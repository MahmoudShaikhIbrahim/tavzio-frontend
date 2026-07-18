import { authFetch, setSession, getToken } from './session';
import { fetchWithTimeout } from './fetchWithTimeout';
import type {
  Profile, AdminBusiness, Card, StaffMember,
  AnalyticsSummary, CardBreakdownItem, LoyaltyProgramAdmin, LoyaltyMemberRow, LoyaltyProgramConfig,
  LoyaltyEarnMethod, LoyaltyStructure, RewardType, LoyaltyClaim,
  MenuCategory, MenuItem, OrderRow, OrderStatus,
  PosIntegration, PosIntegrationStatus, PosProvider, PosPurpose,
  Service, BookingRow, BookingStatus,
  CustomButton, PaymentRow, MenuItemAddon, AuditLogEntry, SupportMessage, InboxThread,
} from '../types';

const BASE = import.meta.env.VITE_API_BASE_URL || '';

// --- Auth ---

export async function login(email: string, password: string) {
  const res = await fetchWithTimeout(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Login failed');
  setSession(data.accessToken, undefined, data.refreshToken);
  return data as { accessToken: string; refreshToken: string; user: { id: string; email: string } };
}

export function getMe() {
  return authFetch<Profile>('/api/auth/me');
}

// --- Business onboarding (super_admin) ---

export interface RegisterBusinessPayload {
  name: string;
  email: string;
  password: string;
  businessName: string;
  slug: string;
  category: string;
}

// This is the one-time "sign up a new client" step - a real endpoint today,
// a proper intake form's submit handler tomorrow.
export async function registerBusiness(payload: RegisterBusinessPayload) {
  const res = await fetchWithTimeout(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Registration failed');
  return data as { business: { id: string; slug: string; name: string } };
}

export function listBusinesses(params: { status?: string; search?: string } = {}) {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return authFetch<{ businesses: AdminBusiness[]; total: number }>(`/api/businesses${qs ? `?${qs}` : ''}`);
}

export function getBusiness(id: string) {
  return authFetch<AdminBusiness>(`/api/businesses/${id}`);
}

export function updateBusiness(id: string, payload: Partial<AdminBusiness>) {
  return authFetch<AdminBusiness>(`/api/businesses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function setBusinessStatus(id: string, status: 'active' | 'suspended' | 'pending') {
  return authFetch<AdminBusiness>(`/api/businesses/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function deleteBusiness(id: string) {
  return authFetch<{ message: string }>(`/api/businesses/${id}`, { method: 'DELETE' });
}

// --- Cards ---

export function listCards(businessId: string) {
  return authFetch<Card[]>(`/api/businesses/${businessId}/cards`);
}

export function createCards(businessId: string, count: number, label = '') {
  return authFetch<Card[]>(`/api/businesses/${businessId}/cards`, {
    method: 'POST',
    body: JSON.stringify({ count, label }),
  });
}

export function updateCard(businessId: string, cardId: string, payload: { label?: string; status?: string }) {
  return authFetch<Card>(`/api/businesses/${businessId}/cards/${cardId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// No deleteCard function - "Disable" is the only way to retire a card,
// deliberately. There's no DELETE route on the backend for this anymore
// (see cardRoutes.js), so this would just 404 if it existed.

// --- Staff + admin cards (super_admin issues; owner manages staff accounts) ---

export function listStaff(businessId: string) {
  return authFetch<StaffMember[]>(`/api/businesses/${businessId}/staff`);
}

export function inviteStaff(businessId: string, name: string, email: string) {
  return authFetch<StaffMember>(`/api/businesses/${businessId}/staff`, {
    method: 'POST',
    body: JSON.stringify({ name, email }),
  });
}

export function setStaffActive(businessId: string, userId: string, isActive: boolean) {
  return authFetch<StaffMember>(`/api/businesses/${businessId}/staff/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

// super_admin only - matches how physical cards actually get programmed, in person
export function issueAdminCard(businessId: string, userId: string, label = 'Admin card') {
  return authFetch<Card>(`/api/businesses/${businessId}/staff/${userId}/card`, {
    method: 'POST',
    body: JSON.stringify({ label }),
  });
}

// --- Analytics ---

export function getAnalyticsSummary(businessId: string, from?: string, to?: string) {
  const qs = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString();
  return authFetch<AnalyticsSummary>(`/api/businesses/${businessId}/analytics/summary${qs ? `?${qs}` : ''}`);
}

export function getCardBreakdown(businessId: string) {
  return authFetch<CardBreakdownItem[]>(`/api/businesses/${businessId}/analytics/cards`);
}

// --- Loyalty (owner/staff side) ---

export function getLoyaltyProgram(businessId: string) {
  return authFetch<LoyaltyProgramAdmin | null>(`/api/businesses/${businessId}/loyalty/program`);
}

export interface UpsertLoyaltyProgramPayload {
  earnMethod: LoyaltyEarnMethod;
  structure: LoyaltyStructure;
  usePoints: boolean;
  rewardType: RewardType;
  rewardValue: number;
  rewardDescription: string;
  enabled: boolean;
  config: LoyaltyProgramConfig;
}

export function upsertLoyaltyProgram(businessId: string, payload: UpsertLoyaltyProgramPayload) {
  return authFetch<LoyaltyProgramAdmin>(`/api/businesses/${businessId}/loyalty/program`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function listLoyaltyMembers(businessId: string, search?: string) {
  const qs = search ? `?search=${encodeURIComponent(search)}` : '';
  return authFetch<LoyaltyMemberRow[]>(`/api/businesses/${businessId}/loyalty/members${qs}`);
}

export function adjustLoyaltyMember(businessId: string, membershipId: string, payload: { visits?: number; points?: number; spendAmount?: number; note?: string }) {
  return authFetch<LoyaltyMemberRow>(`/api/businesses/${businessId}/loyalty/members/${membershipId}/adjust`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function redeemLoyaltyReward(businessId: string, membershipId: string) {
  return authFetch<LoyaltyMemberRow>(`/api/businesses/${businessId}/loyalty/members/${membershipId}/redeem`, {
    method: 'POST',
  });
}

// --- Reward claims - shown in the same Requests panel as Call Waiter/Request Bill ---

export function listLoyaltyClaims(businessId: string) {
  return authFetch<LoyaltyClaim[]>(`/api/businesses/${businessId}/loyalty/claims`);
}

export function applyManualClaim(businessId: string, claimId: string) {
  return authFetch<LoyaltyClaim>(`/api/businesses/${businessId}/loyalty/claims/${claimId}/apply`, { method: 'PATCH' });
}

// --- Feature entitlements (super_admin only) ---
// See updateBusinessFeatures further below - handles the full nested
// ordering/booking/loyalty/staffAccounts structure.

// --- Menu management (owner/staff) ---

export function listMenuCategories(businessId: string) {
  return authFetch<MenuCategory[]>(`/api/businesses/${businessId}/menu/categories`);
}

export function createMenuCategory(businessId: string, name: string, sortOrder = 0) {
  return authFetch<MenuCategory>(`/api/businesses/${businessId}/menu/categories`, {
    method: 'POST',
    body: JSON.stringify({ name, sortOrder }),
  });
}

export function updateMenuCategory(businessId: string, categoryId: string, payload: { name?: string; sortOrder?: number }) {
  return authFetch<MenuCategory>(`/api/businesses/${businessId}/menu/categories/${categoryId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteMenuCategory(businessId: string, categoryId: string) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/menu/categories/${categoryId}`, { method: 'DELETE' });
}

export function listMenuItems(businessId: string) {
  return authFetch<MenuItem[]>(`/api/businesses/${businessId}/menu/items`);
}

export interface MenuItemPayload {
  categoryId?: string | null;
  name?: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  isAvailable?: boolean;
  sortOrder?: number;
}

export function createMenuItem(businessId: string, payload: MenuItemPayload) {
  return authFetch<MenuItem>(`/api/businesses/${businessId}/menu/items`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateMenuItem(businessId: string, itemId: string, payload: MenuItemPayload) {
  return authFetch<MenuItem>(`/api/businesses/${businessId}/menu/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteMenuItem(businessId: string, itemId: string) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/menu/items/${itemId}`, { method: 'DELETE' });
}

// --- Orders (owner/staff) ---

export function listOrders(businessId: string, status?: OrderStatus) {
  const qs = status ? `?status=${status}` : '';
  return authFetch<OrderRow[]>(`/api/businesses/${businessId}/orders${qs}`);
}

export function updateOrderStatus(businessId: string, orderId: string, status: OrderStatus) {
  return authFetch<OrderRow>(`/api/businesses/${businessId}/orders/${orderId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// --- POS integration (purpose-scoped: 'ordering' or 'booking') ---

// super_admin only - full config including credentials
export function getPosIntegration(businessId: string, purpose: PosPurpose) {
  return authFetch<PosIntegration | null>(`/api/businesses/${businessId}/pos-integration?purpose=${purpose}`);
}

export function upsertPosIntegration(
  businessId: string, purpose: PosPurpose, provider: PosProvider, enabled: boolean, config: Record<string, string>
) {
  return authFetch<PosIntegration>(`/api/businesses/${businessId}/pos-integration`, {
    method: 'PUT',
    body: JSON.stringify({ purpose, provider, enabled, config }),
  });
}

// owner/staff-safe - no credentials
export function getPosIntegrationStatus(businessId: string, purpose: PosPurpose) {
  return authFetch<PosIntegrationStatus | null>(`/api/businesses/${businessId}/pos-integration/status?purpose=${purpose}`);
}

// --- Full features update (super_admin only) - deep-merges nested
// ordering/booking categories on the backend, so partial patches are safe. ---

export function updateBusinessFeatures(businessId: string, patch: Record<string, unknown>) {
  return authFetch<AdminBusiness>(`/api/businesses/${businessId}/features`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

// --- Services (bookable, owner/staff manage) ---

export function listServices(businessId: string) {
  return authFetch<Service[]>(`/api/businesses/${businessId}/services`);
}

export interface ServicePayload {
  name?: string;
  description?: string;
  price?: number;
  durationMinutes?: number;
  isAvailable?: boolean;
  sortOrder?: number;
}

export function createService(businessId: string, payload: ServicePayload) {
  return authFetch<Service>(`/api/businesses/${businessId}/services`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateService(businessId: string, serviceId: string, payload: ServicePayload) {
  return authFetch<Service>(`/api/businesses/${businessId}/services/${serviceId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteService(businessId: string, serviceId: string) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/services/${serviceId}`, { method: 'DELETE' });
}

// --- Bookings (owner/staff view + confirm/decline) ---

export function listBookings(businessId: string, status?: BookingStatus) {
  const qs = status ? `?status=${status}` : '';
  return authFetch<BookingRow[]>(`/api/businesses/${businessId}/bookings${qs}`);
}

export function updateBookingStatus(businessId: string, bookingId: string, status: BookingStatus) {
  return authFetch<BookingRow>(`/api/businesses/${businessId}/bookings/${bookingId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// --- Notification sounds - convenience wrapper around updateBusiness ---

export function updateNotificationSettings(businessId: string, patch: Record<string, Partial<import('../types').NotificationSetting>>) {
  return authFetch<AdminBusiness>(`/api/businesses/${businessId}`, {
    method: 'PATCH',
    body: JSON.stringify({ notificationSettings: patch }),
  });
}

// --- POS integration toggle (owner/staff-safe - never touches credentials) ---

export function togglePosIntegration(businessId: string, purpose: 'ordering' | 'booking', enabled: boolean) {
  return authFetch<PosIntegrationStatus>(`/api/businesses/${businessId}/pos-integration/toggle?purpose=${purpose}`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });
}

// --- Payment integration (Tap Payments) - owner-only for credentials ---

export function getPaymentIntegration(businessId: string) {
  return authFetch<PosIntegration | null>(`/api/businesses/${businessId}/payment-integration`);
}

export function upsertPaymentIntegration(businessId: string, enabled: boolean, config: Record<string, string>) {
  return authFetch<PosIntegration>(`/api/businesses/${businessId}/payment-integration`, {
    method: 'PUT',
    body: JSON.stringify({ enabled, config }),
  });
}

export function getPaymentStatus(businessId: string) {
  return authFetch<{ enabled: boolean; status: string } | null>(`/api/businesses/${businessId}/payment-integration/status`);
}

// --- Payments list (dashboard view) ---

export function listPayments(businessId: string) {
  return authFetch<PaymentRow[]>(`/api/businesses/${businessId}/payments`);
}

// --- Custom buttons - full parity, owner/staff/super_admin can all manage ---

export function listCustomButtons(businessId: string) {
  return authFetch<CustomButton[]>(`/api/businesses/${businessId}/custom-buttons`);
}

export interface CustomButtonPayload {
  label?: string;
  icon?: string;
  url?: string;
  enabled?: boolean;
  sortOrder?: number;
}

export function createCustomButton(businessId: string, payload: CustomButtonPayload) {
  return authFetch<CustomButton>(`/api/businesses/${businessId}/custom-buttons`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateCustomButton(businessId: string, buttonId: string, payload: CustomButtonPayload) {
  return authFetch<CustomButton>(`/api/businesses/${businessId}/custom-buttons/${buttonId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteCustomButton(businessId: string, buttonId: string) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/custom-buttons/${buttonId}`, { method: 'DELETE' });
}

// --- Exports - triggers a real browser download, since these return files, not JSON ---

export async function downloadExport(
  businessId: string,
  kind: 'orders' | 'bookings' | 'payments',
  format: 'csv' | 'pdf',
  range?: { from?: string; to?: string }
) {
  const token = getToken();
  const params = new URLSearchParams({ format });
  if (range?.from) params.set('from', range.from);
  if (range?.to) params.set('to', range.to);
  // Longer timeout than the default - generating a PDF for a business with
  // a lot of history genuinely can take longer than a normal API call.
  const res = await fetchWithTimeout(
    `${BASE}/api/businesses/${businessId}/${kind}/export?${params.toString()}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    30000
  );
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${kind}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// --- Order voiding / clear table / staff-placed orders ---

export function voidOrder(businessId: string, orderId: string, reason?: string) {
  return authFetch<OrderRow>(`/api/businesses/${businessId}/orders/${orderId}/void`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

// --- Call Waiter / Request Bill - a separate, lightweight feed, never
// mixed into the kitchen's order queue ---

export interface RequestRow {
  id: string;
  table_label: string;
  request_type: 'call_waiter' | 'request_bill';
  status: string;
  created_at: string;
}

export function listRequests(businessId: string) {
  return authFetch<RequestRow[]>(`/api/businesses/${businessId}/orders/requests`);
}

export function dismissRequest(businessId: string, requestId: string) {
  return authFetch<RequestRow>(`/api/businesses/${businessId}/orders/requests/${requestId}/dismiss`, { method: 'PATCH' });
}

export function voidOrderItem(businessId: string, orderId: string, itemId: string) {
  return authFetch<{ id: string }>(`/api/businesses/${businessId}/orders/${orderId}/items/${itemId}/void`, {
    method: 'POST',
  });
}

export function clearTable(businessId: string, cardId: string) {
  return authFetch<{ message: string; clearedOrderIds: string[] }>(`/api/businesses/${businessId}/orders/clear-table`, {
    method: 'POST',
    body: JSON.stringify({ cardId }),
  });
}

export interface StaffOrderItemPayload {
  menuItemId: string;
  quantity: number;
  note?: string;
  addonIds?: string[];
}

export function placeStaffOrder(businessId: string, cardId: string, items: StaffOrderItemPayload[], note?: string) {
  return authFetch<{ order: OrderRow }>(`/api/businesses/${businessId}/orders/staff-place`, {
    method: 'POST',
    body: JSON.stringify({ cardId, items, note }),
  });
}

// --- Menu item add-ons ---

export function listAddons(businessId: string, itemId: string) {
  return authFetch<MenuItemAddon[]>(`/api/businesses/${businessId}/menu/items/${itemId}/addons`);
}

export function createAddon(businessId: string, itemId: string, name: string, price: number) {
  return authFetch<MenuItemAddon>(`/api/businesses/${businessId}/menu/items/${itemId}/addons`, {
    method: 'POST',
    body: JSON.stringify({ name, price }),
  });
}

export function updateAddon(businessId: string, itemId: string, addonId: string, payload: { name?: string; price?: number }) {
  return authFetch<MenuItemAddon>(`/api/businesses/${businessId}/menu/items/${itemId}/addons/${addonId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteAddon(businessId: string, itemId: string, addonId: string) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/menu/items/${itemId}/addons/${addonId}`, { method: 'DELETE' });
}

// --- Refunds ---

export function refundPayment(businessId: string, paymentId: string, amount?: number, reason?: string) {
  return authFetch<PaymentRow>(`/api/businesses/${businessId}/payments/${paymentId}/refund`, {
    method: 'POST',
    body: JSON.stringify({ amount, reason }),
  });
}

// --- Audit log ---

export function listAuditLog(businessId: string) {
  return authFetch<AuditLogEntry[]>(`/api/businesses/${businessId}/audit-log`);
}

// --- Support messages ---

export function listMessages(businessId: string) {
  return authFetch<SupportMessage[]>(`/api/businesses/${businessId}/messages`);
}

export function sendMessage(businessId: string, message: string) {
  return authFetch<SupportMessage>(`/api/businesses/${businessId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export function markMessagesRead(businessId: string) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/messages/read`, { method: 'PATCH' });
}

export function getInbox() {
  return authFetch<InboxThread[]>('/api/messages/inbox');
}

// --- Card delete (super_admin only) ---

export function deleteCard(businessId: string, cardId: string) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/cards/${cardId}`, { method: 'DELETE' });
}
