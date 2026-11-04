import { useMemo, useState } from 'react';
import { Check, CheckCheck, Eraser, Package, Search, Star, X } from 'lucide-react';
import type { ColorFamily } from '../types';
import { BASIC_24, BEAD_COLORS, BRANDS, COLOR_FAMILIES, FAMILY_SWATCH } from '../data/beadColors';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { BeadSwatch, SectionTitle } from './ui';

export default function InventoryManager() {
  const { brand, setBrand, inventory, setInventory, toggleInventory } = useApp();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState<ColorFamily | 'All'>('All');
  const [ownedOnly, setOwnedOnly] = useState(false);

  const brandColors = useMemo(() => BEAD_COLORS.filter((c) => c.brand === brand), [brand]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return brandColors.filter(
      (c) =>
        (family === 'All' || c.family === family) &&
        (!ownedOnly || inventory.has(c.id)) &&
        (!q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.hex.toLowerCase().includes(q)),
    );
  }, [brandColors, family, ownedOnly, query, inventory]);

  const ownedInBrand = brandColors.filter((c) => inventory.has(c.id)).length;
  const otherBrandIds = [...inventory].filter((id) => !brandColors.some((c) => c.id === id));

  const familyCounts = useMemo(() => {
    const m = new Map<ColorFamily, number>();
    for (const c of brandColors) m.set(c.family, (m.get(c.family) ?? 0) + 1);
    return m;
  }, [brandColors]);

  const selectAll = () => {
    setInventory([...otherBrandIds, ...brandColors.map((c) => c.id)]);
    toast.success(`All ${brandColors.length} ${brand} colours selected`);
  };
  const selectBasic = () => {
    setInventory([...otherBrandIds, ...BASIC_24[brand]]);
    toast.success(`Basic 24 ${brand} colours selected`);
  };
  const clearBrand = () => {
    setInventory(otherBrandIds);
    toast.info(`${brand} colours cleared`);
  };
  const selectVisible = (on: boolean) => {
    const ids = new Set(inventory);
    for (const c of visible) {
      if (on) ids.add(c.id);
      else ids.delete(c.id);
    }
    setInventory(ids);
  };

  return (
    <section className="card p-4 sm:p-6">
      <SectionTitle
        icon={<Package className="h-5 w-5" />}
        title="My bead inventory"
        subtitle="Patterns will only use colours you own. Your selection is saved on this device."
        action={
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-extrabold text-brand-600">
            {inventory.size} colour{inventory.size === 1 ? '' : 's'} owned
          </span>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Bead brand" className="flex rounded-2xl bg-surface-sunken p-1">
          {BRANDS.map((b) => {
            const count = BEAD_COLORS.filter((c) => c.brand === b && inventory.has(c.id)).length;
            return (
              <button
                key={b}
                role="tab"
                type="button"
                aria-selected={brand === b}
                onClick={() => setBrand(b)}
                className={`rounded-xl px-4 py-1.5 text-sm font-bold transition ${
                  brand === b ? 'bg-white text-brand-600 shadow-sm' : 'text-ink-subtle hover:text-ink-soft'
                }`}
              >
                {b} <span className="text-xs text-ink-subtle">({count})</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={selectAll}>
            <CheckCheck className="h-4 w-4" /> Select all (full palette)
          </button>
          <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={selectBasic}>
            <Star className="h-4 w-4" /> Basic 24 colours
          </button>
          <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={clearBrand}>
            <Eraser className="h-4 w-4" /> Clear
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <input
            type="search"
            className="input pl-9"
            placeholder="Search by name, code or hex…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search colours"
          />
          {query && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-ink-subtle hover:text-ink-muted"
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-bold text-ink-muted">
          <input
            type="checkbox"
            className="h-4 w-4 accent-pink-500"
            checked={ownedOnly}
            onChange={(e) => setOwnedOnly(e.target.checked)}
          />
          Owned only
        </label>
      </div>

      <div className="scrollbar-thin -mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          onClick={() => setFamily('All')}
          className={`chip shrink-0 ${family === 'All' ? 'border-inverse bg-inverse text-white' : 'border-line bg-white text-ink-muted'}`}
        >
          All ({brandColors.length})
        </button>
        {COLOR_FAMILIES.filter((f) => familyCounts.get(f)).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFamily(f)}
            className={`chip shrink-0 ${family === f ? 'border-inverse bg-inverse text-white' : 'border-line bg-white text-ink-muted'}`}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: FAMILY_SWATCH[f] }} />
            {f} ({familyCounts.get(f)})
          </button>
        ))}
      </div>

      <div className="mb-2 flex items-center justify-between text-xs font-bold text-ink-subtle">
        <span>
          {ownedInBrand} / {brandColors.length} {brand} colours owned · showing {visible.length}
        </span>
        {visible.length > 0 && (
          <span className="flex gap-3">
            <button type="button" className="text-brand-500 hover:text-brand-700" onClick={() => selectVisible(true)}>
              Select shown
            </button>
            <button type="button" className="text-ink-subtle hover:text-ink-muted" onClick={() => selectVisible(false)}>
              Deselect shown
            </button>
          </span>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl bg-surface-muted py-10 text-center text-sm font-semibold text-ink-subtle">
          No colours match your filters.
        </p>
      ) : (
        <ul className="grid max-h-[460px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-4">
          {visible.map((c) => {
            const owned = inventory.has(c.id);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  aria-pressed={owned}
                  onClick={() => toggleInventory(c.id)}
                  className={`flex w-full items-center gap-2.5 rounded-2xl border p-2 text-left transition active:scale-[0.98] ${
                    owned
                      ? 'border-brand-300 bg-brand-50/70 shadow-sm'
                      : 'border-line-soft bg-white opacity-60 grayscale-[40%] hover:opacity-100 hover:grayscale-0'
                  }`}
                >
                  <BeadSwatch hex={c.hex} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-extrabold text-ink-soft">{c.name}</span>
                    <span className="block text-[11px] font-semibold text-ink-subtle">
                      {c.code} · {c.hex}
                    </span>
                  </span>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                      owned ? 'border-brand-500 bg-brand-500 text-white' : 'border-line-strong'
                    }`}
                  >
                    {owned && <Check className="h-3 w-3" strokeWidth={4} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
