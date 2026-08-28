import { useEffect, useRef } from 'react';

// Explicit, system-wide safety net requested after Realtime still missed
// updates in production: every page that subscribes to a Supabase
// Realtime table now ALSO polls its own reload function every 5 seconds,
// completely independent of whether the websocket delivered anything.
// This never replaces the realtime subscription (still the reason things
// usually update within milliseconds, not 5 seconds) - it's a backstop
// so a missed or silently-dropped Realtime event is never more than 5
// seconds stale, without staff ever needing to manually refresh.
//
// Deliberately does NOT touch subscribeToBusinessTable's onChange
// contract - several callers (Kitchen, Orders, Analytics, Payments,
// Requests) use the changed row's actual data in that callback, not just
// "something changed, go reload"; polling instead calls each page's own
// existing reload function directly, which every one of these pages
// already has for its initial mount-time fetch.
export function usePollingFallback(reload: () => void, enabled = true, intervalMs = 5000) {
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => reloadRef.current(), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs]);
}
