import Anthropic from '@anthropic-ai/sdk';
import type { Character, CombatAction, PlayerAction, TurnEvent } from '@dmai/shared';
import { uid } from '@dmai/shared';
import {
  CLASSES,
  castOutOfCombat,
  checkLabel,
  createCharacter,
  effectiveDc,
  naturalD20,
  needsDeathSave,
  performCheck,
  playerAction,
  rollDeathSave,
  toggleEquip,
  useConsumable,
  itemName,
  type CombatResult,
  type Rng,
} from '@dmai/rules';
import { openDoorsOnPath, walkPath } from '@dmai/mapgen';
import type { Store } from '../db';
import { getAdventure, type Adventure } from '../adventures';
import { sx } from '../i18n';
import type { ModelClient } from '../dm/model';
import { PAUSING_TOOLS, applyCombatOutcome, parsePausing, runTool, toolDefinitions, type TurnCtx } from '../dm/tools';
import { setupMessage, stateBlock, systemPrompt } from '../dm/prompt';
import { addLog, combatCtx, createCampaignState, occupied, refreshVision, toView, type CampaignState, type ToolResult, type Transcript } from './state';

export class GameError extends Error {
  constructor(public code: string, message?: string, public status = 400) {
    super(message ?? code);
  }
}

type Emit = (e: TurnEvent) => void;
type ContentParam = Anthropic.Beta.Messages.BetaContentBlockParam;

const MAX_DM_ITERATIONS = 8;

export class GameEngine {
  private locks = new Map<string, Promise<unknown>>();
  private busy = new Set<string>();
  private system = systemPrompt();
  private tools = toolDefinitions();

  constructor(private store: Store, private model: ModelClient, private rng?: Rng) {}

  // -------------------------------------------------------------------------
  // Characters and campaigns

  createCharacter(userId: string, draft: Parameters<typeof createCharacter>[1]): Character {
    const c = createCharacter(userId, draft);
    this.store.saveCharacter(c);
    return c;
  }

  createCampaign(userId: string, params: { characterId: string; adventureId: string; difficulty: 'easy' | 'hard'; locale: 'en' | 'tr' }) {
    const character = this.store.getCharacter(params.characterId);
    if (!character || character.userId !== userId) throw new GameError('character_not_found', undefined, 404);
    if (character.status !== 'alive') throw new GameError('character_dead');
    if (character.activeCampaignId) {
      const existing = this.store.getCampaign(character.activeCampaignId);
      if (existing && existing.state.status === 'active') throw new GameError('character_busy');
    }
    const adventure = getAdventure(params.adventureId);
    if (!adventure) throw new GameError('adventure_not_found', undefined, 404);
    const state = createCampaignState({ userId, character, adventure, difficulty: params.difficulty, locale: params.locale });
    character.activeCampaignId = state.id;
    // Restore the character between adventures.
    character.conditions = [];
    character.deathSaves = { successes: 0, failures: 0 };
    this.store.saveCharacter(character);
    this.store.saveCampaign(state, []);
    return toView(state, character, adventure);
  }

  view(userId: string, campaignId: string) {
    const { state, character, adventure } = this.load(userId, campaignId);
    return toView(state, character, adventure, this.busy.has(campaignId));
  }

  abandon(userId: string, campaignId: string) {
    const { state, character, adventure } = this.load(userId, campaignId);
    if (state.status === 'active') {
      state.status = 'abandoned';
      state.combat = null;
      state.pending = null;
    }
    if (character.activeCampaignId === state.id) character.activeCampaignId = null;
    this.store.saveCampaign(state);
    this.store.saveCharacter(character);
    return toView(state, character, adventure);
  }

  private load(userId: string, campaignId: string) {
    const row = this.store.getCampaign(campaignId);
    if (!row || row.state.userId !== userId) throw new GameError('campaign_not_found', undefined, 404);
    const character = this.store.getCharacter(row.state.characterId);
    const adventure = getAdventure(row.state.adventureId);
    if (!character || !adventure) throw new GameError('campaign_broken', undefined, 500);
    return { state: row.state, transcript: row.transcript, character, adventure };
  }

  // -------------------------------------------------------------------------
  // Turns

