import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Utensils, Star, Calendar, BarChart3, CreditCard } from 'lucide-react';
import { useLiveSystemTheme } from '../lib/ThemeContext';
import { submitLead } from '../lib/api';
import Logo from '../components/Logo';

const CATEGORIES = ['restaurant', 'cafe', 'retail', 'hotel', 'salon', 'clinic', 'gym', 'other'];

const FEATURES = [
  { n: '01', icon: Utensils, title: 'Ordering', text: 'Customers browse the menu and order straight from the table, no app required.' },
  { n: '02', icon: CreditCard, title: 'Pay Bill', text: 'Apple Pay and Google Pay at the table, with split-bill built in.' },
  { n: '03', icon: Star, title: 'Loyalty', text: 'Stamps, points, tiers, or spend-based rewards, tracked automatically.' },
  { n: '04', icon: Calendar, title: 'Booking', text: 'Salons, clinics, and gyms can take appointment requests the same way.' },
  { n: '05', icon: BarChart3, title: 'Live analytics', text: 'See exactly which table or spot gets the most engagement.' },
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
const PLANS = {
  connect: {
    name: 'Tavzio Connect',
    tagline: 'The core platform, ready on day one.',
    restaurant: { base: 300, perUnit: 20 },
    hotel: { base: 1500, perUnit: 20 },
  },
  full: {
    name: 'Tavzio Full',
    tagline: 'Everything in Connect, plus the full operational suite.',
    restaurant: { base: 800, perUnit: 20 },
    hotel: { base: 2500, perUnit: 20 },
  },
} as const;

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

export default function Home() {
  // A new visitor here has no account, no stored preference - this
  // should just match their own device's setting, live, never anything
  // tied to any logged-in account.
  const theme = useLiveSystemTheme();
  const [exampleUnits, setExampleUnits] = useState(10);
  const [pricingType, setPricingType] = useState<'restaurant' | 'hotel'>('restaurant');
  const [pricingPlan, setPricingPlan] = useState<'connect' | 'full'>('connect');
  const tapIndex = useTapCycle();

  function scrollToPricing(e: React.MouseEvent) {
    e.preventDefault();
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div data-theme={theme} className="min-h-screen bg-ink">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-ink-line px-8 py-5">
        <div className="flex items-center gap-2">
          <Logo className="h-9 w-auto" />
        </div>
        <Link
          to="/admin/login"
          className="rounded-lg border border-brass/40 px-4 py-2 text-sm font-medium text-brass transition-colors hover:bg-brass/10"
        >
          Sign In
        </Link>
      </div>

      {/* Hero - the tap itself is the thesis, not a headline over a
          generic gradient. Real product photography with a live ripple
          at the exact point a guest's finger lands, and a caption that
          cycles through what that single tap actually becomes. */}
      <div className="relative overflow-hidden border-b border-ink-line">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_65%_55%_at_50%_0%,rgba(184,146,90,0.10),transparent)]" />
        <div className="relative mx-auto grid max-w-6xl gap-16 px-6 py-20 sm:py-28 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-12">
          <div className="text-center lg:text-left">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-brass">For restaurants & hotels in the UAE</p>
            <h1 className="mt-5 font-display text-[2.75rem] leading-[1.06] text-ivory sm:text-6xl">
              One tap.
              <br />
              Every guest <em className="not-italic text-brass">touchpoint.</em>
            </h1>
            <p className="mx-auto mt-6 max-w-md text-[15px] leading-relaxed text-ivory-dim lg:mx-0">
              A single brass card on the table or the nightstand becomes a live menu, a bill, a loyalty
              program, a room request — replacing the staff you'd otherwise need to run each one by hand.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-5 lg:justify-start">
              <a
                href="#get-started"
                className="rounded-lg bg-brass px-6 py-3 font-medium text-ink transition-opacity hover:opacity-90"
              >
                Get started
              </a>
              <a
                href="#pricing"
                onClick={scrollToPricing}
                className="text-sm font-medium text-ivory-dim transition-colors hover:text-ivory"
              >
                See pricing →
              </a>
            </div>
          </div>

          <div className="mx-auto w-full max-w-sm lg:max-w-none">
            <div className="relative overflow-hidden rounded-2xl shadow-2xl ring-1 ring-brass/20">
              <img src="/brand/stand-front.jpg" alt="A Tavzio NFC card and stand on a restaurant table" className="w-full" />
            </div>
            <div className="mt-5 flex justify-center">
              <p className="rounded-full border border-ink-line bg-ink-soft px-5 py-2 font-mono text-xs text-ivory-dim">
                One tap becomes <span key={tapIndex} className="text-brass">{TAP_BECOMES[tapIndex]}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Your stand, on your tables - an editorial spread rather than a
          plain matched pair: one image leads at full weight, the second
          sits offset beneath it like a caption photo in a print layout,
          with a pull-quote standing in place of ordinary body copy. */}
      <div className="border-b border-ink-line px-6 py-24">
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
      </div>

      {/* How it works - a genuine sequence (tap precedes connect
          precedes grow), so numbered steps earn their place here rather
          than decorating an unordered list. */}
      <div className="border-b border-ink-line px-6 py-20">
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
      </div>

      {/* Features - an indexed list, not a grid of matched icon cards.
          The numbering ties back to the same editorial device used for
          "How it works" and the pricing example, so the page reads as
          one considered system rather than five separate templates
          bolted together. */}
      <div className="border-b border-ink-line px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.22em] text-brass">What's built in</p>
          <div className="mt-12 divide-y divide-ink-line border-y border-ink-line">
            {FEATURES.map((f) => (
              <div key={f.title} className="group flex items-start gap-5 py-6 transition-colors duration-200 hover:bg-ink-soft/40 sm:gap-8 sm:px-4">
                <p className="font-mono text-sm text-brass/50 transition-colors duration-200 group-hover:text-brass">{f.n}</p>
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brass/40 text-brass">
                  <f.icon size={16} strokeWidth={1.75} />
                </span>
                <div>
                  <p className="font-display text-lg text-ivory">{f.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ivory-dim">{f.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing, with a real worked example */}
      <div id="pricing" className="border-b border-ink-line px-6 py-20">
        <div className="mx-auto max-w-4xl">
          {/* Why the price is what it is, before showing the numbers themselves */}
          <div className="mb-14 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-brass/30 bg-ink-soft p-6">
              <p className="font-display text-lg text-brass">Tavzio means fewer employees</p>
              <p className="mt-3 text-sm leading-relaxed text-ivory-dim">
                Traditional restaurant and hotel software helps you manage staff. Tavzio replaces the need for a lot of them —
                taking orders, answering requests, and routine day-to-day tasks run on their own, around the clock.
              </p>
              <p className="mt-4 border-l-2 border-brass/60 pl-3 text-sm text-ivory">
                The real saving isn't the subscription — it's the salaries, visas, and training you no longer need to pay for.
              </p>
            </div>
            <div className="rounded-xl border border-ink-line bg-ink-soft p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-brass">The operational savings chain</p>
              <div className="mt-4 space-y-2 text-sm text-ivory-dim">
                <div className="rounded-lg border border-ink-line px-3 py-2">Less payroll & salaries</div>
                <div className="pl-3 text-brass/60">↓</div>
                <div className="rounded-lg border border-ink-line px-3 py-2">Fewer employee visas & medical insurance</div>
                <div className="pl-3 text-brass/60">↓</div>
                <div className="rounded-lg border border-ink-line px-3 py-2">Less training overhead & fewer human errors</div>
                <div className="pl-3 text-brass/60">↓</div>
                <div className="rounded-lg border border-success/40 bg-success/5 px-3 py-2 text-success">Significantly lower operating expenses</div>
              </div>
            </div>
          </div>

          <p className="text-center font-mono text-[11px] uppercase tracking-[0.22em] text-brass">Pricing</p>
          <p className="mx-auto mt-3 max-w-md text-center text-sm text-ivory-dim">
            Two plans, priced for what you actually run — a restaurant table or a hotel room. No setup contracts, no hidden costs.
          </p>

          <div className="mt-8 flex justify-center">
            <div className="inline-flex rounded-lg border border-ink-line bg-ink-soft p-1">
              {(['restaurant', 'hotel'] as const).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setPricingType(t)}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                    pricingType === t ? 'bg-brass text-ink' : 'text-ivory-dim hover:text-ivory'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {(['connect', 'full'] as const).map((planKey) => {
              const plan = PLANS[planKey];
              const rates = plan[pricingType];
              const unit = pricingType === 'restaurant' ? 'table' : 'room';
              const selected = pricingPlan === planKey;
              return (
                <button
                  type="button"
                  key={planKey}
                  onClick={() => setPricingPlan(planKey)}
                  className={`relative rounded-xl border p-6 text-left transition-colors ${
                    selected ? 'border-brass bg-ink-soft' : 'border-ink-line bg-ink-soft/60 hover:border-brass/40'
                  }`}
                >
                  {planKey === 'full' && (
                    <span className="absolute -top-2.5 right-6 rounded-full bg-brass px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink">Full suite</span>
                  )}
                  <p className="font-display text-xl text-ivory">{plan.name}</p>
                  <p className="mt-2 font-mono text-4xl tabular-nums text-ivory">
                    {rates.base}<span className="ml-1 text-base font-sans text-ivory-dim">AED / month</span>
                  </p>
                  <p className="mt-1 font-mono text-sm text-ivory-dim">+ {rates.perUnit} AED / {unit} / month</p>
                  <p className="mt-3 text-sm text-ivory-dim">{plan.tagline}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-6 rounded-xl border border-brass/30 bg-ink p-6">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-brass">Example — {PLANS[pricingPlan].name}</p>
              <label className="flex items-center gap-2 text-sm text-ivory-dim capitalize">
                {pricingType === 'restaurant' ? 'Tables' : 'Rooms'}
                <input
                  type="number"
                  min={1}
                  onFocus={(e) => e.target.select()}
                  value={exampleUnits}
                  onChange={(e) => setExampleUnits(Number(e.target.value))}
                  className="w-16 rounded-lg border border-ink-line bg-ink-soft px-2 py-1 text-center text-ivory"
                />
              </label>
            </div>
            {(() => {
              const rates = PLANS[pricingPlan][pricingType];
              const units = Math.max(1, exampleUnits);
              const unitLabel = pricingType === 'restaurant' ? 'table' : 'room';
              return (
                <>
                  <div className="mt-3 space-y-1 font-mono text-sm text-ivory-dim">
                    <div className="flex justify-between"><span className="font-sans">Base</span><span>{rates.base} AED</span></div>
                    <div className="flex justify-between"><span className="font-sans">{units} {unitLabel}{units === 1 ? '' : 's'}</span><span>{units * rates.perUnit} AED</span></div>
                  </div>
                  <div className="mt-3 flex justify-between border-t border-ink-line pt-3 font-display text-lg text-ivory">
                    <span>Total / month</span>
                    <span className="font-mono text-brass">{rates.base + units * rates.perUnit} AED</span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Lead capture */}
      <div id="get-started" className="border-b border-ink-line px-6 py-24">
        <div className="mx-auto max-w-md text-center">
          <p className="font-display text-3xl text-ivory">Get started</p>
          <p className="mt-3 text-sm leading-relaxed text-ivory-dim">
            Tell us a bit about your business — we'll reach out to set everything up personally.
          </p>
          <LeadForm />
        </div>
      </div>

      <div className="px-6 py-10 text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest text-ivory-dim/40">Tavzio — the tap is the interface</p>
      </div>
    </div>
  );
}

function LeadForm() {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [businessType, setBusinessType] = useState('restaurant');
  const [standsEstimate, setStandsEstimate] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await submitLead({ email, phone, businessType, standsEstimate: Math.max(1, standsEstimate) });
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
        type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border border-ink-line bg-ink-soft px-4 py-3 text-base text-ivory placeholder:text-ivory-dim/60"
      />
      <input
        type="tel" required placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)}
        className="w-full rounded-lg border border-ink-line bg-ink-soft px-4 py-3 text-base text-ivory placeholder:text-ivory-dim/60"
      />
      <select
        value={businessType} onChange={(e) => setBusinessType(e.target.value)}
        className="w-full rounded-lg border border-ink-line bg-ink-soft px-4 py-3 text-base text-ivory"
      >
        {CATEGORIES.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
      </select>
      <label className="block text-sm text-ivory-dim">
        How many stands do you think you'll need?
        <input
          type="number" min={1} onFocus={(e) => e.target.select()} value={standsEstimate} onChange={(e) => setStandsEstimate(Number(e.target.value))}
          className="mt-1 w-full rounded-lg border border-ink-line bg-ink-soft px-4 py-3 text-base text-ivory"
        />
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="submit" disabled={submitting}
        className="w-full rounded-lg bg-brass px-4 py-3 font-medium text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? 'Sending...' : 'Get started'}
      </button>
    </form>
  );
}
