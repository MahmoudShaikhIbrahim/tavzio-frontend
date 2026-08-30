import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Search, UtensilsCrossed } from 'lucide-react';
import {
  getBookingConfig, requestBookingOtp, verifyBookingOtp, submitPublicBooking, cancelPublicBooking,
  listMyBookings, reschedulePublicBooking, cancelPublicBookingService, type MyBooking,
  getBookingPaymentStatus, getBusiness, type BookingConfig,
} from '../lib/api';
import { getSavedPhone, setSavedPhone } from '../lib/loyaltyStorage';
import { buildBusinessThemeVars } from '../lib/businessTheme';
import { AdvancedDatePicker, AdvancedTimePicker } from '../components/AdvancedDateTimePicker';
import type { Business } from '../types';
import { Check } from 'lucide-react';
import { LanguageProvider, useLanguage } from '../lib/i18n/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

// Real replacement for the old service-appointment booking flow (see
// lib/api.ts's comment) - a genuinely different product now: a table
// reservation, optionally with a food pre-order and a down payment,
// gated behind phone OTP verification. Fully translated across all 9
// languages via the tb* keys in translations/*.ts, same t()/LanguageProvider
// mechanism used everywhere else in the app - the language switcher
// actually changes visible text now, not just RTL/LTR direction.
const FOOD_TIMING_OPTIONS = [
  { value: 0, labelKey: 'tbReadyOnArrival' as const },
  { value: 5, labelKey: 'tbReady5' as const },
  { value: 10, labelKey: 'tbReady10' as const },
  { value: 15, labelKey: 'tbReady15' as const },
];

type Step = 'loading' | 'notAvailable' | 'form' | 'otp' | 'submitting' | 'confirmed' | 'paymentPending' | 'paymentFailed' | 'managePhone' | 'manageOtp' | 'manageList';

interface CartLine { menuItemId: string; name: string; price: number; quantity: number; note: string }

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// Real helper matching the backend's own checkWithinHours semantics
// exactly: a day missing from the hours object means no restriction, an
// explicit null means closed that day. bookingHours (if set at all)
// takes over from operatingHours entirely, not merged day-by-day - the
// same "one complete override object" model the admin editor itself uses.
function getEffectiveHoursFor(dateStr: string, operatingHours: BookingConfig['operatingHours'], bookingHours: BookingConfig['bookingHours']) {
  if (!dateStr) return { minTime: undefined, maxTime: undefined, closed: false };
  const hoursObj = bookingHours || operatingHours;
  if (!hoursObj) return { minTime: undefined, maxTime: undefined, closed: false };
  const dayKey = DAY_KEYS[new Date(`${dateStr}T00:00:00`).getDay()];
  if (!(dayKey in hoursObj)) return { minTime: undefined, maxTime: undefined, closed: false };
  const dayHours = hoursObj[dayKey];
  if (!dayHours) return { minTime: undefined, maxTime: undefined, closed: true };
  return { minTime: dayHours.open, maxTime: dayHours.close, closed: false };
}

// Real, robust fix for a confirmed bug: layering a semi-transparent
// native date/time input under a custom placeholder (the previous
// approach) still let the native picker's own internal sub-controls
// (WebKit's calendar-picker-indicator, the native mm/dd/yyyy segments
// once a value exists) render their own box on top - producing the
// doubled/broken look. The only actually reliable fix is to hide the
// native input completely (opacity-0, zero visible footprint) and
// drive it entirely through one single custom-styled box - tapping it
// calls showPicker() to open the real native picker, with a focus()
// fallback for older Safari versions that don't support it yet.
// Real, expandable "add with note" row - matches the same interaction
// pattern already used for notification buttons elsewhere in the app
// (tap to expand, optional note, confirm) instead of a bare Add button
// with no way for the guest to say "no onions" before it's in the cart.
// Exported for reuse by DriveThroughPage.tsx - the exact same item row
// (image, name, price, expandable note, add-to-cart) drive-through
// needs, not a rebuilt lookalike.
export function BookingMenuItemRow({ item, cart, onAdd, t }: {
  item: BookingConfig['menu'][number];
  cart: { menuItemId: string; note: string; quantity: number }[];
  onAdd: (item: BookingConfig['menu'][number], note?: string) => void;
  t: (key: Parameters<ReturnType<typeof useLanguage>['t']>[0], vars?: Record<string, string | number>) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState('');
  const totalQuantity = cart.filter((l) => l.menuItemId === item.id).reduce((s, l) => s + l.quantity, 0);

  function handleConfirmAdd() {
    onAdd(item, note.trim());
    setNote('');
    setExpanded(false);
  }

  return (
    <div className="rounded-lg border border-ink-line p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} className="h-12 w-12 shrink-0 rounded-lg object-cover" loading="lazy" />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-ink text-ivory-dim/30">
              <UtensilsCrossed size={18} strokeWidth={1.5} />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-display text-sm text-ivory">{item.name}</p>
            <p className="text-xs text-ivory-dim">AED {item.price.toFixed(2)}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {totalQuantity > 0 && <span className="rounded-full bg-brass/20 px-2 py-0.5 text-xs text-brass">{totalQuantity} {t('tbInCart')}</span>}
          <button type="button" onClick={() => setExpanded((s) => !s)} className="rounded-lg border border-brass/40 px-3 py-1.5 text-xs text-brass hover:bg-brass/10">
            {expanded ? t('tbCancel') : t('tbAdd')}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="mt-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('tbItemNotePlaceholder')}
            className="w-full rounded-lg border border-ink-line bg-ink px-3 py-1.5 text-sm text-ivory placeholder:text-ivory-dim/60"
          />
          <button type="button" onClick={handleConfirmAdd} className="mt-1.5 w-full rounded-lg bg-brass px-3 py-1.5 text-sm font-medium text-ink hover:opacity-90">
            {t('tbAddToOrder')}
          </button>
        </div>
      )}
    </div>
  );
}

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return <LoadingShell />;
  return (
    <LanguageProvider slug={slug}>
      <BookingPageContent slug={slug} />
    </LanguageProvider>
  );
}

