// fix/combat-budget: 5e encounter budget (DMG "Creating a Combat Encounter").
import type { Difficulty } from '@dmai/shared';
import { MONSTERS } from './data/monsters';
import type { EnemySpec } from './combat';

/** XP per challenge rating (SRD). */
export const CR_XP: Record<string, number> = {
  '0': 10,
  '1/8': 25,
  '1/4': 50,
  '1/2': 100,
  '1': 200,
  '2': 450,
  '3': 700,
  '4': 1100,
  '5': 1800,
};

export type EncounterTier = 'easy' | 'medium' | 'hard' | 'deadly';

/** XP thresholds per character level (index 0 = level 1) for one character. */
export const ENCOUNTER_THRESHOLDS: Record<EncounterTier, number[]> = {
  easy: [25, 50, 75, 125, 250],
  medium: [50, 100, 150, 250, 500],
  hard: [75, 150, 225, 375, 750],
  deadly: [100, 200, 400, 500, 1100],
};

/**
 * Which tier is the budget in each game mode. Easy mode may use up to a
 * "medium" fight, hard mode up to a "hard" fight; "deadly" is never allowed.
 * No party-size shift is applied: the game is always one hero.
 */
export const BUDGET_TIER: Record<Difficulty, EncounterTier> = { easy: 'medium', hard: 'hard' };

/** Encounter XP budget for a character level and game mode. */
export function encounterBudget(level: number, difficulty: Difficulty): number {
  const row = ENCOUNTER_THRESHOLDS[BUDGET_TIER[difficulty]];
  return row[Math.min(Math.max(Math.floor(level), 1), row.length) - 1]!;
}

/** DMG multiplier for the number of monsters. */
export function monsterMultiplier(count: number): number {
  if (count <= 1) return 1;
  if (count === 2) return 1.5;
  if (count <= 6) return 2;
  if (count <= 10) return 2.5;
  if (count <= 14) return 3;
  return 4;
}

/** XP value of one monster (its own xp field, else by CR, else 0). */
export function monsterXp(monsterId: string): number {
  const m = MONSTERS[monsterId];
  if (!m) return 0;
  return m.xp ?? CR_XP[m.cr] ?? 0;
}

/** Adjusted XP of a whole monster list (sum of XP times the count multiplier). */
export function adjustedXp(enemies: EnemySpec[]): number {
  let total = 0;
  let n = 0;
  for (const e of enemies) {
    total += monsterXp(e.monsterId) * e.count;
    n += e.count;
  }
  return total * monsterMultiplier(n);
}

export interface TrimResult {
  enemies: EnemySpec[];
  budget: number;
  adjustedBefore: number;
  adjustedAfter: number;
  removed: number;
  /** True when something was removed. */
  lightened: boolean;
  /** Still above budget with the single monster that had to be kept. */
  stillOver: boolean;
}

/**
 * Trims a monster list to the budget. Repeatedly removes one monster: unnamed
 * before named, the weakest first, ties from the biggest group. Never removes
 * the last monster.
 */
export function trimToBudget(enemies: EnemySpec[], level: number, difficulty: Difficulty): TrimResult {
  const budget = encounterBudget(level, difficulty);
  const list = enemies.map((e) => ({ ...e }));
  const adjustedBefore = adjustedXp(list);
  const total = () => list.reduce((s, e) => s + e.count, 0);
  let removed = 0;
  while (list.length > 0 && total() > 1 && adjustedXp(list) > budget) {
    const order = [...list].sort((a, b) => Number(!!a.name) - Number(!!b.name) || monsterXp(a.monsterId) - monsterXp(b.monsterId) || b.count - a.count);
    const victim = order[0]!;
    victim.count -= 1;
    removed += 1;
    if (victim.count === 0) list.splice(list.indexOf(victim), 1);
  }
  const adjustedAfter = adjustedXp(list);
  return { enemies: list, budget, adjustedBefore, adjustedAfter, removed, lightened: removed > 0, stillOver: adjustedAfter > budget };
}

/**
 * Milestone XP for entering each non-start scene for the first time.
 * Cumulative targets: 300 XP (level 2) at the middle scene, 900 XP (level 3)
 * on entering the last scene. Returns scene id -> XP.
 */
export function milestoneXpPlan(sceneIds: string[], startScene: string): Record<string, number> {
  const ids = sceneIds.filter((s) => s !== startScene);
  const k = ids.length;
  const plan: Record<string, number> = {};
  if (k === 0) return plan;
  const mid = Math.ceil(k / 2);
  let prev = 0;
  ids.forEach((id, idx) => {
    const i = idx + 1;
    const cum = i === k ? 900 : i <= mid ? Math.round((300 * i) / mid) : Math.round(300 + (600 * (i - mid)) / (k - mid));
    plan[id] = cum - prev;
    prev = cum;
  });
  return plan;
}
