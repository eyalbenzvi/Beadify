import type { ColorUsage, Pattern } from '../types';
import { contrastText } from './color';
import { boardsNeeded, columnLabel, PEGBOARD_SIZE, totalBeads } from './pattern';
import { downloadBlob, safeFilename } from './render';

export interface SvgOptions {
  title: string;
  showSymbols: boolean;
  showGrid: boolean;
}

const CELL = 20;
const AXIS = 28;
const PAD = 24;
const HEADER = 56;
const FONT = "font-family=\"Nunito, 'Helvetica Neue', Arial, sans-serif\"";

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Builds a self-contained vector SVG of the whole pattern with coordinates,
 * pegboard boundaries, optional symbols and a colour legend.
 */
export function buildPatternSvg(pattern: Pattern, usage: ColorUsage[], opts: SvgOptions): string {
  const { width, height } = pattern;
  const gridW = width * CELL;
  const gridH = height * CELL;
  const ox = PAD + AXIS;
  const oy = PAD + HEADER + AXIS;
  const totalW = Math.max(PAD * 2 + AXIS * 2 + gridW, 520);
  const legendCols = Math.max(1, Math.floor((totalW - PAD * 2) / 230));
  const legendRows = Math.ceil(usage.length / legendCols);
  const legendTop = oy + gridH + AXIS + 20;
  const totalH = legendTop + 30 + legendRows * 30 + PAD;
  const symbols = new Map(usage.map((u) => [u.color.id, u]));
  const boards = boardsNeeded(width, height);
  const out: string[] = [];

  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}" ${FONT}>`,
    `<rect width="100%" height="100%" fill="#FFFFFF"/>`,
    `<text x="${PAD}" y="${PAD + 22}" font-size="22" font-weight="800" fill="#1F2937">${esc(opts.title)}</text>`,
    `<text x="${PAD}" y="${PAD + 44}" font-size="12" font-weight="600" fill="#6B7280">${esc(
      `${width} × ${height} pegs · ${totalBeads(pattern).toLocaleString()} beads · ${usage.length} colours · ${boards.total} board${boards.total === 1 ? '' : 's'} · Made with Beadify`,
    )}</text>`,
    `<rect x="${ox}" y="${oy}" width="${gridW}" height="${gridH}" fill="#F8FAFC"/>`,
  );

  // Cells
  out.push('<g>');
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const id = pattern.cells[y * width + x];
      if (!id) continue;
      const u = symbols.get(id);
      if (!u) continue;
      const px = ox + x * CELL;
      const py = oy + y * CELL;
      out.push(`<rect x="${px}" y="${py}" width="${CELL}" height="${CELL}" fill="${u.color.hex}"/>`);
      if (opts.showSymbols) {
        out.push(
          `<text x="${px + CELL / 2}" y="${py + CELL / 2}" font-size="${u.symbol.length > 1 ? 9 : 12}" font-weight="800" text-anchor="middle" dominant-baseline="central" fill="${contrastText(u.color.rgb)}">${esc(u.symbol)}</text>`,
        );
      }
    }
  }
  out.push('</g>');

  // Grid
  if (opts.showGrid) {
    out.push('<g stroke-linecap="square">');
    for (let i = 0; i <= width; i++) {
      const major = i % 10 === 0 || i === width;
      out.push(
        `<line x1="${ox + i * CELL}" y1="${oy}" x2="${ox + i * CELL}" y2="${oy + gridH}" stroke="${major ? '#64748B' : '#CBD5E1'}" stroke-width="${major ? 1.2 : 0.6}"/>`,
      );
    }
    for (let j = 0; j <= height; j++) {
      const major = j % 10 === 0 || j === height;
      out.push(
        `<line x1="${ox}" y1="${oy + j * CELL}" x2="${ox + gridW}" y2="${oy + j * CELL}" stroke="${major ? '#64748B' : '#CBD5E1'}" stroke-width="${major ? 1.2 : 0.6}"/>`,
      );
    }
    out.push('</g>');
  }

  // Pegboard boundaries
  out.push('<g stroke="#DB2777" stroke-width="2" stroke-dasharray="6 4" fill="none">');
  for (let x = PEGBOARD_SIZE; x < width; x += PEGBOARD_SIZE) out.push(`<line x1="${ox + x * CELL}" y1="${oy}" x2="${ox + x * CELL}" y2="${oy + gridH}"/>`);
  for (let y = PEGBOARD_SIZE; y < height; y += PEGBOARD_SIZE) out.push(`<line x1="${ox}" y1="${oy + y * CELL}" x2="${ox + gridW}" y2="${oy + y * CELL}"/>`);
  out.push(`</g><rect x="${ox}" y="${oy}" width="${gridW}" height="${gridH}" fill="none" stroke="#475569" stroke-width="1.5"/>`);

  // Axes
  out.push('<g font-size="10" font-weight="700" fill="#475569" text-anchor="middle" dominant-baseline="central">');
  for (let x = 0; x < width; x++) {
    const cx = ox + x * CELL + CELL / 2;
    const label = esc(columnLabel(x));
    out.push(`<text x="${cx}" y="${oy - AXIS / 2}">${label}</text><text x="${cx}" y="${oy + gridH + AXIS / 2}">${label}</text>`);
  }
  for (let y = 0; y < height; y++) {
    const cy = oy + y * CELL + CELL / 2;
    out.push(`<text x="${ox - AXIS / 2}" y="${cy}">${y + 1}</text><text x="${ox + gridW + AXIS / 2}" y="${cy}">${y + 1}</text>`);
  }
  out.push('</g>');

  // Legend
  out.push(`<text x="${PAD}" y="${legendTop + 12}" font-size="16" font-weight="800" fill="#1F2937">Colour legend</text>`);
  const colW = (totalW - PAD * 2) / legendCols;
  usage.forEach((u, i) => {
    const lx = PAD + (i % legendCols) * colW;
    const ly = legendTop + 28 + Math.floor(i / legendCols) * 30;
    out.push(
      `<rect x="${lx}" y="${ly}" width="22" height="22" rx="3" fill="${u.color.hex}" stroke="rgba(0,0,0,0.2)"/>`,
      `<text x="${lx + 11}" y="${ly + 11}" font-size="12" font-weight="800" text-anchor="middle" dominant-baseline="central" fill="${contrastText(u.color.rgb)}">${esc(u.symbol)}</text>`,
      `<text x="${lx + 30}" y="${ly + 9}" font-size="11" font-weight="700" fill="#1F2937">${esc(`${u.color.code} ${u.color.name}`)}</text>`,
      `<text x="${lx + 30}" y="${ly + 21}" font-size="10" fill="#6B7280">${esc(`× ${u.count.toLocaleString()} · ${u.color.hex}`)}</text>`,
    );
  });

  out.push('</svg>');
  return out.join('\n');
}

export function exportPatternSvg(pattern: Pattern, usage: ColorUsage[], opts: SvgOptions): void {
  const svg = buildPatternSvg(pattern, usage, opts);
  downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${safeFilename(opts.title)}.svg`);
}
