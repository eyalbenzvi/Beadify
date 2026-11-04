import type { ColorUsage, Pattern, ViewPreferences } from '../types';
import { BEAD_BY_ID } from '../data/beadColors';
import { contrastText } from './color';
import { boardsNeeded, columnLabel, PEGBOARD_SIZE, totalBeads } from './pattern';

/** Draws one bead (or square tile) with a subtle highlight to look like a fused bead. */
export function drawBead(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  hex: string,
  style: ViewPreferences['beadStyle'],
): void {
  if (style === 'square' || size < 6) {
    ctx.fillStyle = hex;
    ctx.fillRect(px, py, size, size);
    return;
  }
  const cx = px + size / 2;
  const cy = py + size / 2;
  const r = size * 0.46;
  ctx.fillStyle = hex;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // Centre hole
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.36, 0, Math.PI * 2);
  ctx.fill();
  // Highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(1, size * 0.06);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.7, Math.PI * 1.05, Math.PI * 1.55);
  ctx.stroke();
}

export function drawSymbol(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  symbol: string,
  rgb: { r: number; g: number; b: number },
): void {
  ctx.fillStyle = contrastText(rgb);
  ctx.font = `800 ${Math.round(size * (symbol.length > 1 ? 0.42 : 0.56))}px Nunito, ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, px + size / 2, py + size / 2 + size * 0.03);
}

/** 1 pixel-per-bead (scaled) thumbnail, used for quick previews. */
export function drawPatternThumbnail(canvas: HTMLCanvasElement, pattern: Pattern, cell: number): void {
  canvas.width = pattern.width * cell;
  canvas.height = pattern.height * cell;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < pattern.height; y++) {
    for (let x = 0; x < pattern.width; x++) {
      const id = pattern.cells[y * pattern.width + x];
      if (!id) continue;
      const c = BEAD_BY_ID.get(id);
      if (!c) continue;
      drawBead(ctx, x * cell, y * cell, cell, c.hex, cell >= 6 ? 'round' : 'square');
    }
  }
}

export interface ExportOptions {
  showSymbols: boolean;
  showGrid: boolean;
  beadStyle: ViewPreferences['beadStyle'];
  title: string;
  includeLegend: boolean;
}

const MAX_EXPORT_SIDE = 8000;

/** Renders a high-resolution, self-contained pattern image with axes and legend. */
export function renderPatternExport(pattern: Pattern, usage: ColorUsage[], opts: ExportOptions): HTMLCanvasElement {
  const { width, height } = pattern;
  const cell = Math.max(10, Math.min(32, Math.floor(MAX_EXPORT_SIDE / (Math.max(width, height) + 4))));
  const axis = Math.round(cell * 1.6);
  const pad = Math.round(cell * 1.2);
  const header = Math.round(cell * 3);
  const gridW = width * cell;
  const gridH = height * cell;

  const legendCols = Math.max(1, Math.floor((gridW + axis * 2) / (cell * 11)));
  const legendRowH = Math.round(cell * 1.5);
  const legendRows = opts.includeLegend ? Math.ceil(usage.length / legendCols) : 0;
  const legendH = opts.includeLegend ? Math.round(cell * 2.4) + legendRows * legendRowH + pad : 0;

  const canvas = document.createElement('canvas');
  canvas.width = pad * 2 + axis * 2 + gridW;
  canvas.height = pad * 2 + header + axis * 2 + gridH + legendH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable.');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Header
  ctx.fillStyle = '#1F2937';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${Math.round(cell * 1.1)}px Nunito, ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText(opts.title, pad, pad + cell * 1.2);
  const boards = boardsNeeded(width, height);
  ctx.font = `600 ${Math.round(cell * 0.6)}px Nunito, ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = '#6B7280';
  ctx.fillText(
    `${width} × ${height} pegs · ${totalBeads(pattern).toLocaleString()} beads · ${usage.length} colours · ${boards.total} board${boards.total === 1 ? '' : 's'} · Made with Beadify`,
    pad,
    pad + cell * 2.2,
  );

  const ox = pad + axis;
  const oy = pad + header + axis;

  // Cells
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(ox, oy, gridW, gridH);
  const symbols = new Map(usage.map((u) => [u.color.id, u]));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const id = pattern.cells[y * width + x];
      if (!id) continue;
      const u = symbols.get(id);
      const c = u?.color ?? BEAD_BY_ID.get(id);
      if (!c) continue;
      const px = ox + x * cell;
      const py = oy + y * cell;
      drawBead(ctx, px, py, cell, c.hex, opts.showSymbols ? 'square' : opts.beadStyle);
      if (opts.showSymbols && u) drawSymbol(ctx, px, py, cell, u.symbol, c.rgb);
    }
  }

  // Grid lines
  if (opts.showGrid) {
    for (let i = 0; i <= width; i++) {
      const major = i % 10 === 0 || i === width;
      const board = i % PEGBOARD_SIZE === 0;
      ctx.strokeStyle = board ? '#DB2777' : major ? '#64748B' : 'rgba(100,116,139,0.35)';
      ctx.lineWidth = board ? 2.5 : major ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(ox + i * cell + 0.5, oy);
      ctx.lineTo(ox + i * cell + 0.5, oy + gridH);
      ctx.stroke();
    }
    for (let j = 0; j <= height; j++) {
      const major = j % 10 === 0 || j === height;
      const board = j % PEGBOARD_SIZE === 0;
      ctx.strokeStyle = board ? '#DB2777' : major ? '#64748B' : 'rgba(100,116,139,0.35)';
      ctx.lineWidth = board ? 2.5 : major ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(ox, oy + j * cell + 0.5);
      ctx.lineTo(ox + gridW, oy + j * cell + 0.5);
      ctx.stroke();
    }
  }

  // Axes (top/bottom letters, left/right numbers)
  ctx.fillStyle = '#475569';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let x = 0; x < width; x++) {
    const label = columnLabel(x);
    ctx.font = `700 ${Math.round(cell * (label.length > 1 ? 0.42 : 0.55))}px Nunito, ui-sans-serif, system-ui, sans-serif`;
    const cx = ox + x * cell + cell / 2;
    ctx.fillText(label, cx, oy - axis / 2);
    ctx.fillText(label, cx, oy + gridH + axis / 2);
  }
  for (let y = 0; y < height; y++) {
    const label = String(y + 1);
    ctx.font = `700 ${Math.round(cell * (label.length > 2 ? 0.42 : 0.52))}px Nunito, ui-sans-serif, system-ui, sans-serif`;
    const cy = oy + y * cell + cell / 2;
    ctx.fillText(label, ox - axis / 2, cy);
    ctx.fillText(label, ox + gridW + axis / 2, cy);
  }

  // Legend
  if (opts.includeLegend) {
    let ly = oy + gridH + axis + pad;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#1F2937';
    ctx.font = `800 ${Math.round(cell * 0.85)}px Nunito, ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText('Colour legend', pad, ly + cell);
    ly += Math.round(cell * 2.0);
    const colW = (canvas.width - pad * 2) / legendCols;
    usage.forEach((u, i) => {
      const col = i % legendCols;
      const row = Math.floor(i / legendCols);
      const lx = pad + col * colW;
      const y = ly + row * legendRowH;
      drawBead(ctx, lx, y, cell, u.color.hex, 'square');
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(lx + 0.5, y + 0.5, cell - 1, cell - 1);
      drawSymbol(ctx, lx, y, cell, u.symbol, u.color.rgb);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#1F2937';
      ctx.font = `700 ${Math.round(cell * 0.5)}px Nunito, ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(`${u.color.code} ${u.color.name}`, lx + cell * 1.3, y + cell * 0.32);
      ctx.fillStyle = '#6B7280';
      ctx.font = `600 ${Math.round(cell * 0.42)}px Nunito, ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(`× ${u.count.toLocaleString()}  ·  ${u.color.hex}`, lx + cell * 1.3, y + cell * 0.8);
    });
  }

  return canvas;
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('The image is too large for this browser to export.'));
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      resolve();
    }, 'image/png');
  });
}

export function safeFilename(name: string): string {
  return (name || 'pattern').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'pattern';
}
