import { useEffect, useRef, useState } from 'react';

// Real, reusable scroll-reveal - a section fades and slides up into
// place the first time it enters the viewport, then stays. Genuinely
// what most "advanced-feeling" marketing sites do differently from a
// static page: it's not fake polish, it's a real IntersectionObserver
// driving actual CSS transitions, same underlying mechanism as the
// scroll-spy already built for the Privacy Policy page's table of
// contents. Respects prefers-reduced-motion - always visible
// immediately for anyone who's asked their system to reduce motion,
// rather than making them wait on an animation they didn't want.
export function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, className: `transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}` };
}
