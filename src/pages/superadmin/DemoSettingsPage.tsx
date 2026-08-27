import { useEffect, useState } from 'react';
import {
  listDemoMenuItems, createDemoMenuItem, updateDemoMenuItem, deleteDemoMenuItem, importDemoMenuFromBusiness,
  listBusinesses, getDemoSettingsAdmin, updateDemoSettingsAdmin, type DemoMenuItem, type DemoSettings,
} from '../../lib/authApi';
import { uploadBusinessFile } from '../../lib/supabaseClient';
import type { AdminBusiness } from '../../types';
import { Section, Field, inputClass, PrimaryButton, ActionButton } from '../../components/ui';
import { useConfirm } from '../../components/ConfirmDialog';

// Manages the independent menu backing the public /demo page. Confirmed
// requirement: this is deliberately NOT a live link to any real
// business's menu - importing from Al Bait (or anywhere else) copies
// values in once. Deleting the real account later never touches what's
// here.
export default function DemoSettingsPage() {
  const confirm = useConfirm();
  const [items, setItems] = useState<DemoMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [businesses, setBusinesses] = useState<AdminBusiness[]>([]);
  const [importBusinessId, setImportBusinessId] = useState('');
  const [importResult, setImportResult] = useState('');
  const [demoSettings, setDemoSettings] = useState<DemoSettings | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  function reload() {
    setLoading(true);
    listDemoMenuItems().then(setItems).finally(() => setLoading(false));
  }
  useEffect(reload, []);
  useEffect(() => {
    listBusinesses({}).then((r) => setBusinesses(r.businesses)).catch(() => {});
    getDemoSettingsAdmin().then((s) => { setDemoSettings(s); setBusinessName(s.business_name); }).catch(() => {});
  }, []);

  async function handleSaveIdentity() {
    setSavingIdentity(true);
    const updated = await updateDemoSettingsAdmin({ businessName });
    setDemoSettings(updated);
    setSavingIdentity(false);
  }

  async function handleUploadCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const url = await uploadBusinessFile('platform', file, 'demo-cover');
      const updated = await updateDemoSettingsAdmin({ coverImageUrl: url });
      setDemoSettings(updated);
    } finally {
      setUploadingCover(false);
    }
  }

  async function handleImport() {
    if (!importBusinessId) return;
    setImporting(true);
    setImportResult('');
    try {
      const res = await importDemoMenuFromBusiness(importBusinessId);
      setImportResult(res.message);
      reload();
    } catch (e) {
      setImportResult(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  async function handleToggleEnabled(item: DemoMenuItem) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, enabled: !i.enabled } : i)));
    await updateDemoMenuItem(item.id, { enabled: !item.enabled }).catch(reload);
  }

  async function handleDelete(itemId: string) {
    if (!(await confirm({ title: 'Remove item?', message: 'Remove this item from the demo menu?', confirmLabel: 'Remove', danger: true }))) return;
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    await deleteDemoMenuItem(itemId).catch(reload);
  }

  const grouped = items.reduce<Record<string, DemoMenuItem[]>>((acc, item) => {
    (acc[item.category] ||= []).push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ivory">Demo Settings</h1>
        <p className="mt-1 text-base text-ivory-dim">
          Controls the menu shown on the public marketing demo (tavzio.ae/demo). Independent of any real
          business's actual menu - deleting a real account never affects this.
        </p>
      </div>

      <Section title="Business Identity">
        <p className="text-base text-ivory-dim">
          The name and cover photo shown on the demo phone at tavzio.ae/demo - the actual identity a visitor sees, not a placeholder.
        </p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end">
          <Field label="Business name">
            <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClass} />
          </Field>
          <button type="button" onClick={handleSaveIdentity} disabled={savingIdentity} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
            {savingIdentity ? 'Saving...' : 'Save name'}
          </button>
        </div>
        <div className="mt-4">
          <p className="mb-1.5 text-base text-ivory-dim">Cover photo</p>
          {demoSettings?.cover_image_url && (
            <img src={demoSettings.cover_image_url} alt="" className="mb-2 h-24 w-40 rounded-lg object-cover" />
          )}
          <input type="file" accept="image/*" onChange={handleUploadCover} disabled={uploadingCover} className="text-sm text-ivory-dim" />
          {uploadingCover && <p className="mt-1 text-sm text-ivory-dim">Uploading...</p>}
        </div>
      </Section>

      <Section title="Import from a real business">
        <p className="text-sm text-ivory-dim">
          Copies a business's current available menu items into the demo as independent rows (name, description,
          price, image, category). This is a one-time copy, not a live sync - re-running it adds more items rather
          than updating existing ones.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Source business">
            <select value={importBusinessId} onChange={(e) => setImportBusinessId(e.target.value)} className={`${inputClass} w-64`}>
              <option value="">Select a business...</option>
              {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <PrimaryButton onClick={handleImport} loading={importing} disabled={!importBusinessId}>
            Import menu
          </PrimaryButton>
        </div>
        {importResult && <p className="text-sm text-ivory-dim">{importResult}</p>}
      </Section>

      <Section title="Demo menu items" action={<ActionButton onClick={() => setAdding(!adding)}>{adding ? 'Cancel' : 'Add item'}</ActionButton>}>
        {adding && <AddItemForm onSaved={() => { setAdding(false); reload(); }} />}
        {loading && <p className="text-ivory-dim">Loading...</p>}
        {!loading && Object.entries(grouped).map(([category, categoryItems]) => (
          <div key={category} className="space-y-2">
            <p className="text-sm uppercase tracking-wide text-brass">{category}</p>
            {categoryItems.map((item) => (
              <DemoItemRow key={item.id} item={item} onToggleEnabled={() => handleToggleEnabled(item)} onDelete={() => handleDelete(item.id)} onSaved={reload} />
            ))}
          </div>
        ))}
        {!loading && items.length === 0 && <p className="text-ivory-dim">No demo items yet - import from a real business or add items manually.</p>}
      </Section>
    </div>
  );
}

