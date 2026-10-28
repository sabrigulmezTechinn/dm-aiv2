import type {
  ActiveCondition,
  AdvantageMode,
  Character,
  CombatAction,
  CombatState,
  Combatant,
  ConditionId,
  DamageType,
  Difficulty,
  Locale,
  RollResult,
  TurnBudget,
} from '@dmai/shared';
import {
  abilityMod,
  armorClass,
  attacksPerAction,
  critRange,
  damageCharacter,
  featureUsesLeft,
  hasFeature,
  healCharacter,
  initiativeMod,
  itemName,
  mod,
  removeItem,
  slotAvailable,
  sneakAttackDice,
  spellAttackMod,
  spellAbility,
  spellSaveDc,
  speed as charSpeed,
  spendFeature,
  spendSlot,
  weaponProfiles,
  type WeaponProfile,
} from './character';
import { performCheck, combineAdvantage } from './checks';
import { RACES } from './data/races';
import { MONSTERS, type MonsterAttack, type MonsterDef } from './data/monsters';
import { SPELLS, type SpellDef } from './data/spells';
import { getItem } from './data/items';
import { averageDice, combineRolls, naturalD20, parseDice, roll, rollD20 } from './dice';
import { adjacent, distanceFt, findPath, key, lineOfSight, pickSpawnTiles, type Grid, type Point } from './grid';
import { defaultRng, type Rng } from './rng';
import { damageTypeName, tx } from './text';

export interface CombatCtx {
  character: Character;
  grid: Grid;
  difficulty: Difficulty;
  locale: Locale;
  rng?: Rng;
}

export type CombatOutcome = 'victory' | 'death' | 'captured' | 'ended';

export interface CombatResult {
  rolls: RollResult[];
  events: string[];
  error?: string;
  outcome?: CombatOutcome;
  xp?: number;
}

export interface EnemySpec {
  monsterId: string;
  count: number;
  name?: string;
}

const newResult = (): CombatResult => ({ rolls: [], events: [] });

export function playerCombatantId(c: Character): string {
  return `pc_${c.id}`;
}

function player(state: CombatState, ctx: CombatCtx): Combatant {
  return state.combatants[playerCombatantId(ctx.character)]!;
}

function syncPlayer(state: CombatState, ctx: CombatCtx): void {
  const p = player(state, ctx);
  p.hp = ctx.character.hp;
  p.maxHp = ctx.character.maxHp;
  p.ac = armorClass(ctx.character);
  p.dead = ctx.character.status === 'dead';
}

function conds(state: CombatState, ctx: CombatCtx, who: Combatant): ActiveCondition[] {
  return who.kind === 'player' ? ctx.character.conditions : who.conditions;
}

function hasCond(state: CombatState, ctx: CombatCtx, who: Combatant, id: ConditionId): boolean {
  return conds(state, ctx, who).some((c) => c.id === id);
}

function addCond(state: CombatState, ctx: CombatCtx, who: Combatant, id: ConditionId, rounds?: number): void {
  const list = conds(state, ctx, who);
  const existing = list.find((c) => c.id === id);
  if (existing) existing.rounds = rounds;
  else list.push(rounds === undefined ? { id } : { id, rounds });
}

function removeCond(state: CombatState, ctx: CombatCtx, who: Combatant, id: ConditionId): void {
  const list = conds(state, ctx, who);
  const i = list.findIndex((c) => c.id === id);
  if (i >= 0) list.splice(i, 1);
}

function alive(c: Combatant): boolean {
  return !c.dead && !c.fled;
}

function enemies(state: CombatState): Combatant[] {
  return Object.values(state.combatants).filter((c) => c.team === 'enemy' && alive(c));
}

function occupiedTiles(state: CombatState, except?: string): Set<string> {
  const s = new Set<string>();
  for (const c of Object.values(state.combatants)) if (alive(c) && c.id !== except) s.add(key(c.x, c.y));
  return s;
}

function freshBudget(spd: number): TurnBudget {
  return { movement: spd, action: true, bonusAction: true, reaction: true, attacksLeft: 0, sneakAttackUsed: false };
}

function scaledHp(def: MonsterDef, difficulty: Difficulty): number {
  const avg = Math.max(1, averageDice(def.hp));
  return difficulty === 'easy' ? Math.max(1, Math.round(avg * 0.75)) : avg;
}

function letter(i: number): string {
  return String.fromCharCode(65 + (i % 26));
}

// ---------------------------------------------------------------------------
// Start

export function startCombat(
  ctx: CombatCtx,
  spec: { enemies: EnemySpec[]; playerPos: Point; occupied?: Set<string>; surprise?: 'party' | 'enemies' },
): { state: CombatState; result: CombatResult } {
  const rng = ctx.rng ?? defaultRng;
  const res = newResult();
  const c = ctx.character;
  const pid = playerCombatantId(c);
  const combatants: Record<string, Combatant> = {};
  combatants[pid] = {
    id: pid,
    kind: 'player',
    team: 'party',
    name: c.name,
    refId: c.id,
    hp: c.hp,
    maxHp: c.maxHp,
    ac: armorClass(c),
    speed: charSpeed(c),
    initiative: 0,
    x: spec.playerPos.x,
    y: spec.playerPos.y,
    conditions: [],
    dead: false,
    fled: false,
  };
  const occupied = new Set(spec.occupied ?? []);
  occupied.add(key(spec.playerPos.x, spec.playerPos.y));
  const total = spec.enemies.reduce((s, e) => s + Math.max(1, Math.min(8, e.count)), 0);
  const spots = pickSpawnTiles(ctx.grid, spec.playerPos, total, occupied, rng);
  let n = 0;
  for (const e of spec.enemies) {
    const def = MONSTERS[e.monsterId];
    if (!def) continue;
    const count = Math.max(1, Math.min(8, e.count));
    for (let i = 0; i < count; i++) {
      const spot = spots[n] ?? spec.playerPos;
      n++;
      const id = `m${n}`;
      const baseName = e.name?.trim() || def.name[ctx.locale];
      const hp = scaledHp(def, ctx.difficulty);
      combatants[id] = {
        id,
        kind: 'monster',
        team: 'enemy',
        name: count > 1 ? `${baseName} ${letter(i)}` : baseName,
        refId: def.id,
        hp,
        maxHp: hp,
        ac: def.ac,
        speed: def.speed,
        initiative: 0,
        x: spot.x,
        y: spot.y,
        conditions: [],
        dead: false,
        fled: false,
      };
    }
  }
  // Initiative.
  for (const cb of Object.values(combatants)) {
    const dexMod = cb.kind === 'player' ? initiativeMod(c) : mod(MONSTERS[cb.refId]!.abilities.dex);
    let adv: AdvantageMode = 'none';
    if (spec.surprise === 'party' && cb.team === 'party') adv = 'advantage';
    if (spec.surprise === 'enemies' && cb.team === 'enemy') adv = 'advantage';
    const r = rollD20({ modifier: dexMod, kind: 'initiative', advantage: adv, label: ctx.locale === 'tr' ? 'İnisiyatif' : 'Initiative', actor: cb.name, rng, lucky: cb.kind === 'player' && RACES[c.race].traits.includes('lucky') });
    cb.initiative = r.total + dexMod / 100;
    if (cb.kind === 'player') res.rolls.push(r);
  }
  const order = Object.values(combatants)
    .sort((a, b) => b.initiative - a.initiative)
    .map((cb) => cb.id);
  const state: CombatState = {
    round: 1,
    turnIndex: 0,
    order,
    combatants,
    budget: freshBudget(30),
    reactionUsed: [],
    pendingEvents: [],
  };
  const orderText = order.map((id) => `${combatants[id]!.name} (${Math.floor(combatants[id]!.initiative)})`).join(', ');
  res.events.push(tx(ctx.locale, 'initiative', { order: orderText }));
  beginTurn(state, ctx, res);
  const more = runMonsters(state, ctx);
  merge(res, more);
  state.pendingEvents.push(...res.events);
  return { state, result: res };
}

