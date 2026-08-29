import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import {
  listRequests, dismissRequest, listLoyaltyClaims, applyManualClaim, listCashPendingItems,
  type RequestRow, type CashPendingItem,
} from '../../lib/authApi';
import type { LoyaltyClaim } from '../../types';
import { hexToRgba } from '../../lib/color';
import { subscribeToBusinessTable, subscribeToOrderItemsForBusiness } from '../../lib/supabaseClient';
import { usePollingFallback } from '../../hooks/usePollingFallback';
import { playNotificationSound } from '../../lib/soundPlayer';
import PaymentModal from '../../components/PaymentModal';
import { getBusiness } from '../../lib/authApi';
import type { NotificationSettings } from '../../types';

// Color-coded by type, not just listed identically - a staff member
// glancing over from across the room should be able to tell "someone
// wants their bill" apart from "reward ready" without walking up to read
// small print.
const REQUEST_STYLE = {
  call_waiter: { border: 'border-info/50', bg: 'bg-info/10', text: 'text-info', label: 'Call waiter' },
  request_bill: { border: 'border-success/50', bg: 'bg-success/10', text: 'text-success', label: 'Request bill' },
  // Falls back to this for any custom notification button - REQUEST_STYLE
  // used to be a hard lookup keyed only by the two original built-in
  // types, so a 'custom' request had no entry at all and would throw
  // trying to read .border off undefined, crashing this whole page the
  // instant one custom-button request arrived.
  custom: { border: 'border-brass/50', bg: 'bg-brass/10', text: 'text-brass', label: 'Request' },
} as const;

