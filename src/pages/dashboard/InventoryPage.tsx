import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import {
  listIngredients, createIngredient, updateIngredient, deleteIngredient, adjustStock,
  recordWaste, getWasteReport, getLowStock, getInventoryValuation,
  getMenuItemFoodCost, getActualFoodCost,
  listSuppliers, createSupplier, updateSupplier, deleteSupplier,
  listPurchaseOrders, createPurchaseOrder, receivePurchaseOrder, listPurchaseOrderReceipts,
  listWarehouses, createWarehouse, updateWarehouse, deleteWarehouse, getWarehouseStock,
  listStockTransfers, createStockTransfer, approveStockTransfer, shipStockTransfer,
  receiveStockTransfer, cancelStockTransfer, listPoAllocations, receivePoAllocation,
} from '../../lib/authApi';
import type {
  Ingredient, Supplier, PurchaseOrder, PurchaseOrderReceipt, LowStockIngredient, InventoryValuation, WasteReport, FoodCostReport, ActualFoodCostReport,
  Warehouse, WarehouseStockLine, StockTransfer, PoAllocation,
} from '../../types';
import { Section, Field, inputClass, PrimaryButton, ActionButton } from '../../components/ui';
import { useConfirm } from '../../components/ConfirmDialog';

const UNITS = ['g', 'kg', 'ml', 'l', 'piece'];
const WASTE_CATEGORIES = [
  { value: 'spoilage', label: 'Spoilage' },
  { value: 'prep_error', label: 'Prep error' },
  { value: 'breakage', label: 'Breakage' },
  { value: 'expired', label: 'Expired' },
  { value: 'other', label: 'Other' },
];

export default function InventoryPage() {
  const { user } = useSession();
  const { t } = useT();
  const businessId = user?.business_id;
  const [tab, setTab] = useState<'ingredients' | 'suppliers' | 'purchase-orders' | 'reorder' | 'waste' | 'food-cost' | 'warehouses' | 'stock-transfers'>('ingredients');

  if (!businessId) return <p className="text-ivory-dim">Loading...</p>;

  const tabLabels: Record<typeof tab, string> = {
    ingredients: 'Ingredients', suppliers: 'Suppliers', 'purchase-orders': 'Purchase Orders',
    reorder: 'Reorder & valuation', waste: 'Waste', 'food-cost': 'Food Cost',
    warehouses: 'Warehouses', 'stock-transfers': 'Stock Transfers',
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-ivory">{t('Inventory')}</h1>
      <div className="flex flex-wrap gap-2 border-b border-ink-line">
        {(['ingredients', 'reorder', 'waste', 'food-cost', 'warehouses', 'stock-transfers', 'suppliers', 'purchase-orders'] as const).map((tabKey) => (
          <button type="button"
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`px-2.5 py-1.5 text-sm sm:px-4 sm:py-2 sm:text-base ${tab === tabKey ? 'border-b-2 border-brass text-brass' : 'text-ivory-dim hover:text-ivory'}`}
          >
            {t(tabLabels[tabKey])}
          </button>
        ))}
      </div>
      {tab === 'ingredients' && <IngredientsTab businessId={businessId} />}
      {tab === 'suppliers' && <SuppliersTab businessId={businessId} />}
      {tab === 'purchase-orders' && <PurchaseOrdersTab businessId={businessId} />}
      {tab === 'reorder' && <ReorderTab businessId={businessId} />}
      {tab === 'waste' && <WasteTab businessId={businessId} />}
      {tab === 'food-cost' && <FoodCostTab businessId={businessId} />}
      {tab === 'warehouses' && <WarehousesTab businessId={businessId} />}
      {tab === 'stock-transfers' && <StockTransfersTab businessId={businessId} />}
    </div>
  );
}

