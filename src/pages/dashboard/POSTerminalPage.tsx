import { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { UtensilsCrossed, RotateCcw, Lock, Minus, Plus, FileText, Search, CreditCard, ChevronLeft, ChevronRight, Car } from 'lucide-react';
import { isCloseMatch } from '../../lib/fuzzyMatch';
import RecordPaymentFlow from '../../components/RecordPaymentFlow';
import PaymentModal from '../../components/PaymentModal';
import { useConfirm } from '../../components/ConfirmDialog';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import {
  getMyOpenTill, openTill, closeTill, listTillSessions, getXReport, type XReport,
  listMenuCategories, listMenuItems, createPosOrder, getBusiness, lookupFolioByRoom,
  listHotelOutlets, listPayments, listOrders, listTables, assignTable,
} from '../../lib/authApi';
import { queueOrder, flushQueue, cacheMenu, getCachedMenu, getQueue } from '../../lib/offlineQueue';
import { subscribeToBusinessTable, subscribeToOrderItemsForBusiness } from '../../lib/supabaseClient';
import { usePollingFallback } from '../../hooks/usePollingFallback';
import type { TillSession, MenuCategory, MenuItem, PaymentRow, OrderRow, FloorTable } from '../../types';
import { Section, Field, inputClass } from '../../components/ui';
import SectionRequestNotifications from '../../components/SectionRequestNotifications';
import { PaymentRowItem } from './PaymentsPage';

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
  const { focusMode } = useOutletContext<{ focusMode?: boolean }>();

  function reloadTill() {
    if (businessId) getMyOpenTill(businessId).then(setTill).catch(() => {});
  }
  useEffect(reloadTill, [businessId]);

  if (!businessId || till === undefined) return <p className="text-ivory-dim">Loading...</p>;

  if (!till) return <OpenTillScreen businessId={businessId} onOpened={reloadTill} />;

  return (
    <div className="space-y-4">
      <TerminalScreen businessId={businessId} till={till} onTillClosed={reloadTill} focusMode={!!focusMode} />
    </div>
  );
}

