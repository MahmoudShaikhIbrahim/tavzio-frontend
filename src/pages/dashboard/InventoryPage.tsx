import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import {
  listIngredients, createIngredient, adjustStock,
  listSuppliers, createSupplier,
  listPurchaseOrders, createPurchaseOrder, receivePurchaseOrder,
} from '../../lib/authApi';
import type { Ingredient, Supplier, PurchaseOrder } from '../../types';
import { Section, Field, inputClass } from '../../components/ui';

const UNITS = ['g', 'kg', 'ml', 'l', 'piece'];

export default function InventoryPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [tab, setTab] = useState<'ingredients' | 'suppliers' | 'purchase-orders'>('ingredients');

  if (!businessId) return <p className="text-ivory-dim">Loading...</p>;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-ivory">Inventory</h1>
      <div className="flex gap-2 border-b border-ink-line">
        {(['ingredients', 'suppliers', 'purchase-orders'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-base ${tab === t ? 'border-b-2 border-brass text-brass' : 'text-ivory-dim hover:text-ivory'}`}
          >
            {t === 'ingredients' ? 'Ingredients' : t === 'suppliers' ? 'Suppliers' : 'Purchase Orders'}
          </button>
        ))}
      </div>
      {tab === 'ingredients' && <IngredientsTab businessId={businessId} />}
      {tab === 'suppliers' && <SuppliersTab businessId={businessId} />}
      {tab === 'purchase-orders' && <PurchaseOrdersTab businessId={businessId} />}
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

  return (
    <Section title="Ingredients" action={
      <button onClick={() => setShowAdd((s) => !s)} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90">
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
      <div className="space-y-2">
        {ingredients.map((ing) => {
          const low = ing.stock_qty <= ing.low_stock_threshold;
          return (
            <div key={ing.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-line px-4 py-3">
              <div>
                <p className="text-base text-ivory">{ing.name}</p>
                <p className={`text-sm ${low ? 'text-danger' : 'text-ivory-dim'}`}>
                  {ing.stock_qty} {ing.unit} in stock {low && '· low stock'} · AED {ing.cost_per_unit.toFixed(2)}/{ing.unit}
                </p>
              </div>
              {adjustingId === ing.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="+/- qty"
                    onFocus={(e) => e.target.select()}
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(e.target.value)}
                    className="w-28 rounded-lg border border-ink-line bg-ink px-3 py-1.5 text-base text-ivory"
                  />
                  <button onClick={() => handleAdjust(ing.id)} className="rounded-lg bg-brass px-3 py-1.5 text-sm font-medium text-ink">Apply</button>
                  <button onClick={() => setAdjustingId(null)} className="text-sm text-ivory-dim">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setAdjustingId(ing.id)} className="text-sm text-brass hover:underline">Adjust stock</button>
              )}
            </div>
          );
        })}
        {!loading && ingredients.length === 0 && <p className="text-ivory-dim">No ingredients yet.</p>}
      </div>
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
      <div className="space-y-2">
        {suppliers.map((s) => (
          <div key={s.id} className="rounded-lg border border-ink-line px-4 py-3">
            <p className="text-base text-ivory">{s.name}</p>
            <p className="text-sm text-ivory-dim">{[s.phone, s.email].filter(Boolean).join(' · ')}</p>
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

  async function handleReceive(id: string) {
    await receivePurchaseOrder(businessId, id);
    reload();
    listIngredients(businessId).then(setIngredients);
  }

  return (
    <Section title="Purchase Orders" action={
      <button onClick={() => setShowNew((s) => !s)} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90">
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
      <div className="space-y-2">
        {orders.map((po) => (
          <div key={po.id} className="rounded-lg border border-ink-line px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-base text-ivory">{po.suppliers?.name || 'No supplier'} · AED {po.total_cost_aed.toFixed(2)}</p>
              {po.status === 'pending' ? (
                <button onClick={() => handleReceive(po.id)} className="rounded-lg bg-brass px-3 py-1.5 text-sm font-medium text-ink">Mark received</button>
              ) : (
                <span className="text-sm text-success">Received</span>
              )}
            </div>
            <p className="text-sm text-ivory-dim">
              {po.purchase_order_items.map((it) => `${it.quantity} ${it.ingredients?.unit || ''} ${it.ingredients?.name || ''}`).join(', ')}
            </p>
          </div>
        ))}
        {orders.length === 0 && <p className="text-ivory-dim">No purchase orders yet.</p>}
      </div>
    </Section>
  );
}
