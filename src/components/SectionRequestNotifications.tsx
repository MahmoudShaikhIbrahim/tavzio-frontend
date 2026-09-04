import { useEffect, useState } from 'react';
import { listRequestsForSection, dismissRequest, type RequestRow } from '../lib/authApi';
import { subscribeToBusinessTable } from '../lib/supabaseClient';
import { usePollingFallback } from '../hooks/usePollingFallback';
import { hexToRgba } from '../lib/color';
import { useT } from '../hooks/useT';
import { splitRequestLabel } from '../lib/requestLabel';

// The real other half of the "true redirect" feature: a request routed
// to a specific section (Kitchen, POS Terminal, Tables) never shows on
// the general Requests page anymore - it only ever shows here, on the
// actual section it was sent to. Same real dismiss action and custom-
// color support the old shared cards had, just scoped to one section.
export default function SectionRequestNotifications({ businessId, section }: { businessId: string; section: string }) {
  const { t } = useT();
  const [requests, setRequests] = useState<RequestRow[]>([]);

  function reload() {
    listRequestsForSection(businessId, section).then(setRequests).catch(() => {});
  }
  useEffect(() => {
    reload();
    const unsubscribe = subscribeToBusinessTable(businessId, 'orders', reload);
    return () => { unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, section]);
  usePollingFallback(reload, !!businessId);

  async function handleDismiss(id: string) {
    setRequests((prev) => prev.filter((r) => r.id !== id));
    dismissRequest(businessId, id).catch(reload);
  }

  if (requests.length === 0) return null;

  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {requests.map((r) => {
        // The custom color an owner picks (e.g. to match one specific
        // landing-page button) only tints the card's border/background
        // here - it's decorative accent, not the text color. Applying an
        // arbitrary owner-chosen hex directly as foreground text was the
        // actual bug: a color picked to look good on their customer-
        // facing button can be unreadable (or literally invisible) once
        // reused as text against this dashboard's own background,
        // especially in the light theme this dashboard also renders in.
        // Text always stays one of the two theme-aware tokens below, so
        // it's guaranteed legible in both themes no matter what color
        // the owner picked.
        const customBg = r.request_color ? hexToRgba(r.request_color, 0.15) : null;
        const customStyle = r.request_color && customBg ? { borderColor: r.request_color, backgroundColor: customBg } : undefined;
        const { title, note } = splitRequestLabel(r.custom_request_label || t('Request'));
        return (
          <div key={r.id} className={`rounded-lg border p-2.5 ${customStyle ? '' : 'border-brass/50 bg-brass/10'}`} style={customStyle}>
            <p className="text-xs font-semibold leading-snug text-brass">
              {title}
              {' — '}<span className="font-normal text-ivory">{r.table_label || t('No table')}</span>
            </p>
            {note && <p className="mt-0.5 text-xs leading-snug text-ivory-dim">{note}</p>}
            <button type="button" onClick={() => handleDismiss(r.id)} className="mt-1.5 w-full rounded-md border border-brass px-2 py-1 text-[11px] text-brass hover:bg-brass/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
              {t('Dismiss')}
            </button>
          </div>
        );
      })}
    </div>
  );
}
