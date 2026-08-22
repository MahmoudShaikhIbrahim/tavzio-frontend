import { useEffect, useState, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { buildBusinessThemeVars } from '../lib/businessTheme';
import { subscribeToRoomUpdates } from '../lib/supabaseClient';
import { getIcon, getIconColor } from '../lib/iconLibrary';

const BASE = import.meta.env.VITE_API_BASE_URL || '';

interface FolioCharge {
  id: string;
  description: string;
  amount_aed: number;
  charge_type: string;
  created_at: string;
}

interface GuestServiceOption {
  id: string;
  routingType: string;
  label: string;
  options: string[];
}

interface GuestCustomButton {
  id: string;
  label: string;
  icon: string;
  image_url: string | null;
  url: string;
  button_type: 'link' | 'notification' | 'group';
  notification_destination: 'general' | 'housekeeping_task' | 'maintenance_ticket';
  target_section: string | null;
  parent_button_id: string | null;
}

interface PortalData {
  business: { name: string; slug: string; logoUrl: string; links: Record<string, string>; theme: { customerBackground?: string; customerButton?: string } };
  // null for a lobby/unassigned stand - no specific room to show.
  room: { id: string; roomNumber: string; roomType: string } | null;
  guest: { name: string; checkInDate: string; checkOutDate: string } | null;
  folioId: string | null;
  folioBalance: number | null;
  vatBreakdown: { subtotalExVat: number; vatAmount: number; vatRate: number; totalIncVat: number } | null;
  charges: FolioCharge[];
  guestServices: GuestServiceOption[];
  customButtons: GuestCustomButton[];
}

interface OutletItem {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  categoryId: string | null;
}

interface Outlet {
  id: string;
  name: string;
  outletType: 'restaurant' | 'room_service' | 'bar' | 'pool' | 'breakfast' | 'other';
  location: string;
  openingHours: string;
  items: OutletItem[];
}

interface TrackedRequest {
  id: string;
  kind: 'general' | 'housekeeping' | 'maintenance' | 'order';
  label: string;
  status: string;
  createdAt: string;
}

type View = 'home' | 'roomService' | 'outlet' | 'myBill' | 'myRequests' | 'request' | 'reception' | 'feedback';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Submitted', open: 'Submitted', in_progress: 'In progress',
  done: 'Completed', resolved: 'Completed',
};

