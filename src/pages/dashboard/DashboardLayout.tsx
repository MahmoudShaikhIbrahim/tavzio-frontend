import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';
import { getBusiness, updateMyTheme } from '../../lib/authApi';
import type { BusinessFeatures } from '../../types';
import ThemeToggle from '../../components/ThemeToggle';
import { useTheme } from '../../lib/ThemeContext';

const TABS = [
  { path: 'orders', label: 'Orders', ownerOnly: false, requires: 'ordering' as const },
  { path: 'requests', label: 'Requests', ownerOnly: false, requires: 'ordering' as const },
  { path: 'bookings', label: 'Bookings', ownerOnly: false, requires: 'booking' as const },
  { path: 'services', label: 'Services', ownerOnly: false, requires: 'booking' as const },
  { path: 'payments', label: 'Payments', ownerOnly: false, requires: null },
  { path: 'audit-log', label: 'Audit Log', ownerOnly: false, requires: null },
  { path: 'analytics', label: 'Analytics', ownerOnly: false, requires: null },
  { path: 'features', label: 'Features', ownerOnly: false, requires: null }, // self-service toggles - never gated by its own flag
  { path: 'staff', label: 'Staff', ownerOnly: true, requires: 'staffAccounts' as const },
  { path: 'settings', label: 'Settings', ownerOnly: false, requires: null }, // Menu, Loyalty, Cards, Notifications, and Landing Page Buttons all live here now - business info specifically stays owner-only, enforced inside the page itself
  { path: 'messages', label: 'Contact Us', ownerOnly: false, requires: null },
];

export default function DashboardLayout() {
  const { user, logout } = useSession();
  const location = useLocation();
  const isOwner = user?.role === 'business_owner';
  const [features, setFeatures] = useState<BusinessFeatures | null>(null);
  const { setMode } = useTheme();

  // The account's own saved theme takes over the moment it loads - this
  // is what actually makes it "belong to the account" rather than the
  // browser: if a different person logs in on this same device, their
  // own preference now correctly overrides whatever was here before.
  useEffect(() => {
    if (user?.theme_preference) setMode(user.theme_preference);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.theme_preference]);

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
    if (requires === 'staffAccounts') return features.staffAccounts;
    return true;
  }

  const visibleTabs = TABS.filter((t) => (!t.ownerOnly || isOwner) && tabAllowed(t.requires));

  return (
    <div className="min-h-screen bg-ink">
      <header className="border-b border-ink-line">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <span className="font-mono text-[11px] uppercase tracking-wider text-brass">Tavzio</span>
          <div className="flex items-center gap-4 text-base text-ivory-dim">
            <ThemeToggle onChange={(mode) => updateMyTheme(mode).catch(() => {})} />
            <span>{user?.name} · {isOwner ? 'Owner' : 'Staff'}</span>
            <button onClick={logout} className="hover:text-ivory">Sign out</button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-5">
          {visibleTabs.map((t) => (
            <Link
              key={t.path}
              to={`/admin/dashboard/${t.path}`}
              className={`shrink-0 border-b-2 px-3 py-2.5 text-base ${
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
      <main className="mx-auto max-w-7xl px-5 py-8">
        <Outlet />
      </main>
    </div>
  );
}
