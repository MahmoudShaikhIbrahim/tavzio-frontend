import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import { listBookings, createBooking, updateBookingStatus, assignBookingTable, listFloorTables, getBusiness } from '../../lib/authApi';
import ExportButtons from '../../components/ExportButtons';
import { subscribeToBusinessTable } from '../../lib/supabaseClient';
import { playNotificationSound } from '../../lib/soundPlayer';
import { Field, inputClass } from '../../components/ui';
import type { BookingRow, BookingStatus, NotificationSettings, FloorTable } from '../../types';

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  declined: 'Declined',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_STYLE: Record<BookingStatus, string> = {
  pending: 'border-brass text-brass',
  confirmed: 'border-success/50 text-success',
  declined: 'border-danger/40 text-danger',
  completed: 'border-ink-line text-ivory-dim',
  cancelled: 'border-danger/40 text-danger',
};

export default function BookingsPage() {
  const { user } = useSession();
  const { t } = useT();
  const businessId = user?.business_id;
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [tables, setTables] = useState<FloorTable[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [showNewBooking, setShowNewBooking] = useState(false);

  function reload() {
    if (businessId) listBookings(businessId).then(setBookings);
    if (businessId) listFloorTables(businessId).then(setTables).catch(() => setTables([]));
  }

  useEffect(reload, [businessId]);
  useEffect(() => {
    if (businessId) getBusiness(businessId).then((b) => setNotificationSettings(b.notification_settings));
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    const unsubscribe = subscribeToBusinessTable(businessId, 'bookings', () => {
      reload();
      if (notificationSettings) playNotificationSound(notificationSettings.newBooking);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, notificationSettings]);

  if (!businessId) return null;

  const pending = bookings.filter((b) => b.status === 'pending');
  const upcoming = bookings.filter((b) => b.status === 'confirmed');
  const past = bookings.filter((b) => ['completed', 'declined', 'cancelled'].includes(b.status));

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-ivory">{t('Bookings')}</h1>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowNewBooking((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">
            {t('+ New booking')}
          </button>
          <ExportButtons businessId={businessId} kind="bookings" />
        </div>
      </div>

      {showNewBooking && (
        <NewBookingForm businessId={businessId} tables={tables} onDone={() => { setShowNewBooking(false); reload(); }} />
      )}

      <Group title={t('Needs a response')} bookings={pending} businessId={businessId} tables={tables} onBookingsChange={setBookings} onChange={reload} />
      <Group title={t('Upcoming')} bookings={upcoming} businessId={businessId} tables={tables} onBookingsChange={setBookings} onChange={reload} />
      <Group title={t('History')} bookings={past.slice(0, 10)} businessId={businessId} tables={tables} onBookingsChange={setBookings} onChange={reload} />
    </div>
  );
}

// Answers the real complaint directly: a reservation phoned in has
// somewhere to go now - the same table staff already work from, not a
// separate system. Table assignment is optional at creation (a phone
// caller books a time, not necessarily a specific table) and can be
// added or changed later from the list itself.
function NewBookingForm({ businessId, tables, onDone }: { businessId: string; tables: FloorTable[]; onDone: () => void }) {
  const { t } = useT();
  const [guestName, setGuestName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('19:00');
  const [tableId, setTableId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guestName.trim()) return;
    setSaving(true);
    setError('');
    try {
      await createBooking(businessId, {
        guestName: guestName.trim(),
        contactPhone,
        partySize,
        requestedAt: new Date(`${date}T${time}`).toISOString(),
        note,
        tableId: tableId || null,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create booking');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-brass/40 bg-ink-soft p-4">
      <p className="text-sm text-ivory-dim">{t('For a reservation taken by phone or in person - confirmed immediately, no approval step.')}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t('Guest name')}><input required value={guestName} onChange={(e) => setGuestName(e.target.value)} className={inputClass} /></Field>
        <Field label={t('Phone')}><input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputClass} /></Field>
        <Field label={t('Party size')}><input type="number" min={1} value={partySize} onFocus={(e) => e.target.select()} onChange={(e) => setPartySize(Number(e.target.value))} className={inputClass} /></Field>
        <Field label={t('Date')}><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} /></Field>
        <Field label={t('Time')}><input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} /></Field>
        <Field label={t('Table (optional)')}>
          <select value={tableId} onChange={(e) => setTableId(e.target.value)} className={inputClass}>
            <option value="">{t('Not assigned yet')}</option>
            {tables.map((tbl) => <option key={tbl.id} value={tbl.id}>{tbl.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label={t('Note')}><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anniversary, high chair needed, etc." className={inputClass} /></Field>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={saving} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
        {saving ? t('Creating...') : t('Create booking')}
      </button>
    </form>
  );
}

function Group({ title, bookings, businessId, tables, onBookingsChange, onChange }: {
  title: string; bookings: BookingRow[]; businessId: string; tables: FloorTable[]; onBookingsChange: (updater: (prev: BookingRow[]) => BookingRow[]) => void; onChange: () => void;
}) {
  if (bookings.length === 0) return null;
  return (
    <div>
      <h2 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ivory-dim">{title}</h2>
      <div className="space-y-4">
        {bookings.map((b) => <BookingRowItem key={b.id} booking={b} businessId={businessId} tables={tables} onBookingsChange={onBookingsChange} onChange={onChange} />)}
      </div>
    </div>
  );
}

function BookingRowItem({ booking, businessId, tables, onBookingsChange, onChange }: {
  booking: BookingRow; businessId: string; tables: FloorTable[]; onBookingsChange: (updater: (prev: BookingRow[]) => BookingRow[]) => void; onChange: () => void;
}) {
  const { t } = useT();
  function setStatus(status: BookingStatus) {
    onBookingsChange((prev) => prev.map((b) => (b.id === booking.id ? { ...b, status } : b)));
    updateBookingStatus(businessId, booking.id, status).catch(onChange);
  }

  function setTable(tableId: string) {
    assignBookingTable(businessId, booking.id, tableId || null).then(onChange).catch(onChange);
  }

  const title = booking.guest_name || booking.service_name || t('Booking');

  return (
    <div className="rounded-lg border border-ink-line px-3.5 py-3 text-base">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-ivory">
            {title}
            {booking.party_size ? <span className="text-ivory-dim"> · {t('party of')} {booking.party_size}</span> : null}
          </p>
          <p className="text-base text-ivory-dim">
            {new Date(booking.requested_at).toLocaleString()}
            {booking.contact_phone && ` · ${booking.contact_phone}`}
          </p>
          {booking.note && <p className="mt-1 text-base italic text-brass">{booking.note}</p>}
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-sm ${STATUS_STYLE[booking.status]}`}>
          {t(STATUS_LABEL[booking.status])}
        </span>
      </div>

      {tables.length > 0 && ['pending', 'confirmed'].includes(booking.status) && (
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="text-ivory-dim">{t('Table:')}</span>
          <select value={booking.table_id || ''} onChange={(e) => setTable(e.target.value)} className="rounded border border-ink-line bg-ink px-2 py-1 text-xs text-ivory">
            <option value="">{t('Not assigned')}</option>
            {tables.map((tbl) => <option key={tbl.id} value={tbl.id}>{tbl.label}</option>)}
          </select>
        </div>
      )}

      {booking.status === 'pending' && (
        <div className="mt-2.5 flex gap-2">
          <button type="button"
            onClick={() => setStatus('confirmed')}
            className="flex-1 rounded-lg bg-brass px-3 py-2 text-base font-medium text-ink hover:opacity-90"
          >
            {t('Confirm')}
          </button>
          <button type="button"
            onClick={() => setStatus('declined')}
            className="rounded-lg border border-danger/40 px-3 py-2 text-base text-danger hover:bg-danger/10"
          >
            {t('Decline')}
          </button>
        </div>
      )}
      {booking.status === 'confirmed' && (
        <button type="button"
          onClick={() => setStatus('completed')}
          className="mt-2.5 w-full rounded-lg border border-brass/40 px-3 py-2 text-base text-brass hover:bg-brass/10"
        >
          {t('Mark completed')}
        </button>
      )}
    </div>
  );
}
