import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import CommandPalette from '../../components/CommandPalette';
import CustomizeNavModal from '../../components/CustomizeNavModal';
import { saveLastDashboardPath } from '../../lib/lastDashboardPath';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import { getBusiness, updateMyTheme, getNotificationCounts, markSectionViewed, setMyNavLayout, type NotificationCounts } from '../../lib/authApi';
import { buildBusinessThemeVars } from '../../lib/businessTheme';
import type { BusinessFeatures, BusinessTheme } from '../../types';
import AccountMenu from '../../components/AccountMenu';
import Logo from '../../components/Logo';
import ClockWidget from '../../components/ClockWidget';
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
    body: "The tabs you use most live here - which ones you see depends on what's enabled for your business. Use the customize-navigation button in the header to reorder them or hide the ones you don't use.",
  },
  {
    selector: 'settings-dropdown',
    title: 'Everything else lives here',
    body: 'Less frequent things - Menu, Staff, Payroll, Accounting, and more - are grouped under Settings so they never crowd your main tabs. Hidden tabs can also be restored from here.',
  },
  {
    selector: 'command-palette',
    title: 'Jump anywhere, instantly',
    body: "Press ⌘K (or Ctrl+K) from any screen, or tap this bar. Type a page name, or what you're trying to do - \"invite staff\" finds the real action, not just the Staff page. Even a typo still gets you there, it'll suggest the closest real match. This reaches every page and action you can access, including ones hidden from your main tabs - hiding something from the nav bar doesn't mean losing the fast way back to it.",
  },
  {
    selector: 'focus-mode-button',
    title: 'Focus mode',
    body: 'For a busy counter shift - hides everything except the page itself and takes over the full screen, browser chrome included. Turn it on here any time, on any page, not just POS/Kitchen/Orders. Press it again (or the Exit button once inside) to come back to normal.',
  },
  {
    selector: 'account-menu',
    title: 'Your account',
    body: 'Business Profile, your theme (light, dark, or matching your system), and sign out all live here now, together. If you manage more than one business, switching between them without signing out lives here too.',
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
  { path: 'bookings', label: 'Bookings', ownerOnly: false, requires: 'booking' as const, badge: null, badge2: null },
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
  { path: 'settings/credentials', label: 'Credentials & Integrations', ownerOnly: true, requires: null },
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
  { path: 'services', label: 'Services', ownerOnly: false, requires: 'booking' as const },
  { path: 'features', label: 'Features', ownerOnly: false, requires: null },
  { path: 'audit-log', label: 'Audit Log', ownerOnly: false, requires: null },
  { path: 'analytics', label: 'Analytics', ownerOnly: false, requires: null },
  { path: 'forecasting', label: 'Forecasting & Budgeting', ownerOnly: true, requires: 'forecasting' as const },
  { path: 'staff', label: 'Staff', ownerOnly: true, requires: 'staffAccounts' as const },
  { path: 'messages', label: 'Contact Us', ownerOnly: false, requires: null },
  // Appears/disappears per-account, not per-business - see is_org_owner
  // (migration 0098). Deliberately ownerOnly: false: org duty was never
  // tied to full business-owner access, so a regular staff member
  // appointed to run the org sees these the same as the owner would.
  { path: 'org/overview', label: 'Organization', ownerOnly: false, requires: 'orgOwner' as const },
  { path: 'org/menu', label: 'Org Menu', ownerOnly: false, requires: 'orgOwner' as const },
  { path: 'org/suppliers', label: 'Org Suppliers', ownerOnly: false, requires: 'orgOwner' as const },
  { path: 'org/purchase-orders', label: 'Org Purchase Orders', ownerOnly: false, requires: 'orgOwner' as const },
];

