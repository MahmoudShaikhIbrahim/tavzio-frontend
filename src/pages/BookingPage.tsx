import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getServices, submitBooking } from '../lib/api';
import type { Service } from '../types';
import { LanguageProvider, useLanguage } from '../lib/i18n/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return <LoadingShell />;
  return (
    <LanguageProvider slug={slug}>
      <BookingPageContent slug={slug} />
    </LanguageProvider>
  );
}

function BookingPageContent({ slug }: { slug: string }) {
  const { t, isRtl } = useLanguage();
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selected, setSelected] = useState<Service | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const tapEventId = (() => {
    const stored = sessionStorage.getItem(`tavzio_tap_${slug}`);
    return stored ? Number(stored) : null;
  })();

  useEffect(() => {
    getServices(slug)
      .then((res) => setServices(res.services))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <LoadingShell />;
  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-ink px-6 text-center" dir={isRtl ? 'rtl' : 'ltr'}>
        <p className="font-display text-xl text-ivory">{t('bookingNotAvailable')}</p>
        <p className="text-sm text-ivory-dim">{t('bookingNotAvailableDesc')}</p>
      </div>
    );
  }

  if (!tapEventId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-ink px-6 text-center" dir={isRtl ? 'rtl' : 'ltr'}>
        <p className="font-display text-xl text-ivory">{t('bookingNeedsFreshTap')}</p>
        <p className="text-sm text-ivory-dim">{t('bookingNeedsFreshTapDesc')}</p>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink px-6 text-center" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-brass">
          <span className="font-display text-2xl text-brass">✓</span>
        </div>
        <p className="font-display text-xl text-ivory">{t('requestSent')}</p>
        <p className="text-sm text-ivory-dim">{t('requestSentDesc')}</p>
        <button
          onClick={() => navigate(`/${slug}`)}
          className="mt-4 rounded-lg border border-brass/40 px-4 py-2 text-sm text-brass hover:bg-brass/10"
        >
          {t('backTo', { slug })}
        </button>
      </div>
    );
  }

  if (selected) {
    return (
      <BookingForm
        slug={slug}
        service={selected}
        tapEventId={tapEventId}
        onBack={() => setSelected(null)}
        onConfirmed={() => setConfirmed(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-ink" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="mx-auto max-w-md px-6 pt-10 pb-16">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl text-ivory">{t('bookAppointment')}</h1>
          <LanguageSwitcher />
        </div>
        <div className="mt-6 space-y-3">
          {services.map((service) => (
            <button
              key={service.id}
              onClick={() => setSelected(service)}
              className="flex w-full items-center justify-between rounded-xl border border-ink-line bg-ink-soft px-5 py-4 text-start"
            >
              <div>
                <p className="font-body text-[15px] font-medium text-ivory">{service.name}</p>
                {service.description && <p className="mt-0.5 text-xs text-ivory-dim">{service.description}</p>}
                <p className="mt-0.5 text-xs text-ivory-dim">{service.duration_minutes} {t('minutesAbbrev')}</p>
              </div>
              <span className="shrink-0 ps-3 text-sm text-brass">{service.price.toFixed(2)}</span>
            </button>
          ))}
          {services.length === 0 && <p className="text-sm text-ivory-dim">{t('noServicesYet')}</p>}
        </div>
      </div>
    </div>
  );
}

function BookingForm({ slug, service, tapEventId, onBack, onConfirmed }: {
  slug: string; service: Service; tapEventId: number; onBack: () => void; onConfirmed: () => void;
}) {
  const { t, isRtl } = useLanguage();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!date || !time) return;
    setSubmitting(true);
    setError('');
    try {
      const requestedAt = new Date(`${date}T${time}`).toISOString();
      await submitBooking(slug, tapEventId, service.id, requestedAt, note, phone);
      onConfirmed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your request');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="mx-auto max-w-md px-6 pt-10 pb-16">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="text-sm text-ivory-dim hover:text-ivory">{isRtl ? '→' : '←'} {t('back')}</button>
          <LanguageSwitcher />
        </div>
        <h1 className="mt-3 font-display text-2xl text-ivory">{service.name}</h1>
        <p className="mt-1 text-sm text-brass">{service.price.toFixed(2)} · {service.duration_minutes} {t('minutesAbbrev')}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-ink-line bg-ink-soft px-3.5 py-2.5 text-ivory"
            />
            <input
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="rounded-lg border border-ink-line bg-ink-soft px-3.5 py-2.5 text-ivory"
            />
          </div>
          <input
            type="tel"
            placeholder={t('phoneForConfirm')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-ink-line bg-ink-soft px-3.5 py-2.5 text-ivory placeholder:text-ivory-dim/60"
          />
          <textarea
            placeholder={t('noteOptionalPlaceholder')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-ink-line bg-ink-soft px-3.5 py-2.5 text-ivory placeholder:text-ivory-dim/60"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brass px-4 py-3 font-medium text-ink disabled:opacity-50"
          >
            {submitting ? t('sending') : t('requestThisTime')}
          </button>
          <p className="text-center text-xs text-ivory-dim">{t('bookingDisclaimer')}</p>
        </form>
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
