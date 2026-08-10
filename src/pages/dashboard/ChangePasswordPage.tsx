import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changePassword } from '../../lib/authApi';
import { useSession } from '../../hooks/useSession';
import { Section, Field, inputClass } from '../../components/ui';

export default function ChangePasswordPage({ forced = false }: { forced?: boolean }) {
  const { user } = useSession();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) { setError('New password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      if (forced) {
        setDone(true);
        setTimeout(() => navigate('/admin/dashboard/orders'), 1200);
      } else {
        setDone(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password');
    } finally {
      setSaving(false);
    }
  }

  const content = (
    <Section title={forced ? 'Set your own password' : 'Change password'}>
      {forced && (
        <p className="text-base text-ivory-dim">
          Welcome{user?.name ? `, ${user.name}` : ''}. For security, set a password only you know before continuing -
          the one used to create your account was set by Tavzio and shouldn't stay in use.
        </p>
      )}
      {done ? (
        <p className="text-base text-success">Password updated{forced ? ' - taking you to your dashboard...' : '.'}</p>
      ) : (
        <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
          <Field label={forced ? 'Current (temporary) password' : 'Current password'}>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required className={inputClass} />
          </Field>
          <Field label="New password">
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} className={inputClass} />
          </Field>
          <Field label="Confirm new password">
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className={inputClass} />
          </Field>
          {error && <p className="text-base text-danger">{error}</p>}
          <button type="submit" disabled={saving} className="rounded-lg bg-brass px-4 py-2.5 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
            {saving ? 'Saving...' : 'Set new password'}
          </button>
        </form>
      )}
    </Section>
  );

  if (!forced) return content;

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-5">
      <div className="w-full max-w-md">{content}</div>
    </div>
  );
}
