import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';

interface Section {
  id: string;
  title: string;
  body: string[];
}

// Real content, deliberately consistent with Annex A (Data Processing
// Addendum) already written into every signed contract - not a generic
// template. The contract text itself (see buildContractText in
// contractController.js) promises this exact page exists at
// tavzio.ae/legal; this is what makes that promise true rather than a
// dead link.
const SECTIONS: Section[] = [
  {
    id: 'who-we-are',
    title: '1. Who we are',
    body: [
      'This policy applies to Tavzio FZC ("Tavzio", "we", "us"), a hospitality technology platform providing NFC/QR-powered guest experience, ordering, and payment software to restaurants and hotels ("Businesses") in the United Arab Emirates.',
      'It covers two different relationships: our own visitors and prospective clients on this website, and the guests of the Businesses that use Tavzio (where we act as a data processor on that Business\'s behalf, not as the data controller).',
    ],
  },
  {
    id: 'what-we-collect',
    title: '2. What we collect',
    body: [
      'From website visitors: name, email, phone number, and business details you submit through our "Get Started" or "Contact us" forms.',
      'From Business accounts and staff: name, email, role, and activity within the platform (orders processed, settings changed) needed to operate the service and maintain a security audit trail.',
      'From guests of a Business (processed on that Business\'s behalf): order and payment details, loyalty/reservation information where enabled, and NFC tap events used to route a guest to the correct menu or portal. We do not sell this data, and a Business\'s guest data is never shared with or visible to any other Business on the platform.',
    ],
  },
  {
    id: 'how-we-use-it',
    title: '3. How we use it',
    body: [
      'To operate the platform: process orders and payments, generate receipts, run loyalty programs, and provide the dashboards Businesses use to manage their operations.',
      'To respond to inquiries submitted through this website and, where you\'ve asked us to, follow up about pricing or onboarding.',
      'To maintain security: detecting and preventing fraud, unauthorized access, and abuse of the platform.',
      'We do not use guest or Business data to train external AI models, and we do not sell personal data to third parties.',
    ],
  },
  {
    id: 'legal-basis',
    title: '4. Legal basis and UAE compliance',
    body: [
      'Tavzio processes personal data in accordance with UAE Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data ("UAE PDPL").',
      'For a Business\'s guest and customer data, Tavzio acts as a data processor and the Business acts as the data controller, as set out in the Data Processing Addendum incorporated into every Tavzio service agreement. Where you\'re a guest of a Business using Tavzio, your rights regarding that data are primarily exercised through that Business - we assist them in responding to such requests.',
    ],
  },
  {
    id: 'sharing',
    title: '5. Who we share data with',
    body: [
      'Subprocessors necessary to run the platform: cloud hosting and database providers, and payment gateway providers used to process transactions. Each is bound by confidentiality and security obligations consistent with this policy.',
      'We do not share personal data with third parties for their own marketing purposes.',
      'We may disclose information where required by UAE law or a valid legal process.',
    ],
  },
  {
    id: 'security',
    title: '6. Security',
    body: [
      'Sensitive credentials (such as payment gateway API keys) are encrypted at rest. Every Business\'s data is isolated from every other Business\'s data at the database level, enforced independently of application code.',
      'Administrative access to the platform requires authentication, and we maintain an audit trail of significant account and data changes.',
      'No system is perfectly secure. If we become aware of a data breach affecting your personal data, we will notify affected Businesses without undue delay, consistent with our contractual and legal obligations.',
    ],
  },
  {
    id: 'retention',
    title: '7. Data retention',
    body: [
      'We retain personal data for as long as needed to provide the service and for legitimate business purposes such as legal compliance, dispute resolution, and enforcing our agreements.',
      'When a Business\'s agreement with Tavzio ends, we delete or return that Business\'s data at their election, subject to any legal retention requirements that apply.',
    ],
  },
  {
    id: 'your-rights',
    title: '8. Your rights',
    body: [
      'Depending on your relationship to Tavzio, you may have the right to access, correct, or request deletion of your personal data, and to object to certain processing, under UAE PDPL.',
      'If you\'re a guest of a Business using Tavzio, please contact that Business directly, as they control the data and are best placed to action your request. If you\'re a website visitor or a Business account holder, contact us directly using the details below.',
    ],
  },
  {
    id: 'cookies',
    title: '9. Cookies and this website',
    body: [
      'This website uses only the cookies and local storage necessary for it to function - for example, keeping you signed in to your dashboard, or remembering your demo session on our public demo page. We do not use third-party advertising or tracking cookies.',
    ],
  },
  {
    id: 'changes',
    title: '10. Changes to this policy',
    body: [
      'We may update this policy from time to time to reflect changes in our practices or legal requirements. We\'ll update the "Last updated" date below when we do; where a change is material, we\'ll take reasonable steps to notify affected Businesses.',
    ],
  },
  {
    id: 'contact',
    title: '11. Contact us',
    body: [
      'For questions about this policy or to exercise a data subject right, contact Tavzio at the email address provided in your service agreement, or through the "Contact us" form on our homepage.',
    ],
  },
];

