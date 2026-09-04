import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import { getPaymentIntegration, upsertPaymentIntegration } from '../../lib/authApi';
import type { PosIntegration } from '../../types';
import { Section, Field, inputClass } from '../../components/ui';
import PasswordField from '../../components/PasswordField';

// Same show/hide pattern already used for the account password on
// AdminLogin, via the shared PasswordField component - these gateway
// secrets are just as sensitive and deserve the same masking-by-default
// treatment, not a plain visible text box.
function SecretField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <Field label={label}>
      <PasswordField value={value} onChange={onChange} placeholder={placeholder} required={false} autoComplete="off" />
    </Field>
  );
}

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
  const { t } = useT();
  const [integration, setIntegration] = useState<PosIntegration | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState<'tap' | 'telr' | 'ngenius' | 'ziina' | ''>('');
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
        // No fallback to 'tap' here - if this business has never actually
        // saved a provider, leave the selection genuinely blank rather
        // than silently pre-selecting one as if it had been chosen. That
        // was the exact bug: an unconfigured account's dashboard, PDFs,
        // and reports all showing "Tap Payments" as if it were in use.
        setProvider((data.config?.provider as 'tap' | 'telr' | 'ngenius' | 'ziina') || '');
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
    if (!provider) { setSaveError(t('Choose a payment provider first')); return; }
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
      setSaveError(err instanceof Error ? err.message : t('Could not save payment settings'));
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <Section title={t('Pay Bill setup')}>
      <p className="text-base text-ivory-dim">
        {t('Your own payment account — money goes straight to your bank, Tavzio never touches it. Only you can see or edit this, not staff, not the platform operator.')}
      </p>
      {integration?.status && (
        <p className="text-base">
          {t('Status:')} <span className={integration.status === 'connected' ? 'text-success' : 'text-ivory-dim'}>{integration.status}</span>
        </p>
      )}
      <div className="max-w-lg space-y-5 rounded-xl border border-ink-line p-5">
        <Field label={t('Payment provider')}>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as 'tap' | 'telr' | 'ngenius' | 'ziina' | '')}
            className="w-full rounded-lg border border-ink-line bg-ink px-3.5 py-2.5 text-base text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
          >
            <option value="">{t('Choose a provider...')}</option>
            {PROVIDERS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </Field>

        {provider === 'tap' && (
          <div className="space-y-4 border-t border-ink-line pt-5">
            <SecretField label={t('Tap secret key')} value={secretKey} onChange={setSecretKey} placeholder={t('From your Tap Payments dashboard')} />
          </div>
        )}

        {provider === 'telr' && (
          <div className="space-y-4 border-t border-ink-line pt-5">
            <Field label={t('Store ID')}>
              <input value={storeId} onChange={(e) => setStoreId(e.target.value)} placeholder={t('From your Telr account')} className={inputClass} />
            </Field>
            <SecretField label={t('Authentication key')} value={authKey} onChange={setAuthKey} placeholder={t('From your Telr account')} />
            <p className="text-sm text-ivory-dim">
              {t('One extra step with Telr: live payments only work from server addresses Telr has pre-approved — ask Telr support to whitelist your Tavzio server\'s IPs when setting up. Test mode has no such restriction.')}
            </p>
          </div>
        )}

        {provider === 'ngenius' && (
          <div className="space-y-4 border-t border-ink-line pt-5">
            <SecretField label={t('Service account API key')} value={apiKey} onChange={setApiKey} placeholder="N-Genius portal → Settings → Integrations → Service Accounts" />
            <Field label={t('Outlet reference')}>
              <input value={outletRef} onChange={(e) => setOutletRef(e.target.value)} placeholder="N-Genius portal → Settings → Organization Hierarchy" className={inputClass} />
            </Field>
          </div>
        )}

        {provider === 'ziina' && (
          <div className="space-y-4 border-t border-ink-line pt-5">
            <SecretField label={t('Ziina API key')} value={ziinaApiKey} onChange={setZiinaApiKey} placeholder={t('From your Ziina Business dashboard → Developers')} />
            <p className="text-sm text-ivory-dim">
              {t("This is your own Ziina account, separate from Tavzio's — money goes straight to your Ziina balance, not through us.")}
            </p>
          </div>
        )}

        {provider !== 'tap' && (
          <label className="flex items-center gap-2.5 text-base text-ivory-dim">
            <input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} className="accent-brass" />
            {t('Test mode — for trying it out before going live')}
          </label>
        )}

        <div className="space-y-4 border-t border-ink-line pt-5">
          <label className="flex items-center gap-2.5 text-base text-ivory-dim">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-brass" />
            {t('Enabled — let customers pay via Pay Bill')}
          </label>
          <button type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-brass px-5 py-2.5 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
          >
            {saving ? t('Saving...') : t('Save')}
          </button>
          {saveError && <p className="text-sm text-danger">{saveError}</p>}
        </div>
      </div>
    </Section>
  );
}
