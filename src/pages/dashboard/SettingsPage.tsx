import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react';
import { useSession } from '../../hooks/useSession';
import { getBusiness, updateBusiness } from '../../lib/authApi';
import { uploadBusinessImage } from '../../lib/supabaseClient';
import type { AdminBusiness, BusinessLinks } from '../../types';
import { LINK_META, LINK_ORDER } from '../../lib/linkMeta';
import { Section, Field, inputClass, PrimaryButton } from '../../components/ui';

const CATEGORIES = ['restaurant', 'cafe', 'retail', 'hotel', 'salon', 'clinic', 'gym', 'other'];

export default function SettingsPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [business, setBusiness] = useState<AdminBusiness | null>(null);

  useEffect(() => {
    if (businessId) getBusiness(businessId).then(setBusiness);
  }, [businessId]);

  if (!business || !businessId) return <p className="text-ivory-dim">Loading...</p>;

  return (
    <div className="space-y-6">
      <ProfileForm business={business} businessId={businessId} onSaved={setBusiness} />
      <LinksForm business={business} businessId={businessId} onSaved={setBusiness} />
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
          <label className="inline-block cursor-pointer rounded-lg border border-ink-line px-3.5 py-2 text-sm text-ivory-dim hover:text-ivory">
            {uploading ? 'Uploading...' : value ? 'Replace image' : 'Upload image'}
            <input type="file" accept="image/*" onChange={handleFile} disabled={uploading} className="hidden" />
          </label>
          {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
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
          className="rounded-lg bg-brass px-4 py-2.5 text-sm font-medium text-ink hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save buttons'}
        </button>
      }
    >
      <p className="text-xs text-ivory-dim">
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
              <span className="w-40 shrink-0 text-sm text-ivory">{meta.label}</span>
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
