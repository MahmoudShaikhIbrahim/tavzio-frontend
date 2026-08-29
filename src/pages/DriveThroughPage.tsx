import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Search, UtensilsCrossed } from 'lucide-react';
import {
  getBookingConfig, requestBookingOtp, verifyBookingOtp,
  createDriveThroughOrder, confirmDriveThroughPayment, type BookingConfig,
} from '../lib/api';
import type { Receipt } from '../types';
import { LanguageProvider, useLanguage } from '../lib/i18n/LanguageContext';
import { BookingMenuItemRow } from './BookingPage';

type Step = 'loading' | 'notAvailable' | 'form' | 'otp' | 'submitting' | 'confirmingPayment' | 'confirmed' | 'failed';

interface CartLine { menuItemId: string; name: string; price: number; quantity: number; note: string }

const ARRIVAL_OPTIONS = [5, 10, 15, 20, 25, 30];

export default function DriveThroughPage() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return null;
  return (
    <LanguageProvider slug={slug}>
      <DriveThroughContent slug={slug} />
    </LanguageProvider>
  );
}

function DriveThroughContent({ slug }: { slug: string }) {
  const { isRtl, t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [config, setConfig] = useState<BookingConfig | null>(null);
  const [step, setStep] = useState<Step>('loading');
  const [error, setError] = useState('');

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [foodSearchQuery, setFoodSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [arrivalMinutes, setArrivalMinutes] = useState(10);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmedArrival, setConfirmedArrival] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  useEffect(() => {
    getBookingConfig(slug)
      .then((res) => {
        setConfig(res);
        setStep(res.driveThrough.enabled ? 'form' : 'notAvailable');
      })
      .catch(() => setStep('notAvailable'));
  }, [slug]);

  // Real, explicit case: the customer is landing back here after a
  // redirect-based payment (Telr/N-Genius/Ziina's own hosted page) -
  // same "poll once on return" pattern the table booking and NFC order
  // flows already use, not something new invented for this page.
  const orderPaymentId = searchParams.get('orderPaymentId');
  useEffect(() => {
    if (!orderPaymentId) return;
    setStep('confirmingPayment');
    confirmDriveThroughPayment(orderPaymentId)
      .then((res) => {
        setConfirmedArrival(null); // arrival time isn't known from this response alone; the confirmation screen below just doesn't show a countdown in this specific path
        setReceipt(res.receipt || null);
        setStep('confirmed');
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Payment could not be confirmed');
        setStep('failed');
      });
  }, [orderPaymentId]);

  function addToCart(item: BookingConfig['menu'][number], noteText?: string) {
    setCart((prev) => {
      const existing = prev.find((l) => l.menuItemId === item.id && l.note === (noteText || ''));
      if (existing) return prev.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1, note: noteText || '' }];
    });
  }
  function changeQuantity(menuItemId: string, noteText: string, delta: number) {
    setCart((prev) => prev
      .map((l) => (l.menuItemId === menuItemId && l.note === noteText ? { ...l, quantity: l.quantity + delta } : l))
      .filter((l) => l.quantity > 0));
  }
  function removeCartLine(menuItemId: string, noteText: string) {
    setCart((prev) => prev.filter((l) => !(l.menuItemId === menuItemId && l.note === noteText)));
  }
  const cartTotal = cart.reduce((sum, l) => sum + l.price * l.quantity, 0);

  async function handleSendOtp(e: FormEvent) {
    e.preventDefault();
    if (!phone || cart.length === 0) return;
    setError('');
    setSubmitting(true);
    try {
      await requestBookingOtp(slug, phone);
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
      const result = await createDriveThroughOrder(slug, {
        phone,
        items: cart.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity, note: l.note })),
        arrivalMinutes,
        note,
      });
      if (result.paymentRequired && result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }
      setConfirmedArrival(arrivalMinutes);
      setStep('confirmed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStep('failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'loading' || step === 'confirmingPayment') {
    return <Shell isRtl={isRtl}><p className="text-ivory-dim">{t('tbOnlyTakesAMoment')}</p></Shell>;
  }

  if (step === 'notAvailable') {
    return (
      <Shell isRtl={isRtl}>
        <p className="font-display text-xl text-ivory">{t('dtNotAvailable')}</p>
        <p className="mt-2 text-sm text-ivory-dim">{t('dtNotAvailableDesc')}</p>
      </Shell>
    );
  }

  if (step === 'confirmed') {
    if (receipt) {
      // Real, explicit request: a receipt "everywhere" - identical
      // layout/download pattern to BillPage.tsx's own receipt, since
      // this should read as the same feature, not a lookalike built
      // separately for this one page.
      return (
        <Shell isRtl={isRtl}>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-brass">
              <span className="font-display text-xl text-brass">✓</span>
            </div>
            <p className="font-display text-xl text-ivory">{t('dtOrderConfirmed')}</p>
            {confirmedArrival !== null && <p className="text-sm text-ivory-dim">{t('dtOrderConfirmedDesc', { minutes: confirmedArrival })}</p>}
          </div>

          <div className="mt-6 rounded-xl border border-ink-line bg-ink-soft p-5 font-mono text-xs text-ivory-dim">
            <p className="text-center text-[11px] uppercase tracking-wider text-brass">Receipt</p>
            <p className="mt-1 text-center">{new Date(receipt.paidAt).toLocaleString()}</p>
            <div className="my-3 border-t border-dashed border-ink-line" />
            {receipt.items.map((item, i) => (
              <div key={i} className="mb-1.5">
                <div className="flex justify-between text-ivory">
                  <span>{item.quantity}× {item.name}</span>
                  <span>{item.lineTotal.toFixed(2)}</span>
                </div>
                {item.addons.map((a, ai) => (
                  <div key={ai} className="flex justify-between pl-3 text-[11px]">
                    <span>+ {a.name}</span>
                    <span>{a.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ))}
            <div className="my-3 border-t border-dashed border-ink-line" />
            <div className="flex justify-between"><span>Subtotal (ex VAT)</span><span>{receipt.subtotalExVat.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>VAT ({(receipt.vatRate * 100).toFixed(0)}%)</span><span>{receipt.vatAmount.toFixed(2)}</span></div>
            <div className="my-3 border-t border-dashed border-ink-line" />
            <div className="flex justify-between text-sm text-ivory"><span>Total</span><span>{receipt.total.toFixed(2)} AED</span></div>
          </div>

          <div className="mt-4 print:hidden">
            <button type="button" onClick={() => window.print()} className="w-full rounded-lg border border-brass/40 px-3 py-2.5 text-sm text-brass hover:bg-brass/10">
              Download receipt
            </button>
          </div>
        </Shell>
      );
    }
    return (
      <Shell isRtl={isRtl}>
        <p className="font-display text-xl text-ivory">{t('dtOrderConfirmed')}</p>
        {confirmedArrival !== null && (
          <p className="mt-2 text-sm text-ivory-dim">{t('dtOrderConfirmedDesc', { minutes: confirmedArrival })}</p>
        )}
      </Shell>
    );
  }

  if (step === 'failed') {
    return (
      <Shell isRtl={isRtl}>
        <p className="font-display text-xl text-ivory">{t('dtOrderFailed')}</p>
        <p className="mt-2 text-sm text-ivory-dim">{error || t('dtOrderFailedDesc')}</p>
        <button type="button" onClick={() => setStep('form')} className="mt-4 rounded-lg border border-brass/40 px-4 py-2 text-sm text-brass hover:bg-brass/10">
          {t('tbTryAgain')}
        </button>
      </Shell>
    );
  }

  if (step === 'otp') {
    return (
      <Shell isRtl={isRtl}>
        <h1 className="font-display text-2xl text-ivory">{t('tbVerifyNumber')}</h1>
        <p className="mt-1 text-sm text-ivory-dim">{t('tbCodeSentTo', { phone })}</p>
        <form onSubmit={handleVerifyAndSubmit} className="mt-6 space-y-3">
          <input
            value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" placeholder={t('tbEnterCode')} maxLength={6}
            className="w-full rounded-lg border border-ink-line bg-ink-soft px-4 py-3 text-center text-lg tracking-widest text-ivory placeholder:text-ivory-dim/60"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <button type="submit" disabled={submitting || !otp} className="w-full rounded-lg bg-brass px-4 py-3 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
            {submitting ? t('tbConfirming') : t('dtPlaceOrder')}
          </button>
          <button type="button" onClick={() => requestBookingOtp(slug, phone)} className="w-full text-center text-sm text-ivory-dim hover:text-ivory">
            {t('tbResendCode')}
          </button>
        </form>
      </Shell>
    );
  }

  // step === 'form'
  const q = foodSearchQuery.trim().toLowerCase();
  const menu = config?.menu || [];
  const searched = menu.filter((item) => !q || item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q));
  const grouped = searched.reduce<Record<string, typeof searched>>((acc, item) => {
    const cat = item.menu_categories?.name || t('tbOtherItems');
    (acc[cat] ||= []).push(item);
    return acc;
  }, {});
  const categoryNames = Object.keys(grouped);
  const effectiveCategory = q ? null : (activeCategory && categoryNames.includes(activeCategory) ? activeCategory : categoryNames[0] || null);
  const visibleItems = q ? searched : (effectiveCategory ? grouped[effectiveCategory] || [] : []);

  return (
    <Shell isRtl={isRtl}>
      <h1 className="font-display text-2xl text-ivory">{t('dtHeading')}</h1>
      <p className="mt-1 text-sm text-ivory-dim">{t('dtSubtitle')}</p>

      <div className="relative mt-5">
        <Search size={15} strokeWidth={2} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ivory-dim" />
        <input
          type="search" value={foodSearchQuery} onChange={(e) => setFoodSearchQuery(e.target.value)}
          placeholder={t('menuSearchPlaceholder')}
          className="w-full rounded-lg border border-ink-line bg-ink-soft py-2 ps-8 pe-3 text-sm text-ivory placeholder:text-ivory-dim/60"
        />
      </div>

      {!q && categoryNames.length > 1 && (
        <div className="mt-3 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: 'none' }}>
          {categoryNames.map((category) => (
            <button type="button" key={category} onClick={() => setActiveCategory(category)}
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
        {visibleItems.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-ivory-dim">
            <UtensilsCrossed size={22} strokeWidth={1.5} />
            <p className="mt-2 text-sm">{t('tbNoMenuResults')}</p>
          </div>
        ) : (
          visibleItems.map((item) => <BookingMenuItemRow key={item.id} item={item} cart={cart} onAdd={addToCart} t={t} />)
        )}
      </div>

      {cart.length > 0 && (
        <>
          <div className="mt-4 space-y-2 border-t border-ink-line pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-ivory-dim">{t('tbYourOrder')}</p>
            {cart.map((line) => (
              <div key={`${line.menuItemId}-${line.note}`} className="flex items-start justify-between gap-2 rounded-lg bg-ink-soft px-3 py-2">
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
            <span className="text-ivory-dim">{t('tbTotal')}</span>
            <span className="text-ivory">AED {cartTotal.toFixed(2)}</span>
          </div>

          <p className="mt-4 text-xs uppercase tracking-wide text-ivory-dim">{t('dtArrivalPrompt')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {ARRIVAL_OPTIONS.map((m) => (
              <button type="button" key={m} onClick={() => setArrivalMinutes(m)}
                className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                  m === arrivalMinutes ? 'border-brass bg-brass text-ink font-medium' : 'border-ink-line text-ivory-dim hover:border-brass/40 hover:text-brass'
                }`}
              >
                {t('dtArrivalMinutes', { minutes: m })}
              </button>
            ))}
          </div>

          {config?.driveThrough.downPayment.enabled && (
            <p className="mt-4 rounded-lg border border-brass/30 bg-brass/5 px-3 py-2 text-sm text-brass">
              {config.driveThrough.downPayment.mode === 'full'
                ? t('tbFullPaymentRequired')
                : config.driveThrough.downPayment.mode === 'percentage'
                ? t('tbPercentDownPayment', { percent: config.driveThrough.downPayment.value || 0 })
                : t('tbFixedDownPayment', { amount: config.driveThrough.downPayment.value || 0 })}
            </p>
          )}

          <textarea
            placeholder={t('tbSpecialRequests')} value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            className="mt-4 w-full rounded-lg border border-ink-line bg-ink-soft px-3.5 py-2.5 text-ivory placeholder:text-ivory-dim/60"
          />

          <form onSubmit={handleSendOtp} className="mt-4 space-y-3">
            <input
              value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder={t('phoneForConfirm')}
              className="w-full rounded-lg border border-ink-line bg-ink-soft px-4 py-3 text-ivory placeholder:text-ivory-dim/60"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <button type="submit" disabled={submitting || !phone} className="w-full rounded-lg bg-brass px-4 py-3 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
              {submitting ? t('tbSendingCode') : t('tbSendVerificationCode')}
            </button>
          </form>
        </>
      )}

      <Link to={`/${slug}/book`} className="mt-6 block text-center text-sm text-ivory-dim hover:text-ivory">{t('back')}</Link>
    </Shell>
  );
}

function Shell({ isRtl, children }: { isRtl: boolean; children: React.ReactNode }) {
  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen bg-ink px-5 py-10">
      <div className="mx-auto max-w-lg">{children}</div>
    </div>
  );
}
