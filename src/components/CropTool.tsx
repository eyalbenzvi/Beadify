import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { CropRect, SourceImage } from '../types';

type DragMode = 'move' | 'new' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface Props {
  source: SourceImage;
  crop: CropRect;
  onChange: (c: CropRect) => void;
  /** width / height in pixels, or null for free-form */
  aspect: number | null;
}

const MIN = 0.02;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Largest crop with the given pixel aspect that fits, centred on (cx, cy). */
export function fitAspect(source: SourceImage, aspect: number, cx = 0.5, cy = 0.5): CropRect {
  const imgAspect = source.width / source.height;
  let w = 1;
  let h = 1;
  if (aspect > imgAspect) h = imgAspect / aspect;
  else w = aspect / imgAspect;
  return { x: clamp(cx - w / 2, 0, 1 - w), y: clamp(cy - h / 2, 0, 1 - h), w, h };
}

export default function CropTool({ source, crop, onChange, aspect }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: DragMode; startX: number; startY: number; start: CropRect; pointerId: number } | null>(null);
  const [active, setActive] = useState(false);

  const toNorm = useCallback((clientX: number, clientY: number) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clamp((clientX - rect.left) / rect.width, 0, 1), y: clamp((clientY - rect.top) / rect.height, 0, 1) };
  }, []);

  const resizeWithAspect = useCallback(
    (anchorX: number, anchorY: number, px: number, py: number, ratio: number): CropRect => {
      const dirX = px >= anchorX ? 1 : -1;
      const dirY = py >= anchorY ? 1 : -1;
      const W = source.width;
      const H = source.height;
      let wPx = Math.max(Math.abs(px - anchorX) * W, Math.abs(py - anchorY) * H * ratio);
      const maxW = (dirX > 0 ? 1 - anchorX : anchorX) * W;
      const maxH = (dirY > 0 ? 1 - anchorY : anchorY) * H;
      wPx = Math.max(MIN * W, Math.min(wPx, maxW, maxH * ratio));
      const w = wPx / W;
      const h = wPx / ratio / H;
      return { x: dirX > 0 ? anchorX : anchorX - w, y: dirY > 0 ? anchorY : anchorY - h, w, h };
    },
    [source.width, source.height],
  );

  const onPointerDown = (mode: DragMode) => (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = toNorm(e.clientX, e.clientY);
    drag.current = { mode, startX: p.x, startY: p.y, start: crop, pointerId: e.pointerId };
    setActive(true);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const p = toNorm(e.clientX, e.clientY);
    const dx = p.x - d.startX;
    const dy = p.y - d.startY;
    const s = d.start;

    if (d.mode === 'move') {
      onChange({ ...s, x: clamp(s.x + dx, 0, 1 - s.w), y: clamp(s.y + dy, 0, 1 - s.h) });
      return;
    }
    if (d.mode === 'new') {
      if (aspect) {
        onChange(resizeWithAspect(d.startX, d.startY, p.x, p.y, aspect));
      } else {
        const x = Math.min(d.startX, p.x);
        const y = Math.min(d.startY, p.y);
        onChange({ x, y, w: Math.max(MIN, Math.abs(p.x - d.startX)), h: Math.max(MIN, Math.abs(p.y - d.startY)) });
      }
      return;
    }
    if (aspect && d.mode.length === 2) {
      const ax = d.mode.includes('w') ? s.x + s.w : s.x;
      const ay = d.mode.includes('n') ? s.y + s.h : s.y;
      onChange(resizeWithAspect(ax, ay, p.x, p.y, aspect));
      return;
    }
    let { x, y, w, h } = s;
    if (d.mode.includes('w')) {
      const nx = clamp(s.x + dx, 0, s.x + s.w - MIN);
      w = s.x + s.w - nx;
      x = nx;
    }
    if (d.mode.includes('e')) w = clamp(s.w + dx, MIN, 1 - s.x);
    if (d.mode.includes('n')) {
      const ny = clamp(s.y + dy, 0, s.y + s.h - MIN);
      h = s.y + s.h - ny;
      y = ny;
    }
    if (d.mode.includes('s')) h = clamp(s.h + dy, MIN, 1 - s.y);
    onChange({ x, y, w, h });
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    if (drag.current?.pointerId === e.pointerId) {
      drag.current = null;
      setActive(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    onChange({ ...crop, x: clamp(crop.x + m[0], 0, 1 - crop.w), y: clamp(crop.y + m[1], 0, 1 - crop.h) });
  };

  // Keep crop within bounds if it ever becomes invalid (e.g. restored state).
  useEffect(() => {
    if (crop.x + crop.w > 1.0001 || crop.y + crop.h > 1.0001) {
      onChange({ x: clamp(crop.x, 0, 1 - crop.w), y: clamp(crop.y, 0, 1 - crop.h), w: Math.min(1, crop.w), h: Math.min(1, crop.h) });
    }
  }, [crop, onChange]);

  const handles: DragMode[] = aspect ? ['nw', 'ne', 'sw', 'se'] : ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  const handlePos: Record<string, string> = {
    nw: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize',
    n: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize',
    ne: 'right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize',
    e: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
    se: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize',
    s: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize',
    sw: 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize',
    w: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
  };

  const pxW = Math.round(crop.w * source.width);
  const pxH = Math.round(crop.h * source.height);

  return (
    <div className="checkerboard flex items-center justify-center rounded-2xl p-3">
      <div
        ref={frameRef}
        className="touch-none-all relative select-none"
        style={{ aspectRatio: `${source.width} / ${source.height}`, maxHeight: '62vh', width: '100%', maxWidth: `calc(62vh * ${source.width / source.height})` }}
        onPointerDown={onPointerDown('new')}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img src={source.dataUrl} alt="Source" draggable={false} className="pointer-events-none h-full w-full rounded-md object-fill" />
        {/* Dim outside the crop */}
        <div
          className="pointer-events-none absolute inset-0 rounded-md"
          style={{
            background: 'rgba(15, 23, 42, 0.55)',
            clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${crop.x * 100}% ${crop.y * 100}%, ${crop.x * 100}% ${(crop.y + crop.h) * 100}%, ${(crop.x + crop.w) * 100}% ${(crop.y + crop.h) * 100}%, ${(crop.x + crop.w) * 100}% ${crop.y * 100}%, ${crop.x * 100}% ${crop.y * 100}%)`,
          }}
        />
        <div
          role="slider"
          tabIndex={0}
          aria-label="Crop area. Use arrow keys to move."
          aria-valuetext={`${pxW} by ${pxH} pixels`}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown('move')}
          className="absolute cursor-move border-2 border-white shadow-[0_0_0_1px_rgba(236,72,153,0.9)]"
          style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}
        >
          {/* Rule of thirds */}
          <div className={`pointer-events-none absolute inset-0 transition-opacity ${active ? 'opacity-100' : 'opacity-40'}`}>
            <div className="absolute inset-y-0 left-1/3 w-px bg-white/70" />
            <div className="absolute inset-y-0 left-2/3 w-px bg-white/70" />
            <div className="absolute inset-x-0 top-1/3 h-px bg-white/70" />
            <div className="absolute inset-x-0 top-2/3 h-px bg-white/70" />
          </div>
          {handles.map((h) => (
            <span
              key={h}
              onPointerDown={onPointerDown(h)}
              className={`absolute h-5 w-5 rounded-full border-[3px] border-white bg-brand-500 shadow-md sm:h-4 sm:w-4 ${handlePos[h]}`}
            />
          ))}
          <span className="pointer-events-none absolute -top-7 left-0 whitespace-nowrap rounded-md bg-inverse/80 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {pxW} × {pxH}
          </span>
        </div>
      </div>
    </div>
  );
}
