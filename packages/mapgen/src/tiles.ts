import type { GameMap, Prop } from '@dmai/shared';
import type { Grid } from '@dmai/rules';

export const FLOOR_CHARS = new Set(['.', '=', ',', '"', '/', '>', '<', '+']);
export const OPAQUE_CHARS = new Set(['#', ' ', '+']);

export function tileAt(map: Pick<GameMap, 'tiles' | 'width' | 'height'>, x: number, y: number): string {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return ' ';
  return map.tiles[y]![x] ?? ' ';
}

export function setTile(rows: string[][], x: number, y: number, ch: string): void {
  if (y < 0 || y >= rows.length || x < 0 || x >= rows[0]!.length) return;
  rows[y]![x] = ch;
}

export function isFloorChar(ch: string): boolean {
  return FLOOR_CHARS.has(ch);
}

/** A Grid view over a GameMap, with props blocking movement/sight. */
export class MapGrid implements Grid {
  readonly width: number;
  readonly height: number;
  private blockMove = new Set<string>();
  private blockSight = new Set<string>();

  constructor(private map: GameMap) {
    this.width = map.width;
    this.height = map.height;
    for (const p of map.props) this.addProp(p);
  }

  private addProp(p: Prop) {
    const k = `${p.x},${p.y}`;
    if (p.blocksMove) this.blockMove.add(k);
    if (p.blocksSight) this.blockSight.add(k);
  }

  passable(x: number, y: number): boolean {
    const ch = tileAt(this.map, x, y);
    return isFloorChar(ch) && !this.blockMove.has(`${x},${y}`);
  }

  transparent(x: number, y: number): boolean {
    const ch = tileAt(this.map, x, y);
    return !OPAQUE_CHARS.has(ch) && !this.blockSight.has(`${x},${y}`);
  }
}

/** Surrounds every walkable tile with walls where there is void. */
export function encloseWithWalls(rows: string[][]): void {
  const h = rows.length;
  const w = rows[0]!.length;
  const copy = rows.map((r) => [...r]);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (copy[y]![x] !== ' ') continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++)
        for (let dx = -1; dx <= 1 && !near; dx++) {
          const ch = copy[y + dy]?.[x + dx];
          if (ch && ch !== ' ' && ch !== '#') near = true;
        }
      if (near) rows[y]![x] = '#';
    }
  // Map edge must be wall or void.
  for (let x = 0; x < w; x++) {
    if (rows[0]![x] !== ' ') rows[0]![x] = '#';
    if (rows[h - 1]![x] !== ' ') rows[h - 1]![x] = '#';
  }
  for (let y = 0; y < h; y++) {
    if (rows[y]![0] !== ' ') rows[y]![0] = '#';
    if (rows[y]![w - 1] !== ' ') rows[y]![w - 1] = '#';
  }
}

export function emptyRows(w: number, h: number, ch = ' '): string[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => ch));
}
