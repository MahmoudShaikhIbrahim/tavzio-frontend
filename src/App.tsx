import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { getLastDashboardPath } from './lib/lastDashboardPath';
import { ThemeProvider } from './lib/ThemeContext';
import { ConfirmDialogProvider } from './components/ConfirmDialog';
import { DashboardLanguageProvider } from './lib/i18n/DashboardLanguageContext';
import RequireRole from './components/RequireRole';

// Eager - the pages nearly everyone hits first (the marketing
// homepage, the whole login/invite flow, the 404, and the three
// layout shells every other page renders inside of), so there's no
// real benefit to deferring these behind their own network request.
import Home from './pages/Home';
import NotFound from './pages/NotFound';
import AdminLogin from './pages/AdminLogin';
import CheckEmail from './pages/CheckEmail';
import ConfirmDevice from './pages/ConfirmDevice';
import SuperAdminLayout from './pages/superadmin/SuperAdminLayout';
import OrgOwnerLayout from './pages/orgowner/OrgOwnerLayout';
import DashboardLayout from './pages/dashboard/DashboardLayout';

// Real, explicit performance fix (confirmed by explicit report - every
// page having a load delay, explicitly including the customer-facing
// NFC page): this whole app was one single ~2.2MB JS bundle - a
// customer just tapping a card to see a menu was downloading and
// parsing the entire admin dashboard, the whole superadmin panel, and
// every org-owner page first, none of which they'll ever use. Real
// code-splitting now - each of these loads its own small chunk only
// when actually navigated to, not upfront for everyone regardless of
// which single page they came for.
const DemoPage = lazy(() => import('./pages/DemoPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TapHandler = lazy(() => import('./pages/TapHandler'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const MenuPage = lazy(() => import('./pages/MenuPage'));
const BookingPage = lazy(() => import('./pages/BookingPage'));
const BookingChooserPage = lazy(() => import('./pages/BookingChooserPage'));
const DriveThroughPage = lazy(() => import('./pages/DriveThroughPage'));
const BookingArrivalPage = lazy(() => import('./pages/BookingArrivalPage'));
const BillPage = lazy(() => import('./pages/BillPage'));
const BusinessesList = lazy(() => import('./pages/superadmin/BusinessesList'));
const CreateBusiness = lazy(() => import('./pages/superadmin/CreateBusiness'));
const LeadsPage = lazy(() => import('./pages/superadmin/LeadsPage'));
const BusinessDetail = lazy(() => import('./pages/superadmin/BusinessDetail'));
const MessagesInboxPage = lazy(() => import('./pages/superadmin/MessagesInboxPage'));
const BillingSettingsPage = lazy(() => import('./pages/superadmin/BillingSettingsPage'));
const DemoSettingsPage = lazy(() => import('./pages/superadmin/DemoSettingsPage'));
const AuditReportPage = lazy(() => import('./pages/superadmin/AuditReportPage'));
const OrganizationsPage = lazy(() => import('./pages/superadmin/OrganizationsPage'));
const ContractsListPage = lazy(() => import('./pages/superadmin/ContractsListPage'));
const CreateContractPage = lazy(() => import('./pages/superadmin/CreateContractPage'));
const SuperAdminDigitalCardsPage = lazy(() => import('./pages/superadmin/SuperAdminDigitalCardsPage'));
const SuperAdminCardEditorPage = lazy(() => import('./pages/superadmin/SuperAdminCardEditorPage'));
const OrgOverviewPage = lazy(() => import('./pages/orgowner/OrgOverviewPage'));
const OrgMenuPage = lazy(() => import('./pages/orgowner/OrgMenuPage'));
const OrgSuppliersPage = lazy(() => import('./pages/orgowner/OrgSuppliersPage'));
const OrgPurchaseOrdersPage = lazy(() => import('./pages/orgowner/OrgPurchaseOrdersPage'));
const AnalyticsPage = lazy(() => import('./pages/dashboard/AnalyticsPage'));
const ForecastingPage = lazy(() => import('./pages/dashboard/ForecastingPage'));
const StaffPage = lazy(() => import('./pages/dashboard/StaffPage'));
const SettingsPage = lazy(() => import('./pages/dashboard/SettingsPage'));
const BusinessProfilePage = lazy(() => import('./pages/dashboard/BusinessProfilePage'));
const PayBillSetupPage = lazy(() => import('./pages/dashboard/PayBillSetupPage'));
const PrinterSetupPage = lazy(() => import('./pages/dashboard/PrinterSetupPage'));
const CredentialsPage = lazy(() => import('./pages/dashboard/CredentialsPage'));
const LandingButtonsPage = lazy(() => import('./pages/dashboard/LandingButtonsPage'));
const MenuManagementPage = lazy(() => import('./pages/dashboard/MenuManagementPage'));
const LoyaltyPage = lazy(() => import('./pages/dashboard/LoyaltyPage'));
const CardsPage = lazy(() => import('./pages/dashboard/CardsPage'));
const NotificationsPage = lazy(() => import('./pages/dashboard/NotificationsPage'));
const OrdersPage = lazy(() => import('./pages/dashboard/OrdersPage'));
const RequestsPage = lazy(() => import('./pages/dashboard/RequestsPage'));
const KitchenPage = lazy(() => import('./pages/dashboard/KitchenPage'));
const BookingsPage = lazy(() => import('./pages/dashboard/BookingsPage'));
const FeaturesPage = lazy(() => import('./pages/dashboard/FeaturesPage'));
const PaymentsPage = lazy(() => import('./pages/dashboard/PaymentsPage'));
const TableReceiptsPage = lazy(() => import('./pages/dashboard/TableReceiptsPage'));
const AuditLogPage = lazy(() => import('./pages/dashboard/AuditLogPage'));
const MessagesPage = lazy(() => import('./pages/dashboard/MessagesPage'));
const InventoryPage = lazy(() => import('./pages/dashboard/InventoryPage'));
const POSTerminalPage = lazy(() => import('./pages/dashboard/POSTerminalPage'));
const TableManagementPage = lazy(() => import('./pages/dashboard/TableManagementPage'));
const DeliveryIntegrationPage = lazy(() => import('./pages/dashboard/DeliveryIntegrationPage'));
const FrontDeskPage = lazy(() => import('./pages/dashboard/FrontDeskPage'));
const HousekeepingPage = lazy(() => import('./pages/dashboard/HousekeepingPage'));
const ExternalHotelSystemsPage = lazy(() => import('./pages/dashboard/ExternalHotelSystemsPage'));
const HotelOutletsPage = lazy(() => import('./pages/dashboard/HotelOutletsPage'));
const SalesEventsPage = lazy(() => import('./pages/dashboard/SalesEventsPage'));
const RatePlansPage = lazy(() => import('./pages/dashboard/RatePlansPage'));
const NightAuditPage = lazy(() => import('./pages/dashboard/NightAuditPage'));
const PosIntegrationPage = lazy(() => import('./pages/dashboard/PosIntegrationPage'));
const HRPage = lazy(() => import('./pages/dashboard/HRPage'));
const PayrollPage = lazy(() => import('./pages/dashboard/PayrollPage'));
const AccountingPage = lazy(() => import('./pages/dashboard/AccountingPage'));
const ChannelManagerPage = lazy(() => import('./pages/dashboard/ChannelManagerPage'));
const MarketingPage = lazy(() => import('./pages/dashboard/MarketingPage'));
const PaymentReconciliationPage = lazy(() => import('./pages/dashboard/PaymentReconciliationPage'));
const ContractPage = lazy(() => import('./pages/dashboard/ContractPage'));
const ChangePasswordPage = lazy(() => import('./pages/dashboard/ChangePasswordPage'));
const SignContractPage = lazy(() => import('./pages/SignContractPage'));
const PublicCardPage = lazy(() => import('./pages/PublicCardPage'));
const HotelGuestPortalPage = lazy(() => import('./pages/HotelGuestPortalPage'));

// See the comment where this is rendered in App() for the full
// reasoning - this exists specifically because Supabase's redirect
// allow-list can silently drop an invite/recovery token onto the
// wrong page. Captured via a lazy useState initializer (runs
// synchronously on first render, before any effect) for the same
// reason AdminLogin.tsx's own hash-detection does the same thing:
// supabase-js's own client auto-clears the hash from the URL shortly
// after processing it, so this needs the value before that happens,
// not a fresh read of window.location.hash later.
function InviteHashRedirect() {
  const [hash] = useState(() => window.location.hash);
  const navigate = useNavigate();

  useEffect(() => {
    const isInviteOrRecovery = hash.includes('type=invite') || hash.includes('type=recovery');
    if (isInviteOrRecovery && window.location.pathname !== '/admin/login') {
      navigate(`/admin/login${hash}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

// Real fix, replacing the old hardcoded <Navigate to="orders" /> - a
// fresh login or reload lands back wherever the person actually was
// last, not always on Orders (which also happens to auto-trigger focus
// mode, the exact confusing "why am I suddenly in full-page Orders"
// bug this closes for good).
function DashboardIndexRedirect() {
  return <Navigate to={getLastDashboardPath()} replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <ConfirmDialogProvider>
      <BrowserRouter>
      {/* Real fix for a confirmed failure: Supabase's invite/recovery
          link only honors the app's requested redirect path if that
          exact path is in Supabase's own Redirect URLs allow-list -
          if it's missing (or the allow-list entry is even slightly
          off), Supabase silently falls back to Site URL instead,
          dropping the person on the homepage with the real session
          token still sitting in the URL hash, unprocessed, since
          AdminLogin.tsx (the only place that ever looked for it) never
          even mounts on that route. This runs on every single page
          the app renders and catches that token regardless of where
          Supabase actually lands someone, forwarding to the one page
          that knows how to use it - so a misconfigured allow-list
          degrades gracefully instead of silently losing the invite. */}
      <InviteHashRedirect />
      <Suspense fallback={<div style={{ background: '#14110F', minHeight: '100vh' }} />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/demo" element={<DemoPage />} />
        {/* Matches exactly what buildContractText already promises
            every signed client - "tavzio.ae/legal" - not a path chosen
            independently of that commitment. */}
        <Route path="/legal" element={<PrivacyPolicyPage />} />

        {/* This is the URL physically programmed onto NFC chips */}
        <Route path="/t/:cardUid" element={<TapHandler />} />

        {/* Public, no-login contract signing - the "send in a minute" link */}
        <Route path="/sign/:token" element={<SignContractPage />} />
        <Route path="/card/:slug" element={<PublicCardPage />} />
        <Route path="/:slug/room/:roomId" element={<HotelGuestPortalPage />} />
        {/* Lobby/reception/unassigned hotel stands - same component,
            useParams().roomId is simply undefined here, which
            HotelGuestPortalPage's portalBase logic already treats as
            "no room" rather than an error. See resolveCardTap for the
            matching backend redirect. */}
        <Route path="/:slug/hotel-portal" element={<HotelGuestPortalPage />} />

        {/* Real email/password login - the only owner/staff access path
            now (admin cards were removed), always available to super_admin
            too. */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/check-email" element={<CheckEmail />} />
        <Route path="/admin/confirm-device/:pendingId" element={<ConfirmDevice />} />

        {/* Super admin only - onboarding, business/card/staff management */}
        <Route element={<RequireRole allow={['super_admin']} />}>
          <Route path="/admin/super" element={<SuperAdminLayout />}>
            <Route index element={<Navigate to="businesses" replace />} />
            <Route path="businesses" element={<BusinessesList />} />
            <Route path="businesses/new" element={<CreateBusiness />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="businesses/:businessId" element={<BusinessDetail />} />
            <Route path="messages" element={<MessagesInboxPage />} />
            <Route path="billing-settings" element={<BillingSettingsPage />} />
            <Route path="demo-settings" element={<DemoSettingsPage />} />
            <Route path="audit-report" element={<AuditReportPage />} />
            <Route path="organizations" element={<OrganizationsPage />} />
            <Route path="contracts" element={<ContractsListPage />} />
            <Route path="contracts/new" element={<CreateContractPage />} />
            <Route path="digital-cards" element={<SuperAdminDigitalCardsPage />} />
            <Route path="digital-cards/:cardId" element={<SuperAdminCardEditorPage />} />
            {/* Confirmed gap: super_admin had zero self-service account
                page anywhere - reuses the same ChangePasswordPage every
                other account type already uses for password/email/
                language, rather than building a second, different page
                for the exact same thing. */}
            <Route path="account" element={<DashboardLanguageProvider><ChangePasswordPage /></DashboardLanguageProvider>} />
          </Route>
        </Route>

        {/* Org owner - franchise/multi-outlet accounts, no single business_id */}
        <Route element={<RequireRole allow={['org_owner']} />}>
          <Route path="/admin/org" element={<OrgOwnerLayout />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<OrgOverviewPage />} />
            <Route path="menu" element={<OrgMenuPage />} />
            <Route path="suppliers" element={<OrgSuppliersPage />} />
            <Route path="purchase-orders" element={<OrgPurchaseOrdersPage />} />
          </Route>
        </Route>

        {/* Owner/staff shared dashboard */}
        <Route element={<RequireRole allow={['business_owner', 'staff']} />}>
          <Route path="/admin/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardIndexRedirect />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="forecasting" element={<ForecastingPage />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="settings" element={<SettingsPage />} />
            {/* Same components the standalone /admin/org portal uses -
                self-contained (call getMyOrganization() themselves via
                requireOrgOwner, now is_org_owner-aware), no layout
                dependency, so reusing them here needed zero changes to
                the page components themselves. See DashboardLayout's
                SETTINGS_ITEMS 'orgOwner' entries for the nav gating. */}
            <Route path="org/overview" element={<OrgOverviewPage />} />
            <Route path="org/menu" element={<OrgMenuPage />} />
            <Route path="org/suppliers" element={<OrgSuppliersPage />} />
            <Route path="org/purchase-orders" element={<OrgPurchaseOrdersPage />} />
            <Route path="settings/business-profile" element={<BusinessProfilePage />} />
            <Route path="settings/pay-bill" element={<PayBillSetupPage />} />
            <Route path="settings/printer" element={<PrinterSetupPage />} />
            <Route path="settings/credentials" element={<CredentialsPage />} />
            <Route path="settings/landing-buttons" element={<LandingButtonsPage />} />
            <Route path="settings/menu" element={<MenuManagementPage />} />
            <Route path="settings/loyalty" element={<LoyaltyPage />} />
            <Route path="settings/cards" element={<CardsPage />} />
            <Route path="settings/notifications" element={<NotificationsPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="requests" element={<RequestsPage />} />
            <Route path="kitchen" element={<KitchenPage />} />
            <Route path="bookings" element={<BookingsPage />} />
            <Route path="features" element={<FeaturesPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="audit-log" element={<AuditLogPage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="table-receipts" element={<TableReceiptsPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="pos" element={<POSTerminalPage />} />
            <Route path="tables" element={<TableManagementPage />} />
            <Route path="settings/delivery" element={<DeliveryIntegrationPage />} />
            <Route path="front-desk" element={<FrontDeskPage />} />
            <Route path="sales-events" element={<SalesEventsPage />} />
            <Route path="housekeeping" element={<HousekeepingPage />} />
            <Route path="settings/external-hotel-systems" element={<ExternalHotelSystemsPage />} />
            <Route path="settings/hotel-outlets" element={<HotelOutletsPage />} />
            <Route path="settings/rate-plans" element={<RatePlansPage />} />
            <Route path="settings/night-audit" element={<NightAuditPage />} />
            <Route path="settings/pos-integration" element={<PosIntegrationPage />} />
            <Route path="settings/hr" element={<HRPage />} />
            <Route path="settings/payroll" element={<PayrollPage />} />
            <Route path="settings/accounting" element={<AccountingPage />} />
            <Route path="settings/channel-manager" element={<ChannelManagerPage />} />
            <Route path="settings/warehouses" element={<Navigate to="../inventory" replace />} />
            <Route path="settings/stock-transfers" element={<Navigate to="../inventory" replace />} />
            <Route path="settings/online-booking" element={<Navigate to="../bookings" replace />} />
            <Route path="settings/marketing" element={<MarketingPage />} />
            <Route path="reconciliation" element={<PaymentReconciliationPage />} />
            <Route path="settings/contract" element={<ContractPage />} />
            <Route path="settings/change-password" element={<ChangePasswordPage />} />
          </Route>
        </Route>

        {/* Public ordering/booking/payment - only reachable if the business has it enabled */}
        <Route path="/:slug/menu" element={<MenuPage />} />
        <Route path="/:slug/book" element={<BookingChooserPage />} />
        <Route path="/:slug/book/table" element={<BookingPage />} />
        <Route path="/:slug/book/drive-through" element={<DriveThroughPage />} />
        <Route path="/:slug/arrival/:bookingId" element={<BookingArrivalPage />} />
        <Route path="/:slug/pay" element={<BillPage />} />

        {/* Every business's public landing page, e.g. tavzio.com/bella-pizza */}
        <Route path="/:slug" element={<LandingPage />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
      </BrowserRouter>
      </ConfirmDialogProvider>
    </ThemeProvider>
  );
}
