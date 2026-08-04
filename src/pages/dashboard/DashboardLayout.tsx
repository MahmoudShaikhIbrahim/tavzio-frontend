import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';
import { getBusiness, updateMyTheme, getNotificationCounts, markSectionViewed, type NotificationCounts } from '../../lib/authApi';
import type { BusinessFeatures } from '../../types';
import ThemeToggle from '../../components/ThemeToggle';
import { useTheme } from '../../lib/ThemeContext';

const TABS = [
  { path: 'orders', label: 'Orders', ownerOnly: false, requires: 'ordering' as const, badge: 'orders' as const, badge2: 'requests' as const },
  { path: 'kitchen', label: 'Kitchen', ownerOnly: false, requires: 'ordering' as const, badge: null, badge2: null },
  { path: 'bookings', label: 'Bookings', ownerOnly: false, requires: 'booking' as const, badge: null, badge2: null },
  { path: 'services', label: 'Services', ownerOnly: false, requires: 'booking' as const, badge: null, badge2: null },
  { path: 'payments', label: 'Payments', ownerOnly: false, requires: null, badge: 'payments' as const, badge2: null },
  { path: 'audit-log', label: 'Audit Log', ownerOnly: false, requires: null, badge: null, badge2: null },
  { path: 'analytics', label: 'Analytics', ownerOnly: false, requires: null, badge: null, badge2: null },
  { path: 'features', label: 'Features', ownerOnly: false, requires: null, badge: null, badge2: null }, // self-service toggles - never gated by its own flag
  { path: 'staff', label: 'Staff', ownerOnly: true, requires: 'staffAccounts' as const, badge: null, badge2: null },
  { path: 'settings', label: 'Settings', ownerOnly: false, requires: null, badge: null, badge2: null }, // Menu, Loyalty, Cards, Notifications, and Landing Page Buttons all live here now - business info specifically stays owner-only, enforced inside the page itself
  { path: 'receipts', label: 'Receipts', ownerOnly: false, requires: null, badge: null, badge2: null },
  { path: 'messages', label: 'Contact Us', ownerOnly: false, requires: null, badge: null, badge2: null },
];

export default function DashboardLayout() {
  const { user, logout } = useSession();
  const location = useLocation();
  const isOwner = user?.role === 'business_owner';
  const [features, setFeatures] = useState<BusinessFeatures | null>(null);
  const [counts, setCounts] = useState<NotificationCounts>({ orders: 0, requests: 0, payments: 0 });
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

  // Polling rather than realtime here deliberately - this is a red dot
  // on a tab, not something that needs to update mid-glance. A 15s
  // refresh is plenty responsive for "should I go check that tab" while
  // being far simpler than wiring up three more realtime subscriptions
  // on top of the ones already running on the actual pages.
  // Single source of truth for "clear the badge for whatever tab I just
  // opened" - determines the section from the URL, marks it viewed
  // server-side, THEN refreshes counts, in that guaranteed order. This
  // used to be split across each page (marking viewed) and this layout
  // (reading counts) as two independent effects with no ordering between
  // them - occasionally the count would refresh a moment before the
  // mark-viewed call finished, showing a stale badge that then never
  // updated again until the next poll or navigation.
  useEffect(() => {
    const bizId = user?.business_id;
    if (!bizId) return;
    const tab = TABS.find((t) => (t.badge || t.badge2) && location.pathname.includes(t.path));
    const sections = [tab?.badge, tab?.badge2].filter((s): s is 'orders' | 'requests' | 'payments' => !!s);
    Promise.all(sections.map((s) => markSectionViewed(bizId, s)))
      .catch(() => {})
      .finally(() => {
        getNotificationCounts(bizId).then(setCounts).catch(() => {});
      });
  }, [location.pathname, user?.business_id]);

  useEffect(() => {
    if (!user?.business_id) return;
    function refresh() {
      if (user?.business_id) getNotificationCounts(user.business_id).then(setCounts).catch(() => {});
    }
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
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
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-mono text-[11px] uppercase tracking-wider text-brass">Tavzio</span>
          <div className="flex flex-wrap items-center gap-4 text-base text-ivory-dim">
            <ThemeToggle onChange={(mode) => updateMyTheme(mode).catch(() => {})} />
            <span>{user?.name} · {isOwner ? 'Owner' : 'Staff'}</span>
            <button onClick={logout} className="hover:text-ivory">Sign out</button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1.5 overflow-x-auto px-6 pt-1.5">
          {visibleTabs.map((t) => {
            const count = (t.badge ? counts[t.badge] : 0) + (t.badge2 ? counts[t.badge2] : 0);
            return (
              <Link
                key={t.path}
                to={`/admin/dashboard/${t.path}`}
                className={`relative shrink-0 border-b-2 px-3 py-2.5 text-base ${
                  location.pathname.includes(t.path)
                    ? 'border-brass text-ivory'
                    : 'border-transparent text-ivory-dim hover:text-ivory'
                }`}
              >
                {t.label}
                {count > 0 && (
                  <span className="absolute top-0 end-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-medium text-ivory">
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-8 sm:py-14">
        <Outlet />
      </main>
    </div>
  );
}
