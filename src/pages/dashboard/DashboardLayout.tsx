import { useEffect, useRef, useState, type MouseEvent, type TouchEvent } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import { getBusiness, updateMyTheme, getNotificationCounts, markSectionViewed, setMyNavLayout, type NotificationCounts } from '../../lib/authApi';
import { buildBusinessThemeVars } from '../../lib/businessTheme';
import type { BusinessFeatures, BusinessTheme } from '../../types';
import ThemeToggle from '../../components/ThemeToggle';
import Logo from '../../components/Logo';
import ClockWidget from '../../components/ClockWidget';
import AccountSwitcher from '../../components/AccountSwitcher';
import { useTheme } from '../../lib/ThemeContext';
import { DashboardLanguageProvider } from '../../lib/i18n/DashboardLanguageContext';
import { subscribeToBusinessTable, subscribeToOrderItemsForBusiness } from '../../lib/supabaseClient';
import ChangePasswordPage from './ChangePasswordPage';
import GuidedTour, { type TourStep } from '../../components/GuidedTour';
import { updateMyTour } from '../../lib/authApi';

// First real tour content, covering the navigation shell itself (the
// thing everyone touches on every single login, regardless of role or
// which modules their business has enabled). Deeper, page-specific
// tours (e.g. walking through Orders or Payroll in detail) are a
// natural next extension of this same GuidedTour engine, not a
// separate system - just a different steps array passed to the same
// component on whichever page needs it.
const DASHBOARD_TOUR_STEPS: TourStep[] = [
  {
    selector: 'nav-tabs',
    title: 'Your main tabs',
    body: "The tabs you use most live here - which ones you see depends on what's enabled for your business. Double-click or long-press any tab to hide it or move it left/right.",
  },
  {
    selector: 'settings-dropdown',
    title: 'Everything else lives here',
    body: 'Less frequent things - Menu, Staff, Payroll, Accounting, and more - are grouped under Settings so they never crowd your main tabs. Hidden tabs can also be restored from here.',
  },
  {
    selector: 'account-switcher',
    title: 'Switch accounts',
    body: 'Manage more than one business? Switch between them here without signing out.',
  },
  {
    selector: 'theme-toggle',
    title: 'Light or dark',
    body: 'Your theme preference is saved to your account - it follows you to any device you log in from.',
  },
];

// Only what's actually checked constantly through a shift stays
// top-level - everything else, however often it's used, lives in the
// Settings dropdown below instead of competing for space in this bar.
const TABS = [
  { path: 'orders', label: 'Orders', ownerOnly: false, requires: 'ordering' as const, badge: 'orders' as const, badge2: null },
  { path: 'requests', label: 'Requests', ownerOnly: false, requires: 'ordering' as const, badge: 'requests' as const, badge2: null },
  { path: 'kitchen', label: 'Kitchen', ownerOnly: false, requires: 'ordering' as const, badge: 'kitchen' as const, badge2: null },
  { path: 'pos', label: 'POS Terminal', ownerOnly: false, requires: 'ordering' as const, badge: null, badge2: null },
  // Floor plan / table layout is a restaurant-only concept - a hotel with
  // ordering enabled (for its Room Service / outlet POS) still shouldn't
  // see a "Tables" tab, since it has rooms, not tables.
  { path: 'tables', label: 'Tables', ownerOnly: false, requires: 'orderingNotHotel' as const, badge: null, badge2: null },
  { path: 'front-desk', label: 'Front Desk', ownerOnly: false, requires: 'hotel' as const, badge: 'front-desk' as const, badge2: null },
  { path: 'housekeeping', label: 'Housekeeping', ownerOnly: false, requires: 'hotel' as const, badge: 'housekeeping' as const, badge2: null },
  { path: 'sales-events', label: 'Sales & Events', ownerOnly: false, requires: 'hotel' as const, badge: null, badge2: null },
  { path: 'payments', label: 'Payments', ownerOnly: false, requires: null, badge: 'payments' as const, badge2: null },
  { path: 'inventory', label: 'Inventory', ownerOnly: false, requires: 'inventory' as const, badge: null, badge2: null },
  { path: 'reconciliation', label: 'Bank Reconciliation', ownerOnly: true, requires: null, badge: null, badge2: null },
];

