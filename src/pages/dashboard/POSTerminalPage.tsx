import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';
import {
  getMyOpenTill, openTill, closeTill, listTillSessions,
  listMenuCategories, listMenuItems, createPosOrder, confirmPosCardPayment,
} from '../../lib/authApi';
import { queueOrder, flushQueue, cacheMenu, getCachedMenu, getQueue } from '../../lib/offlineQueue';
import type { TillSession, MenuCategory, MenuItem } from '../../types';
import { Section, Field, inputClass } from '../../components/ui';

interface CartLine {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

export default function POSTerminalPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [till, setTill] = useState<TillSession | null | undefined>(undefined);
  const [searchParams] = useSearchParams();
  const [cardPaymentResult, setCardPaymentResult] = useState<'success' | 'failed' | null>(null);

  function reloadTill() {
    if (businessId) getMyOpenTill(businessId).then(setTill);
  }
  useEffect(reloadTill, [businessId]);

  // Landed back here after paying on the gateway's own hosted page -
  // verify the real outcome server-side, same never-trust-the-redirect
  // rule as the guest portal's folio payment confirmation.
  useEffect(() => {
    const txnId = searchParams.get('posPaymentTxnId');
    if (!txnId || !businessId) return;
    confirmPosCardPayment(businessId, txnId)
      .then(() => setCardPaymentResult('success'))
      .catch(() => setCardPaymentResult('failed'));
  }, [searchParams, businessId]);

  if (!businessId || till === undefined) return <p className="text-ivory-dim">Loading...</p>;

  if (!till) return <OpenTillScreen businessId={businessId} onOpened={reloadTill} />;

