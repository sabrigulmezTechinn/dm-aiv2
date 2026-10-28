import type { Ability, AbilityScores, DamageType, Loc } from '@dmai/shared';

export interface MonsterAttack {
  id: string;
  name: Loc;
  toHit: number;
  damage: string;
  damageType: DamageType;
  /** Melee reach in feet. Undefined for pure ranged attacks. */
  reach?: number;
  /** [normal, long] in feet. */
  range?: [number, number];
  /** Rider effect on hit. */
  onHit?: { save: Ability; dc: number; damage?: string; damageType?: DamageType; half?: boolean; condition?: 'prone' | 'poisoned' };
}

export type MonsterTrait = 'pack_tactics' | 'nimble_escape' | 'undead_fortitude' | 'aggressive' | 'undead' | 'sunlight_sensitivity';

export interface MonsterDef {
  id: string;
  name: Loc;
  description: Loc;
  ac: number;
  hp: string;
  speed: number;
  abilities: AbilityScores;
  cr: string;
  xp: number;
  attacks: MonsterAttack[];
  /** Attack ids used in one Multiattack action. */
  multiattack?: string[];
  traits: MonsterTrait[];
  vulnerable?: DamageType[];
  resist?: DamageType[];
  immune?: DamageType[];
  /** Flee when HP falls to this fraction or below (0 = never). */
  morale: number;
  /** Preferred tactics. */
  behavior: 'melee' | 'ranged' | 'skirmisher';
  color: string;
}

const ab = (str: number, dex: number, con: number, int: number, wis: number, cha: number): AbilityScores => ({ str, dex, con, int, wis, cha });

