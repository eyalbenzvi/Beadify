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
   - Exports: PNG with a choice of resolution, vector SVG, a multi-page PDF (A4 or US Letter: overview, legend, one page per 29×29 board), and a print layout.
   - Keyboard editing: focus the grid, use the arrow keys to move, and press Enter to apply the active tool.

The current project autosaves locally and is restored on reload.

## Architecture notes

- **Off-main-thread conversion.** `src/lib/imageProcessing.ts` rasterises the crop (DOM).
  The pure `src/lib/patternEngine.ts` (linear-light pooling, CIEDE2000 matching, dithering)
  runs in `src/workers/pattern.worker.ts` through `src/lib/patternClient.ts`, which transfers
  buffers, drops stale preview requests and falls back to synchronous processing.
- **Design tokens.** Semantic colours (`ink`, `surface`, `line`, `inverse`) are CSS variables
  mapped in `tailwind.config.js`. The app honours `prefers-reduced-motion` and has an `ErrorBoundary`
  around each step.
- **Export engine.** PDF, SVG and print share tiling, symbols and `PAGE_SIZES`
  (`src/lib/pageGeometry.ts`). jsPDF is lazy-loaded.

## Project skills

`.claude/skills/` contains three Claude Code skills that encode this project's conventions:

| Skill | Scope |
| --- | --- |
| `canvas-image-processing` | Image pipeline, workers, colour science, canvas limits |
| `react-tailwind-design-system` | Tokens, layout, accessibility, motion, React patterns |
| `export-print-engine` | PNG / SVG / PDF / print output and pagination |

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
  lib/          color science (CIEDE2000), image processing, pattern engine, quantization, PNG/SVG/PDF export
  steps/        The four wizard steps
  workers/      Pattern conversion Web Worker
```

Bead hex values are approximations of real bead colours. Actual colours vary by production batch.
