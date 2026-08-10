import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './lib/ThemeContext';
import Home from './pages/Home';
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

import DashboardLayout from './pages/dashboard/DashboardLayout';
import AnalyticsPage from './pages/dashboard/AnalyticsPage';
import StaffPage from './pages/dashboard/StaffPage';
import SettingsPage from './pages/dashboard/SettingsPage';
import BusinessProfilePage from './pages/dashboard/BusinessProfilePage';
import PayBillSetupPage from './pages/dashboard/PayBillSetupPage';
import PrinterSetupPage from './pages/dashboard/PrinterSetupPage';
import LandingButtonsPage from './pages/dashboard/LandingButtonsPage';
import MenuManagementPage from './pages/dashboard/MenuManagementPage';
import LoyaltyPage from './pages/dashboard/LoyaltyPage';
import CardsPage from './pages/dashboard/CardsPage';
import NotificationsPage from './pages/dashboard/NotificationsPage';
import OrdersPage from './pages/dashboard/OrdersPage';
import KitchenPage from './pages/dashboard/KitchenPage';
import ServicesManagementPage from './pages/dashboard/ServicesManagementPage';
import BookingsPage from './pages/dashboard/BookingsPage';
import FeaturesPage from './pages/dashboard/FeaturesPage';
import PaymentsPage from './pages/dashboard/PaymentsPage';
import ReceiptsPage from './pages/dashboard/ReceiptsPage';
import AuditLogPage from './pages/dashboard/AuditLogPage';
import MessagesPage from './pages/dashboard/MessagesPage';
import TableReceiptsPage from './pages/dashboard/TableReceiptsPage';
import InventoryPage from './pages/dashboard/InventoryPage';
import ContractPage from './pages/dashboard/ContractPage';
import ChangePasswordPage from './pages/dashboard/ChangePasswordPage';
import SignContractPage from './pages/SignContractPage';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />

        {/* This is the URL physically programmed onto NFC chips */}
        <Route path="/t/:cardUid" element={<TapHandler />} />

        {/* Public, no-login contract signing - the "send in a minute" link */}
        <Route path="/sign/:token" element={<SignContractPage />} />

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
          </Route>
        </Route>

        {/* Owner/staff shared dashboard */}
        <Route element={<RequireRole allow={['business_owner', 'staff']} />}>
          <Route path="/admin/dashboard" element={<DashboardLayout />}>
            <Route index element={<Navigate to="orders" replace />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="settings/business-profile" element={<BusinessProfilePage />} />
            <Route path="settings/pay-bill" element={<PayBillSetupPage />} />
            <Route path="settings/printer" element={<PrinterSetupPage />} />
            <Route path="settings/landing-buttons" element={<LandingButtonsPage />} />
            <Route path="settings/menu" element={<MenuManagementPage />} />
            <Route path="settings/loyalty" element={<LoyaltyPage />} />
            <Route path="settings/cards" element={<CardsPage />} />
            <Route path="settings/notifications" element={<NotificationsPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="kitchen" element={<KitchenPage />} />
            <Route path="services" element={<ServicesManagementPage />} />
            <Route path="bookings" element={<BookingsPage />} />
            <Route path="features" element={<FeaturesPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="receipts" element={<ReceiptsPage />} />
            <Route path="audit-log" element={<AuditLogPage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="table-receipts" element={<TableReceiptsPage />} />
            <Route path="inventory" element={<InventoryPage />} />
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
