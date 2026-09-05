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
  // Deliberately a separate key from "booking" above (which gates the
  // internal staff-facing bookings tab, unrelated) - the public online
  // booking page's own config: on/off, whether it takes a food
  // pre-order alongside the reservation, and the down payment rules.
  onlineBooking?: {
    enabled: boolean;
    allowPreOrder: boolean;
    downPayment: {
      enabled: boolean;
      mode?: 'full' | 'percentage' | 'fixed';
      value?: number;
    };
    // Real, explicit addition for the drive-through feature: shown as
    // a "Location" option on the same chooser page as Book a Table /
    // Drive Through - not drive-through-specific itself (it's part of
    // the shared chooser), but edited from within the Drive Through
    // settings section per the explicit request.
    locationUrl?: string;
  };
  // Real, explicit addition: drive-through ordering, configured as its
  // own advanced section inside "Buttons and Links" (see
  // LandingButtonsPage.tsx) - separate from onlineBooking/booking above
  // since it's a genuinely different flow (no table, no reservation,
  // reaches the kitchen like a normal order), not a variant of either.
  driveThrough?: {
    enabled: boolean;
    downPayment: {
      enabled: boolean;
      mode?: 'full' | 'percentage' | 'fixed';
      value?: number;
    };
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
  // Owner-only HR module, off by default - each sub-module independent
  // so a business can turn on just documents, or just commission, etc.
  hr?: {
    enabled: boolean;
    documents: boolean;
    commission: boolean;
    tips: boolean;
    scheduling?: boolean;
    laborCost?: boolean;
  };
  forecasting?: {
    enabled: boolean;
  };
  payroll?: {
    enabled: boolean;
  };
  accounting?: {
    enabled: boolean;
  };
  channelManager?: {
    enabled: boolean;
  };
  marketing?: {
    enabled: boolean;
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
  role: 'super_admin' | 'org_owner' | 'business_owner' | 'staff';
  business_id: string | null;
  is_active: boolean;
  email?: string;
  theme_preference: 'light' | 'dark' | 'system';
  preferred_language: 'en' | 'ar' | 'ru' | 'es' | 'hi' | 'ur' | 'tl' | 'zh' | 'fr';
  must_change_password: boolean;
  job_role?: string | null;
  assigned_sections?: string[] | null;
  assigned_outlet_ids?: string[] | null;
  // Owner-granted, staff-only - see migration 0083. When true, this
  // account passes every owner-only check server-side, not just a UI
  // hint - authorize() and current_role_name() both honor it directly.
  full_access?: boolean;
  // Org-management capability layered on top of role - not a role swap.
  // See migration 0098, same pattern as full_access above but for
  // multi-location org duties instead of owner-equivalence.
  is_org_owner?: boolean;
  // Per-person dashboard tab hide/reorder, plus which Settings pages (if
  // any) are pinned onto the main dashboard tab row. null = default
  // order, nothing hidden, nothing pinned.
  nav_layout?: { hidden: string[]; order: string[]; pinned?: string[] } | null;
  // NULL = tour not yet shown/completed - dashboard auto-opens it. Set
  // once completed/skipped; "Restart guide" in Business Profile clears
  // it back to null.
  tour_completed_at?: string | null;
  // Self-service profile picture - null/undefined shows an initials
  // circle instead.
  avatar_url?: string | null;
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
  tourism_dirham_rate_aed: number;
  operating_hours: Record<string, { open: string; close: string } | null> | null;
  booking_hours: Record<string, { open: string; close: string } | null> | null;
  created_at: string;
  contractCountdown: {
    contractNumber: string;
    paymentFrequency: 'monthly' | 'quarterly' | 'yearly';
    nextBillingDate: string;
    daysToBilling: number;
    endDate: string;
    daysToExpiry: number;
    expiryWarningDays: number;
  } | null;
}

export interface Contract {
  id: string;
  business_id: string | null;
  client_name: string | null;
  client_email: string | null;
  client_business_name: string | null;
  client_category: string | null;
  contract_number: string;
  start_date: string;
  end_date: string;
  payment_frequency: 'monthly' | 'quarterly' | 'yearly';
  stands_count: number;
  system_fee_aed: number;
  card_price_aed: number;
  annual_total_aed: number;
  status: 'draft' | 'sent' | 'signed' | 'paid' | 'active' | 'terminated' | 'expired';
  signed_snapshot_text: string | null;
  signed_by_name: string | null;
  signed_at: string | null;
  created_at: string;
  terminated_at?: string | null;
  terminated_by?: string | null;
  termination_reason?: string | null;
  termination_basis?: 'non_payment' | 'material_breach' | 'client_convenience' | 'mutual_agreement' | null;
  countdown: {
    nextBillingDate: string;
    daysToBilling: number;
    daysToExpiry: number;
    expiryWarningDays: number;
  } | null;
}

export interface DigitalCardAnalytics {
  view: number;
  phone_click: number;
  whatsapp_click: number;
  email_click: number;
  website_click: number;
  social_click: number;
  save_contact: number;
  share: number;
}

export interface DigitalCard {
  id: string;
  business_id: string | null;
  owner_user_id: string | null;
  slug: string;
  card_type: 'business' | 'person';
  status: 'draft' | 'active' | 'inactive';
  name: string;
  title: string;
  company: string;
  description: string;
  logo_url: string | null;
  photo_url: string | null;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  address: string;
  location_url: string;
  working_hours: string;
  contact_visibility: Record<string, boolean>;
  social_links: Record<string, { url: string; enabled: boolean }>;
  design: { template?: string; primaryColor?: string; secondaryColor?: string; buttonStyle?: string };
  created_at: string;
  updated_at?: string;
}

export interface Supplier {
  id: string;
  business_id: string | null;
  organization_id?: string | null;
  name: string;
  contact_name: string;
  phone: string;
  email: string;
}

export interface Warehouse {
  id: string;
  name: string;
  type: 'central' | 'kitchen' | 'dry_store' | 'cold_store' | 'general';
  business_id: string | null;
  organization_id: string | null;
  address: string;
  ingredient_stock?: { ingredient_id: string; quantity: number }[];
}

export interface WarehouseStockLine {
  quantity: number;
  ingredients: { id: string; name: string; unit: string; low_stock_threshold: number };
}

export interface StockTransferItem {
  id: string;
  ingredient_id: string;
  quantity: number;
  ingredients?: { name: string; unit: string };
}

export interface StockTransfer {
  id: string;
  from_warehouse_id: string | null;
  to_warehouse_id: string;
  status: 'requested' | 'approved' | 'in_transit' | 'received' | 'cancelled';
  requested_by: string | null;
  approved_by: string | null;
  received_by: string | null;
  requested_at: string;
  approved_at: string | null;
  received_at: string | null;
  note: string;
  stock_transfer_items?: StockTransferItem[];
  from?: { id: string; name: string } | null;
  to?: { id: string; name: string };
}

export interface PoAllocation {
  id: string;
  purchase_order_item_id: string;
  business_id: string;
  quantity: number;
  received: boolean;
  received_at: string | null;
  received_into_warehouse_id: string | null;
  ingredient_id: string | null;
  purchase_order_items?: {
    item_name: string;
    item_unit: string;
    quantity: number;
    unit_cost_aed: number;
    purchase_orders?: { ordered_at: string; suppliers?: { name: string } | null };
  };
}

export interface OrgPurchaseOrderAllocation {
  id: string;
  business_id: string;
  quantity: number;
  received: boolean;
  businesses?: { name: string };
}

export interface OrgPurchaseOrderItem {
  id: string;
  item_name: string;
  item_unit: string;
  quantity: number;
  unit_cost_aed: number;
  purchase_order_allocations?: OrgPurchaseOrderAllocation[];
}

export interface OrgPurchaseOrder {
  id: string;
  organization_id: string;
  supplier_id: string | null;
  status: 'pending' | 'received' | 'cancelled';
  total_cost_aed: number;
  ordered_at: string;
  suppliers?: { name: string } | null;
  purchase_order_items?: OrgPurchaseOrderItem[];
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
  received_quantity: number;
  ingredients?: { name: string; unit: string };
}

export interface PurchaseOrder {
  id: string;
  business_id: string;
  supplier_id: string | null;
  status: 'pending' | 'partially_received' | 'received' | 'cancelled';
  total_cost_aed: number;
  ordered_at: string;
  received_at: string | null;
  suppliers?: { name: string } | null;
  purchase_order_items: PurchaseOrderItem[];
}

export interface PurchaseOrderReceipt {
  id: string;
  purchase_order_id: string;
  received_by: string | null;
  is_partial: boolean;
  items: { ingredientId: string; name: string; unit: string; receivedNow: number; stillMissing: number }[];
  created_at: string;
  profiles?: { name: string } | null;
}

export interface LowStockIngredient {
  ingredientId: string;
  name: string;
  unit: string;
  stockQty: number;
  lowStockThreshold: number;
  costPerUnit: number;
  supplierId: string | null;
  supplierName: string | null;
  suggestedReorderQty: number;
}

export interface InventoryValuation {
  totalValueAed: number;
  lines: { ingredientId: string; name: string; unit: string; stockQty: number; costPerUnit: number; valueAed: number }[];
}

export interface WasteReport {
  days: number;
  totalCostAed: number;
  byIngredient: { ingredientId: string; name: string; unit: string; quantity: number; costAed: number }[];
  byCategory: { category: string; quantityEvents: number; costAed: number }[];
  events: { id: string; ingredientName: string; quantity: number; unit: string; costAed: number; wasteCategory: string; note: string; createdAt: string }[];
}

export interface MenuItemFoodCost {
  menuItemId: string;
  name: string;
  price: number;
  isAvailable: boolean;
  recipeCostAed: number | null;
  foodCostPct: number | null;
  marginAed: number | null;
  marginPct: number | null;
  trackedByRecipe: boolean;
}

export interface FoodCostReport {
  items: MenuItemFoodCost[];
  avgFoodCostPct: number | null;
  untrackedCount: number;
}

export interface ActualFoodCostReport {
  from: string;
  to: string;
  totalRevenueAed: number;
  totalCostAed: number;
  untrackedRevenueAed: number;
  foodCostPct: number | null;
  byItem: { name: string; quantitySold: number; revenueAed: number; costAed: number; trackedByRecipe: boolean }[];
}

export interface StaffSchedule {
  id: string;
  staffId: string;
  staffName: string;
  scheduledStart: string;
  scheduledEnd: string;
  roleLabel: string;
  notes: string;
  hours: number;
  forecastCostAed: number | null;
}

export interface ScheduleReport {
  schedules: StaffSchedule[];
  totalHours: number;
  totalForecastCostAed: number;
  untrackedShiftCount: number;
}

export interface LaborCostReport {
  from: string;
  to: string;
  totalRevenueAed: number;
  totalLaborCostAed: number;
  laborCostPct: number | null;
  untrackedHours: number;
  overtimeShiftCount: number;
  byStaff: { staffId: string; name: string; hours: number; costAed: number; hourlyRateAed: number | null; overtimeShifts: number }[];
}

export interface MySchedule {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  role_label: string;
  notes: string;
}

export interface SalesForecast {
  days: number;
  historyWeeks: number;
  forecast: { date: string; dayOfWeek: string; forecastRevenueAed: number | null; basedOnSampleSize: number }[];
  totalForecastAed: number;
  lowConfidenceDays: number;
}

export interface BusinessBudget {
  id: string;
  business_id: string;
  period_month: string;
  revenue_budget_aed: number | null;
  food_cost_pct_budget: number | null;
  labor_cost_pct_budget: number | null;
}

export interface BudgetVsActual {
  month: string;
  budget: BusinessBudget | null;
  actual: {
    revenueAed: number;
    foodCostPct: number | null;
    foodCostNote: string;
    laborCostPct: number | null;
    laborCostNote: string;
  };
  variance: { revenueAed: number | null; foodCostPct: number | null; laborCostPct: number | null } | null;
}

export interface Lead {
  id: string;
  email: string;
  phone: string;
  business_name: string;
  business_type: string | null;
  stands_estimate: number;
  current_pos_system: string;
  note: string;
  converted: boolean;
  converted_business_id: string | null;
  created_at: string;
  source: 'get_started' | 'pricing_inquiry';
  preferred_contact_method: 'email' | 'phone' | null;
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
  outlet_id: string | null;
  profiles?: { name: string };
}

export interface FloorTable {
  id: string;
  label: string;
  seatCount: number;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning';
  mergedWithTableId: string | null;
  // Real, explicit addition for the floor plan feature: null until a
  // business actually arranges their map - the list/card view stays
  // the fallback for any table that hasn't been placed yet.
  gridX: number | null;
  gridY: number | null;
  shape: 'round' | 'long';
  zone: string;
  card: { id: string; uid: string; status: string } | null;
  activeOrders: { id: string; card_id: string; total: number; status: string }[];
}

export interface FloorPlanCell { id: string; gridX: number; gridY: number; cellType: 'wall' | 'window' | 'door' | 'counter' | 'plant'; orientation: 'left' | 'right' | 'top' | 'bottom' }

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
  vip: boolean;
  room_preference: string;
  dietary_notes: string;
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
  booking_group_id: string | null;
  hotel_guests?: { name: string; phone: string; email: string };
  hotel_rooms?: { room_number: string; room_type: string };
  hotel_booking_groups?: { id: string; group_name: string } | null;
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
  status: 'open' | 'closed' | 'billed_to_account';
  is_primary: boolean;
  payer_type: 'guest' | 'company';
  company_name: string;
  charges: HotelFolioCharge[];
  balance: number;
  hotel_reservations?: { check_in_date: string; check_out_date: string; hotel_guests: { name: string }; hotel_rooms: { room_number: string } };
}

