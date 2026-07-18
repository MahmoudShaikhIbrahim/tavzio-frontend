import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { getAnalyticsSummary, getCardBreakdown } from '../../lib/authApi';
import { subscribeToBusinessTable } from '../../lib/supabaseClient';
import { useSession } from '../../hooks/useSession';
import type { AnalyticsSummary, CardBreakdownItem } from '../../types';
import { Section } from '../../components/ui';

export default function AnalyticsPage() {
  const { user } = useSession();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [cardBreakdown, setCardBreakdown] = useState<CardBreakdownItem[]>([]);
  const [liveTapCount, setLiveTapCount] = useState(0);
  const [liveFeed, setLiveFeed] = useState<string[]>([]);

  const businessId = user?.business_id;

  function reload() {
    if (!businessId) return;
    getAnalyticsSummary(businessId).then(setSummary);
    getCardBreakdown(businessId).then(setCardBreakdown);
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
    <div className="space-y-6">
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
        <div className="space-y-1.5">
          {cardBreakdown.map((c) => (
            <div key={c.cardId} className="flex items-center justify-between rounded-lg border border-ink-line px-3.5 py-2 text-base">
              <span className="text-ivory">{c.label || 'Untitled'}</span>
              <span className="text-ivory-dim">{c.taps} taps</span>
            </div>
          ))}
          {cardBreakdown.length === 0 && <p className="text-base text-ivory-dim">No card activity yet.</p>}
        </div>
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
