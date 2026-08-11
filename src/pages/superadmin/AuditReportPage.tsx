import { useState } from 'react';
import { downloadPlatformAuditReport } from '../../lib/authApi';
import { Section } from '../../components/ui';

export default function AuditReportPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  async function handleIssue() {
    setGenerating(true);
    setError('');
    try {
      await downloadPlatformAuditReport(year);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate audit report');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ivory">Audit Report</h1>
        <p className="mt-1 text-base text-ivory-dim">
          Every signed contract and every billing receipt Tavzio has issued, across every client, for one year -
          the platform's own revenue record. Press Issue and a single PDF downloads immediately, ready to hand
          to the FTA or an accountant.
        </p>
      </div>

      <Section title="Issue Audit Report" action={
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-ink-line bg-ink px-2.5 py-1.5 text-sm text-ivory"
          >
            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={handleIssue}
            disabled={generating}
            className="rounded-lg bg-brass px-4 py-2 text-sm font-medium text-ink hover:opacity-90 disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Issue Audit Report'}
          </button>
        </div>
      }>
        <p className="text-base text-ivory-dim">
          Compiled directly from live contract and billing-receipt records at the moment you press the button -
          nothing here is entered by hand, so it always matches what's actually on file.
        </p>
        {error && <p className="text-base text-danger">{error}</p>}
      </Section>
    </div>
  );
}
