import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Ban, Replace, Search, X } from 'lucide-react';
import type { BeadColor } from '../types';
import { BEAD_BY_ID } from '../data/beadColors';
import { ciede2000 } from '../lib/color';
import { cellLabel } from '../lib/pattern';
import { BeadSwatch } from './ui';

interface Props {
  anchor: { clientX: number; clientY: number };
  cell: { x: number; y: number };
  currentId: string | null;
  palette: BeadColor[];
  onPick: (id: string | null) => void;
  onReplaceAll: (from: string, to: string | null) => void;
  onClose: () => void;
}

export default function ColorPickerPopover({ anchor, cell, currentId, palette, onPick, onReplaceAll, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [query, setQuery] = useState('');
  const [replaceMode, setReplaceMode] = useState(false);
  const current = currentId ? BEAD_BY_ID.get(currentId) ?? null : null;

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = palette.filter(
      (c) => !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.hex.toLowerCase().includes(q),
    );
    // Closest colours to the current bead first, which makes small corrections fast.
    if (current) return [...list].sort((a, b) => ciede2000(current.lab, a.lab) - ciede2000(current.lab, b.lab));
    return list;
  }, [palette, query, current]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = anchor.clientX + 12;
    let top = anchor.clientY + 12;
    if (left + width > vw - 8) left = Math.max(8, anchor.clientX - width - 12);
    if (top + height > vh - 8) top = Math.max(8, vh - height - 8);
    setPos({ left, top });
  }, [anchor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => window.addEventListener('pointerdown', onDown), 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
      window.clearTimeout(t);
    };
  }, [onClose]);

  const choose = (id: string | null) => {
    if (replaceMode && currentId) onReplaceAll(currentId, id);
    else onPick(id);
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Choose bead for ${cellLabel(cell.x, cell.y)}`}
      className="no-print fixed z-50 flex max-h-[min(440px,80vh)] w-[min(320px,calc(100vw-16px))] animate-toast-in flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999 }}
    >
      <div className="flex items-center gap-2.5 border-b border-slate-100 p-3">
        {current ? <BeadSwatch hex={current.hex} size={28} /> : <span className="h-7 w-7 rounded-full border-2 border-dashed border-slate-300" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-slate-700">{current ? current.name : 'Empty peg'}</p>
          <p className="text-xs font-semibold text-slate-400">
            {cellLabel(cell.x, cell.y)} · col {cell.x + 1}, row {cell.y + 1}
            {current && ` · ${current.code}`}
          </p>
        </div>
        <button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-2 p-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            type="search"
            className="input py-1.5 pl-8"
            placeholder="Search owned colours…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {currentId && (
          <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-600">
            <input type="checkbox" className="accent-pink-500" checked={replaceMode} onChange={(e) => setReplaceMode(e.target.checked)} />
            <Replace className="h-3.5 w-3.5" /> Replace every “{current?.name}” bead
          </label>
        )}
      </div>
      <div className="grid flex-1 grid-cols-6 gap-1.5 overflow-y-auto px-3 pb-3">
        <button
          type="button"
          onClick={() => choose(null)}
          title="Empty peg (no bead)"
          aria-label="Empty peg"
          className={`flex aspect-square items-center justify-center rounded-xl border-2 border-dashed transition hover:scale-110 ${
            currentId === null ? 'border-brand-500 text-brand-500' : 'border-slate-300 text-slate-400'
          }`}
        >
          <Ban className="h-4 w-4" />
        </button>
        {sorted.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => choose(c.id)}
            title={`${c.code} ${c.name}`}
            aria-label={`${c.code} ${c.name}`}
            className={`flex aspect-square items-center justify-center rounded-xl transition hover:scale-110 hover:bg-slate-50 ${
              c.id === currentId ? 'bg-brand-50 ring-2 ring-brand-500' : ''
            }`}
          >
            <BeadSwatch hex={c.hex} size={30} />
          </button>
        ))}
        {sorted.length === 0 && <p className="col-span-5 self-center text-xs font-semibold text-slate-400">No owned colours match.</p>}
      </div>
    </div>
  );
}
