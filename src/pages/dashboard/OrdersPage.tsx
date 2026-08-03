import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import {
  listOrders, updateOrderStatus, getBusiness,
  voidOrder, voidOrderItem, clearTable, recordManualPayment, markSectionViewed,
} from '../../lib/authApi';
import { subscribeToBusinessTable, subscribeToOrderItemsForBusiness } from '../../lib/supabaseClient';
import { playNotificationSound } from '../../lib/soundPlayer';
import type { OrderRow, OrderStatus, NotificationSettings } from '../../types';
import StaffOrderModal from '../../components/StaffOrderModal';
import ExportButtons from '../../components/ExportButtons';

const STATUS_FLOW: Record<OrderStatus, OrderStatus | null> = {
  pending: 'ready',
  ready: 'completed',
  completed: null,
  cancelled: null,
};

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

export default function OrdersPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [recentOpen, setRecentOpen] = useState(false);
  const [newOrderPulse, setNewOrderPulse] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [showStaffOrder, setShowStaffOrder] = useState(false);

  function reload() {
    if (businessId) listOrders(businessId).then(setOrders);
  }

  useEffect(reload, [businessId]);
  useEffect(() => {
    if (businessId) markSectionViewed(businessId, 'orders').catch(() => {});
  }, [businessId]);
  useEffect(() => {
    if (businessId) getBusiness(businessId).then((b) => setNotificationSettings(b.notification_settings));
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    const unsubscribe = subscribeToBusinessTable(businessId, 'orders', (row) => {
      const requestType = row.request_type as string;
      if (requestType !== 'order') return; // Call Waiter/Request Bill live on the Requests page now
      reload();
      setNewOrderPulse(true);
      setTimeout(() => setNewOrderPulse(false), 2000);
      if (notificationSettings) playNotificationSound(notificationSettings.newOrder);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, notificationSettings]);

  // A customer marking items "pay in cash" needs staff to actually notice
  // and go collect it - same alert treatment as a new order coming in,
  // since both mean "someone needs to walk over to a table."
  useEffect(() => {
    const unsubscribe = subscribeToOrderItemsForBusiness((row) => {
      if (!row.cash_pending) return;
      reload();
      setNewOrderPulse(true);
      setTimeout(() => setNewOrderPulse(false), 2000);
      if (notificationSettings) playNotificationSound(notificationSettings.newOrder);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificationSettings]);

  if (!businessId) return null;

  // Voided orders are excluded from every active/past grouping entirely -
  // that's the actual point of voiding, not just a status label.
  const visible = orders.filter((o) => !o.voided);
  const active = visible.filter((o) => o.status !== 'completed' && o.status !== 'cancelled');
  const past = visible.filter((o) => o.status === 'completed' || o.status === 'cancelled');

  // Grouped by table - so a busy screen with several tables at once shows
  // each table's own state at a glance, instead of one flat mixed list.
  const tableGroups = active.reduce<Record<string, OrderRow[]>>((acc, o) => {
    const key = o.table_label || 'No table';
    (acc[key] ||= []).push(o);
    return acc;
  }, {});

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-3xl text-ivory">Orders</h1>
          {newOrderPulse && <span className="h-2 w-2 animate-pulse rounded-full bg-brass" />}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowStaffOrder(true)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">
            + Order for a table
          </button>
          <ExportButtons businessId={businessId} kind="orders" />
        </div>
      </div>

      {Object.keys(tableGroups).length === 0 ? (
        <p className="text-base text-ivory-dim">No active orders right now.</p>
      ) : (
        <div className="space-y-10">
          {Object.keys(tableGroups).map((table) => (
            <TableGroup key={table} table={table} orders={tableGroups[table]} businessId={businessId} onChange={reload} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div>
          <button
            onClick={() => setRecentOpen((v) => !v)}
            className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-ivory-dim hover:text-ivory"
          >
            <span>Recent ({past.length})</span>
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
    </div>
  );
}

function TableGroup({ table, orders, businessId, onChange }: {
  table: string; orders: OrderRow[]; businessId: string; onChange: () => void;
}) {
  const [clearing, setClearing] = useState(false);
  // Any of these orders' card_id works to identify the table for clearing.
  const cardId = orders[0]?.card_id;

  async function handleClearTable() {
    if (!cardId) return;
    if (!confirm(`Clear ${table}? This voids everything currently unpaid at this table.`)) return;
    setClearing(true);
    await clearTable(businessId, cardId);
    setClearing(false);
    onChange();
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-xl text-ivory">{table}</h2>
        {cardId && (
          <button
            onClick={handleClearTable}
            disabled={clearing}
            className="rounded-lg border border-danger/40 px-3 py-1.5 text-base text-danger hover:bg-danger/10 disabled:opacity-50"
          >
            {clearing ? 'Clearing...' : 'Clear table'}
          </button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} businessId={businessId} onChange={onChange} />
        ))}
      </div>
    </div>
  );
}

function OrderCard({ order, businessId, onChange }: { order: OrderRow; businessId: string; onChange: () => void }) {
  const next = STATUS_FLOW[order.status];
  const visibleItems = order.order_items.filter((i) => !i.voided);
  const unpaidItems = visibleItems.filter((i) => !i.paid);

  const [showPayment, setShowPayment] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [method, setMethod] = useState<'card_machine' | 'cash'>('card_machine');
  const [recording, setRecording] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  function toggleSelected(itemId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  async function handleRecordPayment() {
    if (selected.size === 0) {
      setPaymentError('Select at least one item');
      return;
    }
    setRecording(true);
    setPaymentError('');
    try {
      await recordManualPayment(businessId, order.id, Array.from(selected), method);
      setSelected(new Set());
      setShowPayment(false);
      onChange();
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Could not record payment');
    } finally {
      setRecording(false);
    }
  }

  return (
    <div className="rounded-xl border border-ink-line bg-ink-soft p-4">
      <div className="flex items-center justify-between">
        <p className="font-display text-xl text-ivory">
          {order.table_label || 'No table'}
          {order.placed_by_staff_id && <span className="ml-2 rounded-full border border-brass/40 px-2 py-0.5 text-[10px] text-brass">Added by staff</span>}
        </p>
        <span className={`rounded-full border px-2.5 py-0.5 text-sm ${STATUS_STYLE[order.status]}`}>
          {STATUS_LABEL[order.status]}
        </span>
      </div>

      <div className="mt-2 space-y-4 text-base">
        {visibleItems.map((item) => (
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
              onClick={() => voidOrderItem(businessId, order.id, item.id).then(onChange)}
              className="shrink-0 text-base text-danger hover:underline"
              title="Void just this item"
            >
              Void
            </button>
          </div>
        ))}
        {visibleItems.length === 0 && <p className="text-base italic text-ivory-dim">All items voided</p>}
      </div>

      {order.note && <p className="mt-2 text-base italic text-brass">Note: {order.note}</p>}

      <p className="mt-2 text-base text-ivory">{order.total.toFixed(2)}</p>

      {order.pos_sync_status !== 'not_applicable' && (
        <p className="mt-1 text-base text-ivory-dim">
          POS sync: {order.pos_sync_status}
          {order.pos_sync_status === 'failed' && order.pos_sync_error ? ` — ${order.pos_sync_error}` : ''}
        </p>
      )}

      {unpaidItems.length > 0 && (
        <div className="mt-3 rounded-lg border border-ink-line p-3">
          <button onClick={() => setShowPayment((v) => !v)} className="text-base font-medium text-brass hover:underline">
            {showPayment ? 'Hide' : 'Record payment'} ({unpaidItems.length} unpaid)
          </button>
          {showPayment && (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-ivory-dim">Select what was actually paid, outside Tavzio (card machine, cash, or other):</p>
              <div className="space-y-2">
                {unpaidItems.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-base text-ivory">
                    <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelected(item.id)} className="accent-brass" />
                    {item.quantity}× {item.item_name}
                    {item.cash_pending && <span className="text-xs text-warning">(cash pending)</span>}
                    <span className="ml-auto text-ivory-dim">{((item.unit_price + item.addon_total) * item.quantity).toFixed(2)}</span>
                  </label>
                ))}
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
              {paymentError && <p className="text-sm text-danger">{paymentError}</p>}
              <button
                onClick={handleRecordPayment}
                disabled={recording}
                className="w-full rounded-lg bg-brass px-3 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50"
              >
                {recording ? 'Recording…' : 'Confirm payment received'}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        {next && (
          <button
            onClick={() => updateOrderStatus(businessId, order.id, next).then(onChange)}
            className="flex-1 rounded-lg bg-brass px-3 py-2 text-base font-medium text-ink hover:opacity-90"
          >
            Mark {STATUS_LABEL[next].toLowerCase()}
          </button>
        )}
        {order.status !== 'cancelled' && order.status !== 'completed' && (
          <button
            onClick={() => updateOrderStatus(businessId, order.id, 'cancelled').then(onChange)}
            className="rounded-lg border border-danger/40 px-3 py-2 text-base text-danger hover:bg-danger/10"
          >
            Cancel
          </button>
        )}
        <button
          onClick={() => { if (confirm('Void this entire order? This is for stray leftover orders, not a customer cancelling.')) voidOrder(businessId, order.id).then(onChange); }}
          className="rounded-lg border border-ink-line px-3 py-2 text-base text-ivory-dim hover:text-ivory"
          title="Void the whole order"
        >
          Void order
        </button>
      </div>
    </div>
  );
}
