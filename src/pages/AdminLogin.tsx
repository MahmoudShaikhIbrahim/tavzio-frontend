import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { login, getMe, completeInvite } from '../lib/authApi';
import { setSession } from '../lib/session';
import { getSupabase } from '../lib/supabaseClient';
import { useLiveSystemTheme } from '../lib/ThemeContext';
import Logo from '../components/Logo';
import TurnstileWidget from '../components/TurnstileWidget';

// Real fix for a confirmed gap: an invite email's link landed here with
// #access_token=...&type=invite in the URL, and nothing in this app
// ever read that - supabase-js's client auto-consumes it into ITS OWN
// internal session (detectSessionInUrl defaults to true), completely
// separate from this app's own authFetch/useSession system, which only
// ever reads from its own localStorage token. Without this, an invited
// person landed on an ordinary login form with no password yet to type
// in - stuck, even once the link itself pointed at the right domain.
// Captured once, synchronously, at first render - supabase-js clears
// the hash from the URL shortly after processing it, so this needs to
// grab it before that happens, not read window.location.hash again later.
function useInviteMode() {
  const [hash] = useState(() => window.location.hash);
  if (hash.includes('type=invite')) return 'invite';
  if (hash.includes('type=recovery')) return 'recovery';
  return null;
}

export default function AdminLogin() {
  // Same reasoning as the marketing homepage - nobody's logged in yet
  // here, so this follows the visitor's own device setting live, never
  // any stored account preference.
  const theme = useLiveSystemTheme();
  const inviteMode = useInviteMode();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password, turnstileToken);
      const me = await getMe();
      navigate(me.role === 'super_admin' ? '/admin/super/businesses' : me.role === 'org_owner' ? '/admin/org' : '/admin/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoading(false);
    }
  }

  if (inviteMode) {
    return <SetPasswordForm mode={inviteMode} theme={theme} onDone={navigate} />;
  }

  return (
    <div data-theme={theme} className="flex min-h-screen items-center justify-center bg-ink px-8">
      <div className="w-full max-w-sm">
        <Logo className="mx-auto h-12 w-auto" />
        <h1 className="mt-1 text-center font-display text-2xl text-ivory">Sign in</h1>
        <p className="mt-1 text-center text-sm text-ivory-dim">
          Platform administrators, business owners, and staff all sign in
          here with their email and password.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-ink-line bg-ink-soft px-3.5 py-2.5 text-ivory
                       placeholder:text-ivory-dim/60 focus:border-brass"
          />
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-ink-line bg-ink-soft px-3.5 py-2.5 pe-11 text-ivory
                         placeholder:text-ivory-dim/60 focus:border-brass"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-ivory-dim hover:text-ivory"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <TurnstileWidget onVerify={setTurnstileToken} />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brass px-4 py-2.5 font-medium text-ink transition-opacity
                       hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

// The other half of the fix: supabase-js already auto-established a
// real session from the invite link's token by the time this renders
// (detectSessionInUrl). This form only needs to collect a real password
// and set it on that session - then bridges the resulting tokens into
// THIS app's own session system (setSession, same function the normal
// login flow uses) so authFetch/useSession recognize the person as
// properly logged in afterward, not just supabase-js's own internal
// client state.
function SetPasswordForm({ mode, theme, onDone }: { mode: 'invite' | 'recovery'; theme: string; onDone: (path: string) => void }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setSaving(true);
    try {
      const supabase = getSupabase();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('Could not establish a session - try the invite link again');
      setSession(sessionData.session.access_token, undefined, sessionData.session.refresh_token);

      // Real fix for a confirmed bug: without this, must_change_password
      // stayed true forever after completing an invite this way, and
      // every layout's forced-change gate would then try to render the
      // standard change-password form next - which itself demands a
      // "current password" this account never had (it authenticated via
      // a single-use link, not a known existing password), an unwinnable
      // dead end that crashed the org owner layout outright since it
      // wasn't wrapped for that render path either (see OrgOwnerLayout.tsx).
      await completeInvite();

      const me = await getMe();
      onDone(me.role === 'super_admin' ? '/admin/super/businesses' : me.role === 'org_owner' ? '/admin/org' : '/admin/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set your password - try the invite link again');
      setSaving(false);
    }
  }

  return (
    <div data-theme={theme} className="flex min-h-screen items-center justify-center bg-ink px-8">
      <div className="w-full max-w-sm">
        <Logo className="mx-auto h-12 w-auto" />
        <h1 className="mt-1 text-center font-display text-2xl text-ivory">
          {mode === 'invite' ? 'Welcome to Tavzio' : 'Set a new password'}
        </h1>
        <p className="mt-1 text-center text-sm text-ivory-dim">
          {mode === 'invite' ? 'Set a password to activate your account.' : 'Choose a new password to sign back in.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-ink-line bg-ink-soft px-3.5 py-2.5 pe-11 text-ivory
                         placeholder:text-ivory-dim/60 focus:border-brass"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-ivory-dim hover:text-ivory"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            required
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-lg border border-ink-line bg-ink-soft px-3.5 py-2.5 text-ivory
                       placeholder:text-ivory-dim/60 focus:border-brass"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-brass px-4 py-2.5 font-medium text-ink transition-opacity
                       hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Set password and continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