function merge(into: CombatResult, from: CombatResult): void {
  into.rolls.push(...from.rolls);
  into.events.push(...from.events);
  if (from.outcome) into.outcome = from.outcome;
  if (from.xp !== undefined) into.xp = from.xp;
  if (from.error) into.error = from.error;
}

export function currentCombatant(state: CombatState): Combatant | undefined {
  return state.combatants[state.order[state.turnIndex]!];
}

export function isPlayerTurn(state: CombatState, ctx: CombatCtx): boolean {
  return currentCombatant(state)?.id === playerCombatantId(ctx.character);
}

/** True when the player is at 0 HP, dying, and it's their turn (needs a death save). */
export function needsDeathSave(state: CombatState, ctx: CombatCtx): boolean {
  const c = ctx.character;
  return isPlayerTurn(state, ctx) && c.status === 'alive' && c.hp === 0 && !c.conditions.some((x) => x.id === 'stable');
}

// ---------------------------------------------------------------------------
// Turn flow

function tickConditions(list: ActiveCondition[]): void {
  for (let i = list.length - 1; i >= 0; i--) {
    const cnd = list[i]!;
    if (cnd.rounds === undefined) continue;
    cnd.rounds -= 1;
    if (cnd.rounds <= 0) list.splice(i, 1);
  }
}

function beginTurn(state: CombatState, ctx: CombatCtx, res: CombatResult): void {
  const cur = currentCombatant(state);
  if (!cur) return;
  state.reactionUsed = state.reactionUsed.filter((id) => id !== cur.id);
  const list = conds(state, ctx, cur);
  // Dodge lasts until the start of your next turn.
  const di = list.findIndex((x) => x.id === 'dodging');
  if (di >= 0) list.splice(di, 1);
  tickConditions(list);
  const spd = cur.kind === 'player' ? charSpeed(ctx.character) : cur.speed;
  state.budget = freshBudget(spd);
  if (cur.kind === 'player') {
    if (hasCond(state, ctx, cur, 'prone') && ctx.character.hp > 0) {
      removeCond(state, ctx, cur, 'prone');
      state.budget.movement = Math.floor(spd / 2);
      res.events.push(tx(ctx.locale, 'stands', { a: cur.name }));
    }
    return;
  }
  // Spirit guardians aura around the player.
  const p = player(state, ctx);
  if (hasCond(state, ctx, p, 'spirit_guardians') && distanceFt(p, cur) <= 15 && alive(cur)) {
    const def = MONSTERS[cur.refId]!;
    const dc = spellSaveDc(ctx.character);
    const save = rollD20({ modifier: mod(def.abilities.wis), dc, kind: 'save', label: cur.name, actor: cur.name, rng: ctx.rng });
    const dmg = roll('3d8', { rng: ctx.rng, kind: 'damage', label: 'Spirit Guardians' });
    const amount = save.success ? Math.floor(dmg.total / 2) : dmg.total;
    res.events.push(tx(ctx.locale, 'guardians', { t: cur.name }));
    damageMonster(state, ctx, cur, amount, 'radiant', false, res);
  }
}

function advanceTurn(state: CombatState, ctx: CombatCtx, res: CombatResult): void {
  const cur = currentCombatant(state);
  if (cur) removeCond(state, ctx, cur, 'disengaged');
  for (let guard = 0; guard < state.order.length + 1; guard++) {
    state.turnIndex += 1;
    if (state.turnIndex >= state.order.length) {
      state.turnIndex = 0;
      state.round += 1;
      res.events.push(tx(ctx.locale, 'round', { n: state.round }));
    }
    const next = currentCombatant(state);
    if (next && alive(next)) break;
  }
  beginTurn(state, ctx, res);
}

export function checkOutcome(state: CombatState, ctx: CombatCtx): { outcome: CombatOutcome; xp: number } | null {
  const c = ctx.character;
  if (c.status === 'dead') return { outcome: 'death', xp: 0 };
  if (c.hp === 0 && c.conditions.some((x) => x.id === 'stable')) return { outcome: 'captured', xp: 0 };
  if (enemies(state).length === 0) {
    let xp = 0;
    for (const cb of Object.values(state.combatants)) {
      if (cb.team !== 'enemy') continue;
      const def = MONSTERS[cb.refId];
      if (!def) continue;
      if (cb.dead) xp += def.xp;
      else if (cb.fled) xp += Math.floor(def.xp / 2);
    }
    return { outcome: 'victory', xp };
  }
  return null;
}

function finishIfOver(state: CombatState, ctx: CombatCtx, res: CombatResult): boolean {
  const o = checkOutcome(state, ctx);
  if (!o) return false;
  res.outcome = o.outcome;
  res.xp = o.xp;
  if (o.outcome === 'victory') res.events.push(tx(ctx.locale, 'victory', { xp: o.xp }));
  if (o.outcome === 'death') res.events.push(tx(ctx.locale, 'died', { a: ctx.character.name }));
  return true;
}

/** Runs monster turns until it is the player's turn or the fight ends. */
export function runMonsters(state: CombatState, ctx: CombatCtx): CombatResult {
  const res = newResult();
  for (let guard = 0; guard < 200; guard++) {
    if (finishIfOver(state, ctx, res)) return res;
    const cur = currentCombatant(state);
    if (!cur) return res;
    if (cur.kind === 'player') return res;
    if (alive(cur)) monsterTurn(state, ctx, cur, res);
    syncPlayer(state, ctx);
    if (finishIfOver(state, ctx, res)) return res;
    advanceTurn(state, ctx, res);
  }
  return res;
}