  async act(userId: string, campaignId: string, action: PlayerAction, emit: Emit): Promise<void> {
    const prev = this.locks.get(campaignId) ?? Promise.resolve();
    const run = prev.catch(() => undefined).then(() => this.actLocked(userId, campaignId, action, emit));
    this.locks.set(campaignId, run);
    try {
      await run;
    } finally {
      if (this.locks.get(campaignId) === run) this.locks.delete(campaignId);
    }
  }

  private async actLocked(userId: string, campaignId: string, action: PlayerAction, emit: Emit): Promise<void> {
    const { state, transcript, character, adventure } = this.load(userId, campaignId);
    const ctx: TurnCtx = {
      state,
      character,
      adventure,
      emit,
      emitState: () => emit({ type: 'state', view: toView(state, character, adventure, true) }),
      rng: this.rng,
    };
    const save = () => {
      this.store.saveCharacter(character);
      this.store.saveCampaign(state, transcript);
    };
    this.busy.add(campaignId);
    try {
      if (state.status !== 'active') throw new GameError('campaign_over');
      await this.dispatch(ctx, transcript, action, save);
      this.syncPending(ctx);
      save();
      emit({ type: 'state', view: toView(state, character, adventure, false) });
      emit({ type: 'done' });
    } catch (err) {
      this.syncPending(ctx);
      save();
      const code = err instanceof GameError ? err.code : 'internal';
      if (!(err instanceof GameError)) console.error('[engine]', err);
      emit({ type: 'error', code, message: err instanceof GameError ? err.message : 'Internal error' });
      emit({ type: 'state', view: toView(state, character, adventure, false) });
      emit({ type: 'done' });
    } finally {
      this.busy.delete(campaignId);
    }
  }

  /** Death saves are driven by combat state rather than the DM. */
  private syncPending(ctx: TurnCtx) {
    const { state, character } = ctx;
    if (state.status !== 'active') {
      state.pending = null;
      return;
    }
    if (state.combat && state.map && needsDeathSave(state.combat, combatCtx(state, character))) state.pending = { type: 'death_save' };
    else if (state.pending?.type === 'death_save') state.pending = null;
  }

