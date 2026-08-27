import { useEffect, useState } from 'react';
import { getReceiptBranding, updateReceiptBranding } from '../../lib/authApi';
import { uploadBusinessFile } from '../../lib/supabaseClient';
import { Field, Section, inputClass } from '../../components/ui';
import type { ReceiptBranding } from '../../types';

// Reuses the existing business-assets bucket under a fixed "platform"
// path - super_admin already has write access anywhere in that bucket
// (confirmed against the real storage policy), so no new bucket or
// migration is needed for this.
export default function BillingSettingsPage() {
  const [branding, setBranding] = useState<ReceiptBranding | null>(null);
  const [legalName, setLegalName] = useState('');
  const [issuerTrn, setIssuerTrn] = useState('');
  const [saving, setSaving] = useState<'stamp' | 'signature' | 'name' | 'trn' | null>(null);

  function reload() {
    getReceiptBranding().then((b) => {
      setBranding(b);
      setLegalName(b.legal_name);
      setIssuerTrn(b.issuer_trn || '');
    });
  }
  useEffect(reload, []);

  async function handleUpload(kind: 'stamp' | 'signature', file: File) {
    setSaving(kind);
    const url = await uploadBusinessFile('platform', file, `receipt-${kind}`);
    await updateReceiptBranding(kind === 'stamp' ? { stampUrl: url } : { signatureUrl: url });
    setSaving(null);
    reload();
  }

  async function handleSaveName() {
    setSaving('name');
    await updateReceiptBranding({ legalName });
    setSaving(null);
    reload();
  }

  async function handleSaveTrn() {
    setSaving('trn');
    await updateReceiptBranding({ issuerTrn });
    setSaving(null);
    reload();
  }

  if (!branding) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-8 py-14">
      <Section title="Billing receipt branding">
        <p className="text-base text-ivory-dim">
          What every NEW receipt uses going forward - swap either one
          anytime. Past receipts already issued keep whatever stamp and
          signature was active when they were generated; updating here
          never changes a receipt that already went out.
        </p>

        <Field label="Legal trade name (shown at the top of every receipt)">
          <div className="flex gap-2">
            <input value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Your registered trade name" className={`${inputClass} flex-1`} />
            <button type="button" onClick={handleSaveName} disabled={saving === 'name'} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
              {saving === 'name' ? 'Saving...' : 'Save'}
            </button>
          </div>
        </Field>

        <Field label="Your TRN (required on every receipt to be a valid tax invoice)">
          <div className="flex gap-2">
            <input value={issuerTrn} onChange={(e) => setIssuerTrn(e.target.value)} placeholder="100000000000003" className={`${inputClass} flex-1`} />
            <button type="button" onClick={handleSaveTrn} disabled={saving === 'trn'} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
              {saving === 'trn' ? 'Saving...' : 'Save'}
            </button>
          </div>
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-3 rounded-lg border border-ink-line p-4">
            <p className="text-base text-ivory">Stamp</p>
            {branding.stamp_url ? (
              <img src={branding.stamp_url} alt="Current stamp" className="h-28 w-28 rounded-lg border border-ink-line object-contain bg-white p-2" />
            ) : (
              <p className="text-sm text-ivory-dim">No stamp uploaded yet - receipts will simply omit it until one is added.</p>
            )}
            <label className="inline-block cursor-pointer rounded-lg border border-ink-line px-3.5 py-2 text-sm text-ivory-dim hover:border-brass/60 hover:text-ivory">
              {saving === 'stamp' ? 'Uploading...' : branding.stamp_url ? 'Replace stamp' : 'Upload stamp'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload('stamp', e.target.files[0])} />
            </label>
          </div>

          <div className="space-y-3 rounded-lg border border-ink-line p-4">
            <p className="text-base text-ivory">Signature</p>
            {branding.signature_url ? (
              <img src={branding.signature_url} alt="Current signature" className="h-28 w-40 rounded-lg border border-ink-line object-contain bg-white p-2" />
            ) : (
              <p className="text-sm text-ivory-dim">No signature uploaded yet - receipts will simply omit it until one is added.</p>
            )}
            <label className="inline-block cursor-pointer rounded-lg border border-ink-line px-3.5 py-2 text-sm text-ivory-dim hover:border-brass/60 hover:text-ivory">
              {saving === 'signature' ? 'Uploading...' : branding.signature_url ? 'Replace signature' : 'Upload signature'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload('signature', e.target.files[0])} />
            </label>
          </div>
        </div>
      </Section>
    </div>
  );
}
