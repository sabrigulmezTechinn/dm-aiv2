import { describe, expect, it } from 'vitest';
import { averageDice, isValidDice, parseDice, roll, rollD20 } from '../src/dice';
import { scriptedRng, seededRng } from '../src/rng';

describe('dice', () => {
  it('parses expressions', () => {
    expect(parseDice('2d6+3')).toEqual({ terms: [{ count: 2, sides: 6 }], modifier: 3 });
    expect(parseDice('d20')).toEqual({ terms: [{ count: 1, sides: 20 }], modifier: 0 });
    expect(parseDice('1d8 + 1d6 - 1')).toEqual({ terms: [{ count: 1, sides: 8 }, { count: 1, sides: 6 }], modifier: -1 });
    expect(isValidDice('banana')).toBe(false);
    expect(isValidDice('3d6')).toBe(true);
  });

  it('rolls within bounds', () => {
    const rng = seededRng(42);
    for (let i = 0; i < 200; i++) {
      const r = roll('2d6+1', { rng });
      expect(r.total).toBeGreaterThanOrEqual(3);
      expect(r.total).toBeLessThanOrEqual(13);
      expect(r.dice).toHaveLength(2);
    }
  });

  it('doubles dice on critical', () => {
    const r = roll('1d8+3', { rng: scriptedRng([5, 6]), critical: true });
    expect(r.dice).toHaveLength(2);
    expect(r.total).toBe(14);
  });

  it('applies advantage and disadvantage', () => {
    const adv = rollD20({ modifier: 2, advantage: 'advantage', rng: scriptedRng([4, 17]) });
    expect(adv.total).toBe(19);
    const dis = rollD20({ modifier: 2, advantage: 'disadvantage', rng: scriptedRng([4, 17]) });
    expect(dis.total).toBe(6);
  });

  it('resolves DCs and criticals', () => {
    const hit = rollD20({ modifier: 0, dc: 25, kind: 'attack', rng: scriptedRng([20]) });
    expect(hit.critical).toBe('hit');
    expect(hit.success).toBe(true);
    const miss = rollD20({ modifier: 30, dc: 5, kind: 'attack', rng: scriptedRng([1]) });
    expect(miss.success).toBe(false);
    const check = rollD20({ modifier: 3, dc: 15, rng: scriptedRng([12]) });
    expect(check.success).toBe(true);
  });

  it('rerolls natural 1 when lucky', () => {
    const r = rollD20({ modifier: 0, lucky: true, rng: scriptedRng([1, 15]) });
    expect(r.total).toBe(15);
  });

  it('averages', () => {
    expect(averageDice('2d6')).toBe(7);
    expect(averageDice('7d10+21')).toBe(59);
  });
});
