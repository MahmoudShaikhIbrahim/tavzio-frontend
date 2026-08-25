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
  Contract, Supplier, Ingredient, RecipeLine, PurchaseOrder, LowStockIngredient, InventoryValuation, WasteReport,
  FoodCostReport, ActualFoodCostReport, StaffSchedule, ScheduleReport, LaborCostReport, MySchedule,
  SalesForecast, BusinessBudget, BudgetVsActual,
  Lead, TillSession, FloorTable, WaitlistEntry,
  HotelRoom, HotelGuest, HotelReservation, HotelFolio, HotelFolioCharge, HotelOutlet, HotelBookingGroup,
  DigitalCard, DigitalCardAnalytics,
  SalaryStructure, PayrollRun, Payslip, PayslipDeduction, WpsExport,
  ChartAccount, JournalEntry, JournalEntryLine, TrialBalance, Vendor, ApBill, ArInvoice,
  ChannelConnection, ChannelBooking,
  MarketingTemplate, MarketingCampaign, MarketingCampaignStats, MarketingSuppression,
  Warehouse, WarehouseStockLine, StockTransfer, PoAllocation, OrgPurchaseOrder,
} from '../types';

const BASE = import.meta.env.VITE_API_BASE_URL || '';

// --- Auth ---

export async function login(email: string, password: string, turnstileToken?: string) {
  const res = await fetchWithTimeout(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, turnstileToken }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.message || 'Login failed');
  setSession(data.accessToken, undefined, data.refreshToken);
  return data as { accessToken: string; refreshToken: string; user: { id: string; email: string } };
}

export function getMe() {
  return authFetch<Profile>('/api/auth/me');
}

export function completeInvite() {
  return authFetch<{ message: string }>('/api/auth/complete-invite', { method: 'POST' });
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

// Same 9 languages as the customer-facing NFC interface - tied to the
// account, not the device, so it follows a staff member to wherever
// they next log in, and each staff account keeps its own choice.
export function updateMyLanguage(language: string) {
  return authFetch<Profile>('/api/auth/language', {
    method: 'PATCH',
    body: JSON.stringify({ language }),
  });
}

// completed=true on finishing or explicitly skipping the tour (both stop
// it auto-opening again); completed=false is what "Restart guide" sends.
export function updateMyTour(completed: boolean) {
  return authFetch<{ id: string; tour_completed_at: string | null }>('/api/auth/tour', {
    method: 'PATCH',
    body: JSON.stringify({ completed }),
  });
}

export function changePassword(currentPassword: string, newPassword: string) {
  return authFetch<{ message: string }>('/api/auth/change-password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function setMyPin(pin: string, currentPin?: string) {
  return authFetch<{ message: string }>('/api/auth/pin', {
    method: 'POST',
    body: JSON.stringify({ pin, currentPin }),
  });
}

export function verifyMyPin(pin: string) {
  return authFetch<{ verified: true }>('/api/auth/pin/verify', {
    method: 'POST',
    body: JSON.stringify({ pin }),
  });
}

export function changeMyEmail(currentPassword: string, newEmail: string) {
  return authFetch<{ message: string; email: string }>('/api/auth/email', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newEmail }),
  });
}

export function listLeads() {
  return authFetch<Lead[]>('/api/leads');
}

export function markLeadConverted(leadId: string, businessId?: string) {
  return authFetch<Lead>(`/api/leads/${leadId}`, { method: 'PATCH', body: JSON.stringify({ businessId }) });
}

// --- Demo Settings (super_admin) ---
// Manages the independent menu backing the public /demo marketing page
// - never linked to any real business's actual menu_items, so deleting
// a real account later (e.g. Al Bait) can never break the demo.

export interface DemoMenuItem {
  id: string;
  name: string;
  description: string;
  price_aed: number;
  image_url: string;
  category: string;
  sort_order: number;
  enabled: boolean;
}

export function listDemoMenuItems() {
  return authFetch<DemoMenuItem[]>('/api/admin/demo/menu-items');
}
export function createDemoMenuItem(payload: { name: string; description?: string; priceAed: number; imageUrl?: string; category?: string; sortOrder?: number }) {
  return authFetch<DemoMenuItem>('/api/admin/demo/menu-items', { method: 'POST', body: JSON.stringify(payload) });
}
export function updateDemoMenuItem(itemId: string, payload: Partial<{ name: string; description: string; priceAed: number; imageUrl: string; category: string; sortOrder: number; enabled: boolean }>) {
  return authFetch<DemoMenuItem>(`/api/admin/demo/menu-items/${itemId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}
export function deleteDemoMenuItem(itemId: string) {
  return authFetch<{ message: string }>(`/api/admin/demo/menu-items/${itemId}`, { method: 'DELETE' });
}
export function importDemoMenuFromBusiness(businessId: string) {
  return authFetch<{ message: string; items: DemoMenuItem[] }>('/api/admin/demo/menu-items/import', { method: 'POST', body: JSON.stringify({ businessId }) });
}

// --- Till sessions ---

export function getMyOpenTill(businessId: string) {
  return authFetch<TillSession | null>(`/api/businesses/${businessId}/till/mine`);
}

export function openTill(businessId: string, openingFloatAed: number, outletId?: string) {
  return authFetch<TillSession>(`/api/businesses/${businessId}/till/open`, { method: 'POST', body: JSON.stringify({ openingFloatAed, outletId }) });
}

export function closeTill(businessId: string, tillId: string, countedCashAed: number, notes?: string) {
  return authFetch<TillSession>(`/api/businesses/${businessId}/till/${tillId}/close`, { method: 'POST', body: JSON.stringify({ countedCashAed, notes }) });
}

export interface XReport {
  tillId: string; staffId: string; openedAt: string; openingFloatAed: number;
  cashSalesTotal: number; cardSalesTotal: number; expectedCashAed: number; generatedAt: string;
}
export function getXReport(businessId: string, tillId: string) {
  return authFetch<XReport>(`/api/businesses/${businessId}/till/${tillId}/x-report`);
}

export function listTillSessions(businessId: string) {
  return authFetch<TillSession[]>(`/api/businesses/${businessId}/till`);
}

// --- POS terminal orders ---

export function createPosOrder(businessId: string, payload: {
  tableLabel?: string; orderType?: 'dine_in' | 'walk_in' | 'pickup' | 'delivery'; items: { menuItemId: string; quantity: number; addonIds?: string[]; note?: string; course?: string }[]; note?: string; chargeToFolioId?: string;
  discountType?: 'percentage' | 'fixed'; discountValue?: number; discountReason?: string;
}) {
  return authFetch<{ order: OrderRow; items: OrderItemRow[] }>(`/api/businesses/${businessId}/orders/pos`, { method: 'POST', body: JSON.stringify(payload) });
}

export function fireCourse(businessId: string, orderId: string, course: string) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/orders/${orderId}/fire-course`, { method: 'POST', body: JSON.stringify({ course }) });
}

// --- Table management ---

export function listFloorTables(businessId: string) {
  return authFetch<FloorTable[]>(`/api/businesses/${businessId}/tables-floor`);
}

