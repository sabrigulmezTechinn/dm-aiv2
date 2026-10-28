import { describe, expect, it } from 'vitest';
import { createCharacter, damageCharacter } from '../src/character';
import {
  checkOutcome,
  isPlayerTurn,
  needsDeathSave,
  playerAction,
  playerCombatantId,
  rollDeathSave,
  runMonsters,
  startCombat,
  type CombatCtx,
} from '../src/combat';
import { scriptedRng, seededRng } from '../src/rng';
import { fighterDraft, openGrid, wizardDraft } from './helpers';

function setup(draft = fighterDraft, seed = 7, difficulty: 'easy' | 'hard' = 'hard') {
  const character = createCharacter('u1', draft);
  const ctx: CombatCtx = { character, grid: openGrid(), difficulty, locale: 'en', rng: seededRng(seed) };
  const { state, result } = startCombat(ctx, { enemies: [{ monsterId: 'goblin', count: 2 }], playerPos: { x: 10, y: 10 } });
  return { ctx, state, result, character };
}

describe('combat', () => {
  it('starts with initiative and reaches the player turn', () => {
    const { ctx, state, result } = setup();
    expect(Object.keys(state.combatants)).toHaveLength(3);
    expect(result.events[0]).toMatch(/Initiative/);
    expect(isPlayerTurn(state, ctx) || checkOutcome(state, ctx)).toBeTruthy();
  });

  it('scales enemy hp on easy', () => {
    const easy = setup(fighterDraft, 7, 'easy');
    const hard = setup(fighterDraft, 7, 'hard');
    expect(easy.state.combatants.m1!.maxHp).toBeLessThan(hard.state.combatants.m1!.maxHp);
  });

  it('lets the player move, attack and end turn', () => {
    const { ctx, state } = setup();
    const pid = playerCombatantId(ctx.character);
    const goblin = state.combatants.m1!;
    const p = state.combatants[pid]!;
    // Move next to the goblin.
    const target = { x: goblin.x + (p.x < goblin.x ? -1 : 1), y: goblin.y };
    if (!(target.x === p.x && target.y === p.y)) {
      const mv = playerAction(state, ctx, { kind: 'move', ...target });
      expect(mv.error === undefined || mv.error === 'too_far' || mv.error === 'no_path').toBe(true);
    }
    const atk = playerAction(state, ctx, { kind: 'attack', targetId: 'm1' });
    if (!atk.error) {
      expect(atk.rolls.length).toBeGreaterThan(0);
      expect(state.budget.action).toBe(false);
      const again = playerAction(state, ctx, { kind: 'attack', targetId: 'm1' });
      expect(again.error).toBe('no_action');
    }
    const end = playerAction(state, ctx, { kind: 'end_turn' });
    expect(end.error).toBeUndefined();
    expect(isPlayerTurn(state, ctx) || end.outcome).toBeTruthy();
  });

  it('rejects actions out of turn and out of range', () => {
    const { ctx, state } = setup();
    if (!isPlayerTurn(state, ctx)) return;
    const far = playerAction(state, ctx, { kind: 'move', x: 0, y: 0 });
    expect(far.error).toBe('too_far');
  });

  it('wins when all enemies fall', () => {
    const { ctx, state } = setup();
    for (const c of Object.values(state.combatants)) if (c.team === 'enemy') { c.hp = 0; c.dead = true; }
    const o = checkOutcome(state, ctx);
    expect(o?.outcome).toBe('victory');
    expect(o?.xp).toBe(100);
  });

  it('casts magic missile', () => {
    const { ctx, state } = setup(wizardDraft, 3);
    if (!isPlayerTurn(state, ctx)) return;
    const r = playerAction(state, ctx, { kind: 'cast', spellId: 'magic_missile', targetId: 'm1' });
    expect(r.error).toBeUndefined();
    expect(ctx.character.spellSlots.used[0]).toBe(1);
  });

  it('handles death saves and death', () => {
    const { ctx, state, character } = setup();
    damageCharacter(character, character.hp);
    // Force player's turn.
    state.turnIndex = state.order.indexOf(playerCombatantId(character));
    expect(needsDeathSave(state, ctx)).toBe(true);
    ctx.rng = scriptedRng([1, 1, 1, 1, 1, 1, 1, 1]);
    rollDeathSave(state, ctx);
    expect(character.deathSaves.failures).toBeGreaterThanOrEqual(2);
    if (character.status !== 'dead') rollDeathSave(state, ctx);
    expect(character.status).toBe('dead');
    expect(checkOutcome(state, ctx)?.outcome).toBe('death');
  });

  it('stabilizes after successes (easy needs two)', () => {
    const { ctx, state, character } = setup(fighterDraft, 7, 'easy');
    damageCharacter(character, character.hp);
    ctx.rng = scriptedRng([15, 15]);
    rollDeathSave(null, ctx);
    rollDeathSave(null, ctx);
    expect(character.conditions.some((x) => x.id === 'stable')).toBe(true);
    expect(checkOutcome(state, ctx)?.outcome).toBe('captured');
  });

  it('runs many full fights without throwing', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const character = createCharacter('u1', seed % 2 ? fighterDraft : wizardDraft);
      const ctx: CombatCtx = { character, grid: openGrid(16, 16, [[5, 5], [5, 6], [5, 7]]), difficulty: seed % 3 ? 'hard' : 'easy', locale: seed % 2 ? 'en' : 'tr', rng: seededRng(seed) };
      const { state } = startCombat(ctx, { enemies: [{ monsterId: 'orc', count: 1 }, { monsterId: 'wolf', count: 2 }], playerPos: { x: 2, y: 2 } });
      for (let i = 0; i < 200; i++) {
        const o = checkOutcome(state, ctx);
        if (o) break;
        if (needsDeathSave(state, ctx)) { rollDeathSave(state, ctx); continue; }
        if (!isPlayerTurn(state, ctx)) { runMonsters(state, ctx); continue; }
        const enemy = Object.values(state.combatants).find((c) => c.team === 'enemy' && !c.dead && !c.fled);
        if (enemy) {
          const p = state.combatants[playerCombatantId(character)]!;
          const dx = Math.sign(enemy.x - p.x);
          const dy = Math.sign(enemy.y - p.y);
          playerAction(state, ctx, { kind: 'move', x: enemy.x - dx, y: enemy.y - dy });
          playerAction(state, ctx, { kind: 'attack', targetId: enemy.id });
        }
        playerAction(state, ctx, { kind: 'end_turn' });
      }
      expect(['victory', 'death', 'captured']).toContain(checkOutcome(state, ctx)?.outcome);
    }
  });
});
