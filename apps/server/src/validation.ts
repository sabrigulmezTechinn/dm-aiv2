import { z } from 'zod';
import { CLASS_IDS, RACE_IDS, SKILL_IDS } from '@dmai/rules';

const point = { x: z.number().int().min(0).max(200), y: z.number().int().min(0).max(200) };

export const combatActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('move'), ...point }),
  z.object({ kind: z.literal('attack'), targetId: z.string().max(40), weaponUid: z.string().max(60).optional() }),
  z.object({ kind: z.literal('cast'), spellId: z.string().max(40), targetId: z.string().max(40).optional() }),
  z.object({ kind: z.literal('dash') }),
  z.object({ kind: z.literal('dodge') }),
  z.object({ kind: z.literal('disengage') }),
  z.object({ kind: z.literal('use_item'), itemUid: z.string().max(60) }),
  z.object({ kind: z.literal('second_wind') }),
  z.object({ kind: z.literal('action_surge') }),
  z.object({ kind: z.literal('turn_undead') }),
  z.object({ kind: z.literal('end_turn') }),
]);

export const playerActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('begin') }),
  z.object({ type: z.literal('say'), text: z.string().min(1).max(600) }),
  z.object({ type: z.literal('choose'), choiceId: z.string().max(40) }),
  z.object({ type: z.literal('roll') }),
  z.object({ type: z.literal('move'), ...point }),
  z.object({ type: z.literal('combat'), action: combatActionSchema }),
  z.object({ type: z.literal('death_save') }),
  z.object({ type: z.literal('rest'), kind: z.enum(['short', 'long']) }),
  z.object({ type: z.literal('continue') }),
  z.object({ type: z.literal('use_item'), itemUid: z.string().max(60) }),
  z.object({ type: z.literal('cast'), spellId: z.string().max(40) }),
  z.object({ type: z.literal('equip'), itemUid: z.string().max(60) }),
]);

const score = z.number().int().min(3).max(18);
export const characterDraftSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  race: z.enum(RACE_IDS as [string, ...string[]]),
  class: z.enum(CLASS_IDS as [string, ...string[]]),
  baseAbilities: z.object({ str: score, dex: score, con: score, int: score, wis: score, cha: score }),
  skills: z.array(z.enum(SKILL_IDS as [string, ...string[]])).max(6),
});

export const newCampaignSchema = z.object({
  characterId: z.string().max(60),
  adventureId: z.string().max(60),
  difficulty: z.enum(['easy', 'hard']),
  locale: z.enum(['en', 'tr']),
});
