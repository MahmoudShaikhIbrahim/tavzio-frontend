export interface LinkButtonConfig {
  enabled: boolean;
  value: string;
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
  };
  booking: {
    menuView: boolean;
    submission: boolean;
    integration: boolean;
  };
  loyalty: boolean;
  staffAccounts: boolean;
}

export interface Business {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
  cover_image_url: string;
  description: string;
  links: BusinessLinks;
  theme: { darkMode: boolean; accentColor: string };
  category: string;
  features: BusinessFeatures;
  loyaltyProgram: LoyaltyProgram | null;
  paymentEnabled: boolean;
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
  theme: { darkMode: boolean; accentColor: string };
  status: 'active' | 'suspended' | 'pending';
  features: BusinessFeatures;
  notification_settings: NotificationSettings;
  created_at: string;
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
}

export interface AnalyticsSummary {
  range: { from: string; to: string };
  totalTaps: number;
  tapsByDay: { day: string; count: number }[];
  eventsByType: { type: string; count: number }[];
  devicesSplit: { device: string; count: number }[];
  topHours: { hour: number; count: number }[];
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
  sort_order: number;
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
  description: string;
  price: number;
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

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
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

export type PosProvider = 'foodics' | 'square' | 'zenoti' | 'loyverse' | 'fresha' | 'tap' | 'custom';
export type PosPurpose = 'ordering' | 'booking' | 'payment';

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

export type AuditAction = 'void_order' | 'void_item' | 'refund' | 'staff_order_placed' | 'card_deleted';

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
