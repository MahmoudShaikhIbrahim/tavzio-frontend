import { useEffect, useState, type ReactNode } from 'react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import { listContracts, previewContract, signContract, downloadContractPdf, listReceipts, downloadReceiptPdf } from '../../lib/authApi';
import type { Contract, BillingReceipt } from '../../types';
import { Section } from '../../components/ui';

export default function ContractPage() {
  const { t } = useT();
  const [tab, setTab] = useState<'contract' | 'receipts'>('contract');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ivory">{t('Contracts & Receipts')}</h1>
        <p className="mt-1 text-base text-ivory-dim">{t("Everything you've signed and everything you've been billed, in one place.")}</p>
      </div>
      <div className="flex gap-2">
        <TabButton active={tab === 'contract'} onClick={() => setTab('contract')}>{t('Contract')}</TabButton>
        <TabButton active={tab === 'receipts'} onClick={() => setTab('receipts')}>{t('Receipts')}</TabButton>
      </div>
      {tab === 'contract' ? <ContractTab /> : <ReceiptsTab />}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${active ? 'bg-brass text-ink' : 'border border-ink-line text-ivory-dim hover:border-brass/40 hover:text-ivory'}`}
    >
      {children}
    </button>
  );
}

function ContractTab() {
  const { user } = useSession();
  const { t } = useT();
  const businessId = user?.business_id;
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [previewText, setPreviewText] = useState('');
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!businessId) return;
    listContracts(businessId).then(setContracts).finally(() => setLoading(false));
  }, [businessId]);

  // The most relevant one to show: an unsigned draft/sent contract takes
  // priority over an already-signed one, since that's the thing needing
  // the owner's attention right now.
  const activeContract = contracts.find((c) => c.status === 'draft' || c.status === 'sent') || contracts[0];

  useEffect(() => {
    if (!businessId || !activeContract) return;
    previewContract(businessId, activeContract.id).then((res) => setPreviewText(res.text));
  }, [businessId, activeContract?.id]);

  async function handleSign() {
    if (!businessId || !activeContract) return;
    if (!fullName.trim()) { setError('Type your full legal name to sign'); return; }
    if (!agreed) { setError('Please confirm you have read and agree to the terms'); return; }
    setSigning(true);
    setError('');
    try {
      const updated = await signContract(businessId, activeContract.id, fullName.trim());
      setContracts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign contract');
    } finally {
      setSigning(false);
    }
  }

  async function handleDownload() {
    if (!businessId || !activeContract) return;
    setDownloading(true);
    try {
      await downloadContractPdf(businessId, activeContract.id, activeContract.contract_number);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download contract');
    } finally {
      setDownloading(false);
    }
  }

  if (loading) return <p className="text-ivory-dim">Loading...</p>;
  if (!activeContract) return <Section title={t('Service Contract')}><p className="text-ivory-dim">{t('No contract has been issued to your account yet.')}</p></Section>;

  const isSigned = activeContract.status === 'signed' || activeContract.status === 'active';

  return (
    <Section
      title={t('Service Contract')}
      action={
        <button type="button" onClick={handleDownload} disabled={downloading} className="rounded-lg border border-brass/40 px-4 py-2 text-sm text-brass hover:bg-brass/10 disabled:opacity-50">
          {downloading ? t('Downloading...') : t('Download PDF')}
        </button>
      }
    >
      <div className="flex items-center justify-between">
        <p className="text-base text-ivory">{activeContract.contract_number}</p>
        <span className={`text-sm ${isSigned ? 'text-success' : 'text-warning'}`}>
          {isSigned ? `${t('Signed by')} ${activeContract.signed_by_name} ${t('on')} ${new Date(activeContract.signed_at!).toLocaleDateString()}` : t('Awaiting your signature')}
        </span>
      </div>
      {activeContract.countdown && (
        <p className="mt-1 text-sm text-ivory-dim">
          {t('Next bill:')} {new Date(activeContract.countdown.nextBillingDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          {' · '}
          {t('Renews:')} {new Date(activeContract.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
      )}

      <pre className="max-h-[28rem] overflow-y-auto whitespace-pre-wrap rounded-lg border border-ink-line bg-ink-soft p-5 text-sm leading-relaxed text-ivory-dim">
        {isSigned && activeContract.signed_snapshot_text ? activeContract.signed_snapshot_text : previewText}
      </pre>

      {!isSigned && (
        <div className="space-y-3 rounded-2xl border border-ink-line p-4 shadow-sm">
          <p className="text-sm text-ivory-dim">
            {t('Signing electronically here is legally valid under UAE Federal Decree-Law No. 46 of 2021 on Electronic Transactions and Trust Services. Your typed name, the time, and your IP address are recorded alongside the exact text above at the moment you sign.')}
          </p>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t('Type your full legal name')}
            className="w-full rounded-lg border border-ink-line bg-ink px-3.5 py-2.5 text-base text-ivory"
          />
          <label className="flex items-center gap-2 text-base text-ivory">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="accent-brass" />
            {t('I have read and agree to the terms above.')}
          </label>
          {error && <p className="text-base text-danger">{error}</p>}
          <button type="button"
            onClick={handleSign}
            disabled={signing}
            className="rounded-full bg-brass px-4 py-2.5 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50"
          >
            {signing ? t('Signing...') : t('Sign contract')}
          </button>
        </div>
      )}
      {error && isSigned && <p className="text-base text-danger">{error}</p>}
    </Section>
  );
}

function ReceiptsTab() {
  const { user } = useSession();
  const { t } = useT();
  const businessId = user?.business_id;
  const [receipts, setReceipts] = useState<BillingReceipt[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (businessId) listReceipts(businessId).then(setReceipts);
  }, [businessId]);

  if (!businessId) return null;

  async function handleDownload(receipt: BillingReceipt) {
    setDownloadingId(receipt.id);
    try {
      await downloadReceiptPdf(businessId!, receipt.id, receipt.receipt_number);
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <Section title={t('Receipts')}>
      <p className="text-base text-ivory-dim">
        {t("Every receipt Tavzio has issued to your business - a monthly subscriber sees a new one appear here each billing period; a one-time client sees a single receipt, unless a later change means a new one is issued.")}
      </p>
      <div className="space-y-4">
        {receipts.map((r) => (
          <div key={r.id} className="flex flex-col gap-3 rounded-2xl border border-ink-line px-5 py-4 text-base shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-ivory">
                {r.receipt_number}
                <span className="text-ivory-dim"> — {r.period_label || r.receipt_type.replace('_', ' ')}</span>
                <span className={`ms-2 inline-block rounded-full border px-2 py-0.5 text-xs ${r.payment_status === 'paid' ? 'border-success/40 text-success' : 'border-brass/40 text-brass'}`}>
                  {r.payment_status === 'paid' ? t('Paid') : t('Payment due')}
                </span>
              </p>
              <p className="text-sm text-ivory-dim">
                {new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} · AED {Number(r.amount).toFixed(2)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {r.payment_status !== 'paid' && r.payment_link_url && (
                <a
                  href={r.payment_link_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-brass px-4 py-2 text-sm font-medium text-ink hover:opacity-90"
                >
                  {t('Pay now')}
                </a>
              )}
              <button type="button"
                onClick={() => handleDownload(r)}
                disabled={downloadingId === r.id}
                className="rounded-full border border-brass/40 px-4 py-2 text-sm text-brass hover:bg-brass/10 disabled:opacity-50"
              >
                {downloadingId === r.id ? t('Downloading...') : t('Download PDF')}
              </button>
            </div>
          </div>
        ))}
        {receipts.length === 0 && (
          <p className="text-base text-ivory-dim">{t("No receipts yet - they'll appear here the moment Tavzio issues one.")}</p>
        )}
      </div>
    </Section>
  );
}
