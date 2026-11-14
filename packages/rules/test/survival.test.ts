import { describe, expect, it } from 'vitest';
import { applyDifficultyStart, createCharacter, damageCharacter, isPermadeath, shortRest } from '../src/character';
import { playerCombatantId, rollDeathSave, startCombat, type CombatCtx } from '../src/combat';
import { scriptedRng, seededRng } from '../src/rng';
import { fighterDraft, openGrid } from './helpers';

const potions = (c: ReturnType<typeof createCharacter>) =>
  c.inventory.filter((i) => i.itemId === 'healing_potion').reduce((a, i) => a + i.qty, 0);

function downed(difficulty: 'easy' | 'hard') {
  const character = createCharacter('u1', fighterDraft);
  const ctx: CombatCtx = { character, grid: openGrid(), difficulty, locale: 'en', rng: seededRng(3) };
  const { state } = startCombat(ctx, { enemies: [{ monsterId: 'goblin', count: 1 }], playerPos: { x: 10, y: 10 } });
  damageCharacter(character, character.hp);
  state.turnIndex = state.order.indexOf(playerCombatantId(character));
  return { ctx, state, character };
}

describe('easy survival', () => {
  it('grants 2 healing potions on easy only', () => {
    const e = createCharacter('u1', fighterDraft);
    const before = potions(e);
    applyDifficultyStart(e, 'easy');
    expect(potions(e)).toBe(before + 2);
    const h = createCharacter('u1', fighterDraft);
    applyDifficultyStart(h, 'hard');
    applyDifficultyStart(h);
    expect(potions(h)).toBe(before);
  });

  it('short rest spends all hit dice on easy, stops at 75% otherwise', () => {
    const mk = () => {
      const c = createCharacter('u1', fighterDraft);
      c.level = 5;
      c.maxHp = 100;
      c.hp = 1;
      c.hitDice = 5;
      return c;
    };
    const easy = mk();
    const re = shortRest(easy, scriptedRng([1, 1, 1, 1, 1]), 'easy');
    expect(re.hitDiceSpent).toBe(5);
    expect(easy.hitDice).toBe(0);
    const hard = mk();
    hard.hp = 80;
    expect(shortRest(hard, seededRng(1)).hitDiceSpent).toBe(1);
    const hard2 = mk();
    hard2.hp = 80;
    expect(shortRest(hard2, seededRng(1), 'hard').hitDiceSpent).toBe(1);
    const easy2 = mk();
    easy2.hp = 80;
    expect(shortRest(easy2, seededRng(1), 'easy').hitDiceSpent).toBeGreaterThan(1);
  });

  it('natural 1 death save is one failure on easy, two on hard', () => {
    const e = downed('easy');
    e.ctx.rng = scriptedRng([1, 1, 1]);
    rollDeathSave(e.state, e.ctx);
    expect(e.character.deathSaves.failures).toBe(1);
    const h = downed('hard');
    h.ctx.rng = scriptedRng([1, 1, 1]);
    rollDeathSave(h.state, h.ctx);
    expect(h.character.deathSaves.failures).toBe(2);
  });
});

describe('easy mode has no permanent death (Decision A)', () => {
  it('isPermadeath is true only on hard', () => {
    expect(isPermadeath('easy')).toBe(false);
    expect(isPermadeath('hard')).toBe(true);
    expect(isPermadeath()).toBe(true);
  });

  it('three failed death saves spare the character on easy and report captured', () => {
    const e = downed('easy');
    e.ctx.rng = scriptedRng([1, 1, 1, 1, 1, 1, 1, 1]);
    const res = rollDeathSave(e.state, e.ctx);
    expect(res.spared).toBeUndefined();
    e.character.deathSaves.failures = 2;
    e.state.turnIndex = e.state.order.indexOf(playerCombatantId(e.character));
    const last = rollDeathSave(e.state, e.ctx);
    expect(last.spared).toBe(true);
    expect(e.character.status).toBe('alive');
    expect(e.character.hp).toBe(0);
    expect(e.character.conditions.some((x) => x.id === 'unconscious')).toBe(true);
    expect(e.character.conditions.some((x) => x.id === 'stable')).toBe(true);
    expect(last.outcome).toBe('captured');
    expect(last.events.some((t) => /spare/.test(t))).toBe(true);
  });

  it('three failed death saves kill on hard', () => {
    const h = downed('hard');
    h.character.deathSaves.failures = 2;
    h.ctx.rng = scriptedRng([2, 2, 2]);
    const res = rollDeathSave(h.state, h.ctx);
    expect(h.character.status).toBe('dead');
    expect(res.spared).toBeUndefined();
    expect(res.outcome).toBe('death');
  });

  it('death saves outside combat on easy do not kill either', () => {
    const c = createCharacter('u1', fighterDraft);
    damageCharacter(c, c.hp);
    c.deathSaves.failures = 2;
    const ctx: CombatCtx = { character: c, grid: openGrid(), difficulty: 'easy', locale: 'tr', rng: scriptedRng([2, 2]) };
    const res = rollDeathSave(null, ctx);
    expect(c.status).toBe('alive');
    expect(res.spared).toBe(true);
  });

  it('damage at 0 HP never kills on easy, even a massive hit or a third failure', () => {
    const c = createCharacter('u1', fighterDraft);
    damageCharacter(c, c.hp, { massiveDamage: false });
    c.deathSaves.failures = 2;
    const out = damageCharacter(c, c.maxHp * 3, { massiveDamage: false });
    expect(out.died).toBe(false);
    expect(c.status).toBe('alive');
    expect(c.conditions.some((x) => x.id === 'stable')).toBe(true);
    const h = createCharacter('u1', fighterDraft);
    damageCharacter(h, h.hp);
    expect(damageCharacter(h, h.maxHp * 3).died).toBe(true);
  });

  it('explicit permadeath:false also protects against massive damage on the way down', () => {
    const c = createCharacter('u1', fighterDraft);
    const out = damageCharacter(c, c.maxHp * 5, { permadeath: false });
    expect(out.died).toBe(false);
    expect(c.status).toBe('alive');
  });
});
