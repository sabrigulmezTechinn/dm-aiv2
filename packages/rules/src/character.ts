import type { Ability, AbilityScores, Character, CharacterDraft, ClassId, InventoryItem, Skill } from '@dmai/shared';
import { ABILITIES, clamp, uid } from '@dmai/shared';
import { CLASSES, FULL_CASTER_SLOTS, MAX_LEVEL, XP_THRESHOLDS, proficiencyBonus } from './data/classes';
import { RACES } from './data/races';
import { SKILLS } from './data/skills';
import { getItem, isArmor, isWeapon, type WeaponDef } from './data/items';
import { spellsFor } from './data/spells';
import { roll } from './dice';
import type { Rng } from './rng';

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
export const POINT_BUY_BUDGET = 27;
const POINT_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

export function mod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function pointBuyCost(scores: AbilityScores): number {
  return ABILITIES.reduce((sum, a) => sum + (POINT_COST[scores[a]] ?? Infinity), 0);
}

export function applyRacialBonuses(base: AbilityScores, race: CharacterDraft['race']): AbilityScores {
  const out = { ...base };
  for (const [k, v] of Object.entries(RACES[race].bonuses)) out[k as Ability] += v ?? 0;
  return out;
}

export interface DraftValidation {
  ok: boolean;
  errors: string[];
}

/** Validates a creation draft. Accepts standard array, point buy, or rolled scores (3..18). */
export function validateDraft(d: CharacterDraft): DraftValidation {
  const errors: string[] = [];
  if (!d.name || d.name.trim().length < 1 || d.name.length > 40) errors.push('name');
  if (!RACES[d.race]) errors.push('race');
  const cls = CLASSES[d.class];
  if (!cls) errors.push('class');
  for (const a of ABILITIES) {
    const v = d.baseAbilities?.[a];
    if (typeof v !== 'number' || v < 3 || v > 18 || !Number.isInteger(v)) errors.push(`ability:${a}`);
  }
  if (cls) {
    const raceSkills = RACES[d.race]?.skills ?? [];
    const chosen = d.skills.filter((s) => !raceSkills.includes(s));
    if (new Set(d.skills).size !== d.skills.length) errors.push('skills:duplicate');
    if (chosen.length !== cls.skillCount) errors.push('skills:count');
    if (chosen.some((s) => !cls.skillChoices.includes(s))) errors.push('skills:invalid');
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(d.color)) errors.push('color');
  return { ok: errors.length === 0, errors };
}

function startingInventory(cls: ClassId): InventoryItem[] {
  return CLASSES[cls].startingItems.map((it) => ({
    uid: uid('i'),
    itemId: it.itemId,
    qty: it.qty ?? 1,
    equipped: it.equipped ?? false,
  }));
}

export function maxHpFor(cls: ClassId, race: CharacterDraft['race'], level: number, con: number): number {
  const die = CLASSES[cls].hitDie;
  const conMod = mod(con);
  let hp = die + conMod;
  for (let l = 2; l <= level; l++) hp += Math.max(1, die / 2 + 1 + conMod);
  if (RACES[race].traits.includes('dwarven_toughness')) hp += level;
  return Math.max(1, hp);
}

export function createCharacter(userId: string, draft: CharacterDraft): Character {
  const v = validateDraft(draft);
  if (!v.ok) throw new Error(`Invalid character: ${v.errors.join(', ')}`);
  const abilities = applyRacialBonuses(draft.baseAbilities, draft.race);
  const cls = CLASSES[draft.class];
  const raceSkills = RACES[draft.race].skills;
  const skills = Array.from(new Set<Skill>([...draft.skills.filter((s) => !raceSkills.includes(s)), ...raceSkills]));
  const maxHp = maxHpFor(draft.class, draft.race, 1, abilities.con);
  const now = Date.now();
  const c: Character = {
    id: uid('c'),
    userId,
    name: draft.name.trim(),
    color: draft.color,
    race: draft.race,
    class: draft.class,
    level: 1,
    xp: 0,
    abilities,
    maxHp,
    hp: maxHp,
    tempHp: 0,
    hitDice: 1,
    skills,
    inventory: startingInventory(draft.class),
    gold: cls.startingGold,
    spells: [],
    spellSlots: { max: [], used: [] },
    featureUses: {},
    conditions: [],
    deathSaves: { successes: 0, failures: 0 },
    status: 'alive',
    activeCampaignId: null,
    createdAt: now,
    updatedAt: now,
  };
  refreshClassResources(c);
  return c;
}