export default function HotelGuestPortalPage() {
  // roomId is present for an in-room stand, absent for a lobby/reception/
  // unassigned one - both now reach this same page (see resolveCardTap),
  // and portalBase is the one place that decides which backend path to
  // call, so every fetch and child component below just uses portalBase
  // and never has to re-derive the room-vs-lobby distinction itself.
  const { slug, roomId } = useParams<{ slug: string; roomId?: string }>();
  const portalBase = slug ? (roomId ? `/hotel/${slug}/room/${roomId}` : `/hotel/${slug}/hotel-portal`) : '';
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<PortalData | null>(null);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('home');
  const [activeOutlet, setActiveOutlet] = useState<Outlet | null>(null);
  const [activeRequestService, setActiveRequestService] = useState<GuestServiceOption | null>(null);
  const [paying, setPaying] = useState(false);
  const [payResult, setPayResult] = useState<'success' | 'failed' | null>(null);

  function reload() {
    if (!slug) return;
    fetch(`${BASE}/api/public${portalBase}`).then((r) => r.json()).then(setData).finally(() => setLoading(false));
    // Ordering only exists for a room with a folio to charge it to - a
    // lobby stand has no roomId, so this is skipped entirely rather than
    // hitting a route that doesn't exist for that case (there is no
    // /hotel-portal/outlets endpoint, deliberately - see publicRoutes.js).
    if (roomId) {
      fetch(`${BASE}/api/public${portalBase}/outlets`).then((r) => r.json()).then(setOutlets).catch(() => {});
    }
  }
  useEffect(reload, [slug, roomId]);

  // Real-time, genuinely instant - a Supabase Realtime subscription
  // scoped to this room (see migration 0047 + subscribeToRoomUpdates),
  // not a polling loop. Staff marking something "in progress" or "done"
  // pushes to this screen the moment it happens, same mechanism the
  // rest of the dashboard already uses for live updates elsewhere.
  const [requests, setRequests] = useState<TrackedRequest[]>([]);
  function refreshRequests() {
    if (!slug) return;
    fetch(`${BASE}/api/public${portalBase}/my-requests`).then((r) => r.json()).then(setRequests).catch(() => {});
  }
  useEffect(refreshRequests, [slug, roomId]);
  useEffect(() => {
    if (!roomId) return;
    const unsubscribe = subscribeToRoomUpdates(roomId, refreshRequests);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    const txnId = searchParams.get('folioPaymentTxnId');
    if (!txnId || !slug || !roomId) return;
    fetch(`${BASE}/api/public${portalBase}/folio/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId: txnId }),
    })
      .then((r) => { setPayResult(r.ok ? 'success' : 'failed'); return r.json(); })
      .then(() => reload())
      .catch(() => setPayResult('failed'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, slug, roomId]);

  async function handlePayBill() {
    if (!slug || !roomId) return;
    setPaying(true);
    try {
      const res = await fetch(`${BASE}/api/public${portalBase}/folio/pay`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      });
      const result = await res.json();
      if (!res.ok) { alert(result.message || 'Could not start payment'); setPaying(false); return; }
      window.location.href = result.redirectUrl;
    } catch {
      alert('Could not start payment - check your connection and try again');
      setPaying(false);
    }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-ink"><div className="h-8 w-8 animate-pulse rounded-full border-2 border-brass/40" /></div>;
  if (!data) return <div className="flex min-h-screen items-center justify-center bg-ink px-6 text-center text-ivory-dim">This portal isn't available right now.</div>;

  const themeVars = buildBusinessThemeVars(data.business.theme?.customerBackground, data.business.theme?.customerButton);

  return (
    <div style={themeVars} className="min-h-screen bg-ink px-5 py-8">
      <div className="mx-auto max-w-md space-y-5">
        <Header data={data} />

        {payResult && (
          <div className={`rounded-lg border px-4 py-3 text-center text-sm ${payResult === 'success' ? 'border-success/40 bg-success/10 text-success' : 'border-danger/40 bg-danger/10 text-danger'}`}>
            {payResult === 'success' ? 'Payment received - thank you.' : 'Payment was not completed. Please try again.'}
          </div>
        )}

        {view !== 'home' && (
          <button type="button" onClick={() => { setView('home'); setActiveOutlet(null); setActiveRequestService(null); }} className="text-sm text-brass hover:underline">
            ← Back
          </button>
        )}

        {view === 'home' && (
          <HomeView
            data={data}
            outlets={outlets}
            portalBase={portalBase}
            requestsCount={requests.filter((r) => r.status !== 'done' && r.status !== 'resolved').length}
            onSelectOutlet={(o) => { setActiveOutlet(o); setView('outlet'); }}
            onNav={setView}
            onRequestCategory={(s) => { setActiveRequestService(s); setView('request'); }}
          />
        )}

        {view === 'outlet' && activeOutlet && (
          <OutletOrderView portalBase={portalBase} outlet={activeOutlet} onDone={() => { setView('home'); reload(); }} />
        )}

        {view === 'myBill' && <MyBillView data={data} paying={paying} onPay={handlePayBill} />}

        {view === 'myRequests' && <MyRequestsView requests={requests} />}

        {view === 'request' && activeRequestService && (
          <RequestFormView
            portalBase={portalBase}
            service={activeRequestService}
            onDone={() => setView('home')}
          />
        )}

        {view === 'reception' && <ReceptionView portalBase={portalBase} onDone={() => setView('home')} />}
        {view === 'feedback' && <FeedbackView portalBase={portalBase} onDone={() => setView('home')} />}
      </div>
    </div>
  );
}

function Header({ data }: { data: PortalData }) {
  return (
    <div className="text-center">
      {data.business.logoUrl && <img src={data.business.logoUrl} alt={data.business.name} className="mx-auto mb-3 h-14 w-14 rounded-full object-cover" />}
      <p className="font-display text-2xl text-ivory">{data.business.name}</p>
      {data.room ? (
        data.guest ? (
          <p className="text-sm text-ivory-dim">
            Welcome, {data.guest.name} · Room {data.room.roomNumber}
            {data.guest.checkInDate && data.guest.checkOutDate && (
              <> · {new Date(data.guest.checkInDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}–{new Date(data.guest.checkOutDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</>
            )}
          </p>
        ) : (
          <p className="text-sm text-ivory-dim">Room {data.room.roomNumber}</p>
        )
      ) : (
        <p className="text-sm text-ivory-dim">Front Desk</p>
      )}
    </div>
  );
}

function HomeView({ data, outlets, portalBase, requestsCount, onSelectOutlet, onNav, onRequestCategory }: {
  data: PortalData; outlets: Outlet[]; portalBase: string; requestsCount: number;
  onSelectOutlet: (o: Outlet) => void; onNav: (v: View) => void; onRequestCategory: (service: GuestServiceOption) => void;
}) {
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  if (openGroupId) {
    const group = data.customButtons.find((b) => b.id === openGroupId);
    const children = data.customButtons.filter((b) => b.parent_button_id === openGroupId);
    return (
      <div className="space-y-2">
        <button type="button" onClick={() => setOpenGroupId(null)} className="text-sm text-brass hover:underline">&larr; {group?.label || 'Back'}</button>
        {children.map((btn) => (
          <CustomButtonItem key={btn.id} btn={btn} portalBase={portalBase} onOpenGroup={setOpenGroupId} />
        ))}
        {children.length === 0 && <p className="text-sm text-ivory-dim">Nothing here yet.</p>}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button type="button" onClick={() => onNav('myRequests')} className="flex w-full items-center justify-between rounded-xl border border-brass/30 bg-ink-soft px-4 py-3 text-left">
        <span className="text-base text-ivory">My Requests</span>
        {requestsCount > 0 && <span className="rounded-full bg-brass px-2 py-0.5 text-xs font-medium text-ink">{requestsCount} active</span>}
      </button>

      {data.folioBalance !== null && (
        <button type="button" onClick={() => onNav('myBill')} className="w-full rounded-xl border border-brass/30 bg-ink-soft p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-brass">My Bill</p>
          <p className="mt-1 font-display text-2xl text-ivory">AED {data.folioBalance.toFixed(2)}</p>
          <p className="mt-1 text-sm text-ivory-dim">Tap to view details and pay</p>
        </button>
      )}

      {outlets.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-wide text-brass">Order</p>
          {outlets.map((o) => (
            <button type="button" key={o.id} onClick={() => onSelectOutlet(o)} className="flex w-full items-center justify-between rounded-lg border border-ink-line px-4 py-3 text-left hover:border-brass">
              <span className="text-ivory">{outletIcon(o.outletType)} {o.name}</span>
              <span className="text-xs text-ivory-dim">{o.openingHours}</span>
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-brass">Services</p>
        {data.guestServices.map((s) => (
          <button type="button" key={s.id} onClick={() => onRequestCategory(s)} className="w-full rounded-lg border border-ink-line px-4 py-3 text-left text-ivory hover:border-brass">
            {s.label}
          </button>
        ))}
        {/* Landing Page Buttons - same customization system as the
            restaurant-facing page, on the one page a hotel guest
            actually reaches, room-bound or not. Only top-level buttons
            render directly; a group's own children only appear once
            that group is opened. */}
        {data.customButtons.filter((b) => !b.parent_button_id).map((btn) => (
          <CustomButtonItem key={btn.id} btn={btn} portalBase={portalBase} onOpenGroup={setOpenGroupId} />
        ))}
        <button type="button" onClick={() => onNav('reception')} className="w-full rounded-lg border border-ink-line px-4 py-3 text-left text-ivory hover:border-brass">
          Reception
        </button>
        <button type="button" onClick={() => onNav('feedback')} className="w-full rounded-lg border border-ink-line px-4 py-3 text-left text-ivory hover:border-brass">
          Feedback
        </button>
      </div>
    </div>
  );
}

function CustomButtonItem({ btn, portalBase, onOpenGroup }: {
  btn: GuestCustomButton; portalBase: string; onOpenGroup: (id: string) => void;
}) {
  const Icon = getIcon(btn.icon);
  const brandColor = getIconColor(btn.icon);
  const iconEl = btn.image_url ? (
    <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-ink-line">
      <img src={btn.image_url} alt="" className="h-full w-full object-cover" />
    </span>
  ) : (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brass/40 text-brass" style={brandColor ? { color: brandColor, borderColor: `${brandColor}66` } : undefined}>
      <Icon size={15} />
    </span>
  );

  if (btn.button_type === 'group') {
    return (
      <button type="button" onClick={() => onOpenGroup(btn.id)} className="flex w-full items-center gap-3 rounded-lg border border-ink-line px-4 py-3 text-left text-ivory hover:border-brass">
        {iconEl}
        <span>{btn.label}</span>
        <span className="ml-auto text-ivory-dim">&rsaquo;</span>
      </button>
    );
  }

  if (btn.button_type === 'notification') {
    return <CustomNotificationButton btn={btn} portalBase={portalBase} iconEl={iconEl} />;
  }

  return (
    <a href={btn.url} target="_blank" rel="noreferrer" className="flex w-full items-center gap-3 rounded-lg border border-ink-line px-4 py-3 text-left text-ivory hover:border-brass">
      {iconEl}
      <span>{btn.label}</span>
    </a>
  );
}

// Notification-type custom buttons need somewhere to actually land for a
// hotel guest, who has no tap-event the way the restaurant landing page
// does - reuses the same request endpoint Services already uses (room-
// scoped or the lobby variant, whichever portalBase points at), routed
// the same way submitGuestRequest already routes housekeeping/maintenance
// destinations, so both button systems land in the exact same real
// staff-facing queues either way.
function CustomNotificationButton({ btn, portalBase, iconEl }: { btn: GuestCustomButton; portalBase: string; iconEl: ReactNode }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function handleClick() {
    setState('sending');
    try {
      const requestType = btn.notification_destination === 'housekeeping_task' ? 'housekeeping'
        : btn.notification_destination === 'maintenance_ticket' ? 'maintenance'
        : 'other';
      const res = await fetch(`${BASE}/api/public${portalBase}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType, note: btn.label }),
      });
      if (!res.ok) throw new Error();
      setState('sent');
    } catch {
      setState('error');
    }
  }

  if (state === 'sent') {
    return (
      <div className="flex w-full items-center gap-3 rounded-lg border border-brass/40 px-4 py-3 text-left text-brass">
        {iconEl}
        <span>Staff notified</span>
      </div>
    );
  }

  return (
    <button type="button" onClick={handleClick} disabled={state === 'sending'} className="flex w-full items-center gap-3 rounded-lg border border-ink-line px-4 py-3 text-left text-ivory hover:border-brass disabled:opacity-50">
      {iconEl}
      <span>{state === 'sending' ? 'Sending...' : state === 'error' ? `${btn.label} - tap to try again` : btn.label}</span>
    </button>
  );
}

