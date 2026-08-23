import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import {
  listWarehouses, listStockTransfers, createStockTransfer, approveStockTransfer, shipStockTransfer,
  receiveStockTransfer, cancelStockTransfer, listIngredients, listPoAllocations, receivePoAllocation,
} from '../../lib/authApi';
import type { Warehouse, StockTransfer, Ingredient, PoAllocation } from '../../types';
import { Section, Field, inputClass, PrimaryButton, ActionButton } from '../../components/ui';

const STATUS_STYLE: Record<string, string> = {
  requested: 'border-ink-line text-ivory-dim',
  approved: 'border-brass/40 text-brass',
  in_transit: 'border-brass/40 text-brass',
  received: 'border-success/40 text-success',
  cancelled: 'border-danger/40 text-danger',
};

export default function StockTransfersPage() {
  const { user } = useSession();
  const { t } = useT();
  const businessId = user?.business_id;
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [allocations, setAllocations] = useState<PoAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTransfer, setShowNewTransfer] = useState(false);

  function reload() {
    if (!businessId) return;
    Promise.all([
      listWarehouses(businessId),
      listIngredients(businessId),
      listStockTransfers(businessId),
      listPoAllocations(businessId, false),
    ]).then(([w, i, tr, alloc]) => {
      setWarehouses(w);
      setIngredients(i);
      setTransfers(tr);
      setAllocations(alloc);
    }).finally(() => setLoading(false));
  }
  useEffect(reload, [businessId]);

  async function handleAction(action: (bId: string, id: string) => Promise<unknown>, transferId: string) {
    if (!businessId) return;
    try {
      await action(businessId, transferId);
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    }
  }

  if (!businessId) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ivory">{t('Stock Transfers')}</h1>
        <p className="mt-1 text-base text-ivory-dim">
          {t('Move stock between your own warehouses, and receive whatever this business has been allocated from an organization-level purchase order.')}
        </p>
      </div>

      {allocations.length > 0 && (
        <Section title={t('Incoming from your organization')}>
          <p className="text-sm text-ivory-dim">
            {t("Your share of a purchase order placed at the organization level - pick which of your own ingredients and warehouses each one restocks.")}
          </p>
          <div className="space-y-2">
            {allocations.map((a) => (
              <PoAllocationRow key={a.id} allocation={a} businessId={businessId} ingredients={ingredients} warehouses={warehouses} onReceived={reload} />
            ))}
          </div>
        </Section>
      )}

      <Section title={t('Transfers between your warehouses')} action={<ActionButton onClick={() => setShowNewTransfer((v) => !v)}>{showNewTransfer ? t('Cancel') : t('New transfer')}</ActionButton>}>
        {showNewTransfer && (
          <NewTransferForm businessId={businessId} warehouses={warehouses} ingredients={ingredients} onSaved={() => { setShowNewTransfer(false); reload(); }} />
        )}
        {loading && <p className="text-ivory-dim">{t('Loading...')}</p>}
        <div className="space-y-2">
          {transfers.map((tr) => (
            <div key={tr.id} className="rounded-lg border border-ink-line px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-base text-ivory">
                  {tr.from?.name || t('New delivery')} → {tr.to?.name}
                  <span className={`ms-2 rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLE[tr.status]}`}>{tr.status.replace('_', ' ')}</span>
                </p>
                <div className="flex items-center gap-3">
                  {tr.status === 'requested' && <button type="button" onClick={() => handleAction(approveStockTransfer, tr.id)} className="text-sm text-brass hover:underline">{t('Approve')}</button>}
                  {tr.status === 'approved' && tr.from_warehouse_id && <button type="button" onClick={() => handleAction(shipStockTransfer, tr.id)} className="text-sm text-brass hover:underline">{t('Mark shipped')}</button>}
                  {(tr.status === 'in_transit' || (tr.status === 'approved' && !tr.from_warehouse_id)) && <button type="button" onClick={() => handleAction(receiveStockTransfer, tr.id)} className="text-sm text-success hover:underline">{t('Mark received')}</button>}
                  {(tr.status === 'requested' || tr.status === 'approved') && <button type="button" onClick={() => handleAction(cancelStockTransfer, tr.id)} className="text-sm text-danger hover:underline">{t('Cancel')}</button>}
                </div>
              </div>
              <p className="mt-1 text-sm text-ivory-dim">
                {(tr.stock_transfer_items || []).map((i) => `${i.quantity} ${i.ingredients?.unit || ''} ${i.ingredients?.name || ''}`).join(', ')}
              </p>
            </div>
          ))}
          {!loading && transfers.length === 0 && <p className="text-ivory-dim">{t('No transfers yet.')}</p>}
        </div>
      </Section>
    </div>
  );
}

