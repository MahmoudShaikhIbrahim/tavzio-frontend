export interface DayHours {
  open: string;
  close: string;
}
export type WeeklyHours = Partial<Record<'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat', DayHours | null>>;

const DAYS: { key: keyof WeeklyHours; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

// Real weekly hours editor - per day, either "Closed" or a real
// open/close time range. A day with no entry at all (not shown as
// "closed", genuinely absent from the object) means "no restriction",
// matching exactly how the backend's own validation treats a missing
// key versus an explicit null.
export default function WeeklyHoursEditor({ value, onChange }: { value: WeeklyHours; onChange: (v: WeeklyHours) => void }) {
  function setDay(day: keyof WeeklyHours, hours: DayHours | null) {
    onChange({ ...value, [day]: hours });
  }

  return (
    <div className="space-y-2">
      {DAYS.map(({ key, label }) => {
        const dayValue = value[key];
        const isClosed = dayValue === null;
        const isSet = dayValue !== undefined;
        return (
          <div key={key} className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink-line px-3.5 py-2.5 shadow-sm">
            <span className="w-24 shrink-0 text-sm text-ivory">{label}</span>
            {!isSet ? (
              <span className="text-sm text-ivory-dim">No restriction</span>
            ) : isClosed ? (
              <span className="text-sm text-ivory-dim">Closed</span>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={dayValue.open}
                  onChange={(e) => setDay(key, { ...dayValue, open: e.target.value })}
                  className="rounded-full border border-ink-line bg-ink px-3 py-1.5 text-sm text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
                />
                <span className="text-sm text-ivory-dim">to</span>
                <input
                  type="time"
                  value={dayValue.close}
                  onChange={(e) => setDay(key, { ...dayValue, close: e.target.value })}
                  className="rounded-full border border-ink-line bg-ink px-3 py-1.5 text-sm text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
                />
              </div>
            )}
            <div className="ms-auto flex gap-2 text-xs">
              <button type="button" onClick={() => setDay(key, { open: '09:00', close: '22:00' })} className={`rounded-full px-2.5 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${isSet && !isClosed ? 'bg-brass text-ink' : 'text-brass hover:bg-brass/10'}`}>
                Open
              </button>
              <button type="button" onClick={() => setDay(key, null)} className={`rounded-full px-2.5 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger ${isClosed ? 'bg-danger text-status-text' : 'text-danger hover:bg-danger/10'}`}>
                Closed
              </button>
              {isSet && (
                <button
                  type="button"
                  onClick={() => {
                    const next = { ...value };
                    delete next[key];
                    onChange(next);
                  }}
                  className="rounded-full px-2.5 py-1 text-ivory-dim hover:bg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
