# Tavzio design tokens

Extracted directly from `tailwind.config.js` + `src/index.css` (RGB
triplets as committed - convert to OKLCH when composing new derived
values, per impeccable's color guidance, but preserve these exact
brand anchors as-is).

## Color - dark (default)

| Token | RGB | Role |
|---|---|---|
| `ink` | 20 17 15 | Page background |
| `ink-soft` | 31 26 21 | Raised surface (cards, inputs) |
| `ink-line` | 51 43 35 | Borders/dividers |
| `brass` | 184 146 90 | Primary accent |
| `brass-bright` | 217 180 127 | Accent hover/emphasis |
| `ivory` | 244 238 227 | Primary text |
| `ivory-dim` | 167 154 135 | Secondary/muted text |
| `danger` | 248 113 113 | |
| `success` | 74 222 128 | |
| `info` | 96 165 250 | |
| `warning` | 250 204 21 | |

## Color - light

| Token | RGB | Role |
|---|---|---|
| `ink` | 247 243 236 | Page background (warm parchment, not pure white) |
| `ink-soft` | 239 230 214 | Raised surface |
| `ink-line` | 196 178 148 | Borders/dividers |
| `brass` | 150 115 62 | Primary accent (deepened for contrast on light bg) |
| `brass-bright` | 184 146 90 | Accent hover/emphasis |
| `ivory` | 33 28 22 | Primary text (near-black, not pure black) |
| `ivory-dim` | 82 71 56 | Secondary/muted text |
| `danger` | 185 28 28 | |
| `success` | 21 128 61 | |
| `info` | 29 78 216 | |
| `warning` | 161 98 7 | |

Same variable names both themes, values inverted/retuned per theme -
this is why theme switching works app-wide with zero per-component
changes: every `bg-ink`/`text-ivory`/`border-brass` usage already
resolves correctly in both.

## Type

- Display: `Fraunces` (serif) - headings, brand moments
- Body: `IBM Plex Sans` - UI text, paragraphs
- Mono: `IBM Plex Mono` - codes, technical values

Serif display + sans body is a real contrast pairing (per impeccable's
font-pairing rule) - preserve this pairing, don't introduce a second
sans alongside IBM Plex Sans.

## Motion

- `tap-ripple`: `scale(0.85)→scale(2.4)`, opacity `0.9→0`, over `1.1s`,
  `cubic-bezier(0.22, 1, 0.36, 1)` (an ease-out-expo-family curve -
  already aligned with impeccable's "ease out with exponential curves,
  no bounce/elastic" rule). Extend this curve family for new motion
  rather than introducing a different easing feel.

## Known gaps (confirmed while extracting, not yet fixed)

- `SECTION_OPTIONS`/dashboard sections now correctly scope by business
  category (hotel vs restaurant) - see `dashboardSections.ts`, fixed
  earlier in this project. No further action needed here.
- No dedicated z-index scale found yet (impeccable requires a semantic
  scale: dropdown → sticky → modal-backdrop → modal → toast → tooltip) -
  worth checking during the first `audit` pass, not assumed broken.