  private async dispatch(ctx: TurnCtx, transcript: Transcript, action: PlayerAction, save: () => void): Promise<void> {
    const { state, character } = ctx;
    const loc = state.locale;
    const pending = state.pending;
    if (pending?.type === 'check' && action.type !== 'roll') throw new GameError('roll_pending');
    if (pending?.type === 'death_save' && action.type !== 'death_save') throw new GameError('death_save_pending');

    switch (action.type) {
      case 'begin': {
        if (state.turn > 0 || transcript.length > 0) throw new GameError('already_started');
        state.turn = 1;
        const text = `${setupMessage(state, character, ctx.adventure)}\n\n${stateBlock(state, character)}\n\nBegin the adventure: narrate the opening scene (where the hero is, the mood, the hook) and offer choices.`;
        await this.runDm(ctx, transcript, text, save);
        return;
      }
      case 'say': {
        const text = action.text.trim().slice(0, 600);
        if (!text) throw new GameError('empty');
        addLog(state, { kind: 'player', text });
        state.turn += 1;
        this.resolveWaiting(state, 'The player did not pick any suggested option and acted freely instead (see below).');
        await this.runDm(ctx, transcript, `${stateBlock(state, character)}\n\nPlayer: "${text.replace(/"/g, "'")}"`, save);
        return;
      }
      case 'rest': {
        if (state.combat) throw new GameError('in_combat');
        const text = action.kind === 'long' ? (loc === 'tr' ? 'Uzun bir dinlenme yapmak istiyorum.' : 'I want to take a long rest.') : loc === 'tr' ? 'Kısa bir mola verip dinlenmek istiyorum.' : 'I want to take a short rest.';
        addLog(state, { kind: 'player', text });
        state.turn += 1;
        this.resolveWaiting(state, 'The player asked to rest instead of picking an option.');
        await this.runDm(ctx, transcript, `${stateBlock(state, character)}\n\nPlayer requests a ${action.kind} rest. Decide with the rest tool whether it is safe here, then narrate.`, save);
        return;
      }
      case 'choose': {
        if (pending?.type !== 'choice') throw new GameError('no_choice');
        const choice = state.hiddenChoices.find((c) => c.id === action.choiceId);
        if (!choice) throw new GameError('bad_choice');
        addLog(state, { kind: 'player', text: choice.label });
        state.turn += 1;
        this.resolveWaiting(state, `The player chose "${choice.label}" [${choice.id}]. Your secret note for this option was: ${choice.consequence}`);
        await this.runDm(ctx, transcript, `${stateBlock(state, character)}\n\nThe player chose: "${choice.label}". Resolve it, honoring your secret note.`, save);
        return;
      }
      case 'roll': {
        if (pending?.type !== 'check') throw new GameError('no_check');
        const r = performCheck(character, { kind: pending.kind, key: pending.key, dc: pending.dc, advantage: pending.advantage }, state.difficulty, loc, this.rng);
        r.label = `${pending.reason} · ${r.label}`;
        emit(ctx, { type: 'roll', roll: r });
        addLog(state, { kind: 'roll', roll: r });
        const nat = naturalD20(r);
        const dc = effectiveDc(pending.dc, state.difficulty);
        const result = `Check result for "${pending.reason}" (${checkLabel(pending, 'en')}): natural ${nat} ${r.modifier >= 0 ? '+' : ''}${r.modifier} = ${r.total} vs DC ${dc} -> ${r.success ? 'SUCCESS' : 'FAILURE'}${nat === 20 ? ' (natural 20!)' : nat === 1 ? ' (natural 1!)' : ''}.`;
        state.pending = null;
        this.resolveWaiting(state, result);
        state.turn += 1;
        save();
        await this.runDm(ctx, transcript, `${stateBlock(state, character)}\n\n${result} Narrate the outcome.`, save);
        return;
      }
      case 'continue': {
        state.turn += 1;
        this.resolveWaiting(state, 'The player waited.');
        await this.runDm(ctx, transcript, `${stateBlock(state, character)}\n\n(The player waits for the story to continue.)`, save);
        return;
      }
      case 'move': {
        if (state.combat) return this.combat(ctx, transcript, { kind: 'move', x: action.x, y: action.y }, save);
        if (!state.map || !state.playerPos) throw new GameError('no_map');
        const path = walkPath(state.map, state.playerPos, { x: action.x, y: action.y }, occupied(state));
        if (!path) throw new GameError('no_path');
        openDoorsOnPath(state.map, path);
        state.playerPos = { x: action.x, y: action.y };
        refreshVision(state, character);
        return;
      }
      case 'combat':
        return this.combat(ctx, transcript, action.action, save);
      case 'death_save': {
        if (!state.combat) throw new GameError('no_combat');
        const res = rollDeathSave(state.combat, this.cctx(state, character));
        this.logCombat(ctx, res);
        await this.afterCombatStep(ctx, transcript, res, true, save);
        return;
      }
      case 'use_item': {
        if (state.combat) return this.combat(ctx, transcript, { kind: 'use_item', itemUid: action.itemUid }, save);
        const res = useConsumable(character, action.itemUid, loc, this.rng);
        if (res.error) throw new GameError(res.error);
        this.logCombat(ctx, res);
        return;
      }
      case 'cast': {
        if (state.combat) throw new GameError('use_combat_action');
        const res = castOutOfCombat(character, action.spellId, loc, this.rng);
        if (res.error) throw new GameError(res.error);
        this.logCombat(ctx, res);
        return;
      }
      case 'equip': {
        if (state.combat) throw new GameError('in_combat');
        const item = character.inventory.find((i) => i.uid === action.itemUid);
        if (!item || !toggleEquip(character, action.itemUid)) throw new GameError('not_equippable');
        addLog(state, { kind: 'system', text: sx(loc, item.equipped ? 'equipped' : 'unequipped', { item: itemName(item, loc) }) });
        return;
      }
    }
  }

  private cctx(state: CampaignState, character: Character) {
    const c = combatCtx(state, character);
    c.rng = this.rng;
    return c;
  }

  private logCombat(ctx: TurnCtx, res: CombatResult) {
    for (const r of res.rolls) {
      ctx.emit({ type: 'roll', roll: r });
      addLog(ctx.state, { kind: 'roll', roll: r });
    }
    for (const e of res.events) addLog(ctx.state, { kind: 'system', text: e });
  }

