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
        <button
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
          {extraButtons.map((b) => <CustomButtonRow key={b.id} button={b} buttons={extraButtons} businessId={businessId} onButtonsChange={setExtraButtons} onChange={reloadExtras} />)}
        </div>
        {showAddForm ? (
          <CustomButtonForm businessId={businessId} onDone={() => { setShowAddForm(false); reloadExtras(); }} />
        ) : (
          <button
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

const PROVIDERS = [
  { key: 'tap', label: 'Tap Payments' },
  { key: 'telr', label: 'Telr' },
  { key: 'ngenius', label: 'N-Genius Online (Network International)' },
  { key: 'ziina', label: 'Ziina' },
] as const;


function CustomButtonForm({ businessId, existing, onDone }: { businessId: string; existing?: CustomButton; onDone: () => void }) {
  const [label, setLabel] = useState(existing?.label || '');
  const [icon, setIcon] = useState(existing?.icon || 'link');
  const [imageUrl, setImageUrl] = useState<string | null>(existing?.image_url || null);
  const [url, setUrl] = useState(existing?.url || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

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
      if (existing) {
        await updateCustomButton(businessId, existing.id, { label, icon, imageUrl, url });
      } else {
        await createCustomButton(businessId, { label, icon, imageUrl, url });
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
      <Field label="URL"><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className={inputClass} /></Field>
      <button disabled={saving || uploading} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink disabled:opacity-50">
        {saving ? 'Saving...' : existing ? 'Save changes' : 'Add button'}
      </button>
      {error && <p className="text-base text-danger">{error}</p>}
    </form>
  );
}


function CustomButtonRow({ button, buttons, businessId, onButtonsChange, onChange }: {
  button: CustomButton; buttons: CustomButton[]; businessId: string; onButtonsChange: (b: CustomButton[]) => void; onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) return <CustomButtonForm businessId={businessId} existing={button} onDone={() => { setEditing(false); onChange(); }} />;

  const Icon = getIcon(button.icon);
  const brandColor = getIconColor(button.icon);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-ink-line px-5 py-4 text-base sm:flex-row sm:items-center sm:justify-between">
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
  );
}

