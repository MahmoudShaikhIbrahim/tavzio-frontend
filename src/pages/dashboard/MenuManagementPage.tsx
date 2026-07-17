import { useEffect, useState, type FormEvent, type ChangeEvent, useRef } from 'react';
import { useSession } from '../../hooks/useSession';
import {
  listMenuCategories, createMenuCategory, deleteMenuCategory,
  listMenuItems, createMenuItem, updateMenuItem, deleteMenuItem,
  listAddons, createAddon, deleteAddon,
} from '../../lib/authApi';
import { uploadBusinessFile } from '../../lib/supabaseClient';
import type { MenuCategory, MenuItem, MenuItemAddon } from '../../types';
import { Section, Field, inputClass, PrimaryButton, ActionButton } from '../../components/ui';

export default function MenuManagementPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);

  function reload() {
    if (!businessId) return;
    listMenuCategories(businessId).then(setCategories);
    listMenuItems(businessId).then(setItems);
  }

  useEffect(reload, [businessId]);

  if (!businessId) return null;

  return (
    <div className="space-y-6">
      <CategoriesSection businessId={businessId} categories={categories} onChange={reload} />
      <ItemsSection businessId={businessId} categories={categories} items={items} onChange={reload} />
    </div>
  );
}

function CategoriesSection({ businessId, categories, onChange }: {
  businessId: string; categories: MenuCategory[]; onChange: () => void;
}) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    await createMenuCategory(businessId, name);
    setName('');
    setSaving(false);
    onChange();
  }

  return (
    <Section title="Categories">
      <div className="space-y-1.5">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg border border-ink-line px-3.5 py-2 text-base">
            <span className="text-ivory">{c.name}</span>
            <ActionButton danger onClick={() => deleteMenuCategory(businessId, c.id).then(onChange)}>Remove</ActionButton>
          </div>
        ))}
        {categories.length === 0 && <p className="text-base text-ivory-dim">No categories yet — items can also exist without one.</p>}
      </div>
      <form onSubmit={handleAdd} className="flex gap-2 border-t border-ink-line pt-3">
        <input placeholder="e.g. Starters" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        <PrimaryButton disabled={saving}>{saving ? 'Adding...' : 'Add category'}</PrimaryButton>
      </form>
    </Section>
  );
}

function ItemsSection({ businessId, categories, items, onChange }: {
  businessId: string; categories: MenuCategory[]; items: MenuItem[]; onChange: () => void;
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <Section
      title="Items"
      action={
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90"
        >
          + Add item
        </button>
      }
    >
      {showForm && (
        <ItemForm
          businessId={businessId}
          categories={categories}
          onDone={() => { setShowForm(false); onChange(); }}
        />
      )}
      <div className="space-y-1.5">
        {items.map((item) => (
          <ItemRow key={item.id} item={item} businessId={businessId} categories={categories} onChange={onChange} />
        ))}
        {items.length === 0 && <p className="text-base text-ivory-dim">No items yet.</p>}
      </div>
    </Section>
  );
}

