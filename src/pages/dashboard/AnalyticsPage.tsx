import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { getAnalyticsSummary, getCardBreakdown, getSalesByChannel, type SalesByChannel } from '../../lib/authApi';
import { subscribeToBusinessTable } from '../../lib/supabaseClient';
import { useSession } from '../../hooks/useSession';
import type { AnalyticsSummary, CardBreakdownItem } from '../../types';
import { Section } from '../../components/ui';

// Brass-led palette matching the rest of the dashboard, not recharts'
// default rainbow set - a pie chart is still part of the same premium
// theme as everything else, not a generic library default.
const CHANNEL_COLORS = ['#b8925a', '#6b8f8c', '#a3654f', '#7d7a9e', '#8a9a5b'];

export default function AnalyticsPage() {
  const { user } = useSession();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [cardBreakdown, setCardBreakdown] = useState<CardBreakdownItem[]>([]);
  const [salesByChannel, setSalesByChannel] = useState<SalesByChannel | null>(null);
  const [liveTapCount, setLiveTapCount] = useState(0);
  const [liveFeed, setLiveFeed] = useState<string[]>([]);

  const businessId = user?.business_id;

  function reload() {
    if (!businessId) return;
    getAnalyticsSummary(businessId).then(setSummary);
    getCardBreakdown(businessId).then(setCardBreakdown);
    getSalesByChannel(businessId).then(setSalesByChannel);
  }

  useEffect(reload, [businessId]);

  // Live updates: a new nfc_tap event bumps the on-screen counter and feed
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

  if (!summary) return <p className="text-ivory-dim">Loading...</p>;

  const returning = summary.returningVisitors;
  const returningPct = returning && returning.new + returning.returning > 0
    ? Math.round((returning.returning / (returning.new + returning.returning)) * 100)
    : null;

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total taps (30d)" value={summary.totalTaps + liveTapCount} live={liveTapCount > 0} />
        <Stat label="Top hour" value={summary.topHours[0] ? `${summary.topHours[0].hour}:00` : '—'} />
        <Stat label="Busiest day" value={summary.busiestDays[0] ? summary.busiestDays[0].day_name.trim() : '—'} />
        <Stat label="Returning visitors" value={returningPct !== null ? `${returningPct}%` : '—'} />
      </div>

      {liveFeed.length > 0 && (
        <Section title="Live activity">
          <ul className="space-y-1 text-base text-ivory-dim">
            {liveFeed.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </Section>
      )}

      <Section title="Taps over time">
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

      <Section title="Button clicks">
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

      <Section title="Card performance">
        <div className="space-y-4">
          {cardBreakdown.map((c) => (
            <div key={c.cardId} className="flex items-center justify-between rounded-lg border border-ink-line px-5 py-4 text-base">
              <span className="text-ivory">{c.label || 'Untitled'}</span>
              <span className="text-ivory-dim">{c.taps} taps</span>
            </div>
          ))}
          {cardBreakdown.length === 0 && <p className="text-base text-ivory-dim">No card activity yet.</p>}
        </div>
      </Section>

      <Section title="Sales by Channel">
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
                <span className="text-ivory">Total: AED {salesByChannel.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-base text-ivory-dim">No sales in the last 30 days yet.</p>
        )}
      </Section>
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
