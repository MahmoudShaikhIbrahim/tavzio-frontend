import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { listReceipts, downloadReceiptPdf } from '../../lib/authApi';
import { Section } from '../../components/ui';
import type { BillingReceipt } from '../../types';

export default function ReceiptsPage() {
  const { user } = useSession();
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
    <div className="space-y-10">
      <Section title="Receipts">
        <p className="text-base text-ivory-dim">
          Every receipt Tavzio has issued to your business - a monthly
          subscriber sees a new one appear here each billing period; a
          one-time client sees a single receipt, unless a later change
          means a new one is issued.
        </p>
        <div className="space-y-4">
          {receipts.map((r) => (
            <div key={r.id} className="flex flex-col gap-3 rounded-lg border border-ink-line px-5 py-4 text-base sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-ivory">
                  {r.receipt_number}
                  <span className="text-ivory-dim"> — {r.period_label || r.receipt_type.replace('_', ' ')}</span>
                  <span className={`ms-2 inline-block rounded-full border px-2 py-0.5 text-xs ${r.payment_status === 'paid' ? 'border-success/40 text-success' : 'border-brass/40 text-brass'}`}>
                    {r.payment_status === 'paid' ? 'Paid' : 'Payment due'}
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
                    className="rounded-lg bg-brass px-4 py-2 text-sm font-medium text-ink hover:opacity-90"
                  >
                    Pay now
                  </a>
                )}
                <button
                  onClick={() => handleDownload(r)}
                  disabled={downloadingId === r.id}
                  className="rounded-lg border border-brass/40 px-4 py-2 text-sm text-brass hover:bg-brass/10 disabled:opacity-50"
                >
                  {downloadingId === r.id ? 'Downloading...' : 'Download PDF'}
                </button>
              </div>
            </div>
          ))}
          {receipts.length === 0 && (
            <p className="text-base text-ivory-dim">No receipts yet - they'll appear here the moment Tavzio issues one.</p>
          )}
        </div>
      </Section>
    </div>
  );
}
