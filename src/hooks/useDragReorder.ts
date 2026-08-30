import { useCallback, useLayoutEffect, useRef, useState } from 'react';

// PICK UP, THEN PLACE - two discrete, ordinary events, not one long
// continuously-tracked gesture (see git history for why the earlier
// continuous-drag version was abandoned entirely).
//
//   1. Press and hold an item (~500ms) - it visually lifts to show it's
//      picked up.
//   2. Tap anywhere else - the held item moves to that spot. Done,
//      committed immediately.
//   3. Tap the held item again - cancels the pick-up, nothing moves.
//
// Real hardening pass: every part of step 2's "tap" is now handled
// directly through onPointerUp, not the browser's separate, synthesized
// `click` event. Relying on `click` meant relying on each browser's own
// rules for whether/when a click fires after a pointer sequence -
// rules that are not identical across engines, particularly around
// long-press-style interactions. Detecting a tap explicitly in
// onPointerUp (short elapsed time, minimal movement, only when nothing
// is currently held) removes that entire category of cross-browser
// risk - there's no unspecified translation layer left to disagree
// about.
//
// T only needs a stable id via getId - the hook never looks at
// anything else on the item, so the same hook drives menu items, nav
// entries, and categories without any per-surface variant.
const SETTLE_MS = 260;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const TAP_MAX_MOVE_PX = 8;
// Real, explicit request: much faster pickup. The disambiguation this
// hold protects against (a scroll or swipe starting on an item
// shouldn't be misread as "pick this up") is still real and still
// needed, so this stays a hold rather than a plain tap-to-pick-up -
// but 500ms was a generic default, not a value anything here actually
// required. 150ms, combined with the existing move-cancels-it check
// below, is still long enough to tell a deliberate press from a quick
// scroll flick, while reading as instant to a person actually pressing
// and holding.
const PICKUP_HOLD_MS = 150;

