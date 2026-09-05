import { useState } from 'react';
import { useT } from '../hooks/useT';
import PaymentModal from './PaymentModal';
import type { OrderRow, OrderItemRow } from '../types';

// The real, advanced payment flow - combine several tables into one
// payment, or split by item so one person out of a party of five can
// pay separately on the card machine. Originally built for Orders page;
// now shared with POS Terminal too, so staff never have to leave the
// counter to reach it.
export default function RecordPaymentFlow({ businessId, orders, onClose, onDone }: {
  businessId: string; orders: OrderRow[]; onClose: () => void; onDone: () => void;
}) {
  const { t } = useT();
  // Real combine-checks: a Set, not a single string - two separate
  // tables wanting to pay together (a common real request, not an edge
  // case) previously had no way to be settled in one pass at all.
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [pickingTables, setPickingTables] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showPayment, setShowPayment] = useState(false);

  const tableGroups = orders.reduce<Record<string, OrderRow[]>>((acc, o) => {
    const key = o.table_label || t('No table');
    const unpaid = o.order_items.filter((i) => !i.voided && !i.paid);
    if (unpaid.length > 0) (acc[key] ||= []).push(o);
    return acc;
  }, {});

  // itemId -> orderId, so several separate orders (whether from one
  // table with multiple rounds, or several combined tables) can still
  // be settled in one pass - the shared PaymentModal groups by this
  // same real orderId underneath, since orders always stay genuinely
  // separate records even when paid together.
  const itemToOrder = new Map<string, string>();
  const itemDetails = new Map<string, OrderItemRow>();
  const itemTable = new Map<string, string>();
  Array.from(selectedTables).forEach((table) => (tableGroups[table] || []).forEach((o) => o.order_items.forEach((i) => {
    if (!i.voided && !i.paid) { itemToOrder.set(i.id, o.id); itemDetails.set(i.id, i); itemTable.set(i.id, table); }
  })));

  function toggleTable(table: string) {
    setSelectedTables((prev) => {
      const next = new Set(prev);
      if (next.has(table)) next.delete(table);
      else next.add(table);
      return next;
    });
  }

  function toggle(itemId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  const paymentItems = Array.from(selected).map((itemId) => {
    const item = itemDetails.get(itemId)!;
    return { id: item.id, orderId: itemToOrder.get(itemId)!, name: item.item_name, unitPrice: item.unit_price, addonTotal: item.addon_total, quantity: item.quantity };
  });

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-ink/80 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-ink-line bg-ink p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-ivory">{t('Record payment')}</h2>
          <button type="button" onClick={onClose} className="rounded-full px-2 py-1 text-base text-ivory-dim hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">{t("Close")}</button>
        </div>

        {pickingTables ? (
          <div className="space-y-2">
            {Object.keys(tableGroups).length === 0 && <p className="text-base text-ivory-dim">{t('No unpaid items right now.')}</p>}
            <p className="text-sm text-ivory-dim">{t('Select one table, or several to combine into one payment.')}</p>
            {Object.keys(tableGroups).map((table) => (
              <label
                key={table}
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-base text-ivory shadow-sm ${
                  selectedTables.has(table) ? 'border-brass bg-brass/10' : 'border-ink-line hover:border-brass/40'
                }`}
              >
                <input type="checkbox" checked={selectedTables.has(table)} onChange={() => toggleTable(table)} className="accent-brass" />
                {table}
              </label>
            ))}
            <button type="button"
              onClick={() => setPickingTables(false)}
              disabled={selectedTables.size === 0}
              className="mt-2 w-full rounded-full bg-brass px-3 py-3 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
            >
              {selectedTables.size > 1 ? t('Combine {n} tables').replace('{n}', String(selectedTables.size)) : t('Continue')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <button type="button" onClick={() => { setPickingTables(true); setSelected(new Set()); }} className="rounded-full px-1 text-sm text-brass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">{t('← Back to tables')}</button>
            <div className="flex items-center justify-between">
              <p className="text-sm text-ivory-dim">{selected.size} {t('of')} {itemToOrder.size} {t('selected')}</p>
              <button type="button"
                onClick={() => setSelected(selected.size === itemToOrder.size ? new Set() : new Set(itemToOrder.keys()))}
                className="rounded-full px-1 text-sm text-brass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
              >
                {selected.size === itemToOrder.size ? t('Deselect all') : t('Select all')}
              </button>
            </div>
            <div className="space-y-3">
              {Array.from(selectedTables).map((table) => (
                <div key={table}>
                  {selectedTables.size > 1 && <p className="mb-1 text-xs uppercase tracking-wide text-brass/70">{table}</p>}
                  <div className="space-y-2">
                    {(tableGroups[table] || []).map((o) => o.order_items.filter((i) => !i.voided && !i.paid).map((item) => (
                      <label key={item.id} className="flex items-center gap-2 text-base text-ivory">
                        <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} className="accent-brass" />
                        {item.quantity}× {item.item_name}
                        {item.cash_pending && <span className="text-xs text-warning">{t('(cash pending)')}</span>}
                        <span className="ml-auto text-ivory-dim">{((item.unit_price + item.addon_total) * item.quantity).toFixed(2)}</span>
                      </label>
                    )))}
                  </div>
                </div>
              ))}
            </div>
            <button type="button"
              onClick={() => setShowPayment(true)}
              disabled={selected.size === 0}
              className="w-full rounded-full bg-brass px-3 py-3 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
            >
              {t('Continue to Payment')}
            </button>
          </div>
        )}
      </div>
      {showPayment && (
        <PaymentModal
          businessId={businessId}
          items={paymentItems}
          defaultMode="card"
          onClose={() => setShowPayment(false)}
          onDone={onDone}
        />
      )}
    </div>
  );
}
