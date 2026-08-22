import type { ReactNode, FormEvent } from 'react';

// Sizes bumped up one notch across the board (text-sm -> text-base,
// text-xs -> text-sm, section titles text-lg -> text-xl) - staff and
// owners were finding the dashboard too small to read comfortably
// without leaning in, especially on a shared screen at a counter.

// Real fix for "make navigation feel like Wio": researched what Wio's
// actual reputation is built on (see conversation) - not visual flair,
// specifically instant tactile feedback on every tap and predictable,
// fast transitions. Every interactive element below now presses down
// slightly on tap/click (active:scale-[0.97]) so a person gets visual
// confirmation their tap registered the instant they touch it, not
// only once a network response comes back - the actual thing that
// makes an interface feel fast, independent of real network latency.
const PRESS_FEEDBACK = 'transition-transform duration-100 active:scale-[0.97]';

export const inputClass =
  'w-full rounded-lg border border-ink-line bg-ink-soft px-3.5 py-2.5 text-base text-ivory placeholder:text-ivory-dim/60 focus:border-brass transition-colors duration-150';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-base text-ivory-dim">{label}</span>
      {children}
    </label>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-line p-9">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-ivory">{title}</h2>
        {action}
      </div>
      <div className="mt-6 space-y-6">{children}</div>
    </div>
  );
}

// Small inline spinner - shared by both button variants below so a
// "Saving..." state always looks the same everywhere in the app,
// rather than each page inventing its own loading indicator (or, more
// commonly, none at all - just disabled text, which reads as "did my
// tap even register?" rather than "this is working on it").
function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
    </svg>
  );
}

// loading is optional and additive - existing call sites that already
// manually swap their own children text (e.g. `{loading ? 'Saving...' :
// 'Save'}`) keep working exactly as before with zero changes needed;
// passing loading as well now also disables the button and adds a
// spinner automatically, so a page can adopt the richer state whenever
// it touches that file next, not all at once.
export function ActionButton({
  children, onClick, disabled, danger, loading, type = 'button', size = 'md',
}: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; danger?: boolean; loading?: boolean;
  type?: 'button' | 'submit'; size?: 'sm' | 'md';
}) {
  const sizeClass = size === 'sm' ? 'px-2.5 py-1.5 text-sm' : 'px-3.5 py-2 text-base';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center gap-1.5 rounded-lg border disabled:cursor-not-allowed disabled:opacity-50 ${sizeClass} ${PRESS_FEEDBACK} ${
        danger ? 'border-danger/40 text-danger hover:bg-danger/10' : 'border-brass/40 text-brass hover:bg-brass/10'
      }`}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function PrimaryButton({
  children, disabled, loading, type = 'submit', onClick, size = 'md',
}: {
  children: ReactNode; disabled?: boolean; loading?: boolean; type?: 'button' | 'submit'; onClick?: () => void; size?: 'sm' | 'md';
}) {
  const sizeClass = size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5 text-base';
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg bg-brass font-medium text-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${sizeClass} ${PRESS_FEEDBACK}`}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function ToggleRow({ label, description, checked, onChange, disabled }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-ink-line px-3.5 py-3 transition-colors duration-150 hover:border-ink-line/70">
      <div>
        <p className="text-base text-ivory">{label}</p>
        {description && <p className="text-sm text-ivory-dim">{description}</p>}
      </div>
      <button type="button"
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={`shrink-0 rounded-lg border px-3.5 py-2 text-base disabled:cursor-not-allowed disabled:opacity-50 ${PRESS_FEEDBACK} ${
          checked ? 'border-brass text-brass' : 'border-ink-line text-ivory-dim'
        }`}
      >
        {checked ? 'Enabled' : 'Disabled'}
      </button>
    </div>
  );
}

export { Spinner };
export type { FormEvent };
