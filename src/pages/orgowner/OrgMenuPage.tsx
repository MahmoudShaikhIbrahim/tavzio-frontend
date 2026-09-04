import { useEffect, useState } from 'react';
import {
  getMyOrganization, listOrgMenuCategories, createOrgMenuCategory, createOrgMenuItem,
  updateOrgMenuItem, deleteOrgMenuItem, publishOrgMenu,
  type Organization, type OrgMenuCategory,
} from '../../lib/authApi';
import { Section, Field, inputClass } from '../../components/ui';
import { useConfirm } from '../../components/ConfirmDialog';

export default function OrgMenuPage() {
  const confirm = useConfirm();
  const [org, setOrg] = useState<Organization | null>(null);
  const [categories, setCategories] = useState<OrgMenuCategory[]>([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [showAddItem, setShowAddItem] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState(0);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState('');

  function reload() {
    getMyOrganization().then(setOrg);
    listOrgMenuCategories().then(setCategories);
  }
  useEffect(reload, []);

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryName.trim()) return;
    await createOrgMenuCategory(categoryName.trim());
    setCategoryName(''); setShowAddCategory(false);
    reload();
  }

  async function handleAddItem(e: React.FormEvent, categoryId: string) {
    e.preventDefault();
    if (!itemName.trim()) return;
    await createOrgMenuItem({ categoryId, name: itemName.trim(), price: itemPrice });
    setItemName(''); setItemPrice(0); setShowAddItem(null);
    reload();
  }

  async function handleDeleteItem(itemId: string) {
    if (!(await confirm({ title: 'Remove item?', message: 'Remove this item from the master menu? Locations that already published it keep their own copy.', confirmLabel: 'Remove', danger: true }))) return;
    await deleteOrgMenuItem(itemId);
    reload();
  }

  function toggleLocation(id: string) {
    setSelectedLocations((prev) => (prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]));
  }

  async function handlePublish() {
    if (selectedLocations.length === 0) return;
    setPublishing(true);
    setPublishResult('');
    try {
      const result = await publishOrgMenu(selectedLocations);
      setPublishResult(result.message);
    } catch (err) {
      setPublishResult(err instanceof Error ? err.message : 'Could not publish');
    } finally {
      setPublishing(false);
    }
  }

  if (!org) return <p className="text-ivory-dim">Loading...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ivory">Master Menu</h1>
        <p className="mt-1 text-base text-ivory-dim">
          Manage your menu once here, then publish it to any of your locations. Each location can still override
          its own price - publishing never overwrites a price a location has customized.
        </p>
      </div>

      <Section title="Publish to Locations" action={
        <button type="button" onClick={handlePublish} disabled={publishing || selectedLocations.length === 0} className="rounded-lg bg-brass px-4 py-2 text-sm font-medium text-ink hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
          {publishing ? 'Publishing...' : 'Publish'}
        </button>
      }>
        <div className="flex flex-wrap gap-3">
          {(org.businesses || []).map((b) => (
            <label key={b.id} className="flex items-center gap-2 text-base text-ivory">
              <input type="checkbox" checked={selectedLocations.includes(b.id)} onChange={() => toggleLocation(b.id)} className="accent-brass" />
              {b.name}
            </label>
          ))}
          {(org.businesses || []).length === 0 && <p className="text-ivory-dim">No locations linked yet.</p>}
        </div>
        {publishResult && <p className="text-sm text-ivory-dim">{publishResult}</p>}
      </Section>

      <Section title="Categories & Items" action={
        <button type="button" onClick={() => setShowAddCategory((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
          + Add category
        </button>
      }>
        {showAddCategory && (
          <form onSubmit={handleAddCategory} className="flex items-end gap-2">
            <Field label="Category name"><input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} required className={inputClass} /></Field>
            <button type="submit" className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">Add</button>
          </form>
        )}
        <div className="space-y-4">
          {categories.map((cat) => (
            <div key={cat.id} className="rounded-lg border border-ink-line p-4">
              <div className="flex items-center justify-between">
                <p className="text-base text-ivory">{cat.name}</p>
                <button type="button" onClick={() => setShowAddItem(showAddItem === cat.id ? null : cat.id)} className="text-sm text-brass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
                  + Add item
                </button>
              </div>
              {showAddItem === cat.id && (
                <form onSubmit={(e) => handleAddItem(e, cat.id)} className="mt-2 flex items-end gap-2">
                  <input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Item name" required className="rounded-lg border border-ink-line bg-ink px-3 py-1.5 text-sm text-ivory" />
                  <input type="number" min={0} value={itemPrice} onFocus={(ev) => ev.target.select()} onChange={(e) => setItemPrice(Number(e.target.value))} placeholder="Price" className="w-24 rounded-lg border border-ink-line bg-ink px-3 py-1.5 text-sm text-ivory" />
                  <button type="submit" className="rounded-lg bg-brass px-3 py-1.5 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">Add</button>
                </form>
              )}
              <div className="mt-2 space-y-1.5">
                {cat.organization_menu_items.map((item) => (
                  <ItemRow key={item.id} item={item} onSaved={reload} onDelete={() => handleDeleteItem(item.id)} />
                ))}
                {cat.organization_menu_items.length === 0 && <p className="text-sm text-ivory-dim">No items in this category yet.</p>}
              </div>
            </div>
          ))}
          {categories.length === 0 && <p className="text-ivory-dim">No categories yet - add one above.</p>}
        </div>
      </Section>
    </div>
  );
}

function ItemRow({ item, onSaved, onDelete }: { item: { id: string; name: string; price: number }; onSaved: () => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(item.price);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateOrgMenuItem(item.id, { price });
      setEditing(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center justify-between rounded border border-ink-line px-3 py-2 text-sm">
      <span className="text-ivory">{item.name}</span>
      {editing ? (
        <div className="flex items-center gap-2">
          <input type="number" min={0} value={price} onFocus={(e) => e.target.select()} onChange={(e) => setPrice(Number(e.target.value))} className="w-20 rounded border border-ink-line bg-ink px-2 py-1 text-sm text-ivory" />
          <button type="button" onClick={handleSave} disabled={saving} className="text-brass hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">Save</button>
          <button type="button" onClick={() => setEditing(false)} className="text-ivory-dim hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">Cancel</button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="text-ivory-dim">AED {item.price.toFixed(2)}</span>
          <button type="button" onClick={() => setEditing(true)} className="text-brass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">Edit</button>
          <button type="button" onClick={onDelete} className="text-danger hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">Delete</button>
        </div>
      )}
    </div>
  );
}
