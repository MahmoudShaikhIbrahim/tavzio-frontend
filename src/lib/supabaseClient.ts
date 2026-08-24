import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// This is the ONE place the frontend talks to Supabase directly rather
// than through our own backend - Realtime subscriptions (websockets) and
// Storage uploads both need a direct connection; proxying either through
// Express would add nothing but complexity. The anon key is safe here
// (it's meant to be public); RLS and storage policies still govern
// exactly what this connection can read or write.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let client: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// The actual fix for a real, serious bug: every one of the ~40 dashboard
// pages calls useSession() independently, and each one used to call this
// function fresh on every mount - meaning every single navigation between
// dashboard sections created a BRAND NEW Supabase client (a brand new
// GoTrueClient with its own background token-refresh timer), never
// tearing down the previous one. That's what "Multiple GoTrueClient
// instances detected" actually meant, and why heavy navigation eventually
// exhausted the backend's rate limit and locked the account out entirely.
// Idempotent now - re-authorizing with the SAME token (the normal case:
// one login, many page visits) is a no-op, so exactly one client and one
// refresh timer exist for the whole session, no matter how much the user
// navigates.
let authorizedToken: string | null = null;

export function authorizeSupabase(accessToken: string) {
  if (accessToken === authorizedToken) return client;
  authorizedToken = accessToken;
  client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  client.realtime.setAuth(accessToken);
  return client;
}

export function getSupabase() {
  return client;
}

// Subscribes to new rows on a table for one business, calling `onInsert`
// for each. Returns an unsubscribe function - always call it on unmount.
export function subscribeToBusinessTable(
  businessId: string,
  table: 'events' | 'loyalty_memberships' | 'loyalty_transactions' | 'cards' | 'orders' | 'order_items' | 'bookings' | 'payments' | 'custom_buttons' | 'support_messages' | 'loyalty_reward_claims' | 'housekeeping_tasks' | 'maintenance_tickets' | 'guest_service_requests' | 'profiles',
  onChange: (row: Record<string, unknown>) => void
) {
  // Deliberately a unique name per call, not just business+table - a
  // deterministic name meant two subscriptions to the same table could
  // collide on a fast remount (unmount's cleanup hadn't finished before
  // the new mount tried to subscribe again), and adding a listener to a
  // channel that already had .subscribe() called on it throws and crashes
  // the whole page. A random suffix means every call always gets its own
  // fresh channel, no matter how quickly components remount.
  const channel = client
    .channel(`business-${businessId}-${table}-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table, filter: `business_id=eq.${businessId}` },
      (payload) => onChange(payload.new as Record<string, unknown>)
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table, filter: `business_id=eq.${businessId}` },
      (payload) => onChange(payload.new as Record<string, unknown>)
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

// Staff-side order_items updates (e.g. a customer marking "pay in cash",
// which needs to alert staff to go collect it). Deliberately NOT using
// subscribeToBusinessTable above for this - its business_id filter
// doesn't work for order_items at all (no such column on that table,
// same root cause as the anon case below), it just happens that nothing
// has called it that way yet. No filter is needed here anyway: this
// uses the authenticated, RLS-bound connection, and staff already only
// ever see their own business's rows via the existing order_items
// SELECT policy - Realtime naturally respects that.
export function subscribeToOrderItemsForBusiness(onUpdate: (row: Record<string, unknown>) => void) {
  const channel = client
    .channel(`staff-order-items-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'order_items' }, (payload) => onUpdate(payload.new as Record<string, unknown>))
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

