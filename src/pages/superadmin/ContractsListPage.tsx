import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listAllContracts, previewStandaloneContract, sendStandaloneContract, onboardContract, terminateContract, deleteContract } from '../../lib/authApi';
import type { Contract } from '../../types';
import { useConfirm } from '../../components/ConfirmDialog';

const STATUS_STYLES: Record<string, string> = {
  draft: 'text-ivory-dim border-ink-line',
  sent: 'text-brass border-brass/40',
  signed: 'text-success border-success/40',
  paid: 'text-success border-success/40',
  active: 'text-success border-success/40',
  terminated: 'text-danger border-danger/40',
  expired: 'text-danger border-danger/40',
};

// Real fix for a confirmed gap: 'signed' and 'paid' used to render
// identically (same green badge, same plain word) - a super admin
// scanning this list at a glance had no way to tell a contract that's
// only been signed (Tavzio is still waiting on real money) apart from
// one that's genuinely settled. 'signed' now gets its own real
// two-tone label; everything else keeps the plain badge, since there's
// no equivalent payment-status distinction to make for draft/sent/
// terminated/expired.
export function ContractStatusLabel({ status }: { status: string }) {
  if (status === 'signed') {
    return (
      <span className="inline-flex overflow-hidden rounded-full border border-ink-line text-xs">
        <span className="bg-success/15 px-2 py-0.5 text-success">Signed</span>
        <span className="bg-danger/15 px-2 py-0.5 text-danger">No Payment</span>
      </span>
    );
  }
  if (status === 'paid' || status === 'active') {
    return (
      <span className="inline-flex overflow-hidden rounded-full border border-success/40 text-xs">
        <span className="bg-success/15 px-2 py-0.5 text-success">Signed</span>
        <span className="bg-success/15 px-2 py-0.5 text-success">Paid</span>
      </span>
    );
  }
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLES[status] || 'text-ivory-dim border-ink-line'}`}>{status}</span>
  );
}

const TERMINATION_BASES: { value: 'non_payment' | 'material_breach' | 'client_convenience' | 'mutual_agreement'; label: string }[] = [
  { value: 'non_payment', label: 'Non-payment (Section 3 - 30+ days overdue)' },
  { value: 'material_breach', label: 'Material breach (Section 9 - 15 days uncured)' },
  { value: 'client_convenience', label: 'Client convenience (Section 9 - 90 days notice)' },
  { value: 'mutual_agreement', label: 'Mutual agreement' },
];

export default function ContractsListPage() {
  const confirm = useConfirm();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [terminationBasis, setTerminationBasis] = useState<typeof TERMINATION_BASES[number]['value']>('non_payment');
  const [terminationReason, setTerminationReason] = useState('');
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
    if (!(await confirm({ title: 'Onboard business?', message: `Onboard ${contract.client_business_name}? This creates their Tavzio account and emails them a link to set their password.`, confirmLabel: 'Onboard' }))) return;
    setBusyId(contract.id);
    try {
      const res = await onboardContract(contract.id);
      navigate(`/admin/super/businesses/${res.business.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not onboard this contract');
      setBusyId(null);
    }
  }

  // Real consequences, not just a status change - see contractController.js.
  // Requiring a basis and (for anything except mutual_agreement) a
  // reason keeps this traceable to an actual clause in the signed
  // contract, not a free decision made outside of what the client agreed to.
  async function handleTerminate(contract: Contract) {
    const basisLabel = TERMINATION_BASES.find((b) => b.value === terminationBasis)?.label;
    const confirmMsg = `Terminate ${contract.contract_number} on the basis of "${basisLabel}"? ${
      contract.business_id ? 'This will immediately suspend their account and email them a termination notice.' : 'This contract has no linked account yet.'
    } This cannot be undone.`;
    if (!(await confirm({ title: 'Terminate contract?', message: confirmMsg, confirmLabel: 'Terminate', danger: true }))) return;
    setBusyId(contract.id);
    try {
      await terminateContract(contract.id, terminationBasis, terminationReason);
      setTerminatingId(null);
      setTerminationReason('');
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not terminate this contract');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(contract: Contract) {
    if (!(await confirm({ title: 'Delete contract?', message: `Permanently delete ${contract.contract_number}? This only works because it was never signed - a signed contract can't be deleted, only terminated.`, confirmLabel: 'Delete', danger: true }))) return;
    setBusyId(contract.id);
    try {
      await deleteContract(contract.id);
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not delete this contract');
    } finally {
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
                    <ContractStatusLabel status={c.status} />
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
                  {['signed', 'paid', 'active'].includes(c.status) && (
                    <button type="button" onClick={() => setTerminatingId(terminatingId === c.id ? null : c.id)} className="text-sm text-danger hover:underline">
                      {terminatingId === c.id ? 'Cancel' : 'Terminate'}
                    </button>
                  )}
                  {['draft', 'sent'].includes(c.status) && (
                    <button type="button" disabled={busyId === c.id} onClick={() => handleDelete(c)} className="text-sm text-danger hover:underline disabled:opacity-50">
                      Delete
                    </button>
                  )}
                  {c.business_id && (
                    <Link to={`/admin/super/businesses/${c.business_id}`} className="text-sm text-ivory-dim hover:text-ivory">
                      View business →
                    </Link>
                  )}
                </div>
              </div>
              {c.status === 'terminated' && c.termination_basis && (
                <p className="mt-2 text-sm text-danger">
                  Terminated ({TERMINATION_BASES.find((b) => b.value === c.termination_basis)?.label || c.termination_basis})
                  {c.termination_reason && ` — ${c.termination_reason}`}
                </p>
              )}
              {terminatingId === c.id && (
                <div className="mt-3 space-y-3 rounded-lg border border-danger/30 bg-danger/5 p-4">
                  <p className="text-sm text-ivory">
                    Choose the contractual basis - this is recorded and, if this contract is linked to an account,{' '}
                    {c.business_id ? 'that account will be suspended immediately and the owner emailed a termination notice.' : 'nothing else happens since no account is linked yet.'}
                  </p>
                  <select
                    value={terminationBasis}
                    onChange={(e) => setTerminationBasis(e.target.value as typeof terminationBasis)}
                    className="w-full rounded-lg border border-ink-line bg-ink-soft px-3 py-2 text-sm text-ivory"
                  >
                    {TERMINATION_BASES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                  <input
                    value={terminationReason}
                    onChange={(e) => setTerminationReason(e.target.value)}
                    placeholder="Reason (optional, included in the notice sent to the client)"
                    className="w-full rounded-lg border border-ink-line bg-ink-soft px-3 py-2 text-sm text-ivory placeholder:text-ivory-dim/60"
                  />
                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => handleTerminate(c)}
                    className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-ivory hover:opacity-90 disabled:opacity-50"
                  >
                    {busyId === c.id ? 'Terminating...' : 'Confirm termination'}
                  </button>
                </div>
              )}
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
