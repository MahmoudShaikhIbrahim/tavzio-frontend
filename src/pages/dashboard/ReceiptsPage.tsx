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
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-ink-line px-5 py-4 text-base">
              <div>
                <p className="text-ivory">
                  {r.receipt_number}
                  <span className="text-ivory-dim"> — {r.period_label || r.receipt_type.replace('_', ' ')}</span>
                </p>
                <p className="text-sm text-ivory-dim">
                  {new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} · AED {Number(r.amount).toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => handleDownload(r)}
                disabled={downloadingId === r.id}
                className="rounded-lg border border-brass/40 px-4 py-2 text-sm text-brass hover:bg-brass/10 disabled:opacity-50"
              >
                {downloadingId === r.id ? 'Downloading...' : 'Download PDF'}
              </button>
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
