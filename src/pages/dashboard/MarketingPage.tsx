import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import {
  getBusiness,
  listMarketingTemplates, createMarketingTemplate, deleteMarketingTemplate,
  listCampaigns, createCampaign, sendCampaign, cancelCampaign, getCampaignStats,
  listSuppressions, removeSuppression,
} from '../../lib/authApi';
import type { AdminBusiness, MarketingTemplate, MarketingCampaign, MarketingCampaignStats, MarketingSuppression } from '../../types';
import { Section, Field, inputClass, PrimaryButton, ActionButton } from '../../components/ui';

export default function MarketingPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [business, setBusiness] = useState<AdminBusiness | null>(null);

  useEffect(() => {
    if (businessId) getBusiness(businessId).then(setBusiness);
  }, [businessId]);

  if (!businessId || !business) return <p className="text-ivory-dim">Loading...</p>;

  if (!business.features.marketing?.enabled) {
    return (
      <div className="max-w-lg space-y-3">
        <h1 className="font-display text-3xl text-ivory">Marketing</h1>
        <p className="text-base text-ivory-dim">Turned off for your business. Turn it on under Features to send campaigns.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ivory">Marketing</h1>
        <p className="mt-1 text-base text-ivory-dim">Owner-only.</p>
      </div>
      <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm text-ivory-dim">
        Email campaigns send for real through your connected Gmail account. SMS campaigns can be built and staged here, but sending isn't connected yet - there's no SMS provider on this account. Connect one (e.g. Twilio) to enable real SMS sending.
      </div>
      <CampaignsSection businessId={businessId} category={business.category} />
      <TemplatesSection businessId={businessId} />
      <SuppressionsSection businessId={businessId} />
    </div>
  );
}

function CampaignsSection({ businessId, category }: { businessId: string; category: string }) {
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  function reload() {
    setLoading(true);
    listCampaigns(businessId).then(setCampaigns).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(reload, [businessId]);

  return (
    <Section title="Campaigns" action={<ActionButton onClick={() => setCreating(!creating)}>{creating ? 'Cancel' : 'New campaign'}</ActionButton>}>
      {creating && <NewCampaignForm businessId={businessId} category={category} onSaved={() => { setCreating(false); reload(); }} />}
      {loading && <p className="text-ivory-dim">Loading...</p>}
      {!loading && (
        <div className="space-y-2">
          {campaigns.map((c) => <CampaignRow key={c.id} businessId={businessId} campaign={c} onChanged={reload} />)}
          {campaigns.length === 0 && !creating && <p className="text-ivory-dim">No campaigns yet.</p>}
        </div>
      )}
    </Section>
  );
}

function NewCampaignForm({ businessId, category, onSaved }: { businessId: string; category: string; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<'email' | 'sms'>('email');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'all_hotel_guests' | 'all_loyalty_members' | 'manual'>(category === 'hotel' ? 'all_hotel_guests' : 'all_loyalty_members');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ recipientCount?: number; suppressedCount?: number } | null>(null);

  async function handleSave() {
    if (!name || !body) { setError('Name and body are required'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await createCampaign(businessId, { name, channel, subject, body, audience });
      setResult(res);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create campaign');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-ink-line p-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Campaign name"><input value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} w-48`} /></Field>
        <Field label="Channel">
          <select value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)} className={`${inputClass} w-32`}>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
          </select>
        </Field>
        <Field label="Audience">
          <select value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)} className={`${inputClass} w-48`}>
            {category === 'hotel' && <option value="all_hotel_guests">All hotel guests</option>}
            <option value="all_loyalty_members">All loyalty members (phone/SMS only)</option>
          </select>
        </Field>
      </div>
      {channel === 'email' && <div className="mt-3"><Field label="Subject"><input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} /></Field></div>}
      <div className="mt-3">
        <Field label="Message">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className={inputClass} />
        </Field>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <PrimaryButton onClick={handleSave} disabled={saving}>{saving ? 'Building...' : 'Build campaign'}</PrimaryButton>
      </div>
      {result && <p className="mt-2 text-sm text-success">Built with {result.recipientCount} recipient(s){result.suppressedCount ? `, ${result.suppressedCount} suppressed` : ''}.</p>}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

const STATUS_COLOR: Record<MarketingCampaign['status'], string> = {
  draft: 'text-ivory-dim',
  scheduled: 'text-brass',
  sending: 'text-warning',
  sent: 'text-success',
  cancelled: 'text-danger',
};