function outletIcon(type: Outlet['outletType']) {
  return { restaurant: '🍽', room_service: '🍽', bar: '🍸', pool: '🏊', breakfast: '🍳', other: '🛎' }[type] || '🛎';
}

function OutletOrderView({ portalBase, outlet, onDone }: { portalBase: string; outlet: Outlet; onDone: () => void }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function changeQty(itemId: string, delta: number) {
    setCart((prev) => {
      const next = { ...prev, [itemId]: Math.max(0, (prev[itemId] || 0) + delta) };
      if (next[itemId] === 0) delete next[itemId];
      return next;
    });
  }

  const total = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = outlet.items.find((i) => i.id === id);
    return sum + (item ? item.price * qty : 0);
  }, 0);

  async function handleSubmit() {
    if (Object.keys(cart).length === 0) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${BASE}/api/public${portalBase}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outletId: outlet.id,
          items: Object.entries(cart).map(([menuItemId, quantity]) => ({ menuItemId, quantity })),
          paymentMethod: 'room',
        }),
      });
      const result = await res.json();
      if (!res.ok) { setError(result.message || 'Could not place order'); setSubmitting(false); return; }
      setSuccess(result.message || 'Order sent - charged to your room.');
      setCart({});
    } catch {
      setError('Could not reach the server - please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-base text-success">{success}</p>
        <button type="button" onClick={onDone} className="rounded-lg bg-brass px-4 py-2.5 text-base font-medium text-ink">Done</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="font-display text-xl text-ivory">{outlet.name}</p>
        <p className="text-sm text-ivory-dim">{outlet.location}{outlet.location && outlet.openingHours ? ' · ' : ''}{outlet.openingHours}</p>
      </div>
      <div className="space-y-3">
        {outlet.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-ink-line p-3">
            {item.imageUrl && (
              <img src={item.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-base text-ivory">{item.name}</p>
              {item.description && <p className="text-sm text-ivory-dim">{item.description}</p>}
              <p className="text-sm text-brass">AED {item.price.toFixed(2)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => changeQty(item.id, -1)} className="h-7 w-7 rounded border border-ink-line text-ivory-dim">-</button>
              <span className="w-5 text-center text-ivory">{cart[item.id] || 0}</span>
              <button type="button" onClick={() => changeQty(item.id, 1)} className="h-7 w-7 rounded border border-ink-line text-ivory-dim">+</button>
            </div>
          </div>
        ))}
        {outlet.items.length === 0 && <p className="text-ivory-dim">Nothing on the menu here yet.</p>}
      </div>
      {Object.keys(cart).length > 0 && (
        <div className="rounded-lg border border-brass/30 bg-ink-soft p-4">
          <div className="flex justify-between text-base">
            <span className="text-ivory">Total</span>
            <span className="text-brass">AED {total.toFixed(2)}</span>
          </div>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          <button type="button" onClick={handleSubmit} disabled={submitting} className="mt-3 w-full rounded-lg bg-brass px-4 py-2.5 text-base font-medium text-ink disabled:opacity-50">
            {submitting ? 'Sending...' : 'Charge to Room'}
          </button>
        </div>
      )}
    </div>
  );
}

function MyBillView({ data, paying, onPay }: { data: PortalData; paying: boolean; onPay: () => void }) {
  return (
    <div className="space-y-4">
      <p className="font-display text-xl text-ivory">My Bill</p>
      <div className="space-y-2 rounded-lg border border-ink-line p-4">
        {data.charges.map((c) => (
          <div key={c.id} className="flex justify-between text-sm">
            <span className="text-ivory-dim">{c.description}</span>
            <span className={Number(c.amount_aed) < 0 ? 'text-success' : 'text-ivory'}>AED {Number(c.amount_aed).toFixed(2)}</span>
          </div>
        ))}
        {data.charges.length === 0 && <p className="text-sm text-ivory-dim">No charges yet.</p>}
      </div>
      {data.vatBreakdown && (
        <div className="space-y-1 rounded-lg border border-ink-line p-4 text-sm">
          <div className="flex justify-between text-ivory-dim">
            <span>Subtotal (excl. VAT)</span>
            <span>AED {data.vatBreakdown.subtotalExVat.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-ivory-dim">
            <span>VAT (5%)</span>
            <span>AED {data.vatBreakdown.vatAmount.toFixed(2)}</span>
          </div>
        </div>
      )}
      <div className="rounded-xl border border-brass/30 bg-ink-soft p-4 text-center">
        <p className="text-xs uppercase tracking-wide text-brass">Current balance</p>
        <p className="mt-1 font-display text-2xl text-ivory">AED {(data.folioBalance ?? 0).toFixed(2)}</p>
        {(data.folioBalance ?? 0) > 0 && (
          <button type="button" onClick={onPay} disabled={paying} className="mt-3 w-full rounded-lg bg-brass px-4 py-2.5 text-base font-medium text-ink disabled:opacity-50">
            {paying ? 'Starting payment...' : 'Pay by card'}
          </button>
        )}
      </div>
    </div>
  );
}

function MyRequestsView({ requests }: { requests: TrackedRequest[] }) {
  return (
    <div className="space-y-3">
      <p className="font-display text-xl text-ivory">My Requests</p>
      {requests.map((r) => (
        <div key={`${r.kind}-${r.id}`} className="flex items-center justify-between rounded-lg border border-ink-line px-4 py-3">
          <span className="capitalize text-ivory">{r.label}</span>
          <span className={`text-sm ${r.status === 'done' || r.status === 'resolved' ? 'text-success' : 'text-brass'}`}>
            {STATUS_LABEL[r.status] || r.status}
          </span>
        </div>
      ))}
      {requests.length === 0 && <p className="text-ivory-dim">Nothing submitted yet.</p>}
    </div>
  );
}

function RequestFormView({ portalBase, service, onDone }: { portalBase: string; service: GuestServiceOption; onDone: () => void }) {
  const [option, setOption] = useState(service.options?.[0] || '');
  const [note, setNote] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${BASE}/api/public${portalBase}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: service.routingType,
          note: [option, note].filter(Boolean).join(' - '),
          quantity: service.routingType === 'towels' ? quantity : undefined,
        }),
      });
      if (!res.ok) { const r = await res.json(); setError(r.message || 'Could not send request'); setSubmitting(false); return; }
      setSuccess(true);
    } catch {
      setError('Could not reach the server - please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-base text-success">Request sent - our team has been notified.</p>
        <button type="button" onClick={onDone} className="rounded-lg bg-brass px-4 py-2.5 text-base font-medium text-ink">Done</button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-ink-line p-4">
      <p className="font-display text-xl text-ivory">{service.label}</p>
      {service.options.length > 0 && (
        <select value={option} onChange={(e) => setOption(e.target.value)} className="w-full rounded-lg border border-ink-line bg-ink px-3 py-2.5 text-base text-ivory">
          {service.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
      {service.routingType === 'towels' && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-ivory-dim">How many?</span>
          <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="h-7 w-7 rounded border border-ink-line text-ivory-dim">-</button>
          <span className="w-5 text-center text-ivory">{quantity}</span>
          <button type="button" onClick={() => setQuantity((q) => q + 1)} className="h-7 w-7 rounded border border-ink-line text-ivory-dim">+</button>
        </div>
      )}
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Any details? (optional)"
        className="w-full rounded-lg border border-ink-line bg-ink px-3 py-2.5 text-base text-ivory placeholder:text-ivory-dim/60"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="button" onClick={handleSubmit} disabled={submitting} className="w-full rounded-lg bg-brass px-4 py-2.5 text-base font-medium text-ink disabled:opacity-50">
        {submitting ? 'Sending...' : 'Send Request'}
      </button>
    </div>
  );
}

function ReceptionView({ portalBase, onDone }: { portalBase: string; onDone: () => void }) {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSend() {
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      await fetch(`${BASE}/api/public${portalBase}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType: 'reception_message', note: message.trim() }),
      });
      setSuccess(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-base text-success">Message sent - reception will respond shortly.</p>
        <button type="button" onClick={onDone} className="rounded-lg bg-brass px-4 py-2.5 text-base font-medium text-ink">Done</button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-ink-line p-4">
      <p className="font-display text-xl text-ivory">Reception</p>
      <p className="text-sm text-ivory-dim">How can we help?</p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        placeholder="Type your message..."
        className="w-full rounded-lg border border-ink-line bg-ink px-3 py-2.5 text-base text-ivory placeholder:text-ivory-dim/60"
      />
      <button type="button" onClick={handleSend} disabled={submitting} className="w-full rounded-lg bg-brass px-4 py-2.5 text-base font-medium text-ink disabled:opacity-50">
        {submitting ? 'Sending...' : 'Send'}
      </button>
    </div>
  );
}

function FeedbackView({ portalBase, onDone }: { portalBase: string; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [contactMe, setContactMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await fetch(`${BASE}/api/public${portalBase}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType: 'feedback', note: `Rating: ${rating}/5${comment ? ' - ' + comment : ''}${contactMe ? ' [wants contact]' : ''}` }),
      });
      setSuccess(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-base text-success">Thank you for your feedback.</p>
        <button type="button" onClick={onDone} className="rounded-lg bg-brass px-4 py-2.5 text-base font-medium text-ink">Done</button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-ink-line p-4">
      <p className="font-display text-xl text-ivory">How was your stay?</p>
      <div className="flex justify-center gap-1 text-3xl">
        {[1, 2, 3, 4, 5].map((n) => (
          <button type="button" key={n} onClick={() => setRating(n)} className={n <= rating ? 'text-brass' : 'text-ivory-dim/40'}>★</button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="What would you like to tell us?"
        className="w-full rounded-lg border border-ink-line bg-ink px-3 py-2.5 text-base text-ivory placeholder:text-ivory-dim/60"
      />
      <label className="flex items-center gap-2 text-sm text-ivory">
        <input type="checkbox" checked={contactMe} onChange={(e) => setContactMe(e.target.checked)} className="accent-brass" />
        I'd like someone from the hotel to contact me
      </label>
      <button type="button" onClick={handleSubmit} disabled={submitting || rating === 0} className="w-full rounded-lg bg-brass px-4 py-2.5 text-base font-medium text-ink disabled:opacity-50">
        {submitting ? 'Sending...' : 'Submit Feedback'}
      </button>
    </div>
  );
}
