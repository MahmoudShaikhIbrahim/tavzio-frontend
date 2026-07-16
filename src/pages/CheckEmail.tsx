import { useLocation } from 'react-router-dom';

export default function CheckEmail() {
  const location = useLocation();
  const message = (location.state as { message?: string } | null)?.message;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-ink px-6 text-center">
      <p className="font-display text-xl text-ivory">Check your email</p>
      <p className="max-w-xs text-sm text-ivory-dim">
        {message || 'Open the confirmation link on this same device to finish logging in.'}
      </p>
    </div>
  );
}
