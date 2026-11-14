import type { Ability, ClassId, Loc, Skill } from '@dmai/shared';

export interface ClassFeature {
  id: string;
  level: number;
  name: Loc;
  description: Loc;
}

export interface ClassDef {
  id: ClassId;
  name: Loc;
  description: Loc;
  role: Loc;
  complexity: 1 | 2 | 3;
  hitDie: number;
  primary: Ability;
  saves: Ability[];
  skillChoices: Skill[];
  skillCount: number;
  /** Starting inventory: catalog ids with quantities. First weapon is the default. */
  startingItems: { itemId: string; qty?: number; equipped?: boolean }[];
  startingGold: number;
  spellcasting?: { ability: Ability };
  /** Recommended standard-array assignment. */
  suggestedArray: Record<Ability, number>;
  features: ClassFeature[];
}

export const CLASSES: Record<ClassId, ClassDef> = {
  fighter: {
    id: 'fighter',
    name: { en: 'Fighter', tr: 'Savaşçı' },
    description: {
      en: 'A master of arms and armor who stays standing when others fall.',
      tr: 'Silah ve zırh ustası. Başkaları düşerken ayakta kalan.',
    },
    role: { en: 'Front line', tr: 'Ön saf' },
    complexity: 1,
    hitDie: 10,
    primary: 'str',
    saves: ['str', 'con'],
    skillChoices: ['acrobatics', 'animal_handling', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival'],
    skillCount: 2,
    startingItems: [
      { itemId: 'longsword', equipped: true },
      { itemId: 'chain_mail', equipped: true },
      { itemId: 'shield', equipped: true },
      { itemId: 'light_crossbow', equipped: true },
      { itemId: 'handaxe', qty: 2 },
      { itemId: 'healing_potion', qty: 1 },
      { itemId: 'torch', qty: 3 },
      { itemId: 'rations', qty: 5 },
      { itemId: 'rope' },
    ],
    startingGold: 10,
    suggestedArray: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 },
    features: [
      { id: 'fighting_style', level: 1, name: { en: 'Fighting Style: Defense', tr: 'Dövüş Tarzı: Savunma' }, description: { en: '+1 AC while wearing armor.', tr: 'Zırh giyerken +1 ZS.' } },
      { id: 'second_wind', level: 1, name: { en: 'Second Wind', tr: 'İkinci Nefes' }, description: { en: 'Bonus action: regain 1d10 + level HP. Once per short rest.', tr: 'Bonus aksiyon: 1d10 + seviye HP kazan. Kısa dinlenme başına bir kez.' } },
      { id: 'action_surge', level: 2, name: { en: 'Action Surge', tr: 'Aksiyon Atağı' }, description: { en: 'Take one additional action on your turn. Once per short rest.', tr: 'Sıranda bir ek aksiyon al. Kısa dinlenme başına bir kez.' } },
      { id: 'improved_critical', level: 3, name: { en: 'Improved Critical', tr: 'Gelişmiş Kritik' }, description: { en: 'Your weapon attacks score a critical hit on 19 or 20.', tr: 'Silah saldırıların 19 veya 20\'de kritik vurur.' } },
      { id: 'asi', level: 4, name: { en: 'Ability Score Improvement', tr: 'Yetenek Artışı' }, description: { en: '+2 Strength.', tr: '+2 Güç.' } },
      { id: 'extra_attack', level: 5, name: { en: 'Extra Attack', tr: 'Ek Saldırı' }, description: { en: 'Attack twice when you take the Attack action.', tr: 'Saldırı aksiyonunda iki kez saldır.' } },
    ],
  },
  rogue: {
    id: 'rogue',
    name: { en: 'Rogue', tr: 'Haydut' },
    description: {
      en: 'A cunning scoundrel who strikes where it hurts and slips away unseen.',
      tr: 'Acıtan yerden vuran ve görünmeden sıvışan kurnaz bir düzenbaz.',
    },
    role: { en: 'Skills and precision', tr: 'Beceri ve isabet' },
    complexity: 2,
    hitDie: 8,
    primary: 'dex',
    saves: ['dex', 'int'],
    skillChoices: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleight_of_hand', 'stealth'],
    skillCount: 4,
    startingItems: [
      { itemId: 'shortsword', equipped: true },
      { itemId: 'shortbow', equipped: true },
      { itemId: 'dagger', qty: 2 },
      { itemId: 'leather', equipped: true },
      { itemId: 'thieves_tools' },
      { itemId: 'healing_potion', qty: 1 },
      { itemId: 'torch', qty: 3 },
      { itemId: 'rations', qty: 5 },
      { itemId: 'crowbar' },
    ],
    startingGold: 15,
    suggestedArray: { str: 8, dex: 15, con: 13, int: 12, wis: 10, cha: 14 },
    features: [
      { id: 'sneak_attack', level: 1, name: { en: 'Sneak Attack', tr: 'Sinsi Saldırı' }, description: { en: 'Once per turn, extra damage when you have advantage or an ally is next to the target.', tr: 'Sıra başına bir kez, avantajın varsa veya hedefin yanında bir müttefik varsa ek hasar.' } },
      { id: 'expertise', level: 1, name: { en: 'Expertise', tr: 'Uzmanlık' }, description: { en: 'Double proficiency in your first two chosen skills.', tr: 'Seçtiğin ilk iki beceride iki kat yeterlilik.' } },
      { id: 'cunning_action', level: 2, name: { en: 'Cunning Action', tr: 'Kurnaz Hamle' }, description: { en: 'Dash or Disengage as a bonus action.', tr: 'Koşma veya Geri Çekilmeyi bonus aksiyonla yap.' } },
      { id: 'asi', level: 4, name: { en: 'Ability Score Improvement', tr: 'Yetenek Artışı' }, description: { en: '+2 Dexterity.', tr: '+2 Çeviklik.' } },
      { id: 'uncanny_dodge', level: 5, name: { en: 'Uncanny Dodge', tr: 'Tekinsiz Kaçış' }, description: { en: 'Use your reaction to halve the damage of an attack that hits you.', tr: 'Sana isabet eden bir saldırının hasarını tepkinle yarıya indir.' } },
    ],
  },
  wizard: {
    id: 'wizard',
    name: { en: 'Wizard', tr: 'Büyücü' },
    description: {
      en: 'A scholar of the arcane who bends reality with words of power.',
      tr: 'Kudret sözcükleriyle gerçekliği büken bir arkan bilgini.',
    },
    role: { en: 'Ranged magic', tr: 'Menzilli büyü' },
    complexity: 3,
    hitDie: 6,
    primary: 'int',
    saves: ['int', 'wis'],
    skillChoices: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'],
    skillCount: 2,
    startingItems: [
      { itemId: 'quarterstaff', equipped: true },
      { itemId: 'dagger', qty: 1 },
      { itemId: 'spellbook' },
      { itemId: 'healing_potion', qty: 1 },
      { itemId: 'torch', qty: 3 },
      { itemId: 'rations', qty: 5 },
    ],
    startingGold: 10,
    spellcasting: { ability: 'int' },
    suggestedArray: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 },
    features: [
      { id: 'spellcasting', level: 1, name: { en: 'Spellcasting', tr: 'Büyü Yapma' }, description: { en: 'Cast wizard spells using Intelligence.', tr: 'Zekâ ile büyücü büyüleri yap.' } },
      { id: 'arcane_recovery', level: 1, name: { en: 'Arcane Recovery', tr: 'Arkan Toparlanma' }, description: { en: 'Recover a spell slot on a short rest once per day.', tr: 'Günde bir kez kısa dinlenmede bir büyü yuvası geri kazan.' } },
      { id: 'asi', level: 4, name: { en: 'Ability Score Improvement', tr: 'Yetenek Artışı' }, description: { en: '+2 Intelligence.', tr: '+2 Zekâ.' } },
    ],
  },
  cleric: {
    id: 'cleric',
    name: { en: 'Cleric', tr: 'Rahip' },
    description: {
      en: 'A champion of a god of life who heals allies and smites the undead.',
      tr: 'Yaşam tanrısının savunucusu. Müttefiklerini iyileştirir, ölümsüzleri cezalandırır.',
    },
    role: { en: 'Healer and support', tr: 'Şifacı ve destek' },
    complexity: 2,
    hitDie: 8,
    primary: 'wis',
    saves: ['wis', 'cha'],
    skillChoices: ['history', 'insight', 'medicine', 'persuasion', 'religion'],
    skillCount: 2,
    startingItems: [
      { itemId: 'mace', equipped: true },
      { itemId: 'scale_mail', equipped: true },
      { itemId: 'shield', equipped: true },
      { itemId: 'light_crossbow', equipped: true },
      { itemId: 'holy_symbol' },
      { itemId: 'healing_potion', qty: 1 },
      { itemId: 'torch', qty: 3 },
      { itemId: 'rations', qty: 5 },
    ],
    startingGold: 15,
    spellcasting: { ability: 'wis' },
    suggestedArray: { str: 14, dex: 10, con: 13, int: 8, wis: 15, cha: 12 },
    features: [
      { id: 'spellcasting', level: 1, name: { en: 'Spellcasting', tr: 'Büyü Yapma' }, description: { en: 'Cast cleric spells using Wisdom.', tr: 'Bilgelik ile rahip büyüleri yap.' } },
      { id: 'disciple_of_life', level: 1, name: { en: 'Disciple of Life', tr: 'Yaşamın Müridi' }, description: { en: 'Healing spells restore extra HP equal to 2 + spell level.', tr: 'İyileştirme büyüleri 2 + büyü seviyesi kadar ek HP yeniler.' } },
      { id: 'turn_undead', level: 2, name: { en: 'Turn Undead', tr: 'Ölümsüzleri Kovma' }, description: { en: 'Undead nearby must flee. Once per short rest.', tr: 'Yakındaki ölümsüzler kaçmak zorunda kalır. Kısa dinlenme başına bir kez.' } },
      { id: 'asi', level: 4, name: { en: 'Ability Score Improvement', tr: 'Yetenek Artışı' }, description: { en: '+2 Wisdom.', tr: '+2 Bilgelik.' } },
      { id: 'destroy_undead', level: 5, name: { en: 'Destroy Undead', tr: 'Ölümsüzleri Yok Et' }, description: { en: 'Weak undead are destroyed outright by Turn Undead.', tr: 'Zayıf ölümsüzler Kovma ile anında yok olur.' } },
    ],
  },
};

export const CLASS_IDS = Object.keys(CLASSES) as ClassId[];

/** Full caster spell slots by character level (index 0 = slot level 1). */
export const FULL_CASTER_SLOTS: Record<number, number[]> = {
  1: [2],
  2: [3],
  3: [4, 2],
  4: [4, 3],
  5: [4, 3, 2],
};

export const XP_THRESHOLDS = [0, 300, 900, 2700, 6500];
export const MAX_LEVEL = 5;

export function proficiencyBonus(level: number): number {
  return level >= 5 ? 3 : 2;
}