// ---------------------------------------------------------------------------
// Damage

function damageMonster(state: CombatState, ctx: CombatCtx, m: Combatant, amount: number, type: DamageType, crit: boolean, res: CombatResult): void {
  const def = MONSTERS[m.refId];
  let dmg = amount;
  if (def?.immune?.includes(type)) dmg = 0;
  else if (def?.resist?.includes(type)) dmg = Math.floor(dmg / 2);
  else if (def?.vulnerable?.includes(type)) dmg *= 2;
  if (dmg <= 0 || m.dead) return;
  if (hasCond(state, ctx, m, 'asleep')) {
    removeCond(state, ctx, m, 'asleep');
    res.events.push(tx(ctx.locale, 'wakes', { t: m.name }));
  }
  m.hp -= dmg;
  if (m.hp <= 0) {
    if (def?.traits.includes('undead_fortitude') && type !== 'radiant' && !crit) {
      const save = rollD20({ modifier: mod(def.abilities.con), dc: 5 + dmg, kind: 'save', label: m.name, rng: ctx.rng });
      if (save.success) {
        m.hp = 1;
        res.events.push(tx(ctx.locale, 'fortitude', { t: m.name }));
        return;
      }
    }
    m.hp = 0;
    m.dead = true;
    res.events.push(tx(ctx.locale, 'falls', { t: m.name }));
  }
}

function damagePlayer(state: CombatState, ctx: CombatCtx, amount: number, type: DamageType, crit: boolean, res: CombatResult): void {
  const c = ctx.character;
  let dmg = amount;
  if (type === 'poison' && RACES[c.race].traits.includes('poison_resilience')) dmg = Math.floor(dmg / 2);
  const wasDown = c.hp === 0;
  const out = damageCharacter(c, dmg);
  if (wasDown && crit && c.status === 'alive') {
    c.deathSaves.failures += 1;
    if (c.deathSaves.failures >= 3) c.status = 'dead';
  }
  if (out.relentless) res.events.push(tx(ctx.locale, 'relentless', { t: c.name }));
  if (out.dropped) res.events.push(tx(ctx.locale, 'downed', { t: c.name }));
  if (wasDown && c.status === 'alive') res.events.push(tx(ctx.locale, 'deathSaveFail', { f: c.deathSaves.failures }));
  syncPlayer(state, ctx);
}

// ---------------------------------------------------------------------------
// Monster AI

function monsterTurn(state: CombatState, ctx: CombatCtx, m: Combatant, res: CombatResult): void {
  const def = MONSTERS[m.refId]!;
  const p = player(state, ctx);
  const c = ctx.character;
  if (hasCond(state, ctx, m, 'asleep')) {
    res.events.push(tx(ctx.locale, 'sleeps', { a: m.name }));
    return;
  }
  if (hasCond(state, ctx, m, 'prone')) {
    removeCond(state, ctx, m, 'prone');
    state.budget.movement = Math.floor(state.budget.movement / 2);
  }
  // Fleeing monsters that survived a round escape.
  if (hasCond(state, ctx, m, 'frightened') && m.conditions.find((x) => x.id === 'frightened')?.rounds === undefined) {
    m.fled = true;
    res.events.push(tx(ctx.locale, 'escaped', { a: m.name }));
    return;
  }
  if (hasCond(state, ctx, m, 'frightened')) {
    moveAway(state, ctx, m, p, state.budget.movement, res);
    return;
  }
  if (def.morale > 0 && !def.traits.includes('undead') && m.hp <= def.morale * m.maxHp && m.hp < m.maxHp) {
    res.events.push(tx(ctx.locale, 'flees', { a: m.name }));
    addCond(state, ctx, m, 'disengaged');
    addCond(state, ctx, m, 'frightened');
    moveAway(state, ctx, m, p, state.budget.movement, res);
    return;
  }
  if (c.hp === 0) {
    const smart = def.abilities.int >= 6;
    const rng = ctx.rng ?? defaultRng;
    if (ctx.difficulty === 'easy' || !smart || rng() < 0.5) {
      res.events.push(tx(ctx.locale, 'waits', { a: m.name }));
      return;
    }
  }
  const melee = def.attacks.filter((a) => a.reach);
  const ranged = def.attacks.filter((a) => a.range);
  let movement = state.budget.movement;
  if (def.traits.includes('aggressive') && !adjacent(m, p)) movement += m.speed;

  // Wounded skirmishers with a ranged attack step back first.
  if (def.traits.includes('nimble_escape') && adjacent(m, p) && ranged.length > 0 && m.hp < m.maxHp / 2) {
    addCond(state, ctx, m, 'disengaged');
    res.events.push(tx(ctx.locale, 'disengage', { a: m.name }));
    moveAway(state, ctx, m, p, Math.min(movement, 15), res);
    tryRanged(state, ctx, m, def, ranged, res);
    return;
  }
  if (adjacent(m, p) && melee.length > 0) {
    doAttacks(state, ctx, m, def, true, res);
    return;
  }
  if (def.behavior !== 'melee' || melee.length === 0) {
    if (tryRanged(state, ctx, m, def, ranged, res)) return;
  }
  // Move toward the player.
  moveToward(state, ctx, m, p, movement, res);
  if (adjacent(m, p) && melee.length > 0) doAttacks(state, ctx, m, def, true, res);
  else tryRanged(state, ctx, m, def, ranged, res);
}

function tryRanged(state: CombatState, ctx: CombatCtx, m: Combatant, def: MonsterDef, ranged: MonsterAttack[], res: CombatResult): boolean {
  const p = player(state, ctx);
  const d = distanceFt(m, p);
  const atk = ranged.find((a) => a.range && d <= a.range[1]);
  if (!atk || !lineOfSight(ctx.grid, m, p)) return false;
  doAttacks(state, ctx, m, def, false, res, atk);
  return true;
}

function doAttacks(state: CombatState, ctx: CombatCtx, m: Combatant, def: MonsterDef, melee: boolean, res: CombatResult, single?: MonsterAttack): void {
  let list: MonsterAttack[];
  if (single) list = [single];
  else if (def.multiattack) {
    list = def.multiattack.map((id) => def.attacks.find((a) => a.id === id)!).filter((a) => (melee ? a.reach : a.range));
    if (list.length === 0) list = [def.attacks.find((a) => (melee ? a.reach : a.range))!];
  } else list = [def.attacks.find((a) => (melee ? a.reach : a.range))!];
  for (const atk of list) {
    if (!atk) continue;
    if (ctx.character.status === 'dead') return;
    monsterAttack(state, ctx, m, def, atk, res);
  }
}

