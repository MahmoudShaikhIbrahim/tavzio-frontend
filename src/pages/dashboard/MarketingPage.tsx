import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import {
  getBusiness,
  listMarketingTemplates, createMarketingTemplate, deleteMarketingTemplate,
  listCampaigns, createCampaign, sendCampaign, cancelCampaign, getCampaignStats,
  listSuppressions, removeSuppression,
} from '../../lib/authApi';
import type { AdminBusiness, MarketingTemplate, MarketingCampaign, MarketingCampaignStats, MarketingSuppression } from '../../types';
import { Section, Field, inputClass, PrimaryButton, ActionButton } from '../../components/ui';
import { useConfirm } from '../../components/ConfirmDialog';

export default function MarketingPage() {
  const { t } = useT();
  const { user } = useSession();
  const businessId = user?.business_id;
  const [business, setBusiness] = useState<AdminBusiness | null>(null);

  useEffect(() => {
    if (businessId) getBusiness(businessId).then(setBusiness);
  }, [businessId]);

  if (!businessId || !business) return <p className="text-ivory-dim">{t('Loading...')}</p>;

  if (!business.features.marketing?.enabled) {
    return (
      <div className="max-w-lg space-y-3">
        <h1 className="font-display text-3xl text-ivory">{t('Marketing')}</h1>
        <p className="text-base text-ivory-dim">{t('Turned off for your business. Turn it on under Features to send campaigns.')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ivory">{t('Marketing')}</h1>
        <p className="mt-1 text-base text-ivory-dim">{t('Owner-only.')}</p>
      </div>
      <div className="rounded-2xl border border-warning/30 bg-warning/5 p-4 text-sm text-ivory-dim shadow-sm">
        {t('Email campaigns send for real through your connected Gmail account. SMS campaigns can be built and staged here, but sending isn\'t connected yet - there\'s no SMS provider on this account. Connect one (e.g. Twilio) to enable real SMS sending.')}
      </div>
      <CampaignsSection businessId={businessId} category={business.category} />
      <TemplatesSection businessId={businessId} />
      <SuppressionsSection businessId={businessId} />
    </div>
  );
}

function CampaignsSection({ businessId, category }: { businessId: string; category: string }) {
  const { t } = useT();
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  function reload() {
    setLoading(true);
    listCampaigns(businessId).then(setCampaigns).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(reload, [businessId]);

  return (
    <Section title={t('Campaigns')} action={<ActionButton onClick={() => setCreating(!creating)}>{creating ? t('Cancel') : t('New campaign')}</ActionButton>}>
      {creating && <NewCampaignForm businessId={businessId} category={category} onSaved={() => { setCreating(false); reload(); }} />}
      {loading && <p className="text-ivory-dim">{t('Loading...')}</p>}
      {!loading && (
        <div className="space-y-2">
          {campaigns.map((c) => <CampaignRow key={c.id} businessId={businessId} campaign={c} onChanged={reload} />)}
          {campaigns.length === 0 && !creating && <p className="text-ivory-dim">{t('No campaigns yet.')}</p>}
        </div>
      )}
    </Section>
  );
}

function NewCampaignForm({ businessId, category, onSaved }: { businessId: string; category: string; onSaved: () => void }) {
  const { t } = useT();
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<'email' | 'sms'>('email');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'all_hotel_guests' | 'all_loyalty_members' | 'manual'>(category === 'hotel' ? 'all_hotel_guests' : 'all_loyalty_members');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ recipientCount?: number; suppressedCount?: number } | null>(null);

  async function handleSave() {
    if (!name || !body) { setError(t('Name and body are required')); return; }
    setSaving(true);
    setError('');
    try {
      const res = await createCampaign(businessId, { name, channel, subject, body, audience });
      setResult(res);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Could not create campaign'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-ink-line p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t('Campaign name')}><input value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} w-48`} /></Field>
        <Field label={t('Channel')}>
          <select value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)} className={`${inputClass} w-32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass`}>
            <option value="email">{t('Email')}</option>
            <option value="sms">{t('SMS')}</option>
          </select>
        </Field>
        <Field label={t('Audience')}>
          <select value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)} className={`${inputClass} w-48 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass`}>
            {category === 'hotel' && <option value="all_hotel_guests">{t('All hotel guests')}</option>}
            <option value="all_loyalty_members">{t('All loyalty members (phone/SMS only)')}</option>
          </select>
        </Field>
      </div>
      {channel === 'email' && <div className="mt-3"><Field label={t('Subject')}><input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} /></Field></div>}
      <div className="mt-3">
        <Field label={t('Message')}>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className={inputClass} />
        </Field>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <PrimaryButton onClick={handleSave} disabled={saving}>{saving ? t('Building...') : t('Build campaign')}</PrimaryButton>
      </div>
      {result && <p className="mt-2 text-sm text-success">{t('Built with')} {result.recipientCount} {t('recipient(s)')}{result.suppressedCount ? `, ${result.suppressedCount} ${t('suppressed')}` : ''}.</p>}
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
  const { t } = useT();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<MarketingCampaignStats | null>(null);
  const [showStats, setShowStats] = useState(false);

  async function handleSend() {
    // Sending reaches a real audience for real, right now, and can't be
    // recalled once it goes out - the single most consequential action
    // on this whole page, so it gets the same confirm-first treatment
    // as every other hard-to-undo action in the dashboard.
    if (!(await confirm({
      title: t('Send this campaign now?'),
      message: `${t('This sends')} "${campaign.name}" ${t('to its real audience immediately. This cannot be undone or recalled once sent.')}`,
      confirmLabel: t('Send now'),
      danger: true,
    }))) return;
    setBusy(true);
    setError('');
    try {
      await sendCampaign(businessId, campaign.id);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Send failed'));
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
    <div className="rounded-2xl border border-ink-line p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-base text-ivory">{campaign.name} <span className="text-sm text-ivory-dim">({campaign.channel})</span></p>
          <button type="button" onClick={toggleStats} className={`text-sm capitalize ${STATUS_COLOR[campaign.status]} hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass`}>{campaign.status}</button>
        </div>
        <div className="flex gap-2">
          {['draft', 'scheduled'].includes(campaign.status) && (
            <>
              <ActionButton danger onClick={handleCancel} disabled={busy}>{t('Cancel')}</ActionButton>
              <PrimaryButton onClick={handleSend} disabled={busy}>{busy ? t('Sending...') : t('Send now')}</PrimaryButton>
            </>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {showStats && stats && (
        <div className="mt-2 flex gap-4 text-sm text-ivory-dim">
          <span>{t('Total')}: {stats.total}</span>
          {Object.entries(stats.byStatus).map(([status, count]) => <span key={status} className="capitalize">{status}: {count}</span>)}
        </div>
      )}
    </div>
  );
}

function TemplatesSection({ businessId }: { businessId: string }) {
  const { t } = useT();
  const confirm = useConfirm();
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

  async function handleDelete(id: string, name: string) {
    if (!(await confirm({ title: t('Delete this template?'), message: `${t('Delete')} "${name}"? ${t('This cannot be undone.')}`, confirmLabel: t('Delete'), danger: true }))) return;
    await deleteMarketingTemplate(businessId, id);
    reload();
  }

  return (
    <Section title={t('Templates')} action={<ActionButton onClick={() => setAdding(!adding)}>{adding ? t('Cancel') : t('New template')}</ActionButton>}>
      {adding && (
        <div className="rounded-2xl border border-ink-line p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t('Name')}><input value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} w-48`} /></Field>
            <Field label={t('Channel')}>
              <select value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)} className={`${inputClass} w-32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass`}>
                <option value="email">{t('Email')}</option>
                <option value="sms">{t('SMS')}</option>
              </select>
            </Field>
            <Field label={t('Category')}>
              <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className={`${inputClass} w-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass`}>
                <option value="general">{t('General')}</option>
                <option value="welcome">{t('Welcome')}</option>
                <option value="birthday">{t('Birthday')}</option>
                <option value="win_back">{t('Win-back')}</option>
                <option value="review_request">{t('Review request')}</option>
                <option value="promotion">{t('Promotion')}</option>
              </select>
            </Field>
          </div>
          {channel === 'email' && <div className="mt-3"><Field label={t('Subject')}><input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} /></Field></div>}
          <div className="mt-3"><Field label={t('Body')}><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className={inputClass} /></Field></div>
          <PrimaryButton onClick={handleAdd}>{t('Save template')}</PrimaryButton>
        </div>
      )}
      {loading && <p className="text-ivory-dim">{t('Loading...')}</p>}
      {!loading && (
        <div className="grid gap-2 sm:grid-cols-2">
          {templates.map((tpl) => (
            <div key={tpl.id} className="rounded-2xl border border-ink-line p-3 shadow-sm">
              <p className="text-base text-ivory">{tpl.name} <span className="text-sm text-ivory-dim">({tpl.channel}, {tpl.category})</span></p>
              <p className="mt-1 text-sm text-ivory-dim line-clamp-2">{tpl.body}</p>
              <button type="button" onClick={() => handleDelete(tpl.id, tpl.name)} className="mt-1 text-sm text-danger hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">{t('Delete')}</button>
            </div>
          ))}
          {templates.length === 0 && <p className="text-ivory-dim">{t('No templates yet.')}</p>}
        </div>
      )}
    </Section>
  );
}

