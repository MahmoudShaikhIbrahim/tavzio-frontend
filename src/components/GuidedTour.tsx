import { useEffect, useState, type CSSProperties } from 'react';

export interface TourStep {
  // Matches a `data-tour="..."` attribute already placed on the real
  // element being explained - not a hardcoded pixel position, so the
  // highlight always tracks the actual live element regardless of
  // screen size or what else is on the page that day.
  selector: string;
  title: string;
  body: string;
  // Which side of the element the tooltip prefers to sit on - falls
  // back to whatever direction actually has room if the preferred side
  // would push the tooltip off-screen.
  placement?: 'bottom' | 'top' | 'left' | 'right';
}

interface Rect { top: number; left: number; width: number; height: number }

// Generic engine, not tied to any one tour's content - the dashboard
// navigation tour is the first real use of this, but the same component
// can drive a tour anywhere else in the app later just by passing a
// different steps array, matched against different data-tour attributes.
export default function GuidedTour({ steps, onDone, onSkip }: {
  steps: TourStep[]; onDone: () => void; onSkip: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const step = steps[index];

  // Re-measures on every step change AND on resize/scroll - a tooltip
  // anchored to a stale position (e.g. after the window resizes, or the
  // page scrolls) is worse than no tour at all, since it visually
  // points at nothing.
  useEffect(() => {
    function measure() {
      const el = document.querySelector(`[data-tour="${step.selector}"]`);
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step.selector]);

  function next() {
    if (index === steps.length - 1) onDone();
    else setIndex((i) => i + 1);
  }
  function back() {
    setIndex((i) => Math.max(0, i - 1));
  }

  const placement = step.placement || 'bottom';
  const PAD = 10;
  const tooltipStyle: CSSProperties = rect
    ? placement === 'bottom'
      ? { top: rect.top + rect.height + PAD, left: Math.max(16, Math.min(rect.left, window.innerWidth - 336)) }
      : placement === 'top'
        ? { top: Math.max(16, rect.top - PAD - 160), left: Math.max(16, Math.min(rect.left, window.innerWidth - 336)) }
        : placement === 'left'
          ? { top: rect.top, left: Math.max(16, rect.left - PAD - 320) }
          : { top: rect.top, left: Math.min(rect.left + rect.width + PAD, window.innerWidth - 336) }
    : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Dimmed backdrop with a cut-out around the highlighted element,
          built from four rectangles rather than an SVG mask - simpler
          to reason about and keep in sync with a rect that changes on
          every scroll/resize tick. */}
      {rect ? (
        <>
          <div className="fixed bg-black/70" style={{ top: 0, left: 0, right: 0, height: Math.max(0, rect.top - 6) }} />
          <div className="fixed bg-black/70" style={{ top: rect.top - 6, left: 0, width: Math.max(0, rect.left - 6), height: rect.height + 12 }} />
          <div className="fixed bg-black/70" style={{ top: rect.top - 6, left: rect.left + rect.width + 6, right: 0, height: rect.height + 12 }} />
          <div className="fixed bg-black/70" style={{ top: rect.top + rect.height + 6, left: 0, right: 0, bottom: 0 }} />
          <div
            className="fixed rounded-lg ring-2 ring-brass"
            style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
          />
        </>
      ) : (
        <div className="fixed inset-0 bg-black/70" />
      )}

      <div className="fixed z-[101] w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-brass/40 bg-ink-soft p-4 shadow-2xl shadow-black/60" style={tooltipStyle}>
        <p className="font-display text-lg text-ivory">{step.title}</p>
        <p className="mt-1.5 text-sm text-ivory-dim">{step.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === index ? 'bg-brass' : 'bg-ink-line'}`} />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onSkip} className="rounded-full px-2 py-1 text-sm text-ivory-dim hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">Skip</button>
            {index > 0 && <button type="button" onClick={back} className="rounded-full px-2 py-1 text-sm text-ivory-dim hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">Back</button>}
            <button type="button" onClick={next} className="rounded-full bg-brass px-3.5 py-1.5 text-sm font-medium text-ink hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
              {index === steps.length - 1 ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