function monsterAttack(state: CombatState, ctx: CombatCtx, m: Combatant, def: MonsterDef, atk: MonsterAttack, res: CombatResult): void {
  const p = player(state, ctx);
  const c = ctx.character;
  const d = distanceFt(m, p);
  const isMelee = !!atk.reach && d <= atk.reach;
  const modes: AdvantageMode[] = [];
  const down = c.hp === 0;
  if (def.traits.includes('pack_tactics') && enemies(state).some((o) => o.id !== m.id && adjacent(o, p) && !hasCond(state, ctx, o, 'asleep'))) modes.push('advantage');
  if (!down && hasCond(state, ctx, p, 'dodging')) modes.push('disadvantage');
  if (hasCond(state, ctx, p, 'prone') || down) modes.push(isMelee ? 'advantage' : 'disadvantage');
  if (down && isMelee) modes.push('advantage');
  if (hasCond(state, ctx, m, 'poisoned')) modes.push('disadvantage');
  if (!isMelee && d <= 5 && !down) modes.push('disadvantage');
  if (!isMelee && atk.range && d > atk.range[0]) modes.push('disadvantage');
  const ac = armorClass(c) + (hasCond(state, ctx, p, 'shielded') ? 5 : 0);
  const r = rollD20({ modifier: atk.toHit, advantage: combineAdvantage(...modes), dc: ac, dcVisible: true, kind: 'attack', label: `${m.name}: ${atk.name[ctx.locale]}`, actor: m.name, rng: ctx.rng });
  res.rolls.push(r);
  if (!r.success) {
    res.events.push(tx(ctx.locale, 'miss', { a: m.name, t: c.name, w: atk.name[ctx.locale] }));
    return;
  }
  const crit = r.critical === 'hit' || (down && isMelee);
  const dmg = roll(atk.damage, { rng: ctx.rng, critical: crit, kind: 'damage', label: atk.name[ctx.locale], actor: m.name, min: 1 });
  res.rolls.push(dmg);
  let amount = dmg.total;
  if (!down && hasFeature(c, 'uncanny_dodge') && !state.reactionUsed.includes(p.id)) {
    amount = Math.floor(amount / 2);
    state.reactionUsed.push(p.id);
    res.events.push(tx(ctx.locale, 'uncanny', { t: c.name }));
  }
  res.events.push(tx(ctx.locale, crit ? 'crit' : 'hit', { a: m.name, t: c.name, w: atk.name[ctx.locale], d: amount }));
  damagePlayer(state, ctx, amount, atk.damageType, crit, res);
  if (atk.onHit && c.status === 'alive' && c.hp > 0) {
    const save = performCheck(c, { kind: 'save', key: atk.onHit.save, dc: atk.onHit.dc, advantage: 'none' }, 'hard', ctx.locale, ctx.rng);
    res.rolls.push(save);
    if (atk.onHit.damage) {
      const extra = roll(atk.onHit.damage, { rng: ctx.rng, kind: 'damage', label: damageTypeName(atk.onHit.damageType ?? 'poison', ctx.locale), actor: m.name });
      res.rolls.push(extra);
      const amt = save.success ? (atk.onHit.half ? Math.floor(extra.total / 2) : 0) : extra.total;
      if (amt > 0) {
        res.events.push(tx(ctx.locale, 'saveFail', { t: c.name, d: amt, type: damageTypeName(atk.onHit.damageType ?? 'poison', ctx.locale) }));
        damagePlayer(state, ctx, amt, atk.onHit.damageType ?? 'poison', false, res);
      }
    }
    if (!save.success && atk.onHit.condition) {
      addCond(state, ctx, p, atk.onHit.condition, atk.onHit.condition === 'poisoned' ? 10 : undefined);
      res.events.push(tx(ctx.locale, atk.onHit.condition === 'prone' ? 'prone' : 'poisoned', { t: c.name }));
    }
  }
}

function stepToward(state: CombatState, ctx: CombatCtx, m: Combatant, path: { x: number; y: number }[], budgetFt: number, res: CombatResult): void {
  const p = player(state, ctx);
  let spent = 0;
  let moved = false;
  for (const step of path) {
    if (spent + 5 > budgetFt) break;
    // Player opportunity attack when a monster leaves reach (resolved before it moves).
    if (adjacent(m, p) && !adjacent(step, p) && !hasCond(state, ctx, m, 'disengaged')) {
      playerOpportunityAttack(state, ctx, m, res);
      if (m.dead) return;
    }
    m.x = step.x;
    m.y = step.y;
    spent += 5;
    moved = true;
  }
  if (moved) res.events.push(tx(ctx.locale, 'moves', { a: m.name }));
}

function moveToward(state: CombatState, ctx: CombatCtx, m: Combatant, target: Combatant, budgetFt: number, res: CombatResult): void {
  const blocked = occupiedTiles(state, m.id);
  const path = findPath(ctx.grid, m, target, blocked, { allowGoalBlocked: true, maxSteps: 60 });
  if (!path || path.length === 0) return;
  path.pop(); // don't step onto the target
  stepToward(state, ctx, m, path, budgetFt, res);
}

function moveAway(state: CombatState, ctx: CombatCtx, m: Combatant, from: Combatant, budgetFt: number, res: CombatResult): void {
  const blocked = occupiedTiles(state, m.id);
  const steps: { x: number; y: number }[] = [];
  let cur = { x: m.x, y: m.y };
  for (let i = 0; i < Math.floor(budgetFt / 5); i++) {
    let best: { x: number; y: number } | null = null;
    let bestD = distanceFt(cur, from);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        if ((dx === 0 && dy === 0) || !ctx.grid.passable(nx, ny) || blocked.has(key(nx, ny))) continue;
        const nd = distanceFt({ x: nx, y: ny }, from);
        if (nd > bestD) {
          bestD = nd;
          best = { x: nx, y: ny };
        }
      }
    if (!best) break;
    steps.push(best);
    cur = best;
  }
  stepToward(state, ctx, m, steps, budgetFt, res);
}

// ---------------------------------------------------------------------------
// Player actions

function attackModes(state: CombatState, ctx: CombatCtx, attacker: Combatant, target: Combatant, isMelee: boolean, rangeNormal?: number): AdvantageMode[] {
  const modes: AdvantageMode[] = [];
  const d = distanceFt(attacker, target);
  if (hasCond(state, ctx, attacker, 'poisoned')) modes.push('disadvantage');
  if (hasCond(state, ctx, attacker, 'prone')) modes.push('disadvantage');
  if (hasCond(state, ctx, target, 'dodging')) modes.push('disadvantage');
  if (hasCond(state, ctx, target, 'prone')) modes.push(isMelee ? 'advantage' : 'disadvantage');
  if (hasCond(state, ctx, target, 'asleep')) modes.push('advantage');
  if (!isMelee) {
    const threatened = enemies(state).some((e) => adjacent(e, attacker) && !hasCond(state, ctx, e, 'asleep'));
    if (threatened) modes.push('disadvantage');
    if (rangeNormal !== undefined && d > rangeNormal) modes.push('disadvantage');
  }
  return modes;
}

