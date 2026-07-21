import { useState } from 'react';
import type { CartLine, MenuItem, MenuItemAddon } from '../types';

export function useCart() {
  const [lines, setLines] = useState<CartLine[]>([]);

  function addItem(item: MenuItem, quantity: number, note: string, selectedAddons: MenuItemAddon[] = []) {
    setLines((prev) => [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity, note, selectedAddons }]);
  }

  // Editing an item already in the cart, before submission - previously
  // the only option was remove-and-re-add from scratch.
  function updateLine(index: number, patch: Partial<Pick<CartLine, 'quantity' | 'note' | 'selectedAddons'>>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  // Silently drops any cart lines referencing items that just went
  // unavailable (individually, or via a paused category/business-wide
  // pause) - the customer never gets to submit something that's no
  // longer orderable, without needing an error message interrupting them
  // mid-browse.
  function removeByMenuItemIds(ids: Set<string>) {
    setLines((prev) => prev.filter((l) => !ids.has(l.menuItemId)));
  }

  function clear() {
    setLines([]);
  }

  function lineTotal(line: CartLine) {
    const addonTotal = line.selectedAddons.reduce((sum, a) => sum + Number(a.price), 0);
    return (line.price + addonTotal) * line.quantity;
  }

  const total = lines.reduce((sum, l) => sum + lineTotal(l), 0);

  return { lines, addItem, updateLine, removeLine, removeByMenuItemIds, clear, total, lineTotal };
}
