import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';
import { getBusiness, updateMyTheme, getNotificationCounts, markSectionViewed, type NotificationCounts } from '../../lib/authApi';
import type { BusinessFeatures } from '../../types';
import ThemeToggle from '../../components/ThemeToggle';
import { useTheme } from '../../lib/ThemeContext';

// Only what's actually checked constantly through a shift stays
// top-level - everything else, however often it's used, lives in the
// Settings dropdown below instead of competing for space in this bar.
const TABS = [
  { path: 'orders', label: 'Orders', ownerOnly: false, requires: 'ordering' as const, badge: 'orders' as const, badge2: 'requests' as const },
  { path: 'kitchen', label: 'Kitchen', ownerOnly: false, requires: 'ordering' as const, badge: null, badge2: null },
  { path: 'payments', label: 'Payments', ownerOnly: false, requires: null, badge: 'payments' as const, badge2: null },
];

// Everything that used to be its own tab, or lived buried inside the old
// monolithic Settings page, now surfaces here instead - grouped roughly
// by how closely related each thing is, not alphabetically.
const SETTINGS_ITEMS = [
  { path: 'settings/business-profile', label: 'Business Profile', ownerOnly: true, requires: null },
  { path: 'settings/pay-bill', label: 'Pay Bill Setup', ownerOnly: true, requires: null },
  { path: 'settings/landing-buttons', label: 'Landing Page Buttons', ownerOnly: true, requires: null },
  { path: 'settings/menu', label: 'Menu Management', ownerOnly: false, requires: null },
  { path: 'settings/loyalty', label: 'Loyalty', ownerOnly: false, requires: null },
  { path: 'settings/cards', label: 'Cards', ownerOnly: false, requires: null },
  { path: 'settings/notifications', label: 'Notifications', ownerOnly: false, requires: null },
  { path: 'bookings', label: 'Bookings', ownerOnly: false, requires: 'booking' as const },
  { path: 'services', label: 'Services', ownerOnly: false, requires: 'booking' as const },
  { path: 'features', label: 'Features', ownerOnly: false, requires: null },
  { path: 'audit-log', label: 'Audit Log', ownerOnly: false, requires: null },
  { path: 'analytics', label: 'Analytics', ownerOnly: false, requires: null },
  { path: 'staff', label: 'Staff', ownerOnly: true, requires: 'staffAccounts' as const },
  { path: 'receipts', label: 'Receipts', ownerOnly: false, requires: null },
  { path: 'messages', label: 'Contact Us', ownerOnly: false, requires: null },
];

export default function DashboardLayout() {
  const { user, logout } = useSession();
  const location = useLocation();
  const isOwner = user?.role === 'business_owner';
  const [features, setFeatures] = useState<BusinessFeatures | null>(null);
  const [counts, setCounts] = useState<NotificationCounts>({ orders: 0, requests: 0, payments: 0 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
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

  // Closes the dropdown on an outside click, same expectation any real
  // dropdown menu carries - without this it would only ever close by
  // picking an item, which feels broken the first time you tap away.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function tabAllowed(requires: 'ordering' | 'booking' | 'staffAccounts' | null) {
    if (!requires || !features) return !requires;
    if (requires === 'ordering') return features.ordering.menuView || features.ordering.submission;
    if (requires === 'booking') return features.booking.menuView || features.booking.submission;
    if (requires === 'staffAccounts') return features.staffAccounts;
    return true;
  }

  const visibleTabs = TABS.filter((t) => (!t.ownerOnly || isOwner) && tabAllowed(t.requires));
  const visibleSettingsItems = SETTINGS_ITEMS.filter((t) => (!t.ownerOnly || isOwner) && tabAllowed(t.requires));
  const isSettingsActive = visibleSettingsItems.some((t) => location.pathname.includes(t.path)) || location.pathname.includes('/settings');

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
        <nav className="mx-auto flex max-w-7xl items-center gap-1.5 px-6 pt-1.5">
          <div className="flex flex-1 items-center gap-1.5 overflow-x-auto">
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
          </div>

          <div ref={settingsRef} className="relative shrink-0">
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-base ${
                isSettingsActive ? 'border-brass text-ivory' : 'border-transparent text-ivory-dim hover:text-ivory'
              }`}
            >
              Settings
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className={`transition-transform ${settingsOpen ? 'rotate-180' : ''}`}>
                <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {settingsOpen && (
              <div className="absolute end-0 top-full z-30 mt-2 w-[26rem] max-w-[90vw] overflow-hidden rounded-xl border border-brass/30 bg-ink-soft shadow-2xl shadow-black/50">
                <div className="grid max-h-[70vh] grid-cols-2 gap-x-1 gap-y-0.5 overflow-y-auto p-2">
                  {visibleSettingsItems.map((t) => (
                    <Link
                      key={t.path}
                      to={`/admin/dashboard/${t.path}`}
                      onClick={() => setSettingsOpen(false)}
                      className={`rounded-lg px-3 py-2.5 text-base transition-colors ${
                        location.pathname.includes(t.path)
                          ? 'bg-brass/10 text-brass'
                          : 'text-ivory-dim hover:bg-ink hover:text-ivory'
                      }`}
                    >
                      {t.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-8 sm:py-14">
        <Outlet />
      </main>
    </div>
  );
}