  return (
    <div className="space-y-4">
      {cardPaymentResult && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${cardPaymentResult === 'success' ? 'border-success/40 bg-success/10 text-success' : 'border-danger/40 bg-danger/10 text-danger'}`}>
          {cardPaymentResult === 'success' ? 'Online card payment confirmed.' : 'Online card payment was not completed.'}
        </div>
      )}
      <TerminalScreen businessId={businessId} till={till} onTillClosed={reloadTill} />
    </div>
  );
}

function OpenTillScreen({ businessId, onOpened }: { businessId: string; onOpened: () => void }) {
  const [openingFloat, setOpeningFloat] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<TillSession[]>([]);

  useEffect(() => {
    listTillSessions(businessId).then((sessions) => setHistory(sessions.slice(0, 5)));
  }, [businessId]);

  async function handleOpen() {
    setSaving(true);
    setError('');
    try {
      await openTill(businessId, openingFloat);
      onOpened();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open till');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <Section title="Open your till">
        <p className="text-base text-ivory-dim">
          Count the cash currently in the drawer before you start your shift - this is your starting float.
        </p>
        <Field label="Opening float (AED)">
          <input
            type="number" min={0} onFocus={(e) => e.target.select()}
            value={openingFloat} onChange={(e) => setOpeningFloat(Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        {error && <p className="text-base text-danger">{error}</p>}
        <button onClick={handleOpen} disabled={saving} className="w-full rounded-lg bg-brass px-4 py-3 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
          {saving ? 'Opening...' : 'Open till & start selling'}
        </button>
      </Section>

      {history.length > 0 && (
        <Section title="Recent till sessions">
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="rounded-lg border border-ink-line px-4 py-3 text-sm">
                <p className="text-ivory">{h.profiles?.name || 'Staff'} · {new Date(h.opened_at).toLocaleDateString()}</p>
                {h.status === 'closed' ? (
                  <p className={Number(h.variance_aed) === 0 ? 'text-success' : 'text-warning'}>
                    Expected {h.expected_cash_aed?.toFixed(2)} · Counted {h.counted_cash_aed?.toFixed(2)} ·
                    {' '}Variance {Number(h.variance_aed) >= 0 ? '+' : ''}{h.variance_aed?.toFixed(2)}
                  </p>
                ) : (
                  <p className="text-brass">Still open</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function TerminalScreen({ businessId, till, onTillClosed }: { businessId: string; till: TillSession; onTillClosed: () => void }) {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [tableLabel, setTableLabel] = useState('Walk-in');
  const [showCloseTill, setShowCloseTill] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState<{ total: number; method: string } | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [queuedCount, setQueuedCount] = useState(getQueue().length);

  // Menu load with a real offline fallback - if the live fetch fails
  // (no connection), fall back to whatever was cached the last time it
  // succeeded, rather than leaving the terminal with nothing to sell.
  useEffect(() => {
    Promise.all([listMenuCategories(businessId), listMenuItems(businessId)])
      .then(([cats, menuItems]) => {
        setCategories(cats);
        setItems(menuItems);
        if (cats.length > 0) setActiveCategory(cats[0].id);
        cacheMenu(cats, menuItems);
      })
      .catch(() => {
        const cached = getCachedMenu();
        if (cached) {
          setCategories(cached.categories);
          setItems(cached.items);
          if (cached.categories.length > 0) setActiveCategory(cached.categories[0].id);
        }
      });
  }, [businessId]);

  // Sync any locally-queued orders the moment connectivity returns, and
  // keep retrying periodically in case the 'online' event itself is
  // unreliable on this device/network.
  useEffect(() => {
    async function trySync() {
      const { remaining } = await flushQueue();
      setQueuedCount(remaining);
    }
    function handleOnline() { setIsOffline(false); trySync(); }
    function handleOffline() { setIsOffline(true); }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (navigator.onLine) trySync();
    const interval = setInterval(() => { if (navigator.onLine) trySync(); }, 30000);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [businessId]);

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((l) => l.menuItemId === item.id);
      if (existing) return prev.map((l) => (l.menuItemId === item.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  }

  function changeQty(menuItemId: string, delta: number) {
    setCart((prev) => prev.map((l) => (l.menuItemId === menuItemId ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l)).filter((l) => l.quantity > 0));
  }

  const cartTotal = cart.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const visibleItems = items.filter((i) => i.category_id === activeCategory);

  async function handleCharge(paymentMethod: 'cash' | 'card' | 'card_online' | 'other') {
    if (cart.length === 0) return;
    setCheckingOut(true);
    setError('');
    const payload = { tableLabel, items: cart.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity })), paymentMethod };

    // card_online is a real gateway charge - it can't be queued offline
    // (there's no gateway to reach), and it redirects to a hosted
    // payment page rather than confirming immediately like every other
    // method does.
    if (paymentMethod === 'card_online') {
      try {
        const result = await createPosOrder(businessId, payload);
        if (result.redirectUrl) {
          window.location.href = result.redirectUrl;
          return;
        }
        setError('Could not start online payment');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not start online payment');
      } finally {
        setCheckingOut(false);
      }
      return;
    }

    try {
      if (!navigator.onLine) throw new Error('offline');
      await createPosOrder(businessId, payload);
      setConfirmed({ total: cartTotal, method: paymentMethod });
      setCart([]);
      setTableLabel('Walk-in');
    } catch {
      // Genuinely offline (or the request failed to even reach the
      // server) - never block the sale over it. Save it locally and
      // keep going; it syncs for real the moment connectivity returns.
      queueOrder({ businessId, ...payload });
      setQueuedCount(getQueue().length);
      setConfirmed({ total: cartTotal, method: `${paymentMethod} (saved offline - will sync)` });
      setCart([]);
      setTableLabel('Walk-in');
    } finally {
      setCheckingOut(false);
    }
  }

  if (confirmed) {
    return (
      <div className="mx-auto max-w-sm space-y-4 text-center">
        <p className="font-display text-2xl text-ivory">Order sent to kitchen</p>
        <p className="text-ivory-dim">AED {confirmed.total.toFixed(2)} · paid by {confirmed.method}</p>
        <button onClick={() => setConfirmed(null)} className="rounded-lg bg-brass px-6 py-3 text-base font-medium text-ink hover:opacity-90">
          New order
        </button>
      </div>
    );
  }

  if (showCloseTill) {
    return <CloseTillScreen businessId={businessId} till={till} onDone={onTillClosed} onCancel={() => setShowCloseTill(false)} />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-display text-2xl text-ivory">POS Terminal</h1>
          <button onClick={() => setShowCloseTill(true)} className="text-sm text-brass hover:underline">Close till</button>
        </div>
        {(isOffline || queuedCount > 0) && (
          <div className={`mb-4 rounded-lg border px-4 py-2.5 text-sm ${isOffline ? 'border-danger/40 text-danger' : 'border-warning/40 text-warning'}`}>
            {isOffline
              ? `Offline - orders are being saved locally${queuedCount > 0 ? ` (${queuedCount} waiting to sync)` : ''} and will send automatically once you're back online.`
              : `Syncing ${queuedCount} order${queuedCount === 1 ? '' : 's'} saved while offline...`}
          </div>
        )}
        <div className="flex gap-2 overflow-x-auto border-b border-ink-line pb-2">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm ${activeCategory === c.id ? 'bg-brass text-ink' : 'border border-ink-line text-ivory-dim'}`}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visibleItems.map((item) => (
            <button
              key={item.id}
              onClick={() => addToCart(item)}
              className="rounded-lg border border-ink-line p-3 text-left hover:border-brass"
            >
              <p className="text-base text-ivory">{item.name}</p>
              <p className="text-sm text-brass">AED {item.price.toFixed(2)}</p>
            </button>
          ))}
          {visibleItems.length === 0 && <p className="text-ivory-dim">No items in this category.</p>}
        </div>
      </div>

      <div className="rounded-xl border border-ink-line p-4">
        <Field label="Table / order label">
          <input value={tableLabel} onChange={(e) => setTableLabel(e.target.value)} className={inputClass} placeholder="Walk-in, Phone #3, Table 5..." />
        </Field>
        <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
          {cart.map((line) => (
            <div key={line.menuItemId} className="flex items-center justify-between gap-2 text-base">
              <span className="text-ivory">{line.name}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => changeQty(line.menuItemId, -1)} className="h-6 w-6 rounded border border-ink-line text-ivory-dim">-</button>
                <span className="w-5 text-center text-ivory">{line.quantity}</span>
                <button onClick={() => changeQty(line.menuItemId, 1)} className="h-6 w-6 rounded border border-ink-line text-ivory-dim">+</button>
                <span className="w-16 text-right text-brass">{(line.price * line.quantity).toFixed(2)}</span>
              </div>
            </div>
          ))}
          {cart.length === 0 && <p className="text-ivory-dim">Cart is empty.</p>}
        </div>
        <div className="mt-4 flex justify-between border-t border-ink-line pt-3 text-lg">
          <span className="text-ivory">Total</span>
          <span className="text-brass">AED {cartTotal.toFixed(2)}</span>
        </div>
        {error && <p className="mt-2 text-base text-danger">{error}</p>}
        <div className="mt-4 space-y-2">
          <button onClick={() => handleCharge('cash')} disabled={checkingOut || cart.length === 0} className="w-full rounded-lg bg-brass px-4 py-3 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
            Charge - Cash
          </button>
          <button onClick={() => handleCharge('card')} disabled={checkingOut || cart.length === 0} className="w-full rounded-lg border border-brass/40 px-4 py-3 text-base font-medium text-brass hover:bg-brass/10 disabled:opacity-50">
            Charge - Card (external machine)
          </button>
          <button onClick={() => handleCharge('card_online')} disabled={checkingOut || cart.length === 0} className="w-full rounded-lg border border-brass/40 px-4 py-3 text-base font-medium text-brass hover:bg-brass/10 disabled:opacity-50">
            Charge - Card online (real gateway)
          </button>
        </div>
      </div>
    </div>
  );
}

function CloseTillScreen({ businessId, till, onDone, onCancel }: { businessId: string; till: TillSession; onDone: () => void; onCancel: () => void }) {
  const [countedCash, setCountedCash] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<TillSession | null>(null);

  async function handleClose() {
    setSaving(true);
    setError('');
    try {
      const updated = await closeTill(businessId, till.id, countedCash, notes);
      setResult(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not close till');
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    const variance = Number(result.variance_aed);
    return (
      <div className="mx-auto max-w-sm space-y-4 text-center">
        <p className="font-display text-2xl text-ivory">Till closed</p>
        <div className="space-y-1 text-base text-ivory-dim">
          <p>Expected: AED {result.expected_cash_aed?.toFixed(2)}</p>
          <p>Counted: AED {result.counted_cash_aed?.toFixed(2)}</p>
          <p className={variance === 0 ? 'text-success' : 'text-warning'}>
            Variance: {variance >= 0 ? '+' : ''}{variance.toFixed(2)} AED
          </p>
        </div>
        <button onClick={onDone} className="rounded-lg bg-brass px-6 py-3 text-base font-medium text-ink hover:opacity-90">Done</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <Section title="Close till">
        <p className="text-base text-ivory-dim">Count the cash physically in the drawer and enter the real total.</p>
        <Field label="Counted cash (AED)">
          <input type="number" min={0} onFocus={(e) => e.target.select()} value={countedCash} onChange={(e) => setCountedCash(Number(e.target.value))} className={inputClass} />
        </Field>
        <Field label="Notes (optional)">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
        </Field>
        {error && <p className="text-base text-danger">{error}</p>}
        <div className="flex gap-2">
          <button onClick={handleClose} disabled={saving} className="flex-1 rounded-lg bg-brass px-4 py-3 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
            {saving ? 'Closing...' : 'Close till'}
          </button>
          <button onClick={onCancel} className="rounded-lg border border-ink-line px-4 py-3 text-base text-ivory-dim">Cancel</button>
        </div>
      </Section>
    </div>
  );
}
