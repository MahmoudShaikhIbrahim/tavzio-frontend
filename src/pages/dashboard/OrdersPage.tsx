import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import {
  listOrders, updateOrderStatus, getBusiness, ackOrderReady,
  voidOrderItem, clearTable, fireCourse,
  listRequests, dismissRequest, listLoyaltyClaims, applyManualClaim, listCashPendingItems,
  getPaymentIntegration,
  type RequestRow, type CashPendingItem,
} from '../../lib/authApi';
import { subscribeToBusinessTable, subscribeToOrderItemsForBusiness } from '../../lib/supabaseClient';
import { playNotificationSound } from '../../lib/soundPlayer';
import type { OrderRow, OrderStatus, NotificationSettings, LoyaltyClaim } from '../../types';
import ExportButtons from '../../components/ExportButtons';
import { useConfirm } from '../../components/ConfirmDialog';
import RecordPaymentFlow from '../../components/RecordPaymentFlow';

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
  const tableGroups = active.reduce<Record<string, OrderRow[]>>((acc, o) => {
    const key = o.table_label || t('No table');
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
    const remainingItems = tableGroups[table].flatMap((o) => o.order_items.filter((i) => !i.voided));
    const anyItemLeft = remainingItems.length > 0;
    const anyUnpaid = remainingItems.some((i) => !i.paid);
    if (!anyItemLeft || !anyUnpaid) delete tableGroups[table];
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
          {requests.map((r) => (
            <div key={r.id} className="rounded-lg border border-brass/50 bg-brass/10 p-3">
              <p className="text-sm font-medium text-brass">
                {r.request_type === 'call_waiter' ? t('Call waiter') : r.request_type === 'request_bill' ? t('Request bill') : r.custom_request_label || t('Request')} — <span className="text-ivory">{r.table_label || t('No table')}</span>
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
          ))}
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

      {Object.keys(tableGroups).length === 0 ? (
        <p className="text-base text-ivory-dim">{t('No active orders right now.')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
    <div id={`table-${encodeURIComponent(table)}`} className="w-full scroll-mt-24 rounded-xl border border-ink-line bg-ink-soft p-3">
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
                      ? { ...o, order_items: o.order_items.map((i) => (i.id === item.id ? { ...i, voided: true } : i)) }
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
          <h2 className="text-sm text-ivory-dim">{table}</h2>
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

