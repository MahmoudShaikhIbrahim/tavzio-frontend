import { useEffect, useState, type FormEvent } from 'react';
import type { LoyaltyProgram, LoyaltyMembership, RewardInfo, TierReward } from '../types';
import { loyaltyCheckin, loyaltyStatus, claimReward } from '../lib/api';
import { getSavedPhone, setSavedPhone } from '../lib/loyaltyStorage';
import { useLanguage } from '../lib/i18n/LanguageContext';

interface Props {
  slug: string;
  program: LoyaltyProgram;
  tapEventId: number | null;
}

export default function LoyaltyWidget({ slug, program, tapEventId }: Props) {
  const { t } = useLanguage();
  const [phone, setPhone] = useState('');
  const [membership, setMembership] = useState<LoyaltyMembership | null>(null);
  const [rewardReady, setRewardReady] = useState(false);
  const [reward, setReward] = useState<RewardInfo | null>(null);
  const [currentTierReward, setCurrentTierReward] = useState<TierReward | null>(null);
  const [pendingClaim, setPendingClaim] = useState(false);
  const [alreadyCounted, setAlreadyCounted] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');
  const [claiming, setClaiming] = useState(false);
  // True only while the SILENT auto-checkin (recognized device + fresh tap)
  // is in flight - keeps the form from flashing on screen for a moment
  // before the progress view appears, since this is meant to feel instant
  // and invisible, not like a login step.
  const [autoChecking, setAutoChecking] = useState(false);

  function applyResponse(res: { membership: LoyaltyMembership; rewardReady?: boolean; alreadyCounted?: boolean; reward?: RewardInfo | null; currentTierReward?: TierReward | null; pendingClaim?: boolean }) {
    setMembership(res.membership);
    setRewardReady(!!res.rewardReady);
    setAlreadyCounted(!!res.alreadyCounted);
    setReward(res.reward || null);
    setCurrentTierReward(res.currentTierReward || null);
    setPendingClaim(!!res.pendingClaim);
  }

  // If this browser already has a saved number for this business: a real,
  // fresh tap (tapEventId present) auto-credits the visit silently, no
  // typing, no form shown - this is the actual fix for "remember me and
  // count me automatically." Without a fresh tap (e.g. someone just opens
  // a bookmarked link), it falls back to a read-only status check instead,
  // since there's nothing legitimate to credit.
  //
  // A single tapEventId can only ever be credited ONCE (the backend
  // correctly rejects a repeat check-in with the same tap) - so if this
  // exact tapEventId was already used this session (e.g. navigating to
  // the menu and back to the landing page), re-attempting a check-in
  // would always fail. This remembers that per tapEventId and switches to
  // a plain status fetch instead - same progress shown, no failed write.
  useEffect(() => {
    const saved = getSavedPhone(slug);
    if (!saved) return;
    setPhone(saved);

    const alreadyCreditedKey = `tavzio_credited_${tapEventId}`;
    const alreadyCreditedThisTap = tapEventId && sessionStorage.getItem(alreadyCreditedKey) === 'true';

    if (tapEventId && !alreadyCreditedThisTap) {
      setAutoChecking(true);
      loyaltyCheckin(slug, saved, tapEventId)
        .then((res) => {
          applyResponse(res);
          sessionStorage.setItem(alreadyCreditedKey, 'true');
        })
        .catch(() => {}) // silent - if it fails, they still see the manual form below on retry
        .finally(() => setAutoChecking(false));
    } else {
      setStatus('loading');
      loyaltyStatus(slug, saved)
        .then((res) => {
          if (res.membership) applyResponse({ ...res, membership: res.membership });
          setStatus('idle');
        })
        .catch(() => setStatus('idle'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, tapEventId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setStatus('loading');
    setError('');
    try {
      if (tapEventId) {
        const res = await loyaltyCheckin(slug, phone.trim(), tapEventId);
        applyResponse(res);
        sessionStorage.setItem(`tavzio_credited_${tapEventId}`, 'true');
      } else {
        const res = await loyaltyStatus(slug, phone.trim());
        if (res.membership) applyResponse({ ...res, membership: res.membership });
      }
      setSavedPhone(slug, phone.trim());
      setStatus('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStatus('error');
    }
  }

  async function handleClaim() {
    if (!tapEventId) return;
    setClaiming(true);
    try {
      await claimReward(slug, phone, tapEventId);
      setPendingClaim(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not claim reward');
    } finally {
      setClaiming(false);
    }
  }

  const cfg = program.config;

  if (autoChecking) {
    return (
      <div className="rounded-xl border border-brass/30 bg-ink-soft p-5">
        <p className="font-mono text-[11px] uppercase tracking-wider text-brass">{t('loyalty')}</p>
        <div className="mt-3 h-16 animate-pulse rounded-lg bg-ink" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-brass/30 bg-ink-soft p-5">
      <p className="font-mono text-[11px] uppercase tracking-wider text-brass">{t('loyalty')}</p>

      {!membership ? (
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <p className="text-sm text-ivory-dim">
            {tapEventId ? t('loyaltyStartPrompt') : t('loyaltyCheckPrompt')}
          </p>
          <input
            type="tel"
            inputMode="tel"
            required
            placeholder={t('phoneNumber')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-ink-line bg-ink px-3.5 py-2.5 text-ivory
                       placeholder:text-ivory-dim/60 focus:border-brass"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full rounded-lg bg-brass px-4 py-2.5 font-medium text-ink transition-opacity
                       hover:opacity-90 disabled:opacity-50"
          >
            {status === 'loading' ? t('checking') : tapEventId ? t('startEarning') : t('checkStatus')}
          </button>
        </form>
      ) : (
        <div className="mt-3 space-y-3">
          {/* Threshold reward - one-time, claimed then reset */}
          {rewardReady && !pendingClaim && (
            <div className="space-y-2 rounded-lg border border-brass bg-brass/10 px-3.5 py-2.5 text-sm text-brass-bright">
              <p>{t('rewardUnlocked')} — {reward?.description || t('yourReward')}</p>
              {tapEventId && (
                <button
                  onClick={handleClaim}
                  disabled={claiming}
                  className="w-full rounded-lg bg-brass px-3 py-2 text-sm font-medium text-ink disabled:opacity-50"
                >
                  {claiming ? t('claiming') : t('claimReward')}
                </button>
              )}
            </div>
          )}
          {rewardReady && pendingClaim && (
            <div className="rounded-lg border border-brass bg-brass/10 px-3.5 py-2.5 text-sm text-brass-bright">
              {t('rewardClaimed')}
            </div>
          )}
          {!rewardReady && alreadyCounted && (
            <div className="rounded-lg border border-ink-line bg-ink px-3.5 py-2.5 text-sm text-ivory-dim">
              {t('alreadyCountedToday')}
            </div>
          )}

          {/* Tiered - an ongoing perk, always shown, never claimed */}
          {program.structure === 'tiered' && (
            <TierStatus tier={membership.current_tier} tierReward={currentTierReward} tiers={cfg.tiers || []} measure={program.earn_method === 'spend' ? membership.total_spend : program.use_points ? membership.points : membership.visits} />
          )}

          {/* Threshold - progress toward the next reward */}
          {program.structure === 'threshold' && program.earn_method === 'spend' && (
            <SpendBar spend={membership.total_spend} threshold={cfg.thresholdAmount || 500} currency={cfg.currency || ''} />
          )}
          {program.structure === 'threshold' && program.earn_method === 'visit' && program.use_points && (
            <PointsBar points={membership.points} threshold={cfg.redeemThreshold || 100} />
          )}
          {program.structure === 'threshold' && program.earn_method === 'visit' && !program.use_points && (
            <PunchCard visits={membership.visits} required={cfg.visitsRequired || 10} />
          )}
        </div>
      )}
    </div>
  );
}

function PunchCard({ visits, required }: { visits: number; required: number }) {
  const { t } = useLanguage();
  const filled = visits % required;
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: required }).map((_, i) => (
          <span
            key={i}
            className={`h-7 w-7 rounded-full border ${i < filled ? 'border-brass bg-brass' : 'border-ink-line'}`}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-ivory-dim">{t('visitsProgress', { filled, required })}</p>
    </div>
  );
}

function PointsBar({ points, threshold }: { points: number; threshold: number }) {
  const { t } = useLanguage();
  const pct = Math.min(100, Math.round((points / threshold) * 100));
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-ink">
        <div className="h-full rounded-full bg-brass" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-ivory-dim">{t('pointsProgress', { points, threshold })}</p>
    </div>
  );
}

function TierStatus({ tier, tierReward, tiers, measure }: {
  tier: string | null; tierReward: TierReward | null; tiers: { name: string; threshold: number }[]; measure: number;
}) {
  const { t } = useLanguage();
  const next = [...tiers].sort((a, b) => a.threshold - b.threshold).find((tr) => tr.threshold > measure);
  return (
    <div>
      <p className="font-display text-lg text-brass-bright">{tier || t('noTierYet')}</p>
      {tierReward && <p className="mt-1 text-sm text-brass-bright">{tierReward.description}</p>}
      {next && <p className="mt-1 text-xs text-ivory-dim">{t('moreVisitsTo', { n: next.threshold - measure, tier: next.name })}</p>}
    </div>
  );
}

function SpendBar({ spend, threshold, currency }: { spend: number; threshold: number; currency: string }) {
  const pct = Math.min(100, Math.round((spend / threshold) * 100));
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-ink">
        <div className="h-full rounded-full bg-brass" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-ivory-dim">{currency} {spend}/{threshold}</p>
    </div>
  );
}
