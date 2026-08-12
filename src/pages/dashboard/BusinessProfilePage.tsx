import { useEffect, useState, type ChangeEvent, type FormEvent, type CSSProperties } from 'react';
import { useSession } from '../../hooks/useSession';
import { getBusiness, updateBusiness } from '../../lib/authApi';
import { uploadBusinessImage } from '../../lib/supabaseClient';
import type { AdminBusiness } from '../../types';
import { Section, Field, inputClass, PrimaryButton } from '../../components/ui';
import { buildBusinessThemeVars } from '../../lib/businessTheme';
import ChangePasswordPage from './ChangePasswordPage';


export default function BusinessProfilePage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [business, setBusiness] = useState<AdminBusiness | null>(null);

  useEffect(() => {
    if (businessId) getBusiness(businessId).then(setBusiness);
  }, [businessId]);

  if (!business || !businessId) return <p className="text-ivory-dim">Loading...</p>;

  return (
    <div className="space-y-8">
      <ProfileForm business={business} businessId={businessId} onSaved={setBusiness} />
      <AppearanceSection business={business} businessId={businessId} onSaved={setBusiness} />
      {/* Change Password lives here, not as its own settings entry - it's
          personal account security, not a business configuration, so it
          belongs alongside the rest of "who am I / how do I sign in" here. */}
      <ChangePasswordPage />
    </div>
  );
}

function ProfileForm({ business, businessId, onSaved }: { business: AdminBusiness; businessId: string; onSaved: (b: AdminBusiness) => void }) {
  const [name, setName] = useState(business.name);
  const [description, setDescription] = useState(business.description);
  const category = business.category;
  const [logoUrl, setLogoUrl] = useState(business.logo_url);
  const [coverImageUrl, setCoverImageUrl] = useState(business.cover_image_url);
  const [trn, setTrn] = useState(business.trn || '');
  const [tourismDirhamRateAed, setTourismDirhamRateAed] = useState(business.tourism_dirham_rate_aed || 0);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const updated = await updateBusiness(businessId, { name, description, logoUrl, coverImageUrl, trn, tourismDirhamRateAed } as Partial<AdminBusiness>);
    onSaved(updated);
    setSaving(false);
  }

  return (
    <Section title="Business profile">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-wrap gap-4">
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-64 rounded-lg border border-ink-line bg-ink-soft px-3.5 py-2.5 text-base text-ivory placeholder:text-ivory-dim/60 focus:border-brass" />
          </Field>
          <Field label="Business Type">
            <div className="w-48 rounded-lg border border-ink-line bg-ink-soft/50 px-3.5 py-2.5 text-base text-ivory-dim">
              {category} <span className="text-xs">(contact Tavzio to change)</span>
            </div>
          </Field>
          <Field label="TRN (optional - shown on your receipts, needed to reclaim VAT)">
            <input value={trn} onChange={(e) => setTrn(e.target.value)} placeholder="100000000000003" className="w-56 rounded-lg border border-ink-line bg-ink-soft px-3.5 py-2.5 text-base text-ivory placeholder:text-ivory-dim/60 focus:border-brass" />
          </Field>
          {category === 'hotel' && (
            <Field label="Tourism Dirham fee, per room per night (AED)">
              <input
                type="number"
                min={0}
                step={1}
                onFocus={(e) => e.target.select()}
                value={tourismDirhamRateAed}
                onChange={(e) => setTourismDirhamRateAed(Number(e.target.value))}
                className="w-56 rounded-lg border border-ink-line bg-ink-soft px-3.5 py-2.5 text-base text-ivory placeholder:text-ivory-dim/60 focus:border-brass"
              />
            </Field>
          )}
        </div>
        <Field label="Description">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} className={`${inputClass} max-w-2xl`} />
        </Field>

        <ImageUploadField label="Logo" businessId={businessId} kind="logo" value={logoUrl} onUploaded={setLogoUrl} />
        <ImageUploadField label="Cover image" businessId={businessId} kind="cover" value={coverImageUrl} onUploaded={setCoverImageUrl} />

        <PrimaryButton disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</PrimaryButton>
      </form>
    </Section>
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
          <label className="inline-block cursor-pointer rounded-lg border border-ink-line px-5 py-4 text-base text-ivory-dim hover:text-ivory">
            {uploading ? 'Uploading...' : value ? 'Replace image' : 'Upload image'}
            <input type="file" accept="image/*" onChange={handleFile} disabled={uploading} className="hidden" />
          </label>
          {error && <p className="mt-1 text-base text-danger">{error}</p>}
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

