import type {
  Adjustments,
  BeadColor,
  ConversionSettings,
  CropRect,
  SourceImage,
} from '../types';
import { applyAdjustments, type RegionData } from './patternEngine';

export { applyAdjustments };

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
 * DOM half of the pipeline: rasterises the placed crop region at k× the
 * destination cell size and returns the raw RGBA samples. Everything after this
 * is pure math (see patternEngine.ts) and can run in a worker.
 */
export function extractRegion(input: GenerateInput): RegionData {
  const { src, crop, width, height, settings } = input;
  const p = computePlacement(src, crop, width, height, settings.fit);
  // Supersample factor: render the region at k× the destination size, then pool.
  const k = Math.max(1, Math.min(8, Math.ceil(Math.max(p.sw / p.dw, p.sh / p.dh))));
  const rw = p.dw * k;
  const rh = p.dh * k;
  const { ctx } = createCanvas(rw, rh);
  // Majority voting needs unblended source pixels; averaging benefits from smoothing.
  ctx.imageSmoothingEnabled = settings.sampling !== 'dominant';
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src.element, p.sx, p.sy, p.sw, p.sh, 0, 0, rw, rh);
  const data = ctx.getImageData(0, 0, rw, rh).data;
  return { data, rw, rh, k, dx: p.dx, dy: p.dy, dw: p.dw, dh: p.dh };
}
