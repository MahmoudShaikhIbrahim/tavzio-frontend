import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Utensils, Star, Calendar, CreditCard, ShieldCheck, Ban, Building2, Menu, X, ArrowRight,
  Nfc, MonitorSmartphone, ChefHat, Car, Map, Boxes, Users, Languages, Radio, Link2, Zap,
  BedDouble, Sparkles, Wrench, ConciergeBell, Receipt,
} from 'lucide-react';
import { useLiveSystemTheme } from '../lib/ThemeContext';
import { submitLead } from '../lib/api';
import { useScrollReveal } from '../hooks/useScrollReveal';
import Logo from '../components/Logo';

const CATEGORIES = ['restaurant', 'cafe', 'retail', 'hotel', 'salon', 'clinic', 'gym', 'other'];

// Real, explicit request: "Built for" folded directly into Features -
// these are now what the two toggle buttons above the moving list
// switch between, not a separate section a visitor has to read twice.
// Every line is a real, currently-shipping feature, not a roadmap item.
const RESTAURANT_FEATURES = [
  { icon: Nfc, title: 'Tap or scan, either way', text: 'An NFC card and a QR code on the same stand - the menu, the bill, or a loyalty stamp opens instantly, however a guest prefers.' },
  { icon: Radio, title: 'Real-time, everywhere', text: 'Kitchen, Orders, POS, and Tables Map all update the instant something happens.' },
  { icon: MonitorSmartphone, title: 'POS Terminal', text: 'A full point of sale built into the same platform, not bolted on afterward.' },
  { icon: ChefHat, title: 'Live Kitchen Display', text: 'Real-time tickets, routed automatically to the right station.' },
  { icon: Car, title: 'Drive Through & pickup', text: 'Order ahead, pick an arrival time, staff see it coming with a live countdown.' },
  { icon: Map, title: 'Tables Map', text: 'A real spatial floor plan - shaped, seat-sized tables, walls and windows drawn to match the room.' },
  { icon: Calendar, title: 'Online Booking', text: 'Reservations with a configurable deposit - full, a percentage, or nothing at all.' },
  { icon: Star, title: 'Loyalty', text: 'Stamps, points, or tiers, tracked automatically with every tap.' },
  { icon: Boxes, title: 'Inventory & Purchase Orders', text: 'Stock tracking and supplier ordering built in from day one.' },
  { icon: Users, title: 'Staff & HR', text: 'Shifts, roles, and permissions, from the same dashboard as everything else.' },
  { icon: Languages, title: 'Genuinely multi-language', text: 'Arabic, English, and more - every screen, not just the menu.' },
  { icon: CreditCard, title: 'Pay Bill, any gateway', text: 'Split-bill payments through whichever payment provider you already use.' },
];

const HOTEL_FEATURES = [
  { icon: Nfc, title: 'Tap or scan, by the bed', text: 'An NFC card and a QR code in every room - room service, requests, or the bill open instantly, however a guest prefers.' },
  { icon: Radio, title: 'Real-time, everywhere', text: 'Requests, Kitchen, and Housekeeping all update the instant something happens.' },
  { icon: ConciergeBell, title: 'Guest requests', text: 'Housekeeping, amenities, maintenance - every request routed live to the right team.' },
  { icon: ChefHat, title: 'In-room ordering & room service', text: 'Routes to the same live Kitchen Display as any other order - nothing separate to manage.' },
  { icon: Calendar, title: 'Reservations', text: 'A configurable deposit - full, a percentage, or nothing at all.' },
  { icon: Receipt, title: 'Charged to the room', text: 'Room service and requests land straight on the guest folio, not a separate bill to chase down.' },
  { icon: Star, title: 'Loyalty', text: 'Stamps, points, or tiers, tracked automatically with every tap.' },
  { icon: Sparkles, title: 'Housekeeping', text: 'Task tracking per room, so nothing gets missed on a busy turnover day.' },
  { icon: Wrench, title: 'Maintenance tickets', text: 'Logged, assigned, and tracked to resolution - not a note that gets lost.' },
  { icon: BedDouble, title: 'Staff & HR', text: 'Shifts, roles, and permissions, from the same dashboard as everything else.' },
  { icon: Languages, title: 'Genuinely multi-language', text: 'Arabic, English, and more - every guest and staff screen.' },
  { icon: Boxes, title: 'Inventory & Purchase Orders', text: 'Stock tracking and supplier ordering built in from day one.' },
];

