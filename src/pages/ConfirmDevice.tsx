import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { setSession, setDeviceToken } from '../lib/session';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';

const BASE = import.meta.env.VITE_API_BASE_URL || '';

export default function ConfirmDevice() {
  const { pendingId } = useParams<{ pendingId: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!pendingId) return;
    fetchWithTimeout(`${BASE}/api/auth/confirm-device/${pendingId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'This link is no longer valid');
        setSession(data.accessToken, data.role, data.refreshToken);
        setDeviceToken(data.deviceToken);
        navigate(data.redirect || '/admin/dashboard');
      })
      .catch((err) => setError(err.message));
  }, [pendingId, navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-ink px-6 text-center">
        <p className="font-display text-xl text-ivory">Couldn't confirm this device</p>
        <p className="text-sm text-ivory-dim">{error}</p>
        <p className="text-sm text-ivory-dim">Tap the card again to get a new link.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink">
      <div className="h-10 w-10 animate-pulse rounded-full border-2 border-brass/40" />
    </div>
  );
}
