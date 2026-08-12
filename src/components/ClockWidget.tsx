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
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (businessId) getMyOpenShift(businessId).then(setShift).finally(() => setLoaded(true));
  }, [businessId]);

  async function handleToggle() {
    if (!businessId) return;
    setBusy(true);
    try {
      const updated = shift ? await clockOut(businessId) : await clockIn(businessId);
      setShift(shift ? null : updated);
    } catch {
      // A failed clock-in/out shouldn't silently look like it worked -
      // re-fetch the real state rather than trust an optimistic guess.
      getMyOpenShift(businessId).then(setShift);
    } finally {
      setBusy(false);
    }
  }

  if (!loaded || !businessId) return null;

  return (
    <button type="button"
      onClick={handleToggle}
      disabled={busy}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm disabled:opacity-50 ${
        shift ? 'border-success/40 text-success' : 'border-ink-line text-ivory-dim hover:text-ivory'
      }`}
      title={shift ? `Clocked in since ${new Date(shift.clock_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not clocked in'}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${shift ? 'bg-success' : 'bg-ivory-dim/40'}`} />
      {busy ? '...' : shift ? 'Clock out' : 'Clock in'}
    </button>
  );
}
