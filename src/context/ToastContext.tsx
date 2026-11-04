import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import type { ToastMessage } from '../types';

interface ToastApi {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ICONS = {
  success: <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden />,
  error: <AlertCircle className="h-5 w-5 text-rose-500" aria-hidden />,
  info: <Info className="h-5 w-5 text-sky-500" aria-hidden />,
};

const ACCENT = {
  success: 'border-l-emerald-400',
  error: 'border-l-rose-400',
  info: 'border-l-sky-400',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastMessage['kind'], title: string, description?: string) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { id, kind, title, description }]);
      window.setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3500);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (t, d) => push('success', t, d),
      error: (t, d) => push('error', t, d),
      info: (t, d) => push('info', t, d),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="no-print pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4 sm:top-auto sm:bottom-6 sm:right-6 sm:left-auto sm:items-end"
        aria-live="polite"
        role="status"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-2xl border border-l-4 border-line bg-white/95 p-3.5 shadow-pop backdrop-blur ${ACCENT[t.kind]}`}
          >
            <span className="mt-0.5 shrink-0">{ICONS[t.kind]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">{t.title}</p>
              {t.description && <p className="mt-0.5 text-xs text-ink-subtle">{t.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="rounded-lg p-1 text-ink-subtle transition hover:bg-surface-sunken hover:text-ink-muted"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
