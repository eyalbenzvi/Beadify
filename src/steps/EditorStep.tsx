import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Circle,
  Download,
  Eraser,
  FileText,
  Grid3x3,
  Hand,
  Hash,
  LayoutGrid,
  Maximize2,
  MousePointer2,
  PaintBucket,
  Paintbrush,
  PenTool,
  Pipette,
  Printer,
  Redo2,
  Square,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { ViewPreferences } from '../types';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { BEAD_BY_ID } from '../data/beadColors';
import PatternCanvas, { clampScale, RULER, type CellEvent, type Viewport } from '../components/PatternCanvas';
import ColorPickerPopover from '../components/ColorPickerPopover';
import ShoppingList, { AssemblyTips, StatsSummary } from '../components/ShoppingList';
import PrintView from '../components/PrintView';
import { BeadSwatch, SectionTitle, Segmented, Toggle } from '../components/ui';
import { cellLabel, computeUsage, floodFill, replaceColor, symbolMap } from '../lib/pattern';
import { remapCells } from '../lib/quantize';
import { downloadCanvas, fontsReady, renderPatternExport, safeFilename } from '../lib/render';
import { exportPatternPdf, preloadPdfEngine } from '../lib/exportPdf';
import { exportPatternSvg } from '../lib/exportSvg';
import { PAGE_SIZES } from '../lib/pageGeometry';

type Tool = 'select' | 'paint' | 'erase' | 'fill' | 'eyedropper' | 'pan';

const TOOLS: { id: Tool; label: string; key: string; icon: ReactNode; hint: string }[] = [
  { id: 'select', label: 'Select', key: 'V', icon: <MousePointer2 className="h-4 w-4" />, hint: 'Click a bead to choose its colour' },
  { id: 'paint', label: 'Paint', key: 'B', icon: <Paintbrush className="h-4 w-4" />, hint: 'Click or drag to paint with the active colour' },
  { id: 'erase', label: 'Erase', key: 'E', icon: <Eraser className="h-4 w-4" />, hint: 'Remove beads (leave the peg empty)' },
  { id: 'fill', label: 'Fill', key: 'F', icon: <PaintBucket className="h-4 w-4" />, hint: 'Fill a connected area with the active colour' },
  { id: 'eyedropper', label: 'Pick', key: 'I', icon: <Pipette className="h-4 w-4" />, hint: 'Pick the active colour from the grid' },
  { id: 'pan', label: 'Pan', key: 'H', icon: <Hand className="h-4 w-4" />, hint: 'Drag to move around. Wheel / pinch to zoom.' },
];

const CURSORS: Record<Tool, string> = {
  select: 'pointer',
  paint: 'crosshair',
  erase: 'cell',
  fill: 'copy',
  eyedropper: 'crosshair',
  pan: 'grab',
};

/** Bresenham line between two cells so fast drags don't leave gaps. */
function lineCells(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const out: [number, number][] = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    out.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return out;
}

