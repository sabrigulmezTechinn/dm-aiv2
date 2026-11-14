import * as ROT from 'rot-js';
import type { GameMap, LightSource, MapKind, Prop, PropKind, Room } from '@dmai/shared';
import { findPath, seededRng, type Rng } from '@dmai/rules';
import { MapGrid, emptyRows, encloseWithWalls, isFloorChar, setTile } from './tiles';

export interface GenerateOptions {
  kind: MapKind;
  seed: number;
  id?: string;
}

const BLOCKING: Record<PropKind, { move: boolean; sight: boolean }> = {
  bar_counter: { move: true, sight: false },
  table: { move: true, sight: false },
  chair: { move: false, sight: false },
  stool: { move: false, sight: false },
  fireplace: { move: true, sight: false },
  barrel: { move: true, sight: false },
  crate: { move: true, sight: false },
  chest: { move: true, sight: false },
  bed: { move: true, sight: false },
  altar: { move: true, sight: false },
  statue: { move: true, sight: true },
  pillar: { move: true, sight: true },
  rubble: { move: false, sight: false },
  torch: { move: false, sight: false },
  tree: { move: true, sight: true },
  rock: { move: true, sight: false },
  bookshelf: { move: true, sight: true },
  bones: { move: false, sight: false },
  campfire: { move: true, sight: false },
};

class Builder {
  rows: string[][];
  props: Prop[] = [];
  rooms: Room[] = [];
  lights: LightSource[] = [];
  anchors: Record<string, { x: number; y: number }> = {};
  private occupied = new Set<string>();
  private n = 0;

  constructor(public w: number, public h: number, public rng: Rng) {
    this.rows = emptyRows(w, h);
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.rng() * (max - min + 1));
  }

  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.rng() * arr.length)]!;
  }

  floorAt(x: number, y: number): boolean {
    const ch = this.rows[y]?.[x];
    return !!ch && isFloorChar(ch) && ch !== '+' && ch !== '/';
  }

  free(x: number, y: number): boolean {
    return this.floorAt(x, y) && !this.occupied.has(`${x},${y}`);
  }

  prop(kind: PropKind, x: number, y: number, opts: { rot?: number; tag?: string; force?: boolean } = {}): Prop | null {
    if (!opts.force && !this.free(x, y)) return null;
    const b = BLOCKING[kind];
    const p: Prop = { id: `p${++this.n}`, kind, x, y, blocksMove: b.move, blocksSight: b.sight };
    if (opts.rot) p.rot = opts.rot;
    if (opts.tag) p.tag = opts.tag;
    this.props.push(p);
    this.occupied.add(`${x},${y}`);
    return p;
  }

  reserve(x: number, y: number) {
    this.occupied.add(`${x},${y}`);
  }

  /** Wall-adjacent floor tiles inside a room, useful for wall decorations. */
  wallSpots(r: Room): { x: number; y: number; rot: number }[] {
    const out: { x: number; y: number; rot: number }[] = [];
    for (let x = r.x; x < r.x + r.w; x++) {
      if (this.rows[r.y - 1]?.[x] === '#') out.push({ x, y: r.y, rot: 0 });
      if (this.rows[r.y + r.h]?.[x] === '#') out.push({ x, y: r.y + r.h - 1, rot: 2 });
    }
    for (let y = r.y; y < r.y + r.h; y++) {
      if (this.rows[y]?.[r.x - 1] === '#') out.push({ x: r.x, y, rot: 3 });
      if (this.rows[y]?.[r.x + r.w] === '#') out.push({ x: r.x + r.w - 1, y, rot: 1 });
    }
    return out;
  }

  /** Removes blocking props until every open floor tile is reachable from spawn. */
  ensureConnected(spawn: { x: number; y: number }): void {
    for (let guard = 0; guard < 50; guard++) {
      const map = this.finishRaw('dungeon', 0, 'tmp', spawn, 0);
      const withProps = new MapGrid(map);
      const bare = new MapGrid({ ...map, props: [] });
      const reach = new Set<string>();
      const stack = [spawn];
      reach.add(`${spawn.x},${spawn.y}`);
      while (stack.length) {
        const p = stack.pop()!;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = p.x + dx;
            const ny = p.y + dy;
            const k = `${nx},${ny}`;
            if (reach.has(k) || !withProps.passable(nx, ny)) continue;
            if (dx && dy && (!withProps.passable(p.x + dx, p.y) || !withProps.passable(p.x, p.y + dy))) continue;
            reach.add(k);
            stack.push({ x: nx, y: ny });
          }
      }
      let target: { x: number; y: number } | null = null;
      for (let y = 0; y < this.h && !target; y++)
        for (let x = 0; x < this.w && !target; x++) if (withProps.passable(x, y) && !reach.has(`${x},${y}`)) target = { x, y };
      if (!target) return;
      const path = findPath(bare, spawn, target);
      if (!path) {
        // Unreachable even without props: fill it in so it isn't a phantom area.
        this.rows[target.y]![target.x] = '#';
        continue;
      }
      const onPath = new Set(path.map((p) => `${p.x},${p.y}`));
      // Also clear corner blockers next to diagonal steps.
      this.props = this.props.filter((pr) => !(pr.blocksMove && onPath.has(`${pr.x},${pr.y}`)));
    }
  }

  finish(kind: MapKind, seed: number, id: string, spawn: { x: number; y: number }, ambient: number): GameMap {
    this.ensureConnected(spawn);
    return this.finishRaw(kind, seed, id, spawn, ambient);
  }

  finishRaw(kind: MapKind, seed: number, id: string, spawn: { x: number; y: number }, ambient: number): GameMap {
    return {
      id,
      kind,
      seed,
      width: this.w,
      height: this.h,
      tiles: this.rows.map((r) => r.join('')),
      props: this.props,
      rooms: this.rooms,
      lights: this.lights,
      spawn,
      ambient,
      anchors: this.anchors,
    };
  }
}

