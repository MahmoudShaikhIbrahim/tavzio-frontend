import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';
import { getBusiness } from '../../lib/authApi';
import type { BusinessFeatures } from '../../types';

const TABS = [
  { path: 'analytics', label: 'Analytics', ownerOnly: false, requires: null },
  { path: 'orders', label: 'Orders', ownerOnly: false, requires: 'ordering' as const },
  { path: 'menu', label: 'Menu', ownerOnly: false, requires: 'ordering' as const },
  { path: 'bookings', label: 'Bookings', ownerOnly: false, requires: 'booking' as const },
  { path: 'services', label: 'Services', ownerOnly: false, requires: 'booking' as const },
  { path: 'payments', label: 'Payments', ownerOnly: false, requires: null },
  { path: 'loyalty', label: 'Loyalty', ownerOnly: false, requires: 'loyalty' as const },
  { path: 'cards', label: 'Cards', ownerOnly: false, requires: null }, // always available - core safety plumbing, never a toggle
  { path: 'features', label: 'Features', ownerOnly: false, requires: null }, // self-service toggles - never gated by its own flag
  { path: 'notifications', label: 'Notifications', ownerOnly: false, requires: null },
  { path: 'audit-log', label: 'Audit Log', ownerOnly: false, requires: null },
  { path: 'messages', label: 'Contact Us', ownerOnly: false, requires: null },
  { path: 'staff', label: 'Staff', ownerOnly: true, requires: 'staffAccounts' as const },
  { path: 'settings', label: 'Settings', ownerOnly: true, requires: null },
];

export default function DashboardLayout() {
  const { user, logout } = useSession();
  const location = useLocation();
  const isOwner = user?.role === 'business_owner';
  const [features, setFeatures] = useState<BusinessFeatures | null>(null);

  // Every one of these gates is a super_admin-granted entitlement, not
  // something a business turns on itself - so this reads the business
  // record rather than any preference the owner set.
  useEffect(() => {
    if (user?.business_id) {
      getBusiness(user.business_id).then((b) => setFeatures(b.features));
    }
  }, [user?.business_id]);

  function tabAllowed(requires: typeof TABS[number]['requires']) {
    if (!requires || !features) return !requires;
    if (requires === 'ordering') return features.ordering.menuView || features.ordering.submission;
    if (requires === 'booking') return features.booking.menuView || features.booking.submission;
    if (requires === 'loyalty') return features.loyalty;
    if (requires === 'staffAccounts') return features.staffAccounts;
    return true;
  }

  const visibleTabs = TABS.filter((t) => (!t.ownerOnly || isOwner) && tabAllowed(t.requires));

  return (
    <div className="min-h-screen bg-ink">
      <header className="border-b border-ink-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <span className="font-mono text-[11px] uppercase tracking-wider text-brass">Tavzio</span>
          <div className="flex items-center gap-4 text-sm text-ivory-dim">
            <span>{user?.name} · {isOwner ? 'Owner' : 'Staff'}</span>
            <button onClick={logout} className="hover:text-ivory">Sign out</button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-5">
          {visibleTabs.map((t) => (
            <Link
              key={t.path}
              to={`/admin/dashboard/${t.path}`}
              className={`shrink-0 border-b-2 px-3 py-2.5 text-sm ${
                location.pathname.includes(t.path)
                  ? 'border-brass text-ivory'
                  : 'border-transparent text-ivory-dim hover:text-ivory'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8">
        <Outlet />
      </main>
    </div>
  );
}