// Real tasks, not just destinations - "how do I invite a new server"
// is a much more natural thing to search than knowing it lives under
// Settings > HR. Each one points at wherever that task actually
// happens; keywords cover the different real ways someone might
// phrase the same task ("add", "create", "new" all mean the same
// thing to someone searching). requires reuses the exact same values
// tabAllowed() already checks, so this filters through the same real
// feature-gating the tabs themselves use - a hotel never sees a
// restaurant-only action and vice versa, no separate rules to drift
// out of sync.
const DASHBOARD_ACTIONS = [
  { path: 'pos', label: 'Take an order', keywords: 'new order sell ring up', requires: 'ordering' as const },
  { path: 'pos', label: 'Record a payment', keywords: 'pay bill charge card cash', requires: 'ordering' as const },
  { path: 'pos', label: 'Open the till', keywords: 'start shift cash drawer', requires: 'ordering' as const },
  { path: 'pos', label: 'Close the till', keywords: 'end shift cash out', requires: 'ordering' as const },
  { path: 'pos', label: 'Run an X-report', keywords: 'sales summary shift report', requires: 'ordering' as const },
  { path: 'pos', label: 'Issue a refund', keywords: 'return money back', requires: 'ordering' as const },
  { path: 'settings/menu', label: 'Add a menu item', keywords: 'new dish product create', requires: null },
  { path: 'settings/menu', label: 'Add a menu category', keywords: 'new section create', requires: null },
  { path: 'settings/menu', label: 'Pause a menu item', keywords: 'sold out unavailable 86', requires: null },
  { path: 'staff', label: 'Invite a staff member', keywords: 'new employee add hire', requires: 'staffAccounts' as const },
  { path: 'staff', label: 'Deactivate a staff member', keywords: 'remove fire disable account', requires: 'staffAccounts' as const },
  { path: 'inventory', label: 'Create a purchase order', keywords: 'restock order supplier new', requires: 'inventory' as const },
  { path: 'inventory', label: 'Add a supplier', keywords: 'new vendor create', requires: 'inventory' as const },
  { path: 'inventory', label: 'Record waste', keywords: 'spoilage loss log', requires: 'inventory' as const },
  { path: 'inventory', label: 'Check low stock', keywords: 'running out reorder alert', requires: 'inventory' as const },
  { path: 'bookings', label: 'Create a new booking', keywords: 'reservation table new add', requires: 'booking' as const },
  { path: 'tables', label: 'Merge tables', keywords: 'combine join party', requires: 'orderingNotHotel' as const },
  { path: 'front-desk', label: 'Check in a guest', keywords: 'arrival room new', requires: 'hotel' as const },
  { path: 'front-desk', label: 'Check out a guest', keywords: 'departure folio close', requires: 'hotel' as const },
  { path: 'housekeeping', label: 'Assign a housekeeping task', keywords: 'clean room new', requires: 'hotel' as const },
  { path: 'settings/rate-plans', label: 'Add a rate plan', keywords: 'pricing new room rate', requires: 'hotel' as const },
  { path: 'payments', label: "View today's payments", keywords: 'transactions sales revenue', requires: null },
  { path: 'settings/loyalty', label: 'Set up a loyalty reward', keywords: 'points program new', requires: null },
  { path: 'settings/cards', label: 'Issue a new NFC card', keywords: 'create program table', requires: null },
];

