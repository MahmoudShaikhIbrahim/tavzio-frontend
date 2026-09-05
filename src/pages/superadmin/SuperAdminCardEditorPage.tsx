import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { listSuperAdminDigitalCards, updateSuperAdminDigitalCard, getSuperAdminDigitalCardAnalytics } from '../../lib/authApi';
import type { DigitalCard, DigitalCardAnalytics } from '../../types';
import { Section, Field, inputClass, PrimaryButton } from '../../components/ui';

const BASE = import.meta.env.VITE_API_BASE_URL || '';
const SITE = window.location.origin;
const SOCIAL_NETWORKS = ['instagram', 'facebook', 'tiktok', 'linkedin', 'youtube', 'twitter', 'snapchat'] as const;
const TEMPLATES = ['classic', 'modern', 'luxury', 'minimal'] as const;

export default function SuperAdminCardEditorPage() {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<DigitalCard | null>(null);
  const [analytics, setAnalytics] = useState<DigitalCardAnalytics | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!cardId) return;
    // No single-card-by-id endpoint exists for super_admin (list is cheap
    // and already scoped to just this admin's own cards) - reused here
    // rather than adding a near-duplicate GET /:cardId route.
    listSuperAdminDigitalCards().then((cards) => {
      const found = cards.find((c) => c.id === cardId);
      if (found) setForm(found);
    });
    getSuperAdminDigitalCardAnalytics(cardId).then(setAnalytics);
  }, [cardId]);

  async function handleSave() {
    if (!form || !cardId) return;
    setSaving(true);
    setSaved(false);
    try {
      const updated = await updateSuperAdminDigitalCard(cardId, {
        name: form.name, title: form.title, company: form.company, description: form.description,
        logo_url: form.logo_url, photo_url: form.photo_url,
        phone: form.phone, whatsapp: form.whatsapp, email: form.email, website: form.website,
        address: form.address, location_url: form.location_url, working_hours: form.working_hours,
        contact_visibility: form.contact_visibility, social_links: form.social_links, design: form.design,
      } as never);
      setForm(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (!form) return <p className="text-ivory-dim">Loading...</p>;

  return (
    <div>
      <button type="button" onClick={() => navigate('/admin/super/digital-cards')} className="mb-4 text-sm text-ivory-dim hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">&larr; Back to cards</button>
      <h1 className="font-display text-3xl text-ivory">{form.name}</h1>
      <p className="mt-1 text-base text-ivory-dim">{SITE}/card/{form.slug}</p>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-ink-line p-4 space-y-2 shadow-sm">
            <a href={`${SITE}/card/${form.slug}`} target="_blank" rel="noreferrer" className="block text-sm text-brass hover:underline">Preview</a>
            <a href={`${BASE}/api/public/cards/${form.slug}/qr.png`} target="_blank" rel="noreferrer" className="block text-sm text-brass hover:underline">Download QR (PNG)</a>
            <a href={`${BASE}/api/public/cards/${form.slug}/qr.svg`} target="_blank" rel="noreferrer" className="block text-sm text-brass hover:underline">Download QR (SVG)</a>
            <button type="button" onClick={() => navigator.clipboard.writeText(`${SITE}/card/${form.slug}`)} className="block text-sm text-ivory-dim hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">Copy link</button>
          </div>
          {analytics && (
            <div className="rounded-2xl border border-ink-line p-4 shadow-sm">
              <p className="mb-2 text-sm font-medium text-ivory">Analytics</p>
              <div className="grid grid-cols-2 gap-2 text-sm text-ivory-dim">
                <p>Views: <span className="text-ivory">{analytics.view}</span></p>
                <p>Saved: <span className="text-ivory">{analytics.save_contact}</span></p>
                <p>WhatsApp: <span className="text-ivory">{analytics.whatsapp_click}</span></p>
                <p>Phone: <span className="text-ivory">{analytics.phone_click}</span></p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Section title="Profile">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} /></Field>
              <Field label="Job title"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} /></Field>
              <Field label="Company"><input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className={inputClass} /></Field>
              <Field label="Photo URL"><input value={form.photo_url || ''} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} className={inputClass} /></Field>
            </div>
            <Field label="Bio"><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className={inputClass} /></Field>
          </Section>

          <Section title="Contact">
            {[
              { key: 'phone', label: 'Phone' }, { key: 'whatsapp', label: 'WhatsApp' }, { key: 'email', label: 'Email' },
              { key: 'website', label: 'Website' }, { key: 'address', label: 'Address' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center gap-3">
                <label className="flex w-28 shrink-0 items-center gap-2 text-sm text-ivory-dim">
                  <input type="checkbox" checked={form.contact_visibility[key] !== false} onChange={(e) => setForm({ ...form, contact_visibility: { ...form.contact_visibility, [key]: e.target.checked } })} />
                  {label}
                </label>
                <input value={(form as never as Record<string, string>)[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value } as never)} className={inputClass} />
              </div>
            ))}
          </Section>

          <Section title="Social media">
            {SOCIAL_NETWORKS.map((network) => (
              <div key={network} className="flex items-center gap-3">
                <label className="flex w-28 shrink-0 items-center gap-2 text-sm capitalize text-ivory-dim">
                  <input type="checkbox" checked={form.social_links[network]?.enabled ?? false} onChange={(e) => setForm({ ...form, social_links: { ...form.social_links, [network]: { url: form.social_links[network]?.url || '', enabled: e.target.checked } } })} />
                  {network}
                </label>
                <input value={form.social_links[network]?.url || ''} onChange={(e) => setForm({ ...form, social_links: { ...form.social_links, [network]: { url: e.target.value, enabled: form.social_links[network]?.enabled ?? Boolean(e.target.value) } } })} className={inputClass} />
              </div>
            ))}
          </Section>

          <Section title="Design">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {TEMPLATES.map((tpl) => (
                <button type="button" key={tpl} onClick={() => setForm({ ...form, design: { ...form.design, template: tpl } })} className={`rounded-lg border px-3 py-3 text-sm capitalize ${form.design.template === tpl ? 'border-brass text-brass' : 'border-ink-line text-ivory-dim'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass`}>
                  {tpl}
                </button>
              ))}
            </div>
            <div className="flex gap-6 pt-2">
              <label className="flex flex-col items-center gap-1.5">
                <span className="text-sm text-ivory-dim">Primary</span>
                <input type="color" value={form.design.primaryColor || '#b8925a'} onChange={(e) => setForm({ ...form, design: { ...form.design, primaryColor: e.target.value } })} className="h-11 w-11 rounded-full border border-ink-line bg-transparent p-0" />
              </label>
              <label className="flex flex-col items-center gap-1.5">
                <span className="text-sm text-ivory-dim">Background</span>
                <input type="color" value={form.design.secondaryColor || '#141110'} onChange={(e) => setForm({ ...form, design: { ...form.design, secondaryColor: e.target.value } })} className="h-11 w-11 rounded-full border border-ink-line bg-transparent p-0" />
              </label>
            </div>
          </Section>

          <div className="flex items-center gap-3">
            <PrimaryButton type="button" disabled={saving} onClick={handleSave}>{saving ? 'Saving...' : 'Save card'}</PrimaryButton>
            {saved && <p className="text-sm text-success">Saved.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
