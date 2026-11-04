import { useMemo, useState } from 'react';
import { ClipboardCopy, Clock, Flame, Grid2x2, Layers, Lightbulb, ShoppingBag, Sparkles } from 'lucide-react';
import type { ColorUsage, Pattern } from '../types';
import { useToast } from '../context/ToastContext';
import { contrastText } from '../lib/color';
import { BEADS_PER_BAG, boardsNeeded, estimateMinutes, formatDuration, sortUsage, totalBeads } from '../lib/pattern';
import { BeadSwatch, SectionTitle, Segmented, Stat } from './ui';

interface Props {
  pattern: Pattern;
  usage: ColorUsage[];
  inventory: Set<string>;
  highlightId: string | null;
  onHighlight: (id: string | null) => void;
}

export function StatsSummary({ pattern, usage }: { pattern: Pattern; usage: ColorUsage[] }) {
  const beads = totalBeads(pattern);
  const boards = boardsNeeded(pattern.width, pattern.height);
  return (
    <div className="grid grid-cols-2 gap-2">
      <Stat icon={<Sparkles className="h-3.5 w-3.5" />} label="Beads" value={beads.toLocaleString()} hint={`${(pattern.width * pattern.height - beads).toLocaleString()} empty pegs`} />
      <Stat icon={<Layers className="h-3.5 w-3.5" />} label="Colours" value={usage.length} />
      <Stat
        icon={<Grid2x2 className="h-3.5 w-3.5" />}
        label="Pegboards"
        value={boards.total}
        hint={`${boards.across} × ${boards.down} of 29 × 29`}
      />
      <Stat icon={<Clock className="h-3.5 w-3.5" />} label="Build time" value={formatDuration(estimateMinutes(beads))} hint="approx. placing time" />
    </div>
  );
}

export default function ShoppingList({ pattern, usage, inventory, highlightId, onHighlight }: Props) {
  const toast = useToast();
  const [sortBy, setSortBy] = useState<'quantity' | 'family' | 'code'>('quantity');
  const sorted = useMemo(() => sortUsage(usage, sortBy), [usage, sortBy]);
  const beads = totalBeads(pattern);
  const max = usage[0]?.count ?? 1;

  const copyList = async () => {
    const lines = sorted.map(
      (u) => `${u.symbol}\t${u.color.code}\t${u.color.name}\t${u.count}\t(${Math.ceil(u.count / BEADS_PER_BAG)} bag${Math.ceil(u.count / BEADS_PER_BAG) === 1 ? '' : 's'})`,
    );
    const text = [`Beadify shopping list — ${beads} beads, ${usage.length} colours`, ...lines].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Shopping list copied', 'Paste it into your notes or order form.');
    } catch {
      toast.error('Clipboard unavailable', 'Your browser blocked clipboard access.');
    }
  };

  return (
    <section className="card p-4 sm:p-6">
      <SectionTitle
        icon={<ShoppingBag className="h-5 w-5" />}
        title="Shopping list"
        subtitle="Tap a colour to highlight it on the grid."
        action={
          <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => void copyList()}>
            <ClipboardCopy className="h-4 w-4" /> Copy
          </button>
        }
      />
      <div className="mb-3 max-w-sm">
        <Segmented
          ariaLabel="Sort shopping list"
          size="sm"
          value={sortBy}
          onChange={setSortBy}
          options={[
            { value: 'quantity', label: 'Quantity' },
            { value: 'family', label: 'Colour family' },
            { value: 'code', label: 'Code' },
          ]}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="text-left text-xs font-extrabold uppercase tracking-wider text-ink-subtle">
              <th className="py-2 pr-2">Sym</th>
              <th className="py-2 pr-2">Colour</th>
              <th className="py-2 pr-2">Family</th>
              <th className="py-2 pr-2 text-right">Beads</th>
              <th className="w-1/4 py-2 pl-3">Share</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((u) => {
              const active = highlightId === u.color.id;
              const missing = !inventory.has(u.color.id);
              return (
                <tr
                  key={u.color.id}
                  onClick={() => onHighlight(active ? null : u.color.id)}
                  className={`cursor-pointer border-t border-line-soft transition ${active ? 'bg-brand-50' : 'hover:bg-surface-muted'}`}
                >
                  <td className="py-2 pr-2">
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black ring-1 ring-black/10"
                      style={{ background: u.color.hex, color: contrastText(u.color.rgb) }}
                    >
                      {u.symbol}
                    </span>
                  </td>
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-2">
                      <BeadSwatch hex={u.color.hex} size={22} />
                      <div className="min-w-0">
                        <p className="truncate font-extrabold text-ink-soft">{u.color.name}</p>
                        <p className="text-xs font-semibold text-ink-subtle">
                          {u.color.code} · {u.color.brand}
                          {missing && <span className="ml-1 text-amber-600">· not in inventory</span>}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 pr-2 text-xs font-semibold text-ink-subtle">{u.color.family}</td>
                  <td className="py-2 pr-2 text-right font-extrabold tabular-nums text-ink-soft">{u.count.toLocaleString()}</td>
                  <td className="py-2 pl-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                        <div className="h-full rounded-full" style={{ width: `${(u.count / max) * 100}%`, background: u.color.hex }} />
                      </div>
                      <span className="w-10 text-right text-xs font-bold tabular-nums text-ink-subtle">
                        {((u.count / Math.max(1, beads)) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line font-extrabold text-ink-soft">
              <td colSpan={3} className="py-2">
                Total
              </td>
              <td className="py-2 pr-2 text-right tabular-nums">{beads.toLocaleString()}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

const TIPS: { title: string; body: string }[] = [
  {
    title: 'Work board by board',
    body: 'Large patterns are split into 29 × 29 sections (pink dashed lines). Connect your pegboards with the grid on the printout so every section lines up.',
  },
  {
    title: 'Place colours in batches',
    body: 'Fill one colour at a time — start with the outline or the most common colour. Tweezers or a bead pen make small details much easier.',
  },
  {
    title: 'Iron on medium, no steam',
    body: 'Cover the beads with ironing paper and use a medium setting with no steam. Move the iron in slow circles for 10–20 seconds until the beads fuse.',
  },
  {
    title: 'Flip and fuse the back',
    body: 'Let it cool slightly, peel it off the board, flip it and iron the other side for a sturdier piece. Peek under the paper to check the holes are still open if you like the classic look.',
  },
  {
    title: 'Keep it flat',
    body: 'While still warm, place the piece under a heavy book for a few minutes so it cools perfectly flat without warping.',
  },
  {
    title: 'Buy a little extra',
    body: 'Bags vary slightly in count and colour batch — buy about 10% more than the shopping list to cover drops and mistakes.',
  },
];

export function AssemblyTips() {
  return (
    <section className="card p-4 sm:p-6">
      <SectionTitle icon={<Lightbulb className="h-5 w-5" />} title="Ironing & assembly tips" />
      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {TIPS.map((t, i) => (
          <li key={t.title} className="flex gap-3 rounded-2xl bg-amber-50/70 p-3.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white font-display text-sm font-bold text-brand-600 shadow-sm">
              {i + 1}
            </span>
            <div>
              <p className="flex items-center gap-1.5 text-sm font-extrabold text-ink-soft">
                {i === 2 && <Flame className="h-4 w-4 text-orange-500" />}
                {t.title}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{t.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
