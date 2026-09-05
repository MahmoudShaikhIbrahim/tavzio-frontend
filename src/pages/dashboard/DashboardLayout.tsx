import { useEffect, useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { X as XIcon } from 'lucide-react';
import CommandPalette from '../../components/CommandPalette';
import CustomizeNavModal from '../../components/CustomizeNavModal';
import { saveLastDashboardPath } from '../../lib/lastDashboardPath';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/useT';
import { getBusiness, updateMyTheme, getNotificationCounts, markSectionViewed, setMyNavLayout, getPaymentIntegration, type NotificationCounts } from '../../lib/authApi';
import { buildBusinessThemeVars } from '../../lib/businessTheme';
import type { BusinessFeatures, BusinessTheme } from '../../types';
import ThemeToggle from '../../components/ThemeToggle';
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
    selector: 'nav-drawer-button',
    title: 'Everything lives here now',
    body: "Tap this to open your menu - every page you use, Settings, your account, and Customize navigation all live in one scrollable list instead of crowding the header. What you see there depends on what's enabled for your business.",
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
    selector: 'orders-map-toggle',
    title: 'Orders and Tables Map, one page',
    body: 'Orders and Tables Map are two sides of the same live data, not two separate pages - flip between them any time. Orders is the time-ordered list; the map is for "where is table 12" at a glance.',
  },
  {
    selector: 'orders-map-toggle',
    title: 'Arranging the floor plan',
    body: "The map only shows a table once it's been placed - set that up once in Table Setup's \"Arrange floor plan\", tap-to-place tables, walls, windows, doors and counters to match the real room. Nothing to redo here after that.",
  },
  {
    selector: 'account-menu',
    title: 'Your account',
    body: 'Your name, a small Business Profile icon, and Sign out live at the very bottom of this menu. Your theme (light, dark, or matching your system) is right at the top instead.',
  },
];

// Only what's actually checked constantly through a shift stays
// top-level - everything else, however often it's used, lives in the
// Settings dropdown below instead of competing for space in this bar.
const TABS = [
  // Requests (call waiter / request bill / loyalty claims / cash-pending)
  // now surfaces only in Orders' own attention panel - it used to also
  // have this separate tab showing the exact same live queue, which was
  // pure duplication (see the retired /requests route in App.tsx).
  { path: 'orders', label: 'Orders', emoji: '🧾', ownerOnly: false, requires: 'ordering' as const, badge: 'orders' as const, badge2: 'requests' as const },
  { path: 'kitchen', label: 'Kitchen', emoji: '🔥', ownerOnly: false, requires: 'ordering' as const, badge: 'kitchen' as const, badge2: null },
  { path: 'pos', label: 'POS Terminal', emoji: '💳', ownerOnly: false, requires: 'ordering' as const, badge: null, badge2: null },
  { path: 'bookings', label: 'Bookings', emoji: '📅', ownerOnly: false, requires: 'booking' as const, badge: null, badge2: null },
  // Floor plan / table layout is a restaurant-only concept - a hotel with
  // ordering enabled (for its Room Service / outlet POS) still shouldn't
  // see a "Tables" tab, since it has rooms, not tables.
  { path: 'tables', label: 'Tables', emoji: '🪑', ownerOnly: false, requires: 'orderingNotHotel' as const, badge: null, badge2: null },
  { path: 'front-desk', label: 'Front Desk', emoji: '🛎️', ownerOnly: false, requires: 'hotel' as const, badge: 'front-desk' as const, badge2: null },
  { path: 'housekeeping', label: 'Housekeeping', emoji: '🧹', ownerOnly: false, requires: 'hotel' as const, badge: 'housekeeping' as const, badge2: null },
  { path: 'sales-events', label: 'Sales & Events', emoji: '🎉', ownerOnly: false, requires: 'hotel' as const, badge: null, badge2: null },
  { path: 'payments', label: 'Payments', emoji: '💰', ownerOnly: false, requires: null, badge: 'payments' as const, badge2: null },
  { path: 'inventory', label: 'Inventory', emoji: '📦', ownerOnly: false, requires: 'inventory' as const, badge: null, badge2: null },
  { path: 'reconciliation', label: 'Bank Reconciliation', emoji: '🏦', ownerOnly: true, requires: null, badge: null, badge2: null },
];

