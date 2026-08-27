import { useEffect, useMemo, useState } from 'react';
import { subscribeToDemoOrders, subscribeToDemoRequests } from '../lib/supabaseClient';
import { Bell, Receipt, UtensilsCrossed } from 'lucide-react';

const BASE = import.meta.env.VITE_API_BASE_URL || '';

interface DemoMenuItem {
  id: string;
  name: string;
  description: string;
  price_aed: number;
  image_url: string;
  category: string;
}
interface DemoOrderItem {
  id: string;
  name_snapshot: string;
  price_aed_snapshot: number;
  quantity: number;
}
interface DemoOrder {
  id: string;
  status: 'pending' | 'ready' | 'paid';
  created_at: string;
  demo_order_items: DemoOrderItem[];
}
interface DemoRequest {
  id: string;
  type: 'call_waiter' | 'request_bill';
  status: 'pending' | 'acknowledged';
  created_at: string;
}
interface DemoSettings {
  business_name: string;
  cover_image_url: string;
}

// A random id kept in localStorage for the life of this browser's demo
// session - not a login, not tied to any account. This is purely what
// keeps "my order" separate from anyone else demoing at the same time,
// and what lets a returning visitor's kitchen panel keep showing their
// own recent orders on refresh.
function getDemoSessionId(): string {
  const key = 'tavzio_demo_session';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export default function DemoPage() {
  const sessionId = useMemo(getDemoSessionId, []);
  const [settings, setSettings] = useState<DemoSettings | null>(null);
  const [menu, setMenu] = useState<DemoMenuItem[]>([]);
  const [orders, setOrders] = useState<DemoOrder[]>([]);
  const [requests, setRequests] = useState<DemoRequest[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [placing, setPlacing] = useState(false);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [sendingRequest, setSendingRequest] = useState<'call_waiter' | 'request_bill' | null>(null);
  const [rightTab, setRightTab] = useState<'kitchen' | 'notifications'>('kitchen');
  const [justSentRequest, setJustSentRequest] = useState<'call_waiter' | 'request_bill' | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/public/demo/menu`).then((r) => r.json()).then(setMenu).finally(() => setLoadingMenu(false));
    fetch(`${BASE}/api/public/demo/settings`).then((r) => r.json()).then(setSettings).catch(() => {});
  }, []);

  function reloadOrders() {
    fetch(`${BASE}/api/public/demo/orders?sessionId=${sessionId}`).then((r) => r.json()).then(setOrders).catch(() => {});
  }
  function reloadRequests() {
    fetch(`${BASE}/api/public/demo/requests?sessionId=${sessionId}`).then((r) => r.json()).then(setRequests).catch(() => {});
  }
  useEffect(() => { reloadOrders(); reloadRequests(); }, [sessionId]);

  // The actual "immediately" requirement - a genuine Realtime
  // subscription, not a polling interval, is what makes an order (or a
  // Call Waiter / Request the Bill tap) placed on the left panel appear
  // on the staff-facing side on the right without any perceptible delay.
  useEffect(() => {
    const unsubOrders = subscribeToDemoOrders(sessionId, reloadOrders);
    const unsubRequests = subscribeToDemoRequests(sessionId, reloadRequests);
    return () => { unsubOrders(); unsubRequests(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const grouped = menu.reduce<Record<string, DemoMenuItem[]>>((acc, item) => {
    (acc[item.category] ||= []).push(item);
    return acc;
  }, {});

  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = menu.find((m) => m.id === id);
    return sum + (item ? item.price_aed * qty : 0);
  }, 0);
  const cartCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);

  function addToCart(itemId: string) {
    setCart((prev) => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 }));
  }
  function removeFromCart(itemId: string) {
    setCart((prev) => {
      const next = { ...prev };
      if (next[itemId] > 1) next[itemId] -= 1;
      else delete next[itemId];
      return next;
    });
  }

  async function handlePlaceOrder() {
    if (cartCount === 0) return;
    setPlacing(true);
    try {
      await fetch(`${BASE}/api/public/demo/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          items: Object.entries(cart).map(([menuItemId, quantity]) => ({ menuItemId, quantity })),
        }),
      });
      setCart({});
      reloadOrders();
    } finally {
      setPlacing(false);
    }
  }

  const unpaidOrders = orders.filter((o) => o.status !== 'paid');
  const unpaidTotal = unpaidOrders.reduce((sum, o) => sum + o.demo_order_items.reduce((s, i) => s + i.price_aed_snapshot * i.quantity, 0), 0);

  async function handlePayBill() {
    for (const order of unpaidOrders) {
      setPayingOrderId(order.id);
      await fetch(`${BASE}/api/public/demo/orders/${order.id}/pay`, { method: 'POST' });
    }
    setPayingOrderId(null);
    reloadOrders();
  }

  async function handleMarkReady(orderId: string) {
    await fetch(`${BASE}/api/public/demo/orders/${orderId}/ready`, { method: 'PATCH' });
    reloadOrders();
  }

  // Real notification flow, not a decorative button - sends an actual
  // request row, surfaces it live on the Notifications tab (with a
  // real unread badge), and gives the guest side a brief confirmation
  // so tapping it feels like it genuinely did something.
  async function handleSendRequest(type: 'call_waiter' | 'request_bill') {
    setSendingRequest(type);
    try {
      await fetch(`${BASE}/api/public/demo/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, type }),
      });
      reloadRequests();
      setJustSentRequest(type);
      setTimeout(() => setJustSentRequest(null), 3000);
    } finally {
      setSendingRequest(null);
    }
  }

  async function handleAcknowledgeRequest(requestId: string) {
    await fetch(`${BASE}/api/public/demo/requests/${requestId}/acknowledge`, { method: 'PATCH' });
    reloadRequests();
  }

  const pendingRequestCount = requests.filter((r) => r.status === 'pending').length;
  const pendingKitchenCount = orders.filter((o) => o.status === 'pending').length;

  return (
    <div className="min-h-screen bg-ink px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <p className="text-sm uppercase tracking-wide text-brass">Live Demo</p>
          <h1 className="mt-1 font-display text-3xl text-ivory sm:text-4xl">Try the guest experience for real</h1>
          <p className="mx-auto mt-2 max-w-2xl text-base text-ivory-dim">
            This is the exact screen a guest sees after tapping an NFC card at the table. Order something on the
            left, then watch it hit the staff side instantly on the right - no signup, nothing real happens.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {/* LEFT: the actual customer-facing NFC landing experience,
              phone-framed so it visually reads as "what a guest sees",
              not just another section of the marketing page. */}
          <div className="mx-auto w-full max-w-sm rounded-[2rem] border-4 border-ink-line bg-ink-soft p-4 shadow-2xl shadow-black/50">
            <div className="overflow-hidden rounded-2xl bg-ink">
              {/* Real business photo, not a placeholder circle - the
                  actual identity a guest would recognize, managed by
                  super_admin so this stays current without a redeploy. */}
              {settings?.cover_image_url ? (
                <img src={settings.cover_image_url} alt={settings.business_name} className="h-32 w-full object-cover" />
              ) : (
                <div className="flex h-32 w-full items-center justify-center bg-gradient-to-br from-brass/20 to-ink">
                  <UtensilsCrossed size={32} strokeWidth={1.5} className="text-brass/40" />
                </div>
              )}
              <div className="p-4">
                <div className="text-center">
                  <p className="font-display text-xl text-ivory">{settings?.business_name || 'Al Bait Restaurant'}</p>
                  <p className="text-sm text-ivory-dim">Table 4 · Demo</p>
                </div>

                {/* Real Call Waiter / Request the Bill - the actual
                    notification flow, not simulated. */}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSendRequest('call_waiter')}
                    disabled={sendingRequest === 'call_waiter'}
                    className="flex flex-col items-center gap-1 rounded-lg border border-ink-line px-2 py-2.5 text-xs text-ivory-dim transition-colors hover:border-brass/40 hover:text-ivory disabled:opacity-50"
                  >
                    <Bell size={16} strokeWidth={1.75} />
                    {justSentRequest === 'call_waiter' ? 'Waiter notified!' : 'Call Waiter'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendRequest('request_bill')}
                    disabled={sendingRequest === 'request_bill'}
                    className="flex flex-col items-center gap-1 rounded-lg border border-ink-line px-2 py-2.5 text-xs text-ivory-dim transition-colors hover:border-brass/40 hover:text-ivory disabled:opacity-50"
                  >
                    <Receipt size={16} strokeWidth={1.75} />
                    {justSentRequest === 'request_bill' ? 'Request sent!' : 'Request the Bill'}
                  </button>
                </div>

                {cartCount > 0 && (
                  <div className="mt-4 rounded-lg border border-brass/30 bg-ink-soft px-3 py-2 text-sm text-ivory">
                    {cartCount} item{cartCount > 1 ? 's' : ''} · AED {cartTotal.toFixed(2)}
                  </div>
                )}

                {unpaidOrders.length > 0 && (
                  <button
                    type="button"
                    onClick={handlePayBill}
                    disabled={!!payingOrderId}
                    className="mt-4 w-full rounded-lg border border-brass/40 px-3 py-2.5 text-base text-brass hover:bg-brass/10 disabled:opacity-50"
                  >
                    {payingOrderId ? 'Processing...' : `Pay Bill · AED ${unpaidTotal.toFixed(2)}`}
                  </button>
                )}

                <div className="mt-4 max-h-[24rem] space-y-4 overflow-y-auto">
                  {loadingMenu && <p className="text-sm text-ivory-dim">Loading menu...</p>}
                  {Object.entries(grouped).map(([category, categoryItems]) => (
                    <div key={category}>
                      <p className="text-sm uppercase tracking-wide text-brass">{category}</p>
                      <div className="mt-1.5 space-y-2">
                        {categoryItems.map((item) => (
                          <div key={item.id} className="flex items-center gap-3 rounded-lg border border-ink-line p-2">
                            {item.image_url && <img src={item.image_url} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-ivory">{item.name}</p>
                              <p className="text-sm text-ivory-dim">AED {item.price_aed.toFixed(2)}</p>
                            </div>
                            {cart[item.id] ? (
                              <div className="flex shrink-0 items-center gap-2">
                                <button type="button" onClick={() => removeFromCart(item.id)} className="h-6 w-6 rounded border border-ink-line text-ivory-dim">-</button>
                                <span className="w-4 text-center text-sm text-ivory">{cart[item.id]}</span>
                                <button type="button" onClick={() => addToCart(item.id)} className="h-6 w-6 rounded border border-brass/40 text-brass">+</button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => addToCart(item.id)} className="shrink-0 rounded-lg border border-brass/40 px-2.5 py-1 text-sm text-brass hover:bg-brass/10">
                                Add
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {!loadingMenu && menu.length === 0 && (
                    <p className="text-sm text-ivory-dim">The demo menu hasn't been set up yet - check back soon.</p>
                  )}
                </div>

                {cartCount > 0 && (
                  <button
                    type="button"
                    onClick={handlePlaceOrder}
                    disabled={placing}
                    className="mt-4 w-full rounded-lg bg-brass px-4 py-2.5 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50"
                  >
                    {placing ? 'Sending order...' : `Place order · AED ${cartTotal.toFixed(2)}`}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: the staff-facing side - a real tab switch between
              Kitchen Display and Notifications (Call Waiter / Request
              the Bill), same layout language as the actual staff
              dashboard's Kitchen and Requests tabs, so the demo
              genuinely shows "this is the same product," not a mocked-up
              screenshot. */}
          <div className="rounded-2xl border border-ink-line bg-ink-soft p-5">
            <div className="flex gap-2 border-b border-ink-line">
              <button
                type="button"
                onClick={() => setRightTab('kitchen')}
                className={`relative px-3 py-2 text-sm ${rightTab === 'kitchen' ? 'border-b-2 border-brass text-brass' : 'text-ivory-dim hover:text-ivory'}`}
              >
                Kitchen Display
                {pendingKitchenCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-medium text-status-text">{pendingKitchenCount}</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setRightTab('notifications')}
                className={`relative px-3 py-2 text-sm ${rightTab === 'notifications' ? 'border-b-2 border-brass text-brass' : 'text-ivory-dim hover:text-ivory'}`}
              >
                Notifications
                {pendingRequestCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-medium text-status-text">{pendingRequestCount}</span>
                )}
              </button>
            </div>

            {rightTab === 'kitchen' && (
              <>
                <p className="mt-3 text-sm text-ivory-dim">Updates instantly the moment an order is placed on the left.</p>
                <div className="mt-4 space-y-3">
                  {orders.filter((o) => o.status === 'pending').map((order) => (
                    <div key={order.id} className="animate-hero-rise rounded-lg border border-brass/30 bg-ink p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-brass">Table 4</p>
                        <button type="button" onClick={() => handleMarkReady(order.id)} className="rounded-lg border border-brass/40 px-2.5 py-1 text-sm text-brass hover:bg-brass/10">
                          Mark ready
                        </button>
                      </div>
                      <ul className="mt-2 space-y-1">
                        {order.demo_order_items.map((item) => (
                          <li key={item.id} className="text-base text-ivory">{item.quantity}× {item.name_snapshot}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {orders.filter((o) => o.status === 'ready').map((order) => (
                    <div key={order.id} className="rounded-lg border border-success/30 bg-ink p-4 opacity-70">
                      <p className="text-sm text-success">Ready · Table 4</p>
                      <ul className="mt-2 space-y-1">
                        {order.demo_order_items.map((item) => (
                          <li key={item.id} className="text-base text-ivory">{item.quantity}× {item.name_snapshot}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {orders.filter((o) => o.status === 'pending' || o.status === 'ready').length === 0 && (
                    <p className="text-ivory-dim">No orders yet - place one on the left to see it appear here instantly.</p>
                  )}
                </div>
              </>
            )}

            {rightTab === 'notifications' && (
              <>
                <p className="mt-3 text-sm text-ivory-dim">Every Call Waiter or Request the Bill tap on the left appears here live.</p>
                <div className="mt-4 space-y-3">
                  {requests.map((r) => (
                    <div
                      key={r.id}
                      className={`animate-hero-rise flex items-center justify-between gap-3 rounded-lg border p-4 ${r.status === 'pending' ? 'border-brass/30 bg-ink' : 'border-ink-line bg-ink opacity-60'}`}
                    >
                      <div className="flex items-center gap-3">
                        {r.type === 'call_waiter' ? <Bell size={18} strokeWidth={1.75} className="text-brass" /> : <Receipt size={18} strokeWidth={1.75} className="text-brass" />}
                        <div>
                          <p className="text-base text-ivory">{r.type === 'call_waiter' ? 'Call Waiter' : 'Request the Bill'}</p>
                          <p className="text-xs text-ivory-dim">Table 4 · {new Date(r.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</p>
                        </div>
                      </div>
                      {r.status === 'pending' ? (
                        <button type="button" onClick={() => handleAcknowledgeRequest(r.id)} className="shrink-0 rounded-lg border border-brass/40 px-2.5 py-1 text-sm text-brass hover:bg-brass/10">
                          Acknowledge
                        </button>
                      ) : (
                        <span className="shrink-0 text-xs text-ivory-dim">Done</span>
                      )}
                    </div>
                  ))}
                  {requests.length === 0 && (
                    <p className="text-ivory-dim">No requests yet - tap Call Waiter or Request the Bill on the left to see it appear here instantly.</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
