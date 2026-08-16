import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { listOrders, updateOrderStatus, getBusiness } from '../../lib/authApi';
import { subscribeToBusinessTable } from '../../lib/supabaseClient';
import { playNotificationSound } from '../../lib/soundPlayer';
import type { OrderRow, NotificationSettings } from '../../types';

// Standard KDS behavior, not a Tavzio invention: a ticket's age is the
// single most important thing a kitchen needs at a glance during a rush
// - it's how every commercial kitchen display (Toast, Square, Lightspeed)
// signals "this one's falling behind" without anyone having to check a
// clock. Thresholds are deliberately generous defaults for a sit-down
// kitchen, not fast-food; a business needing tighter timing can ask to
// make these configurable later.
const AMBER_AFTER_MINUTES = 8;
const RED_AFTER_MINUTES = 15;

function useTicker() {
  // Re-renders every ticket's elapsed time once a minute - not on every
  // render, so this never competes with the real-time order updates for
  // CPU/battery on a screen that's meant to just sit in the kitchen all day.
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(interval);
  }, []);
}

function TicketAge({ createdAt }: { createdAt: string }) {
  const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  const color = minutes >= RED_AFTER_MINUTES ? 'text-danger' : minutes >= AMBER_AFTER_MINUTES ? 'text-warning' : 'text-ivory-dim';
  return <span className={`font-mono text-sm ${color}`}>{minutes < 1 ? 'just now' : `${minutes} min`}</span>;
}

