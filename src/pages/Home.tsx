import { Link } from 'react-router-dom';
import { QrCode, Utensils, Star, Calendar, BarChart3, CreditCard } from 'lucide-react';

const WHATSAPP_NUMBER = '971500000000'; // TODO: replace with the real business WhatsApp number before going live

const FEATURES = [
  { icon: Utensils, title: 'Ordering', text: 'Customers browse the menu and order straight from the table, no app required.' },
  { icon: CreditCard, title: 'Pay Bill', text: 'Apple Pay and Google Pay at the table, with split-bill built in.' },
  { icon: Star, title: 'Loyalty', text: 'Stamps, points, tiers, or spend-based rewards, tracked automatically.' },
  { icon: Calendar, title: 'Booking', text: 'Salons, clinics, and gyms can take appointment requests the same way.' },
  { icon: BarChart3, title: 'Live analytics', text: 'See exactly which table or spot gets the most engagement.' },
];

const STEPS = [
  { n: '01', title: 'Tap', text: 'A customer taps their phone on the card at your table, counter, or door.' },
  { n: '02', title: 'Connect', text: 'Their phone opens your own page instantly — no app, no download, no login.' },
  { n: '03', title: 'Grow', text: 'Every tap becomes a real customer touchpoint — an order, a review, a returning visit.' },
];

export default function Home() {
  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi, I'd like to learn more about Tavzio for my business.")}`;

  return (
    <div className="min-h-screen bg-ink">
      {/* Header - a real Sign In, visible to everyone. There's nothing
          insecure about that: the login form itself is what checks
          credentials - someone without real access just gets rejected
          there, same as any normal website. */}
      <div className="flex items-center justify-between border-b border-ink-line px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-brass/60">
            <span className="font-display text-sm text-brass">T</span>
          </span>
          <span className="font-mono text-[11px] uppercase tracking-wider text-brass">Tavzio</span>
        </div>

        <div className="text-right">
          <Link
            to="/admin/login"
            className="rounded-lg border border-brass/40 px-4 py-2 text-sm font-medium text-brass transition-colors hover:bg-brass/10"
          >
            Sign In
          </Link>
          <p className="mt-1.5 text-[11px] text-ivory-dim/60">
            New here?{' '}
            <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi, I'd like to sign up for Tavzio.")}`}
              target="_blank" rel="noreferrer" className="text-brass hover:underline">
              Contact us on WhatsApp
            </a>
          </p>
        </div>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden px-6 pb-20 pt-24 text-center sm:pt-32">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.07]">
          <QrCode size={480} strokeWidth={0.5} className="text-brass" />
        </div>

        <div className="relative mx-auto max-w-2xl">
          <span className="relative inline-flex h-20 w-20 items-center justify-center rounded-full border-2 border-brass">
            <span className="absolute inline-flex h-20 w-20 animate-tap-ripple rounded-full border border-brass" />
            <span className="font-display text-2xl text-brass">T</span>
          </span>

          <p className="mt-6 font-mono text-[11px] uppercase tracking-wider text-brass">Tavzio</p>
          <h1 className="mt-2 font-display text-4xl font-medium leading-tight text-ivory sm:text-5xl">
            Tap. Connect. Grow.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-ivory-dim">
            One tap turns a table, a counter, or a door into a menu, a loyalty
            program, a booking page, and a way to pay — all without an app.
          </p>

          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-brass px-6 py-3 font-medium text-ink transition-opacity hover:opacity-90"
          >
            Get Tavzio for your business
          </a>
          <p className="mt-3 text-xs text-ivory-dim/70">We'll reach out personally to set everything up with you.</p>
        </div>
      </div>

      {/* How it works */}
      <div className="border-t border-ink-line px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <p className="text-center font-mono text-[11px] uppercase tracking-wider text-brass">How it works</p>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.n}>
                <p className="font-display text-3xl text-brass/40">{step.n}</p>
                <p className="mt-2 font-display text-lg text-ivory">{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ivory-dim">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="border-t border-ink-line px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <p className="text-center font-mono text-[11px] uppercase tracking-wider text-brass">What's built in</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-ink-line bg-ink-soft p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-brass/40 text-brass">
                  <f.icon size={18} strokeWidth={1.75} />
                </span>
                <p className="mt-3 font-display text-lg text-ivory">{f.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ivory-dim">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA footer */}
      <div className="border-t border-ink-line px-6 py-16 text-center">
        <p className="font-display text-xl text-ivory">Seen this at a table nearby?</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ivory-dim">
          If you run a restaurant, café, salon, or similar business and want
          this for your own space, reach out — setup is handled personally,
          card included.
        </p>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-brass/40 px-6 py-3 font-medium text-brass transition-colors hover:bg-brass/10"
        >
          Message us on WhatsApp
        </a>
        <p className="mt-10 font-mono text-[10px] uppercase tracking-widest text-ivory-dim/40">Tavzio</p>
      </div>
    </div>
  );
}
