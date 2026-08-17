import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import { getPrinterIntegration, listAvailablePrinters, upsertPrinterIntegration } from '../../lib/authApi';
import type { PosIntegration } from '../../types';
import { Section, Field, inputClass } from '../../components/ui';

export default function PrinterSetupPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  if (!businessId) return <p className="text-ivory-dim">Loading...</p>;
  return <PrinterSetup businessId={businessId} />;
}

function PrinterSetup({ businessId }: { businessId: string }) {
  const { t } = useT();
  const [integration, setIntegration] = useState<PosIntegration | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [printers, setPrinters] = useState<{ id: number; name: string; description: string; state: string }[]>([]);
  const [printerId, setPrinterId] = useState('');
  const [printerName, setPrinterName] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getPrinterIntegration(businessId).then((data) => {
      setIntegration(data);
      if (data) {
        setEnabled(data.enabled);
        setApiKey(data.config?.apiKey || '');
        setPrinterId(data.config?.printerId || '');
        setPrinterName(data.config?.printerName || '');
      }
      setLoaded(true);
    });
  }, [businessId]);

  async function handleRefreshPrinters() {
    setRefreshing(true);
    setRefreshError('');
    try {
      const res = await listAvailablePrinters(businessId, apiKey);
      setPrinters(res.printers);
      if (res.printers.length === 0) {
        setRefreshError('No printers found - make sure the PrintNode Client is running on a computer connected to your printer.');
      }
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : 'Could not reach PrintNode with that key');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError('');
    try {
      const updated = await upsertPrinterIntegration(businessId, { enabled, apiKey, printerId, printerName });
      setIntegration(updated);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save printer settings');
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <Section title={t('Receipt printer')}>
      <p className="text-base text-ivory-dim">
        {t('Connects Tavzio to a real receipt printer via PrintNode, so pressing "Print" on Table Receipts sends straight to the printer next to your cashier. Requires the free PrintNode Client running once on whatever computer is physically connected to your printer - after that, everything else is automatic. Only you can see or edit this, not staff, not the platform operator.')}
      </p>
      {integration?.status && (
        <p className="text-base">
          {t('Status:')} <span className={integration.status === 'connected' ? 'text-success' : 'text-ivory-dim'}>{integration.status}</span>
          {printerName && <span className="text-ivory-dim"> — {printerName}</span>}
        </p>
      )}
      <div className="max-w-lg space-y-5 rounded-xl border border-ink-line p-5">
        <Field label={t('PrintNode API key')}>
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={t("From your PrintNode account's API Keys page")}
            className={inputClass}
          />
        </Field>

        <button
          type="button"
          onClick={handleRefreshPrinters}
          disabled={refreshing || !apiKey}
          className="rounded-lg border border-brass/40 px-3.5 py-2 text-base text-brass hover:bg-brass/10 disabled:opacity-50"
        >
          {refreshing ? t('Refreshing...') : t('Refresh printers')}
        </button>
        {refreshError && <p className="text-base text-danger">{refreshError}</p>}

        {printers.length > 0 && (
          <Field label={t('Printer')}>
            <select
              value={printerId}
              onChange={(e) => {
                setPrinterId(e.target.value);
                setPrinterName(printers.find((p) => String(p.id) === e.target.value)?.name || '');
              }}
              className="w-full rounded-lg border border-ink-line bg-ink px-3.5 py-2.5 text-base text-ivory"
            >
              <option value="">{t('Select a printer...')}</option>
              {printers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.description ? ` — ${p.description}` : ''}</option>
              ))}
            </select>
          </Field>
        )}

        <label className="flex items-center gap-2 text-base text-ivory">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-brass" />
          {t('Enabled')}
        </label>

        {saveError && <p className="text-base text-danger">{saveError}</p>}
        <button type="button"
          onClick={handleSave}
          disabled={saving || (enabled && !printerId)}
          className="rounded-lg bg-brass px-4 py-2.5 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50"
        >
          {saving ? t('Saving...') : t('Save')}
        </button>
      </div>
    </Section>
  );
}
