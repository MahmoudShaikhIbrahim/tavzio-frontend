import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import { getBusiness, updateBusinessFeatures, getPaymentStatus } from '../../lib/authApi';
import type { AdminBusiness } from '../../types';
import { Section, ToggleRow } from '../../components/ui';

export default function FeaturesPage() {
  const { user } = useSession();
  const { t } = useT();
  const businessId = user?.business_id;
  const [business, setBusiness] = useState<AdminBusiness | null>(null);
  const [paymentConnected, setPaymentConnected] = useState(false);
  const [tab, setTab] = useState<'ordering' | 'booking' | 'other' | 'inventory' | 'hr' | 'forecasting'>('ordering');
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
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-ivory">{t('Features')}</h1>
      <div className="flex flex-wrap gap-2 border-b border-ink-line">
        {(['ordering', 'booking', 'other', 'inventory', 'hr', 'forecasting'] as const).map((tabKey) => {
          const label = tabKey === 'hr' ? 'HR'
            : tabKey === 'forecasting' ? 'Forecasting & Budgeting'
            : tabKey === 'ordering' ? 'Ordering'
            : tabKey === 'booking' ? 'Booking'
            : tabKey === 'inventory' ? 'Inventory'
            : 'Other';
          return (
            <button type="button" key={tabKey} onClick={() => setTab(tabKey)} className={`px-2.5 py-1.5 text-sm sm:px-4 sm:py-2 sm:text-base ${tab === tabKey ? 'border-b-2 border-brass text-brass' : 'text-ivory-dim hover:text-ivory'}`}>
              {t(label)}
            </button>
          );
        })}
      </div>

      {tab === 'ordering' && (
        <Section title={t('Ordering')}>
          <p className="mb-3 text-sm text-ivory-dim">
            {t('Call a Waiter, Request the Bill, and any other guest-notification button now live under Landing Page Buttons, alongside your other buttons - not here anymore.')}
          </p>
          <div className="space-y-2">
            <ToggleRow label={t('Menu view')} description={t('Customers can browse the menu after tapping.')}
              checked={ordering.menuView} onChange={(v) => patch({ ordering: { menuView: v } })} />
            <ToggleRow label={t('Order submission')} description={t("Customers can actually place an order — Tavzio's own order screen always works, no POS needed.")}
              checked={ordering.submission} onChange={(v) => patch({ ordering: { submission: v } })} />
            <ToggleRow label={t('POS integration')} description={t("Push orders into a connected POS, on top of Tavzio's own screen. Set up by the platform operator.")}
              checked={ordering.posIntegration} onChange={(v) => patch({ ordering: { posIntegration: v } })} />
            <ToggleRow
              label={t('Pay before order')}
              description={
                paymentConnected
                  ? t('Customers pay (card or cash) the moment they hit "Send order" - it only reaches the kitchen once payment is confirmed.')
                  : t('Connect a payment provider in Pay Bill Setup first - this needs somewhere to actually charge the card.')
              }
              checked={ordering.payBeforeOrder}
              onChange={(v) => patch({ ordering: { payBeforeOrder: v } })}
              disabled={!ordering.submission || !paymentConnected}
            />
          </div>
        </Section>
      )}

      {tab === 'booking' && (
        <Section title={t('Booking')}>
          <div className="space-y-2">
            <ToggleRow label={t('Booking page')} description={t('Customers can browse services after tapping.')}
              checked={booking.menuView} onChange={(v) => patch({ booking: { menuView: v } })} />
            <ToggleRow label={t('Booking submission')} description={t('Customers can request an appointment — you confirm or decline.')}
              checked={booking.submission} onChange={(v) => patch({ booking: { submission: v } })} />
            <ToggleRow label={t('Booking integration')} description={t('Push bookings into a connected system. Set up by the platform operator.')}
              checked={booking.integration} onChange={(v) => patch({ booking: { integration: v } })} />
          </div>
        </Section>
      )}

      {tab === 'other' && (
        <Section title={t('Other')}>
          <div className="space-y-2">
            <ToggleRow label={t('Loyalty program')} checked={business.features.loyalty}
              onChange={(v) => patch({ loyalty: v })} />
            <ToggleRow label={t('Staff accounts')} description={t('Turn off if this business never needs a second account.')}
              checked={business.features.staffAccounts} onChange={(v) => patch({ staffAccounts: v })} />
          </div>
        </Section>
      )}

      {tab === 'inventory' && (
        <Section title={t('Inventory')}>
          <div className="space-y-2">
            <ToggleRow label={t('Ingredient-level inventory')} description={t('Track real stock per ingredient via menu-item recipes, not just per-dish counts.')}
              checked={business.features.inventory?.enabled || false} onChange={(v) => patch({ inventory: { enabled: v } })} />
            <ToggleRow label={t('Block orders on insufficient stock')} description={t('If off, orders are still tracked but never blocked for low stock.')}
              checked={business.features.inventory?.blockOrdersOnLowStock ?? true}
              onChange={(v) => patch({ inventory: { blockOrdersOnLowStock: v } })}
              disabled={!business.features.inventory?.enabled} />
          </div>
        </Section>
      )}

      {tab === 'hr' && (
        <Section title={t('HR')}>
          <p className="mb-3 text-sm text-ivory-dim">
            {t("Owner-only, always — staff accounts never see any of this, regardless of what sections they're assigned to. Each piece below is independent; turn on only what your business actually uses.")}
          </p>
          <div className="space-y-2">
            <ToggleRow label={t('Enable HR')} description={t('Master switch - turns on the HR section in your dashboard. Off by default.')}
              checked={business.features.hr?.enabled || false} onChange={(v) => patch({ hr: { enabled: v } })} />
            <ToggleRow label={t('Staff documents')} description={t("Store each staff member's ID, visa, labor card, or signed contract.")}
              checked={business.features.hr?.documents || false} onChange={(v) => patch({ hr: { documents: v } })}
              disabled={!business.features.hr?.enabled} />
            <ToggleRow label={t('Commission tracking')} description={t('Set a commission rate per staff member and see it calculated from their actual sales.')}
              checked={business.features.hr?.commission || false} onChange={(v) => patch({ hr: { commission: v } })}
              disabled={!business.features.hr?.enabled} />
            <ToggleRow label={t('Tip pooling')} description={t('Split collected tips across staff, evenly or by hours worked.')}
              checked={business.features.hr?.tips || false} onChange={(v) => patch({ hr: { tips: v } })}
              disabled={!business.features.hr?.enabled} />
            <ToggleRow label={t('Staff scheduling')} description={t('Build a roster of upcoming shifts per staff member, with a forecasted labor cost.')}
              checked={business.features.hr?.scheduling || false} onChange={(v) => patch({ hr: { scheduling: v } })}
              disabled={!business.features.hr?.enabled} />
            <ToggleRow label={t('Labor cost tracking')} description={t('Set an hourly rate per staff member and see real labor cost against revenue, from actual clocked hours.')}
              checked={business.features.hr?.laborCost || false} onChange={(v) => patch({ hr: { laborCost: v } })}
              disabled={!business.features.hr?.enabled} />
          </div>
        </Section>
      )}

      {tab === 'forecasting' && (
        <Section title={t('Forecasting & Budgeting')}>
          <p className="mb-3 text-sm text-ivory-dim">
            {t('Owner-only. A day-of-week sales forecast built from your own order history, plus monthly budget targets you set yourself, compared against real revenue, food cost, and labor cost as the month happens.')}
          </p>
          <ToggleRow label={t('Enable Forecasting & Budgeting')} description={t('Turns on the Forecasting & Budgeting section in your dashboard. Off by default.')}
            checked={business.features.forecasting?.enabled || false} onChange={(v) => patch({ forecasting: { enabled: v } })} />
        </Section>
      )}
    </div>
  );
}
