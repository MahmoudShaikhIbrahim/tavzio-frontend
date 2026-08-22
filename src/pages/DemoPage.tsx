import { useEffect, useMemo, useState } from 'react';
import { subscribeToDemoOrders } from '../lib/supabaseClient';

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
  const [menu, setMenu] = useState<DemoMenuItem[]>([]);
  const [orders, setOrders] = useState<DemoOrder[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [placing, setPlacing] = useState(false);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/public/demo/menu`).then((r) => r.json()).then(setMenu).finally(() => setLoadingMenu(false));
  }, []);

  function reloadOrders() {
    fetch(`${BASE}/api/public/demo/orders?sessionId=${sessionId}`).then((r) => r.json()).then(setOrders).catch(() => {});
  }
  useEffect(reloadOrders, [sessionId]);

  // The actual "immediately" requirement - a genuine Realtime
  // subscription, not a polling interval, is what makes an order
  // placed on the left panel appear on the kitchen display on the
  // right without any perceptible delay.
  useEffect(() => {
    const unsubscribe = subscribeToDemoOrders(sessionId, reloadOrders);
    return unsubscribe;
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

  return (
    <div className="min-h-screen bg-ink px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <p className="text-sm uppercase tracking-wide text-brass">Live Demo</p>
          <h1 className="mt-1 font-display text-3xl text-ivory sm:text-4xl">Try the guest experience for real</h1>
          <p className="mx-auto mt-2 max-w-2xl text-base text-ivory-dim">
            This is the exact screen a guest sees after tapping an NFC card at the table. Order something on the
            left, then watch it hit the kitchen instantly on the right - no signup, nothing real happens.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {/* LEFT: the actual customer-facing NFC landing experience,
              phone-framed so it visually reads as "what a guest sees",
              not just another section of the marketing page. */}
          <div className="mx-auto w-full max-w-sm rounded-[2rem] border-4 border-ink-line bg-ink-soft p-4 shadow-2xl shadow-black/50">
            <div className="rounded-2xl bg-ink p-4">
              <div className="text-center">
                <div className="mx-auto h-14 w-14 rounded-full bg-brass/20" />
                <p className="mt-2 font-display text-xl text-ivory">Al Bait Restaurant</p>
                <p className="text-sm text-ivory-dim">Table 4 · Demo</p>
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

              <div className="mt-4 max-h-[28rem] space-y-4 overflow-y-auto">
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

          {/* RIGHT: kitchen display, same layout language as the real
              staff dashboard's Kitchen tab, so the demo genuinely shows
              "this is the same product," not a mocked-up screenshot. */}
          <div className="rounded-2xl border border-ink-line bg-ink-soft p-5">
            <p className="font-display text-xl text-ivory">Kitchen Display</p>
            <p className="text-sm text-ivory-dim">Updates instantly the moment an order is placed on the left.</p>
            <div className="mt-4 space-y-3">
              {orders.filter((o) => o.status === 'pending').map((order) => (
                <div key={order.id} className="rounded-lg border border-brass/30 bg-ink p-4">
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
          </div>
        </div>
      </div>
    </div>
  );
}
