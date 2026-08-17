import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import { listHotelOutlets, createHotelOutlet, updateHotelOutlet, deleteHotelOutlet, setHotelOutletItems, listMenuItems } from '../../lib/authApi';
import type { HotelOutlet, MenuItem } from '../../types';
import { Section, Field, inputClass, PrimaryButton } from '../../components/ui';

const OUTLET_TYPES = [
  { value: 'room_service', label: 'Room Service' },
  { value: 'bar', label: 'Bar' },
  { value: 'pool', label: 'Pool' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'other', label: 'Other' },
];

export default function HotelOutletsPage() {
  const { user } = useSession();
  const { t } = useT();
  const businessId = user?.business_id;
  const [outlets, setOutlets] = useState<HotelOutlet[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [outletType, setOutletType] = useState('room_service');
  const [location, setLocation] = useState('');
  const [openingHours, setOpeningHours] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingItemsFor, setEditingItemsFor] = useState<string | null>(null);

  function reload() {
    if (!businessId) return;
    listHotelOutlets(businessId).then(setOutlets);
    listMenuItems(businessId).then(setMenuItems);
  }
  useEffect(reload, [businessId]);

  if (!businessId) return null;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createHotelOutlet(businessId!, { name, outletType, location, openingHours });
      setName(''); setLocation(''); setOpeningHours(''); setShowAdd(false);
      reload();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(outlet: HotelOutlet) {
    await updateHotelOutlet(businessId!, outlet.id, { enabled: !outlet.enabled });
    reload();
  }

  async function handleDelete(outlet: HotelOutlet) {
    if (!confirm(`${t('Delete')} "${outlet.name}"? ${t('Guests will no longer be able to order from it.')}`)) return;
    await deleteHotelOutlet(businessId!, outlet.id);
    reload();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-ivory">{t('F&B Outlets & Services')}</h1>
        <p className="mt-1 text-base text-ivory-dim">
          {t('Room Service, bars, the pool, breakfast - each is a separate outlet guests order from, but all draw from the same menu items you manage under Menu Management. Add an item to multiple outlets at once, each with its own optional price.')}
        </p>
      </div>

      <Section title={t('Outlets')} action={
        <button type="button" onClick={() => setShowAdd((s) => !s)} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90">
          {t('+ Add outlet')}
        </button>
      }>
        {showAdd && (
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-line p-4">
            <Field label={t('Name')}><input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Rooftop Bar" className={inputClass} /></Field>
            <Field label={t('Type')}>
              <select value={outletType} onChange={(e) => setOutletType(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory">
                {OUTLET_TYPES.map((ot) => <option key={ot.value} value={ot.value}>{t(ot.label)}</option>)}
              </select>
            </Field>
            <Field label={t('Location')}><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ground Floor" className={inputClass} /></Field>
            <Field label={t('Hours')}><input value={openingHours} onChange={(e) => setOpeningHours(e.target.value)} placeholder="17:00–02:00" className={inputClass} /></Field>
            <div className="self-end"><PrimaryButton disabled={saving}>{saving ? t('Adding...') : t('Add')}</PrimaryButton></div>
          </form>
        )}

        <div className="space-y-3">
          {outlets.map((o) => (
            <div key={o.id} className="rounded-lg border border-ink-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-base text-ivory">{o.name} <span className="text-xs uppercase text-brass">{t(OUTLET_TYPES.find((ot) => ot.value === o.outlet_type)?.label || '')}</span></p>
                  <p className="text-sm text-ivory-dim">{[o.location, o.opening_hours].filter(Boolean).join(' · ')} · {o.hotel_outlet_items?.length || 0} {t('item(s)')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => handleToggle(o)} className={`text-sm ${o.enabled ? 'text-success' : 'text-ivory-dim'} hover:underline`}>
                    {o.enabled ? t('Enabled') : t('Disabled')}
                  </button>
                  <button type="button" onClick={() => setEditingItemsFor(editingItemsFor === o.id ? null : o.id)} className="text-sm text-brass hover:underline">
                    {editingItemsFor === o.id ? t('Close') : t('Edit items')}
                  </button>
                  <button type="button" onClick={() => handleDelete(o)} className="text-sm text-danger hover:underline">{t('Delete')}</button>
                </div>
              </div>
              {editingItemsFor === o.id && (
                <OutletItemPicker
                  businessId={businessId}
                  outlet={o}
                  menuItems={menuItems}
                  onSaved={() => { setEditingItemsFor(null); reload(); }}
                />
              )}
            </div>
          ))}
          {outlets.length === 0 && <p className="text-ivory-dim">{t('No outlets yet - add one above (e.g. "Room Service", "Pool Bar").')}</p>}
        </div>
      </Section>
    </div>
  );
}

function OutletItemPicker({ businessId, outlet, menuItems, onSaved }: {
  businessId: string; outlet: HotelOutlet; menuItems: MenuItem[]; onSaved: () => void;
}) {
  const { t } = useT();
  const [selected, setSelected] = useState<string[]>((outlet.hotel_outlet_items || []).map((i) => i.menu_item_id));
  const [saving, setSaving] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await setHotelOutletItems(businessId, outlet.id, selected);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-ink-line bg-ink-soft p-3">
      <p className="text-sm text-ivory-dim">{t('Check every item this outlet should offer.')}</p>
      <div className="grid max-h-64 grid-cols-2 gap-1.5 overflow-y-auto">
        {menuItems.map((item) => (
          <label key={item.id} className="flex items-center gap-2 text-sm text-ivory">
            <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} className="accent-brass" />
            {item.name}
          </label>
        ))}
        {menuItems.length === 0 && <p className="text-sm text-ivory-dim">{t('No menu items yet - add some under Menu Management first.')}</p>}
      </div>
      <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90 disabled:opacity-50">
        {saving ? t('Saving...') : t('Save items')}
      </button>
    </div>
  );
}
