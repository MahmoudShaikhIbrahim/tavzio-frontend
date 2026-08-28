import { authorizeSupabase } from './supabaseClient';
import { fetchWithTimeout } from './fetchWithTimeout';
import { safeJson } from './safeJson';

const TOKEN_KEY = 'tavzio_access_token';
const REFRESH_TOKEN_KEY = 'tavzio_refresh_token';
const ROLE_KEY = 'tavzio_role';
const DEVICE_TOKEN_KEY = 'tavzio_device_token';

// sessionStorage, not localStorage: localStorage is shared across every
// tab of the same browser, so logging into a second account in a second
// tab would silently overwrite the first tab's session - exactly what
// was happening (an owner account "becoming" super_admin after a
// refresh, because both tabs were reading/writing the same shared slot).
// sessionStorage is isolated per tab - each tab now has to log in
// independently, but none of them can ever kick another one out.
export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken() {
  return sessionStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setSession(token: string, role?: string, refreshToken?: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
  if (role) sessionStorage.setItem(ROLE_KEY, role);
  if (refreshToken) sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function getStoredRole() {
  return sessionStorage.getItem(ROLE_KEY);
}

// Only relevant if REQUIRE_DEVICE_CONFIRMATION=true on the backend (off by
// default). Once a device is confirmed via the emailed link, this gets set
// so future taps from the same browser skip straight to instant login.
// Deliberately still localStorage - "is this browser/device recognized"
// is a real per-device fact, not per-tab session state, so sharing it
// across tabs is correct here, unlike the token itself above.
export function getDeviceToken() {
  return localStorage.getItem(DEVICE_TOKEN_KEY);
}

export function setDeviceToken(token: string) {
  localStorage.setItem(DEVICE_TOKEN_KEY, token);
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(ROLE_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
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

export async function refreshAccessToken(): Promise<string | 'invalid' | null> {
  if (refreshInFlight) return refreshInFlight;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  refreshInFlight = (async () => {
    try {
      let res: Response;
      try {
        res = await fetchWithTimeout(`${BASE}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // Network-level failure - the server may be temporarily
        // unreachable (deploy in progress, brief outage). This does NOT
        // mean the refresh token is actually invalid, so the session must
        // not be cleared here - that was the exact bug: a 15-30 minute
        // outage getting misread as "you need to log in again."
        return null;
      }

      // An explicit rejection from the server - the refresh token really
      // is expired or revoked. This is the ONLY case that should force a
      // real re-login.
      if (res.status === 401 || res.status === 403) return 'invalid';

      // Any other non-2xx (500, 502, 503 from an outage/gateway) is a
      // server-side problem, not a statement about whether this session
      // is valid - same treatment as the network failure above.
      if (!res.ok) return null;

      try {
        const data = await safeJson(res);
        setSession(data.accessToken, undefined, data.refreshToken);
        // Realtime subscriptions and Storage uploads authenticate directly
        // against Supabase, separately from authFetch's own header - without
        // this, they'd silently keep using the old, soon-to-be-invalid token
        // even after REST calls have already moved on to the new one.
        authorizeSupabase(data.accessToken);
        return data.accessToken as string;
      } catch {
        // 2xx status but an unparseable body (rare, but possible with a
        // misbehaving proxy) - again, not evidence the session is invalid.
        return null;
      }
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
      const result = await refreshAccessToken();
      if (result && result !== 'invalid') return authFetch<T>(path, options, true);
      if (result === null) {
        // Refresh itself couldn't be attempted properly (server
        // unreachable, outage) - the session might still be perfectly
        // valid. Don't clear it; just tell this one request it failed
        // and let the next action retry naturally.
        throw new Error('The server is temporarily unavailable — please try again in a moment.');
      }
      // result === 'invalid': the refresh token was genuinely rejected -
      // this is the one case that means a real re-login is needed.
    }
    clearSession();
    window.location.href = '/admin/login';
    throw new Error('Session expired');
  }

  const data = await safeJson(res);
  if (!res.ok) {
    const error = new Error(data.message || 'Request failed');
    // Additive only - every existing catch block already only reads
    // .message, unaffected. This gives a specific few flows (PIN setup
    // detection, so far) a real structured code to branch on instead of
    // fragile string-matching against the message text.
    if (data.code) (error as Error & { code?: string }).code = data.code;
    throw error;
  }
  return data as T;
}

// FormData variant for file uploads (e.g. AI menu extraction) - deliberately
// does NOT set Content-Type, since the browser must set its own multipart
// boundary automatically; authFetch above always forces
// 'Content-Type: application/json', which would silently break any
// multipart upload sent through it. Same auth/401-refresh/retry behavior.
export async function authFetchForm<T>(path: string, formData: FormData, isRetry = false, timeoutMs = 10000): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetchWithTimeout(`${BASE}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }, timeoutMs);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('This is taking too long — check your connection and try again');
    }
    throw err;
  }

  if (res.status === 401) {
    if (!isRetry) {
      const result = await refreshAccessToken();
      if (result && result !== 'invalid') return authFetchForm<T>(path, formData, true, timeoutMs);
      if (result === null) {
        throw new Error('The server is temporarily unavailable — please try again in a moment.');
      }
    }
    clearSession();
    window.location.href = '/admin/login';
    throw new Error('Session expired');
  }

  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data as T;
}
