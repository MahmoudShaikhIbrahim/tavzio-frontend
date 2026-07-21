import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useSession } from '../../hooks/useSession';
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
  const businessId = user?.business_id;
  const [business, setBusiness] = useState<AdminBusiness | null>(null);

  function reload() {
    if (businessId) getBusiness(businessId).then(setBusiness);
  }
  useEffect(reload, [businessId]);

  if (!business || !businessId) return <p className="text-ivory-dim">Loading...</p>;

  return (
    <div className="space-y-4">
      <p className="text-base text-ivory-dim">
        Each alert is fully independent — turn any of them off, pick a
        preset, or upload your own sound.
      </p>
      {(Object.keys(EVENT_META) as NotificationEvent[]).map((event) => (
        <NotificationEventCard
          key={event}
          businessId={businessId}
          event={event}
          setting={business.notification_settings[event]}
          onChange={reload}
        />
      ))}
    </div>
  );
}

function NotificationEventCard({ businessId, event, setting, onChange }: {
  businessId: string; event: NotificationEvent; setting: NotificationSetting; onChange: () => void;
}) {
  const meta = EVENT_META[event];
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function patch(update: Partial<NotificationSetting>) {
    setSaving(true);
    await updateNotificationSettings(businessId, { [event]: update });
    setSaving(false);
    onChange();
  }

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    try {
      const url = await uploadBusinessFile(businessId, file, `sounds/${event}`);
      await updateNotificationSettings(businessId, { [event]: { sound: 'custom', customUrl: url } });
      onChange();
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <Section title={meta.label}>
      <p className="text-base text-ivory-dim">{meta.description}</p>

      <div className="flex items-center justify-between">
        <span className="text-base text-ivory-dim">Sound</span>
        <button
          onClick={() => patch({ enabled: !setting.enabled })}
          disabled={saving}
          className={`rounded-lg border px-4 py-3 text-base disabled:opacity-50 ${
            setting.enabled ? 'border-brass text-brass' : 'border-ink-line text-ivory-dim'
          }`}
        >
          {setting.enabled ? 'On' : 'Off'}
        </button>
      </div>

      {setting.enabled && (
        <div className="space-y-2 rounded-lg border border-ink-line p-3">
          <div className="flex items-center gap-2">
            <select
              value={setting.sound === 'custom' ? 'custom' : setting.sound}
              onChange={(e) => patch({ sound: e.target.value })}
              disabled={saving}
              className="flex-1 rounded-lg border border-ink-line bg-ink px-3 py-2 text-base text-ivory"
            >
              {SOUND_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              {setting.customUrl && <option value="custom">Custom upload</option>}
            </select>
            {setting.sound !== 'custom' && (
              <button
                onClick={() => playPresetSound(setting.sound)}
                className="shrink-0 rounded-lg border border-ink-line px-3 py-2 text-base text-ivory-dim hover:text-ivory"
              >
                ▶ Preview
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
              className="rounded-lg border border-brass/40 px-4 py-3 text-base text-brass hover:bg-brass/10 disabled:opacity-50"
            >
              Upload custom sound
            </button>
            <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleUpload} className="hidden" />
            {setting.customUrl && (
              <button
                onClick={() => patch({ sound: 'default', customUrl: '' })}
                className="text-base text-danger hover:underline"
              >
                Remove custom sound
              </button>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}
