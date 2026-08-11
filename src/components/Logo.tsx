import { useTheme } from '../lib/ThemeContext';

// Single source of truth for the Tavzio wordmark. Two pre-cut transparent
// PNGs (white text for dark surfaces, ink-dark text for light surfaces)
// swap based on the resolved theme, so this always reads clean regardless
// of which page or theme mode it's dropped into - no more plain text
// "Tavzio" standing in for the real mark, and no more baking a light/dark
// choice into any one page.
export default function Logo({ className = 'h-6 w-auto' }: { className?: string }) {
  const { resolvedTheme } = useTheme();
  const src = resolvedTheme === 'light' ? '/brand/logo-dark.png' : '/brand/logo-white.png';
  return <img src={src} alt="Tavzio" className={className} />;
}
