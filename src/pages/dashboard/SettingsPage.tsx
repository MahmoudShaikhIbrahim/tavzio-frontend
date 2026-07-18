import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react';
import { useSession } from '../../hooks/useSession';
import {
  getBusiness, updateBusiness,
  listCustomButtons, createCustomButton, updateCustomButton, deleteCustomButton,
} from '../../lib/authApi';
import { uploadBusinessImage } from '../../lib/supabaseClient';
import type { AdminBusiness, BusinessLinks, CustomButton } from '../../types';
import { LINK_META, LINK_ORDER } from '../../lib/linkMeta';
import { ICON_LIBRARY, getIcon } from '../../lib/iconLibrary';
import { Section, Field, inputClass, PrimaryButton, ActionButton } from '../../components/ui';
import MenuManagementPage from './MenuManagementPage';
import LoyaltyPage from './LoyaltyPage';
import CardsPage from './CardsPage';
import NotificationsPage from './NotificationsPage';

const CATEGORIES = ['restaurant', 'cafe', 'retail', 'hotel', 'salon', 'clinic', 'gym', 'other'];

// A single, scrollable page grouping everything that's genuinely a
// "setting" rather than day-to-day operational work - Menu, Loyalty,
// Cards, and Notifications used to be separate top-level tabs; they live
// here now, each under its own clear heading.
export default function SettingsPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const isOwner = user?.role === 'business_owner';
  const [business, setBusiness] = useState<AdminBusiness | null>(null);

  useEffect(() => {
    if (businessId) getBusiness(businessId).then(setBusiness);
  }, [businessId]);

  if (!business || !businessId) return <p className="text-ivory-dim">Loading...</p>;

  return (
    <div className="space-y-10">
      {/* Business info and landing page buttons stay owner-only, exactly
          as they always were - only Menu/Loyalty/Cards/Notifications
          below are the parts staff already had access to before this
          reorg, and keep that same access now. */}
      {isOwner && (
        <>
          <ProfileForm business={business} businessId={businessId} onSaved={setBusiness} />
          <LandingPageButtonsSection business={business} businessId={businessId} onSaved={setBusiness} />
        </>
      )}

      <div>
        <h2 className="mb-3 font-display text-xl text-ivory">Menu</h2>
        <MenuManagementPage />
      </div>

      <div>
        <h2 className="mb-3 font-display text-xl text-ivory">Loyalty</h2>
        <LoyaltyPage />
      </div>

      <div>
        <h2 className="mb-3 font-display text-xl text-ivory">Cards</h2>
        <CardsPage />
      </div>

      <div>
        <h2 className="mb-3 font-display text-xl text-ivory">Notifications</h2>
        <NotificationsPage />
      </div>
    </div>
  );
}

