import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { getPaymentIntegration, upsertPaymentIntegration } from '../../lib/authApi';
import type { PosIntegration } from '../../types';
import { Section, Field, inputClass } from '../../components/ui';

const PROVIDERS = [
  { key: 'tap', label: 'Tap Payments' },
  { key: 'telr', label: 'Telr' },
  { key: 'ngenius', label: 'N-Genius Online (Network International)' },
  { key: 'ziina', label: 'Ziina' },
] as const;

export default function PayBillSetupPage() {
  const { user } = useSession();
  const businessId = user?.business_id;

  if (!businessId) return <p className="text-ivory-dim">Loading...</p>;

  return <PaymentProviderSetup businessId={businessId} />;
}

function PaymentProviderSetup({ businessId }: { businessId: string }) {
  const [integration, setIntegration] = useState<PosIntegration | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState<'tap' | 'telr' | 'ngenius' | 'ziina'>('tap');
  // Tap
  const [secretKey, setSecretKey] = useState('');
  // Telr
  const [storeId, setStoreId] = useState('');
  const [authKey, setAuthKey] = useState('');
  // N-Genius
  const [apiKey, setApiKey] = useState('');
  const [outletRef, setOutletRef] = useState('');
  // Ziina
  const [ziinaApiKey, setZiinaApiKey] = useState('');
  const [testMode, setTestMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getPaymentIntegration(businessId).then((data) => {
      setIntegration(data);
      if (data) {
        setEnabled(data.enabled);
        setProvider((data.config?.provider as 'tap' | 'telr' | 'ngenius' | 'ziina') || 'tap');
        setSecretKey(data.config?.secretKey || '');
        setStoreId(data.config?.storeId || '');
        setAuthKey(data.config?.authKey || '');
        setApiKey(data.config?.provider === 'ngenius' ? (data.config?.apiKey || '') : '');
        setOutletRef(data.config?.outletRef || '');
        setZiinaApiKey(data.config?.provider === 'ziina' ? (data.config?.apiKey || '') : '');
        setTestMode(!!data.config?.testMode);
      }
      setLoaded(true);
    });
  }, [businessId]);

  async function handleSave() {
    setSaving(true);
    setSaveError('');
    try {
      const config =
        provider === 'tap' ? { provider, secretKey }
        : provider === 'telr' ? { provider, storeId, authKey, testMode }
        : provider === 'ngenius' ? { provider, apiKey, outletRef, testMode }
        : { provider, apiKey: ziinaApiKey, testMode };
      const updated = await upsertPaymentIntegration(businessId, enabled, config);
      setIntegration(updated);
    } catch (err) {
      // Previously this threw uncaught and left the button stuck on
      // "Saving..." forever with zero indication anything had gone
      // wrong - now the real reason actually reaches the screen.
      setSaveError(err instanceof Error ? err.message : 'Could not save payment settings');
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <Section title="Pay Bill setup">
      <p className="text-base text-ivory-dim">
        Your own payment account — money goes straight to your bank,
        Tavzio never touches it. Only you can see or edit this, not staff,
        not the platform operator.
      </p>
      {integration?.status && (
        <p className="text-base">
          Status: <span className={integration.status === 'connected' ? 'text-success' : 'text-ivory-dim'}>{integration.status}</span>
        </p>
      )}
      <div className="max-w-lg space-y-5 rounded-xl border border-ink-line p-5">
        <Field label="Payment provider">
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as 'tap' | 'telr' | 'ngenius' | 'ziina')}
            className="w-full rounded-lg border border-ink-line bg-ink px-3.5 py-2.5 text-base text-ivory"
          >
            {PROVIDERS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </Field>

        {provider === 'tap' && (
          <div className="space-y-4 border-t border-ink-line pt-5">
            <Field label="Tap secret key">
              <input
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="From your Tap Payments dashboard"
                className={inputClass}
              />
            </Field>
          </div>
        )}

        {provider === 'telr' && (
          <div className="space-y-4 border-t border-ink-line pt-5">
            <Field label="Store ID">
              <input value={storeId} onChange={(e) => setStoreId(e.target.value)} placeholder="From your Telr account" className={inputClass} />
            </Field>
            <Field label="Authentication key">
              <input value={authKey} onChange={(e) => setAuthKey(e.target.value)} placeholder="From your Telr account" className={inputClass} />
            </Field>
            <p className="text-sm text-ivory-dim">
              One extra step with Telr: live payments only work from server
              addresses Telr has pre-approved — ask Telr support to whitelist
              your Tavzio server's IPs when setting up. Test mode has no such
              restriction.
            </p>
          </div>
        )}

        {provider === 'ngenius' && (
          <div className="space-y-4 border-t border-ink-line pt-5">
            <Field label="Service account API key">
              <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="N-Genius portal → Settings → Integrations → Service Accounts" className={inputClass} />
            </Field>
            <Field label="Outlet reference">
              <input value={outletRef} onChange={(e) => setOutletRef(e.target.value)} placeholder="N-Genius portal → Settings → Organization Hierarchy" className={inputClass} />
            </Field>
          </div>
        )}

        {provider === 'ziina' && (
          <div className="space-y-4 border-t border-ink-line pt-5">
            <Field label="Ziina API key">
              <input value={ziinaApiKey} onChange={(e) => setZiinaApiKey(e.target.value)} placeholder="From your Ziina Business dashboard → Developers" className={inputClass} />
            </Field>
            <p className="text-sm text-ivory-dim">
              This is your own Ziina account, separate from Tavzio's — money
              goes straight to your Ziina balance, not through us.
            </p>
          </div>
        )}

        {provider !== 'tap' && (
          <label className="flex items-center gap-2.5 text-base text-ivory-dim">
            <input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} className="accent-brass" />
            Test mode — for trying it out before going live
          </label>
        )}

        <div className="space-y-4 border-t border-ink-line pt-5">
          <label className="flex items-center gap-2.5 text-base text-ivory-dim">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-brass" />
            Enabled — let customers pay via Pay Bill
          </label>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-brass px-5 py-2.5 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          {saveError && <p className="text-sm text-danger">{saveError}</p>}
        </div>
      </div>
    </Section>
  );
}