  private async combat(ctx: TurnCtx, transcript: Transcript, action: CombatAction, save: () => void) {
    const { state, character } = ctx;
    if (!state.combat || !state.map) throw new GameError('no_combat');
    const cc = this.cctx(state, character);
    const res = playerAction(state.combat, cc, action);
    if (res.error) throw new GameError(res.error);
    this.logCombat(ctx, res);
    const roundOver = action.kind === 'end_turn' || character.hp <= 0;
    await this.afterCombatStep(ctx, transcript, res, roundOver, save);
  }

  /** Handles combat outcomes and asks the DM to narrate when a round completes. */
  private async afterCombatStep(ctx: TurnCtx, transcript: Transcript, res: CombatResult, roundOver: boolean, save: () => void) {
    const { state, character } = ctx;
    const combat = state.combat;
    if (!combat) return;
    const events = combat.pendingEvents.slice(-40);
    let instruction = 'Narrate these events in 1-3 vivid sentences inside present_choices with an empty choices list.';
    if (res.outcome) instruction = applyCombatOutcome(ctx, res.outcome, res.xp ?? 0);
    else if (!roundOver) return;
    combat.pendingEvents = [];
    state.turn += 1;
    this.resolveWaiting(state, 'Combat continued.');
    save();
    if (state.status !== 'active' && res.outcome !== 'death') return;
    await this.runDm(ctx, transcript, `${stateBlock(state, character)}\n\n<combat_round>\n${events.join('\n')}\n</combat_round>\n${instruction}`, save);
  }

  /** Converts a pending turn-ending tool into a tool_result for the next user message. */
  private resolveWaiting(state: CampaignState, content: string) {
    if (state.waitingTool) {
      state.heldResults.push({ type: 'tool_result', tool_use_id: state.waitingTool.id, content });
      state.waitingTool = null;
    }
    if (state.pending?.type === 'choice') state.pending = null;
    state.hiddenChoices = [];
  }

  // -------------------------------------------------------------------------
  // DM loop

