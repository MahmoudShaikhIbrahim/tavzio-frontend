import { useLocation, Link } from 'react-router-dom';
import Logo from '../components/Logo';

export default function CheckEmail() {
  const location = useLocation();
  const message = (location.state as { message?: string } | null)?.message;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink px-6 text-center">
      <Link to="/" className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-ink">
        <Logo size="lg" />
      </Link>
      <p className="mt-2 font-display text-xl text-ivory">Check your email</p>
      <p className="max-w-xs text-sm text-ivory-dim">
        {message || 'Open the confirmation link on this same device to finish logging in.'}
      </p>
      <p className="max-w-xs text-xs text-ivory-dim/70">
        Didn't get it? Tap your card again to get a new link.
      </p>
      <Link
        to="/admin/login"
        className="mt-4 rounded-lg border border-brass/40 px-4 py-2 text-sm text-brass hover:bg-brass/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
      >
        Back to sign in
      </Link>
    </div>
  );
}
