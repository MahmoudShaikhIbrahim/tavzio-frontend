/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // CSS variables, not fixed hex - this is what makes theme
        // switching (light/dark/system) apply everywhere automatically:
        // every existing bg-ink, text-ivory, border-brass usage across
        // the whole app already uses these names, so swapping the
        // underlying variable values (see index.css) re-themes
        // everything at once, with zero changes needed in any component.
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        'ink-soft': 'rgb(var(--color-ink-soft) / <alpha-value>)',
        'ink-line': 'rgb(var(--color-ink-line) / <alpha-value>)',
        brass: 'rgb(var(--color-brass) / <alpha-value>)',
        'brass-bright': 'rgb(var(--color-brass-bright) / <alpha-value>)',
        ivory: 'rgb(var(--color-ivory) / <alpha-value>)',
        'ivory-dim': 'rgb(var(--color-ivory-dim) / <alpha-value>)',
        // Status colors - also theme-aware, following the same principle:
        // brighter in dark mode, deepened in light mode, so contrast holds
        // in both instead of one theme inheriting the other's tuning.
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        info: 'rgb(var(--color-info) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        body: ['"IBM Plex Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      keyframes: {
        'tap-ripple': {
          '0%': { transform: 'scale(0.85)', opacity: '0.9' },
          '70%': { transform: 'scale(2.4)', opacity: '0' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        'hero-rise': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        // A live status pulse - not decoration, a real signal this is a
        // running product, not a screenshot. Legitimate to run
        // continuously (same convention as any "live" indicator dot),
        // unlike the earlier ambient cover drift this app doesn't have.
        'live-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        // One-shot payoff moment for a real booking confirmation - the
        // single highest-emotion instant in this whole flow, deserving
        // real weight, unlike the neutral/failure states around it.
        'confirm-pop': {
          '0%': { opacity: '0', transform: 'scale(0.5)' },
          '60%': { opacity: '1', transform: 'scale(1.08)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'tap-ripple': 'tap-ripple 1.1s cubic-bezier(0.22, 1, 0.36, 1) 1',
        'hero-rise': 'hero-rise 0.8s cubic-bezier(0.22, 1, 0.36, 1) both',
        'live-pulse': 'live-pulse 2s ease-in-out infinite',
        'confirm-pop': 'confirm-pop 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
      // Same curve as tap-ripple above, exposed as a reusable class
      // (ease-brass) so every other piece of motion in the app - scroll
      // reveals, hover transitions, anything added later - draws from
      // the same one considered easing instead of falling back to
      // Tailwind's generic ease-out by default.
      transitionTimingFunction: {
        brass: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      // Real semantic scale (found missing during the design audit -
      // every stacking value across the app was a standalone number
      // like z-10/z-40 with no documented relationship to any other).
      // Use these names going forward instead of arbitrary numbers.
      zIndex: {
        dropdown: '10',
        sticky: '20',
        'modal-backdrop': '30',
        modal: '40',
        toast: '50',
      },
    },
  },
  plugins: [],
};
