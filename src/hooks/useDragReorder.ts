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
// The hit-testing is measured ONCE, at the instant the drag begins
// (dragStartCenters), and never re-measured against the live DOM again
// for the rest of that drag. Two real bugs came from the first version
// not doing this: (1) the jiggle wobble on every OTHER item constantly,
// if only slightly, shifts each one's live getBoundingClientRect() every
// animation frame, so hit-testing against live rects was comparing
// against a moving target and produced direction-dependent drift over a
// multi-position drag; (2) since the new order was always derived by
// incrementally splicing the PREVIOUS live order, any one miscalculated
// swap permanently corrupted every swap after it for the rest of that
// drag. Now every move event derives the new order fresh from the
// original start order plus "how far has the pointer moved from where
// this item started", so there's nothing to drift and nothing for the
// wobble to interfere with.
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
  const [arranging, setArranging] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [liveOrder, setLiveOrder] = useState<T[]>(items);
  // How far the pointer has moved from where the drag started - applied
  // as a live transform on the dragged item so it actually visibly
  // follows the finger/cursor, the way a "picked up" tile should. This
  // was the real, biggest miss in the first version: the dragged tile
  // never moved from its original cell at all, it just sat there
  // scaled-up while the array silently reordered underneath it - which
  // is exactly why dragging looked like it "wasn't working."
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const longPressTimer = useRef<number | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const orderRef = useRef<T[]>(items);
  const dragStartOrder = useRef<T[]>(items);
  const dragStartCenters = useRef<{ id: string; x: number; y: number }[]>([]);
  const dragStartPointer = useRef({ x: 0, y: 0 });
  // A long-press-then-release-without-moving is still a valid pointerdown
  // + pointerup sequence in the same spot, which browsers then follow
  // with a synthetic click - exactly the moment arranging just turned
  // back off, so that click would otherwise silently re-trigger whatever
  // the item's normal tap action is (e.g. adding it to a cart) right as
  // the person let go. A ref, not state, because it must be correct at
  // the instant the click fires with zero re-render race.
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
      setLiveOrder(items);
      setDragOffset({ x: 0, y: 0 });
      setArranging(true);
      setDraggingId(id);
      try { target.setPointerCapture(pointerId); } catch { /* already released, e.g. a very fast tap */ }
    }, 500);
  }

  function handlePointerMove(id: string, e: React.PointerEvent) {
    if (!arranging || draggingId !== id) {
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

    const dx = e.clientX - dragStartPointer.current.x;
    const dy = e.clientY - dragStartPointer.current.y;
    setDragOffset({ x: dx, y: dy });

    const myStart = dragStartCenters.current.find((c) => c.id === id);
    if (!myStart) return;
    const currentX = myStart.x + dx;
    const currentY = myStart.y + dy;

    // Nearest slot to the dragged item's CURRENT (start + delta)
    // position, measured only against every item's FROZEN start
    // center - never a live one, so nothing mid-drag can throw this off.
    let nearestId = id;
    let nearestDist = Infinity;
    for (const c of dragStartCenters.current) {
      const d = Math.hypot(currentX - c.x, currentY - c.y);
      if (d < nearestDist) { nearestDist = d; nearestId = c.id; }
    }

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
    if (arranging) {
      setArranging(false);
      setDraggingId(null);
      setDragOffset({ x: 0, y: 0 });
      suppressClickId.current = id;
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
      // doesn't fight with this one. The dragged item also gets a real
      // transform here so it visibly tracks the pointer/finger instead
      // of sitting still while the list silently reorders around it.
      style: {
        touchAction: arranging && isDragging ? 'none' : undefined,
        // Scale baked directly into this same transform string, not left
        // to a Tailwind scale-* class - an inline style's transform
        // always wins over a class's transform (same CSS property,
        // higher specificity), so a separate scale-105 class on the
        // dragged item would have been silently discarded the moment
        // this translate was added instead of combined with it.
        transform: isDragging ? `translate(${dragOffset.x}px, ${dragOffset.y}px) scale(1.06)` : undefined,
        transition: isDragging ? 'none' : undefined,
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
