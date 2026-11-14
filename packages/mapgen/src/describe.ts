import type { GameMap, Locale, PropKind, Token } from '@dmai/shared';
import { MapGrid, tileAt } from './tiles';
import { findPath, type Point } from '@dmai/rules';

const PROP_NAMES: Record<PropKind, { en: string; tr: string }> = {
  bar_counter: { en: 'bar counter', tr: 'bar tezgâhı' },
  table: { en: 'table', tr: 'masa' },
  chair: { en: 'chair', tr: 'sandalye' },
  stool: { en: 'stool', tr: 'tabure' },
  fireplace: { en: 'fireplace', tr: 'şömine' },
  barrel: { en: 'barrel', tr: 'fıçı' },
  crate: { en: 'crate', tr: 'sandık (tahta)' },
  chest: { en: 'chest', tr: 'sandık' },
  bed: { en: 'bed', tr: 'yatak' },
  altar: { en: 'altar', tr: 'sunak' },
  statue: { en: 'statue', tr: 'heykel' },
  pillar: { en: 'pillar', tr: 'sütun' },
  rubble: { en: 'rubble', tr: 'moloz' },
  torch: { en: 'wall torch', tr: 'duvar meşalesi' },
  tree: { en: 'tree', tr: 'ağaç' },
  rock: { en: 'boulder', tr: 'kaya' },
  bookshelf: { en: 'bookshelf', tr: 'kitaplık' },
  bones: { en: 'bones', tr: 'kemikler' },
  campfire: { en: 'campfire', tr: 'kamp ateşi' },
};

export function propName(kind: PropKind, locale: Locale): string {
  return PROP_NAMES[kind][locale];
}

const DIRS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];

export function direction(from: Point, to: Point): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return 'here';
  const a = Math.atan2(dy, dx);
  const i = (Math.round(a / (Math.PI / 4)) + 8) % 8;
  return DIRS[i]!;
}

function dist(a: Point, b: Point): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function roomAt(map: GameMap, p: Point) {
  return map.rooms.find((r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h);
}

/**
 * Compact English description of the map from the player's point of view,
 * given to the AI DM so its narration matches what is on screen.
 */
export function describeForDm(map: GameMap, player: Point, visible: Set<string>, tokens: Token[]): string {
  const lines: string[] = [];
  const room = roomAt(map, player);
  lines.push(`Map: ${map.kind}, ${map.width}x${map.height} tiles (1 tile = 5 ft). Player at (${player.x},${player.y})${room ? ` in "${room.label}"` : ''}.`);
  const groups = new Map<string, { n: number; nearest: Point; d: number }>();
  for (const p of map.props) {
    if (!visible.has(`${p.x},${p.y}`)) continue;
    const name = PROP_NAMES[p.kind].en + (p.tag && p.kind === 'chest' ? ` (${p.tag})` : '');
    const d = dist(player, p);
    const g = groups.get(name);
    if (!g) groups.set(name, { n: 1, nearest: p, d });
    else {
      g.n++;
      if (d < g.d) {
        g.d = d;
        g.nearest = p;
      }
    }
  }
  if (groups.size) {
    const parts = [...groups.entries()]
      .sort((a, b) => a[1].d - b[1].d)
      .slice(0, 12)
      .map(([name, g]) => `${g.n > 1 ? `${g.n}x ` : ''}${name} (nearest ${g.d * 5} ft ${direction(player, g.nearest)})`);
    lines.push(`Visible objects: ${parts.join('; ')}.`);
  } else lines.push('Visible objects: none.');
  const exits: string[] = [];
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      const ch = tileAt(map, x, y);
      if (!visible.has(`${x},${y}`)) continue;
      if (ch === '+' || ch === '/') exits.push(`${ch === '+' ? 'closed' : 'open'} door ${dist(player, { x, y }) * 5} ft ${direction(player, { x, y })}`);
      if (ch === '>') exits.push(`stairs down ${dist(player, { x, y }) * 5} ft ${direction(player, { x, y })}`);
      if (ch === '<') exits.push(`stairs up ${dist(player, { x, y }) * 5} ft ${direction(player, { x, y })}`);
    }
  if (exits.length) lines.push(`Visible exits: ${exits.slice(0, 8).join('; ')}.`);
  const seen = tokens.filter((t) => t.kind !== 'player' && visible.has(`${t.x},${t.y}`));
  if (seen.length) lines.push(`Visible characters: ${seen.map((t) => `${t.name} [${t.id}] ${dist(player, t) * 5} ft ${direction(player, t)}${t.dead ? ' (dead)' : ''}`).join('; ')}.`);
  const unseenRooms = map.rooms.filter((r) => r !== room && !visible.has(`${r.x + Math.floor(r.w / 2)},${r.y + Math.floor(r.h / 2)}`));
  if (unseenRooms.length && map.kind !== 'battlefield') lines.push(`Unexplored areas remain (${unseenRooms.length} rooms not in view).`);
  return lines.join('\n');
}

/** Finds the nearest free passable tile to a point. */
export function nearestFree(map: GameMap, near: Point, occupied: Set<string>): Point {
  const grid = new MapGrid(map);
  for (let r = 0; r < 12; r++) {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = near.x + dx;
        const y = near.y + dy;
        if (grid.passable(x, y) && !occupied.has(`${x},${y}`) && tileAt(map, x, y) !== '+') return { x, y };
      }
  }
  return map.spawn;
}

/** Path for out-of-combat movement; returns null if unreachable. */
export function walkPath(map: GameMap, from: Point, to: Point, occupied: Set<string>): Point[] | null {
  const grid = new MapGrid(map);
  if (!grid.passable(to.x, to.y)) return null;
  return findPath(grid, from, to, occupied, { maxSteps: 120 });
}

/** Opens closed doors along a path (mutates map.tiles). Returns true if any door opened. */
export function openDoorsOnPath(map: GameMap, path: Point[]): boolean {
  let opened = false;
  for (const p of path) {
    if (tileAt(map, p.x, p.y) === '+') {
      const row = map.tiles[p.y]!;
      map.tiles[p.y] = row.slice(0, p.x) + '/' + row.slice(p.x + 1);
      opened = true;
    }
  }
  return opened;
}
