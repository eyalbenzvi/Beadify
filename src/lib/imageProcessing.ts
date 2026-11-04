import type {
  Adjustments,
  BeadColor,
  ConversionSettings,
  CropRect,
  Pattern,
  SourceImage,
} from '../types';
import { createMatcher } from './quantize';

export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp', 'image/svg+xml'];
const MAX_SOURCE_DIMENSION = 2048;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

export class ImageLoadError extends Error {}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new ImageLoadError('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ImageLoadError('The image could not be decoded. It may be corrupted or in an unsupported format.'));
    img.src = src;
  });
}

function createCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context is unavailable in this browser.');
  return { canvas, ctx };
}

/** Normalises any loaded image into a bounded-size raster SourceImage. */
async function toSourceImage(img: HTMLImageElement, name: string): Promise<SourceImage> {
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;
  if (!naturalW || !naturalH) throw new ImageLoadError('The image has no dimensions.');
  const scale = Math.min(1, MAX_SOURCE_DIMENSION / Math.max(naturalW, naturalH));
  const w = Math.round(naturalW * scale);
  const h = Math.round(naturalH * scale);
  const { canvas, ctx } = createCanvas(w, h);
  ctx.imageSmoothingEnabled = scale < 1;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  const dataUrl = canvas.toDataURL('image/png');
  const element = await loadImageElement(dataUrl);
  return { name, dataUrl, width: w, height: h, element };
}

export async function loadImageFromFile(file: File): Promise<SourceImage> {
  const typeOk = ACCEPTED_TYPES.includes(file.type) || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name);
  if (!typeOk) {
    throw new ImageLoadError(`"${file.name}" is not a supported image. Please use PNG, JPEG or WebP.`);
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ImageLoadError('That file is larger than 25 MB. Please choose a smaller image.');
  }
  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImageElement(dataUrl);
  return toSourceImage(img, file.name.replace(/\.[^.]+$/, '') || 'image');
}

export async function loadImageFromDataUrl(dataUrl: string, name: string): Promise<SourceImage> {
  const img = await loadImageElement(dataUrl);
  return toSourceImage(img, name);
}

export type SourceTransform = 'rotate-cw' | 'rotate-ccw' | 'flip-h' | 'flip-v';

export async function transformSource(src: SourceImage, op: SourceTransform): Promise<SourceImage> {
  const rotate = op === 'rotate-cw' || op === 'rotate-ccw';
  const w = rotate ? src.height : src.width;
  const h = rotate ? src.width : src.height;
  const { canvas, ctx } = createCanvas(w, h);
  ctx.translate(w / 2, h / 2);
  if (op === 'rotate-cw') ctx.rotate(Math.PI / 2);
  if (op === 'rotate-ccw') ctx.rotate(-Math.PI / 2);
  if (op === 'flip-h') ctx.scale(-1, 1);
  if (op === 'flip-v') ctx.scale(1, -1);
  ctx.drawImage(src.element, -src.width / 2, -src.height / 2);
  const dataUrl = canvas.toDataURL('image/png');
  const element = await loadImageElement(dataUrl);
  return { name: src.name, dataUrl, width: w, height: h, element };
}

/** Applies brightness / contrast / saturation to RGBA data in place. */
export function applyAdjustments(data: Uint8ClampedArray, adj: Adjustments): void {
  const { brightness, contrast, saturation } = adj;
  if (brightness === 0 && contrast === 0 && saturation === 0) return;
  const bOffset = brightness * 1.28;
  const c = contrast * 2.55;
  const cFactor = (259 * (c + 255)) / (255 * (259 - c));
  const sFactor = 1 + saturation / 100;
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] + bOffset;
    let g = data[i + 1] + bOffset;
    let b = data[i + 2] + bOffset;
    r = cFactor * (r - 128) + 128;
    g = cFactor * (g - 128) + 128;
    b = cFactor * (b - 128) + 128;
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    data[i] = gray + (r - gray) * sFactor;
    data[i + 1] = gray + (g - gray) * sFactor;
    data[i + 2] = gray + (b - gray) * sFactor;
  }
}