// Real fix for a confirmed bug: .includes(tab.path) is a plain substring
// check, so a short path like 'pos' falsely matches ANY longer path that
// happens to start with those same letters - 'settings/pos-integration'
// included, which is exactly why the POS Terminal tab lit up while
// looking at Settings > POS Integration. Requires a real segment
// boundary (either an exact match, or the next character is a genuine
// '/') so 'pos' only ever matches '/admin/dashboard/pos' itself or
// something truly nested under it, never a same-prefix sibling.
function isTabActive(pathname: string, tabPath: string): boolean {
  const target = `/admin/dashboard/${tabPath}`;
  return pathname === target || pathname.startsWith(`${target}/`);
}

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
  // Auto-enters on these three specifically - the working, information-
  // dense screens someone stares at for a whole shift, where every
  // pixel spent on chrome is a pixel not spent on the actual floor/
  // kitchen/counter. Re-triggers fresh on every navigation to one of
  // these (not a sticky global toggle) - landing on Kitchen after
  // manually exiting focus mode on Orders should still focus Kitchen,
  // matching "pressing the page" literally rather than remembering a
  // preference across completely different screens.
  //
  // Real, explicit-only entry - focus mode never auto-triggers from
  // navigation anymore, on any page, however you got there. The
  // explicit toggle button below (and the matching Exit button once
  // inside) are now the only ways in or out.
  const [focusMode, setFocusMode] = useState(false);

  // Real fullscreen, not just this app's own chrome - requestFullscreen
  // only works when called synchronously inside a real click/keydown
  // handler (a hard browser security rule), so this only ever runs from
  // the explicit toggle button's own click handler.
  function enterFocusMode() {
    setFocusMode(true);
    document.documentElement.requestFullscreen?.().catch(() => {});
  }
  function exitFocusMode() {
    setFocusMode(false);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }
  useEffect(() => {
    function onFullscreenChange() {
      if (!document.fullscreenElement) setFocusMode(false);
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);
  useEffect(() => {
    // Real path persistence, every real navigation - what makes a
    // future login/reload able to return here at all.
    const dashboardPath = location.pathname.replace(/^\/admin\/dashboard\/?/, '');
    if (dashboardPath) saveLastDashboardPath(dashboardPath);
  }, [location.pathname]);
  const settingsRef = useRef<HTMLDivElement>(null);
  const { setMode } = useTheme();
  // Local override so a hide/reorder change reflects instantly without
  // waiting on useSession's 20s cache to naturally refresh - synced from
  // the account's real saved layout once it loads, then updated
  // optimistically on every change and persisted via setMyNavLayout.
  const [navLayoutOverride, setNavLayoutOverride] = useState<{ hidden: string[]; order: string[] } | null | undefined>(undefined);

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
    const tab = TABS.find((t) => (t.badge || t.badge2) && isTabActive(location.pathname, t.path));
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

    // Real-time: every table that feeds a badge count triggers an
    // immediate refresh the moment something changes.
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

  function tabAllowed(requires: 'ordering' | 'orderingNotHotel' | 'booking' | 'staffAccounts' | 'inventory' | 'hotel' | 'notHotel' | 'hr' | 'forecasting' | 'payroll' | 'accounting' | 'channelManager' | 'marketing' | 'orgOwner' | null) {
    if (requires === 'hotel') return category === 'hotel';
    // Delivery platform integrations (Deliverect etc.) only make sense for
    // restaurants/cafés dispatching food off-site - a hotel has no
    // "delivery" concept in Tavzio, so this hides regardless of features.
    if (requires === 'notHotel') return category !== 'hotel';
    if (requires === 'orderingNotHotel') {
      if (category === 'hotel') return false;
      return !!features && (features.ordering.menuView || features.ordering.submission);
    }
    // Independent of every business feature flag above - this business
    // may have no ordering/booking/inventory enabled at all and still
    // be part of an organization. Gated purely on the account's own
    // is_org_owner capability (see migration 0098), not on role or
    // hasOwnerAccess - a regular staff member appointed to run the org
    // sees these tabs the same as the owner would, since org duties
    // were never tied to full business-owner access in the first place.
    if (requires === 'orgOwner') return !!user?.is_org_owner;
    if (!requires || !features) return !requires;
    if (requires === 'ordering') return features.ordering.menuView || features.ordering.submission;
    if (requires === 'booking') return features.booking.menuView || features.booking.submission || !!features.onlineBooking?.enabled;
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
    .filter((t) => t.path !== 'settings/change-password' || !isOwner)
    // Real fix: a section-restricted staff account used to see the full
    // Settings dropdown regardless of what was actually assigned to
    // them - the main tabs bar respected allowedSections, this never
    // did. Change Password stays always-available (Change PIN now
    // lives on that same page) since every account needs a way to
    // manage its own login regardless of what else it's restricted
    // from - everything else only shows if the owner explicitly
    // included it in assigned_sections.
    .filter((t) => t.path === 'settings/change-password' || !allowedSections || allowedSections.includes(t.path));

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
  // Deliberately the full permission-filtered lists, not the
  // hide-filtered visibleTabs/visibleSettingsItems above - a command
  // palette exists precisely to still reach a page someone hid from
  // their everyday nav bar, not to respect that same declutter choice.
  const paletteItems = [...baseVisibleTabs, ...baseVisibleSettingsItems]
    .filter((item, i, arr) => arr.findIndex((x) => x.path === item.path) === i)
    .map((item) => ({ path: item.path, label: item.label, kind: 'page' as const }));
  const reachablePaths = new Set([...baseVisibleTabs, ...baseVisibleSettingsItems].map((i) => i.path));
  const paletteActions = DASHBOARD_ACTIONS
    .filter((a) => reachablePaths.has(a.path) && tabAllowed(a.requires))
    .map((a) => ({ path: a.path, label: a.label, keywords: a.keywords, kind: 'action' as const }));
  const hiddenTabs = [...baseVisibleTabs, ...baseVisibleSettingsItems].filter((i) => navLayout?.hidden.includes(i.path));
  const isSettingsActive = visibleSettingsItems.some((t) => isTabActive(location.pathname, t.path)) || location.pathname.includes('/settings');

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
  function moveItem(scope: { path: string }[], path: string, direction: -1 | 1) {
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
  }

  function restoreItem(path: string) {
    const hidden = (navLayout?.hidden ?? []).filter((p) => p !== path);
    persistLayout({ hidden, order: navLayout?.order ?? [] });
  }

  // Real redesign, replacing the old double-click/long-press-per-tab
  // popover approach entirely - that produced a small floating box that
  // could land awkwardly depending on scroll position and tab width,
  // and gave no clear signal you were "in an editing state" at all. One
  // explicit toggle now enters a proper Customize mode for the whole
  // bar at once: every tab shows its controls inline, in place, with a
  // persistent banner making it unmistakable you're editing rather than
  // just browsing.
  const [customizing, setCustomizing] = useState(false);
  useEffect(() => { setCustomizing(false); }, [location.pathname]);

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
      {!focusMode && (
      <header className="border-b border-ink-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-4">
            <Logo />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-base text-ivory-dim">
            <div data-tour="command-palette"><CommandPalette items={paletteItems} actions={paletteActions} t={t} /></div>
            {/* Real, explicit toggle - the actual gap this closes: the
                only way in before was the automatic POS/Kitchen/Orders
                trigger, with no way to enter it manually on any other
                page, or to turn it on/off as a deliberate choice rather
                than a side effect of which tab happened to be active. */}
            <button
              type="button"
              data-tour="focus-mode-button"
              onClick={enterFocusMode}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-line hover:border-brass/40 hover:text-ivory"
              title={t('Focus mode')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m11-5v3a2 2 0 0 1-2 2h-3" /></svg>
            </button>
            <ClockWidget />
            <button
              type="button"
              onClick={() => setShowTour(true)}
              title={t('Show guided tour')}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-ink-line text-sm text-ivory-dim transition-all duration-150 hover:border-brass hover:text-brass active:scale-[0.9]"
            >
              ?
            </button>
            <button
              type="button"
              onClick={() => setCustomizing(true)}
              title={t('Customize navigation')}
              className={`flex h-7 w-7 items-center justify-center rounded-full border text-sm transition-all duration-150 active:scale-[0.9] ${
                customizing ? 'border-brass bg-brass/10 text-brass' : 'border-ink-line text-ivory-dim hover:border-brass hover:text-brass'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h8M2 8h5M2 12h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <circle cx="12.5" cy="4" r="1.6" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="9" cy="12" r="1.6" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </button>
            <div data-tour="account-menu">
              <AccountMenu
                name={user?.name || ''}
                role={isOwner ? t('Owner') : t('Staff')}
                onSignOut={logout}
                onThemeChange={(mode) => updateMyTheme(mode).catch(() => {})}
                t={t}
              />
            </div>
          </div>
        </div>

        <nav className="mx-auto flex max-w-7xl items-center gap-1.5 px-6 pt-1.5">
          <div data-tour="nav-tabs" className="flex flex-1 flex-wrap items-center gap-2.5">
            {visibleTabs.map((tab) => {
              const count = (tab.badge ? counts[tab.badge] : 0) + (tab.badge2 ? counts[tab.badge2] : 0);

              return (
                <Link
                  key={tab.path}
                  to={`/admin/dashboard/${tab.path}`}
                  className={`relative block shrink-0 border-b-2 px-3 py-2.5 text-base transition-all duration-150 active:scale-[0.97] ${
                    isTabActive(location.pathname, tab.path)
                      ? 'border-brass text-ivory'
                      : 'border-transparent text-ivory-dim hover:text-ivory'
                  }`}
                >
                  {t(tab.label)}
                  {count > 0 && (
                    <span className="absolute top-0 end-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-medium text-status-text">
                      {count > 9 ? '9+' : count}
                    </span>
                  )}
                </Link>
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
              <div className="absolute end-0 top-full z-dropdown mt-2 w-[26rem] max-w-[90vw] overflow-hidden rounded-xl border border-brass/30 bg-ink-soft shadow-2xl shadow-black/50">
                <div className="grid max-h-[70vh] grid-cols-2 gap-x-1 gap-y-0.5 overflow-y-auto p-2.5">
                  {visibleSettingsItems.map((tab) => (
                    <Link
                      key={tab.path}
                      to={`/admin/dashboard/${tab.path}`}
                      onClick={() => setSettingsOpen(false)}
                      className={`block rounded-lg px-3 py-2.5 text-base transition-all duration-150 active:scale-[0.97] ${
                        isTabActive(location.pathname, tab.path)
                          ? 'bg-brass/10 text-brass'
                          : 'text-ivory-dim hover:bg-ink hover:text-ivory'
                      }`}
                    >
                      {t(tab.label)}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </nav>
      </header>
      )}

      {customizing && (
        <CustomizeNavModal
          mainTabs={visibleTabs}
          settingsItems={visibleSettingsItems}
          hiddenTabs={hiddenTabs}
          onMove={moveItem}
          onHide={hideItem}
          onRestore={restoreItem}
          onDone={() => setCustomizing(false)}
          t={t}
        />
      )}
      {focusMode && (
        <div className="flex items-center justify-between px-4 py-2">
          <CommandPalette items={paletteItems} actions={paletteActions} t={t} />
          <button
            type="button"
            onClick={exitFocusMode}
            className="rounded-lg border border-ink-line px-3.5 py-2 text-sm text-ivory-dim transition-colors hover:border-brass/50 hover:text-ivory"
          >
            {t('Exit focus mode')}
          </button>
        </div>
      )}
      <main className={focusMode ? 'px-4 py-4 sm:px-6' : 'mx-auto max-w-7xl px-4 py-10 sm:px-8 sm:py-14'}>
        <Outlet context={{ refetchFeatures }} />
      </main>
    </div>
  );
}
