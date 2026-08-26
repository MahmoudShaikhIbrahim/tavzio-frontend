import { useCallback, useEffect, useState, useRef } from 'react';
import { Search } from 'lucide-react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { subscribeToMenuChanges } from '../lib/supabaseClient';
import { getMenu, submitOrder, getBusiness, payOrder, createOrderPaySession, confirmOrderPayment, cancelOrderPayment, payOrderWithCash } from '../lib/api';
import { buildBusinessThemeVars } from '../lib/businessTheme';
import type { Business } from '../types';
import { useCart } from '../hooks/useCart';
import type { MenuCategory, MenuItem, MenuItemAddon } from '../types';
import { LanguageProvider, useLanguage } from '../lib/i18n/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

// Falls back to the original text whenever a translation is missing for
// the current language (item just added, translation API hiccup, etc.) -
// same graceful-fallback behavior already documented for this feature,
// it just wasn't actually wired up on this page until now.
function translated(base: string, i18n: Record<string, string> | undefined, language: string): string {
  return i18n?.[language] || base;
}

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
  const [layoutMode, setLayoutMode] = useState<'rows' | 'grid'>(
    () => (localStorage.getItem('tavzio_menu_layout') as 'rows' | 'grid') || 'rows'
  );
  function toggleLayout() {
    setLayoutMode((prev) => {
      const next = prev === 'rows' ? 'grid' : 'rows';
      localStorage.setItem('tavzio_menu_layout', next);
      return next;
    });
  }
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const jumpedRef = useRef(false);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [orderingPaused, setOrderingPaused] = useState(false);
  const [submissionEnabled, setSubmissionEnabled] = useState(false);
  const [payBeforeOrderEnabled, setPayBeforeOrderEnabled] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState('tap');
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeItem, setActiveItem] = useState<MenuItem | null>(null);
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [orderNote, setOrderNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [cashPendingConfirmed, setCashPendingConfirmed] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmingReturn, setConfirmingReturn] = useState(false);

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

  const fetchMenu = useCallback(() => {
    getMenu(slug, language)
      .then((res) => {
        setCategories(res.categories);
        setItems(res.items);
        setOrderingPaused(res.orderingPaused);
        setSubmissionEnabled(res.submissionEnabled);
        setPayBeforeOrderEnabled(res.payBeforeOrderEnabled);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, language]);

  useEffect(() => {
    fetchMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, language]);

  useEffect(() => {
    if (!business?.id) return;
    // Real-time, not a poll - catches an item, category, or the whole
    // business getting paused while a customer is still on this page,
    // the instant it happens rather than up to 20 seconds later.
    const unsubscribe = subscribeToMenuChanges(business.id, fetchMenu);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.id]);

  function scrollToCategory(categoryId: string) {
    categoryRefs.current[categoryId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Landing-page "jump straight to Hookah" buttons link here as
  // ?category=<id> - only fires once per load, and only after the menu
  // has actually rendered (the ref needs to exist), otherwise there's
  // nothing to scroll to yet.
  useEffect(() => {
    if (jumpedRef.current || items.length === 0) return;
    const target = searchParams.get('category');
    if (target && categoryRefs.current[target]) {
      jumpedRef.current = true;
      setTimeout(() => scrollToCategory(target), 100);
    }
  }, [items, searchParams]);

  useEffect(() => {
    getBusiness(slug).then((b) => {
      setPaymentProvider(b.paymentProvider || 'tap');
      setBusiness(b);
    }).catch(() => {});
  }, [slug]);

  // Landing back from a redirect provider's page (Telr/N-Genius/Ziina) -
  // the backend re-verifies the real outcome with the provider itself,
  // never trusts that arriving on this URL means anything on its own.
  useEffect(() => {
    const paymentId = searchParams.get('orderPaymentId');
    if (!paymentId) return;
    // Resolved one way or another now - no longer an abandoned attempt.
    sessionStorage.removeItem(`tavzio_pending_order_payment_${slug}`);
    setPendingCancel(null);
    setConfirmingReturn(true);
    confirmOrderPayment(slug, paymentId)
      .then(() => {
        setConfirmed(true);
        cart.clear();
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Payment was not completed - no order was sent to the kitchen'))
      .finally(() => setConfirmingReturn(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Set the moment a redirect payment starts (see handlePayByCard below),
  // cleared once resolved. Still here on a fresh load means the customer
  // left mid-payment without completing anything - same recovery as the
  // Pay Bill flow, so an abandoned order doesn't sit stuck.
  const [pendingCancel, setPendingCancel] = useState<{ orderId: string; tapEventId: number } | null>(() => {
    const stored = sessionStorage.getItem(`tavzio_pending_order_payment_${slug}`);
    return stored ? JSON.parse(stored) : null;
  });
  const [cancellingPending, setCancellingPending] = useState(false);

  async function handleCancelPendingOrder() {
    if (!pendingCancel) return;
    setCancellingPending(true);
    try {
      await cancelOrderPayment(slug, pendingCancel.orderId, pendingCancel.tapEventId);
    } catch {
      // Already resolved server-side - nothing left to cancel either way.
    } finally {
      sessionStorage.removeItem(`tavzio_pending_order_payment_${slug}`);
      setPendingCancel(null);
      setCancellingPending(false);
    }
  }

  async function handleSendOrderPressed() {
    if (!tapEventId || cart.lines.length === 0) return;
    if (payBeforeOrderEnabled) {
      setShowCheckout(true);
      return;
    }
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

  async function handlePayByCard() {
    if (!tapEventId) return;
    setSubmitting(true);
    setError('');
    try {
      if (paymentProvider === 'telr' || paymentProvider === 'ngenius' || paymentProvider === 'ziina') {
        const session = await createOrderPaySession(slug, tapEventId, orderNote, cart.lines);
        sessionStorage.setItem(`tavzio_pending_order_payment_${slug}`, JSON.stringify({ orderId: session.orderId, tapEventId }));
        window.location.href = session.redirectUrl;
        return;
      }
      // Tap in-page flow needs a real card token from Tap's own JS SDK
      // (Apple/Google Pay tokenization) - same known gap already flagged
      // on the Pay Bill page for this exact provider; not fabricated here.
      const tapToken = 'TODO_REPLACE_WITH_REAL_TAP_SDK_TOKEN';
      await payOrder(slug, tapEventId, orderNote, cart.lines, tapToken);
      setConfirmed(true);
      cart.clear();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed - no order was sent to the kitchen');
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePayInCash() {
    if (!tapEventId) return;
    setSubmitting(true);
    setError('');
    try {
      await payOrderWithCash(slug, tapEventId, orderNote, cart.lines);
      setCashPendingConfirmed(true);
      cart.clear();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start your order');
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

  if (confirmingReturn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink">
        <div className="h-10 w-10 animate-pulse rounded-full border-2 border-brass/40" />
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
        <button type="button"
          onClick={() => navigate(`/${slug}`)}
          className="mt-4 rounded-lg border border-brass/40 px-4 py-2 text-sm text-brass hover:bg-brass/10"
        >
          {t('backTo', { slug })}
        </button>
      </div>
    );
  }

  if (cashPendingConfirmed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink px-6 text-center" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-brass">
          <span className="font-display text-2xl text-brass">AED</span>
        </div>
        <p className="font-display text-xl text-ivory">Please pay at the cashier</p>
        <p className="text-sm text-ivory-dim">Your order will be sent to the kitchen as soon as staff confirm your cash payment.</p>
        <button type="button"
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

  const searchResults = searchQuery.trim()
    ? items.filter((i) => {
        const q = searchQuery.trim().toLowerCase();
        return (
          translated(i.name, i.name_i18n, language).toLowerCase().includes(q) ||
          i.name.toLowerCase().includes(q) ||
          translated(i.description, i.description_i18n, language).toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q)
        );
      })
    : [];

  function renderItem(item: MenuItem) {
    const orderable = submissionEnabled && isOrderable(item);
    const priceTag = (
      <span className="shrink-0 ps-3 text-sm text-brass">
        {item.original_price != null && <span className="me-1.5 text-ivory-dim line-through">{item.original_price.toFixed(2)}</span>}
        {item.price.toFixed(2)}
      </span>
    );

    if (layoutMode === 'grid') {
      // Big-square variant, customer's own choice - larger image on top,
      // name/price below, two per row. Description dropped here
      // deliberately - at half-width on a phone there isn't room for it
      // without the card feeling cramped; tapping still opens the full
      // item detail with the description intact.
      return (
        <button type="button"
          key={`${item.id}-${item.category_id}`}
          onClick={() => submissionEnabled && orderable && setActiveItem(item)}
          disabled={submissionEnabled && !orderable}
          className={`flex flex-col overflow-hidden rounded-xl border text-start ${
            !submissionEnabled || orderable ? 'border-ink-line bg-ink-soft' : 'cursor-not-allowed border-ink-line bg-ink-soft/40 opacity-60'
          }`}
        >
          <div className="aspect-square w-full bg-ink">
            {item.image_url && <img src={item.image_url} alt="" className="h-full w-full object-cover" />}
          </div>
          <div className="flex items-start justify-between gap-2 p-3">
            <div className="min-w-0">
              <p className="truncate font-display text-[15px] font-medium text-ivory">{translated(item.name, item.name_i18n, language)}</p>
              {submissionEnabled && !orderable && <p className="mt-0.5 text-xs font-medium text-danger">{t('unavailable')}</p>}
            </div>
            {priceTag}
          </div>
        </button>
      );
    }

    if (!submissionEnabled) {
      // Read-only: name, description, photo, and price still show - just
      // no way to add it to an order, since there's no ordering to add it to.
      return (
        <div
          key={`${item.id}-${item.category_id}`}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-ink-line bg-ink-soft px-5 py-5 text-start"
        >
          {item.image_url && <img src={item.image_url} alt="" className="h-24 w-24 shrink-0 rounded-lg object-cover" />}
          <div className="flex-1">
            <p className="font-display text-[15px] font-medium text-ivory">{translated(item.name, item.name_i18n, language)}</p>
            {item.description && <p className="mt-0.5 text-xs text-ivory-dim">{translated(item.description, item.description_i18n, language)}</p>}
          </div>
          {priceTag}
        </div>
      );
    }
    return (
      <button type="button"
        key={`${item.id}-${item.category_id}`}
        onClick={() => orderable && setActiveItem(item)}
        disabled={!orderable}
        className={`flex w-full items-center gap-4 justify-between rounded-xl border px-5 py-5 text-start ${
          orderable ? 'border-ink-line bg-ink-soft' : 'cursor-not-allowed border-ink-line bg-ink-soft/40 opacity-60'
        }`}
      >
        {item.image_url && <img src={item.image_url} alt="" className="h-24 w-24 shrink-0 rounded-lg object-cover" />}
        <div className="flex-1">
          <p className="font-display text-[15px] font-medium text-ivory">{translated(item.name, item.name_i18n, language)}</p>
          {item.description && <p className="mt-0.5 text-xs text-ivory-dim">{translated(item.description, item.description_i18n, language)}</p>}
          {orderable && (item.addons && item.addons.length > 0) && <p className="mt-0.5 text-xs text-brass/70">{t('addonsAvailable')}</p>}
          {!orderable && <p className="mt-0.5 text-xs font-medium text-danger">{t('unavailable')}</p>}
        </div>
        {priceTag}
      </button>
    );
  }

  const editingLine = editingLineIndex != null ? cart.lines[editingLineIndex] : null;
  const editingItem = editingLine ? items.find((i) => i.id === editingLine.menuItemId) || null : null;

  return (
    <div
      className={`min-h-screen bg-ink ${submissionEnabled ? 'pb-32' : 'pb-16'}`}
      dir={isRtl ? 'rtl' : 'ltr'}
      style={buildBusinessThemeVars(business?.theme?.customerBackground, business?.theme?.customerButton)}
    >
      <div className="mx-auto max-w-md px-6 pt-14">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl text-ivory">{t('menu')}</h1>
          <div className="flex items-center gap-2">
            <button type="button"
              onClick={toggleLayout}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-line text-ivory-dim hover:text-ivory"
              title={layoutMode === 'rows' ? 'Switch to grid view' : 'Switch to list view'}
              aria-label={layoutMode === 'rows' ? 'Switch to grid view' : 'Switch to list view'}
            >
              {layoutMode === 'rows' ? (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1" y="1" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="10" y="1" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="1" y="10" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="10" y="10" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1" y="2" width="16" height="3" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="1" y="8" width="16" height="3" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="1" y="14" width="16" height="3" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg>
              )}
            </button>
            <LanguageSwitcher />
          </div>
        </div>

        {pendingCancel && !searchParams.get('orderPaymentId') && (
          <div className="mt-4 rounded-xl border border-warning/40 bg-ink-soft px-4 py-3">
            <p className="text-sm text-ivory">You started a payment that wasn't finished.</p>
            <p className="mt-0.5 text-xs text-ivory-dim">That order is on hold - cancel it to start fresh, or continue if you're still paying.</p>
            <button
              type="button"
              onClick={handleCancelPendingOrder}
              disabled={cancellingPending}
              className="mt-2 rounded-lg border border-warning/60 px-3 py-1.5 text-xs font-medium text-warning hover:bg-warning/10 disabled:opacity-50"
            >
              {cancellingPending ? 'Cancelling...' : 'Cancel that order'}
            </button>
          </div>
        )}

        {/* Real search - matches against both the base name/description
            and whatever language is currently active, so a search stays
            useful regardless of which language a guest has the menu
            set to. While searching, category browsing gives way to a
            flat results list - a match could span several categories,
            and grouping it back into those would only make the results
            harder to scan, not easier. */}
        <div className="relative mt-4">
          <Search size={16} strokeWidth={2} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ivory-dim" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('menuSearchPlaceholder')}
            className="w-full rounded-lg border border-ink-line bg-ink-soft py-2.5 ps-9 pe-3 text-sm text-ivory placeholder:text-ivory-dim/60"
          />
        </div>

        {searchQuery.trim() ? (
          <div className="mt-4 space-y-3">
            {searchResults.map(renderItem)}
            {searchResults.length === 0 && <p className="py-6 text-center text-sm text-ivory-dim">{t('menuNoSearchResults')}</p>}
          </div>
        ) : (
          <>
        {categories.length > 1 && (
          <div className="mt-4 -mx-6 flex gap-2 overflow-x-auto px-6 pb-1" style={{ scrollbarWidth: 'none' }}>
            {categories.map((cat) => (
              items.some((i) => i.category_id === cat.id) && (
                <button type="button"
                  key={cat.id}
                  onClick={() => scrollToCategory(cat.id)}
                  className="shrink-0 rounded-full border border-ink-line px-3 py-1.5 text-xs text-ivory-dim hover:border-brass/40 hover:text-brass"
                >
                  {translated(cat.name, cat.name_i18n, language)}
                </button>
              )
            ))}
          </div>
        )}

        {categories.map((cat) => {
          const catItems = items.filter((i) => i.category_id === cat.id);
          if (catItems.length === 0) return null;
          return (
            <div key={cat.id} ref={(el) => { categoryRefs.current[cat.id] = el; }} className="mt-6 scroll-mt-16">
              <h2 className="font-mono text-[11px] uppercase tracking-wider text-brass">{translated(cat.name, cat.name_i18n, language)}</h2>
              <div className={layoutMode === 'grid' ? 'mt-2 grid grid-cols-2 gap-3' : 'mt-2 space-y-3'}>
                {catItems.map(renderItem)}
              </div>
            </div>
          );
        })}

        {items.some((i) => !i.category_id) && (
          <div className={layoutMode === 'grid' ? 'mt-6 grid grid-cols-2 gap-3' : 'mt-6 space-y-3'}>
            {items.filter((i) => !i.category_id).map(renderItem)}
          </div>
        )}
        </>
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
                  <button type="button" onClick={() => setEditingLineIndex(i)} className="flex-1 text-start hover:text-ivory">
                    <span>{l.quantity}× {l.name}{l.note ? ` (${l.note})` : ''}</span>
                    {l.selectedAddons.length > 0 && (
                      <span className="block text-xs text-brass/70">+ {l.selectedAddons.map((a) => a.name).join(', ')}</span>
                    )}
                  </button>
                  <button type="button" onClick={() => cart.removeLine(i)} className="ms-2 shrink-0 text-danger">✕</button>
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
            <button type="button"
              onClick={handleSendOrderPressed}
              disabled={submitting}
              className="w-full rounded-lg bg-brass px-4 py-3 font-medium text-ink disabled:opacity-50"
            >
              {submitting ? t('sending') : `${t('sendOrder')} — ${cart.total.toFixed(2)}`}
            </button>
          </div>
        </div>
      )}

      {showCheckout && (
        <div className="fixed inset-0 z-modal flex items-end bg-black/60" onClick={() => !submitting && setShowCheckout(false)}>
          <div className="w-full rounded-t-2xl border-t border-ink-line bg-ink-soft p-5" onClick={(e) => e.stopPropagation()}>
            <p className="font-display text-lg text-ivory">Pay to send your order</p>
            <p className="mt-1 text-sm text-ivory-dim">This business requires payment before your order reaches the kitchen.</p>
            <p className="mt-3 text-sm text-brass">Total — {cart.total.toFixed(2)}</p>
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
            <button type="button"
              onClick={handlePayByCard}
              disabled={submitting}
              className="mt-4 w-full rounded-lg bg-brass px-4 py-3 font-medium text-ink disabled:opacity-50"
            >
              {submitting ? t('sending') : 'Pay by card'}
            </button>
            <button type="button"
              onClick={handlePayInCash}
              disabled={submitting}
              className="mt-2 w-full rounded-lg border border-brass/40 px-4 py-3 font-medium text-brass hover:bg-brass/10 disabled:opacity-50"
            >
              Pay in cash
            </button>
            <button type="button"
              onClick={() => setShowCheckout(false)}
              disabled={submitting}
              className="mt-2 w-full rounded-lg px-4 py-2 text-sm text-ivory-dim"
            >
              Cancel
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
  const { t, language } = useLanguage();
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
    <div className="fixed inset-0 z-modal flex items-end bg-black/60" onClick={onClose}>
      <div
        className="w-full rounded-t-2xl border-t border-ink-line bg-ink-soft p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {item.image_url && <img src={item.image_url} alt="" className="mb-3 h-40 w-full rounded-xl bg-ink-soft object-contain" />}
        <p className="font-display text-lg text-ivory">{translated(item.name, item.name_i18n, language)}</p>
        {item.description && <p className="mt-1 text-sm text-ivory-dim">{translated(item.description, item.description_i18n, language)}</p>}
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
          <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="h-9 w-9 rounded-full border border-ink-line text-ivory">−</button>
          <span className="w-6 text-center text-ivory">{quantity}</span>
          <button type="button" onClick={() => setQuantity((q) => q + 1)} className="h-9 w-9 rounded-full border border-ink-line text-ivory">+</button>
        </div>

        <input
          placeholder={t('itemNotePlaceholder')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-4 w-full rounded-lg border border-ink-line bg-ink px-3 py-2 text-sm text-ivory placeholder:text-ivory-dim/60"
        />

        <button type="button"
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
