import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import {
  getBusiness, listStaff,
  listSalaryStructures, setSalaryStructure,
  listPayrollRuns, createPayrollRun, listPayslipsForRun, setPayslipDeductions,
  approvePayrollRun, markPayrollRunPaid, recordWpsExport,
} from '../../lib/authApi';
import type { AdminBusiness, StaffMember, SalaryStructure, PayrollRun, Payslip, PayslipDeduction } from '../../types';
import { Section, Field, inputClass, PrimaryButton, ActionButton } from '../../components/ui';

export default function PayrollPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [business, setBusiness] = useState<AdminBusiness | null>(null);

  useEffect(() => {
    if (businessId) getBusiness(businessId).then(setBusiness);
  }, [businessId]);

  if (!businessId || !business) return <p className="text-ivory-dim">Loading...</p>;

  if (!business.features.payroll?.enabled) {
    return (
      <div className="max-w-lg space-y-3">
        <h1 className="font-display text-3xl text-ivory">Payroll</h1>
        <p className="text-base text-ivory-dim">Turned off for your business. Turn it on under Features to set salaries and run payroll.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ivory">Payroll</h1>
        <p className="mt-1 text-base text-ivory-dim">Owner-only. Salaries, payroll runs, and WPS export tracking.</p>
      </div>
      <SalaryStructuresSection businessId={businessId} />
      <PayrollRunsSection businessId={businessId} />
    </div>
  );
}

// --- Salary structures ---

