import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';
import {
  getMyOpenTill, openTill, closeTill, listTillSessions,
  listMenuCategories, listMenuItems, createPosOrder, confirmPosCardPayment, getBusiness, lookupFolioByRoom,
  listHotelOutlets,
} from '../../lib/authApi';
import { queueOrder, flushQueue, cacheMenu, getCachedMenu, getQueue } from '../../lib/offlineQueue';
import type { TillSession, MenuCategory, MenuItem } from '../../types';
import { Section, Field, inputClass } from '../../components/ui';

interface CartLine {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  course: string;
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
  const [isHotel, setIsHotel] = useState(false);
  const [outlets, setOutlets] = useState<{ id: string; name: string }[]>([]);
  const [outletId, setOutletId] = useState('');

  useEffect(() => {
    listTillSessions(businessId).then((sessions) => setHistory(sessions.slice(0, 5)));
    getBusiness(businessId).then((b) => setIsHotel(b.category === 'hotel')).catch(() => {});
  }, [businessId]);

  // Only ever fetched for a hotel - a restaurant has no outlets concept
  // (confirmed: hotel-only for now, restaurants may get this later).
  useEffect(() => {
    if (isHotel) listHotelOutlets(businessId).then((data) => setOutlets(data.filter((o) => o.enabled).map((o) => ({ id: o.id, name: o.name }))));
  }, [isHotel, businessId]);

