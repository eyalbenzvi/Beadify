/**
 * Pure, DOM-free half of the conversion pipeline. It runs inside
 * src/workers/pattern.worker.ts and also synchronously as a fallback.
 * Do not import anything that touches `document` or `window` here.
 */
import type { Adjustments, BeadColor, ConversionSettings, Pattern } from '../types';
import { createMatcher } from './quantize';

export interface RegionData {
  /** RGBA samples of the placed region at k× the destination cell size */
  data: Uint8ClampedArray;
  rw: number;
  rh: number;
  /** Samples per cell edge */
  k: number;
  /** Destination rect in grid cells */
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

export interface BuildInput {
  region: RegionData;
  width: number;
  height: number;
  adjustments: Adjustments;
  settings: ConversionSettings;
  palette: BeadColor[];
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

/**
 * Error-diffusion kernels as [dx, dy, weight]. Atkinson only spreads 6/8 of the
 * error, which keeps highlights crisp. That suits bold, high-contrast bead art.
 */
const DIFFUSION_KERNELS: Partial<Record<ConversionSettings['dither'], [number, number, number][]>> = {
  'floyd-steinberg': [
    [1, 0, 7 / 16],
    [-1, 1, 3 / 16],
    [0, 1, 5 / 16],
    [1, 1, 1 / 16],
  ],
  atkinson: [
    [1, 0, 1 / 8],
    [2, 0, 1 / 8],
    [-1, 1, 1 / 8],
    [0, 1, 1 / 8],
    [1, 1, 1 / 8],
    [0, 2, 1 / 8],
  ],
};

const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const BAYER_8 = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
];

/** Ordered (Bayer) threshold matrices for regular, texture-like dithering. */
const BAYER: Partial<Record<ConversionSettings['dither'], { matrix: number[]; size: number; levels: number }>> = {
  bayer4: { matrix: BAYER_4, size: 4, levels: 16 },
  bayer8: { matrix: BAYER_8, size: 8, levels: 64 },
};

/** Amplitude of the ordered-dither offset in sRGB units (about the gap between neighbouring beads). */
const ORDERED_SPREAD = 56;

/** sRGB byte → linear light (0..1) lookup table. */
const SRGB_TO_LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const v = i / 255;
  SRGB_TO_LINEAR[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearToSrgb(l: number): number {
  const v = l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055;
  return v * 255;
}

/**
 * Pools the region into one colour per cell, then maps every cell to the nearest
 * bead in `palette` (the user's inventory).
 *
 * - `average` sampling: alpha-weighted mean computed in **linear light**, so
 *   high-contrast edges keep their brightness and hue.
 * - `dominant` sampling: majority vote of the matched bead per sub-sample.
 */
export function buildPattern(input: BuildInput): Pattern {
  const { region, width, height, adjustments, settings, palette } = input;
  if (palette.length === 0) {
    throw new Error('Your inventory is empty. Select at least one bead colour.');
  }
  const { data: raw, rw, k, dx, dy, dw, dh } = region;
  applyAdjustments(raw, adjustments);

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
  for (let cy = 0; cy < dh; cy++) {
    for (let cx = 0; cx < dw; cx++) {
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let sa = 0;
      for (let yy = 0; yy < k; yy++) {
        let idx = ((cy * k + yy) * rw + cx * k) * 4;
        for (let xx = 0; xx < k; xx++, idx += 4) {
          const a = raw[idx + 3] / 255;
          sr += SRGB_TO_LINEAR[raw[idx]] * a;
          sg += SRGB_TO_LINEAR[raw[idx + 1]] * a;
          sb += SRGB_TO_LINEAR[raw[idx + 2]] * a;
          sa += a;
        }
      }
      const out = (cy + dy) * width + (cx + dx);
      const coverage = sa / blockArea;
      if (settings.transparentAsEmpty) {
        if (coverage < 0.5) {
          empty[out] = 1;
          continue;
        }
        empty[out] = 0;
        rBuf[out] = linearToSrgb(sr / sa);
        gBuf[out] = linearToSrgb(sg / sa);
        bBuf[out] = linearToSrgb(sb / sa);
      } else {
        // Composite over white (white is 1.0 in linear light).
        const white = 1 - coverage;
        rBuf[out] = linearToSrgb(sr / blockArea + white);
        gBuf[out] = linearToSrgb(sg / blockArea + white);
        bBuf[out] = linearToSrgb(sb / blockArea + white);
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
    const kernel = DIFFUSION_KERNELS[settings.dither];
    const bayer = BAYER[settings.dither];
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
        let cr = r[i];
        let cg = g[i];
        let cb = b[i];
        if (bayer) {
          // Ordered dithering: nudge the colour by the normalised threshold before matching.
          const t = (bayer.matrix[(y % bayer.size) * bayer.size + (x % bayer.size)] + 0.5) / bayer.levels - 0.5;
          cr += t * ORDERED_SPREAD;
          cg += t * ORDERED_SPREAD;
          cb += t * ORDERED_SPREAD;
        }
        cr = cr < 0 ? 0 : cr > 255 ? 255 : cr;
        cg = cg < 0 ? 0 : cg > 255 ? 255 : cg;
        cb = cb < 0 ? 0 : cb > 255 ? 255 : cb;
        const bead = matcher(cr, cg, cb);
        cells[i] = bead.id;
        if (kernel) {
          const er = cr - bead.rgb.r;
          const eg = cg - bead.rgb.g;
          const eb = cb - bead.rgb.b;
          for (const [dx2, dy2, f] of kernel) {
            const nx = x + dx2;
            const ny = y + dy2;
            if (nx < 0 || nx >= width || ny >= height) continue;
            spread(ny * width + nx, er, eg, eb, f);
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
    for (let cy = 0; cy < dh; cy++) {
      for (let cx = 0; cx < dw; cx++) {
        const out = (cy + dy) * width + (cx + dx);
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

  const run = settings.sampling === 'dominant' ? dominantWith : quantizeWith;
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
