import { useCallback, useRef, useState } from 'react';

// Real replacement for every up/down-button reorder UI in this app,
// requested explicitly: press and hold an item (~500ms, same threshold
// iOS uses) until it and its neighbors start jiggling - that's the
// signal the whole list is now grabbable - then drag it anywhere in the
// list/grid; other items shift live to make room as the pointer moves
// over them, exactly like rearranging iPhone home screen apps. Lifting
// the pointer commits the new order.
//
// Deliberately built on Pointer Events + setPointerCapture rather than
// the HTML5 Drag and Drop API - HTML5 DnD has no real touch support,
// and every surface this hook drives (a POS touchscreen, a phone) is
// touch-first. Orientation-agnostic on purpose (works for POS's
// wrapping item grid and the nav modal's vertical lists identically):
// it doesn't reason about rows/columns at all, just "which item's
// on-screen center is the pointer closest to right now."
//
// Two real, separate bugs came out of an earlier version, both fixed
// here:
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
// 2) The dragged item's on-screen position no longer goes through React
// state/re-render at all. An earlier version called setDragOffset() on
// every single pointermove - for POS specifically, that's a full
// re-render of a genuinely heavy component (cart, order panel, floor
// tables, hotel folio lookups) tens of times a second, which is exactly
// the kind of load that makes a browser start coalescing/dropping
// pointermove events - "unsettling", "1 out of 100" is what that looks
// like from the outside. The dragged item's visual position is now a
// direct DOM mutation (this hook holds real refs to every item) on the
// SAME synchronous event, completely decoupled from React's render
// cycle; a React state update (setLiveOrder) only fires when the
// pointer actually crosses into a new slot, not on every pixel of
// movement. All internal decision logic (is a drag in progress, which
// item, what the latest order is) reads from refs, not from state
// variables closed over by a specific render, so it can never go stale
// no matter how React's async scheduling times out relative to a fast
// native pointer event.
//
// T only needs a stable id via getId - the hook never looks at
// anything else on the item, so the same hook drives menu items, nav
// entries, and categories without any per-surface variant.
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
  const orderRef = useRef<T[]>(items);
  const dragStartOrder = useRef<T[]>(items);
  const dragStartCenters = useRef<{ id: string; x: number; y: number }[]>([]);
  const dragStartPointer = useRef({ x: 0, y: 0 });
  const dragOffsetRef = useRef({ x: 0, y: 0 });
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

  // Applies the live drag offset straight to the DOM node - called on
  // every pointermove, deliberately bypassing React entirely. This is
  // what makes the dragged tile actually track the pointer/finger
  // smoothly regardless of how expensive the surrounding component is
  // to re-render.
  function paintDragOffset(id: string) {
    const el = itemRefs.current.get(id);
    if (el) el.style.transform = `translate(${dragOffsetRef.current.x}px, ${dragOffsetRef.current.y}px) scale(1.06)`;
  }

  function handlePointerDown(id: string, e: React.PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pressOrigin.current = { x: e.clientX, y: e.clientY };
    const target = e.currentTarget as HTMLElement;
    const pointerId = e.pointerId;
    clearLongPress();
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
      try { target.setPointerCapture(pointerId); } catch { /* already released, e.g. a very fast tap */ }
    }, 500);
  }

  function handlePointerMove(id: string, e: React.PointerEvent) {
    if (!arrangingRef.current || draggingIdRef.current !== id) {
      // Not armed yet - a real drag/scroll gesture before the long
      // press fires should cancel it, same as iOS not entering jiggle
      // mode if you were actually just scrolling.
      if (longPressTimer.current !== null && pressOrigin.current) {
        const dx = e.clientX - pressOrigin.current.x;
        const dy = e.clientY - pressOrigin.current.y;
        if (Math.hypot(dx, dy) > 8) clearLongPress();
      }
      return;
    }

    dragOffsetRef.current = {
      x: e.clientX - dragStartPointer.current.x,
      y: e.clientY - dragStartPointer.current.y,
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
    // actually changed - not on every pixel of movement. This is the
    // real fix for the re-render storm: an earlier version called
    // setState on every single pointermove even when nothing about the
    // ORDER had changed yet.
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
    setLiveOrder(order);
  }

  function endGesture(id: string) {
    clearLongPress();
    if (arrangingRef.current) {
      arrangingRef.current = false;
      draggingIdRef.current = null;
      setArranging(false);
      setDraggingId(null);
      suppressClickId.current = id;
      // The transform was applied directly to the DOM node, entirely
      // outside React's style prop - React has never had this in a
      // style object it rendered, so it has no memory of it and would
      // never clear it on its own. Left unset, the dropped tile would
      // stay visually offset in place forever, permanently detached
      // from its real (now-different) grid/list position.
      const el = itemRefs.current.get(id);
      if (el) el.style.transform = '';
      onCommit(orderRef.current);
    }
    pressOrigin.current = null;
  }

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
      onPointerMove: (e: React.PointerEvent) => handlePointerMove(id, e),
      onPointerUp: () => endGesture(id),
      onPointerCancel: () => endGesture(id),
      // A long press is a real press-and-hold, not a click - suppress
      // the browser's own text-selection/callout gesture on touch so it
      // doesn't fight with this one. No transform here anymore for the
      // dragged item - that's applied directly to the DOM node by
      // paintDragOffset, not through this declarative style, so it
      // can't lag behind a busy render.
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