export function useDragReorder<T>({
  items,
  getId,
  onCommit,
}: {
  items: T[];
  getId: (item: T) => string;
  // Called immediately once a placement happens, with the final
  // reordered array - a placement IS the commit, there's no separate
  // "live" intermediate order to manage.
  onCommit: (newOrder: T[]) => void;
}) {
  const [heldId, setHeldId] = useState<string | null>(null);
  const heldIdRef = useRef<string | null>(null);
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const longPressTimer = useRef<number | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());
  // Set the instant a long press fires, consumed by the pointerup that
  // immediately follows releasing it - without this, that release
  // would register as an ordinary tap on the item that was just picked
  // up (e.g. adding it to a cart) the moment the person let go.
  const justPickedUpId = useRef<string | null>(null);

  const registerItemRef = useCallback((id: string, el: HTMLElement | null) => {
    if (el) itemRefs.current.set(id, el);
    else itemRefs.current.delete(id);
  }, []);

  function clearLongPress() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function captureRectsBeforeReorder() {
    const map = new Map<string, DOMRect>();
    for (const [id, el] of itemRefs.current) map.set(id, el.getBoundingClientRect());
    prevRectsRef.current = map;
  }

  function commitPlacement(targetId: string) {
    const heldItemId = heldIdRef.current;
    if (!heldItemId || heldItemId === targetId) return;
    const from = items.findIndex((it) => getId(it) === heldItemId);
    const to = items.findIndex((it) => getId(it) === targetId);
    if (from === -1 || to === -1) return;
    captureRectsBeforeReorder();
    const order = [...items];
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    heldIdRef.current = null;
    setHeldId(null);
    onCommit(order);
  }

  function handlePointerDown(id: string, e: React.PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Something is already held and this press landed on a DIFFERENT
    // item - the placement itself happens on release (onPointerUp), not
    // here; no long-press timer is needed for a placement tap.
    if (heldIdRef.current && heldIdRef.current !== id) return;
    pressOrigin.current = { x: e.clientX, y: e.clientY };
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      justPickedUpId.current = id;
      heldIdRef.current = id;
      setHeldId(id);
      longPressTimer.current = null;
    }, PICKUP_HOLD_MS);
  }

  function handlePointerMove(e: React.PointerEvent) {
    // Only ever cancels a PENDING long press (before it's fired) if
    // this was actually a scroll/swipe rather than a genuine hold -
    // same reasoning iOS uses for not entering pick-up mode on a
    // scroll gesture.
    if (longPressTimer.current !== null && pressOrigin.current) {
      const dx = e.clientX - pressOrigin.current.x;
      const dy = e.clientY - pressOrigin.current.y;
      if (Math.hypot(dx, dy) > TAP_MAX_MOVE_PX) clearLongPress();
    }
  }

  // Everything happens here, on release - the single source of truth
  // for "what did this press+release actually mean", entirely within
  // pointer events, never depending on a separately-synthesized click.
  function handlePointerUp(id: string, e: React.PointerEvent, onTap?: () => void) {
    const wasStillPending = longPressTimer.current !== null;
    const origin = pressOrigin.current;
    clearLongPress();
    pressOrigin.current = null;

    if (justPickedUpId.current === id) {
      // Tail end of the long press that just picked this item up - not
      // a real tap, already handled.
      justPickedUpId.current = null;
      return;
    }

    if (heldIdRef.current) {
      if (heldIdRef.current === id) {
        // A genuine separate tap on the already-held item - cancel.
        heldIdRef.current = null;
        setHeldId(null);
        return;
      }
      // Placement: releasing on a different item while one is held.
      commitPlacement(id);
      return;
    }

    // Nothing held. A real ordinary tap only if the long-press timer
    // was still pending when released (never fired - i.e. this was a
    // short press) and the pointer didn't move far - i.e. this was
    // neither a completed hold nor a scroll/swipe.
    if (wasStillPending && origin) {
      const dx = e.clientX - origin.x;
      const dy = e.clientY - origin.y;
      if (Math.hypot(dx, dy) <= TAP_MAX_MOVE_PX) onTap?.();
    }
  }

  // Real FLIP animation, triggered simply by the committed order
  // actually changing - captured positions (prevRectsRef) come from
  // right before the commit in commitPlacement above, so every item
  // eases from where it visually was into its real new slot instead of
  // jumping there.
  useLayoutEffect(() => {
    for (const [id, el] of itemRefs.current) {
      const prev = prevRectsRef.current.get(id);
      if (!prev) continue;
      const next = el.getBoundingClientRect();
      const dx = prev.left - next.left;
      const dy = prev.top - next.top;
      if (!dx && !dy) continue;
      el.style.transition = 'none';
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      el.getBoundingClientRect(); // force a reflow so the transition below actually animates
      requestAnimationFrame(() => {
        el.style.transition = `transform ${SETTLE_MS}ms ${EASE}`;
        el.style.transform = '';
      });
    }
    prevRectsRef.current = new Map();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // onTap is the caller's own default action for a genuine, ordinary
  // tap when nothing is held (e.g. adding an item to a cart) - passed
  // straight through to handlePointerUp so the ENTIRE decision (was
  // this a tap, a placement, a cancel, or the tail of a pick-up) lives
  // in one place, driven only by pointer events.
  function itemHandlers(id: string, onTap?: () => void) {
    return {
      onPointerDown: (e: React.PointerEvent) => handlePointerDown(id, e),
      onPointerMove: handlePointerMove,
      onPointerUp: (e: React.PointerEvent) => handlePointerUp(id, e, onTap),
      onPointerCancel: () => { clearLongPress(); pressOrigin.current = null; },
    };
  }

  return {
    heldId,
    // Always just the caller's own items now - there's no separate
    // in-flight "live" order distinct from the committed one, since a
    // placement commits immediately. Kept as `displayItems` so callers
    // don't need restructuring beyond swapping the gesture itself.
    displayItems: items,
    registerItemRef,
    itemHandlers,
  };
}
