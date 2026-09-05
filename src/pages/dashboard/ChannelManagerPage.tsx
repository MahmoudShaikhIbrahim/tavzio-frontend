import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import {
  getBusiness,
  listChannelConnections, upsertChannelConnection, disconnectChannel,
  pushRatesToChannel, listChannelBookings, confirmChannelBooking, rejectChannelBooking,
} from '../../lib/authApi';
import type { AdminBusiness, ChannelConnection, ChannelBooking } from '../../types';
import { Section, Field, inputClass, PrimaryButton, ActionButton } from '../../components/ui';
import PasswordField from '../../components/PasswordField';

const CHANNEL_LABELS: Record<ChannelConnection['channel'], string> = {
  booking_com: 'Booking.com',
  expedia: 'Expedia',
  airbnb: 'Airbnb',
  agoda: 'Agoda',
  other: 'Other',
};

export default function ChannelManagerPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [business, setBusiness] = useState<AdminBusiness | null>(null);

  useEffect(() => {
    if (businessId) getBusiness(businessId).then(setBusiness);
  }, [businessId]);

  if (!businessId || !business) return <p className="text-ivory-dim">Loading...</p>;

  if (business.category !== 'hotel') {
    return (
      <div className="max-w-lg space-y-3">
        <h1 className="font-display text-3xl text-ivory">Channel Manager</h1>
        <p className="text-base text-ivory-dim">Only available for hotel businesses - restaurants don't have an OTA/rate-distribution concept to sync.</p>
      </div>
    );
  }

  if (!business.features.channelManager?.enabled) {
    return (
      <div className="max-w-lg space-y-3">
        <h1 className="font-display text-3xl text-ivory">Channel Manager</h1>
        <p className="text-base text-ivory-dim">Turned off for your business. Turn it on under Features to connect OTAs and sync rates.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ivory">Channel Manager</h1>
        <p className="mt-1 text-base text-ivory-dim">Owner-only. Connect OTAs, push rates, and review incoming bookings.</p>
      </div>
      <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm text-ivory-dim">
        Real Booking.com / Expedia / Airbnb sync requires signing up as a certified connectivity partner with each OTA
        and obtaining real API credentials through their own certification process - that's an account-level step only
        you can start with each platform. Once you have credentials, enter them below and rate/booking sync will use them for real.
      </div>
      <ConnectionsSection businessId={businessId} />
      <RatePushSection businessId={businessId} />
      <InboundBookingsSection businessId={businessId} />
    </div>
  );
}

