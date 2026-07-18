import { useEffect, useState } from 'react';
import { listCards, listMenuItems, listMenuCategories, listAddons, placeStaffOrder } from '../lib/authApi';
import { useCart } from '../hooks/useCart';
import type { Card, MenuCategory, MenuItem, MenuItemAddon } from '../types';

export default function StaffOrderModal({ businessId, onClose, onPlaced }: {
  businessId: string; onClose: () => void; onPlaced: () => void;
}) {
  const [cards, setCards] = useState<Card[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [selectedCardId, setSelectedCardId] = useState('');
  const [activeItem, setActiveItem] = useState<MenuItem | null>(null);
  const [activeAddons, setActiveAddons] = useState<MenuItemAddon[]>([]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const cart = useCart();

  useEffect(() => {
    listCards(businessId).then((all) => setCards(all.filter((c) => !c.linked_user_id && c.status === 'active')));
    listMenuCategories(businessId).then(setCategories);
    listMenuItems(businessId).then((all) => setItems(all.map((i) => ({ ...i, addons: [] }))));
  }, [businessId]);

  async function openItem(item: MenuItem) {
    setActiveItem(item);
    const addons = await listAddons(businessId, item.id);
    setActiveAddons(addons);
  }

  async function handleSubmit() {
    if (!selectedCardId || cart.lines.length === 0) return;
    setSubmitting(true);
    setError('');
    try {
      await placeStaffOrder(
        businessId,
        selectedCardId,
        cart.lines.map((l) => ({
          menuItemId: l.menuItemId,
          quantity: l.quantity,
          note: l.note,
          addonIds: l.selectedAddons.map((a) => a.id),
        })),
        note
      );
      onPlaced();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not place the order');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/70" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl border-t border-ink-line bg-ink-soft p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-ivory">Order for a table</h2>
          <button onClick={onClose} className="text-ivory-dim hover:text-ivory">✕</button>
        </div>

        <select
          value={selectedCardId}
          onChange={(e) => setSelectedCardId(e.target.value)}
          className="mt-4 w-full rounded-lg border border-ink-line bg-ink px-3 py-2.5 text-base text-ivory"
        >
          <option value="">Select a table...</option>
          {cards.map((c) => <option key={c.id} value={c.id}>{c.label || c.uid}</option>)}
        </select>

        <div className="mt-4 space-y-4">
          {categories.map((cat) => {
            const catItems = items.filter((i) => i.category_id === cat.id && i.is_available);
            if (catItems.length === 0) return null;
            return (
              <div key={cat.id}>
                <p className="font-mono text-[11px] uppercase tracking-wider text-brass">{cat.name}</p>
                <div className="mt-1.5 space-y-1.5">
                  {catItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => openItem(item)}
                      className="flex w-full items-center justify-between rounded-lg border border-ink-line px-3 py-2 text-left text-base"
                    >
                      <span className="text-ivory">{item.name}</span>
                      <span className="text-brass">{item.price.toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {cart.lines.length > 0 && (
          <div className="mt-4 space-y-1.5 border-t border-ink-line pt-3 text-base">
            {cart.lines.map((l, i) => (
              <div key={i} className="flex items-center justify-between text-ivory-dim">
                <span>{l.quantity}× {l.name}{l.note ? ` (${l.note})` : ''}</span>
                <button onClick={() => cart.removeLine(i)} className="text-danger">✕</button>
              </div>
            ))}
            <p className="pt-1 text-ivory">Total: {cart.total.toFixed(2)}</p>
          </div>
        )}

        <input
          placeholder="Order note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-3 w-full rounded-lg border border-ink-line bg-ink px-3 py-2 text-sm text-ivory placeholder:text-ivory-dim/60"
        />

        {error && <p className="mt-2 text-base text-danger">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting || !selectedCardId || cart.lines.length === 0}
          className="mt-4 w-full rounded-lg bg-brass px-4 py-3 font-medium text-ink disabled:opacity-50"
        >
          {submitting ? 'Placing...' : 'Place order'}
        </button>
      </div>

      {activeItem && (
        <ItemPicker
          item={activeItem}
          addons={activeAddons}
          onClose={() => setActiveItem(null)}
          onAdd={(qty, note, addons) => {
            cart.addItem(activeItem, qty, note, addons);
            setActiveItem(null);
          }}
        />
      )}
    </div>
  );
}

function ItemPicker({ item, addons, onClose, onAdd }: {
  item: MenuItem; addons: MenuItemAddon[]; onClose: () => void; onAdd: (qty: number, note: string, addons: MenuItemAddon[]) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/70" onClick={onClose}>
      <div className="w-full rounded-t-2xl border-t border-ink-line bg-ink-soft p-5" onClick={(e) => e.stopPropagation()}>
        <p className="font-display text-xl text-ivory">{item.name}</p>
        {addons.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {addons.map((a) => (
              <label key={a.id} className="flex items-center justify-between rounded-lg border border-ink-line px-3 py-2 text-base">
                <span className="flex items-center gap-2 text-ivory">
                  <input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggle(a.id)} className="accent-brass" />
                  {a.name}
                </span>
                <span className="text-brass">+{a.price.toFixed(2)}</span>
              </label>
            ))}
          </div>
        )}
        <div className="mt-4 flex items-center gap-3">
          <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="h-9 w-9 rounded-full border border-ink-line text-ivory">−</button>
          <span className="w-6 text-center text-ivory">{quantity}</span>
          <button onClick={() => setQuantity((q) => q + 1)} className="h-9 w-9 rounded-full border border-ink-line text-ivory">+</button>
        </div>
        <input
          placeholder="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-3 w-full rounded-lg border border-ink-line bg-ink px-3 py-2 text-sm text-ivory placeholder:text-ivory-dim/60"
        />
        <button
          onClick={() => onAdd(quantity, note, addons.filter((a) => selectedIds.has(a.id)))}
          className="mt-4 w-full rounded-lg bg-brass px-4 py-3 font-medium text-ink"
        >
          Add
        </button>
      </div>
    </div>
  );
}
