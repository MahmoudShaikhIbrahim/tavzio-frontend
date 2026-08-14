import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';
import { getBusiness, updateBusinessFeatures, getPaymentStatus } from '../../lib/authApi';
import type { AdminBusiness } from '../../types';
import { Section, ToggleRow } from '../../components/ui';

export default function FeaturesPage() {
  const { user } = useSession();
  const businessId = user?.business_id;
  const [business, setBusiness] = useState<AdminBusiness | null>(null);
  const [paymentConnected, setPaymentConnected] = useState(false);
  // The real fix for the nav-visibility problem the old reload was
  // covering for: DashboardLayout now exposes a way to refresh its own
  // copy of features directly, through the same Outlet context every
  // nested dashboard page already renders inside. No full page reload
  // needed - the nav just refetches itself the moment a toggle saves.
  const { refetchFeatures } = useOutletContext<{ refetchFeatures: () => void }>();

  function reload() {
    if (businessId) getBusiness(businessId).then(setBusiness);
  }
  useEffect(reload, [businessId]);
  useEffect(() => {
    if (businessId) getPaymentStatus(businessId).then((s) => setPaymentConnected(!!s?.enabled));
  }, [businessId]);

  if (!business || !businessId) return <p className="text-ivory-dim">Loading...</p>;

  function patch(body: Record<string, unknown>) {
    updateBusinessFeatures(businessId!, body)
      .then(() => {
        reload();
        refetchFeatures();
      })
      .catch(() => reload());
  }

  const { ordering, booking } = business.features;

  return (
    <div className="space-y-10">
      <Section title="Ordering">
        <p className="mb-3 text-sm text-ivory-dim">
          Call a Waiter, Request the Bill, and any other guest-notification button now live under
          Landing Page Buttons, alongside your other buttons - not here anymore.
        </p>
        <div className="space-y-2">
          <ToggleRow label="Menu view" description="Customers can browse the menu after tapping."
            checked={ordering.menuView} onChange={(v) => patch({ ordering: { menuView: v } })} />
          <ToggleRow label="Order submission" description="Customers can actually place an order — Tavzio's own order screen always works, no POS needed."
            checked={ordering.submission} onChange={(v) => patch({ ordering: { submission: v } })} />
          <ToggleRow label="POS integration" description="Push orders into a connected POS, on top of Tavzio's own screen. Set up by the platform operator."
            checked={ordering.posIntegration} onChange={(v) => patch({ ordering: { posIntegration: v } })} />
          <ToggleRow
            label="Pay before order"
            description={
              paymentConnected
                ? 'Customers pay (card or cash) the moment they hit "Send order" - it only reaches the kitchen once payment is confirmed.'
                : 'Connect a payment provider in Pay Bill Setup first - this needs somewhere to actually charge the card.'
            }
            checked={ordering.payBeforeOrder}
            onChange={(v) => patch({ ordering: { payBeforeOrder: v } })}
            disabled={!ordering.submission || !paymentConnected}
          />
        </div>
      </Section>

      <Section title="Booking">
        <div className="space-y-2">
          <ToggleRow label="Booking page" description="Customers can browse services after tapping."
            checked={booking.menuView} onChange={(v) => patch({ booking: { menuView: v } })} />
          <ToggleRow label="Booking submission" description="Customers can request an appointment — you confirm or decline."
            checked={booking.submission} onChange={(v) => patch({ booking: { submission: v } })} />
          <ToggleRow label="Booking integration" description="Push bookings into a connected system. Set up by the platform operator."
            checked={booking.integration} onChange={(v) => patch({ booking: { integration: v } })} />
        </div>
      </Section>

      <Section title="Other">
        <div className="space-y-2">
          <ToggleRow label="Loyalty program" checked={business.features.loyalty}
            onChange={(v) => patch({ loyalty: v })} />
          <ToggleRow label="Staff accounts" description="Turn off if this business never needs a second account."
            checked={business.features.staffAccounts} onChange={(v) => patch({ staffAccounts: v })} />
        </div>
      </Section>

      <Section title="Inventory">
        <div className="space-y-2">
          <ToggleRow label="Ingredient-level inventory" description="Track real stock per ingredient via menu-item recipes, not just per-dish counts."
            checked={business.features.inventory?.enabled || false} onChange={(v) => patch({ inventory: { enabled: v } })} />
          <ToggleRow label="Block orders on insufficient stock" description="If off, orders are still tracked but never blocked for low stock."
            checked={business.features.inventory?.blockOrdersOnLowStock ?? true}
            onChange={(v) => patch({ inventory: { blockOrdersOnLowStock: v } })}
            disabled={!business.features.inventory?.enabled} />
        </div>
      </Section>

      <Section title="HR">
        <p className="mb-3 text-sm text-ivory-dim">
          Owner-only, always — staff accounts never see any of this, regardless of what sections they're assigned to.
          Each piece below is independent; turn on only what your business actually uses.
        </p>
        <div className="space-y-2">
          <ToggleRow label="Enable HR" description="Master switch - turns on the HR section in your dashboard. Off by default."
            checked={business.features.hr?.enabled || false} onChange={(v) => patch({ hr: { enabled: v } })} />
          <ToggleRow label="Staff documents" description="Store each staff member's ID, visa, labor card, or signed contract."
            checked={business.features.hr?.documents || false} onChange={(v) => patch({ hr: { documents: v } })}
            disabled={!business.features.hr?.enabled} />
          <ToggleRow label="Commission tracking" description="Set a commission rate per staff member and see it calculated from their actual sales."
            checked={business.features.hr?.commission || false} onChange={(v) => patch({ hr: { commission: v } })}
            disabled={!business.features.hr?.enabled} />
          <ToggleRow label="Tip pooling" description="Split collected tips across staff, evenly or by hours worked."
            checked={business.features.hr?.tips || false} onChange={(v) => patch({ hr: { tips: v } })}
            disabled={!business.features.hr?.enabled} />
        </div>
      </Section>
    </div>
  );
}
