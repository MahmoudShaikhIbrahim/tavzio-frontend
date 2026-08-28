// The real T mark from the back of the actual Tavzio business card - the
// same skewed path data, unchanged, just recolored via currentColor so
// it inherits whatever color it's placed in instead of the flat white
// fill baked into that print file (which only ever had to work on one
// dark background).
export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="-89.50 -37.50 763.25 773.75" className={className} fill="currentColor" aria-hidden="true">
      <g transform="skewX(-17.715)">
        <path d="M 114.0,0 L 637.5,0 L 634.0,164.0 L 398.4,164.0 L 398.4,700.0 L 237.4,700.0 L 237.4,164.0 L 0,164.0 L 0,114.0 A 114.0,114.0 0 0 1 114.0,0 Z" />
      </g>
    </svg>
  );
}

// The exact "Tavzio" wordmark from the front of the actual business
// card - the real letterform paths, not a font approximation. A font
// can never match hand-built custom vector letterforms exactly (no
// typeface has these exact shapes), so this is the real path data
// itself, recolored via currentColor the same way LogoMark above is -
// still genuinely scalable vector markup, not a flat raster image file,
// so it still adapts to dark mode, light mode, or a business's own
// theme color like every other themed element on the page.
export function LogoWordmark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="-89.50 -39.25 3078.50 789.50" className={className} fill="currentColor" aria-hidden="true" role="img" aria-label="Tavzio">
      <g transform="skewX(-17.715)">
        <path transform="translate(0.0,0)" d="M 114.0,0 L 637.5,0 L 634.0,164.0 L 398.4,164.0 L 398.4,700.0 L 237.4,700.0 L 237.4,164.0 L 0,164.0 L 0,114.0 A 114.0,114.0 0 0 1 114.0,0 Z" />
        <path transform="translate(582.5,0)" d="M 0.0,445.0 A 250.0,269.0 0 0 1 500.0,445.0 A 250.0,269.0 0 0 1 0.0,445.0 Z M 339.0,190.0 L 500.0,190.0 L 500.0,700.0 L 339.0,700.0 Z M 161.0,445.0 A 89.0,124.0 0 0 0 339.0,445.0 A 89.0,124.0 0 0 0 161.0,445.0 Z" />
        <path transform="translate(1152.5,0)" d="M 0,190.0 L 174.4,190.0 L 310.0,413.1 L 445.6,190.0 L 620.0,190.0 L 310.0,700.0 Z" />
        <path transform="translate(1818.5,0)" d="M 0,190.0 L 490.0,190.0 L 490.0,315.0 L 192.0,575.0 L 490.0,575.0 L 490.0,700.0 L 0,700.0 L 0,575.0 L 298.0,315.0 L 0,315.0 Z" />
        <path transform="translate(2368.5,0)" d="M 0,190.0 L 161.0,190.0 L 161.0,700.0 L 0,700.0 Z M 5.5,73.0 A 75.0,75.0 0 0 1 155.5,73.0 A 75.0,75.0 0 0 1 5.5,73.0 Z" />
        <path transform="translate(2573.5,0)" d="M 0.0,445.0 A 253.0,269.0 0 0 1 506.0,445.0 A 253.0,269.0 0 0 1 0.0,445.0 Z M 161.0,445.0 A 92.0,124.0 0 0 0 345.0,445.0 A 92.0,124.0 0 0 0 161.0,445.0 Z" />
      </g>
    </svg>
  );
}

// size controls the wordmark's height; width follows automatically from
// its own aspect ratio (viewBox is ~3078:789, i.e. roughly 4:1).
const SIZES = { md: 'h-6', lg: 'h-8', sm: 'h-5' } as const;

export default function Logo({ className = '', size = 'md' }: { className?: string; size?: keyof typeof SIZES }) {
  return (
    <span className={`inline-flex items-center text-ivory ${className}`}>
      <LogoWordmark className={`${SIZES[size]} w-auto`} />
    </span>
  );
}
