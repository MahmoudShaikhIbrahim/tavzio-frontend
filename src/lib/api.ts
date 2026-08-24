import type {
  Business, LoyaltyMembership, TapResponse, MenuCategory, MenuItem, OrderRow, CartLine,
  OrderRequestType, BillItem, PaymentRow, Receipt, LoyaltyCheckinResponse, LoyaltyClaim,
} from '../types';
import { getDeviceToken } from './session';
import { getVisitorId } from './visitor';
import { fetchWithTimeout } from './fetchWithTimeout';
import { safeJson } from './safeJson';

// In dev, Vite's proxy (see vite.config.ts) forwards /api to localhost:5000.
// In production, set VITE_API_BASE_URL to the deployed backend's URL.
const BASE = import.meta.env.VITE_API_BASE_URL || '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetchWithTimeout(`${BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Visitor-Id': getVisitorId(),
        ...options?.headers,
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('This is taking too long — check your connection and try again');
    }
    throw err;
  }
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data as T;
}

export function resolveCardTap(cardUid: string) {
  const deviceToken = getDeviceToken();
  return request<TapResponse>(`/api/public/tap/${cardUid}`, {
    headers: deviceToken ? { 'X-Device-Token': deviceToken } : {},
  });
}

export function getBusiness(slug: string, lang?: string) {
  return request<Business>(`/api/public/business/${slug}${lang ? `?lang=${lang}` : ''}`);
}

export function logEvent(slug: string, type: string, cardUid?: string) {
  return request<{ message: string }>(`/api/public/business/${slug}/event`, {
    method: 'POST',
    body: JSON.stringify({ type, cardUid }),
    keepalive: true,
  });
}

export function loyaltyCheckin(slug: string, phone: string, tapEventId: number) {
  return request<LoyaltyCheckinResponse>(
    `/api/public/business/${slug}/loyalty/checkin`,
    { method: 'POST', body: JSON.stringify({ phone, tapEventId }) }
  );
}

export function loyaltyStatus(slug: string, phone: string) {
  return request<Partial<LoyaltyCheckinResponse> & { membership: LoyaltyMembership | null }>(
    `/api/public/business/${slug}/loyalty/status?phone=${encodeURIComponent(phone)}`
  );
}

export function claimReward(slug: string, phone: string, tapEventId: number) {
  return request<{ claim: LoyaltyClaim }>(`/api/public/business/${slug}/loyalty/claim`, {
    method: 'POST',
    body: JSON.stringify({ phone, tapEventId }),
  });
}

export function getMenu(slug: string, lang?: string) {
  return request<{
    categories: MenuCategory[]; items: MenuItem[]; orderingPaused: boolean;
    submissionEnabled: boolean; callWaiterEnabled: boolean; requestBillEnabled: boolean;
    payBeforeOrderEnabled: boolean;
  }>(`/api/public/business/${slug}/menu${lang ? `?lang=${lang}` : ''}`);
}

function cartItemsPayload(cart: CartLine[]) {
  return cart.map((c) => ({
    menuItemId: c.menuItemId,
    quantity: c.quantity,
    note: c.note,
    addonIds: c.selectedAddons.map((a) => a.id),
  }));
}

// Tap in-page flow (pay-before-order) - charges immediately with a card
// token and, only on success, sends the order to the kitchen.
export function payOrder(slug: string, tapEventId: number, note: string, cart: CartLine[], tapToken: string) {
  return request<{ order: OrderRow; payment: PaymentRow }>(`/api/public/business/${slug}/orders/pay`, {
    method: 'POST',
    body: JSON.stringify({ tapEventId, note, items: cartItemsPayload(cart), tapToken }),
  });
}

// Redirect providers (Telr/N-Genius/Ziina) - returns the hosted page URL
// to send the customer to before anything reaches the kitchen.
export function createOrderPaySession(slug: string, tapEventId: number, note: string, cart: CartLine[]) {
  return request<{ paymentId: string; redirectUrl: string; orderId: string }>(`/api/public/business/${slug}/orders/pay-session`, {
    method: 'POST',
    body: JSON.stringify({ tapEventId, note, items: cartItemsPayload(cart) }),
  });
}

