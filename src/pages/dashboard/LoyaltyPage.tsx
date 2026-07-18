import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import {
  getLoyaltyProgram, upsertLoyaltyProgram, listLoyaltyMembers, adjustLoyaltyMember, redeemLoyaltyReward,
} from '../../lib/authApi';
import type {
  LoyaltyProgramAdmin, LoyaltyMemberRow, LoyaltyTier, CooldownType, LoyaltyEarnMethod, LoyaltyStructure, RewardType,
} from '../../types';
import { Section, Field, inputClass, PrimaryButton, ActionButton, type FormEvent } from '../../components/ui';

const REWARD_TYPE_LABELS: Record<RewardType, string> = {
  percentage: 'Percentage off',
  fixed_amount: 'Fixed amount off',
  manual: 'Free item / other (staff apply manually)',
};

export default function LoyaltyPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [program, setProgram] = useState<LoyaltyProgramAdmin | null>(null);
  const [members, setMembers] = useState<LoyaltyMemberRow[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!businessId) return;
    getLoyaltyProgram(businessId).then(setProgram);
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    listLoyaltyMembers(businessId, search).then(setMembers);
  }, [businessId, search]);

  if (!businessId) return null;

  return (
    <div className="space-y-6">
      <ProgramConfigForm businessId={businessId} program={program} onSaved={setProgram} />

      {program?.enabled && (
        <Section title="Members">
          <input
            placeholder="Search by phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inputClass}
          />
          <div className="space-y-1.5">
            {members.map((m) => (
              <MemberRow key={m.id} member={m} businessId={businessId} program={program} onChange={() => listLoyaltyMembers(businessId, search).then(setMembers)} />
            ))}
            {members.length === 0 && <p className="text-base text-ivory-dim">No members yet.</p>}
          </div>
        </Section>
      )}
    </div>
  );
}

