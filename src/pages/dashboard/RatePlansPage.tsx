import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import {
  listRatePlans, createRatePlan, updateRatePlan, type HotelRatePlan,
  listRateOverrides, setRateOverride, deleteRateOverride, type HotelRateOverride,
  listPricingRules, createPricingRule, updatePricingRule, deletePricingRule, type HotelPricingRule,
  getOccupancyForecast, type OccupancyForecast,
} from '../../lib/authApi';
import { Section, Field, inputClass } from '../../components/ui';
import { useConfirm } from '../../components/ConfirmDialog';

// Matches the actual database constraint on hotel_rate_plans.rate_type -
// confirmed against the migration, not guessed.
const RATE_TYPES = ['flexible', 'non_refundable', 'corporate', 'promotional', 'seasonal', 'weekend', 'package', 'breakfast_included', 'half_board', 'full_board'];
const MEAL_PLANS = ['none', 'breakfast', 'half_board', 'full_board'];

// Underlying DB values stay snake_case/English - replaces every
// underscore (not just the first) before translating, so a value like
// 'breakfast_included' correctly becomes the dictionary key 'breakfast
// included' rather than silently missing a second underscore.
function spacedWord(t: (text: string) => string, raw: string) {
  return t(raw.replace(/_/g, ' '));
}

