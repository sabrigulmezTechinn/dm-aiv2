import type { Ability, Loc, Skill } from '@dmai/shared';

export interface SkillDef {
  id: Skill;
  ability: Ability;
  name: Loc;
}

export const SKILLS: Record<Skill, SkillDef> = {
  acrobatics: { id: 'acrobatics', ability: 'dex', name: { en: 'Acrobatics', tr: 'Akrobasi' } },
  animal_handling: { id: 'animal_handling', ability: 'wis', name: { en: 'Animal Handling', tr: 'Hayvan Terbiyesi' } },
  arcana: { id: 'arcana', ability: 'int', name: { en: 'Arcana', tr: 'Arkana' } },
  athletics: { id: 'athletics', ability: 'str', name: { en: 'Athletics', tr: 'Atletizm' } },
  deception: { id: 'deception', ability: 'cha', name: { en: 'Deception', tr: 'Aldatma' } },
  history: { id: 'history', ability: 'int', name: { en: 'History', tr: 'Tarih' } },
  insight: { id: 'insight', ability: 'wis', name: { en: 'Insight', tr: 'Sezgi' } },
  intimidation: { id: 'intimidation', ability: 'cha', name: { en: 'Intimidation', tr: 'Gözdağı' } },
  investigation: { id: 'investigation', ability: 'int', name: { en: 'Investigation', tr: 'Araştırma' } },
  medicine: { id: 'medicine', ability: 'wis', name: { en: 'Medicine', tr: 'Tıp' } },
  nature: { id: 'nature', ability: 'int', name: { en: 'Nature', tr: 'Doğa' } },
  perception: { id: 'perception', ability: 'wis', name: { en: 'Perception', tr: 'Algı' } },
  performance: { id: 'performance', ability: 'cha', name: { en: 'Performance', tr: 'Gösteri' } },
  persuasion: { id: 'persuasion', ability: 'cha', name: { en: 'Persuasion', tr: 'İkna' } },
  religion: { id: 'religion', ability: 'int', name: { en: 'Religion', tr: 'Din' } },
  sleight_of_hand: { id: 'sleight_of_hand', ability: 'dex', name: { en: 'Sleight of Hand', tr: 'El Çabukluğu' } },
  stealth: { id: 'stealth', ability: 'dex', name: { en: 'Stealth', tr: 'Gizlilik' } },
  survival: { id: 'survival', ability: 'wis', name: { en: 'Survival', tr: 'Hayatta Kalma' } },
};

export const SKILL_IDS = Object.keys(SKILLS) as Skill[];

export function isSkill(v: string): v is Skill {
  return v in SKILLS;
}
