import type { Ability, AdvantageMode, Character, Difficulty, RollResult, Skill } from '@dmai/shared';
import { ABILITY_NAMES } from './data/abilities';
import { RACES } from './data/races';
import { SKILLS, isSkill } from './data/skills';
import { abilityMod, saveMod, skillMod } from './character';
import { roll, rollD20 } from './dice';
import type { Rng } from './rng';

export interface CheckRequest {
  kind: 'skill' | 'ability' | 'save';
  key: Skill | Ability;
  dc: number;
  advantage: AdvantageMode;
}

export function combineAdvantage(...modes: AdvantageMode[]): AdvantageMode {
  const adv = modes.includes('advantage');
  const dis = modes.includes('disadvantage');
  if (adv && !dis) return 'advantage';
  if (dis && !adv) return 'disadvantage';
  return 'none';
}

/** Easy mode lowers DCs by 2 (minimum 5). */
export function effectiveDc(dc: number, difficulty: Difficulty): number {
  return difficulty === 'easy' ? Math.max(5, dc - 2) : dc;
}

export function checkModifier(c: Character, req: Pick<CheckRequest, 'kind' | 'key'>): number {
  if (req.kind === 'save') return saveMod(c, req.key as Ability);
  if (req.kind === 'skill' && isSkill(req.key)) return skillMod(c, req.key);
  return abilityMod(c, req.key as Ability);
}

export function checkLabel(req: Pick<CheckRequest, 'kind' | 'key'>, locale: 'en' | 'tr'): string {
  if (req.kind === 'skill' && isSkill(req.key)) return SKILLS[req.key].name[locale];
  const ab = ABILITY_NAMES[req.key as Ability]?.[locale] ?? req.key;
  if (req.kind === 'save') return locale === 'tr' ? `${ab} kurtarması` : `${ab} save`;
  return locale === 'tr' ? `${ab} kontrolü` : `${ab} check`;
}

export function performCheck(
  c: Character,
  req: CheckRequest,
  difficulty: Difficulty,
  locale: 'en' | 'tr',
  rng?: Rng,
): RollResult {
  const modes: AdvantageMode[] = [req.advantage];
  if (c.conditions.some((x) => x.id === 'poisoned') && req.kind !== 'save') modes.push('disadvantage');
  let modifier = checkModifier(c, req);
  let bless = 0;
  if (req.kind === 'save' && c.conditions.some((x) => x.id === 'blessed')) {
    bless = roll('1d4', { rng }).total;
    modifier += bless;
  }
  const dc = effectiveDc(req.dc, difficulty);
  const r = rollD20({
    modifier,
    advantage: combineAdvantage(...modes),
    dc,
    dcVisible: difficulty === 'easy',
    lucky: RACES[c.race].traits.includes('lucky'),
    kind: req.kind === 'save' ? 'save' : 'check',
    label: checkLabel(req, locale) + (bless ? ` (+${bless} ${locale === 'tr' ? 'kutsama' : 'bless'})` : ''),
    actor: c.name,
    rng,
  });
  return r;
}
