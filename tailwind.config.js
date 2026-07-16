/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#14110F',        // page background - warm near-black, not pure black
        'ink-soft': '#1F1A15', // card/surface background
        'ink-line': '#332B23', // hairline borders on dark surfaces
        brass: '#B8925A',      // primary accent - the "engraved metal" color
        'brass-bright': '#D9B47F',
        ivory: '#F4EEE3',      // primary text on dark
        'ivory-dim': '#A79A87', // secondary/muted text
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