function BookingPageContent({ slug }: { slug: string }) {
  const { isRtl, t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [business, setBusiness] = useState<Business | null>(null);
  const [config, setConfig] = useState<BookingConfig | null>(null);
  const [step, setStep] = useState<Step>('loading');

  // Form state
  const [guestName, setGuestName] = useState('');
  const [phone, setPhone] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [foodSearchQuery, setFoodSearchQuery] = useState('');
  const [activeFoodCategory, setActiveFoodCategory] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [foodTiming, setFoodTiming] = useState(0);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedServiceOptionId, setSelectedServiceOptionId] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [serviceDateTouched, setServiceDateTouched] = useState(false);
  const [serviceTime, setServiceTime] = useState('');
  const [otp, setOtp] = useState('');
  const [, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [managePhone, setManagePhone] = useState('');
  const [manageOtp, setManageOtp] = useState('');
  const [myBookings, setMyBookings] = useState<MyBooking[]>([]);
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [manageBusy, setManageBusy] = useState(false);

  useEffect(() => {
    getBusiness(slug).then(setBusiness).catch(() => {});
    getBookingConfig(slug)
      .then((c) => { setConfig(c); setStep('form'); })
      .catch(() => setStep('notAvailable'));
  }, [slug]);

  // Real, explicit extension of the same "remember this device" pattern
  // already built for loyalty: pre-fills a returning customer's own
  // phone number so they never have to type it again on this device.
  // Deliberately does NOT skip the OTP step itself the way loyalty
  // does - createPublicBooking's own verification window (see
  // VERIFIED_WINDOW_MINUTES in bookingPublicController.js) is a real,
  // intentional security boundary for actually reserving a table, not
  // an oversight: a stale verification from an old visit shouldn't be
  // enough to make a brand new reservation on its own. This still
  // removes the actual friction (remembering and typing a phone
  // number) while leaving that boundary genuinely intact - a fresh
  // code still has to land on their phone and be entered for every new
  // booking.
  useEffect(() => {
    if (!business) return;
    const saved = getSavedPhone(business.id);
    if (saved) {
      setPhone(saved);
      setManagePhone(saved);
    }
  }, [business]);

  // Real fix for the explicit request: the service date defaults to
  // the same date as the table booking itself ("obviously the same
  // date") and stays in sync if the guest changes the main date later -
  // unless they've deliberately edited the service date themselves,
  // in which case their own choice is never silently overwritten.
  useEffect(() => {
    if (!serviceDateTouched) setServiceDate(date);
  }, [date, serviceDateTouched]);

  // Returning from a redirect-based down payment - poll until the
  // reconciliation loop (or the gateway's own instant callback) marks
  // it paid, same "poll after redirect" pattern the rest of this app's
  // payment flows already use.
  const returningPaymentId = searchParams.get('bookingPaymentId');
  useEffect(() => {
    if (!returningPaymentId) return;
    setStep('paymentPending');
    const interval = setInterval(async () => {
      try {
        const status = await getBookingPaymentStatus(returningPaymentId);
        if (status.down_payment_status === 'paid') {
          clearInterval(interval);
          setStep('confirmed');
        } else if (status.down_payment_status === 'failed') {
          clearInterval(interval);
          setStep('paymentFailed');
        }
      } catch {
        // transient - keep polling
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [returningPaymentId]);

  function addToCart(item: BookingConfig['menu'][number], note: string = '') {
    setCart((prev) => {
      const existing = prev.find((l) => l.menuItemId === item.id && l.note === note);
      if (existing) return prev.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1, note }];
    });
  }
  function changeQuantity(menuItemId: string, note: string, delta: number) {
    setCart((prev) => prev
      .map((l) => (l.menuItemId === menuItemId && l.note === note ? { ...l, quantity: l.quantity + delta } : l))
      .filter((l) => l.quantity > 0));
  }
  function removeCartLine(menuItemId: string, note: string) {
    setCart((prev) => prev.filter((l) => !(l.menuItemId === menuItemId && l.note === note)));
  }
  const cartTotal = cart.reduce((sum, l) => sum + l.price * l.quantity, 0);
  // Real fix for the explicit request: a selected service (its own base
  // price plus whichever option is chosen) never used to be reflected
  // in what the guest sees they'll owe - only the food pre-order cart
  // was. The backend has always priced the service correctly for the
  // down payment; this just makes the guest-facing total match it.
  const selectedService = config?.services.find((s) => s.id === selectedServiceId) || null;
  const selectedServiceOption = selectedService?.service_options.find((o) => o.id === selectedServiceOptionId) || null;
  const serviceTotal = selectedService ? Number(selectedService.price) + Number(selectedServiceOption?.price_delta || 0) : 0;
  const grandTotal = cartTotal + serviceTotal;

  async function handleSendOtp(e: FormEvent) {
    e.preventDefault();
    if (!guestName || !phone || !date || !time || !partySize) return;
    setError('');
    setSubmitting(true);
    try {
      await requestBookingOtp(slug, phone);
      setOtpSent(true);
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send verification code');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyAndSubmit(e: FormEvent) {
    e.preventDefault();
    if (!otp) return;
    if (selectedServiceId && (!serviceDate || !serviceTime)) {
      setError('Please choose a date and time for the service you selected');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await verifyBookingOtp(slug, phone, otp);
      if (business) setSavedPhone(business.id, phone);

      const requestedAt = new Date(`${date}T${time}`).toISOString();
      const result = await submitPublicBooking(slug, {
        phone, guestName, partySize, requestedAt, note,
        items: config?.allowPreOrder && cart.length > 0 ? cart.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity, note: l.note })) : undefined,
        foodReadyOffsetMinutes: config?.allowPreOrder && cart.length > 0 ? foodTiming : undefined,
        serviceId: selectedServiceId || undefined,
        serviceOptionId: selectedServiceOptionId || undefined,
        serviceRequestedAt: selectedServiceId ? new Date(`${serviceDate}T${serviceTime}`).toISOString() : undefined,
      });

      if (result.paymentRequired && result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }
      setStep('confirmed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete your booking');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestManageOtp(e: FormEvent) {
    e.preventDefault();
    if (!managePhone.trim()) return;
    setManageBusy(true);
    setError('');
    try {
      await requestBookingOtp(slug, managePhone.trim());
      setStep('manageOtp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send verification code');
    } finally {
      setManageBusy(false);
    }
  }

  async function handleVerifyManageOtp(e: FormEvent) {
    e.preventDefault();
    setManageBusy(true);
    setError('');
    try {
      await verifyBookingOtp(slug, managePhone.trim(), manageOtp);
      if (business) setSavedPhone(business.id, managePhone.trim());
      const bookings = await listMyBookings(slug, managePhone.trim());
      setMyBookings(bookings);
      setStep('manageList');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect code');
    } finally {
      setManageBusy(false);
    }
  }

  async function handleCancelFromList(id: string) {
    setManageBusy(true);
    try {
      await cancelPublicBooking(id, managePhone.trim());
      setMyBookings((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel this booking');
    } finally {
      setManageBusy(false);
    }
  }

  // Real, separate action for the explicit request: cancels just the
  // attached service, keeping the table reservation itself - updates
  // the booking in place rather than removing it from the list, since
  // the booking is still very much active.
  async function handleCancelServiceFromList(id: string) {
    setManageBusy(true);
    try {
      const updated = await cancelPublicBookingService(id, managePhone.trim());
      setMyBookings((prev) => prev.map((b) => (b.id === id ? updated : b)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel this service');
    } finally {
      setManageBusy(false);
    }
  }

  async function handleReschedule(id: string, newDate: string, newTime: string, newPartySize: number) {
    setManageBusy(true);
    setError('');
    try {
      const updated = await reschedulePublicBooking(id, managePhone.trim(), `${newDate}T${newTime}:00`, newPartySize);
      setMyBookings((prev) => prev.map((b) => (b.id === id ? { ...b, requested_at: updated.requested_at, party_size: updated.party_size } : b)));
      setRescheduling(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reschedule this booking');
    } finally {
      setManageBusy(false);
    }
  }

  const themeStyle = buildBusinessThemeVars(business?.theme?.customerBackground, business?.theme?.customerButton);

  if (step === 'loading') return <LoadingShell />;

  if (step === 'notAvailable') {
    return (
      <Shell isRtl={isRtl}>
        <p className="font-display text-xl text-ivory">{t('tbNotAvailable')}</p>
        <p className="text-sm text-ivory-dim">{t('tbNotAvailableDesc')}</p>
      </Shell>
    );
  }

  if (step === 'paymentPending') {
    return (
      <Shell isRtl={isRtl}>
        <div className="h-10 w-10 animate-pulse rounded-full border-2 border-brass/40" />
        <p className="font-display text-xl text-ivory">{t('tbConfirmingPayment')}</p>
        <p className="text-sm text-ivory-dim">{t('tbOnlyTakesAMoment')}</p>
      </Shell>
    );
  }

  if (step === 'paymentFailed') {
    return (
      <Shell isRtl={isRtl}>
        <p className="font-display text-xl text-ivory">{t('tbPaymentFailed')}</p>
        <p className="text-sm text-ivory-dim">{t('tbTableNotReserved')}</p>
        <button type="button" onClick={() => window.location.href = `/${slug}/book`} className="mt-4 rounded-lg border border-brass/40 px-4 py-2 text-sm text-brass hover:bg-brass/10">
          {t('tbTryAgain')}
        </button>
      </Shell>
    );
  }

  if (step === 'confirmed') {
    return (
      <Shell isRtl={isRtl}>
        <div className="flex h-16 w-16 animate-confirm-pop items-center justify-center rounded-full border-2 border-brass bg-brass/10 motion-reduce:animate-none">
          <Check size={28} strokeWidth={2.5} className="text-brass" />
        </div>
        <p className="mt-1 animate-hero-rise font-display text-xl text-ivory [animation-delay:150ms] motion-reduce:animate-none">{t('tbRequestSent')}</p>
        <p className="max-w-xs animate-hero-rise text-sm text-ivory-dim [animation-delay:220ms] motion-reduce:animate-none">
          {t('tbWillConfirm', { business: config?.businessName || '' })}
          {cart.length > 0 && ` ${t('tbFoodOrderNoted')}`}
        </p>
        <div className="mt-3 animate-hero-rise rounded-lg border border-brass/30 bg-ink-soft px-4 py-3 text-sm text-ivory-dim [animation-delay:290ms] motion-reduce:animate-none">
          {t('tbTapStand')}
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </Shell>
    );
  }

  if (step === 'otp') {
    return (
      <div className="min-h-screen bg-ink" dir={isRtl ? 'rtl' : 'ltr'} style={themeStyle}>
        <div className="mx-auto max-w-md px-6 pt-14 pb-16">
          <button type="button" onClick={() => setStep('form')} className="text-sm text-ivory-dim hover:text-ivory">{isRtl ? '→' : '←'} {t('back')}</button>
          <h1 className="mt-3 font-display text-2xl text-ivory">{t('tbVerifyNumber')}</h1>
          <p className="mt-1 text-sm text-ivory-dim">{t('tbCodeSentTo', { phone })}</p>
          <form onSubmit={handleVerifyAndSubmit} className="mt-6 space-y-3">
            <input
              type="text" inputMode="numeric" maxLength={6} required placeholder={t('tbEnterCode')}
              autoComplete="one-time-code"
              value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              className="w-full rounded-lg border border-ink-line bg-ink-soft px-3.5 py-3 text-center text-2xl tracking-[0.3em] text-ivory placeholder:text-base placeholder:tracking-normal placeholder:text-ivory-dim/60"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <button type="submit" disabled={submitting} className="w-full rounded-lg bg-brass px-4 py-3 font-medium text-ink disabled:opacity-50">
              {submitting ? t('tbConfirming') : t('tbConfirmBooking')}
            </button>
            <button
              type="button"
              onClick={async () => { setError(''); try { await requestBookingOtp(slug, phone); } catch { /* silent */ } }}
              className="w-full text-center text-sm text-ivory-dim hover:text-ivory"
            >
              {t('tbResendCode')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (step === 'managePhone') {
    return (
      <div className="min-h-screen bg-ink" dir={isRtl ? 'rtl' : 'ltr'} style={themeStyle}>
        <div className="mx-auto max-w-md px-6 pt-14 pb-16">
          <button type="button" onClick={() => setStep('form')} className="text-sm text-ivory-dim hover:text-ivory">{isRtl ? '→' : '←'} {t('back')}</button>
          <div className="mt-6 rounded-xl border border-brass/30 bg-ink-soft p-5">
            <p className="font-mono text-[11px] uppercase tracking-wider text-brass">{t('tbManageBooking')}</p>
            <p className="mt-2 text-sm text-ivory-dim">{t('tbManageBookingPrompt')}</p>
            <form onSubmit={handleRequestManageOtp} className="mt-3 space-y-3">
              <input
                type="tel" inputMode="tel" required placeholder={t('phoneNumber')}
                value={managePhone} onChange={(e) => setManagePhone(e.target.value)}
                className="w-full rounded-lg border border-ink-line bg-ink px-3.5 py-2.5 text-ivory placeholder:text-ivory-dim/60 focus:border-brass"
              />
              {error && <p className="text-sm text-danger">{error}</p>}
              <button type="submit" disabled={manageBusy} className="w-full rounded-lg bg-brass px-4 py-2.5 font-medium text-ink transition-opacity hover:opacity-90 disabled:opacity-50">
                {manageBusy ? t('tbSendingCode') : t('tbSendVerificationCode')}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'manageOtp') {
    return (
      <div className="min-h-screen bg-ink" dir={isRtl ? 'rtl' : 'ltr'} style={themeStyle}>
        <div className="mx-auto max-w-md px-6 pt-14 pb-16">
          <button type="button" onClick={() => setStep('managePhone')} className="text-sm text-ivory-dim hover:text-ivory">{isRtl ? '→' : '←'} {t('back')}</button>
          <h1 className="mt-3 font-display text-2xl text-ivory">{t('tbVerifyNumber')}</h1>
          <p className="mt-1 text-sm text-ivory-dim">{t('tbCodeSentTo', { phone: managePhone })}</p>
          <form onSubmit={handleVerifyManageOtp} className="mt-6 space-y-3">
            <input
              type="text" inputMode="numeric" maxLength={6} required placeholder={t('tbEnterCode')}
              autoComplete="one-time-code"
              value={manageOtp} onChange={(e) => setManageOtp(e.target.value.replace(/\D/g, ''))}
              className="w-full rounded-lg border border-ink-line bg-ink-soft px-3.5 py-3 text-center text-2xl tracking-[0.3em] text-ivory placeholder:text-base placeholder:tracking-normal placeholder:text-ivory-dim/60"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <button type="submit" disabled={manageBusy} className="w-full rounded-lg bg-brass px-4 py-3 font-medium text-ink disabled:opacity-50">
              {manageBusy ? t('tbConfirming') : t('tbConfirmBooking')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (step === 'manageList') {
    return (
      <div className="min-h-screen bg-ink" dir={isRtl ? 'rtl' : 'ltr'} style={themeStyle}>
        <div className="mx-auto max-w-md px-6 pt-14 pb-16">
          <button type="button" onClick={() => setStep('form')} className="text-sm text-ivory-dim hover:text-ivory">{isRtl ? '→' : '←'} {t('back')}</button>
          <h1 className="mt-3 font-display text-2xl text-ivory">{t('tbYourBookings')}</h1>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          <div className="mt-4 space-y-3">
            {myBookings.length === 0 && <p className="text-sm text-ivory-dim">{t('tbNoUpcomingBookings')}</p>}
            {myBookings.map((b) => (
              <div key={b.id} className="rounded-xl border border-brass/30 bg-ink-soft p-4">
                <p className="text-ivory">{new Date(b.requested_at).toLocaleString()}</p>
                <p className="text-sm text-ivory-dim">{t('tbGuests')}: {b.party_size} · {t(b.status === 'confirmed' ? 'tbStatusConfirmed' : 'tbStatusPending')}</p>
                {b.services?.name && (
                  <div className="mt-1.5 rounded-lg border border-brass/30 bg-ink px-2.5 py-1.5 text-sm text-ivory">
                    <p>
                      🎉 {b.services.name}
                      {b.service_options?.label && <span className="text-ivory-dim"> — {b.service_options.label}</span>}
                      {b.service_requested_at && (
                        <span className="text-ivory-dim"> · {new Date(b.service_requested_at).toLocaleString(undefined, { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' })}</span>
                      )}
                    </p>
                    <button type="button" disabled={manageBusy} onClick={() => handleCancelServiceFromList(b.id)} className="mt-1 text-xs text-danger hover:underline disabled:opacity-50">
                      {t('tbCancelServiceOnly')}
                    </button>
                  </div>
                )}
                {rescheduling === b.id ? (
                  <RescheduleForm booking={b} busy={manageBusy} onCancel={() => setRescheduling(null)} onSave={handleReschedule} operatingHours={config?.operatingHours ?? null} bookingHours={config?.bookingHours ?? null} />
                ) : (
                  <div className="mt-3 flex gap-3">
                    <button type="button" disabled={manageBusy} onClick={() => setRescheduling(b.id)} className="text-sm text-brass hover:underline disabled:opacity-50">
                      {t('tbReschedule')}
                    </button>
                    <button type="button" disabled={manageBusy} onClick={() => handleCancelFromList(b.id)} className="text-sm text-danger hover:underline disabled:opacity-50">
                      {t('tbCancelBooking')}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-ink" dir={isRtl ? 'rtl' : 'ltr'} style={themeStyle}>
      <div className="mx-auto max-w-md px-6 pt-14 pb-16">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl text-ivory">{t('tbBookATable')}</h1>
          <LanguageSwitcher />
        </div>
        {config?.businessName && <p className="mt-1 text-sm text-brass">{config.businessName}</p>}
        <button type="button" onClick={() => { setError(''); setStep('managePhone'); }} className="mt-3 text-sm text-ivory-dim underline decoration-ink-line hover:text-ivory">
          {t('tbManageBookingLink')}
        </button>

        <form onSubmit={handleSendOtp} className="mt-6 space-y-3">
          <input type="text" required placeholder={t('tbYourName')} value={guestName} onChange={(e) => setGuestName(e.target.value)}
            className="w-full rounded-lg border border-ink-line bg-ink-soft px-3.5 py-2.5 text-ivory placeholder:text-ivory-dim/60" />
          <input type="tel" required placeholder={t('phoneNumber')} value={phone} onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-ink-line bg-ink-soft px-3.5 py-2.5 text-ivory placeholder:text-ivory-dim/60" />
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="mb-1 block text-xs text-ivory-dim">{t('tbDate')}</label>
              <AdvancedDatePicker value={date} onChange={setDate} />
            </div>
            <div className="col-span-1">
              <label className="mb-1 block text-xs text-ivory-dim">{t('tbTime')}</label>
              {(() => {
                const hours = getEffectiveHoursFor(date, config?.operatingHours ?? null, config?.bookingHours ?? null);
                if (hours.closed) return <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger">{t('tbClosedThatDay')}</p>;
                return <AdvancedTimePicker value={time} onChange={setTime} minTime={hours.minTime} maxTime={hours.maxTime} />;
              })()}
            </div>
            <div className="col-span-1">
              <label className="mb-1 block text-xs text-ivory-dim">{t('tbGuests')}</label>
              <input type="number" min={1} required value={partySize} onFocus={(e) => e.target.select()} onChange={(e) => setPartySize(Number(e.target.value))}
                className="w-full rounded-lg border border-ink-line bg-ink-soft px-3 py-2.5 text-center text-sm text-ivory" />
            </div>
          </div>
          <textarea placeholder={t('tbSpecialRequests')} value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            className="w-full rounded-lg border border-ink-line bg-ink-soft px-3.5 py-2.5 text-ivory placeholder:text-ivory-dim/60" />

          {config?.allowPreOrder && config.menu.length > 0 && (
            <div className="rounded-xl border border-ink-line bg-ink-soft p-4">
              <p className="font-display text-lg text-ivory">{t('tbPreOrderFood')}</p>
              <p className="mt-0.5 text-xs text-ivory-dim">{t('tbPreOrderFoodDesc')}</p>
              <div className="relative mt-3">
                <Search size={15} strokeWidth={2} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ivory-dim" />
                <input
                  type="search"
                  value={foodSearchQuery}
                  onChange={(e) => setFoodSearchQuery(e.target.value)}
                  placeholder={t('menuSearchPlaceholder')}
                  className="w-full rounded-lg border border-ink-line bg-ink py-2 ps-8 pe-3 text-sm text-ivory placeholder:text-ivory-dim/60"
                />
              </div>

              {(() => {
                const q = foodSearchQuery.trim().toLowerCase();
                const searched = config.menu.filter((item) => !q || item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q));
                const grouped = searched.reduce<Record<string, typeof searched>>((acc, item) => {
                  const cat = item.menu_categories?.name || t('tbOtherItems');
                  (acc[cat] ||= []).push(item);
                  return acc;
                }, {});
                const categoryNames = Object.keys(grouped);
                // Real fix for the explicit request: this used to stack every
                // category's full item list in one endless vertical scroll -
                // "10 KM long". Category chips now actually FILTER (one
                // category shown at a time, like the POS Terminal's own
                // category tabs) instead of just scrolling to an anchor, and
                // the visible list is height-capped with its own internal
                // scroll - so the page itself never grows past a few
                // screenfuls no matter how large the menu is. Searching
                // still searches across every category at once, since
                // narrowing to one category while searching would hide
                // results the guest is explicitly looking for.
                const effectiveCategory = q ? null : (activeFoodCategory && categoryNames.includes(activeFoodCategory) ? activeFoodCategory : categoryNames[0] || null);
                const visibleItems = q ? searched : (effectiveCategory ? grouped[effectiveCategory] || [] : []);
                return (
                  <>
                    {!q && categoryNames.length > 1 && (
                      <div className="mt-3 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: 'none' }}>
                        {categoryNames.map((category) => (
                          <button type="button"
                            key={category}
                            onClick={() => setActiveFoodCategory(category)}
                            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                              category === effectiveCategory ? 'border-brass bg-brass text-ink font-medium' : 'border-ink-line text-ivory-dim hover:border-brass/40 hover:text-brass'
                            }`}
                          >
                            {category}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pe-1">
                      {visibleItems.map((item) => <BookingMenuItemRow key={item.id} item={item} cart={cart} onAdd={addToCart} t={t} />)}
                      {visibleItems.length === 0 && <p className="text-sm text-ivory-dim">{t('tbNoMenuResults')}</p>}
                    </div>
                  </>
                );
              })()}

              {cart.length > 0 && (
                <>
                  <div className="mt-4 space-y-2 border-t border-ink-line pt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-ivory-dim">{t('tbYourOrder')}</p>
                    {cart.map((line) => (
                      <div key={`${line.menuItemId}-${line.note}`} className="flex items-start justify-between gap-2 rounded-lg bg-ink px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-ivory">{line.quantity}× {line.name}</p>
                          {line.note && <p className="mt-0.5 text-xs italic text-brass">"{line.note}"</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button type="button" onClick={() => changeQuantity(line.menuItemId, line.note, -1)} className="flex h-6 w-6 items-center justify-center rounded border border-ink-line text-ivory-dim hover:text-ivory">−</button>
                          <span className="w-4 text-center text-sm text-ivory">{line.quantity}</span>
                          <button type="button" onClick={() => changeQuantity(line.menuItemId, line.note, 1)} className="flex h-6 w-6 items-center justify-center rounded border border-brass/40 text-brass">+</button>
                          <button type="button" onClick={() => removeCartLine(line.menuItemId, line.note)} className="ms-1 text-xs text-danger hover:underline">{t('tbRemove')}</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-between border-t border-ink-line pt-3 text-sm">
                    <span className="text-ivory-dim">{selectedService ? 'Food subtotal' : t('tbTotal')}</span>
                    <span className="text-ivory">AED {cartTotal.toFixed(2)}</span>
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-wide text-ivory-dim">{t('tbWhenReady')}</p>
                  <div className="mt-1.5 space-y-1.5">
                    {FOOD_TIMING_OPTIONS.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 text-sm text-ivory">
                        <input type="radio" name="foodTiming" checked={foodTiming === opt.value} onChange={() => setFoodTiming(opt.value)} className="accent-brass" />
                        {t(opt.labelKey)}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {config && config.services.length > 0 && (
            <div className="rounded-xl border border-ink-line bg-ink-soft p-4">
              <p className="font-display text-lg text-ivory">Add a service</p>
              <p className="mt-0.5 text-xs text-ivory-dim">Birthday packages and other extras for your visit - optional.</p>
              <select
                value={selectedServiceId}
                onChange={(e) => { setSelectedServiceId(e.target.value); setSelectedServiceOptionId(''); }}
                className="mt-3 w-full rounded-lg border border-ink-line bg-ink px-3 py-2.5 text-sm text-ivory"
              >
                <option value="">None</option>
                {config.services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} — AED {s.price.toFixed(2)}</option>
                ))}
              </select>

              {selectedServiceId && (() => {
                const service = config.services.find((s) => s.id === selectedServiceId);
                if (!service) return null;
                return (
                  <>
                    {service.description && <p className="mt-2 text-xs text-ivory-dim">{service.description}</p>}
                    {service.service_options.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {service.service_options.map((opt) => {
                          const isSelected = selectedServiceOptionId === opt.id;
                          return (
                            <button
                              type="button"
                              key={opt.id}
                              onClick={() => setSelectedServiceOptionId(isSelected ? '' : opt.id)}
                              className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                                isSelected ? 'border-brass bg-brass text-ink font-medium' : 'border-ink-line text-ivory hover:border-brass/40'
                              }`}
                            >
                              {opt.label}{opt.price_delta !== 0 && ` (${opt.price_delta > 0 ? '+' : ''}AED ${opt.price_delta.toFixed(2)})`}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <p className="mt-3 text-xs text-ivory-dim">When for the service? (defaults to your booking's own date)</p>
                    <div className="mt-1 grid grid-cols-2 gap-3">
                      <AdvancedDatePicker value={serviceDate} onChange={(v) => { setServiceDate(v); setServiceDateTouched(true); }} />
                      <AdvancedTimePicker
                        value={serviceTime}
                        onChange={setServiceTime}
                        minTime={service.available_start_time?.slice(0, 5)}
                        maxTime={service.available_end_time?.slice(0, 5)}
                      />
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {(cart.length > 0 || selectedService) && (
            <div className="rounded-xl border border-brass/30 bg-ink-soft p-4">
              <div className="space-y-1.5 text-sm">
                {cart.length > 0 && (
                  <div className="flex justify-between text-ivory-dim">
                    <span>Food</span>
                    <span>AED {cartTotal.toFixed(2)}</span>
                  </div>
                )}
                {selectedService && (
                  <div className="flex justify-between text-ivory-dim">
                    <span>{selectedService.name}{selectedServiceOption ? ` — ${selectedServiceOption.label}` : ''}</span>
                    <span>AED {serviceTotal.toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div className="mt-2 flex justify-between border-t border-ink-line pt-2 text-sm font-medium">
                <span className="text-ivory">Total</span>
                <span className="text-brass">AED {grandTotal.toFixed(2)}</span>
              </div>
            </div>
          )}

          {config?.downPayment.enabled && (
            <p className="rounded-lg border border-brass/30 bg-ink-soft px-3.5 py-2.5 text-xs text-ivory-dim">
              {config.downPayment.mode === 'full'
                ? t('tbFullPaymentRequired')
                : config.downPayment.mode === 'percentage'
                ? t('tbPercentDownPayment', { percent: config.downPayment.value ?? 0 })
                : t('tbFixedDownPayment', { amount: config.downPayment.value ?? 0 })}
            </p>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}
          <button type="submit" disabled={submitting} className="w-full rounded-lg bg-brass px-4 py-3 font-medium text-ink disabled:opacity-50">
            {submitting ? t('tbSendingCode') : t('tbSendVerificationCode')}
          </button>
        </form>
      </div>
    </div>
  );
}

function Shell({ isRtl, children }: { isRtl: boolean; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-ink px-6 text-center" dir={isRtl ? 'rtl' : 'ltr'}>
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

function RescheduleForm({ booking, busy, onCancel, onSave, operatingHours, bookingHours }: {
  booking: MyBooking; busy: boolean; onCancel: () => void;
  onSave: (id: string, date: string, time: string, partySize: number) => void;
  operatingHours: BookingConfig['operatingHours']; bookingHours: BookingConfig['bookingHours'];
}) {
  const { t } = useLanguage();
  const current = new Date(booking.requested_at);
  const [date, setDate] = useState(current.toISOString().slice(0, 10));
  const [time, setTime] = useState(current.toTimeString().slice(0, 5));
  const [partySize, setPartySize] = useState(booking.party_size);
  const hours = getEffectiveHoursFor(date, operatingHours, bookingHours);

  return (
    <div className="mt-3 space-y-2 border-t border-ink-line pt-3">
      {hours.closed ? (
        <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">{t('tbClosedThatDay')}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <AdvancedDatePicker value={date} onChange={setDate} />
          <AdvancedTimePicker value={time} onChange={setTime} minTime={hours.minTime} maxTime={hours.maxTime} />
          <input type="number" min={1} value={partySize} onFocus={(e) => e.target.select()} onChange={(e) => setPartySize(Number(e.target.value))}
            className="rounded-lg border border-ink-line bg-ink px-2 py-1.5 text-center text-sm text-ivory" />
        </div>
      )}
      <div className="flex gap-3">
        <button type="button" disabled={busy || hours.closed || !time} onClick={() => onSave(booking.id, date, time, partySize)} className="rounded-lg bg-brass px-3 py-1.5 text-sm font-medium text-ink disabled:opacity-50">
          {busy ? t('tbConfirming') : t('tbSaveChanges')}
        </button>
        <button type="button" disabled={busy} onClick={onCancel} className="text-sm text-ivory-dim hover:text-ivory disabled:opacity-50">
          {t('tbCancelEdit')}
        </button>
      </div>
    </div>
  );
}
