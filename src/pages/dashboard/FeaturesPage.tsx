import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession';
import { getBusiness, updateBusinessFeatures } from '../../lib/authApi';
import type { AdminBusiness } from '../../types';
import { Section, ToggleRow } from '../../components/ui';

export default function FeaturesPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [business, setBusiness] = useState<AdminBusiness | null>(null);
  const [saving, setSaving] = useState(false);

  function reload() {
    if (businessId) getBusiness(businessId).then(setBusiness);
  }
  useEffect(reload, [businessId]);

  if (!business || !businessId) return <p className="text-ivory-dim">Loading...</p>;

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    await updateBusinessFeatures(businessId!, body);
    setSaving(false);
    reload();
  }

  const { ordering, booking } = business.features;

  return (
    <div className="space-y-6">
      <Section title="Ordering">
        <div className="space-y-2">
          <ToggleRow label="Menu view" description="Customers can browse the menu after tapping."
            checked={ordering.menuView} onChange={(v) => patch({ ordering: { menuView: v } })} disabled={saving} />
          <ToggleRow label="Order submission" description="Customers can actually place an order — Tavzio's own order screen always works, no POS needed."
            checked={ordering.submission} onChange={(v) => patch({ ordering: { submission: v } })} disabled={saving} />
          <ToggleRow label="POS integration" description="Push orders into a connected POS, on top of Tavzio's own screen. Set up by the platform operator."
            checked={ordering.posIntegration} onChange={(v) => patch({ ordering: { posIntegration: v } })} disabled={saving} />
          <ToggleRow label="Call waiter" description="Only useful with order submission or POS integration on."
            checked={ordering.callWaiter} onChange={(v) => patch({ ordering: { callWaiter: v } })} disabled={saving || !ordering.submission} />
          <ToggleRow label="Request bill" description="Only useful with order submission or POS integration on."
            checked={ordering.requestBill} onChange={(v) => patch({ ordering: { requestBill: v } })} disabled={saving || !ordering.submission} />
        </div>
      </Section>

      <Section title="Booking">
        <div className="space-y-2">
          <ToggleRow label="Booking page" description="Customers can browse services after tapping."
            checked={booking.menuView} onChange={(v) => patch({ booking: { menuView: v } })} disabled={saving} />
          <ToggleRow label="Booking submission" description="Customers can request an appointment — you confirm or decline."
            checked={booking.submission} onChange={(v) => patch({ booking: { submission: v } })} disabled={saving} />
          <ToggleRow label="Booking integration" description="Push bookings into a connected system. Set up by the platform operator."
            checked={booking.integration} onChange={(v) => patch({ booking: { integration: v } })} disabled={saving} />
        </div>
      </Section>

      <Section title="Other">
        <div className="space-y-2">
          <ToggleRow label="Loyalty program" checked={business.features.loyalty}
            onChange={(v) => patch({ loyalty: v })} disabled={saving} />
          <ToggleRow label="Staff accounts" description="Turn off if this business never needs a second account."
            checked={business.features.staffAccounts} onChange={(v) => patch({ staffAccounts: v })} disabled={saving} />
        </div>
      </Section>
    </div>
  );
}
