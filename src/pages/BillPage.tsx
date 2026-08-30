import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getBill, payBill, getBusiness, createBillPaySession, confirmBillPayment, cancelBillPaySession, markItemsCashPending } from '../lib/api';
import { buildBusinessThemeVars } from '../lib/businessTheme';
import { subscribeToBillItems } from '../lib/supabaseClient';
import { usePollingFallback } from '../hooks/usePollingFallback';
import { getSavedPhone } from '../lib/loyaltyStorage';
import type { BillItem, Receipt, Business } from '../types';
import { LanguageProvider, useLanguage } from '../lib/i18n/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

const TIP_OPTIONS = [0, 10, 15, 20];

export default function BillPage() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return <LoadingShell />;
  return (
    <LanguageProvider slug={slug}>
      <BillPageContent slug={slug} />
    </LanguageProvider>
  );
}

function BillPageContent({ slug }: { slug: string }) {
  const { t, isRtl } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<BillItem[]>([]);
  const [paidItems, setPaidItems] = useState<BillItem[]>([]);
  const [paidSectionOpen, setPaidSectionOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tipPercent, setTipPercent] = useState(0);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [paid, setPaid] = useState(false);
  // Deliberately separate from 'paid' above, and never reset - 'paid'
  // flips back to false when the person taps "View live bill" to keep
  // browsing, but this stays true for the rest of this tab's session.
  // It's what lets the Paid section correctly show right after YOUR OWN
  // payment, while a genuinely fresh tap (new customer, or the same one
  // tomorrow) with nothing left owing shows a clean "nothing to pay"
  // screen instead of someone else's old paid history.
  const hasPaidThisSessionRef = useRef(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [rewardDescription, setRewardDescription] = useState('');
  const [provider, setProvider] = useState('tap');
  const [business, setBusiness] = useState<Business | null>(null);

  const tapEventId = (() => {
    const stored = sessionStorage.getItem(`tavzio_tap_${slug}`);
    return stored ? Number(stored) : null;
  })();

  // Set the moment a redirect payment is started (see handlePay below),
  // cleared the moment it's resolved one way or another. If it's still
  // here on a fresh page load, the customer left mid-payment (browser
  // back button, closed the tab, changed their mind) without ever
  // reaching the gateway's own return - that's exactly the case with no
  // other way to know the attempt was abandoned.
  const [pendingCancelPaymentId, setPendingCancelPaymentId] = useState<string | null>(
    () => sessionStorage.getItem(`tavzio_pending_payment_${slug}`)
  );
  const [cancellingPending, setCancellingPending] = useState(false);

  async function handleCancelPendingPayment() {
    if (!pendingCancelPaymentId) return;
    setCancellingPending(true);
    try {
      await cancelBillPaySession(slug, pendingCancelPaymentId);
    } catch {
      // Already resolved server-side (paid, or expired) - either way,
      // nothing left for the customer to cancel, so just clear it here too.
    } finally {
      sessionStorage.removeItem(`tavzio_pending_payment_${slug}`);
      setPendingCancelPaymentId(null);
      setCancellingPending(false);
      loadBill();
    }
  }

  // Landing back from a redirect provider's page (Telr / N-Genius): the
  // URL carries the paymentId, and the ONLY thing that decides success is
  // the backend's verification against the provider's own status API.
  const returningPaymentId = searchParams.get('paymentId');
  useEffect(() => {
    if (!returningPaymentId) return;
    // Real fix, part of the same business-id re-keying above: this
    // used to fire the instant the page mounted, which could genuinely
    // run before the business fetch below had resolved - reading
    // getSavedPhone(business.id) at that moment would silently find
    // nothing, even though a real saved number existed, just because
    // business.id wasn't known yet. Waiting for business to actually
    // be loaded (and re-running once it is, via the dependency below)
    // means this always has the real id in hand before it ever reads
    // or needs it - a fraction-of-a-second wait that's genuinely
    // unnoticeable against a multi-second real redirect round trip to
    // an external payment gateway and back.
    if (!business) return;
    // The gateway itself has now resolved this one way or another -
    // it's no longer an abandoned attempt, whatever confirmBillPayment
    // below finds out.
    sessionStorage.removeItem(`tavzio_pending_payment_${slug}`);
    setPendingCancelPaymentId(null);
    setLoading(true);
    const savedPhone = getSavedPhone(business.id) || undefined;
    confirmBillPayment(slug, returningPaymentId, savedPhone)
      .then((res) => {
        if (res.status === 'completed') {
          setReceipt(res.receipt || null);
          setPaid(true);
          hasPaidThisSessionRef.current = true;
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Payment was not completed'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returningPaymentId, business]);

  useEffect(() => {
    getBusiness(slug).then((b) => { setProvider(b.paymentProvider || 'tap'); setBusiness(b); }).catch(() => {});
  }, [slug]);

  function loadBill() {
    if (!tapEventId || !business) return;
    const savedPhone = getSavedPhone(business.id) || undefined;
    getBill(slug, tapEventId, savedPhone)
      .then((res) => {
        setItems(res.items);
        setPaidItems(res.paidItems || []);
        setDiscountAmount(res.discountAmount || 0);
        setRewardDescription(res.rewardDescription || '');
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }

  useEffect(loadBill, [slug, tapEventId, business]);
  // Explicit, system-wide request, and a real fix for a false claim this
  // comment used to make: there was no actual safety-net timer here at
  // all before now, just this comment describing one that didn't exist.
  // This is a genuine 5-second poll of loadBill(), independent of the
  // realtime subscription below.
  usePollingFallback(loadBill, !!tapEventId);

  // Live updates: any diner's screen reflects payments the moment they
  // happen, elsewhere at the same table - no manual refresh, and no risk
  // of two people both trying to pay for something someone else just
  // settled. The 5-second poll above is the actual fallback for a
  // brand-new order appearing after the initial load (a new order_id the
  // realtime filter wasn't subscribed to yet), or for any missed event.
  useEffect(() => {
    if (!tapEventId || items.length === 0) return;
    const orderIds = Array.from(new Set(items.map((i) => i.order_id)));
    const unsubscribe = subscribeToBillItems(orderIds, (row) => {
      const changed = row as unknown as BillItem;
      if (changed.voided) {
        setItems((prev) => prev.filter((i) => i.id !== changed.id));
        setPaidItems((prev) => prev.filter((i) => i.id !== changed.id));
        setSelected((prev) => {
          if (!prev.has(changed.id)) return prev;
          const next = new Set(prev);
          next.delete(changed.id);
          return next;
        });
        return;
      }
      if (changed.paid) {
        setItems((prev) => prev.filter((i) => i.id !== changed.id));
        setPaidItems((prev) => (prev.some((i) => i.id === changed.id) ? prev : [...prev, changed]));
        setSelected((prev) => {
          if (!prev.has(changed.id)) return prev;
          const next = new Set(prev);
          next.delete(changed.id);
          return next;
        });
      } else {
        // Newly-added item (INSERT) or an unusual re-open case - only
        // add if genuinely new to us, never duplicate.
        setItems((prev) => (prev.some((i) => i.id === changed.id) ? prev : [...prev, changed]));
      }
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tapEventId, items.length > 0]);

  function toggleItem(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Nothing selected means "pay everything" - matches how a real table
  // often works: most people just pay the whole remaining bill, and
  // selecting specific items is only needed when splitting.
  const payingSpecificItems = selected.size > 0;
  const itemsToPay = payingSpecificItems ? items.filter((i) => selected.has(i.id)) : items;
  const rawSubtotal = itemsToPay.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  // The discount preview is computed against the FULL bill server-side -
  // only shown here when paying everything, since prorating it across a
  // partial split isn't meaningful until payment actually happens (the
  // real, final discount is always recomputed correctly server-side at
  // that moment regardless of what's previewed here).
  const previewDiscount = payingSpecificItems ? 0 : discountAmount;
  const subtotal = Math.max(0, rawSubtotal - previewDiscount);
  const tip = Math.round(subtotal * (tipPercent / 100) * 100) / 100;
  const total = subtotal + tip;

  const [markingCash, setMarkingCash] = useState(false);
  const [cashMarkedMessage, setCashMarkedMessage] = useState('');

  async function handleMarkCash() {
    if (!tapEventId || !payingSpecificItems) return;
    setMarkingCash(true);
    setError('');
    try {
      await markItemsCashPending(slug, tapEventId, itemsToPay.map((i) => i.id));
      setCashMarkedMessage('Marked as cash — let your server know when they\'re free.');
      setSelected(new Set());
      loadBill();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark as cash');
    } finally {
      setMarkingCash(false);
    }
  }

  async function handlePay() {
    if (!tapEventId || itemsToPay.length === 0) return;
    setPaying(true);
    setError('');
    try {
      const savedPhone = (business && getSavedPhone(business.id)) || undefined;
      const itemIds = payingSpecificItems ? itemsToPay.map((i) => i.id) : null;

      // Redirect providers (Telr / N-Genius / Ziina): the provider's own
      // hosted page takes the card details - nothing sensitive ever
      // touches Tavzio, and no client-side SDK is needed at all.
      if (provider === 'telr' || provider === 'ngenius' || provider === 'ziina') {
        const session = await createBillPaySession(slug, tapEventId, itemIds, tip, savedPhone);
        // Saved before navigating away - this is what lets the page
        // recognize, if the customer comes back via their browser's own
        // back button instead of the gateway's own return, that there's
        // a still-reserved attempt they might want to give up on.
        sessionStorage.setItem(`tavzio_pending_payment_${slug}`, session.paymentId);
        window.location.href = session.redirectUrl;
        return; // navigating away - the return URL brings them back here
      }

      // =====================================================================
      // TODO — real Apple Pay / Google Pay tokenization goes here (Tap only).
      // =====================================================================
      // Everything above this point (itemized selection, split-payment
      // logic, tip calculation, running total) is complete and correct.
      // This one step - turning a tap of "Pay" into a real `tapToken` - needs
      // Tap Payments' own JS SDK loaded via script tag and initialized
      // against this business's public key, which in turn requires:
      //   1. A real deployed HTTPS domain (Apple Pay's JS API refuses to
      //      initialize on localhost or an unverified domain)
      //   2. The one-time Apple Pay domain verification file hosted at
      //      that domain (see the backend README's payments section)
      // Neither exists yet in local dev, so this can't be fully wired and
      // tested until after deployment. The backend call below
      // (`payBill`) is already real and correct - it's ready the moment a
      // genuine `tapToken` can be produced here instead of this placeholder.
      const tapToken = 'TODO_REPLACE_WITH_REAL_TAP_SDK_TOKEN';
      // =====================================================================

      const res = await payBill(slug, tapEventId, itemIds, tip, tapToken, savedPhone);
      setReceipt(res.receipt);
      setPaid(true);
      hasPaidThisSessionRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setPaying(false);
    }
  }

  if (loading) return <LoadingShell />;
  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-ink px-6 text-center" dir={isRtl ? 'rtl' : 'ltr'}>
        <p className="font-display text-xl text-ivory">{t('payBillNotAvailable')}</p>
        <p className="text-sm text-ivory-dim">{t('payBillNotAvailableDesc')}</p>
      </div>
    );
  }
  if (!tapEventId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-ink px-6 text-center" dir={isRtl ? 'rtl' : 'ltr'}>
        <p className="font-display text-xl text-ivory">{t('payBillNeedsFreshTap')}</p>
        <p className="text-sm text-ivory-dim">{t('payBillNeedsFreshTapDesc')}</p>
      </div>
    );
  }
  // Digital receipt - deliberately English only, per explicit decision,
  // not run through the language switcher, regardless of what language
  // the rest of this page is shown in.

  // Refreshing the return page after a payment was already confirmed:
  // the backend reports completed without re-sending the receipt - a
  // clear success beats falling through to a confusing "Nothing to pay."
  if (paid && !receipt) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink px-8 text-center">
        <p className="font-display text-xl text-ivory">{t('paymentSuccessful')}</p>
      </div>
    );
  }

  if (paid && receipt) {
    return (
      <div className="min-h-screen bg-ink px-6 py-10">
        <div className="mx-auto max-w-sm">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-brass">
              <span className="font-display text-xl text-brass">✓</span>
            </div>
            <p className="font-display text-xl text-ivory">Payment successful</p>
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
            {receipt.discountAmount > 0 && (
              <div className="flex justify-between text-brass"><span>{receipt.rewardDescription || 'Reward'}</span><span>-{receipt.discountAmount.toFixed(2)}</span></div>
            )}
            <div className="flex justify-between"><span>Subtotal (ex VAT)</span><span>{receipt.subtotalExVat.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>VAT ({(receipt.vatRate * 100).toFixed(0)}%)</span><span>{receipt.vatAmount.toFixed(2)}</span></div>
            {receipt.tip > 0 && <div className="flex justify-between"><span>Tip</span><span>{receipt.tip.toFixed(2)}</span></div>}
            <div className="my-3 border-t border-dashed border-ink-line" />
            <div className="flex justify-between text-sm text-ivory"><span>Total</span><span>{receipt.total.toFixed(2)} AED</span></div>
          </div>

          {/* Real fix for the explicit request: nothing here let the
              guest keep a copy of the receipt or leave a review right
              after paying - the exact moment they're most likely to.
              Download uses the browser's native print-to-PDF (no extra
              PDF library needed for a one-page receipt); the review
              button only renders if the business has actually set a
              Google review link on their landing page (same `links`
              config the landing page itself reads from), never a
              guessed/default URL. */}
          <div className="mt-4 grid grid-cols-2 gap-2 print:hidden">
            <button type="button" onClick={() => window.print()} className="rounded-lg border border-brass/40 px-3 py-2.5 text-sm text-brass hover:bg-brass/10">
              Download receipt
            </button>
            {business?.links?.googleReviews?.enabled && business.links.googleReviews.value && (
              <a
                href={business.links.googleReviews.value}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center rounded-lg border border-brass/40 px-3 py-2.5 text-sm text-brass hover:bg-brass/10"
              >
                ★ Leave a review
              </a>
            )}
          </div>

          <button type="button"
            onClick={() => { setPaid(false); setReceipt(null); setSelected(new Set()); setTipPercent(0); loadBill(); }}
            className="mt-3 w-full rounded-lg border border-brass/40 px-4 py-2.5 text-sm text-brass hover:bg-brass/10 print:hidden"
          >
            View live bill
          </button>
          <button type="button" onClick={() => navigate(`/${slug}`)} className="mt-3 w-full rounded-lg border border-ink-line px-4 py-2.5 text-sm text-ivory-dim hover:bg-ink-soft print:hidden">
            {t('backTo', { name: business?.name || slug })}
          </button>
        </div>
      </div>
    );
  }
  if (items.length === 0 && (paidItems.length === 0 || !hasPaidThisSessionRef.current)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-ink px-6 text-center" dir={isRtl ? 'rtl' : 'ltr'}>
        <p className="font-display text-xl text-ivory">{t('nothingToPayHeading')}</p>
        <p className="text-sm text-ivory-dim">{t('nothingToPayDesc')}</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-ink pb-40"
      dir={isRtl ? 'rtl' : 'ltr'}
      style={buildBusinessThemeVars(business?.theme?.customerBackground, business?.theme?.customerButton)}
    >
      <div className="mx-auto max-w-md px-6 pt-14">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl text-ivory">{t('payBill')}</h1>
          <LanguageSwitcher />
        </div>
        <p className="mt-1 text-sm text-ivory-dim">{t('payBillInstructions')}</p>

        {pendingCancelPaymentId && !returningPaymentId && (
          <div className="mt-4 rounded-xl border border-warning/40 bg-ink-soft px-4 py-3">
            <p className="text-sm text-ivory">You started a payment that wasn't finished.</p>
            <p className="mt-0.5 text-xs text-ivory-dim">Those items are held for you for a few minutes - cancel to make them available again, or continue if you're still paying.</p>
            <button
              type="button"
              onClick={handleCancelPendingPayment}
              disabled={cancellingPending}
              className="mt-2 rounded-lg border border-warning/60 px-3 py-1.5 text-xs font-medium text-warning hover:bg-warning/10 disabled:opacity-50"
            >
              {cancellingPending ? 'Cancelling...' : 'Cancel that attempt'}
            </button>
          </div>
        )}

        <div className="mt-5 space-y-3">
          {items.length === 0 && (
            <div className="rounded-xl border border-ink-line bg-ink-soft px-5 py-6 text-center">
              <p className="font-body text-[15px] text-ivory">Everything's been paid</p>
              <p className="mt-1 text-xs text-ivory-dim">Check the Paid section below, or your bill again for a reference.</p>
            </div>
          )}
          {items.map((item) => (
            <button type="button"
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className={`flex w-full items-center justify-between rounded-xl border px-5 py-5 text-start transition-colors ${
                selected.has(item.id) ? 'border-brass bg-brass/10' : 'border-ink-line bg-ink-soft'
              }`}
            >
              <div>
                <p className="font-body text-[15px] font-medium text-ivory">
                  {item.quantity}× {item.item_name}
                  {item.cash_pending && (
                    <span className="ms-2 rounded-full border border-warning/40 px-2 py-0.5 text-[10px] font-normal text-warning">
                      Cash pending
                    </span>
                  )}
                </p>
                {item.note && <p className="mt-0.5 text-xs italic text-ivory-dim">{item.note}</p>}
              </div>
              <span className="shrink-0 ps-3 text-sm text-brass">{(item.unit_price * item.quantity).toFixed(2)}</span>
            </button>
          ))}
        </div>

        {paidItems.length > 0 && (
          <div className="mt-4">
            <button type="button"
              onClick={() => setPaidSectionOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-lg border border-ink-line px-4 py-3 text-sm text-ivory-dim hover:bg-ink-soft"
            >
              <span>Paid ({paidItems.length} item{paidItems.length === 1 ? '' : 's'})</span>
              <span className="text-xs">{paidSectionOpen ? '▲ Hide' : '▼ Show'}</span>
            </button>
            {paidSectionOpen && (
              <div className="mt-2 space-y-2">
                {paidItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl border border-ink-line bg-ink-soft/50 px-5 py-4 opacity-60">
                    <div>
                      <p className="font-body text-[15px] text-ivory line-through">
                        {item.quantity}× {item.item_name}
                      </p>
                      {item.note && <p className="mt-0.5 text-xs italic text-ivory-dim">{item.note}</p>}
                    </div>
                    <span className="shrink-0 ps-3 text-sm text-ivory-dim">{(item.unit_price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {items.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-sm text-ivory-dim">{t('addTip')}</p>
          <div className="flex gap-2">
            {TIP_OPTIONS.map((pct) => (
              <button type="button"
                key={pct}
                onClick={() => setTipPercent(pct)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                  tipPercent === pct ? 'border-brass text-brass' : 'border-ink-line text-ivory-dim'
                }`}
              >
                {pct === 0 ? t('noTip') : `${pct}%`}
              </button>
            ))}
          </div>
        </div>
        )}
      </div>

      {items.length > 0 && (
      <div className="fixed inset-x-0 bottom-0 border-t border-ink-line bg-ink-soft px-5 py-4">
        <div className="mx-auto max-w-md">
          <div className="mb-2 flex justify-between text-sm text-ivory-dim">
            <span>{payingSpecificItems ? t('selectedItems') : t('fullBill')}</span>
            <span>{rawSubtotal.toFixed(2)}</span>
          </div>
          {previewDiscount > 0 && (
            <div className="mb-2 flex justify-between text-sm text-brass">
              <span>{rewardDescription || 'Reward'}</span>
              <span>-{previewDiscount.toFixed(2)}</span>
            </div>
          )}
          {tip > 0 && (
            <div className="mb-2 flex justify-between text-sm text-ivory-dim">
              <span>{t('tip')}</span>
              <span>{tip.toFixed(2)}</span>
            </div>
          )}
          {error && <p className="mb-2 text-sm text-danger">{error}</p>}
          {cashMarkedMessage && <p className="mb-2 text-sm text-warning">{cashMarkedMessage}</p>}
          <button type="button"
            onClick={handlePay}
            disabled={paying}
            className="w-full rounded-lg bg-brass px-4 py-3 font-medium text-ink disabled:opacity-50"
          >
            {paying ? t('processing') : t('payAmount', { amount: total.toFixed(2) })}
          </button>
          {payingSpecificItems && (
            <button type="button"
              onClick={handleMarkCash}
              disabled={markingCash || paying}
              className="mt-2 w-full rounded-lg border border-warning/40 px-4 py-2.5 text-sm text-warning hover:bg-warning/10 disabled:opacity-50"
            >
              {markingCash ? 'Marking…' : 'Pay in cash instead'}
            </button>
          )}
        </div>
      </div>
      )}
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
