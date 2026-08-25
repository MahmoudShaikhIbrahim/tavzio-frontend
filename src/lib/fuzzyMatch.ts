// Real edit-distance based fuzzy matching - not a gimmick, the actual
// standard algorithm ("Levenshtein distance") used by every real spell
// checker and "did you mean" feature. Counts the minimum number of
// single-character edits (insert, delete, substitute) needed to turn
// one string into another - "inventry" -> "inventory" is 1 edit (a
// missing 'o'), so it scores very close even though it's not a
// substring match at all.
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prevRow = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const currRow = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow.push(Math.min(
        currRow[j - 1] + 1,      // insertion
        prevRow[j] + 1,          // deletion
        prevRow[j - 1] + cost    // substitution
      ));
    }
    prevRow = currRow;
  }
  return prevRow[n];
}

// A real "did you mean" threshold - scaled to word length, not a fixed
// number, since a 1-character typo in a short word ("pos" -> "pod")
// should count as close, but the same absolute distance in a long word
// is far less meaningful. Roughly: allow ~30% of the target word's
// length as edits, with a minimum of 1 and a cap of 3 (past that, it's
// not really "the same word with a typo" anymore).
export function isCloseMatch(query: string, target: string): boolean {
  const q = query.trim().toLowerCase();
  const t = target.trim().toLowerCase();
  if (!q || !t) return false;
  if (t.includes(q) || q.includes(t)) return false; // real substring match already exists, not a "did you mean" case
  const threshold = Math.min(3, Math.max(1, Math.round(t.length * 0.3)));
  return levenshtein(q, t) <= threshold;
}

// Finds the single closest real match among a list of candidates, for
// a "did you mean X?" suggestion - returns null if nothing is close
// enough to be worth suggesting.
export function findClosestMatch<T>(query: string, items: T[], getLabel: (item: T) => string): T | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  let best: T | null = null;
  let bestDistance = Infinity;
  for (const item of items) {
    const label = getLabel(item).toLowerCase();
    if (label.includes(q) || q.includes(label)) continue; // already a real substring match, no need to suggest
    const dist = levenshtein(q, label);
    const threshold = Math.min(3, Math.max(1, Math.round(label.length * 0.3)));
    if (dist <= threshold && dist < bestDistance) {
      best = item;
      bestDistance = dist;
    }
  }
  return best;
}