/** Recomputes slots and known spells for the current level. Keeps used slots where possible. */
export function refreshClassResources(c: Character): void {
  const cls = CLASSES[c.class];
  if (cls.spellcasting) {
    const max = FULL_CASTER_SLOTS[c.level] ?? [];
    c.spellSlots = { max: [...max], used: max.map((_, i) => Math.min(c.spellSlots.used[i] ?? 0, max[i]!)) };
    c.spells = spellsFor(c.class, max.length).map((s) => s.id);
  }
}

export function hasFeature(c: Character, featureId: string): boolean {
  return CLASSES[c.class].features.some((f) => f.id === featureId && f.level <= c.level);
}

export function profBonus(c: Character): number {
  return proficiencyBonus(c.level);
}

export function abilityMod(c: Character, a: Ability): number {
  return mod(c.abilities[a]);
}

export function skillMod(c: Character, s: Skill): number {
  const def = SKILLS[s];
  let m = abilityMod(c, def.ability);
  if (c.skills.includes(s)) {
    m += profBonus(c);
    if (isExpert(c, s)) m += profBonus(c);
  }
  return m;
}

export function isExpert(c: Character, s: Skill): boolean {
  if (!hasFeature(c, 'expertise')) return false;
  const raceSkills = RACES[c.race].skills;
  const classSkills = c.skills.filter((x) => !raceSkills.includes(x));
  return classSkills.slice(0, 2).includes(s);
}

export function saveMod(c: Character, a: Ability): number {
  let m = abilityMod(c, a);
  if (CLASSES[c.class].saves.includes(a)) m += profBonus(c);
  return m;
}

export function passivePerception(c: Character): number {
  return 10 + skillMod(c, 'perception');
}

export function equipped(c: Character) {
  return c.inventory.filter((i) => i.equipped).map((i) => ({ inv: i, def: getItem(i.itemId) }));
}

export function armorClass(c: Character): number {
  const eq = equipped(c);
  const armor = eq.find((e) => isArmor(e.def) && e.def.category !== 'shield');
  const shield = eq.find((e) => isArmor(e.def) && e.def.category === 'shield');
  const dex = abilityMod(c, 'dex');
  let ac: number;
  if (armor && isArmor(armor.def)) {
    const maxDex = armor.def.maxDex;
    ac = armor.def.baseAc + (maxDex === undefined ? dex : Math.min(dex, maxDex));
    if (hasFeature(c, 'fighting_style')) ac += 1;
  } else if (c.featureUses.mage_armor) {
    ac = 13 + dex;
  } else {
    ac = 10 + dex;
  }
  if (shield) ac += 2;
  return ac;
}

export function speed(c: Character): number {
  return RACES[c.race].speed;
}

export function darkvision(c: Character): number {
  return RACES[c.race].darkvision;
}

export function initiativeMod(c: Character): number {
  return abilityMod(c, 'dex');
}

export function spellAbility(c: Character): Ability | null {
  return CLASSES[c.class].spellcasting?.ability ?? null;
}

export function spellSaveDc(c: Character): number {
  const a = spellAbility(c);
  return a ? 8 + profBonus(c) + abilityMod(c, a) : 0;
}

export function spellAttackMod(c: Character): number {
  const a = spellAbility(c);
  return a ? profBonus(c) + abilityMod(c, a) : 0;
}

export interface WeaponProfile {
  uid: string;
  def: WeaponDef;
  toHit: number;
  damage: string;
  damageMod: number;
  ranged: boolean;
  reach: number;
  range?: [number, number];
}

