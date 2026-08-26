import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import { listOrders, updateOrderStatus, getBusiness, reprintKitchenTicket } from '../../lib/authApi';
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
  const { t } = useT();
  const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  const color = minutes >= RED_AFTER_MINUTES ? 'text-danger' : minutes >= AMBER_AFTER_MINUTES ? 'text-warning' : 'text-ivory-dim';
  return <span className={`font-mono text-sm ${color}`}>{minutes < 1 ? t('just now') : `${minutes} min`}</span>;
}

// Kitchen is deliberately the simplest page in the whole dashboard: one
// job, no distractions. Every order stays genuinely separate here (no
// grouping, no merging) so kitchen staff always know exactly what's new
// versus already being worked - and it shows ONLY pending orders, per
// explicit decision. No Requests, no Payments, nothing else competing
// for attention on a screen that's meant to just sit in the kitchen.
export default function KitchenPage() {
  const { user } = useSession();
  const { t } = useT();
  const businessId = user?.business_id;
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [newOrderPulse, setNewOrderPulse] = useState(false);
  const [stationFilter, setStationFilter] = useState<string>('all');
  const [reprintingId, setReprintingId] = useState<string | null>(null);
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

  // A real, named action (logged server-side with who and when) for a
  // lost or misprinted paper ticket - never silently re-fires anything,
  // just resends what's already fired to whichever stations have a
  // printer mapped.
  async function handleReprint(orderId: string) {
    if (!businessId) return;
    setReprintingId(orderId);
    try {
      await reprintKitchenTicket(businessId, orderId);
    } finally {
      setReprintingId(null);
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
        <h1 className="font-display text-2xl text-ivory">{t('Kitchen')}</h1>
        {newOrderPulse && <span className="h-2 w-2 animate-pulse rounded-full bg-brass" />}
      </div>

      {stations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setStationFilter('all')} className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${stationFilter === 'all' ? 'card-elevated bg-brass text-ink' : 'border border-ink-line text-ivory-dim hover:border-brass/50 hover:text-ivory'}`}>
            {t('All stations')}
          </button>
          {stations.map((s) => (
            <button type="button" key={s} onClick={() => setStationFilter(s)} className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${stationFilter === s ? 'card-elevated bg-brass text-ink' : 'border border-ink-line text-ivory-dim hover:border-brass/50 hover:text-ivory'}`}>
              {s}
            </button>
          ))}
        </div>
      )}

      {visibleOrders.length === 0 && (
        <p className="text-base text-ivory-dim">{t('No pending orders right now.')}</p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {visibleOrders
          .map((order) => {
          const minutes = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
          const urgency = minutes >= RED_AFTER_MINUTES ? 'danger' : minutes >= AMBER_AFTER_MINUTES ? 'warning' : null;
          const allFiredItems = order.order_items.filter((i) => !i.voided && i.course_status !== 'held');
          const firedItems = stationFilter === 'all' ? allFiredItems : allFiredItems.filter((i) => i.station === stationFilter);
          // Not shown in detail (a held course's items are deliberately
          // not visible yet) - just a heads-up that more is coming, and
          // for which course, so the kitchen can pace itself.
          const heldCourses = [...new Set(order.order_items.filter((i) => !i.voided && i.course_status === 'held').map((i) => i.course))];
          return (
            <div key={order.id} className="overflow-hidden rounded-lg border border-ink-line bg-ink-soft">
              {/* A colored top strip reads faster than a thin border at
                  the distance a KDS screen is actually viewed from
                  across a kitchen - the same real convention commercial
                  kitchen displays (Toast, Square, Lightspeed) already
                  use to signal an aging ticket, just implemented here
                  with a genuine block of color instead of a 2px line. */}
              <div className={`h-1 ${urgency === 'danger' ? 'bg-danger' : urgency === 'warning' ? 'bg-warning' : 'bg-ink-line'}`} />
              <div className="p-2.5">
                <div className="space-y-2">
                  {firedItems.map((item) => (
                    <div key={item.id} className="flex gap-1.5">
                      <span className="flex h-6 min-w-6 items-center justify-center rounded bg-ink px-1 font-mono text-sm text-brass">{item.quantity}×</span>
                      <div className="text-ivory-dim">
                        <span className="font-display text-lg font-medium text-ivory">{item.item_name}</span>
                        {item.station && <span className="ml-1 text-[10px] uppercase tracking-wide text-brass">{item.station}</span>}
                        {item.addons.length > 0 && (
                          <span className="block text-sm text-brass">+ {item.addons.map((a) => a.name).join(', ')}</span>
                        )}
                        {item.note && <span className="block text-sm italic text-ivory">— {item.note}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-ink-line pt-2">
                  <p className="text-sm text-ivory-dim">{order.table_label || t('No table')}</p>
                  <div className="flex items-center gap-1.5">
                    {order.status === 'preparing' && <span className="rounded-full border border-brass/40 px-1.5 py-0.5 text-[10px] font-medium text-brass">{t('Preparing')}</span>}
                    <TicketAge createdAt={order.created_at} />
                  </div>
                </div>
                {heldCourses.length > 0 && (
                  <p className="mt-2 rounded bg-ink px-2 py-1 text-xs text-brass">{t('Waiting to fire:')} {heldCourses.join(', ')}</p>
                )}
                {order.note && <p className="mt-2 rounded border border-brass/30 bg-brass/5 px-2 py-1 text-xs italic text-brass">{t('Note:')} {order.note}</p>}
                <div className="mt-2.5 flex gap-1.5">
                  {order.status === 'pending' && (
                    <button type="button"
                      onClick={() => handleStart(order.id)}
                      className="flex-1 rounded-md border border-brass/40 px-2 min-h-[36px] py-1.5 text-xs font-medium text-brass hover:bg-brass/10"
                    >
                      {t('Start')}
                    </button>
                  )}
                  <button type="button"
                    onClick={() => handleMarkReady(order.id)}
                    className="flex-1 rounded-md bg-brass px-2 min-h-[36px] py-1.5 text-xs font-medium text-ink hover:opacity-90"
                  >
                    {t('Mark ready')}
                  </button>
                  <button type="button"
                    onClick={() => handleReprint(order.id)}
                    disabled={reprintingId === order.id}
                    title={t('Reprint ticket')}
                    className="rounded-md border border-ink-line px-2 min-h-[36px] py-1.5 text-xs text-ivory-dim hover:border-brass/40 hover:text-ivory disabled:opacity-50"
                  >
                    {reprintingId === order.id ? '…' : t('Reprint')}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
