import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import { getPaymentReconciliation, refundPaymentTransaction, downloadBusinessAuditReport, type PaymentTransaction, type UnverifiedManualPayment } from '../../lib/authApi';
import { Section } from '../../components/ui';

const STATUS_COLOR: Record<string, string> = { completed: 'text-success', pending: 'text-warning', failed: 'text-danger' };

export default function PaymentReconciliationPage() {
  const { user } = useSession();
  const { t } = useT();
  const businessId = user?.business_id;
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [unverified, setUnverified] = useState<UnverifiedManualPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditYear, setAuditYear] = useState(new Date().getFullYear());
  const [generatingAudit, setGeneratingAudit] = useState(false);
  const [auditError, setAuditError] = useState('');

  function reload() {
    if (!businessId) return;
    getPaymentReconciliation(businessId).then((r) => { setTransactions(r.gatewayTransactions); setUnverified(r.unverifiedManualPayments); }).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(reload, [businessId]);

  async function handleIssueAuditReport() {
    if (!businessId) return;
    setGeneratingAudit(true);
    setAuditError('');
    try {
      await downloadBusinessAuditReport(businessId, auditYear);
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : t('Could not generate audit report'));
    } finally {
      setGeneratingAudit(false);
    }
  }

  if (!businessId) return <p className="text-ivory-dim">Loading...</p>;

  const totalCompleted = transactions.filter((t) => t.status === 'completed' && t.transaction_type === 'charge').reduce((s, t) => s + t.amount_aed, 0);
  const totalRefunded = transactions.filter((t) => t.status === 'completed' && t.transaction_type === 'refund').reduce((s, t) => s + t.amount_aed, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ivory">{t('Bank Reconciliation')}</h1>
        <p className="mt-1 text-base text-ivory-dim">
          {t('Matches what your payment gateway actually confirmed against manual folio charges that were marked paid but never linked to a real transaction - use this to catch anything unaccounted for. For a simple list of every payment (with refunds), see the')} <span className="text-ivory">{t('Payments')}</span> {t('tab instead.')}
        </p>
      </div>

      <Section title={t('Audit Report')} action={
        <div className="flex items-center gap-2">
          <select
            value={auditYear}
            onChange={(e) => setAuditYear(Number(e.target.value))}
            className="rounded-lg border border-ink-line bg-ink px-2.5 py-1.5 text-sm text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button type="button"
            onClick={handleIssueAuditReport}
            disabled={generatingAudit}
            className="rounded-lg bg-brass px-4 py-1.5 text-sm font-medium text-ink hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
          >
            {generatingAudit ? t('Generating...') : t('Issue Audit Report')}
          </button>
        </div>
      }>
        <p className="text-base text-ivory-dim">
          {t('Every signed contract, billing receipt, and completed customer payment for the selected year, compiled into one PDF - hand it straight to your accountant or the FTA, no manual reconciliation needed.')}
        </p>
        {auditError && <p className="mt-2 text-sm text-danger">{auditError}</p>}
      </Section>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-ink-line p-4">
          <p className="text-sm text-ivory-dim">{t('Gateway-confirmed')}</p>
          <p className="mt-1 font-display text-xl text-success">AED {totalCompleted.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-ink-line p-4">
          <p className="text-sm text-ivory-dim">{t('Refunded')}</p>
          <p className="mt-1 font-display text-xl text-warning">AED {totalRefunded.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-danger/40 p-4">
          <p className="text-sm text-ivory-dim">{t('Unverified manual entries')}</p>
          <p className="mt-1 font-display text-xl text-danger">{unverified.length}</p>
        </div>
      </div>

      {unverified.length > 0 && (
        <Section title={t('Unverified manual payments')}>
          <p className="text-sm text-ivory-dim">{t('Recorded by staff without a real gateway transaction behind them - cash, or something paid outside Tavzio entirely.')}</p>
          <div className="space-y-2">
            {unverified.map((u) => (
              <div key={u.id} className="rounded-lg border border-danger/30 px-4 py-3 text-sm">
                <p className="text-ivory">{u.description} · AED {Math.abs(u.amount_aed).toFixed(2)} · {u.charge_type}</p>
                <p className="text-ivory-dim">{new Date(u.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title={t('Gateway transactions')}>
        {loading && <p className="text-ivory-dim">Loading...</p>}
        <div className="space-y-2">
          {transactions.map((txn) => (
            <TransactionRow key={txn.id} txn={txn} businessId={businessId} onChange={reload} />
          ))}
          {!loading && transactions.length === 0 && <p className="text-ivory-dim">{t('No gateway transactions yet.')}</p>}
        </div>
      </Section>
    </div>
  );
}

// Same inline expandable refund pattern as PaymentsPage's PaymentRowItem -
// replaces the old window.prompt()-based flow, which blocked the whole
// page behind a native browser dialog for a real financial action.
function TransactionRow({ txn, businessId, onChange }: { txn: PaymentTransaction; businessId: string; onChange: () => void }) {
  const { t } = useT();
  const [showRefund, setShowRefund] = useState(false);
  const [amount, setAmount] = useState(txn.amount_aed);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleRefund() {
    setSubmitting(true);
    setError('');
    try {
      await refundPaymentTransaction(businessId, txn.id, amount, reason);
      setShowRefund(false);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Refund could not be processed'));
    } finally {
      setSubmitting(false);
    }
  }

  const canRefund = txn.status === 'completed' && txn.transaction_type === 'charge';

  return (
    <div className="rounded-lg border border-ink-line px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-base text-ivory">{txn.provider} · {txn.transaction_type} · AED {txn.amount_aed.toFixed(2)}</p>
          <p className={`text-sm ${STATUS_COLOR[txn.status]}`}>{txn.status} · {txn.context_type} · {new Date(txn.created_at).toLocaleString()}</p>
          {txn.failure_reason && <p className="text-sm text-danger">{txn.failure_reason}</p>}
        </div>
        {canRefund && (
          <button
            type="button"
            onClick={() => setShowRefund((s) => !s)}
            className="rounded-lg border border-danger/40 px-3 py-1.5 text-sm text-danger hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
          >
            {t('Refund')}
          </button>
        )}
      </div>

      {showRefund && canRefund && (
        <div className="mt-2 space-y-2 border-t border-ink-line pt-2">
          <div className="flex gap-2">
            <input
              type="number" onFocus={(e) => e.target.select()}
              step="0.01"
              min={0}
              max={txn.amount_aed}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-28 rounded-lg border border-ink-line bg-ink px-2 py-1.5 text-base text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
            />
            <input
              placeholder={t('Reason (optional)')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="flex-1 rounded-lg border border-ink-line bg-ink px-2 py-1.5 text-base text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
            />
          </div>
          {error && <p className="text-base text-danger">{error}</p>}
          <button type="button"
            onClick={handleRefund}
            disabled={submitting}
            className="w-full rounded-lg border border-danger/40 bg-danger/10 px-3 py-1.5 text-base text-danger disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
          >
            {submitting ? t('Processing...') : `${t('Confirm refund of')} ${amount.toFixed(2)} AED`}
          </button>
        </div>
      )}
    </div>
  );
}