// Everything that used to be its own tab, or lived buried inside the old
// monolithic Settings page, now surfaces here instead - grouped roughly
// by how closely related each thing is, not alphabetically.
const SETTINGS_ITEMS = [
  { path: 'settings/credentials', label: 'Credentials & Integrations', emoji: '🔑', ownerOnly: true, requires: null },
  { path: 'settings/contract', label: 'Contracts & Receipts', emoji: '📄', ownerOnly: true, requires: null },
  // Staff-only entry point - owners get this inline inside Business
  // Profile instead (see that page), and Business Profile itself is
  // owner-only, so staff still need a direct way to change their own
  // password. Filtered out for owners below rather than typed as a
  // field on every item, to keep this array's shape uniform.
  { path: 'settings/change-password', label: 'Change Password', emoji: '🔒', ownerOnly: false, requires: null },
  { path: 'settings/hotel-outlets', label: 'F&B Outlets & Services', emoji: '🍽️', ownerOnly: true, requires: 'hotel' as const },
  { path: 'settings/rate-plans', label: 'Rate Plans', emoji: '🏷️', ownerOnly: true, requires: 'hotel' as const },
  { path: 'settings/night-audit', label: 'Night Audit', emoji: '🌙', ownerOnly: true, requires: 'hotel' as const },
  // Staff account management (the roster, invites, permissions) lives
  // as a tab inside this same page now, and stays reachable regardless
  // of the HR feature module - so this entry is gated only on being an
  // owner, not on 'hr', which HRPage itself checks per-module instead.
  { path: 'settings/hr', label: 'HR', emoji: '👥', ownerOnly: true, requires: null },
  { path: 'settings/payroll', label: 'Payroll', emoji: '💵', ownerOnly: true, requires: 'payroll' as const },
  { path: 'settings/accounting', label: 'Accounting', emoji: '📊', ownerOnly: true, requires: 'accounting' as const },
  { path: 'settings/channel-manager', label: 'Channel Manager', emoji: '🔗', ownerOnly: true, requires: 'channelManager' as const },
  { path: 'settings/marketing', label: 'Marketing', emoji: '📣', ownerOnly: true, requires: 'marketing' as const },
  { path: 'settings/landing-buttons', label: 'Buttons and Links', emoji: '🔘', ownerOnly: true, requires: null },
  { path: 'settings/menu', label: 'Menu Management', emoji: '📖', ownerOnly: false, requires: null },
  { path: 'settings/loyalty', label: 'Loyalty', emoji: '⭐', ownerOnly: false, requires: null },
  { path: 'settings/cards', label: 'Cards', emoji: '💳', ownerOnly: false, requires: null },
  { path: 'settings/notifications', label: 'Notifications', emoji: '🔔', ownerOnly: false, requires: null },
  { path: 'features', label: 'Features', emoji: '🧩', ownerOnly: false, requires: null },
  { path: 'audit-log', label: 'Audit Log', emoji: '📋', ownerOnly: false, requires: null },
  { path: 'analytics', label: 'Analytics', emoji: '📈', ownerOnly: false, requires: null },
  { path: 'forecasting', label: 'Forecasting & Budgeting', emoji: '🔮', ownerOnly: true, requires: 'forecasting' as const },
  { path: 'messages', label: 'Contact Us', emoji: '💬', ownerOnly: false, requires: null },
  // Appears/disappears per-account, not per-business - see is_org_owner
  // (migration 0098). Deliberately ownerOnly: false: org duty was never
  // tied to full business-owner access, so a regular staff member
  // appointed to run the org sees these the same as the owner would.
  { path: 'org/overview', label: 'Organization', emoji: '🌐', ownerOnly: false, requires: 'orgOwner' as const },
  { path: 'org/menu', label: 'Org Menu', emoji: '📖', ownerOnly: false, requires: 'orgOwner' as const },
  { path: 'org/suppliers', label: 'Org Suppliers', emoji: '🚚', ownerOnly: false, requires: 'orgOwner' as const },
  { path: 'org/purchase-orders', label: 'Org Purchase Orders', emoji: '🛒', ownerOnly: false, requires: 'orgOwner' as const },
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
  { path: 'settings/hr', label: 'Invite a staff member', keywords: 'new employee add hire staff', requires: 'staffAccounts' as const },
  { path: 'settings/hr', label: 'Deactivate a staff member', keywords: 'remove fire disable account staff', requires: 'staffAccounts' as const },
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

// One drawer row that expands into its real subpages in place - a
// grid-template-rows transition (0fr -> 1fr) animates smoothly without
// ever needing to measure the children's real height in JS, which is
// what makes this "advanced" rather than a plain instant show/hide.
function NavGroup({ emoji, label, linkPath, items, open, onToggle, pathname, t }: {
  emoji: string; label: string; linkPath?: string;
  items: { path: string; label: string }[]; open: boolean; onToggle: () => void;
  pathname: string; t: (s: string) => string;
}) {
  const isActive = (!!linkPath && isTabActive(pathname, linkPath)) || items.some((i) => isTabActive(pathname, i.path));
  return (
    <div>
      <div className="flex items-center">
        {linkPath ? (
          <Link
            to={`/admin/dashboard/${linkPath}`}
            className={`flex-1 px-4 py-2.5 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-inset ${
              isActive ? 'bg-brass/10 text-brass' : 'text-ivory-dim hover:bg-ink hover:text-ivory'
            }`}
          >
            {emoji} {label}
          </Link>
        ) : (
          <span className={`flex-1 px-4 py-2.5 text-base ${isActive ? 'text-brass' : 'text-ivory-dim'}`}>{emoji} {label}</span>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={open ? t('Collapse') : t('Expand')}
          aria-expanded={open}
          className="me-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ivory-dim hover:bg-ink hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
            <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div className="grid transition-[grid-template-rows] duration-300 ease-in-out" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
        <div className="overflow-hidden">
          {items.map((item) => (
            <Link
              key={item.path}
              to={`/admin/dashboard/${item.path}`}
              className={`block py-2.5 pe-4 ps-9 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-inset ${
                isTabActive(pathname, item.path) ? 'bg-brass/10 text-brass' : 'text-ivory-dim hover:bg-ink hover:text-ivory'
              }`}
            >
              {t(item.label)}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// The whole "Main pages" section and the whole "Settings" section, each
// collapsible in exactly the same way a single subpage group is - not
// just the two special cases (Business Profile's Organization, HR's
// Staff) nested inside Settings, but the sections themselves too.
function SidebarSection({ label, open, onToggle, last, children }: {
  label: string; open: boolean; onToggle: () => void; last?: boolean; children: ReactNode;
}) {
  return (
    <div className={last ? 'flex-1' : 'border-b border-ink-line'}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-inset"
      >
        <span className="flex-1 text-xs font-medium uppercase tracking-wide text-ivory-dim/70">{label}</span>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className={`shrink-0 text-ivory-dim transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="grid transition-[grid-template-rows] duration-300 ease-in-out" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
        <div className="overflow-hidden pb-1.5">{children}</div>
      </div>
    </div>
  );
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
  // Real restructure, replacing the old tabs-bar + separate Settings
  // dropdown entirely: every page, Settings, the account menu, and
  // Customize navigation now live in one slide-out drawer opened from a
  // single small logo button, the same "everything behind one menu
  // button" shape Instagram/TikTok/WhatsApp all use for their own
  // secondary navigation - so the header itself never grows past one
  // compact row regardless of how many tabs/settings items a business
  // has enabled.
  const [drawerOpen, setDrawerOpen] = useState(false);
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
  const { setMode } = useTheme();
  // Local override so a hide/reorder change reflects instantly without
  // waiting on useSession's 20s cache to naturally refresh - synced from
  // the account's real saved layout once it loads, then updated
  // optimistically on every change and persisted via setMyNavLayout.
  const [navLayoutOverride, setNavLayoutOverride] = useState<{ hidden: string[]; order: string[]; pinned?: string[] } | null | undefined>(undefined);

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

  // Several tour steps (Focus mode, Customize navigation, the account
  // section) now point at elements that only exist while the drawer is
  // open - forcing it open for the tour's duration means those steps
  // still highlight something real instead of degrading to a plain
  // centered tooltip pointing at nothing.
  useEffect(() => {
    if (showTour) setDrawerOpen(true);
  }, [showTour]);

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

  // Real, explicit fix (confirmed by explicit report: the Record
  // Payment button visibly disappeared and reappeared every single
  // time Orders was opened - "treat it as any button, it has to stay
  // visible"). The real problem was WHERE this lived: fetched fresh
  // inside OrdersPage itself, which unmounts and re-runs its own
  // effects every time someone navigates away and back, so the brief
  // "don't know yet" gap reopened on every single visit. Fetched once
  // here instead, at the shell level that stays mounted for the whole
  // session (exactly like refetchFeatures above), so by the time any
  // page asks for it, the real answer is already sitting there - no
  // flicker, because there's no per-visit fetch left to flicker.
  const [payBillEnabled, setPayBillEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    if (user?.business_id) getPaymentIntegration(user.business_id).then((i) => setPayBillEnabled(!!i?.enabled)).catch(() => {});
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
  // Settings pages someone chose to pin directly onto the main dashboard
  // tab row, next to Orders/Kitchen/etc., instead of only reachable from
  // inside this drawer - everything not pinned stays exactly where it
  // was, tucked away in Settings.
  const pinned: string[] = navLayout?.pinned ?? [];
  const pinnedTabs = visibleSettingsItems.filter((i) => pinned.includes(i.path));
  const drawerSettingsItems = visibleSettingsItems.filter((i) => !pinned.includes(i.path));

  // Organization (and the shared org pages) is a Business Profile
  // concern, not a Staff one - it nests as an expandable group in the
  // drawer instead of four flat, same-looking rows. Staff itself now
  // lives as a tab inside HR (see HRPage), not as a separate nav entry
  // at all.
  const ORG_GROUP_PATHS = ['org/overview', 'org/menu', 'org/suppliers', 'org/purchase-orders'];
  const orgGroupItems = drawerSettingsItems.filter((i) => ORG_GROUP_PATHS.includes(i.path));
  const hrItem = drawerSettingsItems.find((i) => i.path === 'settings/hr');
  const flatSettingsItems = drawerSettingsItems.filter((i) => !ORG_GROUP_PATHS.includes(i.path) && i.path !== 'settings/hr');
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
  // Shown on the collapsed drawer button itself, so an unread badge is
  // still visible at a glance without needing to open the drawer first -
  // the one piece of the old always-visible tab bar this still surfaces
  // outside the menu.
  const totalBadgeCount = visibleTabs.reduce((sum, tab) => sum + (tab.badge ? counts[tab.badge] : 0) + (tab.badge2 ? counts[tab.badge2] : 0), 0);

  // Persists via setMyNavLayout (self-service, see staffRoutes.js) and
  // updates the local override immediately rather than waiting on a
  // fresh /me fetch - reverts the override if the save actually fails,
  // so the UI never silently drifts from what's really saved.
  function persistLayout(next: { hidden: string[]; order: string[]; pinned?: string[] }) {
    const previous = navLayout;
    setNavLayoutOverride(next);
    if (user?.business_id && user?.id) {
      setMyNavLayout(user.business_id, user.id, next).catch(() => setNavLayoutOverride(previous));
    }
  }

  // Two independent reorder scopes, not one combined list - the top tab
  // bar and the Settings dropdown grid are two different UI regions, so
  // dragging a tab out of the bar and into the dropdown (or vice versa)
  // would be a confusing recategorization, not a reorder. Both still
  // persist into the same flat nav_layout.order array; only the drag
  // gesture itself stays scoped to its own list.
  function reorderScope(scope: { path: string }[], newOrder: { path: string }[]) {
    const otherScope = scope === visibleTabs ? visibleSettingsItems : visibleTabs;
    const newPaths = newOrder.map((i) => i.path);
    const fullOrder = scope === visibleTabs ? [...newPaths, ...otherScope.map((i) => i.path)] : [...otherScope.map((i) => i.path), ...newPaths];
    persistLayout({ hidden: navLayout?.hidden ?? [], order: fullOrder, pinned });
  }

  function hideItem(path: string) {
    const hidden = [...(navLayout?.hidden ?? []), path];
    const order = [...visibleTabs, ...visibleSettingsItems].map((i) => i.path).filter((p) => p !== path);
    persistLayout({ hidden, order, pinned });
  }

  function restoreItem(path: string) {
    const hidden = (navLayout?.hidden ?? []).filter((p) => p !== path);
    persistLayout({ hidden, order: navLayout?.order ?? [], pinned });
  }

  function pinItem(path: string) {
    persistLayout({ hidden: navLayout?.hidden ?? [], order: navLayout?.order ?? [], pinned: [...pinned, path] });
  }
  function unpinItem(path: string) {
    persistLayout({ hidden: navLayout?.hidden ?? [], order: navLayout?.order ?? [], pinned: pinned.filter((p) => p !== path) });
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
  useEffect(() => { setCustomizing(false); setDrawerOpen(false); }, [location.pathname]);

  // Which collapsible drawer groups (Business Profile's Organization
  // pages, HR's Staff subpage) are expanded - opens on its own the
  // moment you're actually inside one of its pages, so navigating
  // straight to e.g. Org Menu never leaves its own group looking
  // collapsed/hidden.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  function isGroupOpen(key: string, childPaths: string[]) {
    if (openGroups[key] !== undefined) return openGroups[key];
    return childPaths.some((p) => isTabActive(location.pathname, p));
  }
  function toggleGroup(key: string, childPaths: string[]) {
    setOpenGroups((prev) => ({ ...prev, [key]: !isGroupOpen(key, childPaths) }));
  }

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
      {/* Real, explicit quality fix: without this, a hotel account (which
          never gets a Tables tab at all - floor plans are a restaurant
          concept) would still sit through two tour steps about a
          feature it has no access to, pointing at an element that
          doesn't exist for them. Filtered with the exact same
          tabAllowed check the Tables nav tab itself uses, so this can
          never drift out of sync with what that account actually sees. */}
      {showTour && <GuidedTour steps={DASHBOARD_TOUR_STEPS.filter((s) => s.selector !== 'orders-map-toggle' || tabAllowed('orderingNotHotel'))} onDone={closeTour} onSkip={closeTour} />}
      {!focusMode && (
      <header className="border-b border-ink-line">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          {/* Just a small icon now, not the full wordmark - the real
              Tavzio logo only ever appears once the drawer it opens is
              actually open, at the top of that panel. Everything that
              used to compete for header space (every tab, Settings and
              its whole contents, the account menu, Customize
              navigation) lives behind this one button as a slide-out
              menu - the same shape Instagram, TikTok and WhatsApp all
              use for their own secondary navigation. */}
          <button
            type="button"
            data-tour="nav-drawer-button"
            onClick={() => setDrawerOpen(true)}
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brass/15 text-base text-brass transition-colors hover:bg-brass/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
            aria-label={t('Menu')}
          >
            <span aria-hidden="true">☰</span>
            {totalBadgeCount > 0 && (
              <span className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-medium text-status-text">
                {totalBadgeCount > 9 ? '9+' : totalBadgeCount}
              </span>
            )}
          </button>

          <div className="flex flex-1 items-center justify-end gap-2.5">
            <div data-tour="command-palette" className="min-w-0"><CommandPalette items={paletteItems} actions={paletteActions} t={t} /></div>
            {/* Focus mode lives right on the main page next to the
                search bar now, not tucked a level deeper inside the
                drawer - the whole point of a one-tap "clear the screen"
                action is that it's actually one tap away. */}
            <button
              type="button"
              data-tour="focus-mode-button"
              onClick={enterFocusMode}
              title={t('Focus mode')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink-line text-ivory-dim hover:border-brass/40 hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m11-5v3a2 2 0 0 1-2 2h-3" /></svg>
            </button>
            <ClockWidget />
          </div>
        </div>

        {/* Pages pinned onto the main dashboard (see Customize
            navigation) - reachable in one tap, right next to each
            other, without opening the drawer at all. */}
        {pinnedTabs.length > 0 && (
          <div className="scrollbar-none flex gap-2 overflow-x-auto border-t border-ink-line px-4 py-2 sm:px-6">
            {pinnedTabs.map((tab) => (
              <Link
                key={tab.path}
                to={`/admin/dashboard/${tab.path}`}
                className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${
                  isTabActive(location.pathname, tab.path) ? 'bg-brass text-ink' : 'border border-ink-line text-ivory-dim hover:border-brass/50 hover:text-ivory'
                }`}
              >
                {tab.emoji} {t(tab.label)}
              </Link>
            ))}
          </div>
        )}
      </header>
      )}

      {drawerOpen && (
        <div className="fixed inset-0 z-modal">
          <button
            type="button"
            aria-label={t('Close menu')}
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/60"
          />
          <div className="absolute inset-y-0 start-0 flex w-[85vw] max-w-xs flex-col overflow-y-auto border-e border-ink-line bg-ink-soft shadow-2xl shadow-black/50 sm:max-w-sm">
            <div className="flex items-center justify-between gap-2 border-b border-ink-line px-4 py-3.5">
              <Logo size="sm" />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label={t('Close menu')}
                className="flex h-8 w-8 items-center justify-center rounded-full text-ivory-dim hover:bg-ink hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
              >
                <XIcon size={16} />
              </button>
            </div>

            {/* Theme, right at the very top - the one setting someone
                reaches for before anything else, picked directly rather
                than cycled through. */}
            <div className="border-b border-ink-line px-4 py-3.5">
              <ThemeToggle variant="segmented" onChange={(mode) => updateMyTheme(mode).catch(() => {})} />
            </div>

            {/* Quick actions - guided tour and reordering the lists
                below. Focus mode now lives on the main page itself, next
                to the search bar, not in here. */}
            <div className="flex items-center gap-2 border-b border-ink-line px-4 py-3">
              <button
                type="button"
                onClick={() => { setShowTour(true); }}
                title={t('Show guided tour')}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-line text-sm text-ivory-dim hover:border-brass hover:text-brass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
              >
                ?
              </button>
              <button
                type="button"
                onClick={() => { setCustomizing(true); }}
                title={t('Customize navigation')}
                className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${
                  customizing ? 'border-brass bg-brass/10 text-brass' : 'border-ink-line text-ivory-dim hover:border-brass hover:text-brass'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M2 4h8M2 8h5M2 12h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  <circle cx="12.5" cy="4" r="1.6" stroke="currentColor" strokeWidth="1.4" />
                  <circle cx="9" cy="12" r="1.6" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </button>
            </div>

            {/* Main pages and Settings are each their own collapsible
                section now - the same smooth accordion every real
                subpage group uses below, applied to the two sections
                themselves, not just the two special cases inside them. */}
            <SidebarSection
              label={t('Main pages')}
              open={isGroupOpen('main-pages', visibleTabs.map((i) => i.path))}
              onToggle={() => toggleGroup('main-pages', visibleTabs.map((i) => i.path))}
            >
              <nav data-tour="nav-tabs">
                {visibleTabs.map((tab) => {
                  const count = (tab.badge ? counts[tab.badge] : 0) + (tab.badge2 ? counts[tab.badge2] : 0);
                  const active = isTabActive(location.pathname, tab.path);
                  return (
                    <Link
                      key={tab.path}
                      to={`/admin/dashboard/${tab.path}`}
                      className={`flex items-center gap-2.5 px-4 py-2.5 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-inset ${
                        active ? 'bg-brass/10 text-brass' : 'text-ivory hover:bg-ink'
                      }`}
                    >
                      <span aria-hidden="true">{tab.emoji}</span>
                      <span className="flex-1">{t(tab.label)}</span>
                      {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brass" />}
                      {count > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-medium text-status-text">
                          {count > 9 ? '9+' : count}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </SidebarSection>

            {/* Everything else, under its own collapsible section. A page
                with real subpages (Business Profile's Organization, HR's
                Staff) expands in place as its own nested accordion
                instead of sitting as its own same-looking flat row. */}
            <SidebarSection
              label={t('Settings')}
              open={isGroupOpen('settings', visibleSettingsItems.map((i) => i.path))}
              onToggle={() => toggleGroup('settings', visibleSettingsItems.map((i) => i.path))}
              last
            >
              <div data-tour="settings-dropdown">
                {orgGroupItems.length > 0 && (
                  <NavGroup
                    emoji="🌐"
                    label={t('Organization')}
                    linkPath={orgGroupItems[0].path}
                    items={orgGroupItems.slice(1)}
                    open={isGroupOpen('business-profile-org', orgGroupItems.map((i) => i.path))}
                    onToggle={() => toggleGroup('business-profile-org', orgGroupItems.map((i) => i.path))}
                    pathname={location.pathname}
                    t={t}
                  />
                )}

                {/* Staff lives as a tab inside HR itself now (see
                    HRPage) - no separate nested dropdown for it here
                    anymore, just the one flat row. */}
                {hrItem && (
                  <Link
                    to={`/admin/dashboard/${hrItem.path}`}
                    className={`block px-4 py-2.5 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-inset ${
                      isTabActive(location.pathname, hrItem.path) ? 'bg-brass/10 text-brass' : 'text-ivory-dim hover:bg-ink hover:text-ivory'
                    }`}
                  >
                    {hrItem.emoji} {t(hrItem.label)}
                  </Link>
                )}

                {flatSettingsItems.map((tab) => (
                  <Link
                    key={tab.path}
                    to={`/admin/dashboard/${tab.path}`}
                    className={`block px-4 py-2.5 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-inset ${
                      isTabActive(location.pathname, tab.path) ? 'bg-brass/10 text-brass' : 'text-ivory-dim hover:bg-ink hover:text-ivory'
                    }`}
                  >
                    {tab.emoji} {t(tab.label)}
                  </Link>
                ))}
              </div>
            </SidebarSection>

            {/* Account section: name/role, sign out - moved to the very
                bottom of the drawer, below every page it's not one of. */}
            <div data-tour="account-menu" className="mt-auto flex items-center gap-3 border-t border-ink-line px-4 py-3.5">
              {/* Business Profile - a small icon-only picture button, not
                  a text row lost inside Settings, right here at the very
                  bottom next to who's signed in. */}
              <Link
                to="/admin/dashboard/settings/business-profile"
                onClick={() => setDrawerOpen(false)}
                title={t('Business Profile')}
                aria-label={t('Business Profile')}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${
                  isTabActive(location.pathname, 'settings/business-profile') ? 'bg-brass/25 text-brass' : 'bg-brass/15 text-brass hover:bg-brass/25'
                }`}
              >
                <span aria-hidden="true">🏢</span>
              </Link>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base text-ivory">{user?.name}</p>
                <p className="text-sm text-ivory-dim">{isOwner ? t('Owner') : t('Staff')}</p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="shrink-0 rounded-full border border-danger/40 px-3 py-1.5 text-sm text-danger hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
              >
                {t('Sign out')}
              </button>
            </div>
          </div>
        </div>
      )}

      {customizing && (
        <CustomizeNavModal
          mainTabs={visibleTabs}
          settingsItems={visibleSettingsItems}
          hiddenTabs={hiddenTabs}
          pinned={pinned}
          onReorder={reorderScope}
          onHide={hideItem}
          onRestore={restoreItem}
          onPin={pinItem}
          onUnpin={unpinItem}
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
            className="rounded-lg border border-ink-line px-3.5 py-2 text-sm text-ivory-dim transition-colors hover:border-brass/50 hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
          >
            {t('Exit focus mode')}
          </button>
        </div>
      )}
      <main className={focusMode ? 'px-4 py-4 sm:px-6' : 'mx-auto max-w-7xl px-4 py-10 sm:px-8 sm:py-14'}>
        <Outlet context={{ refetchFeatures, focusMode, payBillEnabled }} />
      </main>
    </div>
  );
}
