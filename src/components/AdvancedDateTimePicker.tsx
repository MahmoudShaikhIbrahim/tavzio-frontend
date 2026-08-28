import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Clock } from 'lucide-react';

function pad(n: number) {
  return String(n).padStart(2, '0');
}
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Real calendar grid - month navigation, today highlighted, past dates
// genuinely disabled (not just styled differently), selected date
// clearly marked. Closes on outside click and on Escape, like any
// real native picker would.
export function AdvancedDatePicker({ value, onChange, minDate }: { value: string; onChange: (v: string) => void; minDate?: string }) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = value ? new Date(`${value}T00:00:00`) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const min = minDate ? new Date(`${minDate}T00:00:00`) : today;

  const firstOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay();
  const selectedDate = value ? new Date(`${value}T00:00:00`) : null;

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));

  const displayValue = selectedDate
    ? selectedDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="flex w-full items-center gap-2.5 truncate rounded-lg border border-ink-line bg-ink-soft px-3 py-2.5 text-start text-sm text-ivory transition-colors hover:border-brass/40"
      >
        <Calendar size={16} strokeWidth={1.75} className="shrink-0 text-brass" />
        <span className={displayValue ? '' : 'text-ivory-dim/70'}>{displayValue || 'Select date'}</span>
      </button>

      {open && (
        <div className="absolute z-dropdown mt-2 w-72 rounded-2xl border border-ink-line bg-ink-soft p-3 shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between px-1">
            <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))} className="rounded-lg p-1.5 text-ivory-dim hover:bg-ink hover:text-ivory">
              <ChevronLeft size={16} />
            </button>
            <p className="font-display text-sm text-ivory">{MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}</p>
            <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))} className="rounded-lg p-1.5 text-ivory-dim hover:bg-ink hover:text-ivory">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((w, i) => (
              <div key={i} className="flex h-7 items-center justify-center text-[11px] font-medium text-ivory-dim">{w}</div>
            ))}
            {cells.map((cellDate, i) => {
              if (!cellDate) return <div key={i} />;
              const disabled = cellDate < min;
              const isToday = isSameDay(cellDate, today);
              const isSelected = selectedDate && isSameDay(cellDate, selectedDate);
              return (
                <button
                  type="button"
                  key={i}
                  disabled={disabled}
                  onClick={() => { onChange(toDateStr(cellDate)); setOpen(false); }}
                  className={`flex h-9 items-center justify-center rounded-lg text-sm transition-colors ${
                    isSelected ? 'bg-brass font-medium text-ink'
                    : disabled ? 'cursor-not-allowed text-ivory-dim/25'
                    : isToday ? 'border border-brass/50 text-brass hover:bg-brass/10'
                    : 'text-ivory hover:bg-ink'
                  }`}
                >
                  {cellDate.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Real time-slot grid - a fixed interval of real, tappable slots rather
// than a native scroll wheel, closes the same way the date picker does.
export function AdvancedTimePicker({ value, onChange, intervalMinutes = 30, startHour = 8, endHour = 23 }: {
  value: string; onChange: (v: string) => void; intervalMinutes?: number; startHour?: number; endHour?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  useEffect(() => {
    if (open && value) {
      // Real, working scroll-to-selected - no dependency on a native
      // element's own internal scroll behavior.
      const el = listRef.current?.querySelector(`[data-time="${value}"]`);
      el?.scrollIntoView({ block: 'center' });
    }
  }, [open, value]);

  const slots: string[] = [];
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += intervalMinutes) {
      if (h === endHour && m > 0) break;
      slots.push(`${pad(h)}:${pad(m)}`);
    }
  }

  function displayTime(t: string) {
    const [h, m] = t.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="flex w-full items-center gap-2.5 truncate rounded-lg border border-ink-line bg-ink-soft px-3 py-2.5 text-start text-sm text-ivory transition-colors hover:border-brass/40"
      >
        <Clock size={16} strokeWidth={1.75} className="shrink-0 text-brass" />
        <span className={value ? '' : 'text-ivory-dim/70'}>{value ? displayTime(value) : 'Select time'}</span>
      </button>

      {open && (
        <div className="absolute z-dropdown mt-2 w-40 overflow-hidden rounded-2xl border border-ink-line bg-ink-soft shadow-2xl shadow-black/40">
          <div ref={listRef} className="max-h-64 overflow-y-auto p-1.5">
            {slots.map((slot) => (
              <button
                type="button"
                key={slot}
                data-time={slot}
                onClick={() => { onChange(slot); setOpen(false); }}
                className={`w-full rounded-lg px-3 py-2 text-start text-sm transition-colors ${
                  slot === value ? 'bg-brass font-medium text-ink' : 'text-ivory hover:bg-ink'
                }`}
              >
                {displayTime(slot)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
