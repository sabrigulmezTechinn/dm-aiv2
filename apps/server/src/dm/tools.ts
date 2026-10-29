import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { Character, ConditionId, RollResult, SceneKind, TurnEvent } from '@dmai/shared';
import { ABILITIES, uid } from '@dmai/shared';
import {
  ITEMS,
  MONSTERS,
  SKILL_IDS,
  addItem,
  awardXp,
  damageCharacter,
  damageTypeName,
  getItem,
  healCharacter,
  isValidDice,
  itemName,
  longRest,
  removeItem,
  roll,
  shortRest,
  startCombat,
  endCombat as rulesEndCombat,
  type Rng,
} from '@dmai/rules';
import { generateMap, emptyExplored, MapGrid } from '@dmai/mapgen';
import type { Adventure } from '../adventures';
import { sx } from '../i18n';
import { addLog, combatCtx, enterScene, occupied, placeNpc, refreshVision, type CampaignState } from '../game/state';

export interface TurnCtx {
  state: CampaignState;
  character: Character;
  adventure: Adventure;
  emit: (e: TurnEvent) => void;
  emitState: () => void;
  rng?: Rng;
}

export interface ToolOutcome {
  content: string;
  isError?: boolean;
}

const DAMAGE_TYPES = ['slashing', 'piercing', 'bludgeoning', 'fire', 'cold', 'radiant', 'necrotic', 'poison', 'force', 'acid', 'lightning', 'thunder', 'psychic'] as const;
const SCENE_KINDS = ['tavern', 'dungeon', 'cellar', 'cave', 'battlefield', 'outdoor', 'town'] as const;
const CHECK_KEYS = [...SKILL_IDS, ...ABILITIES] as [string, ...string[]];
const dice = z.string().max(30).refine(isValidDice, 'invalid dice expression, use e.g. "2d6+1"');

