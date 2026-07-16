import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { resolveCardTap } from '../lib/api';
import { setSession } from '../lib/session';

export default function TapHandler() {
  const { cardUid } = useParams<{ cardUid: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!cardUid) return;

    resolveCardTap(cardUid)
      .then((res) => {
        if (res.status === 'pending_confirmation') {
          // Stricter mode (REQUIRE_DEVICE_CONFIRMATION=true) - not the
          // default, but handled here so the frontend supports it if you
          // ever turn that flag on.
          navigate('/admin/check-email', { state: { message: res.message } });
          return;
        }

        if (res.accessToken) {
          // Admin card - store the session and go straight to the dashboard.
          setSession(res.accessToken, res.role, res.refreshToken);
          navigate(res.redirect);
          return;
        }

        // Customer card - remember the tap token for this business's
        // loyalty check-in, then go to the public landing page.
        if (res.tapEventId && res.redirect) {
          const slug = res.redirect.replace('/', '');
          sessionStorage.setItem(`tavzio_tap_${slug}`, String(res.tapEventId));
        }
        navigate(res.redirect);
      })
      .catch((err) => setError(err.message || 'This card is not recognized'));
  }, [cardUid, navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-ink px-6 text-center">
        <p className="font-display text-xl text-ivory">Card not recognized</p>
        <p className="text-sm text-ivory-dim">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink">
      <div className="h-10 w-10 animate-pulse rounded-full border-2 border-brass/40" />
    </div>
  );
}
