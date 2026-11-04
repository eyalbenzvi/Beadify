import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface SheetProps {
  /** Pointer position the popover anchors to on larger screens */
  anchor?: { clientX: number; clientY: number };
  label: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

const DESKTOP_QUERY = '(min-width: 640px)';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/**
 * Accessible floating panel. It renders as a popover anchored to the pointer at `sm` and
 * up, and as a bottom sheet with a backdrop on phones. It closes on Escape or an outside
 * click, and restores focus to the previously focused element when it unmounts.
 */
export function Sheet({ anchor, label, onClose, children, className = '' }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  // A touch that opens the sheet is followed by a compatibility "click" at the same spot,
  // which would land on whatever the sheet now shows there. Ignore input briefly.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setArmed(true), 350);
    return () => window.clearTimeout(t);
  }, []);

  // Move focus into the dialog (without popping the mobile keyboard), restore it on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus({ preventScroll: true });
    return () => previous?.focus?.({ preventScroll: true });
  }, []);

  useLayoutEffect(() => {
    if (!isDesktop || !anchor) return;
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
  }, [anchor, isDesktop]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      // Keep Tab focus inside the dialog.
      if (e.key === 'Tab' && ref.current) {
        const focusables = ref.current.querySelectorAll<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])');
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
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

  const panel = isDesktop ? (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      className={`no-print fixed z-50 flex max-h-[min(440px,80vh)] w-[320px] animate-toast-in flex-col overflow-hidden rounded-panel border border-line bg-surface shadow-2xl ${className}`}
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999 }}
    >
      {children}
    </div>
  ) : (
    <>
      <div className="no-print fixed inset-0 z-40 bg-inverse/40 backdrop-blur-[1px] motion-safe:animate-fade-in-up" aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`no-print fixed inset-x-0 bottom-0 z-50 flex ${armed ? '' : 'pointer-events-none'} max-h-[75vh] flex-col overflow-hidden rounded-t-panel border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-2xl motion-safe:animate-fade-in-up ${className}`}
      >
        <span className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-line-strong" aria-hidden />
        {children}
      </div>
    </>
  );

  return createPortal(panel, document.body);
}
