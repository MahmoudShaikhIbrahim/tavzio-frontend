import { Sun, Moon, MonitorSmartphone } from 'lucide-react';
import { useTheme, type ThemeMode } from '../lib/ThemeContext';

const CYCLE: ThemeMode[] = ['dark', 'light', 'system'];
const ICONS: Record<ThemeMode, typeof Sun> = { dark: Moon, light: Sun, system: MonitorSmartphone };
const LABELS: Record<ThemeMode, string> = { dark: 'Dark', light: 'Light', system: 'System' };

export default function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const Icon = ICONS[mode];

  function cycle() {
    const next = CYCLE[(CYCLE.indexOf(mode) + 1) % CYCLE.length];
    setMode(next);
  }

  return (
    <button
      onClick={cycle}
      title={`Theme: ${LABELS[mode]} — click to change`}
      className="group flex items-center gap-2 rounded-full border border-brass/40 bg-ink-soft px-3.5 py-2
                 text-ivory-dim shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200
                 hover:border-brass hover:text-brass-bright hover:shadow-[0_0_0_1px_rgba(184,146,90,0.15)]"
    >
      <Icon size={15} className="transition-transform duration-300 group-hover:rotate-12" />
      <span className="font-mono text-[11px] uppercase tracking-widest">{LABELS[mode]}</span>
    </button>
  );
}
