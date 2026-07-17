import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Business } from '../types';
import { getBusiness } from '../lib/api';
import { LINK_ORDER } from '../lib/linkMeta';
import LinkButton from '../components/LinkButton';
import PrimaryActionButtons from '../components/PrimaryActionButtons';
import LoyaltyWidget from '../components/LoyaltyWidget';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { LanguageProvider, useLanguage } from '../lib/i18n/LanguageContext';
import NotFound from './NotFound';

export default function LandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [business, setBusiness] = useState<Business | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Set by TapHandler right after a real NFC tap - proves this visit
  // followed an actual tap, which is what loyalty check-in, ordering, and
  // booking all require.
  const tapEventId = (() => {
    const stored = slug ? sessionStorage.getItem(`tavzio_tap_${slug}`) : null;
    return stored ? Number(stored) : null;
  })();

  useEffect(() => {
    if (!slug) return;
    getBusiness(slug)
      .then(setBusiness)
      .catch(() => setNotFound(true));
  }, [slug]);

  if (notFound) return <NotFound />;
  if (!business || !slug) return <LoadingShell />;

  return (
    <LanguageProvider slug={slug}>
      <LandingPageContent business={business} tapEventId={tapEventId} />
    </LanguageProvider>
  );
}

function LandingPageContent({ business, tapEventId }: { business: Business; tapEventId: number | null }) {
  const { t, isRtl } = useLanguage();

  // The 7 plain external-link buttons - Menu/Book/Call Waiter/Request Bill
  // are NOT part of this list anymore, they're rendered separately by
  // PrimaryActionButtons since they route into Tavzio's own flows.
  const enabledLinks = LINK_ORDER.filter((key) => business.links[key]?.enabled);

  return (
    <div className="relative min-h-screen bg-ink pb-16" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Cover */}
      <div className="relative h-48 w-full overflow-hidden bg-ink-soft sm:h-60">
        {business.cover_image_url && (
          <img src={business.cover_image_url} alt="" className="h-full w-full object-cover opacity-90" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/10 to-transparent" />
      </div>

      {/* Deliberately OUTSIDE the cover's overflow-hidden box - the switcher
          just sits visually in the same spot via absolute positioning
          against the page itself, but its dropdown is never clipped now. */}
      <div className="absolute end-4 top-4 z-10">
        <LanguageSwitcher />
      </div>

      <div className="relative mx-auto max-w-md px-5">
        {/* Logo medallion, overlapping the cover, with the tap-ripple signature moment */}
        <div className="relative -mt-12 flex justify-center">
          <span className="absolute inline-flex h-24 w-24 animate-tap-ripple rounded-full border border-brass" />
          <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-brass bg-ink-soft shadow-lg">
            {business.logo_url ? (
              <img src={business.logo_url} alt={business.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-display text-3xl text-brass">
                {business.name.charAt(0)}
              </div>
            )}
          </div>
        </div>

        {/* Identity */}
        <div className="mt-4 text-center">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ivory-dim">{business.category}</p>
          <h1 className="mt-1 font-display text-[28px] font-medium leading-tight text-ivory">{business.name}</h1>
          {business.description && (
            <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-ivory-dim">{business.description}</p>
          )}
        </div>

        {/* Loyalty */}
        {business.loyaltyProgram && (
          <div className="mt-6">
            <LoyaltyWidget slug={business.slug} program={business.loyaltyProgram} tapEventId={tapEventId} />
          </div>
        )}

        {/* Ordering / booking / quick requests */}
        <div className="mt-6">
          <PrimaryActionButtons business={business} tapEventId={tapEventId} />
        </div>

        {/* Plain external links */}
        <div className="mt-2.5 space-y-2.5">
          {enabledLinks.map((key) => (
            <LinkButton key={key} linkKey={key} value={business.links[key].value} slug={business.slug} />
          ))}
        </div>

        <p className="mt-10 text-center font-mono text-[10px] uppercase tracking-widest text-ivory-dim/40">
          {t('poweredBy')}
        </p>
      </div>
    </div>
  );
}

function LoadingShell() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink">
      <div className="h-10 w-10 animate-pulse rounded-full border-2 border-brass/40" />
    </div>
  );
}
