import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { listContracts, previewContract, signContract } from '../../lib/authApi';
import type { Contract } from '../../types';
import { Section } from '../../components/ui';

export default function ContractPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [previewText, setPreviewText] = useState('');
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!businessId) return;
    listContracts(businessId).then(setContracts).finally(() => setLoading(false));
  }, [businessId]);

  // The most relevant one to show: an unsigned draft/sent contract takes
  // priority over an already-signed one, since that's the thing needing
  // the owner's attention right now.
  const activeContract = contracts.find((c) => c.status === 'draft' || c.status === 'sent') || contracts[0];

  useEffect(() => {
    if (!businessId || !activeContract) return;
    previewContract(businessId, activeContract.id).then((res) => setPreviewText(res.text));
  }, [businessId, activeContract?.id]);

  async function handleSign() {
    if (!businessId || !activeContract) return;
    if (!fullName.trim()) { setError('Type your full legal name to sign'); return; }
    if (!agreed) { setError('Please confirm you have read and agree to the terms'); return; }
    setSigning(true);
    setError('');
    try {
      const updated = await signContract(businessId, activeContract.id, fullName.trim());
      setContracts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign contract');
    } finally {
      setSigning(false);
    }
  }

  if (loading) return <p className="text-ivory-dim">Loading...</p>;
  if (!activeContract) return <Section title="Service Contract"><p className="text-ivory-dim">No contract has been issued to your account yet.</p></Section>;

  const isSigned = activeContract.status === 'signed' || activeContract.status === 'active';

  return (
    <Section title="Service Contract">
      <div className="flex items-center justify-between">
        <p className="text-base text-ivory">{activeContract.contract_number}</p>
        <span className={`text-sm ${isSigned ? 'text-success' : 'text-warning'}`}>
          {isSigned ? `Signed by ${activeContract.signed_by_name} on ${new Date(activeContract.signed_at!).toLocaleDateString()}` : 'Awaiting your signature'}
        </span>
      </div>

      <pre className="max-h-[28rem] overflow-y-auto whitespace-pre-wrap rounded-lg border border-ink-line bg-ink-soft p-5 text-sm leading-relaxed text-ivory-dim">
        {isSigned && activeContract.signed_snapshot_text ? activeContract.signed_snapshot_text : previewText}
      </pre>

      {!isSigned && (
        <div className="space-y-3 rounded-lg border border-ink-line p-4">
          <p className="text-sm text-ivory-dim">
            Signing electronically here is legally valid under UAE Federal Decree-Law No. 46 of 2021 on Electronic
            Transactions and Trust Services. Your typed name, the time, and your IP address are recorded alongside
            the exact text above at the moment you sign.
          </p>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Type your full legal name"
            className="w-full rounded-lg border border-ink-line bg-ink px-3.5 py-2.5 text-base text-ivory"
          />
          <label className="flex items-center gap-2 text-base text-ivory">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="accent-brass" />
            I have read and agree to the terms above.
          </label>
          {error && <p className="text-base text-danger">{error}</p>}
          <button
            onClick={handleSign}
            disabled={signing}
            className="rounded-lg bg-brass px-4 py-2.5 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50"
          >
            {signing ? 'Signing...' : 'Sign contract'}
          </button>
        </div>
      )}
    </Section>
  );
}