function PoAllocationRow({ allocation, businessId, ingredients, warehouses, onReceived }: {
  allocation: PoAllocation; businessId: string; ingredients: Ingredient[]; warehouses: Warehouse[]; onReceived: () => void;
}) {
  const { t } = useT();
  const [ingredientId, setIngredientId] = useState(allocation.ingredient_id || '');
  const [warehouseId, setWarehouseId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleReceive() {
    if (!ingredientId || !warehouseId) { setError('Pick which ingredient and warehouse this restocks'); return; }
    setSaving(true);
    setError('');
    try {
      await receivePoAllocation(businessId, allocation.id, { ingredientId, warehouseId });
      onReceived();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not receive');
    } finally {
      setSaving(false);
    }
  }

  const item = allocation.purchase_order_items;
  return (
    <div className="rounded-lg border border-brass/30 bg-ink-soft p-4">
      <p className="text-base text-ivory">
        {allocation.quantity} {item?.item_unit} {item?.item_name}
        {item?.purchase_orders?.suppliers?.name && <span className="text-ivory-dim"> · {item.purchase_orders.suppliers.name}</span>}
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <select value={ingredientId} onChange={(e) => setIngredientId(e.target.value)} className={inputClass}>
          <option value="">{t('Restocks which ingredient?')}</option>
          {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={inputClass}>
          <option value="">{t('Into which warehouse?')}</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-3">
        <PrimaryButton onClick={handleReceive} loading={saving} type="button">{t('Mark received')}</PrimaryButton>
      </div>
    </div>
  );
}

function NewTransferForm({ businessId, warehouses, ingredients, onSaved }: {
  businessId: string; warehouses: Warehouse[]; ingredients: Ingredient[]; onSaved: () => void;
}) {
  const { t } = useT();
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [ingredientId, setIngredientId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!toId || !ingredientId) { setError('Destination warehouse and an ingredient are required'); return; }
    if (fromId && fromId === toId) { setError('Source and destination must be different'); return; }
    setSaving(true);
    setError('');
    try {
      await createStockTransfer(businessId, {
        fromWarehouseId: fromId || null,
        toWarehouseId: toId,
        items: [{ ingredientId, quantity }],
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create transfer');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-ink-line p-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label={t('From (leave blank for a fresh delivery)')}>
          <select value={fromId} onChange={(e) => setFromId(e.target.value)} className={inputClass}>
            <option value="">{t('No source - new delivery')}</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </Field>
        <Field label={t('To')}>
          <select value={toId} onChange={(e) => setToId(e.target.value)} className={inputClass}>
            <option value="">{t('Select...')}</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </Field>
        <Field label={t('Ingredient')}>
          <select value={ingredientId} onChange={(e) => setIngredientId(e.target.value)} className={inputClass}>
            <option value="">{t('Select...')}</option>
            {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </Field>
        <Field label={t('Quantity')}>
          <input type="number" min={0.01} step="0.01" onFocus={(e) => e.target.select()} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className={inputClass} />
        </Field>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-3">
        <PrimaryButton onClick={handleSave} loading={saving} type="button">{t('Create transfer')}</PrimaryButton>
      </div>
    </div>
  );
}
