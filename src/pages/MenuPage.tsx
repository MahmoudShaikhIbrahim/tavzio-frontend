import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getMenu, submitOrder } from '../lib/api';
import { useCart } from '../hooks/useCart';
import type { MenuCategory, MenuItem, MenuItemAddon } from '../types';
import { LanguageProvider, useLanguage } from '../lib/i18n/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function MenuPage() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return <LoadingShell />;
  return (
    <LanguageProvider slug={slug}>
      <MenuPageContent slug={slug} />
    </LanguageProvider>
  );
}

function MenuPageContent({ slug }: { slug: string }) {
  const { language, t, isRtl } = useLanguage();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [orderingPaused, setOrderingPaused] = useState(false);
  const [submissionEnabled, setSubmissionEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeItem, setActiveItem] = useState<MenuItem | null>(null);
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [orderNote, setOrderNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');

  const cart = useCart();

  const tapEventId = (() => {
    const stored = sessionStorage.getItem(`tavzio_tap_${slug}`);
    return stored ? Number(stored) : null;
  })();

  function isOrderable(item: MenuItem): boolean {
    if (orderingPaused) return false;
    if (!item.is_available) return false;
    const category = categories.find((c) => c.id === item.category_id);
    if (category?.paused) return false;
    return true;
  }

  useEffect(() => {
    function fetchMenu() {
      getMenu(slug, language)
        .then((res) => {
          setCategories(res.categories);
          setItems(res.items);
          setOrderingPaused(res.orderingPaused);
          setSubmissionEnabled(res.submissionEnabled);

          // Drop anything now unavailable straight out of the cart -
          // a customer should never be able to submit an order for
          // something that went sold-out while they were still browsing.
          const unavailableIds = new Set(
            res.items
              .filter((i) => !i.is_available || res.orderingPaused || res.categories.find((c) => c.id === i.category_id)?.paused)
              .map((i) => i.id)
          );
          if (unavailableIds.size > 0) cart.removeByMenuItemIds(unavailableIds);
        })
        .catch(() => setNotFound(true))
        .finally(() => setLoading(false));
    }

    fetchMenu();
    // Periodic refresh, not just on load - catches an item, category, or
    // the whole business getting paused while a customer is still on
    // this page, not just on their next visit.
    const interval = setInterval(fetchMenu, 20000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, language]);

  async function handleSubmitOrder() {
    if (!tapEventId || cart.lines.length === 0) return;
    setSubmitting(true);
    setError('');
    try {
      await submitOrder(slug, tapEventId, orderNote, cart.lines);
      setConfirmed(true);
      cart.clear();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your order');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingShell />;
  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-ink px-6 text-center" dir={isRtl ? 'rtl' : 'ltr'}>
        <p className="font-display text-xl text-ivory">{t('menuNotAvailable')}</p>
        <p className="text-sm text-ivory-dim">{t('menuNotAvailableDesc')}</p>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink px-6 text-center" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-brass">
          <span className="font-display text-2xl text-brass">✓</span>
        </div>
        <p className="font-display text-xl text-ivory">{t('orderSent')}</p>
        <p className="text-sm text-ivory-dim">{t('orderSentDesc')}</p>
        <button
          onClick={() => navigate(`/${slug}`)}
          className="mt-4 rounded-lg border border-brass/40 px-4 py-2 text-sm text-brass hover:bg-brass/10"
        >
          {t('backTo', { slug })}
        </button>
      </div>
    );
  }

  // Ordering (adding to a cart and submitting) needs proof of a real, fresh
  // tap - browsing a read-only menu doesn't touch anything sensitive and
  // doesn't need that same guarantee, so this gate only applies once
  // submission is actually possible.
  if (submissionEnabled && !tapEventId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-ink px-6 text-center" dir={isRtl ? 'rtl' : 'ltr'}>
        <p className="font-display text-xl text-ivory">{t('orderingNeedsFreshTap')}</p>
        <p className="text-sm text-ivory-dim">{t('orderingNeedsFreshTapDesc')}</p>
      </div>
    );
  }

  function renderItem(item: MenuItem) {
    if (!submissionEnabled) {
      // Read-only: name, description, photo, and price still show - just
      // no way to add it to an order, since there's no ordering to add it to.
      return (
        <div
          key={item.id}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-ink-line bg-ink-soft px-5 py-4 text-start"
        >
          {item.image_url && <img src={item.image_url} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />}
          <div className="flex-1">
            <p className="font-body text-[15px] font-medium text-ivory">{item.name}</p>
            {item.description && <p className="mt-0.5 text-xs text-ivory-dim">{item.description}</p>}
          </div>
          <span className="shrink-0 ps-3 text-sm text-brass">{item.price.toFixed(2)}</span>
        </div>
      );
    }
    const orderable = isOrderable(item);
    return (
      <button
        key={item.id}
        onClick={() => orderable && setActiveItem(item)}
        disabled={!orderable}
        className={`flex w-full items-center gap-4 justify-between rounded-xl border px-5 py-4 text-start ${
          orderable ? 'border-ink-line bg-ink-soft' : 'cursor-not-allowed border-ink-line bg-ink-soft/40 opacity-60'
        }`}
      >
        {item.image_url && <img src={item.image_url} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />}
        <div className="flex-1">
          <p className="font-body text-[15px] font-medium text-ivory">{item.name}</p>
          {item.description && <p className="mt-0.5 text-xs text-ivory-dim">{item.description}</p>}
          {orderable && (item.addons && item.addons.length > 0) && <p className="mt-0.5 text-xs text-brass/70">{t('addonsAvailable')}</p>}
          {!orderable && <p className="mt-0.5 text-xs font-medium text-danger">{t('unavailable')}</p>}
        </div>
        <span className="shrink-0 ps-3 text-sm text-brass">{item.price.toFixed(2)}</span>
      </button>
    );
  }

  const editingLine = editingLineIndex != null ? cart.lines[editingLineIndex] : null;
  const editingItem = editingLine ? items.find((i) => i.id === editingLine.menuItemId) || null : null;

  return (
    <div className={`min-h-screen bg-ink ${submissionEnabled ? 'pb-32' : 'pb-16'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="mx-auto max-w-md px-6 pt-10">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl text-ivory">{t('menu')}</h1>
          <LanguageSwitcher />
        </div>

        {categories.map((cat) => {
          const catItems = items.filter((i) => i.category_id === cat.id);
          if (catItems.length === 0) return null;
          return (
            <div key={cat.id} className="mt-6">
              <h2 className="font-mono text-[11px] uppercase tracking-wider text-brass">{cat.name}</h2>
              <div className="mt-2 space-y-3">
                {catItems.map(renderItem)}
              </div>
            </div>
          );
        })}

        {items.some((i) => !i.category_id) && (
          <div className="mt-6 space-y-3">
            {items.filter((i) => !i.category_id).map(renderItem)}
          </div>
        )}
      </div>

      {/* Adding a brand-new item */}
      {submissionEnabled && activeItem && (
        <AddToCartSheet
          item={activeItem}
          onClose={() => setActiveItem(null)}
          onSave={(qty, note, addons) => {
            cart.addItem(activeItem, qty, note, addons);
            setActiveItem(null);
          }}
        />
      )}

      {/* Editing something already in the cart, before submission */}
      {submissionEnabled && editingLine && editingItem && (
        <AddToCartSheet
          item={editingItem}
          initialQuantity={editingLine.quantity}
          initialNote={editingLine.note}
          initialAddons={editingLine.selectedAddons}
          isEditing
          onClose={() => setEditingLineIndex(null)}
          onSave={(qty, note, addons) => {
            cart.updateLine(editingLineIndex!, { quantity: qty, note, selectedAddons: addons });
            setEditingLineIndex(null);
          }}
        />
      )}

      {submissionEnabled && cart.lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-ink-line bg-ink-soft px-5 py-4">
          <div className="mx-auto max-w-md">
            <div className="mb-2 max-h-40 space-y-1.5 overflow-y-auto text-sm">
              {cart.lines.map((l, i) => (
                <div key={i} className="flex items-start justify-between text-ivory-dim">
                  <button onClick={() => setEditingLineIndex(i)} className="flex-1 text-start hover:text-ivory">
                    <span>{l.quantity}× {l.name}{l.note ? ` (${l.note})` : ''}</span>
                    {l.selectedAddons.length > 0 && (
                      <span className="block text-xs text-brass/70">+ {l.selectedAddons.map((a) => a.name).join(', ')}</span>
                    )}
                  </button>
                  <button onClick={() => cart.removeLine(i)} className="ms-2 shrink-0 text-danger">✕</button>
                </div>
              ))}
            </div>
            <input
              placeholder={t('orderNoteePlaceholder')}
              value={orderNote}
              onChange={(e) => setOrderNote(e.target.value)}
              className="mb-2 w-full rounded-lg border border-ink-line bg-ink px-3 py-2 text-sm text-ivory placeholder:text-ivory-dim/60"
            />
            {error && <p className="mb-2 text-sm text-danger">{error}</p>}
            <button
              onClick={handleSubmitOrder}
              disabled={submitting}
              className="w-full rounded-lg bg-brass px-4 py-3 font-medium text-ink disabled:opacity-50"
            >
              {submitting ? t('sending') : `${t('sendOrder')} — ${cart.total.toFixed(2)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddToCartSheet({ item, initialQuantity = 1, initialNote = '', initialAddons = [], isEditing, onClose, onSave }: {
  item: MenuItem;
  initialQuantity?: number;
  initialNote?: string;
  initialAddons?: MenuItemAddon[];
  isEditing?: boolean;
  onClose: () => void;
  onSave: (qty: number, note: string, addons: MenuItemAddon[]) => void;
}) {
  const { t } = useLanguage();
  const [quantity, setQuantity] = useState(initialQuantity);
  const [note, setNote] = useState(initialNote);
  const [selectedAddonIds, setSelectedAddonIds] = useState<Set<string>>(new Set(initialAddons.map((a) => a.id)));

  function toggleAddon(id: string) {
    setSelectedAddonIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const selectedAddons = (item.addons || []).filter((a) => selectedAddonIds.has(a.id));
  const addonTotal = selectedAddons.reduce((sum, a) => sum + a.price, 0);
  const lineTotal = (item.price + addonTotal) * quantity;

  return (
    <div className="fixed inset-0 z-10 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="w-full rounded-t-2xl border-t border-ink-line bg-ink-soft p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {item.image_url && <img src={item.image_url} alt="" className="mb-3 h-40 w-full rounded-xl object-cover" />}
        <p className="font-display text-lg text-ivory">{item.name}</p>
        {item.description && <p className="mt-1 text-sm text-ivory-dim">{item.description}</p>}
        <p className="mt-1 text-sm text-brass">{item.price.toFixed(2)}</p>

        {(item.addons && item.addons.length > 0) && (
          <div className="mt-4 space-y-1.5">
            <p className="text-xs uppercase tracking-wide text-ivory-dim">{t('addons')}</p>
            {(item.addons || []).map((addon) => (
              <label key={addon.id} className="flex items-center justify-between rounded-lg border border-ink-line px-3 py-2">
                <span className="flex items-center gap-2 text-sm text-ivory">
                  <input
                    type="checkbox"
                    checked={selectedAddonIds.has(addon.id)}
                    onChange={() => toggleAddon(addon.id)}
                    className="accent-brass"
                  />
                  {addon.name}
                </span>
                <span className="text-sm text-brass">+{addon.price.toFixed(2)}</span>
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
          placeholder={t('itemNotePlaceholder')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-4 w-full rounded-lg border border-ink-line bg-ink px-3 py-2 text-sm text-ivory placeholder:text-ivory-dim/60"
        />

        <button
          onClick={() => onSave(quantity, note, selectedAddons)}
          className="mt-4 w-full rounded-lg bg-brass px-4 py-3 font-medium text-ink"
        >
          {isEditing ? t('saveChanges') : t('addToOrder')} — {lineTotal.toFixed(2)}
        </button>
      </div>
    </div>
  );
}

function LoadingShell() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink">
      <div className="h-10 w-10 animate-pulse rounded-full border-2 border-brass/40" />
    </div>
  );
}
