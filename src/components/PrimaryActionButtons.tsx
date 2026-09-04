import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UtensilsCrossed, CalendarCheck, CreditCard, ChevronRight, ArrowLeft, ExternalLink } from 'lucide-react';
import type { Business, CustomButton } from '../types';
import { submitCustomButtonRequest } from '../lib/api';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { getIcon, getIconColor } from '../lib/iconLibrary';

interface Props {
  business: Business;
  tapEventId: number | null;
}

const buttonClass =
  'group flex w-full items-center gap-3 rounded-xl border border-brass/30 bg-ink-soft px-4 py-3.5 ' +
  'text-start text-ivory transition-colors duration-150 hover:border-brass active:bg-ink ' +
  'active:shadow-[inset_0_1px_4px_rgba(0,0,0,0.5)] disabled:opacity-50 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-ink';

const iconWrapClass = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brass/40 text-brass';

export default function PrimaryActionButtons({ business, tapEventId }: Props) {
  const { ordering, booking } = business.features;
  const { t } = useLanguage();
  // A group button (e.g. "Services") replaces this whole list with its
  // own children when tapped - null means showing the normal top-level
  // list, an id means showing that group's contents instead.
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  if (openGroupId) {
    const group = business.customButtons.find((b) => b.id === openGroupId);
    const children = business.customButtons.filter((b) => b.parent_button_id === openGroupId && b.enabled);
    return (
      <div className="space-y-2.5">
        <button type="button" onClick={() => setOpenGroupId(null)} className="flex items-center gap-2 rounded text-sm text-ivory-dim hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-ink">
          <ArrowLeft size={15} /> {group?.label || 'Back'}
        </button>
        {children.map((btn) => <CustomButtonItem key={btn.id} btn={btn} slug={business.slug} tapEventId={tapEventId} onOpenGroup={setOpenGroupId} />)}
        {children.length === 0 && <p className="text-sm text-ivory-dim">Nothing here yet.</p>}
      </div>
    );
  }

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

      {/* Call a Waiter / Request the Bill / Housekeeping / Maintenance /
          any other owner-defined notification button, plus link buttons
          and group ("Services") buttons - all one system, managed from
          Landing Page Buttons. Only top-level buttons (no parent) ever
          render here directly; a group's own children only appear once
          that group is opened. */}
      {business.customButtons.filter((btn) => !btn.parent_button_id).map((btn) => (
        <CustomButtonItem key={btn.id} btn={btn} slug={business.slug} tapEventId={tapEventId} onOpenGroup={setOpenGroupId} />
      ))}
    </div>
  );
}

function CustomButtonItem({ btn, slug, tapEventId, onOpenGroup }: {
  btn: CustomButton; slug: string; tapEventId: number | null; onOpenGroup: (id: string) => void;
}) {
  if (btn.button_type === 'group') {
    const Icon = getIcon(btn.icon);
    const brandColor = getIconColor(btn.icon);
    return (
      <button type="button" onClick={() => onOpenGroup(btn.id)} className={buttonClass}>
        {btn.image_url ? (
          <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-ink-line">
            <img src={btn.image_url} alt="" className="h-full w-full object-cover" />
          </span>
        ) : (
          <span className={iconWrapClass} style={brandColor ? { color: brandColor, borderColor: `${brandColor}66` } : undefined}>
            <Icon size={15} />
          </span>
        )}
        <span className="font-body text-[15px] font-medium">{btn.label}</span>
        <ChevronRight size={16} className="ml-auto shrink-0 text-ivory-dim" />
      </button>
    );
  }

  if (btn.button_type === 'notification') {
    return <QuickRequestButton slug={slug} tapEventId={tapEventId} button={btn} />;
  }

  const Icon = getIcon(btn.icon);
  const brandColor = getIconColor(btn.icon);
  return (
    <a href={btn.url} target="_blank" rel="noreferrer" className={buttonClass}>
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
      {/* Distinguishes "leaves the site" links from in-page actions
          (group buttons use a chevron, notification buttons use none) -
          otherwise all three button types look identical and users can't
          predict what tapping one will do. */}
      <ExternalLink size={14} className="ml-auto shrink-0 text-ivory-dim" />
    </a>
  );
}

function QuickRequestButton({ slug, tapEventId, button }: {
  slug: string; tapEventId: number | null; button: { id: string; label: string; icon: string; image_url: string | null; allow_note?: boolean };
}) {
  const [state, setState] = useState<'idle' | 'expanded' | 'sending' | 'sent' | 'error' | 'no-tap'>('idle');
  const [note, setNote] = useState('');
  const { t } = useLanguage();
  const Icon = getIcon(button.icon);
  const brandColor = getIconColor(button.icon);

  const allowNote = button.allow_note !== false;

  async function handleTap() {
    if (!allowNote) {
      if (!tapEventId) { setState('no-tap'); return; }
      setState('sending');
      try {
        await submitCustomButtonRequest(slug, button.id, tapEventId);
        setState('sent');
      } catch {
        setState('error');
      }
      return;
    }
    setState('expanded');
  }

  async function handleSend() {
    if (!tapEventId) {
      setState('no-tap');
      return;
    }
    setState('sending');
    try {
      await submitCustomButtonRequest(slug, button.id, tapEventId, note.trim() || undefined);
      setState('sent');
    } catch {
      setState('error');
    }
  }

  const iconEl = button.image_url ? (
    <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-ink-line">
      <img src={button.image_url} alt="" className="h-full w-full object-cover" />
    </span>
  ) : (
    <span className={iconWrapClass} style={brandColor ? { color: brandColor, borderColor: `${brandColor}66` } : undefined}>
      <Icon size={17} strokeWidth={1.75} />
    </span>
  );

  if (state === 'sent') {
    return (
      <div className={`${buttonClass} cursor-default`}>
        {iconEl}
        {/* Real bug fix (confirmed by direct report: this text stayed
            gold/brass in both light and dark theme, unlike every other
            label in this same component - buttonClass and the expanded
            note view above both correctly use text-ivory, which is the
            one that actually flips white/black with the business's own
            theme; text-brass never does, in either mode - see
            index.css's own --color-ivory vs --color-brass definitions
            under [data-theme='light'] and [data-theme='dark']). */}
        <span className="font-body text-[15px] font-medium text-ivory">{t('staffNotified')}</span>
      </div>
    );
  }

  if (allowNote && (state === 'expanded' || state === 'sending')) {
    return (
      <div className="rounded-2xl border border-brass/40 p-3">
        <div className="flex items-center gap-3 text-ivory">
          {iconEl}
          <span className="font-body text-[15px] font-medium">{button.label}</span>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('addNoteOptional')}
          rows={2}
          className="mt-2 w-full rounded-lg border border-ink-line bg-ink px-3 py-2 text-sm text-ivory placeholder:text-ivory-dim/60"
        />
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={handleSend} disabled={state === 'sending'} className="rounded-lg bg-brass px-3 py-1.5 text-sm font-medium text-ink disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-ink">
            {state === 'sending' ? t('sending') : t('send')}
          </button>
          <button type="button" onClick={() => setState('idle')} className="rounded text-sm text-ivory-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-ink">{t('cancel')}</button>
        </div>
      </div>
    );
  }

  return (
    <button type="button" onClick={handleTap} disabled={state === 'sending'} className={buttonClass}>
      {iconEl}
      <span className="font-body text-[15px] font-medium">
        {state === 'sending'
          ? t('sending')
          : state === 'no-tap'
          ? t('tapRequiredForRequest')
          : state === 'error'
          ? `${button.label} — ${t('tapAgainToTry')}`
          : button.label}
      </span>
    </button>
  );
}