export default function RequestsPage() {
  const { user } = useSession();
  const { t } = useT();
  const businessId = user?.business_id;
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [claims, setClaims] = useState<LoyaltyClaim[]>([]);
  const [cashPending, setCashPending] = useState<CashPendingItem[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);

  function reloadRequests() {
    if (businessId) listRequests(businessId).then((all) => setRequests(all.filter((r) => r.status !== 'completed'))).catch(() => {});
  }
  function reloadClaims() {
    if (businessId) listLoyaltyClaims(businessId).then(setClaims).catch(() => {});
  }
  function reloadCashPending() {
    if (businessId) listCashPendingItems(businessId).then(setCashPending).catch(() => {});
  }

  // Real fix: these used to wait for the full round trip before the
  // card ever disappeared - the actual reason Orders page's own
  // Dismiss/Ack buttons already felt instant and these didn't. Same
  // fix here: update state immediately, only reload for real if the
  // request actually fails.
  async function handleDismiss(id: string) {
    setRequests((prev) => prev.filter((r) => r.id !== id));
    try {
      await dismissRequest(businessId!, id);
    } catch {
      reloadRequests();
    }
  }
  async function handleApplyClaim(id: string) {
    setClaims((prev) => prev.filter((c) => c.id !== id));
    try {
      await applyManualClaim(businessId!, id);
    } catch {
      reloadClaims();
    }
  }

  const [payingCashItem, setPayingCashItem] = useState<CashPendingItem | null>(null);

  useEffect(reloadRequests, [businessId]);
  useEffect(reloadClaims, [businessId]);
  useEffect(reloadCashPending, [businessId]);
  // Explicit, system-wide request: an independent 5-second poll of all
  // three of this page's own reload functions, completely separate from
  // the realtime subscriptions below - a safety net so a missed/dropped
  // Realtime event is never more than 5s stale, with no manual refresh.
  usePollingFallback(() => { reloadRequests(); reloadClaims(); reloadCashPending(); }, !!businessId);
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

  // Live: a customer marking "pay in cash" shows up here the moment it
  // happens, same as Call Waiter already does - no reason cash-pending
  // should be the one thing on this page staff has to manually refresh for.
  useEffect(() => {
    const unsubscribe = subscribeToOrderItemsForBusiness((row) => {
      if (!row.cash_pending && !row.paid) return; // covers both a new flag and a resolution elsewhere
      reloadCashPending();
      if (row.cash_pending && notificationSettings) playNotificationSound(notificationSettings.requestBill);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificationSettings]);

  useEffect(() => {
    if (!businessId) return;
    const unsubscribe = subscribeToBusinessTable(businessId, 'loyalty_reward_claims', reloadClaims);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  if (!businessId) return null;

  const nothingPending = requests.length === 0 && claims.length === 0 && cashPending.length === 0;

  return (
    <div className="space-y-10">
      <h1 className="font-display text-3xl text-ivory">{t('Requests')}</h1>

      {nothingPending ? (
        <p className="text-lg text-ivory-dim">{t('Nothing pending right now.')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {requests.map((r) => {
            const style = REQUEST_STYLE[r.request_type];
            const label = r.request_type === 'custom' ? (r.custom_request_label || t(style.label)) : t(style.label);
            const customBg = r.request_color ? hexToRgba(r.request_color, 0.1) : null;
            const customStyle = r.request_color && customBg ? { borderColor: r.request_color, backgroundColor: customBg } : undefined;
            return (
              <div
                key={r.id}
                className={`rounded-lg border p-3 ${customStyle ? '' : `${style.border} ${style.bg}`}`}
                style={customStyle}
              >
                <p className="text-sm font-medium" style={customStyle ? { color: r.request_color! } : undefined}>
                  <span className={customStyle ? '' : style.text}>{label}</span> — <span className="text-ivory">{r.table_label || t('No table')}</span>
                </p>
                <button type="button"
                  onClick={() => handleDismiss(r.id)}
                  className="mt-2 w-full rounded-md border border-ivory-dim/40 px-2 min-h-[36px] py-1.5 text-xs text-ivory hover:bg-ivory/10"
                >
                  {t('Dismiss')}
                </button>
              </div>
            );
          })}

          {cashPending.map((item) => (
            <div key={item.id} className="rounded-lg border border-warning/50 bg-warning/10 p-3">
              <p className="text-sm font-medium text-warning">
                {t('Cash pending —')} <span className="text-ivory">{item.table_label || t('No table')}</span>
              </p>
              <p className="mt-0.5 text-xs text-ivory-dim">{item.quantity}× {item.item_name}, {((item.unit_price + item.addon_total) * item.quantity).toFixed(2)}</p>
              <button type="button"
                onClick={() => setPayingCashItem(item)}
                className="mt-2 w-full rounded-md border border-warning px-2 min-h-[36px] py-1.5 text-xs text-warning hover:bg-warning/10"
              >
                {t('Mark received')}
              </button>
            </div>
          ))}

          {claims.map((c) => (
            <div key={c.id} className="rounded-lg border border-brass bg-brass/10 p-3">
              <p className="text-sm font-medium text-brass-bright">
                {t('Reward ready —')} <span className="text-ivory">{c.table_label || t('No table')}</span>
              </p>
              {c.reward_description && <p className="mt-0.5 text-xs text-ivory-dim">{c.reward_description}</p>}
              {c.reward_type === 'manual' ? (
                <button type="button"
                  onClick={() => handleApplyClaim(c.id)}
                  className="mt-2 w-full rounded-md border border-brass px-2 min-h-[36px] py-1.5 text-xs text-brass hover:bg-brass/10"
                >
                  {t('Mark applied')}
                </button>
              ) : (
                <p className="mt-2 text-xs text-ivory-dim">{t('Applies automatically at Pay Bill')}</p>
              )}
            </div>
          ))}
        </div>
      )}
      {payingCashItem && businessId && (
        <PaymentModal
          businessId={businessId}
          items={[{ id: payingCashItem.id, orderId: payingCashItem.order_id, name: payingCashItem.item_name, unitPrice: payingCashItem.unit_price, addonTotal: payingCashItem.addon_total, quantity: payingCashItem.quantity }]}
          onClose={() => setPayingCashItem(null)}
          onDone={() => { setPayingCashItem(null); reloadCashPending(); }}
        />
      )}
    </div>
  );
}
