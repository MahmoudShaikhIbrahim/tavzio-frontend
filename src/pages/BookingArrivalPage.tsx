import { useEffect, useState, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getBookingArrival, confirmBookingArrival, type BookingArrival } from '../lib/api';

// The customer-side half of the dual arrival-confirmation flow (see
// migration 0092 and resolveCardTap in publicController.js) - a tap on
// a table with a pending reservation lands here instead of the normal
// landing page. Deliberately shows the actual name/time/party size and
// requires one real tap to confirm, rather than auto-confirming from
// the NFC tap alone - if a different walk-in group ends up sitting at
// this table before the reserved guest arrives, they'll see a name and
// time that isn't theirs and won't confirm it, which is what keeps
// this honest rather than blindly trusting table location alone.
export default function BookingArrivalPage() {
  const { slug, bookingId } = useParams<{ slug: string; bookingId: string }>();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<BookingArrival | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!bookingId) return;
    getBookingArrival(bookingId).then(setBooking).catch(() => setNotFound(true));
  }, [bookingId]);

  async function handleConfirm() {
    if (!bookingId) return;
    setConfirming(true);
    setError('');
    try {
      await confirmBookingArrival(bookingId);
      setConfirmed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not confirm - a staff member may have already confirmed this for you');
    } finally {
      setConfirming(false);
    }
  }

  if (notFound) {
    return (
      <Shell>
        <p className="font-display text-xl text-ivory">Nothing to confirm here</p>
        <p className="max-w-xs text-sm text-ivory-dim">This table doesn't have a reservation waiting on arrival right now.</p>
        <button type="button" onClick={() => navigate(`/${slug}`)} className="mt-4 rounded-lg border border-brass/40 px-4 py-2 text-sm text-brass hover:bg-brass/10">
          Continue to {slug}
        </button>
      </Shell>
    );
  }

  if (confirmed) {
    return (
      <Shell>
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-brass">
          <span className="font-display text-2xl text-brass">✓</span>
        </div>
        <p className="font-display text-xl text-ivory">Arrival confirmed</p>
        <p className="text-sm text-ivory-dim">Enjoy your visit.</p>
        <button type="button" onClick={() => navigate(`/${slug}`)} className="mt-4 rounded-lg border border-brass/40 px-4 py-2 text-sm text-brass hover:bg-brass/10">
          Continue to {slug}
        </button>
      </Shell>
    );
  }

  if (!booking) return <LoadingShell />;

  return (
    <Shell>
      <p className="font-display text-2xl text-ivory">Confirm arrival</p>
      <div className="mt-2 rounded-xl border border-brass/30 bg-ink-soft px-5 py-4">
        <p className="font-display text-lg text-ivory">{booking.guest_name}</p>
        <p className="mt-1 text-sm text-ivory-dim">
          Table for {booking.party_size} · {new Date(booking.requested_at).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
        </p>
      </div>
      <p className="mt-3 max-w-xs text-sm text-ivory-dim">If this is your reservation, tap below to let the team know you're here.</p>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="button"
        onClick={handleConfirm}
        disabled={confirming}
        className="mt-4 w-full max-w-xs rounded-lg bg-brass px-4 py-3 font-medium text-ink disabled:opacity-50"
      >
        {confirming ? 'Confirming...' : "Yes, that's us"}
      </button>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-ink px-6 text-center">
      {children}
    </div>
  );
}

function LoadingShell() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink">
      <div className="h-10 w-10 animate-pulse rounded-full border-2 border-brass/40" />
    </div>
  );
}