/** All weapons the character can attack with (equipped first, then carried). */
export function weaponProfiles(c: Character): WeaponProfile[] {
  const hasShield = equipped(c).some((e) => isArmor(e.def) && e.def.category === 'shield');
  const out: WeaponProfile[] = [];
  const sorted = [...c.inventory].sort((a, b) => Number(!!b.equipped) - Number(!!a.equipped));
  for (const inv of sorted) {
    const def = getItem(inv.itemId);
    if (!isWeapon(def)) continue;
    const str = abilityMod(c, 'str');
    const dex = abilityMod(c, 'dex');
    const useDex = def.ranged || (def.properties.includes('finesse') && dex > str);
    const m = useDex ? dex : str;
    const versatile = def.versatileDamage && !hasShield ? def.versatileDamage : def.damage;
    out.push({
      uid: inv.uid,
      def,
      toHit: m + profBonus(c),
      damage: versatile,
      damageMod: m,
      ranged: def.ranged,
      reach: def.ranged ? 0 : 5,
      range: def.range,
    });
  }
  if (out.length === 0) {
    const str = abilityMod(c, 'str');
    out.push({
      uid: 'unarmed',
      def: { type: 'weapon', id: 'unarmed', name: { en: 'Unarmed Strike', tr: 'Silahsız Vuruş' }, category: 'simple', damage: '1', damageType: 'bludgeoning', properties: [], ranged: false, weight: 0, cost: 0 },
      toHit: str + profBonus(c),
      damage: '1',
      damageMod: str,
      ranged: false,
      reach: 5,
    });
  }
  return out;
}

export function sneakAttackDice(c: Character): number {
  return hasFeature(c, 'sneak_attack') ? Math.ceil(c.level / 2) : 0;
}

export function critRange(c: Character): number {
  return hasFeature(c, 'improved_critical') ? 19 : 20;
}

export function attacksPerAction(c: Character): number {
  return hasFeature(c, 'extra_attack') ? 2 : 1;
}

export function featureMaxUses(c: Character, id: string): number {
  if (id === 'second_wind') return hasFeature(c, 'second_wind') ? 1 : 0;
  if (id === 'action_surge') return hasFeature(c, 'action_surge') ? 1 : 0;
  if (id === 'turn_undead') return hasFeature(c, 'turn_undead') ? 1 : 0;
  if (id === 'arcane_recovery') return hasFeature(c, 'arcane_recovery') ? 1 : 0;
  if (id === 'relentless') return RACES[c.race].traits.includes('relentless') ? 1 : 0;
  return 0;
}

export function featureUsesLeft(c: Character, id: string): number {
  return Math.max(0, featureMaxUses(c, id) - (c.featureUses[`used_${id}`] ?? 0));
}

export function spendFeature(c: Character, id: string): boolean {
  if (featureUsesLeft(c, id) <= 0) return false;
  c.featureUses[`used_${id}`] = (c.featureUses[`used_${id}`] ?? 0) + 1;
  return true;
}

// ---------------------------------------------------------------------------
// HP

export interface DamageOutcome {
  dealt: number;
  dropped: boolean;
  died: boolean;
  relentless: boolean;
}

/**
 * Applies damage to a character, handling temp HP, massive damage, relentless endurance and death saves.
 * With `massiveDamage: false` (easy mode) overflow damage never kills outright.
 */
export function damageCharacter(c: Character, amount: number, opts: { massiveDamage?: boolean } = {}): DamageOutcome {
  const massive = opts.massiveDamage ?? true;
  const out: DamageOutcome = { dealt: 0, dropped: false, died: false, relentless: false };
  if (c.status === 'dead' || amount <= 0) return out;
  let remaining = amount;
  if (c.tempHp > 0) {
    const absorbed = Math.min(c.tempHp, remaining);
    c.tempHp -= absorbed;
    remaining -= absorbed;
  }
  out.dealt = amount;
  if (c.hp === 0) {
    // Damage while at 0 HP causes a death save failure (2 on a critical is handled by caller).
    if (massive && remaining >= c.maxHp) {
      c.status = 'dead';
      out.died = true;
    } else if (remaining > 0) {
      c.deathSaves.failures += 1;
      c.conditions = c.conditions.filter((x) => x.id !== 'stable');
      if (c.deathSaves.failures >= 3) {
        c.status = 'dead';
        out.died = true;
      }
    }
    return out;
  }
  const overflow = remaining - c.hp;
  c.hp = Math.max(0, c.hp - remaining);
  if (c.hp === 0) {
    if (massive && overflow >= c.maxHp) {
      c.status = 'dead';
      out.died = true;
      return out;
    }
    if (spendFeature(c, 'relentless')) {
      c.hp = 1;
      out.relentless = true;
      return out;
    }
    out.dropped = true;
    c.deathSaves = { successes: 0, failures: 0 };
    if (!c.conditions.some((x) => x.id === 'unconscious')) c.conditions.push({ id: 'unconscious' });
  }
  return out;
}