function OpenTillScreen({ businessId, onOpened }: { businessId: string; onOpened: () => void }) {
  const { t } = useT();
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
      <Section title={t('Open your till')}>
        <p className="text-base text-ivory-dim">
          {t('Count the cash currently in the drawer before you start your shift - this is your starting float.')}
        </p>
        {isHotel && (
          <Field label={t('Outlet - this till stays locked to it for the whole session')}>
            <select value={outletId} onChange={(e) => setOutletId(e.target.value)} className="w-full rounded-lg border border-ink-line bg-ink px-3.5 py-2.5 text-base text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
              <option value="">{t('Select an outlet...')}</option>
              {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
        )}
        <Field label={t('Opening float (AED)')}>
          <input
            type="number" min={0} onFocus={(e) => e.target.select()}
            value={openingFloat} onChange={(e) => setOpeningFloat(Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        {error && <p className="text-base text-danger">{error}</p>}
        <button type="button" onClick={handleOpen} disabled={saving} className="w-full rounded-full bg-brass px-4 py-3 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
          {saving ? t('Opening...') : t('Open till & start selling')}
        </button>
      </Section>

      {history.length > 0 && (
        <Section title={t('Recent till sessions')}>
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="rounded-2xl border border-ink-line px-4 py-3 text-sm shadow-sm">
                <p className="text-ivory">{h.profiles?.name || t('Staff')} · {new Date(h.opened_at).toLocaleDateString()}</p>
                {h.status === 'closed' ? (
                  <p className={Number(h.variance_aed) === 0 ? 'text-success' : 'text-warning'}>
                    {t('Expected')} {h.expected_cash_aed?.toFixed(2)} · {t('Counted')} {h.counted_cash_aed?.toFixed(2)} ·
                    {' '}{t('Variance')} {Number(h.variance_aed) >= 0 ? '+' : ''}{h.variance_aed?.toFixed(2)}
                  </p>
                ) : (
                  <p className="text-brass">{t('Still open')}</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// Matches the terminology real POS systems use (Toast, Square, Clover
// all split Dine-in / Takeout / Delivery the same way) - Walk-in is
// kept as its own 4th type here on top of that, since it covers a case
// those don't split out on its own: a counter sale handed over
// immediately, with no table and no name/phone worth collecting at all.
const ORDER_TYPE_LABELS: Record<'dine_in' | 'walk_in' | 'pickup' | 'delivery', string> = {
  dine_in: 'Dine-in', walk_in: 'Walk-in', pickup: 'Pickup', delivery: 'Delivery',
};
const ORDER_TYPE_FIELD_LABEL: Record<'dine_in' | 'walk_in' | 'pickup' | 'delivery', string> = {
  dine_in: 'Table number', walk_in: 'Name (optional)', pickup: 'Name / phone', delivery: 'Name / phone',
};
const ORDER_TYPE_PLACEHOLDER: Record<'dine_in' | 'walk_in' | 'pickup' | 'delivery', string> = {
  dine_in: 'e.g. Table 5', walk_in: 'Leave blank to auto-number', pickup: 'e.g. Sara, 050 123 4567', delivery: 'e.g. Ahmed, 050 123 4567',
};

function TerminalScreen({ businessId, till, onTillClosed, focusMode }: { businessId: string; till: TillSession; onTillClosed: () => void; focusMode: boolean }) {
  const { t } = useT();
  const confirm = useConfirm();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  // Real fix for the explicit request: 12 items per page, real pagination
  // (not endless horizontal scroll) - the left/right buttons only appear
  // once a category actually has more than one page's worth. Resets to
  // page 1 whenever the category or search changes, since staying on
  // "page 2" of a brand new category/search would just show an empty grid.
  // Explicit request: focus mode's denser grid (smaller tiles, more
  // columns) genuinely has room for double the items before it would
  // need to scroll - 12 was a flat constant that ignored that, which is
  // exactly why an item was stranded alone on page 2 while page 1
  // still had visible room in focus mode.
  const ITEMS_PER_PAGE = focusMode ? 24 : 12;
  const [itemsPage, setItemsPage] = useState(0);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  useEffect(() => { setItemsPage(0); }, [activeCategory, itemSearchQuery]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderType, setOrderType] = useState<'dine_in' | 'walk_in' | 'pickup' | 'delivery'>('walk_in');
  const [floorTables, setFloorTables] = useState<FloorTable[]>([]);
  const [selectedCardId, setSelectedCardId] = useState('');
  function reloadFloorTables() {
    listTables(businessId).then(setFloorTables).catch(() => {});
  }
  useEffect(() => {
    reloadFloorTables();
    const unsubOrders = subscribeToBusinessTable(businessId, 'orders', reloadFloorTables);
    return unsubOrders;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);
  const [tableLabel, setTableLabel] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [showCloseTill, setShowCloseTill] = useState(false);
  const [showXReport, setShowXReport] = useState(false);
  const [showRefunds, setShowRefunds] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState<{ total: number; headline: string; detail: string } | null>(null);
  // Real, explicit request: staff must be actively alerted the moment a
  // new pay-at-pickup drive-through order arrives (not just left to
  // notice it sitting in the quick-pay chip row on their own) - a
  // one-time popup with the amount, so they know to collect payment
  // manually when the customer arrives. Only fires for orders that are
  // genuinely NEW since this screen was last checked, and only for
  // pay-at-pickup ones specifically - a "pay first" order arrives
  // already paid (see finalizeOrderPayment), so it never even reaches
  // quickPayOrders in the first place, and correctly never triggers this.
  const [driveThroughAlert, setDriveThroughAlert] = useState<{ label: string; amount: number } | null>(null);
  const seenDriveThroughIds = useRef(new Set<string>());
  const [pendingPayment, setPendingPayment] = useState<{ items: { id: string; orderId: string; name: string; unitPrice: number; addonTotal: number; quantity: number }[] } | null>(null);
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
  const [quickPayTarget, setQuickPayTarget] = useState<OrderRow | null>(null);
  const [convertingOrder, setConvertingOrder] = useState<OrderRow | null>(null);
  const [convertCardId, setConvertCardId] = useState('');
  const [convertSaving, setConvertSaving] = useState(false);

  async function handleConvertToDineIn() {
    if (!convertingOrder || !convertCardId) return;
    setConvertSaving(true);
    try {
      await assignTable(businessId, convertingOrder.id, convertCardId);
      setConvertingOrder(null);
      setConvertCardId('');
      reloadQuickPay();
      reloadFloorTables();
    } finally {
      setConvertSaving(false);
    }
  }

  // Real fix for the exact complaint: "who tf is walk 1 and walk 2" -
  // an auto-numbered label ("Walk-in #3", "Pickup #7") tells staff
  // nothing about what's actually in the order. Detects that specific
  // pattern and falls back to real item names instead; a genuine
  // custom name someone actually typed in (anything that doesn't match
  // the pattern) is shown as-is, since that IS the useful information
  // in that case.
  function quickPayLabel(order: OrderRow): string {
    if (order.order_type === 'drive_through') {
      const minutes = order.arrival_at ? Math.round((new Date(order.arrival_at).getTime() - Date.now()) / 60000) : null;
      return minutes !== null ? `${t('Drive Through')} — ${minutes <= 0 ? t('Arriving now') : `${minutes} ${t('min')}`}` : t('Drive Through');
    }
    const isAutoGenerated = /^(Walk-in|Pickup) #\d+$/.test(order.table_label || '');
    if (!isAutoGenerated && order.table_label) return order.table_label;
    const unpaidItems = order.order_items.filter((i) => !i.voided && !i.paid);
    const names = unpaidItems.map((i) => `${i.quantity}× ${i.item_name}`);
    return names.length <= 2 ? names.join(', ') : `${names[0]}, +${names.length - 1} more`;
  }

  // Real fix for a confirmed gap: an order sent to the kitchen had no
  // direct way back to pay it except navigating away to Orders and
  // working through Record Payment's table-selection maze. This is the
  // Real fix for a confirmed bug: card_id alone stopped being a
  // reliable "is this staff-managed" signal the moment a walk-in gets
  // converted to dine-in and connected to a table with a real card -
  // the order gains a card_id even though it's still fundamentally a
  // staff-placed order, not a genuine customer NFC session. source is
  // the actually-reliable field here: set once at creation to
  // 'staff_pos' or 'customer_tap' and never touched afterward by the
  // table-conversion flow, regardless of what happens to card_id.
  const [quickPayOrders, setQuickPayOrders] = useState<OrderRow[]>([]);
  function reloadQuickPay() {
    listOrders(businessId).then((orders) => {
      // Real bug fix (confirmed by explicit report): this filter
      // excluded 'customer_tap' entirely - a customer who tapped the
      // NFC card and ordered directly from the table never showed up
      // here for staff to collect payment on, regardless of how the
      // order was actually placed. Staff need to be able to record
      // payment for ANY unpaid order, not only ones placed through POS
      // itself or drive-through.
      setQuickPayOrders(orders.filter((o) =>
        (o.source === 'staff_pos' || o.source === 'drive_through' || o.source === 'customer_tap')
        && o.order_items.some((i) => !i.voided && !i.paid)
      ));
    }).catch(() => {});
  }
  useEffect(() => {
    reloadQuickPay();
    const unsubOrders = subscribeToBusinessTable(businessId, 'orders', reloadQuickPay);
    const unsubItems = subscribeToOrderItemsForBusiness(() => reloadQuickPay());
    return () => { unsubOrders(); unsubItems(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);
  // Real, explicit request: alert staff the moment a new pay-at-pickup
  // drive-through order shows up, not just leave it sitting quietly in
  // the chip row. Diffs against everything already seen THIS session
  // (a ref, not state, so it survives re-renders without itself
  // triggering one) - only a genuinely new order id fires the alert,
  // never one already shown once, even if reloadQuickPay refires for
  // an unrelated reason (a different order's status changing, the 5s
  // poll, etc).
  useEffect(() => {
    for (const order of quickPayOrders) {
      if (order.order_type !== 'drive_through') continue;
      if (seenDriveThroughIds.current.has(order.id)) continue;
      seenDriveThroughIds.current.add(order.id);
      setDriveThroughAlert({ label: quickPayLabel(order), amount: order.total });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickPayOrders]);
  useEffect(() => {
    if (!driveThroughAlert) return;
    const timer = setTimeout(() => setDriveThroughAlert(null), 6000);
    return () => clearTimeout(timer);
  }, [driveThroughAlert]);
  // Explicit, system-wide request: an independent 5-second poll of both
  // this screen's own reload functions (floor tables + unpaid/quick-pay
  // orders), completely separate from the realtime subscriptions above -
  // a safety net so a missed/dropped Realtime event is never more than
  // 5s stale, with no manual refresh needed.
  usePollingFallback(() => { reloadFloorTables(); reloadQuickPay(); }, !!businessId);

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

  // Real, explicit request: one button that clears the whole order in
  // progress, whether it's one item or many - the actual problem being
  // solved is a customer changing their mind after several items are
  // already in, which used to mean removing every single line one at a
  // time. A real confirmation first, same as every other place in this
  // app that can wipe out real, hard-to-redo work in one tap.
  async function clearCart() {
    if (cart.length === 0) return;
    if (!(await confirm({
      title: t('Clear this order?'),
      message: t('Removes every item currently in the cart. This cannot be undone.'),
      confirmLabel: t('Clear order'),
      danger: true,
    }))) return;
    setCart([]);
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
  const exactSearchResults = itemSearchQuery.trim()
    ? items.filter((i) => {
        const q = itemSearchQuery.trim().toLowerCase();
        return (!outletItemIds || outletItemIds.has(i.id)) && (i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q));
      })
    : null;
  // Real fallback: a genuine typo ("chiken sandwish") shouldn't return
  // nothing just because it isn't a literal substring match - falls
  // back to fuzzy name matching only when the exact search truly found
  // nothing, never overriding a real match.
  const fuzzySearchResults = itemSearchQuery.trim() && exactSearchResults?.length === 0
    ? items.filter((i) => (!outletItemIds || outletItemIds.has(i.id)) && i.name.split(/\s+/).some((word) => isCloseMatch(itemSearchQuery, word)))
    : [];
  const visibleItems = itemSearchQuery.trim()
    ? (exactSearchResults!.length > 0 ? exactSearchResults! : fuzzySearchResults)
    : items.filter((i) => i.category_id === activeCategory && (!outletItemIds || outletItemIds.has(i.id)));
  const isFuzzyFallback = itemSearchQuery.trim() && exactSearchResults?.length === 0 && fuzzySearchResults.length > 0;
  const totalItemPages = Math.max(1, Math.ceil(visibleItems.length / ITEMS_PER_PAGE));
  const safeItemsPage = Math.min(itemsPage, totalItemPages - 1);
  const pageItems = visibleItems.slice(safeItemsPage * ITEMS_PER_PAGE, safeItemsPage * ITEMS_PER_PAGE + ITEMS_PER_PAGE);

  function resetCartState() {
    setCart([]);
    setOrderType('walk_in');
    setTableLabel('');
    setSelectedCardId('');
    setOrderNote('');
    setRoomFolio(null);
    setRoomNumber('');
    setDiscountType('');
    setDiscountValue(0);
    setDiscountReason('');
  }

  // Both Send to Kitchen and Payment start with the exact same real
  // action - create the order, unpaid, and fire it to the kitchen.
  // Payment continues on to open the shared PaymentModal immediately
  // for that just-created order; Send to Kitchen stops there. If the
  // Payment modal gets cancelled, the order simply stays unpaid and
  // reachable later via Orders - the same real state a dine-in table
  // or a pay-on-collection pickup order is always in, no special
  // casing needed between "meant to pay now" and "changed their mind".
  async function handleSendToKitchen(openPaymentAfter: boolean) {
    if (cart.length === 0) return;
    if (orderType === 'dine_in' && !selectedCardId) { setError('Pick which table this is for'); return; }
    if (discountType && !discountReason.trim()) { setError('Enter a reason for the discount/comp'); return; }
    setCheckingOut(true);
    setError('');
    const payload = {
      tableLabel: tableLabel.trim() || undefined,
      orderType,
      tableId: orderType === 'dine_in' && selectedCardId ? selectedCardId : undefined,
      note: orderNote,
      items: cart.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity, course: l.course || undefined })),
      ...(discountType ? { discountType, discountValue, discountReason } : {}),
    };

    try {
      if (!navigator.onLine) throw new Error('offline');
      const result = await createPosOrder(businessId, payload);
      if (openPaymentAfter) {
        setPendingPayment({
          items: result.items.map((i) => ({ id: i.id, orderId: result.order.id, name: i.item_name, unitPrice: i.unit_price, addonTotal: i.addon_total, quantity: i.quantity })),
        });
      } else {
        setConfirmed({ total: cartTotal, headline: t('Order sent to kitchen'), detail: t('Not yet paid') });
        reloadQuickPay();
      }
      resetCartState();
    } catch {
      // Genuinely offline (or the request failed to even reach the
      // server) - never block the order over it. Save it locally and
      // keep going; it syncs for real the moment connectivity returns.
      // Payment can't be taken offline either way (PIN verification
      // needs the server), so an offline "Payment" press just falls
      // back to queuing the order like Send to Kitchen would - it's
      // payable once back online, same as any other unpaid order.
      queueOrder({ businessId, ...payload, tableLabel: payload.tableLabel || ORDER_TYPE_LABELS[orderType] });
      setQueuedCount(getQueue().length);
      setConfirmed({ total: cartTotal, headline: t('Order saved offline'), detail: t('Will sync once back online - not yet paid') });
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
        chargeToFolioId: roomFolio.folioId,
        ...(discountType ? { discountType, discountValue, discountReason } : {}),
      });
      setConfirmed({ total: cartTotal, headline: t('Charged to room'), detail: `${t('Room')} ${roomFolio.roomNumber}` });
      resetCartState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not charge to room');
    } finally {
      setCheckingOut(false);
    }
  }

  // Real fix for a confirmed complaint: this used to replace the ENTIRE
  // terminal screen after every single order, forcing an explicit "New
  // order" click before the next customer could even be started - on a
  // busy counter that's real friction, hundreds of times a shift. The
  // cart is already reset by the time this fires either way (see
  // resetCartState() calls above), so there's nothing left to protect by
  // blocking the screen - a brief, non-blocking toast that clears itself
  // says the same thing without stopping anyone.
  useEffect(() => {
    if (!confirmed) return;
    const duration = confirmed.headline === t('Payment received') ? 4500 : 2500;
    const timer = setTimeout(() => setConfirmed(null), duration);
    return () => clearTimeout(timer);
  }, [confirmed]);

  if (showCloseTill) {
    return <CloseTillScreen businessId={businessId} till={till} onDone={onTillClosed} onCancel={() => setShowCloseTill(false)} />;
  }

  if (showRefunds) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-display text-2xl text-ivory">{t('POS Terminal')}</h1>
          <button type="button" onClick={() => setShowRefunds(false)} className="rounded text-sm text-brass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">{t('Back to selling')}</button>
        </div>
        <RefundsPanel businessId={businessId} />
      </div>
    );
  }

  return (
    <>
      {businessId && <SectionRequestNotifications businessId={businessId} section="pos" />}
      <div className="relative grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* Real, non-blocking replacement for the old full-screen block -
          floats over the corner, never intercepts a tap on the terminal
          underneath, and clears itself on the timer set above. */}
      {confirmed && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-toast flex justify-center sm:inset-x-auto sm:end-6">
          <div className={`flex items-center gap-3 rounded-xl border px-5 py-3 shadow-lg pointer-events-auto motion-safe:animate-hero-rise ${
            confirmed.headline === t('Payment received') ? 'border-success bg-success/15' : 'border-success/40 bg-ink-soft'
          }`}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">✓</span>
            <div>
              <p className="text-sm font-medium text-ivory">{confirmed.headline}</p>
              <p className="text-xs text-ivory-dim">AED {confirmed.total.toFixed(2)} · {confirmed.detail}</p>
            </div>
          </div>
        </div>
      )}
      {/* Real, explicit request: a small popup specifically for a new
          pay-at-pickup drive-through order, distinct in color from the
          success toast above - same non-blocking floating pattern,
          violet instead of green, so it reads as "something needs your
          attention" rather than "something just succeeded". */}
      {driveThroughAlert && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-toast flex justify-center sm:inset-x-auto sm:end-6">
          <div className="flex items-center gap-3 rounded-xl border border-drivethrough bg-drivethrough/15 px-5 py-3 shadow-lg pointer-events-auto motion-safe:animate-hero-rise">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-drivethrough/20 text-drivethrough">
              <Car size={16} strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-sm font-medium text-ivory">{t('New drive-through order')}</p>
              <p className="text-xs text-ivory-dim">{driveThroughAlert.label} · AED {driveThroughAlert.amount.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}
      <div className="min-w-0">
        {/* Real fix for the explicit request: in focus mode, the title
            + full toolbar row used to take the same vertical space as
            normal mode, pushing the item area (and, on a short screen,
            the request notification above) out of view - the opposite
            of what focus mode is for. Collapses to a single compact row
            with icon-only secondary actions when focus mode is on. */}
        {focusMode ? (
          <div className="mb-3 flex items-center justify-between gap-3">
            <h1 className="font-display text-lg text-ivory">{t('POS Terminal')}</h1>
            <div className="flex items-center gap-3 text-ivory-dim">
              <button type="button" onClick={() => setShowRecordPayment(true)} title={t('Record payment')} className="rounded hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"><CreditCard size={16} strokeWidth={2} /></button>
              <button type="button" onClick={() => setShowXReport(true)} title={t('X-report')} className="rounded hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"><FileText size={16} strokeWidth={2} /></button>
              <button type="button" onClick={() => setShowRefunds(true)} title={t('Refunds')} className="rounded hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"><RotateCcw size={16} strokeWidth={2} /></button>
              <button type="button" onClick={() => setShowCloseTill(true)} title={t('Close till')} className="rounded hover:text-brass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"><Lock size={16} strokeWidth={2} /></button>
            </div>
          </div>
        ) : (
        <div className="mb-5 flex items-center justify-between border-b border-ink-line pb-4">
          <h1 className="font-display text-2xl text-ivory">{t('POS Terminal')}</h1>
          <div className="flex items-center gap-5">
            <button type="button" onClick={() => setShowRecordPayment(true)} className="flex items-center gap-1.5 rounded text-sm text-ivory-dim hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
              <CreditCard size={15} strokeWidth={2} />{t('Record payment')}
            </button>
            <button type="button" onClick={() => setShowXReport(true)} className="flex items-center gap-1.5 rounded text-sm text-ivory-dim hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
              <FileText size={15} strokeWidth={2} />{t('X-report')}
            </button>
            <button type="button" onClick={() => setShowRefunds(true)} className="flex items-center gap-1.5 rounded text-sm text-danger hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
              <RotateCcw size={15} strokeWidth={2} />{t('Refunds')}
            </button>
            <button type="button" onClick={() => setShowCloseTill(true)} className="flex items-center gap-1.5 rounded text-sm text-brass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
              <Lock size={15} strokeWidth={2} />{t('Close till')}
            </button>
          </div>
        </div>
        )}
        {(isOffline || queuedCount > 0) && (
          <div className={`rounded-lg border text-sm ${focusMode ? 'mb-2 px-3 py-1.5 text-xs' : 'mb-4 px-4 py-2.5'} ${isOffline ? 'border-danger/40 text-danger' : 'border-warning/40 text-warning'}`}>
            {isOffline
              ? `${t('Offline - orders are being saved locally')}${queuedCount > 0 ? ` (${queuedCount} ${t('waiting to sync')})` : ''} ${t("and will send automatically once you're back online.")}`
              : `${t('Syncing')} ${queuedCount} ${t('order(s) saved while offline...')}`}
          </div>
        )}
        {quickPayOrders.length > 0 && (
          <div className={focusMode ? 'mb-2' : 'mb-4'}>
            {!focusMode && <p className="mb-1.5 text-xs uppercase tracking-wide text-ivory-dim">{t('Unpaid - tap to pay')}</p>}
            <div className="flex flex-wrap gap-1.5">
              {quickPayOrders.map((order) => {
                const isDriveThrough = order.order_type === 'drive_through';
                return (
                <div key={order.id} className={`flex items-stretch overflow-hidden rounded-full border ${isDriveThrough ? 'border-drivethrough bg-drivethrough/10' : 'border-brass/40 bg-brass/5'}`}>
                  <button
                    type="button"
                    onClick={() => setQuickPayTarget(order)}
                    className={`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${isDriveThrough ? 'text-drivethrough hover:bg-drivethrough/20' : 'text-ivory hover:bg-brass/10'} ${focusMode ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'}`}
                  >
                    {quickPayLabel(order)}
                  </button>
                  {['walk_in', 'pickup'].includes(order.order_type) && (
                    <button
                      type="button"
                      onClick={() => setConvertingOrder(order)}
                      title={t('Seat this customer at a table')}
                      className={`border-s border-brass/40 text-brass hover:bg-brass/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${focusMode ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm'}`}
                    >
                      {t('Sit down')}
                    </button>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        )}
        <div className={`relative ${focusMode ? 'mb-2' : 'mb-3'}`}>
          <Search size={16} strokeWidth={2} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ivory-dim" />
          <input
            type="search"
            value={itemSearchQuery}
            onChange={(e) => setItemSearchQuery(e.target.value)}
            placeholder={t('Search items...')}
            className={`w-full rounded-lg border border-ink-line bg-ink-soft ps-9 pe-3 text-base text-ivory placeholder:text-ivory-dim/60 ${focusMode ? 'py-1.5' : 'py-2.5'}`}
          />
        </div>
        {isFuzzyFallback && (
          <p className="mb-3 -mt-1.5 text-xs text-brass">{t('No exact match - showing close results for')} "{itemSearchQuery}"</p>
        )}
        {/* Bigger touch targets throughout this page on purpose - real
            terminals get tapped on a touchscreen, not clicked with a
            mouse, and get tapped hundreds of times a shift. Active
            state gets real elevation (matches .card-elevated's shadow
            language) instead of a flat color fill, so the current
            category reads as physically raised, not just recolored. */}
        <div className="flex items-center gap-2">
          <div className={`flex flex-1 gap-2.5 overflow-x-auto pb-2 ${itemSearchQuery.trim() ? 'pointer-events-none opacity-40' : ''}`}>
            {categories.map((c) => (
              <button type="button"
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`whitespace-nowrap rounded-full font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${focusMode ? 'px-3.5 py-1.5 text-xs' : 'px-5 py-2.5 text-sm'} ${
                  activeCategory === c.id ? 'card-elevated bg-brass text-ink' : 'border border-ink-line text-ivory-dim hover:border-brass/50 hover:text-ivory'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
        {/* Real, explicit request: no reordering here at all - a tap on
            a POS tile always adds it to the cart immediately, nothing
            else. Reordering the menu itself is a Menu Management concern
            now (see that page), not something staff can accidentally
            trigger while actually trying to ring up an order. */}
        {/* Real fix for the explicit request: a fixed 12-item page per
            category, real pagination instead of endless scroll or an
            ever-taller grid - left/right page buttons only appear once a
            category actually spills past one page. In focus mode the
            grid goes denser (more columns, smaller tiles) specifically
            so a full 12-item page still fits without the page needing to
            scroll, whatever else is on screen. */}
        <div className="relative mt-3">
          <div className={`grid gap-2.5 ${focusMode ? 'grid-cols-4 sm:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'}`}>
            {pageItems.map((item) => (
              <button type="button" key={item.id}
                onClick={() => addToCart(item)}
                className="relative select-none overflow-hidden rounded-xl border border-ink-line bg-ink-soft text-left transition-all duration-200 hover:border-brass/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
              >
                  {/* Photo recognition matters at the counter - a busy
                      cashier reads a picture far faster than a name, which is
                      exactly what a plain text tile made slower. Falls back
                      to a plain tile only if this item genuinely has no
                      photo uploaded yet. */}
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className={focusMode ? 'h-12 w-full object-cover' : 'h-20 w-full object-cover sm:h-24'} loading="lazy" draggable={false} />
                  ) : (
                    <div className={`flex w-full items-center justify-center bg-ink text-ivory-dim/30 ${focusMode ? 'h-12' : 'h-20 sm:h-24'}`}>
                      <UtensilsCrossed size={focusMode ? 16 : 22} strokeWidth={1.5} />
                    </div>
                  )}
                  <div className={focusMode ? 'p-1.5' : 'p-2.5'}>
                    <p className={`font-display text-ivory line-clamp-1 ${focusMode ? 'text-xs' : 'text-sm'}`}>{item.name}</p>
                    <p className={`font-medium text-brass ${focusMode ? 'text-xs' : 'mt-0.5 text-sm'}`}>AED {item.price.toFixed(2)}</p>
                  </div>
              </button>
            ))}
            {visibleItems.length === 0 && <p className="text-ivory-dim">{t('No items in this category.')}</p>}
          </div>
          {totalItemPages > 1 && (
            <div className="mt-3 flex items-center justify-center gap-3">
              <button type="button" onClick={() => setItemsPage((p) => Math.max(0, p - 1))} disabled={safeItemsPage === 0}
                aria-label={t('Previous page')}
                className="flex items-center justify-center rounded-full border border-ink-line bg-ink-soft p-1.5 text-ivory-dim hover:text-brass disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
                <ChevronLeft size={18} strokeWidth={2} />
              </button>
              <span className="text-xs text-ivory-dim">{safeItemsPage + 1} / {totalItemPages}</span>
              <button type="button" onClick={() => setItemsPage((p) => Math.min(totalItemPages - 1, p + 1))} disabled={safeItemsPage === totalItemPages - 1}
                aria-label={t('Next page')}
                className="flex items-center justify-center rounded-full border border-ink-line bg-ink-soft p-1.5 text-ivory-dim hover:text-brass disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
                <ChevronRight size={18} strokeWidth={2} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Real fix for the explicit request: rather than shrinking every
          field's padding by hand (high risk of breaking something for
          marginal gain), this panel gets a capped height with its own
          internal scroll in focus mode - the same pattern real POS
          systems (Toast, Square) use for the order summary sidebar. The
          outer page itself never needs to scroll in focus mode; if a
          long cart genuinely doesn't fit, only this panel scrolls. */}
      <div className={`divide-y divide-ink-line rounded-2xl border border-ink-line bg-ink-soft shadow-sm ${focusMode ? 'max-h-[calc(100vh-88px)] overflow-y-auto' : ''}`}>
        <div className="p-4">
          <Field label={t('Order type')}>
            <div className="grid grid-cols-4 gap-1.5">
              {(['dine_in', 'walk_in', 'pickup', 'delivery'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setOrderType(type)}
                  className={`rounded-full border px-2 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${
                    orderType === type ? 'border-brass bg-brass/10 text-brass' : 'border-ink-line text-ivory-dim hover:text-ivory'
                  }`}
                >
                  {t(ORDER_TYPE_LABELS[type])}
                </button>
              ))}
            </div>
          </Field>
          {/* Real fix for a confirmed bug: this used to default to the
              literal string "Walk-in" every time, and the Orders page
              groups tickets by this exact string - so every walk-in order
              rung up in a day collapsed into one shared bucket unless
              staff manually retyped something unique each time. Left
              blank now, the server auto-numbers it ("Walk-in #7") against
              today's real count for this business - never collides again,
              even across multiple POS terminals ringing up orders at
              once - while still overridable with a real name/phone/table
              number when that's useful. */}
          {orderType === 'dine_in' ? (
            <Field label={t('Table')} className="mt-3">
              <select value={selectedCardId} onChange={(e) => setSelectedCardId(e.target.value)} className={inputClass}>
                <option value="">{t('Choose a table...')}</option>
                {floorTables.map((tbl) => (
                  <option key={tbl.id} value={tbl.id} disabled={tbl.status === 'occupied'}>
                    {tbl.label}{!tbl.card ? ` - ${t('no card connected')}` : ''} {tbl.status === 'occupied' ? `- ${t('occupied')}` : tbl.status === 'reserved' ? `- ${t('reserved')}` : ''}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-ivory-dim">
                {t("This links the order to the customer's own Pay Bill.")}
              </p>
            </Field>
          ) : (
          <Field label={t(ORDER_TYPE_FIELD_LABEL[orderType])} className="mt-3">
            <input
              value={tableLabel}
              onChange={(e) => setTableLabel(e.target.value)}
              className={inputClass}
              placeholder={t(ORDER_TYPE_PLACEHOLDER[orderType])}
            />
          </Field>
          )}
          {/* Already fully supported server-side (orders.note + a per-item
              note on order_items) - this input was simply never added
              here before now. */}
          <Field label={t('Notes (kitchen-visible)')} className="mt-3">
            <textarea
              value={orderNote}
              onChange={(e) => setOrderNote(e.target.value)}
              rows={2}
              placeholder={t('e.g. no onions, allergy, extra spicy...')}
              className={`${inputClass} resize-none`}
            />
          </Field>
        </div>

        {/* Real, explicit request: one small button that clears the
            whole order at once - a customer changing their mind after
            several items are already in used to mean removing every
            line one at a time. Only shows once there's actually
            something to clear. */}
        {cart.length > 0 && (
          <div className="flex items-center justify-between border-t border-ink-line px-4 pt-3">
            <span className="text-xs font-medium uppercase tracking-wide text-ivory-dim">{t('Order')}</span>
            <button type="button" onClick={clearCart} aria-label={t('Clear order')}
              title={t('Clear order')}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-ink-line text-ivory-dim hover:border-danger/50 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
            >
              <Minus size={14} strokeWidth={2.25} />
            </button>
          </div>
        )}
        <div className="max-h-96 space-y-2.5 overflow-y-auto p-4">
          {cart.map((line) => (
            <div key={line.menuItemId} className="space-y-1.5 border-b border-ink-line/50 pb-2.5 last:border-0 last:pb-0">
              <div className="flex items-center justify-between gap-2 text-base">
                <span className="font-display text-ivory">{line.name}</span>
                <div className="flex items-center gap-2.5">
                  <button type="button" onClick={() => changeQty(line.menuItemId, -1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-line text-ivory-dim hover:border-brass/50 hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
                    <Minus size={14} strokeWidth={2.25} />
                  </button>
                  <span className="w-5 text-center text-ivory">{line.quantity}</span>
                  <button type="button" onClick={() => changeQty(line.menuItemId, 1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-line text-ivory-dim hover:border-brass/50 hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
                    <Plus size={14} strokeWidth={2.25} />
                  </button>
                  <span className="w-16 text-right font-medium text-brass">{(line.price * line.quantity).toFixed(2)}</span>
                </div>
              </div>
              {/* Optional - leaving this on "Fire now" (the default) fires
                  the item immediately, same as before this existed. Only
                  matters for full-service tables holding mains back until
                  starters are cleared. */}
              <select
                value={line.course}
                onChange={(e) => setLineCourse(line.menuItemId, e.target.value)}
                className="rounded border border-ink-line bg-ink px-1.5 py-0.5 text-xs text-ivory-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
              >
                <option value="">{t('Fire now')}</option>
                <option value="Starter">{t('Hold: Starter')}</option>
                <option value="Main">{t('Hold: Main')}</option>
                <option value="Dessert">{t('Hold: Dessert')}</option>
              </select>
            </div>
          ))}
          {cart.length === 0 && <p className="text-ivory-dim">{t('Cart is empty.')}</p>}
        </div>

        <div className="space-y-2 p-4">
          <div className="flex items-center gap-2">
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as '' | 'percentage' | 'fixed')}
              className="rounded-lg border border-ink-line bg-ink px-2.5 py-1.5 text-sm text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
            >
              <option value="">{t('No discount')}</option>
              <option value="percentage">{t('% off')}</option>
              <option value="fixed">{t('AED off')}</option>
            </select>
            {discountType && (
              <input
                type="number"
                min={0}
                max={discountType === 'percentage' ? 100 : undefined}
                value={discountValue}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
                className="w-20 rounded-lg border border-ink-line bg-ink px-2.5 py-1.5 text-sm text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
              />
            )}
          </div>
          {discountType && (
            <input
              value={discountReason}
              onChange={(e) => setDiscountReason(e.target.value)}
              placeholder={t('Reason (required - e.g. regular customer, kitchen delay)')}
              className="w-full rounded-lg border border-ink-line bg-ink px-2.5 py-1.5 text-sm text-ivory placeholder:text-ivory-dim/60"
            />
          )}
        </div>

        <div className="space-y-1 p-4">
          {discountAmount > 0 && (
            <>
              <div className="flex justify-between text-sm text-ivory-dim">
                <span>{t('Subtotal')}</span>
                <span>AED {cartSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-danger">
                <span>{t('Discount')}</span>
                <span>−AED {discountAmount.toFixed(2)}</span>
              </div>
            </>
          )}
          <div className="flex items-baseline justify-between">
            <span className="text-ivory">{t('Total')}</span>
            <span className="font-display text-2xl text-brass">AED {cartTotal.toFixed(2)}</span>
          </div>
          {error && <p className="mt-2 text-base text-danger">{error}</p>}
        </div>

        {isHotel && (
          <div className="p-4">
            <div className="rounded-lg border border-brass/30 bg-ink p-3">
              <p className="mb-2 text-sm text-ivory">{t('Charge to Room')}</p>
              {roomFolio ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ivory">Room {roomFolio.roomNumber}{roomFolio.guestName ? ` · ${roomFolio.guestName}` : ''}</span>
                  <button type="button" onClick={() => { setRoomFolio(null); setRoomNumber(''); }} className="rounded text-ivory-dim hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">{t('Change')}</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRoomLookup()}
                    placeholder={t('Room number')}
                    className="flex-1 rounded-lg border border-ink-line bg-ink-soft px-3 py-2 text-sm text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
                  />
                  <button type="button" onClick={handleRoomLookup} disabled={lookingUpRoom} className="rounded-lg border border-brass/40 px-3 py-2 text-sm text-brass hover:bg-brass/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
                    {lookingUpRoom ? t('Looking up...') : t('Find')}
                  </button>
                </div>
              )}
              {roomLookupError && <p className="mt-1 text-sm text-danger">{roomLookupError}</p>}
            </div>
          </div>
        )}

        {/* Send to Kitchen and Payment both create the order for real
            (unpaid) - Payment continues straight into the shared
            PaymentModal for whatever was just created, Send to Kitchen
            stops there and leaves it open for later (a dine-in table
            settling at the end of the meal, a pickup order paid on
            collection). Charge to Room stays its own immediate action -
            charging to a guest's room genuinely is the settlement, no
            cash/card tender choice involved. */}
        <div className="space-y-2 p-4">
          {isHotel && (
            <button type="button"
              onClick={handleChargeToRoom}
              disabled={checkingOut || cart.length === 0 || !roomFolio}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-brass/40 px-4 py-3.5 text-base font-medium text-brass hover:bg-brass/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
            >
              {t('Charge to Room')}{roomFolio ? ` ${roomFolio.roomNumber}` : ''}
            </button>
          )}
          <button type="button" onClick={() => handleSendToKitchen(false)} disabled={checkingOut || cart.length === 0} className="flex w-full items-center justify-center gap-2 rounded-full bg-success px-4 py-3.5 text-base font-medium text-status-text hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
            {t('Send to Kitchen')}
          </button>
          <button type="button" onClick={() => handleSendToKitchen(true)} disabled={checkingOut || cart.length === 0} className="flex w-full items-center justify-center gap-2 rounded-full bg-brass px-4 py-3.5 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
            {t('Payment')}
          </button>
        </div>
      </div>

      {pendingPayment && (
        <PaymentModal
          businessId={businessId}
          items={pendingPayment.items}
          defaultMode="card"
          onClose={() => setPendingPayment(null)}
          onDone={() => { setPendingPayment(null); setConfirmed({ total: cartTotal, headline: t('Payment received'), detail: t('Paid in full') }); }}
        />
      )}
      {quickPayTarget && (
        <PaymentModal
          businessId={businessId}
          items={quickPayTarget.order_items.filter((i) => !i.voided && !i.paid).map((i) => ({
            id: i.id, orderId: quickPayTarget.id, name: i.item_name, unitPrice: i.unit_price, addonTotal: i.addon_total, quantity: i.quantity,
          }))}
          defaultMode="card"
          onClose={() => setQuickPayTarget(null)}
          onDone={() => {
            setQuickPayTarget(null);
            reloadQuickPay();
            setConfirmed({ total: quickPayTarget.order_items.reduce((s, i) => s + (i.unit_price + i.addon_total) * i.quantity, 0), headline: t('Payment received'), detail: t('Paid in full') });
          }}
        />
      )}
      {convertingOrder && (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-ink/80 px-4" onClick={() => setConvertingOrder(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-ink-line bg-ink-soft p-5 shadow-2xl shadow-black/50" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-lg text-ivory">{t('Seat')} {quickPayLabel(convertingOrder)}</h2>
            <p className="mt-1 text-sm text-ivory-dim">{t('Pick which table they moved to - their order comes with them.')}</p>
            <select value={convertCardId} onChange={(e) => setConvertCardId(e.target.value)} className={`${inputClass} mt-3`}>
              <option value="">{t('Choose a table')}</option>
              {floorTables.map((tbl) => (
                <option key={tbl.id} value={tbl.id} disabled={tbl.status === 'occupied'}>
                  {tbl.label} {tbl.status === 'occupied' ? `- ${t('occupied')}` : ''}
                </option>
              ))}
            </select>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setConvertingOrder(null)} className="flex-1 rounded-full border border-ink-line py-2.5 text-sm text-ivory-dim hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
                {t('Cancel')}
              </button>
              <button type="button" onClick={handleConvertToDineIn} disabled={!convertCardId || convertSaving} className="flex-1 rounded-full bg-brass py-2.5 text-sm font-medium text-ink hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
                {convertSaving ? t('Seating...') : t('Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
      {showRecordPayment && (
        <RecordPaymentFlow
          businessId={businessId}
          orders={quickPayOrders}
          onClose={() => setShowRecordPayment(false)}
          onDone={() => { setShowRecordPayment(false); reloadQuickPay(); }}
        />
      )}
      {showXReport && (
        <XReportPanel businessId={businessId} tillId={till.id} onClose={() => setShowXReport(false)} />
      )}
    </div>
    </>
  );
}

// Real requirement: staff needed to leave the POS terminal entirely and
// go find the separate Payments admin page just to issue a refund for
// the customer standing right in front of them at the counter. Reuses
// the exact same PaymentRowItem component (and therefore the exact
// same refund logic, gateway routing, and manual-payment blocking) the
// Payments page already uses - one refund system, two entry points,
// never two implementations that could drift apart.
function RefundsPanel({ businessId }: { businessId: string }) {
  const { t } = useT();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'refundable' | 'refunded'>('refundable');

  function reload() {
    listPayments(businessId).then(setPayments).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(reload, [businessId]);
  usePollingFallback(reload, !!businessId);

  const filtered = payments
    .filter((p) => {
      if (filter === 'refundable') return p.status === 'completed' && !p.refunded && !p.provider?.startsWith('manual_') && !p.provider?.startsWith('pos_');
      if (filter === 'refunded') return p.refunded;
      return true;
    })
    .filter((p) => {
      if (!search.trim()) return true;
      const total = (Number(p.amount) + Number(p.tip_amount)).toFixed(2);
      return total.includes(search.trim()) || p.provider?.toLowerCase().includes(search.trim().toLowerCase());
    });

  return (
    <Section title={t('Refunds')}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('Search by amount or method...')}
          className={`${inputClass} max-w-xs`}
        />
        <div className="flex gap-1.5">
          {(['refundable', 'refunded', 'all'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1.5 text-sm capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${
                filter === f ? 'border-danger bg-danger/10 text-danger' : 'border-ink-line text-ivory-dim hover:text-ivory'
              }`}
            >
              {f === 'refundable' ? t('Refundable') : f === 'refunded' ? t('Refunded') : t('All')}
            </button>
          ))}
        </div>
      </div>
      {loading && <p className="text-ivory-dim">{t('Loading...')}</p>}
      <div className="space-y-2">
        {filtered.map((payment) => (
          <PaymentRowItem key={payment.id} payment={payment} businessId={businessId} onChange={reload} />
        ))}
        {!loading && filtered.length === 0 && (
          <p className="text-ivory-dim">
            {filter === 'refundable' ? t('No refundable payments right now.') : t('Nothing here yet.')}
          </p>
        )}
      </div>
    </Section>
  );
}

// Real, read-only - fetches the snapshot once on open and shows it.
// No close/confirm action here at all, deliberately: an X-report that
// could accidentally finalize anything wouldn't be a real X-report.
function XReportPanel({ businessId, tillId, onClose }: { businessId: string; tillId: string; onClose: () => void }) {
  const { t } = useT();
  const [report, setReport] = useState<XReport | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getXReport(businessId, tillId).then(setReport).catch((err) => setError(err instanceof Error ? err.message : 'Could not load report'));
  }, [businessId, tillId]);

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-ink/80 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-ink-line bg-ink-soft p-6 shadow-2xl shadow-black/50">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-ivory">{t('X-report')}</h2>
          <button type="button" onClick={onClose} className="rounded text-base text-ivory-dim hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">{t('Close')}</button>
        </div>
        <p className="mb-4 text-sm text-ivory-dim">{t('A snapshot, not a close - the till stays open.')}</p>
        {error && <p className="text-sm text-danger">{error}</p>}
        {!report && !error && <p className="text-ivory-dim">{t('Loading...')}</p>}
        {report && (
          <div className="space-y-2 text-base">
            <div className="flex justify-between"><span className="text-ivory-dim">{t('Opened')}</span><span className="text-ivory">{new Date(report.openedAt).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-ivory-dim">{t('Opening float')}</span><span className="text-ivory">AED {report.openingFloatAed.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-ivory-dim">{t('Cash sales')}</span><span className="text-ivory">AED {report.cashSalesTotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-ivory-dim">{t('Card sales')}</span><span className="text-ivory">AED {report.cardSalesTotal.toFixed(2)}</span></div>
            <div className="mt-3 flex justify-between border-t border-ink-line pt-3">
              <span className="text-ivory">{t('Expected cash in drawer')}</span>
              <span className="font-display text-xl text-brass">AED {report.expectedCashAed.toFixed(2)}</span>
            </div>
            <p className="text-xs text-ivory-dim">{t('Generated')} {new Date(report.generatedAt).toLocaleTimeString()}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CloseTillScreen({ businessId, till, onDone, onCancel }: { businessId: string; till: TillSession; onDone: () => void; onCancel: () => void }) {
  const { t } = useT();
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
        <p className="font-display text-2xl text-ivory">{t('Till closed')}</p>
        <div className="space-y-1 text-base text-ivory-dim">
          <p>{t('Expected:')} AED {result.expected_cash_aed?.toFixed(2)}</p>
          <p>{t('Counted:')} AED {result.counted_cash_aed?.toFixed(2)}</p>
          <p className={variance === 0 ? 'text-success' : 'text-warning'}>
            {t('Variance:')} {variance >= 0 ? '+' : ''}{variance.toFixed(2)} AED
          </p>
        </div>
        <button type="button" onClick={onDone} className="rounded-full bg-brass px-6 py-3 text-base font-medium text-ink hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">{t('Done')}</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <Section title={t('Close till')}>
        <p className="text-base text-ivory-dim">{t('Count the cash physically in the drawer and enter the real total.')}</p>
        <Field label={t('Counted cash (AED)')}>
          <input type="number" min={0} onFocus={(e) => e.target.select()} value={countedCash} onChange={(e) => setCountedCash(Number(e.target.value))} className={inputClass} />
        </Field>
        <Field label={t('Notes (optional)')}>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
        </Field>
        {error && <p className="text-base text-danger">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={handleClose} disabled={saving} className="flex-1 rounded-full bg-brass px-4 py-3 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
            {saving ? t('Closing...') : t('Close till')}
          </button>
          <button type="button" onClick={onCancel} className="rounded-full border border-ink-line px-4 py-3 text-base text-ivory-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">{t('Cancel')}</button>
        </div>
      </Section>
    </div>
  );
}