// Everything that used to be its own tab, or lived buried inside the old
// monolithic Settings page, now surfaces here instead - grouped roughly
// by how closely related each thing is, not alphabetically.
const SETTINGS_ITEMS = [
  { path: 'settings/business-profile', label: 'Business Profile', ownerOnly: true, requires: null },
  { path: 'settings/credentials', label: 'Credentials & Integrations', ownerOnly: true, requires: null },
  { path: 'settings/delivery', label: 'Delivery Platforms', ownerOnly: true, requires: null },
  { path: 'settings/contract', label: 'Contracts & Receipts', ownerOnly: true, requires: null },
  // Staff-only entry point - owners get this inline inside Business
  // Profile instead (see that page), and Business Profile itself is
  // owner-only, so staff still need a direct way to change their own
  // password. Filtered out for owners below rather than typed as a
  // field on every item, to keep this array's shape uniform.
  { path: 'settings/change-password', label: 'Change Password', ownerOnly: false, requires: null },
  { path: 'settings/hotel-outlets', label: 'F&B Outlets & Services', ownerOnly: true, requires: 'hotel' as const },
  { path: 'settings/rate-plans', label: 'Rate Plans', ownerOnly: true, requires: 'hotel' as const },
  { path: 'settings/night-audit', label: 'Night Audit', ownerOnly: true, requires: 'hotel' as const },
  { path: 'settings/pos-integration', label: 'POS Integration', ownerOnly: true, requires: 'ordering' as const },
  { path: 'settings/hr', label: 'HR', ownerOnly: true, requires: 'hr' as const },
  { path: 'settings/payroll', label: 'Payroll', ownerOnly: true, requires: 'payroll' as const },
  { path: 'settings/accounting', label: 'Accounting', ownerOnly: true, requires: 'accounting' as const },
  { path: 'settings/channel-manager', label: 'Channel Manager', ownerOnly: true, requires: 'channelManager' as const },
  { path: 'settings/marketing', label: 'Marketing', ownerOnly: true, requires: 'marketing' as const },
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
  { path: 'forecasting', label: 'Forecasting & Budgeting', ownerOnly: true, requires: 'forecasting' as const },
  { path: 'staff', label: 'Staff', ownerOnly: true, requires: 'staffAccounts' as const },
  { path: 'messages', label: 'Contact Us', ownerOnly: false, requires: null },
];

export default function DashboardLayout() {
  // The provider has to sit outside the component that actually
  // consumes it via useT() - a component can't read a context it
  // provides in its own render. Everything that used to be the whole
  // export now lives in DashboardLayoutInner below.
  return (
    <DashboardLanguageProvider>
      <DashboardLayoutInner />
    </DashboardLanguageProvider>
  );
}

