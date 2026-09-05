import { Sun, Moon, MonitorSmartphone } from 'lucide-react';
import { useTheme, type ThemeMode } from '../lib/ThemeContext';

const CYCLE: ThemeMode[] = ['dark', 'light', 'system'];
const ICONS: Record<ThemeMode, typeof Sun> = { dark: Moon, light: Sun, system: MonitorSmartphone };
const LABELS: Record<ThemeMode, string> = { dark: 'Dark', light: 'Light', system: 'System' };
// Advanced/animated emoji per mode - used by the segmented variant so the
// three options read at a glance without relying on label text alone.
const EMOJI: Record<ThemeMode, string> = { system: '🖥️', dark: '🌙', light: '☀️' };
const SEGMENTS: ThemeMode[] = ['system', 'dark', 'light'];

export default function ThemeToggle({ onChange, variant = 'cycle' }: { onChange?: (mode: ThemeMode) => void; variant?: 'cycle' | 'segmented' }) {
  const { mode, setMode } = useTheme();

  function select(next: ThemeMode) {
    setMode(next);
    onChange?.(next);
  }

  // Segmented: all three options visible and directly tappable at once -
  // used at the very top of the dashboard drawer, where the whole point
  // is picking a mode in one tap rather than cycling past ones you don't
  // want first.
  if (variant === 'segmented') {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-ink-line bg-ink p-1">
        {SEGMENTS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => select(m)}
            title={LABELS[m]}
            aria-pressed={mode === m}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${
              mode === m ? 'bg-brass text-ink' : 'text-ivory-dim hover:text-ivory'
            }`}
          >
            <span aria-hidden="true">{EMOJI[m]}</span>
            {LABELS[m]}
          </button>
        ))}
      </div>
    );
  }

  const Icon = ICONS[mode];
  function cycle() {
    select(CYCLE[(CYCLE.indexOf(mode) + 1) % CYCLE.length]);
  }

  return (
    <button type="button"
      onClick={cycle}
      title={`Theme: ${LABELS[mode]} — click to change`}
      className="group flex items-center gap-2 rounded-full border border-brass/40 bg-ink-soft px-3.5 py-2
                 text-ivory-dim shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200
                 hover:border-brass hover:text-brass-bright hover:shadow-[0_0_0_1px_rgba(184,146,90,0.15)]
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
    >
      <Icon size={15} className="transition-transform duration-300 group-hover:rotate-12" />
      <span className="font-mono text-[11px] uppercase tracking-widest">{LABELS[mode]}</span>
    </button>
  );
}
