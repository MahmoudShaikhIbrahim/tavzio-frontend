import type { FloorTable, FloorPlanCell } from '../types';

// Validated via real rendered screenshots before being ported here (not
// guessed) - including catching and fixing a real bug where the merged-
// table shape rendered completely disconnected from its actual tables
// due to a missing transform. See useDragReorder.ts's own history for
// why "verify with real output" is the standing rule for anything
// visual in this app, not just interaction code.
export const CELL = 52;

const COLORS = {
  ink: '#14110F', inkSoft: '#1F1A15', inkLine: '#332B23',
  brass: '#B8925A', brassBright: '#D9B47F', ivory: '#F4EEE3', ivoryDim: '#A79A87',
  danger: '#F87171', success: '#4ADE80', info: '#60A5FA', warning: '#FACC15',
  wall: '#0A0908', window: '#3A5A6E', counter: '#2A211A',
};

export function tableDisplayStatus(table: FloorTable): { color: string; label: string } {
  const hasReady = table.activeOrders.some((o) => o.status === 'ready');
  if (hasReady) return { color: COLORS.warning, label: 'Order ready' };
  if (table.status === 'occupied') return { color: COLORS.brass, label: 'Occupied' };
  if (table.status === 'reserved') return { color: COLORS.info, label: 'Reserved' };
  if (table.status === 'cleaning') return { color: COLORS.ivoryDim, label: 'Cleaning' };
  return { color: COLORS.success, label: 'Available' };
}

// Real size scaling by actual seat count, not a uniform box with a
// number - the actual "recognize it, don't read it" requirement.
export function tableDims(table: FloorTable): { w: number; h: number } {
  if (table.shape === 'long') {
    return { w: Math.max(90, 90 + Math.max(0, table.seatCount - 2) * 24), h: 64 };
  }
  return { w: Math.max(56, 56 + Math.max(0, table.seatCount - 2) * 10), h: Math.max(56, 56 + Math.max(0, table.seatCount - 2) * 10) };
}

// Contiguous straight runs of the same cell type become ONE rect - a
// real continuous wall/window/counter strip, not N boxes touching
// edges.
function computeRuns(cells: FloorPlanCell[], type: FloorPlanCell['cellType']) {
  const matching = cells.filter((c) => c.cellType === type);
  const set = new Set(matching.map((c) => `${c.gridX},${c.gridY}`));
  const consumed = new Set<string>();
  const rects: { x: number; y: number; w: number; h: number }[] = [];

  for (const c of matching) {
    const key = `${c.gridX},${c.gridY}`;
    if (consumed.has(key) || set.has(`${c.gridX - 1},${c.gridY}`)) continue;
    let endX = c.gridX;
    while (set.has(`${endX + 1},${c.gridY}`)) endX++;
    if (endX > c.gridX) {
      for (let x = c.gridX; x <= endX; x++) consumed.add(`${x},${c.gridY}`);
      rects.push({ x: c.gridX, y: c.gridY, w: endX - c.gridX + 1, h: 1 });
    }
  }
  for (const c of matching) {
    if (set.has(`${c.gridX},${c.gridY - 1}`)) continue;
    let endY = c.gridY;
    while (set.has(`${c.gridX},${endY + 1}`)) endY++;
    if (endY > c.gridY) {
      for (let y = c.gridY; y <= endY; y++) consumed.add(`${c.gridX},${y}`);
      rects.push({ x: c.gridX, y: c.gridY, w: 1, h: endY - c.gridY + 1 });
    }
  }
  for (const c of matching) {
    if (!consumed.has(`${c.gridX},${c.gridY}`)) rects.push({ x: c.gridX, y: c.gridY, w: 1, h: 1 });
  }
  return rects;
}

function ChairMarks({ w, h, seats, shape }: { w: number; h: number; seats: number; shape: 'round' | 'long' }) {
  const marks = [];
  const cx = w / 2, cy = h / 2;
  if (shape === 'round') {
    const r = Math.max(w, h) / 2 + 9;
    for (let i = 0; i < seats; i++) {
      const angle = (i / seats) * Math.PI * 2 - Math.PI / 2;
      marks.push(<rect key={i} x={cx + r * Math.cos(angle) - 5} y={cy + r * Math.sin(angle) - 3.5} width={10} height={7} rx={2.5} fill={COLORS.inkLine} />);
    }
  } else {
    const perSide = Math.ceil(seats / 2);
    for (let i = 0; i < seats; i++) {
      const side = i < perSide ? -1 : 1;
      const idxOnSide = i < perSide ? i : i - perSide;
      const countOnSide = i < perSide ? perSide : seats - perSide;
      const spacing = w / (countOnSide + 1);
      const x = spacing * (idxOnSide + 1);
      const y = side === -1 ? -8 : h + 8;
      marks.push(<rect key={i} x={x - 5} y={y - 3.5} width={10} height={7} rx={2.5} fill={COLORS.inkLine} />);
    }
  }
  return <>{marks}</>;
}

