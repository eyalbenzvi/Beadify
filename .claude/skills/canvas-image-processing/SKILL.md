---
name: canvas-image-processing
description: Advanced Canvas & Image Processing Specialist for Beadify. Use when touching image loading, cropping, adjustments, downsampling, colour quantization, dithering or anything in src/lib/imageProcessing.ts, src/lib/quantize.ts, src/lib/color.ts or src/workers/. Covers colour-correct resampling, off-main-thread processing and canvas memory limits.
---

# Advanced Canvas & Image Processing Specialist

Apply these rules whenever you write or review pixel-processing code in Beadify.

## Pipeline architecture

1. **Decode on the main thread, compute off it.** The DOM is needed only to decode and
   rasterise (`createImageBitmap` / `drawImage`). Everything after `getImageData` is pure
   math and must run in `src/workers/pattern.worker.ts`.
   - Split the work into `extractRegion()` (DOM, returns `ImageData`) and
     `buildPattern()` (pure, worker-safe, no `document`/`window`).
   - Transfer `ImageData.data.buffer` to the worker (`postMessage(msg, [buffer])`). Never copy it.
   - Tag every request with an incrementing id and drop stale responses, so rapid slider
     changes never show an outdated preview.
   - Keep a synchronous fallback for environments where `Worker` fails to construct.
2. **Pure functions stay pure.** `buildPattern` takes typed arrays plus plain-object palettes
   and returns plain data. That keeps it unit-testable in Node.

## Colour correctness

- sRGB values are gamma-encoded. **Average in linear light**: convert with an sRGB→linear
  LUT (256 entries), average, then convert back. Naive sRGB averaging darkens edges and
  shifts hues on high-contrast boundaries such as black outlines next to bright fills.
- Weight averages by alpha (premultiply) so transparent pixels never bleed colour.
- Do perceptual matching in CIELAB with CIEDE2000. Cache results per exact RGB key in a
  `Map<number, …>` with key `(r << 16) | (g << 8) | b`.
- Dithering (Floyd–Steinberg) diffuses error in sRGB space against the matched bead,
  skips empty cells and clamps before matching.
- Majority-vote ("dominant") sampling must render with `imageSmoothingEnabled = false`,
  otherwise the vote counts interpolated colours that never existed.

## Canvas hygiene

- Use `getContext('2d', { willReadFrequently: true })` for any canvas you read back.
- Clamp working rasters: sources are capped at 2048 px, and supersampling is at most 8× per
  cell. Never allocate a canvas over about 16 megapixels (the iOS Safari limit).
- Use DPR-aware display canvases (`canvas.width = cssW * dpr`, `setTransform(dpr…)`), with dpr
  capped at 2.
- Draw only the visible cell range in the viewport renderer. Never build one huge canvas
  for the editor.
- Release object URLs (`URL.revokeObjectURL`) and close `ImageBitmap`s when done.

## Checklist before finishing

- [ ] No `document`/`window` in worker-reachable modules.
- [ ] Stale worker responses are ignored.
- [ ] Linear-light averaging is used for `sampling: 'average'`.
- [ ] `npm run build` passes, and the editor still renders a 200×200 grid smoothly.