export const schemas = {
  present_choices: z.object({
    narration: z.string().min(1).max(4000).describe('Everything the player reads this turn, in the campaign language. Second person, present tense.'),
    choices: z
      .array(
        z.object({
          id: z.string().min(1).max(40).describe('Short slug, e.g. "bribe_guard".'),
          label: z.string().min(1).max(80).describe('What the player sees on the button, in the campaign language.'),
          skill: z.enum(CHECK_KEYS).optional().describe('Skill or ability the option will likely test, if any.'),
          consequence: z.string().min(1).max(400).describe('SECRET note for yourself (English): what this option will really lead to, including costs or traps. Never shown to the player.'),
        }),
      )
      .max(4)
      .describe('0 to 4 suggested actions. Not every option is good. Use [] when the situation is open-ended.'),
  }),
  request_check: z.object({
    narration: z.string().min(1).max(4000).describe('Narration leading up to the roll, in the campaign language. Do not state the outcome.'),
    kind: z.enum(['skill', 'ability', 'save']),
    key: z.enum(CHECK_KEYS).describe('Skill id for kind=skill, ability id (str, dex, con, int, wis, cha) for ability/save.'),
    dc: z.number().int().min(5).max(30),
    advantage: z.enum(['none', 'advantage', 'disadvantage']).optional(),
    reason: z.string().min(1).max(80).describe('Very short label for the roll button in the campaign language, e.g. "Climb the wall".'),
  }),
  start_combat: z.object({
    enemies: z.array(z.object({ monster_id: z.enum(Object.keys(MONSTERS) as [string, ...string[]]), count: z.number().int().min(1).max(6), name: z.string().max(40).optional() })).min(1).max(4),
    surprise: z.enum(['party', 'enemies', 'none']).optional().describe('"party" if the player ambushes, "enemies" if the player is ambushed.'),
  }),
  end_combat: z.object({
    outcome: z.enum(['enemies_fled', 'enemies_surrendered', 'truce', 'player_escaped']),
    note: z.string().max(300).optional(),
  }),
  apply_damage: z.object({ dice, damage_type: z.enum(DAMAGE_TYPES), reason: z.string().max(120) }),
  heal_player: z.object({ dice, reason: z.string().max(120) }),
  give_item: z.object({
    item_id: z.enum(['custom', ...Object.keys(ITEMS)] as [string, ...string[]]).describe('Catalog id, or "custom" for a unique story item.'),
    name: z.string().max(60).optional().describe('Required for custom items, in the campaign language.'),
    description: z.string().max(200).optional(),
    quantity: z.number().int().min(1).max(20).optional(),
  }),
  take_item: z.object({ item: z.string().min(1).max(60).describe('Catalog id, inventory uid, or custom item name.'), quantity: z.number().int().min(1).max(20).optional() }),
  adjust_gold: z.object({ amount: z.number().int().min(-1000).max(1000), reason: z.string().max(120) }),
  award_xp: z.object({ amount: z.number().int().min(1).max(2000), reason: z.string().max(120).describe('Short reason in the campaign language.') }),
  update_npc: z.object({
    id: z.string().max(40).optional().describe('Existing NPC id. Omit to create a new NPC.'),
    name: z.string().min(1).max(60),
    description: z.string().max(300).optional().describe('In the campaign language.'),
    attitude: z.number().int().min(-3).max(3).optional().describe('-3 hostile ... 0 neutral ... +3 devoted.'),
    note: z.string().max(300).optional().describe('What happened with this NPC, in the campaign language. Shown in the journal.'),
    present: z.boolean().optional().describe('Whether the NPC is in the current scene (shown on the map).'),
    alive: z.boolean().optional(),
    place_near: z.string().max(40).optional().describe('Map anchor name to stand near, e.g. "fireplace", "bar", "entrance".'),
  }),
  update_quest: z.object({
    id: z.string().max(40).optional(),
    title: z.string().max(100).optional().describe('In the campaign language.'),
    status: z.enum(['active', 'completed', 'failed']).optional(),
    note: z.string().max(300).optional().describe('In the campaign language.'),
  }),
  record_fact: z.object({ text: z.string().min(1).max(300).describe('A consequence or decision worth remembering, in the campaign language.'), importance: z.enum(['minor', 'major']).optional() }),
  change_scene: z.object({
    scene_id: z.string().max(40).optional().describe('An adventure scene id. Omit to improvise a new location.'),
    name: z.string().max(60).optional().describe('For improvised scenes, in the campaign language.'),
    kind: z.enum(SCENE_KINDS).optional().describe('For improvised scenes. tavern/dungeon/cellar/cave get a map; outdoor/town show a scene card.'),
    description: z.string().max(400).optional(),
  }),
  rest: z.object({ kind: z.enum(['short', 'long']), allowed: z.boolean(), reason: z.string().max(200) }),
  apply_condition: z.object({ condition: z.enum(['poisoned', 'prone', 'frightened']), add: z.boolean(), rounds: z.number().int().min(1).max(100).optional() }),
  end_adventure: z.object({ outcome: z.enum(['victory', 'defeat']), epilogue: z.string().min(1).max(3000).describe('Closing narration in the campaign language.') }),
};

export type ToolName = keyof typeof schemas;
export const PAUSING_TOOLS: ToolName[] = ['present_choices', 'request_check'];

