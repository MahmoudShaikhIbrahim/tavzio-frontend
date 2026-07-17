import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react';
import { useSession } from '../../hooks/useSession';
import {
  getBusiness, updateBusiness,
  listCustomButtons, createCustomButton, updateCustomButton, deleteCustomButton,
} from '../../lib/authApi';
import { uploadBusinessImage } from '../../lib/supabaseClient';
import type { AdminBusiness, BusinessLinks, CustomButton } from '../../types';
import { LINK_META, LINK_ORDER } from '../../lib/linkMeta';
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

          <div>
            <h2 className="mb-3 font-display text-xl text-ivory">Landing Page Buttons</h2>
            <div className="space-y-4">
              <LinksForm business={business} businessId={businessId} onSaved={setBusiness} />
              <CustomButtonsSection businessId={businessId} />
            </div>
          </div>
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

function CustomButtonsSection({ businessId }: { businessId: string }) {
  const [buttons, setButtons] = useState<CustomButton[]>([]);
  const [showForm, setShowForm] = useState(false);

  function reload() {
    listCustomButtons(businessId).then(setButtons);
  }
  useEffect(reload, [businessId]);

  return (
    <Section
      title="Custom buttons"
      action={
        <button onClick={() => setShowForm((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">
          + Add button
        </button>
      }
    >
      <p className="text-base text-ivory-dim">
        Beyond the 7 built-in links above — add a brand-new button with its
        own label, icon, and link.
      </p>
      {showForm && <CustomButtonForm businessId={businessId} onDone={() => { setShowForm(false); reload(); }} />}
      <div className="space-y-1.5">
        {buttons.map((b) => <CustomButtonRow key={b.id} button={b} businessId={businessId} onChange={reload} />)}
        {buttons.length === 0 && <p className="text-base text-ivory-dim">No custom buttons yet.</p>}
      </div>
    </Section>
  );
}

const ICON_OPTIONS = ['Link', 'Star', 'Gift', 'Music', 'ShoppingBag', 'Heart', 'Phone', 'Mail', 'Globe', 'MapPin', 'Camera', 'Ticket'];

function CustomButtonForm({ businessId, existing, onDone }: { businessId: string; existing?: CustomButton; onDone: () => void }) {
  const [label, setLabel] = useState(existing?.label || '');
  const [icon, setIcon] = useState(existing?.icon || 'Link');
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
            {ICON_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
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

  return (
    <div className="flex items-center justify-between rounded-lg border border-ink-line px-3.5 py-2 text-base">
      <span className="text-ivory">{button.label} <span className="text-ivory-dim">· {button.icon}</span></span>
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

function LinksForm({ business, businessId, onSaved }: { business: AdminBusiness; businessId: string; onSaved: (b: AdminBusiness) => void }) {
  const [links, setLinks] = useState<BusinessLinks>(business.links);
  const [saving, setSaving] = useState(false);

  function updateValue(key: keyof BusinessLinks, value: string) {
    setLinks((prev) => ({ ...prev, [key]: { ...prev[key], value } }));
  }

  async function handleSave() {
    setSaving(true);
    // Only `value` is ever sent from here - `enabled` is exclusively
    // controlled by the platform operator; the backend would silently
    // ignore it anyway, but there's no reason to even offer a control
    // here that wouldn't do anything.
    const payload: Record<string, { value: string }> = {};
    (Object.keys(links) as (keyof BusinessLinks)[]).forEach((key) => {
      payload[key] = { value: links[key].value };
    });
    const updated = await updateBusiness(businessId, { links: payload as unknown as BusinessLinks });
    onSaved(updated);
    setSaving(false);
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
        Which buttons are on or off is set by the platform operator — you
        can fill in the link for anything that's on below.
      </p>
      <div className="space-y-2">
        {LINK_ORDER.map((key) => {
          const meta = LINK_META[key];
          const cfg = links[key];
          return (
            <div key={key} className="flex items-center gap-3 rounded-lg border border-ink-line px-3.5 py-2.5">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${cfg.enabled ? 'bg-brass' : 'bg-ink-line'}`}
                title={cfg.enabled ? 'On' : 'Off'}
              />
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
    </Section>
  );
}
