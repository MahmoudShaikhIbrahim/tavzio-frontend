import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { getCurrentBusinessDate, runNightAudit, listNightAudits, type NightAudit } from '../../lib/authApi';
import { Section } from '../../components/ui';

export default function NightAuditPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [businessDate, setBusinessDate] = useState<string | null>(null);
  const [audits, setAudits] = useState<NightAudit[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  function reload() {
    if (!businessId) return;
    getCurrentBusinessDate(businessId).then((r) => setBusinessDate(r.businessDate));
    listNightAudits(businessId).then(setAudits);
  }
  useEffect(reload, [businessId]);

  async function handleRun() {
    if (!businessId) return;
    if (!confirm(`Run night audit for ${businessDate}? This closes out the day - occupancy, revenue, and arrivals/departures get locked in.`)) return;
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

  const alreadyRunToday = audits.some((a) => a.business_date === businessDate);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ivory">Night Audit</h1>
        <p className="mt-1 text-base text-ivory-dim">
          Closes out the business day - locks in occupancy, room/F&B revenue, and arrivals/departures for the
          record. Run this once per day, typically overnight.
        </p>
      </div>

      <Section title="Run Audit">
        {businessDate && (
          <div className="rounded-xl border border-brass/30 bg-ink-soft p-4">
            <p className="text-xs uppercase tracking-wide text-brass">Current business date</p>
            <p className="mt-1 font-display text-2xl text-ivory">{businessDate}</p>
          </div>
        )}
        {alreadyRunToday && <p className="text-sm text-ivory-dim">Already run for {businessDate}.</p>}
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="button"
          onClick={handleRun}
          disabled={running || alreadyRunToday}
          className="rounded-lg bg-brass px-4 py-2.5 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50"
        >
          {running ? 'Running...' : alreadyRunToday ? 'Already run today' : 'Run night audit'}
        </button>
      </Section>

      <Section title="History">
        <div className="space-y-3">
          {audits.map((a) => (
            <div key={a.id} className="rounded-lg border border-ink-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-base text-ivory">{a.business_date}</p>
                <p className="text-sm text-ivory-dim">Run at {new Date(a.run_at).toLocaleString('en-GB')}</p>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-ivory-dim sm:grid-cols-4">
                <p>Occupancy: <span className="text-ivory">{(a.occupancy_rate * 100).toFixed(0)}%</span></p>
                <p>Rooms sold: <span className="text-ivory">{a.rooms_sold} / {a.rooms_available}</span></p>
                <p>Arrivals: <span className="text-ivory">{a.arrivals_count}</span></p>
                <p>Departures: <span className="text-ivory">{a.departures_count}</span></p>
                <p>Room revenue: <span className="text-ivory">AED {a.room_revenue_aed.toFixed(2)}</span></p>
                <p>F&B revenue: <span className="text-ivory">AED {a.fnb_revenue_aed.toFixed(2)}</span></p>
                <p>Other revenue: <span className="text-ivory">AED {a.other_revenue_aed.toFixed(2)}</span></p>
                <p>Total payments: <span className="text-ivory">AED {a.total_payments_aed.toFixed(2)}</span></p>
              </div>
            </div>
          ))}
          {audits.length === 0 && <p className="text-ivory-dim">No audits run yet.</p>}
        </div>
      </Section>
    </div>
  );
}