export interface HotelBookingGroup {
  id: string;
  business_id: string;
  group_name: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  notes: string;
  created_at: string;
  hotel_reservations?: { id: string; status: string; check_in_date: string; check_out_date: string; hotel_rooms?: { room_number: string }; hotel_guests?: { name: string } }[];
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
  room_id: string | null;
  table_id: string | null;
  status: 'active' | 'inactive' | 'lost' | 'disabled';
  last_programmed_at: string;
  created_at: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: 'business_owner' | 'staff' | 'org_owner';
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  assigned_sections: string[] | null;
  assigned_outlet_ids: string[] | null;
  full_access: boolean;
  nav_layout: { hidden: string[]; order: string[]; pinned?: string[] } | null;
  organization_id: string | null;
  is_org_owner: boolean;
  avatar_url?: string | null;
  email?: string | null;
  phone?: string | null;
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
  station?: string;
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

export type OrderStatus = 'awaiting_payment' | 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
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
  course: string;
  course_status: 'held' | 'fired';
  fired_at: string | null;
  station?: string;
}

export interface OrderRow {
  id: string;
  business_id: string;
  card_id: string | null;
  table_label: string;
  order_type: 'dine_in' | 'walk_in' | 'pickup' | 'delivery' | 'drive_through';
  arrival_at?: string | null;
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
  prep_started_at?: string | null;
  ready_at?: string | null;
  order_items: OrderItemRow[];
  source: 'customer_tap' | 'staff_pos' | 'delivery' | 'drive_through';
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
  available_start_time: string | null;
  available_end_time: string | null;
}