function blessBonus(state: CombatState, ctx: CombatCtx, who: Combatant): number {
  if (!hasCond(state, ctx, who, 'blessed')) return 0;
  return roll('1d4', { rng: ctx.rng }).total;
}

function useAttack(state: CombatState): boolean {
  const b = state.budget;
  if (b.attacksLeft > 0) {
    b.attacksLeft -= 1;
    return true;
  }
  return false;
}

function beginAttackAction(state: CombatState, ctx: CombatCtx): boolean {
  const b = state.budget;
  if (b.attacksLeft > 0) return true;
  if (!b.action) return false;
  b.action = false;
  b.attacksLeft = attacksPerAction(ctx.character);
  return true;
}

function weaponAttack(state: CombatState, ctx: CombatCtx, target: Combatant, w: WeaponProfile, res: CombatResult, opportunity = false): void {
  const c = ctx.character;
  const p = player(state, ctx);
  const d = distanceFt(p, target);
  const isMelee = !w.ranged && d <= 5;
  const thrown = !w.ranged && !isMelee && w.def.properties.includes('thrown');
  const rangeNormal = w.ranged || thrown ? w.range?.[0] : undefined;
  const modes = attackModes(state, ctx, p, target, isMelee, rangeNormal);
  const bless = blessBonus(state, ctx, p);
  const r = rollD20({
    modifier: w.toHit + bless,
    advantage: combineAdvantage(...modes),
    dc: target.ac,
    dcVisible: ctx.difficulty === 'easy',
    kind: 'attack',
    label: `${w.def.name[ctx.locale]}${bless ? ` (+${bless})` : ''}`,
    actor: c.name,
    rng: ctx.rng,
    critRange: critRange(c),
    lucky: RACES[c.race].traits.includes('lucky'),
  });
  res.rolls.push(r);
  const wName = w.def.name[ctx.locale];
  if (!r.success) {
    res.events.push(tx(ctx.locale, 'miss', { a: c.name, t: target.name, w: wName }));
    return;
  }
  const asleepMelee = isMelee && hasCond(state, ctx, target, 'asleep');
  const crit = r.critical === 'hit' || asleepMelee;
  const parts: RollResult[] = [];
  const dmgExpr = w.damageMod !== 0 ? `${w.damage}${w.damageMod > 0 ? '+' : ''}${w.damageMod}` : w.damage;
  parts.push(roll(dmgExpr, { rng: ctx.rng, critical: crit, kind: 'damage', label: wName, actor: c.name, min: 1 }));
  if (crit && RACES[c.race].traits.includes('savage_attacks') && isMelee) {
    const die = parseDice(w.damage).terms[0];
    if (die) parts.push(roll(`1d${die.sides}`, { rng: ctx.rng, kind: 'damage', label: 'Savage', actor: c.name }));
  }
  const sneak = sneakAttackDice(c);
  const finesseOrRanged = w.def.properties.includes('finesse') || w.ranged;
  const adv = combineAdvantage(...modes) === 'advantage';
  const duel = !enemies(state).some((e) => e.id !== target.id && adjacent(e, p));
  if (sneak > 0 && !state.budget.sneakAttackUsed && finesseOrRanged && combineAdvantage(...modes) !== 'disadvantage' && (adv || duel)) {
    state.budget.sneakAttackUsed = true;
    parts.push(roll(`${sneak}d6`, { rng: ctx.rng, critical: crit, kind: 'damage', label: ctx.locale === 'tr' ? 'Sinsi Saldırı' : 'Sneak Attack', actor: c.name }));
  }
  const total = combineRolls(parts, wName);
  res.rolls.push(total);
  res.events.push(tx(ctx.locale, crit ? 'crit' : 'hit', { a: c.name, t: target.name, w: wName, d: total.total }));
  damageMonster(state, ctx, target, total.total, w.def.damageType, crit, res);
  void opportunity;
}

function playerOpportunityAttack(state: CombatState, ctx: CombatCtx, m: Combatant, res: CombatResult): void {
  const p = player(state, ctx);
  const c = ctx.character;
  if (c.hp <= 0 || state.reactionUsed.includes(p.id)) return;
  const w = weaponProfiles(c).find((x) => !x.ranged);
  if (!w) return;
  state.reactionUsed.push(p.id);
  res.events.push(tx(ctx.locale, 'opportunity', { a: c.name, t: m.name }));
  weaponAttack(state, ctx, m, w, res, true);
}

function monsterOpportunityAttacks(state: CombatState, ctx: CombatCtx, from: Point, to: Point, res: CombatResult): void {
  const p = player(state, ctx);
  if (hasCond(state, ctx, p, 'disengaged')) return;
  for (const e of enemies(state)) {
    if (state.reactionUsed.includes(e.id) || hasCond(state, ctx, e, 'asleep') || hasCond(state, ctx, e, 'frightened')) continue;
    if (adjacent(e, from) && !adjacent(e, to)) {
      const def = MONSTERS[e.refId]!;
      const atk = def.attacks.find((a) => a.reach);
      if (!atk) continue;
      state.reactionUsed.push(e.id);
      res.events.push(tx(ctx.locale, 'opportunity', { a: e.name, t: ctx.character.name }));
      // Resolve as if the player were still adjacent.
      const saved = { x: p.x, y: p.y };
      p.x = from.x;
      p.y = from.y;
      monsterAttack(state, ctx, e, def, atk, res);
      p.x = saved.x;
      p.y = saved.y;
      if (ctx.character.hp <= 0) return;
    }
  }
}

function scaleExpr(expr: string, mult: number): string {
  const p = parseDice(expr);
  const terms = p.terms.map((t) => `${t.count * mult}d${t.sides}`).join('+');
  return p.modifier ? `${terms}${p.modifier > 0 ? '+' : ''}${p.modifier}` : terms;
}

function addDice(expr: string, extra: string, times: number): string {
  if (times <= 0) return expr;
  const e = parseDice(extra).terms[0];
  if (!e) return expr;
  return `${expr}+${e.count * times}d${e.sides}`;
}

function spellDamageExpr(sp: SpellDef, base: string, slot: number, c: Character, upcast?: string, cantrip?: boolean): string {
  if (cantrip) return c.level >= 5 ? scaleExpr(base, 2) : base;
  return upcast ? addDice(base, upcast, slot - sp.level) : base;
}

