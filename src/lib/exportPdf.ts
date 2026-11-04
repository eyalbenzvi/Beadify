import type { ColorUsage, Pattern } from '../types';
import { contrastText, hexToRgb } from './color';
import { boardsNeeded, columnLabel, PEGBOARD_SIZE, totalBeads } from './pattern';
import { drawPatternThumbnail, safeFilename } from './render';

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 12;

export interface PdfOptions {
  title: string;
  showSymbols: boolean;
}

/** Splits the pattern into pegboard-aligned tiles. */
export function computeTiles(width: number, height: number, tile = PEGBOARD_SIZE) {
  const tiles: { x0: number; y0: number; w: number; h: number; col: number; row: number }[] = [];
  for (let y0 = 0, row = 0; y0 < height; y0 += tile, row++) {
    for (let x0 = 0, col = 0; x0 < width; x0 += tile, col++) {
      tiles.push({ x0, y0, w: Math.min(tile, width - x0), h: Math.min(tile, height - y0), col, row });
    }
  }
  return tiles;
}

/**
 * Builds a multi-page A4 PDF: an overview page with the colour legend, then one
 * crisp vector page per 29 × 29 pegboard section with coordinates and symbols.
 */
export async function exportPatternPdf(pattern: Pattern, usage: ColorUsage[], opts: PdfOptions): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const symbols = new Map(usage.map((u) => [u.color.id, u]));
  const boards = boardsNeeded(pattern.width, pattern.height);
  const beads = totalBeads(pattern);
  const tiles = computeTiles(pattern.width, pattern.height);

  const footer = (page: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`${opts.title} · Beadify`, MARGIN, PAGE_H - 6);
    doc.text(`Page ${page}`, PAGE_W - MARGIN, PAGE_H - 6, { align: 'right' });
  };

  // ---------- Overview page ----------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(31, 41, 55);
  doc.text(opts.title, MARGIN, MARGIN + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    `${pattern.width} x ${pattern.height} pegs  |  ${beads.toLocaleString()} beads  |  ${usage.length} colours  |  ${boards.total} pegboard${boards.total === 1 ? '' : 's'} (${boards.across} x ${boards.down})`,
    MARGIN,
    MARGIN + 13,
  );

  const thumb = document.createElement('canvas');
  drawPatternThumbnail(thumb, pattern, Math.max(4, Math.min(16, Math.floor(1200 / Math.max(pattern.width, pattern.height)))));
  const maxImgW = PAGE_W - MARGIN * 2;
  const maxImgH = 115;
  const scale = Math.min(maxImgW / thumb.width, maxImgH / thumb.height);
  const imgW = thumb.width * scale;
  const imgH = thumb.height * scale;
  const imgX = (PAGE_W - imgW) / 2;
  const imgY = MARGIN + 19;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(MARGIN, imgY - 2, maxImgW, imgH + 4, 2, 2, 'F');
  doc.addImage(thumb.toDataURL('image/png'), 'PNG', imgX, imgY, imgW, imgH);

  // Board split overlay on the thumbnail
  if (tiles.length > 1) {
    doc.setDrawColor(219, 39, 119);
    doc.setLineWidth(0.4);
    const cellMm = imgW / pattern.width;
    tiles.forEach((t, i) => {
      doc.rect(imgX + t.x0 * cellMm, imgY + t.y0 * cellMm, t.w * cellMm, t.h * cellMm);
      doc.setFontSize(8);
      doc.setTextColor(219, 39, 119);
      doc.text(`${i + 1}`, imgX + t.x0 * cellMm + 1.2, imgY + t.y0 * cellMm + 3.2);
    });
  }

  // Legend table
  let y = imgY + imgH + 10;
  let page = 1;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(31, 41, 55);
  doc.text('Colour legend & shopping list', MARGIN, y);
  y += 6;
  const colW = (PAGE_W - MARGIN * 2) / 2;
  const rowH = 7.5;
  let col = 0;
  for (const u of usage) {
    if (y + rowH > PAGE_H - 14) {
      if (col === 0) {
        col = 1;
        y = page === 1 ? imgY + imgH + 16 : MARGIN + 6;
      } else {
        footer(page);
        doc.addPage();
        page++;
        col = 0;
        y = MARGIN + 6;
      }
    }
    const x = MARGIN + col * colW;
    const rgb = hexToRgb(u.color.hex);
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.setDrawColor(200);
    doc.setLineWidth(0.2);
    doc.rect(x, y, 6, 6, 'FD');
    const t = hexToRgb(contrastText(rgb));
    doc.setTextColor(t.r, t.g, t.b);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(u.symbol.length > 1 ? 7 : 9);
    doc.text(u.symbol, x + 3, y + 4.2, { align: 'center' });
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(9);
    doc.text(`${u.color.code}  ${u.color.name}`, x + 8, y + 2.8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(`${u.count.toLocaleString()} beads  |  ${u.color.brand}  |  ${u.color.hex}`, x + 8, y + 6);
    y += rowH;
  }
  footer(page);

  // ---------- Board pages ----------
  const axis = 6;
  const top = MARGIN + 16;
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    doc.addPage();
    page++;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(31, 41, 55);
    doc.text(`Board ${i + 1} of ${tiles.length}`, MARGIN, MARGIN + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(
      `Columns ${columnLabel(t.x0)}-${columnLabel(t.x0 + t.w - 1)}, rows ${t.y0 + 1}-${t.y0 + t.h}  ·  Row ${t.row + 1}, column ${t.col + 1} of the ${boards.across} x ${boards.down} board layout`,
      MARGIN,
      MARGIN + 10.5,
    );

    // Mini map
    if (tiles.length > 1) {
      const mm = 3.2;
      const mapX = PAGE_W - MARGIN - boards.across * mm;
      for (const o of tiles) {
        const active = o === t;
        doc.setFillColor(active ? 236 : 241, active ? 72 : 245, active ? 153 : 249);
        doc.setDrawColor(180);
        doc.setLineWidth(0.15);
        doc.rect(mapX + o.col * mm, MARGIN + o.row * mm, mm, mm, 'FD');
      }
    }

    const availW = PAGE_W - MARGIN * 2 - axis * 2;
    const availH = PAGE_H - top - MARGIN - axis * 2 - 4;
    const cell = Math.min(availW / t.w, availH / t.h, 9);
    const gx = (PAGE_W - cell * t.w) / 2;
    const gy = top + axis;

    for (let yy = 0; yy < t.h; yy++) {
      for (let xx = 0; xx < t.w; xx++) {
        const id = pattern.cells[(t.y0 + yy) * pattern.width + (t.x0 + xx)];
        const px = gx + xx * cell;
        const py = gy + yy * cell;
        if (!id) continue;
        const u = symbols.get(id);
        if (!u) continue;
        const rgb = u.color.rgb;
        doc.setFillColor(rgb.r, rgb.g, rgb.b);
        doc.rect(px, py, cell, cell, 'F');
        if (opts.showSymbols) {
          const tc = hexToRgb(contrastText(rgb));
          doc.setTextColor(tc.r, tc.g, tc.b);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(cell * (u.symbol.length > 1 ? 1.45 : 1.9));
          doc.text(u.symbol, px + cell / 2, py + cell * 0.68, { align: 'center' });
        }
      }
    }

    // Grid lines: fine every bead, bold every 5 (global coordinates)
    for (let xx = 0; xx <= t.w; xx++) {
      const g = t.x0 + xx;
      const bold = g % 5 === 0 || xx === 0 || xx === t.w;
      doc.setDrawColor(bold ? 71 : 170, bold ? 85 : 180, bold ? 105 : 195);
      doc.setLineWidth(bold ? 0.35 : 0.12);
      doc.line(gx + xx * cell, gy, gx + xx * cell, gy + t.h * cell);
    }
    for (let yy = 0; yy <= t.h; yy++) {
      const g = t.y0 + yy;
      const bold = g % 5 === 0 || yy === 0 || yy === t.h;
      doc.setDrawColor(bold ? 71 : 170, bold ? 85 : 180, bold ? 105 : 195);
      doc.setLineWidth(bold ? 0.35 : 0.12);
      doc.line(gx, gy + yy * cell, gx + t.w * cell, gy + yy * cell);
    }

    // Axes
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    for (let xx = 0; xx < t.w; xx++) {
      const label = columnLabel(t.x0 + xx);
      doc.setFontSize(Math.min(8, cell * (label.length > 1 ? 1.5 : 2)));
      const cx = gx + xx * cell + cell / 2;
      doc.text(label, cx, gy - 1.8, { align: 'center' });
      doc.text(label, cx, gy + t.h * cell + 4, { align: 'center' });
    }
    for (let yy = 0; yy < t.h; yy++) {
      const label = String(t.y0 + yy + 1);
      doc.setFontSize(Math.min(8, cell * (label.length > 2 ? 1.4 : 1.8)));
      const cy = gy + yy * cell + cell * 0.65;
      doc.text(label, gx - 1.5, cy, { align: 'right' });
      doc.text(label, gx + t.w * cell + 1.5, cy);
    }

    // Per-board count summary
    const counts = new Map<string, number>();
    for (let yy = 0; yy < t.h; yy++)
      for (let xx = 0; xx < t.w; xx++) {
        const id = pattern.cells[(t.y0 + yy) * pattern.width + (t.x0 + xx)];
        if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    let sx = MARGIN;
    let sy = gy + t.h * cell + 10;
    doc.setFontSize(7.5);
    for (const u of usage) {
      const n = counts.get(u.color.id);
      if (!n) continue;
      const label = `${u.symbol} ${u.color.code}: ${n}`;
      const w = doc.getTextWidth(label) + 7;
      if (sx + w > PAGE_W - MARGIN) {
        sx = MARGIN;
        sy += 4.5;
      }
      if (sy > PAGE_H - 10) break;
      doc.setFillColor(u.color.rgb.r, u.color.rgb.g, u.color.rgb.b);
      doc.setDrawColor(190);
      doc.rect(sx, sy - 2.6, 3, 3, 'FD');
      doc.setTextColor(60);
      doc.setFont('helvetica', 'normal');
      doc.text(label, sx + 4, sy);
      sx += w;
    }
    footer(page);
  }

  doc.save(`${safeFilename(opts.title)}-pattern.pdf`);
}
