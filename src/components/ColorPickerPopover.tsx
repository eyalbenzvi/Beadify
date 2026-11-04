import { useMemo, useState } from 'react';
import { Ban, Replace, Search, X } from 'lucide-react';
import type { BeadColor } from '../types';
import { BEAD_BY_ID } from '../data/beadColors';
import { ciede2000 } from '../lib/color';
import { cellLabel } from '../lib/pattern';
import { BeadSwatch } from './ui';
import { Sheet } from './Sheet';

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

  const choose = (id: string | null) => {
    if (replaceMode && currentId) onReplaceAll(currentId, id);
    else onPick(id);
  };

  return (
    <Sheet anchor={anchor} label={`Choose bead for ${cellLabel(cell.x, cell.y)}`} onClose={onClose}>
      <div className="flex items-center gap-2.5 border-b border-line-soft p-3">
        {current ? <BeadSwatch hex={current.hex} size={28} /> : <span className="h-7 w-7 rounded-full border-2 border-dashed border-line-strong" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-ink-soft">{current ? current.name : 'Empty peg'}</p>
          <p className="text-xs font-semibold text-ink-subtle">
            {cellLabel(cell.x, cell.y)} · col {cell.x + 1}, row {cell.y + 1}
            {current && ` · ${current.code}`}
          </p>
        </div>
        <button type="button" className="rounded-lg p-1.5 text-ink-subtle hover:bg-surface-sunken" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-2 p-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <input
            type="search"
            className="input py-1.5 pl-8"
            placeholder="Search owned colours…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {currentId && (
          <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-ink-muted">
            <input type="checkbox" className="accent-pink-500" checked={replaceMode} onChange={(e) => setReplaceMode(e.target.checked)} />
            <Replace className="h-3.5 w-3.5" /> Replace every “{current?.name}” bead
          </label>
        )}
      </div>
      <div className="grid flex-1 grid-cols-7 gap-1.5 sm:grid-cols-6 overflow-y-auto px-3 pb-3">
        <button
          type="button"
          onClick={() => choose(null)}
          title="Empty peg (no bead)"
          aria-label="Empty peg"
          className={`flex aspect-square items-center justify-center rounded-xl border-2 border-dashed transition hover:scale-110 ${
            currentId === null ? 'border-brand-500 text-brand-500' : 'border-line-strong text-ink-subtle'
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
            className={`flex aspect-square items-center justify-center rounded-xl transition hover:scale-110 hover:bg-surface-muted ${
              c.id === currentId ? 'bg-brand-50 ring-2 ring-brand-500' : ''
            }`}
          >
            <BeadSwatch hex={c.hex} size={30} />
          </button>
        ))}
        {sorted.length === 0 && <p className="col-span-5 self-center text-xs font-semibold text-ink-subtle">No owned colours match.</p>}
      </div>
    </Sheet>
  );
}
