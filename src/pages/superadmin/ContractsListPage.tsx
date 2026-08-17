import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listAllContracts, previewStandaloneContract, sendStandaloneContract, onboardContract } from '../../lib/authApi';
import type { Contract } from '../../types';

const STATUS_STYLES: Record<string, string> = {
  draft: 'text-ivory-dim border-ink-line',
  sent: 'text-brass border-brass/40',
  signed: 'text-success border-success/40',
  paid: 'text-success border-success/40',
  active: 'text-success border-success/40',
  terminated: 'text-danger border-danger/40',
  expired: 'text-danger border-danger/40',
};

export default function ContractsListPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const navigate = useNavigate();

  function reload() {
    setLoading(true);
    listAllContracts().then(setContracts).finally(() => setLoading(false));
  }

  useEffect(reload, []);

  async function handlePreview(contractId: string) {
    if (previewingId === contractId) {
      setPreviewingId(null);
      return;
    }
    const res = await previewStandaloneContract(contractId);
    setPreviewText(res.text);
    setPreviewingId(contractId);
  }

  async function handleSend(contractId: string) {
    setBusyId(contractId);
    try {
      const res = await sendStandaloneContract(contractId);
      alert(res.message);
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not send contract');
    } finally {
      setBusyId(null);
    }
  }

  async function handleOnboard(contract: Contract) {
    if (!confirm(`Onboard ${contract.client_business_name}? This creates their Tavzio account and emails them a link to set their password.`)) return;
    setBusyId(contract.id);
    try {
      const res = await onboardContract(contract.id);
      navigate(`/admin/super/businesses/${res.business.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not onboard this contract');
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-ivory">Contracts</h1>
        <Link
          to="/admin/super/contracts/new"
          className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90"
        >
          + Create contract
        </Link>
      </div>
      <p className="mt-1 text-base text-ivory-dim">
        A contract exists here before any account does. Once it's signed and paid, an <span className="text-ivory">Onboard</span> action
        appears - that's the one moment the client's account actually gets created.
      </p>

      <div className="mt-5 space-y-3">
        {contracts.map((c) => {
          const isStandalonePending = !c.business_id;
          const canOnboard = isStandalonePending && ['signed', 'paid'].includes(c.status);
          return (
            <div key={c.id} className="rounded-lg border border-ink-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-base font-medium text-ivory">
                    {c.contract_number} · {c.business_id ? '' : (c.client_business_name || 'Unnamed client')}
                  </p>
                  <p className="text-sm text-ivory-dim">
                    {c.client_name} · {c.client_email} · {c.start_date} → {c.end_date} · {c.payment_frequency} · AED {c.annual_total_aed.toFixed(2)}/yr ·{' '}
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLES[c.status] || 'text-ivory-dim border-ink-line'}`}>{c.status}</span>
                    {c.signed_by_name && ` · signed by ${c.signed_by_name}`}
                    {c.business_id && ' · onboarded'}
                  </p>
                </div>
                <div className="flex gap-2">
                  {c.status === 'draft' && (
                    <button type="button" disabled={busyId === c.id} onClick={() => handleSend(c.id)} className="text-sm text-brass hover:underline disabled:opacity-50">
                      Send to client
                    </button>
                  )}
                  <button type="button" onClick={() => handlePreview(c.id)} className="text-sm text-brass hover:underline">
                    {previewingId === c.id ? 'Hide' : 'Preview'}
                  </button>
                  {canOnboard && (
                    <button type="button" disabled={busyId === c.id} onClick={() => handleOnboard(c)} className="text-sm font-medium text-success hover:underline disabled:opacity-50">
                      {busyId === c.id ? 'Onboarding...' : 'Onboard'}
                    </button>
                  )}
                  {c.business_id && (
                    <Link to={`/admin/super/businesses/${c.business_id}`} className="text-sm text-ivory-dim hover:text-ivory">
                      View business →
                    </Link>
                  )}
                </div>
              </div>
              {previewingId === c.id && (
                <pre className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg bg-ink-soft p-4 text-sm text-ivory-dim">{previewText}</pre>
              )}
            </div>
          );
        })}
        {!loading && contracts.length === 0 && <p className="text-base text-ivory-dim">No contracts yet.</p>}
      </div>
    </div>
  );
}