const DESCRIPTIONS: Record<ToolName, string> = {
  present_choices:
    'Ends your turn. Delivers the narration the player reads and up to 4 suggested actions. Call it exactly once, as the last tool call of every reply (unless you call request_check or end_adventure instead). The player can always type a free action instead of picking an option.',
  request_check:
    'Ends your turn and asks the player to roll a d20 ability check, skill check or saving throw. Use when the outcome is uncertain and failure is interesting. You receive the result as the tool result on the next turn; then narrate the consequence.',
  start_combat:
    'Starts a turn-based fight. The rules engine places the monsters on the map, rolls initiative and runs every attack. You only narrate. Use monster ids from the bestiary.',
  end_combat: 'Ends the current fight early for a story reason (enemies flee or surrender, truce, the player escapes).',
  apply_damage: 'Damages the player outside combat (traps, falls, poison). The engine rolls the dice. Never use this for combat attacks.',
  heal_player: 'Heals the player outside combat (a healer, a blessing). The engine rolls the dice.',
  give_item: 'Adds an item to the player inventory. Use catalog ids when one fits, "custom" for unique story items.',
  take_item: 'Removes an item from the player inventory (used, stolen, handed over).',
  adjust_gold: 'Adds or removes gold (rewards, purchases, bribes). The engine refuses if the player cannot pay.',
  award_xp: 'Awards experience points for defeating foes outside the engine, clever solutions, milestones or roleplay. Combat XP is awarded automatically.',
  update_npc: 'Creates or updates an NPC in campaign memory: attitude toward the player, what happened, whether they are present, alive. Call it whenever an NPC is met or their attitude changes.',
  update_quest: 'Creates or updates a quest in the player journal.',
  record_fact: 'Records an important consequence or decision so it is never forgotten (closed doors, broken promises, reputations).',
  change_scene: 'Moves the player to another location. Adventure scenes load their NPCs and map. Use the exits listed for the current scene.',
  rest: 'Answers a rest request. Set allowed=false if the place is unsafe (and narrate why). A long rest restores everything.',
  apply_condition: 'Adds or removes a condition on the player outside combat.',
  end_adventure: 'Ends the adventure with an epilogue. Use only when the story reaches its conclusion or the character dies.',
};

export function toolDefinitions(): Anthropic.Beta.Messages.BetaToolUnion[] {
  return (Object.keys(schemas) as ToolName[]).map((name) => {
    const json = z.toJSONSchema(schemas[name], { target: 'draft-2020-12' }) as Record<string, unknown>;
    delete json.$schema;
    return {
      name,
      description: DESCRIPTIONS[name],
      input_schema: json as Anthropic.Beta.Messages.BetaTool.InputSchema,
      eager_input_streaming: true,
    };
  });
}

// ---------------------------------------------------------------------------
// Handlers

function logRolls(ctx: TurnCtx, rolls: RollResult[]) {
  for (const r of rolls) {
    ctx.emit({ type: 'roll', roll: r });
    addLog(ctx.state, { kind: 'roll', roll: r });
  }
}

function sys(ctx: TurnCtx, text: string, tone: 'info' | 'good' | 'bad' = 'info') {
  addLog(ctx.state, { kind: 'system', text, tone });
}

function charSummary(c: Character): string {
  return `HP ${c.hp}/${c.maxHp}, gold ${c.gold}, level ${c.level}, XP ${c.xp}`;
}

export function handleDeath(ctx: TurnCtx, cause: string, log = true): void {
  const { state, character } = ctx;
  character.status = 'dead';
  character.hp = 0;
  character.activeCampaignId = null;
  character.epitaph = `${ctx.adventure.title[state.locale]} — ${cause}`;
  state.status = 'defeat';
  state.combat = null;
  state.pending = null;
  // The combat engine already logs its own death line.
  if (log) sys(ctx, sx(state.locale, 'died', { name: character.name }), 'bad');
}

type Handler<K extends ToolName> = (input: z.infer<(typeof schemas)[K]>, ctx: TurnCtx) => ToolOutcome;

