import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import {
  listOrders, updateOrderStatus, getBusiness, ackOrderReady,
  voidOrderItem, clearTable, fireCourse,
  listRequests, dismissRequest, listLoyaltyClaims, applyManualClaim, listCashPendingItems,
  listTables, listFloorPlanCells,
  type RequestRow, type CashPendingItem,
} from '../../lib/authApi';
import { subscribeToBusinessTable, subscribeToOrderItemsForBusiness } from '../../lib/supabaseClient';
import { usePollingFallback } from '../../hooks/usePollingFallback';
import { hexToRgba } from '../../lib/color';
import { playNotificationSound } from '../../lib/soundPlayer';
import type { OrderRow, OrderStatus, NotificationSettings, LoyaltyClaim, FloorTable, FloorPlanCell } from '../../types';
import ExportButtons from '../../components/ExportButtons';
import { useConfirm } from '../../components/ConfirmDialog';
import SectionRequestNotifications from '../../components/SectionRequestNotifications';
import RecordPaymentFlow from '../../components/RecordPaymentFlow';
import FloorPlanCanvas, { tableDisplayStatus } from '../../components/FloorPlanCanvas';
import { Map as MapIcon, ListOrdered } from 'lucide-react';

const STATUS_LABEL: Record<OrderStatus, string> = {
  // listOrders filters awaiting_payment out server-side - this view never
  // actually renders it (an unpaid pay-before-order order never reaches
  // the kitchen at all), so this entry only exists to satisfy the
  // exhaustive OrderStatus type.
  awaiting_payment: 'Awaiting payment',
  pending: 'New',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_STYLE: Record<OrderStatus, string> = {
  awaiting_payment: 'border-ink-line text-ivory-dim',
  pending: 'border-brass text-brass',
  preparing: 'border-brass/70 text-brass',
  ready: 'border-success/50 text-success',
  completed: 'border-ink-line text-ivory-dim',
  cancelled: 'border-danger/40 text-danger',
};

const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

// Same component/logic as Kitchen's own ArrivalCountdown (a live
// countdown to when the drive-through customer actually arrives, not
// when the order was placed) - defined here separately rather than
// imported, since KitchenPage.tsx doesn't export it and the two pages
// have no other shared-component relationship to build on.
function ArrivalCountdown({ arrivalAt }: { arrivalAt: string }) {
  const { t } = useT();
  const minutes = Math.round((new Date(arrivalAt).getTime() - Date.now()) / 60000);
  const label = minutes <= 0 ? t('Arriving now') : `${minutes} ${t('min')}`;
  return <span className="font-mono text-sm text-drivethrough">{label}</span>;
}

export default function OrdersPage() {
  const { user } = useSession();
  const { t } = useT();
  const navigate = useNavigate();
  const { payBillEnabled } = useOutletContext<{ focusMode?: boolean; payBillEnabled: boolean | null }>();
  const businessId = user?.business_id;
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [recentOpen, setRecentOpen] = useState(false);
  const [newOrderPulse, setNewOrderPulse] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [showRecordPayment, setShowRecordPayment] = useState(false);

  // Real, explicit addition: the flip page. "view" swaps between the
  // exact same Orders content that's always been here and the new
  // spatial Tables Map - both read the same live orders/tables data,
  // this is genuinely one data layer with two renderers, not two
  // separate pages duplicating logic.
  const [view, setView] = useState<'orders' | 'map'>('orders');
  const [floorTables, setFloorTables] = useState<FloorTable[]>([]);
  const [floorDataLoaded, setFloorDataLoaded] = useState(false);
  const [floorCells, setFloorCells] = useState<FloorPlanCell[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [tableRecordPayment, setTableRecordPayment] = useState(false);

  // Attention panel state - same four sources as the old Requests page,
  // now living at the top of Orders instead, plus the new "order ready"
  // notification.
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [claims, setClaims] = useState<LoyaltyClaim[]>([]);
  const [cashPending, setCashPending] = useState<CashPendingItem[]>([]);

  function reload() {
    if (businessId) listOrders(businessId).then(setOrders).catch(() => {});
  }
  function reloadRequests() {
    if (businessId) listRequests(businessId).then((all) => setRequests(all.filter((r) => r.status !== 'completed'))).catch(() => {});
  }
  function reloadClaims() {
    if (businessId) listLoyaltyClaims(businessId).then(setClaims).catch(() => {});
  }
  function reloadCashPending() {
    if (businessId) listCashPendingItems(businessId).then(setCashPending).catch(() => {});
  }
  // Only fetched/subscribed when the map view is actually in use -
  // most businesses will spend most of their time on the Orders side,
  // no reason to keep this live for a view nobody's looking at.
  //
  // Real bug fix (confirmed by explicit report - "Tables are taking a
  // long time to load and now it's not loading at all", alongside
  // dozens of repeated console errors): these two, and every other
  // reload function in this file, were missing .catch() entirely. With
  // usePollingFallback calling them every 5 seconds regardless of
  // whether the previous attempt succeeded, a single transient failure
  // (a 429, a brief network blip) became an uncaught promise rejection
  // repeating forever, every 5 seconds, for as long as the underlying
  // condition persisted - exactly the flood of identical console
  // errors in the report, and exactly why the map never recovered on
  // its own even after the underlying condition (the rate limit fix
  // above) would have cleared.
  function reloadFloorTables() {
    if (businessId) listTables(businessId).then((rows) => { setFloorTables(rows); setFloorDataLoaded(true); }).catch(() => setFloorDataLoaded(true));
  }
  function reloadFloorCells() {
    if (businessId) listFloorPlanCells(businessId).then(setFloorCells).catch(() => {});
  }

  useEffect(reload, [businessId]);
  useEffect(reloadRequests, [businessId]);
  useEffect(reloadClaims, [businessId]);
  useEffect(reloadCashPending, [businessId]);
  // Real, explicit fix (confirmed by explicit report: a visible delay
  // before the floor plan appears on flipping to it) - the data itself
  // is now fetched once, eagerly, right on page load, so it's already
  // there by the time anyone actually flips to the map. Only the
  // ONGOING realtime subscription and 5-second poll stay gated to the
  // map actually being the active view - that's the part that was ever
  // meant to be conditional (continuous background cost, not this
  // page's very first load), not the one-time initial fetch.
  useEffect(() => {
    if (!businessId) return;
    reloadFloorTables();
    reloadFloorCells();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);
  useEffect(() => {
    if (view !== 'map' || !businessId) return;
    const unsubTables = subscribeToBusinessTable(businessId, 'tables', reloadFloorTables);
    const unsubCells = subscribeToBusinessTable(businessId, 'floor_plan_cells', reloadFloorCells);
    return () => { unsubTables(); unsubCells(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, businessId]);
  usePollingFallback(() => { if (view === 'map') { reloadFloorTables(); reloadFloorCells(); } }, view === 'map' && !!businessId);
  // Explicit, system-wide request: an independent 5-second poll of all
  // four of this page's own reload functions, completely separate from
  // the realtime subscriptions below - a safety net so a missed/dropped
  // Realtime event is never more than 5s stale, with no manual refresh.
  usePollingFallback(() => { reload(); reloadRequests(); reloadClaims(); reloadCashPending(); }, !!businessId);
  useEffect(() => {
    if (businessId) getBusiness(businessId).then((b) => setNotificationSettings(b.notification_settings));
  }, [businessId]);

  // Real-time, instant, everywhere on this page - a new order, an order
  // going ready, a cash-pending flag, all reflect immediately across
  // every open screen without anyone needing to refresh.
  useEffect(() => {
    if (!businessId) return;
    const unsubscribe = subscribeToBusinessTable(businessId, 'orders', (row) => {
      const requestType = row.request_type as string;
      if (requestType === 'order') {
        reload();
        if (row.status === 'pending') {
          setNewOrderPulse(true);
          setTimeout(() => setNewOrderPulse(false), 2000);
          if (notificationSettings) playNotificationSound(notificationSettings.newOrder);
        }
      } else {
        reloadRequests();
        if (notificationSettings) {
          if (requestType === 'call_waiter') playNotificationSound(notificationSettings.callWaiter);
          else if (requestType === 'request_bill') playNotificationSound(notificationSettings.requestBill);
        }
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, notificationSettings]);

  useEffect(() => {
    const unsubscribe = subscribeToOrderItemsForBusiness((row) => {
      if (!row.cash_pending && !row.paid) return;
      reloadCashPending();
      reload();
      if (row.cash_pending && notificationSettings) {
        setNewOrderPulse(true);
        setTimeout(() => setNewOrderPulse(false), 2000);
        playNotificationSound(notificationSettings.requestBill);
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificationSettings]);

  useEffect(() => {
    if (!businessId) return;
    const unsubscribe = subscribeToBusinessTable(businessId, 'loyalty_reward_claims', () => {
      reloadClaims();
      if (notificationSettings) playNotificationSound(notificationSettings.callWaiter);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, notificationSettings]);

  useEffect(() => {
    if (!businessId) return;
    const unsubscribe = subscribeToBusinessTable(businessId, 'loyalty_reward_claims', reloadClaims);
    return unsubscribe;
  }, [businessId]);

  async function handleDismissRequest(id: string) {
    setRequests((prev) => prev.filter((r) => r.id !== id));
    try {
      await dismissRequest(businessId!, id);
    } catch {
      reloadRequests();
    }
  }

  async function handleApplyClaim(id: string) {
    setClaims((prev) => prev.filter((c) => c.id !== id));
    try {
      await applyManualClaim(businessId!, id);
    } catch {
      reloadClaims();
    }
  }

  async function handleAckReady(orderId: string) {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ready_ack: true } : o)));
    try {
      await ackOrderReady(businessId!, orderId);
    } catch {
      reload();
    }
  }

  if (!businessId) return null;

  // Voided orders are excluded from every active/past grouping entirely -
  // that's the actual point of voiding, not just a status label.
  const visible = orders.filter((o) => !o.voided);
  const active = visible.filter((o) => o.status !== 'completed' && o.status !== 'cancelled');
  const past = visible
    .filter((o) => o.status === 'completed' || o.status === 'cancelled')
    .filter((o) => Date.now() - new Date(o.created_at).getTime() < RECENT_WINDOW_MS);
  const readyUnacked = visible.filter((o) => o.status === 'ready' && !o.ready_ack);

  // Grouped by table - one card per table, each order inside it shown as
  // its own labeled section (never merged at the data level - each order
  // stays a real, separate record, this is purely a display grouping).
  // Real fix made while adding drive-through: every drive-through order
  // has an empty table_label (there's no table at all) - grouping by
  // that label alone would have silently merged multiple simultaneous
  // drive-through orders together, and merged them with any other
  // no-table order too. Each drive-through order gets its own real key
  // (its own id) so it always renders as its own separate card,
  // regardless of how many are active at once. Every other order type's
  // existing grouping behavior is untouched.
  const tableGroups = active.reduce<Record<string, OrderRow[]>>((acc, o) => {
    const key = o.order_type === 'drive_through' ? `drive-through-${o.id}` : (o.table_label || t('No table'));
    (acc[key] ||= []).push(o);
    return acc;
  }, {});

  // A group whose every item across every one of its orders has been
  // individually voided - OR fully paid - has nothing left to act on.
  // Neither the order's own status nor a manual "Mark completed" click
  // is required for either case: voiding one item at a time never
  // flips status on its own, and paying off every item shouldn't need
  // a separate confirmation once there's genuinely nothing left owing.
  for (const table of Object.keys(tableGroups)) {
    const remainingItems = tableGroups[table].flatMap((o) => (o.order_items || []).filter((i) => !i.voided));
    const anyItemLeft = remainingItems.length > 0;
    const anyUnpaid = remainingItems.some((i) => !i.paid);
    if (!anyItemLeft || !anyUnpaid) delete tableGroups[table];
  }

  const hasAttentionItems = requests.length > 0 || claims.length > 0 || cashPending.length > 0 || readyUnacked.length > 0;

  return (
    <div className="space-y-10">
      {businessId && <SectionRequestNotifications businessId={businessId} section="orders" />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-3xl text-ivory">{t('Orders')}</h1>
          {newOrderPulse && <span className="h-2 w-2 animate-pulse rounded-full bg-brass" />}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* The flip toggle - big, thumb-reachable, touch-first (not a
              keyboard shortcut), per the explicit requirement. Orders
              and Tables Map read the exact same live data underneath;
              this only changes which side is currently shown. */}
          <div data-tour="orders-map-toggle" className="flex items-center gap-1 rounded-lg border border-ink-line bg-ink p-1">
            <button type="button" onClick={() => setView('orders')}
              className={`flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium transition-colors ${view === 'orders' ? 'bg-brass text-ink' : 'text-ivory-dim hover:text-ivory'}`}
            >
              <ListOrdered size={15} strokeWidth={2} /> {t('Orders')}
            </button>
            <button type="button" onClick={() => setView('map')}
              className={`flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium transition-colors ${view === 'map' ? 'bg-brass text-ink' : 'text-ivory-dim hover:text-ivory'}`}
            >
              <MapIcon size={15} strokeWidth={2} /> {t('Tables Map')}
            </button>
          </div>
          {/* Order creation now lives only in POS Terminal (see #8) - this
              used to open its own duplicate "staff order" form here too,
              which was exactly the confusing overlap between Orders and
              POS. This page is now purely the live status/notifications
              feed; POS is the only place a new order gets created. */}
          <button type="button" onClick={() => navigate('/admin/dashboard/pos')} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">
            {t('Take an order in POS →')}
          </button>
          {/* Real bug fix (confirmed by explicit report: the header
              button visibly flashed "Table Receipts" then flipped to
              "Record payment" a moment later, every single page load).
              payBillEnabled used to default to false, which IS "Table
              Receipts" - so that button always rendered first no matter
              what the real setting was, then silently swapped once the
              actual fetch resolved. A genuine third "not known yet"
              state means neither button (nor the wrong one) ever
              renders before the real answer is in. */}
          {payBillEnabled === true && (
            <button type="button"
              onClick={() => setShowRecordPayment(true)}
              className="rounded-lg border border-brass/40 px-3.5 py-1.5 text-sm text-brass hover:bg-brass/10"
            >
              {t('Record payment')}
            </button>
          )}
          {payBillEnabled === false && (
            <button type="button"
              onClick={() => navigate('/admin/dashboard/table-receipts')}
              className="rounded-lg border border-brass/40 px-3.5 py-1.5 text-sm text-brass hover:bg-brass/10"
            >
              {t('Table Receipts')}
            </button>
          )}
          <ExportButtons businessId={businessId} kind="orders" />
        </div>
      </div>

      {hasAttentionItems && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {readyUnacked.map((o) => (
            <div key={o.id} className="rounded-lg border border-success/50 bg-success/10 p-3">
              <p className="text-sm font-medium text-success">
                {t('Ready —')} <span className="text-ivory">{o.table_label || t('No table')}</span>
              </p>
              <button type="button" onClick={() => handleAckReady(o.id)} className="mt-2 w-full rounded-md border border-success px-2 min-h-[36px] py-1.5 text-xs text-success hover:bg-success/10">
                {t('Dismiss')}
              </button>
            </div>
          ))}
          {requests.map((r) => {
            const customBg = r.request_color ? hexToRgba(r.request_color, 0.1) : null;
            const customStyle = r.request_color && customBg ? { borderColor: r.request_color, backgroundColor: customBg } : undefined;
            return (
              <div key={r.id} className={`rounded-lg border p-3 ${customStyle ? '' : 'border-brass/50 bg-brass/10'}`} style={customStyle}>
                <p className="text-sm font-medium" style={customStyle ? { color: r.request_color! } : undefined}>
                  <span className={customStyle ? '' : 'text-brass'}>
                    {r.request_type === 'call_waiter' ? t('Call waiter') : r.request_type === 'request_bill' ? t('Request bill') : r.custom_request_label || t('Request')}
                  </span>
                  {' — '}<span className="text-ivory">{r.table_label || t('No table')}</span>
                </p>
                <div className="mt-2 flex gap-2">
                  {r.table_label && tableGroups[r.table_label] && (
                    <a
                      href={`#table-${encodeURIComponent(r.table_label)}`}
                      className="flex-1 rounded-md border border-brass bg-brass/20 px-2 min-h-[36px] py-1.5 text-center text-xs text-brass hover:bg-brass/30"
                    >
                      {t('View order')}
                    </a>
                  )}
                  <button type="button" onClick={() => handleDismissRequest(r.id)} className="flex-1 rounded-md border border-brass px-2 min-h-[36px] py-1.5 text-xs text-brass hover:bg-brass/10">
                    {t('Dismiss')}
                  </button>
                </div>
              </div>
            );
          })}
          {cashPending.map((item) => (
            <div key={item.id} className="rounded-lg border border-warning/50 bg-warning/10 p-3">
              <p className="text-sm font-medium text-warning">
                {t('Cash pending —')} <span className="text-ivory">{item.table_label || t('No table')}</span>
              </p>
              <p className="mt-0.5 text-xs text-ivory-dim">{item.quantity}× {item.item_name}</p>
              <p className="mt-1 text-xs text-ivory-dim">{t('Use Record payment to confirm')}</p>
            </div>
          ))}
          {claims.map((c) => (
            <div key={c.id} className="rounded-lg border border-brass/50 bg-brass/10 p-3">
              <p className="text-sm font-medium text-brass">
                {t('Loyalty reward —')} <span className="text-ivory">{c.table_label || t('No table')}</span>
              </p>
              <button type="button"
                onClick={() => handleApplyClaim(c.id)}
                className="mt-2 w-full rounded-md border border-brass px-2 min-h-[36px] py-1.5 text-xs text-brass hover:bg-brass/10"
              >
                {t('Mark redeemed')}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* The actual flip: Orders content is completely unchanged below
          (same tableGroups grid, same cards, same everything), it's
          just now conditionally shown - a real 3D card-flip transition,
          not an instant swap, so it visually reads as "same data, other
          side of the card" the way it was explicitly asked for. */}
      <div style={{ perspective: 2000 }}>
        <div
          className="transition-transform duration-500"
          style={{ transformStyle: 'preserve-3d', transform: view === 'map' ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
        >
          <div style={{ backfaceVisibility: 'hidden', display: view === 'orders' ? 'block' : 'none' }}>
            {Object.keys(tableGroups).length === 0 ? (
              <p className="text-base text-ivory-dim">{t('No active orders right now.')}</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {Object.keys(tableGroups).map((table) => (
                  <TableGroup key={table} table={table} orders={tableGroups[table]} businessId={businessId} payBillEnabled={!!payBillEnabled} onOrdersChange={setOrders} onChange={reload} />
                ))}
              </div>
            )}
          </div>
          <div style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', display: view === 'map' ? 'block' : 'none' }}>
            {/* Orders with no table at all (drive-through/walk-in/pickup)
                have nowhere to sit on a spatial map - a strip here, not
                on the map itself, so "the map has everything too" holds
                without inventing a fake position for them. */}
            {(() => {
              // Real bug fix, same root cause as Table 3's: this only
              // ever checked for a missing table label, never whether
              // anything was actually still unpaid - a drive-through or
              // walk-in order that was fully paid off but never
              // formally cleared would linger here forever showing a
              // stale, already-settled amount. Mirrors the exact same
              // "anyUnpaid" check Orders' own tableGroups and the table
              // detail panel both use, and shows the real remaining
              // total (from actual unpaid items) rather than the
              // order's own stored total, which can be stale after a
              // partial payment.
              const noTableOrders = active
                .filter((o) => !o.table_label && o.order_type !== 'dine_in')
                .map((o) => ({ order: o, unpaid: (o.order_items || []).filter((i) => !i.voided && !i.paid) }))
                .filter(({ unpaid }) => unpaid.length > 0);
              return noTableOrders.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {noTableOrders.map(({ order: o, unpaid }) => (
                    <div key={o.id} className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm ${
                      o.order_type === 'drive_through' ? 'border-drivethrough bg-drivethrough/10 text-drivethrough' : 'border-brass/40 bg-brass/5 text-ivory'
                    }`}>
                      {o.order_type === 'drive_through' ? t('Drive Through') : o.order_type === 'pickup' ? t('Pickup') : t('Walk-in')}
                      {o.order_type === 'drive_through' && o.arrival_at && (
                        <span>— {Math.max(0, Math.round((new Date(o.arrival_at).getTime() - Date.now()) / 60000))} {t('min')}</span>
                      )}
                      <span className="font-mono">AED {unpaid.reduce((sum, i) => sum + (i.unit_price + i.addon_total) * i.quantity, 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
            {!floorDataLoaded ? (
              // Real fix: without this, an empty floorTables array
              // during the brief window before the first fetch resolves
              // rendered the exact same "nothing placed yet" message as
              // a business that genuinely has no floor plan at all -
              // misleading, and exactly what read as "it loads, then
              // pops in wrong-then-right". A neutral, momentary
              // placeholder instead of a false claim about the data.
              <div className="rounded-xl border border-ink-line bg-ink-soft p-8 text-center text-sm text-ivory-dim">{t('Loading...')}</div>
            ) : floorTables.filter((ft) => ft.gridX !== null).length === 0 ? (
              <div className="rounded-xl border border-ink-line bg-ink-soft p-8 text-center">
                <p className="text-base text-ivory">{t('No tables placed on the map yet')}</p>
                <p className="mt-1 text-sm text-ivory-dim">{t('Arrange your floor plan in Table Setup to see it here.')}</p>
                <button type="button" onClick={() => navigate('/admin/dashboard/tables')} className="mt-3 rounded-lg bg-brass px-4 py-2 text-sm font-medium text-ink hover:opacity-90">
                  {t('Go to Table Setup')}
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-ink-line">
                <FloorPlanCanvas tables={floorTables} cells={floorCells} onTapTable={setSelectedTableId} capWidthOnly />
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedTableId && (() => {
        const table = floorTables.find((t) => t.id === selectedTableId);
        if (!table) return null;
        const merged = table.mergedWithTableId ? floorTables.find((t) => t.id === table.mergedWithTableId) : null;
        const tableLabels = merged ? [table.label, merged.label] : [table.label];
        const tableOrders = active.filter((o) => tableLabels.includes(o.table_label));
        // Real bug fix, round 2 (confirmed by explicit report: "Table 3
        // is still showing a previous order that isn't present anywhere
        // in the system"). Traced this to a real discrepancy against
        // Orders' own tableGroups logic just above, which this panel
        // was never actually matching: Orders correctly treats a table
        // as having nothing active once every remaining item is paid
        // off, even if nobody explicitly cleared the order - "anyUnpaid"
        // in that logic, not just "anyItemLeft". This panel only ever
        // checked non-voided (displayItems used to ignore .paid
        // entirely), so a table that was fully paid off but never
        // formally cleared still showed its old, already-settled items
        // here as if they were still owed - explaining exactly why it
        // was visible on the map but nowhere else in the app: Orders
        // was hiding it correctly the whole time, this panel wasn't.
        const remainingItems = tableOrders.flatMap((o) => (o.order_items || []).filter((i) => !i.voided));
        const anyUnpaid = remainingItems.some((i) => !i.paid);
        const payableItems = anyUnpaid ? remainingItems.filter((i) => !i.paid) : [];
        const displayItems = anyUnpaid ? remainingItems : [];
        const { color, label: statusLabel } = tableDisplayStatus(table);
        const total = displayItems.reduce((sum, i) => sum + (i.unit_price + i.addon_total) * i.quantity, 0);
        return (
          <div className="fixed inset-0 z-modal flex items-center justify-end bg-ink/60 p-4" onClick={(e) => { if (e.target === e.currentTarget) setSelectedTableId(null); }}>
            <div className="w-full max-w-md rounded-2xl border-2 bg-ink-soft p-6 shadow-2xl" style={{ borderColor: color }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                {/* Real bug fix (confirmed by explicit report, visible
                    in the screenshots as literal "Table Table 1" text):
                    a table's own label already includes the word
                    "Table" (staff are prompted "e.g. Table 5" when
                    creating one) - prefixing it again here duplicated
                    it on every single table, every time. */}
                <h2 className="font-display text-2xl text-ivory">{merged ? tableLabels.join(' + ') : table.label}</h2>
                <span className="rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide" style={{ color, backgroundColor: hexToRgba(color, 0.15) || undefined }}>{t(statusLabel)}</span>
              </div>
              {table.zone && <p className="mt-1 text-sm text-ivory-dim">{table.zone} · {table.seatCount + (merged?.seatCount || 0)} {t('seats')}</p>}
              <div className="my-4 border-t border-ink-line" />
              {tableOrders.length === 0 ? (
                <p className="text-sm text-ivory-dim">{t('No active order at this table right now.')}</p>
              ) : displayItems.length === 0 ? (
                <p className="text-sm text-ivory-dim">{t('Nothing left to pay at this table.')}</p>
              ) : (
                <div className="space-y-2">
                  {displayItems.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-ivory">{item.quantity}× {item.item_name}</span>
                      <span className="font-mono text-ivory-dim">{((item.unit_price + item.addon_total) * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="my-2 border-t border-ink-line" />
                  <div className="flex justify-between text-base">
                    <span className="text-ivory">{t('Total')}</span>
                    <span className="font-mono text-brass">AED {total.toFixed(2)}</span>
                  </div>
                </div>
              )}
              <div className="mt-5 flex flex-col gap-2">
                {payBillEnabled && payableItems.length > 0 && (
                  <button type="button" onClick={() => setTableRecordPayment(true)} className="w-full rounded-lg bg-brass px-4 py-2.5 text-sm font-medium text-ink hover:opacity-90">
                    {t('Record Payment')}
                  </button>
                )}
                <button type="button" onClick={() => setSelectedTableId(null)} className="w-full rounded-lg border border-ink-line px-4 py-2.5 text-sm text-ivory-dim hover:text-ivory">
                  {t('Close')}
                </button>
              </div>
            </div>
            {tableRecordPayment && (
              <RecordPaymentFlow businessId={businessId} orders={tableOrders} onClose={() => setTableRecordPayment(false)} onDone={() => { setTableRecordPayment(false); setSelectedTableId(null); reload(); }} />
            )}
          </div>
        );
      })()}

      {past.length > 0 && (
        <div>
          <button type="button"
            onClick={() => setRecentOpen((v) => !v)}
            className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-ivory-dim hover:text-ivory"
          >
            <span>{t('Recent, last 24h')} ({past.length})</span>
            <span>{recentOpen ? '▲' : '▼'}</span>
          </button>
          {recentOpen && (
          <div className="space-y-4">
            {past.slice(0, 10).map((order) => (
              <div key={order.id} className="flex items-center justify-between rounded-lg border border-ink-line px-5 py-4 text-base">
                <span className="text-ivory-dim">
                  {order.table_label || t('No table')} — {order.total.toFixed(2)}
                  <span className="ms-2 text-sm text-ivory-dim/60">
                    {new Date(order.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    {' · '}
                    {new Date(order.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-sm ${STATUS_STYLE[order.status]}`}>
                  {t(STATUS_LABEL[order.status])}
                </span>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {showRecordPayment && (
        <RecordPaymentFlow businessId={businessId} orders={active} onClose={() => setShowRecordPayment(false)} onDone={() => { setShowRecordPayment(false); reload(); }} />
      )}
    </div>
  );
}

function TableGroup({ table, orders, businessId, payBillEnabled, onOrdersChange, onChange }: {
  table: string; orders: OrderRow[]; businessId: string; payBillEnabled: boolean; onOrdersChange: (updater: (prev: OrderRow[]) => OrderRow[]) => void; onChange: () => void;
}) {
  const { t } = useT();
  const confirm = useConfirm();
  const [clearing, setClearing] = useState(false);
  const [completing, setCompleting] = useState(false);
  // Any of these orders' card_id works to identify the table for clearing.
  const cardId = orders[0]?.card_id;
  const tableTotal = orders.reduce((sum, o) => sum + Number(o.total), 0);
  // Real, explicit request: unmistakable among normal order cards, same
  // violet used on Kitchen's own drive-through tickets - and a real
  // display label instead of the internal grouping key (see the real
  // fix in the parent component for why drive-through's group key is
  // never a real table name).
  const isDriveThrough = orders[0]?.order_type === 'drive_through';
  const arrivalAt = orders[0]?.arrival_at;

  // Flattened across every order for this table, oldest first - this is
  // what actually makes a later order "land in the same square" instead
  // of opening a new labeled box: there's no longer a per-order
  // container at all, just one continuous list every item joins.
  const allItems = orders.flatMap((order) =>
    (order.order_items || []).filter((i) => !i.voided).map((item) => ({ item, order }))
  );
  const notes = orders.filter((o) => o.note).map((o) => o.note as string);
  const syncIssue = orders.find((o) => o.pos_sync_status === 'failed');

  // Held courses across every order at this table - grouped by course
  // name since "fire the mains" should release every held main at the
  // table in one tap, not once per separate order.
  const heldByCourse = new Map<string, { orderId: string; count: number }[]>();
  for (const order of orders) {
    for (const item of order.order_items) {
      if (item.voided || item.course_status !== 'held' || !item.course) continue;
      const list = heldByCourse.get(item.course) || [];
      const existing = list.find((e) => e.orderId === order.id);
      if (existing) existing.count += 1;
      else list.push({ orderId: order.id, count: 1 });
      heldByCourse.set(item.course, list);
    }
  }
  const [firing, setFiring] = useState<string | null>(null);
  async function handleFireCourse(course: string, orderIds: string[]) {
    setFiring(course);
    try {
      await Promise.all(orderIds.map((id) => fireCourse(businessId, id, course)));
      onChange();
    } finally {
      setFiring(null);
    }
  }

  async function handleClearTable() {
    if (!cardId) return;
    if (!(await confirm({ title: t('Clear table?'), message: `${t('Clear')} ${isDriveThrough ? t('Order') : table}? ${t('This voids everything currently unpaid at this table.')}`, confirmLabel: t('Clear'), danger: true }))) return;
    setClearing(true);
    // Matches the backend's own rule exactly: skip only an order that's
    // genuinely fully paid already (that belongs to Mark Completed). An
    // order with nothing left because every item was deleted one-by-one
    // isn't "paid" - it's just empty, and still needs clearing here too.
    const affectedOrderIds = new Set(
      orders
        .filter((o) => {
          const hasUnpaidUnvoidedItems = (o.order_items || []).some((i) => !i.paid && !i.voided);
          const hasPaidItems = (o.order_items || []).some((i) => i.paid);
          return hasUnpaidUnvoidedItems || !hasPaidItems;
        })
        .map((o) => o.id)
    );
    onOrdersChange((prev) => prev.filter((o) => !affectedOrderIds.has(o.id)));
    try {
      await clearTable(businessId, cardId);
    } catch {
      onChange(); // re-sync with the server if the clear actually failed
    } finally {
      setClearing(false);
    }
  }

  async function handleMarkCompleted() {
    setCompleting(true);
    const orderIds = orders.map((o) => o.id);
    onOrdersChange((prev) => prev.filter((o) => !orderIds.includes(o.id)));
    try {
      await Promise.all(orderIds.map((id) => updateOrderStatus(businessId, id, 'completed')));
    } catch {
      onChange(); // re-sync with the server if any of them actually failed
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div id={`table-${encodeURIComponent(table)}`} className={`w-full scroll-mt-24 rounded-xl border bg-ink-soft p-3 ${isDriveThrough ? 'border-drivethrough' : 'border-ink-line'}`}>
      {isDriveThrough && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-drivethrough/10 px-2.5 py-1.5">
          <span className="text-sm font-medium uppercase tracking-wide text-drivethrough">{t('Drive Through')}</span>
          {arrivalAt && <ArrivalCountdown arrivalAt={arrivalAt} />}
        </div>
      )}
      <div className="space-y-2 text-sm">
        {heldByCourse.size > 0 && (
          <div className="space-y-1.5 rounded-lg border border-brass/30 bg-ink p-2.5">
            {[...heldByCourse.entries()].map(([course, entries]) => {
              const count = entries.reduce((s, e) => s + e.count, 0);
              return (
                <div key={course} className="flex items-center justify-between text-sm">
                  <span className="text-ivory-dim">{course} {t('held')} ({count})</span>
                  <button type="button"
                    onClick={() => handleFireCourse(course, entries.map((e) => e.orderId))}
                    disabled={firing === course}
                    className="rounded-lg bg-brass px-3 min-h-[36px] py-1.5 text-xs font-medium text-ink hover:opacity-90 disabled:opacity-50"
                  >
                    {firing === course ? t('Firing...') : `${t('Fire')} ${course}`}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {allItems.map(({ item, order }) => (
          <div key={item.id} className="flex items-start justify-between gap-2 text-ivory-dim">
            <div className="flex gap-2.5">
              <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-ink px-1 font-mono text-sm text-brass">{item.quantity}×</span>
              <div>
                <span className="font-display text-lg font-medium text-ivory">{item.item_name}</span>
                {item.course_status === 'held' && (
                  <span className="ml-2 rounded-full border border-brass/40 px-2 py-0.5 text-[10px] text-brass">{t('Held:')} {item.course}</span>
                )}
                {item.cash_pending && (
                  <span className="ml-2 rounded-full border border-warning/40 px-2 py-0.5 text-[10px] text-warning">{t('Cash pending')}</span>
                )}
                {item.addons.length > 0 && <span className="block text-sm text-brass">+ {item.addons.map((a) => a.name).join(', ')}</span>}
                {item.note && <span className="block text-sm italic text-ivory">— {item.note}</span>}
              </div>
            </div>
            <button type="button"
              onClick={() => {
                onOrdersChange((prev) =>
                  prev.map((o) =>
                    o.id === order.id
                      ? { ...o, order_items: (o.order_items || []).map((i) => (i.id === item.id ? { ...i, voided: true } : i)) }
                      : o
                  )
                );
                voidOrderItem(businessId, order.id, item.id).catch(onChange);
              }}
              className="shrink-0 text-sm text-danger hover:underline"
              title={t('Delete just this item')}
            >
              {t('Delete')}
            </button>
          </div>
        ))}
        {allItems.length === 0 && <p className="text-base italic text-ivory-dim">{t('All items deleted')}</p>}
      </div>

      <div className="mb-3 mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-ink-line pt-3">
        <div>
          <h2 className="text-sm text-ivory-dim">{isDriveThrough ? t('Order') : table}</h2>
          <p className="text-sm text-ivory-dim">
            {orders.length} {orders.length === 1 ? t('order') : t('orders')} · {tableTotal.toFixed(2)} {t('total')}
          </p>
        </div>
        {cardId && (
          <div className="flex shrink-0 gap-2">
            {!payBillEnabled && (
              <button type="button"
                onClick={handleMarkCompleted}
                disabled={completing}
                className="rounded-md border border-brass/40 px-2 min-h-[36px] py-1.5 text-xs text-brass hover:bg-brass/10 disabled:opacity-50"
              >
                {completing ? t('Completing...') : t('Mark completed')}
              </button>
            )}
            <button type="button"
              onClick={handleClearTable}
              disabled={clearing}
              className="rounded-lg border border-danger/40 px-3 py-2 text-sm text-danger hover:bg-danger/10 disabled:opacity-50"
            >
              {clearing ? t('Clearing...') : t('Clear table')}
            </button>
          </div>
        )}
      </div>

      {notes.length > 0 && (
        <div className="mt-3 space-y-1">
          {notes.map((n, i) => <p key={i} className="text-base italic text-brass">{t('Note:')} {n}</p>)}
        </div>
      )}

      {syncIssue && (
        <p className="mt-2 text-base text-ivory-dim">{t('POS sync failed')}{syncIssue.pos_sync_error ? ` — ${syncIssue.pos_sync_error}` : ''}</p>
      )}
    </div>
  );
}

