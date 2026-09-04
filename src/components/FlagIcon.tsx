// Real fix for the explicit report: Unicode flag emoji (🇬🇧, 🇦🇪, ...) render
// as plain two-letter text ("GB", "AE") on Windows/Chrome instead of an
// actual flag - a long-standing platform font limitation, not something
// any amount of CSS on our side can override. Small inline SVGs sidestep
// the font entirely, so the flag looks the same on every OS. Simplified,
// not pixel-accurate replicas - recognizable at the ~20px size these are
// always shown at, which is all this needs.
export type FlagCode = 'GB' | 'AE' | 'RU' | 'ES' | 'IN' | 'PK' | 'PH' | 'CN' | 'FR';

export default function FlagIcon({ code, className }: { code: FlagCode; className?: string }) {
  const cls = className || 'h-3.5 w-5 rounded-[2px]';
  const common = { viewBox: '0 0 3 2', className: `${cls} shrink-0 overflow-hidden`, 'aria-hidden': true } as const;

  switch (code) {
    case 'GB':
      return (
        <svg {...common}>
          <rect width="3" height="2" fill="#00247d" />
          <path d="M0,0 3,2 M3,0 0,2" stroke="#fff" strokeWidth="0.4" />
          <path d="M0,0 3,2 M3,0 0,2" stroke="#cf142b" strokeWidth="0.14" />
          <path d="M1.5,0 1.5,2 M0,1 3,1" stroke="#fff" strokeWidth="0.5" />
          <path d="M1.5,0 1.5,2 M0,1 3,1" stroke="#cf142b" strokeWidth="0.24" />
        </svg>
      );
    case 'AE':
      return (
        <svg {...common}>
          <rect width="3" height="2" fill="#fff" />
          <rect y="0" width="3" height="0.667" fill="#00732f" />
          <rect y="1.333" width="3" height="0.667" fill="#000" />
          <rect width="0.9" height="2" fill="#ff0000" />
        </svg>
      );
    case 'RU':
      return (
        <svg {...common}>
          <rect width="3" height="0.667" fill="#fff" />
          <rect y="0.667" width="3" height="0.667" fill="#0039a6" />
          <rect y="1.333" width="3" height="0.667" fill="#d52b1e" />
        </svg>
      );
    case 'ES':
      return (
        <svg {...common}>
          <rect width="3" height="2" fill="#aa151b" />
          <rect y="0.5" width="3" height="1" fill="#f1bf00" />
        </svg>
      );
    case 'IN':
      return (
        <svg {...common}>
          <rect width="3" height="0.667" fill="#ff9933" />
          <rect y="0.667" width="3" height="0.667" fill="#fff" />
          <rect y="1.333" width="3" height="0.667" fill="#138808" />
          <circle cx="1.5" cy="1" r="0.22" fill="none" stroke="#000080" strokeWidth="0.05" />
        </svg>
      );
    case 'PK':
      return (
        <svg {...common}>
          <rect width="3" height="2" fill="#01411c" />
          <rect width="0.75" height="2" fill="#fff" />
          <circle cx="1.9" cy="1" r="0.45" fill="#fff" />
          <circle cx="2.05" cy="1" r="0.38" fill="#01411c" />
          <path d="M2.35,0.65 2.45,0.85 2.67,0.85 2.5,0.98 2.57,1.2 2.35,1.06 2.13,1.2 2.2,0.98 2.03,0.85 2.25,0.85 Z" fill="#fff" />
        </svg>
      );
    case 'PH':
      return (
        <svg {...common}>
          <rect width="3" height="1" fill="#0038a8" />
          <rect y="1" width="3" height="1" fill="#ce1126" />
          <path d="M0,0 1.3,1 0,2 Z" fill="#fff" />
          <circle cx="0.45" cy="1" r="0.16" fill="#fcd116" />
        </svg>
      );
    case 'CN':
      return (
        <svg {...common}>
          <rect width="3" height="2" fill="#de2910" />
          <path d="M0.5,0.3 0.62,0.66 1,0.66 0.7,0.88 0.82,1.24 0.5,1.02 0.18,1.24 0.3,0.88 0,0.66 0.38,0.66 Z" fill="#ffde00" />
          <circle cx="1.1" cy="0.25" r="0.07" fill="#ffde00" />
          <circle cx="1.25" cy="0.5" r="0.07" fill="#ffde00" />
          <circle cx="1.25" cy="0.8" r="0.07" fill="#ffde00" />
          <circle cx="1.1" cy="1.05" r="0.07" fill="#ffde00" />
        </svg>
      );
    case 'FR':
      return (
        <svg {...common}>
          <rect width="1" height="2" fill="#0055a4" />
          <rect x="1" width="1" height="2" fill="#fff" />
          <rect x="2" width="1" height="2" fill="#ef4135" />
        </svg>
      );
  }
}
