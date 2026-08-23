import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import { getBusiness, updateBusinessFeatures } from '../../lib/authApi';
import { Section, Field, inputClass, PrimaryButton } from '../../components/ui';

type DownPaymentMode = 'full' | 'percentage' | 'fixed';

export default function OnlineBookingSettingsPage() {
  const { user } = useSession();
  const { t } = useT();
  const businessId = user?.business_id;
  const [slug, setSlug] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [allowPreOrder, setAllowPreOrder] = useState(false);
  const [downPaymentEnabled, setDownPaymentEnabled] = useState(false);
  const [downPaymentMode, setDownPaymentMode] = useState<DownPaymentMode>('percentage');
  const [downPaymentValue, setDownPaymentValue] = useState(20);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!businessId) return;
    getBusiness(businessId).then((b) => {
      setSlug(b.slug);
      const cfg = b.features?.onlineBooking;
      if (cfg) {
        setEnabled(!!cfg.enabled);
        setAllowPreOrder(!!cfg.allowPreOrder);
        setDownPaymentEnabled(!!cfg.downPayment?.enabled);
        if (cfg.downPayment?.mode) setDownPaymentMode(cfg.downPayment.mode);
        if (cfg.downPayment?.value !== undefined) setDownPaymentValue(cfg.downPayment.value);
      }
    }).finally(() => setLoading(false));
  }, [businessId]);

  async function handleSave() {
    if (!businessId) return;
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      // Sent as one complete object, not a partial patch - the backend
      // merge is shallow (one level deep), so downPayment must always
      // be sent whole or an earlier value could get silently dropped.
      await updateBusinessFeatures(businessId, {
        onlineBooking: {
          enabled,
          allowPreOrder,
          downPayment: { enabled: downPaymentEnabled, mode: downPaymentMode, value: downPaymentValue },
        },
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-ivory-dim">{t('Loading...')}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ivory">{t('Online Booking')}</h1>
        <p className="mt-1 text-base text-ivory-dim">
          {t('Let customers reserve a table online, with an optional food pre-order and down payment.')}
        </p>
      </div>

      <Section title={t('Settings')}>
        <label className="flex items-center justify-between gap-4">
          <div>
            <p className="text-base text-ivory">{t('Enable online booking')}</p>
            <p className="text-sm text-ivory-dim">{t('Turns on the public booking page and the QR code / link below.')}</p>
          </div>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-5 w-5 accent-brass" />
        </label>

        {enabled && (
          <>
            <label className="flex items-center justify-between gap-4 border-t border-ink-line pt-4">
              <div>
                <p className="text-base text-ivory">{t('Allow food pre-order with booking')}</p>
                <p className="text-sm text-ivory-dim">{t('Off = booking only. On = customers can also pre-order food, ready when they arrive or a few minutes after.')}</p>
              </div>
              <input type="checkbox" checked={allowPreOrder} onChange={(e) => setAllowPreOrder(e.target.checked)} className="h-5 w-5 accent-brass" />
            </label>

            <div className="border-t border-ink-line pt-4">
              <label className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-base text-ivory">{t('Require a down payment')}</p>
                  <p className="text-sm text-ivory-dim">{t('Charged online when the booking is made, before it counts as confirmed.')}</p>
                </div>
                <input type="checkbox" checked={downPaymentEnabled} onChange={(e) => setDownPaymentEnabled(e.target.checked)} className="h-5 w-5 accent-brass" />
              </label>

              {downPaymentEnabled && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label={t('Type')}>
                    <select value={downPaymentMode} onChange={(e) => setDownPaymentMode(e.target.value as DownPaymentMode)} className={inputClass}>
                      <option value="full">{t('Full amount (only applies if a food pre-order is included)')}</option>
                      <option value="percentage">{t('Percentage of the pre-order total')}</option>
                      <option value="fixed">{t('Fixed amount, every booking')}</option>
                    </select>
                  </Field>
                  {downPaymentMode !== 'full' && (
                    <Field label={downPaymentMode === 'percentage' ? t('Percentage (%)') : t('Amount (AED)')}>
                      <input
                        type="number" min={0} max={downPaymentMode === 'percentage' ? 100 : undefined}
                        value={downPaymentValue} onFocus={(e) => e.target.select()}
                        onChange={(e) => setDownPaymentValue(Number(e.target.value))}
                        className={inputClass}
                      />
                    </Field>
                  )}
                </div>
              )}
              {downPaymentEnabled && downPaymentMode !== 'fixed' && !allowPreOrder && (
                <p className="mt-2 text-sm text-warning">
                  {t('This business has food pre-order turned off, so a percentage or full-amount down payment has nothing to calculate from - only a fixed amount will actually charge anything until pre-order is turned on.')}
                </p>
              )}
            </div>
          </>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex items-center gap-3">
          <PrimaryButton onClick={handleSave} loading={saving} type="button">{t('Save')}</PrimaryButton>
          {saved && <span className="text-sm text-success">{t('Saved')}</span>}
        </div>
      </Section>

      {enabled && slug && <ShareSection slug={slug} />}
    </div>
  );
}

// Real, self-generated QR code - no third-party image service, no
// dependency on an external site staying up. Rendered client-side,
// entirely offline once loaded, using the exact same booking URL the
// "Copy link" button hands out below - one source of truth, so the
// printed QR code and the pasted Instagram/WhatsApp link can never
// point at two different places.
function ShareSection({ slug }: { slug: string }) {
  const { t } = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const bookingUrl = `https://www.tavzio.ae/${slug}/book`;

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, bookingUrl, { width: 240, margin: 2, color: { dark: '#1a1a1a', light: '#ffffff' } }).catch(() => {});
    }
  }, [bookingUrl]);

  function handleCopy() {
    navigator.clipboard.writeText(bookingUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownload() {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `${slug}-booking-qr.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  }

  return (
    <Section title={t('Share your booking page')}>
      <p className="text-base text-ivory-dim">
        {t('Paste this link into your Instagram bio or WhatsApp Business profile, or print the QR code on table tents, window stickers, or flyers.')}
      </p>

      <div className="flex flex-col items-start gap-6 sm:flex-row">
        <div className="rounded-xl border border-ink-line bg-white p-3">
          <canvas ref={canvasRef} />
        </div>
        <div className="flex-1 space-y-3">
          <Field label={t('Booking link')}>
            <div className="flex gap-2">
              <input readOnly value={bookingUrl} className={`${inputClass} flex-1`} />
              <button type="button" onClick={handleCopy} className="shrink-0 rounded-lg border border-brass/40 px-3.5 py-2 text-sm text-brass hover:bg-brass/10">
                {copied ? t('Copied') : t('Copy link')}
              </button>
            </div>
          </Field>
          <button type="button" onClick={handleDownload} className="rounded-lg bg-brass px-4 py-2 text-sm font-medium text-ink hover:opacity-90">
            {t('Download QR code')}
          </button>
        </div>
      </div>
    </Section>
  );
}
