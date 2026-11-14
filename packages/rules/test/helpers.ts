import type { CharacterDraft } from '@dmai/shared';
import type { Grid } from '../src/grid';

export function openGrid(w = 20, h = 20, walls: [number, number][] = []): Grid {
  const wall = new Set(walls.map(([x, y]) => `${x},${y}`));
  return {
    width: w,
    height: h,
    passable: (x, y) => x >= 0 && y >= 0 && x < w && y < h && !wall.has(`${x},${y}`),
    transparent: (x, y) => !wall.has(`${x},${y}`),
  };
}

export const fighterDraft: CharacterDraft = {
  name: 'Brom',
  color: '#aa3322',
  race: 'hill_dwarf',
  class: 'fighter',
  baseAbilities: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 },
  skills: ['athletics', 'perception'],
};

export const wizardDraft: CharacterDraft = {
  name: 'Ilyra',
  color: '#3355cc',
  race: 'high_elf',
  class: 'wizard',
  baseAbilities: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 },
  skills: ['arcana', 'history'],
};

export const rogueDraft: CharacterDraft = {
  name: 'Pip',
  color: '#22aa55',
  race: 'lightfoot_halfling',
  class: 'rogue',
  baseAbilities: { str: 8, dex: 15, con: 13, int: 12, wis: 10, cha: 14 },
  skills: ['acrobatics', 'perception', 'sleight_of_hand', 'deception'],
};

export const clericDraft: CharacterDraft = {
  name: 'Sera',
  color: '#ddcc44',
  race: 'human',
  class: 'cleric',
  baseAbilities: { str: 14, dex: 10, con: 13, int: 8, wis: 15, cha: 12 },
  skills: ['medicine', 'religion'],
};
