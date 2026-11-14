import { describe, expect, it } from 'vitest';
import { adjustedXp, encounterBudget, milestoneXpPlan, monsterMultiplier, monsterXp, trimToBudget, levelForXp } from '../src';

describe('encounter budget', () => {
  it('uses medium for easy and hard for hard', () => {
    expect(encounterBudget(1, 'easy')).toBe(50);
    expect(encounterBudget(1, 'hard')).toBe(75);
    expect(encounterBudget(3, 'hard')).toBe(225);
    expect(encounterBudget(9, 'easy')).toBe(500);
  });
  it('multiplies by monster count', () => {
    expect(monsterMultiplier(1)).toBe(1);
    expect(monsterMultiplier(2)).toBe(1.5);
    expect(monsterMultiplier(4)).toBe(2);
    expect(adjustedXp([{ monsterId: 'goblin', count: 2 }])).toBe(monsterXp('goblin') * 2 * 1.5);
  });
  it('leaves a fair fight alone', () => {
    const r = trimToBudget([{ monsterId: 'giant_rat', count: 1 }], 1, 'easy');
    expect(r.lightened).toBe(false);
    expect(r.enemies).toEqual([{ monsterId: 'giant_rat', count: 1 }]);
  });
  it('trims extra enemies, weakest first, and keeps at least one', () => {
    const r = trimToBudget([{ monsterId: 'goblin', count: 6 }], 1, 'easy');
    expect(r.lightened).toBe(true);
    expect(r.enemies[0]!.count).toBeLessThan(6);
    expect(r.enemies[0]!.count).toBeGreaterThanOrEqual(1);
    expect(r.adjustedAfter).toBeLessThanOrEqual(r.budget);
    const boss = trimToBudget([{ monsterId: 'ogre', count: 2 }], 1, 'hard');
    expect(boss.enemies).toEqual([{ monsterId: 'ogre', count: 1 }]);
    expect(boss.stillOver).toBe(true);
  });
  it('drops the unnamed minion before a named boss', () => {
    const r = trimToBudget([{ monsterId: 'bandit_captain', count: 1, name: 'Varek' }, { monsterId: 'zombie', count: 2 }], 1, 'hard');
    expect(r.enemies[0]!.name).toBe('Varek');
    expect(r.enemies.find((e) => e.monsterId === 'zombie')).toBeUndefined();
  });
  it('does not mutate its input', () => {
    const input = [{ monsterId: 'goblin', count: 5 }];
    trimToBudget(input, 1, 'easy');
    expect(input[0]!.count).toBe(5);
  });
});

describe('milestone XP plan', () => {
  it('reaches level 2 at the middle scene and level 3 on the last', () => {
    const plan = milestoneXpPlan(['a', 'b', 'c', 'd'], 'a');
    expect(plan).toEqual({ b: 150, c: 150, d: 600 });
    expect(levelForXp(plan.b! + plan.c!)).toBe(2);
    expect(levelForXp(plan.b! + plan.c! + plan.d!)).toBe(3);
    expect(milestoneXpPlan(['x', 'y', 'z'], 'x')).toEqual({ y: 300, z: 600 });
    expect(milestoneXpPlan(['x'], 'x')).toEqual({});
  });
  it('handles five scenes', () => {
    const plan = milestoneXpPlan(['s', 'a', 'b', 'c', 'd', 'e'], 's');
    expect(Object.values(plan).reduce((a, b) => a + b, 0)).toBe(900);
  });
});
