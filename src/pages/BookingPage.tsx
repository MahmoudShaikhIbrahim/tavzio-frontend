import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import {
  getBookingConfig, requestBookingOtp, verifyBookingOtp, submitPublicBooking, cancelPublicBooking,
  listMyBookings, reschedulePublicBooking, type MyBooking,
  getBookingPaymentStatus, getBusiness, type BookingConfig,
} from '../lib/api';
import { buildBusinessThemeVars } from '../lib/businessTheme';
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

interface CartLine { menuItemId: string; name: string; price: number; quantity: number }

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
function DatePickerField({ value, onChange, placeholder, type }: {
  value: string; onChange: (v: string) => void; placeholder: string; type: 'date' | 'time';
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const el = inputRef.current;
    if (!el) return;
    if ('showPicker' in el && typeof el.showPicker === 'function') {
      try { el.showPicker(); return; } catch { /* fall through to focus() below */ }
    }
    el.focus();
  }

  function formatDisplay() {
    if (!value) return placeholder;
    if (type === 'date') {
      const d = new Date(`${value}T00:00:00`);
      return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    }
    const [h, m] = value.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openPicker}
        className={`w-full truncate rounded-lg border border-ink-line bg-ink-soft px-3 py-2.5 text-start text-sm ${value ? 'text-ivory' : 'text-ivory-dim/70'}`}
      >
        {formatDisplay()}
      </button>
      <input
        ref={inputRef}
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full opacity-0"
        tabIndex={-1}
      />
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
  const [note, setNote] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [foodTiming, setFoodTiming] = useState(0);
  const [otp, setOtp] = useState('');
  const [, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
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

  function addToCart(item: BookingConfig['menu'][number]) {
    setCart((prev) => {
      const existing = prev.find((l) => l.menuItemId === item.id);
      if (existing) return prev.map((l) => (l.menuItemId === item.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  }
  function changeQuantity(menuItemId: string, delta: number) {
    setCart((prev) => prev
      .map((l) => (l.menuItemId === menuItemId ? { ...l, quantity: l.quantity + delta } : l))
      .filter((l) => l.quantity > 0));
  }
  const cartTotal = cart.reduce((sum, l) => sum + l.price * l.quantity, 0);

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
    setError('');
    setSubmitting(true);
    try {
      await verifyBookingOtp(slug, phone, otp);

      const requestedAt = new Date(`${date}T${time}`).toISOString();
      const result = await submitPublicBooking(slug, {
        phone, guestName, partySize, requestedAt, note,
        items: config?.allowPreOrder && cart.length > 0 ? cart.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity })) : undefined,
        foodReadyOffsetMinutes: config?.allowPreOrder && cart.length > 0 ? foodTiming : undefined,
      });

      setBookingId(result.booking.id);
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

  async function handleCancelBooking() {
    if (!bookingId) return;
    setCancelling(true);
    try {
      await cancelPublicBooking(bookingId, phone);
      setCancelled(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel this booking');
    } finally {
      setCancelling(false);
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
    if (cancelled) {
      return (
        <Shell isRtl={isRtl}>
          <p className="font-display text-xl text-ivory">{t('tbBookingCancelled')}</p>
          <p className="max-w-xs text-sm text-ivory-dim">{t('tbBookingCancelledDesc')}</p>
        </Shell>
      );
    }
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
        {bookingId && (
          <button type="button" disabled={cancelling} onClick={handleCancelBooking}
            className="mt-4 rounded-lg border border-danger/40 px-4 py-2 text-sm text-danger hover:bg-danger/10 disabled:opacity-50">
            {cancelling ? t('tbCancelling') : t('tbCancelBooking')}
          </button>
        )}
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
                {rescheduling === b.id ? (
                  <RescheduleForm booking={b} busy={manageBusy} onCancel={() => setRescheduling(null)} onSave={handleReschedule} />
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
              <DatePickerField value={date} onChange={setDate} placeholder={t('tbSelectDate')} type="date" />
            </div>
            <div className="col-span-1">
              <label className="mb-1 block text-xs text-ivory-dim">{t('tbTime')}</label>
              <DatePickerField value={time} onChange={setTime} placeholder={t('tbSelectTime')} type="time" />
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
              <div className="mt-3 space-y-2">
                {config.menu
                  .filter((item) => {
                    const q = foodSearchQuery.trim().toLowerCase();
                    if (!q) return true;
                    return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
                  })
                  .map((item) => {
                  const line = cart.find((l) => l.menuItemId === item.id);
                  return (
                    <div key={item.id} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-ivory">{item.name}</p>
                        <p className="text-xs text-ivory-dim">AED {item.price.toFixed(2)}</p>
                      </div>
                      {line ? (
                        <div className="flex shrink-0 items-center gap-2">
                          <button type="button" onClick={() => changeQuantity(item.id, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-ink-line text-ivory-dim hover:text-ivory">−</button>
                          <span className="w-5 text-center text-sm text-ivory">{line.quantity}</span>
                          <button type="button" onClick={() => changeQuantity(item.id, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-ink-line text-ivory-dim hover:text-ivory">+</button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => addToCart(item)} className="shrink-0 rounded-lg border border-brass/40 px-3 py-1.5 text-xs text-brass hover:bg-brass/10">{t('tbAdd')}</button>
                      )}
                    </div>
                  );
                })}
              </div>
              {cart.length > 0 && (
                <>
                  <div className="mt-3 flex justify-between border-t border-ink-line pt-3 text-sm">
                    <span className="text-ivory-dim">{t('tbTotal')}</span>
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

function RescheduleForm({ booking, busy, onCancel, onSave }: {
  booking: MyBooking; busy: boolean; onCancel: () => void;
  onSave: (id: string, date: string, time: string, partySize: number) => void;
}) {
  const { t } = useLanguage();
  const current = new Date(booking.requested_at);
  const [date, setDate] = useState(current.toISOString().slice(0, 10));
  const [time, setTime] = useState(current.toTimeString().slice(0, 5));
  const [partySize, setPartySize] = useState(booking.party_size);

  return (
    <div className="mt-3 space-y-2 border-t border-ink-line pt-3">
      <div className="grid grid-cols-3 gap-2">
        <DatePickerField value={date} onChange={setDate} placeholder="Date" type="date" />
        <DatePickerField value={time} onChange={setTime} placeholder="Time" type="time" />
        <input type="number" min={1} value={partySize} onFocus={(e) => e.target.select()} onChange={(e) => setPartySize(Number(e.target.value))}
          className="rounded-lg border border-ink-line bg-ink px-2 py-1.5 text-center text-sm text-ivory" />
      </div>
      <div className="flex gap-3">
        <button type="button" disabled={busy} onClick={() => onSave(booking.id, date, time, partySize)} className="rounded-lg bg-brass px-3 py-1.5 text-sm font-medium text-ink disabled:opacity-50">
          {busy ? t('tbConfirming') : t('tbSaveChanges')}
        </button>
        <button type="button" disabled={busy} onClick={onCancel} className="text-sm text-ivory-dim hover:text-ivory disabled:opacity-50">
          {t('tbCancelEdit')}
        </button>
      </div>
    </div>
  );
}
