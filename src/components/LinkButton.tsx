import type { BusinessLinks } from '../types';
import { LINK_META } from '../lib/linkMeta';
import { getIcon } from '../lib/iconLibrary';
import { logEvent } from '../lib/api';

interface Props {
  linkKey: keyof BusinessLinks;
  value: string;
  icon?: string;
  slug: string;
}

// Maps each link key to the event `type` the backend's events table expects.
const EVENT_TYPE: Partial<Record<keyof BusinessLinks, string>> = {
  googleReviews: 'google_reviews_click',
  instagram: 'instagram_click',
  tiktok: 'tiktok_click',
  facebook: 'facebook_click',
  website: 'website_click',
  whatsapp: 'whatsapp_click',
  directions: 'directions_click',
};

export default function LinkButton({ linkKey, value, icon, slug }: Props) {
  const meta = LINK_META[linkKey];
  const Icon = getIcon(icon || meta.defaultIcon);
  const eventType = EVENT_TYPE[linkKey];

  return (
    <a
      href={meta.buildHref(value)}
      target="_blank"
      rel="noreferrer"
      onClick={() => {
        if (eventType) logEvent(slug, eventType).catch(() => {});
      }}
      className="group flex items-center gap-3 rounded-xl border border-ink-line bg-ink-soft px-4 py-3.5
                 text-ivory transition-colors duration-150 hover:border-brass/60 active:bg-ink
                 active:shadow-[inset_0_1px_4px_rgba(0,0,0,0.5)]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brass/40 text-brass">
        <Icon size={17} />
      </span>
      <span className="font-body text-[15px] font-medium">{meta.label}</span>
    </a>
  );
}
