---
name: export-print-engine
description: Client-Side Export & Print Engine Expert for Beadify. Use when working on PNG/SVG/PDF export, the print view, page layout, pagination, legends or file downloads (src/lib/render.ts, src/lib/exportPdf.ts, src/lib/exportSvg.ts, src/components/PrintView.tsx, @media print CSS).
---

# Client-Side Export & Print Engine Expert

## Principles

1. **Vector where it matters.** Pattern grids in PDF, SVG and print are vector shapes
   (rects and text), never a raster screenshot, so they stay sharp at any zoom or printer
   DPI. Raster is only for the overview thumbnail and the PNG export.
2. **Lazy-load heavy libraries.** `jspdf` is imported with `await import('jspdf')` only when
   the user exports. Never list it in `manualChunks` (that adds a `modulepreload`).
3. **One layout model, many outputs.** Tiling (`computeTiles`), symbols (`computeUsage`)
   and page geometry (`PAGE_SIZES`) are shared by the PDF, SVG and print paths, so every
   output agrees on board numbering and symbols.
4. **Board-aligned pagination.** One page per 29×29 pegboard section, labelled with
   global coordinates (A–Z…, 1–N). A mini-map shows where the section sits. Each page has
   a per-board bead count.
5. **Fonts:** jsPDF standard fonts only support WinAnsi, so symbols must stay ASCII
   (see `SYMBOLS` in `src/lib/pattern.ts`).

## Page sizes

- Support A4 (210×297 mm) and US Letter (215.9×279.4 mm). The chosen size drives both
  jsPDF `format` and a dynamically injected `@page { size: … }` rule for printing.
- Margins of at least 10 mm. Cell size is capped at 9 mm and chosen to fill the printable
  area.

## PNG

- Cap the longest side at 8000 px. Use `canvas.toBlob` (not `toDataURL`) for downloads,
  and reject with a friendly error when the blob is null (browser canvas limit).
- Offer a resolution choice (cell px) and respect the symbols and grid toggles.

## SVG

- Self-contained: inline styles, no external fonts required (generic family fallback),
  `viewBox` set, symbol text with `text-anchor="middle"` and `dominant-baseline="central"`.
- Escape text (`&`, `<`, `>`) before writing it into markup.

## Print

- The print DOM is portalled to `body` (outside `#root`) and only mounted while printing.
  Print is triggered after a paint (`requestAnimationFrame` plus a timeout), and the DOM is
  torn down on `afterprint`.
- `print-color-adjust: exact` keeps swatches. Each page section uses `break-after: page`,
  and legend rows use `break-inside: avoid`.

## Downloads

- Create an object URL, click a temporary `<a download>`, then revoke after a delay.
  Filenames go through `safeFilename()`.

## Checklist

- [ ] PDF opens with N+1 pages for N boards, and coordinates match the editor rulers.
- [ ] Print preview shows no app chrome.
- [ ] SVG validates and opens in a browser.
- [ ] `npm run build` passes.
