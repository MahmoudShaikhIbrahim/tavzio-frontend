import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

// Real replacement for every up/down-button reorder UI in this app,
// requested explicitly: press and hold an item (~500ms, same threshold
// iOS uses) until it and its neighbors start jiggling - that's the
// signal the whole list is now grabbable - then drag it anywhere in the
// list/grid; other items shift live to make room as the pointer moves
// over them, exactly like rearranging iPhone home screen apps. Lifting
// the pointer commits the new order.
//
// Real architecture change from earlier versions, after "still doesn't
// work" feedback specifically on POS's small grid tiles: this no longer
// depends on setPointerCapture succeeding at all. Capture-based
// tracking only keeps receiving pointer events if the browser correctly
// redirects them to the original element once the pointer leaves its
// bounds - support and reliability for that isn't fully uniform across
// browsers, and POS's tiles are small and packed close together, so the
// pointer leaves the original tile's bounds almost immediately on any
// real drag. The actual tracking now happens via listeners attached
// directly to `document` for the duration of a press - that always
// keeps receiving events regardless of what's visually under the
// cursor, which is the standard, more robust pattern real drag-and-drop
// implementations use specifically to sidestep this class of bug.
// setPointerCapture is still requested too (harmless, helps touch-
// scroll suppression in browsers where it works), it's just no longer
// the thing tracking depends on for correctness.
//
// Two more real bugs fixed here, both about accuracy during the drag
// itself:
//
// 1) Hit-testing is measured ONCE, at the instant the drag begins
// (dragStartCenters), and never re-measured against the live DOM again.
// The jiggle wobble on every OTHER item constantly, if only slightly,
// shifts each one's live getBoundingClientRect() every animation frame -
// hit-testing against those live rects was comparing against a moving
// target and drifted, worse in one direction than the other over a
// multi-position drag. Every move event now derives the new order fresh
// from the frozen original order + start positions, so there's nothing
// to drift and nothing for the wobble to interfere with.
//
// 2) The dragged item's on-screen position never goes through React
// state/re-render. It's a direct DOM mutation (this hook holds real
// refs to every item) on the same synchronous event, completely
// decoupled from React's render cycle - a React state update
// (setLiveOrder) only fires when the pointer actually crosses into a
// new slot, not on every pixel of movement. All internal decision logic
// reads from refs, never from state variables closed over by a specific
// render, so it can't go stale regardless of React's async scheduling.
//
// Real polish pass for "premium" feel: other items now genuinely slide
// into their new slot (a real FLIP animation - capture positions before
// the reorder, let the new layout happen instantly and invisibly, then
// animate from the old position to the new one) instead of snapping
// there instantly, and the dropped item eases into its final position
// instead of jumping there. Same easing curve (ease-brass) already used
// for every other considered motion in this app, not a generic one.
//
// T only needs a stable id via getId - the hook never looks at
// anything else on the item, so the same hook drives menu items, nav
// entries, and categories without any per-surface variant.
const SETTLE_MS = 220;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

