import { useEffect, useState } from 'react';
import { useSession } from '../hooks/useSession';
import { getMyOpenShift, clockIn, clockOut, type StaffShift } from '../lib/authApi';

// Deliberately tiny and always-visible in the header, not buried in a
// settings page - the whole point of a time clock is that using it takes
// less effort than not using it. Every staff/owner account gets one,
// since owners work real shifts too.
export default function ClockWidget() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [shift, setShift] = useState<StaffShift | null>(null);
  // Real, explicit request: this used to wait for the full round trip
  // before the button changed at all, so it always felt like it had a
  // delay even on a fast connection. Real optimistic UI now - the
  // button flips the instant it's pressed, and only reverts (with a
  // real re-fetch) if the request actually fails, keeping the original
  // "don't silently show a state that isn't true" safeguard intact,
  // just optimistic-first instead of wait-first.
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (businessId) getMyOpenShift(businessId).then(setShift).finally(() => setLoaded(true));
  }, [businessId]);

  async function handleToggle() {
    if (!businessId || pending) return;
    const wasClockedIn = !!shift;
    setPending(true);
    try {
      const updated = wasClockedIn ? await clockOut(businessId) : await clockIn(businessId);
      setShift(wasClockedIn ? null : updated);
    } catch {
      // A failed clock-in/out shouldn't silently look like it worked -
      // re-fetch the real state rather than trust the optimistic guess.
      getMyOpenShift(businessId).then(setShift);
    } finally {
      setPending(false);
    }
  }

  if (!loaded || !businessId) return null;
  const displayClockedIn = pending ? !shift : !!shift;

  return (
    <button type="button"
      onClick={handleToggle}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${
        displayClockedIn ? 'border-success/40 text-success' : 'border-ink-line text-ivory-dim hover:text-ivory'
      }`}
      title={shift ? `Clocked in since ${new Date(shift.clock_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not clocked in'}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${displayClockedIn ? 'bg-success' : 'bg-ivory-dim/40'}`} />
      {displayClockedIn ? 'Clock out' : 'Clock in'}
    </button>
  );
}
