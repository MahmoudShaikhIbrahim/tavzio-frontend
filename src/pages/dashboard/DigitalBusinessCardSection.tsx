import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import {
  getBusinessDigitalCard, createBusinessDigitalCard, updateBusinessDigitalCard, getBusinessDigitalCardAnalytics,
} from '../../lib/authApi';
import type { DigitalCard, DigitalCardAnalytics } from '../../types';
import { Section, Field, inputClass, PrimaryButton } from '../../components/ui';

const BASE = import.meta.env.VITE_API_BASE_URL || '';
const SITE = window.location.origin;

const SOCIAL_NETWORKS = ['instagram', 'facebook', 'tiktok', 'linkedin', 'youtube', 'twitter', 'snapchat'] as const;
const TEMPLATES = ['classic', 'modern', 'luxury', 'minimal'] as const;

export default function DigitalBusinessCardSection({ businessId }: { businessId: string }) {
  const { user } = useSession();
  const { t } = useT();
  const canEdit = user?.role === 'business_owner' || user?.role === 'super_admin';
  const [card, setCard] = useState<DigitalCard | null | undefined>(undefined); // undefined = loading
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    getBusinessDigitalCard(businessId).then(setCard);
  }, [businessId]);

  async function handleCreate() {
    setCreating(true);
    try {
      const created = await createBusinessDigitalCard(businessId);
      setCard(created);
    } finally {
      setCreating(false);
    }
  }

  if (card === undefined) return <p className="text-ivory-dim">{t('Loading...')}</p>;

  if (!card) {
    return (
      <Section title={t('Digital Business Card')}>
        <p className="text-base text-ivory-dim">
          {t('Your digital identity, always available and easy to share - one link works for your QR code, NFC stands, and social bios, and updates instantly whenever you change your details.')}
        </p>
        {canEdit ? (
          <PrimaryButton type="button" disabled={creating} onClick={handleCreate}>
            {creating ? t('Creating...') : t('Create Digital Business Card')}
          </PrimaryButton>
        ) : (
          <p className="text-base text-ivory-dim">{t('No digital card has been created yet - ask a business owner to set one up.')}</p>
        )}
      </Section>
    );
  }

  return <CardEditor businessId={businessId} card={card} canEdit={canEdit} onSaved={setCard} />;
}