function ItemForm({ businessId, categories, existing, onDone }: {
  businessId: string; categories: MenuCategory[]; existing?: MenuItem; onDone: () => void;
}) {
  const [name, setName] = useState(existing?.name || '');
  const [description, setDescription] = useState(existing?.description || '');
  const [price, setPrice] = useState(existing?.price ?? 0);
  const [categoryId, setCategoryId] = useState(existing?.category_id || '');
  const [imageUrl, setImageUrl] = useState(existing?.image_url || '');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = { name, description, price, categoryId: categoryId || null, imageUrl };
    if (existing) {
      await updateMenuItem(businessId, existing.id, payload);
    } else {
      await createMenuItem(businessId, payload);
    }
    setSaving(false);
    onDone();
  }

  // Uploads immediately on file select - for an existing item, this saves
  // the URL right away; for a brand-new item, it's held in state and sent
  // along with the rest of the form on submit (the item doesn't have a
  // real id yet to scope the storage path to, so the file itself uploads
  // under a temp-safe path, then the URL travels with the create call).
  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    try {
      const pathId = existing?.id || `new-${Date.now()}`;
      const url = await uploadBusinessFile(businessId, file, `menu/${pathId}`);
      setImageUrl(url);
      if (existing) await updateMenuItem(businessId, existing.id, { imageUrl: url });
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-3 space-y-3 rounded-lg border border-ink-line p-3">
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-ink-line bg-ink">
          {imageUrl && <img src={imageUrl} alt="" className="h-full w-full object-cover" />}
        </div>
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={saving}
          className="rounded-lg border border-brass/40 px-3.5 py-2 text-base text-brass hover:bg-brass/10 disabled:opacity-50">
          {imageUrl ? 'Change photo' : 'Add photo'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name"><input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} /></Field>
        <Field label="Price"><input type="number" step="0.01" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} className={inputClass} /></Field>
      </div>
      <Field label="Description">
        <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
      </Field>
      <Field label="Category">
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
          <option value="">No category</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <PrimaryButton disabled={saving}>{saving ? 'Saving...' : existing ? 'Save changes' : 'Add item'}</PrimaryButton>
    </form>
  );
}

function ItemRow({ item, businessId, categories, onChange }: {
  item: MenuItem; businessId: string; categories: MenuCategory[]; onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [showAddons, setShowAddons] = useState(false);

  if (editing) {
    return <ItemForm businessId={businessId} categories={categories} existing={item} onDone={() => { setEditing(false); onChange(); }} />;
  }

  return (
    <div className="rounded-lg border border-ink-line">
      <div className="flex items-center justify-between px-3.5 py-2.5 text-base">
        <div className="flex items-center gap-3">
          {item.image_url && (
            <img src={item.image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
          )}
          <div>
            <span className="text-ivory">{item.name}</span>
            <span className="ml-2 text-ivory-dim">{item.price.toFixed(2)}</span>
            {!item.is_available && <span className="ml-2 text-base text-red-400">unavailable</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ActionButton onClick={() => updateMenuItem(businessId, item.id, { isAvailable: !item.is_available }).then(onChange)}>
            {item.is_available ? 'Mark unavailable' : 'Mark available'}
          </ActionButton>
          <ActionButton onClick={() => setShowAddons((s) => !s)}>Add-ons</ActionButton>
          <ActionButton onClick={() => setEditing(true)}>Edit</ActionButton>
          <ActionButton danger onClick={() => deleteMenuItem(businessId, item.id).then(onChange)}>Remove</ActionButton>
        </div>
      </div>
      {showAddons && <AddonManager businessId={businessId} itemId={item.id} />}
    </div>
  );
}

function AddonManager({ businessId, itemId }: { businessId: string; itemId: string }) {
  const [addons, setAddons] = useState<MenuItemAddon[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);

  function reload() {
    listAddons(businessId, itemId).then(setAddons);
  }
  useEffect(reload, [businessId, itemId]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createAddon(businessId, itemId, name.trim(), price);
    setName(''); setPrice(0);
    reload();
  }

  return (
    <div className="space-y-2 border-t border-ink-line p-3">
      {addons.map((a) => (
        <div key={a.id} className="flex items-center justify-between text-base">
          <span className="text-ivory-dim">{a.name} — +{a.price.toFixed(2)}</span>
          <ActionButton danger onClick={() => deleteAddon(businessId, itemId, a.id).then(reload)}>Remove</ActionButton>
        </div>
      ))}
      {addons.length === 0 && <p className="text-base text-ivory-dim">No add-ons yet.</p>}
      <form onSubmit={handleAdd} className="flex gap-2 pt-1">
        <input placeholder="e.g. Extra cheese" value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} flex-1`} />
        <input type="number" step="0.01" min={0} placeholder="Price" value={price} onChange={(e) => setPrice(Number(e.target.value))} className={`${inputClass} w-24`} />
        <PrimaryButton>Add</PrimaryButton>
      </form>
    </div>
  );
}