export interface ServiceOption {
  id: string;
  service_id: string;
  label: string;
  price_delta: number;
  sort_order: number;
}

export type BookingStatus = 'pending' | 'confirmed' | 'declined' | 'completed' | 'cancelled';

export interface BookingItemRow {
  id: string;
  menu_item_id: string | null;
  item_name: string;
  quantity: number;
  unit_price: number;
}

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
  party_size: number | null;
  table_id: string | null;
  guest_name: string;
  created_by_staff_id: string | null;
  tables?: { label: string } | null;
  customer_phone_verified: boolean;
  food_ready_offset_minutes: number | null;
  arrival_status: 'not_arrived' | 'arrived';
  arrived_at: string | null;
  arrived_via: 'staff' | 'customer_tap' | null;
  down_payment_required_aed: number;
  down_payment_status: 'not_required' | 'pending' | 'paid' | 'failed' | 'refunded';
  booking_items?: BookingItemRow[];
  service_option_id: string | null;
  service_requested_at: string | null;
  services?: { name: string } | null;
  service_options?: { label: string } | null;
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
  button_type: 'link' | 'notification' | 'group';
  notification_destination: 'general' | 'housekeeping_task' | 'maintenance_ticket';
  target_section: string | null;
  parent_button_id: string | null;
  allow_note: boolean;
  color: string | null;
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
  // Added server-side in listPayments - which table this payment came
  // from, and what's still unpaid on that same table right now.
  tableLabel: string | null;
  remainingAed: number | null;
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