const LAST_UPDATED = 'August 23, 2026';

export default function PrivacyPolicyPage() {
  const [tocOpen, setTocOpen] = useState(false);
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Real scroll-spy, not just a static list - the currently-visible
  // section highlights itself in the table of contents automatically,
  // the same "always know where you are in a long document" behavior
  // Qlub's own policy page uses.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: '-15% 0px -70% 0px' }
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  function jumpTo(id: string) {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTocOpen(false);
  }

  return (
    <div className="min-h-screen bg-ink">
      <header className="border-b border-ink-line px-6 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link to="/"><Logo className="h-8 w-auto" /></Link>
          <button
            type="button"
            onClick={() => setTocOpen(true)}
            className="flex items-center gap-2 rounded-full border border-ink-line px-4 py-2 text-sm text-ivory-dim transition-colors hover:border-brass hover:text-brass lg:hidden"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h8M2 12h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
            Contents
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-12 lg:grid lg:grid-cols-[240px_1fr] lg:gap-12">
        {/* Desktop: a real sticky sidebar table of contents, always
            visible, current section highlighted - not hidden behind a
            tap the way the mobile version has to be. */}
        <aside className="hidden lg:block">
          <div className="sticky top-12">
            <p className="text-sm uppercase tracking-wide text-brass">Table of contents</p>
            <nav className="mt-4 space-y-1">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => jumpTo(s.id)}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    activeId === s.id ? 'bg-brass/10 text-brass' : 'text-ivory-dim hover:text-ivory'
                  }`}
                >
                  {s.title}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <div>
          <p className="font-display text-3xl text-ivory sm:text-4xl">Privacy Policy</p>
          <p className="mt-2 text-sm text-ivory-dim">Last updated: {LAST_UPDATED}</p>
          <p className="mt-4 max-w-2xl text-base text-ivory-dim">
            This policy explains what personal data Tavzio collects, why, and how it's protected - both for
            visitors to this website and for the Businesses and guests that use the Tavzio platform.
          </p>

          <div className="mt-10 space-y-10">
            {SECTIONS.map((s) => (
              <section
                key={s.id}
                id={s.id}
                ref={(el) => { sectionRefs.current[s.id] = el; }}
                className="scroll-mt-24"
              >
                <h2 className="font-display text-xl text-ivory">{s.title}</h2>
                <div className="mt-3 space-y-3">
                  {s.body.map((p, i) => (
                    <p key={i} className="text-base leading-relaxed text-ivory-dim">{p}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile: the Qlub-style bottom-sheet table of contents -
          opened by the "Contents" button in the header, tapping a
          section jumps and closes the sheet. */}
      {tocOpen && (
        <div className="fixed inset-0 z-toast lg:hidden">
          <button type="button" aria-label="Close" onClick={() => setTocOpen(false)} className="absolute inset-0 bg-black/70" />
          <div className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-2xl border-t border-brass/30 bg-ink-soft p-5">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink-line" />
            <div className="flex items-center justify-between">
              <p className="font-display text-xl text-ivory">Table of contents</p>
              <button type="button" onClick={() => setTocOpen(false)} className="text-ivory-dim hover:text-ivory">✕</button>
            </div>
            <nav className="mt-4 space-y-1">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => jumpTo(s.id)}
                  className={`block w-full rounded-lg px-3 py-2.5 text-left text-base transition-colors ${
                    activeId === s.id ? 'bg-brass/10 text-brass' : 'text-ivory-dim'
                  }`}
                >
                  {s.title}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
