import { useEffect, useState } from 'react';
import { listRequestsForSection, dismissRequest, type RequestRow } from '../lib/authApi';
import { subscribeToBusinessTable } from '../lib/supabaseClient';
import { usePollingFallback } from '../hooks/usePollingFallback';
import { hexToRgba } from '../lib/color';
import { useT } from '../hooks/useT';

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
        const customBg = r.request_color ? hexToRgba(r.request_color, 0.1) : null;
        const customStyle = r.request_color && customBg ? { borderColor: r.request_color, backgroundColor: customBg } : undefined;
        return (
          <div key={r.id} className={`rounded-lg border p-2.5 ${customStyle ? '' : 'border-brass/50 bg-brass/10'}`} style={customStyle}>
            <p className="text-xs font-medium leading-snug" style={customStyle ? { color: r.request_color! } : undefined}>
              <span className={customStyle ? '' : 'text-brass'}>{r.custom_request_label || t('Request')}</span>
              {' — '}<span className="text-ivory">{r.table_label || t('No table')}</span>
            </p>
            <button type="button" onClick={() => handleDismiss(r.id)} className="mt-1.5 w-full rounded-md border border-brass px-2 py-1 text-[11px] text-brass hover:bg-brass/10">
              {t('Dismiss')}
            </button>
          </div>
        );
      })}
    </div>
  );
}
