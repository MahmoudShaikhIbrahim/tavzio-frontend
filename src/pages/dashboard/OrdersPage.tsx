import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';
import {
  listOrders, updateOrderStatus, getBusiness, ackOrderReady,
  voidOrderItem, clearTable, recordManualPayment,
  listRequests, dismissRequest, listLoyaltyClaims, applyManualClaim, listCashPendingItems,
  getPaymentIntegration,
  type RequestRow, type CashPendingItem,
} from '../../lib/authApi';
import { subscribeToBusinessTable, subscribeToOrderItemsForBusiness } from '../../lib/supabaseClient';
import { playNotificationSound } from '../../lib/soundPlayer';
import type { OrderRow, OrderStatus, NotificationSettings, LoyaltyClaim } from '../../types';
import StaffOrderModal from '../../components/StaffOrderModal';
import ExportButtons from '../../components/ExportButtons';

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'New',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: 'border-brass text-brass',
  ready: 'border-success/50 text-success',
  completed: 'border-ink-line text-ivory-dim',
  cancelled: 'border-danger/40 text-danger',
};

const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

export default function OrdersPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const businessId = user?.business_id;
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [recentOpen, setRecentOpen] = useState(false);
  const [newOrderPulse, setNewOrderPulse] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [showStaffOrder, setShowStaffOrder] = useState(false);
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
    const key = o.table_label || 'No table';
    (acc[key] ||= []).push(o);
    return acc;
  }, {});

  const hasAttentionItems = requests.length > 0 || claims.length > 0 || cashPending.length > 0 || readyUnacked.length > 0;

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-3xl text-ivory">Orders</h1>
          {newOrderPulse && <span className="h-2 w-2 animate-pulse rounded-full bg-brass" />}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowStaffOrder(true)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">
            + Order for a table
          </button>
          {payBillEnabled && (
            <button
              onClick={() => setShowRecordPayment(true)}
              className="rounded-lg border border-brass/40 px-3.5 py-1.5 text-sm text-brass hover:bg-brass/10"
            >
              Record payment
            </button>
          )}
          {!payBillEnabled && (
            <button
              onClick={() => navigate('/admin/dashboard/table-receipts')}
              className="rounded-lg border border-brass/40 px-3.5 py-1.5 text-sm text-brass hover:bg-brass/10"
            >
              Table Receipts
            </button>
          )}
          <ExportButtons businessId={businessId} kind="orders" />
        </div>
      </div>

      {hasAttentionItems && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {readyUnacked.map((o) => (
            <div key={o.id} className="rounded-xl border border-success/50 bg-success/10 p-4">
              <p className="text-base font-medium text-success">
                Ready — <span className="text-ivory">{o.table_label || 'No table'}</span>
              </p>
              <button onClick={() => handleAckReady(o.id)} className="mt-3 w-full rounded-lg border border-success px-3 py-2 text-base text-success hover:bg-success/10">
                Dismiss
              </button>
            </div>
          ))}
          {requests.map((r) => (
            <div key={r.id} className="rounded-xl border border-brass/50 bg-brass/10 p-4">
              <p className="text-base font-medium text-brass">
                {r.request_type === 'call_waiter' ? 'Call Waiter' : 'Request Bill'} — <span className="text-ivory">{r.table_label || 'No table'}</span>
              </p>
              <button onClick={() => handleDismissRequest(r.id)} className="mt-3 w-full rounded-lg border border-brass px-3 py-2 text-base text-brass hover:bg-brass/10">
                Dismiss
              </button>
            </div>
          ))}
          {cashPending.map((item) => (
            <div key={item.id} className="rounded-xl border border-warning/50 bg-warning/10 p-4">
              <p className="text-base font-medium text-warning">
                Cash pending — <span className="text-ivory">{item.table_label || 'No table'}</span>
              </p>
              <p className="mt-1 text-sm text-ivory-dim">{item.quantity}× {item.item_name}</p>
              <p className="mt-2 text-sm text-ivory-dim">Use Record payment to confirm</p>
            </div>
          ))}
          {claims.map((c) => (
            <div key={c.id} className="rounded-xl border border-brass/50 bg-brass/10 p-4">
              <p className="text-base font-medium text-brass">
                Loyalty reward — <span className="text-ivory">{c.table_label || 'No table'}</span>
              </p>
              <button
                onClick={() => applyManualClaim(businessId, c.id).then(reloadClaims)}
                className="mt-3 w-full rounded-lg border border-brass px-3 py-2 text-base text-brass hover:bg-brass/10"
              >
                Mark redeemed
              </button>
            </div>
          ))}
        </div>
      )}

      {Object.keys(tableGroups).length === 0 ? (
        <p className="text-base text-ivory-dim">No active orders right now.</p>
      ) : (
        <div className="flex flex-wrap items-start gap-6">
          {Object.keys(tableGroups).map((table) => (
            <TableGroup key={table} table={table} orders={tableGroups[table]} businessId={businessId} payBillEnabled={payBillEnabled} onOrdersChange={setOrders} onChange={reload} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div>
          <button
            onClick={() => setRecentOpen((v) => !v)}
            className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-ivory-dim hover:text-ivory"
          >
            <span>Recent, last 24h ({past.length})</span>
            <span>{recentOpen ? '▲' : '▼'}</span>
          </button>
          {recentOpen && (
          <div className="space-y-4">
            {past.slice(0, 10).map((order) => (
              <div key={order.id} className="flex items-center justify-between rounded-lg border border-ink-line px-5 py-4 text-base">
                <span className="text-ivory-dim">
                  {order.table_label || 'No table'} — {order.total.toFixed(2)}
                  <span className="ms-2 text-sm text-ivory-dim/60">
                    {new Date(order.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    {' · '}
                    {new Date(order.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-sm ${STATUS_STYLE[order.status]}`}>
                  {STATUS_LABEL[order.status]}
                </span>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {showStaffOrder && (
        <StaffOrderModal businessId={businessId} onClose={() => setShowStaffOrder(false)} onPlaced={() => { setShowStaffOrder(false); reload(); }} />
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

  async function handleClearTable() {
    if (!cardId) return;
    if (!confirm(`Clear ${table}? This voids everything currently unpaid at this table.`)) return;
    setClearing(true);
    const affectedOrderIds = new Set(
      orders.filter((o) => o.order_items.some((i) => !i.paid && !i.voided)).map((o) => o.id)
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
    <div className="w-full max-w-sm rounded-2xl border border-ink-line p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-ivory">{table}</h2>
          <p className="text-sm text-ivory-dim">
            {orders.length} order{orders.length === 1 ? '' : 's'} · {tableTotal.toFixed(2)} total
          </p>
        </div>
        {cardId && (
          <div className="flex shrink-0 gap-2">
            {!payBillEnabled && (
              <button
                onClick={handleMarkCompleted}
                disabled={completing}
                className="rounded-lg border border-brass/40 px-3 py-1.5 text-base text-brass hover:bg-brass/10 disabled:opacity-50"
              >
                {completing ? 'Completing...' : 'Mark completed'}
              </button>
            )}
            <button
              onClick={handleClearTable}
              disabled={clearing}
              className="rounded-lg border border-danger/40 px-2.5 py-1 text-sm text-danger hover:bg-danger/10 disabled:opacity-50"
            >
              {clearing ? 'Clearing...' : 'Clear table'}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3 text-lg">
        {allItems.map(({ item, order }) => (
          <div key={item.id} className="flex items-start justify-between gap-2 text-ivory-dim">
            <div>
              <span className="text-ivory">{item.quantity}×</span> {item.item_name}
              {item.cash_pending && (
                <span className="ml-2 rounded-full border border-warning/40 px-2 py-0.5 text-[10px] text-warning">Cash pending</span>
              )}
              {item.addons.length > 0 && <span className="block text-base text-brass/70">+ {item.addons.map((a) => a.name).join(', ')}</span>}
              {item.note && <span className="block italic">— {item.note}</span>}
            </div>
            <button
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
              title="Delete just this item"
            >
              Delete
            </button>
          </div>
        ))}
        {allItems.length === 0 && <p className="text-base italic text-ivory-dim">All items deleted</p>}
      </div>

      {notes.length > 0 && (
        <div className="mt-3 space-y-1">
          {notes.map((n, i) => <p key={i} className="text-base italic text-brass">Note: {n}</p>)}
        </div>
      )}

      {syncIssue && (
        <p className="mt-2 text-base text-ivory-dim">POS sync failed{syncIssue.pos_sync_error ? ` — ${syncIssue.pos_sync_error}` : ''}</p>
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
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [method, setMethod] = useState<'card_machine' | 'cash'>('card_machine');
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');

  const tableGroups = orders.reduce<Record<string, OrderRow[]>>((acc, o) => {
    const key = o.table_label || 'No table';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-ink-line bg-ink p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-ivory">Record payment</h2>
          <button onClick={onClose} className="text-base text-ivory-dim hover:text-ivory">Close</button>
        </div>

        {!selectedTable ? (
          <div className="space-y-2">
            {Object.keys(tableGroups).length === 0 && <p className="text-base text-ivory-dim">No unpaid items right now.</p>}
            {Object.keys(tableGroups).map((table) => (
              <button
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
            <button onClick={() => { setSelectedTable(null); setSelected(new Set()); }} className="text-sm text-brass hover:underline">← Back to tables</button>
            <div className="flex items-center justify-between">
              <p className="text-sm text-ivory-dim">{selected.size} of {itemToOrder.size} selected</p>
              <button
                onClick={() => setSelected(selected.size === itemToOrder.size ? new Set() : new Set(itemToOrder.keys()))}
                className="text-sm text-brass hover:underline"
              >
                {selected.size === itemToOrder.size ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="space-y-2">
              {tableOrders.map((o) => o.order_items.filter((i) => !i.voided && !i.paid).map((item) => (
                <label key={item.id} className="flex items-center gap-2 text-base text-ivory">
                  <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} className="accent-brass" />
                  {item.quantity}× {item.item_name}
                  {item.cash_pending && <span className="text-xs text-warning">(cash pending)</span>}
                  <span className="ml-auto text-ivory-dim">{((item.unit_price + item.addon_total) * item.quantity).toFixed(2)}</span>
                </label>
              )))}
            </div>
            <div className="flex gap-2">
              {(['card_machine', 'cash'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm ${method === m ? 'border-brass text-brass' : 'border-ink-line text-ivory-dim'}`}
                >
                  {m === 'card_machine' ? 'Card machine' : 'Cash'}
                </button>
              ))}
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              onClick={handleConfirm}
              disabled={recording}
              className="w-full rounded-lg bg-brass px-3 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50"
            >
              {recording ? 'Recording…' : 'Confirm payment received'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
