import type {
  Business, LoyaltyMembership, TapResponse, MenuCategory, MenuItem, OrderRow, CartLine,
  OrderRequestType, Service, BookingRow, BillItem, PaymentRow, Receipt, LoyaltyCheckinResponse, LoyaltyClaim,
} from '../types';
import { getDeviceToken } from './session';
import { getVisitorId } from './visitor';
import { fetchWithTimeout } from './fetchWithTimeout';

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
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data as T;
}

export function resolveCardTap(cardUid: string) {
  const deviceToken = getDeviceToken();
  return request<TapResponse>(`/api/public/tap/${cardUid}`, {
    headers: deviceToken ? { 'X-Device-Token': deviceToken } : {},
  });
}

export function getBusiness(slug: string) {
  return request<Business>(`/api/public/business/${slug}`);
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

export function getMenu(slug: string) {
  return request<{
    categories: MenuCategory[]; items: MenuItem[];
    submissionEnabled: boolean; callWaiterEnabled: boolean; requestBillEnabled: boolean;
  }>(`/api/public/business/${slug}/menu`);
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
export function submitQuickRequest(slug: string, tapEventId: number, requestType: 'call_waiter' | 'request_bill') {
  return request<{ order: OrderRow }>(`/api/public/business/${slug}/orders`, {
    method: 'POST',
    body: JSON.stringify({ tapEventId, requestType, note: '', items: [] }),
  });
}

export function getServices(slug: string) {
  return request<{ services: Service[] }>(`/api/public/business/${slug}/services`);
}

export function submitBooking(
  slug: string,
  tapEventId: number,
  serviceId: string,
  requestedAt: string,
  note: string,
  contactPhone: string
) {
  return request<{ booking: BookingRow }>(`/api/public/business/${slug}/bookings`, {
    method: 'POST',
    body: JSON.stringify({ tapEventId, serviceId, requestedAt, note, contactPhone }),
  });
}

export function getBill(slug: string, tapEventId: number, phone?: string) {
  const qs = phone ? `&phone=${encodeURIComponent(phone)}` : '';
  return request<{ items: BillItem[]; total: number; subtotal: number; discountAmount: number; rewardDescription: string }>(
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
