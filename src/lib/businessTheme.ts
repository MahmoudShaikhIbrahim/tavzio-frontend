// =========================================================================
// Business appearance customization - "1 click, 1 color" for Background
// and Buttons. Rather than touching every bg-ink/text-brass class across
// every customer-facing page (and the dashboard), this overrides the
// same CSS custom properties Tailwind's color classes already read from
// (see tailwind.config.js + index.css) on a scoped wrapper - so every
// existing class re-themes automatically, with zero changes needed in
// any page component. Two colors in, a full coherent palette out.
// =========================================================================

import type { CSSProperties } from 'react';

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

function rgbToTriple([r, g, b]: [number, number, number]): string {
  return `${r} ${g} ${b}`;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

// Shifts a color toward white (positive amount) or black (negative) -
// used to derive the "soft"/"line" surface shades from a single
// background color, same relationship the original ink/ink-soft/ink-line
// trio already has.
function shift([r, g, b]: [number, number, number], amount: number): [number, number, number] {
  const target = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  return [clamp(r + (target - r) * t), clamp(g + (target - g) * t), clamp(b + (target - b) * t)];
}

// Relative luminance (WCAG-style approximation) - decides whether text on
// top of this color should be light or dark, so a business can never
// accidentally pick a combination that makes their own page unreadable.
function isLight([r, g, b]: [number, number, number]): boolean {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

// Builds the full 7-variable set from just two chosen colors. Either or
// both can be null/undefined - in that case those specific variables are
// simply omitted, so the page's normal [data-theme] default takes over
// with zero visual change until a business actually picks a color.
export function buildBusinessThemeVars(background?: string | null, button?: string | null): CSSProperties {
  const vars: Record<string, string> = {};

  const bg = background ? hexToRgb(background) : null;
  if (bg) {
    const textIsDark = isLight(bg);
    vars['--color-ink'] = rgbToTriple(bg);
    vars['--color-ink-soft'] = rgbToTriple(shift(bg, textIsDark ? -0.08 : 0.12));
    vars['--color-ink-line'] = rgbToTriple(shift(bg, textIsDark ? -0.18 : 0.28));
    vars['--color-ivory'] = textIsDark ? '20 17 15' : '244 238 227';
    vars['--color-ivory-dim'] = textIsDark ? '82 71 56' : '167 154 135';
  }

  const btn = button ? hexToRgb(button) : null;
  if (btn) {
    vars['--color-brass'] = rgbToTriple(btn);
    vars['--color-brass-bright'] = rgbToTriple(shift(btn, 0.18));
  }

  return vars as CSSProperties;
}
