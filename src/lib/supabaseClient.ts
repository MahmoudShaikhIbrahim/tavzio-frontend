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

// Call once you have the logged-in user's access token (from tap-login or
// password login). Rebuilds the client with that token attached to every
// REST request (Storage included), and authorizes the Realtime websocket
// the same way - so both are scoped by RLS exactly like any authenticated
// backend call, not just anonymous/public access.
export function authorizeSupabase(accessToken: string) {
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
  table: 'events' | 'loyalty_memberships' | 'loyalty_transactions' | 'cards' | 'orders' | 'order_items' | 'bookings' | 'payments' | 'custom_buttons' | 'support_messages',
  onInsert: (row: Record<string, unknown>) => void
) {
  const channel = client
    .channel(`business-${businessId}-${table}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table, filter: `business_id=eq.${businessId}` },
      (payload) => onInsert(payload.new as Record<string, unknown>)
    )
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
