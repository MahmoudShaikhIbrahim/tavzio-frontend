import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import { getCurrentBusinessDate, getNightAuditPreview, runNightAudit, listNightAudits, type NightAudit, type NightAuditPreview } from '../../lib/authApi';
import { Section } from '../../components/ui';
import { useConfirm } from '../../components/ConfirmDialog';

export default function NightAuditPage() {
  const confirm = useConfirm();
  const { user } = useSession();
  const { t } = useT();
  const businessId = user?.business_id;
  const [businessDate, setBusinessDate] = useState<string | null>(null);
  const [preview, setPreview] = useState<NightAuditPreview | null>(null);
  const [audits, setAudits] = useState<NightAudit[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  function reload() {
    if (!businessId) return;
    getCurrentBusinessDate(businessId).then((r) => setBusinessDate(r.businessDate)).catch(() => {});
    getNightAuditPreview(businessId).then(setPreview).catch(() => {});
    listNightAudits(businessId).then(setAudits).catch(() => {});
  }
  useEffect(reload, [businessId]);

  async function handleRun() {
    if (!businessId) return;
    const parts = [`${t('Run night audit for')} ${businessDate}? ${t('This closes out the day - occupancy, revenue, and arrivals/departures get locked in.')}`];
    if (preview?.noShowCandidateCount) parts.push(`${preview.noShowCandidateCount} ${t('unarrived confirmed reservation(s) will be marked no-show.')}`);
    if (!(await confirm({ title: t('Run night audit?'), message: parts.join('\n\n'), confirmLabel: t('Run audit') }))) return;
    setRunning(true);
    setError('');
    try {
      await runNightAudit(businessId);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not run the night audit');
    } finally {
      setRunning(false);
    }
  }

  if (!businessId) return <p className="text-ivory-dim">Loading...</p>;

  const alreadyRunToday = preview?.alreadyRun ?? audits.some((a) => a.business_date === businessDate);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ivory">{t('Night Audit')}</h1>
        <p className="mt-1 text-base text-ivory-dim">
          {t('Closes out the business day - locks in occupancy, room/F&B revenue, and arrivals/departures for the record, and processes any reservations that never arrived. Run this once per day, typically overnight.')}
        </p>
      </div>

      <Section title={t('Run Audit')}>
        {businessDate && (
          <div className="rounded-xl border border-brass/30 bg-ink-soft p-4">
            <p className="text-xs uppercase tracking-wide text-brass">{t('Current business date')}</p>
            <p className="mt-1 font-display text-2xl text-ivory">{businessDate}</p>
          </div>
        )}
        {preview && !alreadyRunToday && (preview.noShowCandidateCount > 0 || preview.unresolvedDeparturesCount > 0) && (
          <div className="space-y-1 rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">
            {preview.noShowCandidateCount > 0 && (
              <p className="text-warning">{preview.noShowCandidateCount} {t('confirmed reservation(s) never arrived - running the audit will mark them no-show.')}</p>
            )}
            {preview.unresolvedDeparturesCount > 0 && (
              <p className="text-warning">{preview.unresolvedDeparturesCount} {t('guest(s) are still checked in past their checkout date - the audit will flag this, not check them out automatically.')}</p>
            )}
          </div>
        )}
        {alreadyRunToday && <p className="text-sm text-ivory-dim">{t('Already run for')} {businessDate}.</p>}
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="button"
          onClick={handleRun}
          disabled={running || alreadyRunToday}
          className="rounded-lg bg-brass px-4 py-2.5 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50"
        >
          {running ? t('Running...') : alreadyRunToday ? t('Already run today') : t('Run night audit')}
        </button>
      </Section>

      <Section title={t('History')}>
        <div className="space-y-3">
          {audits.map((a) => (
            <div key={a.id} className="rounded-lg border border-ink-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-base text-ivory">{a.business_date}</p>
                <p className="text-sm text-ivory-dim">{t('Run at')} {new Date(a.run_at).toLocaleString('en-GB')}</p>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-ivory-dim sm:grid-cols-4">
                <p>{t('Occupancy:')} <span className="text-ivory">{a.occupancy_rate.toFixed(0)}%</span></p>
                <p>{t('Rooms sold:')} <span className="text-ivory">{a.rooms_sold} / {a.rooms_available}</span></p>
                <p>{t('Arrivals:')} <span className="text-ivory">{a.arrivals_count}</span></p>
                <p>{t('Departures:')} <span className="text-ivory">{a.departures_count}</span></p>
                <p>{t('Room revenue:')} <span className="text-ivory">AED {a.room_revenue_aed.toFixed(2)}</span></p>
                <p>{t('F&B revenue:')} <span className="text-ivory">AED {a.fnb_revenue_aed.toFixed(2)}</span></p>
                <p>{t('Other revenue:')} <span className="text-ivory">AED {a.other_revenue_aed.toFixed(2)}</span></p>
                <p>{t('Total payments:')} <span className="text-ivory">AED {a.total_payments_aed.toFixed(2)}</span></p>
                {a.no_shows_processed > 0 && <p>{t('No-shows processed:')} <span className="text-warning">{a.no_shows_processed}</span></p>}
                {a.unresolved_departures_count > 0 && <p>{t('Unresolved departures:')} <span className="text-warning">{a.unresolved_departures_count}</span></p>}
              </div>
            </div>
          ))}
          {audits.length === 0 && <p className="text-ivory-dim">{t('No audits run yet.')}</p>}
        </div>
      </Section>
    </div>
  );
}
