import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { buildBusinessThemeVars } from '../lib/businessTheme';

const BASE = import.meta.env.VITE_API_BASE_URL || '';

interface PortalData {
  business: { name: string; slug: string; logoUrl: string; links: Record<string, string>; theme: { customerBackground?: string; customerButton?: string } };
  room: { id: string; roomNumber: string; roomType: string };
  guest: { name: string; checkInDate: string; checkOutDate: string } | null;
  folioId: string | null;
  folioBalance: number | null;
}

const REQUEST_TYPES = [
  { key: 'towels', label: 'Extra towels' },
  { key: 'housekeeping', label: 'Housekeeping' },
  { key: 'maintenance', label: 'Report an issue' },
  { key: 'taxi', label: 'Request a taxi' },
  { key: 'laundry', label: 'Laundry' },
  { key: 'other', label: 'Something else' },
];

export default function HotelGuestPortalPage() {
  const { slug, roomId } = useParams<{ slug: string; roomId: string }>();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sentRequest, setSentRequest] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [activeRequest, setActiveRequest] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [payResult, setPayResult] = useState<'success' | 'failed' | null>(null);

  function reload() {
    if (!slug || !roomId) return;
    fetch(`${BASE}/api/public/hotel/${slug}/room/${roomId}`).then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }
  useEffect(reload, [slug, roomId]);

  // Landed back here after paying on the gateway's own page - verify
  // the real outcome server-side rather than trusting the redirect.
  useEffect(() => {
    const txnId = searchParams.get('folioPaymentTxnId');
    if (!txnId || !slug || !roomId) return;
    fetch(`${BASE}/api/public/hotel/${slug}/room/${roomId}/folio/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId: txnId }),
    })
      .then((r) => { setPayResult(r.ok ? 'success' : 'failed'); return r.json(); })
      .then(() => reload())
      .catch(() => setPayResult('failed'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, slug, roomId]);

  async function handlePayBill() {
    if (!slug || !roomId) return;
    setPaying(true);
    try {
      const res = await fetch(`${BASE}/api/public/hotel/${slug}/room/${roomId}/folio/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const result = await res.json();
      if (!res.ok) { alert(result.message || 'Could not start payment'); setPaying(false); return; }
      window.location.href = result.redirectUrl;
    } catch {
      setPaying(false);
    }
  }

  async function handleRequest(requestType: string) {
    if (!slug || !roomId) return;
    await fetch(`${BASE}/api/public/hotel/${slug}/room/${roomId}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType, note }),
    });
    setSentRequest(requestType);
    setActiveRequest(null);
    setNote('');
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-ink"><div className="h-8 w-8 animate-pulse rounded-full border-2 border-brass/40" /></div>;
  if (!data) return <div className="flex min-h-screen items-center justify-center bg-ink px-6 text-center text-ivory-dim">This room isn't available right now.</div>;

  const themeVars = buildBusinessThemeVars(data.business.theme?.customerBackground, data.business.theme?.customerButton);

  return (
    <div style={themeVars} className="min-h-screen bg-ink px-5 py-10">
      <div className="mx-auto max-w-md space-y-6">
        <div className="text-center">
          {data.business.logoUrl && <img src={data.business.logoUrl} alt={data.business.name} className="mx-auto mb-3 h-14 w-14 rounded-full object-cover" />}
          <p className="font-display text-2xl text-ivory">{data.business.name}</p>
          <p className="text-sm text-ivory-dim">Room {data.room.roomNumber}{data.guest ? ` · Welcome, ${data.guest.name}` : ''}</p>
        </div>

        {payResult && (
          <div className={`rounded-lg border px-4 py-3 text-center text-sm ${payResult === 'success' ? 'border-success/40 bg-success/10 text-success' : 'border-danger/40 bg-danger/10 text-danger'}`}>
            {payResult === 'success' ? 'Payment received - thank you.' : 'Payment was not completed. Please try again.'}
          </div>
        )}

        {data.folioBalance !== null && (
          <div className="rounded-xl border border-brass/30 bg-ink-soft p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-brass">Current bill</p>
            <p className="mt-1 font-display text-2xl text-ivory">AED {data.folioBalance.toFixed(2)}</p>
            {data.folioBalance > 0 && (
              <button onClick={handlePayBill} disabled={paying} className="mt-3 w-full rounded-lg bg-brass px-4 py-2.5 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
                {paying ? 'Starting payment...' : 'Pay now'}
              </button>
            )}
          </div>
        )}

        <div className="space-y-2">
          {REQUEST_TYPES.map((r) => (
            <div key={r.key}>
              {sentRequest === r.key ? (
                <div className="rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-center text-sm text-success">
                  Request sent - our team has been notified.
                </div>
              ) : activeRequest === r.key ? (
                <div className="space-y-2 rounded-lg border border-brass/40 p-3">
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Any details? (optional)"
                    className="w-full rounded-lg border border-ink-line bg-ink px-3 py-2 text-sm text-ivory placeholder:text-ivory-dim/60"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => handleRequest(r.key)} className="flex-1 rounded-lg bg-brass px-3 py-2 text-sm font-medium text-ink">Send</button>
                    <button onClick={() => setActiveRequest(null)} className="rounded-lg border border-ink-line px-3 py-2 text-sm text-ivory-dim">Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setActiveRequest(r.key)}
                  className="w-full rounded-lg border border-ink-line px-4 py-3 text-left text-base text-ivory hover:border-brass"
                >
                  {r.label}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