// --- Payroll ---

export interface SalaryStructure {
  id: string;
  business_id: string;
  staff_id: string;
  pay_type: 'monthly' | 'hourly' | 'daily';
  base_amount_aed: number;
  housing_allowance_aed: number;
  transport_allowance_aed: number;
  other_allowances_aed: number;
  effective_from: string;
  effective_to: string | null;
  profiles?: { name: string };
}

export interface PayrollRun {
  id: string;
  business_id: string;
  period_start: string;
  period_end: string;
  status: 'draft' | 'approved' | 'paid' | 'cancelled';
  total_gross_aed: number;
  total_deductions_aed: number;
  total_net_aed: number;
  approved_by: string | null;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
  payslips?: Payslip[];
}

export interface PayslipDeduction {
  label: string;
  amountAed: number;
}

export interface Payslip {
  id: string;
  payroll_run_id: string;
  business_id: string;
  staff_id: string;
  base_amount_aed: number;
  allowances_aed: number;
  overtime_hours: number;
  overtime_amount_aed: number;
  tips_amount_aed: number;
  gross_aed: number;
  deductions: PayslipDeduction[];
  total_deductions_aed: number;
  net_aed: number;
  created_at: string;
  profiles?: { name: string };
  payroll_runs?: { period_start: string; period_end: string; status: PayrollRun['status'] };
}

