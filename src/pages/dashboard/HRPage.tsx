import { useEffect, useState, type ReactNode } from 'react';
import { useSession } from '../../hooks/useSession';
import {
  getBusiness, listStaff,
  listStaffDocuments, uploadStaffDocument, deleteStaffDocument, type StaffDocument,
  setStaffCommission, getCommissionReport, type CommissionReportRow,
  listTipDistributions, createTipDistribution, type TipDistribution,
} from '../../lib/authApi';
import { uploadStaffDocumentFile, getStaffDocumentUrl } from '../../lib/supabaseClient';
import type { StaffMember, AdminBusiness } from '../../types';
import { Section, Field, inputClass } from '../../components/ui';

const DOC_TYPES = ['Emirates ID', 'Passport', 'Visa', 'Labor Card', 'Employment Contract', 'Other'];

export default function HRPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [business, setBusiness] = useState<AdminBusiness | null>(null);
  const [tab, setTab] = useState<'documents' | 'commission' | 'tips'>('documents');

  useEffect(() => {
    if (businessId) getBusiness(businessId).then(setBusiness);
  }, [businessId]);

  if (!businessId || !business) return <p className="text-ivory-dim">Loading...</p>;

  const hr = business.features.hr;
  if (!hr?.enabled) {
    return (
      <div className="max-w-lg space-y-3">
        <h1 className="font-display text-3xl text-ivory">HR</h1>
        <p className="text-base text-ivory-dim">
          HR is turned off for your business. Turn it on under Features, then come back here - each module
          (documents, commission, tips) can be enabled independently.
        </p>
      </div>
    );
  }

  const availableTabs = [
    hr.documents && { key: 'documents' as const, label: 'Staff Documents' },
    hr.commission && { key: 'commission' as const, label: 'Commission' },
    hr.tips && { key: 'tips' as const, label: 'Tip Pooling' },
  ].filter(Boolean) as { key: 'documents' | 'commission' | 'tips'; label: string }[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ivory">HR</h1>
        <p className="mt-1 text-base text-ivory-dim">Owner-only - staff accounts never see this section.</p>
      </div>
      {availableTabs.length === 0 ? (
        <p className="text-ivory-dim">No HR modules are turned on yet - enable one under Features.</p>
      ) : (
        <>
          <div className="flex gap-1.5 border-b border-ink-line">
            {availableTabs.map((t) => (
              <TabButton key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>{t.label}</TabButton>
            ))}
          </div>
          {tab === 'documents' && hr.documents && <DocumentsTab businessId={businessId} />}
          {tab === 'commission' && hr.commission && <CommissionTab businessId={businessId} />}
          {tab === 'tips' && hr.tips && <TipsTab businessId={businessId} />}
        </>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button"
      onClick={onClick}
      className={`border-b-2 px-3 py-2.5 text-base ${active ? 'border-brass text-ivory' : 'border-transparent text-ivory-dim hover:text-ivory'}`}
    >
      {children}
    </button>
  );
}

function DocumentsTab({ businessId }: { businessId: string }) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [documents, setDocuments] = useState<StaffDocument[]>([]);
  const [staffId, setStaffId] = useState('');
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [label, setLabel] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  function reload() {
    listStaff(businessId).then(setStaff);
    listStaffDocuments(businessId).then(setDocuments);
  }
  useEffect(reload, [businessId]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!staffId || !file) { setError('Choose a staff member and a file'); return; }
    setUploading(true);
    setError('');
    try {
      const path = await uploadStaffDocumentFile(businessId, staffId, file);
      await uploadStaffDocument(businessId, { staffId, docType, fileUrl: path, label, expiryDate: expiryDate || null });
      setStaffId(''); setLabel(''); setExpiryDate(''); setFile(null);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload document');
    } finally {
      setUploading(false);
    }
  }

  async function handleView(doc: StaffDocument) {
    try {
      const url = await getStaffDocumentUrl(doc.file_url);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setError('Could not open document');
    }
  }

  async function handleDelete(doc: StaffDocument) {
    if (!confirm(`Delete "${doc.label || doc.doc_type}"? This can't be undone.`)) return;
    await deleteStaffDocument(businessId, doc.id);
    reload();
  }

  return (
    <Section title="Staff Documents">
      <form onSubmit={handleUpload} className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-line p-4">
        <Field label="Staff member">
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory">
            <option value="">Select...</option>
            {staff.filter((s) => s.role === 'staff').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Document type">
          <select value={docType} onChange={(e) => setDocType(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory">
            {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Label (optional)"><input value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} /></Field>
        <Field label="Expiry (optional)"><input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory" /></Field>
        <Field label="File"><input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm text-ivory-dim" /></Field>
        <button type="submit" disabled={uploading} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </form>
      {error && <p className="text-base text-danger">{error}</p>}

      <div className="space-y-2">
        {documents.map((d) => {
          const expiringSoon = d.expiry_date && new Date(d.expiry_date).getTime() - Date.now() < 30 * 86400000;
          return (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-line px-4 py-3 text-base">
              <div>
                <span className="text-ivory">{d.profiles?.name || 'Unknown'}</span>
                <span className="text-ivory-dim"> · {d.doc_type}{d.label ? ` (${d.label})` : ''}</span>
                {d.expiry_date && (
                  <span className={`ml-2 text-sm ${expiringSoon ? 'text-warning' : 'text-ivory-dim'}`}>
                    expires {new Date(d.expiry_date).toLocaleDateString('en-GB')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <button type="button" onClick={() => handleView(d)} className="text-brass hover:underline">View</button>
                <button type="button" onClick={() => handleDelete(d)} className="text-danger hover:underline">Delete</button>
              </div>
            </div>
          );
        })}
        {documents.length === 0 && <p className="text-ivory-dim">No documents uploaded yet.</p>}
      </div>
    </Section>
  );
}

function CommissionTab({ businessId }: { businessId: string }) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [report, setReport] = useState<CommissionReportRow[]>([]);
  const [totalCommission, setTotalCommission] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rateType, setRateType] = useState<'percentage' | 'fixed_per_order'>('percentage');
  const [rateValue, setRateValue] = useState(0);

  function reload() {
    listStaff(businessId).then(setStaff);
    getCommissionReport(businessId).then((r) => { setReport(r.report); setTotalCommission(r.totalCommission); });
  }
  useEffect(reload, [businessId]);

  async function handleSave(staffId: string) {
    await setStaffCommission(businessId, staffId, { commissionType: rateType, commissionRate: rateValue });
    setEditingId(null);
    reload();
  }

  async function handleClear(staffId: string) {
    await setStaffCommission(businessId, staffId, { commissionType: null });
    reload();
  }

  return (
    <div className="space-y-6">
      <Section title="Commission Rates">
        <div className="space-y-2">
          {staff.filter((s) => s.role === 'staff').map((s) => {
            const reportRow = report.find((r) => r.staffId === s.id);
            return (
              <div key={s.id} className="rounded-lg border border-ink-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-base text-ivory">{s.name}</span>
                  {editingId === s.id ? (
                    <div className="flex items-center gap-2">
                      <select value={rateType} onChange={(e) => setRateType(e.target.value as 'percentage' | 'fixed_per_order')} className="rounded border border-ink-line bg-ink px-2 py-1 text-sm text-ivory">
                        <option value="percentage">% of sales</option>
                        <option value="fixed_per_order">AED per order</option>
                      </select>
                      <input type="number" min={0} value={rateValue} onFocus={(e) => e.target.select()} onChange={(e) => setRateValue(Number(e.target.value))} className="w-20 rounded border border-ink-line bg-ink px-2 py-1 text-sm text-ivory" />
                      <button type="button" onClick={() => handleSave(s.id)} className="text-sm text-brass hover:underline">Save</button>
                      <button type="button" onClick={() => setEditingId(null)} className="text-sm text-ivory-dim">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-sm">
                      {reportRow?.commissionType ? (
                        <span className="text-ivory-dim">{reportRow.commissionRate}{reportRow.commissionType === 'percentage' ? '%' : ' AED/order'}</span>
                      ) : (
                        <span className="text-ivory-dim">No commission set</span>
                      )}
                      <button type="button" onClick={() => { setEditingId(s.id); setRateType('percentage'); setRateValue(0); }} className="text-brass hover:underline">Edit</button>
                      {reportRow?.commissionType && <button type="button" onClick={() => handleClear(s.id)} className="text-danger hover:underline">Clear</button>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Commission Report (last 30 days)">
        <div className="rounded-xl border border-brass/30 bg-ink-soft p-4">
          <p className="text-xs uppercase tracking-wide text-brass">Total commission owed</p>
          <p className="mt-1 font-display text-2xl text-ivory">AED {totalCommission.toFixed(2)}</p>
        </div>
        <div className="space-y-2">
          {report.map((r) => (
            <div key={r.staffId} className="flex items-center justify-between text-sm text-ivory-dim">
              <span>{r.name}</span>
              <span>{r.orderCount} orders · AED {r.salesTotal.toFixed(2)} sales</span>
              <span className="text-ivory">AED {r.commission.toFixed(2)}</span>
            </div>
          ))}
          {report.length === 0 && <p className="text-ivory-dim">No staff have a commission rate set yet.</p>}
        </div>
      </Section>
    </div>
  );
}

function TipsTab({ businessId }: { businessId: string }) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [distributions, setDistributions] = useState<TipDistribution[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [periodStart, setPeriodStart] = useState(() => new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [totalAmount, setTotalAmount] = useState(0);
  const [method, setMethod] = useState<'even' | 'by_hours'>('even');
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function reload() {
    listStaff(businessId).then(setStaff);
    listTipDistributions(businessId).then(setDistributions);
  }
  useEffect(reload, [businessId]);

  function toggleStaff(id: string) {
    setSelectedStaff((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (selectedStaff.length === 0 || totalAmount <= 0) { setError('Pick at least one staff member and a total above 0'); return; }
    setSaving(true);
    setError('');
    try {
      await createTipDistribution(businessId, {
        periodStart: `${periodStart}T00:00:00.000Z`,
        periodEnd: `${periodEnd}T23:59:59.999Z`,
        totalAmountAed: totalAmount,
        method,
        staffIds: selectedStaff,
      });
      setShowAdd(false);
      setTotalAmount(0);
      setSelectedStaff([]);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create distribution');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="Tip Pooling" action={<button type="button" onClick={() => setShowAdd((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">+ Distribute tips</button>}>
      {showAdd && (
        <form onSubmit={handleCreate} className="space-y-3 rounded-lg border border-ink-line p-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Period start"><input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory" /></Field>
            <Field label="Period end"><input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory" /></Field>
            <Field label="Total tips (AED)"><input type="number" min={0} value={totalAmount} onFocus={(e) => e.target.select()} onChange={(e) => setTotalAmount(Number(e.target.value))} className={`${inputClass} w-32`} /></Field>
            <Field label="Split method">
              <select value={method} onChange={(e) => setMethod(e.target.value as 'even' | 'by_hours')} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory">
                <option value="even">Even split</option>
                <option value="by_hours">By hours worked</option>
              </select>
            </Field>
          </div>
          <div>
            <p className="mb-1.5 text-sm text-ivory-dim">Include staff</p>
            <div className="flex flex-wrap gap-3">
              {staff.filter((s) => s.role === 'staff').map((s) => (
                <label key={s.id} className="flex items-center gap-1.5 text-sm text-ivory">
                  <input type="checkbox" checked={selectedStaff.includes(s.id)} onChange={() => toggleStaff(s.id)} className="accent-brass" />
                  {s.name}
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button type="submit" disabled={saving} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
            {saving ? 'Distributing...' : 'Distribute'}
          </button>
        </form>
      )}
      <div className="space-y-3">
        {distributions.map((d) => (
          <div key={d.id} className="rounded-lg border border-ink-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-base text-ivory">
                AED {Number(d.total_amount_aed).toFixed(2)} · {new Date(d.period_start).toLocaleDateString('en-GB')} - {new Date(d.period_end).toLocaleDateString('en-GB')}
              </p>
              <span className="text-sm text-ivory-dim capitalize">{d.method.replace('_', ' ')}</span>
            </div>
            <div className="mt-2 space-y-1 border-t border-ink-line pt-2 text-sm">
              {(d.tip_distribution_shares || []).map((s) => (
                <div key={s.id} className="flex justify-between text-ivory-dim">
                  <span>{s.profiles?.name || 'Unknown'}</span>
                  <span className="text-ivory">AED {Number(s.amount_aed).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {distributions.length === 0 && <p className="text-ivory-dim">No tip distributions yet.</p>}
      </div>
    </Section>
  );
}
