import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import {
  listRequests, dismissRequest, listLoyaltyClaims, applyManualClaim, type RequestRow,
} from '../../lib/authApi';
import type { LoyaltyClaim } from '../../types';
import { subscribeToBusinessTable } from '../../lib/supabaseClient';
import { playNotificationSound } from '../../lib/soundPlayer';
import { getBusiness } from '../../lib/authApi';
import type { NotificationSettings } from '../../types';

// Color-coded by type, not just listed identically - a staff member
// glancing over from across the room should be able to tell "someone
// wants their bill" apart from "reward ready" without walking up to read
// small print.
const REQUEST_STYLE = {
  call_waiter: { border: 'border-blue-400/50', bg: 'bg-blue-400/10', text: 'text-blue-300', label: 'Call waiter' },
  request_bill: { border: 'border-green-400/50', bg: 'bg-green-400/10', text: 'text-green-300', label: 'Request bill' },
} as const;

export default function RequestsPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [claims, setClaims] = useState<LoyaltyClaim[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);

  function reloadRequests() {
    if (businessId) listRequests(businessId).then((all) => setRequests(all.filter((r) => r.status !== 'completed')));
  }
  function reloadClaims() {
    if (businessId) listLoyaltyClaims(businessId).then(setClaims);
  }

  useEffect(reloadRequests, [businessId]);
  useEffect(reloadClaims, [businessId]);
  useEffect(() => {
    if (businessId) getBusiness(businessId).then((b) => setNotificationSettings(b.notification_settings));
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    const unsubscribe = subscribeToBusinessTable(businessId, 'orders', (row) => {
      const requestType = row.request_type as string;
      if (requestType === 'order') return; // real food orders live on the Orders page, not here
      reloadRequests();
      if (notificationSettings) {
        if (requestType === 'call_waiter') playNotificationSound(notificationSettings.callWaiter);
        else if (requestType === 'request_bill') playNotificationSound(notificationSettings.requestBill);
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, notificationSettings]);

  useEffect(() => {
    if (!businessId) return;
    const unsubscribe = subscribeToBusinessTable(businessId, 'loyalty_reward_claims', reloadClaims);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  if (!businessId) return null;

  const nothingPending = requests.length === 0 && claims.length === 0;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-ivory">Requests</h1>

      {nothingPending ? (
        <p className="text-lg text-ivory-dim">Nothing pending right now.</p>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const style = REQUEST_STYLE[r.request_type];
            return (
              <div key={r.id} className={`flex items-center justify-between rounded-xl border-2 ${style.border} ${style.bg} px-5 py-4`}>
                <span className={`text-xl font-medium ${style.text}`}>
                  {style.label} — <span className="text-ivory">{r.table_label || 'No table'}</span>
                </span>
                <button
                  onClick={() => dismissRequest(businessId, r.id).then(reloadRequests)}
                  className="rounded-lg border-2 border-ivory-dim/40 px-4 py-2 text-lg text-ivory hover:bg-ivory/10"
                >
                  Dismiss
                </button>
              </div>
            );
          })}

          {claims.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border-2 border-brass bg-brass/10 px-5 py-4">
              <span className="text-xl font-medium text-brass-bright">
                Reward ready — <span className="text-ivory">{c.table_label || 'No table'}</span>
                {c.reward_description ? <span className="text-ivory-dim"> ({c.reward_description})</span> : ''}
              </span>
              {c.reward_type === 'manual' ? (
                <button
                  onClick={() => applyManualClaim(businessId, c.id).then(reloadClaims)}
                  className="rounded-lg border-2 border-brass px-4 py-2 text-lg text-brass hover:bg-brass/10"
                >
                  Mark applied
                </button>
              ) : (
                <span className="text-lg text-ivory-dim">Applies automatically at Pay Bill</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