export const MONSTERS: Record<string, MonsterDef> = Object.fromEntries(
  ([
    {
      id: 'goblin', name: { en: 'Goblin', tr: 'Goblin' },
      description: { en: 'Small, sneaky and cruel.', tr: 'Küçük, sinsi ve zalim.' },
      ac: 15, hp: '2d6', speed: 30, abilities: ab(8, 14, 10, 10, 8, 8), cr: '1/4', xp: 50,
      attacks: [
        { id: 'scimitar', name: { en: 'Scimitar', tr: 'Pala' }, toHit: 4, damage: '1d6+2', damageType: 'slashing', reach: 5 },
        { id: 'shortbow', name: { en: 'Shortbow', tr: 'Kısa Yay' }, toHit: 4, damage: '1d6+2', damageType: 'piercing', range: [80, 320] },
      ],
      traits: ['nimble_escape'], morale: 0.3, behavior: 'skirmisher', color: '#6b8e23',
    },
    {
      id: 'goblin_boss', name: { en: 'Goblin Boss', tr: 'Goblin Şefi' },
      description: { en: 'A goblin who bullied its way to the top.', tr: 'Zorbalıkla tepeye çıkmış bir goblin.' },
      ac: 17, hp: '6d6', speed: 30, abilities: ab(10, 14, 10, 10, 8, 10), cr: '1', xp: 200,
      attacks: [
        { id: 'scimitar', name: { en: 'Scimitar', tr: 'Pala' }, toHit: 4, damage: '1d6+2', damageType: 'slashing', reach: 5 },
        { id: 'javelin', name: { en: 'Javelin', tr: 'Cirit' }, toHit: 2, damage: '1d6', damageType: 'piercing', range: [30, 120] },
      ],
      multiattack: ['scimitar', 'scimitar'],
      traits: ['nimble_escape'], morale: 0.2, behavior: 'melee', color: '#556b2f',
    },
    {
      id: 'kobold', name: { en: 'Kobold', tr: 'Kobold' },
      description: { en: 'A small reptilian that fights in packs.', tr: 'Sürüyle dövüşen küçük bir sürüngen.' },
      ac: 12, hp: '2d6-2', speed: 30, abilities: ab(7, 15, 9, 8, 7, 8), cr: '1/8', xp: 25,
      attacks: [
        { id: 'dagger', name: { en: 'Dagger', tr: 'Hançer' }, toHit: 4, damage: '1d4+2', damageType: 'piercing', reach: 5 },
        { id: 'sling', name: { en: 'Sling', tr: 'Sapan' }, toHit: 4, damage: '1d4+2', damageType: 'bludgeoning', range: [30, 120] },
      ],
      traits: ['pack_tactics', 'sunlight_sensitivity'], morale: 0.4, behavior: 'skirmisher', color: '#b5651d',
    },
    {
      id: 'giant_rat', name: { en: 'Giant Rat', tr: 'Dev Sıçan' },
      description: { en: 'A filthy rat the size of a dog.', tr: 'Köpek büyüklüğünde pis bir sıçan.' },
      ac: 12, hp: '2d6', speed: 30, abilities: ab(7, 15, 11, 2, 10, 4), cr: '1/8', xp: 25,
      attacks: [{ id: 'bite', name: { en: 'Bite', tr: 'Isırık' }, toHit: 4, damage: '1d4+2', damageType: 'piercing', reach: 5 }],
      traits: ['pack_tactics'], morale: 0.3, behavior: 'melee', color: '#7a6a5a',
    },
    {
      id: 'wolf', name: { en: 'Wolf', tr: 'Kurt' },
      description: { en: 'A hungry pack hunter.', tr: 'Aç bir sürü avcısı.' },
      ac: 13, hp: '2d8+2', speed: 40, abilities: ab(12, 15, 12, 3, 12, 6), cr: '1/4', xp: 50,
      attacks: [{ id: 'bite', name: { en: 'Bite', tr: 'Isırık' }, toHit: 4, damage: '2d4+2', damageType: 'piercing', reach: 5, onHit: { save: 'str', dc: 11, condition: 'prone' } }],
      traits: ['pack_tactics'], morale: 0.25, behavior: 'melee', color: '#808080',
    },
    {
      id: 'skeleton', name: { en: 'Skeleton', tr: 'İskelet' },
      description: { en: 'Animated bones that obey dark magic.', tr: 'Karanlık büyüye itaat eden canlanmış kemikler.' },
      ac: 13, hp: '2d8+4', speed: 30, abilities: ab(10, 14, 15, 6, 8, 5), cr: '1/4', xp: 50,
      attacks: [
        { id: 'shortsword', name: { en: 'Shortsword', tr: 'Kısa Kılıç' }, toHit: 4, damage: '1d6+2', damageType: 'piercing', reach: 5 },
        { id: 'shortbow', name: { en: 'Shortbow', tr: 'Kısa Yay' }, toHit: 4, damage: '1d6+2', damageType: 'piercing', range: [80, 320] },
      ],
      traits: ['undead'], vulnerable: ['bludgeoning'], immune: ['poison'], morale: 0, behavior: 'melee', color: '#e8e4d8',
    },
    {
      id: 'zombie', name: { en: 'Zombie', tr: 'Zombi' },
      description: { en: 'A shambling corpse that will not stay down.', tr: 'Yerde kalmayı bilmeyen, sürünen bir ceset.' },
      ac: 8, hp: '3d8+9', speed: 20, abilities: ab(13, 6, 16, 3, 6, 5), cr: '1/4', xp: 50,
      attacks: [{ id: 'slam', name: { en: 'Slam', tr: 'Darbe' }, toHit: 3, damage: '1d6+1', damageType: 'bludgeoning', reach: 5 }],
      traits: ['undead', 'undead_fortitude'], immune: ['poison'], morale: 0, behavior: 'melee', color: '#5f7a5a',
    },
    {
      id: 'bandit', name: { en: 'Bandit', tr: 'Eşkıya' },
      description: { en: 'A desperate cutthroat.', tr: 'Çaresiz bir gırtlak kesen.' },
      ac: 12, hp: '2d8+2', speed: 30, abilities: ab(11, 12, 12, 10, 10, 10), cr: '1/8', xp: 25,
      attacks: [
        { id: 'scimitar', name: { en: 'Scimitar', tr: 'Pala' }, toHit: 3, damage: '1d6+1', damageType: 'slashing', reach: 5 },
        { id: 'light_crossbow', name: { en: 'Light Crossbow', tr: 'Hafif Arbalet' }, toHit: 3, damage: '1d8+1', damageType: 'piercing', range: [80, 320] },
      ],
      traits: [], morale: 0.35, behavior: 'melee', color: '#8b4513',
    },
    {
      id: 'bandit_captain', name: { en: 'Bandit Captain', tr: 'Eşkıya Reisi' },
      description: { en: 'A charismatic and ruthless leader of outlaws.', tr: 'Karizmatik ve acımasız bir haydut reisi.' },
      ac: 15, hp: '10d8+20', speed: 30, abilities: ab(15, 16, 14, 14, 11, 14), cr: '2', xp: 450,
      attacks: [
        { id: 'scimitar', name: { en: 'Scimitar', tr: 'Pala' }, toHit: 5, damage: '1d6+3', damageType: 'slashing', reach: 5 },
        { id: 'dagger', name: { en: 'Dagger', tr: 'Hançer' }, toHit: 5, damage: '1d4+3', damageType: 'piercing', reach: 5, range: [20, 60] },
      ],
      multiattack: ['scimitar', 'scimitar', 'dagger'],
      traits: [], morale: 0.15, behavior: 'melee', color: '#4a2c17',
    },
    {
      id: 'thug', name: { en: 'Thug', tr: 'Kabadayı' },
      description: { en: 'Hired muscle with a heavy mace.', tr: 'Ağır topuzlu kiralık kas.' },
      ac: 11, hp: '5d8+10', speed: 30, abilities: ab(15, 11, 14, 10, 10, 11), cr: '1/2', xp: 100,
      attacks: [{ id: 'mace', name: { en: 'Mace', tr: 'Topuz' }, toHit: 4, damage: '1d6+2', damageType: 'bludgeoning', reach: 5 }],
      multiattack: ['mace', 'mace'],
      traits: ['pack_tactics'], morale: 0.25, behavior: 'melee', color: '#704214',
    },
    {
      id: 'orc', name: { en: 'Orc', tr: 'Ork' },
      description: { en: 'A savage raider with a greataxe.', tr: 'Büyük baltalı vahşi bir yağmacı.' },
      ac: 13, hp: '2d8+6', speed: 30, abilities: ab(16, 12, 16, 7, 11, 10), cr: '1/2', xp: 100,
      attacks: [
        { id: 'greataxe', name: { en: 'Greataxe', tr: 'Büyük Balta' }, toHit: 5, damage: '1d12+3', damageType: 'slashing', reach: 5 },
        { id: 'javelin', name: { en: 'Javelin', tr: 'Cirit' }, toHit: 5, damage: '1d6+3', damageType: 'piercing', range: [30, 120] },
      ],
      traits: ['aggressive'], morale: 0.1, behavior: 'melee', color: '#4f7942',
    },
    {
      id: 'cultist', name: { en: 'Cultist', tr: 'Tarikatçı' },
      description: { en: 'A robed zealot of a dark power.', tr: 'Karanlık bir güce tapan cüppeli bir fanatik.' },
      ac: 12, hp: '2d8', speed: 30, abilities: ab(11, 12, 10, 10, 11, 10), cr: '1/8', xp: 25,
      attacks: [{ id: 'scimitar', name: { en: 'Scimitar', tr: 'Pala' }, toHit: 3, damage: '1d6+1', damageType: 'slashing', reach: 5 }],
      traits: [], morale: 0.2, behavior: 'melee', color: '#4b0082',
    },
    {
      id: 'giant_spider', name: { en: 'Giant Spider', tr: 'Dev Örümcek' },
      description: { en: 'A horse-sized spider with venomous fangs.', tr: 'At büyüklüğünde, zehirli dişli bir örümcek.' },
      ac: 14, hp: '4d10+4', speed: 30, abilities: ab(14, 16, 12, 2, 11, 4), cr: '1', xp: 200,
      attacks: [{ id: 'bite', name: { en: 'Bite', tr: 'Isırık' }, toHit: 5, damage: '1d8+3', damageType: 'piercing', reach: 5, onHit: { save: 'con', dc: 11, damage: '2d8', damageType: 'poison', half: true } }],
      traits: [], morale: 0.2, behavior: 'melee', color: '#2f2f2f',
    },
    {
      id: 'brown_bear', name: { en: 'Brown Bear', tr: 'Boz Ayı' },
      description: { en: 'A massive, territorial bear.', tr: 'Bölgesini koruyan devasa bir ayı.' },
      ac: 11, hp: '4d10+12', speed: 40, abilities: ab(19, 10, 16, 2, 13, 7), cr: '1', xp: 200,
      attacks: [
        { id: 'bite', name: { en: 'Bite', tr: 'Isırık' }, toHit: 6, damage: '1d8+4', damageType: 'piercing', reach: 5 },
        { id: 'claws', name: { en: 'Claws', tr: 'Pençeler' }, toHit: 6, damage: '2d6+4', damageType: 'slashing', reach: 5 },
      ],
      multiattack: ['bite', 'claws'],
      traits: [], morale: 0.3, behavior: 'melee', color: '#5c4033',
    },
    {
      id: 'ogre', name: { en: 'Ogre', tr: 'Ogre' },
      description: { en: 'A hulking, dim-witted brute.', tr: 'İri yarı, kalın kafalı bir canavar.' },
      ac: 11, hp: '7d10+21', speed: 40, abilities: ab(19, 8, 16, 5, 7, 7), cr: '2', xp: 450,
      attacks: [
        { id: 'greatclub', name: { en: 'Greatclub', tr: 'Büyük Sopa' }, toHit: 6, damage: '2d8+4', damageType: 'bludgeoning', reach: 5 },
        { id: 'javelin', name: { en: 'Javelin', tr: 'Cirit' }, toHit: 6, damage: '2d6+4', damageType: 'piercing', range: [30, 120] },
      ],
      traits: [], morale: 0, behavior: 'melee', color: '#8f9779',
    },
  ] satisfies MonsterDef[]).map((m) => [m.id, m]),
);

export const MONSTER_IDS = Object.keys(MONSTERS);
