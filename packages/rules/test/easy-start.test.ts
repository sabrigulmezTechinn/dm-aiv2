import { describe, expect, it } from 'vitest';
import { applyDifficultyStart, createCharacter } from '../src/character';
import { fighterDraft } from './helpers';

const potions = (c: ReturnType<typeof createCharacter>) =>
  c.inventory.filter((i) => i.itemId === 'healing_potion').reduce((a, i) => a + i.qty, 0);

describe('easy campaign start', () => {
  it('does not stack bonus potions across several easy campaigns', () => {
    const c = createCharacter('u1', fighterDraft);
    const kit = potions(c);
    applyDifficultyStart(c, 'easy');
    applyDifficultyStart(c, 'easy');
    expect(potions(c)).toBe(kit + 2);
  });

  it('tops up again after potions were used', () => {
    const c = createCharacter('u1', fighterDraft);
    applyDifficultyStart(c, 'easy');
    const full = potions(c);
    c.inventory = c.inventory.filter((i) => i.itemId !== 'healing_potion');
    applyDifficultyStart(c, 'easy');
    expect(potions(c)).toBe(full);
  });
});