function DemoItemRow({ item, onToggleEnabled, onDelete, onSaved }: {
  item: DemoMenuItem; onToggleEnabled: () => void; onDelete: () => void; onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description);
  const [priceAed, setPriceAed] = useState(String(item.price_aed));
  const [imageUrl, setImageUrl] = useState(item.image_url);
  const [category, setCategory] = useState(item.category);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateDemoMenuItem(item.id, { name, description, priceAed: Number(priceAed), imageUrl, category });
      setEditing(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-brass/30 p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} /></Field>
          <Field label="Category"><input value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass} /></Field>
          <Field label="Price (AED)"><input type="number" value={priceAed} onFocus={(e) => e.target.select()} onChange={(e) => setPriceAed(e.target.value)} className={inputClass} /></Field>
          <Field label="Image URL"><input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className={inputClass} /></Field>
        </div>
        <div className="mt-2">
          <Field label="Description"><input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} /></Field>
        </div>
        <div className="mt-3 flex gap-2">
          <PrimaryButton onClick={handleSave} loading={saving}>Save</PrimaryButton>
          <ActionButton onClick={() => setEditing(false)}>Cancel</ActionButton>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-ink-line px-4 py-3">
      <div className="flex items-center gap-3">
        {item.image_url && <img src={item.image_url} alt="" className="h-10 w-10 rounded object-cover" />}
        <div>
          <p className={`text-base ${item.enabled ? 'text-ivory' : 'text-ivory-dim line-through'}`}>{item.name}</p>
          <p className="text-sm text-ivory-dim">AED {item.price_aed.toFixed(2)}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={onToggleEnabled} className="text-sm text-ivory-dim hover:text-ivory">
          {item.enabled ? 'Hide' : 'Show'}
        </button>
        <button type="button" onClick={() => setEditing(true)} className="text-sm text-brass hover:underline">Edit</button>
        <button type="button" onClick={onDelete} className="text-sm text-danger hover:underline">Delete</button>
      </div>
    </div>
  );
}

function AddItemForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priceAed, setPriceAed] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [category, setCategory] = useState('Main');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!name || !priceAed) { setError('Name and price are required'); return; }
    setSaving(true);
    setError('');
    try {
      await createDemoMenuItem({ name, description, priceAed: Number(priceAed), imageUrl, category });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-ink-line p-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} /></Field>
        <Field label="Category"><input value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass} /></Field>
        <Field label="Price (AED)"><input type="number" value={priceAed} onFocus={(e) => e.target.select()} onChange={(e) => setPriceAed(e.target.value)} className={inputClass} /></Field>
        <Field label="Image URL"><input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className={inputClass} /></Field>
      </div>
      <div className="mt-2">
        <Field label="Description"><input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} /></Field>
      </div>
      <PrimaryButton onClick={handleSave} loading={saving} type="button">Add item</PrimaryButton>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