  private async runDm(ctx: TurnCtx, transcript: Transcript, text: string, save: () => void): Promise<void> {
    const { state, character, adventure } = ctx;
    const userMsg: Anthropic.Beta.Messages.BetaMessageParam = {
      role: 'user',
      content: [...(state.heldResults as ContentParam[]), { type: 'text', text }],
    };
    let committed = false;
    // If the character dies mid-reply, the model gets one more call to narrate it.
    let finalChance = state.status !== 'active';
    for (let iter = 0; iter < MAX_DM_ITERATIONS; iter++) {
      const messages = committed ? transcript : [...transcript, userMsg];
      const segments = new Map<number, string>();
      let response;
      try {
        response = await this.model.create(
          { system: this.system, tools: this.tools, messages, meta: { state, character, adventure } },
          {
            onStart: (index) => {
              const id = uid('l');
              segments.set(index, id);
              ctx.emit({ type: 'narration_start', entryId: id });
            },
            onDelta: (index, delta) => {
              const id = segments.get(index);
              if (id) ctx.emit({ type: 'narration_delta', entryId: id, text: delta });
            },
          },
        );
      } catch (err) {
        console.error('[dm] model call failed', err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err);
        addLog(state, { kind: 'system', text: sx(state.locale, 'dmError'), tone: 'bad' });
        if (!committed) throw new GameError('dm_unavailable', 'The Dungeon Master is unavailable. Try again.');
        return;
      }
      if (!committed) {
        transcript.push(userMsg);
        state.heldResults = [];
        committed = true;
      }
      transcript.push({ role: 'assistant', content: response.content as ContentParam[] });

      const toolUses = response.content.filter((b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === 'tool_use');
      // Narration first, in block order.
      response.content.forEach((b, i) => {
        if (b.type === 'text' && b.text.trim()) addLog(state, { id: segments.get(i), kind: 'dm', text: b.text.trim() });
      });
      if (response.stopReason === 'refusal') {
        addLog(state, { kind: 'system', text: sx(state.locale, 'dmRefusal') });
        state.heldResults = toolUses.map((t) => ({ type: 'tool_result', tool_use_id: t.id, content: 'Not executed.', is_error: true }));
        return;
      }
      if (toolUses.length === 0) return;
      const truncated = response.stopReason === 'max_tokens';

      const results: ToolResult[] = [];
      let paused: { id: string; name: string } | null = null;
      let ended = false;
      for (const tu of toolUses) {
        const idx = response.content.indexOf(tu);
        if (truncated) {
          results.push({ type: 'tool_result', tool_use_id: tu.id, content: 'Your reply was cut off before this call finished. Keep replies shorter.', is_error: true });
          continue;
        }
        if (PAUSING_TOOLS.includes(tu.name as never)) {
          if (paused) {
            results.push({ type: 'tool_result', tool_use_id: tu.id, content: 'Ignored: only one turn-ending tool per reply.' });
            continue;
          }
          const parsed = parsePausing(tu.name, tu.input);
          if (!parsed?.success) {
            results.push({ type: 'tool_result', tool_use_id: tu.id, content: `Invalid input: ${parsed?.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`, is_error: true });
            continue;
          }
          if (tu.name === 'request_check') {
            const input = parsed.data as { narration: string; kind: 'skill' | 'ability' | 'save'; key: string; dc: number; advantage?: 'none' | 'advantage' | 'disadvantage'; reason: string };
            const isAbility = ['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(input.key);
            if ((input.kind === 'skill') === isAbility) {
              results.push({ type: 'tool_result', tool_use_id: tu.id, content: 'kind "skill" needs a skill id; kinds "ability" and "save" need an ability id.', is_error: true });
              continue;
            }
            addLog(state, { id: segments.get(idx), kind: 'dm', text: input.narration });
            state.pending = { type: 'check', kind: input.kind, key: input.key as never, dc: input.dc, advantage: input.advantage ?? 'none', reason: input.reason };
          } else {
            const input = parsed.data as { narration: string; choices: { id: string; label: string; skill?: string; consequence: string }[] };
            addLog(state, { id: segments.get(idx), kind: 'dm', text: input.narration });
            const unique = input.choices.filter((c, i, arr) => arr.findIndex((o) => o.id === c.id) === i);
            state.hiddenChoices = unique.map((c) => ({ id: c.id, label: c.label, consequence: c.consequence }));
            state.pending = unique.length ? { type: 'choice', choices: unique.map((c) => ({ id: c.id, label: c.label, skill: c.skill as never })) } : null;
          }
          paused = { id: tu.id, name: tu.name };
          continue;
        }
        if (tu.name === 'end_adventure') {
          const input = tu.input as { epilogue?: string };
          if (input.epilogue) addLog(state, { id: segments.get(idx), kind: 'dm', text: input.epilogue });
        }
        const out = runTool(tu.name, tu.input, ctx);
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: out.content, ...(out.isError ? { is_error: true } : {}) });
        if (tu.name === 'end_adventure' && !out.isError) ended = true;
      }
      if (state.status !== 'active' && !ended && !finalChance) {
        finalChance = true;
        if (paused) results.push({ type: 'tool_result', tool_use_id: paused.id, content: 'Superseded: see the other results (the story has reached its end).' });
        state.pending = null;
        state.waitingTool = null;
        transcript.push({ role: 'user', content: results as ContentParam[] });
        save();
        continue;
      }
      if (paused || ended || state.status !== 'active') {
        state.heldResults = results;
        state.waitingTool = paused;
        if (state.status !== 'active') {
          state.pending = null;
          if (!state.ending) {
            const lastDm = [...state.log].reverse().find((l) => l.kind === 'dm');
            state.ending = lastDm && lastDm.kind === 'dm' ? lastDm.text : null;
          }
          if (character.status === 'alive') character.activeCampaignId = null;
        }
        return;
      }
      if (truncated) {
        state.heldResults = results;
        return;
      }
      transcript.push({ role: 'user', content: results as ContentParam[] });
      save();
    }
    // Iteration cap reached: the last results were already sent; nothing held.
  }
}

function emit(ctx: TurnCtx, e: TurnEvent) {
  ctx.emit(e);
}

export function classHitDie(cls: Character['class']) {
  return CLASSES[cls].hitDie;
}

export type { Adventure };
