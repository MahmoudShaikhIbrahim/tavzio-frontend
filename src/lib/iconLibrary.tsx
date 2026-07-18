import type { IconType } from 'react-icons';
// Simple Icons (the `si` set) - unlike FontAwesome's `fa` set, these are
// built specifically to match each company's real, official brand mark,
// sourced from their own published brand assets - the actual logo, not a
// generic icon-font interpretation of it.
import {
  SiInstagram, SiWhatsapp, SiTikTok, SiFacebook, SiGoogle, SiYouTube,
  SiX, SiLinkedIn, SiPinterest, SiSnapchat,
} from 'react-icons/si';
import {
  FaGlobe, FaMapMarkerAlt, FaStar, FaPhone, FaEnvelope, FaMusic, FaGift,
  FaHeart, FaTicketAlt, FaCamera, FaShoppingBag, FaLink,
} from 'react-icons/fa';

export interface IconOption {
  key: string;
  label: string;
  Icon: IconType;
  brandColor?: string; // real platform color - omitted for generic/utility icons, which stay theme-colored (brass)
}

// One shared list - the 7 fixed links, custom buttons, and anywhere else
// an icon needs picking all draw from this exact same set, so there's
// only ever one consistent picker in the whole app, not several
// different ones with different options.
export const ICON_LIBRARY: IconOption[] = [
  { key: 'instagram', label: 'Instagram', Icon: SiInstagram, brandColor: '#E4405F' },
  { key: 'whatsapp', label: 'WhatsApp', Icon: SiWhatsapp, brandColor: '#25D366' },
  { key: 'tiktok', label: 'TikTok', Icon: SiTikTok, brandColor: '#25F4EE' },
  { key: 'facebook', label: 'Facebook', Icon: SiFacebook, brandColor: '#1877F2' },
  { key: 'google', label: 'Google', Icon: SiGoogle, brandColor: '#4285F4' },
  { key: 'youtube', label: 'YouTube', Icon: SiYouTube, brandColor: '#FF0000' },
  { key: 'twitter', label: 'X / Twitter', Icon: SiX, brandColor: '#1DA1F2' },
  { key: 'linkedin', label: 'LinkedIn', Icon: SiLinkedIn, brandColor: '#0A66C2' },
  { key: 'pinterest', label: 'Pinterest', Icon: SiPinterest, brandColor: '#E60023' },
  { key: 'snapchat', label: 'Snapchat', Icon: SiSnapchat, brandColor: '#FFFC00' },
  { key: 'globe', label: 'Website / Globe', Icon: FaGlobe },
  { key: 'mapPin', label: 'Location / Directions', Icon: FaMapMarkerAlt },
  { key: 'star', label: 'Star / Review', Icon: FaStar },
  { key: 'phone', label: 'Phone', Icon: FaPhone },
  { key: 'mail', label: 'Mail', Icon: FaEnvelope },
  { key: 'music', label: 'Music', Icon: FaMusic },
  { key: 'gift', label: 'Gift', Icon: FaGift },
  { key: 'heart', label: 'Heart', Icon: FaHeart },
  { key: 'ticket', label: 'Ticket', Icon: FaTicketAlt },
  { key: 'camera', label: 'Camera', Icon: FaCamera },
  { key: 'shoppingBag', label: 'Shopping Bag', Icon: FaShoppingBag },
  { key: 'link', label: 'Generic Link', Icon: FaLink },
];

const ICON_MAP: Record<string, IconOption> = Object.fromEntries(ICON_LIBRARY.map((o) => [o.key, o]));

export function getIcon(key: string | undefined | null): IconType {
  return (key && ICON_MAP[key]?.Icon) || FaLink;
}

// Real platform color if this icon has one, otherwise undefined - callers
// fall back to the theme's brass color when this is undefined.
export function getIconColor(key: string | undefined | null): string | undefined {
  return key ? ICON_MAP[key]?.brandColor : undefined;
}
