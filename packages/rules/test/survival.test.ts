import { describe, expect, it } from 'vitest';
import { applyDifficultyStart, createCharacter, damageCharacter, shortRest } from '../src/character';
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