export function healCharacter(c: Character, amount: number): number {
  if (c.status === 'dead' || amount <= 0) return 0;
  const before = c.hp;
  c.hp = clamp(c.hp + amount, 0, c.maxHp);
  if (before === 0 && c.hp > 0) {
    c.conditions = c.conditions.filter((x) => x.id !== 'unconscious' && x.id !== 'stable');
    c.deathSaves = { successes: 0, failures: 0 };
  }
  return c.hp - before;
}

// ---------------------------------------------------------------------------
// XP and levels

export function levelForXp(xp: number): number {
  let lvl = 1;
  for (let i = 0; i < XP_THRESHOLDS.length; i++) if (xp >= XP_THRESHOLDS[i]!) lvl = i + 1;
  return Math.min(lvl, MAX_LEVEL);
}

export function xpForNextLevel(c: Character): number | null {
  return c.level >= MAX_LEVEL ? null : XP_THRESHOLDS[c.level]!;
}

export interface LevelUpResult {
  from: number;
  to: number;
  hpGained: number;
  newFeatures: string[];
}

/** Adds XP and applies any level ups. */
export function awardXp(c: Character, amount: number): LevelUpResult | null {
  c.xp += Math.max(0, Math.floor(amount));
  const target = levelForXp(c.xp);
  if (target <= c.level) return null;
  const from = c.level;
  const cls = CLASSES[c.class];
  const newFeatures: string[] = [];
  for (let l = from + 1; l <= target; l++) {
    for (const f of cls.features.filter((f) => f.level === l)) {
      newFeatures.push(f.id);
      if (f.id === 'asi') c.abilities[cls.primary] = Math.min(20, c.abilities[cls.primary] + 2);
    }
  }
  c.level = target;
  const oldMax = c.maxHp;
  c.maxHp = maxHpFor(c.class, c.race, c.level, c.abilities.con) + (c.featureUses.aid ? 5 : 0);
  const gained = c.maxHp - oldMax;
  if (c.hp > 0) c.hp = Math.min(c.maxHp, c.hp + gained);
  c.hitDice = c.level;
  refreshClassResources(c);
  return { from, to: target, hpGained: gained, newFeatures };
}

// ---------------------------------------------------------------------------
// Rests

export interface RestResult {
  hpGained: number;
  hitDiceSpent: number;
  slotsRecovered: number;
}

export function shortRest(c: Character, rng?: Rng): RestResult {
  const res: RestResult = { hpGained: 0, hitDiceSpent: 0, slotsRecovered: 0 };
  if (c.status === 'dead') return res;
  const die = CLASSES[c.class].hitDie;
  // Spend hit dice until healthy or out of dice.
  while (c.hitDice > 0 && c.hp < c.maxHp && c.hp > 0) {
    const r = roll(`1d${die}`, { rng });
    const gain = Math.max(1, r.total + abilityMod(c, 'con'));
    res.hpGained += healCharacter(c, gain);
    c.hitDice -= 1;
    res.hitDiceSpent += 1;
    if (c.hp >= c.maxHp * 0.75) break;
  }
  for (const id of ['second_wind', 'action_surge', 'turn_undead']) delete c.featureUses[`used_${id}`];
  if (featureUsesLeft(c, 'arcane_recovery') > 0) {
    const idx = c.spellSlots.used.findIndex((u) => u > 0);
    if (idx >= 0) {
      c.spellSlots.used[idx]! -= 1;
      spendFeature(c, 'arcane_recovery');
      res.slotsRecovered = 1;
    }
  }
  c.updatedAt = Date.now();
  return res;
}