function IngredientsTab({ businessId }: { businessId: string }) {
  const { t } = useT();
  const confirm = useConfirm();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('g');
  const [threshold, setThreshold] = useState(0);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [wastingId, setWastingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  function reload() {
    setLoading(true);
    listIngredients(businessId).then(setIngredients).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(reload, [businessId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await createIngredient(businessId, { name, unit, lowStockThreshold: threshold });
      setName(''); setThreshold(0); setShowAdd(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add ingredient');
    }
  }

  async function handleAdjust(id: string) {
    const qty = Number(adjustQty);
    if (!qty) return;
    try {
      await adjustStock(businessId, id, { changeQty: qty, reason: 'manual_adjustment' });
      setAdjustingId(null); setAdjustQty('');
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not adjust stock');
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!(await confirm({ title: t('Delete ingredient?'), message: `${t('Delete')} "${name}"? ${t("This can't be undone.")}`, confirmLabel: t('Delete'), danger: true }))) return;
    setError('');
    try {
      await deleteIngredient(businessId, id);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete ingredient');
    }
  }

  return (
    <Section title={t('Ingredients')} action={
      <button type="button" onClick={() => setShowAdd((s) => !s)} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90">
        {t('+ Add ingredient')}
      </button>
    }>
      {showAdd && (
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-line p-4">
          <Field label={t('Name')}>
            <input value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
          </Field>
          <Field label={t('Unit')}>
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory">
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
          <Field label={t('Low-stock threshold')}>
            <input type="number" onFocus={(e) => e.target.select()} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className={`${inputClass} w-32`} />
          </Field>
          <button type="submit" className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90">{t('Save')}</button>
        </form>
      )}
      {error && <p className="text-base text-danger">{error}</p>}
      {loading && <p className="text-ivory-dim">Loading...</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {ingredients.map((ing) => {
          const low = ing.stock_qty <= ing.low_stock_threshold;
          // A visual sense of "how full" this ingredient is, not just a
          // number - capped at 2x the low-stock threshold so the bar is
          // meaningful (a threshold of 5 with 200 in stock shouldn't read
          // as "basically empty" just because 200/huge-number is tiny).
          const ceiling = Math.max(ing.low_stock_threshold * 2, ing.low_stock_threshold + 1, 1);
          const fillPct = Math.min(100, Math.round((ing.stock_qty / ceiling) * 100));
          if (editingId === ing.id) {
            return <IngredientEditForm key={ing.id} businessId={businessId} ingredient={ing} onDone={() => { setEditingId(null); reload(); }} onCancel={() => setEditingId(null)} />;
          }
          return (
            <div key={ing.id} className="rounded-xl border border-ink-line bg-ink-soft/40 p-4 transition-colors hover:border-brass/40">
              <div className="flex items-start justify-between gap-2">
                <p className="font-display text-base text-ivory">{ing.name}</p>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${low ? 'border-danger/40 text-danger' : 'border-success/40 text-success'}`}>
                  {low ? t('Low stock') : t('In stock')}
                </span>
              </div>

              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink-line">
                <div
                  className={`h-full rounded-full transition-all ${low ? 'bg-danger' : 'bg-brass'}`}
                  style={{ width: `${fillPct}%` }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-sm text-ivory-dim">
                <span>{ing.stock_qty} {ing.unit} {t('on hand')}</span>
                <span>AED {ing.cost_per_unit.toFixed(2)}/{ing.unit}</span>
              </div>

              {adjustingId === ing.id ? (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="number"
                    placeholder={t('+/- qty')}
                    onFocus={(e) => e.target.select()}
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(e.target.value)}
                    className="w-24 rounded-lg border border-ink-line bg-ink px-3 py-1.5 text-base text-ivory"
                  />
                  <button type="button" onClick={() => handleAdjust(ing.id)} className="rounded-lg bg-brass px-3 py-1.5 text-sm font-medium text-ink">{t('Apply')}</button>
                  <button type="button" onClick={() => setAdjustingId(null)} className="text-sm text-ivory-dim">{t('Cancel')}</button>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-ink-line pt-3">
                  <button type="button" onClick={() => setAdjustingId(ing.id)} className="text-sm text-brass hover:underline">{t('Adjust stock')}</button>
                  <button type="button" onClick={() => setWastingId(ing.id)} className="text-sm text-danger hover:underline">{t('Record waste')}</button>
                  <button type="button" onClick={() => setEditingId(ing.id)} className="text-sm text-brass hover:underline">{t('Edit')}</button>
                  <button type="button" onClick={() => handleDelete(ing.id, ing.name)} className="text-sm text-danger hover:underline">{t('Delete')}</button>
                </div>
              )}
              {wastingId === ing.id && (
                <WasteQuickForm
                  businessId={businessId}
                  ingredient={ing}
                  onDone={() => { setWastingId(null); reload(); }}
                  onCancel={() => setWastingId(null)}
                />
              )}
            </div>
          );
        })}
        {!loading && ingredients.length === 0 && <p className="text-ivory-dim">{t('No ingredients yet.')}</p>}
      </div>
    </Section>
  );
}

function IngredientEditForm({ businessId, ingredient, onDone, onCancel }: {
  businessId: string; ingredient: Ingredient; onDone: () => void; onCancel: () => void;
}) {
  const { t } = useT();
  const [name, setName] = useState(ingredient.name);
  const [unit, setUnit] = useState(ingredient.unit);
  const [threshold, setThreshold] = useState(ingredient.low_stock_threshold);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await updateIngredient(businessId, ingredient.id, { name, unit, lowStockThreshold: threshold });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this ingredient');
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-brass/40 bg-ink-soft p-4">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('Name')} className="w-full rounded-lg border border-ink-line bg-ink px-3 py-2 text-sm text-ivory" />
      <div className="flex gap-2">
        <select value={unit} onChange={(e) => setUnit(e.target.value as Ingredient['unit'])} className="flex-1 rounded-lg border border-ink-line bg-ink px-3 py-2 text-sm text-ivory">
          <option value="g">g</option>
          <option value="kg">kg</option>
          <option value="ml">ml</option>
          <option value="l">l</option>
          <option value="piece">piece</option>
        </select>
        <input
          type="number" min={0} value={threshold} onFocus={(e) => e.target.select()}
          onChange={(e) => setThreshold(Number(e.target.value))}
          placeholder={t('Low stock at')}
          className="flex-1 rounded-lg border border-ink-line bg-ink px-3 py-2 text-sm text-ivory"
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-brass px-3 py-1.5 text-sm font-medium text-ink disabled:opacity-50">
          {saving ? t('Saving...') : t('Save')}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-ivory-dim">{t('Cancel')}</button>
      </div>
    </div>
  );
}


function WasteQuickForm({ businessId, ingredient, onDone, onCancel }: {
  businessId: string; ingredient: Ingredient; onDone: () => void; onCancel: () => void;
}) {
  const { t } = useT();
  const [quantity, setQuantity] = useState('');
  const [wasteCategory, setWasteCategory] = useState('spoilage');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    const qty = Number(quantity);
    if (!qty || qty <= 0) { setError('Enter a quantity greater than 0'); return; }
    setSaving(true);
    setError('');
    try {
      await recordWaste(businessId, ingredient.id, { quantity: qty, wasteCategory, note });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record waste');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-danger/30 bg-danger/5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number" placeholder={`${t('Qty')} (${ingredient.unit})`} onFocus={(e) => e.target.select()}
          value={quantity} onChange={(e) => setQuantity(e.target.value)}
          className="w-28 rounded-lg border border-ink-line bg-ink px-3 py-1.5 text-sm text-ivory"
        />
        <select value={wasteCategory} onChange={(e) => setWasteCategory(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-1.5 text-sm text-ivory">
          {WASTE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{t(c.label)}</option>)}
        </select>
      </div>
      <input
        value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Note (optional)')}
        className="w-full rounded-lg border border-ink-line bg-ink px-3 py-1.5 text-sm text-ivory"
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-danger/80 px-3 py-1.5 text-sm font-medium text-ink disabled:opacity-50">
          {saving ? t('Saving...') : t('Record waste')}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-ivory-dim">{t('Cancel')}</button>
      </div>
    </div>
  );
}

function ReorderTab({ businessId }: { businessId: string }) {
  const { t } = useT();
  const [lowStock, setLowStock] = useState<LowStockIngredient[]>([]);
  const [valuation, setValuation] = useState<InventoryValuation | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingPoFor, setCreatingPoFor] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  function reload() {
    setLoading(true);
    Promise.all([getLowStock(businessId), getInventoryValuation(businessId)])
      .then(([low, val]) => { setLowStock(low); setValuation(val); }).catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(reload, [businessId]);

  // One-click reorder - creates a real purchase order for exactly this
  // ingredient's suggested quantity, at its last-known unit cost, from
  // its usual supplier if it has one. A manager can still fine-tune the
  // quantities on the Purchase Orders tab afterward - this just removes
  // the "open a blank form and re-type what's already on screen" step.
  async function handleQuickReorder(item: LowStockIngredient) {
    setCreatingPoFor(item.ingredientId);
    setMessage('');
    try {
      await createPurchaseOrder(businessId, {
        supplierId: item.supplierId || null,
        items: [{ ingredientId: item.ingredientId, quantity: item.suggestedReorderQty, unitCostAed: item.costPerUnit }],
      });
      setMessage(`${t('Purchase order created for')} ${item.name} - ${t('see the Purchase Orders tab.')}`);
      reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not create purchase order');
    } finally {
      setCreatingPoFor(null);
    }
  }

  if (loading) return <p className="text-ivory-dim">Loading...</p>;

  return (
    <div className="space-y-6">
      <Section title={t('Stock valuation')}>
        <p className="text-sm text-ivory-dim">{t("Total value of everything currently in stock, at each ingredient's weighted-average cost.")}</p>
        <p className="text-3xl text-brass">AED {(valuation?.totalValueAed ?? 0).toFixed(2)}</p>
        {valuation && valuation.lines.length > 0 && (
          <div className="max-h-64 space-y-1 overflow-y-auto text-sm">
            {valuation.lines.slice(0, 10).map((l) => (
              <div key={l.ingredientId} className="flex justify-between text-ivory-dim">
                <span>{l.name} ({l.stockQty} {l.unit})</span>
                <span className="text-ivory">AED {l.valueAed.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title={t('Low stock - suggested reorders')}>
        {message && <p className="text-sm text-brass">{message}</p>}
        {lowStock.length === 0 && <p className="text-ivory-dim">{t('Nothing is below its threshold right now.')}</p>}
        <div className="space-y-2">
          {lowStock.map((item) => (
            <div key={item.ingredientId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
              <div>
                <p className="text-base text-ivory">{item.name}</p>
                <p className="text-sm text-ivory-dim">
                  {item.stockQty} {item.unit} {t('on hand')} · {t('threshold')} {item.lowStockThreshold} {item.unit}
                  {item.supplierName ? ` · ${t('usual supplier:')} ${item.supplierName}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleQuickReorder(item)}
                disabled={creatingPoFor === item.ingredientId}
                className="rounded-lg bg-brass px-3 py-1.5 text-sm font-medium text-ink disabled:opacity-50"
              >
                {creatingPoFor === item.ingredientId ? t('Creating...') : `${t('Reorder')} ${item.suggestedReorderQty} ${item.unit}`}
              </button>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function WasteTab({ businessId }: { businessId: string }) {
  const { t } = useT();
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<WasteReport | null>(null);
  const [loading, setLoading] = useState(true);

  function reload() {
    setLoading(true);
    getWasteReport(businessId, days).then(setReport).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(reload, [businessId, days]);

  return (
    <Section title={t('Waste report')} action={
      <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-lg border border-ink-line bg-ink px-3 py-1.5 text-sm text-ivory">
        <option value={7}>{t('Last 7 days')}</option>
        <option value={30}>{t('Last 30 days')}</option>
        <option value={90}>{t('Last 90 days')}</option>
      </select>
    }>
      {loading && <p className="text-ivory-dim">Loading...</p>}
      {!loading && report && (
        <>
          <p className="text-3xl text-danger">AED {report.totalCostAed.toFixed(2)}</p>
          <p className="text-sm text-ivory-dim">{t('Total cost of waste over the last')} {report.days} {t('days. Use "Record waste" on an ingredient in the Ingredients tab to add to this.')}</p>

          {report.byCategory.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ivory-dim/70">{t('By reason')}</p>
              <div className="space-y-1">
                {report.byCategory.map((c) => (
                  <div key={c.category} className="flex justify-between text-sm">
                    <span className="text-ivory-dim">{t(WASTE_CATEGORIES.find((w) => w.value === c.category)?.label || c.category)} ({c.quantityEvents})</span>
                    <span className="text-ivory">AED {c.costAed.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.byIngredient.length > 0 && (
            <div>
              <p className="mb-2 mt-4 text-xs font-medium uppercase tracking-wide text-ivory-dim/70">{t('By ingredient')}</p>
              <div className="space-y-1">
                {report.byIngredient.map((i) => (
                  <div key={i.ingredientId} className="flex justify-between text-sm">
                    <span className="text-ivory-dim">{i.name} ({i.quantity} {i.unit})</span>
                    <span className="text-ivory">AED {i.costAed.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.events.length === 0 && <p className="text-ivory-dim">{t('No waste recorded in this window.')}</p>}
        </>
      )}
    </Section>
  );
}

function FoodCostTab({ businessId }: { businessId: string }) {
  const { t } = useT();
  const [view, setView] = useState<'theoretical' | 'actual'>('theoretical');
  const [report, setReport] = useState<FoodCostReport | null>(null);
  const [actual, setActual] = useState<ActualFoodCostReport | null>(null);
  const [actualDays, setActualDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (view === 'theoretical') {
      getMenuItemFoodCost(businessId).then(setReport).finally(() => setLoading(false));
    } else {
      const to = new Date().toISOString();
      const from = new Date(Date.now() - actualDays * 86400000).toISOString();
      getActualFoodCost(businessId, from, to).then(setActual).finally(() => setLoading(false));
    }
  }, [businessId, view, actualDays]);

  return (
    <Section title={t('Food cost')} action={
      <div className="flex items-center gap-2">
        {view === 'actual' && (
          <select value={actualDays} onChange={(e) => setActualDays(Number(e.target.value))} className="rounded-lg border border-ink-line bg-ink px-3 py-1.5 text-sm text-ivory">
            <option value={7}>{t('Last 7 days')}</option>
            <option value={30}>{t('Last 30 days')}</option>
            <option value={90}>{t('Last 90 days')}</option>
          </select>
        )}
        <div className="flex rounded-lg border border-ink-line">
          <button type="button" onClick={() => setView('theoretical')} className={`px-3 py-1.5 text-sm ${view === 'theoretical' ? 'bg-brass text-ink' : 'text-ivory-dim'}`}>{t('By menu')}</button>
          <button type="button" onClick={() => setView('actual')} className={`px-3 py-1.5 text-sm ${view === 'actual' ? 'bg-brass text-ink' : 'text-ivory-dim'}`}>{t('Actual sales')}</button>
        </div>
      </div>
    }>
      {loading && <p className="text-ivory-dim">Loading...</p>}

      {!loading && view === 'theoretical' && report && (
        <>
          <p className="text-sm text-ivory-dim">
            {t("What each dish's recipe costs at current ingredient prices, against what it sells for. Menu average across")}{' '}
            {report.items.length - report.untrackedCount} {t('tracked item(s):')}{' '}
            <span className="text-brass">{report.avgFoodCostPct != null ? `${report.avgFoodCostPct}%` : t('n/a')}</span>
            {report.untrackedCount > 0 && <span className="text-warning"> · {report.untrackedCount} {t("item(s) have no recipe yet, so their cost isn't tracked")}</span>}
          </p>
          <div className="space-y-1">
            {report.items.map((i) => (
              <div key={i.menuItemId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-line px-3 py-2 text-sm">
                <span className="text-ivory">{i.name}{!i.isAvailable ? ` ${t('(unavailable)')}` : ''}</span>
                {i.trackedByRecipe ? (
                  <span className="flex items-center gap-3 text-ivory-dim">
                    <span>{t('Cost')} AED {i.recipeCostAed!.toFixed(2)}</span>
                    <span>{t('Price')} AED {i.price.toFixed(2)}</span>
                    <span className={i.foodCostPct != null && i.foodCostPct > 35 ? 'text-danger' : 'text-success'}>{i.foodCostPct}% {t('food cost')}</span>
                  </span>
                ) : (
                  <span className="text-xs text-warning">{t("No recipe set - add one in Menu Management to track this item's cost")}</span>
                )}
              </div>
            ))}
            {report.items.length === 0 && <p className="text-ivory-dim">{t('No menu items yet.')}</p>}
          </div>
        </>
      )}

      {!loading && view === 'actual' && actual && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-ink-line p-3">
              <p className="text-xs text-ivory-dim">{t('Revenue')}</p>
              <p className="text-xl text-ivory">AED {actual.totalRevenueAed.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-ink-line p-3">
              <p className="text-xs text-ivory-dim">{t('Cost of goods sold')}</p>
              <p className="text-xl text-ivory">AED {actual.totalCostAed.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-ink-line p-3">
              <p className="text-xs text-ivory-dim">{t('Food cost %')}</p>
              <p className="text-xl text-brass">{actual.foodCostPct != null ? `${actual.foodCostPct}%` : t('n/a')}</p>
            </div>
          </div>
          {actual.untrackedRevenueAed > 0 && (
            <p className="text-sm text-warning">
              AED {actual.untrackedRevenueAed.toFixed(2)} {t("of revenue came from items with no recipe set - excluded from the food cost % above so it isn't understated.")}
            </p>
          )}
          <div className="space-y-1">
            {actual.byItem.map((i) => (
              <div key={i.name} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-line px-3 py-2 text-sm">
                <span className="text-ivory">{i.name} × {i.quantitySold}</span>
                <span className="text-ivory-dim">
                  {t('Revenue')} AED {i.revenueAed.toFixed(2)}
                  {i.trackedByRecipe ? ` · ${t('Cost')} AED ${i.costAed.toFixed(2)}` : ` · ${t('not tracked')}`}
                </span>
              </div>
            ))}
            {actual.byItem.length === 0 && <p className="text-ivory-dim">{t('No sales in this window.')}</p>}
          </div>
        </>
      )}
    </Section>
  );
}

function SuppliersTab({ businessId }: { businessId: string }) {
  const { t } = useT();
  const confirm = useConfirm();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [saving, setSaving] = useState(false);

  function reload() {
    listSuppliers(businessId).then(setSuppliers).catch(() => {});
  }
  useEffect(reload, [businessId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createSupplier(businessId, { name, phone, email });
    setName(''); setPhone(''); setEmail('');
    reload();
  }

  function startEdit(s: Supplier) {
    setEditingId(s.id);
    setEditName(s.name);
    setEditPhone(s.phone || '');
    setEditEmail(s.email || '');
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await updateSupplier(businessId, id, { name: editName, phone: editPhone, email: editEmail });
      setEditingId(null);
      reload();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(s: Supplier) {
    if (!(await confirm({
      title: t('Remove this supplier?'),
      message: t('Remove {name}? Past purchase orders that used this supplier keep their own record either way.').replace('{name}', s.name),
      confirmLabel: t('Remove'),
    }))) return;
    await deleteSupplier(businessId, s.id);
    reload();
  }

  return (
    <Section title={t('Suppliers')}>
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-line p-4">
        <Field label={t('Name')}><input value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} /></Field>
        <Field label={t('Phone')}><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} /></Field>
        <Field label={t('Email')}><input value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} /></Field>
        <button type="submit" className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90">{t('Add')}</button>
      </form>
      <div className="grid gap-3 sm:grid-cols-2">
        {suppliers.map((s) => (
          <div key={s.id} className="rounded-xl border border-ink-line bg-ink-soft/40 px-4 py-3 transition-colors hover:border-brass/40">
            {editingId === s.id ? (
              <div className="space-y-2">
                <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder={t('Name')} className={inputClass} />
                <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder={t('Phone')} className={inputClass} />
                <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder={t('Email')} className={inputClass} />
                <div className="flex gap-2">
                  <button type="button" onClick={() => handleSaveEdit(s.id)} disabled={saving} className="rounded-lg bg-brass px-3 py-1.5 text-sm font-medium text-ink hover:opacity-90 disabled:opacity-50">
                    {saving ? t('Saving...') : t('Save')}
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border border-ink-line px-3 py-1.5 text-sm text-ivory-dim hover:text-ivory">{t('Cancel')}</button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-base text-ivory">{s.name}</p>
                <p className="text-sm text-ivory-dim">{[s.phone, s.email].filter(Boolean).join(' · ') || t('No contact details')}</p>
                <div className="mt-2 flex gap-3">
                  <button type="button" onClick={() => startEdit(s)} className="text-sm text-brass hover:underline">{t('Edit')}</button>
                  <button type="button" onClick={() => handleDelete(s)} className="text-sm text-danger hover:underline">{t('Delete')}</button>
                </div>
              </>
            )}
          </div>
        ))}
        {suppliers.length === 0 && <p className="text-ivory-dim">{t('No suppliers yet.')}</p>}
      </div>
    </Section>
  );
}

function PurchaseOrdersTab({ businessId }: { businessId: string }) {
  const { t } = useT();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState<{ ingredientId: string; quantity: string; unitCostAed: string }[]>([
    { ingredientId: '', quantity: '', unitCostAed: '' },
  ]);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [receiveQtys, setReceiveQtys] = useState<Record<string, string>>({});
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<PurchaseOrderReceipt[]>([]);

  function reload() {
    listPurchaseOrders(businessId)
      .then((data) => { setOrders(data); setLoadError(''); })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Could not load purchase orders'));
  }
  useEffect(() => {
    reload();
    listSuppliers(businessId).then(setSuppliers).catch(() => {});
    listIngredients(businessId).then(setIngredients).catch(() => {});
  }, [businessId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const validItems = items.filter((i) => i.ingredientId && Number(i.quantity) > 0);
    if (validItems.length === 0) { setError('Add at least one item'); return; }
    try {
      await createPurchaseOrder(businessId, {
        supplierId: supplierId || null,
        items: validItems.map((i) => ({ ingredientId: i.ingredientId, quantity: Number(i.quantity), unitCostAed: Number(i.unitCostAed) })),
      });
      setShowNew(false);
      setItems([{ ingredientId: '', quantity: '', unitCostAed: '' }]);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create purchase order');
    }
  }

  // No `items` payload = receive everything still outstanding on every
  // line in one shot - the common case for a delivery that arrived complete.
  async function handleReceiveAll(id: string) {
    await receivePurchaseOrder(businessId, id);
    reload();
    listIngredients(businessId).then(setIngredients);
  }

  // A delivery that only partly arrived - only the quantities actually
  // typed in move into stock; anything left blank/zero stays outstanding
  // and the PO stays open for a later delivery to complete.
  async function handleReceivePartial(po: PurchaseOrder) {
    const payload = po.purchase_order_items
      .map((it) => ({ purchaseOrderItemId: it.id, receivedQuantity: Number(receiveQtys[it.id] || 0) }))
      .filter((r) => r.receivedQuantity > 0);
    if (payload.length === 0) { setError('Enter at least one received quantity'); return; }
    await receivePurchaseOrder(businessId, po.id, payload);
    setReceivingId(null);
    setReceiveQtys({});
    reload();
    listIngredients(businessId).then(setIngredients);
  }

  function toggleHistory(poId: string) {
    if (historyId === poId) { setHistoryId(null); return; }
    setHistoryId(poId);
    listPurchaseOrderReceipts(businessId, poId).then(setReceipts).catch(() => setReceipts([]));
  }

  return (
    <Section title={t('Purchase Orders')} action={
      <button type="button" onClick={() => setShowNew((s) => !s)} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90">
        {t('+ New purchase order')}
      </button>
    }>
      {showNew && (
        <form onSubmit={handleCreate} className="space-y-3 rounded-lg border border-ink-line p-4">
          <Field label={t('Supplier (optional)')}>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory">
              <option value="">{t('None')}</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}{!s.email ? ` (${t('no email on file')})` : ''}</option>)}
            </select>
            {supplierId && (
              suppliers.find((s) => s.id === supplierId)?.email
                ? <p className="mt-1 text-xs text-success">{t('This order will be emailed automatically once placed.')}</p>
                : <p className="mt-1 text-xs text-warning">{t('No email on file for this supplier - add one on their profile to send orders automatically.')}</p>
            )}
          </Field>
          {items.map((item, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <select
                value={item.ingredientId}
                onChange={(e) => setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, ingredientId: e.target.value } : it))}
                className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory"
              >
                <option value="">{t('Select ingredient...')}</option>
                {ingredients.map((ing) => <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>)}
              </select>
              <input
                type="number" placeholder={t('Qty')} onFocus={(e) => e.target.select()}
                value={item.quantity}
                onChange={(e) => setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, quantity: e.target.value } : it))}
                className="w-24 rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory"
              />
              <input
                type="number" placeholder={`${t('Cost')}/${t('Unit')} AED`} onFocus={(e) => e.target.select()}
                value={item.unitCostAed}
                onChange={(e) => setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, unitCostAed: e.target.value } : it))}
                className="w-36 rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory"
              />
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" onClick={() => setItems((prev) => [...prev, { ingredientId: '', quantity: '', unitCostAed: '' }])} className="text-sm text-brass hover:underline">
              {t('+ Add item')}
            </button>
            <button type="submit" className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90">{t('Create order')}</button>
          </div>
          {error && <p className="text-base text-danger">{error}</p>}
        </form>
      )}
      {loadError && (
        <p className="rounded-lg border border-danger/40 bg-danger/5 px-3 py-2.5 text-base text-danger">{loadError}</p>
      )}
      <div className="space-y-3">
        {!loadError && orders.length === 0 && <p className="text-ivory-dim">{t('No purchase orders yet.')}</p>}
        {orders.map((po) => (
          <div key={po.id} className="rounded-xl border border-ink-line bg-ink-soft/40 px-4 py-3 transition-colors hover:border-brass/40">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-base text-ivory">{po.suppliers?.name || t('No supplier')} · <span className="text-brass">AED {po.total_cost_aed.toFixed(2)}</span></p>
              <div className="flex items-center gap-2">
                {po.status === 'partially_received' && (
                  <span className="rounded-full border border-warning/40 px-2 py-0.5 text-xs font-medium text-warning">{t('Partially received')}</span>
                )}
                {po.status === 'received' && (
                  <span className="rounded-full border border-success/40 px-2 py-0.5 text-xs font-medium text-success">{t('Received')}</span>
                )}
                {(po.status === 'pending' || po.status === 'partially_received') && (
                  <>
                    <button type="button" onClick={() => handleReceiveAll(po.id)} className="rounded-lg bg-brass px-3 py-1.5 text-sm font-medium text-ink">
                      {t('Receive all outstanding')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setReceivingId(receivingId === po.id ? null : po.id)}
                      className="rounded-lg border border-ink-line px-3 py-1.5 text-sm text-ivory-dim hover:text-ivory"
                    >
                      {t('Receive partially...')}
                    </button>
                  </>
                )}
                {(po.status === 'partially_received' || po.status === 'received') && (
                  <button
                    type="button"
                    onClick={() => toggleHistory(po.id)}
                    className="rounded-lg border border-ink-line px-3 py-1.5 text-sm text-ivory-dim hover:text-ivory"
                  >
                    {historyId === po.id ? t('Hide history') : t('Receive history')}
                  </button>
                )}
              </div>
            </div>
            <p className="mt-1 text-sm text-ivory-dim">
              {po.purchase_order_items.map((it) => {
                const remaining = it.quantity - (it.received_quantity || 0);
                return `${it.quantity} ${it.ingredients?.unit || ''} ${it.ingredients?.name || ''}${remaining < it.quantity && remaining > 0 ? ` (${remaining} ${t('outstanding')})` : ''}`;
              }).join(', ')}
            </p>
            {historyId === po.id && (
              <div className="mt-3 space-y-2 rounded-lg border border-ink-line bg-ink p-3">
                {receipts.length === 0 && <p className="text-sm text-ivory-dim">{t('Loading...')}</p>}
                {receipts.map((r) => (
                  <div key={r.id} className="rounded-lg border border-ink-line px-3 py-2 text-sm">
                    <p className="text-ivory">
                      {new Date(r.created_at).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      {' · '}
                      <span className={r.is_partial ? 'text-warning' : 'text-success'}>{r.is_partial ? t('Partial receive') : t('Full receive')}</span>
                      {r.profiles?.name && ` · ${r.profiles.name}`}
                    </p>
                    <p className="mt-1 text-xs text-ivory-dim">
                      {r.items.map((i) => `${i.receivedNow} ${i.unit} ${i.name}${i.stillMissing > 0 ? ` (${i.stillMissing} ${t('still missing')})` : ''}`).join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {receivingId === po.id && (
              <div className="mt-3 space-y-2 rounded-lg border border-ink-line bg-ink p-3">
                {po.purchase_order_items.map((it) => {
                  const remaining = it.quantity - (it.received_quantity || 0);
                  if (remaining <= 0) return null;
                  return (
                    <div key={it.id} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-ivory-dim">{it.ingredients?.name} - {remaining} {it.ingredients?.unit} {t('outstanding')}</span>
                      <input
                        type="number" placeholder={t('Received qty')} onFocus={(e) => e.target.select()}
                        value={receiveQtys[it.id] || ''}
                        onChange={(e) => setReceiveQtys((prev) => ({ ...prev, [it.id]: e.target.value }))}
                        className="w-32 rounded-lg border border-ink-line bg-ink-soft px-3 py-1.5 text-sm text-ivory"
                      />
                    </div>
                  );
                })}
                {error && <p className="text-xs text-danger">{error}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => handleReceivePartial(po)} className="rounded-lg bg-brass px-3 py-1.5 text-sm font-medium text-ink">{t('Confirm receipt')}</button>
                  <button type="button" onClick={() => { setReceivingId(null); setReceiveQtys({}); }} className="text-sm text-ivory-dim">{t('Cancel')}</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

// =========================================================================
// Warehouses tab - merged in from what used to be a separate page/route.
// Separate storage locations for this business (main kitchen, walk-in
// freezer, dry store, etc). Stock still totals the same across all of
// them for existing low-stock alerts and reports.
// =========================================================================
const WAREHOUSE_TYPE_LABEL: Record<string, string> = {
  central: 'Central',
  kitchen: 'Kitchen',
  dry_store: 'Dry store',
  cold_store: 'Cold store',
  general: 'General',
};

function WarehousesTab({ businessId }: { businessId: string }) {
  const { t } = useT();
  const confirm = useConfirm();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [viewingStockFor, setViewingStockFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  function reload() {
    listWarehouses(businessId).then(setWarehouses).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(reload, [businessId]);

  async function handleDelete(warehouseId: string) {
    if (!(await confirm({ title: t('Delete warehouse?'), message: t('Delete this warehouse? Only possible if it has no stock left in it.'), confirmLabel: t('Delete'), danger: true }))) return;
    try {
      await deleteWarehouse(businessId, warehouseId);
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not delete');
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-base text-ivory-dim">
        {t('Separate storage locations for this business - a main kitchen, a walk-in freezer, a dry store, or anything else you track stock in individually. Stock still totals the same across all of them for your existing low-stock alerts and reports.')}
      </p>

      <Section title={t('Your locations')} action={<ActionButton onClick={() => setAdding((v) => !v)}>{adding ? t('Cancel') : t('Add warehouse')}</ActionButton>}>
        {adding && <AddWarehouseForm businessId={businessId} onSaved={() => { setAdding(false); reload(); }} />}
        {loading && <p className="text-ivory-dim">{t('Loading...')}</p>}
        <div className="space-y-2">
          {warehouses.map((w) => (
            <div key={w.id}>
              {editingId === w.id ? (
                <EditWarehouseForm
                  businessId={businessId}
                  warehouse={w}
                  onSaved={() => { setEditingId(null); reload(); }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex items-center justify-between rounded-lg border border-ink-line px-4 py-3">
                  <div>
                    <p className="text-base text-ivory">{w.name}</p>
                    <p className="text-sm text-ivory-dim">{WAREHOUSE_TYPE_LABEL[w.type] || w.type}{w.address && ` · ${w.address}`}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setViewingStockFor(viewingStockFor === w.id ? null : w.id)} className="text-sm text-brass hover:underline">
                      {viewingStockFor === w.id ? t('Hide stock') : t('View stock')}
                    </button>
                    <button type="button" onClick={() => setEditingId(w.id)} className="text-sm text-brass hover:underline">{t('Edit')}</button>
                    <button type="button" onClick={() => handleDelete(w.id)} className="text-sm text-danger hover:underline">{t('Delete')}</button>
                  </div>
                </div>
              )}
              {viewingStockFor === w.id && <WarehouseStockList businessId={businessId} warehouseId={w.id} />}
            </div>
          ))}
          {!loading && warehouses.length === 0 && <p className="text-ivory-dim">{t('No warehouses yet - everything is tracked as one combined total until you add one.')}</p>}
        </div>
      </Section>
    </div>
  );
}

function WarehouseStockList({ businessId, warehouseId }: { businessId: string; warehouseId: string }) {
  const { t } = useT();
  const [lines, setLines] = useState<WarehouseStockLine[] | null>(null);

  useEffect(() => {
    getWarehouseStock(businessId, warehouseId).then(setLines);
  }, [businessId, warehouseId]);

  return (
    <div className="mt-2 rounded-lg border border-ink-line/60 bg-ink-soft/40 p-3">
      {!lines && <p className="text-sm text-ivory-dim">{t('Loading...')}</p>}
      {lines && lines.length === 0 && <p className="text-sm text-ivory-dim">{t('Nothing stocked here yet.')}</p>}
      {lines && lines.length > 0 && (
        <div className="space-y-1">
          {lines.map((line, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-ivory">{line.ingredients.name}</span>
              <span className={Number(line.quantity) <= Number(line.ingredients.low_stock_threshold) && line.ingredients.low_stock_threshold > 0 ? 'text-warning' : 'text-ivory-dim'}>
                {line.quantity} {line.ingredients.unit}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EditWarehouseForm({ businessId, warehouse, onSaved, onCancel }: {
  businessId: string; warehouse: Warehouse; onSaved: () => void; onCancel: () => void;
}) {
  const { t } = useT();
  const [name, setName] = useState(warehouse.name);
  const [type, setType] = useState(warehouse.type);
  const [address, setAddress] = useState(warehouse.address);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!name) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await updateWarehouse(businessId, warehouse.id, { name, type, address });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-brass/30 bg-ink-soft p-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label={t('Name')}><input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} /></Field>
        <Field label={t('Type')}>
          <select value={type} onChange={(e) => setType(e.target.value as Warehouse['type'])} className={inputClass}>
            {Object.entries(WAREHOUSE_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
      </div>
      <div className="mt-2">
        <Field label={t('Address (optional)')}><input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} /></Field>
      </div>
      <div className="mt-3 flex gap-2">
        <PrimaryButton onClick={handleSave} loading={saving} type="button">{t('Save')}</PrimaryButton>
        <ActionButton onClick={onCancel} type="button">{t('Cancel')}</ActionButton>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

function AddWarehouseForm({ businessId, onSaved }: { businessId: string; onSaved: () => void }) {
  const { t } = useT();
  const [name, setName] = useState('');
  const [type, setType] = useState('general');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!name) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await createWarehouse(businessId, { name, type, address });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-ink-line p-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label={t('Name')}><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Walk-in freezer" className={inputClass} /></Field>
        <Field label={t('Type')}>
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
            {Object.entries(WAREHOUSE_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
      </div>
      <div className="mt-2">
        <Field label={t('Address (optional)')}><input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} /></Field>
      </div>
      <div className="mt-3">
        <PrimaryButton onClick={handleSave} loading={saving} type="button">{t('Add warehouse')}</PrimaryButton>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

// =========================================================================
// Stock Transfers tab - merged in from what used to be a separate
// page/route. Move stock between this business's own warehouses, and
// receive whatever it's been allocated from an organization-level
// purchase order (see poAllocationController.js).
// =========================================================================
const TRANSFER_STATUS_STYLE: Record<string, string> = {
  requested: 'border-ink-line text-ivory-dim',
  approved: 'border-brass/40 text-brass',
  in_transit: 'border-brass/40 text-brass',
  received: 'border-success/40 text-success',
  cancelled: 'border-danger/40 text-danger',
};

function StockTransfersTab({ businessId }: { businessId: string }) {
  const { t } = useT();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [transferIngredients, setTransferIngredients] = useState<Ingredient[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [allocations, setAllocations] = useState<PoAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTransfer, setShowNewTransfer] = useState(false);

  function reload() {
    Promise.all([
      listWarehouses(businessId),
      listIngredients(businessId),
      listStockTransfers(businessId),
      listPoAllocations(businessId, false),
    ]).then(([w, i, tr, alloc]) => {
      setWarehouses(w);
      setTransferIngredients(i);
      setTransfers(tr);
      setAllocations(alloc);
    }).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(reload, [businessId]);

  async function handleAction(action: (bId: string, id: string) => Promise<unknown>, transferId: string) {
    try {
      await action(businessId, transferId);
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-base text-ivory-dim">
        {t('Move stock between your own warehouses, and receive whatever this business has been allocated from an organization-level purchase order.')}
      </p>

      {allocations.length > 0 && (
        <Section title={t('Incoming from your organization')}>
          <p className="text-sm text-ivory-dim">
            {t("Your share of a purchase order placed at the organization level - pick which of your own ingredients and warehouses each one restocks.")}
          </p>
          <div className="space-y-2">
            {allocations.map((a) => (
              <PoAllocationRow key={a.id} allocation={a} businessId={businessId} ingredients={transferIngredients} warehouses={warehouses} onReceived={reload} />
            ))}
          </div>
        </Section>
      )}

      <Section title={t('Transfers between your warehouses')} action={<ActionButton onClick={() => setShowNewTransfer((v) => !v)}>{showNewTransfer ? t('Cancel') : t('New transfer')}</ActionButton>}>
        {showNewTransfer && (
          <NewTransferForm businessId={businessId} warehouses={warehouses} ingredients={transferIngredients} onSaved={() => { setShowNewTransfer(false); reload(); }} />
        )}
        {loading && <p className="text-ivory-dim">{t('Loading...')}</p>}
        <div className="space-y-2">
          {transfers.map((tr) => (
            <div key={tr.id} className="rounded-lg border border-ink-line px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-base text-ivory">
                  {tr.from?.name || t('New delivery')} → {tr.to?.name}
                  <span className={`ms-2 rounded-full border px-2 py-0.5 text-xs ${TRANSFER_STATUS_STYLE[tr.status]}`}>{tr.status.replace('_', ' ')}</span>
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
