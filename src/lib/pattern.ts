import type { BeadColor, ColorFamily, ColorUsage, Pattern } from '../types';
import { BEAD_BY_ID, COLOR_FAMILIES } from '../data/beadColors';

export const PEGBOARD_SIZE = 29;
export const BEADS_PER_BAG = 1000;

/**
 * Easy-to-distinguish ASCII glyphs (no O/0, I/1/l) so they render identically
 * on screen, in PNG exports and in PDF standard fonts.
 */
const SYMBOLS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  '2', '3', '4', '5', '6', '7', '8', '9',
  'a', 'b', 'd', 'e', 'f', 'g', 'h', 'k', 'm', 'n', 'q', 'r', 't', 'u', 'w', 'y',
  '+', '#', '@', '%', '&', '=', '*', '?', '$', '!', '~', '^', '<', '>', '/',
];
const LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ';

export function symbolFor(index: number): string {
  if (index < SYMBOLS.length) return SYMBOLS[index];
  const j = index - SYMBOLS.length;
  return `${LETTERS[Math.floor(j / 9) % LETTERS.length]}${(j % 9) + 1}`;
}

/** Excel-style column labels: A..Z, AA..AZ, BA.. */
export function columnLabel(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function cellLabel(x: number, y: number): string {
  return `${columnLabel(x)}${y + 1}`;
}

/** Per-colour bead counts with stable symbols (most-used colour gets "A"). */
export function computeUsage(pattern: Pattern): ColorUsage[] {
  const counts = new Map<string, number>();
  for (const id of pattern.cells) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  const entries = [...counts.entries()]
    .map(([id, count]) => ({ color: BEAD_BY_ID.get(id), count }))
    .filter((e): e is { color: BeadColor; count: number } => Boolean(e.color))
    .sort((a, b) => b.count - a.count || a.color.code.localeCompare(b.color.code, undefined, { numeric: true }));
  return entries.map((e, i) => ({ ...e, symbol: symbolFor(i) }));
}

export function symbolMap(usage: ColorUsage[]): Map<string, ColorUsage> {
  return new Map(usage.map((u) => [u.color.id, u]));
}

export function boardsNeeded(width: number, height: number): { across: number; down: number; total: number } {
  const across = Math.ceil(width / PEGBOARD_SIZE);
  const down = Math.ceil(height / PEGBOARD_SIZE);
  return { across, down, total: across * down };
}

export function totalBeads(pattern: Pattern): number {
  let n = 0;
  for (const id of pattern.cells) if (id) n++;
  return n;
}

export function sortUsage(usage: ColorUsage[], by: 'quantity' | 'family' | 'code'): ColorUsage[] {
  const copy = [...usage];
  if (by === 'quantity') return copy.sort((a, b) => b.count - a.count);
  if (by === 'code')
    return copy.sort((a, b) => a.color.code.localeCompare(b.color.code, undefined, { numeric: true }));
  const order = (f: ColorFamily) => COLOR_FAMILIES.indexOf(f);
  return copy.sort(
    (a, b) => order(a.color.family) - order(b.color.family) || a.color.lab.L - b.color.lab.L,
  );
}

/** Flood fill (4-connected) replacing the contiguous region at (x, y). */
export function floodFill(pattern: Pattern, x: number, y: number, value: string | null): (string | null)[] | null {
  const { width, height } = pattern;
  const start = y * width + x;
  const target = pattern.cells[start];
  if (target === value) return null;
  const cells = [...pattern.cells];
  const stack = [start];
  while (stack.length) {
    const i = stack.pop() as number;
    if (cells[i] !== target) continue;
    cells[i] = value;
    const cx = i % width;
    const cy = (i - cx) / width;
    if (cx > 0) stack.push(i - 1);
    if (cx < width - 1) stack.push(i + 1);
    if (cy > 0) stack.push(i - width);
    if (cy < height - 1) stack.push(i + width);
  }
  return cells;
}

/** Replaces every occurrence of one colour with another across the pattern. */
export function replaceColor(pattern: Pattern, from: string, to: string | null): (string | null)[] {
  return pattern.cells.map((c) => (c === from ? to : c));
}

export function estimateMinutes(beads: number): number {
  // Roughly 12 beads per minute for placement plus ironing time per board.
  return Math.round(beads / 12);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
