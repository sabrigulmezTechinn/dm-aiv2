import type { Ability, Loc, RaceId, Skill } from '@dmai/shared';

export type RaceTrait = 'lucky' | 'brave' | 'relentless' | 'savage_attacks' | 'dwarven_toughness' | 'poison_resilience' | 'fey_ancestry' | 'keen_senses';

export interface RaceDef {
  id: RaceId;
  name: Loc;
  description: Loc;
  bonuses: Partial<Record<Ability, number>>;
  speed: number;
  /** Darkvision range in feet, 0 if none. */
  darkvision: number;
  skills: Skill[];
  traits: RaceTrait[];
  traitText: Loc;
}

export const RACES: Record<RaceId, RaceDef> = {
  human: {
    id: 'human',
    name: { en: 'Human', tr: 'İnsan' },
    description: {
      en: 'Ambitious and adaptable, humans are found everywhere and excel at anything they set their minds to.',
      tr: 'Hırslı ve uyumlu. İnsanlar her yerdedir ve kafalarına koydukları her işte başarılı olabilirler.',
    },
    bonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    speed: 30,
    darkvision: 0,
    skills: [],
    traits: [],
    traitText: { en: '+1 to every ability score.', tr: 'Tüm yeteneklere +1.' },
  },
  high_elf: {
    id: 'high_elf',
    name: { en: 'High Elf', tr: 'Yüksek Elf' },
    description: {
      en: 'Graceful and keen-eyed, elves see in the dark and are hard to charm.',
      tr: 'Zarif ve keskin gözlü. Elfler karanlıkta görür ve büyüyle kandırılmaları zordur.',
    },
    bonuses: { dex: 2, int: 1 },
    speed: 30,
    darkvision: 60,
    skills: ['perception'],
    traits: ['fey_ancestry', 'keen_senses'],
    traitText: {
      en: 'Darkvision, proficiency in Perception, advantage against charm.',
      tr: 'Karanlıkta görüş, Algı yeterliliği, büyülenmeye karşı avantaj.',
    },
  },
  hill_dwarf: {
    id: 'hill_dwarf',
    name: { en: 'Hill Dwarf', tr: 'Tepe Cücesi' },
    description: {
      en: 'Stout and tough, dwarves shrug off poison and blows that would fell others.',
      tr: 'Tıknaz ve sağlam. Cüceler başkalarını yere serecek zehirleri ve darbeleri savuşturur.',
    },
    bonuses: { con: 2, wis: 1 },
    speed: 25,
    darkvision: 60,
    skills: [],
    traits: ['dwarven_toughness', 'poison_resilience'],
    traitText: {
      en: 'Darkvision, +1 HP per level, resistance to poison.',
      tr: 'Karanlıkta görüş, seviye başına +1 HP, zehre direnç.',
    },
  },
  lightfoot_halfling: {
    id: 'lightfoot_halfling',
    name: { en: 'Lightfoot Halfling', tr: 'Hafifayak Buçukluk' },
    description: {
      en: 'Small, nimble and remarkably lucky, halflings slip through danger.',
      tr: 'Küçük, çevik ve şaşırtıcı derecede şanslı. Buçukluklar tehlikeden sıyrılmayı bilir.',
    },
    bonuses: { dex: 2, cha: 1 },
    speed: 25,
    darkvision: 0,
    skills: ['stealth'],
    traits: ['lucky', 'brave'],
    traitText: {
      en: 'Lucky: reroll natural 1s on d20s. Brave: advantage against fear.',
      tr: 'Şanslı: d20\'de doğal 1\'i yeniden at. Cesur: korkuya karşı avantaj.',
    },
  },
  half_orc: {
    id: 'half_orc',
    name: { en: 'Half-Orc', tr: 'Yarı-Ork' },
    description: {
      en: 'Strong and relentless, half-orcs refuse to fall and hit terrifyingly hard.',
      tr: 'Güçlü ve yılmaz. Yarı-orklar düşmeyi reddeder ve korkunç sert vurur.',
    },
    bonuses: { str: 2, con: 1 },
    speed: 30,
    darkvision: 60,
    skills: ['intimidation'],
    traits: ['relentless', 'savage_attacks'],
    traitText: {
      en: 'Darkvision, Intimidation, drop to 1 HP instead of 0 once per long rest, extra die on critical hits.',
      tr: 'Karanlıkta görüş, Gözdağı, uzun dinlenme başına bir kez 0 yerine 1 HP\'de kalma, kritik vuruşta ek zar.',
    },
  },
};

export const RACE_IDS = Object.keys(RACES) as RaceId[];
