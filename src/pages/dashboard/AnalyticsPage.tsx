import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  getAnalyticsSummary, getCardBreakdown, getSalesByChannel, type SalesByChannel,
  getTopItems, getRevenueTrend, getPeakHours, getKitchenPerformance, getHotelPerformance, getBusiness,
  type TopItemsReport, type RevenueTrend, type PeakHours, type KitchenPerformance, type HotelPerformance,
} from '../../lib/authApi';
import { subscribeToBusinessTable } from '../../lib/supabaseClient';
import { usePollingFallback } from '../../hooks/usePollingFallback';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import type { AnalyticsSummary, CardBreakdownItem } from '../../types';
import { Section } from '../../components/ui';

// Brass-led palette matching the rest of the dashboard, not recharts'
// default rainbow set - a pie chart is still part of the same premium
// theme as everything else, not a generic library default.
const CHANNEL_COLORS = ['#b8925a', '#6b8f8c', '#a3654f', '#7d7a9e', '#8a9a5b'];

export default function AnalyticsPage() {
  const { t } = useT();
  const { user } = useSession();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [cardBreakdown, setCardBreakdown] = useState<CardBreakdownItem[]>([]);
  const [salesByChannel, setSalesByChannel] = useState<SalesByChannel | null>(null);
  const [topItems, setTopItems] = useState<TopItemsReport | null>(null);
  const [revenueTrend, setRevenueTrend] = useState<RevenueTrend | null>(null);
  const [peakHours, setPeakHours] = useState<PeakHours | null>(null);
  const [kitchenPerf, setKitchenPerf] = useState<KitchenPerformance | null>(null);
  const [hotelPerf, setHotelPerf] = useState<HotelPerformance | null>(null);
  const [isHotel, setIsHotel] = useState(false);
  const [topItemsView, setTopItemsView] = useState<'revenue' | 'quantity'>('revenue');
  const [liveTapCount, setLiveTapCount] = useState(0);
  const [liveFeed, setLiveFeed] = useState<string[]>([]);
  const [tab, setTab] = useState<'overview' | 'sales' | 'kitchen' | 'hotel'>('overview');

  const businessId = user?.business_id;

  function reload() {
    if (!businessId) return;
    // Real, systemic fix (part of the same audit): every one of these
    // was an unhandled .then() with no .catch(), and this whole
    // function is called every 5 seconds by usePollingFallback below -
    // a single transient failure on any one of these eight calls
    // became an uncaught promise rejection repeating forever, exactly
    // the same root cause already found and fixed on Orders.
    getAnalyticsSummary(businessId).then(setSummary).catch(() => {});
    getCardBreakdown(businessId).then(setCardBreakdown).catch(() => {});
    getSalesByChannel(businessId).then(setSalesByChannel).catch(() => {});
    getTopItems(businessId, { limit: 10 }).then(setTopItems).catch(() => {});
    getRevenueTrend(businessId).then(setRevenueTrend).catch(() => {});
    getPeakHours(businessId).then(setPeakHours).catch(() => {});
    getKitchenPerformance(businessId).then(setKitchenPerf).catch(() => {});
    getBusiness(businessId).then((b) => {
      setIsHotel(b.category === 'hotel');
      if (b.category === 'hotel') getHotelPerformance(businessId).then(setHotelPerf).catch(() => {});
    }).catch(() => {});
  }

  useEffect(reload, [businessId]);
  usePollingFallback(reload, !!businessId);
  // immediately, without waiting for a manual refresh. This is what "leave
  // the page open, never refresh" actually looks like under the hood.
  // (The Supabase client is already authorized for this user by useSession
  // centrally - no need to do that again here.)
  useEffect(() => {
    if (!businessId) return;

    const unsubscribe = subscribeToBusinessTable(businessId, 'events', (row) => {
      if (row.type === 'nfc_tap') {
        setLiveTapCount((n) => n + 1);
        setLiveFeed((f) => [`Tap at ${new Date(row.created_at as string).toLocaleTimeString()}`, ...f].slice(0, 5));
      }
    });

    return unsubscribe;
  }, [businessId]);

  if (!summary) return <p className="text-ivory-dim">{t('Loading...')}</p>;

  const returning = summary.returningVisitors;
  const returningPct = returning && returning.new + returning.returning > 0
    ? Math.round((returning.returning / (returning.new + returning.returning)) * 100)
    : null;

  const showKitchenTab = !!kitchenPerf && kitchenPerf.trackedTicketCount > 0;
  const showHotelTab = isHotel && !!hotelPerf;
  const tabs = [
    { key: 'overview' as const, label: t('Overview') },
    { key: 'sales' as const, label: t('Sales') },
    showKitchenTab && { key: 'kitchen' as const, label: t('Kitchen') },
    showHotelTab && { key: 'hotel' as const, label: t('Hotel Performance') },
  ].filter((tb): tb is { key: 'overview' | 'sales' | 'kitchen' | 'hotel'; label: string } => !!tb);
  const activeTab = tabs.some((tb) => tb.key === tab) ? tab : 'overview';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label={t('Total taps (30d)')} value={summary.totalTaps + liveTapCount} live={liveTapCount > 0} />
        <Stat label={t('Top hour')} value={summary.topHours[0] ? `${summary.topHours[0].hour}:00` : '—'} />
        <Stat label={t('Busiest day')} value={summary.busiestDays[0] ? summary.busiestDays[0].day_name.trim() : '—'} />
        <Stat label={t('Returning visitors')} value={returningPct !== null ? `${returningPct}%` : '—'} />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-ink-line">
        {tabs.map((tb) => (
          <button type="button" key={tb.key} onClick={() => setTab(tb.key)} className={`px-2.5 py-1.5 text-sm sm:px-4 sm:py-2 sm:text-base ${activeTab === tb.key ? 'border-b-2 border-brass text-brass' : 'text-ivory-dim hover:text-ivory'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass`}>
            {tb.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-10">
          {liveFeed.length > 0 && (
            <Section title={t('Live activity')}>
              <ul className="space-y-1 text-base text-ivory-dim">
                {liveFeed.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </Section>
          )}

          <Section title={t('Taps over time')}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={summary.tapsByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#332B23" />
                <XAxis dataKey="day" stroke="#A79A87" fontSize={11} />
                <YAxis stroke="#A79A87" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#1F1A15', border: '1px solid #332B23' }} />
                <Line type="monotone" dataKey="count" stroke="#B8925A" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Section>

          <Section title={t('Button clicks')}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={summary.eventsByType.filter((e) => e.type !== 'nfc_tap')}>
                <CartesianGrid strokeDasharray="3 3" stroke="#332B23" />
                <XAxis dataKey="type" stroke="#A79A87" fontSize={10} interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis stroke="#A79A87" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#1F1A15', border: '1px solid #332B23' }} />
                <Bar dataKey="count" fill="#B8925A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Section>

          <Section title={t('Card performance')}>
            <div className="space-y-4">
              {cardBreakdown.map((c) => (
                <div key={c.cardId} className="flex items-center justify-between rounded-lg border border-ink-line px-5 py-4 text-base">
                  <span className="text-ivory">{c.label || t('Untitled')}</span>
                  <span className="text-ivory-dim">{c.taps} {t('taps')}</span>
                </div>
              ))}
              {cardBreakdown.length === 0 && <p className="text-base text-ivory-dim">{t('No card activity yet.')}</p>}
            </div>
          </Section>
        </div>
      )}

      {activeTab === 'sales' && (
        <div className="space-y-10">
          <Section title={t('Sales by Channel')}>
            {salesByChannel && salesByChannel.channels.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={salesByChannel.channels}
                        dataKey="total"
                        nameKey="label"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={2}
                      >
                        {salesByChannel.channels.map((_, i) => (
                          <Cell key={i} fill={CHANNEL_COLORS[i % CHANNEL_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `AED ${value.toFixed(2)}`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 self-center">
                  {salesByChannel.channels.map((c, i) => (
                    <div key={c.source} className="flex items-center justify-between text-base">
                      <span className="flex items-center gap-2 text-ivory-dim">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHANNEL_COLORS[i % CHANNEL_COLORS.length] }} />
                        {c.label}
                      </span>
                      <span className="text-ivory">AED {c.total.toFixed(2)} <span className="text-sm text-ivory-dim">({c.percentage}%)</span></span>
                    </div>
                  ))}
                  <div className="mt-2 border-t border-ink-line pt-2 text-base">
                    <span className="text-ivory">{t('Total')}: AED {salesByChannel.grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-base text-ivory-dim">{t('No sales in the last 30 days yet.')}</p>
            )}
          </Section>

          <Section title={t('Revenue trend (30 days)')}>
            {revenueTrend && revenueTrend.trend.length > 0 ? (
              <>
                <p className="text-sm text-ivory-dim">{t('Real daily revenue - not visitor taps, actual money.')}</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={revenueTrend.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#332B23" />
                    <XAxis dataKey="date" stroke="#A79A87" fontSize={11} tickFormatter={(d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} />
                    <YAxis stroke="#A79A87" fontSize={11} />
                    <Tooltip contentStyle={{ background: '#1F1A15', border: '1px solid #332B23' }} formatter={(v: number) => `AED ${v.toFixed(2)}`} />
                    <Line type="monotone" dataKey="revenueAed" stroke="#B8925A" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </>
            ) : (
              <p className="text-base text-ivory-dim">{t('No revenue in this window yet.')}</p>
            )}
          </Section>

          <Section title={t('Top items')} action={
            <div className="flex rounded-lg border border-ink-line">
              <button type="button" onClick={() => setTopItemsView('revenue')} className={`px-3 py-1.5 text-sm ${topItemsView === 'revenue' ? 'bg-brass text-ink' : 'text-ivory-dim'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass`}>{t('By revenue')}</button>
              <button type="button" onClick={() => setTopItemsView('quantity')} className={`px-3 py-1.5 text-sm ${topItemsView === 'quantity' ? 'bg-brass text-ink' : 'text-ivory-dim'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass`}>{t('By quantity')}</button>
            </div>
          }>
            <div className="space-y-1">
              {(topItemsView === 'revenue' ? topItems?.byRevenue : topItems?.byQuantity)?.map((i) => (
                <div key={i.name} className="flex items-center justify-between rounded-lg border border-ink-line px-3 py-2 text-sm">
                  <span className="text-ivory">{i.name}</span>
                  <span className="text-ivory-dim">{i.quantitySold} {t('sold')} · AED {i.revenueAed.toFixed(2)} <span className="text-xs">({i.revenueSharePct}% {t('of revenue')})</span></span>
                </div>
              ))}
              {(!topItems || (topItemsView === 'revenue' ? topItems.byRevenue : topItems.byQuantity).length === 0) && (
                <p className="text-base text-ivory-dim">{t('No sales in this window yet.')}</p>
              )}
            </div>
          </Section>

          <Section title={t('Peak order hours (30 days)')}>
            {peakHours && peakHours.hours.some((h) => h.orderCount > 0) ? (
              <>
                <p className="text-sm text-ivory-dim">{t('When orders actually land - busiest hour:')} {peakHours.peakHour}:00.</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={peakHours.hours}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#332B23" />
                    <XAxis dataKey="hour" stroke="#A79A87" fontSize={10} tickFormatter={(h) => `${h}:00`} />
                    <YAxis stroke="#A79A87" fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: '#1F1A15', border: '1px solid #332B23' }} labelFormatter={(h) => `${h}:00`} />
                    <Bar dataKey="orderCount" fill="#B8925A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <p className="text-base text-ivory-dim">{t('No orders in this window yet.')}</p>
            )}
          </Section>
        </div>
      )}

      {activeTab === 'kitchen' && showKitchenTab && kitchenPerf && (
        <Section title={t('Kitchen performance (7 days)')}>
          <p className="text-sm text-ivory-dim">
            {t('From')} {kitchenPerf.trackedTicketCount} {t('of')} {kitchenPerf.ticketCount} {t('tickets with full timing data')}
            {kitchenPerf.trackedTicketCount < kitchenPerf.ticketCount ? ` (${t('older tickets, or ones still in progress, are excluded')})` : ''}.
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-ink-line p-3">
              <p className="text-xs text-ivory-dim">{t('Avg time to start')}</p>
              <p className="text-xl text-ivory">{kitchenPerf.avgTimeToStartMins != null ? `${kitchenPerf.avgTimeToStartMins} ${t('min')}` : t('n/a')}</p>
            </div>
            <div className="rounded-lg border border-ink-line p-3">
              <p className="text-xs text-ivory-dim">{t('Avg prep time')}</p>
              <p className="text-xl text-ivory">{kitchenPerf.avgPrepTimeMins != null ? `${kitchenPerf.avgPrepTimeMins} ${t('min')}` : t('n/a')}</p>
            </div>
            <div className="rounded-lg border border-ink-line p-3">
              <p className="text-xs text-ivory-dim">{t('Avg total ticket time')}</p>
              <p className="text-xl text-brass">{kitchenPerf.avgTotalTicketMins != null ? `${kitchenPerf.avgTotalTicketMins} ${t('min')}` : t('n/a')}</p>
            </div>
          </div>
        </Section>
      )}

      {activeTab === 'hotel' && showHotelTab && hotelPerf && (
        <div className="space-y-10">
          <Section title={t('Occupancy, ADR & RevPAR trend (30 days)')}>
            {hotelPerf.occupancyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={hotelPerf.occupancyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#332B23" />
                  <XAxis dataKey="date" stroke="#A79A87" fontSize={11} tickFormatter={(d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} />
                  <YAxis stroke="#A79A87" fontSize={11} />
                  <Tooltip contentStyle={{ background: '#1F1A15', border: '1px solid #332B23' }} />
                  <Legend />
                  <Line type="monotone" dataKey="occupancyPct" name={t('Occupancy %')} stroke="#B8925A" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="revParAed" name={t('RevPAR (AED)')} stroke="#6b8f8c" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-base text-ivory-dim">{t('No night audit history in this window yet.')}</p>
            )}
          </Section>

          <Section title={t('Booking sources (30 days)')}>
            <div className="space-y-1">
              {hotelPerf.bookingSources.map((s) => (
                <div key={s.source} className="flex items-center justify-between rounded-lg border border-ink-line px-3 py-2 text-sm">
                  <span className="text-ivory">{s.label}</span>
                  <span className="text-ivory-dim">{s.count} {s.count === 1 ? t('booking') : t('bookings')} · AED {s.revenueAed.toFixed(2)} <span className="text-xs">({s.percentage}%)</span></span>
                </div>
              ))}
              {hotelPerf.bookingSources.length === 0 && <p className="text-base text-ivory-dim">{t('No reservations in this window yet.')}</p>}
            </div>
          </Section>

          <Section title={t('Reservation outcomes (30 days)')}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-ink-line p-3">
                <p className="text-xs text-ivory-dim">{t('Checked out')}</p>
                <p className="text-xl text-success">{hotelPerf.reservationOutcomes.checkedOut}</p>
              </div>
              <div className="rounded-lg border border-ink-line p-3">
                <p className="text-xs text-ivory-dim">{t('Cancellation rate')}</p>
                <p className="text-xl text-ivory">{hotelPerf.reservationOutcomes.cancellationRatePct != null ? `${hotelPerf.reservationOutcomes.cancellationRatePct}%` : t('n/a')}</p>
              </div>
              <div className="rounded-lg border border-ink-line p-3">
                <p className="text-xs text-ivory-dim">{t('No-show rate')}</p>
                <p className="text-xl text-warning">{hotelPerf.reservationOutcomes.noShowRatePct != null ? `${hotelPerf.reservationOutcomes.noShowRatePct}%` : t('n/a')}</p>
              </div>
              <div className="rounded-lg border border-ink-line p-3">
                <p className="text-xs text-ivory-dim">{t('Avg length of stay')}</p>
                <p className="text-xl text-brass">{hotelPerf.avgLengthOfStayNights != null ? `${hotelPerf.avgLengthOfStayNights} ${t('nights')}` : t('n/a')}</p>
              </div>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, live }: { label: string; value: string | number; live?: boolean }) {
  return (
    <div className="rounded-xl border border-ink-line p-4">
      <p className="text-base text-ivory-dim">{label}</p>
      <p className="mt-1 font-display text-3xl text-ivory">
        {value} {live && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-brass align-middle" />}
      </p>
    </div>
  );
}