// Called when the customer lands back from the provider's page.
export function confirmOrderPayment(slug: string, paymentId: string) {
  return request<{ status: string; order?: OrderRow }>(`/api/public/business/${slug}/orders/confirm-payment`, {
    method: 'POST',
    body: JSON.stringify({ paymentId }),
  });
}

// Pay in cash - no charge happens; the order is created and flagged for
// staff to collect cash for, same "pay at cashier" pattern as Pay Bill.
export function payOrderWithCash(slug: string, tapEventId: number, note: string, cart: CartLine[]) {
  return request<{ order: OrderRow; message: string }>(`/api/public/business/${slug}/orders/pay-cash`, {
    method: 'POST',
    body: JSON.stringify({ tapEventId, note, items: cartItemsPayload(cart) }),
  });
}

// Customer backs out of checkout before paying - the order (if created)
// is cancelled and never reaches the kitchen.
export function cancelOrderPayment(slug: string, orderId: string, tapEventId: number) {
  return request<{ message: string }>(`/api/public/business/${slug}/orders/${orderId}/cancel-payment`, {
    method: 'POST',
    body: JSON.stringify({ tapEventId }),
  });
}

export function submitOrder(
  slug: string,
  tapEventId: number,
  note: string,
  cart: CartLine[],
  requestType: OrderRequestType = 'order'
) {
  return request<{ order: OrderRow }>(`/api/public/business/${slug}/orders`, {
    method: 'POST',
    body: JSON.stringify({
      tapEventId,
      note,
      requestType,
      items: cart.map((c) => ({
        menuItemId: c.menuItemId,
        quantity: c.quantity,
        note: c.note,
        addonIds: c.selectedAddons.map((a) => a.id),
      })),
    }),
  });
}

// Call Waiter / Request Bill - no items, just a flagged quick request that
// shows up on the same live Orders screen.

// Real replacement, not an addition: the old service-appointment
// getServices/submitBooking (salon/spa style) used to live at these
// exact paths - retired on the backend (see publicRoutes.js) since
// this new flow supersedes it, confirmed via search these were only
// ever called from BookingPage.tsx, which now calls these instead.
export interface BookingConfig {
  businessName: string;
  allowPreOrder: boolean;
  downPayment: { enabled: boolean; mode?: 'full' | 'percentage' | 'fixed'; value?: number };
  menu: { id: string; name: string; price: number; description: string; image_url: string; menu_categories?: { name: string } | null }[];
}
export function getBookingConfig(slug: string) {
  return request<BookingConfig>(`/api/public/business/${slug}/booking-config`);
}

export function requestBookingOtp(slug: string, phone: string) {
  return request<{ message: string }>(`/api/public/business/${slug}/booking-otp/request`, {
    method: 'POST', body: JSON.stringify({ phone }),
  });
}

export function verifyBookingOtp(slug: string, phone: string, code: string) {
  return request<{ message: string }>(`/api/public/business/${slug}/booking-otp/verify`, {
    method: 'POST', body: JSON.stringify({ phone, code }),
  });
}

export interface CreateBookingResponse {
  booking: { id: string; status: string; down_payment_status: string };
  paymentRequired: boolean;
  redirectUrl?: string;
  paymentId?: string;
}
export function submitPublicBooking(slug: string, payload: {
  phone: string; guestName: string; partySize: number; requestedAt: string; note?: string;
  items?: { menuItemId: string; quantity: number }[]; foodReadyOffsetMinutes?: number;
}) {
  return request<CreateBookingResponse>(`/api/public/business/${slug}/bookings`, {
    method: 'POST', body: JSON.stringify(payload),
  });
}

export function getBookingPaymentStatus(bookingId: string) {
  return request<{ id: string; status: string; down_payment_status: string }>(`/api/public/bookings/${bookingId}/status`);
}

export function cancelPublicBooking(bookingId: string, phone: string) {
  return request<{ id: string; status: string }>(`/api/public/bookings/${bookingId}/cancel`, {
    method: 'POST', body: JSON.stringify({ phone }),
  });
}

