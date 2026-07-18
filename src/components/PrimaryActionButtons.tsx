import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UtensilsCrossed, CalendarCheck, BellRing, Receipt, CreditCard } from 'lucide-react';
import type { Business } from '../types';
import { submitQuickRequest } from '../lib/api';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { getIcon, getIconColor } from '../lib/iconLibrary';

interface Props {
  business: Business;
  tapEventId: number | null;
}

const buttonClass =
  'group flex w-full items-center gap-3 rounded-xl border border-ink-line bg-ink-soft px-4 py-3.5 ' +
  'text-start text-ivory transition-colors duration-150 hover:border-brass/60 active:bg-ink ' +
  'active:shadow-[inset_0_1px_4px_rgba(0,0,0,0.5)] disabled:opacity-50';

const iconWrapClass = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brass/40 text-brass';

export default function PrimaryActionButtons({ business, tapEventId }: Props) {
  const { ordering, booking } = business.features;
  const { t } = useLanguage();

  return (
    <div className="space-y-2.5">
      {ordering.menuView && (
        <Link to={`/${business.slug}/menu`} className={buttonClass}>
          <span className={iconWrapClass}><UtensilsCrossed size={17} strokeWidth={1.75} /></span>
          <span className="font-body text-[15px] font-medium">{t('orderNow')}</span>
        </Link>
      )}

      {booking.menuView && (
        <Link to={`/${business.slug}/book`} className={buttonClass}>
          <span className={iconWrapClass}><CalendarCheck size={17} strokeWidth={1.75} /></span>
          <span className="font-body text-[15px] font-medium">{t('bookAppointment')}</span>
        </Link>
      )}

      {business.paymentEnabled && (
        <Link to={`/${business.slug}/pay`} className={buttonClass}>
          <span className={iconWrapClass}><CreditCard size={17} strokeWidth={1.75} /></span>
          <span className="font-body text-[15px] font-medium">{t('payBill')}</span>
        </Link>
      )}

      {ordering.callWaiter && (
        <QuickRequestButton slug={business.slug} tapEventId={tapEventId} requestType="call_waiter" icon={BellRing} labelKey="callWaiter" />
      )}

      {ordering.requestBill && (
        <QuickRequestButton slug={business.slug} tapEventId={tapEventId} requestType="request_bill" icon={Receipt} labelKey="requestBill" />
      )}

      {business.customButtons.map((btn) => {
        const Icon = getIcon(btn.icon);
        const brandColor = getIconColor(btn.icon);
        return (
          <a key={btn.id} href={btn.url} target="_blank" rel="noreferrer" className={buttonClass}>
            {btn.image_url ? (
              <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-ink-line">
                <img src={btn.image_url} alt="" className="h-full w-full object-cover" />
              </span>
            ) : (
              <span className={iconWrapClass} style={brandColor ? { color: brandColor, borderColor: `${brandColor}66` } : undefined}>
                <Icon size={15} />
              </span>
            )}
            {/* Custom button labels are owner-typed content, same reasoning
                as menu items - never auto-translated. */}
            <span className="font-body text-[15px] font-medium">{btn.label}</span>
          </a>
        );
      })}
    </div>
  );
}

function QuickRequestButton({ slug, tapEventId, requestType, icon: Icon, labelKey }: {
  slug: string; tapEventId: number | null; requestType: 'call_waiter' | 'request_bill'; icon: typeof BellRing;
  labelKey: 'callWaiter' | 'requestBill';
}) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const { t } = useLanguage();
  const label = t(labelKey);

  async function handleClick() {
    if (!tapEventId) {
      setState('error');
      return;
    }
    setState('sending');
    try {
      await submitQuickRequest(slug, tapEventId, requestType);
      setState('sent');
    } catch {
      setState('error');
    }
  }

  if (state === 'sent') {
    return (
      <div className={`${buttonClass} cursor-default`}>
        <span className={iconWrapClass}><Icon size={17} strokeWidth={1.75} /></span>
        <span className="font-body text-[15px] font-medium text-brass">{t('staffNotified')}</span>
      </div>
    );
  }

  return (
    <button onClick={handleClick} disabled={state === 'sending'} className={buttonClass}>
      <span className={iconWrapClass}><Icon size={17} strokeWidth={1.75} /></span>
      <span className="font-body text-[15px] font-medium">
        {state === 'sending' ? t('sending') : state === 'error' ? `${label} — ${t('tapAgainToTry')}` : label}
      </span>
    </button>
  );
}
