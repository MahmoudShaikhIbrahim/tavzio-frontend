import { useEffect, useState } from 'react';
import { listOrgSuppliers, createOrgSupplier, updateOrgSupplier, deleteOrgSupplier } from '../../lib/authApi';
import type { Supplier } from '../../types';
import { Section, Field, inputClass, PrimaryButton, ActionButton } from '../../components/ui';

// Confirmed design: one real supplier record shared across every
// member business, instead of each business separately re-entering
// the same real-world vendor's contact details.
export default function OrgSuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function reload() {
    listOrgSuppliers().then(setSuppliers).finally(() => setLoading(false));
  }
  useEffect(reload, []);

  async function handleDelete(id: string) {
    if (!confirm('Remove this supplier from the organization?')) return;
    try {
      await deleteOrgSupplier(id);
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not delete');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ivory">Suppliers</h1>
        <p className="mt-1 text-base text-ivory-dim">Shared across every location in this organization - one real contact, not a separate copy per business.</p>
      </div>

      <Section title="Organization suppliers" action={<ActionButton onClick={() => setAdding((v) => !v)}>{adding ? 'Cancel' : 'Add supplier'}</ActionButton>}>
        {adding && <AddSupplierForm onSaved={() => { setAdding(false); reload(); }} />}
        {loading && <p className="text-ivory-dim">Loading...</p>}
        <div className="space-y-2">
          {suppliers.map((s) => (
            editingId === s.id ? (
              <EditSupplierForm
                key={s.id}
                supplier={s}
                onSaved={() => { setEditingId(null); reload(); }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-ink-line px-4 py-3">
                <div>
                  <p className="text-base text-ivory">{s.name}</p>
                  <p className="text-sm text-ivory-dim">{[s.contact_name, s.phone, s.email].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setEditingId(s.id)} className="text-sm text-brass hover:underline">Edit</button>
                  <button type="button" onClick={() => handleDelete(s.id)} className="text-sm text-danger hover:underline">Delete</button>
                </div>
              </div>
            )
          ))}
          {!loading && suppliers.length === 0 && <p className="text-ivory-dim">No suppliers yet.</p>}
        </div>
      </Section>
    </div>
  );
}

function EditSupplierForm({ supplier, onSaved, onCancel }: { supplier: Supplier; onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState(supplier.name);
  const [contactName, setContactName] = useState(supplier.contact_name);
  const [phone, setPhone] = useState(supplier.phone);
  const [email, setEmail] = useState(supplier.email);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!name) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await updateOrgSupplier(supplier.id, { name, contactName, phone, email });
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
        <Field label="Supplier name"><input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} /></Field>
        <Field label="Contact name"><input value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputClass} /></Field>
        <Field label="Phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} /></Field>
        <Field label="Email"><input value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} /></Field>
      </div>
      <div className="mt-3 flex gap-2">
        <PrimaryButton onClick={handleSave} loading={saving} type="button">Save</PrimaryButton>
        <ActionButton onClick={onCancel} type="button">Cancel</ActionButton>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

function AddSupplierForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!name) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await createOrgSupplier({ name, contactName, phone, email });
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
        <Field label="Supplier name"><input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} /></Field>
        <Field label="Contact name"><input value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputClass} /></Field>
        <Field label="Phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} /></Field>
        <Field label="Email"><input value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} /></Field>
      </div>
      <div className="mt-3"><PrimaryButton onClick={handleSave} loading={saving} type="button">Add supplier</PrimaryButton></div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