const handlers: { [K in Exclude<ToolName, 'present_choices' | 'request_check'>]: Handler<K> } = {
  start_combat(input, ctx) {
    const { state, character } = ctx;
    if (state.combat) return { content: 'A fight is already in progress.', isError: true };
    if (!state.map) {
      const map = generateMap({ kind: 'battlefield', seed: (state.seed + state.turn * 7919) % 2147483647 || 1, id: `map_fight_${state.turn}` });
      state.map = map;
      state.explored = emptyExplored(map);
      state.playerPos = { ...map.spawn };
      state.combatOnlyMap = true;
    }
    if (!state.playerPos) state.playerPos = { ...state.map.spawn };
    refreshVision(state, character);
    const occ = occupied(state);
    occ.delete(`${state.playerPos.x},${state.playerPos.y}`);
    const cctx = combatCtx(state, character);
    cctx.rng = ctx.rng;
    const { state: combat, result } = startCombat(cctx, {
      enemies: input.enemies.map((e) => ({ monsterId: e.monster_id, count: e.count, name: e.name })),
      playerPos: state.playerPos,
      occupied: occ,
      surprise: input.surprise === 'none' ? undefined : input.surprise,
    });
    state.combat = combat;
    sys(ctx, sx(state.locale, 'combatStart'), 'bad');
    logRolls(ctx, result.rolls);
    for (const e of result.events) sys(ctx, e);
    const foes = Object.values(combat.combatants)
      .filter((c) => c.team === 'enemy')
      .map((c) => `${c.name} [${c.id}] ${MONSTERS[c.refId]?.name.en} HP ${c.hp}`)
      .join('; ');
    combat.pendingEvents = [];
    if (result.outcome) {
      const instruction = applyCombatOutcome(ctx, result.outcome, result.xp ?? 0);
      ctx.emitState();
      return { content: `Combat started and the enemies acted first. Events: ${result.events.join(' ')} ${instruction}` };
    }
    ctx.emitState();
    return {
      content: `Combat started. Enemies: ${foes}. Events so far: ${result.events.join(' ')} It is now the player's turn. Narrate the opening moment of the fight in 1-3 sentences inside present_choices with an empty choices list. Do not describe attacks or damage; the engine handles them.`,
    };
  },
  end_combat(input, ctx) {
    const { state, character } = ctx;
    if (!state.combat || !state.map) return { content: 'No fight in progress.', isError: true };
    const res = rulesEndCombat(state.combat, combatCtx(state, character));
    const xp = input.outcome === 'player_escaped' ? 0 : res.xp ?? 0;
    finishCombat(ctx, xp);
    return { content: `Combat ended (${input.outcome}). ${xp ? `Awarded ${xp} XP. ` : ''}${charSummary(character)}.` };
  },
  apply_damage(input, ctx) {
    const { state, character } = ctx;
    const r = roll(input.dice, { rng: ctx.rng, kind: 'damage', label: input.reason, actor: character.name });
    logRolls(ctx, [r]);
    const out = damageCharacter(character, r.total, { massiveDamage: state.difficulty === 'hard' });
    sys(ctx, sx(state.locale, 'damage', { n: r.total, type: damageTypeName(input.damage_type, state.locale), reason: input.reason }), 'bad');
    if (character.status === 'dead') {
      handleDeath(ctx, input.reason);
      return { content: `The player took ${r.total} damage and DIED (massive damage). Narrate the death, then call end_adventure with outcome "defeat".` };
    }
    if (out.dropped) {
      character.hp = 1;
      character.conditions = character.conditions.filter((c) => c.id !== 'unconscious' && c.id !== 'stable');
      sys(ctx, sx(state.locale, 'blackout'), 'bad');
      return { content: `The player took ${r.total} damage, dropped to 0 HP and blacked out. They come to later with 1 HP. Narrate what happened while they were out (time passes, a cost).` };
    }
    return { content: `The player took ${r.total} ${input.damage_type} damage. Now ${charSummary(character)}.` };
  },
  heal_player(input, ctx) {
    const { state, character } = ctx;
    const r = roll(input.dice, { rng: ctx.rng, kind: 'heal', label: input.reason, actor: character.name });
    logRolls(ctx, [r]);
    const gained = healCharacter(character, r.total);
    sys(ctx, sx(state.locale, 'heal', { n: gained }), 'good');
    return { content: `Healed ${gained}. Now ${charSummary(character)}.` };
  },
  give_item(input, ctx) {
    const { state, character } = ctx;
    if (input.item_id === 'custom' && !input.name) return { content: 'Custom items need a name.', isError: true };
    const qty = input.quantity ?? 1;
    const item = addItem(character, input.item_id, qty, input.item_id === 'custom' ? { name: input.name!, description: input.description } : undefined);
    sys(ctx, sx(state.locale, 'gotItem', { item: itemName(item, state.locale), n: qty }), 'good');
    return { content: `Added ${qty}x ${input.item_id === 'custom' ? input.name : input.item_id} (uid ${item.uid}).` };
  },
  take_item(input, ctx) {
    const { state, character } = ctx;
    const inv = character.inventory.find((i) => i.uid === input.item || i.itemId === input.item || i.name?.toLowerCase() === input.item.toLowerCase());
    if (!inv) return { content: `The player does not have "${input.item}". Inventory: ${character.inventory.map((i) => `${i.itemId === 'custom' ? i.name : i.itemId} x${i.qty}`).join(', ')}`, isError: true };
    const label = itemName(inv, state.locale);
    const n = removeItem(character, inv.uid, input.quantity ?? 1);
    sys(ctx, sx(state.locale, 'lostItem', { item: label, n }), 'bad');
    return { content: `Removed ${n}x ${label}.` };
  },
  adjust_gold(input, ctx) {
    const { state, character } = ctx;
    if (character.gold + input.amount < 0) return { content: `The player only has ${character.gold} gold and cannot pay ${-input.amount}.`, isError: true };
    character.gold += input.amount;
    sys(ctx, sx(state.locale, 'gold', { sign: input.amount >= 0 ? '+' : '', n: input.amount, total: character.gold }), input.amount >= 0 ? 'good' : 'info');
    return { content: `Gold is now ${character.gold}.` };
  },
  award_xp(input, ctx) {
    const { state, character } = ctx;
    const lv = awardXp(character, input.amount);
    sys(ctx, sx(state.locale, 'xp', { n: input.amount, reason: input.reason }), 'good');
    if (lv) sys(ctx, sx(state.locale, 'levelUp', { n: lv.to, hp: lv.hpGained }), 'good');
    return { content: `XP awarded. ${lv ? `LEVEL UP to ${lv.to} (new features: ${lv.newFeatures.join(', ') || 'none'}). ` : ''}${charSummary(character)}.` };
  },
  update_npc(input, ctx) {
    const { state } = ctx;
    let npc = input.id ? state.npcs[input.id] : Object.values(state.npcs).find((n) => n.name.toLowerCase() === input.name.toLowerCase());
    if (!npc) {
      const id = input.id && !state.npcs[input.id] ? input.id : `npc_${uid('')}`;
      npc = { id, name: input.name, description: input.description ?? '', attitude: input.attitude ?? 0, notes: [], present: input.present ?? true, alive: true };
      state.npcs[id] = npc;
    }
    npc.known = true;
    npc.name = input.name;
    if (input.description) npc.description = input.description;
    if (input.attitude !== undefined) npc.attitude = input.attitude;
    if (input.note) npc.notes.push(input.note);
    if (input.alive !== undefined) npc.alive = input.alive;
    if (input.present !== undefined) npc.present = input.present;
    if (npc.present && state.map && (npc.x === undefined || input.place_near)) placeNpc(state, npc, input.place_near);
    if (!npc.present) {
      delete npc.x;
      delete npc.y;
    }
    return { content: `NPC ${npc.name} [${npc.id}] attitude ${npc.attitude}, present ${npc.present}, alive ${npc.alive}.` };
  },
  update_quest(input, ctx) {
    const { state } = ctx;
    let q = input.id ? state.quests[input.id] : undefined;
    if (!q) {
      if (!input.title) return { content: 'New quests need a title.', isError: true };
      const id = input.id ?? `q_${uid('')}`;
      q = { id, title: input.title, status: 'active', notes: [] };
      state.quests[id] = q;
      sys(ctx, sx(state.locale, 'questNew', { t: q.title }), 'good');
    }
    if (input.title) q.title = input.title;
    if (input.note) q.notes.push(input.note);
    if (input.status && input.status !== q.status) {
      q.status = input.status;
      if (q.status === 'completed') sys(ctx, sx(state.locale, 'questDone', { t: q.title }), 'good');
      if (q.status === 'failed') sys(ctx, sx(state.locale, 'questFailed', { t: q.title }), 'bad');
    }
    return { content: `Quest [${q.id}] "${q.title}" is ${q.status}.` };
  },
  record_fact(input, ctx) {
    ctx.state.facts.push({ id: uid('f'), text: input.text, importance: input.importance ?? 'minor', turn: ctx.state.turn });
    return { content: 'Recorded.' };
  },
  change_scene(input, ctx) {
    const { state, character, adventure } = ctx;
    if (state.combat) return { content: 'Cannot change scene during combat. End the combat first.', isError: true };
    const def = input.scene_id ? adventure.scenes[input.scene_id] : undefined;
    if (input.scene_id && !def && !input.kind) return { content: `Unknown scene "${input.scene_id}". Known scenes: ${Object.keys(adventure.scenes).join(', ')}. To improvise, give name and kind.`, isError: true };
    const id = def ? def.id : input.scene_id ?? `scene_${uid('')}`;
    enterScene(state, character, adventure, id, def ? undefined : { name: input.name ?? id, kind: (input.kind ?? 'outdoor') as SceneKind, description: input.description ?? '' });
    sys(ctx, sx(state.locale, 'sceneChange', { name: state.scene.name }));
    ctx.emitState();
    return { content: `Now at "${state.scene.name}" (${state.scene.kind}). ${state.map ? 'A map was generated; see the <map> block next turn.' : 'No map (open area).'} NPCs present: ${Object.values(state.npcs).filter((n) => n.present).map((n) => `${n.name} [${n.id}]`).join(', ') || 'none'}. Exits: ${def?.exits.join(', ') ?? 'improvise'}.` };
  },
  rest(input, ctx) {
    const { state, character } = ctx;
    if (!input.allowed) {
      sys(ctx, sx(state.locale, 'restDenied'));
      return { content: 'Rest denied.' };
    }
    if (state.combat) return { content: 'Cannot rest during combat.', isError: true };
    if (input.kind === 'short') {
      const r = shortRest(character, ctx.rng);
      sys(ctx, sx(state.locale, 'restShort', { hp: r.hpGained }), 'good');
    } else {
      longRest(character);
      sys(ctx, sx(state.locale, 'restLong'), 'good');
    }
    return { content: `Rested (${input.kind}). ${charSummary(character)}.` };
  },
  apply_condition(input, ctx) {
    const { character } = ctx;
    const id = input.condition as ConditionId;
    character.conditions = character.conditions.filter((c) => c.id !== id);
    if (input.add) character.conditions.push(input.rounds ? { id, rounds: input.rounds } : { id });
    return { content: `Condition ${id} ${input.add ? 'added' : 'removed'}.` };
  },
  end_adventure(input, ctx) {
    const { state, character } = ctx;
    state.status = input.outcome === 'victory' ? 'victory' : 'defeat';
    state.ending = input.epilogue;
    state.pending = null;
    if (character.status === 'alive') character.activeCampaignId = null;
    sys(ctx, sx(state.locale, input.outcome === 'victory' ? 'victory' : 'defeat'), input.outcome === 'victory' ? 'good' : 'bad');
    return { content: 'The adventure has ended. Do not call any more tools.' };
  },
};