function CampaignRow({ businessId, campaign, onChanged }: { businessId: string; campaign: MarketingCampaign; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<MarketingCampaignStats | null>(null);
  const [showStats, setShowStats] = useState(false);

  async function handleSend() {
    setBusy(true);
    setError('');
    try {
      await sendCampaign(businessId, campaign.id);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    setBusy(true);
    try {
      await cancelCampaign(businessId, campaign.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function toggleStats() {
    if (!showStats) {
      const s = await getCampaignStats(businessId, campaign.id);
      setStats(s);
    }
    setShowStats(!showStats);
  }

  return (
    <div className="rounded-lg border border-ink-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-base text-ivory">{campaign.name} <span className="text-sm text-ivory-dim">({campaign.channel})</span></p>
          <button type="button" onClick={toggleStats} className={`text-sm capitalize ${STATUS_COLOR[campaign.status]} hover:underline`}>{campaign.status}</button>
        </div>
        <div className="flex gap-2">
          {['draft', 'scheduled'].includes(campaign.status) && (
            <>
              <ActionButton danger onClick={handleCancel} disabled={busy}>Cancel</ActionButton>
              <PrimaryButton onClick={handleSend} disabled={busy}>{busy ? 'Sending...' : 'Send now'}</PrimaryButton>
            </>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {showStats && stats && (
        <div className="mt-2 flex gap-4 text-sm text-ivory-dim">
          <span>Total: {stats.total}</span>
          {Object.entries(stats.byStatus).map(([status, count]) => <span key={status} className="capitalize">{status}: {count}</span>)}
        </div>
      )}
    </div>
  );
}

function TemplatesSection({ businessId }: { businessId: string }) {
  const [templates, setTemplates] = useState<MarketingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<'email' | 'sms'>('email');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<MarketingTemplate['category']>('general');

  function reload() {
    setLoading(true);
    listMarketingTemplates(businessId).then(setTemplates).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(reload, [businessId]);

  async function handleAdd() {
    if (!name || !body) return;
    await createMarketingTemplate(businessId, { name, channel, subject, body, category });
    setName(''); setSubject(''); setBody(''); setAdding(false);
    reload();
  }

  async function handleDelete(id: string) {
    await deleteMarketingTemplate(businessId, id);
    reload();
  }

  return (
    <Section title="Templates" action={<ActionButton onClick={() => setAdding(!adding)}>{adding ? 'Cancel' : 'New template'}</ActionButton>}>
      {adding && (
        <div className="rounded-lg border border-ink-line p-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} w-48`} /></Field>
            <Field label="Channel">
              <select value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)} className={`${inputClass} w-32`}>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </select>
            </Field>
            <Field label="Category">
              <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className={`${inputClass} w-40`}>
                <option value="general">General</option>
                <option value="welcome">Welcome</option>
                <option value="birthday">Birthday</option>
                <option value="win_back">Win-back</option>
                <option value="review_request">Review request</option>
                <option value="promotion">Promotion</option>
              </select>
            </Field>
          </div>
          {channel === 'email' && <div className="mt-3"><Field label="Subject"><input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} /></Field></div>}
          <div className="mt-3"><Field label="Body"><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className={inputClass} /></Field></div>
          <PrimaryButton onClick={handleAdd}>Save template</PrimaryButton>
        </div>
      )}
      {loading && <p className="text-ivory-dim">Loading...</p>}
      {!loading && (
        <div className="grid gap-2 sm:grid-cols-2">
          {templates.map((t) => (
            <div key={t.id} className="rounded-lg border border-ink-line p-3">
              <p className="text-base text-ivory">{t.name} <span className="text-sm text-ivory-dim">({t.channel}, {t.category})</span></p>
              <p className="mt-1 text-sm text-ivory-dim line-clamp-2">{t.body}</p>
              <button type="button" onClick={() => handleDelete(t.id)} className="mt-1 text-sm text-danger hover:underline">Delete</button>
            </div>
          ))}
          {templates.length === 0 && <p className="text-ivory-dim">No templates yet.</p>}
        </div>
      )}
    </Section>
  );
}

function SuppressionsSection({ businessId }: { businessId: string }) {
  const [suppressions, setSuppressions] = useState<MarketingSuppression[]>([]);
  const [loading, setLoading] = useState(true);

  function reload() {
    setLoading(true);
    listSuppressions(businessId).then(setSuppressions).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(reload, [businessId]);

  async function handleRemove(id: string) {
    await removeSuppression(businessId, id);
    reload();
  }

  return (
    <Section title="Suppression list">
      <p className="text-sm text-ivory-dim">Contacts here are excluded from every future campaign, regardless of audience.</p>
      {loading && <p className="text-ivory-dim">Loading...</p>}
      {!loading && (
        <div className="space-y-1">
          {suppressions.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-ink-line px-3 py-2 text-sm">
              <span className="text-ivory">{s.contact_value} <span className="text-ivory-dim">({s.channel}, {s.reason})</span></span>
              <button type="button" onClick={() => handleRemove(s.id)} className="text-danger hover:underline">Remove</button>
            </div>
          ))}
          {suppressions.length === 0 && <p className="text-ivory-dim">Nobody suppressed.</p>}
        </div>
      )}
    </Section>
  );
}