// Real, defensible comparison points - each grounded in an actual,
// factual product difference (not a vague "we're better" claim), and
// deliberately not naming any specific competitor by name. The NFC-vs-
// QR point was removed: Tavzio's own stand carries both, so it's no
// longer a real point of difference - replaced with distinctions that
// still hold.
const COMPARISON = [
  { icon: Boxes, us: 'Inventory built into the same platform from day one', them: 'Inventory bolted on later through a separate integration or partner' },
  { icon: Link2, us: 'Works with whichever payment gateway you already use', them: 'Often locked to the vendor\'s own payment processing' },
  { icon: Zap, us: 'Every screen - Kitchen, Orders, POS, Tables Map - updates live', them: 'Periodic sync, refresh-to-see-it-update' },
  { icon: Map, us: 'A real floor plan - staff glance and know exactly where a table is', them: 'A flat list of table names to scroll and search through' },
  { icon: Car, us: 'Drive-through and pickup built in natively, from day one', them: 'Usually a separate add-on, or not supported at all' },
];

const STEPS = [
  { n: '01', title: 'Tap', text: 'A customer taps their phone on the card at your table, counter, or door.' },
  { n: '02', title: 'Connect', text: 'Their phone opens your own page instantly — no app, no download, no login.' },
  { n: '03', title: 'Grow', text: 'Every tap becomes a real customer touchpoint — an order, a review, a returning visit.' },
];

// What one tap on the actual card becomes, in rotation - the hero's
// signature moment names itself from the real product, not a generic
// "features" list restated.
const TAP_BECOMES = ['the menu.', 'the bill.', 'a loyalty stamp.', 'a room request.', 'a booking.'];

// Two plans, priced differently for a restaurant (per table) than a
// hotel (per room) - reflects what each unit actually is in the two
// setups, not a one-size-fits-all number.
// Ambient, not intrusive - cycles on its own, but never for someone who's
// asked their system to reduce motion.
function useTapCycle() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const interval = setInterval(() => setIndex((i) => (i + 1) % TAP_BECOMES.length), 2600);
    return () => clearInterval(interval);
  }, []);
  return index;
}

