export interface LinkButtonConfig {
  enabled: boolean;
  value: string;
  icon?: string;
  label?: string; // overrides the default label (e.g. "Message on WhatsApp") if set
  imageUrl?: string | null; // overrides the icon entirely if set - an uploaded logo/picture
}

// Trimmed to the 7 buttons that work as plain external links on their own.
// Call and Special Offers were removed entirely (special offers now live
// inside the menu as a category); Menu and Book Appointment are no longer
// simple links - they route into Tavzio's own ordering/booking flows,
// governed by BusinessFeatures below.
export interface BusinessLinks {
  googleReviews: LinkButtonConfig;
  instagram: LinkButtonConfig;
  tiktok: LinkButtonConfig;
  facebook: LinkButtonConfig;
  whatsapp: LinkButtonConfig;
  website: LinkButtonConfig;
  directions: LinkButtonConfig;
}

export type LoyaltyEarnMethod = 'visit' | 'spend';
export type LoyaltyStructure = 'threshold' | 'tiered';
export type RewardType = 'percentage' | 'fixed_amount' | 'manual';

export interface LoyaltyTier {
  name: string;
  threshold: number; // measured in visits, points, or spend depending on the program's settings
  rewardType: RewardType;
  rewardValue: number;
  rewardDescription: string;
}

export type CooldownType = 'none' | 'daily' | 'weekly' | 'custom';

export interface LoyaltyCooldown {
  type: CooldownType;
  hours?: number; // only used when type === 'custom'
}

export interface LoyaltyProgramConfig {
  visitsRequired?: number;
  pointsPerVisit?: number;
  redeemThreshold?: number;
  thresholdAmount?: number;
  currency?: string;
  tiers?: LoyaltyTier[];
  // How often a tap is allowed to count - owner-set per program. Never
  // applies to spend-based earning (staff-entered, can't be gamed by re-tapping).
  cooldown?: LoyaltyCooldown;
}

export interface LoyaltyProgram {
  earn_method: LoyaltyEarnMethod;
  structure: LoyaltyStructure;
  use_points: boolean;
  reward_type: RewardType;
  reward_value: number;
  reward_description: string;
  config: LoyaltyProgramConfig;
}

export interface RewardInfo {
  type: RewardType;
  value: number;
  description: string;
}

export interface TierReward {
  name: string;
  type: RewardType;
  value: number;
  description: string;
}

// Every one of these is super_admin-only to toggle - one-tier control, no
// owner-side override anywhere in this structure.
export interface BusinessFeatures {
  // Card stays true by default (matches how every business already
  // worked); website is the new, optional second access path. Both can
  // be true at once - a business isn't limited to just one.
  accessMethods: {
    card: boolean;
    website: boolean;
  };
  ordering: {
    menuView: boolean;
    submission: boolean;
    posIntegration: boolean;
    callWaiter: boolean;
    requestBill: boolean;
    // Self-service - owner/staff turn this on themselves once a payment
    // provider is connected (Pay Bill Setup). "Send order" then requires
    // payment (card or staff-confirmed cash) before it reaches the kitchen.
    payBeforeOrder: boolean;
  };
  booking: {
    menuView: boolean;
    submission: boolean;
    integration: boolean;
  };
  loyalty: boolean;
  staffAccounts: boolean;
  // Tier 2 ingredient-level inventory - self-service, off by default.
  // blockOrdersOnLowStock defaults true: an order that can't actually be
  // made from current stock gets rejected rather than silently accepted.
  inventory: {
    enabled: boolean;
    blockOrdersOnLowStock: boolean;
  };
}

// Business appearance customization - "1 click, 1 color" for
// Background/Buttons, applied to every customer-facing NFC page
// (Landing/Menu/Bill/Booking). Null = use Tavzio's own default palette.
// dashboardBackground/dashboardButton apply the same idea to the
// owner/staff dashboard - shared business-wide, not a per-person
// preference (that stays the existing profile theme_preference toggle).
export interface BusinessTheme {
  darkMode: boolean;
  accentColor: string;
  customerBackground: string | null;
  customerButton: string | null;
  dashboardBackground: string | null;
  dashboardButton: string | null;
}

