import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { getLastDashboardPath } from './lib/lastDashboardPath';
import { ThemeProvider } from './lib/ThemeContext';
import { ConfirmDialogProvider } from './components/ConfirmDialog';
import Home from './pages/Home';
import DemoPage from './pages/DemoPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import { DashboardLanguageProvider } from './lib/i18n/DashboardLanguageContext';
import TapHandler from './pages/TapHandler';
import LandingPage from './pages/LandingPage';
import MenuPage from './pages/MenuPage';
import BookingPage from './pages/BookingPage';
import BookingArrivalPage from './pages/BookingArrivalPage';
import BillPage from './pages/BillPage';
import NotFound from './pages/NotFound';
import AdminLogin from './pages/AdminLogin';
import CheckEmail from './pages/CheckEmail';
import ConfirmDevice from './pages/ConfirmDevice';
import RequireRole from './components/RequireRole';

import SuperAdminLayout from './pages/superadmin/SuperAdminLayout';
import BusinessesList from './pages/superadmin/BusinessesList';
import CreateBusiness from './pages/superadmin/CreateBusiness';
import LeadsPage from './pages/superadmin/LeadsPage';
import BusinessDetail from './pages/superadmin/BusinessDetail';
import MessagesInboxPage from './pages/superadmin/MessagesInboxPage';
import BillingSettingsPage from './pages/superadmin/BillingSettingsPage';
import DemoSettingsPage from './pages/superadmin/DemoSettingsPage';
import AuditReportPage from './pages/superadmin/AuditReportPage';
import OrganizationsPage from './pages/superadmin/OrganizationsPage';
import ContractsListPage from './pages/superadmin/ContractsListPage';
import CreateContractPage from './pages/superadmin/CreateContractPage';
import SuperAdminDigitalCardsPage from './pages/superadmin/SuperAdminDigitalCardsPage';
import SuperAdminCardEditorPage from './pages/superadmin/SuperAdminCardEditorPage';
import OrgOwnerLayout from './pages/orgowner/OrgOwnerLayout';
import OrgOverviewPage from './pages/orgowner/OrgOverviewPage';
import OrgMenuPage from './pages/orgowner/OrgMenuPage';
import OrgSuppliersPage from './pages/orgowner/OrgSuppliersPage';
import OrgPurchaseOrdersPage from './pages/orgowner/OrgPurchaseOrdersPage';

import DashboardLayout from './pages/dashboard/DashboardLayout';
import AnalyticsPage from './pages/dashboard/AnalyticsPage';
import ForecastingPage from './pages/dashboard/ForecastingPage';
import StaffPage from './pages/dashboard/StaffPage';
import SettingsPage from './pages/dashboard/SettingsPage';
import BusinessProfilePage from './pages/dashboard/BusinessProfilePage';
import PayBillSetupPage from './pages/dashboard/PayBillSetupPage';
import PrinterSetupPage from './pages/dashboard/PrinterSetupPage';
import CredentialsPage from './pages/dashboard/CredentialsPage';
import LandingButtonsPage from './pages/dashboard/LandingButtonsPage';
import MenuManagementPage from './pages/dashboard/MenuManagementPage';
import LoyaltyPage from './pages/dashboard/LoyaltyPage';
import CardsPage from './pages/dashboard/CardsPage';
import NotificationsPage from './pages/dashboard/NotificationsPage';
import OrdersPage from './pages/dashboard/OrdersPage';
import RequestsPage from './pages/dashboard/RequestsPage';
import KitchenPage from './pages/dashboard/KitchenPage';
import BookingsPage from './pages/dashboard/BookingsPage';
import FeaturesPage from './pages/dashboard/FeaturesPage';
import PaymentsPage from './pages/dashboard/PaymentsPage';
import TableReceiptsPage from './pages/dashboard/TableReceiptsPage';
import AuditLogPage from './pages/dashboard/AuditLogPage';
import MessagesPage from './pages/dashboard/MessagesPage';
import InventoryPage from './pages/dashboard/InventoryPage';
import POSTerminalPage from './pages/dashboard/POSTerminalPage';
import TableManagementPage from './pages/dashboard/TableManagementPage';
import DeliveryIntegrationPage from './pages/dashboard/DeliveryIntegrationPage';
import FrontDeskPage from './pages/dashboard/FrontDeskPage';
import HousekeepingPage from './pages/dashboard/HousekeepingPage';
import ExternalHotelSystemsPage from './pages/dashboard/ExternalHotelSystemsPage';
import HotelOutletsPage from './pages/dashboard/HotelOutletsPage';
import SalesEventsPage from './pages/dashboard/SalesEventsPage';
import RatePlansPage from './pages/dashboard/RatePlansPage';
import NightAuditPage from './pages/dashboard/NightAuditPage';
import PosIntegrationPage from './pages/dashboard/PosIntegrationPage';
import HRPage from './pages/dashboard/HRPage';
import PayrollPage from './pages/dashboard/PayrollPage';
import AccountingPage from './pages/dashboard/AccountingPage';
import ChannelManagerPage from './pages/dashboard/ChannelManagerPage';
import MarketingPage from './pages/dashboard/MarketingPage';
import PaymentReconciliationPage from './pages/dashboard/PaymentReconciliationPage';
import ContractPage from './pages/dashboard/ContractPage';
import ChangePasswordPage from './pages/dashboard/ChangePasswordPage';
import SignContractPage from './pages/SignContractPage';
import PublicCardPage from './pages/PublicCardPage';
import HotelGuestPortalPage from './pages/HotelGuestPortalPage';

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
        <Route path="/:slug/book" element={<BookingPage />} />
        <Route path="/:slug/arrival/:bookingId" element={<BookingArrivalPage />} />
        <Route path="/:slug/pay" element={<BillPage />} />

        {/* Every business's public landing page, e.g. tavzio.com/bella-pizza */}
        <Route path="/:slug" element={<LandingPage />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
      </BrowserRouter>
      </ConfirmDialogProvider>
    </ThemeProvider>
  );
}