// ---------------------------------------------------------------------------
// Tavern

function generateTavern(seed: number, id: string): GameMap {
  const rng = seededRng(seed);
  const W = 20 + Math.floor(rng() * 4);
  const H = 15 + Math.floor(rng() * 3);
  const b = new Builder(W, H, rng);
  // Interior floor.
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) setTile(b.rows, x, y, '=');
  // Back rooms on the east side: kitchen (north) and storeroom (south).
  const split = W - 7;
  for (let y = 1; y < H - 1; y++) setTile(b.rows, split, y, '#');
  const mid = Math.floor(H / 2);
  for (let x = split + 1; x < W - 1; x++) setTile(b.rows, x, mid, '#');
  setTile(b.rows, split, Math.floor(mid / 2) + 1, '+');
  setTile(b.rows, split, mid + Math.floor((H - mid) / 2), '+');
  // Storeroom stone floor and stairs to the cellar.
  for (let y = mid + 1; y < H - 1; y++) for (let x = split + 1; x < W - 1; x++) setTile(b.rows, x, y, '.');
  const stairs = { x: W - 3, y: H - 3 };
  setTile(b.rows, stairs.x, stairs.y, '>');
  b.anchors.cellar_stairs = stairs;
  b.reserve(stairs.x, stairs.y);
  // Front door.
  const doorX = Math.floor(split / 2);
  setTile(b.rows, doorX, H - 1, '+');
  encloseWithWalls(b.rows);
  setTile(b.rows, doorX, H - 1, '+');
  const spawn = { x: doorX, y: H - 2 };
  b.reserve(spawn.x, spawn.y);
  b.reserve(spawn.x, spawn.y - 1);
  b.anchors.entrance = spawn;

  const common: Room = { id: 'r1', label: 'common_room', x: 1, y: 1, w: split - 1, h: H - 2 };
  const kitchen: Room = { id: 'r2', label: 'kitchen', x: split + 1, y: 1, w: W - split - 2, h: mid - 1 };
  const store: Room = { id: 'r3', label: 'storeroom', x: split + 1, y: mid + 1, w: W - split - 2, h: H - mid - 2 };
  b.rooms.push(common, kitchen, store);

  // Bar counter along the north wall of the common room, near the kitchen.
  const barLen = b.int(4, 6);
  const barY = 3;
  const barX0 = split - barLen - 1;
  for (let i = 0; i < barLen; i++) {
    b.prop('bar_counter', barX0 + i, barY);
    b.prop('stool', barX0 + i, barY + 1);
  }
  // Behind the bar: barrels and the innkeeper spot.
  b.prop('barrel', barX0, 1);
  b.prop('barrel', barX0 + 1, 1);
  b.anchors.behind_bar = { x: barX0 + Math.floor(barLen / 2), y: 2 };
  b.reserve(b.anchors.behind_bar.x, b.anchors.behind_bar.y);
  b.anchors.bar = { x: barX0 + Math.floor(barLen / 2), y: barY + 1 };

  // Fireplace on the west wall.
  const fy = b.int(4, H - 6);
  b.prop('fireplace', 1, fy, { rot: 3 });
  b.lights.push({ x: 1, y: fy, radius: 6, color: '#ff8a3c' });
  b.anchors.fireplace = { x: 2, y: fy };
  b.reserve(2, fy);

  // Tables with chairs in the common room.
  const tableSpots: { x: number; y: number }[] = [];
  for (let ty = 6; ty < H - 3; ty += 3)
    for (let tx = 4; tx < split - 2; tx += 4) tableSpots.push({ x: tx + b.int(0, 1), y: ty });
  let t = 0;
  for (const s of tableSpots) {
    if (Math.abs(s.x - doorX) <= 1 && s.y >= H - 4) continue;
    if (!b.free(s.x, s.y) || b.rng() < 0.15) continue;
    b.prop('table', s.x, s.y);
    t++;
    const seats = [
      [s.x - 1, s.y],
      [s.x + 1, s.y],
      [s.x, s.y - 1],
      [s.x, s.y + 1],
    ] as const;
    let si = 0;
    for (const [cx, cy] of seats) {
      if (b.rng() < 0.75 && b.prop('chair', cx, cy, { rot: si })) {
        if (!b.anchors[`table_${t}`]) b.anchors[`table_${t}`] = { x: cx, y: cy };
      }
      si++;
    }
  }
  b.anchors.corner = { x: 2, y: H - 3 };

  // Kitchen.
  b.prop('table', kitchen.x + 1, kitchen.y + 1);
  b.prop('barrel', kitchen.x + kitchen.w - 1, kitchen.y);
  b.prop('crate', kitchen.x + kitchen.w - 1, kitchen.y + 1);
  b.prop('fireplace', kitchen.x + Math.floor(kitchen.w / 2), kitchen.y, { rot: 0, force: true });
  b.lights.push({ x: kitchen.x + Math.floor(kitchen.w / 2), y: kitchen.y, radius: 4, color: '#ff8a3c' });
  b.anchors.kitchen = { x: kitchen.x + 1, y: kitchen.y + kitchen.h - 1 };
  // Storeroom.
  b.prop('crate', store.x, store.y + store.h - 1);
  b.prop('barrel', store.x + 1, store.y + store.h - 1);
  b.prop('crate', store.x, store.y);
  b.prop('chest', store.x + store.w - 1, store.y, { tag: 'locked' });

  // Wall torches.
  for (const r of [common, common]) {
    const spots = b.wallSpots(r).filter((s) => b.free(s.x, s.y));
    const s = b.pick(spots);
    if (s) {
      b.prop('torch', s.x, s.y, { rot: s.rot });
      b.lights.push({ x: s.x, y: s.y, radius: 5, color: '#ffb35c' });
    }
  }
  return b.finish('tavern', seed, id, spawn, 0.75);
}

