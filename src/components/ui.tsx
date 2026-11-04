import type { ReactNode } from 'react';

export function Spinner({ label = 'Working…', className = '' }: { label?: string; className?: string }) {
  const colors = ['bg-brand-400', 'bg-violet-400', 'bg-amber-300'];
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`} role="status" aria-live="polite">
      <div className="flex gap-1.5">
        {colors.map((c, i) => (
          <span
            key={c}
            className={`h-3.5 w-3.5 animate-bead-bounce rounded-full ${c} ring-2 ring-white`}
            style={{ animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </div>
      <span className="text-sm font-bold text-ink-subtle">{label}</span>
    </div>
  );
}

export function SectionTitle({ icon, title, subtitle, action }: { icon?: ReactNode; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            {icon}
          </span>
        )}
        <div>
          <h2 className="font-display text-lg font-semibold text-ink sm:text-xl">{title}</h2>
          {subtitle && <p className="text-sm text-ink-subtle">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  icon?: ReactNode;
  format?: (v: number) => string;
  resetValue?: number;
}

export function Slider({ label, value, min, max, step = 1, onChange, icon, format, resetValue }: SliderProps) {
  const id = `slider-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="flex items-center gap-2 text-sm font-bold text-ink-soft">
          {icon}
          {label}
        </label>
        <div className="flex items-center gap-2">
          <span className="min-w-[3ch] rounded-lg bg-surface-sunken px-2 py-0.5 text-right text-xs font-extrabold tabular-nums text-ink-muted">
            {format ? format(value) : value}
          </span>
          {resetValue !== undefined && value !== resetValue && (
            <button
              type="button"
              className="text-xs font-bold text-brand-500 hover:text-brand-700"
              onClick={() => onChange(resetValue)}
            >
              Reset
            </button>
          )}
        </div>
      </div>
      <input
        id={id}
        type="range"
        className="slider w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  description?: string;
  icon?: ReactNode;
}

export function Toggle({ label, checked, onChange, description, icon }: ToggleProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-1 py-1.5">
      <span className="flex min-w-0 items-center gap-2">
        {icon && <span className="text-ink-subtle">{icon}</span>}
        <span className="min-w-0">
          <span className="block text-sm font-bold text-ink-soft">{label}</span>
          {description && <span className="block text-xs text-ink-subtle">{description}</span>}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-brand-500' : 'bg-line-strong'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`}
        />
      </button>
    </label>
  );
}

interface SegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: string; icon?: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
  size?: 'sm' | 'md';
}

export function Segmented<T extends string>({ value, options, onChange, ariaLabel, size = 'md' }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-1 rounded-2xl bg-surface-sunken p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl font-bold transition ${
              size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'
            } ${active ? 'bg-white text-brand-600 shadow-sm' : 'text-ink-subtle hover:text-ink-soft'}`}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function BeadSwatch({ hex, size = 20, className = '', title }: { hex: string; size?: number; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-block shrink-0 rounded-full ring-1 ring-black/10 ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.0) 0 ${size * 0.17}px, ${hex} ${size * 0.18}px), ${hex}`,
        boxShadow: `inset 0 -${Math.max(1, size / 10)}px ${Math.max(2, size / 6)}px rgba(0,0,0,0.18), inset 0 ${Math.max(1, size / 10)}px ${Math.max(2, size / 6)}px rgba(255,255,255,0.35)`,
        WebkitMaskImage: `radial-gradient(circle at 50% 50%, transparent ${size * 0.16}px, #000 ${size * 0.18}px)`,
        maskImage: `radial-gradient(circle at 50% 50%, transparent ${size * 0.16}px, #000 ${size * 0.18}px)`,
      }}
    />
  );
}

export function Stat({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line-soft bg-surface-muted p-3">
      <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-ink-subtle">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink">{value}</div>
      {hint && <div className="text-xs text-ink-subtle">{hint}</div>}
    </div>
  );
}
