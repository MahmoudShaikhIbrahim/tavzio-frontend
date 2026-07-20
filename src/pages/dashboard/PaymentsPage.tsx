import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import {
  listPayments, getBusiness,
  getPaymentIntegration, upsertPaymentIntegration, refundPayment,
} from '../../lib/authApi';
import { subscribeToBusinessTable } from '../../lib/supabaseClient';
import { playNotificationSound } from '../../lib/soundPlayer';
import type { PaymentRow, NotificationSettings, PosIntegration } from '../../types';
import { Section, Field, inputClass } from '../../components/ui';
import ExportButtons from '../../components/ExportButtons';

export default function PaymentsPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const isOwner = user?.role === 'business_owner';
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

  return (
    <div className="space-y-6">
      <Section
        title="Payment history"
        action={
          <div className="flex gap-2">
            <ExportButtons businessId={businessId} kind="payments" />
          </div>
        }
      >
        <p className="text-base text-ivory-dim">Today's total: <span className="text-ivory">{totalToday.toFixed(2)} AED</span></p>
        <div className="space-y-1.5">
          {completed.map((p) => (
            <PaymentRowItem key={p.id} payment={p} businessId={businessId} onChange={reload} />
          ))}
          {completed.length === 0 && <p className="text-base text-ivory-dim">No payments yet.</p>}
        </div>
      </Section>

      {isOwner && <TapPaymentsSetup businessId={businessId} />}
    </div>
  );
}

function PaymentRowItem({ payment, businessId, onChange }: { payment: PaymentRow; businessId: string; onChange: () => void }) {
  const [showRefund, setShowRefund] = useState(false);
  const [amount, setAmount] = useState(Number(payment.amount) + Number(payment.tip_amount));
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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
      <div className="flex items-center justify-between">
        <span className="text-ivory-dim">{new Date(payment.created_at).toLocaleString()}</span>
        <div className="flex items-center gap-2">
          <span className="text-ivory">
            {(Number(payment.amount) + Number(payment.tip_amount)).toFixed(2)} AED{payment.tip_amount > 0 && ` (incl. ${payment.tip_amount} tip)`}
          </span>
          {payment.refunded ? (
            <span className="rounded-full border border-danger/40 px-2 py-0.5 text-sm text-danger">Refunded {payment.refund_amount}</span>
          ) : (
            <button onClick={() => setShowRefund((s) => !s)} className="text-base text-danger hover:underline">Refund</button>
          )}
        </div>
      </div>

      {showRefund && !payment.refunded && (
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
              placeholder="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="flex-1 rounded-lg border border-ink-line bg-ink px-2 py-1.5 text-base text-ivory"
            />
          </div>
          {error && <p className="text-base text-danger">{error}</p>}
          <button
            onClick={handleRefund}
            disabled={submitting}
            className="w-full rounded-lg bg-danger/10 border border-danger/40 px-3 py-1.5 text-base text-danger disabled:opacity-50"
          >
            {submitting ? 'Processing...' : `Confirm refund of ${amount.toFixed(2)} AED`}
          </button>
        </div>
      )}
    </div>
  );
}

function TapPaymentsSetup({ businessId }: { businessId: string }) {
  const [integration, setIntegration] = useState<PosIntegration | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [secretKey, setSecretKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getPaymentIntegration(businessId).then((data) => {
      setIntegration(data);
      if (data) {
        setEnabled(data.enabled);
        setSecretKey(data.config?.secretKey || '');
      }
      setLoaded(true);
    });
  }, [businessId]);

  async function handleSave() {
    setSaving(true);
    const updated = await upsertPaymentIntegration(businessId, enabled, { secretKey });
    setIntegration(updated);
    setSaving(false);
  }

  if (!loaded) return null;

  return (
    <Section title="Pay Bill setup (Tap Payments)">
      <p className="text-base text-ivory-dim">
        Your own Tap Payments account — money goes straight to your bank,
        Tavzio never touches it. Only you can see or edit this, not staff,
        not the platform operator.
      </p>
      {integration?.status && (
        <p className="text-base">
          Status: <span className={integration.status === 'connected' ? 'text-success' : 'text-ivory-dim'}>{integration.status}</span>
        </p>
      )}
      <div className="max-w-lg space-y-3 rounded-lg border border-ink-line p-3">
        <Field label="Tap secret key">
          <input
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            placeholder="From your Tap Payments dashboard"
            className={inputClass}
          />
        </Field>
        <label className="flex items-center gap-2 text-base text-ivory-dim">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-brass" />
          Enabled — let customers pay via Pay Bill
        </label>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </Section>
  );
}
