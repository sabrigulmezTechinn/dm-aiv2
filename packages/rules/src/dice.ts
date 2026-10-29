import type { AdvantageMode, RollResult } from '@dmai/shared';
import { uid } from '@dmai/shared';
import { defaultRng, type Rng } from './rng';

export interface DiceTerm {
  count: number;
  sides: number;
}

export interface ParsedDice {
  terms: DiceTerm[];
  modifier: number;
}

const TERM_RE = /([+-]?)\s*(\d*)d(\d+)|([+-]?)\s*(\d+)/gi;

/** Parses expressions like "2d6+3", "1d8 + 1d6 - 1", "d20". */
export function parseDice(expr: string): ParsedDice {
  const terms: DiceTerm[] = [];
  let modifier = 0;
  const cleaned = expr.replace(/\s+/g, '');
  if (!/^[+-]?(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$/i.test(cleaned)) {
    throw new Error(`Invalid dice expression: ${expr}`);
  }
  for (const m of cleaned.matchAll(TERM_RE)) {
    if (m[3]) {
      const sign = m[1] === '-' ? -1 : 1;
      const count = m[2] ? parseInt(m[2], 10) : 1;
      const sides = parseInt(m[3], 10);
      if (count > 100 || sides > 1000 || sides < 1) throw new Error(`Dice out of range: ${expr}`);
      terms.push({ count: count * sign, sides });
    } else if (m[5]) {
      const sign = m[4] === '-' ? -1 : 1;
      modifier += sign * parseInt(m[5], 10);
    }
  }
  return { terms, modifier };
}

export function isValidDice(expr: string): boolean {
  try {
    parseDice(expr);
    return true;
  } catch {
    return false;
  }
}

/** Rolls a single die. Honors scripted rngs (see rng.ts) used in tests. */
export function rollDie(sides: number, rng: Rng = defaultRng): number {
  const scripted = (rng as { scripted?: number[] }).scripted;
  if (scripted && scripted.length > 0) {
    const v = scripted.shift()!;
    return Math.max(1, Math.min(sides, v));
  }
  return Math.floor(rng() * sides) + 1;
}

export interface RollOptions {
  label?: string;
  kind?: RollResult['kind'];
  actor?: string;
  rng?: Rng;
  /** Doubles the number of dice (critical hit damage). */
  critical?: boolean;
  /** Minimum total (healing etc.). */
  min?: number;
}

export function roll(expr: string, opts: RollOptions = {}): RollResult {
  const rng = opts.rng ?? defaultRng;
  const parsed = parseDice(expr);
  const dice: RollResult['dice'] = [];
  let total = parsed.modifier;
  for (const term of parsed.terms) {
    const n = Math.abs(term.count) * (opts.critical ? 2 : 1);
    const sign = term.count < 0 ? -1 : 1;
    for (let i = 0; i < n; i++) {
      const v = rollDie(term.sides, rng);
      dice.push({ sides: term.sides, value: v });
      total += sign * v;
    }
  }
  if (opts.min !== undefined) total = Math.max(opts.min, total);
  return {
    id: uid('r'),
    expression: expr,
    dice,
    modifier: parsed.modifier,
    total,
    label: opts.label ?? expr,
    kind: opts.kind ?? 'other',
    actor: opts.actor,
  };
}

export interface D20Options extends RollOptions {
  modifier: number;
  advantage?: AdvantageMode;
  dc?: number;
  dcVisible?: boolean;
  /** Reroll natural 1s once (halfling Lucky). */
  lucky?: boolean;
  /** Natural roll needed for a critical hit (attacks only). Default 20. */
  critRange?: number;
}

/** Rolls a d20 with modifier, advantage/disadvantage and optional DC. */
export function rollD20(opts: D20Options): RollResult {
  const rng = opts.rng ?? defaultRng;
  const adv = opts.advantage ?? 'none';
  const rollOne = () => {
    let v = rollDie(20, rng);
    if (opts.lucky && v === 1) v = rollDie(20, rng);
    return v;
  };
  const a = rollOne();
  const dice: RollResult['dice'] = [{ sides: 20, value: a }];
  let natural = a;
  if (adv !== 'none') {
    const b = rollOne();
    const keepB = adv === 'advantage' ? b > a : b < a;
    natural = keepB ? b : a;
    dice[0]!.dropped = keepB;
    dice.push({ sides: 20, value: b, dropped: !keepB });
  }
  const total = natural + opts.modifier;
  const mod = opts.modifier;
  const result: RollResult = {
    id: uid('r'),
    expression: `1d20${mod >= 0 ? '+' : ''}${mod}`,
    dice,
    modifier: mod,
    total,
    label: opts.label ?? 'd20',
    kind: opts.kind ?? 'check',
    advantage: adv,
    actor: opts.actor,
  };
  if (opts.kind === 'attack') {
    if (natural >= (opts.critRange ?? 20)) result.critical = 'hit';
    else if (natural === 1) result.critical = 'miss';
  }
  if (opts.dc !== undefined) {
    result.dc = opts.dc;
    result.dcVisible = opts.dcVisible ?? true;
    if (opts.kind === 'attack') {
      result.success = result.critical === 'hit' || (result.critical !== 'miss' && total >= opts.dc);
    } else {
      result.success = total >= opts.dc;
    }
  }
  return result;
}

/** Natural d20 value that was kept. */
export function naturalD20(r: RollResult): number {
  const kept = r.dice.find((d) => d.sides === 20 && !d.dropped);
  return kept?.value ?? 0;
}

/** Average value of an expression, e.g. for monster HP. */
export function averageDice(expr: string): number {
  const p = parseDice(expr);
  return Math.floor(p.terms.reduce((s, t) => s + t.count * ((t.sides + 1) / 2), p.modifier));
}

/** Combines the dice of multiple damage rolls into one result (e.g. weapon + sneak attack). */
export function combineRolls(rolls: RollResult[], label: string, kind: RollResult['kind'] = 'damage'): RollResult {
  return {
    id: uid('r'),
    expression: rolls.map((r) => r.expression).join(' + '),
    dice: rolls.flatMap((r) => r.dice),
    modifier: rolls.reduce((s, r) => s + r.modifier, 0),
    total: rolls.reduce((s, r) => s + r.total, 0),
    label,
    kind,
    actor: rolls[0]?.actor,
  };
}
