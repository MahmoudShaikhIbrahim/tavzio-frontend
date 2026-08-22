import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changePassword, changeMyEmail, updateMyLanguage } from '../../lib/authApi';
import { useSession } from '../../hooks/useSession';
import { useDashboardLanguage } from '../../lib/i18n/DashboardLanguageContext';
import { useT } from '../../hooks/useT';
import { Section, Field, inputClass } from '../../components/ui';
import PasswordField from '../../components/PasswordField';
import { LANGUAGES } from '../../lib/i18n/types';

export default function ChangePasswordPage({ forced = false }: { forced?: boolean }) {
  const { user } = useSession();
  const { t } = useT();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  // The context IS the single source of truth for which language is
  // currently active - no separate local copy to keep in sync. Reading
  // it here means this page's own "which button is highlighted" state
  // can never drift from what the rest of the dashboard is actually
  // showing.
  const { language, setLanguage } = useDashboardLanguage();
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [languageSaved, setLanguageSaved] = useState(false);
  const [languageError, setLanguageError] = useState('');
  const languageAttemptRef = useRef(0);

  async function handleLanguageChange(code: string) {
    // A real bug this fixes: clicking through several language buttons in
    // quick succession (very easy to do testing all 9) used to leave
    // every click's own 2-second "hide the confirmation" timer running
    // independently - an OLDER click's timer firing after a NEWER click
    // had already shown its own "Saved." would clear that newer
    // confirmation early, making a language look like it silently never
    // saved even though it genuinely did. Tagging each attempt with its
    // own id and only acting on the most recent one fixes that for good.
    languageAttemptRef.current += 1;
    const thisAttempt = languageAttemptRef.current;

    // Instant, not waiting on the network - this is what makes the
    // whole dashboard switch language immediately, everywhere, the
    // moment someone taps a button. The save below still runs, so the
    // choice survives a future login; if it fails, the switch itself
    // has already happened and languageError below explains the save
    // problem separately rather than undoing the visible change.
    setLanguage(code);
    setSavingLanguage(true);
    setLanguageSaved(false);
    setLanguageError('');
    try {
      await updateMyLanguage(code);
      if (thisAttempt !== languageAttemptRef.current) return; // a newer click already superseded this one
      setLanguageSaved(true);
      setTimeout(() => {
        if (thisAttempt === languageAttemptRef.current) setLanguageSaved(false);
      }, 2000);
    } catch (err) {
      if (thisAttempt !== languageAttemptRef.current) return;
      setLanguageError(err instanceof Error ? err.message : 'Could not save - please try again');
    } finally {
      if (thisAttempt === languageAttemptRef.current) setSavingLanguage(false);
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
        <Section title={t('Preferred language')}>
          <p className="text-sm text-ivory-dim">
            {t("Applies to your own account only - each staff member sets their own, separately from anyone else's.")}
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
          {languageSaved && <p className="text-sm text-success">{t('Saved.')}</p>}
          {languageError && <p className="text-sm text-danger">{languageError}</p>}
        </Section>
      )}
      {!forced && <ChangeEmailSection />}
      <Section title={forced ? t('Set your own password') : t('Change password')}>
        {forced && (
          <p className="text-base text-ivory-dim">
            {t('Welcome')}{user?.name ? `, ${user.name}` : ''}. {t("For security, set a password only you know before continuing - the one used to create your account was set by Tavzio and shouldn't stay in use.")}
          </p>
        )}
        {done ? (
          <p className="text-base text-success">{t('Password updated')}{forced ? ` ${t('- taking you to your dashboard...')}` : '.'}</p>
        ) : (
          <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
            <Field label={forced ? t('Current (temporary) password') : t('Current password')}>
              <PasswordField value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
            </Field>
            <Field label={t('New password')}>
              <PasswordField value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
            </Field>
            <Field label={t('Confirm new password')}>
              <PasswordField value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
            </Field>
            {error && <p className="text-base text-danger">{error}</p>}
            <button type="submit" disabled={saving} className="rounded-lg bg-brass px-4 py-2.5 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
              {saving ? t('Saving...') : t('Set new password')}
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

// Confirmed requirement: owner, staff, and super_admin all need this -
// self-service only (verified by the account's own current password,
// same discipline as password change above), so this doesn't let
// anyone change someone else's email, including an owner changing a
// staff member's. Reused by every page that renders ChangePasswordPage
// (business dashboard settings, and the super_admin account page) since
// it's defined once here rather than duplicated.
function ChangeEmailSection() {
  const { t } = useT();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await changeMyEmail(currentPassword, newEmail);
      setDone(res.email);
      setCurrentPassword('');
      setNewEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update email');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title={t('Change email address')}>
      <p className="text-sm text-ivory-dim">
        {t('Updates the email you sign in with. Takes effect immediately - no confirmation link needed.')}
      </p>
      {done && <p className="text-base text-success">{t('Email updated to')} {done}.</p>}
      <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
        <Field label={t('Current password')}>
          <PasswordField value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
        </Field>
        <Field label={t('New email address')}>
          <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required className={inputClass} />
        </Field>
        {error && <p className="text-base text-danger">{error}</p>}
        <button type="submit" disabled={saving} className="rounded-lg bg-brass px-4 py-2.5 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
          {saving ? t('Saving...') : t('Update email')}
        </button>
      </form>
    </Section>
  );
}