// ---------------------------------------------------------------------------
// Dungeon / cellar via rot.js Digger

function digDungeon(kind: 'dungeon' | 'cellar', seed: number, id: string): GameMap {
  const rng = seededRng(seed);
  const W = kind === 'dungeon' ? 44 : 26;
  const H = kind === 'dungeon' ? 30 : 18;
  ROT.RNG.setSeed(seed);
  const b = new Builder(W, H, rng);
  const digger = new ROT.Map.Digger(W, H, {
    roomWidth: kind === 'dungeon' ? [4, 9] : [3, 6],
    roomHeight: kind === 'dungeon' ? [3, 7] : [3, 5],
    corridorLength: kind === 'dungeon' ? [2, 7] : [1, 4],
    dugPercentage: kind === 'dungeon' ? 0.28 : 0.35,
  });
  digger.create((x, y, v) => {
    if (v === 0) setTile(b.rows, x, y, '.');
  });
  const rooms = digger.getRooms();
  rooms.forEach((r, i) => {
    b.rooms.push({ id: `r${i + 1}`, label: `room_${i + 1}`, x: r.getLeft(), y: r.getTop(), w: r.getRight() - r.getLeft() + 1, h: r.getBottom() - r.getTop() + 1 });
    r.getDoors((dx, dy) => setTile(b.rows, dx, dy, '+'));
  });
  encloseWithWalls(b.rows);
  // Doors that ended up isolated become floor.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (b.rows[y]![x] !== '+') continue;
      const ns = isFloorChar(b.rows[y - 1]?.[x] ?? ' ') && isFloorChar(b.rows[y + 1]?.[x] ?? ' ');
      const ew = isFloorChar(b.rows[y]?.[x - 1] ?? ' ') && isFloorChar(b.rows[y]?.[x + 1] ?? ' ');
      if (!(ns || ew) || b.rng() < 0.35) b.rows[y]![x] = '.';
    }
  const first = b.rooms[0]!;
  const spawn = { x: first.x + Math.floor(first.w / 2), y: first.y + Math.floor(first.h / 2) };
  setTile(b.rows, spawn.x, spawn.y, '<');
  b.reserve(spawn.x, spawn.y);
  b.anchors.entrance = spawn;
  // Farthest room gets the stairs down / the treasure.
  const grid = new MapGrid(b.finishRaw(kind, seed, id, spawn, 0));
  let far = first;
  let farLen = -1;
  for (const r of b.rooms.slice(1)) {
    const c = { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) };
    const path = findPath(grid, spawn, c);
    if (path && path.length > farLen) {
      farLen = path.length;
      far = r;
    }
  }
  const farCenter = { x: far.x + Math.floor(far.w / 2), y: far.y + Math.floor(far.h / 2) };
  b.anchors.deepest = farCenter;
  far.label = kind === 'dungeon' ? 'inner_sanctum' : 'back_room';
  first.label = 'entrance_hall';
  if (kind === 'dungeon') {
    b.prop('altar', farCenter.x, farCenter.y - 1);
    b.prop('statue', far.x, far.y);
    b.prop('statue', far.x + far.w - 1, far.y);
    b.prop('chest', farCenter.x + 1, farCenter.y + 1, { tag: 'treasure' });
    b.anchors.altar = { x: farCenter.x, y: farCenter.y };
  } else {
    b.prop('chest', farCenter.x, farCenter.y, { tag: 'hidden' });
  }
  b.reserve(farCenter.x, farCenter.y);
  // Decorate rooms.
  for (const r of b.rooms) {
    const area = r.w * r.h;
    const n = Math.max(1, Math.floor(area / 10));
    const kinds: PropKind[] = kind === 'dungeon' ? ['rubble', 'bones', 'crate', 'barrel', 'pillar', 'rubble'] : ['barrel', 'crate', 'barrel', 'crate', 'bookshelf'];
    for (let i = 0; i < n; i++) {
      const x = r.x + b.int(0, r.w - 1);
      const y = r.y + b.int(0, r.h - 1);
      const k = b.pick(kinds);
      if (k === 'pillar' && (r.w < 5 || r.h < 4)) continue;
      // Avoid blocking room centers and doorways.
      if (Math.abs(x - (r.x + r.w / 2)) < 1 && Math.abs(y - (r.y + r.h / 2)) < 1) continue;
      if (adjacentToDoor(b.rows, x, y)) continue;
      b.prop(k, x, y);
    }
    if (kind === 'dungeon' && r.w >= 6 && r.h >= 5 && b.rng() < 0.4) {
      b.prop('pillar', r.x + 1, r.y + 1);
      b.prop('pillar', r.x + r.w - 2, r.y + r.h - 2);
    }
    if (b.rng() < (kind === 'dungeon' ? 0.45 : 0.3)) {
      const spots = b.wallSpots(r).filter((s) => b.free(s.x, s.y) && !adjacentToDoor(b.rows, s.x, s.y));
      const s = spots.length ? b.pick(spots) : null;
      if (s) {
        b.prop('torch', s.x, s.y, { rot: s.rot });
        b.lights.push({ x: s.x, y: s.y, radius: 4, color: '#ffa04a' });
      }
    }
  }
  // Every room center is a placement anchor.
  b.rooms.forEach((r) => {
    b.anchors[r.label] = { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) };
  });
  return b.finish(kind, seed, id, spawn, kind === 'dungeon' ? 0.12 : 0.18);
}

