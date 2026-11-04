import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Grid2x2, LayoutGrid, Settings2, Sparkles, Wand2 } from 'lucide-react';
import type { ConversionSettings, Pattern } from '../types';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { BOARD_PRESETS, MAX_GRID, MIN_GRID } from '../data/boards';
import { BASIC_24 } from '../data/beadColors';
import { renderAdjustedCrop } from '../lib/imageProcessing';
import { createLatestPatternRequester, requestPattern } from '../lib/patternClient';
import { boardsNeeded, computeUsage, totalBeads } from '../lib/pattern';
import { drawPatternThumbnail } from '../lib/render';
import InventoryManager from '../components/InventoryManager';
import { SectionTitle, Segmented, Spinner, Toggle } from '../components/ui';

function clampGrid(v: number): number {
  if (!Number.isFinite(v)) return MIN_GRID;
  return Math.max(MIN_GRID, Math.min(MAX_GRID, Math.round(v)));
}

export default function InventoryStep() {
  const { source, crop, adjustments, board, setBoard, settings, setSettings, palette, setInventory, brand, inventory, setPattern, pattern, setStep } =
    useApp();
  const toast = useToast();
  const [preview, setPreview] = useState<Pattern | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [customW, setCustomW] = useState(String(board.width));
  const [customH, setCustomH] = useState(String(board.height));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestPreview = useMemo(() => createLatestPatternRequester(), []);

  // Debounced live preview, computed in a Web Worker. Only the latest request resolves.
  useEffect(() => {
    if (!source || palette.length === 0) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setComputing(true);
    const handle = window.setTimeout(() => {
      requestPreview({ src: source, crop, adjustments, width: board.width, height: board.height, settings, palette })
        .then((p) => {
          if (cancelled) return;
          setPreview(p);
          setPreviewError(null);
        })
        .catch((err: unknown) => {
          if (!cancelled) setPreviewError(err instanceof Error ? err.message : 'Preview failed.');
        })
        .finally(() => {
          if (!cancelled) setComputing(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [requestPreview, source, crop, adjustments, board.width, board.height, settings, palette]);

  useEffect(() => {
    if (preview && canvasRef.current) drawPatternThumbnail(canvasRef.current, preview, 8);
  }, [preview]);

  if (!source) return null;

  const update = <K extends keyof ConversionSettings>(key: K, value: ConversionSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const applyCustom = () => {
    const w = clampGrid(Number(customW));
    const h = clampGrid(Number(customH));
    setCustomW(String(w));
    setCustomH(String(h));
    setBoard({ preset: 'custom', width: w, height: h });
  };

  const generate = async () => {
    if (palette.length === 0) {
      toast.error('Your inventory is empty', 'Select at least one bead colour to generate a pattern.');
      return;
    }
    if (pattern?.edited && !window.confirm('Regenerating will replace your manual edits in the current pattern. Continue?')) {
      return;
    }
    setGenerating(true);
    try {
      const p = await requestPattern({ src: source, crop, adjustments, width: board.width, height: board.height, settings, palette });
      const colors = computeUsage(p).length;
      setPattern(p);
      toast.success('Pattern generated successfully!', `${p.width} × ${p.height} grid using ${colors} colour${colors === 1 ? '' : 's'}.`);
      setStep(4);
    } catch (err) {
      toast.error('Pattern generation failed', err instanceof Error ? err.message : undefined);
    } finally {
      setGenerating(false);
    }
  };

  const boards = boardsNeeded(board.width, board.height);
  const previewColors = preview ? computeUsage(preview).length : 0;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
      <div className="min-w-0 space-y-6">
        <section className="card p-4 sm:p-5">
          <SectionTitle icon={<LayoutGrid className="h-5 w-5" />} title="Board size" subtitle="Standard pegboards are 29 × 29 pegs." />
          <div className="grid grid-cols-2 gap-2">
            {BOARD_PRESETS.map((b) => {
              const active = board.preset === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setBoard({ preset: b.id, width: b.width, height: b.height });
                    setCustomW(String(b.width));
                    setCustomH(String(b.height));
                  }}
                  aria-pressed={active}
                  className={`rounded-2xl border p-2.5 text-left transition ${
                    active ? 'border-brand-400 bg-brand-50 shadow-sm' : 'border-line-soft bg-white hover:border-brand-200'
                  }`}
                >
                  <span className="block text-sm font-extrabold text-ink-soft">{b.label}</span>
                  <span className="block text-xs text-ink-subtle">{b.description}</span>
                </button>
              );
            })}
          </div>
          <div className={`mt-3 rounded-2xl border p-3 ${board.preset === 'custom' ? 'border-brand-400 bg-brand-50' : 'border-line-soft'}`}>
            <p className="label mb-2">Custom grid ({MIN_GRID}–{MAX_GRID})</p>
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                applyCustom();
              }}
            >
              <input
                type="number"
                inputMode="numeric"
                min={MIN_GRID}
                max={MAX_GRID}
                className="input min-w-0"
                value={customW}
                onChange={(e) => setCustomW(e.target.value)}
                aria-label="Custom width in beads"
              />
              <span className="font-bold text-ink-subtle">×</span>
              <input
                type="number"
                inputMode="numeric"
                min={MIN_GRID}
                max={MAX_GRID}
                className="input min-w-0"
                value={customH}
                onChange={(e) => setCustomH(e.target.value)}
                aria-label="Custom height in beads"
              />
              <button type="submit" className="btn-secondary shrink-0 px-3">
                Apply
              </button>
            </form>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-ink-subtle">
            <Grid2x2 className="h-4 w-4" />
            {board.width} × {board.height} = {(board.width * board.height).toLocaleString()} pegs · {boards.total} board
            {boards.total === 1 ? '' : 's'} ({boards.across} × {boards.down})
          </p>
        </section>

        <section className="card p-4 sm:p-5">
          <SectionTitle icon={<Settings2 className="h-5 w-5" />} title="Conversion" />
          <div className="space-y-4">
            <div>
              <p className="label mb-1.5">Image fit</p>
              <Segmented
                ariaLabel="Image fit"
                value={settings.fit}
                onChange={(v) => update('fit', v)}
                size="sm"
                options={[
                  { value: 'fill', label: 'Fill', title: 'Crop to fill the whole board' },
                  { value: 'fit', label: 'Fit', title: 'Show the whole image, leave empty pegs' },
                  { value: 'stretch', label: 'Stretch', title: 'Stretch to the board shape' },
                ]}
              />
            </div>
            <div>
              <p className="label mb-1.5">Colour matching</p>
              <Segmented
                ariaLabel="Colour distance"
                value={settings.distance}
                onChange={(v) => update('distance', v)}
                size="sm"
                options={[
                  { value: 'ciede2000', label: 'CIEDE2000', title: 'Perceptual — most accurate' },
                  { value: 'weighted-rgb', label: 'Weighted RGB', title: 'Fast, punchier colours' },
                ]}
              />
            </div>
            <div>
              <p className="label mb-1.5">Sampling</p>
              <Segmented
                ariaLabel="Sampling"
                value={settings.sampling}
                onChange={(v) => update('sampling', v)}
                size="sm"
                options={[
                  { value: 'average', label: 'Average', title: 'Blend each area — smooth, great for photos' },
                  { value: 'dominant', label: 'Dominant', title: 'Most common colour per bead — crisp, great for pixel art' },
                ]}
              />
            </div>
            <div className={settings.sampling === 'dominant' ? 'pointer-events-none opacity-50' : ''}>
              <label htmlFor="dithering" className="label mb-1.5 block">
                Dithering{settings.sampling === 'dominant' && ' (average sampling only)'}
              </label>
              <select
                id="dithering"
                aria-label="Dithering"
                className="input"
                value={settings.dither}
                onChange={(e) => update('dither', e.target.value as ConversionSettings['dither'])}
              >
                <option value="none">None (flat colours, best for pixel art)</option>
                <option value="floyd-steinberg">Floyd–Steinberg (smooth photo gradients)</option>
                <option value="atkinson">Atkinson (crisp, high contrast)</option>
                <option value="bayer4">Bayer 4×4 (regular retro texture)</option>
                <option value="bayer8">Bayer 8×8 (fine ordered gradient)</option>
              </select>
            </div>
            <div>
              <label htmlFor="max-colors" className="label mb-1.5 block">
                Max colours
              </label>
              <select
                id="max-colors"
                className="input"
                value={settings.maxColors}
                onChange={(e) => update('maxColors', Number(e.target.value))}
              >
                <option value={0}>Unlimited</option>
                {[2, 3, 4, 6, 8, 10, 12, 16, 20, 24, 32].map((n) => (
                  <option key={n} value={n}>
                    {n} colours
                  </option>
                ))}
              </select>
            </div>
            <Toggle
              label="Transparent = empty peg"
              description="Skip see-through areas of PNGs"
              checked={settings.transparentAsEmpty}
              onChange={(v) => update('transparentAsEmpty', v)}
            />
          </div>
        </section>
      </div>

      <div className="min-w-0 space-y-6">
        <section className="card p-4 sm:p-6">
          <SectionTitle
            icon={<Sparkles className="h-5 w-5" />}
            title="Live pattern preview"
            subtitle={preview ? `${previewColors} colours · ${totalBeads(preview).toLocaleString()} beads` : undefined}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <div className="checkerboard relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl">
              {palette.length === 0 ? (
                <div className="flex max-w-xs flex-col items-center gap-3 p-6 text-center">
                  <AlertTriangle className="h-10 w-10 text-amber-500" />
                  <p className="font-bold text-ink-soft">Your inventory is empty</p>
                  <p className="text-sm text-ink-subtle">Pick the bead colours you own below, or start with a basic set.</p>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      setInventory([...inventory, ...BASIC_24[brand]]);
                      toast.success(`Added Basic 24 ${brand} colours`);
                    }}
                  >
                    Use Basic 24 {brand}
                  </button>
                </div>
              ) : previewError ? (
                <p className="p-6 text-center text-sm font-semibold text-rose-500">{previewError}</p>
              ) : (
                <>
                  <canvas
                    ref={canvasRef}
                    className="max-h-full max-w-full"
                    style={{ imageRendering: 'pixelated' }}
                    aria-label="Pattern preview"
                  />
                  {computing && (
                    <div className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-ink-subtle shadow">
                      Updating…
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <div className="rounded-2xl bg-surface-muted p-3">
                <p className="label mb-2">Your crop</p>
                <CropThumb />
              </div>
              <p className="text-xs leading-relaxed text-ink-subtle">
                Colours are matched strictly to your <b>{palette.length}</b> owned colours. Missing shades are replaced with the
                closest bead you have.
              </p>
              <div className="mt-auto flex flex-col gap-2">
                <button type="button" className="btn-primary w-full py-3" disabled={generating || palette.length === 0} onClick={() => void generate()}>
                  {generating ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Generating…
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4" /> {pattern ? 'Regenerate pattern' : 'Generate pattern'}
                    </>
                  )}
                </button>
                {pattern && (
                  <button type="button" className="btn-secondary w-full" onClick={() => setStep(4)}>
                    Open current pattern
                  </button>
                )}
                <button type="button" className="btn-ghost w-full" onClick={() => setStep(2)}>
                  <ArrowLeft className="h-4 w-4" /> Back to crop
                </button>
              </div>
            </div>
          </div>
          {generating && (
            <div className="mt-4">
              <Spinner label="Mapping pixels to beads…" />
            </div>
          )}
        </section>

        <InventoryManager />
      </div>
    </div>
  );
}

function CropThumb() {
  const { source, crop, adjustments } = useApp();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!source || !ref.current) return;
    renderAdjustedCrop(ref.current, source, crop, adjustments, 220);
  }, [source, crop, adjustments]);
  return <canvas ref={ref} className="checkerboard mx-auto max-h-40 max-w-full rounded-xl" aria-label="Cropped source" />;
}