function DashboardLayoutInner() {
  const { user, logout } = useSession();
  const { t, isRtl } = useT();
  const location = useLocation();
  const isOwner = user?.role === 'business_owner';
  // A staff account granted full_access (see migration 0083) sees and
  // does everything an owner does - this is the one place the frontend
  // nav needs to know that; every actual data access is separately
  // re-enforced server-side (authorize(), current_role_name()), so this
  // flag being wrong here would only ever hide/show a tab, never grant
  // or deny real access to anything behind it.
  const hasOwnerAccess = isOwner || !!user?.full_access;
  const [features, setFeatures] = useState<BusinessFeatures | null>(null);
  const [theme, setTheme] = useState<BusinessTheme | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [counts, setCounts] = useState<NotificationCounts>({ orders: 0, requests: 0, payments: 0, kitchen: 0, housekeeping: 0, 'front-desk': 0 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const { setMode } = useTheme();
  // Local override so a hide/reorder change reflects instantly without
  // waiting on useSession's 20s cache to naturally refresh - synced from
  // the account's real saved layout once it loads, then updated
  // optimistically on every change and persisted via setMyNavLayout.
  const [navLayoutOverride, setNavLayoutOverride] = useState<{ hidden: string[]; order: string[] } | null | undefined>(undefined);
  const [editingPath, setEditingPath] = useState<string | null>(null);

  // Auto-opens once per account, the first time tour_completed_at is
  // genuinely null (never shown, or explicitly reset via "Restart guide"
  // in Business Profile) - never re-triggers just because the profile
  // re-fetches, since that would re-open the tour on every cache expiry.
  const [showTour, setShowTour] = useState(false);
  const [tourAutoShown, setTourAutoShown] = useState(false);
  useEffect(() => {
    if (user && user.tour_completed_at == null && !tourAutoShown) {
      setShowTour(true);
      setTourAutoShown(true);
    }
  }, [user?.id, user?.tour_completed_at, tourAutoShown]);

  function closeTour() {
    setShowTour(false);
    updateMyTour(true).catch(() => {});
  }

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
  function refetchFeatures() {
    if (user?.business_id) {
      getBusiness(user.business_id).then((b) => {
        setFeatures(b.features);
        setTheme(b.theme);
        setCategory(b.category);
      });
    }
  }
  useEffect(() => {
    refetchFeatures();
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
    const sections = [tab?.badge, tab?.badge2].filter((s): s is keyof NotificationCounts => !!s);
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

    // Real-time: every table that feeds a badge count triggers an
    // immediate refresh the moment something changes, rather than
    // waiting up to 15 seconds for the next poll - the poll stays too,
    // as a safety net if a websocket event is ever missed, but it's no
    // longer the only thing keeping these numbers current.
    const bizId = user.business_id;
    const unsubscribers = [
      subscribeToBusinessTable(bizId, 'orders', refresh),
      // order_items has no business_id column of its own - filtering by
      // one (like every other subscription here does) would just never
      // match anything. This uses the RLS-backed, unfiltered version
      // instead, same as the "staff order marked cash-pending" alert
      // elsewhere already does.
      subscribeToOrderItemsForBusiness(refresh),
      subscribeToBusinessTable(bizId, 'loyalty_reward_claims', refresh),
      subscribeToBusinessTable(bizId, 'payments', refresh),
      subscribeToBusinessTable(bizId, 'housekeeping_tasks', refresh),
      subscribeToBusinessTable(bizId, 'maintenance_tickets', refresh),
      subscribeToBusinessTable(bizId, 'guest_service_requests', refresh),
    ];

    return () => {
      clearInterval(interval);
      unsubscribers.forEach((unsub) => unsub());
    };
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

  function tabAllowed(requires: 'ordering' | 'orderingNotHotel' | 'booking' | 'staffAccounts' | 'inventory' | 'hotel' | 'notHotel' | 'hr' | 'forecasting' | 'payroll' | 'accounting' | 'channelManager' | 'marketing' | null) {
    if (requires === 'hotel') return category === 'hotel';
    // Delivery platform integrations (Deliverect etc.) only make sense for
    // restaurants/cafés dispatching food off-site - a hotel has no
    // "delivery" concept in Tavzio, so this hides regardless of features.
    if (requires === 'notHotel') return category !== 'hotel';
    if (requires === 'orderingNotHotel') {
      if (category === 'hotel') return false;
      return !!features && (features.ordering.menuView || features.ordering.submission);
    }
    if (!requires || !features) return !requires;
    if (requires === 'ordering') return features.ordering.menuView || features.ordering.submission;
    if (requires === 'booking') return features.booking.menuView || features.booking.submission;
    if (requires === 'staffAccounts') return features.staffAccounts;
    if (requires === 'inventory') return features.inventory?.enabled;
    if (requires === 'hr') return !!features.hr?.enabled;
    if (requires === 'forecasting') return !!features.forecasting?.enabled;
    if (requires === 'payroll') return !!features.payroll?.enabled;
    if (requires === 'accounting') return !!features.accounting?.enabled;
    // Channel manager is hotel-only, same rule as the 'hotel' branch above -
    // combined with its own feature flag since it's off by default too.
    if (requires === 'channelManager') return category === 'hotel' && !!features.channelManager?.enabled;
    if (requires === 'marketing') return !!features.marketing?.enabled;
    return true;
  }

  // A staff account with an explicit (non-null) assigned_sections list is
  // restricted to exactly those tabs, on top of every other gate above -
  // owners, super_admin, and full_access staff are never restricted this
  // way, and a staff account left at the default (null) sees everything
  // it otherwise would, exactly as before this existed.
  const allowedSections = !hasOwnerAccess && user?.role === 'staff' ? user.assigned_sections : null;
  const baseVisibleTabs = TABS.filter((t) => (!t.ownerOnly || hasOwnerAccess) && tabAllowed(t.requires) && (!allowedSections || allowedSections.includes(t.path)));
  const baseVisibleSettingsItems = SETTINGS_ITEMS
    .filter((t) => (!t.ownerOnly || hasOwnerAccess) && tabAllowed(t.requires))
    .filter((t) => t.path !== 'settings/change-password' || !isOwner);

  // Per-person hide/reorder (see migration 0083's nav_layout) applies on
  // top of every access gate above, never instead of it - a hidden tab
  // is still access-checked first, so restoring it later can never leak
  // something the account was never allowed to see in the first place.
  const navLayout = navLayoutOverride === undefined ? user?.nav_layout ?? null : navLayoutOverride;
  function applyLayout<T extends { path: string }>(items: T[]): T[] {
    if (!navLayout) return items;
    const visible = items.filter((i) => !navLayout.hidden.includes(i.path));
    if (navLayout.order.length === 0) return visible;
    const orderIndex = new Map(navLayout.order.map((p, i) => [p, i]));
    return [...visible].sort((a, b) => {
      const ai = orderIndex.has(a.path) ? orderIndex.get(a.path)! : Infinity;
      const bi = orderIndex.has(b.path) ? orderIndex.get(b.path)! : Infinity;
      return ai - bi;
    });
  }
  const visibleTabs = applyLayout(baseVisibleTabs);
  const visibleSettingsItems = applyLayout(baseVisibleSettingsItems);
  const hiddenTabs = [...baseVisibleTabs, ...baseVisibleSettingsItems].filter((i) => navLayout?.hidden.includes(i.path));
  const isSettingsActive = visibleSettingsItems.some((t) => location.pathname.includes(t.path)) || location.pathname.includes('/settings');

  // Persists via setMyNavLayout (self-service, see staffRoutes.js) and
  // updates the local override immediately rather than waiting on a
  // fresh /me fetch - reverts the override if the save actually fails,
  // so the UI never silently drifts from what's really saved.
  function persistLayout(next: { hidden: string[]; order: string[] }) {
    const previous = navLayout;
    setNavLayoutOverride(next);
    if (user?.business_id && user?.id) {
      setMyNavLayout(user.business_id, user.id, next).catch(() => setNavLayoutOverride(previous));
    }
  }

  // Two independent reorder scopes, not one combined list - the top tab
  // bar and the Settings dropdown grid are two different UI regions, so
  // "move right" swapping a tab out of the bar and into the dropdown (or
  // vice versa) would be a confusing recategorization, not a reorder.
  // Both still persist into the same flat nav_layout.order array; only
  // the swap itself stays scoped.
  function moveItem(scope: typeof visibleTabs | typeof visibleSettingsItems, path: string, direction: -1 | 1) {
    const scopePaths = scope.map((i) => i.path);
    const idx = scopePaths.indexOf(path);
    const swapIdx = idx + direction;
    if (idx === -1 || swapIdx < 0 || swapIdx >= scopePaths.length) return;
    [scopePaths[idx], scopePaths[swapIdx]] = [scopePaths[swapIdx], scopePaths[idx]];
    const otherScope = scope === visibleTabs ? visibleSettingsItems : visibleTabs;
    const fullOrder = scope === visibleTabs ? [...scopePaths, ...otherScope.map((i) => i.path)] : [...otherScope.map((i) => i.path), ...scopePaths];
    persistLayout({ hidden: navLayout?.hidden ?? [], order: fullOrder });
  }

  function hideItem(path: string) {
    const hidden = [...(navLayout?.hidden ?? []), path];
    const order = [...visibleTabs, ...visibleSettingsItems].map((i) => i.path).filter((p) => p !== path);
    persistLayout({ hidden, order });
    setEditingPath(null);
  }

  function restoreItem(path: string) {
    const hidden = (navLayout?.hidden ?? []).filter((p) => p !== path);
    persistLayout({ hidden, order: navLayout?.order ?? [] });
  }

  // Double-click (desktop) and long-press (touch) both enter "move this
  // tab" mode for the tapped item, without hijacking a normal single
  // tap/click's navigation - a genuine double-click/long-press is a
  // distinct browser event from a click, so this never adds a delay to
  // ordinary navigation the way "wait to see if a second tap comes"
  // would.
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  function handleDoubleClick(e: MouseEvent, path: string) {
    e.preventDefault();
    setEditingPath((cur) => (cur === path ? null : path));
  }
  function handleTouchStart(path: string) {
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setEditingPath((cur) => (cur === path ? null : path));
    }, 500);
  }
  function handleTouchEnd(e: TouchEvent) {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (longPressFired.current) e.preventDefault();
  }

  // Closes the "move this tab" controls the moment the route changes -
  // otherwise they'd stay open pointing at whatever tab was being
  // edited even after navigating elsewhere.
  useEffect(() => { setEditingPath(null); }, [location.pathname]);

  // Owner accounts start with a password the super admin set directly
  // and knows - force setting a real one before anything else in the
  // dashboard is reachable. Staff never hits this (they always set
  // their own via the invite-email flow), so this only ever applies to
  // an owner's very first login.
  if (user?.must_change_password) {
    return <ChangePasswordPage forced />;
  }

  return (
    <div
      className="min-h-screen bg-ink"
      dir={isRtl ? 'rtl' : 'ltr'}
      style={buildBusinessThemeVars(theme?.dashboardBackground, theme?.dashboardButton)}
    >
      {showTour && <GuidedTour steps={DASHBOARD_TOUR_STEPS} onDone={closeTour} onSkip={closeTour} />}
      <header className="border-b border-ink-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <Logo className="h-9 w-auto" />
          <div className="flex flex-wrap items-center gap-4 text-base text-ivory-dim">
            <ClockWidget />
            <div data-tour="account-switcher"><AccountSwitcher /></div>
            <div data-tour="theme-toggle"><ThemeToggle onChange={(mode) => updateMyTheme(mode).catch(() => {})} /></div>
            <button
              type="button"
              onClick={() => setShowTour(true)}
              title={t('Show guided tour')}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-ink-line text-sm text-ivory-dim transition-all duration-150 hover:border-brass hover:text-brass active:scale-[0.9]"
            >
              ?
            </button>
            <span>{user?.name} · {isOwner ? 'Owner' : 'Staff'}</span>
            <button type="button" onClick={logout} className="hover:text-ivory">{t('Sign out')}</button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl items-center gap-1.5 px-6 pt-1.5">
          <div data-tour="nav-tabs" className="flex flex-1 items-center gap-1.5 overflow-x-auto">
            {visibleTabs.map((tab, i) => {
              const count = (tab.badge ? counts[tab.badge] : 0) + (tab.badge2 ? counts[tab.badge2] : 0);
              const isEditing = editingPath === tab.path;
              return (
                <div key={tab.path} className="relative shrink-0">
                  <Link
                    to={`/admin/dashboard/${tab.path}`}
                    onDoubleClick={(e) => handleDoubleClick(e, tab.path)}
                    onTouchStart={() => handleTouchStart(tab.path)}
                    onTouchEnd={handleTouchEnd}
                    className={`relative block border-b-2 px-3 py-2.5 text-base transition-all duration-150 active:scale-[0.97] ${
                      isEditing ? 'border-brass/50 bg-ink-soft' :
                      location.pathname.includes(tab.path)
                        ? 'border-brass text-ivory'
                        : 'border-transparent text-ivory-dim hover:text-ivory'
                    }`}
                  >
                    {t(tab.label)}
                    {count > 0 && !isEditing && (
                      <span className="absolute top-0 end-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-medium text-ivory">
                        {count > 9 ? '9+' : count}
                      </span>
                    )}
                  </Link>
                  {isEditing && (
                    <div className="absolute start-0 top-full z-30 mt-1 flex items-center gap-1 rounded-lg border border-brass/30 bg-ink-soft p-1 shadow-xl shadow-black/50">
                      <button type="button" onClick={() => moveItem(visibleTabs, tab.path, -1)} disabled={i === 0} className="rounded px-2 py-1 text-ivory-dim hover:text-ivory disabled:opacity-30" aria-label="Move left">‹</button>
                      <button type="button" onClick={() => moveItem(visibleTabs, tab.path, 1)} disabled={i === visibleTabs.length - 1} className="rounded px-2 py-1 text-ivory-dim hover:text-ivory disabled:opacity-30" aria-label="Move right">›</button>
                      <button type="button" onClick={() => hideItem(tab.path)} className="rounded px-2 py-1 text-sm text-danger hover:bg-danger/10" aria-label="Hide tab">{t('Hide')}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div ref={settingsRef} data-tour="settings-dropdown" className="relative shrink-0">
            <button type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-base transition-all duration-150 active:scale-[0.97] ${
                isSettingsActive ? 'border-brass text-ivory' : 'border-transparent text-ivory-dim hover:text-ivory'
              }`}
            >
              {t('Settings')}
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className={`transition-transform ${settingsOpen ? 'rotate-180' : ''}`}>
                <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {settingsOpen && (
              <div className="absolute end-0 top-full z-30 mt-2 w-[26rem] max-w-[90vw] overflow-hidden rounded-xl border border-brass/30 bg-ink-soft shadow-2xl shadow-black/50">
                <div className="grid max-h-[70vh] grid-cols-2 gap-x-1 gap-y-0.5 overflow-y-auto p-2">
                  {visibleSettingsItems.map((tab, i) => {
                    const isEditing = editingPath === tab.path;
                    return (
                      <div key={tab.path} className="relative">
                        <Link
                          to={`/admin/dashboard/${tab.path}`}
                          onClick={() => !isEditing && setSettingsOpen(false)}
                          onDoubleClick={(e) => handleDoubleClick(e, tab.path)}
                          onTouchStart={() => handleTouchStart(tab.path)}
                          onTouchEnd={handleTouchEnd}
                          className={`block rounded-lg px-3 py-2.5 text-base transition-all duration-150 active:scale-[0.97] ${
                            isEditing ? 'bg-brass/20 text-ivory' :
                            location.pathname.includes(tab.path)
                              ? 'bg-brass/10 text-brass'
                              : 'text-ivory-dim hover:bg-ink hover:text-ivory'
                          }`}
                        >
                          {t(tab.label)}
                        </Link>
                        {isEditing && (
                          <div className="absolute start-0 top-full z-40 mt-1 flex items-center gap-1 rounded-lg border border-brass/30 bg-ink p-1 shadow-xl shadow-black/50">
                            <button type="button" onClick={() => moveItem(visibleSettingsItems, tab.path, -1)} disabled={i === 0} className="rounded px-2 py-1 text-ivory-dim hover:text-ivory disabled:opacity-30" aria-label="Move left">‹</button>
                            <button type="button" onClick={() => moveItem(visibleSettingsItems, tab.path, 1)} disabled={i === visibleSettingsItems.length - 1} className="rounded px-2 py-1 text-ivory-dim hover:text-ivory disabled:opacity-30" aria-label="Move right">›</button>
                            <button type="button" onClick={() => hideItem(tab.path)} className="rounded px-2 py-1 text-sm text-danger hover:bg-danger/10">{t('Hide')}</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {hiddenTabs.length > 0 && (
                  <div className="border-t border-ink-line p-2">
                    <p className="px-1 pb-1 text-sm text-ivory-dim">{t('Hidden - tap to restore')}</p>
                    <div className="flex flex-wrap gap-1.5 px-1 pb-1">
                      {hiddenTabs.map((tab) => (
                        <button
                          key={tab.path}
                          type="button"
                          onClick={() => restoreItem(tab.path)}
                          className="rounded-full border border-ink-line px-2.5 py-1 text-sm text-ivory-dim hover:border-brass hover:text-ivory"
                        >
                          + {t(tab.label)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-8 sm:py-14">
        <Outlet context={{ refetchFeatures }} />
      </main>
    </div>
  );
}