// =========================================================================
// Appearance — "1 click, 1 color" for Background/Buttons, one pair for
// the customer-facing pages (Landing/Menu/Bill/Booking), one shared
// business-wide for the owner/staff dashboard. Just sets two hex values
// on businesses.theme - buildBusinessThemeVars derives the full palette
// (including automatic text contrast) from those on the actual pages.
// =========================================================================

function ColorPairPicker({ title, description, background, button, onChange, previewVars }: {
  title: string;
  description: string;
  background: string | null;
  button: string | null;
  onChange: (next: { background: string | null; button: string | null }) => void;
  previewVars: CSSProperties;
}) {
  const DEFAULT_BG = '#141110';
  const DEFAULT_BUTTON = '#b8925a';

  return (
    <div className="space-y-3 rounded-xl border border-ink-line p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base font-medium text-ivory">{title}</p>
          <p className="text-sm text-ivory-dim">{description}</p>
        </div>
        {(background || button) && (
          <button
            type="button"
            onClick={() => onChange({ background: null, button: null })}
            className="shrink-0 text-sm text-ivory-dim hover:text-ivory"
          >
            Use default
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <label className="flex flex-col items-center gap-1.5">
          <span className="text-sm text-ivory-dim">Background</span>
          <input
            type="color"
            value={background || DEFAULT_BG}
            onChange={(e) => onChange({ background: e.target.value, button })}
            className="h-11 w-11 cursor-pointer rounded-full border border-ink-line bg-transparent p-0"
          />
        </label>
        <label className="flex flex-col items-center gap-1.5">
          <span className="text-sm text-ivory-dim">Buttons</span>
          <input
            type="color"
            value={button || DEFAULT_BUTTON}
            onChange={(e) => onChange({ background, button: e.target.value })}
            className="h-11 w-11 cursor-pointer rounded-full border border-ink-line bg-transparent p-0"
          />
        </label>
        <div className="flex h-11 flex-1 min-w-[8rem] items-center justify-center rounded-lg" style={previewVars}>
          <div className="rounded-lg bg-ink px-4 py-2">
            <span className="rounded-md bg-brass px-3 py-1.5 text-sm font-medium text-ink">Preview</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppearanceSection({ business, businessId, onSaved }: { business: AdminBusiness; businessId: string; onSaved: (b: AdminBusiness) => void }) {
  const [customerBackground, setCustomerBackground] = useState(business.theme.customerBackground);
  const [customerButton, setCustomerButton] = useState(business.theme.customerButton);
  const [dashboardBackground, setDashboardBackground] = useState(business.theme.dashboardBackground);
  const [dashboardButton, setDashboardButton] = useState(business.theme.dashboardButton);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const updated = await updateBusiness(businessId, {
        theme: { customerBackground, customerButton, dashboardBackground, dashboardButton },
      } as Partial<AdminBusiness>);
      onSaved(updated);
      // Dashboard colors are shared business-wide - apply immediately for
      // everyone on this device rather than waiting for a fresh login.
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save appearance settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      title="Appearance"
      action={
        <button onClick={handleSave} disabled={saving} className="rounded-lg bg-brass px-4 py-2.5 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
      }
    >
      <p className="text-base text-ivory-dim">
        One click, one color - matches your own brand across your customer-facing pages and, separately, your team's
        dashboard. Text color adjusts automatically so it always stays readable.
      </p>
      <ColorPairPicker
        title="Landing page, Menu & Bill"
        description="Applies everywhere a customer sees after tapping your NFC card."
        background={customerBackground}
        button={customerButton}
        onChange={({ background, button }) => { setCustomerBackground(background); setCustomerButton(button); }}
        previewVars={buildBusinessThemeVars(customerBackground, customerButton)}
      />
      <ColorPairPicker
        title="Owner/staff dashboard"
        description="Shared for your whole team - not a personal preference."
        background={dashboardBackground}
        button={dashboardButton}
        onChange={({ background, button }) => { setDashboardBackground(background); setDashboardButton(button); }}
        previewVars={buildBusinessThemeVars(dashboardBackground, dashboardButton)}
      />
      {error && <p className="text-base text-danger">{error}</p>}
    </Section>
  );
}

