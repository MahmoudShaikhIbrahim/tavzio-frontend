import { useEffect, useState } from 'react';
import { getMyOrganization, getOrgReport, type Organization, type OrgReportRow } from '../../lib/authApi';
import { Section } from '../../components/ui';

export default function OrgOverviewPage() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [report, setReport] = useState<{ locations: OrgReportRow[]; grandTotal: number } | null>(null);

  useEffect(() => {
    getMyOrganization().then(setOrg);
    getOrgReport().then(setReport);
  }, []);

  if (!org) return <p className="text-ivory-dim">Loading...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ivory">{org.name}</h1>
        <p className="mt-1 text-base text-ivory-dim">{(org.businesses || []).length} location(s)</p>
      </div>

      <Section title="Combined Revenue (last 30 days)">
        {report ? (
          <>
            <div className="rounded-xl border border-brass/30 bg-ink-soft p-4">
              <p className="text-xs uppercase tracking-wide text-brass">Total across all locations</p>
              <p className="mt-1 font-display text-2xl text-ivory">AED {report.grandTotal.toFixed(2)}</p>
            </div>
            <div className="space-y-2">
              {report.locations.map((l) => (
                <div key={l.businessId} className="flex items-center justify-between text-base">
                  <span className="text-ivory">{l.name}</span>
                  <span className="text-ivory-dim">{l.orderCount} orders · <span className="text-ivory">AED {l.total.toFixed(2)}</span></span>
                </div>
              ))}
              {report.locations.length === 0 && <p className="text-ivory-dim">No locations linked yet.</p>}
            </div>
          </>
        ) : <p className="text-ivory-dim">Loading...</p>}
      </Section>

      <Section title="Locations">
        <div className="grid gap-3 sm:grid-cols-2">
          {(org.businesses || []).map((b) => (
            <div key={b.id} className="rounded-lg border border-ink-line p-4">
              <p className="text-base text-ivory">{b.name}</p>
              <p className="text-sm text-ivory-dim capitalize">{b.category} · {b.status}</p>
            </div>
          ))}
          {(org.businesses || []).length === 0 && <p className="text-ivory-dim">No locations linked yet - contact Tavzio to link one.</p>}
        </div>
      </Section>
    </div>
  );
}
