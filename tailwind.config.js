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
      },
      animation: {
        'tap-ripple': 'tap-ripple 1.1s cubic-bezier(0.22, 1, 0.36, 1) 1',
      },
    },
  },
  plugins: [],
};