// Wraps any section in the real scroll-reveal from useScrollReveal -
// defined once here so every section on the page gets the same
// fade/slide-up treatment consistently, rather than each one wiring
// the hook by hand.
function RevealSection({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  const { ref, className: revealClass } = useScrollReveal<HTMLDivElement>();
  return (
    <div id={id} ref={ref} className={`${className || ''} ${revealClass}`}>
      {children}
    </div>
  );
}

// Real, explicit request: a horizontally, slowly self-scrolling list -
// browsable by aiming the mouse at it and using the scroll wheel, a
// trackpad swipe, a touch swipe, or a genuine click-and-drag with the
// mouse itself. The last one was the real, confirmed bug: this used to
// set cursor:grab without ever actually implementing drag - there was
// no pointermove tracking at all, so a mouse drag did nothing while
// the auto-scroll kept quietly resuming underneath the user's cursor,
// which is exactly what read as "breaking and hanging". Rebuilt against
// Apple's own WebKit/Safari event-handling guidance and the Pointer
// Events spec: setPointerCapture on pointerdown so the drag keeps
// tracking even if the cursor leaves the element mid-gesture (the
// actual fix for the "even swiping doesn't work" half of the report -
// without capture, a fast drag can outrun the element's own bounds and
// silently stop receiving move events), and pointercancel handled
// identically to pointerup - the Pointer Events spec is explicit that
// skipping pointercancel is what causes a "persistent drag state",
// i.e. exactly a permanently stuck/hung interaction.
//
// Custom drag logic is scoped to pointerType === 'mouse' only. Touch
// and pen already get correct, native, momentum-scrolled dragging for
// free from the browser on a horizontal-overflow element - adding a
// second, custom-JS drag implementation on top of that native one is
// what usually causes touch interactions to fight themselves and feel
// broken, so this deliberately leaves touch/pen alone.
function FeatureMarquee({ features }: { features: { icon: typeof Nfc; title: string; text: string }[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const resumeTimer = useRef<number>();
  const dragRef = useRef<{ active: boolean; pointerId: number | null; startX: number; startScrollLeft: number }>({
    active: false, pointerId: null, startX: 0, startScrollLeft: 0,
  });

  useEffect(() => {
    let raf: number;
    function tick() {
      const el = scrollRef.current;
      if (el && !pausedRef.current) {
        el.scrollLeft += 0.6;
        const half = el.scrollWidth / 2;
        if (half > 0 && el.scrollLeft >= half) el.scrollLeft -= half;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  function pause() {
    pausedRef.current = true;
    if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
  }
  function scheduleResume() {
    if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => { pausedRef.current = false; }, 1200);
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el!.scrollLeft += e.deltaY;
        pause();
        scheduleResume();
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== 'mouse') return;
    const el = scrollRef.current;
    if (!el) return;
    dragRef.current = { active: true, pointerId: e.pointerId, startX: e.clientX, startScrollLeft: el.scrollLeft };
    el.setPointerCapture(e.pointerId);
    el.style.cursor = 'grabbing';
    // Stops the browser from starting a native text-selection or
    // drag-ghost image mid-drag, which is what "breaking" looked like
    // visually even on the rare pointermove that did land.
    e.preventDefault();
    pause();
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = scrollRef.current;
    const drag = dragRef.current;
    if (!el || !drag.active || drag.pointerId !== e.pointerId) return;
    el.scrollLeft = drag.startScrollLeft - (e.clientX - drag.startX);
  }
  // Real, explicit hardening pass (confirmed by explicit report: the
  // drag "worked once then needed re-pressing"). Firefox's own pointer-
  // events bug history (bugzilla 1258804 among others) documents real,
  // recurring timing edge cases in exactly this area - a captured
  // element occasionally not receiving the matching pointerup/
  // pointercancel it's owed. This can't be reliably reproduced or
  // proven in this environment (Firefox itself isn't installable
  // here), so rather than guess at a specific root cause, the fix is
  // to stop depending on any single element correctly receiving that
  // end event at all: endDrag is now a plain function callable from
  // both the element's own pointerup/pointercancel AND a window-level
  // fallback of the same two events. If the element-scoped one is ever
  // missed, the window one still resets the drag state, so a stuck
  // drag genuinely cannot survive past the next pointerup anywhere on
  // the page.
  function endDrag() {
    const el = scrollRef.current;
    const drag = dragRef.current;
    if (!drag.active && drag.pointerId === null) return;
    if (drag.pointerId !== null && el) {
      try { el.releasePointerCapture(drag.pointerId); } catch { /* already released */ }
      el.style.cursor = 'grab';
    }
    dragRef.current.active = false;
    dragRef.current.pointerId = null;
    scheduleResume();
  }

  useEffect(() => {
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    return () => {
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={scrollRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onTouchStart={pause}
      onTouchEnd={scheduleResume}
      className="flex select-none gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ cursor: 'grab' }}
    >
      {[...features, ...features].map((f, i) => (
        <div key={i} className="card-elevated flex w-72 shrink-0 flex-col rounded-2xl border border-ink-line bg-ink-soft p-7 transition-colors duration-200 hover:border-brass/40">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-brass/40 text-brass">
            <f.icon size={19} strokeWidth={1.75} />
          </span>
          <p className="mt-5 font-display text-lg text-ivory">{f.title}</p>
          <p className="mt-3 text-sm leading-relaxed text-ivory-dim">{f.text}</p>
        </div>
      ))}
    </div>
  );
}

// Real scroll tracking for the header's scale-down - a simple boolean
// past a small threshold (not a continuous 0-1 value tied to scroll
// position), because a slow, elegant transition reads as one deliberate
// state change on a real CSS transition duration, not a scrubbed
// animation that jitters with every pixel of scroll.
function useScrolledPast(threshold: number) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > threshold);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
}

// One definition for the luxury button treatment (see .btn-luxury in
// index.css) so every primary CTA on the page - hero, lead form -
// shares the exact same hover behavior instead of each
// one hand-rolling the label/arrow markup slightly differently.
function PrimaryLink({ to, href, onClick, type, disabled, className, children }: {
  to?: string; href?: string; onClick?: (e: ReactMouseEvent) => void; type?: 'button' | 'submit';
  disabled?: boolean; className?: string; children: ReactNode;
}) {
  const content = (
    <>
      <span className="btn-luxury-label">{children}</span>
      <span className="btn-luxury-arrow"><ArrowRight size={16} strokeWidth={2} /></span>
    </>
  );
  const cls = `btn-luxury inline-flex items-center gap-2 bg-brass px-6 py-3 font-medium text-ink transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-ink ${className || ''}`;
  if (to) return <Link to={to} onClick={onClick} className={cls}>{content}</Link>;
  if (href) return <a href={href} onClick={onClick} className={cls}>{content}</a>;
  return <button type={type || 'button'} onClick={onClick} disabled={disabled} className={cls}>{content}</button>;
}

// Real mobile menu - there wasn't one before (the old nav was simply
// `hidden md:flex`, meaning it just disappeared below md with nothing
// replacing it). Full-height panel, ease-in entrance as specifically
// asked for (distinct from ease-brass used everywhere else - this one
// specific interaction genuinely calls for gathering momentum on the
// way in), and each link laid out as a real two-column typographic
// row (mono index number + large serif link) rather than a plain
// stacked list, echoing the same numbered-editorial device already
// used for "How it works" and the feature list further down the page.
const MOBILE_LINKS = [
  { n: '01', label: 'Features', href: '#features' },
  { n: '02', label: 'How it works', href: '#how-it-works' },
  { n: '03', label: 'Demo', to: '/demo' },
];

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-modal md:hidden ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 transition-opacity duration-500 ease-in ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        className={`absolute inset-y-0 end-0 flex h-full w-[min(420px,88vw)] flex-col border-s border-ink-line bg-ink px-8 pb-10 pt-8 shadow-2xl transition-transform duration-500 ease-in ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-brass">Menu</span>
          <button type="button" onClick={onClose} aria-label="Close menu" className="flex h-10 w-10 items-center justify-center rounded-lg text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
            <X size={22} strokeWidth={1.75} />
          </button>
        </div>

        <nav className="mt-12 flex flex-1 flex-col divide-y divide-ink-line border-y border-ink-line">
          {MOBILE_LINKS.map((link) => {
            const row = (
              <>
                <span className="font-mono text-xs text-brass/60">{link.n}</span>
                <span className="font-display text-2xl text-ivory">{link.label}</span>
              </>
            );
            const rowClass = 'grid grid-cols-[2.5rem_1fr] items-center gap-4 py-5 transition-colors hover:bg-ink-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass';
            if (link.to) return <Link key={link.n} to={link.to} onClick={onClose} className={rowClass}>{row}</Link>;
            return (
              <a
                key={link.n}
                href={link.href}
                onClick={onClose}
                className={rowClass}
              >
                {row}
              </a>
            );
          })}
        </nav>

        <Link
          to="/admin/login"
          onClick={onClose}
          className="mt-8 rounded-lg border border-brass/40 px-4 py-3 text-center font-medium text-brass transition-colors hover:bg-brass/10"
        >
          Sign In
        </Link>
      </div>
    </div>
  );
}

export default function Home() {
  // A new visitor here has no account, no stored preference - this
  // should just match their own device's setting, live, never anything
  // tied to any logged-in account.
  const theme = useLiveSystemTheme();
  const tapIndex = useTapCycle();
  const scrolled = useScrolledPast(24);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Which of the two feature lists the marquee shows - a business kind
  // a visitor picks, not a scroll-tracked state, so it stays put until
  // they choose otherwise.
  const [featureCategory, setFeatureCategory] = useState<'restaurant' | 'hotel'>('restaurant');

  return (
    <div data-theme={theme} className="min-h-screen bg-ink">
      {/* Header - sticky, with real anchor navigation into sections
          that actually exist on this page (not decorative nav items
          pointing nowhere). Generous padding and wide item spacing at
          rest, then a slow (700ms), deliberate scale-down + padding
          tighten once the visitor actually starts reading - never
          instant, never scrubbed to scroll position pixel-by-pixel,
          just one considered state change. */}
      <div
        className={`sticky top-0 z-sticky flex origin-top items-center justify-between border-b border-ink-line bg-ink/90 backdrop-blur transition-all duration-700 ease-brass ${
          scrolled ? 'scale-[0.97] px-6 py-3 sm:px-10 lg:px-14' : 'px-6 py-6 sm:px-10 sm:py-7 lg:px-16'
        }`}
      >
        <a href="/" className="flex items-center gap-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
          <Logo />
        </a>
        <nav className="hidden items-center gap-12 text-sm text-ivory-dim md:flex">
          <a href="#features" className="rounded transition-colors hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">Features</a>
          <a href="#how-it-works" className="rounded transition-colors hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">How it works</a>
          <Link to="/demo" className="rounded transition-colors hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">Demo</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            to="/admin/login"
            className="hidden rounded-lg border border-brass/40 px-4 py-2 text-sm font-medium text-brass transition-colors hover:bg-brass/10 md:inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
          >
            Sign In
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-ivory md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
          >
            <Menu size={22} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <MobileMenu open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Hero - the tap itself is the thesis, not a headline over a
          generic gradient. Real product photography with a live ripple
          at the exact point a guest's finger lands, and a caption that
          cycles through what that single tap actually becomes.

          The one real risk spent here: the photo gets genuine dimension
          (a static perspective tilt + layered brass glow, not a flat
          card) and every element rises into place once on load - real
          choreography, not a loop. The eyebrow's pulsing dot is the one
          continuous motion, and it earns that: it's a live-status
          signal ("this is a running product"), the same legitimate
          convention as any live indicator, not the ambient decoration
          that didn't hold up last time. */}
      <div className="relative overflow-hidden border-b border-ink-line">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_65%_55%_at_50%_0%,rgba(184,146,90,0.10),transparent)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_45%_60%_at_82%_35%,rgba(184,146,90,0.08),transparent)]" />
        <div className="relative mx-auto grid max-w-6xl gap-16 px-6 py-12 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-12">
          <div className="text-center lg:text-left">
            <p className="inline-flex animate-hero-rise items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-brass">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute h-1.5 w-1.5 animate-live-pulse rounded-full bg-brass motion-reduce:animate-none" />
              </span>
              For restaurants & hotels in the UAE
            </p>
            <h1 className="mt-5 animate-hero-rise font-display text-[2.25rem] leading-[1.1] text-ivory [animation-delay:80ms] sm:text-5xl lg:text-6xl">
              One tap. <em className="not-italic text-brass">That's the whole system.</em>
            </h1>
            <p className="mx-auto mt-6 max-w-md animate-hero-rise text-[15px] leading-relaxed text-ivory-dim [animation-delay:160ms] lg:mx-0">
              A single card on the table or the nightstand opens the menu, takes the bill, tracks loyalty, and handles requests —
              everything a guest needs, and everything your staff used to repeat by hand, all day.
            </p>
            <div className="mt-9 flex animate-hero-rise flex-wrap items-center justify-center gap-5 [animation-delay:240ms] lg:justify-start">
              <PrimaryLink href="#get-started">Get started</PrimaryLink>
              <Link
                to="/demo"
                className="rounded-full border border-brass/40 px-6 py-3 font-medium text-brass transition-colors hover:bg-brass/10"
              >
                Try the demo
              </Link>
            </div>
          </div>

          <div className="mx-auto w-full max-w-sm animate-hero-rise [animation-delay:120ms] lg:max-w-none">
            <div className="card-elevated relative overflow-hidden rounded-2xl ring-1 ring-brass/20">
              <div className="pointer-events-none absolute -inset-6 -z-10 bg-[radial-gradient(ellipse_60%_60%_at_50%_40%,rgba(184,146,90,0.35),transparent)] blur-2xl" />
              <img src="/brand/stand-front.jpg" alt="A Tavzio NFC card and stand on a restaurant table" className="w-full" />
            </div>
            <div className="mt-5 flex justify-center">
              <p className="rounded-full border border-ink-line bg-ink-soft px-5 py-2 font-mono text-xs text-ivory-dim">
                One tap becomes <span key={tapIndex} className="text-brass">{TAP_BECOMES[tapIndex]}</span>
              </p>
            </div>
            <p className="mt-3 text-center text-xs text-ivory-dim lg:text-left">
              Every stand is customized to match your brand — finish, engraving, and branding, all made to order.
            </p>
          </div>
        </div>
      </div>

      {/* Features - real, explicit request: positioned right here, "The
          point" 's own spot right after the hero (a visitor sees what's
          actually built before reading five more sections), and "Built
          for" folded directly in as the two category toggles rather
          than living as a separate section a visitor has to read twice.
          The list scrolls itself, slowly, and a visitor can also aim
          the mouse at it and browse with the scroll wheel, a trackpad
          swipe, or a touch swipe - see FeatureMarquee above for how
          each of those actually works. */}
      <RevealSection id="features" className="border-b border-ink-line px-6 py-24">
        <div className="mx-auto max-w-4xl text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-brass">What's built in</p>
          <p className="mx-auto mt-7 max-w-3xl font-display text-3xl leading-[1.35] text-ivory sm:text-4xl">
            The best technology in hospitality is the kind a guest never has to think about —{' '}
            <em className="font-light italic text-ivory">it just works.</em>
          </p>
          <div className="mt-9 flex justify-center gap-2">
            <button
              type="button" onClick={() => setFeatureCategory('restaurant')}
              className={`flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition-colors ${
                featureCategory === 'restaurant' ? 'border-brass bg-brass text-ink' : 'border-ink-line text-ivory-dim hover:border-brass/40 hover:text-ivory'
              }`}
            >
              <Utensils size={15} strokeWidth={1.75} /> Restaurants & cafés
            </button>
            <button
              type="button" onClick={() => setFeatureCategory('hotel')}
              className={`flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition-colors ${
                featureCategory === 'hotel' ? 'border-brass bg-brass text-ink' : 'border-ink-line text-ivory-dim hover:border-brass/40 hover:text-ivory'
              }`}
            >
              <Building2 size={15} strokeWidth={1.75} /> Hotels
            </button>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-6xl">
          <FeatureMarquee features={featureCategory === 'restaurant' ? RESTAURANT_FEATURES : HOTEL_FEATURES} />
        </div>
      </RevealSection>

      {/* Your stand, on your tables - an editorial spread rather than a
          plain matched pair: one image leads at full weight, the second
          sits offset beneath it like a caption photo in a print layout,
          with a pull-quote standing in place of ordinary body copy. */}
      <RevealSection className="border-b border-ink-line px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.22em] text-brass">Your stand, on your tables</p>
          <div className="mt-12 grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-end">
            <div className="overflow-hidden rounded-2xl shadow-2xl ring-1 ring-ink-line">
              <img src="/brand/stand-angled.jpg" alt="Tavzio NFC stand, angled view" className="w-full" />
            </div>
            <div className="flex flex-col gap-6">
              <div className="overflow-hidden rounded-2xl shadow-xl ring-1 ring-ink-line lg:ms-8">
                <img src="/brand/stand-side.jpg" alt="Tavzio NFC stand, side profile" className="w-full" />
              </div>
              <p className="font-display text-xl leading-snug text-ivory lg:ms-8">
                "A single card at every table — <span className="text-brass">customers see it the moment they sit down.</span>"
              </p>
            </div>
          </div>
        </div>
      </RevealSection>

      {/* How it works - a genuine sequence (tap precedes connect
          precedes grow), so numbered steps earn their place here rather
          than decorating an unordered list. */}
      <RevealSection id="how-it-works" className="border-b border-ink-line px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.22em] text-brass">How it works</p>
          <div className="relative mt-12 grid gap-10 sm:grid-cols-3 sm:gap-6">
            <div className="pointer-events-none absolute left-0 right-0 top-[22px] hidden border-t border-dashed border-ink-line sm:block" />
            {STEPS.map((step) => (
              <div key={step.n} className="relative bg-ink text-center sm:text-left">
                <p className="font-mono text-2xl text-brass">{step.n}</p>
                <p className="mt-3 font-display text-xl text-ivory">{step.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ivory-dim">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* How Tavzio differs - real, factual product distinctions, never
          a specific competitor named (nothing here needs to be, since
          each point stands on its own as a real feature difference,
          not a disparaging claim about anyone in particular). */}
      <RevealSection className="border-b border-ink-line px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.22em] text-brass">How Tavzio is different</p>
          <div className="mt-12 overflow-hidden rounded-2xl border border-ink-line">
            <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-x-6 gap-y-0 bg-ink-soft px-6 py-4 text-xs font-medium uppercase tracking-wide text-ivory-dim sm:gap-x-10">
              <span />
              <span className="text-brass">Tavzio</span>
              <span>A typical system</span>
            </div>
            {COMPARISON.map((c, i) => (
              <div key={c.us} className={`grid grid-cols-[auto_1fr_1fr] items-center gap-x-6 px-6 py-5 sm:gap-x-10 ${i % 2 === 1 ? 'bg-ink-soft/40' : ''}`}>
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-brass/40 text-brass">
                  <c.icon size={16} strokeWidth={1.75} />
                </span>
                <p className="text-sm leading-relaxed text-ivory">{c.us}</p>
                <p className="text-sm leading-relaxed text-ivory-dim">{c.them}</p>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Why Tavzio - real, defensible facts about the product and
          company itself, deliberately not performance stats (no
          customers yet to measure "X% more tips" or "Y minutes saved"
          from - claiming numbers like that without real data behind
          them would be fabricating social proof). */}
      <RevealSection className="border-b border-ink-line px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.22em] text-brass">Why Tavzio</p>
          <div className="mt-14 grid gap-10 sm:grid-cols-3">
            <div className="text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-brass/40 text-brass"><Ban size={18} strokeWidth={1.75} /></span>
              <p className="mt-5 font-display text-lg text-ivory">No commission on orders</p>
              <p className="mt-3 text-sm leading-relaxed text-ivory-dim">A flat subscription, not a cut of every sale. What your guests pay is what you keep.</p>
            </div>
            {/* Stepped offset - the same asymmetric rhythm used on
                "Built for" above, so a visitor's eye reads this whole
                page as one considered editorial system rather than
                three separate sections that happen to share a color
                palette. */}
            <div className="text-center sm:mt-10">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-brass/40 text-brass"><Building2 size={18} strokeWidth={1.75} /></span>
              <p className="mt-5 font-display text-lg text-ivory">Your own branded page</p>
              <p className="mt-3 text-sm leading-relaxed text-ivory-dim">Not a shared marketplace app - guests land on your name, your logo, your menu.</p>
            </div>
            <div className="text-center sm:mt-20">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-brass/40 text-brass"><ShieldCheck size={18} strokeWidth={1.75} /></span>
              <p className="mt-5 font-display text-lg text-ivory">UAE-based, PDPL compliant</p>
              <p className="mt-3 text-sm leading-relaxed text-ivory-dim">Built and run in the UAE, in line with Federal Decree-Law No. 45 of 2021. <Link to="/legal" className="rounded text-brass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">Read our privacy policy →</Link></p>
            </div>
          </div>
        </div>
      </RevealSection>


      {/* Lead capture - an isolated, framed zone rather than a plain
          section flowing into the footer, so the single most important
          conversion moment on the page reads as its own clean space. */}
      <div id="get-started" className="border-b border-ink-line px-6 py-32">
        <div className="card-elevated mx-auto max-w-md rounded-2xl border border-brass/30 bg-ink-soft p-10 text-center">
          <p className="font-display text-3xl text-ivory">Get started</p>
          <p className="mt-4 text-sm leading-relaxed text-ivory-dim">
            Tell us a bit about your business — we'll reach out to set everything up personally.
          </p>
          <LeadForm />
        </div>
      </div>

      <footer className="border-t border-ink-line px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="font-mono text-[10px] uppercase tracking-widest text-ivory-dim/40">Tavzio — the tap is the interface</p>
          <div className="flex items-center gap-5 text-sm text-ivory-dim">
            <Link to="/legal" className="rounded hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function LeadForm() {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('restaurant');
  const [standsEstimate, setStandsEstimate] = useState(5);
  const [currentPosSystem, setCurrentPosSystem] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await submitLead({ email, phone, businessName, businessType, standsEstimate: Math.max(1, standsEstimate), currentPosSystem });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit - please try again');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mt-8 rounded-xl border border-brass/30 bg-ink-soft p-6 text-center">
        <p className="font-display text-lg text-ivory">Thanks — we've got it.</p>
        <p className="mt-1 text-sm text-ivory-dim">We'll reach out shortly to get you set up.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-3 text-left">
      <input
        type="text" required placeholder="Business name" value={businessName} onChange={(e) => setBusinessName(e.target.value)}
        className="w-full rounded-lg border border-ink-line bg-ink-soft px-4 py-3 text-base text-ivory placeholder:text-ivory-dim/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
      />
      <input
        type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border border-ink-line bg-ink-soft px-4 py-3 text-base text-ivory placeholder:text-ivory-dim/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
      />
      <input
        type="tel" required placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)}
        className="w-full rounded-lg border border-ink-line bg-ink-soft px-4 py-3 text-base text-ivory placeholder:text-ivory-dim/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
      />
      <select
        value={businessType} onChange={(e) => setBusinessType(e.target.value)}
        className="w-full rounded-lg border border-ink-line bg-ink-soft px-4 py-3 text-base text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
      >
        {CATEGORIES.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
      </select>
      <input
        type="text" placeholder="Current POS system (or leave blank if you're new / have none yet)"
        value={currentPosSystem} onChange={(e) => setCurrentPosSystem(e.target.value)}
        className="w-full rounded-lg border border-ink-line bg-ink-soft px-4 py-3 text-base text-ivory placeholder:text-ivory-dim/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
      />
      <label className="block text-sm text-ivory-dim">
        How many stands do you think you'll need?
        <input
          type="number" min={1} onFocus={(e) => e.target.select()} value={standsEstimate} onChange={(e) => setStandsEstimate(Number(e.target.value))}
          className="mt-1 w-full rounded-lg border border-ink-line bg-ink-soft px-4 py-3 text-base text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
        />
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <PrimaryLink type="submit" disabled={submitting} className="w-full justify-center">
        {submitting ? 'Sending...' : 'Get started'}
      </PrimaryLink>
    </form>
  );
}
