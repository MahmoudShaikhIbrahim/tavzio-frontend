// The real T mark from the back of the actual Tavzio business card - the
// same skewed path data, unchanged, just recolored via currentColor so
// it inherits whatever color it's placed in instead of the flat white
// fill baked into that print file (which only ever had to work on one
// dark background). fill="currentColor" is what lets a single icon
// component work in every place Logo renders - dark mode, light mode,
// or a business's own custom theme color - the exact same reasoning
// the text next to it already relies on.
export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="-89.50 -37.50 763.25 773.75" className={className} fill="currentColor" aria-hidden="true">
      <g transform="skewX(-17.715)">
        <path d="M 114.0,0 L 637.5,0 L 634.0,164.0 L 398.4,164.0 L 398.4,700.0 L 237.4,700.0 L 237.4,164.0 L 0,164.0 L 0,114.0 A 114.0,114.0 0 0 1 114.0,0 Z" />
      </g>
    </svg>
  );
}

// Real text, not an image - a PNG has a color baked in at export time, so
// it can never adapt to whatever a business actually sets as their own
// theme color (see businessTheme.ts, which computes real, contrast-safe
// text color from whatever background a business picks). Real text
// inherits that same color automatically, the same way every other
// word on the page already does - dark mode, light mode, or any custom
// color a business sets - no separate light/dark image swap needed at
// all, since text-ivory already handles that itself. This is the exact
// same word from the front of the actual business card, just set in
// this app's own display font instead of that print file's one-off
// custom letterform paths - a real font can't reproduce hand-built
// vector letterforms exactly, but it's the only way this stays
// selectable, accessible text instead of another image.
//
// size replaces what used to be a height class (h-9, h-12, etc) - those
// were sized for an image's aspect ratio and don't map cleanly onto
// font size. className is still there for real layout needs (mx-auto,
// lg:hidden) alongside it.
const SIZES = { md: 'text-2xl', lg: 'text-3xl', sm: 'text-xl' } as const;
const ICON_SIZES = { md: 'h-6 w-6', lg: 'h-7 w-7', sm: 'h-5 w-5' } as const;

export default function Logo({ className = '', size = 'md' }: { className?: string; size?: keyof typeof SIZES }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display font-semibold uppercase tracking-wide text-ivory ${SIZES[size]} ${className}`}>
      <LogoMark className={`${ICON_SIZES[size]} shrink-0 text-brass`} />
      Tavzio
    </span>
  );
}