export function updateTableStatus(businessId: string, cardId: string, payload: { tableStatus?: 'available' | 'occupied' | 'reserved' | 'cleaning'; seatCount?: number }) {
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
export function createRoom(businessId: string, payload: { roomNumber: string; roomType?: string; floor?: string; maxOccupancy?: number; baseRateAed?: number; cardId?: string }) {
  return authFetch<HotelRoom>(`/api/businesses/${businessId}/hotel/rooms`, { method: 'POST', body: JSON.stringify(payload) });
}
export function updateRoom(businessId: string, roomId: string, payload: Partial<{ roomNumber: string; roomType: string; floor: string; maxOccupancy: number; baseRateAed: number; status: string }>) {
  return authFetch<HotelRoom>(`/api/businesses/${businessId}/hotel/rooms/${roomId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function listGuests(businessId: string, search?: string) {
  return authFetch<HotelGuest[]>(`/api/businesses/${businessId}/hotel/guests${search ? `?search=${encodeURIComponent(search)}` : ''}`);
}
export function matchGuestByPhone(businessId: string, phone: string) {
  return authFetch<HotelGuest[]>(`/api/businesses/${businessId}/hotel/guests/match?phone=${encodeURIComponent(phone)}`);
}
export function createGuest(businessId: string, payload: { name: string; email?: string; phone?: string; idDocumentType?: string; idDocumentNumber?: string; nationality?: string; notes?: string; vip?: boolean; roomPreference?: string; dietaryNotes?: string }) {
  return authFetch<HotelGuest>(`/api/businesses/${businessId}/hotel/guests`, { method: 'POST', body: JSON.stringify(payload) });
}
export function updateGuest(businessId: string, guestId: string, payload: Partial<{ name: string; email: string; phone: string; idDocumentType: string; idDocumentNumber: string; nationality: string; notes: string; vip: boolean; roomPreference: string; dietaryNotes: string }>) {
  return authFetch<HotelGuest>(`/api/businesses/${businessId}/hotel/guests/${guestId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}
export interface GuestStay {
  reservationId: string; checkInDate: string; checkOutDate: string; nights: number; status: string;
  roomNumber: string | null; roomType: string | null; spendAed: number;
}
export interface GuestStayHistory {
  stays: GuestStay[]; totalStays: number; totalNights: number; lifetimeSpendAed: number;
}
export function getGuestStayHistory(businessId: string, guestId: string) {
  return authFetch<GuestStayHistory>(`/api/businesses/${businessId}/hotel/guests/${guestId}/stays`);
}

export function listReservations(businessId: string, status?: string) {
  return authFetch<HotelReservation[]>(`/api/businesses/${businessId}/hotel/reservations${status ? `?status=${status}` : ''}`);
}
export function createReservation(businessId: string, payload: { guestId: string; roomId?: string | null; checkInDate: string; checkOutDate: string; adults?: number; children?: number; source?: string; rateAed?: number; bookingGroupId?: string | null }) {
  return authFetch<HotelReservation>(`/api/businesses/${businessId}/hotel/reservations`, { method: 'POST', body: JSON.stringify(payload) });
}
export function checkInReservation(businessId: string, reservationId: string, roomId?: string) {
  return authFetch<{ reservation: HotelReservation; folio: HotelFolio }>(`/api/businesses/${businessId}/hotel/reservations/${reservationId}/checkin`, { method: 'POST', body: JSON.stringify({ roomId }) });
}
export function checkOutReservation(businessId: string, reservationId: string) {
  return authFetch<HotelReservation>(`/api/businesses/${businessId}/hotel/reservations/${reservationId}/checkout`, { method: 'POST' });
}

// --- Hotel booking groups (block/group bookings - a wedding, a corporate block) ---

export function listBookingGroups(businessId: string) {
  return authFetch<HotelBookingGroup[]>(`/api/businesses/${businessId}/hotel/booking-groups`);
}
export function createBookingGroup(businessId: string, payload: { groupName: string; contactName?: string; contactPhone?: string; contactEmail?: string; notes?: string }) {
  return authFetch<HotelBookingGroup>(`/api/businesses/${businessId}/hotel/booking-groups`, { method: 'POST', body: JSON.stringify(payload) });
}
export function updateBookingGroup(businessId: string, groupId: string, payload: Partial<{ groupName: string; contactName: string; contactPhone: string; contactEmail: string; notes: string }>) {
  return authFetch<HotelBookingGroup>(`/api/businesses/${businessId}/hotel/booking-groups/${groupId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}
export function deleteBookingGroup(businessId: string, groupId: string) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/hotel/booking-groups/${groupId}`, { method: 'DELETE' });
}

export interface CityLedgerEntry {
  id: string; folioId: string; companyName: string; amountAed: number; billedAt: string;
  paidAt: string | null; paymentReference: string; notes: string; daysOutstanding: number | null; guestName: string | null;
}
export function listCityLedgerEntries(businessId: string, status?: 'unpaid' | 'paid') {
  return authFetch<{ entries: CityLedgerEntry[]; totalOutstandingAed: number }>(`/api/businesses/${businessId}/hotel/city-ledger${status ? `?status=${status}` : ''}`);
}
export function settleCityLedgerEntry(businessId: string, entryId: string, payload: { paymentReference?: string; notes?: string }) {
  return authFetch<CityLedgerEntry>(`/api/businesses/${businessId}/hotel/city-ledger/${entryId}/settle`, { method: 'POST', body: JSON.stringify(payload) });
}

export interface HotelEventSpace {
  id: string; business_id: string; name: string; capacity: number; hourly_rate_aed: number; description: string; active: boolean;
}
export function listEventSpaces(businessId: string) {
  return authFetch<HotelEventSpace[]>(`/api/businesses/${businessId}/hotel/event-spaces`);
}
export function createEventSpace(businessId: string, payload: { name: string; capacity?: number; hourlyRateAed?: number; description?: string }) {
  return authFetch<HotelEventSpace>(`/api/businesses/${businessId}/hotel/event-spaces`, { method: 'POST', body: JSON.stringify(payload) });
}
export function updateEventSpace(businessId: string, spaceId: string, payload: Partial<{ name: string; capacity: number; hourlyRateAed: number; description: string; active: boolean }>) {
  return authFetch<HotelEventSpace>(`/api/businesses/${businessId}/hotel/event-spaces/${spaceId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export interface HotelEventCharge {
  id: string; event_id: string; description: string; amount_aed: number; charge_type: string; created_at: string;
}
export interface HotelEvent {
  id: string; business_id: string; event_space_id: string | null; client_name: string; client_phone: string; client_email: string;
  event_type: 'wedding' | 'conference' | 'meeting' | 'corporate' | 'social' | 'other';
  event_date: string; start_time: string; end_time: string; expected_attendance: number;
  status: 'inquiry' | 'tentative' | 'confirmed' | 'completed' | 'cancelled';
  sales_notes: string; hotel_event_spaces?: { name: string; capacity: number } | null;
}
export interface HotelEventDetail extends HotelEvent {
  charges: HotelEventCharge[];
  balance: number;
}
export function listEvents(businessId: string, params?: { from?: string; to?: string; status?: string }) {
  const qs = new URLSearchParams();
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  if (params?.status) qs.set('status', params.status);
  const s = qs.toString();
  return authFetch<HotelEvent[]>(`/api/businesses/${businessId}/hotel/events${s ? `?${s}` : ''}`);
}
export function getEvent(businessId: string, eventId: string) {
  return authFetch<HotelEventDetail>(`/api/businesses/${businessId}/hotel/events/${eventId}`);
}
export function createEvent(businessId: string, payload: {
  eventSpaceId?: string | null; clientName: string; clientPhone?: string; clientEmail?: string; eventType?: string;
  eventDate: string; startTime: string; endTime: string; expectedAttendance?: number; status?: string; salesNotes?: string;
}) {
  return authFetch<HotelEvent>(`/api/businesses/${businessId}/hotel/events`, { method: 'POST', body: JSON.stringify(payload) });
}
export function updateEvent(businessId: string, eventId: string, payload: Partial<{
  status: string; eventSpaceId: string | null; eventDate: string; startTime: string; endTime: string; expectedAttendance: number; salesNotes: string;
}>) {
  return authFetch<HotelEvent>(`/api/businesses/${businessId}/hotel/events/${eventId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}
export function addEventCharge(businessId: string, eventId: string, payload: { description: string; amountAed: number; chargeType?: string }) {
  return authFetch<HotelEventCharge>(`/api/businesses/${businessId}/hotel/events/${eventId}/charges`, { method: 'POST', body: JSON.stringify(payload) });
}
export function recordEventPayment(businessId: string, eventId: string, payload: { amountAed: number; description?: string }) {
  return authFetch<HotelEventCharge>(`/api/businesses/${businessId}/hotel/events/${eventId}/payment`, { method: 'POST', body: JSON.stringify(payload) });
}
export function deleteEventCharge(businessId: string, eventId: string, chargeId: string) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/hotel/events/${eventId}/charges/${chargeId}`, { method: 'DELETE' });
}
export interface EventPipelineSummary {
  from: string; to: string; byStatus: Record<string, number>; totalEvents: number; totalBilledAed: number;
}
export function getEventPipelineSummary(businessId: string, from?: string, to?: string) {
  const qs = new URLSearchParams();
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  const s = qs.toString();
  return authFetch<EventPipelineSummary>(`/api/businesses/${businessId}/hotel/events-pipeline-summary${s ? `?${s}` : ''}`);
}
export function cancelReservation(businessId: string, reservationId: string) {
  return authFetch<HotelReservation>(`/api/businesses/${businessId}/hotel/reservations/${reservationId}/cancel`, { method: 'POST' });
}
export function markReservationNoShow(businessId: string, reservationId: string) {
  return authFetch<HotelReservation>(`/api/businesses/${businessId}/hotel/reservations/${reservationId}/no-show`, { method: 'POST' });
}
export function modifyReservation(businessId: string, reservationId: string, payload: Partial<{ checkInDate: string; checkOutDate: string; roomId: string | null; rateAed: number }>) {
  return authFetch<HotelReservation>(`/api/businesses/${businessId}/hotel/reservations/${reservationId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}
export function transferReservationRoom(businessId: string, reservationId: string, newRoomId: string) {
  return authFetch<HotelReservation>(`/api/businesses/${businessId}/hotel/reservations/${reservationId}/transfer-room`, { method: 'POST', body: JSON.stringify({ newRoomId }) });
}

export function getFolio(businessId: string, folioId: string) {
  return authFetch<HotelFolio>(`/api/businesses/${businessId}/hotel/folios/${folioId}`);
}
export function getFoliosByReservation(businessId: string, reservationId: string) {
  return authFetch<HotelFolio[]>(`/api/businesses/${businessId}/hotel/folios/by-reservation/${reservationId}`);
}
// Room-number search for the POS "Charge to Room" flow.
export function lookupFolioByRoom(businessId: string, roomNumber: string) {
  return authFetch<{ folioId: string; roomNumber: string; guestName: string }>(
    `/api/businesses/${businessId}/hotel/folios/lookup?roomNumber=${encodeURIComponent(roomNumber)}`
  );
}
export interface TourismDirhamCharge {
  id: string; description: string; amount_aed: number; created_at: string;
  hotel_folios?: { hotel_reservations?: { hotel_rooms?: { room_number: string }; hotel_guests?: { name: string } } };
}
export function getTourismDirhamReport(businessId: string, range?: { from?: string; to?: string }) {
  const params = new URLSearchParams();
  if (range?.from) params.set('from', range.from);
  if (range?.to) params.set('to', range.to);
  const qs = params.toString();
  return authFetch<{ charges: TourismDirhamCharge[]; total: number; count: number }>(
    `/api/businesses/${businessId}/hotel/tourism-dirham-report${qs ? `?${qs}` : ''}`
  );
}

// --- Hotel outlets (Room Service / Bars / Pool / Breakfast, sharing the existing F&B menu) ---

export function listHotelOutlets(businessId: string) {
  return authFetch<HotelOutlet[]>(`/api/businesses/${businessId}/hotel/outlets`);
}
export function createHotelOutlet(businessId: string, payload: { name: string; outletType: string; location?: string; openingHours?: string; sortOrder?: number }) {
  return authFetch<HotelOutlet>(`/api/businesses/${businessId}/hotel/outlets`, { method: 'POST', body: JSON.stringify(payload) });
}
export function updateHotelOutlet(businessId: string, outletId: string, payload: Partial<{ name: string; enabled: boolean; location: string; openingHours: string; sortOrder: number }>) {
  return authFetch<HotelOutlet>(`/api/businesses/${businessId}/hotel/outlets/${outletId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}
export function deleteHotelOutlet(businessId: string, outletId: string) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/hotel/outlets/${outletId}`, { method: 'DELETE' });
}
export function setHotelOutletItems(businessId: string, outletId: string, menuItemIds: string[]) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/hotel/outlets/${outletId}/items`, { method: 'PUT', body: JSON.stringify({ menuItemIds }) });
}

export interface HotelGuestServiceRow {
  id: string; business_id: string; routing_type: string; label: string; options: string[]; enabled: boolean; sort_order: number;
}
export const GUEST_SERVICE_ROUTING_TYPES = ['towels', 'turndown', 'housekeeping', 'maintenance', 'taxi', 'laundry', 'pool', 'transportation', 'other'] as const;
export function listGuestServices(businessId: string) {
  return authFetch<HotelGuestServiceRow[]>(`/api/businesses/${businessId}/hotel/guest-services`);
}
export function createGuestService(businessId: string, payload: { routingType: string; label: string; options?: string[]; sortOrder?: number }) {
  return authFetch<HotelGuestServiceRow>(`/api/businesses/${businessId}/hotel/guest-services`, { method: 'POST', body: JSON.stringify(payload) });
}
export function updateGuestService(businessId: string, serviceId: string, payload: Partial<{ label: string; options: string[]; enabled: boolean; sortOrder: number; routingType: string }>) {
  return authFetch<HotelGuestServiceRow>(`/api/businesses/${businessId}/hotel/guest-services/${serviceId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}
export function deleteGuestService(businessId: string, serviceId: string) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/hotel/guest-services/${serviceId}`, { method: 'DELETE' });
}
export function addFolioCharge(businessId: string, folioId: string, payload: { description: string; amountAed: number; chargeType?: string }) {
  return authFetch<HotelFolioCharge>(`/api/businesses/${businessId}/hotel/folios/${folioId}/charges`, { method: 'POST', body: JSON.stringify(payload) });
}
export function deleteFolioCharge(businessId: string, folioId: string, chargeId: string) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/hotel/folios/${folioId}/charges/${chargeId}`, { method: 'DELETE' });
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
export function createRatePlan(businessId: string, payload: { name: string; rateType?: string; baseRateAed: number; isRefundable?: boolean; mealPlan?: string; validFrom?: string | null; validTo?: string | null }) {
  return authFetch<HotelRatePlan>(`/api/businesses/${businessId}/hotel/rate-plans`, { method: 'POST', body: JSON.stringify(payload) });
}
export function updateRatePlan(businessId: string, ratePlanId: string, payload: Partial<{ name: string; rateType: string; baseRateAed: number; isRefundable: boolean; mealPlan: string; validFrom: string | null; validTo: string | null; active: boolean }>) {
  return authFetch<HotelRatePlan>(`/api/businesses/${businessId}/hotel/rate-plans/${ratePlanId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export interface HotelRateOverride {
  id: string; business_id: string; rate_plan_id: string; override_date: string; rate_aed: number;
}
export function listRateOverrides(businessId: string, ratePlanId?: string) {
  return authFetch<HotelRateOverride[]>(`/api/businesses/${businessId}/hotel/revenue/rate-overrides${ratePlanId ? `?ratePlanId=${ratePlanId}` : ''}`);
}
export function setRateOverride(businessId: string, payload: { ratePlanId: string; overrideDate: string; rateAed: number }) {
  return authFetch<HotelRateOverride>(`/api/businesses/${businessId}/hotel/revenue/rate-overrides`, { method: 'PUT', body: JSON.stringify(payload) });
}
export function deleteRateOverride(businessId: string, overrideId: string) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/hotel/revenue/rate-overrides/${overrideId}`, { method: 'DELETE' });
}

export interface HotelPricingRule {
  id: string; business_id: string; name: string; occupancy_threshold_pct: number; surcharge_pct: number; active: boolean;
}
export function listPricingRules(businessId: string) {
  return authFetch<HotelPricingRule[]>(`/api/businesses/${businessId}/hotel/revenue/pricing-rules`);
}
export function createPricingRule(businessId: string, payload: { name: string; occupancyThresholdPct: number; surchargePct: number }) {
  return authFetch<HotelPricingRule>(`/api/businesses/${businessId}/hotel/revenue/pricing-rules`, { method: 'POST', body: JSON.stringify(payload) });
}
export function updatePricingRule(businessId: string, ruleId: string, payload: Partial<{ name: string; occupancyThresholdPct: number; surchargePct: number; active: boolean }>) {
  return authFetch<HotelPricingRule>(`/api/businesses/${businessId}/hotel/revenue/pricing-rules/${ruleId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}
export function deletePricingRule(businessId: string, ruleId: string) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/hotel/revenue/pricing-rules/${ruleId}`, { method: 'DELETE' });
}

export interface EffectiveRate {
  ratePlanId: string; date: string; baseRateAed: number; overrideApplied: boolean; rateBeforeSurchargeAed: number;
  occupancyPct: number; appliedRule: { id: string; name: string; surchargePct: number } | null; finalRateAed: number;
}
export function getEffectiveRate(businessId: string, ratePlanId: string, date: string) {
  return authFetch<EffectiveRate>(`/api/businesses/${businessId}/hotel/revenue/effective-rate?ratePlanId=${ratePlanId}&date=${date}`);
}

export interface OccupancyForecast {
  days: number;
  forecast: { date: string; occupancyPct: number; totalRooms: number; occupiedRooms: number }[];
}
export function getOccupancyForecast(businessId: string, days = 14) {
  return authFetch<OccupancyForecast>(`/api/businesses/${businessId}/hotel/revenue/occupancy-forecast?days=${days}`);
}

export interface NightAudit {
  id: string; business_id: string; business_date: string; run_at: string;
  room_revenue_aed: number; fnb_revenue_aed: number; other_revenue_aed: number; total_payments_aed: number;
  rooms_sold: number; rooms_available: number; occupancy_rate: number; arrivals_count: number; departures_count: number;
  no_shows_processed: number; unresolved_departures_count: number;
}
export function getCurrentBusinessDate(businessId: string) {
  return authFetch<{ businessDate: string }>(`/api/businesses/${businessId}/hotel/business-date`);
}
export interface NightAuditPreview {
  businessDate: string; alreadyRun: boolean; noShowCandidateCount: number; unresolvedDeparturesCount: number;
}
export function getNightAuditPreview(businessId: string) {
  return authFetch<NightAuditPreview>(`/api/businesses/${businessId}/hotel/night-audit/preview`);
}
export function runNightAudit(businessId: string) {
  return authFetch<NightAudit>(`/api/businesses/${businessId}/hotel/night-audit/run`, { method: 'POST' });
}
export function listNightAudits(businessId: string) {
  return authFetch<NightAudit[]>(`/api/businesses/${businessId}/hotel/night-audit`);
}

export interface HousekeepingTask {
  id: string; business_id: string; room_id: string; task_type: string; status: 'pending' | 'in_progress' | 'done';
  priority: 'normal' | 'urgent'; assigned_to: string | null; notes: string; created_at: string; started_at: string | null; completed_at: string | null;
  hotel_rooms?: { room_number: string }; profiles?: { name: string };
}
export function listHousekeepingTasks(businessId: string, status?: string) {
  return authFetch<HousekeepingTask[]>(`/api/businesses/${businessId}/hotel/housekeeping${status ? `?status=${status}` : ''}`);
}
export function createHousekeepingTask(businessId: string, payload: { roomId: string; taskType?: string; assignedTo?: string | null; notes?: string; priority?: 'normal' | 'urgent' }) {
  return authFetch<HousekeepingTask>(`/api/businesses/${businessId}/hotel/housekeeping`, { method: 'POST', body: JSON.stringify(payload) });
}
export function updateHousekeepingTask(businessId: string, taskId: string, status: string) {
  return authFetch<HousekeepingTask>(`/api/businesses/${businessId}/hotel/housekeeping/${taskId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
}
export interface HousekeepingPerformance {
  days: number; taskCount: number; completedCount: number; avgQueueTimeMins: number | null; avgCleanTimeMins: number | null;
}
export function getHousekeepingPerformance(businessId: string, days = 7) {
  return authFetch<HousekeepingPerformance>(`/api/businesses/${businessId}/hotel/housekeeping-performance?days=${days}`);
}

export interface MaintenanceTicket {
  id: string; business_id: string; room_id: string | null; title: string; description: string;
  status: 'open' | 'in_progress' | 'resolved'; priority: string; assigned_to: string | null; created_at: string;
  started_at: string | null; resolved_at: string | null; took_room_out_of_service: boolean;
  estimated_cost_aed: number | null; actual_cost_aed: number | null;
  hotel_rooms?: { room_number: string }; profiles?: { name: string };
}
export function listMaintenanceTickets(businessId: string, status?: string) {
  return authFetch<MaintenanceTicket[]>(`/api/businesses/${businessId}/hotel/maintenance${status ? `?status=${status}` : ''}`);
}
export function createMaintenanceTicket(businessId: string, payload: { roomId?: string | null; title: string; description?: string; priority?: string; takeRoomOutOfService?: boolean; estimatedCostAed?: number | null }) {
  return authFetch<MaintenanceTicket>(`/api/businesses/${businessId}/hotel/maintenance`, { method: 'POST', body: JSON.stringify(payload) });
}
export function updateMaintenanceTicket(businessId: string, ticketId: string, payload: { status?: string; priority?: string; assignedTo?: string | null; actualCostAed?: number | null }) {
  return authFetch<MaintenanceTicket>(`/api/businesses/${businessId}/hotel/maintenance/${ticketId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}
export interface MaintenancePerformance {
  days: number; ticketCount: number; resolvedCount: number; urgentOpenCount: number;
  avgQueueTimeMins: number | null; avgRepairTimeMins: number | null; totalActualCostAed: number;
}
export function getMaintenancePerformance(businessId: string, days = 30) {
  return authFetch<MaintenancePerformance>(`/api/businesses/${businessId}/hotel/maintenance-performance?days=${days}`);
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
export function disconnectExternalHotelSystem(businessId: string, provider: string) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/external-hotel-systems/${provider}`, { method: 'DELETE' });
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

// --- Digital Business Card ---

export function getBusinessDigitalCard(businessId: string) {
  return authFetch<DigitalCard | null>(`/api/businesses/${businessId}/digital-card`);
}

export function createBusinessDigitalCard(businessId: string) {
  return authFetch<DigitalCard>(`/api/businesses/${businessId}/digital-card`, { method: 'POST' });
}

export function updateBusinessDigitalCard(businessId: string, cardId: string, payload: Partial<DigitalCard>) {
  return authFetch<DigitalCard>(`/api/businesses/${businessId}/digital-card/${cardId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function getBusinessDigitalCardAnalytics(businessId: string, cardId: string) {
  return authFetch<DigitalCardAnalytics>(`/api/businesses/${businessId}/digital-card/${cardId}/analytics`);
}

export function listSuperAdminDigitalCards() {
  return authFetch<DigitalCard[]>('/api/super-admin/digital-cards');
}

export function createSuperAdminDigitalCard(payload: Partial<DigitalCard> & { name: string; cardType: 'business' | 'person' }) {
  return authFetch<DigitalCard>('/api/super-admin/digital-cards', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateSuperAdminDigitalCard(cardId: string, payload: Partial<DigitalCard>) {
  return authFetch<DigitalCard>(`/api/super-admin/digital-cards/${cardId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function deleteSuperAdminDigitalCard(cardId: string) {
  return authFetch<{ message: string }>(`/api/super-admin/digital-cards/${cardId}`, { method: 'DELETE' });
}

export function getSuperAdminDigitalCardAnalytics(cardId: string) {
  return authFetch<DigitalCardAnalytics>(`/api/super-admin/digital-cards/${cardId}/analytics`);
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

export function updateCard(businessId: string, cardId: string, payload: { label?: string; status?: string; roomId?: string | null }) {
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

export function inviteStaff(businessId: string, name: string, email: string, sections?: string[] | null) {
  return authFetch<StaffMember>(`/api/businesses/${businessId}/staff`, {
    method: 'POST',
    body: JSON.stringify({ name, email, sections: sections ?? null }),
  });
}

export function deleteStaffAccount(businessId: string, userId: string) {
  return authFetch<{ message: string; id: string }>(`/api/businesses/${businessId}/staff/${userId}`, {
    method: 'DELETE',
  });
}

// --- Self-service organizations (multi-location) ---

export interface BusinessOrganization {
  id: string;
  name: string;
  created_at: string;
}

export function getBusinessOrganization(businessId: string) {
  return authFetch<BusinessOrganization | null>(`/api/businesses/${businessId}/organization`);
}

export function appointOrgOwner(
  businessId: string,
  payload: { name: string; email: string; orgName?: string } | { staffId: string; orgName?: string }
) {
  return authFetch<StaffMember>(`/api/businesses/${businessId}/organization/owner`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function leaveOrganization(businessId: string) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/organization`, { method: 'DELETE' });
}

export function setOrgOwnerStatus(businessId: string, userId: string, isOrgOwner: boolean) {
  return authFetch<StaffMember>(`/api/businesses/${businessId}/organization/owner/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ isOrgOwner }),
  });
}

// getMyOpenShift returns null (a bare 204/empty-body-shaped response) when
// nothing's open - authFetch<StaffShift | null> models that honestly
// rather than pretending there's always a shift object.
export interface StaffShift {
  id: string; business_id: string; staff_id: string; clock_in_at: string; clock_out_at: string | null;
  hours?: number | null; profiles?: { name: string };
}
export function getMyOpenShift(businessId: string) {
  return authFetch<StaffShift | null>(`/api/businesses/${businessId}/staff-shifts/mine`);
}
export function clockIn(businessId: string) {
  return authFetch<StaffShift>(`/api/businesses/${businessId}/staff-shifts/clock-in`, { method: 'POST' });
}
export function clockOut(businessId: string) {
  return authFetch<StaffShift>(`/api/businesses/${businessId}/staff-shifts/clock-out`, { method: 'POST' });
}
export function listStaffShifts(businessId: string, range?: { from?: string; to?: string }) {
  const params = new URLSearchParams();
  if (range?.from) params.set('from', range.from);
  if (range?.to) params.set('to', range.to);
  const qs = params.toString();
  return authFetch<StaffShift[]>(`/api/businesses/${businessId}/staff-shifts${qs ? `?${qs}` : ''}`);
}

// --- HR module (owner-only: staff documents, commission, tip pooling) ---

export interface StaffDocument {
  id: string; business_id: string; staff_id: string; doc_type: string; file_url: string;
  label: string; expiry_date: string | null; created_at: string; profiles?: { name: string };
}
export function listStaffDocuments(businessId: string) {
  return authFetch<StaffDocument[]>(`/api/businesses/${businessId}/hr/documents`);
}
export function uploadStaffDocument(businessId: string, payload: { staffId: string; docType: string; fileUrl: string; label?: string; expiryDate?: string | null }) {
  return authFetch<StaffDocument>(`/api/businesses/${businessId}/hr/documents`, { method: 'POST', body: JSON.stringify(payload) });
}
export function deleteStaffDocument(businessId: string, documentId: string) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/hr/documents/${documentId}`, { method: 'DELETE' });
}

export function setStaffCommission(businessId: string, staffId: string, payload: { commissionType: 'percentage' | 'fixed_per_order' | null; commissionRate?: number }) {
  return authFetch<{ id: string; name: string; commission_type: string | null; commission_rate: number | null }>(
    `/api/businesses/${businessId}/hr/commission/${staffId}`, { method: 'PATCH', body: JSON.stringify(payload) }
  );
}
export interface CommissionReportRow {
  staffId: string; name: string; commissionType: string; commissionRate: number; orderCount: number; salesTotal: number; commission: number;
}
export function getCommissionReport(businessId: string, range?: { from?: string; to?: string }) {
  const params = new URLSearchParams();
  if (range?.from) params.set('from', range.from);
  if (range?.to) params.set('to', range.to);
  const qs = params.toString();
  return authFetch<{ from: string; to: string; report: CommissionReportRow[]; totalCommission: number }>(
    `/api/businesses/${businessId}/hr/commission-report${qs ? `?${qs}` : ''}`
  );
}

export interface TipDistribution {
  id: string; business_id: string; period_start: string; period_end: string; total_amount_aed: number; method: 'even' | 'by_hours'; created_at: string;
  tip_distribution_shares?: { id: string; staff_id: string; amount_aed: number; profiles?: { name: string } }[];
}
export function listTipDistributions(businessId: string) {
  return authFetch<TipDistribution[]>(`/api/businesses/${businessId}/hr/tip-distributions`);
}
export function createTipDistribution(businessId: string, payload: { periodStart: string; periodEnd: string; totalAmountAed: number; method: 'even' | 'by_hours'; staffIds: string[] }) {
  return authFetch<{ distribution: TipDistribution; shares: { staffId: string; amount: number }[] }>(
    `/api/businesses/${businessId}/hr/tip-distributions`, { method: 'POST', body: JSON.stringify(payload) }
  );
}

export function setStaffWage(businessId: string, staffId: string, hourlyRateAed: number | null) {
  return authFetch<{ id: string; name: string; hourly_rate_aed: number | null }>(
    `/api/businesses/${businessId}/hr/wage/${staffId}`, { method: 'PATCH', body: JSON.stringify({ hourlyRateAed }) }
  );
}

export function listSchedules(businessId: string, range?: { from?: string; to?: string }) {
  const params = new URLSearchParams();
  if (range?.from) params.set('from', range.from);
  if (range?.to) params.set('to', range.to);
  const qs = params.toString();
  return authFetch<ScheduleReport>(`/api/businesses/${businessId}/hr/schedules${qs ? `?${qs}` : ''}`);
}
export function createSchedule(businessId: string, payload: { staffId: string; scheduledStart: string; scheduledEnd: string; roleLabel?: string; notes?: string }) {
  return authFetch<StaffSchedule>(`/api/businesses/${businessId}/hr/schedules`, { method: 'POST', body: JSON.stringify(payload) });
}
export function updateSchedule(businessId: string, scheduleId: string, payload: Partial<{ scheduledStart: string; scheduledEnd: string; roleLabel: string; notes: string }>) {
  return authFetch<StaffSchedule>(`/api/businesses/${businessId}/hr/schedules/${scheduleId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}
export function deleteSchedule(businessId: string, scheduleId: string) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/hr/schedules/${scheduleId}`, { method: 'DELETE' });
}

export function getLaborCostReport(businessId: string, range?: { from?: string; to?: string }) {
  const params = new URLSearchParams();
  if (range?.from) params.set('from', range.from);
  if (range?.to) params.set('to', range.to);
  const qs = params.toString();
  return authFetch<LaborCostReport>(`/api/businesses/${businessId}/hr/labor-cost${qs ? `?${qs}` : ''}`);
}

export function getMySchedule(businessId: string) {
  return authFetch<MySchedule[]>(`/api/businesses/${businessId}/staff-shifts/my-schedule`);
}

export function getSalesForecast(businessId: string, days = 7) {
  return authFetch<SalesForecast>(`/api/businesses/${businessId}/forecasting/sales-forecast?days=${days}`);
}
export function getBudget(businessId: string, month: string) {
  return authFetch<BusinessBudget | null>(`/api/businesses/${businessId}/forecasting/budget?month=${month}`);
}
export function setBudget(businessId: string, payload: { month: string; revenueBudgetAed?: number | null; foodCostPctBudget?: number | null; laborCostPctBudget?: number | null }) {
  return authFetch<BusinessBudget>(`/api/businesses/${businessId}/forecasting/budget`, { method: 'PUT', body: JSON.stringify(payload) });
}
export function getBudgetVsActual(businessId: string, month: string) {
  return authFetch<BudgetVsActual>(`/api/businesses/${businessId}/forecasting/budget-vs-actual?month=${month}`);
}

// --- Payroll ---

export function listSalaryStructures(businessId: string) {
  return authFetch<SalaryStructure[]>(`/api/businesses/${businessId}/payroll/salary-structures`);
}
export function setSalaryStructure(businessId: string, payload: {
  staffId: string; payType: 'monthly' | 'hourly' | 'daily'; baseAmountAed: number;
  housingAllowanceAed?: number; transportAllowanceAed?: number; otherAllowancesAed?: number;
}) {
  return authFetch<SalaryStructure>(`/api/businesses/${businessId}/payroll/salary-structures`, { method: 'POST', body: JSON.stringify(payload) });
}
export function listPayrollRuns(businessId: string) {
  return authFetch<PayrollRun[]>(`/api/businesses/${businessId}/payroll/runs`);
}
export function createPayrollRun(businessId: string, periodStart: string, periodEnd: string) {
  return authFetch<PayrollRun>(`/api/businesses/${businessId}/payroll/runs`, { method: 'POST', body: JSON.stringify({ periodStart, periodEnd }) });
}
export function listPayslipsForRun(businessId: string, runId: string) {
  return authFetch<Payslip[]>(`/api/businesses/${businessId}/payroll/runs/${runId}/payslips`);
}
export function setPayslipDeductions(businessId: string, runId: string, payslipId: string, deductions: PayslipDeduction[]) {
  return authFetch<Payslip>(`/api/businesses/${businessId}/payroll/runs/${runId}/deductions/${payslipId}`, { method: 'PATCH', body: JSON.stringify({ deductions }) });
}
export function approvePayrollRun(businessId: string, runId: string) {
  return authFetch<PayrollRun>(`/api/businesses/${businessId}/payroll/runs/${runId}/approve`, { method: 'PATCH' });
}
export function markPayrollRunPaid(businessId: string, runId: string) {
  return authFetch<PayrollRun>(`/api/businesses/${businessId}/payroll/runs/${runId}/mark-paid`, { method: 'PATCH' });
}
export function recordWpsExport(businessId: string, runId: string) {
  return authFetch<WpsExport>(`/api/businesses/${businessId}/payroll/runs/${runId}/wps-export`, { method: 'POST' });
}
export function getMyPayslips(businessId: string) {
  return authFetch<Payslip[]>(`/api/businesses/${businessId}/payroll/my-payslips`);
}

// --- Accounting ---

export function listAccounts(businessId: string) {
  return authFetch<ChartAccount[]>(`/api/businesses/${businessId}/accounting/accounts`);
}
export function createAccount(businessId: string, payload: { code: string; name: string; accountType: ChartAccount['account_type']; parentAccountId?: string | null }) {
  return authFetch<ChartAccount>(`/api/businesses/${businessId}/accounting/accounts`, { method: 'POST', body: JSON.stringify(payload) });
}
export function seedDefaultAccounts(businessId: string) {
  return authFetch<ChartAccount[]>(`/api/businesses/${businessId}/accounting/accounts/seed-defaults`, { method: 'POST' });
}
export function listJournalEntries(businessId: string, range?: { from?: string; to?: string }) {
  const params = new URLSearchParams();
  if (range?.from) params.set('from', range.from);
  if (range?.to) params.set('to', range.to);
  const qs = params.toString();
  return authFetch<JournalEntry[]>(`/api/businesses/${businessId}/accounting/journal-entries${qs ? `?${qs}` : ''}`);
}
export function createJournalEntry(businessId: string, payload: { entryDate?: string; reference?: string; description?: string; lines: JournalEntryLine[] }) {
  return authFetch<JournalEntry>(`/api/businesses/${businessId}/accounting/journal-entries`, { method: 'POST', body: JSON.stringify(payload) });
}
export function postJournalEntry(businessId: string, entryId: string) {
  return authFetch<JournalEntry>(`/api/businesses/${businessId}/accounting/journal-entries/${entryId}/post`, { method: 'PATCH' });
}
export function voidJournalEntry(businessId: string, entryId: string) {
  return authFetch<JournalEntry>(`/api/businesses/${businessId}/accounting/journal-entries/${entryId}/void`, { method: 'PATCH' });
}
export function getTrialBalance(businessId: string, asOf?: string) {
  return authFetch<TrialBalance>(`/api/businesses/${businessId}/accounting/trial-balance${asOf ? `?asOf=${asOf}` : ''}`);
}
export function listVendors(businessId: string) {
  return authFetch<Vendor[]>(`/api/businesses/${businessId}/accounting/vendors`);
}
export function createVendor(businessId: string, payload: { name: string; contactEmail?: string; contactPhone?: string; paymentTermsDays?: number }) {
  return authFetch<Vendor>(`/api/businesses/${businessId}/accounting/vendors`, { method: 'POST', body: JSON.stringify(payload) });
}
export function listApBills(businessId: string) {
  return authFetch<ApBill[]>(`/api/businesses/${businessId}/accounting/ap-bills`);
}
export function createApBill(businessId: string, payload: { vendorId: string; billNumber?: string; billDate?: string; dueDate: string; amountAed: number }) {
  return authFetch<ApBill>(`/api/businesses/${businessId}/accounting/ap-bills`, { method: 'POST', body: JSON.stringify(payload) });
}
export function recordApPayment(businessId: string, billId: string, amountPaidAed: number) {
  return authFetch<ApBill>(`/api/businesses/${businessId}/accounting/ap-bills/${billId}/pay`, { method: 'PATCH', body: JSON.stringify({ amountPaidAed }) });
}
export function listArInvoices(businessId: string) {
  return authFetch<ArInvoice[]>(`/api/businesses/${businessId}/accounting/ar-invoices`);
}
export function createArInvoice(businessId: string, payload: { customerName: string; customerEmail?: string; invoiceNumber?: string; invoiceDate?: string; dueDate: string; amountAed: number }) {
  return authFetch<ArInvoice>(`/api/businesses/${businessId}/accounting/ar-invoices`, { method: 'POST', body: JSON.stringify(payload) });
}
export function recordArReceipt(businessId: string, invoiceId: string, amountReceivedAed: number) {
  return authFetch<ArInvoice>(`/api/businesses/${businessId}/accounting/ar-invoices/${invoiceId}/receive`, { method: 'PATCH', body: JSON.stringify({ amountReceivedAed }) });
}

// --- Channel manager (hotel-only) ---

export function listChannelConnections(businessId: string) {
  return authFetch<ChannelConnection[]>(`/api/businesses/${businessId}/channel-manager/connections`);
}
export function upsertChannelConnection(businessId: string, channel: ChannelConnection['channel'], credentials: Record<string, string>) {
  return authFetch<ChannelConnection>(`/api/businesses/${businessId}/channel-manager/connections/${channel}`, { method: 'PUT', body: JSON.stringify(credentials) });
}
export function disconnectChannel(businessId: string, channel: ChannelConnection['channel']) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/channel-manager/connections/${channel}`, { method: 'DELETE' });
}
export function pushRatesToChannel(businessId: string, payload: { channel: string; roomType: string; dates: { stayDate: string; rateAed: number; availableRooms: number }[] }) {
  return authFetch<{ message: string; syncStatus: string }>(`/api/businesses/${businessId}/channel-manager/push-rates`, { method: 'POST', body: JSON.stringify(payload) });
}
export function listChannelBookings(businessId: string, status?: string) {
  return authFetch<ChannelBooking[]>(`/api/businesses/${businessId}/channel-manager/bookings${status ? `?status=${status}` : ''}`);
}
export function confirmChannelBooking(businessId: string, bookingId: string) {
  return authFetch<ChannelBooking>(`/api/businesses/${businessId}/channel-manager/bookings/${bookingId}/confirm`, { method: 'PATCH' });
}
export function rejectChannelBooking(businessId: string, bookingId: string) {
  return authFetch<ChannelBooking>(`/api/businesses/${businessId}/channel-manager/bookings/${bookingId}/reject`, { method: 'PATCH' });
}

// --- Marketing ---

export function listMarketingTemplates(businessId: string) {
  return authFetch<MarketingTemplate[]>(`/api/businesses/${businessId}/marketing/templates`);
}
export function createMarketingTemplate(businessId: string, payload: { name: string; channel: 'email' | 'sms'; subject?: string; body: string; category?: MarketingTemplate['category'] }) {
  return authFetch<MarketingTemplate>(`/api/businesses/${businessId}/marketing/templates`, { method: 'POST', body: JSON.stringify(payload) });
}
export function deleteMarketingTemplate(businessId: string, templateId: string) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/marketing/templates/${templateId}`, { method: 'DELETE' });
}
export function listCampaigns(businessId: string) {
  return authFetch<MarketingCampaign[]>(`/api/businesses/${businessId}/marketing/campaigns`);
}
export function createCampaign(businessId: string, payload: {
  name: string; channel: 'email' | 'sms'; subject?: string; body: string; scheduledFor?: string | null;
  audience: 'all_hotel_guests' | 'all_loyalty_members' | 'manual'; manualContacts?: { contactValue: string }[];
}) {
  return authFetch<MarketingCampaign>(`/api/businesses/${businessId}/marketing/campaigns`, { method: 'POST', body: JSON.stringify(payload) });
}
export function sendCampaign(businessId: string, campaignId: string) {
  return authFetch<MarketingCampaign>(`/api/businesses/${businessId}/marketing/campaigns/${campaignId}/send`, { method: 'POST' });
}
export function cancelCampaign(businessId: string, campaignId: string) {
  return authFetch<MarketingCampaign>(`/api/businesses/${businessId}/marketing/campaigns/${campaignId}/cancel`, { method: 'PATCH' });
}
export function getCampaignStats(businessId: string, campaignId: string) {
  return authFetch<MarketingCampaignStats>(`/api/businesses/${businessId}/marketing/campaigns/${campaignId}/stats`);
}
export function listSuppressions(businessId: string) {
  return authFetch<MarketingSuppression[]>(`/api/businesses/${businessId}/marketing/suppressions`);
}
export function addSuppression(businessId: string, payload: { contactValue: string; channel: 'email' | 'sms'; reason?: string }) {
  return authFetch<MarketingSuppression>(`/api/businesses/${businessId}/marketing/suppressions`, { method: 'POST', body: JSON.stringify(payload) });
}
export function removeSuppression(businessId: string, suppressionId: string) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/marketing/suppressions/${suppressionId}`, { method: 'DELETE' });
}

export function setStaffActive(businessId: string, userId: string, isActive: boolean) {
  return authFetch<StaffMember>(`/api/businesses/${businessId}/staff/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

// sections: null = unrestricted (sees everything their role/features
// allow, same as before this feature existed). An array (even empty)
// restricts the account to exactly those section keys - see
// DashboardLayout's TABS/SETTINGS_ITEMS `path` values for the valid keys.
export function setStaffSections(businessId: string, userId: string, sections: string[] | null) {
  return authFetch<StaffMember>(`/api/businesses/${businessId}/staff/${userId}/sections`, {
    method: 'PATCH',
    body: JSON.stringify({ sections }),
  });
}

export function setStaffOutlets(businessId: string, userId: string, outletIds: string[] | null) {
  return authFetch<StaffMember>(`/api/businesses/${businessId}/staff/${userId}/outlets`, {
    method: 'PATCH',
    body: JSON.stringify({ outletIds }),
  });
}

// Owner-equivalent access for a specific staff account - real,
// server-enforced (see authorize()/current_role_name() on the backend),
// not cosmetic.
export function setStaffFullAccess(businessId: string, userId: string, fullAccess: boolean) {
  return authFetch<{ id: string; name: string; full_access: boolean }>(`/api/businesses/${businessId}/staff/${userId}/full-access`, {
    method: 'PATCH',
    body: JSON.stringify({ fullAccess }),
  });
}

// Self-service only - the backend enforces userId === the caller's own
// id, so this is never used to set someone else's layout.
export function setMyNavLayout(businessId: string, userId: string, layout: { hidden: string[]; order: string[] } | null) {
  return authFetch<{ id: string; nav_layout: { hidden: string[]; order: string[] } | null }>(`/api/businesses/${businessId}/staff/${userId}/nav-layout`, {
    method: 'PATCH',
    body: JSON.stringify(layout ?? { hidden: null, order: null }),
  });
}

export function resetAccountPassword(businessId: string, userId: string) {
  return authFetch<{ tempPassword: string; name: string }>(`/api/businesses/${businessId}/staff/${userId}/reset-password`, {
    method: 'POST',
  });
}

export function resendStaffInvite(businessId: string, userId: string) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/staff/${userId}/resend-invite`, {
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

export interface SalesByChannel {
  from: string; to: string; grandTotal: number;
  channels: { source: string; label: string; orderCount: number; total: number; percentage: number }[];
}
export function getSalesByChannel(businessId: string, range?: { from?: string; to?: string }) {
  const params = new URLSearchParams();
  if (range?.from) params.set('from', range.from);
  if (range?.to) params.set('to', range.to);
  const qs = params.toString();
  return authFetch<SalesByChannel>(`/api/businesses/${businessId}/analytics/sales-by-channel${qs ? `?${qs}` : ''}`);
}

export interface TopItemsReport {
  from: string; to: string;
  byRevenue: { name: string; quantitySold: number; revenueAed: number; revenueSharePct: number }[];
  byQuantity: { name: string; quantitySold: number; revenueAed: number; revenueSharePct: number }[];
}
export function getTopItems(businessId: string, range?: { from?: string; to?: string; limit?: number }) {
  const params = new URLSearchParams();
  if (range?.from) params.set('from', range.from);
  if (range?.to) params.set('to', range.to);
  if (range?.limit) params.set('limit', String(range.limit));
  const qs = params.toString();
  return authFetch<TopItemsReport>(`/api/businesses/${businessId}/analytics/top-items${qs ? `?${qs}` : ''}`);
}

export interface RevenueTrend {
  from: string; to: string; totalRevenueAed: number;
  trend: { date: string; revenueAed: number }[];
}
export function getRevenueTrend(businessId: string, range?: { from?: string; to?: string }) {
  const params = new URLSearchParams();
  if (range?.from) params.set('from', range.from);
  if (range?.to) params.set('to', range.to);
  const qs = params.toString();
  return authFetch<RevenueTrend>(`/api/businesses/${businessId}/analytics/revenue-trend${qs ? `?${qs}` : ''}`);
}

export interface PeakHours {
  from: string; to: string; peakHour: number;
  hours: { hour: number; orderCount: number }[];
}
export function getPeakHours(businessId: string, range?: { from?: string; to?: string }) {
  const params = new URLSearchParams();
  if (range?.from) params.set('from', range.from);
  if (range?.to) params.set('to', range.to);
  const qs = params.toString();
  return authFetch<PeakHours>(`/api/businesses/${businessId}/analytics/peak-hours${qs ? `?${qs}` : ''}`);
}

export interface KitchenPerformance {
  from: string; to: string; ticketCount: number; trackedTicketCount: number;
  avgTimeToStartMins: number | null; avgPrepTimeMins: number | null; avgTotalTicketMins: number | null;
}
export function getKitchenPerformance(businessId: string, range?: { from?: string; to?: string }) {
  const params = new URLSearchParams();
  if (range?.from) params.set('from', range.from);
  if (range?.to) params.set('to', range.to);
  const qs = params.toString();
  return authFetch<KitchenPerformance>(`/api/businesses/${businessId}/analytics/kitchen-performance${qs ? `?${qs}` : ''}`);
}

export interface HotelPerformance {
  from: string; to: string;
  occupancyTrend: { date: string; occupancyPct: number; adrAed: number | null; revParAed: number | null }[];
  bookingSources: { source: string; label: string; count: number; revenueAed: number; percentage: number }[];
  reservationOutcomes: {
    checkedOut: number; cancelled: number; noShow: number; stillUpcoming: number;
    cancellationRatePct: number | null; noShowRatePct: number | null;
  };
  avgLengthOfStayNights: number | null;
}
export function getHotelPerformance(businessId: string, range?: { from?: string; to?: string }) {
  const params = new URLSearchParams();
  if (range?.from) params.set('from', range.from);
  if (range?.to) params.set('to', range.to);
  const qs = params.toString();
  return authFetch<HotelPerformance>(`/api/businesses/${businessId}/analytics/hotel-performance${qs ? `?${qs}` : ''}`);
}

// --- Linked accounts (login-switch convenience) ---

export interface LinkedAccount {
  linkId: string;
  linkedSince: string;
  account: { id: string; name: string; role: string; business_id: string | null; organization_id: string | null; businesses?: { name: string } };
}
export function listLinkedAccounts() {
  return authFetch<LinkedAccount[]>('/api/auth/linked-accounts');
}
export function switchAccount(targetProfileId: string) {
  return authFetch<{ accessToken: string; refreshToken: string }>('/api/auth/switch-account', {
    method: 'POST', body: JSON.stringify({ targetProfileId }),
  });
}

// --- Organizations (multi-outlet/franchise) ---

export interface Organization {
  id: string;
  name: string;
  created_at: string;
  businesses?: { id: string; name: string; category: string; status: string }[];
}
export function listOrganizations() {
  return authFetch<Organization[]>('/api/organizations');
}
export function createOrganization(name: string) {
  return authFetch<Organization>('/api/organizations', { method: 'POST', body: JSON.stringify({ name }) });
}
export function deleteOrganization(organizationId: string) {
  return authFetch<{ message: string; id: string }>(`/api/organizations/${organizationId}`, { method: 'DELETE' });
}
export function setBusinessOrganization(businessId: string, organizationId: string | null) {
  return authFetch<{ id: string }>(`/api/organizations/businesses/${businessId}/organization`, {
    method: 'PATCH', body: JSON.stringify({ organizationId }),
  });
}
export function inviteOrgOwner(organizationId: string, name: string, email: string) {
  return authFetch<{ id: string; name: string; email: string; resent?: boolean }>(`/api/organizations/${organizationId}/owner`, {
    method: 'POST', body: JSON.stringify({ name, email }),
  });
}

export interface OrgMenuItem {
  id: string; organization_id: string; category_id: string | null;
  name: string; description: string; price: number; image_url: string;
}
export interface OrgMenuCategory {
  id: string; organization_id: string; name: string; sort_order: number;
  organization_menu_items: OrgMenuItem[];
}
function orgQuery(asSuperAdminForOrgId?: string) {
  return asSuperAdminForOrgId ? `?organizationId=${asSuperAdminForOrgId}` : '';
}
export function getMyOrganization(asSuperAdminForOrgId?: string) {
  return authFetch<Organization>(`/api/organizations/mine${orgQuery(asSuperAdminForOrgId)}`);
}
export function listOrgMenuCategories(asSuperAdminForOrgId?: string) {
  return authFetch<OrgMenuCategory[]>(`/api/organizations/menu/categories${orgQuery(asSuperAdminForOrgId)}`);
}
export function createOrgMenuCategory(name: string, asSuperAdminForOrgId?: string) {
  return authFetch<OrgMenuCategory>(`/api/organizations/menu/categories${orgQuery(asSuperAdminForOrgId)}`, {
    method: 'POST', body: JSON.stringify({ name, organizationId: asSuperAdminForOrgId }),
  });
}
export function createOrgMenuItem(payload: { categoryId?: string; name: string; description?: string; price: number; imageUrl?: string }, asSuperAdminForOrgId?: string) {
  return authFetch<OrgMenuItem>(`/api/organizations/menu/items${orgQuery(asSuperAdminForOrgId)}`, {
    method: 'POST', body: JSON.stringify({ ...payload, organizationId: asSuperAdminForOrgId }),
  });
}
export function updateOrgMenuItem(itemId: string, payload: Partial<{ name: string; description: string; price: number; imageUrl: string; categoryId: string | null }>, asSuperAdminForOrgId?: string) {
  return authFetch<OrgMenuItem>(`/api/organizations/menu/items/${itemId}${orgQuery(asSuperAdminForOrgId)}`, {
    method: 'PATCH', body: JSON.stringify({ ...payload, organizationId: asSuperAdminForOrgId }),
  });
}
export function deleteOrgMenuItem(itemId: string, asSuperAdminForOrgId?: string) {
  return authFetch<{ message: string }>(`/api/organizations/menu/items/${itemId}${orgQuery(asSuperAdminForOrgId)}`, {
    method: 'DELETE', body: JSON.stringify({ organizationId: asSuperAdminForOrgId }),
  });
}
export function publishOrgMenu(locationBusinessIds: string[], asSuperAdminForOrgId?: string) {
  return authFetch<{ message: string; created: number; updated: number; locations: number }>(`/api/organizations/menu/publish${orgQuery(asSuperAdminForOrgId)}`, {
    method: 'POST', body: JSON.stringify({ locationBusinessIds, organizationId: asSuperAdminForOrgId }),
  });
}
export interface OrgReportRow { businessId: string; name: string; orderCount: number; total: number }
export function getOrgReport(range?: { from?: string; to?: string }, asSuperAdminForOrgId?: string) {
  const params = new URLSearchParams();
  if (range?.from) params.set('from', range.from);
  if (range?.to) params.set('to', range.to);
  if (asSuperAdminForOrgId) params.set('organizationId', asSuperAdminForOrgId);
  const qs = params.toString();
  return authFetch<{ from: string; to: string; locations: OrgReportRow[]; grandTotal: number }>(`/api/organizations/report${qs ? `?${qs}` : ''}`);
}

export interface HotelOrgReportRow {
  businessId: string; name: string; roomsAvailable: number; auditedDays: number;
  roomRevenueAed: number; occupancyPct: number | null; adrAed: number | null; revParAed: number | null;
}
export interface HotelOrgReport {
  from: string; to: string; days: number; locations: HotelOrgReportRow[];
  orgTotals: { totalRoomRevenueAed: number; totalRoomsAvailable: number; locationsWithNoAuditData: number } | null;
}
export function getHotelOrgReport(range?: { from?: string; to?: string }, asSuperAdminForOrgId?: string) {
  const params = new URLSearchParams();
  if (range?.from) params.set('from', range.from);
  if (range?.to) params.set('to', range.to);
  if (asSuperAdminForOrgId) params.set('organizationId', asSuperAdminForOrgId);
  const qs = params.toString();
  return authFetch<HotelOrgReport>(`/api/organizations/report/hotel${qs ? `?${qs}` : ''}`);
}

// --- Zoho Books accounting sync ---

export function getZohoBooksConnectUrl(businessId: string) {
  return authFetch<{ url: string }>(`/api/businesses/${businessId}/zoho-books/connect`);
}
export function getZohoBooksStatus(businessId: string) {
  return authFetch<{ connected: boolean; connectedAt: string | null }>(`/api/businesses/${businessId}/zoho-books/status`);
}
export function disconnectZohoBooks(businessId: string) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/zoho-books`, { method: 'DELETE' });
}
export function syncZohoBooksReceipts(businessId: string) {
  return authFetch<{ message: string; synced: number; total: number; errors: { receiptNumber: string; error: string }[] }>(
    `/api/businesses/${businessId}/zoho-books/sync`, { method: 'POST' }
  );
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
export function assignBookingTable(businessId: string, bookingId: string, tableId: string | null) {
  return authFetch<BookingRow>(`/api/businesses/${businessId}/bookings/${bookingId}`, {
    method: 'PATCH',
    body: JSON.stringify({ tableId }),
  });
}
export function confirmArrivalByStaff(businessId: string, bookingId: string) {
  return authFetch<BookingRow>(`/api/businesses/${businessId}/bookings/${bookingId}/confirm-arrival`, { method: 'POST' });
}
export function createBooking(businessId: string, payload: {
  guestName: string; contactPhone?: string; partySize?: number; requestedAt: string; note?: string; tableId?: string | null;
}) {
  return authFetch<BookingRow>(`/api/businesses/${businessId}/bookings`, { method: 'POST', body: JSON.stringify(payload) });
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

// --- Kitchen ticket printing (station-routed) ---

export interface KitchenStationPrinter {
  id: string; business_id: string; station: string; printer_id: string; printer_name: string; created_at: string;
}
export function listKitchenStationPrinters(businessId: string) {
  return authFetch<KitchenStationPrinter[]>(`/api/businesses/${businessId}/kitchen-station-printers`);
}
export function upsertKitchenStationPrinter(businessId: string, station: string, printerId: string, printerName: string) {
  return authFetch<KitchenStationPrinter>(`/api/businesses/${businessId}/kitchen-station-printers`, {
    method: 'PUT', body: JSON.stringify({ station, printerId, printerName }),
  });
}
export function deleteKitchenStationPrinter(businessId: string, id: string) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/kitchen-station-printers/${id}`, { method: 'DELETE' });
}
export function reprintKitchenTicket(businessId: string, orderId: string) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/orders/${orderId}/reprint-ticket`, { method: 'POST' });
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
  buttonType?: 'link' | 'notification' | 'group';
  notificationDestination?: 'general' | 'housekeeping_task' | 'maintenance_ticket';
  targetSection?: string | null;
  parentButtonId?: string | null;
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

export function recordManualPayment(businessId: string, orderId: string, itemIds: string[], tenders: { method: 'cash' | 'card'; amount: number }[], pin: string) {
  return authFetch<{ message: string }>(
    `/api/businesses/${businessId}/orders/${orderId}/manual-payment`,
    { method: 'POST', body: JSON.stringify({ itemIds, tenders, pin }) }
  );
}

export function clearStaffPin(businessId: string, userId: string) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/staff/${userId}/pin`, { method: 'DELETE' });
}

export interface NotificationCounts {
  orders: number;
  requests: number;
  payments: number;
  kitchen: number;
  housekeeping: number;
  'front-desk': number;
}

export function getNotificationCounts(businessId: string) {
  return authFetch<NotificationCounts>(`/api/businesses/${businessId}/notifications/counts`);
}

export function markSectionViewed(businessId: string, section: keyof NotificationCounts) {
  return authFetch<{ section: string; viewedAt: string }>(`/api/businesses/${businessId}/notifications/${section}/mark-viewed`, {
    method: 'POST',
  });
}

// --- Call Waiter / Request Bill - a separate, lightweight feed, never
// mixed into the kitchen's order queue ---

export interface RequestRow {
  id: string;
  table_label: string;
  request_type: 'call_waiter' | 'request_bill' | 'custom';
  custom_request_label: string | null;
  target_section: string | null;
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

// Same pattern for a contract - used from the authenticated dashboard.
export async function downloadContractPdf(businessId: string, contractId: string, contractNumber: string) {
  const token = getToken();
  const res = await fetchWithTimeout(
    `${BASE}/api/businesses/${businessId}/contracts/${contractId}/pdf`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    30000
  );
  if (!res.ok) throw new Error('Could not download contract');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${contractNumber}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Business-scoped audit report - every contract, billing receipt, and
// customer payment for the given year, compiled into one PDF an
// accountant/auditor can be handed directly.
export async function downloadBusinessAuditReport(businessId: string, year: number) {
  const token = getToken();
  const res = await fetchWithTimeout(
    `${BASE}/api/businesses/${businessId}/audit-report/pdf?year=${year}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    30000
  );
  if (!res.ok) throw new Error('Could not generate audit report');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit_report_${year}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Platform-wide audit report - super_admin only.
export async function downloadPlatformAuditReport(year: number) {
  const token = getToken();
  const res = await fetchWithTimeout(
    `${BASE}/api/businesses/audit-report/pdf?year=${year}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    30000
  );
  if (!res.ok) throw new Error('Could not generate audit report');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tavzio_platform_audit_${year}.pdf`;
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
  startDate: string; paymentFrequency: 'monthly' | 'quarterly' | 'yearly'; planType?: 'connect' | 'full';
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

// --- Standalone contracts (Create Contract / onboarding flow) ---
// A contract created here has no business yet - client details live on
// the contract row itself until onboardContract links it to a real,
// newly-created business.

export function createStandaloneContract(payload: {
  clientName: string; clientEmail: string; clientBusinessName: string; clientCategory: string;
  startDate: string; paymentFrequency: 'monthly' | 'quarterly' | 'yearly'; planType?: 'connect' | 'full';
  standsCount: number; systemFeeOverride?: number; cardPriceOverride?: number;
}) {
  return authFetch<Contract>('/api/contracts', { method: 'POST', body: JSON.stringify(payload) });
}

export function listAllContracts() {
  return authFetch<Contract[]>('/api/contracts');
}

export function previewStandaloneContract(contractId: string) {
  return authFetch<{ text: string }>(`/api/contracts/${contractId}/preview`);
}

export function sendStandaloneContract(contractId: string) {
  return authFetch<{ message: string }>(`/api/contracts/${contractId}/send`, { method: 'POST' });
}

export function onboardContract(contractId: string) {
  return authFetch<{ business: AdminBusiness; contract: Contract }>(`/api/contracts/${contractId}/onboard`, { method: 'POST' });
}

// Real, distinct operations - see contractController.js for why these
// aren't one action with a flag. Terminate keeps the record and
// triggers real account consequences (business suspended, client
// notified per the actual contract clauses); delete only works on a
// contract nobody ever signed.
export function terminateContract(contractId: string, basis: 'non_payment' | 'material_breach' | 'client_convenience' | 'mutual_agreement', reason?: string) {
  return authFetch<Contract & { businessSuspended: boolean }>(`/api/contracts/${contractId}/terminate`, {
    method: 'POST',
    body: JSON.stringify({ basis, reason }),
  });
}
export function deleteContract(contractId: string) {
  return authFetch<{ message: string }>(`/api/contracts/${contractId}`, { method: 'DELETE' });
}

// --- Inventory ---

export function listSuppliers(businessId: string) {
  return authFetch<Supplier[]>(`/api/businesses/${businessId}/inventory/suppliers`);
}

export function createSupplier(businessId: string, payload: { name: string; contactName?: string; phone?: string; email?: string }) {
  return authFetch<Supplier>(`/api/businesses/${businessId}/inventory/suppliers`, { method: 'POST', body: JSON.stringify(payload) });
}

export function updateSupplier(businessId: string, supplierId: string, payload: { name?: string; contactName?: string; phone?: string; email?: string }) {
  return authFetch<Supplier>(`/api/businesses/${businessId}/inventory/suppliers/${supplierId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function deleteSupplier(businessId: string, supplierId: string) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/inventory/suppliers/${supplierId}`, { method: 'DELETE' });
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

export function deleteIngredient(businessId: string, ingredientId: string) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/inventory/ingredients/${ingredientId}`, { method: 'DELETE' });
}

export function adjustStock(businessId: string, ingredientId: string, payload: { changeQty: number; reason?: string; note?: string }) {
  return authFetch<Ingredient>(`/api/businesses/${businessId}/inventory/ingredients/${ingredientId}/adjust`, { method: 'POST', body: JSON.stringify(payload) });
}

// --- Warehouses & stock transfers ---

export function listWarehouses(businessId: string) {
  return authFetch<Warehouse[]>(`/api/businesses/${businessId}/warehouses`);
}
export function createWarehouse(businessId: string, payload: { name: string; type?: string; address?: string }) {
  return authFetch<Warehouse>(`/api/businesses/${businessId}/warehouses`, { method: 'POST', body: JSON.stringify(payload) });
}
export function updateWarehouse(businessId: string, warehouseId: string, payload: Partial<{ name: string; type: string; address: string }>) {
  return authFetch<Warehouse>(`/api/businesses/${businessId}/warehouses/${warehouseId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}
export function deleteWarehouse(businessId: string, warehouseId: string) {
  return authFetch<{ message: string }>(`/api/businesses/${businessId}/warehouses/${warehouseId}`, { method: 'DELETE' });
}
export function getWarehouseStock(businessId: string, warehouseId: string) {
  return authFetch<WarehouseStockLine[]>(`/api/businesses/${businessId}/warehouses/${warehouseId}/stock`);
}

export function listStockTransfers(businessId: string) {
  return authFetch<StockTransfer[]>(`/api/businesses/${businessId}/stock-transfers`);
}
export function createStockTransfer(businessId: string, payload: { fromWarehouseId?: string | null; toWarehouseId: string; items: { ingredientId: string; quantity: number }[]; note?: string }) {
  return authFetch<StockTransfer>(`/api/businesses/${businessId}/stock-transfers`, { method: 'POST', body: JSON.stringify(payload) });
}
export function approveStockTransfer(businessId: string, transferId: string) {
  return authFetch<StockTransfer>(`/api/businesses/${businessId}/stock-transfers/${transferId}/approve`, { method: 'PATCH' });
}
export function shipStockTransfer(businessId: string, transferId: string) {
  return authFetch<StockTransfer>(`/api/businesses/${businessId}/stock-transfers/${transferId}/ship`, { method: 'PATCH' });
}
export function receiveStockTransfer(businessId: string, transferId: string) {
  return authFetch<StockTransfer>(`/api/businesses/${businessId}/stock-transfers/${transferId}/receive`, { method: 'PATCH' });
}
export function cancelStockTransfer(businessId: string, transferId: string) {
  return authFetch<StockTransfer>(`/api/businesses/${businessId}/stock-transfers/${transferId}/cancel`, { method: 'PATCH' });
}

export function listPoAllocations(businessId: string, received?: boolean) {
  const q = received !== undefined ? `?received=${received}` : '';
  return authFetch<PoAllocation[]>(`/api/businesses/${businessId}/po-allocations${q}`);
}
export function receivePoAllocation(businessId: string, allocationId: string, payload: { ingredientId: string; warehouseId: string }) {
  return authFetch<PoAllocation>(`/api/businesses/${businessId}/po-allocations/${allocationId}/receive`, { method: 'POST', body: JSON.stringify(payload) });
}

// --- Organization supply chain (org_owner / super_admin) ---

export function listOrgSuppliers() {
  return authFetch<Supplier[]>('/api/organizations/suppliers');
}
export function createOrgSupplier(payload: { name: string; contactName?: string; phone?: string; email?: string }) {
  return authFetch<Supplier>('/api/organizations/suppliers', { method: 'POST', body: JSON.stringify(payload) });
}
export function updateOrgSupplier(supplierId: string, payload: Partial<{ name: string; contactName: string; phone: string; email: string }>) {
  return authFetch<Supplier>(`/api/organizations/suppliers/${supplierId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}
export function deleteOrgSupplier(supplierId: string) {
  return authFetch<{ message: string }>(`/api/organizations/suppliers/${supplierId}`, { method: 'DELETE' });
}

export function listOrgPurchaseOrders() {
  return authFetch<OrgPurchaseOrder[]>('/api/organizations/purchase-orders');
}
export function createOrgPurchaseOrder(payload: {
  supplierId?: string | null;
  items: { itemName: string; itemUnit?: string; quantity: number; unitCostAed: number; allocations?: { businessId: string; quantity: number }[] }[];
}) {
  return authFetch<OrgPurchaseOrder>('/api/organizations/purchase-orders', { method: 'POST', body: JSON.stringify(payload) });
}

export function recordWaste(businessId: string, ingredientId: string, payload: { quantity: number; wasteCategory: string; note?: string }) {
  return authFetch<Ingredient>(`/api/businesses/${businessId}/inventory/ingredients/${ingredientId}/waste`, { method: 'POST', body: JSON.stringify(payload) });
}

export function getWasteReport(businessId: string, days = 30) {
  return authFetch<WasteReport>(`/api/businesses/${businessId}/inventory/waste-report?days=${days}`);
}

export function getMenuItemFoodCost(businessId: string) {
  return authFetch<FoodCostReport>(`/api/businesses/${businessId}/inventory/food-cost`);
}

export function getActualFoodCost(businessId: string, from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();
  return authFetch<ActualFoodCostReport>(`/api/businesses/${businessId}/inventory/food-cost/actual${qs ? `?${qs}` : ''}`);
}

export function getLowStock(businessId: string) {
  return authFetch<LowStockIngredient[]>(`/api/businesses/${businessId}/inventory/low-stock`);
}

export function getInventoryValuation(businessId: string) {
  return authFetch<InventoryValuation>(`/api/businesses/${businessId}/inventory/valuation`);
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

// Omit `items` to receive everything outstanding at once (original
// behavior). Pass `items` to receive only some of each line - the PO's
// status becomes 'partially_received' until every line is fully in.
export function receivePurchaseOrder(businessId: string, poId: string, items?: { purchaseOrderItemId: string; receivedQuantity: number }[]) {
  return authFetch<PurchaseOrder>(`/api/businesses/${businessId}/inventory/purchase-orders/${poId}/receive`, {
    method: 'POST',
    body: JSON.stringify(items ? { items } : {}),
  });
}

// super_admin only - one-time, deliberate action. Overwrites whichever
// webhook is currently registered for the whole Ziina account.
export function registerZiinaWebhook() {
  return authFetch<{ message: string }>('/api/ziina/register-webhook', { method: 'POST' });
}