function adjacentToDoor(rows: string[][], x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const ch = rows[y + dy]?.[x + dx];
      if (ch === '+' || ch === '/') return true;
    }
  return false;
}

// ---------------------------------------------------------------------------
// Cave via cellular automata

function generateCave(seed: number, id: string): GameMap {
  const rng = seededRng(seed);
  const W = 38;
  const H = 26;
  ROT.RNG.setSeed(seed);
  const b = new Builder(W, H, rng);
  const cell = new ROT.Map.Cellular(W, H, { born: [5, 6, 7, 8], survive: [4, 5, 6, 7, 8] });
  cell.randomize(0.5);
  for (let i = 0; i < 3; i++) cell.create();
  const open: boolean[][] = Array.from({ length: H }, () => Array(W).fill(false));
  cell.create((x, y, v) => {
    if (v === 1 && x > 1 && y > 1 && x < W - 2 && y < H - 2) open[y]![x] = true;
  });
  // Keep only the largest connected region.
  const seen = new Set<string>();
  let best: [number, number][] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!open[y]![x] || seen.has(`${x},${y}`)) continue;
      const region: [number, number][] = [];
      const stack: [number, number][] = [[x, y]];
      seen.add(`${x},${y}`);
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        region.push([cx, cy]);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (open[ny]?.[nx] && !seen.has(`${nx},${ny}`)) {
            seen.add(`${nx},${ny}`);
            stack.push([nx, ny]);
          }
        }
      }
      if (region.length > best.length) best = region;
    }
  for (const [x, y] of best) setTile(b.rows, x, y, ',');
  encloseWithWalls(b.rows);
  // Spawn at the westmost tile, camp at the eastmost.
  const sorted = [...best].sort((a, c) => a[0] - c[0]);
  const s = sorted[0]!;
  const e = sorted[sorted.length - 1]!;
  const spawn = { x: s[0], y: s[1] };
  b.reserve(spawn.x, spawn.y);
  b.anchors.entrance = spawn;
  let campfire = { x: e[0] - 2, y: e[1] };
  for (const [x, y] of [...best].sort((a, c) => Math.abs(a[0] - e[0] + 2) + Math.abs(a[1] - e[1]) - (Math.abs(c[0] - e[0] + 2) + Math.abs(c[1] - e[1])))) {
    if (b.free(x, y) && !(x === e[0] && y === e[1])) {
      campfire = { x, y };
      break;
    }
  }
  b.reserve(e[0], e[1]);
  if (b.free(campfire.x, campfire.y)) {
    b.prop('campfire', campfire.x, campfire.y);
    b.lights.push({ x: campfire.x, y: campfire.y, radius: 6, color: '#ff7a2c' });
  }
  b.anchors.camp = { x: e[0], y: e[1] };
  b.anchors.deepest = b.anchors.camp;
  const mid = sorted[Math.floor(sorted.length / 2)]!;
  b.anchors.middle = { x: mid[0], y: mid[1] };
  b.rooms.push({ id: 'r1', label: 'cave', x: 1, y: 1, w: W - 2, h: H - 2 });
  // Scatter rocks and bones.
  for (let i = 0; i < best.length / 25; i++) {
    const [x, y] = b.pick(best);
    b.prop(b.rng() < 0.7 ? 'rock' : 'bones', x, y);
  }
  return b.finish('cave', seed, id, spawn, 0.08);
}

