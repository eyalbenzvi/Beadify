import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { ColorUsage, ViewPreferences } from '../types';
import { BEAD_BY_ID } from '../data/beadColors';
import { columnLabel, PEGBOARD_SIZE } from '../lib/pattern';
import { drawBead, drawSymbol } from '../lib/render';

export const RULER = 24;
export const MIN_SCALE = 2;
export const MAX_SCALE = 64;

export interface Viewport {
  scale: number;
  ox: number;
  oy: number;
}

export interface CellEvent {
  x: number;
  y: number;
  clientX: number;
  clientY: number;
}

interface Props {
  width: number;
  height: number;
  cells: (string | null)[];
  usage: Map<string, ColorUsage>;
  view: ViewPreferences;
  viewport: Viewport;
  onViewportChange: (v: Viewport) => void;
  panMode: boolean;
  cursor: string;
  highlightId: string | null;
  onCellDown: (e: CellEvent) => void;
  onCellDrag: (e: CellEvent) => void;
  onCellUp: () => void;
  onHover: (e: CellEvent | null) => void;
  onSizeChange?: (w: number, h: number) => void;
}

export function clampScale(s: number): number {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));
}

export default function PatternCanvas({
  width,
  height,
  cells,
  usage,
  view,
  viewport,
  onViewportChange,
  panMode,
  cursor,
  highlightId,
  onCellDown,
  onCellDrag,
  onCellUp,
  onHover,
  onSizeChange,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<
    | { kind: 'pan'; startX: number; startY: number; start: Viewport }
    | { kind: 'pinch'; startDist: number; startMid: { x: number; y: number }; start: Viewport }
    | { kind: 'paint' }
    | null
  >(null);
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  // Track container size
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry.contentRect;
      setSize({ w: Math.floor(w), h: Math.floor(h) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (size.w && size.h) onSizeChange?.(size.w, size.h);
  }, [size, onSizeChange]);

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size.w || !size.h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { scale: s, ox, oy } = viewport;
    const gx = RULER + ox;
    const gy = RULER + oy;

    ctx.fillStyle = '#F1F5F9';
    ctx.fillRect(0, 0, size.w, size.h);

    const x0 = Math.max(0, Math.floor((RULER - gx) / s));
    const y0 = Math.max(0, Math.floor((RULER - gy) / s));
    const x1 = Math.min(width, Math.ceil((size.w - gx) / s));
    const y1 = Math.min(height, Math.ceil((size.h - gy) / s));

    // Board background with peg dots
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(gx, gy, width * s, height * s);
    const showPegs = s >= 8;
    const showSymbols = view.showSymbols && s >= 10;
    const dim = highlightId !== null;

    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const id = cells[y * width + x];
        const px = gx + x * s;
        const py = gy + y * s;
        if (!id) {
          if (showPegs) {
            ctx.fillStyle = '#E2E8F0';
            ctx.beginPath();
            ctx.arc(px + s / 2, py + s / 2, s * 0.14, 0, Math.PI * 2);
            ctx.fill();
          }
          continue;
        }
        const u = usage.get(id);
        const color = u?.color ?? BEAD_BY_ID.get(id);
        if (!color) continue;
        ctx.globalAlpha = dim && id !== highlightId ? 0.18 : 1;
        drawBead(ctx, px, py, s, color.hex, showSymbols ? 'square' : view.beadStyle);
        if (showSymbols && u) drawSymbol(ctx, px, py, s, u.symbol, color.rgb);
        ctx.globalAlpha = 1;
      }
    }

    // Grid lines
    if (view.showGrid && s >= 5) {
      ctx.lineWidth = 1;
      for (let x = x0; x <= x1; x++) {
        const major = x % 10 === 0;
        ctx.strokeStyle = major ? 'rgba(71,85,105,0.55)' : 'rgba(148,163,184,0.35)';
        const px = Math.round(gx + x * s) + 0.5;
        ctx.beginPath();
        ctx.moveTo(px, gy + y0 * s);
        ctx.lineTo(px, gy + y1 * s);
        ctx.stroke();
      }
      for (let y = y0; y <= y1; y++) {
        const major = y % 10 === 0;
        ctx.strokeStyle = major ? 'rgba(71,85,105,0.55)' : 'rgba(148,163,184,0.35)';
        const py = Math.round(gy + y * s) + 0.5;
        ctx.beginPath();
        ctx.moveTo(gx + x0 * s, py);
        ctx.lineTo(gx + x1 * s, py);
        ctx.stroke();
      }
    }

    // Pegboard boundaries
    if (view.showBoardLines) {
      ctx.strokeStyle = 'rgba(219,39,119,0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      for (let x = PEGBOARD_SIZE; x < width; x += PEGBOARD_SIZE) {
        ctx.beginPath();
        ctx.moveTo(gx + x * s, gy);
        ctx.lineTo(gx + x * s, gy + height * s);
        ctx.stroke();
      }
      for (let y = PEGBOARD_SIZE; y < height; y += PEGBOARD_SIZE) {
        ctx.beginPath();
        ctx.moveTo(gx, gy + y * s);
        ctx.lineTo(gx + width * s, gy + y * s);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = 'rgba(71,85,105,0.7)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(gx, gy, width * s, height * s);

    // Rulers
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.fillRect(0, 0, size.w, RULER);
    ctx.fillRect(0, 0, RULER, size.h);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, RULER + 0.5);
    ctx.lineTo(size.w, RULER + 0.5);
    ctx.moveTo(RULER + 0.5, 0);
    ctx.lineTo(RULER + 0.5, size.h);
    ctx.stroke();

    const every = s >= 16 ? 1 : s >= 8 ? 2 : s >= 4 ? 5 : 10;
    ctx.fillStyle = '#64748B';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 10px Nunito, ui-sans-serif, system-ui, sans-serif';
    ctx.save();
    ctx.beginPath();
    ctx.rect(RULER, 0, size.w - RULER, RULER);
    ctx.clip();
    for (let x = x0; x < x1; x++) {
      if ((x + 1) % every !== 0 && every !== 1 && x !== 0) continue;
      ctx.fillText(columnLabel(x), gx + x * s + s / 2, RULER / 2);
    }
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, RULER, RULER, size.h - RULER);
    ctx.clip();
    for (let y = y0; y < y1; y++) {
      if ((y + 1) % every !== 0 && every !== 1 && y !== 0) continue;
      ctx.fillText(String(y + 1), RULER / 2, gy + y * s + s / 2);
    }
    ctx.restore();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, RULER, RULER);
  }, [cells, width, height, usage, view, viewport, size, highlightId]);

  const cellAt = useCallback(
    (clientX: number, clientY: number): CellEvent | null => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return null;
      const { scale: s, ox, oy } = viewportRef.current;
      const lx = clientX - rect.left;
      const ly = clientY - rect.top;
      if (lx < RULER || ly < RULER) return null;
      const x = Math.floor((lx - RULER - ox) / s);
      const y = Math.floor((ly - RULER - oy) / s);
      if (x < 0 || y < 0 || x >= width || y >= height) return null;
      return { x, y, clientX, clientY };
    },
    [width, height],
  );

  const zoomAt = useCallback(
    (factor: number, clientX: number, clientY: number, base: Viewport = viewportRef.current) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const next = clampScale(base.scale * factor);
      const lx = clientX - rect.left - RULER;
      const ly = clientY - rect.top - RULER;
      const k = next / base.scale;
      onViewportChange({ scale: next, ox: lx - (lx - base.ox) * k, oy: ly - (ly - base.oy) * k });
    },
    [onViewportChange],
  );

  // Non-passive wheel listener so we can prevent page scroll while zooming.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
        if (!e.ctrlKey && !e.metaKey && e.shiftKey) {
          const v = viewportRef.current;
          onViewportChange({ ...v, ox: v.ox - e.deltaY, oy: v.oy - e.deltaX });
          return;
        }
        const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018));
        zoomAt(factor, e.clientX, e.clientY);
      } else {
        const v = viewportRef.current;
        onViewportChange({ ...v, ox: v.ox - e.deltaX, oy: v.oy - e.deltaY });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt, onViewportChange]);

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      // Switch to pinch; abandon any stroke in progress.
      if (gesture.current?.kind === 'paint') onCellUp();
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        kind: 'pinch',
        startDist: Math.hypot(a.x - b.x, a.y - b.y),
        startMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        start: viewportRef.current,
      };
      onHover(null);
      return;
    }
    if (pointers.current.size > 2) return;

    if (panMode || e.button === 1 || e.button === 2) {
      gesture.current = { kind: 'pan', startX: e.clientX, startY: e.clientY, start: viewportRef.current };
      return;
    }
    const cell = cellAt(e.clientX, e.clientY);
    if (cell) {
      gesture.current = { kind: 'paint' };
      onCellDown(cell);
    } else {
      gesture.current = { kind: 'pan', startX: e.clientX, startY: e.clientY, start: viewportRef.current };
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (g?.kind === 'pan') {
      onViewportChange({ ...g.start, ox: g.start.ox + e.clientX - g.startX, oy: g.start.oy + e.clientY - g.startY });
      return;
    }
    if (g?.kind === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const next = clampScale(g.start.scale * (dist / Math.max(1, g.startDist)));
      const k = next / g.start.scale;
      const lx = g.startMid.x - rect.left - RULER;
      const ly = g.startMid.y - rect.top - RULER;
      onViewportChange({
        scale: next,
        ox: lx - (lx - g.start.ox) * k + (mid.x - g.startMid.x),
        oy: ly - (ly - g.start.oy) * k + (mid.y - g.startMid.y),
      });
      return;
    }
    const cell = cellAt(e.clientX, e.clientY);
    if (g?.kind === 'paint' && cell) onCellDrag(cell);
    if (e.pointerType === 'mouse' || g?.kind === 'paint') onHover(cell);
  };

  const endPointer = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId);
    if (gesture.current?.kind === 'paint') onCellUp();
    if (pointers.current.size === 0) gesture.current = null;
    else if (gesture.current?.kind === 'pinch') gesture.current = null;
    if (e.pointerType !== 'mouse') onHover(null);
  };

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="touch-none-all absolute inset-0 block"
        style={{ cursor: gesture.current?.kind === 'pan' ? 'grabbing' : cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse' && !gesture.current) onHover(null);
        }}
        onContextMenu={(e) => e.preventDefault()}
        role="img"
        aria-label={`Bead pattern grid, ${width} by ${height}`}
      />
    </div>
  );
}
