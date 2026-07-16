import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import {
  getLoyaltyProgram, upsertLoyaltyProgram, listLoyaltyMembers, adjustLoyaltyMember, redeemLoyaltyReward,
} from '../../lib/authApi';
import type { LoyaltyProgramAdmin, LoyaltyProgramType, LoyaltyMemberRow, LoyaltyTier, CooldownType } from '../../types';
import { Section, Field, inputClass, PrimaryButton, ActionButton, type FormEvent } from '../../components/ui';

const TYPE_LABELS: Record<LoyaltyProgramType, string> = {
  punch_card: 'Punch card (visit N times, get a reward)',
  points: 'Points (earn per visit, redeem at a threshold)',
  tiered: 'Tiered status (ongoing perks by visit count)',
  spend: 'Spend-based (staff enter amount manually)',
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
            {members.length === 0 && <p className="text-sm text-ivory-dim">No members yet.</p>}
          </div>
        </Section>
      )}
    </div>
  );
}

function ProgramConfigForm({ businessId, program, onSaved }: {
  businessId: string; program: LoyaltyProgramAdmin | null; onSaved: (p: LoyaltyProgramAdmin) => void;
}) {
  const [type, setType] = useState<LoyaltyProgramType>(program?.type || 'punch_card');
  const [enabled, setEnabled] = useState(program?.enabled ?? false);
  const [visitsRequired, setVisitsRequired] = useState(program?.config.visitsRequired ?? 10);
  const [reward, setReward] = useState(program?.config.reward ?? '');
  const [pointsPerVisit, setPointsPerVisit] = useState(program?.config.pointsPerVisit ?? 10);
  const [redeemThreshold, setRedeemThreshold] = useState(program?.config.redeemThreshold ?? 100);
  const [thresholdAmount, setThresholdAmount] = useState(program?.config.thresholdAmount ?? 500);
  const [currency, setCurrency] = useState(program?.config.currency ?? 'AED');
  const [tiers, setTiers] = useState<LoyaltyTier[]>(program?.config.tiers ?? []);
  const [cooldownType, setCooldownType] = useState<CooldownType>(program?.config.cooldown?.type ?? 'none');
  const [cooldownHours, setCooldownHours] = useState(program?.config.cooldown?.hours ?? 6);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (type === 'tiered') {
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
    const cooldown = type !== 'spend'
      ? { type: cooldownType, ...(cooldownType === 'custom' ? { hours: cooldownHours } : {}) }
      : undefined;
    const config =
      type === 'punch_card' ? { visitsRequired, reward, cooldown } :
      type === 'points' ? { pointsPerVisit, redeemThreshold, reward, cooldown } :
      type === 'spend' ? { thresholdAmount, currency, reward } :
      { tiers: [...tiers].sort((a, b) => a.visitsRequired - b.visitsRequired), cooldown };
    const updated = await upsertLoyaltyProgram(businessId, type, enabled, config);
    onSaved(updated);
    setSaving(false);
  }

  function updateTier(index: number, patch: Partial<LoyaltyTier>) {
    setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function addTier() {
    setTiers((prev) => [...prev, { name: '', visitsRequired: (prev[prev.length - 1]?.visitsRequired ?? 0) + 5, perk: '' }]);
  }

  function removeTier(index: number) {
    setTiers((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <Section title="Loyalty program">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Type">
          <select value={type} onChange={(e) => setType(e.target.value as LoyaltyProgramType)} className={inputClass}>
            {Object.entries(TYPE_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
          </select>
        </Field>

        {type === 'punch_card' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Visits required">
              <input type="number" min={1} value={visitsRequired} onChange={(e) => setVisitsRequired(Number(e.target.value))} className={inputClass} />
            </Field>
            <Field label="Reward">
              <input value={reward} onChange={(e) => setReward(e.target.value)} placeholder="Free coffee" className={inputClass} />
            </Field>
          </div>
        )}
        {type === 'points' && (
          <div className="grid grid-cols-3 gap-3">
            <Field label="Points per visit">
              <input type="number" min={1} value={pointsPerVisit} onChange={(e) => setPointsPerVisit(Number(e.target.value))} className={inputClass} />
            </Field>
            <Field label="Redeem threshold">
              <input type="number" min={1} value={redeemThreshold} onChange={(e) => setRedeemThreshold(Number(e.target.value))} className={inputClass} />
            </Field>
            <Field label="Reward">
              <input value={reward} onChange={(e) => setReward(e.target.value)} placeholder="AED 20 off" className={inputClass} />
            </Field>
          </div>
        )}
        {type === 'spend' && (
          <div className="grid grid-cols-3 gap-3">
            <Field label="Threshold amount">
              <input type="number" min={1} value={thresholdAmount} onChange={(e) => setThresholdAmount(Number(e.target.value))} className={inputClass} />
            </Field>
            <Field label="Currency">
              <input value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Reward">
              <input value={reward} onChange={(e) => setReward(e.target.value)} placeholder="AED 50 credit" className={inputClass} />
            </Field>
          </div>
        )}

        {type === 'tiered' && (
          <div className="space-y-3">
            <p className="text-sm text-ivory-dim">
              Each tier is an ongoing perk unlocked at a visit count — not a one-time redemption like punch cards or points.
            </p>
            <div className="space-y-2">
              {tiers.map((tier, i) => (
                <div key={i} className="flex items-end gap-2 rounded-lg border border-ink-line p-3">
                  <Field label="Tier name">
                    <input
                      value={tier.name}
                      onChange={(e) => updateTier(i, { name: e.target.value })}
                      placeholder="Silver"
                      className={`${inputClass} w-32`}
                    />
                  </Field>
                  <Field label="Visits required">
                    <input
                      type="number"
                      min={1}
                      value={tier.visitsRequired}
                      onChange={(e) => updateTier(i, { visitsRequired: Number(e.target.value) })}
                      className={`${inputClass} w-28`}
                    />
                  </Field>
                  <Field label="Perk">
                    <input
                      value={tier.perk}
                      onChange={(e) => updateTier(i, { perk: e.target.value })}
                      placeholder="5% off every visit"
                      className={inputClass}
                    />
                  </Field>
                  <button
                    type="button"
                    onClick={() => removeTier(i)}
                    className="mb-0.5 shrink-0 rounded-lg border border-red-400/40 px-3 py-2.5 text-sm text-red-400 hover:bg-red-400/10"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {tiers.length === 0 && <p className="text-sm text-ivory-dim">No tiers yet — add at least one below.</p>}
            </div>
            <button
              type="button"
              onClick={addTier}
              className="rounded-lg border border-brass/40 px-3.5 py-2 text-sm text-brass hover:bg-brass/10"
            >
              + Add tier
            </button>
          </div>
        )}

        {type !== 'spend' && (
          <Field label="How often a tap counts">
            <div className="flex gap-2">
              <select
                value={cooldownType}
                onChange={(e) => setCooldownType(e.target.value as CooldownType)}
                className={inputClass}
              >
                <option value="none">Every tap counts</option>
                <option value="daily">Once per day</option>
                <option value="weekly">Once per week</option>
                <option value="custom">Custom</option>
              </select>
              {cooldownType === 'custom' && (
                <input
                  type="number"
                  min={1}
                  value={cooldownHours}
                  onChange={(e) => setCooldownHours(Number(e.target.value))}
                  placeholder="Hours"
                  className={`${inputClass} w-28`}
                />
              )}
            </div>
            <p className="mt-1 text-xs text-ivory-dim">
              A customer tapping again before this passes sees their current
              progress with "Already counted for today," instead of getting
              credited twice.
            </p>
          </Field>
        )}

        <label className="flex items-center gap-2 text-sm text-ivory-dim">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-brass" />
          Enabled — shows on the public landing page
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}
        <PrimaryButton disabled={saving}>{saving ? 'Saving...' : 'Save program'}</PrimaryButton>
      </form>
    </Section>
  );
}

function MemberRow({ member, businessId, program, onChange }: {
  member: LoyaltyMemberRow; businessId: string; program: LoyaltyProgramAdmin; onChange: () => void;
}) {
  const [showAdjust, setShowAdjust] = useState(false);

  const progressText =
    program.type === 'punch_card' ? `${member.visits} visits` :
    program.type === 'points' ? `${member.points} points` :
    program.type === 'spend' ? `${member.total_spend} spent` :
    member.current_tier || 'No tier';

  return (
    <div className="rounded-lg border border-ink-line px-3.5 py-2.5 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-ivory">{member.customers?.phone || 'Unknown'}</span>
        <div className="flex items-center gap-2">
          <span className="text-ivory-dim">{progressText}</span>
          <ActionButton onClick={() => setShowAdjust((s) => !s)}>Adjust</ActionButton>
          {(program.type === 'punch_card' || program.type === 'points') && (
            <ActionButton onClick={() => redeemLoyaltyReward(businessId, member.id).then(onChange)}>Redeem</ActionButton>
          )}
        </div>
      </div>
      {showAdjust && <AdjustForm businessId={businessId} membershipId={member.id} onDone={() => { setShowAdjust(false); onChange(); }} />}
    </div>
  );
}

function AdjustForm({ businessId, membershipId, onDone }: { businessId: string; membershipId: string; onDone: () => void }) {
  const [visits, setVisits] = useState(0);
  const [points, setPoints] = useState(0);
  const [spendAmount, setSpendAmount] = useState(0);
  const [note, setNote] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    await adjustLoyaltyMember(businessId, membershipId, { visits, points, spendAmount, note });
    onDone();
  }

  return (
    <form onSubmit={submit} className="mt-2.5 flex flex-wrap items-end gap-2 border-t border-ink-line pt-2.5">
      <Field label="± Visits"><input type="number" value={visits} onChange={(e) => setVisits(Number(e.target.value))} className={`${inputClass} w-24`} /></Field>
      <Field label="± Points"><input type="number" value={points} onChange={(e) => setPoints(Number(e.target.value))} className={`${inputClass} w-24`} /></Field>
      <Field label="+ Spend"><input type="number" value={spendAmount} onChange={(e) => setSpendAmount(Number(e.target.value))} className={`${inputClass} w-24`} /></Field>
      <Field label="Note"><input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} /></Field>
      <PrimaryButton>Apply</PrimaryButton>
    </form>
  );
}