/**
 * Applies the end of a fight (victory, death or capture) and returns the
 * instruction the DM should follow when narrating it.
 */
export function applyCombatOutcome(ctx: TurnCtx, outcome: 'victory' | 'death' | 'captured' | 'ended', xp: number): string {
  const { state, character } = ctx;
  if (outcome === 'death') {
    handleDeath(ctx, state.locale === 'tr' ? 'savaşta düştü' : 'fell in battle', false);
    return 'The player character DIED. Narrate a dignified death scene, then call end_adventure with outcome "defeat" and a short epilogue.';
  }
  if (outcome === 'captured') {
    finishCombat(ctx, 0);
    character.hp = 1;
    character.conditions = character.conditions.filter((c) => c.id !== 'unconscious' && c.id !== 'stable');
    character.deathSaves = { successes: 0, failures: 0 };
    sys(ctx, sx(state.locale, 'captured'), 'bad');
    state.facts.push({ id: uid('f'), text: state.locale === 'tr' ? 'Kahraman yenildi ve düşmanların eline düştü.' : 'The hero was defeated and fell into enemy hands.', importance: 'major', turn: state.turn });
    return 'The character fell and the enemies won, but the character survived (now 1 HP). Decide what the enemies do: capture, rob (use take_item / adjust_gold), or leave them for dead. Narrate waking up and offer choices. The story continues with a cost.';
  }
  finishCombat(ctx, xp);
  return 'The fight is over: VICTORY. Narrate the aftermath in a few sentences and offer choices (search the bodies, move on, tend wounds...).';
}

