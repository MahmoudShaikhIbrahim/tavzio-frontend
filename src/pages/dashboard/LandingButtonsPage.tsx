import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import {
  getBusiness, updateBusiness,
  listCustomButtons, createCustomButton, updateCustomButton, deleteCustomButton,
  listGuestServices, createGuestService, updateGuestService, deleteGuestService,
  GUEST_SERVICE_ROUTING_TYPES, type HotelGuestServiceRow,
  listServices, createService, updateService, deleteService,
  listServiceOptions, createServiceOption, deleteServiceOption,
} from '../../lib/authApi';
import { uploadBusinessFile } from '../../lib/supabaseClient';
import type { AdminBusiness, BusinessLinks, CustomButton, Service, ServiceOption } from '../../types';
import { LINK_META, LINK_ORDER } from '../../lib/linkMeta';
import { ICON_LIBRARY, getIcon, getIconColor } from '../../lib/iconLibrary';
import { requestTargetSectionsFor } from '../../lib/dashboardSections';
import { Section, Field, inputClass, ActionButton } from '../../components/ui';
import { useConfirm } from '../../components/ConfirmDialog';

export default function LandingButtonsPage() {
  const { user } = useSession();
  const { t } = useT();
  const businessId = user?.business_id;
  const [business, setBusiness] = useState<AdminBusiness | null>(null);
  const [tab, setTab] = useState<'landing' | 'guest-portal' | 'services'>('landing');

  useEffect(() => {
    if (businessId) getBusiness(businessId).then(setBusiness);
  }, [businessId]);

  if (!business || !businessId) return <p className="text-ivory-dim">Loading...</p>;

  const isHotel = business.category === 'hotel';

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-ink-line">
        {(['landing', ...(isHotel ? ['guest-portal'] as const : []), 'services'] as const).map((tabKey) => (
          <button type="button" key={tabKey} onClick={() => setTab(tabKey)} className={`px-4 py-2 text-base ${tab === tabKey ? 'border-b-2 border-brass text-brass' : 'text-ivory-dim hover:text-ivory'}`}>
            {tabKey === 'landing' ? t('Landing Page') : tabKey === 'guest-portal' ? t('Guest Portal Services') : t('Bookable Services')}
          </button>
        ))}
      </div>
      {tab === 'landing' && <LandingPageButtonsSection business={business} businessId={businessId} onSaved={setBusiness} />}
      {tab === 'guest-portal' && isHotel && <GuestPortalServicesSection businessId={businessId} />}
      {tab === 'services' && <BookableServicesSection businessId={businessId} />}
    </div>
  );
}

const ROUTING_TYPE_LABELS: Record<string, string> = {
  towels: 'Towels (housekeeping task)',
  turndown: 'Turndown (housekeeping task)',
  housekeeping: 'General housekeeping task',
  maintenance: 'Maintenance ticket',
  taxi: 'Guest request (taxi)',
  laundry: 'Guest request (laundry)',
  pool: 'Guest request (pool)',
  transportation: 'Guest request (transportation)',
  other: 'Guest request (general)',
};

