import { useEffect, useState } from 'react';
import { getMe } from '../lib/authApi';
import { getToken, clearSession, refreshAccessToken } from '../lib/session';
import { authorizeSupabase } from '../lib/supabaseClient';
import type { Profile } from '../types';

// Shared across every component that calls useSession() (there are ~40
// of them, one per dashboard page) - without this, navigating between
// sections re-fetched /api/auth/me fresh on every single mount, piling
// unnecessary load onto the same rate limit that authorizeSupabase's
// client-duplication bug was also hammering. 20 seconds is short enough
// that a real permission/profile change still shows up almost
// immediately, long enough that rapid navigation reuses one fetch
// instead of firing a new one per click.
let cachedUser: Profile | null = null;
let cachedToken: string | null = null;
let cachedAt = 0;
const CACHE_MS = 20000;

export function useSession() {
  const [user, setUser] = useState<Profile | null>(cachedUser);
  const [loading, setLoading] = useState(!cachedUser);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    // Scopes Realtime + Storage to this user's token, once, centrally -
    // every dashboard page that uses useSession gets this for free rather
    // than each one needing to remember to call it. Idempotent - see
    // supabaseClient.ts for why that matters.
    authorizeSupabase(token);

    if (cachedUser && cachedToken === token && Date.now() - cachedAt < CACHE_MS) {
      setUser(cachedUser);
      setLoading(false);
      return;
    }

    getMe()
      .then((u) => {
        cachedUser = u;
        cachedToken = token;
        cachedAt = Date.now();
        setUser(u);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));

    // The actual root cause of "bookings/requests don't update live,
    // only a refresh fixes it": authorizeSupabase's realtime.setAuth()
    // used to only ever get called reactively, when some REST call
    // happened to 401 on an expired access token (Supabase's default
    // token lifetime is 1 hour). A staff member just watching a live
    // page - Bookings, Requests, POS Terminal - makes no REST calls at
    // all while watching, so nothing ever triggered that refresh; the
    // realtime websocket kept authorizing with an increasingly stale,
    // eventually-expired JWT and Supabase silently stopped delivering
    // postgres_changes events on it, with no error visible client-side.
    // A full page reload "fixed" it only because it re-bootstraps the
    // session from scratch with a fresh token. This proactive timer -
    // running on every one of the ~40 pages that call useSession() -
    // refreshes well before the 1-hour expiry so the realtime socket's
    // auth never actually goes stale while the tab stays open.
    const REALTIME_AUTH_REFRESH_MS = 45 * 60 * 1000; // 45 min, ahead of the 1hr token lifetime
    const interval = setInterval(() => {
      refreshAccessToken();
    }, REALTIME_AUTH_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  function logout() {
    cachedUser = null;
    cachedToken = null;
    clearSession();
    window.location.href = '/admin/login';
  }

  return { user, loading, logout };
}
