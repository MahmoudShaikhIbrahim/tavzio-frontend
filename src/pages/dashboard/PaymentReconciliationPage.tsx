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

  function reload() {
    if (!businessId) return;
    getPaymentReconciliation(businessId).then((r) => { setTransactions(r.gatewayTransactions); setUnverified(r.unverifiedManualPayments); }).finally(() => setLoading(false));
  }
  useEffect(reload, [businessId]);

  async function handleIssueAuditReport() {
    if (!businessId) return;
    setGeneratingAudit(true);
    try {
      await downloadBusinessAuditReport(businessId, auditYear);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not generate audit report');
    } finally {
      setGeneratingAudit(false);
    }
  }

  async function handleRefund(txnId: string) {
    if (!businessId) return;
    const reason = prompt(t('Reason for this refund:'));
    if (!reason) return;
    try {
      await refundPaymentTransaction(businessId, txnId, undefined, reason);
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Refund could not be processed');
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
            className="rounded-lg border border-ink-line bg-ink px-2.5 py-1.5 text-sm text-ivory"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button type="button"
            onClick={handleIssueAuditReport}
            disabled={generatingAudit}
            className="rounded-lg bg-brass px-4 py-1.5 text-sm font-medium text-ink hover:opacity-90 disabled:opacity-50"
          >
            {generatingAudit ? t('Generating...') : t('Issue Audit Report')}
          </button>
        </div>
      }>
        <p className="text-base text-ivory-dim">
          {t('Every signed contract, billing receipt, and completed customer payment for the selected year, compiled into one PDF - hand it straight to your accountant or the FTA, no manual reconciliation needed.')}
        </p>
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
            <div key={txn.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-line px-4 py-3">
              <div>
                <p className="text-base text-ivory">{txn.provider} · {txn.transaction_type} · AED {txn.amount_aed.toFixed(2)}</p>
                <p className={`text-sm ${STATUS_COLOR[txn.status]}`}>{txn.status} · {txn.context_type} · {new Date(txn.created_at).toLocaleString()}</p>
                {txn.failure_reason && <p className="text-sm text-danger">{txn.failure_reason}</p>}
              </div>
              {txn.status === 'completed' && txn.transaction_type === 'charge' && (
                <button type="button" onClick={() => handleRefund(txn.id)} className="text-sm text-danger hover:underline">{t('Refund')}</button>
              )}
            </div>
          ))}
          {!loading && transactions.length === 0 && <p className="text-ivory-dim">{t('No gateway transactions yet.')}</p>}
        </div>
      </Section>
    </div>
  );
}