export interface Business {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
  cover_image_url: string;
  description: string;
  links: BusinessLinks;
  theme: BusinessTheme;
  category: string;
  features: BusinessFeatures;
  loyaltyProgram: LoyaltyProgram | null;
  paymentEnabled: boolean;
  paymentProvider: string;
  trn: string;
  customButtons: CustomButton[];
}

export interface LoyaltyMembership {
  id: string;
  visits: number;
  points: number;
  total_spend: number;
  current_tier: string | null;
}

export interface LoyaltyCheckinResponse {
  membership: LoyaltyMembership;
  rewardReady: boolean;
  alreadyCounted: boolean;
  reward: RewardInfo | null;
  currentTierReward: TierReward | null;
  pendingClaim: boolean;
}

export interface LoyaltyClaim {
  id: string;
  business_id: string;
  membership_id: string;
  card_id: string | null;
  table_label: string;
  reward_type: RewardType;
  reward_value: number;
  reward_description: string;
  status: 'pending' | 'applied' | 'cancelled';
  created_at: string;
  loyalty_memberships?: { customers?: { phone: string } };
}

export interface Profile {
  id: string;
  name: string;
  role: 'super_admin' | 'business_owner' | 'staff';
  business_id: string | null;
  is_active: boolean;
  email?: string;
  theme_preference: 'light' | 'dark' | 'system';
  must_change_password: boolean;
  job_role?: string | null;
  assigned_sections?: string[] | null;
}

// The full business record as seen by an authenticated admin - a superset
// of the public Business type, with internal/status fields included.
export interface AdminBusiness {
  id: string;
  name: string;
  slug: string;
  owner: string;
  category: string;
  logo_url: string;
  cover_image_url: string;
  description: string;
  links: BusinessLinks;
  theme: BusinessTheme;
  status: 'active' | 'suspended' | 'pending';
  features: BusinessFeatures;
  ordering_paused: boolean;
  notification_settings: NotificationSettings;
  trn: string;
  created_at: string;
}

export interface Contract {
  id: string;
  business_id: string;
  contract_number: string;
  start_date: string;
  end_date: string;
  payment_frequency: 'monthly' | 'quarterly' | 'yearly';
  stands_count: number;
  system_fee_aed: number;
  card_price_aed: number;
  annual_total_aed: number;
  status: 'draft' | 'sent' | 'signed' | 'active' | 'terminated' | 'expired';
  signed_snapshot_text: string | null;
  signed_by_name: string | null;
  signed_at: string | null;
  created_at: string;
}

export interface Supplier {
  id: string;
  business_id: string;
  name: string;
  contact_name: string;
  phone: string;
  email: string;
}

export interface Ingredient {
  id: string;
  business_id: string;
  name: string;
  unit: 'g' | 'kg' | 'ml' | 'l' | 'piece';
  stock_qty: number;
  low_stock_threshold: number;
  cost_per_unit: number;
  supplier_id: string | null;
  suppliers?: { name: string } | null;
}

export interface RecipeLine {
  id: string;
  menu_item_id: string;
  ingredient_id: string;
  quantity: number;
  ingredients?: { id: string; name: string; unit: string; stock_qty: number };
}

export interface PurchaseOrderItem {
  id: string;
  ingredient_id: string;
  quantity: number;
  unit_cost_aed: number;
  ingredients?: { name: string; unit: string };
}

export interface PurchaseOrder {
  id: string;
  business_id: string;
  supplier_id: string | null;
  status: 'pending' | 'received' | 'cancelled';
  total_cost_aed: number;
  ordered_at: string;
  received_at: string | null;
  suppliers?: { name: string } | null;
  purchase_order_items: PurchaseOrderItem[];
}

export interface Lead {
  id: string;
  email: string;
  phone: string;
  business_type: string;
  stands_estimate: number;
  note: string;
  converted: boolean;
  converted_business_id: string | null;
  created_at: string;
}

export interface TillSession {
  id: string;
  business_id: string;
  staff_id: string;
  opening_float_aed: number;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at: string | null;
  expected_cash_aed: number | null;
  counted_cash_aed: number | null;
  variance_aed: number | null;
  notes: string;
  profiles?: { name: string };
}

