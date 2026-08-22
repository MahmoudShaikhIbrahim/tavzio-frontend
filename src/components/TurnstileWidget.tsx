import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: {
        sitekey: string;
        callback: (token: string) => void;
        'expired-callback'?: () => void;
        'error-callback'?: () => void;
        theme?: 'light' | 'dark' | 'auto';
      }) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const SCRIPT_ID = 'cf-turnstile-script';
let scriptLoadPromise: Promise<void> | null = null;

// Loaded once, shared across every mount - a second <script> tag would
// just be wasted network weight, and Turnstile's own JS is a singleton
// on window.turnstile regardless of how many times the tag appears.
function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;
  scriptLoadPromise = new Promise((resolve, reject) => {
    if (document.getElementById(SCRIPT_ID)) {
      // Script tag already exists (e.g. a previous mount added it) but
      // window.turnstile isn't ready yet - poll briefly rather than
      // adding a duplicate tag.
      const check = setInterval(() => {
        if (window.turnstile) { clearInterval(check); resolve(); }
      }, 50);
      return;
    }
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load bot verification - check your connection.'));
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

// Cloudflare Turnstile - chosen over reCAPTCHA specifically because it
// doesn't track visitors across sites and has no per-request cost or
// volume cap, which matters for a public signup/login form that any
// scraper or bot can hit at will. Renders invisible-first (most real
// visitors never see a challenge at all) and only escalates to a visible
// puzzle if Cloudflare's risk signals call for it.
export default function TurnstileWidget({ onVerify, onError }: { onVerify: (token: string) => void; onError?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [failedToLoad, setFailedToLoad] = useState(false);

  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: onVerify,
          'expired-callback': () => onVerify(''),
          'error-callback': () => onError?.(),
          theme: 'dark',
        });
      })
      .catch(() => setFailedToLoad(true));

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  // Missing site key or failed script load isn't rendered as a blocking
  // error - the form still submits, and the backend's own check (missing
  // token = rejected) is the real enforcement layer. This just avoids a
  // broken-looking empty box if Cloudflare's script genuinely can't load.
  if (!siteKey || failedToLoad) return null;

  return <div ref={containerRef} className="flex justify-center" />;
}
