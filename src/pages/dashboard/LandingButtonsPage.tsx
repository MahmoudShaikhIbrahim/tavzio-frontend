import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react';
import { useSession } from '../../hooks/useSession';
import {
  getBusiness, updateBusiness,
  listCustomButtons, createCustomButton, updateCustomButton, deleteCustomButton,
} from '../../lib/authApi';
import { uploadBusinessFile } from '../../lib/supabaseClient';
import type { AdminBusiness, BusinessLinks, CustomButton } from '../../types';
import { LINK_META, LINK_ORDER } from '../../lib/linkMeta';
import { ICON_LIBRARY, getIcon, getIconColor } from '../../lib/iconLibrary';
import { SECTION_OPTIONS } from '../../lib/dashboardSections';
import { Section, Field, inputClass, ActionButton } from '../../components/ui';

export default function LandingButtonsPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [business, setBusiness] = useState<AdminBusiness | null>(null);

  useEffect(() => {
    if (businessId) getBusiness(businessId).then(setBusiness);
  }, [businessId]);

  if (!business || !businessId) return <p className="text-ivory-dim">Loading...</p>;

  return <LandingPageButtonsSection business={business} businessId={businessId} onSaved={setBusiness} />;
}

function LandingPageButtonsSection({ business, businessId, onSaved }: { business: AdminBusiness; businessId: string; onSaved: (b: AdminBusiness) => void }) {
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
      title="Landing page buttons"
      action={
        <button type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-brass px-4 py-2.5 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save buttons'}
        </button>
      }
    >
      <p className="text-base text-ivory-dim">
        Toggle a button on and fill in its link — it'll show on your landing
        page in this order. Rename it, pick an icon, or upload your own
        image for it. Add more of your own further below.
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
                  {cfg.enabled ? 'On' : 'Off'}
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
                  placeholder="Button label"
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
                <span className="text-sm text-ivory-dim">or</span>
                <label className="w-auto cursor-pointer rounded-lg border border-ink-line px-3 py-1.5 text-sm text-ivory-dim hover:border-brass/60 hover:text-ivory">
                  Upload image
                  <input type="file" accept="image/*" onChange={(e) => handleImageUpload(key, e)} className="hidden" />
                </label>
                {cfg.imageUrl && (
                  <button type="button" onClick={() => updateImage(key, null)} className="w-auto text-sm text-danger hover:underline">
                    Remove
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
            + Add another link
          </button>
        )}
      </div>
    </Section>
  );
}



function CustomButtonForm({ business, businessId, existing, forcedParentId, onDone }: {
  business: AdminBusiness; businessId: string; existing?: CustomButton; forcedParentId?: string; onDone: () => void;
}) {
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
        <Field label="What does this button do?">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setButtonType('link')} className={`rounded-lg border px-3.5 py-2 text-sm ${buttonType === 'link' ? 'border-brass text-brass' : 'border-ink-line text-ivory-dim'}`}>
              Opens a link
            </button>
            <button type="button" onClick={() => setButtonType('notification')} className={`rounded-lg border px-3.5 py-2 text-sm ${buttonType === 'notification' ? 'border-brass text-brass' : 'border-ink-line text-ivory-dim'}`}>
              Notifies staff
            </button>
            <button type="button" onClick={() => setButtonType('group')} className={`rounded-lg border px-3.5 py-2 text-sm ${buttonType === 'group' ? 'border-brass text-brass' : 'border-ink-line text-ivory-dim'}`}>
              A list of services
            </button>
          </div>
          <p className="mt-1.5 text-sm text-ivory-dim">
            {buttonType === 'link'
              ? 'Opens a website, WhatsApp chat, or anything else with a URL.'
              : buttonType === 'group'
                ? 'Shows a list of individual services when tapped - e.g. "Services" opening onto Housekeeping, Maintenance, Room Service.'
                : "Sends a request straight to a specific department's screen - no URL needed."}
          </p>
        </Field>
      )}

      {buttonType === 'notification' && (
        <Field label="Where should this request go?">
          <select value={notificationDestination} onChange={(e) => setNotificationDestination(e.target.value as typeof notificationDestination)} className={inputClass}>
            <option value="general">Front Desk / Requests list</option>
            {isHotel && <option value="housekeeping_task">Housekeeping</option>}
            {isHotel && <option value="maintenance_ticket">Maintenance</option>}
          </select>
          {notificationDestination === 'general' && (
            <>
              <p className="mt-2 text-sm text-ivory-dim">Which section should see it? Leave blank to notify everyone with Requests access.</p>
              <select value={targetSection} onChange={(e) => setTargetSection(e.target.value)} className={`${inputClass} mt-1`}>
                <option value="">Everyone with Requests access</option>
                {SECTION_OPTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </>
          )}
          {notificationDestination === 'housekeeping_task' && (
            <p className="mt-2 text-sm text-ivory-dim">Lands directly on the Housekeeping screen as a real task, for the room the guest tapped from.</p>
          )}
          {notificationDestination === 'maintenance_ticket' && (
            <p className="mt-2 text-sm text-ivory-dim">Lands directly as a maintenance ticket - room if tapped in-room, otherwise a common-area issue.</p>
          )}
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Label"><input required value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} /></Field>
        <Field label="Icon (used unless you upload your own image below)">
          <select value={icon} onChange={(e) => setIcon(e.target.value)} className={inputClass}>
            {ICON_LIBRARY.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Or upload your own logo/picture">
        <div className="flex items-center gap-3">
          {imageUrl && <img src={imageUrl} alt="" className="h-10 w-10 rounded-full border border-ink-line object-cover" />}
          <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="text-sm text-ivory-dim" />
          {imageUrl && (
            <button type="button" onClick={() => setImageUrl(null)} className="text-sm text-danger hover:underline">
              Remove
            </button>
          )}
        </div>
        {uploading && <p className="mt-1 text-sm text-ivory-dim">Uploading...</p>}
      </Field>
      {buttonType === 'link' && (
        <Field label="URL"><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className={inputClass} /></Field>
      )}
      <button disabled={saving || uploading} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink disabled:opacity-50">
        {saving ? 'Saving...' : existing ? 'Save changes' : 'Add button'}
      </button>
      {error && <p className="text-base text-danger">{error}</p>}
    </form>
  );
}


function CustomButtonRow({ button, buttons, business, businessId, onButtonsChange, onChange }: {
  button: CustomButton; buttons: CustomButton[]; business: AdminBusiness; businessId: string; onButtonsChange: (b: CustomButton[]) => void; onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  if (editing) return <CustomButtonForm business={business} businessId={businessId} existing={button} onDone={() => { setEditing(false); onChange(); }} />;

  const Icon = getIcon(button.icon);
  const brandColor = getIconColor(button.icon);
  const children = buttons.filter((b) => b.parent_button_id === button.id);
  const badgeLabel = button.button_type === 'group'
    ? 'Group'
    : button.button_type === 'notification'
      ? button.notification_destination === 'housekeeping_task' ? 'Housekeeping' : button.notification_destination === 'maintenance_ticket' ? 'Maintenance' : 'Notifies staff'
      : 'Link';

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
            {button.enabled ? 'On' : 'Off'}
          </ActionButton>
          <ActionButton onClick={() => setEditing(true)}>Edit</ActionButton>
          <ActionButton
            danger
            onClick={() => {
              onButtonsChange(buttons.filter((b) => b.id !== button.id));
              deleteCustomButton(businessId, button.id).catch(onChange);
            }}
          >
            Delete
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
              + Add a service inside "{button.label}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}