export function useDragReorder<T>({
  items,
  getId,
  onCommit,
}: {
  items: T[];
  getId: (item: T) => string;
  // Called once, on drop, with the final reordered array. Deliberately
  // NOT called on every intermediate swap while dragging - the caller
  // (POS, nav modal, categories) owns optimistic local state for the
  // live reorder, this hook only owns the gesture and hands back the
  // one final result to persist.
  onCommit: (newOrder: T[]) => void;
}) {
  // State exists ONLY for what a render actually needs to show (jiggle
  // class, which item is currently lifted, which order to lay out). It
  // is never read inside an event-handler's decision logic - refs are,
  // exclusively, precisely so a stale closure from an older render can
  // never cause a wrong branch.
  const [arranging, setArranging] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [liveOrder, setLiveOrder] = useState<T[]>(items);

  const arrangingRef = useRef(false);
  const draggingIdRef = useRef<string | null>(null);
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const longPressTimer = useRef<number | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const activePointerId = useRef<number | null>(null);
  const orderRef = useRef<T[]>(items);
  const dragStartOrder = useRef<T[]>(items);
  const dragStartCenters = useRef<{ id: string; x: number; y: number }[]>([]);
  const dragStartPointer = useRef({ x: 0, y: 0 });
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());
  // A long-press-then-release-without-moving is still a valid pointerdown
  // + pointerup sequence in the same spot, which browsers then follow
  // with a synthetic click - exactly the moment arranging just turned
  // back off, so that click would otherwise silently re-trigger whatever
  // the item's normal tap action is (e.g. adding it to a cart) right as
  // the person let go.
  const suppressClickId = useRef<string | null>(null);

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

  function paintDragOffset(id: string) {
    const el = itemRefs.current.get(id);
    if (el) el.style.transform = `translate(${dragOffsetRef.current.x}px, ${dragOffsetRef.current.y}px) scale(1.08)`;
  }

  function captureRectsBeforeReorder() {
    const map = new Map<string, DOMRect>();
    for (const [id, el] of itemRefs.current) map.set(id, el.getBoundingClientRect());
    prevRectsRef.current = map;
  }

  function handleMove(clientX: number, clientY: number) {
    const id = draggingIdRef.current;
    if (!arrangingRef.current || !id) {
      // Not armed yet - a real drag/scroll gesture before the long
      // press fires should cancel it, same as iOS not entering jiggle
      // mode if you were actually just scrolling.
      if (longPressTimer.current !== null && pressOrigin.current) {
        const dx = clientX - pressOrigin.current.x;
        const dy = clientY - pressOrigin.current.y;
        if (Math.hypot(dx, dy) > 8) clearLongPress();
      }
      return;
    }

    dragOffsetRef.current = {
      x: clientX - dragStartPointer.current.x,
      y: clientY - dragStartPointer.current.y,
    };
    paintDragOffset(id);

    const myStart = dragStartCenters.current.find((c) => c.id === id);
    if (!myStart) return;
    const currentX = myStart.x + dragOffsetRef.current.x;
    const currentY = myStart.y + dragOffsetRef.current.y;

    // Nearest slot to the dragged item's CURRENT (start + delta)
    // position, measured only against every item's FROZEN start
    // center - never a live one, so nothing mid-drag can throw this off.
    let nearestId = id;
    let nearestDist = Infinity;
    for (const c of dragStartCenters.current) {
      const d = Math.hypot(currentX - c.x, currentY - c.y);
      if (d < nearestDist) { nearestDist = d; nearestId = c.id; }
    }

    // A React state update only happens here, when the target slot has
    // actually changed - not on every pixel of movement.
    const currentlyAt = orderRef.current.findIndex((it) => getId(it) === id);
    const targetAt = dragStartOrder.current.findIndex((it) => getId(it) === nearestId);
    if (currentlyAt === targetAt) return;

    // Always rebuilt from the ORIGINAL start order, never from whatever
    // the previous move event left behind - so there's no incremental
    // drift to accumulate across a fast multi-position drag in either
    // direction.
    const order = [...dragStartOrder.current];
    const from = order.findIndex((it) => getId(it) === id);
    const to = order.findIndex((it) => getId(it) === nearestId);
    if (from !== -1 && to !== -1 && from !== to) {
      const [moved] = order.splice(from, 1);
      order.splice(to, 0, moved);
    }
    orderRef.current = order;
    captureRectsBeforeReorder();
    setLiveOrder(order);
  }

  function handleEnd() {
    document.removeEventListener('pointermove', onDocPointerMove);
    document.removeEventListener('pointerup', onDocPointerUp);
    document.removeEventListener('pointercancel', onDocPointerUp);
    clearLongPress();
    const id = draggingIdRef.current;
    if (arrangingRef.current && id) {
      arrangingRef.current = false;
      draggingIdRef.current = null;
      setArranging(false);
      setDraggingId(null);
      suppressClickId.current = id;
      // Real settle instead of an instant jump - eases from wherever it
      // was dropped back to its real slot. Cleared afterward so the
      // NEXT drag's live tracking (which must be instant, no easing)
      // doesn't inherit this transition.
      const el = itemRefs.current.get(id);
      if (el) {
        el.style.transition = `transform ${SETTLE_MS}ms ${EASE}`;
        el.style.transform = '';
        window.setTimeout(() => { if (el) el.style.transition = ''; }, SETTLE_MS + 20);
      }
      onCommit(orderRef.current);
    }
    activePointerId.current = null;
    pressOrigin.current = null;
  }

  function onDocPointerMove(e: PointerEvent) {
    if (activePointerId.current !== null && e.pointerId !== activePointerId.current) return;
    handleMove(e.clientX, e.clientY);
  }
  function onDocPointerUp(e: PointerEvent) {
    if (activePointerId.current !== null && e.pointerId !== activePointerId.current) return;
    handleEnd();
  }

  function handlePointerDown(id: string, e: React.PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pressOrigin.current = { x: e.clientX, y: e.clientY };
    activePointerId.current = e.pointerId;
    const target = e.currentTarget as HTMLElement;
    const pointerId = e.pointerId;
    clearLongPress();
    // Attached immediately, not only once a drag actually starts - the
    // pre-drag branch inside handleMove needs to see movement too, to
    // cancel the long press on a real scroll/drag gesture (same as iOS
    // not entering jiggle mode if you were just scrolling).
    document.addEventListener('pointermove', onDocPointerMove);
    document.addEventListener('pointerup', onDocPointerUp);
    document.addEventListener('pointercancel', onDocPointerUp);
    try { target.setPointerCapture(pointerId); } catch { /* best-effort only - see file header */ }
    longPressTimer.current = window.setTimeout(() => {
      dragStartOrder.current = items;
      orderRef.current = items;
      dragStartCenters.current = items.map((it) => {
        const el = itemRefs.current.get(getId(it));
        const r = el?.getBoundingClientRect();
        return { id: getId(it), x: (r?.left ?? 0) + (r?.width ?? 0) / 2, y: (r?.top ?? 0) + (r?.height ?? 0) / 2 };
      });
      dragStartPointer.current = { x: pressOrigin.current!.x, y: pressOrigin.current!.y };
      dragOffsetRef.current = { x: 0, y: 0 };
      arrangingRef.current = true;
      draggingIdRef.current = id;
      setLiveOrder(items);
      setArranging(true);
      setDraggingId(id);
    }, 500);
  }

  // The actual FLIP animation: right after `liveOrder` changes and
  // React has laid out the new order (but before the browser paints
  // it), every non-dragged item gets an instant transform back to
  // where it visually WAS a moment ago, then a rAF later transitions to
  // its real new spot - reads as a smooth slide even though the
  // underlying DOM order genuinely jumped straight there.
  useLayoutEffect(() => {
    for (const [id, el] of itemRefs.current) {
      if (id === draggingIdRef.current) continue;
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
  }, [liveOrder]);

  // Listeners must always be torn down if the component unmounts mid-drag.
  useEffect(() => () => {
    document.removeEventListener('pointermove', onDocPointerMove);
    document.removeEventListener('pointerup', onDocPointerUp);
    document.removeEventListener('pointercancel', onDocPointerUp);
    clearLongPress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function consumeSuppressedClick(id: string): boolean {
    if (suppressClickId.current === id) {
      suppressClickId.current = null;
      return true;
    }
    return false;
  }

  function itemHandlers(id: string) {
    const isDragging = draggingId === id;
    return {
      onPointerDown: (e: React.PointerEvent) => handlePointerDown(id, e),
      // Real per-item onPointerMove/onPointerUp intentionally removed -
      // document-level listeners (added on pointerdown) do this now,
      // see the file header for why.
      style: {
        touchAction: arranging && isDragging ? 'none' : undefined,
      } as React.CSSProperties,
    };
  }

  return {
    arranging,
    draggingId,
    // The list to actually render: live-reordered while dragging, the
    // caller's own items otherwise (so it never lags behind real data -
    // e.g. a new item arriving mid-render - when nothing is being dragged).
    displayItems: arranging ? liveOrder : items,
    registerItemRef,
    itemHandlers,
    consumeSuppressedClick,
  };
}