export function longRest(c: Character): RestResult {
  const res: RestResult = { hpGained: 0, hitDiceSpent: 0, slotsRecovered: 0 };
  if (c.status === 'dead') return res;
  if (c.featureUses.aid) {
    c.maxHp -= 5;
    delete c.featureUses.aid;
  }
  delete c.featureUses.mage_armor;
  res.hpGained = c.maxHp - c.hp;
  c.hp = c.maxHp;
  c.tempHp = 0;
  c.hitDice = Math.min(c.level, c.hitDice + Math.max(1, Math.floor(c.level / 2)));
  res.slotsRecovered = c.spellSlots.used.reduce((a, b) => a + b, 0);
  c.spellSlots.used = c.spellSlots.max.map(() => 0);
  for (const k of Object.keys(c.featureUses)) if (k.startsWith('used_')) delete c.featureUses[k];
  c.conditions = [];
  c.deathSaves = { successes: 0, failures: 0 };
  c.updatedAt = Date.now();
  return res;
}

// ---------------------------------------------------------------------------
// Inventory

export function addItem(c: Character, itemId: string, qty = 1, custom?: { name: string; description?: string }): InventoryItem {
  if (itemId !== 'custom') {
    const existing = c.inventory.find((i) => i.itemId === itemId && !i.equipped);
    if (existing && !isWeapon(getItem(itemId)) && !isArmor(getItem(itemId))) {
      existing.qty += qty;
      return existing;
    }
  }
  const item: InventoryItem = { uid: uid('i'), itemId, qty, equipped: false };
  if (itemId === 'custom' && custom) {
    item.name = custom.name;
    item.description = custom.description;
  }
  c.inventory.push(item);
  return item;
}

/** Removes qty of an item by uid or catalog id. Returns number actually removed. */
export function removeItem(c: Character, ref: string, qty = 1): number {
  const item = c.inventory.find((i) => i.uid === ref) ?? c.inventory.find((i) => i.itemId === ref) ?? c.inventory.find((i) => i.name?.toLowerCase() === ref.toLowerCase());
  if (!item) return 0;
  const n = Math.min(qty, item.qty);
  item.qty -= n;
  if (item.qty <= 0) c.inventory = c.inventory.filter((i) => i !== item);
  return n;
}

export function toggleEquip(c: Character, uidRef: string): boolean {
  const item = c.inventory.find((i) => i.uid === uidRef);
  if (!item) return false;
  const def = getItem(item.itemId);
  if (!def || def.type === 'gear') return false;
  if (!item.equipped && isArmor(def)) {
    // Only one body armor / one shield at a time.
    for (const other of c.inventory) {
      const od = getItem(other.itemId);
      if (other !== item && other.equipped && isArmor(od) && (od.category === 'shield') === (def.category === 'shield')) other.equipped = false;
    }
  }
  item.equipped = !item.equipped;
  return true;
}

export function itemName(item: InventoryItem, locale: 'en' | 'tr'): string {
  if (item.itemId === 'custom') return item.name ?? '???';
  return getItem(item.itemId)?.name[locale] ?? item.itemId;
}

export function slotAvailable(c: Character, level: number): number | null {
  // Returns the lowest available slot level >= level.
  for (let l = level; l <= c.spellSlots.max.length; l++) {
    if ((c.spellSlots.max[l - 1] ?? 0) - (c.spellSlots.used[l - 1] ?? 0) > 0) return l;
  }
  return null;
}

export function spendSlot(c: Character, level: number): boolean {
  const i = level - 1;
  if ((c.spellSlots.max[i] ?? 0) - (c.spellSlots.used[i] ?? 0) <= 0) return false;
  c.spellSlots.used[i] = (c.spellSlots.used[i] ?? 0) + 1;
  return true;
}
