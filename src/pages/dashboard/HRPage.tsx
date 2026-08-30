import { useEffect, useState, type ReactNode } from 'react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import {
  getBusiness, listStaff,
  listStaffDocuments, uploadStaffDocument, deleteStaffDocument, type StaffDocument,
  setStaffCommission, getCommissionReport, type CommissionReportRow,
  listTipDistributions, createTipDistribution, type TipDistribution,
  setStaffWage, listSchedules, createSchedule, deleteSchedule, getLaborCostReport,
} from '../../lib/authApi';
import { uploadStaffDocumentFile, getStaffDocumentUrl } from '../../lib/supabaseClient';
import type { StaffMember, AdminBusiness, StaffSchedule, LaborCostReport } from '../../types';
import { Section, Field, inputClass } from '../../components/ui';
import { useConfirm } from '../../components/ConfirmDialog';

const DOC_TYPES = ['Emirates ID', 'Passport', 'Visa', 'Labor Card', 'Employment Contract', 'Other'];

export default function HRPage() {
  const { user } = useSession();
  const { t } = useT();
  const businessId = user?.business_id;
  const [business, setBusiness] = useState<AdminBusiness | null>(null);
  const [tab, setTab] = useState<'documents' | 'commission' | 'tips' | 'scheduling' | 'labor-cost'>('documents');

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
          {t('HR is turned off for your business. Turn it on under Features, then come back here - each module (documents, commission, tips, scheduling, labor cost) can be enabled independently.')}
        </p>
      </div>
    );
  }

  const availableTabs = [
    hr.documents && { key: 'documents' as const, label: 'Staff Documents' },
    hr.commission && { key: 'commission' as const, label: 'Commission' },
    hr.tips && { key: 'tips' as const, label: 'Tip Pooling' },
    hr.scheduling && { key: 'scheduling' as const, label: 'Scheduling' },
    hr.laborCost && { key: 'labor-cost' as const, label: 'Labor Cost' },
  ].filter(Boolean) as { key: 'documents' | 'commission' | 'tips' | 'scheduling' | 'labor-cost'; label: string }[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ivory">HR</h1>
        <p className="mt-1 text-base text-ivory-dim">{t('Owner-only - staff accounts never see this section.')}</p>
      </div>
      {availableTabs.length === 0 ? (
        <p className="text-ivory-dim">{t('No HR modules are turned on yet - enable one under Features.')}</p>
      ) : (
        <>
          <div className="flex gap-1.5 border-b border-ink-line">
            {availableTabs.map((tabItem) => (
              <TabButton key={tabItem.key} active={tab === tabItem.key} onClick={() => setTab(tabItem.key)}>{t(tabItem.label)}</TabButton>
            ))}
          </div>
          {tab === 'documents' && hr.documents && <DocumentsTab businessId={businessId} />}
          {tab === 'commission' && hr.commission && <CommissionTab businessId={businessId} />}
          {tab === 'tips' && hr.tips && <TipsTab businessId={businessId} />}
          {tab === 'scheduling' && hr.scheduling && <SchedulingTab businessId={businessId} />}
          {tab === 'labor-cost' && hr.laborCost && <LaborCostTab businessId={businessId} />}
        </>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button"
      onClick={onClick}
      className={`border-b-2 px-2 py-1.5 text-sm sm:px-3 sm:py-2.5 sm:text-base ${active ? 'border-brass text-ivory' : 'border-transparent text-ivory-dim hover:text-ivory'}`}
    >
      {children}
    </button>
  );
}

function DocumentsTab({ businessId }: { businessId: string }) {
  const { t } = useT();
  const confirm = useConfirm();
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
    listStaff(businessId).then(setStaff).catch(() => {});
    listStaffDocuments(businessId).then(setDocuments).catch(() => {});
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
    if (!(await confirm({ title: t('Delete document?'), message: `${t('Delete')} "${doc.label || doc.doc_type}"? ${t("This can't be undone.")}`, confirmLabel: t('Delete'), danger: true }))) return;
    await deleteStaffDocument(businessId, doc.id);
    reload();
  }

  return (
    <Section title={t('Staff Documents')}>
      <form onSubmit={handleUpload} className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-line p-4">
        <Field label={t('Staff member')}>
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory">
            <option value="">{t('Select...')}</option>
            {staff.filter((s) => s.role === 'staff').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label={t('Document type')}>
          <select value={docType} onChange={(e) => setDocType(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory">
            {DOC_TYPES.map((dt) => <option key={dt} value={dt}>{t(dt)}</option>)}
          </select>
        </Field>
        <Field label={t('Label (optional)')}><input value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} /></Field>
        <Field label={t('Expiry (optional)')}><input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory" /></Field>
        <Field label={t('File')}><input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm text-ivory-dim" /></Field>
        <button type="submit" disabled={uploading} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
          {uploading ? t('Uploading...') : t('Upload')}
        </button>
      </form>
      {error && <p className="text-base text-danger">{error}</p>}

      <div className="space-y-2">
        {documents.map((d) => {
          const expiringSoon = d.expiry_date && new Date(d.expiry_date).getTime() - Date.now() < 30 * 86400000;
          return (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-line px-4 py-3 text-base">
              <div>
                <span className="text-ivory">{d.profiles?.name || t('Unknown')}</span>
                <span className="text-ivory-dim"> · {d.doc_type}{d.label ? ` (${d.label})` : ''}</span>
                {d.expiry_date && (
                  <span className={`ml-2 text-sm ${expiringSoon ? 'text-warning' : 'text-ivory-dim'}`}>
                    {t('expires')} {new Date(d.expiry_date).toLocaleDateString('en-GB')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <button type="button" onClick={() => handleView(d)} className="text-brass hover:underline">{t('View')}</button>
                <button type="button" onClick={() => handleDelete(d)} className="text-danger hover:underline">{t('Delete')}</button>
              </div>
            </div>
          );
        })}
        {documents.length === 0 && <p className="text-ivory-dim">{t('No documents uploaded yet.')}</p>}
      </div>
    </Section>
  );
}

function CommissionTab({ businessId }: { businessId: string }) {
  const { t } = useT();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [report, setReport] = useState<CommissionReportRow[]>([]);
  const [totalCommission, setTotalCommission] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rateType, setRateType] = useState<'percentage' | 'fixed_per_order'>('percentage');
  const [rateValue, setRateValue] = useState(0);

  function reload() {
    listStaff(businessId).then(setStaff).catch(() => {});
    getCommissionReport(businessId).then((r) => { setReport(r.report); setTotalCommission(r.totalCommission); }).catch(() => {});
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
      <Section title={t('Commission Rates')}>
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
                        <option value="percentage">{t('% of sales')}</option>
                        <option value="fixed_per_order">{t('AED per order')}</option>
                      </select>
                      <input type="number" min={0} value={rateValue} onFocus={(e) => e.target.select()} onChange={(e) => setRateValue(Number(e.target.value))} className="w-20 rounded border border-ink-line bg-ink px-2 py-1 text-sm text-ivory" />
                      <button type="button" onClick={() => handleSave(s.id)} className="text-sm text-brass hover:underline">{t('Save')}</button>
                      <button type="button" onClick={() => setEditingId(null)} className="text-sm text-ivory-dim">{t('Cancel')}</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-sm">
                      {reportRow?.commissionType ? (
                        <span className="text-ivory-dim">{reportRow.commissionRate}{reportRow.commissionType === 'percentage' ? '%' : ' AED/order'}</span>
                      ) : (
                        <span className="text-ivory-dim">{t('No commission set')}</span>
                      )}
                      <button type="button" onClick={() => { setEditingId(s.id); setRateType('percentage'); setRateValue(0); }} className="text-brass hover:underline">{t('Edit')}</button>
                      {reportRow?.commissionType && <button type="button" onClick={() => handleClear(s.id)} className="text-danger hover:underline">{t('Clear')}</button>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title={t('Commission Report (last 30 days)')}>
        <div className="rounded-xl border border-brass/30 bg-ink-soft p-4">
          <p className="text-xs uppercase tracking-wide text-brass">{t('Total commission owed')}</p>
          <p className="mt-1 font-display text-2xl text-ivory">AED {totalCommission.toFixed(2)}</p>
        </div>
        <div className="space-y-2">
          {report.map((r) => (
            <div key={r.staffId} className="flex items-center justify-between text-sm text-ivory-dim">
              <span>{r.name}</span>
              <span>{r.orderCount} {t('orders ·')} AED {r.salesTotal.toFixed(2)} {t('sales')}</span>
              <span className="text-ivory">AED {r.commission.toFixed(2)}</span>
            </div>
          ))}
          {report.length === 0 && <p className="text-ivory-dim">{t('No staff have a commission rate set yet.')}</p>}
        </div>
      </Section>
    </div>
  );
}

function SchedulingTab({ businessId }: { businessId: string }) {
  const { t } = useT();
  const confirm = useConfirm();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [schedules, setSchedules] = useState<StaffSchedule[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [totalForecastCostAed, setTotalForecastCostAed] = useState(0);
  const [untrackedShiftCount, setUntrackedShiftCount] = useState(0);
  const [rangeFrom, setRangeFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [rangeTo, setRangeTo] = useState(() => new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10));
  const [showAdd, setShowAdd] = useState(false);
  const [staffId, setStaffId] = useState('');
  const [shiftDate, setShiftDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [roleLabel, setRoleLabel] = useState('');
  const [error, setError] = useState('');

  function reload() {
    listStaff(businessId).then(setStaff).catch(() => {});
    listSchedules(businessId, { from: `${rangeFrom}T00:00:00.000Z`, to: `${rangeTo}T23:59:59.999Z` }).then((r) => {
      setSchedules(r.schedules);
      setTotalHours(r.totalHours);
      setTotalForecastCostAed(r.totalForecastCostAed);
      setUntrackedShiftCount(r.untrackedShiftCount);
    }).catch(() => {});
  }
  useEffect(reload, [businessId, rangeFrom, rangeTo]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!staffId) { setError('Pick a staff member'); return; }
    const scheduledStart = `${shiftDate}T${startTime}:00`;
    const scheduledEnd = `${shiftDate}T${endTime}:00`;
    if (scheduledEnd <= scheduledStart) { setError('End time must be after start time (same-day shifts only for now)'); return; }
    try {
      await createSchedule(businessId, { staffId, scheduledStart, scheduledEnd, roleLabel });
      setShowAdd(false);
      setRoleLabel('');
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add shift');
    }
  }

  async function handleDelete(id: string) {
    if (!(await confirm({ title: t('Remove shift?'), message: t('Remove this scheduled shift?'), confirmLabel: t('Remove'), danger: true }))) return;
    await deleteSchedule(businessId, id);
    reload();
  }

  return (
    <Section title={t('Roster')} action={
      <div className="flex items-center gap-2">
        <input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-2 py-1.5 text-sm text-ivory" />
        <span className="text-ivory-dim">{t('to')}</span>
        <input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-2 py-1.5 text-sm text-ivory" />
        <button type="button" onClick={() => setShowAdd((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">+ {t('Add shift')}</button>
      </div>
    }>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-ink-line p-3">
          <p className="text-xs text-ivory-dim">{t('Scheduled hours')}</p>
          <p className="text-xl text-ivory">{totalHours}</p>
        </div>
        <div className="rounded-lg border border-ink-line p-3">
          <p className="text-xs text-ivory-dim">{t('Forecasted labor cost')}</p>
          <p className="text-xl text-brass">AED {totalForecastCostAed.toFixed(2)}</p>
        </div>
        {untrackedShiftCount > 0 && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
            <p className="text-xs text-warning">{untrackedShiftCount} {t('shift(s) belong to staff with no hourly rate set - excluded from the forecast above. Set rates in the Labor Cost tab.')}</p>
          </div>
        )}
      </div>

      {showAdd && (
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-line p-4">
          <Field label={t('Staff')}>
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory">
              <option value="">{t('Select...')}</option>
              {staff.filter((s) => s.role === 'staff').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label={t('Date')}><input type="date" value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory" /></Field>
          <Field label={t('Start')}><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory" /></Field>
          <Field label={t('End')}><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory" /></Field>
          <Field label={t('Role (optional)')}><input value={roleLabel} onChange={(e) => setRoleLabel(e.target.value)} placeholder="e.g. Floor, Kitchen" className={inputClass} /></Field>
          <button type="submit" className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90">{t('Add')}</button>
        </form>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="space-y-2">
        {schedules.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-line px-3 py-2 text-sm">
            <span className="text-ivory">
              {s.staffName}{s.roleLabel ? ` · ${s.roleLabel}` : ''} — {new Date(s.scheduledStart).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              {' - '}{new Date(s.scheduledEnd).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="flex items-center gap-3 text-ivory-dim">
              <span>{s.hours}h{s.forecastCostAed != null ? ` · AED ${s.forecastCostAed.toFixed(2)}` : ` · ${t('no rate set')}`}</span>
              <button type="button" onClick={() => handleDelete(s.id)} className="text-danger hover:underline">{t('Remove')}</button>
            </span>
          </div>
        ))}
        {schedules.length === 0 && <p className="text-ivory-dim">{t('No shifts scheduled in this range.')}</p>}
      </div>
    </Section>
  );
}

function LaborCostTab({ businessId }: { businessId: string }) {
  const { t } = useT();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [wages, setWages] = useState<Record<string, number | null>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rateValue, setRateValue] = useState(0);
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<LaborCostReport | null>(null);
  const [loading, setLoading] = useState(true);

  function reload() {
    setLoading(true);
    listStaff(businessId).then(setStaff).catch(() => {});
    const to = new Date().toISOString();
    const from = new Date(Date.now() - days * 86400000).toISOString();
    getLaborCostReport(businessId, { from, to }).then((r) => {
      setReport(r);
      const map: Record<string, number | null> = {};
      for (const s of r.byStaff) map[s.staffId] = s.hourlyRateAed;
      setWages((prev) => ({ ...prev, ...map }));
    }).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(reload, [businessId, days]);

  async function handleSaveWage(staffId: string) {
    const updated = await setStaffWage(businessId, staffId, rateValue || null);
    setWages((prev) => ({ ...prev, [staffId]: updated.hourly_rate_aed }));
    setEditingId(null);
    reload();
  }

  async function handleClearWage(staffId: string) {
    await setStaffWage(businessId, staffId, null);
    setWages((prev) => ({ ...prev, [staffId]: null }));
    reload();
  }

  return (
    <div className="space-y-6">
      <Section title={t('Hourly rates')}>
        <div className="space-y-2">
          {staff.filter((s) => s.role === 'staff').map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-line p-3">
              <span className="text-base text-ivory">{s.name}</span>
              {editingId === s.id ? (
                <div className="flex items-center gap-2">
                  <input type="number" min={0} value={rateValue} onFocus={(e) => e.target.select()} onChange={(e) => setRateValue(Number(e.target.value))} className="w-24 rounded border border-ink-line bg-ink px-2 py-1 text-sm text-ivory" />
                  <span className="text-sm text-ivory-dim">AED/hr</span>
                  <button type="button" onClick={() => handleSaveWage(s.id)} className="text-sm text-brass hover:underline">{t('Save')}</button>
                  <button type="button" onClick={() => setEditingId(null)} className="text-sm text-ivory-dim">{t('Cancel')}</button>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-ivory-dim">{wages[s.id] != null ? `AED ${wages[s.id]!.toFixed(2)}/hr` : t('No rate set')}</span>
                  <button type="button" onClick={() => { setEditingId(s.id); setRateValue(wages[s.id] || 0); }} className="text-brass hover:underline">{t('Edit')}</button>
                  {wages[s.id] != null && <button type="button" onClick={() => handleClearWage(s.id)} className="text-danger hover:underline">{t('Clear')}</button>}
                </div>
              )}
            </div>
          ))}
          {staff.filter((s) => s.role === 'staff').length === 0 && <p className="text-ivory-dim">{t('No staff accounts yet.')}</p>}
        </div>
      </Section>

      <Section title={t('Labor cost report')} action={
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-lg border border-ink-line bg-ink px-3 py-1.5 text-sm text-ivory">
          <option value={7}>{t('Last 7 days')}</option>
          <option value={30}>{t('Last 30 days')}</option>
          <option value={90}>{t('Last 90 days')}</option>
        </select>
      }>
        {loading && <p className="text-ivory-dim">Loading...</p>}
        {!loading && report && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-ink-line p-3">
                <p className="text-xs text-ivory-dim">{t('Revenue')}</p>
                <p className="text-xl text-ivory">AED {report.totalRevenueAed.toFixed(2)}</p>
              </div>
              <div className="rounded-lg border border-ink-line p-3">
                <p className="text-xs text-ivory-dim">{t('Labor cost')}</p>
                <p className="text-xl text-ivory">AED {report.totalLaborCostAed.toFixed(2)}</p>
              </div>
              <div className="rounded-lg border border-ink-line p-3">
                <p className="text-xs text-ivory-dim">{t('Labor cost %')}</p>
                <p className="text-xl text-brass">{report.laborCostPct != null ? `${report.laborCostPct}%` : t('n/a')}</p>
              </div>
            </div>
            {report.untrackedHours > 0 && (
              <p className="text-sm text-warning">{report.untrackedHours} {t('worked hour(s) belong to staff with no rate set - excluded from the cost above.')}</p>
            )}
            {report.overtimeShiftCount > 0 && (
              <p className="text-sm text-warning">{report.overtimeShiftCount} {t('shift(s) exceeded 8 hours in this window.')}</p>
            )}
            <div className="space-y-1">
              {report.byStaff.map((s) => (
                <div key={s.staffId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-line px-3 py-2 text-sm">
                  <span className="text-ivory">{s.name}{s.overtimeShifts > 0 ? ` (${s.overtimeShifts} ${t('overtime shift')}${s.overtimeShifts > 1 ? 's' : ''})` : ''}</span>
                  <span className="text-ivory-dim">{s.hours}h {s.hourlyRateAed != null ? `· AED ${s.costAed.toFixed(2)}` : `· ${t('no rate set')}`}</span>
                </div>
              ))}
              {report.byStaff.length === 0 && <p className="text-ivory-dim">{t('No clocked shifts in this window.')}</p>}
            </div>
          </>
        )}
      </Section>
    </div>
  );
}

function TipsTab({ businessId }: { businessId: string }) {
  const { t } = useT();
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
    listStaff(businessId).then(setStaff).catch(() => {});
    listTipDistributions(businessId).then(setDistributions).catch(() => {});
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
    <Section title={t('Tip Pooling')} action={<button type="button" onClick={() => setShowAdd((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">{t('+ Distribute tips')}</button>}>
      {showAdd && (
        <form onSubmit={handleCreate} className="space-y-3 rounded-lg border border-ink-line p-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t('Period start')}><input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory" /></Field>
            <Field label={t('Period end')}><input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory" /></Field>
            <Field label={t('Total tips (AED)')}><input type="number" min={0} value={totalAmount} onFocus={(e) => e.target.select()} onChange={(e) => setTotalAmount(Number(e.target.value))} className={`${inputClass} w-32`} /></Field>
            <Field label={t('Split method')}>
              <select value={method} onChange={(e) => setMethod(e.target.value as 'even' | 'by_hours')} className="rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory">
                <option value="even">{t('Even split')}</option>
                <option value="by_hours">{t('By hours worked')}</option>
              </select>
            </Field>
          </div>
          <div>
            <p className="mb-1.5 text-sm text-ivory-dim">{t('Include staff')}</p>
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
            {saving ? t('Distributing...') : t('Distribute')}
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
              <span className="text-sm text-ivory-dim">{d.method === 'even' ? t('Even split') : t('By hours worked')}</span>
            </div>
            <div className="mt-2 space-y-1 border-t border-ink-line pt-2 text-sm">
              {(d.tip_distribution_shares || []).map((s) => (
                <div key={s.id} className="flex justify-between text-ivory-dim">
                  <span>{s.profiles?.name || t('Unknown')}</span>
                  <span className="text-ivory">AED {Number(s.amount_aed).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {distributions.length === 0 && <p className="text-ivory-dim">{t('No tip distributions yet.')}</p>}
      </div>
    </Section>
  );
}