export interface WpsExport {
  id: string;
  payroll_run_id: string;
  business_id: string;
  file_format: 'sif';
  generated_at: string;
  generated_by: string | null;
  sifContent?: string;
  includedCount?: number;
  excludedStaff?: { staffId: string; name: string; missingIban: boolean; missingLabourCard: boolean }[];
}

// --- Accounting ---

export interface ChartAccount {
  id: string;
  business_id: string;
  code: string;
  name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  parent_account_id: string | null;
  is_active: boolean;
}

export interface JournalEntryLine {
  id?: string;
  account_id: string;
  debit_aed: number;
  credit_aed: number;
  memo: string;
  chart_of_accounts?: { code: string; name: string };
}

export interface JournalEntry {
  id: string;
  business_id: string;
  entry_date: string;
  reference: string;
  description: string;
  source_type: string | null;
  status: 'draft' | 'posted' | 'voided';
  journal_entry_lines: JournalEntryLine[];
}

export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  accountType: string;
  debitAed: number;
  creditAed: number;
}

export interface TrialBalance {
  asOf: string;
  rows: TrialBalanceRow[];
  totalDebits: number;
  totalCredits: number;
}

export interface Vendor {
  id: string;
  business_id: string;
  name: string;
  contact_email: string;
  contact_phone: string;
  payment_terms_days: number;
  is_active: boolean;
}

export interface ApBill {
  id: string;
  business_id: string;
  vendor_id: string;
  bill_number: string;
  bill_date: string;
  due_date: string;
  amount_aed: number;
  amount_paid_aed: number;
  status: 'unpaid' | 'partial' | 'paid' | 'overdue' | 'voided';
  vendors?: { name: string };
}

export interface ArInvoice {
  id: string;
  business_id: string;
  customer_name: string;
  customer_email: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount_aed: number;
  amount_received_aed: number;
  status: 'unpaid' | 'partial' | 'paid' | 'overdue' | 'voided';
}

// --- Channel manager ---

export interface ChannelConnection {
  id: string;
  channel: 'booking_com' | 'expedia' | 'airbnb' | 'agoda' | 'other';
  is_active: boolean;
  last_synced_at: string | null;
  last_sync_status: 'success' | 'partial' | 'failed' | null;
  last_sync_error: string;
  created_at: string;
}

export interface ChannelBooking {
  id: string;
  business_id: string;
  channel_connection_id: string;
  external_booking_ref: string;
  guest_name: string;
  guest_email: string;
  room_type: string;
  check_in: string;
  check_out: string;
  total_amount_aed: number;
  status: 'received' | 'confirmed' | 'rejected' | 'cancelled';
  received_at: string;
  channel_connections?: { channel: ChannelConnection['channel'] };
}

// --- Marketing ---

export interface MarketingTemplate {
  id: string;
  business_id: string;
  name: string;
  channel: 'email' | 'sms';
  subject: string;
  body: string;
  category: 'general' | 'welcome' | 'birthday' | 'win_back' | 'review_request' | 'promotion';
}

export interface MarketingCampaign {
  id: string;
  business_id: string;
  name: string;
  channel: 'email' | 'sms';
  subject: string;
  body: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';
  scheduled_for: string | null;
  sent_at: string | null;
  created_at: string;
  recipientCount?: number;
  suppressedCount?: number;
  recipientsSent?: number;
  recipientsFailed?: number;
}

export interface MarketingCampaignStats {
  total: number;
  byStatus: Record<string, number>;
}

export interface MarketingSuppression {
  id: string;
  business_id: string;
  contact_value: string;
  channel: 'email' | 'sms';
  reason: string;
  created_at: string;
}
