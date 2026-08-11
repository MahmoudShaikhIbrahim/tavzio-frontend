import { authFetch, setSession, getToken, clearSession } from './session';
import { fetchWithTimeout } from './fetchWithTimeout';
import { safeJson } from './safeJson';
import type {
  Profile, AdminBusiness, Card, StaffMember,
  AnalyticsSummary, CardBreakdownItem, LoyaltyProgramAdmin, LoyaltyMemberRow, LoyaltyProgramConfig,
  LoyaltyEarnMethod, LoyaltyStructure, RewardType, LoyaltyClaim,
  MenuCategory, MenuItem, OrderRow, OrderStatus, OrderItemRow,
  PosIntegration, PosIntegrationStatus, PosProvider, PosPurpose,
  Service, BookingRow, BookingStatus,
  CustomButton, PaymentRow, MenuItemAddon, AuditLogEntry, SupportMessage, InboxThread,
  BillingReceipt, BillingReceiptLineItem, ReceiptBranding,
  Contract, Supplier, Ingredient, RecipeLine, PurchaseOrder, Lead, TillSession, FloorTable, WaitlistEntry,
  HotelRoom, HotelGuest, HotelReservation, HotelFolio, HotelFolioCharge,
} from '../types';

const BASE = import.meta.env.VITE_API_BASE_URL || '';

// --- Auth ---

export async function login(email: string, password: string) {
  const res = await fetchWithTimeout(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.message || 'Login failed');
  setSession(data.accessToken, undefined, data.refreshToken);
  return data as { accessToken: string; refreshToken: string; user: { id: string; email: string } };
}

export function getMe() {
  return authFetch<Profile>('/api/auth/me');
}

// Ties theme to the actual logged-in account, not just this browser -
// switches to the account's own saved preference the moment they log in,
// and follows them to any other device they use.
export function updateMyTheme(theme: 'light' | 'dark' | 'system') {
  return authFetch<Profile>('/api/auth/theme', {
    method: 'PATCH',
    body: JSON.stringify({ theme }),
  });
}

