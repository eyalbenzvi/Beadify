/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Fredoka', 'Nunito', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Semantic tokens backed by CSS variables in src/index.css (rgb channels for /opacity support)
        canvas: 'rgb(var(--color-canvas) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          muted: 'rgb(var(--color-surface-muted) / <alpha-value>)',
          sunken: 'rgb(var(--color-surface-sunken) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--color-ink) / <alpha-value>)',
          soft: 'rgb(var(--color-ink-soft) / <alpha-value>)',
          muted: 'rgb(var(--color-ink-muted) / <alpha-value>)',
          subtle: 'rgb(var(--color-ink-subtle) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--color-line) / <alpha-value>)',
          soft: 'rgb(var(--color-line-soft) / <alpha-value>)',
          strong: 'rgb(var(--color-line-strong) / <alpha-value>)',
        },
        inverse: 'rgb(var(--color-inverse) / <alpha-value>)',
        brand: {
          50: '#fdf2f8',
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#f9a8d4',
          400: '#f472b6',
          500: '#ec4899',
          600: '#db2777',
          700: '#be185d',
          800: '#9d174d',
          900: '#831843',
        },
      },
      borderRadius: {
        control: '0.75rem',
        panel: '1.5rem',
      },
      transitionDuration: {
        fast: '150ms',
        base: '250ms',
      },
      boxShadow: {
        soft: '0 2px 12px -2px rgba(76, 29, 149, 0.08), 0 1px 3px rgba(15, 23, 42, 0.06)',
        pop: '0 12px 32px -8px rgba(219, 39, 119, 0.35)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'toast-in': {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-6deg)' },
          '50%': { transform: 'rotate(6deg)' },
        },
        'bead-bounce': {
          '0%, 80%, 100%': { transform: 'scale(0.6)', opacity: '0.5' },
          '40%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.35s ease-out both',
        'toast-in': 'toast-in 0.25s ease-out both',
        wiggle: 'wiggle 0.6s ease-in-out',
        'bead-bounce': 'bead-bounce 1.2s infinite ease-in-out both',
      },
    },
  },
  plugins: [],
};
