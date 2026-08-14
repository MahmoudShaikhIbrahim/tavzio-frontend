import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { getPosIntegration, getPosIntegrationStatus, upsertPosIntegration, togglePosIntegration } from '../../lib/authApi';
import type { PosProvider } from '../../types';
import { Section, Field, inputClass } from '../../components/ui';

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
  const businessId = user?.business_id;
  const [provider, setProvider] = useState<PosProvider>('square');
  const [enabled, setEnabled] = useState(false);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ status: string; lastSyncedAt: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  function reload() {
    if (!businessId) return;
    getPosIntegration(businessId, 'ordering')
      .then((data) => {
        if (data) {
          setProvider(data.provider);
          setEnabled(data.enabled);
          setConfig(data.config || {});
        }
        setLoaded(true);
      })
      .catch((err) => {
        // Without this, a failed request left the page stuck on
        // "Loading..." forever with no way to tell what went wrong -
        // exactly what was happening when the encryption key was
        // missing and decrypting an existing config threw.
        setError(err instanceof Error ? err.message : 'Could not load this integration');
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
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this integration');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle() {
    if (!businessId) return;
    const next = !enabled;
    setEnabled(next);
    try {
      await togglePosIntegration(businessId, 'ordering', next);
      reload();
    } catch {
      setEnabled(!next);
    }
  }

  if (!businessId || !loaded) return <p className="text-ivory-dim">Loading...</p>;

  const providerNote = PROVIDERS.find((p) => p.key === provider)?.note;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ivory">POS Integration</h1>
        <p className="mt-1 text-base text-ivory-dim">
          Push every order placed through Tavzio out to an external POS in real time, on top of Tavzio's own
          order screen - which always works regardless of whether this is connected.
        </p>
      </div>

      <Section
        title="Connection"
        action={
          <button type="button" onClick={handleToggle} className={`rounded-lg border px-3.5 py-2 text-sm font-medium ${enabled ? 'border-brass text-brass' : 'border-ink-line text-ivory-dim'}`}>
            {enabled ? 'Enabled' : 'Disabled'}
          </button>
        }
      >
        {status && (
          <p className="text-sm text-ivory-dim">
            Status: <span className="capitalize text-ivory">{status.status}</span>
            {status.lastSyncedAt && ` · Last synced ${new Date(status.lastSyncedAt).toLocaleString('en-GB')}`}
          </p>
        )}
        <Field label="Provider">
          <select value={provider} onChange={(e) => { setProvider(e.target.value as PosProvider); setConfig({}); }} className={inputClass}>
            {PROVIDERS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </Field>
        {providerNote && <p className="text-sm text-ivory-dim">{providerNote}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {fieldsByProvider[provider].map((f) => (
            <Field key={f.key} label={f.label}>
              <input
                value={config[f.key] || ''}
                onChange={(e) => setConfig((prev) => ({ ...prev, [f.key]: e.target.value }))}
                className={inputClass}
              />
            </Field>
          ))}
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-brass px-4 py-2.5 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </Section>
    </div>
  );
}