// Every button a guest sees in the in-room portal's "Services" list -
// same customization Naser asked for on the customer-facing landing
// page buttons, applied to the other customer interface (the in-room
// NFC portal) that has its own separate button set.
function GuestPortalServicesSection({ businessId }: { businessId: string }) {
  const { t } = useT();
  const confirm = useConfirm();
  const [services, setServices] = useState<HotelGuestServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    listGuestServices(businessId).then(setServices).finally(() => setLoading(false));
  }
  useEffect(reload, [businessId]);

  async function handleReorder(id: string, direction: -1 | 1) {
    const sorted = [...services].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((s) => s.id === id);
    const swapWith = sorted[idx + direction];
    if (!swapWith) return;
    const aId = sorted[idx].id;
    const aOrder = sorted[idx].sort_order;
    const bId = swapWith.id;
    const bOrder = swapWith.sort_order;
    setServices((prev) => prev.map((s) => {
      if (s.id === aId) return { ...s, sort_order: bOrder };
      if (s.id === bId) return { ...s, sort_order: aOrder };
      return s;
    }));
    try {
      await Promise.all([
        updateGuestService(businessId, aId, { sortOrder: bOrder }),
        updateGuestService(businessId, bId, { sortOrder: aOrder }),
      ]);
    } catch {
      reload();
    }
  }

  async function handleToggleEnabled(s: HotelGuestServiceRow) {
    setServices((prev) => prev.map((x) => (x.id === s.id ? { ...x, enabled: !x.enabled } : x)));
    try {
      await updateGuestService(businessId, s.id, { enabled: !s.enabled });
    } catch {
      reload();
    }
  }

  async function handleDelete(id: string, label: string) {
    if (!(await confirm({ title: t('Remove item?'), message: `${t('Remove')} "${label}" ${t('from the guest portal?')}`, confirmLabel: t('Remove'), danger: true }))) return;
    await deleteGuestService(businessId, id);
    reload();
  }

  const sorted = [...services].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <Section title={t('Guest Portal Services')} action={
      <button type="button" onClick={() => setShowAdd((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">{t('+ Add service')}</button>
    }>
      <p className="text-sm text-ivory-dim">
        {t('These are the buttons a guest sees under "Services" in the in-room NFC portal (Extra towels, Housekeeping, and so on) - rename, reorder, disable, or add your own. Each one routes to a specific place internally (housekeeping, maintenance, or a general staff request), which you pick when adding it.')}
      </p>
      {showAdd && <GuestServiceForm businessId={businessId} onDone={() => { setShowAdd(false); reload(); }} />}
      {loading && <p className="text-ivory-dim">Loading...</p>}
      <div className="space-y-2">
        {sorted.map((s, i) => (
          editingId === s.id ? (
            <GuestServiceForm key={s.id} businessId={businessId} existing={s} onDone={() => { setEditingId(null); reload(); }} onCancel={() => setEditingId(null)} />
          ) : (
            <div key={s.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 ${s.enabled ? 'border-ink-line' : 'border-ink-line opacity-50'}`}>
              <div>
                <p className="text-base text-ivory">{s.label}</p>
                <p className="text-sm text-ivory-dim">
                  {t(ROUTING_TYPE_LABELS[s.routing_type] || s.routing_type)}
                  {s.options.length > 0 && ` · options: ${s.options.join(', ')}`}
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <button type="button" onClick={() => handleReorder(s.id, -1)} disabled={i === 0} className="text-ivory-dim hover:text-ivory disabled:opacity-30">↑</button>
                <button type="button" onClick={() => handleReorder(s.id, 1)} disabled={i === sorted.length - 1} className="text-ivory-dim hover:text-ivory disabled:opacity-30">↓</button>
                <button type="button" onClick={() => handleToggleEnabled(s)} className="text-ivory-dim hover:text-ivory">
                  {s.enabled ? t('Disable') : t('Enable')}
                </button>
                <button type="button" onClick={() => setEditingId(s.id)} className="text-brass hover:underline">{t('Edit')}</button>
                <button type="button" onClick={() => handleDelete(s.id, s.label)} className="text-danger hover:underline">{t('Delete')}</button>
              </div>
            </div>
          )
        ))}
        {!loading && services.length === 0 && <p className="text-ivory-dim">{t('No services yet.')}</p>}
      </div>
    </Section>
  );
}

function GuestServiceForm({ businessId, existing, onDone, onCancel }: {
  businessId: string; existing?: HotelGuestServiceRow; onDone: () => void; onCancel?: () => void;
}) {
  const { t } = useT();
  const [label, setLabel] = useState(existing?.label || '');
  const [routingType, setRoutingType] = useState(existing?.routing_type || 'other');
  const [optionsText, setOptionsText] = useState((existing?.options || []).join(', '));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    setError('');
    const options = optionsText.split(',').map((o) => o.trim()).filter(Boolean);
    try {
      if (existing) {
        await updateGuestService(businessId, existing.id, { label: label.trim(), routingType, options });
      } else {
        await createGuestService(businessId, { label: label.trim(), routingType, options });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this service');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-3 max-w-xl space-y-3 rounded-lg border border-brass/40 bg-ink-soft p-4">
      <Field label={t('Label (what the guest sees)')}>
        <input required value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Spa Booking" className={inputClass} />
      </Field>
      <Field label={t('Routes to')}>
        <select value={routingType} onChange={(e) => setRoutingType(e.target.value)} className={inputClass}>
          {GUEST_SERVICE_ROUTING_TYPES.map((rt) => <option key={rt} value={rt}>{t(ROUTING_TYPE_LABELS[rt] || rt)}</option>)}
        </select>
      </Field>
      <Field label={t('Sub-options (comma-separated, optional)')}>
        <input value={optionsText} onChange={(e) => setOptionsText(e.target.value)} placeholder="e.g. Massage, Facial, Manicure" className={inputClass} />
      </Field>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
          {saving ? t('Saving...') : existing ? t('Save changes') : t('Add service')}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="text-sm text-ivory-dim">{t('Cancel')}</button>}
      </div>
    </form>
  );
}

function LandingPageButtonsSection({ business, businessId, onSaved }: { business: AdminBusiness; businessId: string; onSaved: (b: AdminBusiness) => void }) {
  const { t } = useT();
  const [links, setLinks] = useState<BusinessLinks>(business.links);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [extraButtons, setExtraButtons] = useState<CustomButton[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);

  function reloadExtras() {
    listCustomButtons(businessId).then(setExtraButtons);
  }
  useEffect(reloadExtras, [businessId]);

  function updateValue(key: keyof BusinessLinks, value: string) {
    setLinks((prev) => ({ ...prev, [key]: { ...prev[key], value } }));
  }

  function toggleEnabled(key: keyof BusinessLinks) {
    setLinks((prev) => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }));
  }

  function updateIcon(key: keyof BusinessLinks, icon: string) {
    setLinks((prev) => ({ ...prev, [key]: { ...prev[key], icon } }));
  }

  function updateLabel(key: keyof BusinessLinks, label: string) {
    setLinks((prev) => ({ ...prev, [key]: { ...prev[key], label } }));
  }

  function updateImage(key: keyof BusinessLinks, imageUrl: string | null) {
    setLinks((prev) => ({ ...prev, [key]: { ...prev[key], imageUrl } }));
  }

  async function handleImageUpload(key: keyof BusinessLinks, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadBusinessFile(businessId, file, `links/${key}`);
      updateImage(key, url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload image');
    }
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, { value: string; enabled: boolean; icon: string; label: string | null; imageUrl: string | null }> = {};
      (Object.keys(links) as (keyof BusinessLinks)[]).forEach((key) => {
        payload[key] = {
          value: links[key].value,
          enabled: links[key].enabled,
          icon: links[key].icon || LINK_META[key].defaultIcon,
          label: links[key].label ?? null,
          imageUrl: links[key].imageUrl ?? null,
        };
      });
      const updated = await updateBusiness(businessId, { links: payload as unknown as BusinessLinks });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your links');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      title={t('Landing page buttons')}
      action={
        <button type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-brass px-4 py-2.5 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50"
        >
          {saving ? t('Saving...') : t('Save buttons')}
        </button>
      }
    >
      <p className="text-base text-ivory-dim">
        {t("Toggle a button on and fill in its link — it'll show on your landing page in this order. Rename it, pick an icon, or upload your own image for it. Add more of your own further below.")}
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        {LINK_ORDER.map((key) => {
          const meta = LINK_META[key];
          const cfg = links[key];
          const SelectedIcon = getIcon(cfg.icon || meta.defaultIcon);
          const selectedColor = getIconColor(cfg.icon || meta.defaultIcon);
          return (
            <div key={key} className="space-y-3 rounded-xl border border-ink-line p-4">
              {/* Identity - what this button is and whether it's live */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleEnabled(key)}
                  className={`shrink-0 rounded-lg border px-3.5 py-2 text-sm font-medium ${cfg.enabled ? 'border-brass text-brass' : 'border-ink-line text-ivory-dim'}`}
                >
                  {cfg.enabled ? t('On') : t('Off')}
                </button>
                {cfg.imageUrl ? (
                  <img src={cfg.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-full border border-ink-line object-cover" />
                ) : (
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brass/40 text-brass"
                    style={selectedColor ? { color: selectedColor, borderColor: `${selectedColor}66` } : undefined}
                  >
                    <SelectedIcon size={16} />
                  </span>
                )}
                <input
                  value={cfg.label ?? meta.label}
                  onChange={(e) => updateLabel(key, e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-ink-line bg-ink-soft px-3 py-2 text-sm text-ivory placeholder:text-ivory-dim/60 focus:border-brass"
                  placeholder={t('Button label')}
                />
              </div>

              {/* Appearance - sized to their own content, wraps naturally on narrow screens */}
              <div className="flex flex-wrap items-center gap-2.5 border-t border-ink-line pt-4">
                <select
                  value={cfg.icon || meta.defaultIcon}
                  onChange={(e) => updateIcon(key, e.target.value)}
                  className="w-auto rounded-lg border border-ink-line bg-ink px-2.5 py-1.5 text-sm text-ivory"
                >
                  {ICON_LIBRARY.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
                <span className="text-sm text-ivory-dim">{t('or')}</span>
                <label className="w-auto cursor-pointer rounded-lg border border-ink-line px-3 py-1.5 text-sm text-ivory-dim hover:border-brass/60 hover:text-ivory">
                  {t('Upload image')}
                  <input type="file" accept="image/*" onChange={(e) => handleImageUpload(key, e)} className="hidden" />
                </label>
                {cfg.imageUrl && (
                  <button type="button" onClick={() => updateImage(key, null)} className="w-auto text-sm text-danger hover:underline">
                    {t('Remove')}
                  </button>
                )}
              </div>

              {/* The actual destination - sized to what's realistic for a phone number or URL, not stretched */}
              <div className="border-t border-ink-line pt-3">
                <input
                  value={cfg.value}
                  onChange={(e) => updateValue(key, e.target.value)}
                  placeholder={key === 'whatsapp' ? 'WhatsApp number, e.g. 971501234567' : 'https://...'}
                  className="w-full max-w-sm rounded-lg border border-ink-line bg-ink-soft px-3 py-2 text-sm text-ivory placeholder:text-ivory-dim/60 focus:border-brass"
                />
              </div>
            </div>
          );
        })}
      </div>
      {error && <p className="text-base text-danger">{error}</p>}

      <div className="mt-2 border-t border-ink-line pt-4">
        <div className="space-y-4">
          {extraButtons.filter((b) => !b.parent_button_id).map((b) => (
            <CustomButtonRow key={b.id} button={b} buttons={extraButtons} business={business} businessId={businessId} onButtonsChange={setExtraButtons} onChange={reloadExtras} />
          ))}
        </div>
        {showAddForm ? (
          <CustomButtonForm business={business} businessId={businessId} onDone={() => { setShowAddForm(false); reloadExtras(); }} />
        ) : (
          <button type="button"
            onClick={() => setShowAddForm(true)}
            className="mt-2 rounded-lg border border-brass/40 px-5 py-4 text-base text-brass hover:bg-brass/10"
          >
            {t('+ Add another link')}
          </button>
        )}
      </div>
    </Section>
  );
}



function CustomButtonForm({ business, businessId, existing, forcedParentId, onDone }: {
  business: AdminBusiness; businessId: string; existing?: CustomButton; forcedParentId?: string; onDone: () => void;
}) {
  const { t } = useT();
  const [label, setLabel] = useState(existing?.label || '');
  const [icon, setIcon] = useState(existing?.icon || 'link');
  const [imageUrl, setImageUrl] = useState<string | null>(existing?.image_url || null);
  const [url, setUrl] = useState(existing?.url || '');
  // Forced into a group's child list has no reason to itself be another
  // group - keeps nesting to exactly one level deep, which is what
  // "Services -> individual service" actually needs.
  const [buttonType, setButtonType] = useState<'link' | 'notification' | 'group'>(existing?.button_type || (forcedParentId ? 'notification' : 'link'));
  const [notificationDestination, setNotificationDestination] = useState<'general' | 'housekeeping_task' | 'maintenance_ticket'>(existing?.notification_destination || 'general');
  const [targetSection, setTargetSection] = useState(existing?.target_section || '');
  const [allowNote, setAllowNote] = useState(existing?.allow_note ?? true);
  const [color, setColor] = useState(existing?.color || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const isHotel = business.category === 'hotel';

  async function handleImageUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      // Existing buttons upload under their own id; a brand-new button
      // doesn't have one yet, so a timestamp keeps the path unique until
      // it's actually created.
      const subPath = `custom-buttons/${existing?.id || Date.now()}`;
      const url = await uploadBusinessFile(businessId, file, subPath);
      setImageUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload image');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        label, icon, imageUrl, url, buttonType,
        notificationDestination: buttonType === 'notification' ? notificationDestination : undefined,
        targetSection: buttonType === 'notification' && notificationDestination === 'general' ? (targetSection || null) : null,
        parentButtonId: forcedParentId ?? (existing?.parent_button_id ?? null),
        allowNote: buttonType === 'notification' ? allowNote : undefined,
        color: color || null,
      };
      if (existing) {
        await updateCustomButton(businessId, existing.id, payload);
      } else {
        await createCustomButton(businessId, payload);
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this button');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-4 rounded-xl border border-ink-line p-5">
      {!forcedParentId && (
        <Field label={t('What does this button do?')}>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setButtonType('link')} className={`rounded-lg border px-3.5 py-2 text-sm ${buttonType === 'link' ? 'border-brass text-brass' : 'border-ink-line text-ivory-dim'}`}>
              {t('Opens a link')}
            </button>
            <button type="button" onClick={() => setButtonType('notification')} className={`rounded-lg border px-3.5 py-2 text-sm ${buttonType === 'notification' ? 'border-brass text-brass' : 'border-ink-line text-ivory-dim'}`}>
              {t('Notifies staff')}
            </button>
            <button type="button" onClick={() => setButtonType('group')} className={`rounded-lg border px-3.5 py-2 text-sm ${buttonType === 'group' ? 'border-brass text-brass' : 'border-ink-line text-ivory-dim'}`}>
              {t('A list of services')}
            </button>
          </div>
          <p className="mt-1.5 text-sm text-ivory-dim">
            {buttonType === 'link'
              ? t('Opens a website, WhatsApp chat, or anything else with a URL.')
              : buttonType === 'group'
                ? t('Shows a list of individual services when tapped - e.g. "Services" opening onto Housekeeping, Maintenance, Room Service.')
                : t("Sends a request straight to a specific department's screen - no URL needed.")}
          </p>
        </Field>
      )}

      {buttonType === 'notification' && (
        <Field label={t('Where should this request go?')}>
          <select
            value={notificationDestination === 'general' ? `general::${targetSection}` : notificationDestination}
            onChange={(e) => {
              const [dest, section] = e.target.value.split('::');
              setNotificationDestination(dest as typeof notificationDestination);
              setTargetSection(dest === 'general' ? (section || '') : '');
            }}
            className={inputClass}
          >
            <option value="general::">{t('Everyone with Requests access')}</option>
            {requestTargetSectionsFor(isHotel).map((s) => <option key={s.key} value={`general::${s.key}`}>{t(s.label)}</option>)}
            {isHotel && <option value="housekeeping_task">{t('Housekeeping')}</option>}
            {isHotel && <option value="maintenance_ticket">{t('Maintenance')}</option>}
          </select>
          {notificationDestination === 'general' && targetSection && (
            <p className="mt-2 text-sm text-ivory-dim">{t('Lands on the Requests page, visible only to staff assigned to this section.')}</p>
          )}
          {notificationDestination === 'general' && !targetSection && (
            <p className="mt-2 text-sm text-ivory-dim">{t('Lands on the Requests page, visible to everyone with Requests access.')}</p>
          )}
          {notificationDestination === 'housekeeping_task' && (
            <p className="mt-2 text-sm text-ivory-dim">{t('Lands directly on the Housekeeping screen as a real task, for the room the guest tapped from.')}</p>
          )}
          {notificationDestination === 'maintenance_ticket' && (
            <p className="mt-2 text-sm text-ivory-dim">{t('Lands directly as a maintenance ticket - room if tapped in-room, otherwise a common-area issue.')}</p>
          )}
          <label className="mt-3 flex items-center gap-2 text-sm text-ivory">
            <input type="checkbox" checked={allowNote} onChange={(e) => setAllowNote(e.target.checked)} className="accent-brass" />
            {t('Let the guest add an optional note before sending')}
          </label>
        </Field>
      )}

      {buttonType === 'notification' && (
        <Field label={t('Request card color (optional)')}>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color || '#b8925a'}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded border border-ink-line bg-ink-soft"
            />
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="#b8925a"
              className={`${inputClass} w-32`}
            />
            {color && (
              <button type="button" onClick={() => setColor('')} className="text-sm text-ivory-dim hover:text-ivory">
                {t('Use default')}
              </button>
            )}
          </div>
          <p className="mt-1 text-sm text-ivory-dim">{t('Only changes this button\'s own request card - never affects any other color in the app.')}</p>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('Label')}><input required value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} /></Field>
        <Field label={t('Icon (used unless you upload your own image below)')}>
          <select value={icon} onChange={(e) => setIcon(e.target.value)} className={inputClass}>
            {ICON_LIBRARY.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label={t('Or upload your own logo/picture')}>
        <div className="flex items-center gap-3">
          {imageUrl && <img src={imageUrl} alt="" className="h-10 w-10 rounded-full border border-ink-line object-cover" />}
          <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="text-sm text-ivory-dim" />
          {imageUrl && (
            <button type="button" onClick={() => setImageUrl(null)} className="text-sm text-danger hover:underline">
              {t('Remove')}
            </button>
          )}
        </div>
        {uploading && <p className="mt-1 text-sm text-ivory-dim">{t('Uploading...')}</p>}
      </Field>
      {buttonType === 'link' && (
        <Field label={t('URL')}><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className={inputClass} /></Field>
      )}
      <button disabled={saving || uploading} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink disabled:opacity-50">
        {saving ? t('Saving...') : existing ? t('Save changes') : t('Add button')}
      </button>
      {error && <p className="text-base text-danger">{error}</p>}
    </form>
  );
}


function CustomButtonRow({ button, buttons, business, businessId, onButtonsChange, onChange }: {
  button: CustomButton; buttons: CustomButton[]; business: AdminBusiness; businessId: string; onButtonsChange: (b: CustomButton[]) => void; onChange: () => void;
}) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  if (editing) return <CustomButtonForm business={business} businessId={businessId} existing={button} onDone={() => { setEditing(false); onChange(); }} />;

  const Icon = getIcon(button.icon);
  const brandColor = getIconColor(button.icon);
  const children = buttons.filter((b) => b.parent_button_id === button.id);
  const badgeLabel = button.button_type === 'group'
    ? t('Group')
    : button.button_type === 'notification'
      ? button.notification_destination === 'housekeeping_task' ? t('Housekeeping') : button.notification_destination === 'maintenance_ticket' ? t('Maintenance') : t('Notifies staff')
      : t('Link');

  return (
    <div className="rounded-lg border border-ink-line px-5 py-4">
      <div className="flex flex-col gap-3 text-base sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-2 text-ivory">
          {button.image_url ? (
            <img src={button.image_url} alt="" className="h-7 w-7 shrink-0 rounded-full border border-ink-line object-cover" />
          ) : (
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brass/40 text-brass"
              style={brandColor ? { color: brandColor, borderColor: `${brandColor}66` } : undefined}
            >
              <Icon size={13} />
            </span>
          )}
          {button.label}
          <span className="rounded-full border border-ink-line px-2 py-0.5 text-xs text-ivory-dim">{badgeLabel}</span>
          {button.notification_destination === 'general' && button.target_section && (
            <span className="rounded-full border border-brass/40 px-2 py-0.5 text-xs text-brass">{button.target_section}</span>
          )}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton
            onClick={() => {
              onButtonsChange(buttons.map((b) => (b.id === button.id ? { ...b, enabled: !b.enabled } : b)));
              updateCustomButton(businessId, button.id, { enabled: !button.enabled }).catch(onChange);
            }}
          >
            {button.enabled ? t('On') : t('Off')}
          </ActionButton>
          <ActionButton onClick={() => setEditing(true)}>{t('Edit')}</ActionButton>
          <ActionButton
            danger
            onClick={() => {
              onButtonsChange(buttons.filter((b) => b.id !== button.id));
              deleteCustomButton(businessId, button.id).catch(onChange);
            }}
          >
            {t('Delete')}
          </ActionButton>
        </div>
      </div>

      {button.button_type === 'group' && (
        <div className="mt-3 space-y-2 border-t border-ink-line pt-3">
          {children.map((child) => (
            <CustomButtonRow key={child.id} button={child} buttons={buttons} business={business} businessId={businessId} onButtonsChange={onButtonsChange} onChange={onChange} />
          ))}
          {addingChild ? (
            <CustomButtonForm business={business} businessId={businessId} forcedParentId={button.id} onDone={() => { setAddingChild(false); onChange(); }} />
          ) : (
            <button type="button" onClick={() => setAddingChild(true)} className="text-sm text-brass hover:underline">
              {t('+ Add a service inside')} "{button.label}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Real, relocated home for bookable services (birthday packages etc.) -
// previously an orphaned page with no link pointing to it anywhere in
// the UI. Extended with real option management ("With cake" / "Without
// cake" style choices, each with its own real price), which is what
// actually makes these selectable with real choices during Online
// Booking, not just a flat name/price.
function BookableServicesSection({ businessId }: { businessId: string }) {
  const { t } = useT();
  const confirm = useConfirm();
  const [services, setServices] = useState<Service[]>([]);
  const [showForm, setShowForm] = useState(false);

  function reload() {
    listServices(businessId).then(setServices);
  }
  useEffect(reload, [businessId]);

  return (
    <Section
      title={t('Bookable Services')}
      action={
        <button type="button"
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90"
        >
          {t('+ Add service')}
        </button>
      }
    >
      <p className="text-sm text-ivory-dim">
        {t('Real, priced extras a guest can add to their table booking - a birthday package, an anniversary setup, and so on. Give each one real options (like "With cake" or "Without cake") if it needs a choice - these show up for guests during Online Booking, with their own date and time.')}
      </p>
      {showForm && <ServiceForm businessId={businessId} onDone={() => { setShowForm(false); reload(); }} />}
      <div className="space-y-3">
        {services.map((service) => (
          <ServiceRow key={service.id} service={service} services={services} businessId={businessId} onServicesChange={setServices} onChange={reload} confirm={confirm} />
        ))}
        {services.length === 0 && <p className="text-base text-ivory-dim">{t('No services yet.')}</p>}
      </div>
    </Section>
  );
}

function ServiceForm({ businessId, existing, onDone }: { businessId: string; existing?: Service; onDone: () => void }) {
  const { t } = useT();
  const [name, setName] = useState(existing?.name || '');
  const [description, setDescription] = useState(existing?.description || '');
  const [price, setPrice] = useState(existing?.price ?? 0);
  const [durationMinutes, setDurationMinutes] = useState(existing?.duration_minutes ?? 30);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = { name, description, price, durationMinutes };
    if (existing) {
      await updateService(businessId, existing.id, payload);
    } else {
      await createService(businessId, payload);
    }
    setSaving(false);
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="mb-3 space-y-3 rounded-lg border border-ink-line p-3">
      <div className="grid grid-cols-3 gap-3">
        <Field label={t('Name')}><input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} /></Field>
        <Field label={t('Price')}><input type="number" onFocus={(e) => e.target.select()} step="0.01" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} className={inputClass} /></Field>
        <Field label={t('Duration (min)')}><input type="number" onFocus={(e) => e.target.select()} min={5} step={5} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className={inputClass} /></Field>
      </div>
      <Field label={t('Description')}>
        <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
      </Field>
      <button type="submit" disabled={saving} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
        {saving ? t('Saving...') : existing ? t('Save changes') : t('Add service')}
      </button>
    </form>
  );
}

function ServiceRow({ service, services, businessId, onServicesChange, onChange, confirm }: {
  service: Service; services: Service[]; businessId: string; onServicesChange: (s: Service[]) => void; onChange: () => void;
  confirm: ReturnType<typeof useConfirm>;
}) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  if (editing) {
    return <ServiceForm businessId={businessId} existing={service} onDone={() => { setEditing(false); onChange(); }} />;
  }

  return (
    <div className="rounded-lg border border-ink-line px-3.5 py-2.5">
      <div className="flex flex-col gap-3 text-base sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-ivory">{service.name}</span>
          <span className="ml-2 text-ivory-dim">{service.price.toFixed(2)} · {service.duration_minutes} min</span>
          {!service.is_available && <span className="ml-2 text-base text-danger">{t('unavailable')}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton onClick={() => setShowOptions((s) => !s)}>{showOptions ? t('Hide options') : t('Options')}</ActionButton>
          <ActionButton
            onClick={() => {
              onServicesChange(services.map((s) => (s.id === service.id ? { ...s, is_available: !s.is_available } : s)));
              updateService(businessId, service.id, { isAvailable: !service.is_available }).catch(onChange);
            }}
          >
            {service.is_available ? t('Mark unavailable') : t('Mark available')}
          </ActionButton>
          <ActionButton onClick={() => setEditing(true)}>{t('Edit')}</ActionButton>
          <ActionButton
            danger
            onClick={async () => {
              if (!(await confirm({ title: t('Delete this service?'), message: `${t('Delete')} "${service.name}"?`, confirmLabel: t('Delete'), danger: true }))) return;
              onServicesChange(services.filter((s) => s.id !== service.id));
              deleteService(businessId, service.id).catch(onChange);
            }}
          >
            {t('Remove')}
          </ActionButton>
        </div>
      </div>
      {showOptions && <ServiceOptionsManager businessId={businessId} serviceId={service.id} />}
    </div>
  );
}

// Real option management - "With cake" / "Without cake" style choices,
// each with its own real price adjustment, not just decorative labels.
function ServiceOptionsManager({ businessId, serviceId }: { businessId: string; serviceId: string }) {
  const { t } = useT();
  const confirm = useConfirm();
  const [options, setOptions] = useState<ServiceOption[]>([]);
  const [label, setLabel] = useState('');
  const [priceDelta, setPriceDelta] = useState(0);
  const [saving, setSaving] = useState(false);

  function reload() {
    listServiceOptions(businessId, serviceId).then(setOptions);
  }
  useEffect(reload, [businessId, serviceId]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    await createServiceOption(businessId, serviceId, { label: label.trim(), priceDelta });
    setLabel('');
    setPriceDelta(0);
    setSaving(false);
    reload();
  }

  return (
    <div className="mt-3 space-y-2 border-t border-ink-line pt-3">
      <p className="text-sm text-ivory-dim">{t('Options a guest can choose from - e.g. "With cake" (+50) or "Without cake".')}</p>
      {options.map((opt) => (
        <div key={opt.id} className="flex items-center justify-between gap-2 rounded-lg border border-ink-line px-3 py-2 text-sm">
          <span className="text-ivory">{opt.label}{opt.price_delta !== 0 && ` (${opt.price_delta > 0 ? '+' : ''}AED ${opt.price_delta.toFixed(2)})`}</span>
          <button type="button"
            onClick={async () => {
              if (!(await confirm({ title: t('Remove this option?'), message: `${t('Remove')} "${opt.label}"?`, confirmLabel: t('Remove'), danger: true }))) return;
              setOptions((prev) => prev.filter((o) => o.id !== opt.id));
              deleteServiceOption(businessId, serviceId, opt.id).catch(reload);
            }}
            className="text-xs text-danger hover:underline"
          >
            {t('Remove')}
          </button>
        </div>
      ))}
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
        <Field label={t('Option label')}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('e.g. With cake')} className={inputClass} />
        </Field>
        <Field label={t('Price adjustment')}>
          <input type="number" onFocus={(e) => e.target.select()} step="0.01" value={priceDelta} onChange={(e) => setPriceDelta(Number(e.target.value))} className={`${inputClass} w-32`} />
        </Field>
        <button type="submit" disabled={saving || !label.trim()} className="rounded-lg border border-brass/40 px-3 py-2 text-sm text-brass hover:bg-brass/10 disabled:opacity-50">
          {t('+ Add option')}
        </button>
      </form>
    </div>
  );
}