function castSpell(state: CombatState, ctx: CombatCtx, spellId: string, targetId: string | undefined, res: CombatResult): string | null {
  const c = ctx.character;
  const sp = SPELLS[spellId];
  if (!sp || !c.spells.includes(spellId)) return 'unknown_spell';
  const b = state.budget;
  if (sp.castingTime === 'action' && !b.action) return 'no_action';
  if (sp.castingTime === 'bonus' && !b.bonusAction) return 'no_bonus';
  const p = player(state, ctx);
  let target: Combatant | undefined;
  if (sp.target === 'enemy') {
    target = targetId ? state.combatants[targetId] : undefined;
    if (!target || !alive(target) || target.team !== 'enemy') return 'invalid_target';
    if (distanceFt(p, target) > Math.max(5, sp.range)) return 'out_of_range';
    if (sp.range > 5 && !lineOfSight(ctx.grid, p, target)) return 'no_line_of_sight';
  }
  let slot = 0;
  if (sp.level > 0) {
    const s = slotAvailable(c, sp.level);
    if (!s) return 'no_slot';
    slot = s;
    spendSlot(c, slot);
  }
  if (sp.castingTime === 'action') b.action = false;
  else b.bonusAction = false;
  res.events.push(tx(ctx.locale, 'cast', { a: c.name, s: sp.name[ctx.locale] }));
  const eff = sp.effect;
  const abil = spellAbility(c);
  const abilMod = abil ? abilityMod(c, abil) : 0;
  switch (eff.kind) {
    case 'attack': {
      const rays = eff.rays ?? 1;
      for (let i = 0; i < rays; i++) {
        if (!target || !alive(target)) break;
        const isMelee = sp.range <= 5;
        const modes = attackModes(state, ctx, p, target, isMelee);
        const bless = blessBonus(state, ctx, p);
        const r = rollD20({ modifier: spellAttackMod(c) + bless, advantage: combineAdvantage(...modes), dc: target.ac, dcVisible: ctx.difficulty === 'easy', kind: 'attack', label: sp.name[ctx.locale], actor: c.name, rng: ctx.rng, lucky: RACES[c.race].traits.includes('lucky') });
        res.rolls.push(r);
        if (!r.success) {
          res.events.push(tx(ctx.locale, 'miss', { a: c.name, t: target.name, w: sp.name[ctx.locale] }));
          continue;
        }
        const crit = r.critical === 'hit';
        const dmg = roll(spellDamageExpr(sp, eff.damage, slot, c, eff.upcast, eff.cantrip), { rng: ctx.rng, critical: crit, kind: 'damage', label: sp.name[ctx.locale], actor: c.name });
        res.rolls.push(dmg);
        res.events.push(tx(ctx.locale, crit ? 'crit' : 'hit', { a: c.name, t: target.name, w: sp.name[ctx.locale], d: dmg.total }));
        damageMonster(state, ctx, target, dmg.total, eff.damageType, crit, res);
      }
      break;
    }
    case 'missiles': {
      if (!target) break;
      const darts = eff.darts + (slot - sp.level);
      const parts: RollResult[] = [];
      for (let i = 0; i < darts; i++) parts.push(roll(eff.damage, { rng: ctx.rng, kind: 'damage', label: sp.name[ctx.locale], actor: c.name }));
      const total = combineRolls(parts, sp.name[ctx.locale]);
      res.rolls.push(total);
      res.events.push(tx(ctx.locale, 'missiles', { n: darts, t: target.name, d: total.total }));
      damageMonster(state, ctx, target, total.total, eff.damageType, false, res);
      break;
    }
    case 'save': {
      const center = eff.aroundCaster ? p : target!;
      const victims = eff.radius
        ? enemies(state).filter((e) => distanceFt(center, e) <= eff.radius! && (eff.aroundCaster ? e.id !== p.id : true))
        : target ? [target] : [];
      const expr = spellDamageExpr(sp, eff.damage, slot, c, eff.upcast, eff.cantrip);
      const dmg = roll(expr, { rng: ctx.rng, kind: 'damage', label: sp.name[ctx.locale], actor: c.name });
      res.rolls.push(dmg);
      const dc = spellSaveDc(c);
      for (const v of victims) {
        const def = MONSTERS[v.refId]!;
        const save = rollD20({ modifier: mod(def.abilities[eff.ability]), dc, kind: 'save', label: v.name, actor: v.name, rng: ctx.rng });
        const amount = save.success ? (eff.half ? Math.floor(dmg.total / 2) : 0) : dmg.total;
        if (amount > 0) {
          res.events.push(tx(ctx.locale, save.success ? 'saveOk' : 'saveFail', { t: v.name, d: amount, type: damageTypeName(eff.damageType, ctx.locale) }));
          damageMonster(state, ctx, v, amount, eff.damageType, false, res);
        } else res.events.push(tx(ctx.locale, 'saveNone', { t: v.name }));
      }
      break;
    }
    case 'sleep': {
      const pool = roll(addDice(eff.pool, eff.upcast, slot - sp.level), { rng: ctx.rng, kind: 'other', label: sp.name[ctx.locale], actor: c.name });
      res.rolls.push(pool);
      let left = pool.total;
      const around = target ?? p;
      const victims = enemies(state)
        .filter((e) => distanceFt(around, e) <= eff.radius && !MONSTERS[e.refId]!.traits.includes('undead') && !hasCond(state, ctx, e, 'asleep'))
        .sort((a, b) => a.hp - b.hp);
      for (const v of victims) {
        if (v.hp > left) break;
        left -= v.hp;
        addCond(state, ctx, v, 'asleep', 10);
        res.events.push(tx(ctx.locale, 'fallsAsleep', { t: v.name }));
      }
      break;
    }
    case 'heal': {
      const disciple = hasFeature(c, 'disciple_of_life') ? 2 + slot : 0;
      const r = roll(addDice(eff.dice, eff.upcast, slot - sp.level), { rng: ctx.rng, kind: 'heal', label: sp.name[ctx.locale], actor: c.name });
      const amount = r.total + abilMod + disciple;
      r.total = amount;
      r.modifier += abilMod + disciple;
      res.rolls.push(r);
      const gained = healCharacter(c, amount);
      res.events.push(tx(ctx.locale, 'heal', { a: c.name, d: gained }));
      syncPlayer(state, ctx);
      break;
    }
    case 'buff':
    case 'aura':
      addCond(state, ctx, p, eff.condition, eff.rounds);
      res.events.push(tx(ctx.locale, 'buff', { a: c.name, s: sp.name[ctx.locale] }));
      break;
    case 'self_buff':
      applySelfBuff(c, eff.buff);
      res.events.push(tx(ctx.locale, 'buff', { a: c.name, s: sp.name[ctx.locale] }));
      syncPlayer(state, ctx);
      break;
  }
  return null;
}

export function applySelfBuff(c: Character, buff: 'mage_armor' | 'aid'): void {
  if (buff === 'mage_armor') c.featureUses.mage_armor = 1;
  if (buff === 'aid' && !c.featureUses.aid) {
    c.featureUses.aid = 1;
    c.maxHp += 5;
    c.hp += 5;
  }
}

