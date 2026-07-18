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
import BusinessDetail from './pages/superadmin/BusinessDetail';
import MessagesInboxPage from './pages/superadmin/MessagesInboxPage';

import DashboardLayout from './pages/dashboard/DashboardLayout';
import AnalyticsPage from './pages/dashboard/AnalyticsPage';
import StaffPage from './pages/dashboard/StaffPage';
import SettingsPage from './pages/dashboard/SettingsPage';
import OrdersPage from './pages/dashboard/OrdersPage';
import RequestsPage from './pages/dashboard/RequestsPage';
import ServicesManagementPage from './pages/dashboard/ServicesManagementPage';
import BookingsPage from './pages/dashboard/BookingsPage';
import FeaturesPage from './pages/dashboard/FeaturesPage';
import PaymentsPage from './pages/dashboard/PaymentsPage';
import AuditLogPage from './pages/dashboard/AuditLogPage';
import MessagesPage from './pages/dashboard/MessagesPage';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />

        {/* This is the URL physically programmed onto NFC chips */}
        <Route path="/t/:cardUid" element={<TapHandler />} />

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
            <Route path="businesses/:businessId" element={<BusinessDetail />} />
            <Route path="messages" element={<MessagesInboxPage />} />
          </Route>
        </Route>

        {/* Owner/staff shared dashboard */}
        <Route element={<RequireRole allow={['business_owner', 'staff']} />}>
          <Route path="/admin/dashboard" element={<DashboardLayout />}>
            <Route index element={<Navigate to="orders" replace />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="requests" element={<RequestsPage />} />
            <Route path="services" element={<ServicesManagementPage />} />
            <Route path="bookings" element={<BookingsPage />} />
            <Route path="features" element={<FeaturesPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="audit-log" element={<AuditLogPage />} />
            <Route path="messages" element={<MessagesPage />} />
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
