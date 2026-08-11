import { useEffect, useState, type FormEvent } from 'react';
import { useSession } from '../../hooks/useSession';
import { listStaff, inviteStaff, setStaffActive, resetAccountPassword } from '../../lib/authApi';
import type { StaffMember } from '../../types';
import { Section, Field, inputClass, PrimaryButton } from '../../components/ui';

export default function StaffPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [resetResult, setResetResult] = useState<{ name: string; tempPassword: string } | null>(null);

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
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-ink-line px-5 py-4 text-base">
              <span className="text-ivory">
                {s.name} <span className="text-ivory-dim">· {s.role.replace('_', ' ')}</span>
                {!s.is_active && <span className="ml-2 text-base text-danger">deactivated</span>}
              </span>
              <div className="flex items-center gap-3">
                <button onClick={() => handleResetPassword(s.id)} className="text-base text-ivory-dim hover:text-ivory">
                  Reset password
                </button>
                {s.role === 'staff' && (
                  <button
                    onClick={() => {
                      setStaff((prev) => prev.map((m) => (m.id === s.id ? { ...m, is_active: !m.is_active } : m)));
                      setStaffActive(businessId, s.id, !s.is_active).catch(reload);
                    }}
                    className="text-base text-ivory-dim hover:text-ivory"
                  >
                    {s.is_active ? 'Deactivate' : 'Reactivate'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="text-base text-ivory-dim">
          New staff sign in with their own email and password — no card
          needed, since staff sign in through the website.
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