export function cropToPixels(src: SourceImage, crop: CropRect) {
  const sx = Math.max(0, Math.round(crop.x * src.width));
  const sy = Math.max(0, Math.round(crop.y * src.height));
  const sw = Math.max(1, Math.min(src.width - sx, Math.round(crop.w * src.width)));
  const sh = Math.max(1, Math.min(src.height - sy, Math.round(crop.h * src.height)));
  return { sx, sy, sw, sh };
}

/** Renders the cropped and adjusted region into the given canvas (for live preview). */
export function renderAdjustedCrop(
  target: HTMLCanvasElement,
  src: SourceImage,
  crop: CropRect,
  adj: Adjustments,
  maxSize: number,
): void {
  const { sx, sy, sw, sh } = cropToPixels(src, crop);
  const scale = Math.min(1, maxSize / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  target.width = w;
  target.height = h;
  const ctx = target.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src.element, sx, sy, sw, sh, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  applyAdjustments(imageData.data, adj);
  ctx.putImageData(imageData, 0, 0);
}

interface Placement {
  /** Source rect in image pixels */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** Destination rect in grid cells */
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

function computePlacement(
  src: SourceImage,
  crop: CropRect,
  gridW: number,
  gridH: number,
  fit: ConversionSettings['fit'],
): Placement {
  let { sx, sy, sw, sh } = cropToPixels(src, crop);
  const srcAspect = sw / sh;
  const gridAspect = gridW / gridH;
  let dx = 0;
  let dy = 0;
  let dw = gridW;
  let dh = gridH;

  if (fit === 'fill') {
    if (srcAspect > gridAspect) {
      const newW = sh * gridAspect;
      sx += (sw - newW) / 2;
      sw = newW;
    } else {
      const newH = sw / gridAspect;
      sy += (sh - newH) / 2;
      sh = newH;
    }
  } else if (fit === 'fit') {
    if (srcAspect > gridAspect) {
      dh = Math.max(1, Math.round(gridW / srcAspect));
      dy = Math.floor((gridH - dh) / 2);
    } else {
      dw = Math.max(1, Math.round(gridH * srcAspect));
      dx = Math.floor((gridW - dw) / 2);
    }
  }
  return { sx, sy, sw, sh, dx, dy, dw, dh };
}

export interface GenerateInput {
  src: SourceImage;
  crop: CropRect;
  adjustments: Adjustments;
  width: number;
  height: number;
  settings: ConversionSettings;
  palette: BeadColor[];
}

/**
 * Downsamples the image with area-average pooling, then maps every cell to the
 * nearest bead colour that exists in the supplied (inventory) palette.
 */
export function generatePattern(input: GenerateInput): Pattern {
  const { src, crop, adjustments, width, height, settings, palette } = input;
  if (palette.length === 0) {
    throw new Error('Your inventory is empty. Select at least one bead colour.');
  }
  const p = computePlacement(src, crop, width, height, settings.fit);

  // Supersample factor: render the region at k× the destination size, then box-average.
  const k = Math.max(1, Math.min(8, Math.ceil(Math.max(p.sw / p.dw, p.sh / p.dh))));
  const rw = p.dw * k;
  const rh = p.dh * k;
  const dominant = settings.sampling === 'dominant';
  const { ctx } = createCanvas(rw, rh);
  // Majority voting needs unblended source pixels; averaging benefits from smoothing.
  ctx.imageSmoothingEnabled = !dominant;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src.element, p.sx, p.sy, p.sw, p.sh, 0, 0, rw, rh);
  const raw = ctx.getImageData(0, 0, rw, rh).data;
  applyAdjustments(raw, adjustments);

  // Average pooling (alpha-weighted) into float buffers.
  const count = width * height;
  const rBuf = new Float32Array(count);
  const gBuf = new Float32Array(count);
  const bBuf = new Float32Array(count);
  const empty = new Uint8Array(count);
  empty.fill(settings.transparentAsEmpty ? 1 : 0);
  if (!settings.transparentAsEmpty) {
    rBuf.fill(255);
    gBuf.fill(255);
    bBuf.fill(255);
  }

  const blockArea = k * k;
  for (let cy = 0; cy < p.dh; cy++) {
    for (let cx = 0; cx < p.dw; cx++) {
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let sa = 0;
      for (let yy = 0; yy < k; yy++) {
        let idx = ((cy * k + yy) * rw + cx * k) * 4;
        for (let xx = 0; xx < k; xx++) {
          const a = raw[idx + 3] / 255;
          sr += raw[idx] * a;
          sg += raw[idx + 1] * a;
          sb += raw[idx + 2] * a;
          sa += a;
          idx += 4;
        }
      }
      const out = (cy + p.dy) * width + (cx + p.dx);
      const coverage = sa / blockArea;
      if (settings.transparentAsEmpty) {
        if (coverage < 0.5) {
          empty[out] = 1;
          continue;
        }
        empty[out] = 0;
        rBuf[out] = sr / sa;
        gBuf[out] = sg / sa;
        bBuf[out] = sb / sa;
      } else {
        // Composite over white.
        const white = (1 - coverage) * 255;
        rBuf[out] = sr / blockArea + white;
        gBuf[out] = sg / blockArea + white;
        bBuf[out] = sb / blockArea + white;
        empty[out] = 0;
      }
    }
  }

  const quantizeWith = (pal: BeadColor[]): (string | null)[] => {
    const matcher = createMatcher(pal, settings.distance);
    const r = Float32Array.from(rBuf);
    const g = Float32Array.from(gBuf);
    const b = Float32Array.from(bBuf);
    const cells: (string | null)[] = new Array(count).fill(null);
    const dither = settings.dither === 'floyd-steinberg';
    const spread = (i: number, er: number, eg: number, eb: number, f: number) => {
      if (empty[i]) return;
      r[i] += er * f;
      g[i] += eg * f;
      b[i] += eb * f;
    };
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (empty[i]) continue;
        const cr = r[i] < 0 ? 0 : r[i] > 255 ? 255 : r[i];
        const cg = g[i] < 0 ? 0 : g[i] > 255 ? 255 : g[i];
        const cb = b[i] < 0 ? 0 : b[i] > 255 ? 255 : b[i];
        const bead = matcher(cr, cg, cb);
        cells[i] = bead.id;
        if (dither) {
          const er = cr - bead.rgb.r;
          const eg = cg - bead.rgb.g;
          const eb = cb - bead.rgb.b;
          if (x + 1 < width) spread(i + 1, er, eg, eb, 7 / 16);
          if (y + 1 < height) {
            if (x > 0) spread(i + width - 1, er, eg, eb, 3 / 16);
            spread(i + width, er, eg, eb, 5 / 16);
            if (x + 1 < width) spread(i + width + 1, er, eg, eb, 1 / 16);
          }
        }
      }
    }
    return cells;
  };

  /** Majority vote of the palette colour of every sub-sample in each cell. */
  const dominantWith = (pal: BeadColor[]): (string | null)[] => {
    const matcher = createMatcher(pal, settings.distance);
    const cells: (string | null)[] = new Array(count).fill(null);
    const votes = new Map<string, number>();
    for (let cy = 0; cy < p.dh; cy++) {
      for (let cx = 0; cx < p.dw; cx++) {
        const out = (cy + p.dy) * width + (cx + p.dx);
        if (empty[out]) continue;
        votes.clear();
        let best: string | null = null;
        let bestVotes = 0;
        for (let yy = 0; yy < k; yy++) {
          let idx = ((cy * k + yy) * rw + cx * k) * 4;
          for (let xx = 0; xx < k; xx++, idx += 4) {
            const a = raw[idx + 3] / 255;
            let r = raw[idx];
            let g = raw[idx + 1];
            let b = raw[idx + 2];
            if (settings.transparentAsEmpty) {
              if (a < 0.5) continue;
            } else {
              // Composite over white.
              const white = (1 - a) * 255;
              r = r * a + white;
              g = g * a + white;
              b = b * a + white;
            }
            const id = matcher(r, g, b).id;
            const n = (votes.get(id) ?? 0) + 1;
            votes.set(id, n);
            if (n > bestVotes) {
              bestVotes = n;
              best = id;
            }
          }
        }
        cells[out] = best;
      }
    }
    return cells;
  };

  const run = dominant ? dominantWith : quantizeWith;
  let cells = run(palette);

  if (settings.maxColors > 0) {
    const counts = new Map<string, number>();
    for (const id of cells) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    if (counts.size > settings.maxColors) {
      const keep = new Set(
        [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, settings.maxColors).map(([id]) => id),
      );
      cells = run(palette.filter((c) => keep.has(c.id)));
    }
  }

  return { width, height, cells, createdAt: Date.now(), edited: false };
}
