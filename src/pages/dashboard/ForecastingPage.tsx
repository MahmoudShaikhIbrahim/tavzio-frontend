import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { getBusiness, getSalesForecast, setBudget, getBudgetVsActual } from '../../lib/authApi';
import type { AdminBusiness, SalesForecast, BudgetVsActual } from '../../types';
import { Section, Field, inputClass } from '../../components/ui';

export default function ForecastingPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [business, setBusiness] = useState<AdminBusiness | null>(null);

  useEffect(() => {
    if (businessId) getBusiness(businessId).then(setBusiness);
  }, [businessId]);

  if (!businessId || !business) return <p className="text-ivory-dim">Loading...</p>;

  if (!business.features.forecasting?.enabled) {
    return (
      <div className="max-w-lg space-y-3">
        <h1 className="font-display text-3xl text-ivory">Forecasting & Budgeting</h1>
        <p className="text-base text-ivory-dim">Turned off for your business. Turn it on under Features to see a sales forecast and set monthly budgets.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ivory">Forecasting & Budgeting</h1>
        <p className="mt-1 text-base text-ivory-dim">Owner-only.</p>
      </div>
      <SalesForecastSection businessId={businessId} />
      <BudgetSection businessId={businessId} />
    </div>
  );
}

function SalesForecastSection({ businessId }: { businessId: string }) {
  const [days, setDays] = useState(7);
  const [forecast, setForecast] = useState<SalesForecast | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getSalesForecast(businessId, days).then(setForecast).finally(() => setLoading(false));
  }, [businessId, days]);

  return (
    <Section title="Sales forecast" action={
      <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-lg border border-ink-line bg-ink px-3 py-1.5 text-sm text-ivory">
        <option value={7}>Next 7 days</option>
        <option value={14}>Next 14 days</option>
        <option value={30}>Next 30 days</option>
      </select>
    }>
      {loading && <p className="text-ivory-dim">Loading...</p>}
      {!loading && forecast && (
        <>
          <p className="text-sm text-ivory-dim">
            Built from what each day of the week actually made over your last {forecast.historyWeeks} weeks of orders - not a black-box model,
            just your own history projected forward.
          </p>
          <p className="text-3xl text-brass">AED {forecast.totalForecastAed.toFixed(2)}</p>
          {forecast.lowConfidenceDays > 0 && (
            <p className="text-sm text-warning">
              {forecast.lowConfidenceDays} day(s) below have fewer than 3 weeks of history for that weekday yet - treat those as rough estimates.
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {forecast.forecast.map((f) => (
              <div key={f.date} className={`rounded-lg border p-3 ${f.basedOnSampleSize < 3 ? 'border-warning/30 bg-warning/5' : 'border-ink-line'}`}>
                <p className="text-sm text-ivory">{f.dayOfWeek}, {new Date(f.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                <p className="text-lg text-ivory">{f.forecastRevenueAed != null ? `AED ${f.forecastRevenueAed.toFixed(2)}` : 'No history yet'}</p>
                <p className="text-xs text-ivory-dim">based on {f.basedOnSampleSize} past {f.dayOfWeek}{f.basedOnSampleSize === 1 ? '' : 's'}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </Section>
  );
}

function BudgetSection({ businessId }: { businessId: string }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [report, setReport] = useState<BudgetVsActual | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [revenueBudget, setRevenueBudget] = useState('');
  const [foodCostBudget, setFoodCostBudget] = useState('');
  const [laborCostBudget, setLaborCostBudget] = useState('');
  const [saving, setSaving] = useState(false);

  function reload() {
    setLoading(true);
    getBudgetVsActual(businessId, month).then((r) => {
      setReport(r);
      setRevenueBudget(r.budget?.revenue_budget_aed != null ? String(r.budget.revenue_budget_aed) : '');
      setFoodCostBudget(r.budget?.food_cost_pct_budget != null ? String(r.budget.food_cost_pct_budget) : '');
      setLaborCostBudget(r.budget?.labor_cost_pct_budget != null ? String(r.budget.labor_cost_pct_budget) : '');
    }).finally(() => setLoading(false));
  }
  useEffect(reload, [businessId, month]);

  async function handleSaveBudget() {
    setSaving(true);
    try {
      await setBudget(businessId, {
        month,
        revenueBudgetAed: revenueBudget ? Number(revenueBudget) : null,
        foodCostPctBudget: foodCostBudget ? Number(foodCostBudget) : null,
        laborCostPctBudget: laborCostBudget ? Number(laborCostBudget) : null,
      });
      setEditing(false);
      reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="Budget vs actual" action={
      <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-ink-line bg-ink px-3 py-1.5 text-sm text-ivory" />
    }>
      {loading && <p className="text-ivory-dim">Loading...</p>}
      {!loading && report && (
        <>
          {editing ? (
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-line p-4">
              <Field label="Revenue budget (AED)">
                <input type="number" value={revenueBudget} onFocus={(e) => e.target.select()} onChange={(e) => setRevenueBudget(e.target.value)} className={`${inputClass} w-32`} />
              </Field>
              <Field label="Food cost % target">
                <input type="number" value={foodCostBudget} onFocus={(e) => e.target.select()} onChange={(e) => setFoodCostBudget(e.target.value)} className={`${inputClass} w-28`} />
              </Field>
              <Field label="Labor cost % target">
                <input type="number" value={laborCostBudget} onFocus={(e) => e.target.select()} onChange={(e) => setLaborCostBudget(e.target.value)} className={`${inputClass} w-28`} />
              </Field>
              <button type="button" onClick={handleSaveBudget} disabled={saving} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save budget'}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="text-sm text-ivory-dim">Cancel</button>
            </div>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="text-sm text-brass hover:underline">
              {report.budget ? 'Edit this month\'s budget' : 'Set a budget for this month'}
            </button>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <BudgetCard
              label="Revenue" actual={`AED ${report.actual.revenueAed.toFixed(2)}`}
              target={report.budget?.revenue_budget_aed != null ? `AED ${Number(report.budget.revenue_budget_aed).toFixed(2)}` : null}
              varianceAed={report.variance?.revenueAed ?? null}
              note={null}
            />
            <BudgetCard
              label="Food cost %" actual={report.actual.foodCostPct != null ? `${report.actual.foodCostPct}%` : null}
              target={report.budget?.food_cost_pct_budget != null ? `${report.budget.food_cost_pct_budget}%` : null}
              varianceAed={null} variancePct={report.variance?.foodCostPct ?? null}
              note={report.actual.foodCostNote}
            />
            <BudgetCard
              label="Labor cost %" actual={report.actual.laborCostPct != null ? `${report.actual.laborCostPct}%` : null}
              target={report.budget?.labor_cost_pct_budget != null ? `${report.budget.labor_cost_pct_budget}%` : null}
              varianceAed={null} variancePct={report.variance?.laborCostPct ?? null}
              note={report.actual.laborCostNote}
            />
          </div>
        </>
      )}
    </Section>
  );
}

function BudgetCard({ label, actual, target, varianceAed, variancePct, note }: {
  label: string; actual: string | null; target: string | null; varianceAed?: number | null; variancePct?: number | null; note: string | null;
}) {
  const variance = varianceAed ?? variancePct ?? null;
  // For revenue, being OVER budget is good (positive = green). For a cost
  // percentage, being over budget is bad (positive = red) - the sign
  // means opposite things depending on which card this is, so it can't
  // share one universal color rule.
  const isCostCard = variancePct !== undefined;
  const goodVariance = variance != null && (isCostCard ? variance <= 0 : variance >= 0);
  return (
    <div className="rounded-lg border border-ink-line p-3">
      <p className="text-xs text-ivory-dim">{label}</p>
      <p className="text-xl text-ivory">{actual ?? 'n/a'}</p>
      {target ? (
        <p className="text-sm text-ivory-dim">
          target {target}
          {variance != null && (
            <span className={goodVariance ? ' text-success' : ' text-danger'}>
              {' '}({variance >= 0 ? '+' : ''}{typeof variance === 'number' ? variance.toFixed(2) : variance}{variancePct !== undefined ? '%' : ''})
            </span>
          )}
        </p>
      ) : (
        <p className="text-sm text-ivory-dim">No budget set</p>
      )}
      {note && <p className="mt-1 text-xs text-warning">{note}</p>}
    </div>
  );
}