function SuppressionsSection({ businessId }: { businessId: string }) {
  const { t } = useT();
  const confirm = useConfirm();
  const [suppressions, setSuppressions] = useState<MarketingSuppression[]>([]);
  const [loading, setLoading] = useState(true);

  function reload() {
    setLoading(true);
    listSuppressions(businessId).then(setSuppressions).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(reload, [businessId]);

  async function handleRemove(id: string, contact: string) {
    // Removing someone from suppression puts them back into future
    // campaigns - a real, not-easily-undone consequence if they'd
    // previously opted out or unsubscribed, so this asks first rather
    // than acting on a single misclick.
    if (!(await confirm({ title: t('Remove from suppression list?'), message: `${t('Allow future campaigns to reach')} ${contact} ${t('again? Make sure this is intentional (e.g. not someone who unsubscribed).')}`, confirmLabel: t('Remove'), danger: true }))) return;
    await removeSuppression(businessId, id);
    reload();
  }

  return (
    <Section title={t('Suppression list')}>
      <p className="text-sm text-ivory-dim">{t('Contacts here are excluded from every future campaign, regardless of audience.')}</p>
      {loading && <p className="text-ivory-dim">{t('Loading...')}</p>}
      {!loading && (
        <div className="space-y-1">
          {suppressions.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-2xl border border-ink-line px-3 py-2 text-sm shadow-sm">
              <span className="text-ivory">{s.contact_value} <span className="text-ivory-dim">({s.channel}, {s.reason})</span></span>
              <button type="button" onClick={() => handleRemove(s.id, s.contact_value)} className="text-danger hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">{t('Remove')}</button>
            </div>
          ))}
          {suppressions.length === 0 && <p className="text-ivory-dim">{t('Nobody suppressed.')}</p>}
        </div>
      )}
    </Section>
  );
}
