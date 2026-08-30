import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CalendarCheck, Car, MapPin } from 'lucide-react';
import { getBookingChooserConfig, type BookingChooserConfig } from '../lib/api';
import { LanguageProvider, useLanguage } from '../lib/i18n/LanguageContext';
import { LogoMark } from '../components/Logo';

// The real front door for both flows, per the explicit request: this
// used to BE the table-booking form directly - now it's a real chooser,
// and the actual form moved to /:slug/book/table unchanged. Drive
// Through lives at /:slug/book/drive-through. Neither sub-page needed
// to change how IT works, only where it's reached from.
export default function BookingChooserPage() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return null;
  return (
    <LanguageProvider slug={slug}>
      <ChooserContent slug={slug} />
    </LanguageProvider>
  );
}

function ChooserContent({ slug }: { slug: string }) {
  const { isRtl, t } = useLanguage();
  const [config, setConfig] = useState<BookingChooserConfig | null>(null);
  // Real bug fix (confirmed by direct report: the generic Tavzio logo
  // and only "Book a Table" showed first, then the real logo and
  // "Drive Through" popped in a moment later - a visible wrong-then-
  // right flash, not just an unavoidable network wait). The actual
  // cause was rendering the full chooser UI immediately using
  // `config` before it had loaded: the logo fell back to the generic
  // mark, and "Book a Table" was shown optimistically via
  // `config === null || ...` while Drive Through and Location had no
  // such fallback and simply stayed hidden until the real data
  // arrived - two different loading behaviors for buttons on the same
  // screen, which is exactly what made the mismatch visible. A
  // separate `loaded` flag means nothing in this screen renders at
  // all until the real answer is in, so there is only ever one
  // correct render, never a wrong one to see change into a right one.
  //
  // Real, explicit follow-up performance fix: rather than only hiding
  // the wait, the wait itself is shorter now too - this used to call
  // getBookingConfig, the same endpoint the actual booking form and
  // drive-through ordering page use, both of which genuinely need the
  // full menu and every service's options. This screen never reads
  // either, but was paying for those two extra database round trips
  // on every load regardless. getBookingChooserConfig is the same
  // business lookup with both of those queries removed - see its own
  // comment on the backend for the full reasoning.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getBookingChooserConfig(slug).then(setConfig).catch(() => setConfig(null)).finally(() => setLoaded(true));
  }, [slug]);

  if (!loaded) {
    return <div dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen bg-ink" />;
  }

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="flex min-h-screen flex-col items-center justify-center bg-ink px-6 py-16 text-center">
      {config?.logoUrl ? (
        <img src={config.logoUrl} alt={config.businessName} className="h-16 w-16 rounded-2xl object-cover" />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-soft text-brass">
          <LogoMark className="h-8 w-8" />
        </div>
      )}
      <p className="mt-4 font-display text-2xl text-ivory">{config?.businessName || ''}</p>
      <p className="mt-2 text-sm text-ivory-dim">{t('chChoosePrompt')}</p>

      <div className="mt-10 w-full max-w-sm space-y-3">
        {config?.bookingEnabled && (
          <Link
            to={`/${slug}/book/table`}
            className="flex items-center gap-3 rounded-xl border border-ink-line bg-ink-soft px-5 py-4 text-start transition-colors hover:border-brass/50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brass/15 text-brass">
              <CalendarCheck size={19} strokeWidth={1.75} />
            </span>
            <span className="font-body text-base font-medium text-ivory">{t('chBookTable')}</span>
          </Link>
        )}
        {config?.driveThrough.enabled && (
          <Link
            to={`/${slug}/book/drive-through`}
            className="flex items-center gap-3 rounded-xl border border-ink-line bg-ink-soft px-5 py-4 text-start transition-colors hover:border-brass/50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brass/15 text-brass">
              <Car size={19} strokeWidth={1.75} />
            </span>
            <span className="font-body text-base font-medium text-ivory">{t('chDriveThrough')}</span>
          </Link>
        )}
        {config?.locationUrl && (
          <a
            href={config.locationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border border-ink-line bg-ink-soft px-5 py-4 text-start transition-colors hover:border-brass/50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brass/15 text-brass">
              <MapPin size={19} strokeWidth={1.75} />
            </span>
            <span className="font-body text-base font-medium text-ivory">{t('chLocation')}</span>
          </a>
        )}
      </div>
    </div>
  );
}
