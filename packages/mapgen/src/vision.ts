import * as ROT from 'rot-js';
import type { FogRows, GameMap } from '@dmai/shared';
import { MapGrid } from './tiles';

export interface VisionOptions {
  /** Darkvision range in feet (0 = none). */
  darkvision: number;
  /** Whether the viewer carries a light (torch). */
  hasLight: boolean;
}

/** Radius in tiles the viewer sees unaided on this map. */
export function sightRadius(map: GameMap, opts: VisionOptions): number {
  if (map.ambient >= 0.5) return 30;
  const torch = opts.hasLight ? 8 : 2;
  const dark = Math.floor(opts.darkvision / 5);
  return Math.max(torch, dark);
}

/** Set of "x,y" keys visible from origin. Lit tiles further away are visible if in line of sight. */
export function computeVisible(map: GameMap, origin: { x: number; y: number }, opts: VisionOptions): Set<string> {
  const grid = new MapGrid(map);
  const visible = new Set<string>();
  const fov = new ROT.FOV.PreciseShadowcasting((x, y) => grid.transparent(x, y) || (x === origin.x && y === origin.y));
  const r = sightRadius(map, opts);
  fov.compute(origin.x, origin.y, r, (x, y) => {
    if (x >= 0 && y >= 0 && x < map.width && y < map.height) visible.add(`${x},${y}`);
  });
  if (map.lights.length && r < 30) {
    const lit = new Set<string>();
    for (const l of map.lights) {
      const lf = new ROT.FOV.PreciseShadowcasting((x, y) => grid.transparent(x, y) || (x === l.x && y === l.y));
      lf.compute(l.x, l.y, l.radius, (x, y) => lit.add(`${x},${y}`));
    }
    fov.compute(origin.x, origin.y, 24, (x, y) => {
      const k = `${x},${y}`;
      if (lit.has(k)) visible.add(k);
    });
  }
  // Walls adjacent to visible floor are visible too (keeps rooms readable).
  return visible;
}

export function emptyExplored(map: GameMap): string[] {
  return Array.from({ length: map.height }, () => '0'.repeat(map.width));
}

/** Marks visible tiles as explored and returns the fog rows for the client. */
export function updateFog(map: GameMap, explored: string[], visible: Set<string>): { explored: string[]; fog: FogRows } {
  const ex = explored.map((r) => r.split(''));
  const fog: string[][] = ex.map((r) => r.map((ch) => (ch === '1' ? '1' : '0')));
  for (const k of visible) {
    const [x, y] = k.split(',').map(Number) as [number, number];
    if (!ex[y] || ex[y]![x] === undefined) continue;
    ex[y]![x] = '1';
    fog[y]![x] = '2';
  }
  return { explored: ex.map((r) => r.join('')), fog: fog.map((r) => r.join('')) };
}

/** Copy of the map with unexplored tiles and props hidden (for the client). */
export function maskMap(map: GameMap, explored: string[]): GameMap {
  const tiles = map.tiles.map((row, y) =>
    row
      .split('')
      .map((ch, x) => (explored[y]?.[x] === '1' ? ch : ' '))
      .join(''),
  );
  const props = map.props.filter((p) => explored[p.y]?.[p.x] === '1').map((p) => ({ ...p, tag: undefined }));
  const lights = map.lights.filter((l) => explored[l.y]?.[l.x] === '1');
  return { ...map, tiles, props, lights, anchors: {}, rooms: [] };
}
