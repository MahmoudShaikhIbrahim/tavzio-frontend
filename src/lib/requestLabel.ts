// A request's display label is built server-side as either "Label: note"
// (customButtonController) or "request type - note" (orderController) -
// two different separators for the same idea. Splitting it back apart
// here is display-only (no data/logic change): it lets the title and
// the guest's actual typed message be styled differently, so staff can
// tell "what kind of request this is" from "what they actually typed"
// at a glance instead of reading one flat wall of same-colored text.
export function splitRequestLabel(label: string): { title: string; note: string | null } {
  const colonIdx = label.indexOf(': ');
  const dashIdx = label.indexOf(' - ');
  const idx = colonIdx === -1 ? dashIdx : dashIdx === -1 ? colonIdx : Math.min(colonIdx, dashIdx);
  if (idx === -1) return { title: label, note: null };
  const sepLen = idx === colonIdx ? 2 : 3;
  return { title: label.slice(0, idx), note: label.slice(idx + sepLen) };
}
