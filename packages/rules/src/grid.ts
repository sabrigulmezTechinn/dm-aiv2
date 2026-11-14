/** Minimal grid interface the rules engine needs from a map. */
export interface Grid {
  width: number;
  height: number;
  passable(x: number, y: number): boolean;
  transparent(x: number, y: number): boolean;
}

export interface Point {
  x: number;
  y: number;
}

export const key = (x: number, y: number) => `${x},${y}`;

/** Grid distance in feet (5e default: diagonals cost 5 ft). */
export function distanceFt(a: Point, b: Point): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) * 5;
}

export function adjacent(a: Point, b: Point): boolean {
  return distanceFt(a, b) <= 5 && !(a.x === b.x && a.y === b.y);
}

const DIRS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
] as const;

function canStep(grid: Grid, x: number, y: number, dx: number, dy: number): boolean {
  const nx = x + dx;
  const ny = y + dy;
  if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) return false;
  if (!grid.passable(nx, ny)) return false;
  // No corner cutting past walls.
  if (dx !== 0 && dy !== 0 && (!grid.passable(x + dx, y) || !grid.passable(x, y + dy))) return false;
  return true;
}

/**
 * Breadth-first path from `from` to `to` (8-directional). Tiles in `blocked`
 * cannot be entered, except the goal itself when `allowGoalBlocked` is set.
 * Returns the steps excluding the start, or null.
 */
export function findPath(
  grid: Grid,
  from: Point,
  to: Point,
  blocked: Set<string> = new Set(),
  opts: { maxSteps?: number; allowGoalBlocked?: boolean } = {},
): Point[] | null {
  if (from.x === to.x && from.y === to.y) return [];
  const goal = key(to.x, to.y);
  const prev = new Map<string, string>();
  const seen = new Set<string>([key(from.x, from.y)]);
  let frontier: Point[] = [from];
  let steps = 0;
  while (frontier.length > 0) {
    steps++;
    if (opts.maxSteps !== undefined && steps > opts.maxSteps) return null;
    const next: Point[] = [];
    for (const p of frontier) {
      for (const [dx, dy] of DIRS) {
        if (!canStep(grid, p.x, p.y, dx, dy)) continue;
        const nx = p.x + dx;
        const ny = p.y + dy;
        const k = key(nx, ny);
        if (seen.has(k)) continue;
        if (blocked.has(k) && !(k === goal && opts.allowGoalBlocked)) continue;
        seen.add(k);
        prev.set(k, key(p.x, p.y));
        if (k === goal) {
          const path: Point[] = [];
          let cur: string | undefined = k;
          const start = key(from.x, from.y);
          while (cur && cur !== start) {
            const [cx, cy] = cur.split(',').map(Number) as [number, number];
            path.unshift({ x: cx, y: cy });
            cur = prev.get(cur);
          }
          return path;
        }
        next.push({ x: nx, y: ny });
      }
    }
    frontier = next;
  }
  return null;
}

/** All tiles reachable within `maxFt` feet, with their cost in feet. */
export function reachable(grid: Grid, from: Point, maxFt: number, blocked: Set<string> = new Set()): Map<string, number> {
  const out = new Map<string, number>([[key(from.x, from.y), 0]]);
  let frontier: Point[] = [from];
  let cost = 0;
  while (frontier.length > 0 && cost < maxFt) {
    cost += 5;
    const next: Point[] = [];
    for (const p of frontier) {
      for (const [dx, dy] of DIRS) {
        if (!canStep(grid, p.x, p.y, dx, dy)) continue;
        const k = key(p.x + dx, p.y + dy);
        if (out.has(k) || blocked.has(k)) continue;
        out.set(k, cost);
        next.push({ x: p.x + dx, y: p.y + dy });
      }
    }
    frontier = next;
  }
  return out;
}

/** Bresenham line of sight; intermediate tiles must be transparent. */
export function lineOfSight(grid: Grid, a: Point, b: Point): boolean {
  let x0 = a.x;
  let y0 = a.y;
  const dx = Math.abs(b.x - x0);
  const dy = -Math.abs(b.y - y0);
  const sx = x0 < b.x ? 1 : -1;
  const sy = y0 < b.y ? 1 : -1;
  let err = dx + dy;
  while (!(x0 === b.x && y0 === b.y)) {
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
    if (x0 === b.x && y0 === b.y) break;
    if (!grid.transparent(x0, y0)) return false;
  }
  return true;
}

/** Picks free tiles for new combatants at a comfortable distance from an anchor. */
export function pickSpawnTiles(
  grid: Grid,
  anchor: Point,
  count: number,
  occupied: Set<string>,
  rng: () => number,
  opts: { minDist?: number; maxDist?: number } = {},
): Point[] {
  const minD = opts.minDist ?? 3;
  const maxD = opts.maxDist ?? 7;
  const reach = reachable(grid, anchor, maxD * 5 + 20, new Set());
  const candidates: { p: Point; score: number }[] = [];
  for (const k of reach.keys()) {
    if (occupied.has(k)) continue;
    const [x, y] = k.split(',').map(Number) as [number, number];
    const d = distanceFt(anchor, { x, y }) / 5;
    if (d < minD || d > maxD) continue;
    const los = lineOfSight(grid, anchor, { x, y });
    candidates.push({ p: { x, y }, score: (los ? 10 : 0) + rng() * 5 - Math.abs(d - (minD + maxD) / 2) });
  }
  candidates.sort((a, b) => b.score - a.score);
  const out: Point[] = [];
  const taken = new Set(occupied);
  // Cluster around the best candidate so enemies arrive as a group.
  const first = candidates[0]?.p;
  if (first) {
    const byCluster = [...candidates].sort((a, b) => distanceFt(a.p, first) - distanceFt(b.p, first) || b.score - a.score);
    for (const c of byCluster) {
      if (out.length >= count) break;
      const k = key(c.p.x, c.p.y);
      if (taken.has(k)) continue;
      taken.add(k);
      out.push(c.p);
    }
  }
  // Fallback: any free passable tile.
  if (out.length < count) {
    for (let y = 0; y < grid.height && out.length < count; y++) {
      for (let x = 0; x < grid.width && out.length < count; x++) {
        const k = key(x, y);
        if (grid.passable(x, y) && !taken.has(k)) {
          taken.add(k);
          out.push({ x, y });
        }
      }
    }
  }
  return out;
}
