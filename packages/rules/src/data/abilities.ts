import type { Ability, Loc } from '@dmai/shared';

export const ABILITY_NAMES: Record<Ability, Loc> = {
  str: { en: 'Strength', tr: 'Güç' },
  dex: { en: 'Dexterity', tr: 'Çeviklik' },
  con: { en: 'Constitution', tr: 'Dayanıklılık' },
  int: { en: 'Intelligence', tr: 'Zekâ' },
  wis: { en: 'Wisdom', tr: 'Bilgelik' },
  cha: { en: 'Charisma', tr: 'Karizma' },
};

export const ABILITY_SHORT: Record<Ability, Loc> = {
  str: { en: 'STR', tr: 'GÜÇ' },
  dex: { en: 'DEX', tr: 'ÇEV' },
  con: { en: 'CON', tr: 'DAY' },
  int: { en: 'INT', tr: 'ZEK' },
  wis: { en: 'WIS', tr: 'BİL' },
  cha: { en: 'CHA', tr: 'KAR' },
};
