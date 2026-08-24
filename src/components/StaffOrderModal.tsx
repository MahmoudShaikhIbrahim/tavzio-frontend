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

  // All three fire together on open rather than one waiting on another -
  // cards (needed for step 1) is normally the fastest of the three, so
  // by the time a table's picked and step 2 needs the menu, it's very
  // likely already sitting there ready rather than starting a fresh
  // wait right when it matters most.
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

  const selectedCard = cards.find((c) => c.id === selectedCardId);

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-ink/80 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-ink-line bg-ink-soft p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-ivory">
            {selectedCardId ? (
              <button type="button" onClick={() => setSelectedCardId('')} className="flex items-center gap-1.5 hover:text-brass">
                <span className="text-base">←</span> {selectedCard?.label || selectedCard?.uid}
              </button>
            ) : (
              'Order for a table'
            )}
          </h2>
          <button type="button" onClick={onClose} className="text-ivory-dim hover:text-ivory">✕</button>
        </div>

        {/* Step 1: pick a table - shown first and on its own, so staff
            aren't waiting on the (often larger, slower) menu list before
            they can even start. Big tappable rows, not a cramped dropdown. */}
        {!selectedCardId && (
          <div className="mt-4 space-y-1.5">
            {cards.length === 0 && <p className="text-base text-ivory-dim">Loading tables...</p>}
            {cards.map((c) => (
              <button type="button"
                key={c.id}
                onClick={() => setSelectedCardId(c.id)}
                className="flex w-full items-center justify-between rounded-lg border border-ink-line px-4 py-3 text-left text-base text-ivory hover:border-brass/40"
              >
                {c.label || c.uid}
                <span className="text-ivory-dim">→</span>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: the menu itself - by now categories/items have almost
            certainly already finished loading in the background from the
            effect above, since picking a table takes at least a moment. */}
        {selectedCardId && !activeItem && (
          <div className="mt-4 space-y-4">
            {categories.length === 0 && items.length === 0 && <p className="text-base text-ivory-dim">Loading menu...</p>}
            {categories.map((cat) => {
              const catItems = items.filter((i) => i.category_id === cat.id && i.is_available);
              if (catItems.length === 0) return null;
              return (
                <div key={cat.id}>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-brass">{cat.name}</p>
                  <div className="mt-1.5 space-y-1.5">
                    {catItems.map((item) => (
                      <button type="button"
                        key={item.id}
                        onClick={() => openItem(item)}
                        className="flex w-full items-center gap-3 rounded-lg border border-ink-line px-3 py-2 text-left text-base"
                      >
                        {item.image_url && <img src={item.image_url} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />}
                        <span className="flex-1 text-ivory">{item.name}</span>
                        <span className="shrink-0 text-brass">{item.price.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Addon/quantity picker - inline within this same modal frame
            rather than a separate full-screen overlay stacking on top,
            so adding an item never feels like it left to a different page. */}
        {activeItem && (
          <div className="mt-4">
            <button type="button" onClick={() => setActiveItem(null)} className="mb-3 text-base text-brass hover:underline">← Back to menu</button>
            <div className="flex items-center gap-3">
              {activeItem.image_url && <img src={activeItem.image_url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />}
              <p className="font-display text-xl text-ivory">{activeItem.name}</p>
            </div>
            <ItemPicker
              addons={activeAddons}
              onAdd={(qty, note, addons) => {
                cart.addItem(activeItem, qty, note, addons);
                setActiveItem(null);
              }}
            />
          </div>
        )}

        {cart.lines.length > 0 && (
          <div className="mt-4 space-y-1.5 border-t border-ink-line pt-3 text-base">
            {cart.lines.map((l, i) => (
              <div key={i} className="flex items-center justify-between text-ivory-dim">
                <span>{l.quantity}× {l.name}{l.note ? ` (${l.note})` : ''}</span>
                <button type="button" onClick={() => cart.removeLine(i)} className="text-danger">✕</button>
              </div>
            ))}
            <p className="pt-1 text-ivory">Total: {cart.total.toFixed(2)}</p>
          </div>
        )}

        {selectedCardId && !activeItem && (
          <>
            <input
              placeholder="Order note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-3 w-full rounded-lg border border-ink-line bg-ink px-3 py-2 text-sm text-ivory placeholder:text-ivory-dim/60"
            />

            {error && <p className="mt-2 text-base text-danger">{error}</p>}

            <button type="button"
              onClick={handleSubmit}
              disabled={submitting || cart.lines.length === 0}
              className="mt-4 w-full rounded-lg bg-brass px-4 py-3 font-medium text-ink disabled:opacity-50"
            >
              {submitting ? 'Placing...' : 'Place order'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ItemPicker({ addons, onAdd }: {
  addons: MenuItemAddon[]; onAdd: (qty: number, note: string, addons: MenuItemAddon[]) => void;
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
    <div className="mt-3">
      {addons.length > 0 && (
        <div className="space-y-1.5">
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
        <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="h-9 w-9 rounded-full border border-ink-line text-ivory">−</button>
        <span className="w-6 text-center text-ivory">{quantity}</span>
        <button type="button" onClick={() => setQuantity((q) => q + 1)} className="h-9 w-9 rounded-full border border-ink-line text-ivory">+</button>
      </div>
      <input
        placeholder="Note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mt-3 w-full rounded-lg border border-ink-line bg-ink px-3 py-2 text-sm text-ivory placeholder:text-ivory-dim/60"
      />
      <button type="button"
        onClick={() => onAdd(quantity, note, addons.filter((a) => selectedIds.has(a.id)))}
        className="mt-4 w-full rounded-lg bg-brass px-4 py-3 font-medium text-ink"
      >
        Add
      </button>
    </div>
  );
}
