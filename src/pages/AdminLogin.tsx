import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { login, getMe } from '../lib/authApi';
import { useLiveSystemTheme } from '../lib/ThemeContext';

export default function AdminLogin() {
  // Same reasoning as the marketing homepage - nobody's logged in yet
  // here, so this follows the visitor's own device setting live, never
  // any stored account preference.
  const theme = useLiveSystemTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      const me = await getMe();
      navigate(me.role === 'super_admin' ? '/admin/super/businesses' : '/admin/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoading(false);
    }
  }

  return (
    <div data-theme={theme} className="flex min-h-screen items-center justify-center bg-ink px-6">
      <div className="w-full max-w-sm">
        <p className="text-center font-mono text-[11px] uppercase tracking-wider text-brass">Tavzio</p>
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
