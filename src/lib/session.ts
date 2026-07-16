import { authorizeSupabase } from './supabaseClient';
import { fetchWithTimeout } from './fetchWithTimeout';

const TOKEN_KEY = 'tavzio_access_token';
const REFRESH_TOKEN_KEY = 'tavzio_refresh_token';
const ROLE_KEY = 'tavzio_role';
const DEVICE_TOKEN_KEY = 'tavzio_device_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setSession(token: string, role?: string, refreshToken?: string) {
  localStorage.setItem(TOKEN_KEY, token);
  if (role) localStorage.setItem(ROLE_KEY, role);
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function getStoredRole() {
  return localStorage.getItem(ROLE_KEY);
}

// Only relevant if REQUIRE_DEVICE_CONFIRMATION=true on the backend (off by
// default). Once a device is confirmed via the emailed link, this gets set
// so future taps from the same browser skip straight to instant login.
export function getDeviceToken() {
  return localStorage.getItem(DEVICE_TOKEN_KEY);
}

export function setDeviceToken(token: string) {
  localStorage.setItem(DEVICE_TOKEN_KEY, token);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

const BASE = import.meta.env.VITE_API_BASE_URL || '';

// Exchanges the stored refresh token for a new access token, silently -
// this is what stops a session from dying the moment the access token's
// short lifetime (Supabase defaults to 1 hour) runs out. Concurrent
// callers (several API calls all hitting 401 around the same moment) share
// a single in-flight request rather than each firing their own refresh
// call and racing each other. Uses the same shared timeout as every other
// call in the app - a hung request here can't leave someone stuck forever.
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  refreshInFlight = (async () => {
    try {
      const res = await fetchWithTimeout(`${BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;

      const data = await res.json();
      setSession(data.accessToken, undefined, data.refreshToken);
      // Realtime subscriptions and Storage uploads authenticate directly
      // against Supabase, separately from authFetch's own header - without
      // this, they'd silently keep using the old, soon-to-be-invalid token
      // even after REST calls have already moved on to the new one.
      authorizeSupabase(data.accessToken);
      return data.accessToken as string;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

// Every protected dashboard call goes through here. A 401 first gets one
// genuine attempt at a silent refresh-and-retry - only if that also fails
// (refresh token itself expired/revoked, or missing entirely) does this
// fall through to clearing the session and bouncing to login. `isRetry`
// exists specifically to stop this from ever looping more than once.
export async function authFetch<T>(path: string, options?: RequestInit, isRetry = false): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetchWithTimeout(`${BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('This is taking too long — check your connection and try again');
    }
    throw err;
  }

  if (res.status === 401) {
    if (!isRetry) {
      const newToken = await refreshAccessToken();
      if (newToken) return authFetch<T>(path, options, true);
    }
    clearSession();
    window.location.href = '/admin/login';
    throw new Error('Session expired');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data as T;
}
