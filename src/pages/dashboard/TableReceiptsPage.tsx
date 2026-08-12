import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';
import { listTablesWithUnpaid, getTableReceipt, printTableReceipt, type TableWithUnpaid } from '../../lib/authApi';
import type { OrderItemRow } from '../../types';
import { Section } from '../../components/ui';

export default function TableReceiptsPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const navigate = useNavigate();
  const [tables, setTables] = useState<TableWithUnpaid[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  function reload() {
    if (!businessId) return;
    setLoading(true);
    listTablesWithUnpaid(businessId).then(setTables).finally(() => setLoading(false));
  }
  useEffect(reload, [businessId]);

  if (!businessId) return <p className="text-ivory-dim">Loading...</p>;

  if (selectedCardId) {
    return (
      <TableReceiptDetail
        businessId={businessId}
        cardId={selectedCardId}
        onBack={() => setSelectedCardId(null)}
        onPrinted={() => {
          setSelectedCardId(null);
          reload();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-ivory">Table Receipts</h1>
        <button type="button" onClick={() => navigate('/admin/dashboard/orders')} className="text-sm text-ivory-dim hover:text-ivory">
          Back to Orders
        </button>
      </div>
      <p className="text-base text-ivory-dim">
        For businesses without Pay Bill - prepare and print an itemized receipt for a table, so staff can bring it
        to the customer along with the card machine.
      </p>

      {loading && <p className="text-base text-ivory-dim">Loading...</p>}
      {!loading && tables.length === 0 && <p className="text-base text-ivory-dim">No tables currently have anything unpaid.</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tables.map((t) => (
          <button type="button"
            key={t.cardId}
            onClick={() => setSelectedCardId(t.cardId)}
            className="rounded-xl border border-ink-line p-5 text-start hover:border-brass/40"
          >
            <p className="font-display text-lg text-ivory">{t.tableLabel || 'No table'}</p>
            <p className="mt-1 text-sm text-ivory-dim">{t.itemCount} item{t.itemCount === 1 ? '' : 's'}</p>
            <p className="mt-2 text-base text-brass">AED {t.total.toFixed(2)}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function TableReceiptDetail({ businessId, cardId, onBack, onPrinted }: {
  businessId: string; cardId: string; onBack: () => void; onPrinted: () => void;
}) {
  const [tableLabel, setTableLabel] = useState('');
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState('');
  const [printedResult, setPrintedResult] = useState<{ printed: boolean; printError: string | null; receiptText: string } | null>(null);

  useEffect(() => {
    getTableReceipt(businessId, cardId)
      .then((res) => {
        setTableLabel(res.tableLabel);
        setItems(res.items);
      })
      .finally(() => setLoading(false));
  }, [businessId, cardId]);

  function toggleRemoved(itemId: string) {
    setRemovedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  const finalItems = items.filter((i) => !removedIds.has(i.id));
  const subtotal = finalItems.reduce((sum, i) => sum + (i.unit_price + Number(i.addon_total || 0)) * i.quantity, 0);
  const vat = Math.round((subtotal - subtotal / 1.05) * 100) / 100;
  const net = Math.round((subtotal - vat) * 100) / 100;

  async function handlePrint() {
    setPrinting(true);
    setError('');
    try {
      const result = await printTableReceipt(businessId, cardId, Array.from(removedIds));
      setPrintedResult(result);
      if (!result.printed) {
        // No printer connected (or the job failed) - fall back to the
        // browser's own print dialog with the exact same content, so
        // "Print" never dead-ends even without PrintNode set up.
        openBrowserPrintFallback(result.receiptText);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not print the receipt');
    } finally {
      setPrinting(false);
    }
  }

  if (loading) return <p className="text-ivory-dim">Loading...</p>;

  if (printedResult) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={onBack} className="text-sm text-ivory-dim hover:text-ivory">← Back to tables</button>
        <Section title={`Receipt for ${tableLabel || 'this table'}`}>
          {printedResult.printed ? (
            <p className="text-base text-success">Sent to the printer.</p>
          ) : (
            <p className="text-base text-warning">
              No printer connected{printedResult.printError ? ` (${printedResult.printError})` : ''} - opened your browser's print
              dialog instead.
            </p>
          )}
          <button type="button" onClick={onPrinted} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90">
            Done
          </button>
        </Section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="text-sm text-ivory-dim hover:text-ivory">← Back to tables</button>
      <Section title={`Receipt for ${tableLabel || 'this table'}`}>
        <p className="text-base text-ivory-dim">
          Uncheck anything that shouldn't be on the printed receipt. This only changes what prints - it never removes
          the item from the order, and every removal is recorded in the audit log.
        </p>
        <div className="space-y-2">
          {items.map((item) => (
            <label key={item.id} className="flex items-center justify-between rounded-lg border border-ink-line px-3.5 py-3">
              <span className="flex items-center gap-3 text-base text-ivory">
                <input
                  type="checkbox"
                  checked={!removedIds.has(item.id)}
                  onChange={() => toggleRemoved(item.id)}
                  className="accent-brass"
                />
                {item.quantity}× {item.item_name}
              </span>
              <span className="text-base text-brass">
                {((item.unit_price + Number(item.addon_total || 0)) * item.quantity).toFixed(2)}
              </span>
            </label>
          ))}
        </div>
        <div className="space-y-1 border-t border-ink-line pt-3 text-base">
          <div className="flex justify-between text-ivory-dim"><span>Net</span><span>AED {net.toFixed(2)}</span></div>
          <div className="flex justify-between text-ivory-dim"><span>VAT (5%)</span><span>AED {vat.toFixed(2)}</span></div>
          <div className="flex justify-between font-medium text-ivory"><span>Total</span><span className="text-brass">AED {subtotal.toFixed(2)}</span></div>
        </div>
        {error && <p className="text-base text-danger">{error}</p>}
        <button type="button"
          onClick={handlePrint}
          disabled={printing || finalItems.length === 0}
          className="w-full rounded-lg bg-brass px-4 py-3 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50"
        >
          {printing ? 'Printing...' : 'Print'}
        </button>
      </Section>
    </div>
  );
}

// Opens a minimal print-ready window with the same receipt text the
// printer would have received, formatted for an 80mm-ish narrow layout,
// then triggers the browser's native print dialog - works with whatever
// printer (thermal or regular) is already set up on this device.
function openBrowserPrintFallback(receiptText: string) {
  const win = window.open('', '_blank', 'width=380,height=600');
  if (!win) return;
  win.document.write(`
    <html>
      <head>
        <title>Receipt</title>
        <style>
          body { font-family: 'IBM Plex Mono', monospace; font-size: 12px; width: 280px; margin: 12px auto; white-space: pre-wrap; }
        </style>
      </head>
      <body>${receiptText.replace(/</g, '&lt;')}</body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}
