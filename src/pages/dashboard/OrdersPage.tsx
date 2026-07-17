import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import {
  listOrders, updateOrderStatus, getBusiness, downloadExport,
  voidOrder, voidOrderItem, clearTable, listRequests, dismissRequest, type RequestRow,
  listLoyaltyClaims, applyManualClaim,
} from '../../lib/authApi';
import type { LoyaltyClaim } from '../../types';
import { subscribeToBusinessTable } from '../../lib/supabaseClient';
import { playNotificationSound } from '../../lib/soundPlayer';
import type { OrderRow, OrderStatus, NotificationSettings } from '../../types';
import StaffOrderModal from '../../components/StaffOrderModal';

const STATUS_FLOW: Record<OrderStatus, OrderStatus | null> = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'completed',
  completed: null,
  cancelled: null,
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'New',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: 'border-brass text-brass',
  preparing: 'border-blue-400/50 text-blue-300',
  ready: 'border-green-400/50 text-green-300',
  completed: 'border-ink-line text-ivory-dim',
  cancelled: 'border-red-400/40 text-red-400',
};

export default function OrdersPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [claims, setClaims] = useState<LoyaltyClaim[]>([]);
  const [newOrderPulse, setNewOrderPulse] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [showStaffOrder, setShowStaffOrder] = useState(false);

  function reload() {
    if (businessId) listOrders(businessId).then(setOrders);
  }
  function reloadRequests() {
    if (businessId) listRequests(businessId).then((all) => setRequests(all.filter((r) => r.status !== 'completed')));
  }
  function reloadClaims() {
    if (businessId) listLoyaltyClaims(businessId).then(setClaims);
  }

  useEffect(reload, [businessId]);
  useEffect(reloadRequests, [businessId]);
  useEffect(reloadClaims, [businessId]);
  useEffect(() => {
    if (businessId) getBusiness(businessId).then((b) => setNotificationSettings(b.notification_settings));
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    const unsubscribe = subscribeToBusinessTable(businessId, 'orders', (row) => {
      const requestType = row.request_type as string;
      if (requestType === 'order') {
        reload();
        setNewOrderPulse(true);
        setTimeout(() => setNewOrderPulse(false), 2000);
      } else {
        reloadRequests();
      }

      if (notificationSettings) {
        if (requestType === 'call_waiter') playNotificationSound(notificationSettings.callWaiter);
        else if (requestType === 'request_bill') playNotificationSound(notificationSettings.requestBill);
        else playNotificationSound(notificationSettings.newOrder);
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, notificationSettings]);

  useEffect(() => {
    if (!businessId) return;
    const unsubscribe = subscribeToBusinessTable(businessId, 'loyalty_reward_claims', reloadClaims);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-3xl text-ivory">Orders</h1>
          {newOrderPulse && <span className="h-2 w-2 animate-pulse rounded-full bg-brass" />}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowStaffOrder(true)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">
            + Order for a table
          </button>
          <button onClick={() => downloadExport(businessId, 'orders', 'csv')} className="rounded-lg border border-ink-line px-3 py-1.5 text-sm text-ivory-dim hover:text-ivory">CSV</button>
          <button onClick={() => downloadExport(businessId, 'orders', 'pdf')} className="rounded-lg border border-ink-line px-3 py-1.5 text-sm text-ivory-dim hover:text-ivory">PDF</button>
        </div>
      </div>

      {(requests.length > 0 || claims.length > 0) && (
        <RequestsPanel requests={requests} claims={claims} businessId={businessId} onChange={reloadRequests} onClaimsChange={reloadClaims} />
      )}

      {Object.keys(tableGroups).length === 0 ? (
        <p className="text-base text-ivory-dim">No active orders right now.</p>
      ) : (
        <div className="space-y-6">
          {Object.keys(tableGroups).map((table) => (
            <TableGroup key={table} table={table} orders={tableGroups[table]} businessId={businessId} onChange={reload} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h2 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ivory-dim">Earlier today</h2>
          <div className="space-y-1.5">
            {past.slice(0, 10).map((order) => (
              <div key={order.id} className="flex items-center justify-between rounded-lg border border-ink-line px-3.5 py-2 text-base">
                <span className="text-ivory-dim">{order.table_label || 'No table'} — {order.total.toFixed(2)}</span>
                <span className={`rounded-full border px-2 py-0.5 text-sm ${STATUS_STYLE[order.status]}`}>
                  {STATUS_LABEL[order.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showStaffOrder && (
        <StaffOrderModal businessId={businessId} onClose={() => setShowStaffOrder(false)} onPlaced={() => { setShowStaffOrder(false); reload(); }} />
      )}
    </div>
  );
}

function RequestsPanel({ requests, claims, businessId, onChange, onClaimsChange }: {
  requests: RequestRow[]; claims: LoyaltyClaim[]; businessId: string; onChange: () => void; onClaimsChange: () => void;
}) {
  const LABEL = { call_waiter: 'Call waiter', request_bill: 'Request bill' } as const;

  return (
    <div className="rounded-xl border border-brass/30 bg-brass/5 p-4">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-brass">Requests</p>
      <div className="space-y-1.5">
        {requests.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border border-ink-line bg-ink-soft px-3.5 py-2 text-base">
            <span className="text-ivory">
              {LABEL[r.request_type]} — <span className="text-ivory-dim">{r.table_label || 'No table'}</span>
            </span>
            <button
              onClick={() => dismissRequest(businessId, r.id).then(onChange)}
              className="rounded-lg border border-brass/40 px-3 py-1 text-base text-brass hover:bg-brass/10"
            >
              Dismiss
            </button>
          </div>
        ))}
        {claims.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg border border-ink-line bg-ink-soft px-3.5 py-2 text-base">
            <span className="text-ivory">
              Reward ready — <span className="text-ivory-dim">{c.table_label || 'No table'}</span>
              {c.reward_description ? ` (${c.reward_description})` : ''}
            </span>
            {c.reward_type === 'manual' ? (
              <button
                onClick={() => applyManualClaim(businessId, c.id).then(onClaimsChange)}
                className="rounded-lg border border-brass/40 px-3 py-1 text-base text-brass hover:bg-brass/10"
              >
                Mark applied
              </button>
            ) : (
              <span className="text-base text-ivory-dim">Applies automatically at Pay Bill</span>
            )}
          </div>
        ))}
      </div>
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
            className="rounded-lg border border-red-400/40 px-3 py-1.5 text-base text-red-400 hover:bg-red-400/10 disabled:opacity-50"
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

      <div className="mt-2 space-y-1.5 text-base">
        {visibleItems.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-2 text-ivory-dim">
            <div>
              <span className="text-ivory">{item.quantity}×</span> {item.item_name}
              {item.addons.length > 0 && <span className="block text-base text-brass/70">+ {item.addons.map((a) => a.name).join(', ')}</span>}
              {item.note && <span className="block italic">— {item.note}</span>}
            </div>
            <button
              onClick={() => voidOrderItem(businessId, order.id, item.id).then(onChange)}
              className="shrink-0 text-base text-red-400 hover:underline"
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
            className="rounded-lg border border-red-400/40 px-3 py-2 text-base text-red-400 hover:bg-red-400/10"
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