function CardEditor({ businessId, card, canEdit, onSaved }: {
  businessId: string; card: DigitalCard; canEdit: boolean; onSaved: (c: DigitalCard) => void;
}) {
  const { t } = useT();
  const [form, setForm] = useState<DigitalCard>(card);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [analytics, setAnalytics] = useState<DigitalCardAnalytics | null>(null);

  useEffect(() => { setForm(card); }, [card]);
  useEffect(() => { getBusinessDigitalCardAnalytics(businessId, card.id).then(setAnalytics); }, [businessId, card.id]);

  const publicUrl = `${SITE}/card/${card.slug}`;

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const updated = await updateBusinessDigitalCard(businessId, card.id, {
        name: form.name, title: form.title, company: form.company, description: form.description,
        logo_url: form.logo_url, photo_url: form.photo_url,
        phone: form.phone, whatsapp: form.whatsapp, email: form.email, website: form.website,
        address: form.address, location_url: form.location_url, working_hours: form.working_hours,
        contact_visibility: form.contact_visibility, social_links: form.social_links, design: form.design,
      } as never);
      onSaved(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublishToggle() {
    setSaving(true);
    try {
      const updated = await updateBusinessDigitalCard(businessId, card.id, { status: form.status === 'active' ? 'inactive' : 'active' } as never);
      onSaved(updated);
      setForm(updated);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr] lg:items-start">
      <div className="lg:sticky lg:top-6 space-y-4">
        <CardPreview form={form} />
        <div className="rounded-xl border border-ink-line p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ivory-dim">{t('Status')}</span>
            <span className={`text-sm font-medium ${form.status === 'active' ? 'text-success' : 'text-ivory-dim'}`}>
              {form.status === 'active' ? t('Live') : t('Not published')}
            </span>
          </div>
          {canEdit && (
            <button type="button" onClick={handlePublishToggle} disabled={saving} className="w-full rounded-lg border border-ink-line px-3 py-2 text-sm text-ivory hover:border-brass disabled:opacity-50">
              {form.status === 'active' ? t('Unpublish') : t('Publish card')}
            </button>
          )}
          <div className="space-y-1.5 border-t border-ink-line pt-3">
            <p className="text-sm text-ivory-dim">{t('Public link')}</p>
            <div className="flex gap-2">
              <input readOnly value={publicUrl} className={`${inputClass} text-sm`} onFocus={(e) => e.target.select()} />
              <button type="button" onClick={() => navigator.clipboard.writeText(publicUrl)} className="shrink-0 rounded-lg border border-ink-line px-3 text-sm text-ivory-dim hover:text-ivory">
                {t('Copy')}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <a href={publicUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-ink-line px-3 py-1.5 text-sm text-ivory-dim hover:text-ivory">{t('Preview')}</a>
            <a href={`${BASE}/api/public/cards/${card.slug}/qr.png`} target="_blank" rel="noreferrer" className="rounded-lg border border-ink-line px-3 py-1.5 text-sm text-ivory-dim hover:text-ivory">{t('QR (PNG)')}</a>
            <a href={`${BASE}/api/public/cards/${card.slug}/qr.svg`} target="_blank" rel="noreferrer" className="rounded-lg border border-ink-line px-3 py-1.5 text-sm text-ivory-dim hover:text-ivory">{t('QR (SVG)')}</a>
          </div>
        </div>
        {analytics && <AnalyticsPanel analytics={analytics} />}
      </div>

      <div className="space-y-6">
        <fieldset disabled={!canEdit} className="space-y-6 disabled:opacity-70">
          <Section title={t('Business information')}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('Name')}><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} /></Field>
              <Field label={t('Category / tagline')}><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} /></Field>
            </div>
            <Field label={t('Description')}>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} maxLength={500} className={inputClass} />
            </Field>
          </Section>

          <Section title={t('Contact information')}>
            <p className="text-sm text-ivory-dim">{t('Toggle which details actually show on the public card.')}</p>
            {[
              { key: 'phone', label: t('Phone') },
              { key: 'whatsapp', label: t('WhatsApp') },
              { key: 'email', label: t('Email') },
              { key: 'website', label: t('Website') },
              { key: 'address', label: t('Address') },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center gap-3">
                <label className="flex w-32 shrink-0 items-center gap-2 text-sm text-ivory-dim">
                  <input
                    type="checkbox"
                    checked={form.contact_visibility[key] !== false}
                    onChange={(e) => setForm({ ...form, contact_visibility: { ...form.contact_visibility, [key]: e.target.checked } })}
                  />
                  {label}
                </label>
                <input
                  value={(form as never as Record<string, string>)[key] || ''}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value } as never)}
                  className={inputClass}
                  placeholder={label}
                />
              </div>
            ))}
            <Field label={t('Working hours (optional)')}>
              <input value={form.working_hours} onChange={(e) => setForm({ ...form, working_hours: e.target.value })} placeholder={t('e.g. Daily 9am - 11pm')} className={inputClass} />
            </Field>
            <Field label={t('Google Maps link (optional)')}>
              <input value={form.location_url} onChange={(e) => setForm({ ...form, location_url: e.target.value })} placeholder="https://maps.google.com/..." className={inputClass} />
            </Field>
          </Section>

          <Section title={t('Social media')}>
            {SOCIAL_NETWORKS.map((network) => (
              <div key={network} className="flex items-center gap-3">
                <label className="flex w-28 shrink-0 items-center gap-2 text-sm capitalize text-ivory-dim">
                  <input
                    type="checkbox"
                    checked={form.social_links[network]?.enabled ?? false}
                    onChange={(e) => setForm({
                      ...form,
                      social_links: { ...form.social_links, [network]: { url: form.social_links[network]?.url || '', enabled: e.target.checked } },
                    })}
                  />
                  {network}
                </label>
                <input
                  value={form.social_links[network]?.url || ''}
                  onChange={(e) => setForm({
                    ...form,
                    social_links: { ...form.social_links, [network]: { url: e.target.value, enabled: form.social_links[network]?.enabled ?? Boolean(e.target.value) } },
                  })}
                  placeholder={`https://${network}.com/...`}
                  className={inputClass}
                />
              </div>
            ))}
          </Section>

          <Section title={t('Design')}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {TEMPLATES.map((tpl) => (
                <button
                  type="button"
                  key={tpl}
                  onClick={() => setForm({ ...form, design: { ...form.design, template: tpl } })}
                  className={`rounded-lg border px-3 py-3 text-sm capitalize ${form.design.template === tpl ? 'border-brass text-brass' : 'border-ink-line text-ivory-dim hover:text-ivory'}`}
                >
                  {t(tpl)}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-6 pt-2">
              <label className="flex flex-col items-center gap-1.5">
                <span className="text-sm text-ivory-dim">{t('Primary color')}</span>
                <input type="color" value={form.design.primaryColor || '#b8925a'} onChange={(e) => setForm({ ...form, design: { ...form.design, primaryColor: e.target.value } })} className="h-11 w-11 cursor-pointer rounded-full border border-ink-line bg-transparent p-0" />
              </label>
              <label className="flex flex-col items-center gap-1.5">
                <span className="text-sm text-ivory-dim">{t('Background')}</span>
                <input type="color" value={form.design.secondaryColor || '#141110'} onChange={(e) => setForm({ ...form, design: { ...form.design, secondaryColor: e.target.value } })} className="h-11 w-11 cursor-pointer rounded-full border border-ink-line bg-transparent p-0" />
              </label>
            </div>
          </Section>
        </fieldset>

        {canEdit && (
          <div className="flex items-center gap-3">
            <PrimaryButton type="button" disabled={saving} onClick={handleSave}>{saving ? t('Saving...') : t('Save card')}</PrimaryButton>
            {saved && <p className="text-sm text-success">{t('Saved.')}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function AnalyticsPanel({ analytics }: { analytics: DigitalCardAnalytics }) {
  const { t } = useT();
  const rows: [string, number][] = [
    [t('Card views'), analytics.view],
    [t('Contacts saved'), analytics.save_contact],
    [t('WhatsApp clicks'), analytics.whatsapp_click],
    [t('Phone clicks'), analytics.phone_click],
    [t('Website clicks'), analytics.website_click],
    [t('Shares'), analytics.share],
  ];
  return (
    <div className="rounded-xl border border-ink-line p-4">
      <p className="mb-2 text-sm font-medium text-ivory">{t('Analytics')}</p>
      <div className="grid grid-cols-2 gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-ink-soft/50 px-3 py-2">
            <p className="text-lg font-display text-brass">{value}</p>
            <p className="text-xs text-ivory-dim">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// A compact live preview - the same visual language the public card uses,
// scaled down, so an owner isn't guessing what they're about to publish.
function CardPreview({ form }: { form: DigitalCard }) {
  const primary = form.design.primaryColor || '#b8925a';
  const bg = form.design.secondaryColor || '#141110';
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-line shadow-xl" style={{ background: bg }}>
      <div className="flex flex-col items-center px-6 py-8 text-center">
        <div className="h-16 w-16 overflow-hidden rounded-full border-2" style={{ borderColor: primary }}>
          {(form.photo_url || form.logo_url) ? (
            <img src={form.photo_url || form.logo_url || ''} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-display text-xl text-ivory-dim">{form.name?.[0]?.toUpperCase() || '?'}</div>
          )}
        </div>
        <p className="mt-3 font-display text-lg text-ivory">{form.name || 'Card name'}</p>
        {form.title && <p className="text-xs uppercase tracking-widest" style={{ color: primary }}>{form.title}</p>}
        {form.description && <p className="mt-2 text-xs text-ivory-dim/80 line-clamp-3">{form.description}</p>}
        <div className="mt-4 flex gap-2">
          {['Call', 'WhatsApp', 'Save'].map((label) => (
            <span key={label} className="rounded-full px-3 py-1 text-xs text-ink" style={{ background: primary }}>{label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
