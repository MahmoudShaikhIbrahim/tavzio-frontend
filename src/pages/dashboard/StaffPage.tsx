import { useEffect, useState, type FormEvent } from 'react';
import { useSession } from '../../hooks/useSession';
import { listStaff, inviteStaff, setStaffActive, setStaffSections, resetAccountPassword } from '../../lib/authApi';
import type { StaffMember } from '../../types';
import { SECTION_OPTIONS } from '../../lib/dashboardSections';
import { Section, Field, inputClass, PrimaryButton } from '../../components/ui';

export default function StaffPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [resetResult, setResetResult] = useState<{ name: string; tempPassword: string } | null>(null);
  const [editingSectionsFor, setEditingSectionsFor] = useState<string | null>(null);

  function reload() {
    if (businessId) listStaff(businessId).then(setStaff);
  }

  useEffect(reload, [businessId]);

  if (!businessId) return null;

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    await inviteStaff(businessId!, name, email);
    setName(''); setEmail('');
    setSaving(false);
    reload();
  }

  async function handleResetPassword(userId: string) {
    if (!confirm('Reset this account\'s password? They will be given a new temporary password and forced to set their own on next login.')) return;
    const result = await resetAccountPassword(businessId!, userId);
    setResetResult(result);
  }

  return (
    <div className="space-y-10">
      {resetResult && (
        <div className="rounded-lg border border-brass/40 bg-ink-soft p-4">
          <p className="text-base text-ivory">
            New temporary password for <span className="text-brass">{resetResult.name}</span>:
          </p>
          <p className="mt-1 select-all rounded bg-ink px-3 py-2 font-mono text-lg text-brass">{resetResult.tempPassword}</p>
          <p className="mt-2 text-sm text-ivory-dim">
            Send this to them directly (not visible again after you leave this page). They'll be required to set
            their own new password the moment they log in with it.
          </p>
          <button onClick={() => setResetResult(null)} className="mt-2 text-sm text-ivory-dim hover:text-ivory">Dismiss</button>
        </div>
      )}

      <Section title="Team">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {staff.map((s) => (
            <div key={s.id} className="rounded-lg border border-ink-line px-5 py-4 text-base">
              <div className="flex items-center justify-between">
                <span className="text-ivory">
                  {s.name} <span className="text-ivory-dim">· {s.role.replace('_', ' ')}</span>
                  {!s.is_active && <span className="ml-2 text-base text-danger">deactivated</span>}
                </span>
              </div>
              {s.role === 'staff' && (
                <p className="mt-1 text-sm text-ivory-dim">
                  {s.assigned_sections === null
                    ? 'Sees everything'
                    : s.assigned_sections.length === 0
                      ? 'No sections assigned yet'
                      : s.assigned_sections.map((key) => SECTION_OPTIONS.find((o) => o.key === key)?.label || key).join(', ')}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <button onClick={() => handleResetPassword(s.id)} className="text-sm text-ivory-dim hover:text-ivory">
                  Reset password
                </button>
                {s.role === 'staff' && (
                  <>
                    <button
                      onClick={() => {
                        setStaff((prev) => prev.map((m) => (m.id === s.id ? { ...m, is_active: !m.is_active } : m)));
                        setStaffActive(businessId, s.id, !s.is_active).catch(reload);
                      }}
                      className="text-sm text-ivory-dim hover:text-ivory"
                    >
                      {s.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                    <button
                      onClick={() => setEditingSectionsFor(editingSectionsFor === s.id ? null : s.id)}
                      className="text-sm text-brass hover:underline"
                    >
                      {editingSectionsFor === s.id ? 'Close' : 'Assign sections'}
                    </button>
                  </>
                )}
              </div>
              {editingSectionsFor === s.id && (
                <SectionAssignmentForm
                  businessId={businessId}
                  staffMember={s}
                  onSaved={(updated) => {
                    setStaff((prev) => prev.map((m) => (m.id === updated.id ? { ...m, assigned_sections: updated.assigned_sections } : m)));
                    setEditingSectionsFor(null);
                  }}
                />
              )}
            </div>
          ))}
        </div>

        <p className="text-base text-ivory-dim">
          New staff sign in with their own email and password — no card
          needed, since staff sign in through the website. The same
          account can be open on as many devices at once as needed.
        </p>
        <form onSubmit={handleInvite} className="flex gap-2.5 border-t border-ink-line pt-4">
          <Field label="Name"><input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} /></Field>
          <Field label="Email"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} /></Field>
          <div className="self-end"><PrimaryButton disabled={saving}>{saving ? 'Adding...' : 'Add staff'}</PrimaryButton></div>
        </form>
      </Section>
    </div>
  );
}

// A staff account with `assigned_sections: null` (the default) sees
// everything - opening this form for the first time starts every box
// checked, so simply closing without changing anything leaves that
// account exactly as unrestricted as it was.
function SectionAssignmentForm({ businessId, staffMember, onSaved }: {
  businessId: string; staffMember: StaffMember; onSaved: (updated: StaffMember) => void;
}) {
  const [selected, setSelected] = useState<string[]>(
    staffMember.assigned_sections ?? SECTION_OPTIONS.map((o) => o.key)
  );
  const [saving, setSaving] = useState(false);

  function toggle(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await setStaffSections(businessId, staffMember.id, selected);
      onSaved(updated);
    } finally {
      setSaving(false);
    }
  }

  async function handleClearRestriction() {
    setSaving(true);
    try {
      const updated = await setStaffSections(businessId, staffMember.id, null);
      onSaved(updated);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-ink-line bg-ink-soft p-3">
      <p className="text-sm text-ivory-dim">Only checked sections will appear on this account's dashboard.</p>
      <div className="grid grid-cols-2 gap-1.5">
        {SECTION_OPTIONS.map((opt) => (
          <label key={opt.key} className="flex items-center gap-2 text-sm text-ivory">
            <input type="checkbox" checked={selected.includes(opt.key)} onChange={() => toggle(opt.key)} className="accent-brass" />
            {opt.label}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
        {staffMember.assigned_sections !== null && (
          <button onClick={handleClearRestriction} disabled={saving} className="text-sm text-ivory-dim hover:text-ivory">
            Remove restriction (sees everything)
          </button>
        )}
      </div>
    </div>
  );
}
