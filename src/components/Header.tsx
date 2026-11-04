import { Check, Crop, ImagePlus, Palette, Grid3x3, RotateCcw } from 'lucide-react';
import type { StepId } from '../types';
import { useApp } from '../context/AppContext';

const STEPS: { id: StepId; label: string; short: string; icon: typeof ImagePlus }[] = [
  { id: 1, label: 'Upload / Presets', short: 'Upload', icon: ImagePlus },
  { id: 2, label: 'Crop & Adjust', short: 'Crop', icon: Crop },
  { id: 3, label: 'Inventory & Board', short: 'Colors', icon: Palette },
  { id: 4, label: 'Pattern & Export', short: 'Pattern', icon: Grid3x3 },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-10 w-10 grid-cols-2 gap-0.5 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-500 p-1.5 shadow-pop transition-transform hover:animate-wiggle">
        {['bg-amber-300', 'bg-cyan-200', 'bg-violet-200', 'bg-white'].map((c) => (
          <span key={c} className={`rounded-full ${c} ring-[3px] ring-inset ring-black/10`} />
        ))}
      </div>
      <div className="leading-none">
        <span className="font-display text-2xl font-bold tracking-tight">
          <span className="text-brand-600">Bead</span>
          <span className="text-ink">ify</span>
        </span>
        <span className="hidden text-[11px] font-bold text-ink-subtle sm:block">Pixels → Perler patterns</span>
      </div>
    </div>
  );
}

export default function Header() {
  const { step, setStep, maxReachableStep, source, resetProject } = useApp();

  return (
    <header className="no-print sticky top-0 z-40 border-b border-white/60 bg-white/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <button type="button" onClick={() => setStep(1)} aria-label="Beadify home" className="rounded-2xl">
          <Logo />
        </button>
        {source && (
          <button
            type="button"
            className="btn-ghost px-3 py-2 text-xs"
            onClick={() => {
              if (window.confirm('Start a new project? Your current image and pattern will be cleared.')) resetProject();
            }}
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">New project</span>
          </button>
        )}
      </div>
      <nav aria-label="Progress" className="mx-auto max-w-7xl px-2 pb-2 sm:px-6">
        <ol className="grid grid-cols-4 gap-1 sm:gap-2">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const active = s.id === step;
            const done = s.id < step && s.id <= maxReachableStep;
            const disabled = s.id > maxReachableStep;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setStep(s.id)}
                  aria-current={active ? 'step' : undefined}
                  className={`group flex w-full items-center justify-center gap-2 rounded-2xl px-2 py-2 text-xs font-bold transition sm:justify-start sm:px-3 sm:text-sm ${
                    active
                      ? 'bg-brand-600 text-white shadow-sm'
                      : disabled
                        ? 'cursor-not-allowed text-slate-300'
                        : 'text-ink-muted hover:bg-white hover:shadow-soft'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] ${
                      active ? 'bg-white/25' : done ? 'bg-emerald-100 text-emerald-600' : disabled ? 'bg-surface-sunken' : 'bg-brand-50 text-brand-600'
                    }`}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  </span>
                  <span className="hidden truncate md:inline">
                    {s.id}. {s.label}
                  </span>
                  <span className="truncate md:hidden">{s.short}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </header>
  );
}
