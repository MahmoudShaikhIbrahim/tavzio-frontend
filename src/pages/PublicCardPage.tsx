import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Phone, MessageCircle, Mail, Globe } from 'lucide-react';

const BASE = import.meta.env.VITE_API_BASE_URL || '';

interface PublicCard {
  id: string;
  slug: string;
  card_type: 'business' | 'person';
  status: string;
  name: string;
  title: string;
  company: string;
  description: string;
  logo_url: string | null;
  photo_url: string | null;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  address: string;
  location_url: string;
  working_hours: string;
  contact_visibility: Record<string, boolean>;
  social_links: Record<string, { url: string; enabled: boolean }>;
  design: { template?: string; primaryColor?: string; secondaryColor?: string };
}

const SOCIAL_LABELS: Record<string, string> = {
  instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', linkedin: 'LinkedIn',
  youtube: 'YouTube', twitter: 'X', snapchat: 'Snapchat',
};

function track(slug: string, eventType: string) {
  fetch(`${BASE}/api/public/cards/${slug}/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType }),
  }).catch(() => {}); // best-effort - a failed analytics ping should never block the visitor
}

export default function PublicCardPage() {
  const { slug } = useParams<{ slug: string }>();
  const [card, setCard] = useState<PublicCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`${BASE}/api/public/cards/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setCard(data);
        track(slug, 'view');
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#141110]"><div className="h-10 w-10 animate-pulse rounded-full border-2 border-white/30" /></div>;
  if (notFound || !card) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-[#141110] px-6 text-center">
        <p className="text-lg text-white">This card isn't available</p>
        <p className="text-sm text-white/50">It may have been unpublished or the link is incorrect.</p>
      </div>
    );
  }

  const primary = card.design.primaryColor || '#b8925a';
  const bg = card.design.secondaryColor || '#141110';
  const vis = card.contact_visibility || {};
  const hasPhone = card.phone && vis.phone !== false;
  const hasWhatsapp = card.whatsapp && vis.whatsapp !== false;
  const hasEmail = card.email && vis.email !== false;
  const hasWebsite = card.website && vis.website !== false;
  const hasAddress = card.address && vis.address !== false;
  const socials = Object.entries(card.social_links || {}).filter(([, v]) => v.enabled && v.url);

  function handleShare() {
    track(card!.slug, 'share');
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: card!.name, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="min-h-screen pb-16" style={{ background: bg }}>
      <div className="mx-auto max-w-md px-5 pt-10">
        <div className="flex flex-col items-center text-center">
          <div className="h-28 w-28 overflow-hidden rounded-full border-4" style={{ borderColor: primary }}>
            {(card.photo_url || card.logo_url) ? (
              <img src={card.photo_url || card.logo_url || ''} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-white/5 font-serif text-4xl text-white/40">{card.name?.[0]?.toUpperCase() || '?'}</div>
            )}
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-white">{card.name}</h1>
          {card.title && <p className="mt-1 text-sm uppercase tracking-widest" style={{ color: primary }}>{card.title}</p>}
          {card.card_type === 'person' && card.company && <p className="text-sm text-white/60">{card.company}</p>}
          {card.description && <p className="mt-3 text-sm leading-relaxed text-white/70">{card.description}</p>}
        </div>

        {/* Primary actions - immediately visible, per the spec */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          {hasPhone && (
            <a href={`tel:${card.phone}`} onClick={() => track(card.slug, 'phone_click')} className="flex items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-center text-sm font-medium text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" style={{ background: primary }}>
              <Phone size={15} strokeWidth={2} /> Call
            </a>
          )}
          {hasWhatsapp && (
            <a href={`https://wa.me/${card.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" onClick={() => track(card.slug, 'whatsapp_click')} className="flex items-center justify-center gap-1.5 rounded-xl border px-4 py-3 text-center text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" style={{ borderColor: primary }}>
              <MessageCircle size={15} strokeWidth={2} /> WhatsApp
            </a>
          )}
          {hasEmail && (
            <a href={`mailto:${card.email}`} onClick={() => track(card.slug, 'email_click')} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/20 px-4 py-3 text-center text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              <Mail size={15} strokeWidth={2} /> Email
            </a>
          )}
          {hasWebsite && (
            <a href={card.website} target="_blank" rel="noreferrer" onClick={() => track(card.slug, 'website_click')} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/20 px-4 py-3 text-center text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              <Globe size={15} strokeWidth={2} /> Website
            </a>
          )}
        </div>

        <a
          href={`${BASE}/api/public/cards/${card.slug}/vcard`}
          onClick={() => track(card.slug, 'save_contact')}
          className="mt-3 block rounded-xl px-4 py-3 text-center text-sm font-medium text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          style={{ background: primary }}
        >
          Save Contact
        </a>

        {(hasAddress || card.working_hours) && (
          <div className="mt-6 space-y-1 rounded-xl border border-white/10 p-4 text-sm text-white/70">
            {hasAddress && (
              <p>
                {card.location_url ? <a href={card.location_url} target="_blank" rel="noreferrer" className="rounded underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{card.address}</a> : card.address}
              </p>
            )}
            {card.working_hours && <p className="text-white/50">{card.working_hours}</p>}
          </div>
        )}

        {socials.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {socials.map(([network, { url }]) => (
              <a key={network} href={url} target="_blank" rel="noreferrer" onClick={() => track(card.slug, 'social_click')} className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                {SOCIAL_LABELS[network] || network}
              </a>
            ))}
          </div>
        )}

        <div className="mt-8 flex justify-center gap-4">
          <button
            type="button"
            onClick={handleShare}
            className="rounded px-2 py-1.5 text-sm text-white/60 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {copied ? 'Copied!' : 'Share Card'}
          </button>
          <a
            href={`${BASE}/api/public/cards/${card.slug}/qr.png`}
            target="_blank"
            rel="noreferrer"
            className="rounded px-2 py-1.5 text-sm text-white/60 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            QR Code
          </a>
        </div>

        <p className="mt-10 text-center text-[11px] uppercase tracking-widest text-white/25">Powered by Tavzio</p>
      </div>
    </div>
  );
}
