import { useEffect, useState } from 'react';
import { getMyOrganization, getOrgReport, getHotelOrgReport, type Organization, type OrgReportRow, type HotelOrgReport } from '../../lib/authApi';
import { Section } from '../../components/ui';

export default function OrgOverviewPage() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [report, setReport] = useState<{ locations: OrgReportRow[]; grandTotal: number } | null>(null);
  const [hotelReport, setHotelReport] = useState<HotelOrgReport | null>(null);

  useEffect(() => {
    getMyOrganization().then(setOrg);
    getOrgReport().then(setReport);
    getHotelOrgReport().then(setHotelReport);
  }, []);

  if (!org) return <p className="text-ivory-dim">Loading...</p>;

  const hasHotelLocations = (org.businesses || []).some((b) => b.category === 'hotel');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ivory">{org.name}</h1>
        <p className="mt-1 text-base text-ivory-dim">{(org.businesses || []).length} location(s)</p>
      </div>

      <Section title="Combined Revenue (last 30 days)">
        {report ? (
          <>
            <div className="rounded-2xl border border-brass/30 bg-ink-soft p-4 shadow-sm">
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

      {hasHotelLocations && (
        <Section title="Hotel Performance (last 30 days)">
          <p className="text-sm text-ivory-dim">
            Occupancy, ADR (average daily rate), and RevPAR (revenue per available room) - the standard cross-property
            comparison, from each location's own night audit history.
          </p>
          {hotelReport ? (
            <>
              {hotelReport.orgTotals && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-brass/30 bg-ink-soft p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-brass">Total room revenue</p>
                    <p className="mt-1 font-display text-2xl text-ivory">AED {hotelReport.orgTotals.totalRoomRevenueAed.toFixed(2)}</p>
                  </div>
                  <div className="rounded-2xl border border-brass/30 bg-ink-soft p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-brass">Total rooms across group</p>
                    <p className="mt-1 font-display text-2xl text-ivory">{hotelReport.orgTotals.totalRoomsAvailable}</p>
                  </div>
                </div>
              )}
              {hotelReport.orgTotals && hotelReport.orgTotals.locationsWithNoAuditData > 0 && (
                <p className="text-sm text-warning">
                  {hotelReport.orgTotals.locationsWithNoAuditData} hotel location(s) have no night audit data in this window - excluded from occupancy/ADR/RevPAR until they run one.
                </p>
              )}
              <div className="space-y-2">
                {hotelReport.locations.map((l) => (
                  <div key={l.businessId} className="rounded-2xl border border-ink-line p-3 shadow-sm">
                    <p className="text-base text-ivory">{l.name}</p>
                    {l.auditedDays > 0 ? (
                      <p className="text-sm text-ivory-dim">
                        Occupancy <span className="text-ivory">{l.occupancyPct}%</span> ·
                        {' '}ADR <span className="text-ivory">AED {l.adrAed?.toFixed(2)}</span> ·
                        {' '}RevPAR <span className="text-brass">AED {l.revParAed?.toFixed(2)}</span>
                      </p>
                    ) : (
                      <p className="text-sm text-warning">No night audit data in this window.</p>
                    )}
                  </div>
                ))}
                {hotelReport.locations.length === 0 && <p className="text-ivory-dim">No hotel locations linked yet.</p>}
              </div>
            </>
          ) : <p className="text-ivory-dim">Loading...</p>}
        </Section>
      )}

      <Section title="Locations">
        <div className="grid gap-3 sm:grid-cols-2">
          {(org.businesses || []).map((b) => (
            <div key={b.id} className="flex items-center gap-3 rounded-2xl border border-ink-line p-4 shadow-sm">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brass/15 font-display text-sm font-medium text-brass">
                {b.name.trim()[0]?.toUpperCase() || '?'}
              </span>
              <div className="min-w-0">
                <p className="truncate text-base text-ivory">{b.name}</p>
                <p className="text-sm text-ivory-dim capitalize">{b.category} · {b.status}</p>
              </div>
            </div>
          ))}
          {(org.businesses || []).length === 0 && <p className="text-ivory-dim">No locations linked yet - contact Tavzio to link one.</p>}
        </div>
      </Section>
    </div>
  );
}
