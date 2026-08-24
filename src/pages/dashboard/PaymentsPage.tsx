import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import { listPayments, getBusiness, refundPayment } from '../../lib/authApi';
import { subscribeToBusinessTable } from '../../lib/supabaseClient';
import { playNotificationSound } from '../../lib/soundPlayer';
import type { PaymentRow, NotificationSettings } from '../../types';
import { Section } from '../../components/ui';
import ExportButtons from '../../components/ExportButtons';

export default function PaymentsPage() {
  const { user } = useSession();
  const { t } = useT();
  const businessId = user?.business_id;
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);

  function reload() {
    if (businessId) listPayments(businessId).then(setPayments);
  }
  useEffect(reload, [businessId]);
  useEffect(() => {
    if (businessId) getBusiness(businessId).then((b) => setNotificationSettings(b.notification_settings));
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    const unsubscribe = subscribeToBusinessTable(businessId, 'payments', (row) => {
      reload();
      if (notificationSettings && row.status === 'completed') playNotificationSound(notificationSettings.paymentConfirmed);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, notificationSettings]);

  if (!businessId) return null;

  const completed = payments.filter((p) => p.status === 'completed');
  const totalToday = completed
    .filter((p) => new Date(p.created_at).toDateString() === new Date().toDateString())
    .reduce((sum, p) => sum + Number(p.amount) + Number(p.tip_amount), 0);
  // Default view is last 24h only - full history stays one Export click
  // away, same pattern as Orders' Recent section.
  const recent = completed.filter((p) => Date.now() - new Date(p.created_at).getTime() < 24 * 60 * 60 * 1000);

  return (
    <div className="space-y-10">
      <Section
        title={t('Payment history')}
        action={
          <div className="flex gap-2">
            <ExportButtons businessId={businessId} kind="payments" />
          </div>
        }
      >
        <p className="text-base text-ivory-dim">{t("Today's total:")} <span className="text-ivory">{totalToday.toFixed(2)} AED</span></p>
        <p className="text-sm text-ivory-dim">{t('Showing last 24h - use Export for older dates.')}</p>
        <div className="space-y-4">
          {recent.map((p) => (
            <PaymentRowItem key={p.id} payment={p} businessId={businessId} onChange={reload} />
          ))}
          {recent.length === 0 && <p className="text-base text-ivory-dim">{t('No payments in the last 24h.')}</p>}
        </div>
      </Section>
    </div>
  );
}

const METHOD_LABEL: Record<string, string> = {
  tap: 'Tap',
  telr: 'Telr',
  ngenius: 'N-Genius',
  ziina: 'Ziina',
  manual_cash: 'Cash',
  manual_card_machine: 'Card machine',
};

export function PaymentRowItem({ payment, businessId, onChange }: { payment: PaymentRow; businessId: string; onChange: () => void }) {
  const { t } = useT();
  const [showRefund, setShowRefund] = useState(false);
  const [amount, setAmount] = useState(Number(payment.amount) + Number(payment.tip_amount));
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const isManual = payment.provider?.startsWith('manual_');
  // Telr, N-Genius, and Ziina are real gateway brand names, never
  // translated - only the generic method words (Tap/Cash/Card machine)
  // and the Unknown fallback go through t().
  const rawLabel = METHOD_LABEL[payment.provider] || payment.provider || 'Unknown';
  const methodLabel = ['Tap', 'Cash', 'Card machine', 'Unknown'].includes(rawLabel) ? t(rawLabel) : rawLabel;

  async function handleRefund() {
    setSubmitting(true);
    setError('');
    try {
      await refundPayment(businessId, payment.id, amount, reason);
      setShowRefund(false);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refund failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-ink-line px-3.5 py-2.5 text-base">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-ivory-dim">
          {new Date(payment.created_at).toLocaleString()}
          <span className="ms-2 inline-block rounded-full border border-ink-line px-2 py-0.5 text-xs text-ivory-dim">{methodLabel}</span>
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {payment.tableLabel && (
            <span className="rounded-full border border-brass/40 px-2 py-0.5 text-sm text-brass">
              {t('{table} paid').replace('{table}', payment.tableLabel)}
            </span>
          )}
          <span className="text-ivory">
            {(Number(payment.amount) + Number(payment.tip_amount)).toFixed(2)} AED{payment.tip_amount > 0 && ` (incl. ${payment.tip_amount} tip)`}
          </span>
          {payment.remainingAed !== null && (
            payment.remainingAed > 0 ? (
              <span className="rounded-full border border-warning/40 px-2 py-0.5 text-sm text-warning">
                {t('{amount} AED left').replace('{amount}', payment.remainingAed.toFixed(2))}
              </span>
            ) : (
              <span className="rounded-full border border-success/40 px-2 py-0.5 text-sm text-success">{t('Fully paid')}</span>
            )
          )}
          {payment.refunded ? (
            <span className="rounded-full border border-danger/40 px-2 py-0.5 text-sm text-danger">{t('Refunded')} {payment.refund_amount}</span>
          ) : !isManual ? (
            <button type="button" onClick={() => setShowRefund((s) => !s)} className="text-base text-danger hover:underline">{t('Refund')}</button>
          ) : null}
        </div>
      </div>

      {showRefund && !payment.refunded && !isManual && (
        <div className="mt-2 space-y-2 border-t border-ink-line pt-2">
          <div className="flex gap-2">
            <input
              type="number" onFocus={(e) => e.target.select()}
              step="0.01"
              min={0}
              max={Number(payment.amount) + Number(payment.tip_amount)}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-28 rounded-lg border border-ink-line bg-ink px-2 py-1.5 text-base text-ivory"
            />
            <input
              placeholder={t('Reason (optional)')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="flex-1 rounded-lg border border-ink-line bg-ink px-2 py-1.5 text-base text-ivory"
            />
          </div>
          {error && <p className="text-base text-danger">{error}</p>}
          <button type="button"
            onClick={handleRefund}
            disabled={submitting}
            className="w-full rounded-lg bg-danger/10 border border-danger/40 px-3 py-1.5 text-base text-danger disabled:opacity-50"
          >
            {submitting ? t('Processing...') : `${t('Confirm refund of')} ${amount.toFixed(2)} AED`}
          </button>
        </div>
      )}
    </div>
  );
}

