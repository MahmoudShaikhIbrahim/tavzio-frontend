import { useEffect, useState } from 'react';
import { getMe } from '../lib/authApi';
import { getToken, clearSession } from '../lib/session';
import { authorizeSupabase } from '../lib/supabaseClient';
import type { Profile } from '../types';

export function useSession() {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    // Scopes Realtime + Storage to this user's token, once, centrally -
    // every dashboard page that uses useSession gets this for free rather
    // than each one needing to remember to call it.
    authorizeSupabase(token);

    getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  function logout() {
    clearSession();
    window.location.href = '/admin/login';
  }

  return { user, loading, logout };
}