function TableShape({ table, onTap, dimOverride }: { table: FloorTable; onTap?: () => void; dimOverride?: { w: number; h: number } }) {
  const { color } = tableDisplayStatus(table);
  const { w, h } = dimOverride || tableDims(table);
  return (
    <g transform={`translate(${(table.gridX || 0) * CELL}, ${(table.gridY || 0) * CELL})`}
      onClick={onTap} style={{ cursor: onTap ? 'pointer' : undefined }}>
      <ChairMarks w={w} h={h} seats={table.seatCount} shape={table.shape} />
      {table.shape === 'round' ? (
        <circle cx={w / 2} cy={h / 2} r={Math.min(w, h) / 2} fill={COLORS.inkSoft} stroke={color} strokeWidth={2.5} />
      ) : (
        <rect x={0} y={0} width={w} height={h} rx={12} fill={COLORS.inkSoft} stroke={color} strokeWidth={2.5} />
      )}
      <circle cx={w - 10} cy={10} r={4.5} fill={color} />
      <text x={w / 2} y={h / 2 - 2} textAnchor="middle" fontFamily="Inter" fontWeight={700}
        fontSize={Math.min(w, h) * 0.24} fill={COLORS.ivory}>{table.label}</text>
      <text x={w / 2} y={h / 2 + 15} textAnchor="middle" fontFamily="Inter" fontWeight={500}
        fontSize={10} fill={COLORS.ivoryDim}>{table.seatCount} seats</text>
    </g>
  );
}

// Merged tables rendered as ONE continuous unified shape - a real
// bounding capsule spanning both tables, only rounded on the outside,
// not two boxes with a thin connector line (the explicit correction
// from the earlier Figma pass).
function MergedTableShape({ a, b, onTap }: { a: FloorTable; b: FloorTable; onTap?: () => void }) {
  const da = tableDims(a), db = tableDims(b);
  const ax = (a.gridX || 0) * CELL, ay = (a.gridY || 0) * CELL;
  const bx = (b.gridX || 0) * CELL, by = (b.gridY || 0) * CELL;
  const minX = Math.min(ax, bx), minY = Math.min(ay, by);
  const maxX = Math.max(ax + da.w, bx + db.w), maxY = Math.max(ay + da.h, by + db.h);
  const { color } = tableDisplayStatus(a);
  return (
    <g transform={`translate(${minX}, ${minY})`} onClick={onTap} style={{ cursor: onTap ? 'pointer' : undefined }}>
      <rect x={0} y={0} width={maxX - minX} height={maxY - minY} rx={16} fill={COLORS.inkSoft} stroke={color} strokeWidth={2.5} />
      <g transform={`translate(${ax - minX}, ${ay - minY})`}><ChairMarks w={da.w} h={da.h} seats={a.seatCount} shape={a.shape} /></g>
      <g transform={`translate(${bx - minX}, ${by - minY})`}><ChairMarks w={db.w} h={db.h} seats={b.seatCount} shape={b.shape} /></g>
      <text x={(maxX - minX) / 2} y={(maxY - minY) / 2 - 2} textAnchor="middle" fontFamily="Inter" fontWeight={700} fontSize={16} fill={COLORS.ivory}>{a.label} + {b.label}</text>
      <text x={(maxX - minX) / 2} y={(maxY - minY) / 2 + 16} textAnchor="middle" fontFamily="Inter" fontWeight={500} fontSize={10} fill={COLORS.ivoryDim}>{a.seatCount + b.seatCount} seats</text>
    </g>
  );
}