export interface FloorTable {
  id: string;
  uid: string;
  business_id: string;
  label: string;
  status: 'active' | 'inactive' | 'lost' | 'disabled';
  table_status: 'available' | 'occupied' | 'reserved' | 'cleaning';
  seat_count: number;
  merged_with_card_id: string | null;
  activeOrders: { id: string; card_id: string; total: number; status: string }[];
}

export interface WaitlistEntry {
  id: string;
  business_id: string;
  guest_name: string;
  party_size: number;
  phone: string;
  status: 'waiting' | 'seated' | 'cancelled';
  seated_card_id: string | null;
  created_at: string;
  seated_at: string | null;
}

export interface HotelRoom {
  id: string;
  business_id: string;
  room_number: string;
  room_type: string;
  floor: string;
  max_occupancy: number;
  base_rate_aed: number;
  status: 'available' | 'occupied' | 'dirty' | 'maintenance' | 'out_of_order';
  cards?: { id: string; uid: string; label: string; status: string }[];
}

export interface HotelGuest {
  id: string;
  business_id: string;
  name: string;
  email: string;
  phone: string;
  id_document_type: string;
  id_document_number: string;
  nationality: string;
  notes: string;
}

export interface HotelReservation {
  id: string;
  business_id: string;
  guest_id: string;
  room_id: string | null;
  check_in_date: string;
  check_out_date: string;
  adults: number;
  children: number;
  status: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
  source: 'direct' | 'walk_in' | 'ota' | 'phone';
  rate_aed: number;
  actual_check_in_at: string | null;
  actual_check_out_at: string | null;
  notes: string;
  hotel_guests?: { name: string; phone: string; email: string };
  hotel_rooms?: { room_number: string; room_type: string };
}

export interface HotelFolioCharge {
  id: string;
  folio_id: string;
  description: string;
  amount_aed: number;
  charge_type: 'room' | 'fnb' | 'service' | 'other' | 'payment';
  created_at: string;
}

export interface HotelFolio {
  id: string;
  business_id: string;
  reservation_id: string;
  status: 'open' | 'closed';
  is_primary: boolean;
  payer_type: 'guest' | 'company';
  company_name: string;
  charges: HotelFolioCharge[];
  balance: number;
  hotel_reservations?: { check_in_date: string; check_out_date: string; hotel_guests: { name: string }; hotel_rooms: { room_number: string } };
}

export interface HotelOutletItem {
  id: string;
  menu_item_id: string;
  price_override_aed: number | null;
  available: boolean;
}

export interface HotelOutlet {
  id: string;
  business_id: string;
  name: string;
  outlet_type: 'restaurant' | 'room_service' | 'bar' | 'pool' | 'breakfast' | 'other';
  enabled: boolean;
  location: string;
  opening_hours: string;
  sort_order: number;
  hotel_outlet_items: HotelOutletItem[];
}

export interface Card {
  id: string;
  uid: string;
  business_id: string;
  label: string;
  linked_user_id: string | null;
  status: 'active' | 'inactive' | 'lost' | 'disabled';
  last_programmed_at: string;
  created_at: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: 'business_owner' | 'staff';
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  assigned_sections: string[] | null;
}

export interface AnalyticsSummary {
  range: { from: string; to: string };
  totalTaps: number;
  tapsByDay: { day: string; count: number }[];
  eventsByType: { type: string; count: number }[];
  devicesSplit: { device: string; count: number }[];
  topHours: { hour: number; count: number }[];
  busiestDays: { day_name: string; day_number: number; count: number }[];
  returningVisitors: { new: number; returning: number };
}

export interface CardBreakdownItem {
  cardId: string;
  label: string;
  status: string;
  taps: number;
}

export interface LoyaltyProgramAdmin {
  id: string;
  business_id: string;
  earn_method: LoyaltyEarnMethod;
  structure: LoyaltyStructure;
  use_points: boolean;
  reward_type: RewardType;
  reward_value: number;
  reward_description: string;
  enabled: boolean;
  config: LoyaltyProgramConfig;
}

export interface LoyaltyMemberRow {
  id: string;
  visits: number;
  points: number;
  total_spend: number;
  current_tier: string | null;
  updated_at: string;
  customers: { phone: string; name: string } | null;
}