function ConnectionsSection({ businessId }: { businessId: string }) {
  const [connections, setConnections] = useState<ChannelConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingChannel, setConnectingChannel] = useState<ChannelConnection['channel'] | null>(null);

  function reload() {
    setLoading(true);
    listChannelConnections(businessId).then(setConnections).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(reload, [businessId]);

  async function handleDisconnect(channel: ChannelConnection['channel']) {
    await disconnectChannel(businessId, channel);
    reload();
  }

  const allChannels: ChannelConnection['channel'][] = ['booking_com', 'expedia', 'airbnb', 'agoda', 'other'];

  return (
    <Section title="OTA connections">
      {loading && <p className="text-ivory-dim">Loading...</p>}
      {!loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {allChannels.map((channel) => {
            const conn = connections.find((c) => c.channel === channel);
            return (
              <div key={channel} className="rounded-2xl border border-ink-line p-3 shadow-sm">
                <p className="text-base text-ivory">{CHANNEL_LABELS[channel]}</p>
                {conn ? (
                  <>
                    <p className={`text-sm ${conn.last_sync_status === 'failed' ? 'text-danger' : 'text-success'}`}>
                      {conn.last_synced_at ? `Last synced ${new Date(conn.last_synced_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'Connected, not synced yet'}
                    </p>
                    {conn.last_sync_error && <p className="text-sm text-danger">{conn.last_sync_error}</p>}
                    <button type="button" onClick={() => handleDisconnect(channel)} className="mt-1 text-sm text-danger hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">Disconnect</button>
                  </>
                ) : (
                  <button type="button" onClick={() => setConnectingChannel(channel)} className="mt-1 text-sm text-brass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">Connect</button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {connectingChannel && (
        <ConnectForm businessId={businessId} channel={connectingChannel} onClose={() => setConnectingChannel(null)} onSaved={() => { setConnectingChannel(null); reload(); }} />
      )}
    </Section>
  );
}

function ConnectForm({ businessId, channel, onClose, onSaved }: {
  businessId: string; channel: ChannelConnection['channel']; onClose: () => void; onSaved: () => void;
}) {
  const [apiKey, setApiKey] = useState('');
  const [hotelId, setHotelId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!apiKey || !hotelId) { setError('Both fields are required'); return; }
    setSaving(true);
    setError('');
    try {
      await upsertChannelConnection(businessId, channel, { apiKey, hotelId });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-ink-line p-4 shadow-sm">
      <p className="mb-3 text-base text-ivory">Connect {CHANNEL_LABELS[channel]}</p>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="API key" className="w-56"><PasswordField value={apiKey} onChange={setApiKey} required={false} autoComplete="off" /></Field>
        <Field label={`${CHANNEL_LABELS[channel]} property/hotel ID`}><input value={hotelId} onChange={(e) => setHotelId(e.target.value)} className={`${inputClass} w-48`} /></Field>
        <PrimaryButton onClick={handleSave} disabled={saving}>{saving ? 'Connecting...' : 'Connect'}</PrimaryButton>
        <ActionButton onClick={onClose}>Cancel</ActionButton>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

function RatePushSection({ businessId }: { businessId: string }) {
  const [channel, setChannel] = useState<ChannelConnection['channel']>('booking_com');
  const [roomType, setRoomType] = useState('');
  const [stayDate, setStayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rateAed, setRateAed] = useState('');
  const [availableRooms, setAvailableRooms] = useState('');
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  async function handlePush() {
    if (!roomType || !rateAed || !availableRooms) { setError('Room type, rate, and availability are required'); return; }
    setPushing(true);
    setError('');
    setResult('');
    try {
      const res = await pushRatesToChannel(businessId, {
        channel, roomType, dates: [{ stayDate, rateAed: Number(rateAed), availableRooms: Number(availableRooms) }],
      });
      setResult(res.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Push failed');
    } finally {
      setPushing(false);
    }
  }

  return (
    <Section title="Push rates">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Channel">
          <select value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)} className={`${inputClass} w-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass`}>
            {Object.entries(CHANNEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Room type"><input value={roomType} onChange={(e) => setRoomType(e.target.value)} className={`${inputClass} w-40`} placeholder="e.g. Deluxe King" /></Field>
        <Field label="Stay date"><input type="date" value={stayDate} onChange={(e) => setStayDate(e.target.value)} className={`${inputClass} w-40`} /></Field>
        <Field label="Rate (AED)"><input type="number" value={rateAed} onFocus={(e) => e.target.select()} onChange={(e) => setRateAed(e.target.value)} className={`${inputClass} w-28`} /></Field>
        <Field label="Available rooms"><input type="number" value={availableRooms} onFocus={(e) => e.target.select()} onChange={(e) => setAvailableRooms(e.target.value)} className={`${inputClass} w-28`} /></Field>
        <PrimaryButton onClick={handlePush} disabled={pushing}>{pushing ? 'Pushing...' : 'Push'}</PrimaryButton>
      </div>
      {result && <p className="mt-2 text-sm text-success">{result}</p>}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </Section>
  );
}

function InboundBookingsSection({ businessId }: { businessId: string }) {
  const [bookings, setBookings] = useState<ChannelBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    listChannelBookings(businessId, 'received').then(setBookings).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(reload, [businessId]);

  async function handleConfirm(id: string) {
    setBusyId(id);
    try {
      await confirmChannelBooking(businessId, id);
      reload();
    } finally {
      setBusyId(null);
    }
  }
  async function handleReject(id: string) {
    setBusyId(id);
    try {
      await rejectChannelBooking(businessId, id);
      reload();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Section title="Incoming OTA bookings">
      <p className="text-sm text-ivory-dim">New bookings from a connected OTA land here first - confirm to turn one into a real reservation, so a malformed or duplicate payload never silently touches your live bookings.</p>
      {loading && <p className="text-ivory-dim">Loading...</p>}
      {!loading && (
        <div className="space-y-2">
          {bookings.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-line p-3 shadow-sm">
              <div>
                <p className="text-base text-ivory">{b.guest_name} — {CHANNEL_LABELS[b.channel_connections?.channel ?? 'other']}</p>
                <p className="text-sm text-ivory-dim">
                  {b.room_type || 'Room'} · {new Date(b.check_in).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {new Date(b.check_out).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · AED {Number(b.total_amount_aed).toFixed(2)}
                </p>
              </div>
              <div className="flex gap-2">
                <ActionButton danger onClick={() => handleReject(b.id)} disabled={busyId === b.id}>Reject</ActionButton>
                <PrimaryButton onClick={() => handleConfirm(b.id)} disabled={busyId === b.id}>Confirm</PrimaryButton>
              </div>
            </div>
          ))}
          {bookings.length === 0 && <p className="text-ivory-dim">No new OTA bookings waiting.</p>}
        </div>
      )}
    </Section>
  );
}