export default function FloorPlanCanvas({
  tables, cells, onTapTable, onTapCell, editMode, bounds, fitTo,
}: {
  tables: FloorTable[];
  cells: FloorPlanCell[];
  onTapTable?: (tableId: string) => void;
  onTapCell?: (gridX: number, gridY: number) => void;
  editMode?: boolean;
  // Real, explicit fix: the grid used to always start at (0,0) and
  // only ever grow right/down to fit whatever was already placed -
  // there was no way to add a table or wall further left or higher up
  // than whatever the leftmost/topmost thing already there happened to
  // be. When the editor passes real bounds (which it can expand in any
  // direction), the canvas honors them directly instead of silently
  // re-deriving its own, content-only bounds. View mode (no bounds
  // passed) keeps the old tight auto-fit behavior, which is correct
  // there - the live map has no reason to show empty padding nobody
  // asked for.
  bounds?: { minX: number; minY: number; maxX: number; maxY: number };
  // Real, explicit request: seeing the whole floor plan at once while
  // arranging it. Passing a max pixel size here scales the ENTIRE
  // canvas down to fit within it while keeping every real coordinate
  // untouched - this is SVG's own native behavior (the viewBox stays
  // the full, real size; only the element's own width/height shrink to
  // fit), not a manual transform this component has to compute or
  // maintain itself.
  fitTo?: { width: number; height: number };
}) {
  const placed = tables.filter((t) => t.gridX !== null && t.gridY !== null);
  const wallRects = computeRuns(cells, 'wall');
  const windowRects = computeRuns(cells, 'window');
  const counterRects = computeRuns(cells, 'counter');
  const doorCells = cells.filter((c) => c.cellType === 'door');
  const plantCells = cells.filter((c) => c.cellType === 'plant');

  const mergedIds = new Set<string>();
  const mergedPairs: [FloorTable, FloorTable][] = [];
  for (const t of placed) {
    if (t.mergedWithTableId && !mergedIds.has(t.id)) {
      const other = placed.find((o) => o.id === t.mergedWithTableId);
      if (other) { mergedPairs.push([t, other]); mergedIds.add(t.id); mergedIds.add(other.id); }
    }
  }

  let minX: number, minY: number, maxX: number, maxY: number;
  if (bounds) {
    ({ minX, minY, maxX, maxY } = bounds);
  } else {
    // Real bug fix (confirmed by explicit report: windows visible in
    // the editor never showing up on the live map): this hardcoded the
    // top-left corner to (0,0), which was fine back when nothing could
    // ever be placed left of or above the origin - but the editor can
    // now place tables and cells at genuinely negative coordinates (see
    // "Add space left/above"), and anything placed there fell outside
    // this view's own SVG viewBox entirely, silently clipped out no
    // matter how correctly it was actually saved. The real fix is the
    // same idea as maxX/maxY already had, just extended to the other
    // two corners - derive the minimum from the real content too,
    // rather than assuming content never starts before zero.
    const allX = [0, ...placed.map((t) => t.gridX || 0), ...cells.map((c) => c.gridX)];
    const allY = [0, ...placed.map((t) => t.gridY || 0), ...cells.map((c) => c.gridY)];
    const allMaxX = [0, ...placed.map((t) => (t.gridX || 0) + (tableDims(t).w / CELL) + 1), ...cells.map((c) => c.gridX + 1)];
    const allMaxY = [0, ...placed.map((t) => (t.gridY || 0) + (tableDims(t).h / CELL) + 1), ...cells.map((c) => c.gridY + 1)];
    minX = Math.min(0, Math.floor(Math.min(...allX)));
    minY = Math.min(0, Math.floor(Math.min(...allY)));
    maxX = Math.max(minX + 14, Math.ceil(Math.max(...allMaxX)) + 1);
    maxY = Math.max(minY + 8, Math.ceil(Math.max(...allMaxY)) + 1);
  }
  const cols = maxX - minX;
  const rows = maxY - minY;

  // Zones: group placed tables by their own zone string, label at the
  // top-left-most table in that zone - anchored to real tables rather
  // than a separately-configured position, so a zone label can never
  // drift away from the tables it actually describes.
  const zoneAnchors = new Map<string, { x: number; y: number }>();
  for (const t of placed) {
    if (!t.zone) continue;
    const existing = zoneAnchors.get(t.zone);
    const x = t.gridX || 0, y = t.gridY || 0;
    if (!existing || y < existing.y || (y === existing.y && x < existing.x)) zoneAnchors.set(t.zone, { x, y });
  }

  const editableCellGrid: { x: number; y: number }[] = [];
  if (editMode) {
    for (let y = minY; y < maxY; y++) for (let x = minX; x < maxX; x++) editableCellGrid.push({ x, y });
  }

  const fullWidth = cols * CELL, fullHeight = rows * CELL;
  // Scale down to fit within fitTo, but never scale UP past real size -
  // a small floor plan should stay at its real, precise size for
  // accurate tapping, not get stretched to fill a "fit" box bigger
  // than it actually needs.
  const fitScale = fitTo ? Math.min(1, fitTo.width / fullWidth, fitTo.height / fullHeight) : 1;

  return (
    <svg
      width={fullWidth * fitScale} height={fullHeight * fitScale}
      viewBox={`${minX * CELL} ${minY * CELL} ${fullWidth} ${fullHeight}`}
      style={{ background: COLORS.ink, display: 'block' }}
    >
      {editMode && editableCellGrid.map((c) => (
        <rect key={`grid-${c.x}-${c.y}`} x={c.x * CELL} y={c.y * CELL} width={CELL} height={CELL}
          fill="transparent" stroke={COLORS.inkLine} strokeWidth={0.5}
          onClick={() => onTapCell?.(c.x, c.y)} style={{ cursor: 'pointer' }} />
      ))}
      {wallRects.map((r, i) => <rect key={`w${i}`} x={r.x * CELL} y={r.y * CELL} width={r.w * CELL} height={r.h * CELL} rx={4} fill={COLORS.wall} pointerEvents="none" />)}
      {windowRects.map((r, i) => <rect key={`win${i}`} x={r.x * CELL} y={r.y * CELL} width={r.w * CELL} height={r.h * CELL} rx={4} fill={COLORS.window} pointerEvents="none" />)}
      {counterRects.map((r, i) => <rect key={`c${i}`} x={r.x * CELL} y={r.y * CELL} width={r.w * CELL} height={r.h * CELL} rx={4} fill={COLORS.counter} stroke={COLORS.brass} strokeWidth={1} pointerEvents="none" />)}
      {doorCells.map((d, i) => {
        // Real, explicit request: doors can now face any of the 4
        // sides of their cell, not one fixed shape - a single base
        // shape (hinge + swing arc, "left" orientation) rotated around
        // the cell's own center for the other 3, rather than four
        // separately hand-drawn paths that could drift out of sync
        // with each other.
        const rotation = d.orientation === 'top' ? 90 : d.orientation === 'right' ? 180 : d.orientation === 'bottom' ? -90 : 0;
        return (
          <g key={`d${i}`} transform={`translate(${d.gridX * CELL}, ${d.gridY * CELL}) rotate(${rotation}, ${CELL / 2}, ${CELL / 2})`} pointerEvents="none">
            <rect x={-4} y={2} width={8} height={CELL - 4} rx={2} fill={COLORS.brassBright} />
            <path d={`M -4 2 A ${CELL - 10} ${CELL - 10} 0 0 1 ${CELL - 14} ${CELL - 8}`} fill="none" stroke={COLORS.brass} strokeWidth={1.5} strokeDasharray="4,4" opacity={0.6} />
          </g>
        );
      })}
      {plantCells.map((p, i) => (
        <g key={`p${i}`} transform={`translate(${p.gridX * CELL + CELL / 2}, ${p.gridY * CELL + CELL / 2})`} pointerEvents="none">
          <circle cx={0} cy={-6} r={11} fill={COLORS.success} opacity={0.5} />
          <circle cx={-8} cy={3} r={9} fill={COLORS.success} opacity={0.4} />
          <circle cx={8} cy={3} r={9} fill={COLORS.success} opacity={0.4} />
          <rect x={-2.5} y={8} width={5} height={10} fill={COLORS.wall} />
        </g>
      ))}
      {Array.from(zoneAnchors.entries()).map(([zone, pos]) => (
        <text key={zone} x={pos.x * CELL} y={Math.max(14, pos.y * CELL - 8)} fontFamily="Inter" fontWeight={600} fontSize={11}
          letterSpacing={1.4} fill={COLORS.ivoryDim} pointerEvents="none">{zone.toUpperCase()}</text>
      ))}
      {placed.filter((t) => !mergedIds.has(t.id)).map((t) => (
        <TableShape key={t.id} table={t} onTap={onTapTable ? () => onTapTable(t.id) : undefined} />
      ))}
      {mergedPairs.map(([a, b]) => (
        <MergedTableShape key={a.id} a={a} b={b} onTap={onTapTable ? () => onTapTable(a.id) : undefined} />
      ))}
    </svg>
  );
}
