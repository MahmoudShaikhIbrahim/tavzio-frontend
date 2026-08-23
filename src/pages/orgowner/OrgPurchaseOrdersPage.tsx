import { useEffect, useState } from 'react';
import { getMyOrganization, listOrgSuppliers, listOrgPurchaseOrders, createOrgPurchaseOrder, type Organization } from '../../lib/authApi';
import type { Supplier, OrgPurchaseOrder } from '../../types';
import { Section, Field, inputClass, PrimaryButton, ActionButton } from '../../components/ui';

interface DraftItem {
  itemName: string;
  itemUnit: string;
  quantity: number;
  unitCostAed: number;
  allocations: Record<string, number>; // businessId -> quantity
}

export default function OrgPurchaseOrdersPage() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<OrgPurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  function reload() {
    Promise.all([getMyOrganization(), listOrgSuppliers(), listOrgPurchaseOrders()])
      .then(([o, s, po]) => { setOrg(o); setSuppliers(s); setOrders(po); })
      .finally(() => setLoading(false));
  }
  useEffect(reload, []);

  const businesses = org?.businesses || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ivory">Purchase Orders</h1>
        <p className="mt-1 text-base text-ivory-dim">
          Buy once from a shared supplier, split across whichever locations actually need a share - each business
          receives only its own allocated quantity, into its own warehouse and its own ingredient.
        </p>
      </div>

      <Section title="Place an order" action={<ActionButton onClick={() => setCreating((v) => !v)}>{creating ? 'Cancel' : 'New purchase order'}</ActionButton>}>
        {creating && (
          <NewOrgPoForm suppliers={suppliers} businesses={businesses} onSaved={() => { setCreating(false); reload(); }} />
        )}
      </Section>

      <Section title="Order history">
        {loading && <p className="text-ivory-dim">Loading...</p>}
        <div className="space-y-3">
          {orders.map((po) => (
            <div key={po.id} className="rounded-lg border border-ink-line p-4">
              <p className="text-base text-ivory">
                {po.suppliers?.name || 'No supplier'} · AED {po.total_cost_aed.toFixed(2)} · {new Date(po.ordered_at).toLocaleDateString()}
              </p>
              <div className="mt-2 space-y-2">
                {(po.purchase_order_items || []).map((item) => (
                  <div key={item.id} className="rounded-lg border border-ink-line/60 px-3 py-2 text-sm">
                    <p className="text-ivory">{item.quantity} {item.item_unit} {item.item_name} · AED {item.unit_cost_aed}/unit</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {(item.purchase_order_allocations || []).map((a) => (
                        <span key={a.id} className={`rounded-full border px-2 py-0.5 text-xs ${a.received ? 'border-success/40 text-success' : 'border-ink-line text-ivory-dim'}`}>
                          {a.businesses?.name}: {a.quantity} {a.received ? '(received)' : '(pending)'}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!loading && orders.length === 0 && <p className="text-ivory-dim">No purchase orders yet.</p>}
        </div>
      </Section>
    </div>
  );
}

function NewOrgPoForm({ suppliers, businesses, onSaved }: {
  suppliers: Supplier[]; businesses: { id: string; name: string }[]; onSaved: () => void;
}) {
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState<DraftItem[]>([{ itemName: '', itemUnit: 'kg', quantity: 1, unitCostAed: 0, allocations: {} }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }
  function updateAllocation(index: number, businessId: string, quantity: number) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, allocations: { ...it.allocations, [businessId]: quantity } } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, { itemName: '', itemUnit: 'kg', quantity: 1, unitCostAed: 0, allocations: {} }]);
  }
  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (items.some((it) => !it.itemName || it.quantity <= 0)) {
      setError('Every item needs a name and a quantity greater than zero');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createOrgPurchaseOrder({
        supplierId: supplierId || null,
        items: items.map((it) => ({
          itemName: it.itemName,
          itemUnit: it.itemUnit,
          quantity: it.quantity,
          unitCostAed: it.unitCostAed,
          allocations: Object.entries(it.allocations)
            .filter(([, qty]) => qty > 0)
            .map(([businessId, quantity]) => ({ businessId, quantity })),
        })),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not place order');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-ink-line p-4">
      <Field label="Supplier">
        <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputClass}>
          <option value="">No specific supplier</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>

      {items.map((item, index) => {
        const allocatedTotal = Object.values(item.allocations).reduce((sum, q) => sum + (q || 0), 0);
        return (
          <div key={index} className="rounded-lg border border-ink-line/60 bg-ink-soft p-3">
            <div className="grid gap-2 sm:grid-cols-4">
              <Field label="Item"><input placeholder="e.g. Flour" value={item.itemName} onChange={(e) => updateItem(index, { itemName: e.target.value })} className={inputClass} /></Field>
              <Field label="Unit"><input placeholder="kg, l..." value={item.itemUnit} onChange={(e) => updateItem(index, { itemUnit: e.target.value })} className={inputClass} /></Field>
              <Field label="Quantity"><input type="number" min={0.01} step="0.01" onFocus={(e) => e.target.select()} value={item.quantity} onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })} className={inputClass} /></Field>
              <Field label="Unit cost (AED)"><input type="number" min={0} step="0.01" onFocus={(e) => e.target.select()} value={item.unitCostAed} onChange={(e) => updateItem(index, { unitCostAed: Number(e.target.value) })} className={inputClass} /></Field>
            </div>

            <p className="mt-3 text-sm text-ivory-dim">Split across businesses ({allocatedTotal} / {item.quantity} allocated)</p>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              {businesses.map((b) => (
                <label key={b.id} className="flex items-center justify-between gap-2 text-sm text-ivory">
                  {b.name}
                  <input
                    type="number" min={0} step="0.01" onFocus={(e) => e.target.select()}
                    value={item.allocations[b.id] || 0}
                    onChange={(e) => updateAllocation(index, b.id, Number(e.target.value))}
                    className="w-24 rounded-lg border border-ink-line bg-ink px-2 py-1.5 text-ivory"
                  />
                </label>
              ))}
              {businesses.length === 0 && <p className="text-sm text-ivory-dim">No locations linked to this organization yet.</p>}
            </div>

            {items.length > 1 && (
              <button type="button" onClick={() => removeItem(index)} className="mt-2 text-sm text-danger hover:underline">Remove item</button>
            )}
          </div>
        );
      })}

      <ActionButton onClick={addItem} type="button">+ Add another item</ActionButton>

      {error && <p className="text-sm text-danger">{error}</p>}
      <PrimaryButton onClick={handleSave} loading={saving} type="button">Place order</PrimaryButton>
    </div>
  );
}
