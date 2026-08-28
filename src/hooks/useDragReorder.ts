import { useCallback, useLayoutEffect, useRef, useState } from 'react';

// Complete restructure, after repeated failures with the previous
// approach (continuously tracking the pointer during a live drag,
// computing nearest-slot on every move, keeping a captured/document-
// level listener alive for the whole gesture). That entire class of
// mechanic has too many independent ways to fail - pointer capture
// isn't uniformly reliable, coordinate math can drift, and a fast or
// imprecise real-world gesture (exactly what a POS touchscreen sees)
// stresses all of it at once.
//
// This is a fundamentally different, much simpler interaction instead:
// PICK UP, THEN PLACE - two discrete, ordinary events, not one long
// continuously-tracked gesture.
//
//   1. Press and hold an item (~500ms) - it visually lifts to show it's
//      picked up.
//   2. Tap anywhere else - the held item moves to that spot. Done,
//      committed immediately.
//   3. Tap the held item again - cancels the pick-up, nothing moves.
//
// There is no pointer-tracking during step 2's tap, no capture, no
// document-level listeners, no per-pixel coordinate comparison. The
// entire mechanic reduces to two ordinary click-equivalent events a
// browser has never had trouble delivering reliably, on any device,
// mouse or touch. What still makes this feel considered rather than
// abrupt is real animation: the picked-up item gets a genuine lift
// (scale/shadow, a real CSS transition), and every item's move into
// its new slot is a real FLIP animation (positions captured just
// before the commit, then eased from there to the real new layout) -
// not an instant jump.
//
// T only needs a stable id via getId - the hook never looks at
// anything else on the item, so the same hook drives menu items, nav
// entries, and categories without any per-surface variant.
const SETTLE_MS = 260;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

export function useDragReorder<T>({
  items,
  getId,
  onCommit,
}: {
  items: T[];
  getId: (item: T) => string;
  // Called immediately once a placement happens, with the final
  // reordered array - there's no separate "live" intermediate order to
  // manage anymore, a placement IS the commit.
  onCommit: (newOrder: T[]) => void;
}) {
  const [heldId, setHeldId] = useState<string | null>(null);
  const heldIdRef = useRef<string | null>(null);
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const longPressTimer = useRef<number | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());
  // Set the instant a long press fires, consumed by the click that
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
    // item - that's a placement tap, not the start of a new pick-up;
    // no long-press timer needed, the click handler below does the
    // placement directly.
    if (heldIdRef.current && heldIdRef.current !== id) return;
    pressOrigin.current = { x: e.clientX, y: e.clientY };
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      justPickedUpId.current = id;
      heldIdRef.current = id;
      setHeldId(id);
      longPressTimer.current = null;
    }, 500);
  }

  function handlePointerMove(e: React.PointerEvent) {
    // Only ever cancels a PENDING long press (before it's fired) if
    // this was actually a scroll/swipe rather than a genuine hold -
    // same reasoning iOS uses for not entering pick-up mode on a
    // scroll gesture. Once something is actually held, there is
    // nothing left to track here at all - that's the entire point of
    // this rewrite.
    if (longPressTimer.current !== null && pressOrigin.current) {
      const dx = e.clientX - pressOrigin.current.x;
      const dy = e.clientY - pressOrigin.current.y;
      if (Math.hypot(dx, dy) > 8) clearLongPress();
    }
  }

  function handlePointerUp() {
    clearLongPress();
    pressOrigin.current = null;
  }

  // Called by the caller's own onClick. Returns true when this click
  // was consumed by the pick-up/placement gesture (the caller should
  // skip its own default tap action - e.g. adding an item to a cart);
  // false means this was a genuine, ordinary tap the caller should
  // handle normally.
  function handleActivate(id: string): boolean {
    if (justPickedUpId.current === id) {
      justPickedUpId.current = null;
      return true;
    }
    if (heldIdRef.current) {
      if (heldIdRef.current === id) {
        heldIdRef.current = null;
        setHeldId(null);
        return true;
      }
      commitPlacement(id);
      return true;
    }
    return false;
  }

  // Real FLIP animation, now triggered simply by the committed order
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

  function itemHandlers(id: string) {
    return {
      onPointerDown: (e: React.PointerEvent) => handlePointerDown(id, e),
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
    };
  }

  return {
    heldId,
    // Always just the caller's own items now - there's no separate
    // in-flight "live" order distinct from the committed one anymore,
    // since a placement commits immediately. Kept as `displayItems` so
    // callers didn't need restructuring beyond swapping the gesture
    // itself.
    displayItems: items,
    registerItemRef,
    itemHandlers,
    handleActivate,
  };
}
