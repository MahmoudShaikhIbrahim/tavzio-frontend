import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changePassword, updateMyLanguage } from '../../lib/authApi';
import { useSession } from '../../hooks/useSession';
import { Section, Field, inputClass } from '../../components/ui';
import { LANGUAGES } from '../../lib/i18n/types';

export default function ChangePasswordPage({ forced = false }: { forced?: boolean }) {
  const { user } = useSession();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [language, setLanguage] = useState<string>(user?.preferred_language || 'en');
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [languageSaved, setLanguageSaved] = useState(false);

  // The session's own account loads asynchronously - this picks up the
  // account's real saved preference the moment it arrives, same pattern
  // DashboardLayout uses for theme_preference.
  useEffect(() => {
    if (user?.preferred_language) setLanguage(user.preferred_language);
  }, [user?.preferred_language]);

  async function handleLanguageChange(code: string) {
    setLanguage(code);
    setSavingLanguage(true);
    setLanguageSaved(false);
    try {
      await updateMyLanguage(code);
      setLanguageSaved(true);
      setTimeout(() => setLanguageSaved(false), 2000);
    } catch {
      // Not critical enough to block the page over - the selector still
      // reflects the choice locally even if the save silently failed.
    } finally {
      setSavingLanguage(false);
    }
  }

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
        // Where "continue" actually goes depends on the account's own
        // role - hardcoding this to the business dashboard would bounce
        // a newly-onboarded org_owner (or super_admin) straight back out
        // via RequireRole the instant they land.
        const home = user?.role === 'super_admin' ? '/admin/super/businesses' : user?.role === 'org_owner' ? '/admin/org' : '/admin/dashboard/orders';
        setTimeout(() => navigate(home), 1200);
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
    <>
      {!forced && (
        <Section title="Preferred language">
          <p className="text-sm text-ivory-dim">
            Applies to your own account only - each staff member sets their own, separately from anyone else's.
          </p>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((l) => (
              <button
                type="button"
                key={l.code}
                onClick={() => handleLanguageChange(l.code)}
                disabled={savingLanguage}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 ${
                  language === l.code ? 'border-brass bg-brass/10 text-brass' : 'border-ink-line text-ivory-dim hover:text-ivory'
                }`}
              >
                <span>{l.flag}</span>
                <span>{l.label}</span>
              </button>
            ))}
          </div>
          {languageSaved && <p className="text-sm text-success">Saved.</p>}
        </Section>
      )}
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
    </>
  );

  if (!forced) return content;

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-5">
      <div className="w-full max-w-md">{content}</div>
    </div>
  );
}
