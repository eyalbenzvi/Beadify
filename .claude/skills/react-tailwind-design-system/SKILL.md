---
name: react-tailwind-design-system
description: Modern React & Tailwind Design Systems Architect for Beadify. Use when creating or restyling UI components, layout, theming, accessibility, responsive behaviour or motion in src/components, src/steps, src/index.css or tailwind.config.js.
---

# Modern React & Tailwind Design Systems Architect

## Tokens first

- Colours, radii, shadows and motion live in `tailwind.config.js` and CSS variables in
  `src/index.css`. Components use **semantic** utilities (`bg-surface`, `text-ink`,
  `text-ink-muted`, `border-line`, `bg-brand-500`) and never raw hex values. The exception
  is data-driven colour such as bead swatches.
- Reusable patterns are `@layer components` classes (`.card`, `.btn-*`, `.chip`, `.input`,
  `.label`) or React primitives in `src/components/ui.tsx` (`Slider`, `Toggle`,
  `Segmented`, `Sheet`, `BeadSwatch`, `Stat`, `Spinner`). Extend these. Don't fork one-off
  styles.

## Layout rules

- Every CSS grid item that can contain wide content gets `min-w-0`, and every grid declares
  `grid-cols-1` as its mobile base. This prevents horizontal page overflow on phones.
- Mobile-first: base classes target about 360 px, then layer `sm:`/`md:`/`lg:`/`xl:`.
- Floating UI (popovers, pickers) becomes a bottom **sheet** under `sm` and stays
  anchored to the pointer above it.

## Accessibility

- Interactive elements are real `<button>`/`<input>` elements with an accessible name.
- Toggle buttons use `aria-pressed`, radio groups use `role="radiogroup"`/`role="radio"`
  with `aria-checked`, and dialogs use `role="dialog"` with `aria-modal`, close on Escape
  and restore focus.
- Honour `prefers-reduced-motion`: every animation and smooth scroll is disabled through
  the global reduced-motion rule and `motion-safe:` utilities.
- Text contrast is at least 4.5:1. Muted text never goes lighter than `slate-500` on white.

## React rules

- Context holds durable state. Derived data goes through `useMemo`, and callbacks passed to
  canvas components go through `useCallback`.
- No side effects inside state updater functions, because StrictMode double-invokes them.
- Heavy routes are `lazy()`-loaded behind `Suspense` with a `Spinner` fallback.
- An `ErrorBoundary` wraps the step content so a crash shows a recoverable screen instead
  of a blank page.

## Checklist

- [ ] No horizontal scroll at 375 px width.
- [ ] Keyboard-only users can complete the full flow.
- [ ] Reduced motion produces no animation.
- [ ] `npm run build` passes.
