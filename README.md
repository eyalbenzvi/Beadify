# Beadify

Turn any image into a fuse-bead (Perler / Hama) pattern that uses **only the bead colours you own**.
Everything runs in the browser. Images never leave the device.

## Features

1. **Upload / Presets**: drag-and-drop or file picker (PNG, JPEG, WebP), mobile camera capture, and 7 built-in samples.
2. **Crop & Adjust**: interactive crop with free and fixed aspect ratios (1:1, 4:3, 3:4, 16:9, 2:1, 1:2), rotate/flip, brightness/contrast/saturation, and a live preview.
3. **Inventory & Board**:
   - Board presets (15×15, 29×29, 58×29, 29×58, 58×58, 87×87) or a custom grid from 5 to 200.
   - 65 Perler and 48 Hama colours with code, name and hex.
   - Inventory quick presets (full palette, Basic 24, clear), search, colour-family filters. Saved to localStorage.
   - Conversion options: CIEDE2000 or weighted-RGB matching, average or dominant sampling, Floyd–Steinberg dithering, a max-colour limit, fit/fill/stretch, and transparent areas as empty pegs.
4. **Pattern Editor & Export**:
   - Canvas grid with wheel/pinch zoom and pan, A–Z / 1–N rulers, pegboard boundaries, round or square beads.
   - Grid and symbol toggles.
   - Tools: select (opens a picker limited to your inventory, with "replace all"), paint, erase, flood fill, eyedropper and pan.
   - Undo/redo and keyboard shortcuts.
   - Hover tooltip with bead name, code, symbol and coordinates.
   - Shopping list sorted by quantity, family or code. Click a row to highlight that colour on the grid. Copy to clipboard.
   - Stats (beads, colours, pegboards, build time) and ironing tips.
   - Exports: high-res PNG with axes and legend, a multi-page A4 PDF (overview, legend, one page per 29×29 board), and a print layout.

The current project autosaves locally and is restored on reload.

## Development

```bash
npm install
npm run dev        # start dev server
npm run build      # type-check + production build
npm run preview    # serve the production build
```

Stack: React 18 + TypeScript + Vite, Tailwind CSS, lucide-react, jsPDF (lazy-loaded), Canvas API.

## Project structure

```
src/
  components/   UI building blocks (CropTool, PatternCanvas, InventoryManager, ShoppingList, PrintView, ...)
  context/      AppContext (project state, inventory, history) and ToastContext
  data/         Bead palettes, board presets, sample images
  hooks/        localStorage persistence
  lib/          color science (CIEDE2000), image processing, quantization, pattern utils, PNG/PDF export
  steps/        The four wizard steps
```

Bead hex values are approximations of real bead colours. Actual colours vary by production batch.