export interface BookingArrival {
  id: string; guest_name: string; party_size: number; requested_at: string;
}
export function getBookingArrival(bookingId: string) {
  return request<BookingArrival>(`/api/public/bookings/${bookingId}/arrival`);
}
export function confirmBookingArrival(bookingId: string) {
  return request<{ id: string }>(`/api/public/bookings/${bookingId}/confirm-arrival`, { method: 'POST' });
}

export function getBill(slug: string, tapEventId: number, phone?: string) {
  const qs = phone ? `&phone=${encodeURIComponent(phone)}` : '';
  return request<{ items: BillItem[]; paidItems: BillItem[]; total: number; subtotal: number; discountAmount: number; rewardDescription: string }>(
    `/api/public/business/${slug}/bill?tapEventId=${tapEventId}${qs}`
  );
}

export function payBill(
  slug: string,
  tapEventId: number,
  itemIds: string[] | null,
  tipAmount: number,
  tapToken: string,
  phone?: string
) {
  return request<{ payment: PaymentRow; receipt: Receipt }>(`/api/public/business/${slug}/bill/pay`, {
    method: 'POST',
    body: JSON.stringify({ tapEventId, itemIds, tipAmount, tapToken, phone }),
  });
}

// Customer intent only - never marks anything paid, just flags the
// selected items and alerts staff to come collect cash. See BillPage's
// "Pay in cash" action.
export function markItemsCashPending(slug: string, tapEventId: number, itemIds: string[]) {
  return request<{ message: string; itemIds: string[] }>(`/api/public/business/${slug}/bill/cash-pending`, {
    method: 'POST',
    body: JSON.stringify({ tapEventId, itemIds }),
  });
}

// Redirect providers (Telr, N-Genius): starts the payment and returns the
// provider's hosted page URL to send the customer to.
export function createBillPaySession(slug: string, tapEventId: number, itemIds: string[] | null, tipAmount: number, phone?: string) {
  return request<{ paymentId: string; redirectUrl: string }>(`/api/public/business/${slug}/bill/pay-session`, {
    method: 'POST',
    body: JSON.stringify({ tapEventId, itemIds, tipAmount, phone }),
  });
}

// Called when the customer lands back from the provider's page - the
// backend verifies the real outcome with the provider before completing.
export function confirmBillPayment(slug: string, paymentId: string, phone?: string) {
  return request<{ status: string; payment?: PaymentRow; receipt?: Receipt }>(`/api/public/business/${slug}/bill/confirm`, {
    method: 'POST',
    body: JSON.stringify({ paymentId, phone }),
  });
}

// Explicitly gives up a payment attempt - releases the item reservation
// immediately instead of making the customer, or anyone else waiting on
// the same items, sit out the full 5-minute window.
export function cancelBillPaySession(slug: string, paymentId: string) {
  return request<{ status: string }>(`/api/public/business/${slug}/bill/cancel`, {
    method: 'POST',
    body: JSON.stringify({ paymentId }),
  });
}

// Submits a notification-type custom button request (Call a Waiter,
// Request the Bill, Housekeeping, or any owner-defined one) - lands in
// the same staff-facing Requests list as everything else.
export function submitCustomButtonRequest(slug: string, buttonId: string, tapEventId: number) {
  return request<{ order: OrderRow }>(`/api/public/business/${slug}/custom-buttons/${buttonId}/request`, {
    method: 'POST',
    body: JSON.stringify({ tapEventId }),
  });
}

// The marketing homepage's lead capture - no auth, this is the top of
// the funnel, not customer/business data. Serves both the full "Get
// Started" intake and the lighter "Contact us for pricing" form (see
// migration 0087) - source distinguishes which one on the backend.
export function submitLead(payload: {
  email: string; phone: string; source?: 'get_started' | 'pricing_inquiry';
  businessName?: string; businessType?: string; standsEstimate?: number; currentPosSystem?: string;
  preferredContactMethod?: 'email' | 'phone'; note?: string;
}) {
  return request<{ message: string }>('/api/public/leads', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
