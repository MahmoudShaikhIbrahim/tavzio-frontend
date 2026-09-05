import { useEffect, useState } from 'react';
import { AlertTriangle, Flame, Check, Printer } from 'lucide-react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import { listOrders, updateOrderStatus, getBusiness, reprintKitchenTicket } from '../../lib/authApi';
import { subscribeToBusinessTable } from '../../lib/supabaseClient';
import { usePollingFallback } from '../../hooks/usePollingFallback';
import { playNotificationSound } from '../../lib/soundPlayer';
import SectionRequestNotifications from '../../components/SectionRequestNotifications';
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

// Real, explicit request: a drive-through ticket must be unmistakable
// at a glance among normal tickets - a distinct color (violet, used
// nowhere else on this screen) plus a live countdown to when the
// customer is actually arriving, not just when the order was placed.
function ArrivalCountdown({ arrivalAt }: { arrivalAt: string }) {
  const { t } = useT();
  const minutes = Math.round((new Date(arrivalAt).getTime() - Date.now()) / 60000);
  const label = minutes <= 0 ? t('Arriving now') : `${minutes} ${t('min')}`;
  return <span className="font-mono text-sm text-drivethrough">{label}</span>;
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
    }).catch(() => {});
    // Also pick up anything already 'preparing' - a ticket started but
    // not yet ready still needs to be visible on this screen, not just
    // freshly-pending ones.
    if (businessId) listOrders(businessId, 'preparing').then((rows) => {
      setOrders((prev) => {
        const pendingOnly = prev.filter((o) => o.status !== 'preparing');
        return [...pendingOnly, ...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      });
    }).catch(() => {});
  }

  useEffect(reload, [businessId]);
  // Explicit, system-wide request: an independent 5-second poll of this
  // page's own reload(), completely separate from the realtime
  // subscription below - a safety net so a missed/dropped Realtime
  // event is never more than 5s stale, with no manual refresh needed.
  usePollingFallback(reload, !!businessId);
  useEffect(() => {
    if (businessId) getBusiness(businessId).then((b) => setNotificationSettings(b.notification_settings)).catch(() => {});
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

  // Real restructure: two lanes instead of one mixed grid - "New" and
  // "In progress" is the actual mental model a kitchen already works in
  // (a ticket physically moves from the rail to the pass once started),
  // so the screen should show that same split instead of making someone
  // scan a "Preparing" badge on every card to tell the two apart. Same
  // Kanban shape a real kitchen board (or a Trello column) already uses
  // for exactly this kind of state-based flow.
  const newTickets = visibleOrders.filter((o) => o.status === 'pending');
  const inProgressTickets = visibleOrders.filter((o) => o.status === 'preparing');

  return (
    <div className="space-y-6">
      {businessId && <SectionRequestNotifications businessId={businessId} section="kitchen" />}
      <div className="flex items-center gap-2">
        <h1 className="font-display text-2xl text-ivory">{t('Kitchen')}</h1>
        {newOrderPulse && <span className="h-2 w-2 animate-pulse rounded-full bg-brass" />}
      </div>

      {stations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setStationFilter('all')} className={`rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${stationFilter === 'all' ? 'card-elevated bg-brass text-ink' : 'border border-ink-line text-ivory-dim hover:border-brass/50 hover:text-ivory'}`}>
            {t('All stations')}
          </button>
          {stations.map((s) => (
            <button type="button" key={s} onClick={() => setStationFilter(s)} className={`rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${stationFilter === s ? 'card-elevated bg-brass text-ink' : 'border border-ink-line text-ivory-dim hover:border-brass/50 hover:text-ivory'}`}>
              {s}
            </button>
          ))}
        </div>
      )}

      {visibleOrders.length === 0 ? (
        <p className="text-base text-ivory-dim">{t('No pending orders right now.')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <KitchenLane
            title={t('New')}
            count={newTickets.length}
            accent="brass"
            tickets={newTickets}
            stationFilter={stationFilter}
            reprintingId={reprintingId}
            onStart={handleStart}
            onMarkReady={handleMarkReady}
            onReprint={handleReprint}
            t={t}
          />
          <KitchenLane
            title={t('In progress')}
            count={inProgressTickets.length}
            accent="warning"
            tickets={inProgressTickets}
            stationFilter={stationFilter}
            reprintingId={reprintingId}
            onStart={handleStart}
            onMarkReady={handleMarkReady}
            onReprint={handleReprint}
            t={t}
          />
        </div>
      )}
    </div>
  );
}

