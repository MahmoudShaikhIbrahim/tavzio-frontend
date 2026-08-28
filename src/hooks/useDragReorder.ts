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
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const longPressTimer = useRef<number | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const orderRef = useRef<T[]>(items);
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
      orderRef.current = items;
      setLiveOrder(items);
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

    let nearestId: string | null = null;
    let nearestDist = Infinity;
    for (const [candidateId, el] of itemRefs.current) {
      const r = el.getBoundingClientRect();
      const dist = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
      if (dist < nearestDist) { nearestDist = dist; nearestId = candidateId; }
    }
    if (nearestId && nearestId !== draggingId) {
      const order = [...orderRef.current];
      const from = order.findIndex((it) => getId(it) === draggingId);
      const to = order.findIndex((it) => getId(it) === nearestId);
      if (from !== -1 && to !== -1 && from !== to) {
        const [moved] = order.splice(from, 1);
        order.splice(to, 0, moved);
        orderRef.current = order;
        setLiveOrder(order);
      }
    }
  }

  function endGesture(id: string) {
    clearLongPress();
    if (arranging) {
      setArranging(false);
      setDraggingId(null);
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
    return {
      onPointerDown: (e: React.PointerEvent) => handlePointerDown(id, e),
      onPointerMove: (e: React.PointerEvent) => handlePointerMove(id, e),
      onPointerUp: () => endGesture(id),
      onPointerCancel: () => endGesture(id),
      // A long press is a real press-and-hold, not a click - suppress
      // the browser's own text-selection/callout gesture on touch so it
      // doesn't fight with this one.
      style: { touchAction: arranging && draggingId === id ? 'none' : undefined } as React.CSSProperties,
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
