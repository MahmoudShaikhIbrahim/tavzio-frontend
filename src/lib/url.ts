// Real fix for the explicit report: a business owner typing a location/
// social link into a settings field (e.g. "maps.google.com/...", no
// "https://") produces an <a href> the browser treats as a path RELATIVE
// to tavzio.ae - so instead of leaving the site, it silently hits our
// own router (e.g. tavzio.ae/place/some-cafe/...) and lands on the 404
// page. Backend-generated links (Stripe/Tap payment links, our own
// public card URLs) always come with a protocol already and don't need
// this; this is only for free-text URL fields an owner typed by hand.
export function withProtocol(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
}