// Public/anonymous version for the customer-facing Pay Bill page - no
// login, so this uses the plain anon client rather than an authorized
// one. Backed by migration 0023's scoped RLS policy: anon can only see
// order_items whose order belongs to a card with a genuinely recent NFC
// tap, so this is never a blanket "watch everything" subscription even
// though there's no session identity to scope it by otherwise.
//
// Filtered to the specific order_ids this bill session already knows
// about (from the initial getBill fetch) rather than every order_item
// change happening anywhere - both tighter and cheaper than a broad
// listen would be. Fires on both INSERT (a new item is added to the
// table mid-meal) and UPDATE (an item gets marked paid, by anyone).
export function subscribeToBillItems(
  orderIds: string[],
  onChange: (row: Record<string, unknown>) => void
) {
  if (orderIds.length === 0) return () => {};

  const filter = `order_id=in.(${orderIds.join(',')})`;
  const channel = client
    .channel(`bill-items-${orderIds.join('-').slice(0, 40)}-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_items', filter }, (payload) => onChange(payload.new as Record<string, unknown>))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'order_items', filter }, (payload) => onChange(payload.new as Record<string, unknown>))
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

// Public/anonymous, room-scoped Realtime for the hotel guest portal's
// "My Requests" tracker - backed by migration 0047's anon SELECT
// policies (scoped to "this row has a room_id", the exact same trust
// boundary the guest portal's own REST endpoints already use - knowing
// the room's URL is what grants access, there's no separate guest
// login). Fires on both INSERT (a brand-new request/order appears) and
// UPDATE (staff moves something to in-progress/done), across every
// table the tracker cares about, so a guest sees the real change the
// moment staff makes it - no polling delay.
export function subscribeToRoomUpdates(
  roomId: string,
  onChange: () => void
) {
  const filter = `room_id=eq.${roomId}`;
  const tables = ['guest_service_requests', 'housekeeping_tasks', 'maintenance_tickets', 'orders'] as const;
  const channel = client.channel(`guest-room-${roomId}-${Math.random().toString(36).slice(2)}`);
  for (const table of tables) {
    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter }, () => onChange())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter }, () => onChange());
  }
  channel.subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

// Same pattern, for the public /demo page's two-panel loop: an order
// placed on the ordering panel needs to appear on the kitchen display
// panel "immediately" (confirmed requirement) - this is what makes that
// genuinely real-time rather than a polling delay. Works fully
// unauthenticated (the demo page never calls authorizeSupabase - there's
// no login here), since demo_orders/demo_order_items both carry a
// public "anyone can view" RLS policy specifically so Realtime, which
// enforces RLS the same as a normal query, actually delivers events to
// an anonymous visitor.
export function subscribeToDemoOrders(sessionId: string, onChange: () => void) {
  const filter = `session_id=eq.${sessionId}`;
  const channel = client.channel(`demo-orders-${sessionId}-${Math.random().toString(36).slice(2)}`);
  channel
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'demo_orders', filter }, () => onChange())
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'demo_orders', filter }, () => onChange())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'demo_order_items' }, () => onChange())
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

// Uploads a logo or cover image to the `business-assets` bucket, under a
// fixed path per business+kind (so re-uploading overwrites cleanly rather
// than accumulating orphaned files), and returns its public URL.
export async function uploadBusinessImage(
  businessId: string,
  file: File,
  kind: 'logo' | 'cover'
): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${businessId}/${kind}.${ext}`;

  const { error } = await client.storage
    .from('business-assets')
    .upload(path, file, { upsert: true, cacheControl: '3600' });
  if (error) throw new Error(error.message);

  const { data } = client.storage.from('business-assets').getPublicUrl(path);
  // Cache-bust so the new image shows up immediately instead of whatever
  // the browser/CDN cached under the same path from a previous upload.
  return `${data.publicUrl}?t=${Date.now()}`;
}

// Generic version for anything else that needs a per-business file in
// Storage - menu item photos (path like {businessId}/menu/{itemId}.jpg)
// and notification sound uploads (path like {businessId}/sounds/{event}.mp3).
// Same bucket, same RLS, just an arbitrary sub-path instead of a fixed
// logo/cover slot.
export async function uploadBusinessFile(businessId: string, file: File, subPath: string): Promise<string> {
  const ext = file.name.split('.').pop() || 'bin';
  const path = `${businessId}/${subPath}.${ext}`;

  const { error } = await client.storage
    .from('business-assets')
    .upload(path, file, { upsert: true, cacheControl: '3600' });
  if (error) throw new Error(error.message);

  const { data } = client.storage.from('business-assets').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

// Staff documents (ID/passport/visa/labor card/contracts) go in the
// PRIVATE staff-documents bucket, never business-assets - these are
// sensitive and must never be reachable by a bare public URL. This
// returns the storage PATH, not a URL; getStaffDocumentUrl below turns
// that path into a short-lived signed link only at the moment someone
// with owner access actually wants to view it.
export async function uploadStaffDocumentFile(businessId: string, staffId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'bin';
  const path = `${businessId}/${staffId}/${Date.now()}.${ext}`;
  const { error } = await client.storage.from('staff-documents').upload(path, file, { cacheControl: '3600' });
  if (error) throw new Error(error.message);
  return path;
}

// 10-minute signed URL - long enough to open/download, short enough that
// a copied link isn't a standing leak of someone's passport.
export async function getStaffDocumentUrl(path: string): Promise<string> {
  const { data, error } = await client.storage.from('staff-documents').createSignedUrl(path, 600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
