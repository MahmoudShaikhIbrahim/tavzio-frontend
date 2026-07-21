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
        <div className="space-y-2.5">
          {completed.map((p) => (
            <PaymentRowItem key={p.id} payment={p} businessId={businessId} onChange={reload} />
          ))}
          {completed.length === 0 && <p className="text-base text-ivory-dim">No payments yet.</p>}
        </div>
      </Section>

      {isOwner && <PaymentProviderSetup businessId={businessId} />}
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

const PROVIDERS = [
  { key: 'tap', label: 'Tap Payments' },
  { key: 'telr', label: 'Telr' },
  { key: 'ngenius', label: 'N-Genius Online (Network International)' },
] as const;

function PaymentProviderSetup({ businessId }: { businessId: string }) {
  const [integration, setIntegration] = useState<PosIntegration | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState<'tap' | 'telr' | 'ngenius'>('tap');
  // Tap
  const [secretKey, setSecretKey] = useState('');
  // Telr
  const [storeId, setStoreId] = useState('');
  const [authKey, setAuthKey] = useState('');
  // N-Genius
  const [apiKey, setApiKey] = useState('');
  const [outletRef, setOutletRef] = useState('');
  const [testMode, setTestMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getPaymentIntegration(businessId).then((data) => {
      setIntegration(data);
      if (data) {
        setEnabled(data.enabled);
        setProvider((data.config?.provider as 'tap' | 'telr' | 'ngenius') || 'tap');
        setSecretKey(data.config?.secretKey || '');
        setStoreId(data.config?.storeId || '');
        setAuthKey(data.config?.authKey || '');
        setApiKey(data.config?.apiKey || '');
        setOutletRef(data.config?.outletRef || '');
        setTestMode(!!data.config?.testMode);
      }
      setLoaded(true);
    });
  }, [businessId]);

  async function handleSave() {
    setSaving(true);
    const config =
      provider === 'tap' ? { provider, secretKey }
      : provider === 'telr' ? { provider, storeId, authKey, testMode }
      : { provider, apiKey, outletRef, testMode };
    const updated = await upsertPaymentIntegration(businessId, enabled, config);
    setIntegration(updated);
    setSaving(false);
  }

  if (!loaded) return null;

  return (
    <Section title="Pay Bill setup">
      <p className="text-base text-ivory-dim">
        Your own payment account — money goes straight to your bank,
        Tavzio never touches it. Only you can see or edit this, not staff,
        not the platform operator.
      </p>
      {integration?.status && (
        <p className="text-base">
          Status: <span className={integration.status === 'connected' ? 'text-success' : 'text-ivory-dim'}>{integration.status}</span>
        </p>
      )}
      <div className="max-w-lg space-y-5 rounded-xl border border-ink-line p-5">
        <Field label="Payment provider">
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as 'tap' | 'telr' | 'ngenius')}
            className="w-full rounded-lg border border-ink-line bg-ink px-3.5 py-2.5 text-base text-ivory"
          >
            {PROVIDERS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </Field>

        {provider === 'tap' && (
          <div className="space-y-4 border-t border-ink-line pt-5">
            <Field label="Tap secret key">
              <input
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="From your Tap Payments dashboard"
                className={inputClass}
              />
            </Field>
          </div>
        )}

        {provider === 'telr' && (
          <div className="space-y-4 border-t border-ink-line pt-5">
            <Field label="Store ID">
              <input value={storeId} onChange={(e) => setStoreId(e.target.value)} placeholder="From your Telr account" className={inputClass} />
            </Field>
            <Field label="Authentication key">
              <input value={authKey} onChange={(e) => setAuthKey(e.target.value)} placeholder="From your Telr account" className={inputClass} />
            </Field>
            <p className="text-sm text-ivory-dim">
              One extra step with Telr: live payments only work from server
              addresses Telr has pre-approved — ask Telr support to whitelist
              your Tavzio server's IPs when setting up. Test mode has no such
              restriction.
            </p>
          </div>
        )}

        {provider === 'ngenius' && (
          <div className="space-y-4 border-t border-ink-line pt-5">
            <Field label="Service account API key">
              <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="N-Genius portal → Settings → Integrations → Service Accounts" className={inputClass} />
            </Field>
            <Field label="Outlet reference">
              <input value={outletRef} onChange={(e) => setOutletRef(e.target.value)} placeholder="N-Genius portal → Settings → Organization Hierarchy" className={inputClass} />
            </Field>
          </div>
        )}

        {provider !== 'tap' && (
          <label className="flex items-center gap-2.5 text-base text-ivory-dim">
            <input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} className="accent-brass" />
            Test mode — for trying it out before going live
          </label>
        )}

        <div className="space-y-4 border-t border-ink-line pt-5">
          <label className="flex items-center gap-2.5 text-base text-ivory-dim">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-brass" />
            Enabled — let customers pay via Pay Bill
          </label>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-brass px-5 py-2.5 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </Section>
  );
}
