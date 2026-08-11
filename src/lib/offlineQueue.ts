// =========================================================================
// Offline resilience for the POS terminal specifically - the one place
// in the app where "the internet blinked" genuinely cannot mean "stop
// selling." Scoped deliberately: this queues POS orders locally and
// syncs them the moment connectivity returns, and caches the menu so
// the terminal still has real data to sell from even starting cold with
// no connection. It does NOT make the rest of the app (customer-facing
// pages, dashboard reporting, etc) work offline - that would be a much
// larger, different piece of work than this.
//
// localStorage rather than IndexedDB, on purpose: a POS terminal queues
// at most a handful of orders during a brief outage, not a large
// offline dataset - localStorage's simplicity here is a legitimate
// choice for this size of data, not a corner cut.
// =========================================================================

import { createPosOrder } from './authApi';
import type { MenuCategory, MenuItem } from '../types';

const QUEUE_KEY = 'tavzio_pos_offline_queue';
const MENU_CACHE_KEY = 'tavzio_pos_menu_cache';

export interface QueuedPosOrder {
  localId: string;
  businessId: string;
  tableLabel: string;
  items: { menuItemId: string; quantity: number }[];
  paymentMethod: 'cash' | 'card' | 'other';
  queuedAt: string;
}

export function getQueue(): QueuedPosOrder[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedPosOrder[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function queueOrder(order: Omit<QueuedPosOrder, 'localId' | 'queuedAt'>): QueuedPosOrder {
  const queued: QueuedPosOrder = { ...order, localId: crypto.randomUUID(), queuedAt: new Date().toISOString() };
  const queue = getQueue();
  queue.push(queued);
  saveQueue(queue);
  return queued;
}

// Attempts to send every queued order for real. Each success is removed
// from the queue immediately (not just at the end), so a partial sync -
// connectivity drops again halfway through - never loses track of what
// still needs to go out.
export async function flushQueue(): Promise<{ synced: number; remaining: number }> {
  const queue = getQueue();
  let synced = 0;
  for (const order of queue) {
    try {
      await createPosOrder(order.businessId, {
        tableLabel: order.tableLabel,
        items: order.items,
        paymentMethod: order.paymentMethod,
      });
      synced += 1;
      saveQueue(getQueue().filter((q) => q.localId !== order.localId));
    } catch {
      // Still offline (or a real error) - stop here, leave the rest
      // queued, try again next time flushQueue runs.
      break;
    }
  }
  return { synced, remaining: getQueue().length };
}

// Menu caching - last-known-good copy, so the terminal has real items
// to sell even opening cold with zero connectivity.
export function cacheMenu(categories: MenuCategory[], items: MenuItem[]) {
  try {
    localStorage.setItem(MENU_CACHE_KEY, JSON.stringify({ categories, items, cachedAt: new Date().toISOString() }));
  } catch {
    // Storage full or unavailable - the cache is a nice-to-have, never
    // worth failing the actual order flow over.
  }
}

export function getCachedMenu(): { categories: MenuCategory[]; items: MenuItem[]; cachedAt: string } | null {
  try {
    const raw = localStorage.getItem(MENU_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