function KitchenLane({ title, count, accent, tickets, stationFilter, reprintingId, onStart, onMarkReady, onReprint, t }: {
  title: string; count: number; accent: 'brass' | 'warning'; tickets: OrderRow[]; stationFilter: string; reprintingId: string | null;
  onStart: (id: string) => void; onMarkReady: (id: string) => void; onReprint: (id: string) => void; t: (s: string) => string;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-ivory-dim">{title}</h2>
        <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-medium ${accent === 'brass' ? 'bg-brass text-ink' : 'bg-warning text-ink'}`}>{count}</span>
      </div>
      {tickets.length === 0 ? (
        <p className="text-sm text-ivory-dim">{t('Nothing here.')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tickets.map((order) => (
            <KitchenTicket
              key={order.id}
              order={order}
              stationFilter={stationFilter}
              reprinting={reprintingId === order.id}
              onStart={() => onStart(order.id)}
              onMarkReady={() => onMarkReady(order.id)}
              onReprint={() => onReprint(order.id)}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KitchenTicket({ order, stationFilter, reprinting, onStart, onMarkReady, onReprint, t }: {
  order: OrderRow; stationFilter: string; reprinting: boolean;
  onStart: () => void; onMarkReady: () => void; onReprint: () => void; t: (s: string) => string;
}) {
  const minutes = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
  const urgency = minutes >= RED_AFTER_MINUTES ? 'danger' : minutes >= AMBER_AFTER_MINUTES ? 'warning' : null;
  const allFiredItems = order.order_items.filter((i) => !i.voided && i.course_status !== 'held');
  const firedItems = stationFilter === 'all' ? allFiredItems : allFiredItems.filter((i) => i.station === stationFilter);
  // Not shown in detail (a held course's items are deliberately not
  // visible yet) - just a heads-up that more is coming, and for which
  // course, so the kitchen can pace itself.
  const heldCourses = [...new Set(order.order_items.filter((i) => !i.voided && i.course_status === 'held').map((i) => i.course))];

  return (
    <div className={`overflow-hidden rounded-2xl border bg-ink-soft shadow-sm ${order.order_type === 'drive_through' ? 'border-drivethrough' : 'border-ink-line'}`}>
      {/* A colored top strip reads faster than a thin border at the
          distance a KDS screen is actually viewed from across a kitchen
          - the same real convention commercial kitchen displays (Toast,
          Square, Lightspeed) already use to signal an aging ticket, just
          implemented here with a genuine block of color instead of a 2px
          line. Drive-through always shows its own violet strip
          regardless of age - unmistakable at a glance, per the explicit
          request, rather than competing with the same red/yellow
          urgency colors every other ticket uses. */}
      <div className={`h-1 ${order.order_type === 'drive_through' ? 'bg-drivethrough' : urgency === 'danger' ? 'bg-danger' : urgency === 'warning' ? 'bg-warning' : 'bg-ink-line'}`} />
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <p className={`font-display text-lg font-medium ${order.order_type === 'drive_through' ? 'text-drivethrough' : 'text-ivory'}`}>
            {order.order_type === 'drive_through' ? t('Drive Through') : (order.table_label || t('No table'))}
          </p>
          <div className="flex items-center gap-1.5">
            {urgency && <AlertTriangle size={13} strokeWidth={2.25} className={urgency === 'danger' ? 'text-danger' : 'text-warning'} aria-hidden="true" />}
            <TicketAge createdAt={order.created_at} />
          </div>
        </div>
        {order.order_type === 'drive_through' && order.arrival_at && (
          <p className="mt-0.5 text-xs text-drivethrough">{t('Arriving in')} <ArrivalCountdown arrivalAt={order.arrival_at} /></p>
        )}

        <div className="mt-2.5 space-y-2 border-t border-ink-line pt-2.5">
          {firedItems.map((item) => (
            <div key={item.id} className="flex gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brass/15 font-mono text-[11px] font-semibold text-brass">{item.quantity}</span>
              <div className="text-ivory-dim">
                <span className="text-base font-medium text-ivory">{item.item_name}</span>
                {item.station && <span className="ml-1 text-xs uppercase tracking-wide text-brass">{item.station}</span>}
                {item.addons.length > 0 && (
                  <span className="block text-sm text-brass">+ {item.addons.map((a) => a.name).join(', ')}</span>
                )}
                {item.note && <span className="block text-sm italic text-ivory">— {item.note}</span>}
              </div>
            </div>
          ))}
        </div>

        {heldCourses.length > 0 && (
          <p className="mt-2 rounded-lg bg-ink px-2 py-1 text-xs text-brass">{t('Waiting to fire:')} {heldCourses.join(', ')}</p>
        )}
        {order.note && <p className="mt-2 rounded-lg border border-brass/30 bg-brass/5 px-2 py-1 text-xs italic text-brass">{t('Note:')} {order.note}</p>}

        <div className="mt-3 flex items-center gap-2">
          {order.status === 'pending' && (
            <button type="button"
              onClick={onStart}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-brass/40 min-h-[38px] py-2 text-sm font-medium text-brass hover:bg-brass/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
            >
              <Flame size={14} />
              {t('Start')}
            </button>
          )}
          <button type="button"
            onClick={onMarkReady}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brass min-h-[38px] py-2 text-sm font-medium text-ink hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-ink-soft"
          >
            <Check size={14} />
            {t('Mark ready')}
          </button>
          <button type="button"
            onClick={onReprint}
            disabled={reprinting}
            title={t('Reprint ticket')}
            aria-label={reprinting ? t('Reprinting...') : t('Reprint ticket')}
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border border-ink-line text-ivory-dim hover:border-brass/40 hover:text-ivory disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
          >
            <Printer size={14} className={reprinting ? 'animate-pulse' : ''} />
          </button>
        </div>
      </div>
    </div>
  );
}
