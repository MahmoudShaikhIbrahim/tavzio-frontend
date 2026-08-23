import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import { listWarehouses, createWarehouse, updateWarehouse, deleteWarehouse, getWarehouseStock } from '../../lib/authApi';
import type { Warehouse, WarehouseStockLine } from '../../types';
import { Section, Field, inputClass, PrimaryButton, ActionButton } from '../../components/ui';

const TYPE_LABEL: Record<string, string> = {
  central: 'Central',
  kitchen: 'Kitchen',
  dry_store: 'Dry store',
  cold_store: 'Cold store',
  general: 'General',
};

export default function WarehousesPage() {
  const { user } = useSession();
  const { t } = useT();
  const businessId = user?.business_id;
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [viewingStockFor, setViewingStockFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  function reload() {
    if (businessId) listWarehouses(businessId).then(setWarehouses).finally(() => setLoading(false));
  }
  useEffect(reload, [businessId]);

  async function handleDelete(warehouseId: string) {
    if (!businessId) return;
    if (!confirm(t('Delete this warehouse? Only possible if it has no stock left in it.'))) return;
    try {
      await deleteWarehouse(businessId, warehouseId);
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not delete');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ivory">{t('Warehouses')}</h1>
        <p className="mt-1 text-base text-ivory-dim">
          {t('Separate storage locations for this business - a main kitchen, a walk-in freezer, a dry store, or anything else you track stock in individually. Stock still totals the same across all of them for your existing low-stock alerts and reports.')}
        </p>
      </div>

      <Section title={t('Your locations')} action={<ActionButton onClick={() => setAdding((v) => !v)}>{adding ? t('Cancel') : t('Add warehouse')}</ActionButton>}>
        {adding && businessId && <AddWarehouseForm businessId={businessId} onSaved={() => { setAdding(false); reload(); }} />}
        {loading && <p className="text-ivory-dim">{t('Loading...')}</p>}
        <div className="space-y-2">
          {warehouses.map((w) => (
            <div key={w.id}>
              {editingId === w.id ? (
                <EditWarehouseForm
                  businessId={businessId!}
                  warehouse={w}
                  onSaved={() => { setEditingId(null); reload(); }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex items-center justify-between rounded-lg border border-ink-line px-4 py-3">
                  <div>
                    <p className="text-base text-ivory">{w.name}</p>
                    <p className="text-sm text-ivory-dim">{TYPE_LABEL[w.type] || w.type}{w.address && ` · ${w.address}`}</p>
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
              {viewingStockFor === w.id && businessId && <WarehouseStockList businessId={businessId} warehouseId={w.id} />}
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
            {Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
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
            {Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
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
