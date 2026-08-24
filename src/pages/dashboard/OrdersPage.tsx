import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import {
  listOrders, updateOrderStatus, getBusiness, ackOrderReady,
  voidOrderItem, clearTable, recordManualPayment, fireCourse,
  listRequests, dismissRequest, listLoyaltyClaims, applyManualClaim, listCashPendingItems,
  getPaymentIntegration,
  type RequestRow, type CashPendingItem,
} from '../../lib/authApi';
import { subscribeToBusinessTable, subscribeToOrderItemsForBusiness } from '../../lib/supabaseClient';
import { playNotificationSound } from '../../lib/soundPlayer';
import type { OrderRow, OrderStatus, NotificationSettings, LoyaltyClaim } from '../../types';
import ExportButtons from '../../components/ExportButtons';
import { useConfirm } from '../../components/ConfirmDialog';

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

export default function OrdersPage() {
  const { user } = useSession();
  const { t } = useT();
  const navigate = useNavigate();
  const businessId = user?.business_id;
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [recentOpen, setRecentOpen] = useState(false);
  const [newOrderPulse, setNewOrderPulse] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [payBillEnabled, setPayBillEnabled] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);

  // Attention panel state - same four sources as the old Requests page,
  // now living at the top of Orders instead, plus the new "order ready"
  // notification.
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [claims, setClaims] = useState<LoyaltyClaim[]>([]);
  const [cashPending, setCashPending] = useState<CashPendingItem[]>([]);

  function reload() {
    if (businessId) listOrders(businessId).then(setOrders);
  }
  function reloadRequests() {
    if (businessId) listRequests(businessId).then((all) => setRequests(all.filter((r) => r.status !== 'completed')));
  }
  function reloadClaims() {
    if (businessId) listLoyaltyClaims(businessId).then(setClaims);
  }
  function reloadCashPending() {
    if (businessId) listCashPendingItems(businessId).then(setCashPending);
  }

  useEffect(reload, [businessId]);
  useEffect(reloadRequests, [businessId]);
  useEffect(reloadClaims, [businessId]);
  useEffect(reloadCashPending, [businessId]);
  useEffect(() => {
    if (businessId) getBusiness(businessId).then((b) => setNotificationSettings(b.notification_settings));
  }, [businessId]);
  useEffect(() => {
    if (businessId) getPaymentIntegration(businessId).then((i) => setPayBillEnabled(!!i?.enabled));
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
  const tableGroups = active.reduce<Record<string, OrderRow[]>>((acc, o) => {
    const key = o.table_label || t('No table');
    (acc[key] ||= []).push(o);
    return acc;
  }, {});

  // A group whose every item across every one of its orders has been
  // individually voided has nothing left to act on - the order's own
  // status never changes just because its items were deleted one by
  // one, so without this it would sit here forever as an empty "All
  // items deleted" card cluttering the page.
  for (const table of Object.keys(tableGroups)) {
    const anyItemLeft = tableGroups[table].some((o) => o.order_items.some((i) => !i.voided));
    if (!anyItemLeft) delete tableGroups[table];
  }

  const hasAttentionItems = requests.length > 0 || claims.length > 0 || cashPending.length > 0 || readyUnacked.length > 0;

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-3xl text-ivory">{t('Orders')}</h1>
          {newOrderPulse && <span className="h-2 w-2 animate-pulse rounded-full bg-brass" />}
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Order creation now lives only in POS Terminal (see #8) - this
              used to open its own duplicate "staff order" form here too,
              which was exactly the confusing overlap between Orders and
              POS. This page is now purely the live status/notifications
              feed; POS is the only place a new order gets created. */}
          <button type="button" onClick={() => navigate('/admin/dashboard/pos')} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">
            {t('Take an order in POS →')}
          </button>
          {payBillEnabled && (
            <button type="button"
              onClick={() => setShowRecordPayment(true)}
              className="rounded-lg border border-brass/40 px-3.5 py-1.5 text-sm text-brass hover:bg-brass/10"
            >
              {t('Record payment')}
            </button>
          )}
          {!payBillEnabled && (
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {readyUnacked.map((o) => (
            <div key={o.id} className="pro-panel rounded-xl border border-success/50 bg-success/10 p-4">
              <p className="text-base font-medium text-success">
                {t('Ready —')} <span className="text-ivory">{o.table_label || t('No table')}</span>
              </p>
              <button type="button" onClick={() => handleAckReady(o.id)} className="mt-3 w-full rounded-lg border border-success px-3 py-3 text-base text-success hover:bg-success/10">
                {t('Dismiss')}
              </button>
            </div>
          ))}
          {requests.map((r) => (
            <div key={r.id} className="pro-panel rounded-xl border border-brass/50 bg-brass/10 p-4">
              <p className="text-base font-medium text-brass">
                {r.request_type === 'call_waiter' ? t('Call waiter') : r.request_type === 'request_bill' ? t('Request bill') : r.custom_request_label || t('Request')} — <span className="text-ivory">{r.table_label || t('No table')}</span>
              </p>
              <button type="button" onClick={() => handleDismissRequest(r.id)} className="mt-3 w-full rounded-lg border border-brass px-3 py-3 text-base text-brass hover:bg-brass/10">
                {t('Dismiss')}
              </button>
            </div>
          ))}
          {cashPending.map((item) => (
            <div key={item.id} className="pro-panel rounded-xl border border-warning/50 bg-warning/10 p-4">
              <p className="text-base font-medium text-warning">
                {t('Cash pending —')} <span className="text-ivory">{item.table_label || t('No table')}</span>
              </p>
              <p className="mt-1 text-sm text-ivory-dim">{item.quantity}× {item.item_name}</p>
              <p className="mt-2 text-sm text-ivory-dim">{t('Use Record payment to confirm')}</p>
            </div>
          ))}
          {claims.map((c) => (
            <div key={c.id} className="pro-panel rounded-xl border border-brass/50 bg-brass/10 p-4">
              <p className="text-base font-medium text-brass">
                {t('Loyalty reward —')} <span className="text-ivory">{c.table_label || t('No table')}</span>
              </p>
              <button type="button"
                onClick={() => applyManualClaim(businessId, c.id).then(reloadClaims)}
                className="mt-3 w-full rounded-lg border border-brass px-3 py-3 text-base text-brass hover:bg-brass/10"
              >
                {t('Mark redeemed')}
              </button>
            </div>
          ))}
        </div>
      )}

      {Object.keys(tableGroups).length === 0 ? (
        <p className="text-base text-ivory-dim">{t('No active orders right now.')}</p>
      ) : (
        <div className="flex flex-wrap items-start gap-6">
          {Object.keys(tableGroups).map((table) => (
            <TableGroup key={table} table={table} orders={tableGroups[table]} businessId={businessId} payBillEnabled={payBillEnabled} onOrdersChange={setOrders} onChange={reload} />
          ))}
        </div>
      )}

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

  // Flattened across every order for this table, oldest first - this is
  // what actually makes a later order "land in the same square" instead
  // of opening a new labeled box: there's no longer a per-order
  // container at all, just one continuous list every item joins.
  const allItems = orders.flatMap((order) =>
    order.order_items.filter((i) => !i.voided).map((item) => ({ item, order }))
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
    if (!(await confirm({ title: t('Clear table?'), message: `${t('Clear')} ${table}? ${t('This voids everything currently unpaid at this table.')}`, confirmLabel: t('Clear'), danger: true }))) return;
    setClearing(true);
    // Matches the backend's own rule exactly: skip only an order that's
    // genuinely fully paid already (that belongs to Mark Completed). An
    // order with nothing left because every item was deleted one-by-one
    // isn't "paid" - it's just empty, and still needs clearing here too.
    const affectedOrderIds = new Set(
      orders
        .filter((o) => {
          const hasUnpaidUnvoidedItems = o.order_items.some((i) => !i.paid && !i.voided);
          const hasPaidItems = o.order_items.some((i) => i.paid);
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
    <div className="pro-panel w-full max-w-sm rounded-2xl border border-ink-line bg-ink-soft p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-ivory">{table}</h2>
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
                className="rounded-lg border border-brass/40 px-3 py-2 text-base text-brass hover:bg-brass/10 disabled:opacity-50"
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

      <div className="space-y-3 text-lg">
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
                    className="rounded-lg bg-brass px-3 py-1.5 text-xs font-medium text-ink hover:opacity-90 disabled:opacity-50"
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
                <span className="text-ivory">{item.item_name}</span>
                {item.course_status === 'held' && (
                  <span className="ml-2 rounded-full border border-brass/40 px-2 py-0.5 text-[10px] text-brass">{t('Held:')} {item.course}</span>
                )}
                {item.cash_pending && (
                  <span className="ml-2 rounded-full border border-warning/40 px-2 py-0.5 text-[10px] text-warning">{t('Cash pending')}</span>
                )}
                {item.addons.length > 0 && <span className="block text-base text-brass/70">+ {item.addons.map((a) => a.name).join(', ')}</span>}
                {item.note && <span className="block italic">— {item.note}</span>}
              </div>
            </div>
            <button type="button"
              onClick={() => {
                onOrdersChange((prev) =>
                  prev.map((o) =>
                    o.id === order.id
                      ? { ...o, order_items: o.order_items.map((i) => (i.id === item.id ? { ...i, voided: true } : i)) }
                      : o
                  )
                );
                voidOrderItem(businessId, order.id, item.id).catch(onChange);
              }}
              className="shrink-0 text-base text-danger hover:underline"
              title={t('Delete just this item')}
            >
              {t('Delete')}
            </button>
          </div>
        ))}
        {allItems.length === 0 && <p className="text-base italic text-ivory-dim">{t('All items deleted')}</p>}
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

// The relocated Record Payment flow - table picker, then that table's
// unpaid items across all its separate orders, then card machine/cash.
// Gated to Pay-Bill-enabled businesses only, by the parent component.
function RecordPaymentFlow({ businessId, orders, onClose, onDone }: {
  businessId: string; orders: OrderRow[]; onClose: () => void; onDone: () => void;
}) {
  const { t } = useT();
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [method, setMethod] = useState<'card_machine' | 'cash'>('card_machine');
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');

  const tableGroups = orders.reduce<Record<string, OrderRow[]>>((acc, o) => {
    const key = o.table_label || t('No table');
    const unpaid = o.order_items.filter((i) => !i.voided && !i.paid);
    if (unpaid.length > 0) (acc[key] ||= []).push(o);
    return acc;
  }, {});

  const tableOrders = selectedTable ? tableGroups[selectedTable] || [] : [];
  // itemId -> orderId, so a table with several separate orders can still
  // be settled in one pass - each affected order gets its own
  // recordManualPayment call underneath, since orders always stay
  // genuinely separate records.
  const itemToOrder = new Map<string, string>();
  tableOrders.forEach((o) => o.order_items.forEach((i) => { if (!i.voided && !i.paid) itemToOrder.set(i.id, o.id); }));

  function toggle(itemId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  async function handleConfirm() {
    if (selected.size === 0) {
      setError('Select at least one item');
      return;
    }
    setRecording(true);
    setError('');
    try {
      const byOrder = new Map<string, string[]>();
      selected.forEach((itemId) => {
        const orderId = itemToOrder.get(itemId);
        if (!orderId) return;
        const existing = byOrder.get(orderId);
        if (existing) existing.push(itemId);
        else byOrder.set(orderId, [itemId]);
      });
      await Promise.all(Array.from(byOrder.entries()).map(([orderId, itemIds]) => recordManualPayment(businessId, orderId, itemIds, method)));
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record payment');
    } finally {
      setRecording(false);
    }
  }

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-ink/80 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-ink-line bg-ink p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-ivory">{t('Record payment')}</h2>
          <button type="button" onClick={onClose} className="text-base text-ivory-dim hover:text-ivory">{t('Close')}</button>
        </div>

        {!selectedTable ? (
          <div className="space-y-2">
            {Object.keys(tableGroups).length === 0 && <p className="text-base text-ivory-dim">{t('No unpaid items right now.')}</p>}
            {Object.keys(tableGroups).map((table) => (
              <button type="button"
                key={table}
                onClick={() => setSelectedTable(table)}
                className="block w-full rounded-lg border border-ink-line px-4 py-3 text-start text-base text-ivory hover:border-brass/40"
              >
                {table}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <button type="button" onClick={() => { setSelectedTable(null); setSelected(new Set()); }} className="text-sm text-brass hover:underline">{t('← Back to tables')}</button>
            <div className="flex items-center justify-between">
              <p className="text-sm text-ivory-dim">{selected.size} {t('of')} {itemToOrder.size} {t('selected')}</p>
              <button type="button"
                onClick={() => setSelected(selected.size === itemToOrder.size ? new Set() : new Set(itemToOrder.keys()))}
                className="text-sm text-brass hover:underline"
              >
                {selected.size === itemToOrder.size ? t('Deselect all') : t('Select all')}
              </button>
            </div>
            <div className="space-y-2">
              {tableOrders.map((o) => o.order_items.filter((i) => !i.voided && !i.paid).map((item) => (
                <label key={item.id} className="flex items-center gap-2 text-base text-ivory">
                  <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} className="accent-brass" />
                  {item.quantity}× {item.item_name}
                  {item.cash_pending && <span className="text-xs text-warning">{t('(cash pending)')}</span>}
                  <span className="ml-auto text-ivory-dim">{((item.unit_price + item.addon_total) * item.quantity).toFixed(2)}</span>
                </label>
              )))}
            </div>
            <div className="flex gap-2">
              {(['card_machine', 'cash'] as const).map((m) => (
                <button type="button"
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm ${method === m ? 'border-brass text-brass' : 'border-ink-line text-ivory-dim'}`}
                >
                  {m === 'card_machine' ? t('Card machine') : t('Cash')}
                </button>
              ))}
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button type="button"
              onClick={handleConfirm}
              disabled={recording}
              className="w-full rounded-lg bg-brass px-3 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50"
            >
              {recording ? t('Recording…') : t('Confirm payment received')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
