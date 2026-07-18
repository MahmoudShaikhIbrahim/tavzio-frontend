import type { BusinessLinks } from '../types';

interface LinkMeta {
  label: string;
  defaultIcon: string; // key into ICON_LIBRARY - used unless the owner picks a different one
  buildHref: (value: string) => string;
}

// Only the 7 buttons that work as plain external links on their own. Menu,
// Book Appointment, Call Waiter, and Request Bill are NOT here - they're
// rendered separately on the landing page, governed by BusinessFeatures
// (ordering/booking), since they route into Tavzio's own flows rather
// than an arbitrary external URL. Call and Special Offers were removed
// entirely per the product decision (special offers now live inside the
// menu as a category; a phone call button added little beyond WhatsApp).
export const LINK_META: Record<keyof BusinessLinks, LinkMeta> = {
  googleReviews: { label: 'Leave a Google review', defaultIcon: 'star', buildHref: (v) => v },
  instagram: { label: 'Follow on Instagram', defaultIcon: 'instagram', buildHref: (v) => v },
  tiktok: { label: 'Follow on TikTok', defaultIcon: 'tiktok', buildHref: (v) => v },
  facebook: { label: 'Follow on Facebook', defaultIcon: 'facebook', buildHref: (v) => v },
  whatsapp: { label: 'Message on WhatsApp', defaultIcon: 'whatsapp', buildHref: (v) => `https://wa.me/${v.replace(/\D/g, '')}` },
  website: { label: 'Visit website', defaultIcon: 'globe', buildHref: (v) => v },
  directions: { label: 'Get directions', defaultIcon: 'mapPin', buildHref: (v) => v },
};

// Display order - fixed, so the page has a consistent, predictable shape
// across every business regardless of which buttons they've enabled.
export const LINK_ORDER: (keyof BusinessLinks)[] = [
  'googleReviews', 'whatsapp', 'directions', 'website',
  'instagram', 'tiktok', 'facebook',
];