// ---------------------------------------------------------------------------
// Outdoor battlefield

function generateBattlefield(seed: number, id: string): GameMap {
  const rng = seededRng(seed);
  const W = 26;
  const H = 20;
  const b = new Builder(W, H, rng);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) setTile(b.rows, x, y, '"');
  // A dirt road across.
  let ry = b.int(6, H - 7);
  for (let x = 1; x < W - 1; x++) {
    setTile(b.rows, x, ry, ',');
    setTile(b.rows, x, ry + 1, ',');
    if (b.rng() < 0.2) ry = Math.max(3, Math.min(H - 5, ry + (b.rng() < 0.5 ? -1 : 1)));
  }
  // Optional pond.
  if (b.rng() < 0.5) {
    const px = b.int(5, W - 8);
    const py = ry > H / 2 ? b.int(2, 4) : b.int(H - 6, H - 4);
    for (let y = py; y < py + 3; y++) for (let x = px; x < px + 4; x++) if (b.rng() < 0.85) setTile(b.rows, x, y, '~');
  }
  // Treeline on the edges, scattered trees and rocks.
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      if (b.rows[y]![x] !== '"') continue;
      const edge = x < 3 || y < 3 || x > W - 4 || y > H - 4;
      if (edge && b.rng() < 0.45) b.prop('tree', x, y);
      else if (!edge && b.rng() < 0.05) b.prop(b.rng() < 0.6 ? 'tree' : 'rock', x, y);
    }
  encloseWithWalls(b.rows);
  // Outdoor edges are a soft boundary: dense trees instead of stone walls.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (b.rows[y]![x] === '#') {
        b.rows[y]![x] = '"';
        b.prop('tree', x, y, { force: true });
      }
    }
  const spawn = { x: 3, y: ry };
  for (let dx = 0; dx < 3; dx++) {
    const k = b.props.findIndex((p) => p.x === spawn.x + dx && p.y === spawn.y);
    if (k >= 0) b.props.splice(k, 1);
  }
  b.reserve(spawn.x, spawn.y);
  b.anchors.entrance = spawn;
  b.anchors.road_east = { x: W - 4, y: ry };
  b.rooms.push({ id: 'r1', label: 'clearing', x: 1, y: 1, w: W - 2, h: H - 2 });
  return b.finish('battlefield', seed, id, spawn, 1);
}

export function generateMap(opts: GenerateOptions): GameMap {
  const id = opts.id ?? `map_${opts.kind}_${opts.seed}`;
  switch (opts.kind) {
    case 'tavern':
      return generateTavern(opts.seed, id);
    case 'dungeon':
      return digDungeon('dungeon', opts.seed, id);
    case 'cellar':
      return digDungeon('cellar', opts.seed, id);
    case 'cave':
      return generateCave(opts.seed, id);
    case 'battlefield':
      return generateBattlefield(opts.seed, id);
  }
}
