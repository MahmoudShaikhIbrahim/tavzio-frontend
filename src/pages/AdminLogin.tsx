import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { login, getMe, completeInvite } from '../lib/authApi';
import { setSession } from '../lib/session';
import { getSupabase } from '../lib/supabaseClient';
import { useLiveSystemTheme } from '../lib/ThemeContext';
import Logo from '../components/Logo';
import TurnstileWidget from '../components/TurnstileWidget';

// Real, defensible facts only - the same ones already stated elsewhere
// on the marketing site (Home.tsx's "Why Tavzio" / feature list), never
// a fabricated stat invented just to fill space here.
const FACTS = [
  'One flat subscription — no commission taken on any order.',
  'No app to download. The page just opens the instant a guest taps.',
  'Every tap replaces a task a staff member used to run by hand.',
  'Built and run in the UAE, in line with Federal Decree-Law No. 45 of 2021.',
];

function useFactCycle() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const interval = setInterval(() => setIndex((i) => (i + 1) % FACTS.length), 4200);
    return () => clearInterval(interval);
  }, []);
  return index;
}

// Shared branded shell for every form on this page (sign-in, invite,
// password reset) - a left panel carrying the same identity as the
// marketing homepage (tap-ripple signature moment, brass glow, a
// rotating real fact) instead of every auth form being a plain centered
// card with nothing but a small logo above it. Hidden below lg - a
// decorative panel competing for space with the actual form isn't worth
// it on a small screen, where getting signed in fast matters more.
function AuthShell({ children }: { children: ReactNode }) {
  const factIndex = useFactCycle();
  return (
    <div className="flex min-h-screen bg-ink">
      <div className="relative hidden w-[42%] shrink-0 overflow-hidden border-e border-ink-line bg-ink-soft/40 lg:flex lg:flex-col lg:justify-between lg:p-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_20%_10%,rgba(184,146,90,0.14),transparent)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_85%_90%,rgba(184,146,90,0.10),transparent)]" />
        <div className="relative">
          <Logo className="h-9 w-auto" />
          <p className="mt-14 max-w-xs font-display text-3xl leading-tight text-ivory">
            One tap. Every guest <em className="not-italic text-brass">touchpoint.</em>
          </p>
        </div>
        <div className="relative flex items-center gap-5">
          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center">
            <span className="absolute h-12 w-12 animate-tap-ripple rounded-full border border-brass motion-reduce:hidden" />
            <span className="h-2 w-2 rounded-full bg-brass" />
          </span>
          <p key={factIndex} className="animate-hero-rise font-mono text-xs leading-relaxed text-ivory-dim">
            {FACTS[factIndex]}
          </p>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center px-8 py-16">
        {children}
      </div>
    </div>
  );
}

// Same real .btn-luxury treatment as the marketing homepage - oval,
// letter-spacing widens and an arrow slides in on hover, 0.4s
// ease-in-out. Inlined here rather than imported from Home.tsx (a
// page-specific component isn't the right thing to import across
// pages) - same CSS classes, already global in index.css.
function LuxuryButton({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="btn-luxury inline-flex w-full items-center justify-center gap-2 bg-brass px-4 py-3 font-medium text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      <span className="btn-luxury-label">{children}</span>
      <span className="btn-luxury-arrow"><ArrowRight size={16} strokeWidth={2} /></span>
    </button>
  );
}

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
    <div data-theme={theme}>
      <AuthShell>
        <div className="card-elevated w-full max-w-sm rounded-2xl border border-ink-line bg-ink-soft p-8">
          <Logo className="mx-auto h-12 w-auto lg:hidden" />
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
              className="w-full rounded-lg border border-ink-line bg-ink px-3.5 py-2.5 text-ivory
                         placeholder:text-ivory-dim/60 focus:border-brass"
            />
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-ink-line bg-ink px-3.5 py-2.5 pe-11 text-ivory
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
            <LuxuryButton disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</LuxuryButton>
          </form>
        </div>
      </AuthShell>
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
    <div data-theme={theme}>
      <AuthShell>
        <div className="card-elevated w-full max-w-sm rounded-2xl border border-ink-line bg-ink-soft p-8">
          <Logo className="mx-auto h-12 w-auto lg:hidden" />
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
                className="w-full rounded-lg border border-ink-line bg-ink px-3.5 py-2.5 pe-11 text-ivory
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
              className="w-full rounded-lg border border-ink-line bg-ink px-3.5 py-2.5 text-ivory
                         placeholder:text-ivory-dim/60 focus:border-brass"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <LuxuryButton disabled={saving}>{saving ? 'Saving...' : 'Set password and continue'}</LuxuryButton>
          </form>
        </div>
      </AuthShell>
    </div>
  );
}