  async function handleOpen() {
    if (isHotel && !outletId) { setError('Select which outlet you\'re opening this till for'); return; }
    setSaving(true);
    setError('');
    try {
      await openTill(businessId, openingFloat, isHotel ? outletId : undefined);
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
        {isHotel && (
          <Field label="Outlet - this till stays locked to it for the whole session">
            <select value={outletId} onChange={(e) => setOutletId(e.target.value)} className="w-full rounded-lg border border-ink-line bg-ink px-3.5 py-2.5 text-base text-ivory">
              <option value="">Select an outlet...</option>
              {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Opening float (AED)">
          <input
            type="number" min={0} onFocus={(e) => e.target.select()}
            value={openingFloat} onChange={(e) => setOpeningFloat(Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        {error && <p className="text-base text-danger">{error}</p>}
        <button type="button" onClick={handleOpen} disabled={saving} className="w-full rounded-lg bg-brass px-4 py-3 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
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

  // Hotel-only: charging to a guest's room instead of collecting payment
  // at the counter. Restaurants/cafes never see any of this - it stays
  // strictly behind isHotel.
  const [isHotel, setIsHotel] = useState(false);
  const [roomNumber, setRoomNumber] = useState('');
  const [roomFolio, setRoomFolio] = useState<{ folioId: string; roomNumber: string; guestName: string } | null>(null);
  const [roomLookupError, setRoomLookupError] = useState('');
  const [lookingUpRoom, setLookingUpRoom] = useState(false);
  // The till this session is locked to already fixed which outlet is
  // being operated (enforced server-side at open-till time) - this just
  // narrows the item grid to match, so a Beach till never shows the
  // Restaurant's whole menu.
  const [outletItemIds, setOutletItemIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    getBusiness(businessId).then((b) => setIsHotel(b.category === 'hotel')).catch(() => {});
  }, [businessId]);

  useEffect(() => {
    if (till.outlet_id) {
      listHotelOutlets(businessId).then((outlets) => {
        const mine = outlets.find((o) => o.id === till.outlet_id);
        setOutletItemIds(mine ? new Set(mine.hotel_outlet_items.map((i) => i.menu_item_id)) : new Set());
      });
    } else {
      setOutletItemIds(null);
    }
  }, [businessId, till.outlet_id]);

  async function handleRoomLookup() {
    if (!roomNumber.trim()) return;
    setLookingUpRoom(true);
    setRoomLookupError('');
    setRoomFolio(null);
    try {
      const result = await lookupFolioByRoom(businessId, roomNumber.trim());
      setRoomFolio(result);
      setTableLabel(`Room ${result.roomNumber}`);
    } catch (err) {
      setRoomLookupError(err instanceof Error ? err.message : 'Room not found');
    } finally {
      setLookingUpRoom(false);
    }
  }

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
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1, course: '' }];
    });
  }

  function setLineCourse(menuItemId: string, course: string) {
    setCart((prev) => prev.map((l) => (l.menuItemId === menuItemId ? { ...l, course } : l)));
  }

  function changeQty(menuItemId: string, delta: number) {
    setCart((prev) => prev.map((l) => (l.menuItemId === menuItemId ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l)).filter((l) => l.quantity > 0));
  }

  const [discountType, setDiscountType] = useState<'' | 'percentage' | 'fixed'>('');
  const [discountValue, setDiscountValue] = useState(0);
  const [discountReason, setDiscountReason] = useState('');

  const cartSubtotal = cart.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const discountAmount = discountType === 'percentage'
    ? Math.round(cartSubtotal * (Math.min(100, Math.max(0, discountValue)) / 100) * 100) / 100
    : discountType === 'fixed'
      ? Math.min(cartSubtotal, Math.max(0, discountValue))
      : 0;
  const cartTotal = Math.max(0, cartSubtotal - discountAmount);
  const visibleItems = items.filter((i) => i.category_id === activeCategory && (!outletItemIds || outletItemIds.has(i.id)));

  function resetCartState() {
    setCart([]);
    setTableLabel('Walk-in');
    setRoomFolio(null);
    setRoomNumber('');
    setDiscountType('');
    setDiscountValue(0);
    setDiscountReason('');
  }

  async function handleCharge(paymentMethod: 'cash' | 'card' | 'card_online' | 'other') {
    if (cart.length === 0) return;
    if (discountType && !discountReason.trim()) { setError('Enter a reason for the discount/comp'); return; }
    setCheckingOut(true);
    setError('');
    const payload = {
      tableLabel,
      items: cart.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity, course: l.course || undefined })),
      paymentMethod,
      ...(discountType ? { discountType, discountValue, discountReason } : {}),
    };

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
      resetCartState();
    } catch {
      // Genuinely offline (or the request failed to even reach the
      // server) - never block the sale over it. Save it locally and
      // keep going; it syncs for real the moment connectivity returns.
      queueOrder({ businessId, ...payload });
      setQueuedCount(getQueue().length);
      setConfirmed({ total: cartTotal, method: `${paymentMethod} (saved offline - will sync)` });
      resetCartState();
    } finally {
      setCheckingOut(false);
    }
  }

  // Charge to Room settles immediately, same as cash/card - it just
  // posts to the guest's folio instead of the till. Not offline-queued:
  // a folio charge always needs a live folio to attach to.
  async function handleChargeToRoom() {
    if (cart.length === 0 || !roomFolio) return;
    if (discountType && !discountReason.trim()) { setError('Enter a reason for the discount/comp'); return; }
    setCheckingOut(true);
    setError('');
    try {
      await createPosOrder(businessId, {
        tableLabel,
        items: cart.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity, course: l.course || undefined })),
        paymentMethod: 'other',
        chargeToFolioId: roomFolio.folioId,
        ...(discountType ? { discountType, discountValue, discountReason } : {}),
      });
      setConfirmed({ total: cartTotal, method: `charged to Room ${roomFolio.roomNumber}` });
      resetCartState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not charge to room');
    } finally {
      setCheckingOut(false);
    }
  }

  if (confirmed) {
    return (
      <div className="mx-auto max-w-sm space-y-4 text-center">
        <p className="font-display text-2xl text-ivory">Order sent to kitchen</p>
        <p className="text-ivory-dim">AED {confirmed.total.toFixed(2)} · paid by {confirmed.method}</p>
        <p className="text-sm text-ivory-dim">
          Incl. VAT (5%): AED {(confirmed.total - confirmed.total / 1.05).toFixed(2)}
        </p>
        <button type="button" onClick={() => setConfirmed(null)} className="rounded-lg bg-brass px-6 py-3 text-base font-medium text-ink hover:opacity-90">
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
          <button type="button" onClick={() => setShowCloseTill(true)} className="text-sm text-brass hover:underline">Close till</button>
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
            <button type="button"
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
            <button type="button"
              key={item.id}
              onClick={() => addToCart(item)}
              className="overflow-hidden rounded-lg border border-ink-line text-left hover:border-brass"
            >
              {/* Photo recognition matters at the counter - a busy
                  cashier reads a picture far faster than a name, which is
                  exactly what a plain text tile made slower. Falls back
                  to a plain tile only if this item genuinely has no
                  photo uploaded yet. */}
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="h-20 w-full object-cover sm:h-24" loading="lazy" />
              ) : (
                <div className="flex h-20 w-full items-center justify-center bg-ink-soft text-ivory-dim/40 sm:h-24">
                  <span className="text-2xl">🍽</span>
                </div>
              )}
              <div className="p-2.5">
                <p className="text-sm text-ivory line-clamp-1">{item.name}</p>
                <p className="text-sm text-brass">AED {item.price.toFixed(2)}</p>
              </div>
            </button>
          ))}
          {visibleItems.length === 0 && <p className="text-ivory-dim">No items in this category.</p>}
        </div>
      </div>

      <div className="rounded-xl border border-ink-line p-4">
        <Field label="Table / order label">
          <input value={tableLabel} onChange={(e) => setTableLabel(e.target.value)} className={inputClass} placeholder="Walk-in, Phone #3, Table 5..." />
        </Field>
        <div className="mt-4 max-h-96 space-y-1.5 overflow-y-auto">
          {cart.map((line) => (
            <div key={line.menuItemId} className="space-y-1 border-b border-ink-line/50 pb-1.5">
              <div className="flex items-center justify-between gap-2 text-base">
                <span className="text-ivory">{line.name}</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => changeQty(line.menuItemId, -1)} className="h-6 w-6 rounded border border-ink-line text-ivory-dim">-</button>
                  <span className="w-5 text-center text-ivory">{line.quantity}</span>
                  <button type="button" onClick={() => changeQty(line.menuItemId, 1)} className="h-6 w-6 rounded border border-ink-line text-ivory-dim">+</button>
                  <span className="w-16 text-right text-brass">{(line.price * line.quantity).toFixed(2)}</span>
                </div>
              </div>
              {/* Optional - leaving this on "Fire now" (the default) fires
                  the item immediately, same as before this existed. Only
                  matters for full-service tables holding mains back until
                  starters are cleared. */}
              <select
                value={line.course}
                onChange={(e) => setLineCourse(line.menuItemId, e.target.value)}
                className="rounded border border-ink-line bg-ink px-1.5 py-0.5 text-xs text-ivory-dim"
              >
                <option value="">Fire now</option>
                <option value="Starter">Hold: Starter</option>
                <option value="Main">Hold: Main</option>
                <option value="Dessert">Hold: Dessert</option>
              </select>
            </div>
          ))}
          {cart.length === 0 && <p className="text-ivory-dim">Cart is empty.</p>}
        </div>
        <div className="mt-4 space-y-2 rounded-lg border border-ink-line p-3">
          <div className="flex items-center gap-2">
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as '' | 'percentage' | 'fixed')}
              className="rounded-lg border border-ink-line bg-ink px-2.5 py-1.5 text-sm text-ivory"
            >
              <option value="">No discount</option>
              <option value="percentage">% off</option>
              <option value="fixed">AED off</option>
            </select>
            {discountType && (
              <input
                type="number"
                min={0}
                max={discountType === 'percentage' ? 100 : undefined}
                value={discountValue}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
                className="w-20 rounded-lg border border-ink-line bg-ink px-2.5 py-1.5 text-sm text-ivory"
              />
            )}
          </div>
          {discountType && (
            <input
              value={discountReason}
              onChange={(e) => setDiscountReason(e.target.value)}
              placeholder="Reason (required - e.g. regular customer, kitchen delay)"
              className="w-full rounded-lg border border-ink-line bg-ink px-2.5 py-1.5 text-sm text-ivory placeholder:text-ivory-dim/60"
            />
          )}
        </div>

        <div className="mt-3 space-y-1 border-t border-ink-line pt-3">
          {discountAmount > 0 && (
            <>
              <div className="flex justify-between text-sm text-ivory-dim">
                <span>Subtotal</span>
                <span>AED {cartSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-danger">
                <span>Discount</span>
                <span>−AED {discountAmount.toFixed(2)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between text-lg">
            <span className="text-ivory">Total</span>
            <span className="text-brass">AED {cartTotal.toFixed(2)}</span>
          </div>
        </div>
        {error && <p className="mt-2 text-base text-danger">{error}</p>}

        {isHotel && (
          <div className="mt-4 rounded-lg border border-brass/30 bg-ink-soft p-3">
            <p className="mb-2 text-sm text-ivory">Charge to Room</p>
            {roomFolio ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-ivory">Room {roomFolio.roomNumber}{roomFolio.guestName ? ` · ${roomFolio.guestName}` : ''}</span>
                <button type="button" onClick={() => { setRoomFolio(null); setRoomNumber(''); }} className="text-ivory-dim hover:text-ivory">Change</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRoomLookup()}
                  placeholder="Room number"
                  className="flex-1 rounded-lg border border-ink-line bg-ink px-3 py-2 text-sm text-ivory"
                />
                <button type="button" onClick={handleRoomLookup} disabled={lookingUpRoom} className="rounded-lg border border-brass/40 px-3 py-2 text-sm text-brass hover:bg-brass/10 disabled:opacity-50">
                  {lookingUpRoom ? 'Looking up...' : 'Find'}
                </button>
              </div>
            )}
            {roomLookupError && <p className="mt-1 text-sm text-danger">{roomLookupError}</p>}
          </div>
        )}

        <div className="mt-4 space-y-2">
          {isHotel && (
            <button type="button"
              onClick={handleChargeToRoom}
              disabled={checkingOut || cart.length === 0 || !roomFolio}
              className="w-full rounded-lg bg-brass px-4 py-3 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50"
            >
              Charge to Room{roomFolio ? ` ${roomFolio.roomNumber}` : ''}
            </button>
          )}
          <button type="button" onClick={() => handleCharge('cash')} disabled={checkingOut || cart.length === 0} className="w-full rounded-lg bg-brass px-4 py-3 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
            Charge - Cash
          </button>
          <button type="button" onClick={() => handleCharge('card')} disabled={checkingOut || cart.length === 0} className="w-full rounded-lg border border-brass/40 px-4 py-3 text-base font-medium text-brass hover:bg-brass/10 disabled:opacity-50">
            Charge - Card (external machine)
          </button>
          <button type="button" onClick={() => handleCharge('card_online')} disabled={checkingOut || cart.length === 0} className="w-full rounded-lg border border-brass/40 px-4 py-3 text-base font-medium text-brass hover:bg-brass/10 disabled:opacity-50">
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
        <button type="button" onClick={onDone} className="rounded-lg bg-brass px-6 py-3 text-base font-medium text-ink hover:opacity-90">Done</button>
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
          <button type="button" onClick={handleClose} disabled={saving} className="flex-1 rounded-lg bg-brass px-4 py-3 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
            {saving ? 'Closing...' : 'Close till'}
          </button>
          <button type="button" onClick={onCancel} className="rounded-lg border border-ink-line px-4 py-3 text-base text-ivory-dim">Cancel</button>
        </div>
      </Section>
    </div>
  );
}
