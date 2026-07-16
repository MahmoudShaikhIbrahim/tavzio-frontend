import { useEffect, useState, type FormEvent } from 'react';
import type { LoyaltyProgram, LoyaltyMembership } from '../types';
import { loyaltyCheckin, loyaltyStatus } from '../lib/api';
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
  const [alreadyCounted, setAlreadyCounted] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');
  // True only while the SILENT auto-checkin (recognized device + fresh tap)
  // is in flight - keeps the form from flashing on screen for a moment
  // before the progress view appears, since this is meant to feel instant
  // and invisible, not like a login step.
  const [autoChecking, setAutoChecking] = useState(false);

  // If this browser already has a saved number for this business: a real,
  // fresh tap (tapEventId present) auto-credits the visit silently, no
  // typing, no form shown - this is the actual fix for "remember me and
  // count me automatically." Without a fresh tap (e.g. someone just opens
  // a bookmarked link), it falls back to a read-only status check instead,
  // since there's nothing legitimate to credit.
  useEffect(() => {
    const saved = getSavedPhone(slug);
    if (!saved) return;
    setPhone(saved);

    if (tapEventId) {
      setAutoChecking(true);
      loyaltyCheckin(slug, saved, tapEventId)
        .then((res) => {
          setMembership(res.membership);
          setRewardReady(res.rewardReady);
          setAlreadyCounted(res.alreadyCounted);
        })
        .catch(() => {}) // silent - if it fails, they still see the manual form below on retry
        .finally(() => setAutoChecking(false));
    } else {
      setStatus('loading');
      loyaltyStatus(slug, saved)
        .then((res) => {
          if (res.membership) setMembership(res.membership);
          setStatus('idle');
        })
        .catch(() => setStatus('idle'));
    }
  }, [slug, tapEventId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setStatus('loading');
    setError('');
    try {
      if (tapEventId) {
        const res = await loyaltyCheckin(slug, phone.trim(), tapEventId);
        setMembership(res.membership);
        setRewardReady(res.rewardReady);
        setAlreadyCounted(res.alreadyCounted);
      } else {
        const res = await loyaltyStatus(slug, phone.trim());
        setMembership(res.membership);
      }
      setSavedPhone(slug, phone.trim());
      setStatus('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStatus('error');
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
          {error && <p className="text-sm text-red-400">{error}</p>}
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
          {rewardReady && (
            <div className="rounded-lg border border-brass bg-brass/10 px-3.5 py-2.5 text-sm text-brass-bright">
              {t('rewardUnlocked')} — {cfg.reward || t('showToStaff')}
            </div>
          )}
          {!rewardReady && alreadyCounted && (
            <div className="rounded-lg border border-ink-line bg-ink px-3.5 py-2.5 text-sm text-ivory-dim">
              {t('alreadyCountedToday')}
            </div>
          )}

          {program.type === 'punch_card' && (
            <PunchCard visits={membership.visits} required={cfg.visitsRequired || 10} reward={cfg.reward} />
          )}
          {program.type === 'points' && (
            <PointsBar points={membership.points} threshold={cfg.redeemThreshold || 100} reward={cfg.reward} />
          )}
          {program.type === 'tiered' && (
            <TierStatus tier={membership.current_tier} tiers={cfg.tiers || []} visits={membership.visits} />
          )}
          {program.type === 'spend' && (
            <SpendBar spend={membership.total_spend} threshold={cfg.thresholdAmount || 500} currency={cfg.currency || ''} reward={cfg.reward} />
          )}
        </div>
      )}
    </div>
  );
}

function PunchCard({ visits, required, reward }: { visits: number; required: number; reward?: string }) {
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
      <p className="mt-2 text-xs text-ivory-dim">
        {t('visitsProgress', { filled, required })}{reward ? ` — ${reward}` : ''}
      </p>
    </div>
  );
}

function PointsBar({ points, threshold, reward }: { points: number; threshold: number; reward?: string }) {
  const { t } = useLanguage();
  const pct = Math.min(100, Math.round((points / threshold) * 100));
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-ink">
        <div className="h-full rounded-full bg-brass" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-ivory-dim">
        {t('pointsProgress', { points, threshold })}{reward ? ` — ${reward}` : ''}
      </p>
    </div>
  );
}

function TierStatus({ tier, tiers, visits }: { tier: string | null; tiers: { name: string; visitsRequired: number; perk: string }[]; visits: number }) {
  const { t } = useLanguage();
  const next = [...tiers].sort((a, b) => a.visitsRequired - b.visitsRequired).find((tr) => tr.visitsRequired > visits);
  return (
    <div>
      <p className="font-display text-lg text-brass-bright">{tier || t('noTierYet')}</p>
      {next && <p className="mt-1 text-xs text-ivory-dim">{t('moreVisitsTo', { n: next.visitsRequired - visits, tier: next.name })}</p>}
    </div>
  );
}

function SpendBar({ spend, threshold, currency, reward }: { spend: number; threshold: number; currency: string; reward?: string }) {
  const pct = Math.min(100, Math.round((spend / threshold) * 100));
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-ink">
        <div className="h-full rounded-full bg-brass" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-ivory-dim">
        {currency} {spend}/{threshold}{reward ? ` — ${reward}` : ''}
      </p>
    </div>
  );
}