function CustomButtonForm({ businessId, existing, onDone }: { businessId: string; existing?: CustomButton; onDone: () => void }) {
  const [label, setLabel] = useState(existing?.label || '');
  const [icon, setIcon] = useState(existing?.icon || 'link');
  const [url, setUrl] = useState(existing?.url || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (existing) {
        await updateCustomButton(businessId, existing.id, { label, icon, url });
      } else {
        await createCustomButton(businessId, { label, icon, url });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this button');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-3 space-y-3 rounded-lg border border-ink-line p-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Label"><input required value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} /></Field>
        <Field label="Icon">
          <select value={icon} onChange={(e) => setIcon(e.target.value)} className={inputClass}>
            {ICON_LIBRARY.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="URL"><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className={inputClass} /></Field>
      <button disabled={saving} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink disabled:opacity-50">
        {saving ? 'Saving...' : existing ? 'Save changes' : 'Add button'}
      </button>
      {error && <p className="text-base text-red-400">{error}</p>}
    </form>
  );
}

function CustomButtonRow({ button, businessId, onChange }: { button: CustomButton; businessId: string; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <CustomButtonForm businessId={businessId} existing={button} onDone={() => { setEditing(false); onChange(); }} />;

  const Icon = getIcon(button.icon);

  return (
    <div className="flex items-center justify-between rounded-lg border border-ink-line px-3.5 py-2 text-base">
      <span className="flex items-center gap-2 text-ivory">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brass/40 text-brass">
          <Icon size={13} />
        </span>
        {button.label}
      </span>
      <div className="flex items-center gap-2">
        <ActionButton onClick={() => updateCustomButton(businessId, button.id, { enabled: !button.enabled }).then(onChange)}>
          {button.enabled ? 'On' : 'Off'}
        </ActionButton>
        <ActionButton onClick={() => setEditing(true)}>Edit</ActionButton>
        <ActionButton danger onClick={() => deleteCustomButton(businessId, button.id).then(onChange)}>Delete</ActionButton>
      </div>
    </div>
  );
}

function ImageUploadField({ label, businessId, kind, value, onUploaded }: {
  label: string; businessId: string; kind: 'logo' | 'cover'; value: string; onUploaded: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const url = await uploadBusinessImage(businessId, file, kind);
      onUploaded(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = ''; // allow re-selecting the same file if needed
    }
  }

  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        {value && (
          <img
            src={value}
            alt=""
            className={kind === 'logo' ? 'h-14 w-14 rounded-full border border-ink-line object-cover' : 'h-14 w-24 rounded-md border border-ink-line object-cover'}
          />
        )}
        <div className="flex-1">
          <label className="inline-block cursor-pointer rounded-lg border border-ink-line px-3.5 py-2 text-base text-ivory-dim hover:text-ivory">
            {uploading ? 'Uploading...' : value ? 'Replace image' : 'Upload image'}
            <input type="file" accept="image/*" onChange={handleFile} disabled={uploading} className="hidden" />
          </label>
          {error && <p className="mt-1 text-base text-red-400">{error}</p>}
        </div>
      </div>
      <input
        value={value}
        onChange={(e) => onUploaded(e.target.value)}
        placeholder="Or paste an image URL directly"
        className={`${inputClass} mt-2`}
      />
    </Field>
  );
}

function ProfileForm({ business, businessId, onSaved }: { business: AdminBusiness; businessId: string; onSaved: (b: AdminBusiness) => void }) {
  const [name, setName] = useState(business.name);
  const [description, setDescription] = useState(business.description);
  const [category, setCategory] = useState(business.category);
  const [logoUrl, setLogoUrl] = useState(business.logo_url);
  const [coverImageUrl, setCoverImageUrl] = useState(business.cover_image_url);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const updated = await updateBusiness(businessId, { name, description, category, logoUrl, coverImageUrl } as Partial<AdminBusiness>);
    onSaved(updated);
    setSaving(false);
  }

  return (
    <Section title="Business profile">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Description">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} className={inputClass} />
        </Field>
        <Field label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>

        <ImageUploadField label="Logo" businessId={businessId} kind="logo" value={logoUrl} onUploaded={setLogoUrl} />
        <ImageUploadField label="Cover image" businessId={businessId} kind="cover" value={coverImageUrl} onUploaded={setCoverImageUrl} />

        <PrimaryButton disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</PrimaryButton>
      </form>
    </Section>
  );
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

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, { value: string; enabled: boolean; icon: string }> = {};
      (Object.keys(links) as (keyof BusinessLinks)[]).forEach((key) => {
        payload[key] = { value: links[key].value, enabled: links[key].enabled, icon: links[key].icon || LINK_META[key].defaultIcon };
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
        page in this order. Add more of your own further below.
      </p>
      <div className="space-y-2">
        {LINK_ORDER.map((key) => {
          const meta = LINK_META[key];
          const cfg = links[key];
          const SelectedIcon = getIcon(cfg.icon || meta.defaultIcon);
          return (
            <div key={key} className="flex items-center gap-3 rounded-lg border border-ink-line px-3.5 py-2.5">
              <button
                type="button"
                onClick={() => toggleEnabled(key)}
                className={`shrink-0 rounded-lg border px-3 py-1.5 text-sm ${cfg.enabled ? 'border-brass text-brass' : 'border-ink-line text-ivory-dim'}`}
              >
                {cfg.enabled ? 'On' : 'Off'}
              </button>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brass/40 text-brass">
                <SelectedIcon size={14} />
              </span>
              <select
                value={cfg.icon || meta.defaultIcon}
                onChange={(e) => updateIcon(key, e.target.value)}
                className="shrink-0 rounded-lg border border-ink-line bg-ink px-2 py-1.5 text-sm text-ivory"
              >
                {ICON_LIBRARY.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
              <span className="w-40 shrink-0 text-base text-ivory">{meta.label}</span>
              <input
                value={cfg.value}
                onChange={(e) => updateValue(key, e.target.value)}
                placeholder={key === 'whatsapp' ? '971...' : 'https://...'}
                className={`${inputClass} flex-1`}
              />
            </div>
          );
        })}
      </div>
      {error && <p className="text-base text-red-400">{error}</p>}

      <div className="mt-2 border-t border-ink-line pt-4">
        <div className="space-y-1.5">
          {extraButtons.map((b) => <CustomButtonRow key={b.id} button={b} businessId={businessId} onChange={reloadExtras} />)}
        </div>
        {showAddForm ? (
          <CustomButtonForm businessId={businessId} onDone={() => { setShowAddForm(false); reloadExtras(); }} />
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-2 rounded-lg border border-brass/40 px-3.5 py-2 text-base text-brass hover:bg-brass/10"
          >
            + Add another link
          </button>
        )}
      </div>
    </Section>
  );
}
