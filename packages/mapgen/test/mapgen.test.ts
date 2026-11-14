import { describe, expect, it } from 'vitest';
import type { MapKind } from '@dmai/shared';
import { findPath } from '@dmai/rules';
import { MapGrid, computeVisible, describeForDm, emptyExplored, generateMap, maskMap, nearestFree, updateFog, walkPath } from '../src';

const KINDS: MapKind[] = ['tavern', 'dungeon', 'cellar', 'cave', 'battlefield'];

describe('map generation', () => {
  for (const kind of KINDS) {
    it(`generates connected ${kind} maps`, () => {
      for (let seed = 1; seed <= 15; seed++) {
        const map = generateMap({ kind, seed });
        expect(map.tiles).toHaveLength(map.height);
        expect(map.tiles.every((r) => r.length === map.width)).toBe(true);
        const grid = new MapGrid(map);
        expect(grid.passable(map.spawn.x, map.spawn.y)).toBe(true);
        // Every anchor must be reachable from spawn.
        for (const [name, a] of Object.entries(map.anchors)) {
          const target = grid.passable(a.x, a.y) ? a : nearestFree(map, a, new Set());
          const path = findPath(grid, map.spawn, target, new Set(), {});
          expect(path, `${kind} seed ${seed} anchor ${name}`).not.toBeNull();
        }
      }
    });
  }

  it('is deterministic for a seed', () => {
    expect(generateMap({ kind: 'dungeon', seed: 9 }).tiles).toEqual(generateMap({ kind: 'dungeon', seed: 9 }).tiles);
    expect(generateMap({ kind: 'tavern', seed: 9 }).props).toEqual(generateMap({ kind: 'tavern', seed: 9 }).props);
  });
});

describe('vision', () => {
  it('sees more in a bright tavern than a dark dungeon', () => {
    const tavern = generateMap({ kind: 'tavern', seed: 3 });
    const dungeon = generateMap({ kind: 'dungeon', seed: 3 });
    const tv = computeVisible(tavern, tavern.spawn, { darkvision: 0, hasLight: true });
    const dv = computeVisible(dungeon, dungeon.spawn, { darkvision: 0, hasLight: true });
    expect(tv.has(`${tavern.spawn.x},${tavern.spawn.y}`)).toBe(true);
    expect(tv.size).toBeGreaterThan(40);
    expect(dv.size).toBeLessThan(dungeon.width * dungeon.height / 3);
  });

  it('tracks explored fog and masks the map', () => {
    const map = generateMap({ kind: 'dungeon', seed: 5 });
    const vis = computeVisible(map, map.spawn, { darkvision: 60, hasLight: true });
    const { explored, fog } = updateFog(map, emptyExplored(map), vis);
    expect(fog[map.spawn.y]![map.spawn.x]).toBe('2');
    const masked = maskMap(map, explored);
    const hidden = masked.tiles.join('').split(' ').length;
    expect(hidden).toBeGreaterThan(map.tiles.join('').split(' ').length);
  });

  it('describes the scene for the DM', () => {
    const map = generateMap({ kind: 'tavern', seed: 2 });
    const vis = computeVisible(map, map.spawn, { darkvision: 0, hasLight: true });
    const text = describeForDm(map, map.spawn, vis, [{ id: 'npc1', kind: 'npc', name: 'Marta', x: map.anchors.behind_bar!.x, y: map.anchors.behind_bar!.y, color: '#fff' }]);
    expect(text).toMatch(/bar counter/);
    expect(text).toMatch(/Marta/);
  });

  it('walks between points', () => {
    const map = generateMap({ kind: 'tavern', seed: 4 });
    const target = nearestFree(map, map.anchors.fireplace!, new Set());
    expect(walkPath(map, map.spawn, target, new Set())).not.toBeNull();
  });
});