/** Casts a healing/buff spell outside combat. Returns rolls/events or an error code. */
export function castOutOfCombat(c: Character, spellId: string, locale: Locale, rng?: Rng): CombatResult {
  const res = newResult();
  const sp = SPELLS[spellId];
  if (!sp || !c.spells.includes(spellId) || !sp.outOfCombat) return { ...res, error: 'invalid_spell' };
  let slot = 0;
  if (sp.level > 0) {
    const s = slotAvailable(c, sp.level);
    if (!s) return { ...res, error: 'no_slot' };
    slot = s;
    spendSlot(c, slot);
  }
  res.events.push(tx(locale, 'cast', { a: c.name, s: sp.name[locale] }));
  const eff = sp.effect;
  if (eff.kind === 'heal') {
    const abil = spellAbility(c);
    const disciple = hasFeature(c, 'disciple_of_life') ? 2 + slot : 0;
    const r = roll(addDice(eff.dice, eff.upcast, slot - sp.level), { rng, kind: 'heal', label: sp.name[locale], actor: c.name });
    const bonus = (abil ? abilityMod(c, abil) : 0) + disciple;
    r.total += bonus;
    r.modifier += bonus;
    res.rolls.push(r);
    res.events.push(tx(locale, 'heal', { a: c.name, d: healCharacter(c, r.total) }));
  } else if (eff.kind === 'self_buff') {
    applySelfBuff(c, eff.buff);
    res.events.push(tx(locale, 'buff', { a: c.name, s: sp.name[locale] }));
  }
  return res;
}

/** Uses a consumable (potion etc.). Works in and out of combat. */
export function useConsumable(c: Character, itemUid: string, locale: Locale, rng?: Rng): CombatResult {
  const res = newResult();
  const inv = c.inventory.find((i) => i.uid === itemUid);
  const def = inv ? getItem(inv.itemId) : undefined;
  if (!inv || !def || def.type !== 'gear' || !def.use) return { ...res, error: 'not_usable' };
  if (def.use.kind === 'heal') {
    const r = roll(def.use.dice, { rng, kind: 'heal', label: def.name[locale], actor: c.name });
    res.rolls.push(r);
    const gained = healCharacter(c, r.total);
    res.events.push(tx(locale, 'heal', { a: c.name, d: gained }));
  } else if (def.use.kind === 'cure_poison') {
    c.conditions = c.conditions.filter((x) => x.id !== 'poisoned');
    res.events.push(locale === 'tr' ? `${c.name} panzehiri içti.` : `${c.name} drinks the antitoxin.`);
  } else {
    res.events.push(locale === 'tr' ? `${c.name}, ${itemName(inv, locale)} yaktı.` : `${c.name} lights a ${itemName(inv, locale)}.`);
  }
  removeItem(c, inv.uid, 1);
  return res;
}

export function rollDeathSave(state: CombatState | null, ctx: CombatCtx): CombatResult {
  const res = newResult();
  const c = ctx.character;
  const r = rollD20({ modifier: 0, kind: 'death_save', label: ctx.locale === 'tr' ? 'Ölüm kurtarması' : 'Death save', actor: c.name, rng: ctx.rng, dc: 10, lucky: RACES[c.race].traits.includes('lucky') });
  res.rolls.push(r);
  const nat = naturalD20(r);
  const needed = ctx.difficulty === 'easy' ? 2 : 3;
  if (nat === 20) {
    healCharacter(c, 1);
    res.events.push(tx(ctx.locale, 'revive', { a: c.name }));
  } else if (nat === 1) {
    c.deathSaves.failures += 2;
  } else if (r.total >= 10) {
    c.deathSaves.successes += 1;
    res.events.push(tx(ctx.locale, 'deathSaveOk', { s: c.deathSaves.successes, n: needed }));
  } else {
    c.deathSaves.failures += 1;
  }
  if (nat === 1 || (nat !== 20 && r.total < 10)) res.events.push(tx(ctx.locale, 'deathSaveFail', { f: Math.min(3, c.deathSaves.failures) }));
  if (c.deathSaves.failures >= 3) {
    c.status = 'dead';
    res.events.push(tx(ctx.locale, 'died', { a: c.name }));
  } else if (c.deathSaves.successes >= needed && c.hp === 0) {
    if (!c.conditions.some((x) => x.id === 'stable')) c.conditions.push({ id: 'stable' });
    res.events.push(tx(ctx.locale, 'stable', { a: c.name }));
  }
  if (state) {
    syncPlayer(state, ctx);
    // A death save uses the turn.
    if (!finishIfOver(state, ctx, res)) {
      advanceTurn(state, ctx, res);
      merge(res, runMonsters(state, ctx));
    }
    state.pendingEvents.push(...res.events);
  }
  return res;
}