/** Clears combat state and returns to exploration. */
export function finishCombat(ctx: TurnCtx, xp: number): void {
  const { state, character } = ctx;
  if (state.combat) {
    const pc = Object.values(state.combat.combatants).find((c) => c.kind === 'player');
    if (pc && !state.combatOnlyMap) state.playerPos = { x: pc.x, y: pc.y };
  }
  state.combat = null;
  character.conditions = character.conditions.filter((x) => !['dodging', 'disengaged', 'blessed', 'spirit_guardians', 'shielded', 'prone'].includes(x.id));
  sys(ctx, sx(state.locale, 'combatEnd'), 'good');
  if (xp > 0) {
    const lv = awardXp(character, xp);
    sys(ctx, sx(state.locale, 'xp', { n: xp, reason: state.locale === 'tr' ? 'savaş' : 'combat' }), 'good');
    if (lv) sys(ctx, sx(state.locale, 'levelUp', { n: lv.to, hp: lv.hpGained }), 'good');
  }
  if (state.combatOnlyMap) {
    state.map = null;
    state.explored = null;
    state.playerPos = null;
    state.combatOnlyMap = false;
  } else refreshVision(state, character);
}

export function runTool(name: string, rawInput: unknown, ctx: TurnCtx): ToolOutcome {
  const schema = schemas[name as ToolName];
  if (!schema) return { content: `Unknown tool ${name}.`, isError: true };
  const parsed = schema.safeParse(rawInput);
  if (!parsed.success) return { content: `Invalid input: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`, isError: true };
  const h = (handlers as Record<string, Handler<ToolName>>)[name];
  if (!h) return { content: `Tool ${name} cannot be run directly.`, isError: true };
  try {
    return h(parsed.data as never, ctx);
  } catch (err) {
    return { content: `Tool failed: ${(err as Error).message}`, isError: true };
  }
}

export function parsePausing(name: string, rawInput: unknown) {
  if (name === 'present_choices') return schemas.present_choices.safeParse(rawInput);
  if (name === 'request_check') return schemas.request_check.safeParse(rawInput);
  return null;
}

export function catalogLine(): string {
  return Object.values(ITEMS)
    .map((i) => i.id)
    .join(', ');
}

export function bestiaryLines(): string {
  return Object.values(MONSTERS)
    .map((m) => `${m.id}: ${m.name.en}, CR ${m.cr}, AC ${m.ac}, HP ~${m.hp}, ${m.description.en}`)
    .join('\n');
}

export { getItem, MapGrid };