function SalaryStructuresSection({ businessId }: { businessId: string }) {
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    Promise.all([listSalaryStructures(businessId), listStaff(businessId)])
      .then(([s, st]) => { setStructures(s); setStaff(st); }).catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(reload, [businessId]);

  const structuresByStaff = new Map(structures.map((s) => [s.staff_id, s]));

  return (
    <Section title="Salary structures">
      {loading && <p className="text-ivory-dim">Loading...</p>}
      {!loading && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-base">
            <thead>
              <tr className="border-b border-ink-line text-sm text-ivory-dim">
                <th className="pb-2 pr-4">Staff</th>
                <th className="pb-2 pr-4">Pay type</th>
                <th className="pb-2 pr-4">Base (AED)</th>
                <th className="pb-2 pr-4">Allowances (AED)</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => {
                const structure = structuresByStaff.get(s.id);
                return (
                  <tr key={s.id} className="border-b border-ink-line/50">
                    <td className="py-2 pr-4 text-ivory">{s.name}</td>
                    <td className="py-2 pr-4 text-ivory-dim capitalize">{structure?.pay_type ?? '—'}</td>
                    <td className="py-2 pr-4 text-ivory-dim">{structure ? Number(structure.base_amount_aed).toFixed(2) : '—'}</td>
                    <td className="py-2 pr-4 text-ivory-dim">
                      {structure ? (Number(structure.housing_allowance_aed) + Number(structure.transport_allowance_aed) + Number(structure.other_allowances_aed)).toFixed(2) : '—'}
                    </td>
                    <td className="py-2">
                      <button type="button" onClick={() => setEditingStaffId(s.id)} className="text-sm text-brass hover:underline">
                        {structure ? 'Edit' : 'Set salary'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {staff.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-ivory-dim">No staff members yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {editingStaffId && (
        <SalaryStructureForm
          businessId={businessId}
          staffId={editingStaffId}
          staffName={staff.find((s) => s.id === editingStaffId)?.name ?? ''}
          existing={structuresByStaff.get(editingStaffId) ?? null}
          onClose={() => setEditingStaffId(null)}
          onSaved={() => { setEditingStaffId(null); reload(); }}
        />
      )}
    </Section>
  );
}

function SalaryStructureForm({ businessId, staffId, staffName, existing, onClose, onSaved }: {
  businessId: string; staffId: string; staffName: string; existing: SalaryStructure | null;
  onClose: () => void; onSaved: () => void;
}) {
  const [payType, setPayType] = useState<'monthly' | 'hourly' | 'daily'>(existing?.pay_type ?? 'monthly');
  const [baseAmount, setBaseAmount] = useState(existing ? String(existing.base_amount_aed) : '');
  const [housing, setHousing] = useState(existing ? String(existing.housing_allowance_aed) : '0');
  const [transport, setTransport] = useState(existing ? String(existing.transport_allowance_aed) : '0');
  const [other, setOther] = useState(existing ? String(existing.other_allowances_aed) : '0');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!baseAmount) { setError('Base amount is required'); return; }
    setSaving(true);
    setError('');
    try {
      await setSalaryStructure(businessId, {
        staffId, payType, baseAmountAed: Number(baseAmount),
        housingAllowanceAed: Number(housing) || 0, transportAllowanceAed: Number(transport) || 0, otherAllowancesAed: Number(other) || 0,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-ink-line p-4">
      <p className="mb-3 text-base text-ivory">Salary for {staffName}</p>
      {existing && <p className="mb-3 text-sm text-ivory-dim">This replaces the current structure - the old one is kept on record, closed out as of today.</p>}
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Pay type">
          <select value={payType} onChange={(e) => setPayType(e.target.value as typeof payType)} className={`${inputClass} w-32`}>
            <option value="monthly">Monthly</option>
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
          </select>
        </Field>
        <Field label={payType === 'monthly' ? 'Base / month (AED)' : payType === 'daily' ? 'Base / day (AED)' : 'Base / hour (AED)'}>
          <input type="number" value={baseAmount} onFocus={(e) => e.target.select()} onChange={(e) => setBaseAmount(e.target.value)} className={`${inputClass} w-32`} />
        </Field>
        <Field label="Housing allowance">
          <input type="number" value={housing} onFocus={(e) => e.target.select()} onChange={(e) => setHousing(e.target.value)} className={`${inputClass} w-28`} />
        </Field>
        <Field label="Transport allowance">
          <input type="number" value={transport} onFocus={(e) => e.target.select()} onChange={(e) => setTransport(e.target.value)} className={`${inputClass} w-28`} />
        </Field>
        <Field label="Other allowances">
          <input type="number" value={other} onFocus={(e) => e.target.select()} onChange={(e) => setOther(e.target.value)} className={`${inputClass} w-28`} />
        </Field>
        <PrimaryButton onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</PrimaryButton>
        <ActionButton onClick={onClose}>Cancel</ActionButton>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

// --- Payroll runs ---

function PayrollRunsSection({ businessId }: { businessId: string }) {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [periodStart, setPeriodStart] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10));
  const [creatingBusy, setCreatingBusy] = useState(false);
  const [error, setError] = useState('');
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    listPayrollRuns(businessId).then(setRuns).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(reload, [businessId]);

  async function handleCreateRun() {
    setCreatingBusy(true);
    setError('');
    try {
      const run = await createPayrollRun(businessId, periodStart, periodEnd);
      setCreating(false);
      setExpandedRunId(run.id);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create payroll run');
    } finally {
      setCreatingBusy(false);
    }
  }

  return (
    <Section title="Payroll runs" action={
      !creating && <ActionButton onClick={() => setCreating(true)}>New run</ActionButton>
    }>
      {creating && (
        <div className="rounded-lg border border-ink-line p-4">
          <p className="mb-3 text-base text-ivory">New payroll run</p>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Period start"><input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className={`${inputClass} w-40`} /></Field>
            <Field label="Period end"><input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={`${inputClass} w-40`} /></Field>
            <PrimaryButton onClick={handleCreateRun} disabled={creatingBusy}>{creatingBusy ? 'Building...' : 'Build run'}</PrimaryButton>
            <ActionButton onClick={() => setCreating(false)}>Cancel</ActionButton>
          </div>
          <p className="mt-2 text-sm text-ivory-dim">Builds one payslip per staff member with an active salary structure, using real clocked hours and tips from this period. You can adjust deductions before approving.</p>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        </div>
      )}

      {loading && <p className="text-ivory-dim">Loading...</p>}
      {!loading && (
        <div className="space-y-3">
          {runs.map((run) => (
            <PayrollRunRow
              key={run.id}
              businessId={businessId}
              run={run}
              expanded={expandedRunId === run.id}
              onToggle={() => setExpandedRunId(expandedRunId === run.id ? null : run.id)}
              onChanged={reload}
            />
          ))}
          {runs.length === 0 && !creating && <p className="text-ivory-dim">No payroll runs yet.</p>}
        </div>
      )}
    </Section>
  );
}

const STATUS_COLOR: Record<PayrollRun['status'], string> = {
  draft: 'text-ivory-dim',
  approved: 'text-brass',
  paid: 'text-success',
  cancelled: 'text-danger',
};

function PayrollRunRow({ businessId, run, expanded, onToggle, onChanged }: {
  businessId: string; run: PayrollRun; expanded: boolean; onToggle: () => void; onChanged: () => void;
}) {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loadingPayslips, setLoadingPayslips] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wpsGenerated, setWpsGenerated] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (expanded) {
      setLoadingPayslips(true);
      listPayslipsForRun(businessId, run.id).then(setPayslips).finally(() => setLoadingPayslips(false));
    }
  }, [expanded, businessId, run.id]);

  async function handleApprove() {
    setBusy(true);
    setError('');
    try {
      await approvePayrollRun(businessId, run.id);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not approve');
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkPaid() {
    setBusy(true);
    setError('');
    try {
      await markPayrollRunPaid(businessId, run.id);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not mark as paid');
    } finally {
      setBusy(false);
    }
  }

  async function handleWpsExport() {
    setBusy(true);
    setError('');
    try {
      await recordWpsExport(businessId, run.id);
      setWpsGenerated(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record WPS export');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-ink-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onToggle} className="text-left">
          <p className="text-base text-ivory">
            {new Date(run.period_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {new Date(run.period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          <p className={`text-sm ${STATUS_COLOR[run.status]} capitalize`}>{run.status}</p>
        </button>
        <div className="flex items-center gap-4 text-sm text-ivory-dim">
          <span>Gross AED {Number(run.total_gross_aed).toFixed(2)}</span>
          <span>Net AED {Number(run.total_net_aed).toFixed(2)}</span>
        </div>
        <div className="flex gap-2">
          {run.status === 'draft' && <PrimaryButton onClick={handleApprove} disabled={busy}>Approve</PrimaryButton>}
          {run.status === 'approved' && (
            <>
              <ActionButton onClick={handleWpsExport} disabled={busy || wpsGenerated}>{wpsGenerated ? 'WPS recorded' : 'Generate WPS file'}</ActionButton>
              <PrimaryButton onClick={handleMarkPaid} disabled={busy}>Mark paid</PrimaryButton>
            </>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {run.status === 'approved' && (
        <p className="mt-2 text-sm text-warning">
          WPS file generation records that a Wage Protection System export happened; the actual bank-format (SIF) file itself still needs to be produced through your bank/finance platform's WPS tool - this is the audit-trail entry, not a bank connector.
        </p>
      )}
      {expanded && (
        <div className="mt-4 overflow-x-auto">
          {loadingPayslips && <p className="text-ivory-dim">Loading payslips...</p>}
          {!loadingPayslips && (
            <table className="w-full text-left text-base">
              <thead>
                <tr className="border-b border-ink-line text-sm text-ivory-dim">
                  <th className="pb-2 pr-4">Staff</th>
                  <th className="pb-2 pr-4">Base</th>
                  <th className="pb-2 pr-4">Allowances</th>
                  <th className="pb-2 pr-4">Overtime</th>
                  <th className="pb-2 pr-4">Tips</th>
                  <th className="pb-2 pr-4">Gross</th>
                  <th className="pb-2 pr-4">Deductions</th>
                  <th className="pb-2">Net</th>
                </tr>
              </thead>
              <tbody>
                {payslips.map((p) => (
                  <PayslipRow key={p.id} businessId={businessId} runId={run.id} payslip={p} editable={run.status === 'draft'} onChanged={() => listPayslipsForRun(businessId, run.id).then(setPayslips)} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function PayslipRow({ businessId, runId, payslip, editable, onChanged }: {
  businessId: string; runId: string; payslip: Payslip; editable: boolean; onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [deductions, setDeductions] = useState<PayslipDeduction[]>(payslip.deductions || []);
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await setPayslipDeductions(businessId, runId, payslip.id, deductions);
      setEditing(false);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  function addDeduction() {
    if (!newLabel || !newAmount) return;
    setDeductions([...deductions, { label: newLabel, amountAed: Number(newAmount) }]);
    setNewLabel('');
    setNewAmount('');
  }

  return (
    <>
      <tr className="border-b border-ink-line/50">
        <td className="py-2 pr-4 text-ivory">{payslip.profiles?.name ?? 'Unknown'}</td>
        <td className="py-2 pr-4 text-ivory-dim">{Number(payslip.base_amount_aed).toFixed(2)}</td>
        <td className="py-2 pr-4 text-ivory-dim">{Number(payslip.allowances_aed).toFixed(2)}</td>
        <td className="py-2 pr-4 text-ivory-dim">{Number(payslip.overtime_amount_aed).toFixed(2)}</td>
        <td className="py-2 pr-4 text-ivory-dim">{Number(payslip.tips_amount_aed).toFixed(2)}</td>
        <td className="py-2 pr-4 text-ivory">{Number(payslip.gross_aed).toFixed(2)}</td>
        <td className="py-2 pr-4 text-ivory-dim">
          {Number(payslip.total_deductions_aed).toFixed(2)}
          {editable && <button type="button" onClick={() => setEditing(!editing)} className="ml-2 text-sm text-brass hover:underline">edit</button>}
        </td>
        <td className="py-2 text-ivory">{Number(payslip.net_aed).toFixed(2)}</td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={8} className="pb-3">
            <div className="rounded-lg border border-ink-line p-3">
              {deductions.map((d, i) => (
                <div key={i} className="flex items-center justify-between py-1 text-sm text-ivory-dim">
                  <span>{d.label}</span>
                  <span className="flex items-center gap-2">
                    AED {d.amountAed.toFixed(2)}
                    <button type="button" onClick={() => setDeductions(deductions.filter((_, idx) => idx !== i))} className="text-danger hover:underline">remove</button>
                  </span>
                </div>
              ))}
              <div className="mt-2 flex items-end gap-2">
                <Field label="Label"><input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className={`${inputClass} w-40`} /></Field>
                <Field label="Amount (AED)"><input type="number" value={newAmount} onFocus={(e) => e.target.select()} onChange={(e) => setNewAmount(e.target.value)} className={`${inputClass} w-28`} /></Field>
                <ActionButton onClick={addDeduction}>Add</ActionButton>
                <PrimaryButton onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save deductions'}</PrimaryButton>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