export interface TapResponse {
  redirect: string;
  tapEventId?: number;
  role?: string;
  accessToken?: string;
  refreshToken?: string;
  businessSlug?: string;
  status?: 'pending_confirmation';
  message?: string;
  pendingConfirmationId?: string;
}

export interface MenuCategory {
  id: string;
  business_id: string;
  name: string;
  // Populated by the public getPublicMenu endpoint (select('*') already
  // includes it) - the translated name per language code, e.g. { fr:
  // "Plats principaux" }. Falls back to `name` when a language has no
  // translation yet.
  name_i18n?: Record<string, string>;
  sort_order: number;
  paused: boolean;
}

export interface MenuItemAddon {
  id: string;
  menu_item_id: string;
  name: string;
  price: number;
  sort_order: number;
}

export interface MenuItem {
  id: string;
  business_id: string;
  category_id: string | null;
  name: string;
  name_i18n?: Record<string, string>;
  description: string;
  description_i18n?: Record<string, string>;
  price: number;
  // Only present on the Special Offers virtual-category duplicate of an
  // item - the crossed-out price to show alongside the discounted one.
  original_price?: number;
  offer_price?: number | null;
  offer_starts_at?: string | null;
  offer_ends_at?: string | null;
  image_url: string;
  is_available: boolean;
  sort_order: number;
  // Only populated by the public getPublicMenu endpoint - the dashboard's
  // listMenuItems does NOT include this (add-ons are fetched separately,
  // on demand, when the owner/staff opens an item's Add-ons panel).
  addons?: MenuItemAddon[];
}

// Frontend-only - never sent as-is; submitOrder maps this to the shape
// the backend expects.
export interface CartLine {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  note: string;
  selectedAddons: MenuItemAddon[]; // priced server-side again on submit, this is just for display + the ids sent
}

export type OrderStatus = 'awaiting_payment' | 'pending' | 'ready' | 'completed' | 'cancelled';
export type OrderRequestType = 'order' | 'call_waiter' | 'request_bill';

export interface OrderItemAddonSnapshot {
  name: string;
  price: number;
}

export interface OrderItemRow {
  id: string;
  item_name: string;
  unit_price: number;
  quantity: number;
  note: string;
  paid: boolean;
  cash_pending: boolean;
  voided: boolean;
  addons: OrderItemAddonSnapshot[];
  addon_total: number;
}

export interface OrderRow {
  id: string;
  business_id: string;
  card_id: string | null;
  table_label: string;
  status: OrderStatus;
  ready_ack: boolean;
  request_type: OrderRequestType;
  note: string;
  total: number;
  pos_sync_status: 'not_applicable' | 'pending' | 'synced' | 'failed';
  pos_sync_error: string;
  voided: boolean;
  voided_by: string | null;
  voided_at: string | null;
  void_reason: string;
  placed_by_staff_id: string | null;
  created_at: string;
  order_items: OrderItemRow[];
  source?: 'customer_tap' | 'staff_pos' | 'delivery';
  delivery_platform?: string | null;
}

// --- Booking (parallel to ordering) ---

export interface Service {
  id: string;
  business_id: string;
  name: string;
  description: string;
  price: number;
  duration_minutes: number;
  is_available: boolean;
  sort_order: number;
}

export type BookingStatus = 'pending' | 'confirmed' | 'declined' | 'completed' | 'cancelled';

export interface BookingRow {
  id: string;
  business_id: string;
  card_id: string | null;
  service_id: string | null;
  service_name: string;
  requested_at: string;
  note: string;
  contact_phone: string;
  status: BookingStatus;
  pos_sync_status: 'not_applicable' | 'pending' | 'synced' | 'failed';
  pos_sync_error: string;
  created_at: string;
}

// --- POS / booking-system integration ---

export type PosProvider = 'foodics' | 'square' | 'zenoti' | 'loyverse' | 'fresha' | 'tap' | 'custom' | 'printnode';
export type PosPurpose = 'ordering' | 'booking' | 'payment' | 'printing';

