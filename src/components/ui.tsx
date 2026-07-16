import type { ReactNode, FormEvent } from 'react';

export const inputClass =
  'w-full rounded-lg border border-ink-line bg-ink-soft px-3.5 py-2.5 text-sm text-ivory placeholder:text-ivory-dim/60 focus:border-brass';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-ivory-dim">{label}</span>
      {children}
    </label>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-line p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-ivory">{title}</h2>
        {action}
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

export function ActionButton({
  children, onClick, disabled, danger, type = 'button',
}: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; danger?: boolean; type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border px-3.5 py-2 text-sm disabled:opacity-50 ${
        danger ? 'border-red-400/40 text-red-400 hover:bg-red-400/10' : 'border-brass/40 text-brass hover:bg-brass/10'
      }`}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({ children, disabled, type = 'submit' }: { children: ReactNode; disabled?: boolean; type?: 'button' | 'submit' }) {
  return (
    <button
      type={type}
      disabled={disabled}
      className="rounded-lg bg-brass px-4 py-2.5 text-sm font-medium text-ink hover:opacity-90 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function ToggleRow({ label, description, checked, onChange, disabled }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-ink-line px-3.5 py-3">
      <div>
        <p className="text-sm text-ivory">{label}</p>
        {description && <p className="text-xs text-ivory-dim">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={`shrink-0 rounded-lg border px-3.5 py-2 text-sm disabled:opacity-50 ${
          checked ? 'border-brass text-brass' : 'border-ink-line text-ivory-dim'
        }`}
      >
        {checked ? 'Enabled' : 'Disabled'}
      </button>
    </div>
  );
}

export type { FormEvent };