// Kitchen is deliberately the simplest page in the whole dashboard: one
// job, no distractions. Every order stays genuinely separate here (no
// grouping, no merging) so kitchen staff always know exactly what's new
// versus already being worked - and it shows ONLY pending orders, per
// explicit decision. No Requests, no Payments, nothing else competing
// for attention on a screen that's meant to just sit in the kitchen.
export default function KitchenPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [newOrderPulse, setNewOrderPulse] = useState(false);
  const [stationFilter, setStationFilter] = useState<string>('all');
  useTicker();

  function reload() {
    // Oldest ticket first, always - the one that's been waiting longest
    // is the one that needs eyes on it first, same reason the age badge
    // exists at all. Sorted client-side so this holds regardless of
    // whatever order the API happens to return.
    if (businessId) listOrders(businessId, 'pending').then((rows) => {
      setOrders([...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
    });
    // Also pick up anything already 'preparing' - a ticket started but
    // not yet ready still needs to be visible on this screen, not just
    // freshly-pending ones.
    if (businessId) listOrders(businessId, 'preparing').then((rows) => {
      setOrders((prev) => {
        const pendingOnly = prev.filter((o) => o.status !== 'preparing');
        return [...pendingOnly, ...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      });
    });
  }

  useEffect(reload, [businessId]);
  useEffect(() => {
    if (businessId) getBusiness(businessId).then((b) => setNotificationSettings(b.notification_settings));
  }, [businessId]);

  // Real-time, instant - a new order appears, or an order someone else
  // marked ready on another screen vanishes from here, without ever
  // needing a manual refresh.
  useEffect(() => {
    if (!businessId) return;
    const unsubscribe = subscribeToBusinessTable(businessId, 'orders', (row) => {
      if (row.request_type !== 'order') return;
      const wasPending = row.status === 'pending';
      reload();
      if (wasPending) {
        setNewOrderPulse(true);
        setTimeout(() => setNewOrderPulse(false), 2000);
        if (notificationSettings) playNotificationSound(notificationSettings.newOrder);
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, notificationSettings]);

  async function handleStart(orderId: string) {
    if (!businessId) return;
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: 'preparing' } : o)));
    try {
      await updateOrderStatus(businessId, orderId, 'preparing');
    } catch {
      reload();
    }
  }

  async function handleMarkReady(orderId: string) {
    if (!businessId) return;
    // Optimistic: gone from the screen the instant it's tapped, not after
    // waiting for the server to confirm and a fresh list to reload.
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    try {
      await updateOrderStatus(businessId, orderId, 'ready');
    } catch {
      reload(); // put it back if the request actually failed
    }
  }

  if (!businessId) return null;

  const kitchenOrders = orders.filter((order) => order.order_items.some((i) => !i.voided && i.course_status !== 'held'));
  const stations = [...new Set(kitchenOrders.flatMap((o) => o.order_items.map((i) => i.station).filter((s): s is string => !!s)))].sort();
  const visibleOrders = stationFilter === 'all'
    ? kitchenOrders
    : kitchenOrders.filter((o) => o.order_items.some((i) => !i.voided && i.course_status !== 'held' && i.station === stationFilter));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="font-display text-2xl text-ivory">Kitchen</h1>
        {newOrderPulse && <span className="h-2 w-2 animate-pulse rounded-full bg-brass" />}
      </div>

      {stations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setStationFilter('all')} className={`rounded-full border px-3 py-1 text-sm ${stationFilter === 'all' ? 'border-brass bg-brass/10 text-brass' : 'border-ink-line text-ivory-dim'}`}>
            All stations
          </button>
          {stations.map((s) => (
            <button type="button" key={s} onClick={() => setStationFilter(s)} className={`rounded-full border px-3 py-1 text-sm ${stationFilter === s ? 'border-brass bg-brass/10 text-brass' : 'border-ink-line text-ivory-dim'}`}>
              {s}
            </button>
          ))}
        </div>
      )}

      {visibleOrders.length === 0 && (
        <p className="text-base text-ivory-dim">No pending orders right now.</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleOrders
          .map((order) => {
          const minutes = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
          const borderColor = minutes >= RED_AFTER_MINUTES ? 'border-danger' : minutes >= AMBER_AFTER_MINUTES ? 'border-warning' : 'border-ink-line';
          const allFiredItems = order.order_items.filter((i) => !i.voided && i.course_status !== 'held');
          const firedItems = stationFilter === 'all' ? allFiredItems : allFiredItems.filter((i) => i.station === stationFilter);
          // Not shown in detail (a held course's items are deliberately
          // not visible yet) - just a heads-up that more is coming, and
          // for which course, so the kitchen can pace itself.
          const heldCourses = [...new Set(order.order_items.filter((i) => !i.voided && i.course_status === 'held').map((i) => i.course))];
          return (
            <div key={order.id} className={`rounded-xl border-2 bg-ink-soft p-4 transition-colors ${borderColor}`}>
              <div className="flex items-center justify-between">
                <p className="font-display text-xl text-ivory">{order.table_label || 'No table'}</p>
                <div className="flex items-center gap-2">
                  {order.status === 'preparing' && <span className="rounded-full border border-brass/40 px-2 py-0.5 text-xs text-brass">Preparing</span>}
                  <TicketAge createdAt={order.created_at} />
                </div>
              </div>
              <div className="mt-3 space-y-2 text-lg">
                {firedItems.map((item) => (
                  <div key={item.id} className="text-ivory-dim">
                    <span className="text-ivory">{item.quantity}×</span> {item.item_name}
                    {item.station && <span className="ml-1.5 text-xs uppercase tracking-wide text-brass/60">{item.station}</span>}
                    {item.addons.length > 0 && (
                      <span className="block text-sm text-brass/70">+ {item.addons.map((a) => a.name).join(', ')}</span>
                    )}
                    {item.note && <span className="block text-sm italic">— {item.note}</span>}
                  </div>
                ))}
              </div>
              {heldCourses.length > 0 && (
                <p className="mt-2 text-sm text-brass/70">Waiting to fire: {heldCourses.join(', ')}</p>
              )}
              {order.note && <p className="mt-2 text-sm italic text-brass">Note: {order.note}</p>}
              <div className="mt-4 flex gap-2">
                {order.status === 'pending' && (
                  <button type="button"
                    onClick={() => handleStart(order.id)}
                    className="flex-1 rounded-lg border border-brass/40 px-3 py-2.5 text-base font-medium text-brass hover:bg-brass/10"
                  >
                    Start
                  </button>
                )}
                <button type="button"
                  onClick={() => handleMarkReady(order.id)}
                  className="flex-1 rounded-lg bg-brass px-3 py-2.5 text-base font-medium text-ink hover:opacity-90"
                >
                  Mark ready
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
