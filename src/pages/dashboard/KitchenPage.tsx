import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { listOrders, updateOrderStatus, getBusiness } from '../../lib/authApi';
import { subscribeToBusinessTable } from '../../lib/supabaseClient';
import { playNotificationSound } from '../../lib/soundPlayer';
import type { OrderRow, NotificationSettings } from '../../types';

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

  function reload() {
    if (businessId) listOrders(businessId, 'pending').then(setOrders);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="font-display text-2xl text-ivory">Kitchen</h1>
        {newOrderPulse && <span className="h-2 w-2 animate-pulse rounded-full bg-brass" />}
      </div>

      {orders.length === 0 && (
        <p className="text-base text-ivory-dim">No pending orders right now.</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {orders.map((order) => (
          <div key={order.id} className="rounded-xl border border-ink-line bg-ink-soft p-4">
            <p className="font-display text-xl text-ivory">{order.table_label || 'No table'}</p>
            <div className="mt-3 space-y-2 text-lg">
              {order.order_items.filter((i) => !i.voided).map((item) => (
                <div key={item.id} className="text-ivory-dim">
                  <span className="text-ivory">{item.quantity}×</span> {item.item_name}
                  {item.addons.length > 0 && (
                    <span className="block text-sm text-brass/70">+ {item.addons.map((a) => a.name).join(', ')}</span>
                  )}
                  {item.note && <span className="block text-sm italic">— {item.note}</span>}
                </div>
              ))}
            </div>
            {order.note && <p className="mt-2 text-sm italic text-brass">Note: {order.note}</p>}
            <button
              onClick={() => handleMarkReady(order.id)}
              className="mt-4 w-full rounded-lg bg-brass px-3 py-2.5 text-base font-medium text-ink hover:opacity-90"
            >
              Mark ready
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
