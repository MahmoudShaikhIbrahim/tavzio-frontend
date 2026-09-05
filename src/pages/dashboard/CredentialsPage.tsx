import { useState, useEffect, type ReactNode } from 'react';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import { getBusiness } from '../../lib/authApi';
import PayBillSetupPage from './PayBillSetupPage';
import PrinterSetupPage from './PrinterSetupPage';
import DeliveryIntegrationPage from './DeliveryIntegrationPage';
import PosIntegrationPage from './PosIntegrationPage';
import ExternalHotelSystemsPage from './ExternalHotelSystemsPage';
import AccountingSyncPage from './AccountingSyncPage';

// Everything that needs a credential/API key/account connection, for any
// business type, lives on this one page in premium-separated tabs -
// instead of an owner hopping between four different settings pages to
// get their integrations live. Each tab reuses the exact same page
// component that used to stand alone, so nothing about how any one
// integration works has changed, only where it lives.
export default function CredentialsPage() {
  const { t } = useT();
  const [tab, setTab] = useState<'payments' | 'printer' | 'delivery' | 'pos-integration' | 'hotel-systems' | 'accounting'>('payments');
  const isHotel = useIsHotel();

  const tabs: { key: typeof tab; label: string }[] = [
    { key: 'payments', label: t('Payment Gateway') },
    { key: 'printer', label: t('Receipt Printer') },
    ...(isHotel ? [] : [{ key: 'delivery' as const, label: t('Delivery Platforms') }]),
    { key: 'pos-integration', label: t('POS Integration') },
    ...(isHotel ? [{ key: 'hotel-systems' as const, label: t('External Hotel Systems') }] : []),
    { key: 'accounting', label: t('Accounting Sync') },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ivory">{t('Credentials & Integrations')}</h1>
        <p className="mt-1 text-base text-ivory-dim">
          {t('Every API key, account connection, and gateway credential your business needs, in one place.')}
        </p>
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 sm:flex-wrap" style={{ scrollbarWidth: 'thin' }}>
        {tabs.map((tabItem) => (
          <TabButton key={tabItem.key} active={tab === tabItem.key} onClick={() => setTab(tabItem.key)}>{tabItem.label}</TabButton>
        ))}
      </div>
      <div>
        {tab === 'payments' && <PayBillSetupPage />}
        {tab === 'printer' && <PrinterSetupPage />}
        {tab === 'delivery' && !isHotel && <DeliveryIntegrationPage />}
        {tab === 'pos-integration' && <PosIntegrationPage />}
        {tab === 'hotel-systems' && isHotel && <ExternalHotelSystemsPage />}
        {tab === 'accounting' && <AccountingSyncPage />}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${active ? 'bg-brass text-ink' : 'border border-ink-line text-ivory-dim hover:border-brass/40 hover:text-ivory'}`}
    >
      {children}
    </button>
  );
}

// Lightweight local hook - business category isn't on the session user,
// so this mirrors the same getBusiness call DashboardLayout already
// makes, just scoped to this page instead of threading a prop through.
function useIsHotel() {
  const { user } = useSession();
  const [isHotel, setIsHotel] = useState(false);
  useEffect(() => {
    if (user?.business_id) {
      getBusiness(user.business_id).then((b) => setIsHotel(b.category === 'hotel')).catch(() => {});
    }
  }, [user?.business_id]);
  return isHotel;
}
