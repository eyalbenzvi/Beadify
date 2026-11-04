import type { BeadColor, DistanceMethod } from '../types';
import { ciede2000, rgbToLab, weightedRgbDistance } from './color';

export type Matcher = (r: number, g: number, b: number) => BeadColor;

/**
 * Creates a memoised nearest-colour lookup restricted to `palette`.
 * Results are cached per exact RGB value so repeated colours (very common in
 * pixel art and flat illustrations) are resolved only once.
 */
export function createMatcher(palette: BeadColor[], method: DistanceMethod): Matcher {
  if (palette.length === 0) throw new Error('Cannot match colours against an empty palette.');
  const cache = new Map<number, BeadColor>();
  return (r, g, b) => {
    const ri = Math.round(r);
    const gi = Math.round(g);
    const bi = Math.round(b);
    const key = (ri << 16) | (gi << 8) | bi;
    const hit = cache.get(key);
    if (hit) return hit;
    let best = palette[0];
    let bestD = Infinity;
    if (method === 'ciede2000') {
      const lab = rgbToLab({ r: ri, g: gi, b: bi });
      for (const c of palette) {
        const d = ciede2000(lab, c.lab);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
    } else {
      const rgb = { r: ri, g: gi, b: bi };
      for (const c of palette) {
        const d = weightedRgbDistance(rgb, c.rgb);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
    }
    cache.set(key, best);
    return best;
  };
}

/** Re-maps every cell of an existing pattern to the nearest colour in `palette`. */
export function remapCells(
  cells: (string | null)[],
  palette: BeadColor[],
  lookup: Map<string, BeadColor>,
  method: DistanceMethod,
): (string | null)[] {
  const allowed = new Set(palette.map((c) => c.id));
  const matcher = createMatcher(palette, method);
  return cells.map((id) => {
    if (!id || allowed.has(id)) return id;
    const color = lookup.get(id);
    if (!color) return null;
    return matcher(color.rgb.r, color.rgb.g, color.rgb.b).id;
  });
}
