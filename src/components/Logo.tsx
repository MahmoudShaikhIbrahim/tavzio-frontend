import { useTheme } from '../lib/ThemeContext';

// Single source of truth for the Tavzio wordmark. Two pre-cut transparent
// PNGs (white text for dark surfaces, ink-dark text for light surfaces)
// swap based on the resolved theme, so this always reads clean regardless
// of which page or theme mode it's dropped into - no more plain text
// "Tavzio" standing in for the real mark, and no more baking a light/dark
// choice into any one page. Cropped tight to the actual glyphs (not a
// mostly-empty square canvas), so a given height genuinely fills its
// space instead of most of it being invisible padding - that gap was
// the real reason the mark used to read as "barely visible" even when
// its container looked reasonably sized.
export default function Logo({ className = 'h-9 w-auto' }: { className?: string }) {
  const { resolvedTheme } = useTheme();
  const src = resolvedTheme === 'light' ? '/brand/logo-dark.png' : '/brand/logo-white.png';
  return (
    <img
      src={src}
      alt="Tavzio"
      className={className}
      style={{ filter: resolvedTheme === 'light' ? 'none' : 'drop-shadow(0 0 14px rgba(184,146,90,0.28))' }}
    />
  );
}
