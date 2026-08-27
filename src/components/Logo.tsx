// Real text, not an image - a PNG has a color baked in at export time, so
// it can never adapt to whatever a business actually sets as their own
// theme color (see businessTheme.ts, which computes real, contrast-safe
// text color from whatever background a business picks). Real text
// inherits that same color automatically, the same way every other
// word on the page already does - dark mode, light mode, or any custom
// color a business sets - no separate light/dark image swap needed at
// all, since text-ivory already handles that itself.
//
// size replaces what used to be a height class (h-9, h-12, etc) - those
// were sized for an image's aspect ratio and don't map cleanly onto
// font size. className is still there for real layout needs (mx-auto,
// lg:hidden) alongside it.
const SIZES = { md: 'text-2xl', lg: 'text-3xl', sm: 'text-xl' } as const;

export default function Logo({ className = '', size = 'md' }: { className?: string; size?: keyof typeof SIZES }) {
  return (
    <span className={`inline-flex items-center font-display font-semibold uppercase tracking-wide text-ivory ${SIZES[size]} ${className}`}>
      Tavzio
    </span>
  );
}
