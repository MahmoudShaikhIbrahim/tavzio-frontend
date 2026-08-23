import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  getBookingConfig, requestBookingOtp, verifyBookingOtp, submitPublicBooking,
  getBookingPaymentStatus, getBusiness, type BookingConfig,
} from '../lib/api';
import { buildBusinessThemeVars } from '../lib/businessTheme';
import type { Business } from '../types';
import { LanguageProvider, useLanguage } from '../lib/i18n/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

// Real replacement for the old service-appointment booking flow (see
// lib/api.ts's comment) - a genuinely different product now: a table
// reservation, optionally with a food pre-order and a down payment,
// gated behind phone OTP verification. English-only content
// throughout (not run through the existing t() translation system) -
// translating this properly into all 9 languages is real,
// substantial work on its own and shouldn't be faked with missing-key
// placeholders; RTL layout direction from the existing language
// context is still respected either way.
const FOOD_TIMING_OPTIONS = [
  { value: 0, label: 'Ready when we arrive' },
  { value: 5, label: 'Ready 5 minutes after we sit down' },
  { value: 10, label: 'Ready 10 minutes after we sit down' },
  { value: 15, label: 'Ready 15 minutes after we sit down' },
];

type Step = 'loading' | 'notAvailable' | 'form' | 'otp' | 'submitting' | 'confirmed' | 'paymentPending' | 'paymentFailed';

