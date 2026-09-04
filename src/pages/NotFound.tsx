import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-ink px-6 text-center">
      <p className="font-display text-xl text-ivory">This page doesn't exist</p>
      <p className="text-sm text-ivory-dim">Check the link, or tap the card again if you got here from an NFC tap.</p>
      <Link
        to="/"
        className="mt-4 rounded-lg border border-brass/40 px-4 py-2 text-sm text-brass hover:bg-brass/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
      >
        Go to homepage
      </Link>
    </div>
  );
}
