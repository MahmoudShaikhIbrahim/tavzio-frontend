import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import {
  listRequests, dismissRequest, listLoyaltyClaims, applyManualClaim, listCashPendingItems,
  type RequestRow, type CashPendingItem,
} from '../../lib/authApi';
import type { LoyaltyClaim } from '../../types';
import { subscribeToBusinessTable, subscribeToOrderItemsForBusiness } from '../../lib/supabaseClient';
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
    if (businessId) listRequests(businessId).then((all) => setRequests(all.filter((r) => r.status !== 'completed')));
  }
  function reloadClaims() {
    if (businessId) listLoyaltyClaims(businessId).then(setClaims);
  }
  function reloadCashPending() {
    if (businessId) listCashPendingItems(businessId).then(setCashPending);
  }

  const [payingCashItem, setPayingCashItem] = useState<CashPendingItem | null>(null);

  useEffect(reloadRequests, [businessId]);
  useEffect(reloadClaims, [businessId]);
  useEffect(reloadCashPending, [businessId]);
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
        <div className="space-y-3">
          {requests.map((r) => {
            const style = REQUEST_STYLE[r.request_type];
            const label = r.request_type === 'custom' ? (r.custom_request_label || t(style.label)) : t(style.label);
            return (
              <div key={r.id} className={`flex items-center justify-between rounded-xl border-2 ${style.border} ${style.bg} px-5 py-4`}>
                <span className={`text-xl font-medium ${style.text}`}>
                  {label} — <span className="text-ivory">{r.table_label || t('No table')}</span>
                </span>
                <button type="button"
                  onClick={() => dismissRequest(businessId, r.id).then(reloadRequests)}
                  className="rounded-lg border-2 border-ivory-dim/40 px-5 py-3 text-lg text-ivory hover:bg-ivory/10"
                >
                  {t('Dismiss')}
                </button>
              </div>
            );
          })}

          {cashPending.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-xl border-2 border-warning/50 bg-warning/10 px-5 py-4">
              <span className="text-xl font-medium text-warning">
                {t('Cash pending —')} <span className="text-ivory">{item.table_label || t('No table')}</span>
                <span className="text-ivory-dim"> ({item.quantity}× {item.item_name}, {((item.unit_price + item.addon_total) * item.quantity).toFixed(2)})</span>
              </span>
              <button type="button"
                onClick={() => setPayingCashItem(item)}
                className="rounded-lg border-2 border-warning px-5 py-3 text-lg text-warning hover:bg-warning/10"
              >
                {t('Mark received')}
              </button>
            </div>
          ))}

          {claims.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border-2 border-brass bg-brass/10 px-5 py-4">
              <span className="text-xl font-medium text-brass-bright">
                {t('Reward ready —')} <span className="text-ivory">{c.table_label || t('No table')}</span>
                {c.reward_description ? <span className="text-ivory-dim"> ({c.reward_description})</span> : ''}
              </span>
              {c.reward_type === 'manual' ? (
                <button type="button"
                  onClick={() => applyManualClaim(businessId, c.id).then(reloadClaims)}
                  className="rounded-lg border-2 border-brass px-5 py-3 text-lg text-brass hover:bg-brass/10"
                >
                  {t('Mark applied')}
                </button>
              ) : (
                <span className="text-lg text-ivory-dim">{t('Applies automatically at Pay Bill')}</span>
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