function ProgramConfigForm({ businessId, program, onSaved }: {
  businessId: string; program: LoyaltyProgramAdmin | null; onSaved: (p: LoyaltyProgramAdmin) => void;
}) {
  const [earnMethod, setEarnMethod] = useState<LoyaltyEarnMethod>(program?.earn_method || 'visit');
  const [structure, setStructure] = useState<LoyaltyStructure>(program?.structure || 'threshold');
  const [usePoints, setUsePoints] = useState(program?.use_points ?? false);
  const [enabled, setEnabled] = useState(program?.enabled ?? false);

  const [visitsRequired, setVisitsRequired] = useState(program?.config.visitsRequired ?? 10);
  const [pointsPerVisit, setPointsPerVisit] = useState(program?.config.pointsPerVisit ?? 10);
  const [redeemThreshold, setRedeemThreshold] = useState(program?.config.redeemThreshold ?? 100);
  const [thresholdAmount, setThresholdAmount] = useState(program?.config.thresholdAmount ?? 500);
  const [currency, setCurrency] = useState(program?.config.currency ?? 'AED');

  const [rewardType, setRewardType] = useState<RewardType>(program?.reward_type || 'manual');
  const [rewardValue, setRewardValue] = useState(program?.reward_value ?? 0);
  const [rewardDescription, setRewardDescription] = useState(program?.reward_description ?? '');

  const [tiers, setTiers] = useState<LoyaltyTier[]>(program?.config.tiers ?? []);
  const [cooldownType, setCooldownType] = useState<CooldownType>(program?.config.cooldown?.type ?? 'none');
  const [cooldownHours, setCooldownHours] = useState(program?.config.cooldown?.hours ?? 6);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // What the measure is called, given the current earn method + points
  // choice - used throughout the form so labels always match reality
  // instead of always saying "visits" regardless of settings.
  const measureLabel = earnMethod === 'spend' ? 'amount spent' : usePoints ? 'points' : 'visits';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (structure === 'tiered') {
      if (tiers.length === 0) {
        setError('Add at least one tier before saving.');
        return;
      }
      if (tiers.some((t) => !t.name.trim())) {
        setError('Every tier needs a name.');
        return;
      }
    }

    setSaving(true);
    const cooldown = earnMethod !== 'spend'
      ? { type: cooldownType, ...(cooldownType === 'custom' ? { hours: cooldownHours } : {}) }
      : undefined;

    const config = {
      ...(earnMethod === 'spend' ? { thresholdAmount, currency } : usePoints ? { pointsPerVisit, redeemThreshold } : { visitsRequired }),
      ...(structure === 'tiered' ? { tiers: [...tiers].sort((a, b) => a.threshold - b.threshold) } : {}),
      ...(cooldown ? { cooldown } : {}),
    };

    const updated = await upsertLoyaltyProgram(businessId, {
      earnMethod, structure, usePoints,
      rewardType, rewardValue, rewardDescription,
      enabled, config,
    });
    onSaved(updated);
    setSaving(false);
  }

  function updateTier(index: number, patch: Partial<LoyaltyTier>) {
    setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function addTier() {
    setTiers((prev) => [...prev, { name: '', threshold: (prev[prev.length - 1]?.threshold ?? 0) + 5, rewardType: 'manual', rewardValue: 0, rewardDescription: '' }]);
  }

  function removeTier(index: number) {
    setTiers((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <Section title="Loyalty program">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="How it's earned">
            <select value={earnMethod} onChange={(e) => setEarnMethod(e.target.value as LoyaltyEarnMethod)} className={inputClass}>
              <option value="visit">Visit (customer taps the card)</option>
              <option value="spend">Spend (staff enter the amount)</option>
            </select>
          </Field>
          <Field label="How rewards work">
            <select value={structure} onChange={(e) => setStructure(e.target.value as LoyaltyStructure)} className={inputClass}>
              <option value="threshold">Threshold — one reward, then resets</option>
              <option value="tiered">Tiered — ongoing status, applies automatically</option>
            </select>
          </Field>
        </div>

        {earnMethod === 'visit' && (
          <label className="flex items-center gap-2 text-base text-ivory-dim">
            <input type="checkbox" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} className="accent-brass" />
            Measure in points (visits × a points-per-visit multiplier) instead of raw visit count
          </label>
        )}

        {/* Measure-specific config */}
        <div className="grid grid-cols-2 gap-3">
          {earnMethod === 'spend' && (
            <>
              <Field label="Currency"><input value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass} /></Field>
              {structure === 'threshold' && (
                <Field label="Threshold amount"><input type="number" min={1} value={thresholdAmount} onChange={(e) => setThresholdAmount(Number(e.target.value))} className={inputClass} /></Field>
              )}
            </>
          )}
          {earnMethod === 'visit' && usePoints && (
            <>
              <Field label="Points per visit"><input type="number" min={1} value={pointsPerVisit} onChange={(e) => setPointsPerVisit(Number(e.target.value))} className={inputClass} /></Field>
              {structure === 'threshold' && (
                <Field label="Redeem threshold"><input type="number" min={1} value={redeemThreshold} onChange={(e) => setRedeemThreshold(Number(e.target.value))} className={inputClass} /></Field>
              )}
            </>
          )}
          {earnMethod === 'visit' && !usePoints && structure === 'threshold' && (
            <Field label="Visits required"><input type="number" min={1} value={visitsRequired} onChange={(e) => setVisitsRequired(Number(e.target.value))} className={inputClass} /></Field>
          )}
        </div>

        {/* Threshold reward - one, structured */}
        {structure === 'threshold' && (
          <div className="grid grid-cols-3 gap-3">
            <Field label="Reward type">
              <select value={rewardType} onChange={(e) => setRewardType(e.target.value as RewardType)} className={inputClass}>
                {Object.entries(REWARD_TYPE_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
              </select>
            </Field>
            {rewardType !== 'manual' && (
              <Field label={rewardType === 'percentage' ? 'Percentage (%)' : `Amount (${currency || 'AED'})`}>
                <input type="number" min={0} value={rewardValue} onChange={(e) => setRewardValue(Number(e.target.value))} className={inputClass} />
              </Field>
            )}
            <Field label="Description (shown to customer & staff)">
              <input value={rewardDescription} onChange={(e) => setRewardDescription(e.target.value)} placeholder="Free coffee" className={inputClass} />
            </Field>
          </div>
        )}

        {/* Tiered rewards - one per tier, each auto-applies at payment */}
        {structure === 'tiered' && (
          <div className="space-y-3">
            <p className="text-base text-ivory-dim">
              Each tier is an ongoing status unlocked at a {measureLabel} threshold — its reward applies automatically on every bill from then on, never claimed, never resets.
            </p>
            <div className="space-y-2">
              {tiers.map((tier, i) => (
                <div key={i} className="space-y-2 rounded-lg border border-ink-line p-3">
                  <div className="flex items-end gap-2">
                    <Field label="Tier name">
                      <input value={tier.name} onChange={(e) => updateTier(i, { name: e.target.value })} placeholder="Silver" className={`${inputClass} w-32`} />
                    </Field>
                    <Field label={`Threshold (${measureLabel})`}>
                      <input type="number" min={1} value={tier.threshold} onChange={(e) => updateTier(i, { threshold: Number(e.target.value) })} className={`${inputClass} w-28`} />
                    </Field>
                    <button type="button" onClick={() => removeTier(i)} className="mb-0.5 shrink-0 rounded-lg border border-red-400/40 px-3 py-2.5 text-base text-red-400 hover:bg-red-400/10">
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Reward type">
                      <select value={tier.rewardType} onChange={(e) => updateTier(i, { rewardType: e.target.value as RewardType })} className={inputClass}>
                        {Object.entries(REWARD_TYPE_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                      </select>
                    </Field>
                    {tier.rewardType !== 'manual' && (
                      <Field label={tier.rewardType === 'percentage' ? 'Percentage (%)' : 'Amount'}>
                        <input type="number" min={0} value={tier.rewardValue} onChange={(e) => updateTier(i, { rewardValue: Number(e.target.value) })} className={inputClass} />
                      </Field>
                    )}
                    <Field label="Description">
                      <input value={tier.rewardDescription} onChange={(e) => updateTier(i, { rewardDescription: e.target.value })} placeholder="10% off every visit" className={inputClass} />
                    </Field>
                  </div>
                </div>
              ))}
              {tiers.length === 0 && <p className="text-base text-ivory-dim">No tiers yet — add at least one below.</p>}
            </div>
            <button type="button" onClick={addTier} className="rounded-lg border border-brass/40 px-3.5 py-2 text-base text-brass hover:bg-brass/10">
              + Add tier
            </button>
          </div>
        )}

        {earnMethod === 'visit' && (
          <Field label="How often a tap counts">
            <div className="flex gap-2">
              <select value={cooldownType} onChange={(e) => setCooldownType(e.target.value as CooldownType)} className={inputClass}>
                <option value="none">Every tap counts</option>
                <option value="daily">Once per day</option>
                <option value="weekly">Once per week</option>
                <option value="custom">Custom</option>
              </select>
              {cooldownType === 'custom' && (
                <input type="number" min={1} value={cooldownHours} onChange={(e) => setCooldownHours(Number(e.target.value))} placeholder="Hours" className={`${inputClass} w-28`} />
              )}
            </div>
            <p className="mt-1 text-base text-ivory-dim">
              A customer tapping again before this passes sees their current
              progress with "Already counted for today," instead of getting
              credited twice.
            </p>
          </Field>
        )}

        <label className="flex items-center gap-2 text-base text-ivory-dim">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-brass" />
          Enabled — shows on the public landing page
        </label>

        {error && <p className="text-base text-red-400">{error}</p>}
        <PrimaryButton disabled={saving}>{saving ? 'Saving...' : 'Save program'}</PrimaryButton>
      </form>
    </Section>
  );
}

function MemberRow({ member, businessId, program, onChange }: {
  member: LoyaltyMemberRow; businessId: string; program: LoyaltyProgramAdmin; onChange: () => void;
}) {
  const [showAdjust, setShowAdjust] = useState(false);
  const [redeemError, setRedeemError] = useState('');

  async function handleRedeem() {
    setRedeemError('');
    try {
      await redeemLoyaltyReward(businessId, member.id);
      onChange();
    } catch (err) {
      setRedeemError(err instanceof Error ? err.message : 'Could not redeem');
    }
  }

  const progressText =
    program.earn_method === 'spend' ? `${member.total_spend} spent` :
    program.use_points ? `${member.points} points` :
    program.structure === 'tiered' ? (member.current_tier || 'No tier') :
    `${member.visits} visits`;

  return (
    <div className="rounded-lg border border-ink-line px-3.5 py-2.5 text-base">
      <div className="flex items-center justify-between">
        <span className="text-ivory">{member.customers?.phone || 'Unknown'}</span>
        <div className="flex items-center gap-2">
          <span className="text-ivory-dim">{progressText}</span>
          <ActionButton onClick={() => setShowAdjust((s) => !s)}>Adjust</ActionButton>
          {program.structure === 'threshold' && (
            <ActionButton onClick={handleRedeem}>Redeem</ActionButton>
          )}
        </div>
      </div>
      {redeemError && <p className="mt-1.5 text-base text-red-400">{redeemError}</p>}
      {showAdjust && <AdjustForm businessId={businessId} membershipId={member.id} program={program} onDone={() => { setShowAdjust(false); onChange(); }} />}
    </div>
  );
}

function AdjustForm({ businessId, membershipId, program, onDone }: {
  businessId: string; membershipId: string; program: LoyaltyProgramAdmin; onDone: () => void;
}) {
  const [visits, setVisits] = useState(0);
  const [points, setPoints] = useState(0);
  const [spendAmount, setSpendAmount] = useState(0);
  const [note, setNote] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    await adjustLoyaltyMember(businessId, membershipId, { visits, points, spendAmount, note });
    onDone();
  }

  // Only the ONE field that actually matters for this program's reward
  // calculation - showing all three regardless of configuration meant a
  // staff member could type into "+ Spend" on a pure visit-based program
  // and see nothing happen, since that program never reads total_spend
  // at all. This exactly matches getMeasure()'s own logic.
  const isSpend = program.earn_method === 'spend';
  const isPoints = program.earn_method === 'visit' && program.use_points;

  return (
    <form onSubmit={submit} className="mt-2.5 flex flex-wrap items-end gap-2 border-t border-ink-line pt-2.5">
      {isSpend && <Field label="+ Spend"><input type="number" value={spendAmount} onChange={(e) => setSpendAmount(Number(e.target.value))} className={`${inputClass} w-24`} /></Field>}
      {isPoints && <Field label="± Points"><input type="number" value={points} onChange={(e) => setPoints(Number(e.target.value))} className={`${inputClass} w-24`} /></Field>}
      {!isSpend && !isPoints && <Field label="± Visits"><input type="number" value={visits} onChange={(e) => setVisits(Number(e.target.value))} className={`${inputClass} w-24`} /></Field>}
      <Field label="Note"><input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} /></Field>
      <PrimaryButton>Apply</PrimaryButton>
    </form>
  );
}