/** Applies one player combat action. */
export function playerAction(state: CombatState, ctx: CombatCtx, action: CombatAction): CombatResult {
  const res = newResult();
  const c = ctx.character;
  if (!isPlayerTurn(state, ctx)) return { ...res, error: 'not_your_turn' };
  if (c.hp <= 0 && action.kind !== 'end_turn') return { ...res, error: 'unconscious' };
  const p = player(state, ctx);
  const b = state.budget;
  switch (action.kind) {
    case 'move': {
      const blocked = occupiedTiles(state, p.id);
      const path = findPath(ctx.grid, p, action, blocked, { maxSteps: 40 });
      if (!path) return { ...res, error: 'no_path' };
      const cost = path.length * 5;
      if (cost > b.movement) return { ...res, error: 'too_far' };
      for (const step of path) {
        const from = { x: p.x, y: p.y };
        p.x = step.x;
        p.y = step.y;
        b.movement -= 5;
        monsterOpportunityAttacks(state, ctx, from, step, res);
        if (c.hp <= 0) break;
      }
      break;
    }
    case 'attack': {
      const target = state.combatants[action.targetId];
      if (!target || !alive(target) || target.team !== 'enemy') return { ...res, error: 'invalid_target' };
      const weapons = weaponProfiles(c);
      const d = distanceFt(p, target);
      let w = action.weaponUid ? weapons.find((x) => x.uid === action.weaponUid) : undefined;
      if (!w) w = d <= 5 ? weapons.find((x) => !x.ranged) ?? weapons[0] : weapons.find((x) => x.ranged) ?? weapons.find((x) => x.def.properties.includes('thrown'));
      if (!w) return { ...res, error: 'out_of_range' };
      const maxRange = w.ranged || (w.def.properties.includes('thrown') && d > 5) ? w.range?.[1] ?? 5 : 5;
      if (d > maxRange) return { ...res, error: 'out_of_range' };
      if (d > 5 && !lineOfSight(ctx.grid, p, target)) return { ...res, error: 'no_line_of_sight' };
      if (!beginAttackAction(state, ctx)) return { ...res, error: 'no_action' };
      useAttack(state);
      weaponAttack(state, ctx, target, w, res);
      break;
    }
    case 'cast': {
      const err = castSpell(state, ctx, action.spellId, action.targetId, res);
      if (err) return { ...res, error: err };
      break;
    }
    case 'dash': {
      if (hasFeature(c, 'cunning_action') && b.bonusAction) b.bonusAction = false;
      else if (b.action) b.action = false;
      else return { ...res, error: 'no_action' };
      b.movement += charSpeed(c);
      res.events.push(tx(ctx.locale, 'dash', { a: c.name }));
      break;
    }
    case 'disengage': {
      if (hasFeature(c, 'cunning_action') && b.bonusAction) b.bonusAction = false;
      else if (b.action) b.action = false;
      else return { ...res, error: 'no_action' };
      addCond(state, ctx, p, 'disengaged');
      res.events.push(tx(ctx.locale, 'disengage', { a: c.name }));
      break;
    }
    case 'dodge': {
      if (!b.action) return { ...res, error: 'no_action' };
      b.action = false;
      b.attacksLeft = 0;
      addCond(state, ctx, p, 'dodging');
      res.events.push(tx(ctx.locale, 'dodge', { a: c.name }));
      break;
    }
    case 'use_item': {
      if (!b.action) return { ...res, error: 'no_action' };
      const out = useConsumable(c, action.itemUid, ctx.locale, ctx.rng);
      if (out.error) return { ...res, error: out.error };
      b.action = false;
      b.attacksLeft = 0;
      merge(res, out);
      syncPlayer(state, ctx);
      break;
    }
    case 'second_wind': {
      if (!b.bonusAction) return { ...res, error: 'no_bonus' };
      if (!spendFeature(c, 'second_wind')) return { ...res, error: 'no_uses' };
      b.bonusAction = false;
      const r = roll(`1d10+${c.level}`, { rng: ctx.rng, kind: 'heal', label: ctx.locale === 'tr' ? 'İkinci Nefes' : 'Second Wind', actor: c.name });
      res.rolls.push(r);
      res.events.push(tx(ctx.locale, 'secondWind', { a: c.name }));
      res.events.push(tx(ctx.locale, 'heal', { a: c.name, d: healCharacter(c, r.total) }));
      syncPlayer(state, ctx);
      break;
    }
    case 'action_surge': {
      if (featureUsesLeft(c, 'action_surge') <= 0) return { ...res, error: 'no_uses' };
      if (b.action && b.attacksLeft === 0) return { ...res, error: 'action_unused' };
      spendFeature(c, 'action_surge');
      b.action = true;
      b.attacksLeft = 0;
      res.events.push(tx(ctx.locale, 'surge', { a: c.name }));
      break;
    }
    case 'turn_undead':
      return turnUndead(state, ctx);
    case 'end_turn': {
      advanceTurn(state, ctx, res);
      merge(res, runMonsters(state, ctx));
      state.pendingEvents.push(...res.events);
      return res;
    }
  }
  syncPlayer(state, ctx);
  if (!finishIfOver(state, ctx, res) && c.hp <= 0) {
    // Knocked out mid-turn: the turn ends immediately.
    advanceTurn(state, ctx, res);
    merge(res, runMonsters(state, ctx));
  }
  state.pendingEvents.push(...res.events);
  return res;
}

/** Turn Undead (cleric): undead within 30 ft make a Wisdom save or flee; at level 5 weak ones are destroyed. */
export function turnUndead(state: CombatState, ctx: CombatCtx): CombatResult {
  const res = newResult();
  const c = ctx.character;
  if (!isPlayerTurn(state, ctx)) return { ...res, error: 'not_your_turn' };
  if (!state.budget.action) return { ...res, error: 'no_action' };
  if (!spendFeature(c, 'turn_undead')) return { ...res, error: 'no_uses' };
  state.budget.action = false;
  const p = player(state, ctx);
  const dc = spellSaveDc(c);
  for (const e of enemies(state)) {
    const def = MONSTERS[e.refId]!;
    if (!def.traits.includes('undead') || distanceFt(p, e) > 30) continue;
    const save = rollD20({ modifier: mod(def.abilities.wis), dc, kind: 'save', label: e.name, actor: e.name, rng: ctx.rng });
    if (save.success) {
      res.events.push(tx(ctx.locale, 'saveNone', { t: e.name }));
      continue;
    }
    if (hasFeature(c, 'destroy_undead') && ['1/8', '1/4', '1/2'].includes(def.cr)) {
      e.dead = true;
      e.hp = 0;
      res.events.push(tx(ctx.locale, 'destroyed', { t: e.name }));
    } else {
      addCond(state, ctx, e, 'frightened', 10);
      res.events.push(tx(ctx.locale, 'turned', { t: e.name }));
    }
  }
  finishIfOver(state, ctx, res);
  state.pendingEvents.push(...res.events);
  return res;
}

/** Tiles the player can still reach this turn (for UI highlighting). */
export function movableTiles(state: CombatState, ctx: CombatCtx): { x: number; y: number }[] {
  const p = player(state, ctx);
  const blocked = occupiedTiles(state, p.id);
  const out: { x: number; y: number }[] = [];
  const maxSteps = Math.floor(state.budget.movement / 5);
  if (maxSteps <= 0) return out;
  const seen = new Set<string>([key(p.x, p.y)]);
  let frontier = [{ x: p.x, y: p.y }];
  for (let s = 0; s < maxSteps; s++) {
    const next: { x: number; y: number }[] = [];
    for (const t of frontier) {
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++) {
          const nx = t.x + dx;
          const ny = t.y + dy;
          const k = key(nx, ny);
          if (seen.has(k) || blocked.has(k) || !ctx.grid.passable(nx, ny)) continue;
          if (dx !== 0 && dy !== 0 && (!ctx.grid.passable(t.x + dx, t.y) || !ctx.grid.passable(t.x, t.y + dy))) continue;
          seen.add(k);
          out.push({ x: nx, y: ny });
          next.push({ x: nx, y: ny });
        }
    }
    frontier = next;
  }
  return out;
}

/** Ends combat early (e.g. surrender or the DM resolving it narratively). */
export function endCombat(state: CombatState, ctx: CombatCtx): CombatResult {
  const res = newResult();
  const o = checkOutcome(state, ctx);
  res.outcome = o?.outcome ?? 'ended';
  res.xp = o?.xp ?? Object.values(state.combatants).filter((x) => x.team === 'enemy' && x.dead).reduce((s, x) => s + (MONSTERS[x.refId]?.xp ?? 0), 0);
  // Clear combat-only conditions.
  ctx.character.conditions = ctx.character.conditions.filter((x) => !['dodging', 'disengaged', 'blessed', 'spirit_guardians', 'shielded', 'prone'].includes(x.id));
  return res;
}
