import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { listBookings, updateBookingStatus, getBusiness } from '../../lib/authApi';
import ExportButtons from '../../components/ExportButtons';
import { subscribeToBusinessTable } from '../../lib/supabaseClient';
import { playNotificationSound } from '../../lib/soundPlayer';
import type { BookingRow, BookingStatus, NotificationSettings } from '../../types';

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
  const businessId = user?.business_id;
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);

  function reload() {
    if (businessId) listBookings(businessId).then(setBookings);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-ivory">Bookings</h1>
        <div className="flex gap-2">
          <ExportButtons businessId={businessId} kind="bookings" />
        </div>
      </div>

      <Group title="Needs a response" bookings={pending} businessId={businessId} onChange={reload} />
      <Group title="Upcoming" bookings={upcoming} businessId={businessId} onChange={reload} />
      <Group title="History" bookings={past.slice(0, 10)} businessId={businessId} onChange={reload} />
    </div>
  );
}

function Group({ title, bookings, businessId, onChange }: {
  title: string; bookings: BookingRow[]; businessId: string; onChange: () => void;
}) {
  if (bookings.length === 0) return null;
  return (
    <div>
      <h2 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ivory-dim">{title}</h2>
      <div className="space-y-2.5">
        {bookings.map((b) => <BookingRowItem key={b.id} booking={b} businessId={businessId} onChange={onChange} />)}
      </div>
    </div>
  );
}

function BookingRowItem({ booking, businessId, onChange }: { booking: BookingRow; businessId: string; onChange: () => void }) {
  return (
    <div className="rounded-lg border border-ink-line px-3.5 py-3 text-base">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-ivory">{booking.service_name}</p>
          <p className="text-base text-ivory-dim">
            {new Date(booking.requested_at).toLocaleString()}
            {booking.contact_phone && ` · ${booking.contact_phone}`}
          </p>
          {booking.note && <p className="mt-1 text-base italic text-brass">{booking.note}</p>}
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-sm ${STATUS_STYLE[booking.status]}`}>
          {STATUS_LABEL[booking.status]}
        </span>
      </div>

      {booking.status === 'pending' && (
        <div className="mt-2.5 flex gap-2">
          <button
            onClick={() => updateBookingStatus(businessId, booking.id, 'confirmed').then(onChange)}
            className="flex-1 rounded-lg bg-brass px-3 py-2 text-base font-medium text-ink hover:opacity-90"
          >
            Confirm
          </button>
          <button
            onClick={() => updateBookingStatus(businessId, booking.id, 'declined').then(onChange)}
            className="rounded-lg border border-danger/40 px-3 py-2 text-base text-danger hover:bg-danger/10"
          >
            Decline
          </button>
        </div>
      )}
      {booking.status === 'confirmed' && (
        <button
          onClick={() => updateBookingStatus(businessId, booking.id, 'completed').then(onChange)}
          className="mt-2.5 w-full rounded-lg border border-brass/40 px-3 py-2 text-base text-brass hover:bg-brass/10"
        >
          Mark completed
        </button>
      )}
    </div>
  );
}