export default function EditorStep() {
  const { pattern, commitCells, undo, redo, canUndo, canRedo, view, setView, palette, inventory, settings, source, setStep } = useApp();
  const toast = useToast();

  const [tool, setTool] = useState<Tool>('select');
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const [draft, setDraft] = useState<(string | null)[] | null>(null);
  const [hover, setHover] = useState<CellEvent | null>(null);
  const [picker, setPicker] = useState<{ cell: { x: number; y: number }; anchor: { clientX: number; clientY: number } } | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ scale: 16, ox: 16, oy: 16 });
  const [exporting, setExporting] = useState<null | 'png' | 'pdf' | 'print'>(null);
  const [printing, setPrinting] = useState(false);
  const canvasSize = useRef({ w: 0, h: 0 });
  const fitted = useRef(false);
  const stroke = useRef<{ last: [number, number]; cells: (string | null)[] } | null>(null);

  const usage = useMemo(() => (pattern ? computeUsage(pattern) : []), [pattern]);
  const usageMap = useMemo(() => symbolMap(usage), [usage]);
  const cells = draft ?? pattern?.cells ?? [];
  const title = source?.name ? `${source.name} bead pattern` : 'Bead pattern';
  const missing = useMemo(() => usage.filter((u) => !inventory.has(u.color.id)), [usage, inventory]);

  // Fetch the PDF engine in the background so export starts instantly (and stays inside
  // the user gesture on iOS Safari).
  useEffect(() => {
    const idle = window.setTimeout(() => void preloadPdfEngine().catch(() => undefined), 1200);
    return () => window.clearTimeout(idle);
  }, []);

  // Default active colour: the most used one that the user owns.
  useEffect(() => {
    if (activeColor && inventory.has(activeColor)) return;
    const owned = usage.find((u) => inventory.has(u.color.id));
    setActiveColor(owned?.color.id ?? palette[0]?.id ?? null);
  }, [usage, inventory, palette, activeColor]);

  const fitView = useCallback(() => {
    if (!pattern) return;
    const { w, h } = canvasSize.current;
    if (!w || !h) return;
    const scale = clampScale(Math.floor(Math.min((w - RULER - 24) / pattern.width, (h - RULER - 24) / pattern.height) * 10) / 10);
    setViewport({
      scale,
      ox: (w - RULER - pattern.width * scale) / 2,
      oy: (h - RULER - pattern.height * scale) / 2,
    });
  }, [pattern]);

  const onSizeChange = useCallback(
    (w: number, h: number) => {
      canvasSize.current = { w, h };
      if (!fitted.current) {
        fitted.current = true;
        fitView();
      }
    },
    [fitView],
  );

  const zoomBy = useCallback((factor: number) => {
    const { w, h } = canvasSize.current;
    setViewport((v) => {
      const next = clampScale(v.scale * factor);
      const cx = (w - RULER) / 2;
      const cy = (h - RULER) / 2;
      const k = next / v.scale;
      return { scale: next, ox: cx - (cx - v.ox) * k, oy: cy - (cy - v.oy) * k };
    });
  }, []);

  // ----- Editing -----
  const paintAt = useCallback(
    (working: (string | null)[], x: number, y: number, value: string | null) => {
      if (!pattern) return;
      working[y * pattern.width + x] = value;
    },
    [pattern],
  );

  const onCellDown = useCallback(
    (e: CellEvent) => {
      if (!pattern) return;
      const idx = e.y * pattern.width + e.x;
      setPicker(null);
      switch (tool) {
        case 'select':
          setPicker({ cell: { x: e.x, y: e.y }, anchor: { clientX: e.clientX, clientY: e.clientY } });
          return;
        case 'eyedropper': {
          const id = pattern.cells[idx];
          if (!id) {
            toast.info('That peg is empty', 'Pick a cell that has a bead.');
            return;
          }
          if (!inventory.has(id)) {
            toast.error('Colour not in inventory', 'Add it to your inventory to paint with it.');
            return;
          }
          setActiveColor(id);
          setTool('paint');
          toast.info(`Picked ${BEAD_BY_ID.get(id)?.name ?? id}`);
          return;
        }
        case 'fill': {
          const next = floodFill(pattern, e.x, e.y, activeColor);
          if (next) commitCells(next);
          return;
        }
        case 'paint':
        case 'erase': {
          const value = tool === 'erase' ? null : activeColor;
          if (tool === 'paint' && !value) {
            toast.error('No active colour', 'Choose a colour from the palette first.');
            return;
          }
          const working = [...pattern.cells];
          paintAt(working, e.x, e.y, value);
          stroke.current = { last: [e.x, e.y], cells: working };
          setDraft([...working]);
          return;
        }
        default:
      }
    },
    [pattern, tool, activeColor, inventory, commitCells, paintAt, toast],
  );

  const onCellDrag = useCallback(
    (e: CellEvent) => {
      if (!stroke.current || !pattern) return;
      const value = tool === 'erase' ? null : activeColor;
      const [lx, ly] = stroke.current.last;
      if (lx === e.x && ly === e.y) return;
      const working = stroke.current.cells;
      for (const [x, y] of lineCells(lx, ly, e.x, e.y)) paintAt(working, x, y, value);
      stroke.current.last = [e.x, e.y];
      setDraft([...working]);
    },
    [pattern, tool, activeColor, paintAt],
  );

  const onCellUp = useCallback(() => {
    const current = stroke.current;
    if (!current) return;
    stroke.current = null;
    setDraft(null);
    if (pattern && current.cells.some((v, i) => v !== pattern.cells[i])) commitCells(current.cells);
  }, [pattern, commitCells]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (mod) return;
      const t = TOOLS.find((x) => x.key.toLowerCase() === e.key.toLowerCase());
      if (t) {
        setTool(t.id);
        return;
      }
      if (e.key === '+' || e.key === '=') zoomBy(1.25);
      else if (e.key === '-') zoomBy(0.8);
      else if (e.key === '0') fitView();
      else if (e.key.toLowerCase() === 'g') setView((v) => ({ ...v, showGrid: !v.showGrid }));
      else if (e.key.toLowerCase() === 's') setView((v) => ({ ...v, showSymbols: !v.showSymbols }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, zoomBy, fitView, setView]);

  // Print lifecycle: render print view, print, then tear down.
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done);
    // Wait for the print DOM to mount and paint (two frames + a beat for the overview image).
    let t = 0;
    const raf = requestAnimationFrame(() => {
      t = window.setTimeout(() => {
        window.print();
        setExporting(null);
      }, 150);
    });
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
      window.removeEventListener('afterprint', done);
    };
  }, [printing]);

  if (!pattern) return null;

  const exportPng = async () => {
    setExporting('png');
    await fontsReady();
    try {
      const canvas = renderPatternExport(pattern, usage, {
        showSymbols: view.showSymbols,
        showGrid: view.showGrid,
        beadStyle: view.beadStyle,
        title,
        includeLegend: true,
        cellPx: view.pngCellPx,
      });
      await downloadCanvas(canvas, `${safeFilename(title)}.png`);
      toast.success('PNG downloaded', `${canvas.width} × ${canvas.height}px high-resolution image.`);
    } catch (err) {
      toast.error('PNG export failed', err instanceof Error ? err.message : undefined);
    } finally {
      setExporting(null);
    }
  };

  const exportPdf = async () => {
    setExporting('pdf');
    try {
      await exportPatternPdf(pattern, usage, { title, showSymbols: view.showSymbols, pageSize: view.pageSize });
      toast.success('PDF downloaded', `${PAGE_SIZES[view.pageSize].label} · overview, legend and one page per pegboard.`);
    } catch (err) {
      toast.error('PDF export failed', err instanceof Error ? err.message : undefined);
    } finally {
      setExporting(null);
    }
  };

  const exportSvg = () => {
    try {
      exportPatternSvg(pattern, usage, { title, showSymbols: view.showSymbols, showGrid: view.showGrid });
      toast.success('SVG downloaded', 'Infinitely scalable vector pattern.');
    } catch (err) {
      toast.error('SVG export failed', err instanceof Error ? err.message : undefined);
    }
  };

  const remapMissing = () => {
    if (palette.length === 0) {
      toast.error('Your inventory is empty', 'Add colours before remapping.');
      return;
    }
    commitCells(remapCells(pattern.cells, palette, BEAD_BY_ID, settings.distance));
    toast.success('Pattern remapped', `${missing.length} colour${missing.length === 1 ? '' : 's'} replaced with your closest owned beads.`);
  };

  const hoverColor = hover ? cells[hover.y * pattern.width + hover.x] : null;
  const hoverBead = hoverColor ? usageMap.get(hoverColor) : null;
  const active = activeColor ? BEAD_BY_ID.get(activeColor) : null;
  const viewToggle = (key: keyof ViewPreferences) => (v: boolean) => setView((p) => ({ ...p, [key]: v }));

  return (
    <div className="space-y-6">
      {missing.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
          <p className="flex-1 font-semibold text-amber-800">
            {missing.length} colour{missing.length === 1 ? ' in this pattern is' : 's in this pattern are'} no longer in your inventory
            ({missing.map((m) => m.color.name).join(', ')}).
          </p>
          <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={remapMissing}>
            Remap to owned colours
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="card flex min-w-0 flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-line-soft p-2.5 sm:p-3">
            <div className="flex gap-1 rounded-2xl bg-surface-sunken p-1" role="toolbar" aria-label="Editing tools">
              {TOOLS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTool(t.id)}
                  title={`${t.label} (${t.key}) — ${t.hint}`}
                  aria-label={t.label}
                  aria-pressed={tool === t.id}
                  className={`flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold transition ${
                    tool === t.id ? 'bg-white text-brand-600 shadow-sm' : 'text-ink-subtle hover:text-ink-soft'
                  }`}
                >
                  {t.icon}
                  <span className="hidden 2xl:inline">{t.label}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <button type="button" className="btn-icon" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
                <Undo2 className="h-4 w-4" />
              </button>
              <button type="button" className="btn-icon" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
                <Redo2 className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" className="btn-icon" onClick={() => zoomBy(0.8)} title="Zoom out (-)" aria-label="Zoom out">
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="w-12 text-center text-xs font-extrabold tabular-nums text-ink-subtle">{Math.round(viewport.scale * 6.25)}%</span>
              <button type="button" className="btn-icon" onClick={() => zoomBy(1.25)} title="Zoom in (+)" aria-label="Zoom in">
                <ZoomIn className="h-4 w-4" />
              </button>
              <button type="button" className="btn-icon" onClick={fitView} title="Fit to screen (0)" aria-label="Fit to screen">
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>
            <div className="ml-auto flex gap-1">
              <button
                type="button"
                className={`btn-icon ${view.showGrid ? 'btn-icon-active' : ''}`}
                onClick={() => viewToggle('showGrid')(!view.showGrid)}
                title="Toggle grid lines (G)"
                aria-label="Toggle grid lines"
                aria-pressed={view.showGrid}
              >
                <Grid3x3 className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={`btn-icon ${view.showSymbols ? 'btn-icon-active' : ''}`}
                onClick={() => viewToggle('showSymbols')(!view.showSymbols)}
                title="Toggle colour symbols (S)"
                aria-label="Toggle colour symbols"
                aria-pressed={view.showSymbols}
              >
                <Hash className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={`btn-icon ${view.showBoardLines ? 'btn-icon-active' : ''}`}
                onClick={() => viewToggle('showBoardLines')(!view.showBoardLines)}
                title="Toggle pegboard boundaries"
                aria-label="Toggle pegboard boundaries"
                aria-pressed={view.showBoardLines}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setView((p) => ({ ...p, beadStyle: p.beadStyle === 'round' ? 'square' : 'round' }))}
                title={`Bead style: ${view.beadStyle}`}
                aria-label="Toggle bead style"
              >
                {view.beadStyle === 'round' ? <Circle className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Canvas */}
          <div className="relative h-[58vh] min-h-[340px] sm:h-[68vh]">
            <PatternCanvas
              width={pattern.width}
              height={pattern.height}
              cells={cells}
              usage={usageMap}
              view={view}
              viewport={viewport}
              onViewportChange={setViewport}
              panMode={tool === 'pan'}
              cursor={CURSORS[tool]}
              highlightId={highlightId}
              onCellDown={onCellDown}
              onCellDrag={onCellDrag}
              onCellUp={onCellUp}
              onHover={setHover}
              onSizeChange={onSizeChange}
            />
            {hover && !picker && (
              <div
                className="pointer-events-none fixed z-30 rounded-xl bg-inverse/90 px-2.5 py-1.5 text-xs text-white shadow-lg"
                style={{ left: hover.clientX + 14, top: hover.clientY + 14 }}
              >
                <p className="font-extrabold">
                  {cellLabel(hover.x, hover.y)} <span className="font-semibold text-slate-300">· col {hover.x + 1}, row {hover.y + 1}</span>
                </p>
                {hoverBead ? (
                  <p className="mt-0.5 flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full ring-1 ring-white/50" style={{ background: hoverBead.color.hex }} />
                    {hoverBead.color.name} · {hoverBead.color.code} · “{hoverBead.symbol}”
                  </p>
                ) : (
                  <p className="mt-0.5 text-slate-300">Empty peg</p>
                )}
              </div>
            )}
            {highlightId && (
              <button
                type="button"
                onClick={() => setHighlightId(null)}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-inverse/85 px-3 py-1.5 text-xs font-bold text-white shadow-lg"
              >
                Highlighting {BEAD_BY_ID.get(highlightId)?.name} — tap to clear
              </button>
            )}
          </div>

          {/* Active colour palette */}
          <div className="border-t border-line-soft p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="label">Active colour</span>
              {active ? (
                <span className="flex items-center gap-1.5 text-xs font-bold text-ink-muted">
                  <BeadSwatch hex={active.hex} size={16} /> {active.code} {active.name}
                </span>
              ) : (
                <span className="text-xs font-bold text-ink-subtle">none</span>
              )}
              <span className="ml-auto hidden text-xs text-ink-subtle sm:inline">{TOOLS.find((t) => t.id === tool)?.hint}</span>
            </div>
            <div className="scrollbar-thin flex gap-1 overflow-x-auto pb-1">
              {[...usage.filter((u) => inventory.has(u.color.id)).map((u) => u.color), ...palette.filter((c) => !usageMap.has(c.id))].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setActiveColor(c.id);
                    if (tool === 'select' || tool === 'eyedropper' || tool === 'erase' || tool === 'pan') setTool('paint');
                  }}
                  title={`${c.code} ${c.name}${usageMap.has(c.id) ? ` — ${usageMap.get(c.id)?.count} beads` : ''}`}
                  aria-label={`Use ${c.name}`}
                  aria-pressed={activeColor === c.id}
                  className={`shrink-0 rounded-full p-1 transition hover:scale-110 ${activeColor === c.id ? 'bg-brand-100 ring-2 ring-brand-500' : ''}`}
                >
                  <BeadSwatch hex={c.hex} size={24} />
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="min-w-0 space-y-6">
          <section className="card p-4 sm:p-5">
            <SectionTitle icon={<FileText className="h-5 w-5" />} title="Pattern stats" subtitle={`${pattern.width} × ${pattern.height} grid`} />
            <StatsSummary pattern={pattern} usage={usage} />
          </section>

          <section className="card p-4 sm:p-5">
            <SectionTitle icon={<Download className="h-5 w-5" />} title="Export & print" />
            <div className="space-y-1">
              <Toggle label="Show grid lines" checked={view.showGrid} onChange={viewToggle('showGrid')} />
              <Toggle
                label="Show symbols"
                description="For colour-blind friendly or B&W prints"
                checked={view.showSymbols}
                onChange={viewToggle('showSymbols')}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="label mb-1.5">Paper</p>
                <Segmented
                  ariaLabel="Paper size"
                  size="sm"
                  value={view.pageSize}
                  onChange={(v) => setView((p) => ({ ...p, pageSize: v }))}
                  options={[
                    { value: 'a4', label: 'A4' },
                    { value: 'letter', label: 'Letter' },
                  ]}
                />
              </div>
              <div>
                <label htmlFor="png-res" className="label mb-1.5 block">
                  PNG size
                </label>
                <select
                  id="png-res"
                  className="input py-1.5"
                  value={view.pngCellPx}
                  onChange={(e) => setView((p) => ({ ...p, pngCellPx: Number(e.target.value) }))}
                >
                  <option value={0}>Auto (max)</option>
                  <option value={12}>Small · 12 px</option>
                  <option value={20}>Medium · 20 px</option>
                  <option value={32}>Large · 32 px</option>
                  <option value={48}>Huge · 48 px</option>
                </select>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              <button type="button" className="btn-primary w-full" disabled={exporting !== null} onClick={() => void exportPdf()}>
                {exporting === 'pdf' ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <FileText className="h-4 w-4" />}
                Download PDF pattern
              </button>
              <button type="button" className="btn-secondary w-full" disabled={exporting !== null} onClick={() => void exportPng()}>
                {exporting === 'png' ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-500" /> : <Download className="h-4 w-4" />}
                Download PNG image
              </button>
              <button type="button" className="btn-secondary w-full" disabled={exporting !== null} onClick={exportSvg}>
                <PenTool className="h-4 w-4" /> Download SVG (vector)
              </button>
              <button
                type="button"
                className="btn-secondary w-full"
                disabled={exporting !== null}
                onClick={() => {
                  setExporting('print');
                  setPrinting(true);
                }}
              >
                <Printer className="h-4 w-4" /> Print pattern
              </button>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-ink-subtle">
              PDF & print are vector: an overview, the full colour legend, and one page per 29 × 29 pegboard with A–Z / 1–N
              coordinates. Turn on symbols for black-and-white or colour-blind friendly printouts.
            </p>
          </section>

          <button type="button" className="btn-ghost w-full" onClick={() => setStep(3)}>
            <ArrowLeft className="h-4 w-4" /> Back to colours & board
          </button>
        </aside>
      </div>

      <ShoppingList pattern={pattern} usage={usage} inventory={inventory} highlightId={highlightId} onHighlight={setHighlightId} />
      <AssemblyTips />

      {picker && (
        <ColorPickerPopover
          anchor={picker.anchor}
          cell={picker.cell}
          currentId={pattern.cells[picker.cell.y * pattern.width + picker.cell.x]}
          palette={palette}
          onClose={() => setPicker(null)}
          onPick={(id) => {
            const next = [...pattern.cells];
            next[picker.cell.y * pattern.width + picker.cell.x] = id;
            commitCells(next);
            if (id) setActiveColor(id);
            setPicker(null);
          }}
          onReplaceAll={(from, to) => {
            const n = pattern.cells.filter((c) => c === from).length;
            commitCells(replaceColor(pattern, from, to));
            toast.success(`Replaced ${n} bead${n === 1 ? '' : 's'}`, `${BEAD_BY_ID.get(from)?.name} → ${to ? BEAD_BY_ID.get(to)?.name : 'empty'}`);
            setPicker(null);
          }}
        />
      )}

      {printing && <PrintView pattern={pattern} usage={usage} title={title} showSymbols={view.showSymbols} pageSize={view.pageSize} />}
    </div>
  );
}
