import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { listRatePlans, createRatePlan, updateRatePlan, type HotelRatePlan } from '../../lib/authApi';
import { Section, Field, inputClass } from '../../components/ui';

// Matches the actual database constraint on hotel_rate_plans.rate_type -
// confirmed against the migration, not guessed.
const RATE_TYPES = ['flexible', 'non_refundable', 'corporate', 'promotional', 'seasonal', 'weekend', 'package', 'breakfast_included', 'half_board', 'full_board'];
const MEAL_PLANS = ['none', 'breakfast', 'half_board', 'full_board'];

export default function RatePlansPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [plans, setPlans] = useState<HotelRatePlan[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function reload() {
    if (businessId) listRatePlans(businessId).then(setPlans);
  }
  useEffect(reload, [businessId]);

  if (!businessId) return <p className="text-ivory-dim">Loading...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ivory">Rate Plans</h1>
        <p className="mt-1 text-base text-ivory-dim">
          Different prices for the same rooms - a flexible rate, a cheaper non-refundable one, a corporate rate,
          a seasonal promotion. Pick one when creating a reservation.
        </p>
      </div>

      <Section title="Plans" action={<button type="button" onClick={() => setShowAdd((s) => !s)} className="rounded-lg bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90">+ Add plan</button>}>
        {showAdd && <RatePlanForm businessId={businessId} onDone={() => { setShowAdd(false); reload(); }} />}
        <div className="space-y-3">
          {plans.map((p) => (
            editingId === p.id ? (
              <RatePlanForm key={p.id} businessId={businessId} existing={p} onDone={() => { setEditingId(null); reload(); }} onCancel={() => setEditingId(null)} />
            ) : (
              <div key={p.id} className={`rounded-lg border p-4 ${p.active ? 'border-ink-line' : 'border-ink-line opacity-50'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-base text-ivory">{p.name} <span className="text-sm text-ivory-dim capitalize">· {p.rate_type.replace('_', ' ')}</span></p>
                    <p className="text-sm text-ivory-dim">
                      AED {p.base_rate_aed}/night · {p.is_refundable ? 'Refundable' : 'Non-refundable'} · {p.meal_plan === 'none' ? 'Room only' : p.meal_plan.replace('_', ' ')}
                      {(p.valid_from || p.valid_to) && ` · ${p.valid_from || 'any date'} to ${p.valid_to || 'any date'}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <button type="button" onClick={() => setEditingId(p.id)} className="text-brass hover:underline">Edit</button>
                    <button
                      type="button"
                      onClick={() => updateRatePlan(businessId, p.id, { active: !p.active }).then(reload)}
                      className="text-ivory-dim hover:text-ivory"
                    >
                      {p.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </div>
                </div>
              </div>
            )
          ))}
          {plans.length === 0 && <p className="text-ivory-dim">No rate plans yet - add one above.</p>}
        </div>
      </Section>
    </div>
  );
}

function RatePlanForm({ businessId, existing, onDone, onCancel }: {
  businessId: string; existing?: HotelRatePlan; onDone: () => void; onCancel?: () => void;
}) {
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
        <Field label="Name"><input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Flexible Rate" className={inputClass} /></Field>
        <Field label="Type">
          <select value={rateType} onChange={(e) => setRateType(e.target.value)} className={inputClass}>
            {RATE_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </Field>
        <Field label="Rate per night (AED)">
          <input type="number" min={0} value={baseRate} onFocus={(e) => e.target.select()} onChange={(e) => setBaseRate(Number(e.target.value))} className={inputClass} />
        </Field>
        <Field label="Meal plan">
          <select value={mealPlan} onChange={(e) => setMealPlan(e.target.value)} className={inputClass}>
            {MEAL_PLANS.map((m) => <option key={m} value={m}>{m === 'none' ? 'Room only' : m.replace('_', ' ')}</option>)}
          </select>
        </Field>
        <Field label="Valid from (optional)"><input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className={inputClass} /></Field>
        <Field label="Valid to (optional)"><input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} className={inputClass} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-ivory">
        <input type="checkbox" checked={isRefundable} onChange={(e) => setIsRefundable(e.target.checked)} className="accent-brass" />
        Refundable
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="rounded-lg bg-brass px-4 py-2 text-base font-medium text-ink hover:opacity-90 disabled:opacity-50">
          {saving ? 'Saving...' : existing ? 'Save changes' : 'Add plan'}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="text-sm text-ivory-dim">Cancel</button>}
      </div>
    </form>
  );
}
