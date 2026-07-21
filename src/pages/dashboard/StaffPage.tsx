import { useEffect, useState, type FormEvent } from 'react';
import { useSession } from '../../hooks/useSession';
import { listStaff, inviteStaff, setStaffActive } from '../../lib/authApi';
import type { StaffMember } from '../../types';
import { Section, Field, inputClass, PrimaryButton } from '../../components/ui';

export default function StaffPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

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

  return (
    <div className="space-y-6">
      <Section title="Team">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {staff.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-ink-line px-4 py-3 text-base">
              <span className="text-ivory">
                {s.name} <span className="text-ivory-dim">· {s.role.replace('_', ' ')}</span>
                {!s.is_active && <span className="ml-2 text-base text-danger">deactivated</span>}
              </span>
              {s.role === 'staff' && (
                <button
                  onClick={() => setStaffActive(businessId, s.id, !s.is_active).then(reload)}
                  className="text-base text-ivory-dim hover:text-ivory"
                >
                  {s.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
              )}
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