interface CartLine { menuItemId: string; name: string; price: number; quantity: number }

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
  const { isRtl } = useLanguage();
  const navigate = useNavigate();
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
  const [note, setNote] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [foodTiming, setFoodTiming] = useState(0);
  const [otp, setOtp] = useState('');
  const [, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [, setBookingId] = useState<string | null>(null);

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

  const themeStyle = buildBusinessThemeVars(business?.theme?.customerBackground, business?.theme?.customerButton);

  if (step === 'loading') return <LoadingShell />;

  if (step === 'notAvailable') {
    return (
      <Shell isRtl={isRtl}>
        <p className="font-display text-xl text-ivory">Online booking isn't available</p>
        <p className="text-sm text-ivory-dim">This business hasn't turned on online booking yet.</p>
      </Shell>
    );
  }

  if (step === 'paymentPending') {
    return (
      <Shell isRtl={isRtl}>
        <div className="h-10 w-10 animate-pulse rounded-full border-2 border-brass/40" />
        <p className="font-display text-xl text-ivory">Confirming your payment...</p>
        <p className="text-sm text-ivory-dim">This only takes a moment.</p>
      </Shell>
    );
  }

  if (step === 'paymentFailed') {
    return (
      <Shell isRtl={isRtl}>
        <p className="font-display text-xl text-ivory">Payment didn't go through</p>
        <p className="text-sm text-ivory-dim">Your table wasn't reserved. Please try booking again.</p>
        <button type="button" onClick={() => window.location.href = `/${slug}/book`} className="mt-4 rounded-lg border border-brass/40 px-4 py-2 text-sm text-brass hover:bg-brass/10">
          Try again
        </button>
      </Shell>
    );
  }

  if (step === 'confirmed') {
    return (
      <Shell isRtl={isRtl}>
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-brass">
          <span className="font-display text-2xl text-brass">✓</span>
        </div>
        <p className="font-display text-xl text-ivory">Booking request sent</p>
        <p className="max-w-xs text-sm text-ivory-dim">
          {config?.businessName} will confirm your table shortly.
          {cart.length > 0 && ' Your food order is noted and will be ready as you chose.'}
        </p>
        <div className="mt-3 rounded-lg border border-brass/30 bg-ink-soft px-4 py-3 text-sm text-ivory-dim">
          One more thing - please tap your phone on the table's Tavzio stand once you sit down, to confirm you've arrived.
        </div>
        <button type="button" onClick={() => navigate(`/${slug}`)} className="mt-4 rounded-lg border border-brass/40 px-4 py-2 text-sm text-brass hover:bg-brass/10">
          Back to {slug}
        </button>
      </Shell>
    );
  }

  if (step === 'otp') {
    return (
      <div className="min-h-screen bg-ink" dir={isRtl ? 'rtl' : 'ltr'} style={themeStyle}>
        <div className="mx-auto max-w-md px-6 pt-14 pb-16">
          <button type="button" onClick={() => setStep('form')} className="text-sm text-ivory-dim hover:text-ivory">{isRtl ? '→' : '←'} Back</button>
          <h1 className="mt-3 font-display text-2xl text-ivory">Verify your number</h1>
          <p className="mt-1 text-sm text-ivory-dim">We sent a 6-digit code to {phone}.</p>
          <form onSubmit={handleVerifyAndSubmit} className="mt-6 space-y-3">
            <input
              type="text" inputMode="numeric" maxLength={6} required placeholder="Enter code"
              autoComplete="one-time-code"
              value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              className="w-full rounded-lg border border-ink-line bg-ink-soft px-3.5 py-3 text-center text-2xl tracking-[0.3em] text-ivory placeholder:text-base placeholder:tracking-normal placeholder:text-ivory-dim/60"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <button type="submit" disabled={submitting} className="w-full rounded-lg bg-brass px-4 py-3 font-medium text-ink disabled:opacity-50">
              {submitting ? 'Confirming...' : 'Confirm booking'}
            </button>
            <button
              type="button"
              onClick={async () => { setError(''); try { await requestBookingOtp(slug, phone); } catch { /* silent */ } }}
              className="w-full text-center text-sm text-ivory-dim hover:text-ivory"
            >
              Resend code
            </button>
          </form>
        </div>
      </div>
    );
  }

  // step === 'form'
  return (
    <div className="min-h-screen bg-ink" dir={isRtl ? 'rtl' : 'ltr'} style={themeStyle}>
      <div className="mx-auto max-w-md px-6 pt-14 pb-16">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl text-ivory">Book a table</h1>
          <LanguageSwitcher />
        </div>
        {config?.businessName && <p className="mt-1 text-sm text-brass">{config.businessName}</p>}

        <form onSubmit={handleSendOtp} className="mt-6 space-y-3">
          <input type="text" required placeholder="Your name" value={guestName} onChange={(e) => setGuestName(e.target.value)}
            className="w-full rounded-lg border border-ink-line bg-ink-soft px-3.5 py-2.5 text-ivory placeholder:text-ivory-dim/60" />
          <input type="tel" required placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-ink-line bg-ink-soft px-3.5 py-2.5 text-ivory placeholder:text-ivory-dim/60" />
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="mb-1 block text-xs text-ivory-dim">Date</label>
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-ink-line bg-ink-soft px-3 py-2.5 text-sm text-ivory [color-scheme:dark]" />
            </div>
            <div className="col-span-1">
              <label className="mb-1 block text-xs text-ivory-dim">Time</label>
              <input type="time" required value={time} onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-lg border border-ink-line bg-ink-soft px-3 py-2.5 text-sm text-ivory [color-scheme:dark]" />
            </div>
            <div className="col-span-1">
              <label className="mb-1 block text-xs text-ivory-dim">Guests</label>
              <input type="number" min={1} required value={partySize} onFocus={(e) => e.target.select()} onChange={(e) => setPartySize(Number(e.target.value))}
                className="w-full rounded-lg border border-ink-line bg-ink-soft px-3 py-2.5 text-center text-sm text-ivory" />
            </div>
          </div>
          <textarea placeholder="Any special requests? (optional)" value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            className="w-full rounded-lg border border-ink-line bg-ink-soft px-3.5 py-2.5 text-ivory placeholder:text-ivory-dim/60" />

          {config?.allowPreOrder && config.menu.length > 0 && (
            <div className="rounded-xl border border-ink-line bg-ink-soft p-4">
              <p className="font-display text-lg text-ivory">Pre-order food (optional)</p>
              <p className="mt-0.5 text-xs text-ivory-dim">Have it ready without ordering from scratch when you arrive.</p>
              <div className="mt-3 space-y-2">
                {config.menu.map((item) => {
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
                        <button type="button" onClick={() => addToCart(item)} className="shrink-0 rounded-lg border border-brass/40 px-3 py-1.5 text-xs text-brass hover:bg-brass/10">Add</button>
                      )}
                    </div>
                  );
                })}
              </div>
              {cart.length > 0 && (
                <>
                  <div className="mt-3 flex justify-between border-t border-ink-line pt-3 text-sm">
                    <span className="text-ivory-dim">Total</span>
                    <span className="text-ivory">AED {cartTotal.toFixed(2)}</span>
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-wide text-ivory-dim">When should it be ready?</p>
                  <div className="mt-1.5 space-y-1.5">
                    {FOOD_TIMING_OPTIONS.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 text-sm text-ivory">
                        <input type="radio" name="foodTiming" checked={foodTiming === opt.value} onChange={() => setFoodTiming(opt.value)} className="accent-brass" />
                        {opt.label}
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
                ? 'Full payment is required to confirm this booking.'
                : config.downPayment.mode === 'percentage'
                ? `A ${config.downPayment.value}% down payment is required to confirm this booking.`
                : `A AED ${config.downPayment.value} down payment is required to confirm this booking.`}
            </p>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}
          <button type="submit" disabled={submitting} className="w-full rounded-lg bg-brass px-4 py-3 font-medium text-ink disabled:opacity-50">
            {submitting ? 'Sending code...' : 'Send verification code'}
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