export function changePassword(currentPassword: string, newPassword: string) {
  return authFetch<{ message: string }>('/api/auth/change-password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function listLeads() {
  return authFetch<Lead[]>('/api/leads');
}

export function markLeadConverted(leadId: string, businessId?: string) {
  return authFetch<Lead>(`/api/leads/${leadId}`, { method: 'PATCH', body: JSON.stringify({ businessId }) });
}

// --- Till sessions ---

export function getMyOpenTill(businessId: string) {
  return authFetch<TillSession | null>(`/api/businesses/${businessId}/till/mine`);
}

export function openTill(businessId: string, openingFloatAed: number) {
  return authFetch<TillSession>(`/api/businesses/${businessId}/till/open`, { method: 'POST', body: JSON.stringify({ openingFloatAed }) });
}

export function closeTill(businessId: string, tillId: string, countedCashAed: number, notes?: string) {
  return authFetch<TillSession>(`/api/businesses/${businessId}/till/${tillId}/close`, { method: 'POST', body: JSON.stringify({ countedCashAed, notes }) });
}

export function listTillSessions(businessId: string) {
  return authFetch<TillSession[]>(`/api/businesses/${businessId}/till`);
}

// --- POS terminal orders ---

export function createPosOrder(businessId: string, payload: {
  tableLabel: string; items: { menuItemId: string; quantity: number; addonIds?: string[]; note?: string }[]; note?: string; paymentMethod: 'cash' | 'card' | 'card_online' | 'other'; chargeToFolioId?: string;
}) {
  return authFetch<{ order: OrderRow; items: OrderItemRow[]; redirectUrl?: string; transactionId?: string; awaitingPayment?: boolean }>(`/api/businesses/${businessId}/orders/pos`, { method: 'POST', body: JSON.stringify(payload) });
}

export function confirmPosCardPayment(businessId: string, transactionId: string) {
  return authFetch<{ status: string; order?: OrderRow }>(`/api/businesses/${businessId}/orders/pos/confirm-card-payment`, { method: 'POST', body: JSON.stringify({ transactionId }) });
}

// --- Table management ---

export function listFloorTables(businessId: string) {
  return authFetch<FloorTable[]>(`/api/businesses/${businessId}/tables-floor`);
}

export function updateTableStatus(businessId: string, cardId: string, payload: { tableStatus?: string; seatCount?: number }) {
  return authFetch<FloorTable>(`/api/businesses/${businessId}/tables-floor/${cardId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function mergeTables(businessId: string, cardId: string, mergeWithCardId: string) {
  return authFetch<FloorTable>(`/api/businesses/${businessId}/tables-floor/${cardId}/merge`, { method: 'POST', body: JSON.stringify({ mergeWithCardId }) });
}

export function unmergeTable(businessId: string, cardId: string) {
  return authFetch<FloorTable>(`/api/businesses/${businessId}/tables-floor/${cardId}/unmerge`, { method: 'POST' });
}

export function listWaitlist(businessId: string) {
  return authFetch<WaitlistEntry[]>(`/api/businesses/${businessId}/waitlist`);
}

export function addToWaitlist(businessId: string, payload: { guestName: string; partySize: number; phone?: string }) {
  return authFetch<WaitlistEntry>(`/api/businesses/${businessId}/waitlist`, { method: 'POST', body: JSON.stringify(payload) });
}

export function seatWaitlistEntry(businessId: string, entryId: string, cardId: string) {
  return authFetch<WaitlistEntry>(`/api/businesses/${businessId}/waitlist/${entryId}/seat`, { method: 'POST', body: JSON.stringify({ cardId }) });
}

export function cancelWaitlistEntry(businessId: string, entryId: string) {
  return authFetch<WaitlistEntry>(`/api/businesses/${businessId}/waitlist/${entryId}/cancel`, { method: 'POST' });
}

// --- Delivery platform integration (Deliverect) ---

export interface DeliveryIntegration {
  business_id: string;
  provider: string;
  deliverect_account_id?: string;
  deliverect_location_id?: string;
  enabled: boolean;
}

export function getDeliveryIntegration(businessId: string) {
  return authFetch<DeliveryIntegration>(`/api/businesses/${businessId}/delivery-integration`);
}

export function connectDeliveryIntegration(businessId: string) {
  return authFetch<DeliveryIntegration>(`/api/businesses/${businessId}/delivery-integration`, { method: 'PUT' });
}

// --- Hotel PMS ---

export function listRooms(businessId: string) {
  return authFetch<HotelRoom[]>(`/api/businesses/${businessId}/hotel/rooms`);
}
export function createRoom(businessId: string, payload: { roomNumber: string; roomType?: string; floor?: string; maxOccupancy?: number; baseRateAed?: number }) {
  return authFetch<HotelRoom>(`/api/businesses/${businessId}/hotel/rooms`, { method: 'POST', body: JSON.stringify(payload) });
}
export function updateRoom(businessId: string, roomId: string, payload: Partial<{ roomNumber: string; roomType: string; floor: string; maxOccupancy: number; baseRateAed: number; status: string }>) {
  return authFetch<HotelRoom>(`/api/businesses/${businessId}/hotel/rooms/${roomId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function listGuests(businessId: string, search?: string) {
  return authFetch<HotelGuest[]>(`/api/businesses/${businessId}/hotel/guests${search ? `?search=${encodeURIComponent(search)}` : ''}`);
}
export function createGuest(businessId: string, payload: { name: string; email?: string; phone?: string; idDocumentType?: string; idDocumentNumber?: string; nationality?: string; notes?: string }) {
  return authFetch<HotelGuest>(`/api/businesses/${businessId}/hotel/guests`, { method: 'POST', body: JSON.stringify(payload) });
}

export function listReservations(businessId: string, status?: string) {
  return authFetch<HotelReservation[]>(`/api/businesses/${businessId}/hotel/reservations${status ? `?status=${status}` : ''}`);
}
export function createReservation(businessId: string, payload: { guestId: string; roomId?: string | null; checkInDate: string; checkOutDate: string; adults?: number; children?: number; source?: string; rateAed?: number }) {
  return authFetch<HotelReservation>(`/api/businesses/${businessId}/hotel/reservations`, { method: 'POST', body: JSON.stringify(payload) });
}
export function checkInReservation(businessId: string, reservationId: string, roomId?: string) {
  return authFetch<{ reservation: HotelReservation; folio: HotelFolio }>(`/api/businesses/${businessId}/hotel/reservations/${reservationId}/checkin`, { method: 'POST', body: JSON.stringify({ roomId }) });
}
export function checkOutReservation(businessId: string, reservationId: string) {
  return authFetch<HotelReservation>(`/api/businesses/${businessId}/hotel/reservations/${reservationId}/checkout`, { method: 'POST' });
}
export function cancelReservation(businessId: string, reservationId: string) {
  return authFetch<HotelReservation>(`/api/businesses/${businessId}/hotel/reservations/${reservationId}/cancel`, { method: 'POST' });
}

export function getFolio(businessId: string, folioId: string) {
  return authFetch<HotelFolio>(`/api/businesses/${businessId}/hotel/folios/${folioId}`);
}
export function getFoliosByReservation(businessId: string, reservationId: string) {
  return authFetch<HotelFolio[]>(`/api/businesses/${businessId}/hotel/folios/by-reservation/${reservationId}`);
}
export function addFolioCharge(businessId: string, folioId: string, payload: { description: string; amountAed: number; chargeType?: string }) {
  return authFetch<HotelFolioCharge>(`/api/businesses/${businessId}/hotel/folios/${folioId}/charges`, { method: 'POST', body: JSON.stringify(payload) });
}
export function recordFolioPayment(businessId: string, folioId: string, amountAed: number, description?: string) {
  return authFetch<HotelFolioCharge>(`/api/businesses/${businessId}/hotel/folios/${folioId}/payments`, { method: 'POST', body: JSON.stringify({ amountAed, description }) });
}
export function recordFolioDeposit(businessId: string, folioId: string, amountAed: number, description?: string) {
  return authFetch<HotelFolioCharge>(`/api/businesses/${businessId}/hotel/folios/${folioId}/deposit`, { method: 'POST', body: JSON.stringify({ amountAed, description }) });
}
export function recordFolioRefund(businessId: string, folioId: string, amountAed: number, reason: string, description?: string) {
  return authFetch<HotelFolioCharge>(`/api/businesses/${businessId}/hotel/folios/${folioId}/refund`, { method: 'POST', body: JSON.stringify({ amountAed, reason, description }) });
}
export function recordFolioAdjustment(businessId: string, folioId: string, amountAed: number, description: string, reason: string) {
  return authFetch<HotelFolioCharge>(`/api/businesses/${businessId}/hotel/folios/${folioId}/adjustment`, { method: 'POST', body: JSON.stringify({ amountAed, description, reason }) });
}
export function splitFolio(businessId: string, folioId: string, chargeIds: string[], payerType?: string, companyName?: string) {
  return authFetch<HotelFolio>(`/api/businesses/${businessId}/hotel/folios/${folioId}/split`, { method: 'POST', body: JSON.stringify({ chargeIds, payerType, companyName }) });
}
export function transferFolioCharge(businessId: string, folioId: string, chargeId: string, toFolioId: string) {
  return authFetch<HotelFolioCharge>(`/api/businesses/${businessId}/hotel/folios/${folioId}/transfer-charge`, { method: 'POST', body: JSON.stringify({ chargeId, toFolioId }) });
}

export interface HotelRatePlan {
  id: string; business_id: string; name: string; rate_type: string; base_rate_aed: number;
  is_refundable: boolean; meal_plan: string; valid_from: string | null; valid_to: string | null; active: boolean;
}
export function listRatePlans(businessId: string) {
  return authFetch<HotelRatePlan[]>(`/api/businesses/${businessId}/hotel/rate-plans`);
}
export function createRatePlan(businessId: string, payload: { name: string; rateType?: string; baseRateAed: number; isRefundable?: boolean; mealPlan?: string; validFrom?: string; validTo?: string }) {
  return authFetch<HotelRatePlan>(`/api/businesses/${businessId}/hotel/rate-plans`, { method: 'POST', body: JSON.stringify(payload) });
}

export interface NightAudit {
  id: string; business_id: string; business_date: string; run_at: string;
  room_revenue_aed: number; fnb_revenue_aed: number; other_revenue_aed: number; total_payments_aed: number;
  rooms_sold: number; rooms_available: number; occupancy_rate: number; arrivals_count: number; departures_count: number;
}
export function getCurrentBusinessDate(businessId: string) {
  return authFetch<{ businessDate: string }>(`/api/businesses/${businessId}/hotel/business-date`);
}
export function runNightAudit(businessId: string) {
  return authFetch<NightAudit>(`/api/businesses/${businessId}/hotel/night-audit/run`, { method: 'POST' });
}
export function listNightAudits(businessId: string) {
  return authFetch<NightAudit[]>(`/api/businesses/${businessId}/hotel/night-audit`);
}

export interface HousekeepingTask {
  id: string; business_id: string; room_id: string; task_type: string; status: 'pending' | 'in_progress' | 'done';
  assigned_to: string | null; notes: string; created_at: string; hotel_rooms?: { room_number: string }; profiles?: { name: string };
}
export function listHousekeepingTasks(businessId: string, status?: string) {
  return authFetch<HousekeepingTask[]>(`/api/businesses/${businessId}/hotel/housekeeping${status ? `?status=${status}` : ''}`);
}
export function createHousekeepingTask(businessId: string, payload: { roomId: string; taskType?: string; assignedTo?: string | null; notes?: string }) {
  return authFetch<HousekeepingTask>(`/api/businesses/${businessId}/hotel/housekeeping`, { method: 'POST', body: JSON.stringify(payload) });
}
export function updateHousekeepingTask(businessId: string, taskId: string, status: string) {
  return authFetch<HousekeepingTask>(`/api/businesses/${businessId}/hotel/housekeeping/${taskId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export interface MaintenanceTicket {
  id: string; business_id: string; room_id: string | null; title: string; description: string;
  status: 'open' | 'in_progress' | 'resolved'; priority: string; assigned_to: string | null; created_at: string;
  hotel_rooms?: { room_number: string }; profiles?: { name: string };
}
export function listMaintenanceTickets(businessId: string, status?: string) {
  return authFetch<MaintenanceTicket[]>(`/api/businesses/${businessId}/hotel/maintenance${status ? `?status=${status}` : ''}`);
}
export function createMaintenanceTicket(businessId: string, payload: { roomId?: string | null; title: string; description?: string; priority?: string }) {
  return authFetch<MaintenanceTicket>(`/api/businesses/${businessId}/hotel/maintenance`, { method: 'POST', body: JSON.stringify(payload) });
}
export function updateMaintenanceTicket(businessId: string, ticketId: string, payload: { status?: string; priority?: string; assignedTo?: string | null }) {
  return authFetch<MaintenanceTicket>(`/api/businesses/${businessId}/hotel/maintenance/${ticketId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export interface GuestServiceRequest {
  id: string; business_id: string; room_id: string; request_type: string; note: string;
  status: 'pending' | 'in_progress' | 'done'; created_at: string; hotel_rooms?: { room_number: string };
}
export function listGuestRequests(businessId: string, status?: string) {
  return authFetch<GuestServiceRequest[]>(`/api/businesses/${businessId}/hotel/guest-requests${status ? `?status=${status}` : ''}`);
}
export function updateGuestRequest(businessId: string, requestId: string, status: string) {
  return authFetch<GuestServiceRequest>(`/api/businesses/${businessId}/hotel/guest-requests/${requestId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export interface ExternalHotelSystem {
  provider: string; role: string; label: string; requirement: string;
  connected: boolean; enabled: boolean; externalPropertyId: string;
}
export function listExternalHotelSystems(businessId: string) {
  return authFetch<ExternalHotelSystem[]>(`/api/businesses/${businessId}/external-hotel-systems`);
}
export function connectExternalHotelSystem(businessId: string, provider: string, externalPropertyId: string) {
  return authFetch<ExternalHotelSystem>(`/api/businesses/${businessId}/external-hotel-systems/${provider}`, { method: 'PUT', body: JSON.stringify({ externalPropertyId }) });
}

export interface PaymentTransaction {
  id: string; business_id: string; provider: string; transaction_type: 'charge' | 'refund';
  amount_aed: number; status: 'pending' | 'completed' | 'failed'; provider_ref: string;
  context_type: 'restaurant_payment' | 'hotel_folio_charge' | 'pos_order'; context_id: string;
  failure_reason: string; created_at: string; confirmed_at: string | null;
}
export interface UnverifiedManualPayment {
  id: string; folio_id: string; description: string; amount_aed: number; charge_type: string; created_at: string;
}
export function getPaymentReconciliation(businessId: string) {
  return authFetch<{ gatewayTransactions: PaymentTransaction[]; unverifiedManualPayments: UnverifiedManualPayment[] }>(`/api/businesses/${businessId}/payment-reconciliation`);
}
export function refundPaymentTransaction(businessId: string, txnId: string, amountAed?: number, reason?: string) {
  return authFetch<{ status: string }>(`/api/businesses/${businessId}/payment-transactions/${txnId}/refund`, { method: 'POST', body: JSON.stringify({ amountAed, reason }) });
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
  const data = await safeJson(res);
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

export function resetAccountPassword(businessId: string, userId: string) {
  return authFetch<{ tempPassword: string; name: string }>(`/api/businesses/${businessId}/staff/${userId}/reset-password`, {
    method: 'POST',
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

export function updateMenuCategory(businessId: string, categoryId: string, payload: { name?: string; sortOrder?: number; paused?: boolean }) {
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
  offerPrice?: number | null;
  offerStartsAt?: string | null;
  offerEndsAt?: string | null;
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

// --- AI menu upload (PDF / Excel / photos -> draft for review) ---

export interface MenuAiDraftItem {
  name: string;
  price: number;
  currency?: string;
  description?: string;
  photoUrl?: string;
  // True when the cropped photo came from a small region of the source
  // upload and had to be upscaled significantly to reach a usable size -
  // an honest signal that this specific photo may look softer than a
  // genuinely high-resolution source photo would.
  lowResPhoto?: boolean;
}

export interface MenuAiDraftCategory {
  name: string;
  items: MenuAiDraftItem[];
}

export interface MenuAiUnclear {
  imageIndex: number;
  reason: string;
}

export interface MenuAiExtractResult {
  categories: MenuAiDraftCategory[];
  unclear: MenuAiUnclear[];
  warnings: string[];
}

// Reads the server's newline-delimited JSON stream (ping/result/error
// lines) instead of a single JSON response. Deliberately NOT using
// fetchWithTimeout's fixed total-duration timeout here - that's exactly
// the kind of timeout that was killing large menu uploads before, since
// a genuinely big menu can take minutes as long as it's actively
// working. Instead this uses an IDLE timeout that resets on every chunk
// received - only fires if the connection actually goes silent, not
// just because the whole thing is taking a while.
const EXTRACT_IDLE_TIMEOUT_MS = 45000;

export async function extractMenuAi(businessId: string, files: File[]): Promise<MenuAiExtractResult> {
  const formData = new FormData();
  files.forEach((f) => formData.append('files', f));

  const controller = new AbortController();
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), EXTRACT_IDLE_TIMEOUT_MS);
  }
  resetIdleTimer();

  let res: Response;
  try {
    res = await fetch(`${BASE}/api/businesses/${businessId}/menu/ai/extract`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
      signal: controller.signal,
    });
  } catch {
    clearTimeout(idleTimer);
    throw new Error('The server is temporarily unavailable — please try again in a moment.');
  }

  // This call bypasses authFetch's shared refresh-and-retry logic (that
  // helper expects a single JSON response, not a stream) - a 401 here
  // just means signing in again, rather than the fuller silent-refresh
  // dance the rest of the app gets. Rare in practice: this call happens
  // right after opening the upload screen, not deep into a long session.
  if (res.status === 401) {
    clearTimeout(idleTimer);
    clearSession();
    window.location.href = '/admin/login';
    throw new Error('Session expired');
  }

  if (!res.body) {
    clearTimeout(idleTimer);
    throw new Error('The server is temporarily unavailable — please try again in a moment.');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      resetIdleTimer(); // real activity - push the idle deadline back out
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (!line) continue;

        const parsed = JSON.parse(line);
        if (parsed.type === 'result') return parsed.data as MenuAiExtractResult;
        if (parsed.type === 'error') throw new Error(parsed.message || 'Could not read the menu from these files');
        // type === 'ping' - just keeps the idle timer reset, nothing to do
      }
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('The upload timed out - the connection went idle. Please try again.');
    }
    throw err;
  } finally {
    clearTimeout(idleTimer);
  }

  throw new Error('The connection ended before a result was received - please try again.');
}

export function publishMenuAi(businessId: string, categories: MenuAiDraftCategory[]) {
  return authFetch<{ categoriesCreated: number; itemsCreated: number; errors: string[] }>(
    `/api/businesses/${businessId}/menu/ai/publish`,
    { method: 'POST', body: JSON.stringify({ categories }) }
  );
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

export function ackOrderReady(businessId: string, orderId: string) {
  return authFetch<OrderRow>(`/api/businesses/${businessId}/orders/${orderId}/ready-ack`, { method: 'POST' });
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

export function upsertPaymentIntegration(businessId: string, enabled: boolean, config: Record<string, unknown>) {
  return authFetch<PosIntegration>(`/api/businesses/${businessId}/payment-integration`, {
    method: 'PUT',
    body: JSON.stringify({ enabled, config }),
  });
}

// --- Receipt printer (PrintNode) ---

export function getPrinterIntegration(businessId: string) {
  return authFetch<PosIntegration | null>(`/api/businesses/${businessId}/printer-integration`);
}

export function listAvailablePrinters(businessId: string, apiKey: string) {
  return authFetch<{ printers: { id: number; name: string; description: string; state: string }[] }>(
    `/api/businesses/${businessId}/printer-integration/printers`,
    { method: 'POST', body: JSON.stringify({ apiKey }) }
  );
}

export function upsertPrinterIntegration(
  businessId: string,
  body: { enabled: boolean; apiKey: string; printerId: string; printerName: string }
) {
  return authFetch<PosIntegration>(`/api/businesses/${businessId}/printer-integration`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function getPrinterStatus(businessId: string) {
  return authFetch<{ enabled: boolean; status: string; printerName: string } | null>(
    `/api/businesses/${businessId}/printer-integration/status`
  );
}

// --- Table Receipts (no Pay Bill needed) ---

export interface TableWithUnpaid {
  cardId: string;
  tableLabel: string;
  total: number;
  itemCount: number;
}

export function listTablesWithUnpaid(businessId: string) {
  return authFetch<TableWithUnpaid[]>(`/api/businesses/${businessId}/tables`);
}

export function getTableReceipt(businessId: string, cardId: string) {
  return authFetch<{ tableLabel: string; items: OrderItemRow[]; subtotal: number; net: number; vat: number; total: number }>(
    `/api/businesses/${businessId}/tables/${cardId}/receipt`
  );
}

export function printTableReceipt(businessId: string, cardId: string, removedItemIds: string[]) {
  return authFetch<{
    tableLabel: string; items: OrderItemRow[]; subtotal: number; net: number; vat: number;
    receiptText: string; printed: boolean; printError: string | null;
  }>(`/api/businesses/${businessId}/tables/${cardId}/receipt/print`, {
    method: 'POST',
    body: JSON.stringify({ removedItemIds }),
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
  imageUrl?: string | null;
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

export function recordManualPayment(businessId: string, orderId: string, itemIds: string[], method: 'card_machine' | 'cash') {
  return authFetch<{ amount: number; itemCount: number; method: string }>(
    `/api/businesses/${businessId}/orders/${orderId}/manual-payment`,
    { method: 'POST', body: JSON.stringify({ itemIds, method }) }
  );
}

export interface NotificationCounts {
  orders: number;
  requests: number;
  payments: number;
}

export function getNotificationCounts(businessId: string) {
  return authFetch<NotificationCounts>(`/api/businesses/${businessId}/notifications/counts`);
}

export function markSectionViewed(businessId: string, section: 'orders' | 'requests' | 'payments') {
  return authFetch<{ section: string; viewedAt: string }>(`/api/businesses/${businessId}/notifications/${section}/mark-viewed`, {
    method: 'POST',
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

export interface CashPendingItem {
  id: string;
  order_id: string;
  table_label: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  addon_total: number;
}

export function listCashPendingItems(businessId: string) {
  return authFetch<CashPendingItem[]>(`/api/businesses/${businessId}/orders/cash-pending`);
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

// --- Billing receipts ---

export function listReceipts(businessId: string) {
  return authFetch<BillingReceipt[]>(`/api/businesses/${businessId}/receipts`);
}

// super_admin only.
export function createReceipt(
  businessId: string,
  payload: { receiptType: 'one_time' | 'monthly' | 'adjustment'; lineItems: BillingReceiptLineItem[]; periodLabel?: string; notes?: string }
) {
  return authFetch<BillingReceipt>(`/api/businesses/${businessId}/receipts`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// super_admin only.
export function voidReceipt(businessId: string, receiptId: string) {
  return authFetch<BillingReceipt>(`/api/businesses/${businessId}/receipts/${receiptId}`, { method: 'DELETE' });
}

// Fetches the PDF with the auth token attached (a plain <a href> can't
// carry that header) and triggers a real browser download - same
// established pattern as downloadExport above.
export async function downloadReceiptPdf(businessId: string, receiptId: string, receiptNumber: string) {
  const token = getToken();
  const res = await fetchWithTimeout(
    `${BASE}/api/businesses/${businessId}/receipts/${receiptId}/pdf`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    30000
  );
  if (!res.ok) throw new Error('Could not download receipt');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${receiptNumber}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// super_admin only - the currently-active stamp/signature/legal name new
// receipts will use going forward (past receipts are unaffected).
export function getReceiptBranding() {
  return authFetch<ReceiptBranding>('/api/businesses/receipt-branding');
}

export function updateReceiptBranding(payload: { stampUrl?: string; signatureUrl?: string; legalName?: string; issuerTrn?: string }) {
  return authFetch<ReceiptBranding>('/api/businesses/receipt-branding', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

// --- Contracts ---

export function createContract(businessId: string, payload: {
  startDate: string; paymentFrequency: 'monthly' | 'quarterly' | 'yearly';
  standsCount: number; systemFeeOverride?: number; cardPriceOverride?: number;
}) {
  return authFetch<Contract>(`/api/businesses/${businessId}/contracts`, { method: 'POST', body: JSON.stringify(payload) });
}

export function sendContract(businessId: string, contractId: string) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/contracts/${contractId}/send`, { method: 'POST' });
}

export function listContracts(businessId: string) {
  return authFetch<Contract[]>(`/api/businesses/${businessId}/contracts`);
}

export function previewContract(businessId: string, contractId: string) {
  return authFetch<{ text: string }>(`/api/businesses/${businessId}/contracts/${contractId}/preview`);
}

export function signContract(businessId: string, contractId: string, fullName: string) {
  return authFetch<Contract>(`/api/businesses/${businessId}/contracts/${contractId}/sign`, {
    method: 'POST',
    body: JSON.stringify({ fullName }),
  });
}

export function generateContractReceipt(businessId: string, contractId: string) {
  return authFetch<BillingReceipt & { ziinaError?: string | null }>(`/api/businesses/${businessId}/contracts/${contractId}/receipts/next`, { method: 'POST' });
}

// --- Inventory ---

export function listSuppliers(businessId: string) {
  return authFetch<Supplier[]>(`/api/businesses/${businessId}/inventory/suppliers`);
}

export function createSupplier(businessId: string, payload: { name: string; contactName?: string; phone?: string; email?: string }) {
  return authFetch<Supplier>(`/api/businesses/${businessId}/inventory/suppliers`, { method: 'POST', body: JSON.stringify(payload) });
}

export function listIngredients(businessId: string) {
  return authFetch<Ingredient[]>(`/api/businesses/${businessId}/inventory/ingredients`);
}

export function createIngredient(businessId: string, payload: { name: string; unit: string; lowStockThreshold?: number; supplierId?: string | null }) {
  return authFetch<Ingredient>(`/api/businesses/${businessId}/inventory/ingredients`, { method: 'POST', body: JSON.stringify(payload) });
}

export function updateIngredient(businessId: string, ingredientId: string, payload: Partial<{ name: string; unit: string; lowStockThreshold: number; supplierId: string | null }>) {
  return authFetch<Ingredient>(`/api/businesses/${businessId}/inventory/ingredients/${ingredientId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function adjustStock(businessId: string, ingredientId: string, payload: { changeQty: number; reason?: string; note?: string }) {
  return authFetch<Ingredient>(`/api/businesses/${businessId}/inventory/ingredients/${ingredientId}/adjust`, { method: 'POST', body: JSON.stringify(payload) });
}

export function getRecipe(businessId: string, menuItemId: string) {
  return authFetch<RecipeLine[]>(`/api/businesses/${businessId}/inventory/menu-items/${menuItemId}/recipe`);
}

export function setRecipe(businessId: string, menuItemId: string, ingredients: { ingredientId: string; quantity: number }[]) {
  return authFetch<RecipeLine[]>(`/api/businesses/${businessId}/inventory/menu-items/${menuItemId}/recipe`, { method: 'PUT', body: JSON.stringify({ ingredients }) });
}

export function listPurchaseOrders(businessId: string) {
  return authFetch<PurchaseOrder[]>(`/api/businesses/${businessId}/inventory/purchase-orders`);
}

export function createPurchaseOrder(businessId: string, payload: { supplierId?: string | null; items: { ingredientId: string; quantity: number; unitCostAed: number }[] }) {
  return authFetch<PurchaseOrder>(`/api/businesses/${businessId}/inventory/purchase-orders`, { method: 'POST', body: JSON.stringify(payload) });
}

export function receivePurchaseOrder(businessId: string, poId: string) {
  return authFetch<PurchaseOrder>(`/api/businesses/${businessId}/inventory/purchase-orders/${poId}/receive`, { method: 'POST' });
}

// super_admin only - one-time, deliberate action. Overwrites whichever
// webhook is currently registered for the whole Ziina account.
export function registerZiinaWebhook() {
  return authFetch<{ message: string }>('/api/ziina/register-webhook', { method: 'POST' });
}