export default function RatePlansPage() {
  const { user } = useSession();
  const { t } = useT();
  const businessId = user?.business_id;
  const [plans, setPlans] = useState<HotelRatePlan[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function reload() {
    if (businessId) listRatePlans(businessId).then(setPlans).catch(() => {});
  }
  useEffect(reload, [businessId]);

  async function handleTogglePlan(p: HotelRatePlan) {
    setPlans((prev) => prev.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x)));
    try {
      await updateRatePlan(businessId!, p.id, { active: !p.active });
    } catch {
      reload();
    }
  }

  if (!businessId) return <p className="text-ivory-dim">Loading...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ivory">{t('Rate Plans')}</h1>
        <p className="mt-1 text-base text-ivory-dim">
          {t('Different prices for the same rooms - a flexible rate, a cheaper non-refundable one, a corporate rate, a seasonal promotion. Pick one when creating a reservation.')}
        </p>
      </div>

      <Section title={t('Plans')} action={<button type="button" onClick={() => setShowAdd((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">{t('+ Add plan')}</button>}>
        {showAdd && <RatePlanForm businessId={businessId} onDone={() => { setShowAdd(false); reload(); }} />}
        <div className="space-y-3">
          {plans.map((p) => (
            editingId === p.id ? (
              <RatePlanForm key={p.id} businessId={businessId} existing={p} onDone={() => { setEditingId(null); reload(); }} onCancel={() => setEditingId(null)} />
            ) : (
              <div key={p.id} className={`rounded-lg border p-4 ${p.active ? 'border-ink-line' : 'border-ink-line opacity-50'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-base text-ivory">{p.name} <span className="text-sm text-ivory-dim">· {spacedWord(t, p.rate_type)}</span></p>
                    <p className="text-sm text-ivory-dim">
                      AED {p.base_rate_aed}/night · {p.is_refundable ? t('Refundable') : t('Non-refundable')} · {p.meal_plan === 'none' ? t('Room only') : spacedWord(t, p.meal_plan)}
                      {(p.valid_from || p.valid_to) && ` · ${p.valid_from || t('any date')} ${t('to')} ${p.valid_to || t('any date')}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <button type="button" onClick={() => setEditingId(p.id)} className="text-brass hover:underline">{t('Edit')}</button>
                    <button
                      type="button"
                      onClick={() => handleTogglePlan(p)}
                      className="text-ivory-dim hover:text-ivory"
                    >
                      {p.active ? t('Deactivate') : t('Reactivate')}
                    </button>
                  </div>
                </div>
              </div>
            )
          ))}
          {plans.length === 0 && <p className="text-ivory-dim">{t('No rate plans yet - add one above.')}</p>}
        </div>
      </Section>

      <RateCalendarSection businessId={businessId} plans={plans} />
      <PricingRulesSection businessId={businessId} />
    </div>
  );
}

function RateCalendarSection({ businessId, plans }: { businessId: string; plans: HotelRatePlan[] }) {
  const { t } = useT();
  const [ratePlanId, setRatePlanId] = useState('');
  const [overrides, setOverrides] = useState<HotelRateOverride[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rate, setRate] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (plans.length > 0 && !ratePlanId) setRatePlanId(plans[0].id);
  }, [plans, ratePlanId]);

  function reload() {
    if (ratePlanId) listRateOverrides(businessId, ratePlanId).then(setOverrides).catch(() => {});
  }
  useEffect(reload, [businessId, ratePlanId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!ratePlanId || !rate) return;
    setSaving(true);
    try {
      await setRateOverride(businessId, { ratePlanId, overrideDate: date, rateAed: rate });
      reload();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteRateOverride(businessId, id);
    reload();
  }

  if (plans.length === 0) return null;

  return (
    <Section title={t('Rate calendar')}>
      <p className="text-sm text-ivory-dim">
        {t('Set a specific price for a specific date on a plan - a holiday, an event weekend - without creating a whole new plan just for one night.')}
      </p>
      <Field label={t('Plan')}>
        <select value={ratePlanId} onChange={(e) => setRatePlanId(e.target.value)} className={inputClass}>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
        <Field label={t('Date')}><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} /></Field>
        <Field label="Rate (AED)"><input type="number" min={0} value={rate} onFocus={(e) => e.target.select()} onChange={(e) => setRate(Number(e.target.value))} className={`${inputClass} w-32`} /></Field>
        <button type="submit" disabled={saving} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
          {saving ? t('Saving...') : t('Set override')}
        </button>
      </form>
      <div className="space-y-1">
        {overrides.map((o) => (
          <div key={o.id} className="flex items-center justify-between rounded-lg border border-ink-line px-3 py-2 text-sm">
            <span className="text-ivory">{new Date(o.override_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <span className="flex items-center gap-3">
              <span className="text-brass">AED {o.rate_aed}</span>
              <button type="button" onClick={() => handleDelete(o.id)} className="text-danger hover:underline">{t('Remove')}</button>
            </span>
          </div>
        ))}
        {overrides.length === 0 && <p className="text-ivory-dim">{t('No date-specific overrides for this plan yet.')}</p>}
      </div>
    </Section>
  );
}

function PricingRulesSection({ businessId }: { businessId: string }) {
  const { t } = useT();
  const confirm = useConfirm();
  const [rules, setRules] = useState<HotelPricingRule[]>([]);
  const [forecast, setForecast] = useState<OccupancyForecast | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [threshold, setThreshold] = useState(80);
  const [surcharge, setSurcharge] = useState(20);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function reload() {
    listPricingRules(businessId).then(setRules).catch(() => {});
    getOccupancyForecast(businessId, 14).then(setForecast).catch(() => {});
  }
  useEffect(reload, [businessId]);

  async function handleToggleRule(r: HotelPricingRule) {
    setRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, active: !x.active } : x)));
    try {
      await updatePricingRule(businessId, r.id, { active: !r.active });
    } catch {
      reload();
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await createPricingRule(businessId, { name: name.trim(), occupancyThresholdPct: threshold, surchargePct: surcharge });
      setShowAdd(false);
      setName('');
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add pricing rule');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!(await confirm({ title: t('Remove pricing rule?'), message: t('Remove this pricing rule?'), confirmLabel: t('Remove'), danger: true }))) return;
    await deletePricingRule(businessId, id);
    reload();
  }

  return (
    <div className="space-y-6">
      <Section title={t('Occupancy-based pricing')} action={
        <button type="button" onClick={() => setShowAdd((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">{t('+ Add rule')}</button>
      }>
        <p className="text-sm text-ivory-dim">
          {t('As the hotel fills up for a given date, apply a surcharge automatically - a transparent rule, not a hidden algorithm. When several rules match, only the highest threshold applies (never stacked).')}
        </p>
        {showAdd && (
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-line p-4">
            <Field label={t('Name')}><input value={name} onChange={(e) => setName(e.target.value)} placeholder="High demand" className={inputClass} /></Field>
            <Field label={t('At or above occupancy %')}><input type="number" min={1} max={100} value={threshold} onFocus={(e) => e.target.select()} onChange={(e) => setThreshold(Number(e.target.value))} className={`${inputClass} w-28`} /></Field>
            <Field label={t('Surcharge %')}><input type="number" min={1} value={surcharge} onFocus={(e) => e.target.select()} onChange={(e) => setSurcharge(Number(e.target.value))} className={`${inputClass} w-28`} /></Field>
            <button type="submit" disabled={saving} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
              {saving ? t('Saving...') : t('Add rule')}
            </button>
          </form>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="space-y-2">
          {rules.map((r) => (
            <div key={r.id} className={`flex items-center justify-between rounded-lg border p-3 ${r.active ? 'border-ink-line' : 'border-ink-line opacity-50'}`}>
              <span className="text-ivory">{r.name} - {t('at')} {r.occupancy_threshold_pct}%+ {t('occupancy,')} +{r.surcharge_pct}%</span>
              <div className="flex items-center gap-3 text-sm">
                <button type="button" onClick={() => handleToggleRule(r)} className="text-ivory-dim hover:text-ivory">
                  {r.active ? t('Deactivate') : t('Reactivate')}
                </button>
                <button type="button" onClick={() => handleDelete(r.id)} className="text-danger hover:underline">{t('Remove')}</button>
              </div>
            </div>
          ))}
          {rules.length === 0 && <p className="text-ivory-dim">{t("No pricing rules yet - rates use each plan's flat rate (plus any date overrides above).")}</p>}
        </div>
      </Section>

      <Section title={t('Occupancy forecast (14 days)')}>
        {forecast && forecast.forecast.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
            {forecast.forecast.map((f) => (
              <div key={f.date} className={`rounded-lg border p-2 text-center ${f.occupancyPct >= 80 ? 'border-danger/40 bg-danger/5' : f.occupancyPct >= 50 ? 'border-warning/40 bg-warning/5' : 'border-ink-line'}`}>
                <p className="text-xs text-ivory-dim">{new Date(f.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}</p>
                <p className="text-lg text-ivory">{f.occupancyPct}%</p>
                <p className="text-xs text-ivory-dim">{f.occupiedRooms}/{f.totalRooms}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-ivory-dim">{t('No rooms set up yet.')}</p>
        )}
      </Section>
    </div>
  );
}

function RatePlanForm({ businessId, existing, onDone, onCancel }: {
  businessId: string; existing?: HotelRatePlan; onDone: () => void; onCancel?: () => void;
}) {
  const { t } = useT();
  const [name, setName] = useState(existing?.name || '');
  const [rateType, setRateType] = useState(existing?.rate_type || 'flexible');
  const [baseRate, setBaseRate] = useState(existing?.base_rate_aed || 0);
  const [isRefundable, setIsRefundable] = useState(existing?.is_refundable ?? true);
  const [mealPlan, setMealPlan] = useState(existing?.meal_plan || 'none');
  const [validFrom, setValidFrom] = useState(existing?.valid_from || '');
  const [validTo, setValidTo] = useState(existing?.valid_to || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: name.trim(), rateType, baseRateAed: baseRate, isRefundable, mealPlan,
        validFrom: validFrom || null, validTo: validTo || null,
      };
      if (existing) {
        await updateRatePlan(businessId, existing.id, payload);
      } else {
        await createRatePlan(businessId, payload);
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this rate plan');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-xl border border-brass/40 bg-ink-soft p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('Name')}><input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Flexible Rate" className={inputClass} /></Field>
        <Field label={t('Type')}>
          <select value={rateType} onChange={(e) => setRateType(e.target.value)} className={inputClass}>
            {RATE_TYPES.map((rt) => <option key={rt} value={rt}>{spacedWord(t, rt)}</option>)}
          </select>
        </Field>
        <Field label={t('Rate per night (AED)')}>
          <input type="number" min={0} value={baseRate} onFocus={(e) => e.target.select()} onChange={(e) => setBaseRate(Number(e.target.value))} className={inputClass} />
        </Field>
        <Field label={t('Meal plan')}>
          <select value={mealPlan} onChange={(e) => setMealPlan(e.target.value)} className={inputClass}>
            {MEAL_PLANS.map((m) => <option key={m} value={m}>{m === 'none' ? t('Room only') : spacedWord(t, m)}</option>)}
          </select>
        </Field>
        <Field label={t('Valid from (optional)')}><input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className={inputClass} /></Field>
        <Field label={t('Valid to (optional)')}><input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} className={inputClass} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-ivory">
        <input type="checkbox" checked={isRefundable} onChange={(e) => setIsRefundable(e.target.checked)} className="accent-brass" />
        {t('Refundable')}
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
          {saving ? t('Saving...') : existing ? t('Save changes') : t('Add plan')}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="text-sm text-ivory-dim">{t('Cancel')}</button>}
      </div>
    </form>
  );
}