export interface PosIntegration {
  id: string;
  business_id: string;
  purpose: PosPurpose;
  provider: PosProvider;
  enabled: boolean;
  config: Record<string, string>;
  status: 'disconnected' | 'connected' | 'error';
  last_synced_at: string | null;
}

export interface PosIntegrationStatus {
  provider: PosProvider;
  enabled: boolean;
  status: 'disconnected' | 'connected' | 'error';
  last_synced_at: string | null;
}

// --- Notification sounds - 4 fully independent events ---

export type NotificationEvent = 'callWaiter' | 'requestBill' | 'newOrder' | 'newBooking' | 'paymentConfirmed';

export interface NotificationSetting {
  enabled: boolean;
  sound: string; // a preset id (e.g. 'default', 'chime', 'bell') or 'custom'
  customUrl: string; // only used when sound === 'custom'
}

export type NotificationSettings = Record<NotificationEvent, NotificationSetting>;

// --- Custom buttons - genuinely new buttons beyond the fixed 7 ---

export interface CustomButton {
  id: string;
  business_id: string;
  label: string;
  icon: string;
  image_url: string | null;
  url: string;
  enabled: boolean;
  sort_order: number;
}

// --- Pay Bill / split payments ---

export interface BillItem {
  id: string;
  order_id: string;
  item_name: string;
  unit_price: number;
  quantity: number;
  note: string;
  paid: boolean;
  cash_pending: boolean;
  voided: boolean;
  addons: OrderItemAddonSnapshot[];
  addon_total: number;
}

export interface PaymentRow {
  id: string;
  business_id: string;
  card_id: string | null;
  order_item_ids: string[];
  amount: number;
  tip_amount: number;
  status: 'pending' | 'completed' | 'failed';
  provider: string;
  tap_charge_id: string;
  failure_reason: string;
  refunded: boolean;
  refund_amount: number;
  refunded_at: string | null;
  refunded_by: string | null;
  tap_refund_id: string;
  created_at: string;
}

// --- Digital receipt (English only, per explicit decision) ---

export interface ReceiptLineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  addons: OrderItemAddonSnapshot[];
  lineTotal: number;
}

export interface Receipt {
  items: ReceiptLineItem[];
  subtotalExVat: number;
  vatAmount: number;
  vatRate: number;
  discountAmount: number;
  rewardDescription: string;
  tip: number;
  total: number;
  paidAt: string;
  paymentId: string;
}

// --- Audit log - scoped to exactly 4 action types ---

export type AuditAction = 'void_order' | 'void_item' | 'refund' | 'manual_payment_recorded' | 'payment_integration_updated' | 'receipt_item_removed';

// --- Platform billing receipts - issued by super_admin to a business,
// distinct from the digital Pay Bill Receipt above (that's a customer's
// dine-in receipt; this is Tavzio's own invoice to the restaurant) ---

export interface BillingReceiptLineItem {
  description: string;
  amount: number;
}

export interface BillingReceipt {
  id: string;
  business_id: string;
  receipt_number: string;
  receipt_type: 'one_time' | 'monthly' | 'adjustment';
  line_items: BillingReceiptLineItem[];
  amount: number;
  period_label: string;
  notes: string;
  status: 'issued' | 'void';
  payment_status: 'unpaid' | 'paid';
  payment_link_url: string;
  paid_at: string | null;
  created_at: string;
  // Present only when the receipt saved successfully but Ziina's
  // payment-link call failed at creation time - the receipt still
  // exists (best-effort design), it just has no payment_link_url yet.
  ziinaError?: string;
}

export interface ReceiptBranding {
  stamp_url: string;
  signature_url: string;
  legal_name: string;
  issuer_trn: string;
}

export interface AuditLogEntry {
  id: string;
  business_id: string;
  actor_id: string | null;
  actor_name: string;
  actor_role: string;
  action: AuditAction;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

// --- Support messages (business <-> super admin) ---

export interface SupportMessage {
  id: string;
  business_id: string;
  sender_role: 'business' | 'super_admin';
  sender_id: string | null;
  message: string;
  read_by_business: boolean;
  read_by_super_admin: boolean;
  created_at: string;
}

export interface InboxThread {
  businessId: string;
  businessName: string;
  businessSlug: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}
