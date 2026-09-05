import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import { getBusiness, updateNotificationSettings } from '../../lib/authApi';
import { uploadBusinessFile } from '../../lib/supabaseClient';
import { SOUND_PRESETS, playPresetSound } from '../../lib/soundPlayer';
import type { AdminBusiness, NotificationEvent, NotificationSetting } from '../../types';
import { Section } from '../../components/ui';

const EVENT_META: Record<NotificationEvent, { label: string; description: string }> = {
  callWaiter: { label: 'Call Waiter', description: 'A customer taps to request a staff member.' },
  requestBill: { label: 'Request Bill', description: 'A customer taps to ask for the bill.' },
  newOrder: { label: 'New Order', description: 'A customer submits a food/drink order.' },
  newBooking: { label: 'New Booking', description: 'A customer requests an appointment.' },
  paymentConfirmed: { label: 'Payment Confirmed', description: 'A bill payment goes through successfully.' },
};

export default function NotificationsPage() {
  const { user } = useSession();
  const { t } = useT();
  const businessId = user?.business_id;
  const [business, setBusiness] = useState<AdminBusiness | null>(null);

  function reload() {
    if (businessId) getBusiness(businessId).then(setBusiness).catch(() => {});
  }
  useEffect(reload, [businessId]);

  if (!business || !businessId) return <p className="text-ivory-dim">Loading...</p>;

  return (
    <div className="space-y-4">
      <p className="text-base text-ivory-dim">
        {t('Each alert is fully independent — turn any of them off, pick a preset, or upload your own sound.')}
      </p>
      {(Object.keys(EVENT_META) as NotificationEvent[]).map((event) => (
        <NotificationEventCard
          key={event}
          businessId={businessId}
          event={event}
          setting={business.notification_settings[event]}
          onOptimisticUpdate={(update) =>
            setBusiness((prev) =>
              prev ? { ...prev, notification_settings: { ...prev.notification_settings, [event]: { ...prev.notification_settings[event], ...update } } } : prev
            )
          }
          onChange={reload}
        />
      ))}
    </div>
  );
}

function NotificationEventCard({ businessId, event, setting, onOptimisticUpdate, onChange }: {
  businessId: string; event: NotificationEvent; setting: NotificationSetting; onOptimisticUpdate: (update: Partial<NotificationSetting>) => void; onChange: () => void;
}) {
  const { t } = useT();
  const meta = EVENT_META[event];
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function patch(update: Partial<NotificationSetting>) {
    onOptimisticUpdate(update);
    updateNotificationSettings(businessId, { [event]: update }).catch(onChange);
  }

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    try {
      const url = await uploadBusinessFile(businessId, file, `sounds/${event}`);
      onOptimisticUpdate({ sound: 'custom', customUrl: url });
      await updateNotificationSettings(businessId, { [event]: { sound: 'custom', customUrl: url } });
    } catch {
      onChange();
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <Section title={t(meta.label)}>
      <p className="text-base text-ivory-dim">{t(meta.description)}</p>

      <div className="flex items-center justify-between">
        <span className="text-base text-ivory-dim">{t('Sound')}</span>
        <button type="button"
          onClick={() => patch({ enabled: !setting.enabled })}
          disabled={saving}
          className={`rounded-lg border px-5 py-4 text-base disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${
            setting.enabled ? 'border-brass text-brass' : 'border-ink-line text-ivory-dim'
          }`}
        >
          {setting.enabled ? t('On') : t('Off')}
        </button>
      </div>

      {setting.enabled && (
        <div className="space-y-2 rounded-2xl border border-ink-line p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={setting.sound === 'custom' ? 'custom' : setting.sound}
              onChange={(e) => patch({ sound: e.target.value })}
              disabled={saving}
              className="min-w-0 flex-1 rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
            >
              {SOUND_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              {setting.customUrl && <option value="custom">{t('Custom upload')}</option>}
            </select>
            {setting.sound !== 'custom' && (
              <button type="button"
                onClick={() => playPresetSound(setting.sound)}
                className="shrink-0 rounded-lg border border-ink-line px-3 py-2 text-base text-ivory-dim hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
              >
                ▶ {t('Preview')}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
              className="rounded-lg border border-brass/40 px-5 py-4 text-base text-brass hover:bg-brass/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
            >
              {t('Upload custom sound')}
            </button>
            <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleUpload} className="hidden" />
            {setting.customUrl && (
              <button type="button"
                onClick={() => patch({ sound: 'default', customUrl: '' })}
                className="text-base text-danger hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
              >
                {t('Remove custom sound')}
              </button>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}
