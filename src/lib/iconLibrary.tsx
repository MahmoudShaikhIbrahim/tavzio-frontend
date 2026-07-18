import type { IconType } from 'react-icons';
import {
  FaInstagram, FaWhatsapp, FaTiktok, FaFacebookF, FaGoogle, FaGlobe, FaMapMarkerAlt,
  FaStar, FaPhone, FaEnvelope, FaMusic, FaGift, FaHeart, FaTicketAlt, FaCamera,
  FaShoppingBag, FaLink, FaSnapchatGhost, FaYoutube, FaTwitter, FaLinkedin, FaPinterest,
} from 'react-icons/fa';

export interface IconOption {
  key: string;
  label: string;
  Icon: IconType;
}

// One shared list - the 7 fixed links, custom buttons, and anywhere else
// an icon needs picking all draw from this exact same set, so there's
// only ever one consistent picker in the whole app, not several
// different ones with different options.
export const ICON_LIBRARY: IconOption[] = [
  { key: 'instagram', label: 'Instagram', Icon: FaInstagram },
  { key: 'whatsapp', label: 'WhatsApp', Icon: FaWhatsapp },
  { key: 'tiktok', label: 'TikTok', Icon: FaTiktok },
  { key: 'facebook', label: 'Facebook', Icon: FaFacebookF },
  { key: 'google', label: 'Google', Icon: FaGoogle },
  { key: 'youtube', label: 'YouTube', Icon: FaYoutube },
  { key: 'twitter', label: 'X / Twitter', Icon: FaTwitter },
  { key: 'linkedin', label: 'LinkedIn', Icon: FaLinkedin },
  { key: 'pinterest', label: 'Pinterest', Icon: FaPinterest },
  { key: 'snapchat', label: 'Snapchat', Icon: FaSnapchatGhost },
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

const ICON_MAP: Record<string, IconType> = Object.fromEntries(ICON_LIBRARY.map((o) => [o.key, o.Icon]));

export function getIcon(key: string | undefined | null): IconType {
  return (key && ICON_MAP[key]) || FaLink;
}
