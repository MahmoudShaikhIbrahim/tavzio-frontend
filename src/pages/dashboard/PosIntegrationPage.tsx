import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import { getPosIntegration, getPosIntegrationStatus, upsertPosIntegration, togglePosIntegration } from '../../lib/authApi';
import type { PosProvider } from '../../types';
import { Section, Field, inputClass } from '../../components/ui';
import PasswordField from '../../components/PasswordField';

// Fields whose key implies a real credential, not a plain identifier -
// masked by default with the same show/hide pattern as AdminLogin's
// own password field, rather than sitting visible in a text box.
const SECRET_FIELD_KEYS = new Set(['accessToken', 'authHeaderValue']);

// `label` kept in the signature for call-site parity (aria context is
// obvious from the surrounding field already) - PasswordField doesn't need it.
function SecretField({ value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <PasswordField value={value} onChange={onChange} required={false} autoComplete="off" />;
}

// Only the providers actually wired for 'ordering' purpose (pushing a
// live order out to an external POS) - confirmed directly against
// posDispatcher.js's ORDER_ADAPTERS map, not assumed. Zenoti/Fresha are
// booking-purpose providers, a different integration entirely.
const PROVIDERS: { key: PosProvider; label: string; note?: string }[] = [
  { key: 'square', label: 'Square' },
  { key: 'foodics', label: 'Foodics', note: 'Foodics gates their full API docs behind a paid developer tier - this connects with whatever credentials you have, but Tavzio hasn\'t been able to verify the exact request format against their real documentation yet.' },
  { key: 'loyverse', label: 'Loyverse', note: 'Mostly working - one known gap: Loyverse identifies menu items by their own internal variant_id, which isn\'t yet mapped from Tavzio\'s menu items automatically.' },
  { key: 'custom', label: 'Custom (webhook)', note: 'Sends every order to any endpoint you control - works with anything that can receive a webhook, no specific POS brand required.' },
];

export default function PosIntegrationPage() {
  const { user } = useSession();
  const { t } = useT();
  const businessId = user?.business_id;
  const [provider, setProvider] = useState<PosProvider>('square');
  const [enabled, setEnabled] = useState(false);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ status: string; lastSyncedAt: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toggleError, setToggleError] = useState('');
  const [loaded, setLoaded] = useState(false);
  // Real fix for a confirmed bug: the toggle button was always visible
  // and clickable even before any connection details had ever been
  // saved - clicking it flipped the button optimistically, then
  // silently flipped back the instant the backend's real 404 came in
  // ("No integration configured yet... ask the platform operator to set
  // one up first"), with zero explanation shown anywhere. Tracking
  // whether a real config exists yet (getPosIntegration returns null
  // until the first Save) lets the toggle be honest about why it can't
  // work yet, instead of pretending to be a working switch.
  const [configured, setConfigured] = useState(false);

  function reload() {
    if (!businessId) return;
    getPosIntegration(businessId, 'ordering')
      .then((data) => {
        if (data) {
          setProvider(data.provider);
          setEnabled(data.enabled);
          setConfig(data.config || {});
          setConfigured(true);
        }
        setLoaded(true);
      })
      .catch((err) => {
        // Without this, a failed request left the page stuck on
        // "Loading..." forever with no way to tell what went wrong -
        // exactly what was happening when the encryption key was
        // missing and decrypting an existing config threw.
        setError(err instanceof Error ? err.message : t('Could not load this integration'));
        setLoaded(true);
      });
    getPosIntegrationStatus(businessId, 'ordering')
      .then((s) => setStatus(s ? { status: s.status, lastSyncedAt: s.last_synced_at } : null))
      .catch(() => {});
  }
  useEffect(reload, [businessId]);

  const fieldsByProvider: Record<PosProvider, { key: string; label: string }[]> = {
    foodics: [{ key: 'accessToken', label: 'Access Token' }, { key: 'branchId', label: 'Branch ID' }],
    square: [{ key: 'accessToken', label: 'Access Token' }, { key: 'locationId', label: 'Location ID' }, { key: 'currency', label: 'Currency (e.g. AED)' }],
    loyverse: [{ key: 'accessToken', label: 'Access Token' }, { key: 'storeId', label: 'Store ID' }],
    custom: [
      { key: 'endpoint', label: 'Webhook URL' },
      { key: 'authHeaderName', label: 'Auth header name (optional)' },
      { key: 'authHeaderValue', label: 'Auth header value (optional)' },
      { key: 'bodyTemplate', label: 'Body template (optional - leave blank for default JSON)' },
      { key: 'responseIdPath', label: 'Response field for external order ID (optional)' },
    ],
    zenoti: [], fresha: [], tap: [], printnode: [],
  };

  async function handleSave() {
    if (!businessId) return;
    setSaving(true);
    setError('');
    try {
      await upsertPosIntegration(businessId, 'ordering', provider, enabled, config);
      setConfigured(true);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Could not save this integration'));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle() {
    if (!businessId) return;
    const next = !enabled;
    setEnabled(next);
    setToggleError('');
    try {
      await togglePosIntegration(businessId, 'ordering', next);
      reload();
    } catch (err) {
      setEnabled(!next);
      setToggleError(err instanceof Error ? err.message : t('Could not update this integration'));
    }
  }

  if (!businessId || !loaded) return <p className="text-ivory-dim">Loading...</p>;

  const providerNote = PROVIDERS.find((p) => p.key === provider)?.note;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ivory">{t('POS Integration')}</h1>
        <p className="mt-1 text-base text-ivory-dim">
          {t("Push every order placed through Tavzio out to an external POS in real time, on top of Tavzio's own order screen - which always works regardless of whether this is connected.")}
        </p>
      </div>

      <Section
        title={t('Connection')}
        action={
          <button type="button"
            onClick={handleToggle}
            disabled={!configured}
            title={!configured ? t('Save your connection details below first') : undefined}
            className={`rounded-lg border px-3.5 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${enabled ? 'border-brass text-brass' : 'border-ink-line text-ivory-dim'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass`}
          >
            {enabled ? t('Enabled') : t('Disabled')}
          </button>
        }
      >
        {!configured && (
          <p className="text-sm text-ivory-dim">{t('Not connected yet - fill in a provider and its credentials below, then Save, before this can be turned on.')}</p>
        )}
        {toggleError && <p className="text-sm text-danger">{toggleError}</p>}
        {status && (
          <p className="text-sm text-ivory-dim">
            {t('Status:')} <span className="capitalize text-ivory">{status.status}</span>
            {status.lastSyncedAt && ` · ${t('Last synced')} ${new Date(status.lastSyncedAt).toLocaleString('en-GB')}`}
          </p>
        )}
        <Field label={t('Provider')}>
          <select value={provider} onChange={(e) => { setProvider(e.target.value as PosProvider); setConfig({}); }} className={inputClass}>
            {PROVIDERS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </Field>
        {providerNote && <p className="text-sm text-ivory-dim">{t(providerNote)}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {fieldsByProvider[provider].map((f) => (
            <Field key={f.key} label={t(f.label)}>
              {SECRET_FIELD_KEYS.has(f.key) ? (
                <SecretField
                  label={t(f.label)}
                  value={config[f.key] || ''}
                  onChange={(v) => setConfig((prev) => ({ ...prev, [f.key]: v }))}
                />
              ) : (
                <input
                  value={config[f.key] || ''}
                  onChange={(e) => setConfig((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  className={inputClass}
                />
              )}
            </Field>
          ))}
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button type="button" onClick={handleSave} disabled={saving} className="rounded-full bg-brass px-4 py-2.5 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
          {saving ? t('Saving...') : t('Save')}
        </button>
      </Section>
    </div>
  );
}
