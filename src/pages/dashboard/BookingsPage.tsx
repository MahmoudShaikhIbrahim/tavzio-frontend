import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import { listBookings, createBooking, updateBookingStatus, assignBookingTable, confirmArrivalByStaff, listTables, getBusiness, updateBusinessFeatures } from '../../lib/authApi';
import ExportButtons from '../../components/ExportButtons';
import { subscribeToBusinessTable } from '../../lib/supabaseClient';
import { playNotificationSound } from '../../lib/soundPlayer';
import { Section, Field, inputClass, PrimaryButton } from '../../components/ui';
import type { BookingRow, BookingStatus, NotificationSettings, FloorTable, AdminBusiness } from '../../types';

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
  const [business, setBusiness] = useState<AdminBusiness | null>(null);
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [showOnlineSettings, setShowOnlineSettings] = useState(false);

  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');

  function reload() {
    if (!businessId) return;
    setLoadError('');
    listBookings(businessId)
      .then((rows) => { setBookings(rows); setLoaded(true); })
      .catch((err) => { setLoadError(err instanceof Error ? err.message : 'Could not load bookings'); setLoaded(true); });
    listTables(businessId).then(setTables).catch(() => setTables([]));
  }

  useEffect(reload, [businessId]);
  useEffect(() => {
    if (businessId) getBusiness(businessId).then((b) => { setNotificationSettings(b.notification_settings); setBusiness(b); });
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
          <button type="button" onClick={() => setShowOnlineSettings((s) => !s)} className="rounded-lg border border-brass/40 px-3.5 py-1.5 text-sm text-brass hover:bg-brass/10">
            {showOnlineSettings ? t('Close online booking settings') : t('Online booking settings')}
          </button>
          <ExportButtons businessId={businessId} kind="bookings" />
        </div>
      </div>

      {showOnlineSettings && business && (
        <OnlineBookingSettings business={business} onSaved={(b) => setBusiness(b)} />
      )}

      {showNewBooking && (
        <NewBookingForm businessId={businessId} tables={tables} onDone={() => { setShowNewBooking(false); reload(); }} />
      )}

      {!loaded && <p className="text-ivory-dim">{t('Loading...')}</p>}
      {loadError && <p className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-danger">{loadError}</p>}
      {loaded && !loadError && bookings.length === 0 && (
        <p className="text-ivory-dim">{t('No bookings yet - manual and online bookings will both show up here as they come in.')}</p>
      )}

      <Group title={t('Needs a response')} bookings={pending} businessId={businessId} tables={tables} onBookingsChange={setBookings} onChange={reload} urgent />
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

function Group({ title, bookings, businessId, tables, onBookingsChange, onChange, urgent }: {
  title: string; bookings: BookingRow[]; businessId: string; tables: FloorTable[]; onBookingsChange: (updater: (prev: BookingRow[]) => BookingRow[]) => void; onChange: () => void; urgent?: boolean;
}) {
  if (bookings.length === 0) return null;
  return (
    <div>
      <div className="mb-3 flex items-center gap-2.5">
        <h2 className={`font-mono text-[11px] uppercase tracking-wider ${urgent ? 'text-brass' : 'text-ivory-dim'}`}>{title}</h2>
        {urgent && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brass px-1.5 text-[11px] font-medium text-ink">{bookings.length}</span>}
      </div>
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
  const [confirmingArrival, setConfirmingArrival] = useState(false);

  function setStatus(status: BookingStatus) {
    onBookingsChange((prev) => prev.map((b) => (b.id === booking.id ? { ...b, status } : b)));
    updateBookingStatus(businessId, booking.id, status).catch(onChange);
  }

  function setTable(tableId: string) {
    assignBookingTable(businessId, booking.id, tableId || null).then(onChange).catch(onChange);
  }

  async function handleConfirmArrival() {
    setConfirmingArrival(true);
    try {
      await confirmArrivalByStaff(businessId, booking.id);
      onChange();
    } catch {
      onChange();
    } finally {
      setConfirmingArrival(false);
    }
  }

  const title = booking.guest_name || booking.service_name || t('Booking');
  const foodItems = booking.booking_items || [];

  return (
    <div className="overflow-hidden rounded-xl border border-ink-line bg-ink-soft">
      {/* Same device already used on Kitchen tickets for "this needs
          attention" - a real colored strip, not a new pattern invented
          just for this page, so the whole dashboard signals urgency the
          same way wherever it shows up. */}
      <div className={`h-1.5 ${booking.status === 'pending' ? 'bg-brass' : 'bg-ink-line'}`} />
      <div className="p-4 text-base">
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
        <div className="flex flex-col items-end gap-1.5">
          <span className={`rounded-full border px-3 py-1 text-sm font-medium ${STATUS_STYLE[booking.status]}`}>
            {t(STATUS_LABEL[booking.status])}
          </span>
          {booking.status === 'confirmed' && (
            <span className={`rounded-full border px-2.5 py-0.5 text-xs ${booking.arrival_status === 'arrived' ? 'border-success/50 text-success' : 'border-ink-line text-ivory-dim'}`}>
              {booking.arrival_status === 'arrived' ? t('Arrived') : t('Not arrived')}
            </span>
          )}
        </div>
      </div>

      {foodItems.length > 0 && (
        <div className="mt-3 rounded-lg border border-brass/30 bg-ink px-3 py-2.5">
          <p className="text-xs uppercase tracking-wide text-brass">{t('Pre-ordered food')}</p>
          <p className="mt-1 text-sm text-ivory-dim">
            {foodItems.map((i) => `${i.quantity}× ${i.item_name}`).join(', ')}
            {booking.food_ready_offset_minutes !== null && (
              booking.food_ready_offset_minutes === 0
                ? ` · ${t('ready on arrival')}`
                : ` · ${t('ready')} ${booking.food_ready_offset_minutes} ${t('min after arrival')}`
            )}
          </p>
        </div>
      )}

      {booking.down_payment_status !== 'not_required' && (
        <p className="mt-3 text-sm">
          <span className="text-ivory-dim">{t('Down payment')}: </span>
          <span className={booking.down_payment_status === 'paid' ? 'text-success' : booking.down_payment_status === 'failed' ? 'text-danger' : 'text-brass'}>
            AED {booking.down_payment_required_aed.toFixed(2)} · {t(booking.down_payment_status)}
          </span>
        </p>
      )}

      {tables.length > 0 && ['pending', 'confirmed'].includes(booking.status) && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="text-ivory-dim">{t('Table:')}</span>
          <select value={booking.table_id || ''} onChange={(e) => setTable(e.target.value)} className="rounded border border-ink-line bg-ink px-2 py-1 text-xs text-ivory">
            <option value="">{t('Not assigned')}</option>
            {tables.map((tbl) => <option key={tbl.id} value={tbl.id}>{tbl.label}</option>)}
          </select>
        </div>
      )}

      {booking.status === 'pending' && (
        <div className="mt-3.5 flex gap-2">
          <button type="button"
            onClick={() => setStatus('confirmed')}
            className="flex-1 rounded-lg bg-brass px-3 py-3 text-base font-medium text-ink hover:opacity-90"
          >
            {t('Confirm')}
          </button>
          <button type="button"
            onClick={() => setStatus('declined')}
            className="rounded-lg border border-danger/40 px-4 py-3 text-base text-danger hover:bg-danger/10"
          >
            {t('Decline')}
          </button>
        </div>
      )}
      {booking.status === 'confirmed' && booking.arrival_status === 'not_arrived' && (
        <button type="button"
          onClick={handleConfirmArrival}
          disabled={confirmingArrival}
          className="mt-3.5 w-full rounded-lg border border-brass/40 px-3 py-3 text-base text-brass hover:bg-brass/10 disabled:opacity-50"
        >
          {confirmingArrival ? t('Confirming...') : t("Confirm arrival - I see the guest")}
        </button>
      )}
      {booking.status === 'confirmed' && (
        <button type="button"
          onClick={() => setStatus('completed')}
          className="mt-3.5 w-full rounded-lg border border-brass/40 px-3 py-3 text-base text-brass hover:bg-brass/10"
        >
          {t('Mark completed')}
        </button>
      )}
      </div>
    </div>
  );
}

// Merged in from what used to be a separate "Online Booking" settings
// page - the actual complaint was "online booking and booking must be
// in one single page in separate sections but both must land in the
// booking page" - so this now lives here, as a toggleable section,
// instead of a second page an owner had to separately navigate to.
type DownPaymentMode = 'full' | 'percentage' | 'fixed';

function OnlineBookingSettings({ business, onSaved }: { business: AdminBusiness; onSaved: (b: AdminBusiness) => void }) {
  const { t } = useT();
  const cfg = business.features?.onlineBooking;
  const [enabled, setEnabled] = useState(!!cfg?.enabled);
  const [allowPreOrder, setAllowPreOrder] = useState(!!cfg?.allowPreOrder);
  const [downPaymentEnabled, setDownPaymentEnabled] = useState(!!cfg?.downPayment?.enabled);
  const [downPaymentMode, setDownPaymentMode] = useState<DownPaymentMode>(cfg?.downPayment?.mode || 'percentage');
  const [downPaymentValue, setDownPaymentValue] = useState(cfg?.downPayment?.value ?? 20);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      // Sent as one complete object, not a partial patch - the backend
      // merge is shallow (one level deep), so downPayment must always
      // be sent whole or an earlier value could get silently dropped.
      const updated = await updateBusinessFeatures(business.id, {
        onlineBooking: {
          enabled,
          allowPreOrder,
          downPayment: { enabled: downPaymentEnabled, mode: downPaymentMode, value: downPaymentValue },
        },
      });
      onSaved(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Section title={t('Online booking settings')}>
        <label className="flex items-center justify-between gap-4">
          <div>
            <p className="text-base text-ivory">{t('Enable online booking')}</p>
            <p className="text-sm text-ivory-dim">{t('Turns on the public booking page and the QR code / link below.')}</p>
          </div>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-5 w-5 accent-brass" />
        </label>

        {enabled && (
          <>
            <label className="flex items-center justify-between gap-4 border-t border-ink-line pt-4">
              <div>
                <p className="text-base text-ivory">{t('Allow food pre-order with booking')}</p>
                <p className="text-sm text-ivory-dim">{t('Off = booking only. On = customers can also pre-order food, ready when they arrive or a few minutes after.')}</p>
              </div>
              <input type="checkbox" checked={allowPreOrder} onChange={(e) => setAllowPreOrder(e.target.checked)} className="h-5 w-5 accent-brass" />
            </label>

            <div className="border-t border-ink-line pt-4">
              <label className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-base text-ivory">{t('Require a down payment')}</p>
                  <p className="text-sm text-ivory-dim">{t('Charged online when the booking is made, before it counts as confirmed.')}</p>
                </div>
                <input type="checkbox" checked={downPaymentEnabled} onChange={(e) => setDownPaymentEnabled(e.target.checked)} className="h-5 w-5 accent-brass" />
              </label>

              {downPaymentEnabled && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label={t('Type')}>
                    <select value={downPaymentMode} onChange={(e) => setDownPaymentMode(e.target.value as DownPaymentMode)} className={inputClass}>
                      <option value="full">{t('Full amount (only applies if a food pre-order is included)')}</option>
                      <option value="percentage">{t('Percentage of the pre-order total')}</option>
                      <option value="fixed">{t('Fixed amount, every booking')}</option>
                    </select>
                  </Field>
                  {downPaymentMode !== 'full' && (
                    <Field label={downPaymentMode === 'percentage' ? t('Percentage (%)') : t('Amount (AED)')}>
                      <input
                        type="number" min={0} max={downPaymentMode === 'percentage' ? 100 : undefined}
                        value={downPaymentValue} onFocus={(e) => e.target.select()}
                        onChange={(e) => setDownPaymentValue(Number(e.target.value))}
                        className={inputClass}
                      />
                    </Field>
                  )}
                </div>
              )}
              {downPaymentEnabled && downPaymentMode !== 'fixed' && !allowPreOrder && (
                <p className="mt-2 text-sm text-warning">
                  {t('This business has food pre-order turned off, so a percentage or full-amount down payment has nothing to calculate from - only a fixed amount will actually charge anything until pre-order is turned on.')}
                </p>
              )}
            </div>
          </>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex items-center gap-3">
          <PrimaryButton onClick={handleSave} loading={saving} type="button">{t('Save')}</PrimaryButton>
          {saved && <span className="text-sm text-success">{t('Saved')}</span>}
        </div>
      </Section>

      {enabled && business.slug && <ShareSection slug={business.slug} />}
    </div>
  );
}

// Real, self-generated QR code - no third-party image service, no
// dependency on an external site staying up. Rendered client-side,
// entirely offline once loaded, using the exact same booking URL the
// "Copy link" button hands out below - one source of truth, so the
// printed QR code and the pasted Instagram/WhatsApp link can never
// point at two different places.
function ShareSection({ slug }: { slug: string }) {
  const { t } = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const bookingUrl = `https://www.tavzio.ae/${slug}/book`;

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, bookingUrl, { width: 240, margin: 2, color: { dark: '#1a1a1a', light: '#ffffff' } }).catch(() => {});
    }
  }, [bookingUrl]);

  function handleCopy() {
    navigator.clipboard.writeText(bookingUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownload() {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `${slug}-booking-qr.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  }

  return (
    <Section title={t('Share your booking page')}>
      <p className="text-base text-ivory-dim">
        {t('Paste this link into your Instagram bio or WhatsApp Business profile, or print the QR code on table tents, window stickers, or flyers.')}
      </p>

      <div className="flex flex-col items-start gap-6 sm:flex-row">
        <div className="rounded-xl border border-ink-line bg-white p-3">
          <canvas ref={canvasRef} />
        </div>
        <div className="flex-1 space-y-3">
          <Field label={t('Booking link')}>
            <div className="flex gap-2">
              <input readOnly value={bookingUrl} className={`${inputClass} flex-1`} />
              <button type="button" onClick={handleCopy} className="shrink-0 rounded-lg border border-brass/40 px-3.5 py-2 text-sm text-brass hover:bg-brass/10">
                {copied ? t('Copied') : t('Copy link')}
              </button>
            </div>
          </Field>
          <button type="button" onClick={handleDownload} className="rounded-lg bg-brass px-4 py-2 text-sm font-medium text-ink hover:opacity-90">
            {t('Download QR code')}
          </button>
        </div>
      </div>
    </Section>
  );
}
