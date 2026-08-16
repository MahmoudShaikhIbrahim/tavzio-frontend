import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import {
  listIngredients, createIngredient, updateIngredient, deleteIngredient, adjustStock,
  recordWaste, getWasteReport, getLowStock, getInventoryValuation,
  getMenuItemFoodCost, getActualFoodCost,
  listSuppliers, createSupplier,
  listPurchaseOrders, createPurchaseOrder, receivePurchaseOrder,
} from '../../lib/authApi';
import type { Ingredient, Supplier, PurchaseOrder, LowStockIngredient, InventoryValuation, WasteReport, FoodCostReport, ActualFoodCostReport } from '../../types';
import { Section, Field, inputClass } from '../../components/ui';

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
  const businessId = user?.business_id;
  const [tab, setTab] = useState<'ingredients' | 'suppliers' | 'purchase-orders' | 'reorder' | 'waste' | 'food-cost'>('ingredients');

  if (!businessId) return <p className="text-ivory-dim">Loading...</p>;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-ivory">Inventory</h1>
      <div className="flex flex-wrap gap-2 border-b border-ink-line">
        {(['ingredients', 'reorder', 'waste', 'food-cost', 'suppliers', 'purchase-orders'] as const).map((t) => (
          <button type="button"
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-base ${tab === t ? 'border-b-2 border-brass text-brass' : 'text-ivory-dim hover:text-ivory'}`}
          >
            {t === 'ingredients' ? 'Ingredients' : t === 'suppliers' ? 'Suppliers' : t === 'purchase-orders' ? 'Purchase Orders' : t === 'reorder' ? 'Reorder & valuation' : t === 'waste' ? 'Waste' : 'Food Cost'}
          </button>
        ))}
      </div>
      {tab === 'ingredients' && <IngredientsTab businessId={businessId} />}
      {tab === 'suppliers' && <SuppliersTab businessId={businessId} />}
      {tab === 'purchase-orders' && <PurchaseOrdersTab businessId={businessId} />}
      {tab === 'reorder' && <ReorderTab businessId={businessId} />}
      {tab === 'waste' && <WasteTab businessId={businessId} />}
      {tab === 'food-cost' && <FoodCostTab businessId={businessId} />}
    </div>
  );
}

function IngredientsTab({ businessId }: { businessId: string }) {
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
    listIngredients(businessId).then(setIngredients).finally(() => setLoading(false));
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
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
    setError('');
    try {
      await deleteIngredient(businessId, id);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete ingredient');
    }
  }

  return (
    <Section title="Ingredients" action={
      <button type="button" onClick={() => setShowAdd((s) => !s)} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90">
        + Add ingredient
      </button>
    }>
      {showAdd && (
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-line p-4">
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
          </Field>
          <Field label="Unit">
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory">
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
          <Field label="Low-stock threshold">
            <input type="number" onFocus={(e) => e.target.select()} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className={`${inputClass} w-32`} />
          </Field>
          <button type="submit" className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90">Save</button>
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
                <p className="text-base text-ivory">{ing.name}</p>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${low ? 'border-danger/40 text-danger' : 'border-success/40 text-success'}`}>
                  {low ? 'Low stock' : 'In stock'}
                </span>
              </div>

              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink-line">
                <div
                  className={`h-full rounded-full transition-all ${low ? 'bg-danger' : 'bg-brass'}`}
                  style={{ width: `${fillPct}%` }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-sm text-ivory-dim">
                <span>{ing.stock_qty} {ing.unit} on hand</span>
                <span>AED {ing.cost_per_unit.toFixed(2)}/{ing.unit}</span>
              </div>

              {adjustingId === ing.id ? (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="+/- qty"
                    onFocus={(e) => e.target.select()}
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(e.target.value)}
                    className="w-24 rounded-lg border border-ink-line bg-ink px-3 py-1.5 text-base text-ivory"
                  />
                  <button type="button" onClick={() => handleAdjust(ing.id)} className="rounded-lg bg-brass px-3 py-1.5 text-sm font-medium text-ink">Apply</button>
                  <button type="button" onClick={() => setAdjustingId(null)} className="text-sm text-ivory-dim">Cancel</button>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-ink-line pt-3">
                  <button type="button" onClick={() => setAdjustingId(ing.id)} className="text-sm text-brass hover:underline">Adjust stock</button>
                  <button type="button" onClick={() => setWastingId(ing.id)} className="text-sm text-danger hover:underline">Record waste</button>
                  <button type="button" onClick={() => setEditingId(ing.id)} className="text-sm text-brass hover:underline">Edit</button>
                  <button type="button" onClick={() => handleDelete(ing.id, ing.name)} className="text-sm text-danger hover:underline">Delete</button>
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
        {!loading && ingredients.length === 0 && <p className="text-ivory-dim">No ingredients yet.</p>}
      </div>
    </Section>
  );
}

function IngredientEditForm({ businessId, ingredient, onDone, onCancel }: {
  businessId: string; ingredient: Ingredient; onDone: () => void; onCancel: () => void;
}) {
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
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-full rounded-lg border border-ink-line bg-ink px-3 py-2 text-sm text-ivory" />
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
          placeholder="Low stock at"
          className="flex-1 rounded-lg border border-ink-line bg-ink px-3 py-2 text-sm text-ivory"
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-brass px-3 py-1.5 text-sm font-medium text-ink disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-ivory-dim">Cancel</button>
      </div>
    </div>
  );
}


function WasteQuickForm({ businessId, ingredient, onDone, onCancel }: {
  businessId: string; ingredient: Ingredient; onDone: () => void; onCancel: () => void;
}) {
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
          type="number" placeholder={`Qty (${ingredient.unit})`} onFocus={(e) => e.target.select()}
          value={quantity} onChange={(e) => setQuantity(e.target.value)}
          className="w-28 rounded-lg border border-ink-line bg-ink px-3 py-1.5 text-sm text-ivory"
        />
        <select value={wasteCategory} onChange={(e) => setWasteCategory(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-1.5 text-sm text-ivory">
          {WASTE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <input
        value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)"
        className="w-full rounded-lg border border-ink-line bg-ink px-3 py-1.5 text-sm text-ivory"
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-danger/80 px-3 py-1.5 text-sm font-medium text-ink disabled:opacity-50">
          {saving ? 'Saving...' : 'Record waste'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-ivory-dim">Cancel</button>
      </div>
    </div>
  );
}

function ReorderTab({ businessId }: { businessId: string }) {
  const [lowStock, setLowStock] = useState<LowStockIngredient[]>([]);
  const [valuation, setValuation] = useState<InventoryValuation | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingPoFor, setCreatingPoFor] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  function reload() {
    setLoading(true);
    Promise.all([getLowStock(businessId), getInventoryValuation(businessId)])
      .then(([low, val]) => { setLowStock(low); setValuation(val); })
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
      setMessage(`Purchase order created for ${item.name} - see the Purchase Orders tab.`);
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
      <Section title="Stock valuation">
        <p className="text-sm text-ivory-dim">Total value of everything currently in stock, at each ingredient's weighted-average cost.</p>
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

      <Section title="Low stock - suggested reorders">
        {message && <p className="text-sm text-brass">{message}</p>}
        {lowStock.length === 0 && <p className="text-ivory-dim">Nothing is below its threshold right now.</p>}
        <div className="space-y-2">
          {lowStock.map((item) => (
            <div key={item.ingredientId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
              <div>
                <p className="text-base text-ivory">{item.name}</p>
                <p className="text-sm text-ivory-dim">
                  {item.stockQty} {item.unit} on hand · threshold {item.lowStockThreshold} {item.unit}
                  {item.supplierName ? ` · usual supplier: ${item.supplierName}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleQuickReorder(item)}
                disabled={creatingPoFor === item.ingredientId}
                className="rounded-lg bg-brass px-3 py-1.5 text-sm font-medium text-ink disabled:opacity-50"
              >
                {creatingPoFor === item.ingredientId ? 'Creating...' : `Reorder ${item.suggestedReorderQty} ${item.unit}`}
              </button>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function WasteTab({ businessId }: { businessId: string }) {
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<WasteReport | null>(null);
  const [loading, setLoading] = useState(true);

  function reload() {
    setLoading(true);
    getWasteReport(businessId, days).then(setReport).finally(() => setLoading(false));
  }
  useEffect(reload, [businessId, days]);

  return (
    <Section title="Waste report" action={
      <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-lg border border-ink-line bg-ink px-3 py-1.5 text-sm text-ivory">
        <option value={7}>Last 7 days</option>
        <option value={30}>Last 30 days</option>
        <option value={90}>Last 90 days</option>
      </select>
    }>
      {loading && <p className="text-ivory-dim">Loading...</p>}
      {!loading && report && (
        <>
          <p className="text-3xl text-danger">AED {report.totalCostAed.toFixed(2)}</p>
          <p className="text-sm text-ivory-dim">Total cost of waste over the last {report.days} days. Use "Record waste" on an ingredient in the Ingredients tab to add to this.</p>

          {report.byCategory.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ivory-dim/70">By reason</p>
              <div className="space-y-1">
                {report.byCategory.map((c) => (
                  <div key={c.category} className="flex justify-between text-sm">
                    <span className="text-ivory-dim">{WASTE_CATEGORIES.find((w) => w.value === c.category)?.label || c.category} ({c.quantityEvents})</span>
                    <span className="text-ivory">AED {c.costAed.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.byIngredient.length > 0 && (
            <div>
              <p className="mb-2 mt-4 text-xs font-medium uppercase tracking-wide text-ivory-dim/70">By ingredient</p>
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

          {report.events.length === 0 && <p className="text-ivory-dim">No waste recorded in this window.</p>}
        </>
      )}
    </Section>
  );
}

function FoodCostTab({ businessId }: { businessId: string }) {
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
    <Section title="Food cost" action={
      <div className="flex items-center gap-2">
        {view === 'actual' && (
          <select value={actualDays} onChange={(e) => setActualDays(Number(e.target.value))} className="rounded-lg border border-ink-line bg-ink px-3 py-1.5 text-sm text-ivory">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        )}
        <div className="flex rounded-lg border border-ink-line">
          <button type="button" onClick={() => setView('theoretical')} className={`px-3 py-1.5 text-sm ${view === 'theoretical' ? 'bg-brass text-ink' : 'text-ivory-dim'}`}>By menu</button>
          <button type="button" onClick={() => setView('actual')} className={`px-3 py-1.5 text-sm ${view === 'actual' ? 'bg-brass text-ink' : 'text-ivory-dim'}`}>Actual sales</button>
        </div>
      </div>
    }>
      {loading && <p className="text-ivory-dim">Loading...</p>}

      {!loading && view === 'theoretical' && report && (
        <>
          <p className="text-sm text-ivory-dim">
            What each dish's recipe costs at current ingredient prices, against what it sells for. Menu average across{' '}
            {report.items.length - report.untrackedCount} tracked item(s):{' '}
            <span className="text-brass">{report.avgFoodCostPct != null ? `${report.avgFoodCostPct}%` : 'n/a'}</span>
            {report.untrackedCount > 0 && <span className="text-warning"> · {report.untrackedCount} item(s) have no recipe yet, so their cost isn't tracked</span>}
          </p>
          <div className="space-y-1">
            {report.items.map((i) => (
              <div key={i.menuItemId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-line px-3 py-2 text-sm">
                <span className="text-ivory">{i.name}{!i.isAvailable ? ' (unavailable)' : ''}</span>
                {i.trackedByRecipe ? (
                  <span className="flex items-center gap-3 text-ivory-dim">
                    <span>Cost AED {i.recipeCostAed!.toFixed(2)}</span>
                    <span>Price AED {i.price.toFixed(2)}</span>
                    <span className={i.foodCostPct != null && i.foodCostPct > 35 ? 'text-danger' : 'text-success'}>{i.foodCostPct}% food cost</span>
                  </span>
                ) : (
                  <span className="text-xs text-warning">No recipe set - add one in Menu Management to track this item's cost</span>
                )}
              </div>
            ))}
            {report.items.length === 0 && <p className="text-ivory-dim">No menu items yet.</p>}
          </div>
        </>
      )}

      {!loading && view === 'actual' && actual && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-ink-line p-3">
              <p className="text-xs text-ivory-dim">Revenue</p>
              <p className="text-xl text-ivory">AED {actual.totalRevenueAed.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-ink-line p-3">
              <p className="text-xs text-ivory-dim">Cost of goods sold</p>
              <p className="text-xl text-ivory">AED {actual.totalCostAed.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-ink-line p-3">
              <p className="text-xs text-ivory-dim">Food cost %</p>
              <p className="text-xl text-brass">{actual.foodCostPct != null ? `${actual.foodCostPct}%` : 'n/a'}</p>
            </div>
          </div>
          {actual.untrackedRevenueAed > 0 && (
            <p className="text-sm text-warning">
              AED {actual.untrackedRevenueAed.toFixed(2)} of revenue came from items with no recipe set - excluded from the food cost % above so it isn't understated.
            </p>
          )}
          <div className="space-y-1">
            {actual.byItem.map((i) => (
              <div key={i.name} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-line px-3 py-2 text-sm">
                <span className="text-ivory">{i.name} × {i.quantitySold}</span>
                <span className="text-ivory-dim">
                  Revenue AED {i.revenueAed.toFixed(2)}
                  {i.trackedByRecipe ? ` · Cost AED ${i.costAed.toFixed(2)}` : ' · not tracked'}
                </span>
              </div>
            ))}
            {actual.byItem.length === 0 && <p className="text-ivory-dim">No sales in this window.</p>}
          </div>
        </>
      )}
    </Section>
  );
}

function SuppliersTab({ businessId }: { businessId: string }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  function reload() {
    listSuppliers(businessId).then(setSuppliers);
  }
  useEffect(reload, [businessId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createSupplier(businessId, { name, phone, email });
    setName(''); setPhone(''); setEmail('');
    reload();
  }

  return (
    <Section title="Suppliers">
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-line p-4">
        <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} /></Field>
        <Field label="Phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} /></Field>
        <Field label="Email"><input value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} /></Field>
        <button type="submit" className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90">Add</button>
      </form>
      <div className="grid gap-3 sm:grid-cols-2">
        {suppliers.map((s) => (
          <div key={s.id} className="rounded-xl border border-ink-line bg-ink-soft/40 px-4 py-3 transition-colors hover:border-brass/40">
            <p className="text-base text-ivory">{s.name}</p>
            <p className="text-sm text-ivory-dim">{[s.phone, s.email].filter(Boolean).join(' · ') || 'No contact details'}</p>
          </div>
        ))}
        {suppliers.length === 0 && <p className="text-ivory-dim">No suppliers yet.</p>}
      </div>
    </Section>
  );
}

function PurchaseOrdersTab({ businessId }: { businessId: string }) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState<{ ingredientId: string; quantity: string; unitCostAed: string }[]>([
    { ingredientId: '', quantity: '', unitCostAed: '' },
  ]);
  const [error, setError] = useState('');
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [receiveQtys, setReceiveQtys] = useState<Record<string, string>>({});

  function reload() {
    listPurchaseOrders(businessId).then(setOrders);
  }
  useEffect(() => {
    reload();
    listSuppliers(businessId).then(setSuppliers);
    listIngredients(businessId).then(setIngredients);
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

  return (
    <Section title="Purchase Orders" action={
      <button type="button" onClick={() => setShowNew((s) => !s)} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90">
        + New purchase order
      </button>
    }>
      {showNew && (
        <form onSubmit={handleCreate} className="space-y-3 rounded-lg border border-ink-line p-4">
          <Field label="Supplier (optional)">
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory">
              <option value="">None</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          {items.map((item, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <select
                value={item.ingredientId}
                onChange={(e) => setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, ingredientId: e.target.value } : it))}
                className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory"
              >
                <option value="">Select ingredient...</option>
                {ingredients.map((ing) => <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>)}
              </select>
              <input
                type="number" placeholder="Qty" onFocus={(e) => e.target.select()}
                value={item.quantity}
                onChange={(e) => setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, quantity: e.target.value } : it))}
                className="w-24 rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory"
              />
              <input
                type="number" placeholder="Cost/unit AED" onFocus={(e) => e.target.select()}
                value={item.unitCostAed}
                onChange={(e) => setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, unitCostAed: e.target.value } : it))}
                className="w-36 rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory"
              />
            </div>
          ))}
          <button type="button" onClick={() => setItems((prev) => [...prev, { ingredientId: '', quantity: '', unitCostAed: '' }])} className="text-sm text-brass hover:underline">
            + Add item
          </button>
          {error && <p className="text-base text-danger">{error}</p>}
          <button type="submit" className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90">Create order</button>
        </form>
      )}
      <div className="space-y-3">
        {orders.map((po) => (
          <div key={po.id} className="rounded-xl border border-ink-line bg-ink-soft/40 px-4 py-3 transition-colors hover:border-brass/40">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-base text-ivory">{po.suppliers?.name || 'No supplier'} · <span className="text-brass">AED {po.total_cost_aed.toFixed(2)}</span></p>
              <div className="flex items-center gap-2">
                {po.status === 'partially_received' && (
                  <span className="rounded-full border border-warning/40 px-2 py-0.5 text-xs font-medium text-warning">Partially received</span>
                )}
                {po.status === 'received' && (
                  <span className="rounded-full border border-success/40 px-2 py-0.5 text-xs font-medium text-success">Received</span>
                )}
                {(po.status === 'pending' || po.status === 'partially_received') && (
                  <>
                    <button type="button" onClick={() => handleReceiveAll(po.id)} className="rounded-lg bg-brass px-3 py-1.5 text-sm font-medium text-ink">
                      Receive all outstanding
                    </button>
                    <button
                      type="button"
                      onClick={() => setReceivingId(receivingId === po.id ? null : po.id)}
                      className="rounded-lg border border-ink-line px-3 py-1.5 text-sm text-ivory-dim hover:text-ivory"
                    >
                      Receive partially...
                    </button>
                  </>
                )}
              </div>
            </div>
            <p className="mt-1 text-sm text-ivory-dim">
              {po.purchase_order_items.map((it) => {
                const remaining = it.quantity - (it.received_quantity || 0);
                return `${it.quantity} ${it.ingredients?.unit || ''} ${it.ingredients?.name || ''}${remaining < it.quantity && remaining > 0 ? ` (${remaining} outstanding)` : ''}`;
              }).join(', ')}
            </p>
            {receivingId === po.id && (
              <div className="mt-3 space-y-2 rounded-lg border border-ink-line bg-ink p-3">
                {po.purchase_order_items.map((it) => {
                  const remaining = it.quantity - (it.received_quantity || 0);
                  if (remaining <= 0) return null;
                  return (
                    <div key={it.id} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-ivory-dim">{it.ingredients?.name} - {remaining} {it.ingredients?.unit} outstanding</span>
                      <input
                        type="number" placeholder="Received qty" onFocus={(e) => e.target.select()}
                        value={receiveQtys[it.id] || ''}
                        onChange={(e) => setReceiveQtys((prev) => ({ ...prev, [it.id]: e.target.value }))}
                        className="w-32 rounded-lg border border-ink-line bg-ink-soft px-3 py-1.5 text-sm text-ivory"
                      />
                    </div>
                  );
                })}
                {error && <p className="text-xs text-danger">{error}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => handleReceivePartial(po)} className="rounded-lg bg-brass px-3 py-1.5 text-sm font-medium text-ink">Confirm receipt</button>
                  <button type="button" onClick={() => { setReceivingId(null); setReceiveQtys({}); }} className="text-sm text-ivory-dim">Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {orders.length === 0 && <p className="text-ivory-dim">No purchase orders yet.</p>}
      </div>
    </Section>
  );
}
