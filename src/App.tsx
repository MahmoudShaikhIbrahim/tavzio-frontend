import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './lib/ThemeContext';
import Home from './pages/Home';
import DemoPage from './pages/DemoPage';
import { DashboardLanguageProvider } from './lib/i18n/DashboardLanguageContext';
import TapHandler from './pages/TapHandler';
import LandingPage from './pages/LandingPage';
import MenuPage from './pages/MenuPage';
import BookingPage from './pages/BookingPage';
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
import ServicesManagementPage from './pages/dashboard/ServicesManagementPage';
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

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/demo" element={<DemoPage />} />

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
          </Route>
        </Route>

        {/* Owner/staff shared dashboard */}
        <Route element={<RequireRole allow={['business_owner', 'staff']} />}>
          <Route path="/admin/dashboard" element={<DashboardLayout />}>
            <Route index element={<Navigate to="orders" replace />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="forecasting" element={<ForecastingPage />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="settings" element={<SettingsPage />} />
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
            <Route path="services" element={<ServicesManagementPage />} />
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
            <Route path="settings/marketing" element={<MarketingPage />} />
            <Route path="reconciliation" element={<PaymentReconciliationPage />} />
            <Route path="settings/contract" element={<ContractPage />} />
            <Route path="settings/change-password" element={<ChangePasswordPage />} />
          </Route>
        </Route>

        {/* Public ordering/booking/payment - only reachable if the business has it enabled */}
        <Route path="/:slug/menu" element={<MenuPage />} />
        <Route path="/:slug/book" element={<BookingPage />} />
        <Route path="/:slug/pay" element={<BillPage />} />

        {/* Every business's public landing page, e.g. tavzio.com/bella-pizza */}
        <Route path="/:slug" element={<LandingPage />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
