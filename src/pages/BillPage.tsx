import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getBill, payBill } from '../lib/api';
import { getSavedPhone } from '../lib/loyaltyStorage';
import type { BillItem, Receipt } from '../types';
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
  const [items, setItems] = useState<BillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tipPercent, setTipPercent] = useState(0);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [paid, setPaid] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [rewardDescription, setRewardDescription] = useState('');

  const tapEventId = (() => {
    const stored = sessionStorage.getItem(`tavzio_tap_${slug}`);
    return stored ? Number(stored) : null;
  })();

  function loadBill() {
    if (!tapEventId) return;
    const savedPhone = getSavedPhone(slug) || undefined;
    getBill(slug, tapEventId, savedPhone)
      .then((res) => {
        setItems(res.items);
        setDiscountAmount(res.discountAmount || 0);
        setRewardDescription(res.rewardDescription || '');
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }

  useEffect(loadBill, [slug, tapEventId]);

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

  async function handlePay() {
    if (!tapEventId || itemsToPay.length === 0) return;
    setPaying(true);
    setError('');
    try {
      // =====================================================================
      // TODO — real Apple Pay / Google Pay tokenization goes here.
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

      const savedPhone = getSavedPhone(slug) || undefined;
      const res = await payBill(slug, tapEventId, payingSpecificItems ? itemsToPay.map((i) => i.id) : null, tip, tapToken, savedPhone);
      setReceipt(res.receipt);
      setPaid(true);
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

          <button onClick={() => navigate(`/${slug}`)} className="mt-6 w-full rounded-lg border border-brass/40 px-4 py-2.5 text-sm text-brass hover:bg-brass/10">
            {t('backTo', { slug })}
          </button>
        </div>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-ink px-6 text-center" dir={isRtl ? 'rtl' : 'ltr'}>
        <p className="font-display text-xl text-ivory">{t('nothingToPayHeading')}</p>
        <p className="text-sm text-ivory-dim">{t('nothingToPayDesc')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink pb-40" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="mx-auto max-w-md px-5 pt-8">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl text-ivory">{t('payBill')}</h1>
          <LanguageSwitcher />
        </div>
        <p className="mt-1 text-sm text-ivory-dim">{t('payBillInstructions')}</p>

        <div className="mt-5 space-y-2">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-start transition-colors ${
                selected.has(item.id) ? 'border-brass bg-brass/10' : 'border-ink-line bg-ink-soft'
              }`}
            >
              <div>
                <p className="font-body text-[15px] font-medium text-ivory">
                  {item.quantity}× {item.item_name}
                </p>
                {item.note && <p className="mt-0.5 text-xs italic text-ivory-dim">{item.note}</p>}
              </div>
              <span className="shrink-0 ps-3 text-sm text-brass">{(item.unit_price * item.quantity).toFixed(2)}</span>
            </button>
          ))}
        </div>

        <div className="mt-6">
          <p className="mb-2 text-sm text-ivory-dim">{t('addTip')}</p>
          <div className="flex gap-2">
            {TIP_OPTIONS.map((pct) => (
              <button
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
      </div>

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
          {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
          <button
            onClick={handlePay}
            disabled={paying}
            className="w-full rounded-lg bg-brass px-4 py-3 font-medium text-ink disabled:opacity-50"
          >
            {paying ? t('processing') : t('payAmount', { amount: total.toFixed(2) })}
          </button>
        </div>
      </div>
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
