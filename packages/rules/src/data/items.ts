import type { DamageType, Loc } from '@dmai/shared';

export type WeaponProperty = 'finesse' | 'light' | 'heavy' | 'two_handed' | 'versatile' | 'thrown' | 'loading' | 'ammunition' | 'reach';

export interface WeaponDef {
  type: 'weapon';
  id: string;
  name: Loc;
  category: 'simple' | 'martial';
  damage: string;
  versatileDamage?: string;
  damageType: DamageType;
  properties: WeaponProperty[];
  /** [normal, long] range in feet for ranged/thrown weapons. */
  range?: [number, number];
  ranged: boolean;
  weight: number;
  cost: number;
}

export interface ArmorDef {
  type: 'armor';
  id: string;
  name: Loc;
  category: 'light' | 'medium' | 'heavy' | 'shield';
  baseAc: number;
  /** Max dex bonus; undefined = unlimited, 0 = none. */
  maxDex?: number;
  stealthDisadvantage?: boolean;
  weight: number;
  cost: number;
}

export interface GearDef {
  type: 'gear';
  id: string;
  name: Loc;
  description: Loc;
  /** Consumable effect. */
  use?: { kind: 'heal'; dice: string } | { kind: 'cure_poison' } | { kind: 'light' };
  weight: number;
  cost: number;
}

export type ItemDef = WeaponDef | ArmorDef | GearDef;

const w = (d: Omit<WeaponDef, 'type'>): WeaponDef => ({ type: 'weapon', ...d });
const a = (d: Omit<ArmorDef, 'type'>): ArmorDef => ({ type: 'armor', ...d });
const g = (d: Omit<GearDef, 'type'>): GearDef => ({ type: 'gear', ...d });

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(
  [
    // Weapons (SRD 5.1)
    w({ id: 'dagger', name: { en: 'Dagger', tr: 'Hançer' }, category: 'simple', damage: '1d4', damageType: 'piercing', properties: ['finesse', 'light', 'thrown'], range: [20, 60], ranged: false, weight: 1, cost: 2 }),
    w({ id: 'handaxe', name: { en: 'Handaxe', tr: 'El Baltası' }, category: 'simple', damage: '1d6', damageType: 'slashing', properties: ['light', 'thrown'], range: [20, 60], ranged: false, weight: 2, cost: 5 }),
    w({ id: 'mace', name: { en: 'Mace', tr: 'Topuz' }, category: 'simple', damage: '1d6', damageType: 'bludgeoning', properties: [], ranged: false, weight: 4, cost: 5 }),
    w({ id: 'quarterstaff', name: { en: 'Quarterstaff', tr: 'Asa' }, category: 'simple', damage: '1d6', versatileDamage: '1d8', damageType: 'bludgeoning', properties: ['versatile'], ranged: false, weight: 4, cost: 1 }),
    w({ id: 'spear', name: { en: 'Spear', tr: 'Mızrak' }, category: 'simple', damage: '1d6', versatileDamage: '1d8', damageType: 'piercing', properties: ['thrown', 'versatile'], range: [20, 60], ranged: false, weight: 3, cost: 1 }),
    w({ id: 'light_crossbow', name: { en: 'Light Crossbow', tr: 'Hafif Arbalet' }, category: 'simple', damage: '1d8', damageType: 'piercing', properties: ['ammunition', 'loading', 'two_handed'], range: [80, 320], ranged: true, weight: 5, cost: 25 }),
    w({ id: 'shortbow', name: { en: 'Shortbow', tr: 'Kısa Yay' }, category: 'simple', damage: '1d6', damageType: 'piercing', properties: ['ammunition', 'two_handed'], range: [80, 320], ranged: true, weight: 2, cost: 25 }),
    w({ id: 'shortsword', name: { en: 'Shortsword', tr: 'Kısa Kılıç' }, category: 'martial', damage: '1d6', damageType: 'piercing', properties: ['finesse', 'light'], ranged: false, weight: 2, cost: 10 }),
    w({ id: 'longsword', name: { en: 'Longsword', tr: 'Uzun Kılıç' }, category: 'martial', damage: '1d8', versatileDamage: '1d10', damageType: 'slashing', properties: ['versatile'], ranged: false, weight: 3, cost: 15 }),
    w({ id: 'rapier', name: { en: 'Rapier', tr: 'Meç' }, category: 'martial', damage: '1d8', damageType: 'piercing', properties: ['finesse'], ranged: false, weight: 2, cost: 25 }),
    w({ id: 'battleaxe', name: { en: 'Battleaxe', tr: 'Savaş Baltası' }, category: 'martial', damage: '1d8', versatileDamage: '1d10', damageType: 'slashing', properties: ['versatile'], ranged: false, weight: 4, cost: 10 }),
    w({ id: 'greataxe', name: { en: 'Greataxe', tr: 'Büyük Balta' }, category: 'martial', damage: '1d12', damageType: 'slashing', properties: ['heavy', 'two_handed'], ranged: false, weight: 7, cost: 30 }),
    w({ id: 'warhammer', name: { en: 'Warhammer', tr: 'Savaş Çekici' }, category: 'martial', damage: '1d8', versatileDamage: '1d10', damageType: 'bludgeoning', properties: ['versatile'], ranged: false, weight: 2, cost: 15 }),
    w({ id: 'longbow', name: { en: 'Longbow', tr: 'Uzun Yay' }, category: 'martial', damage: '1d8', damageType: 'piercing', properties: ['ammunition', 'heavy', 'two_handed'], range: [150, 600], ranged: true, weight: 2, cost: 50 }),
    // Armor
    a({ id: 'leather', name: { en: 'Leather Armor', tr: 'Deri Zırh' }, category: 'light', baseAc: 11, weight: 10, cost: 10 }),
    a({ id: 'studded_leather', name: { en: 'Studded Leather', tr: 'Perçinli Deri Zırh' }, category: 'light', baseAc: 12, weight: 13, cost: 45 }),
    a({ id: 'chain_shirt', name: { en: 'Chain Shirt', tr: 'Zincir Gömlek' }, category: 'medium', baseAc: 13, maxDex: 2, weight: 20, cost: 50 }),
    a({ id: 'scale_mail', name: { en: 'Scale Mail', tr: 'Pul Zırh' }, category: 'medium', baseAc: 14, maxDex: 2, stealthDisadvantage: true, weight: 45, cost: 50 }),
    a({ id: 'chain_mail', name: { en: 'Chain Mail', tr: 'Zincir Zırh' }, category: 'heavy', baseAc: 16, maxDex: 0, stealthDisadvantage: true, weight: 55, cost: 75 }),
    a({ id: 'plate', name: { en: 'Plate Armor', tr: 'Plaka Zırh' }, category: 'heavy', baseAc: 18, maxDex: 0, stealthDisadvantage: true, weight: 65, cost: 1500 }),
    a({ id: 'shield', name: { en: 'Shield', tr: 'Kalkan' }, category: 'shield', baseAc: 2, weight: 6, cost: 10 }),
    // Gear
    g({ id: 'healing_potion', name: { en: 'Potion of Healing', tr: 'İyileşme İksiri' }, description: { en: 'Restores 2d4+2 hit points.', tr: '2d4+2 can puanı yeniler.' }, use: { kind: 'heal', dice: '2d4+2' }, weight: 0.5, cost: 50 }),
    g({ id: 'greater_healing_potion', name: { en: 'Potion of Greater Healing', tr: 'Büyük İyileşme İksiri' }, description: { en: 'Restores 4d4+4 hit points.', tr: '4d4+4 can puanı yeniler.' }, use: { kind: 'heal', dice: '4d4+4' }, weight: 0.5, cost: 150 }),
    g({ id: 'antitoxin', name: { en: 'Antitoxin', tr: 'Panzehir' }, description: { en: 'Cures poison.', tr: 'Zehirlenmeyi iyileştirir.' }, use: { kind: 'cure_poison' }, weight: 0, cost: 50 }),
    g({ id: 'torch', name: { en: 'Torch', tr: 'Meşale' }, description: { en: 'Bright light for an hour.', tr: 'Bir saat boyunca parlak ışık.' }, use: { kind: 'light' }, weight: 1, cost: 0.01 }),
    g({ id: 'rope', name: { en: 'Hempen Rope (50 ft)', tr: 'Kenevir Halat (15 m)' }, description: { en: 'Sturdy rope.', tr: 'Sağlam bir halat.' }, weight: 10, cost: 1 }),
    g({ id: 'rations', name: { en: 'Rations', tr: 'Erzak' }, description: { en: 'Dried food for a day.', tr: 'Bir günlük kuru yiyecek.' }, weight: 2, cost: 0.5 }),
    g({ id: 'thieves_tools', name: { en: "Thieves' Tools", tr: 'Hırsız Aletleri' }, description: { en: 'Picks and files for locks.', tr: 'Kilitler için maymuncuk ve eğeler.' }, weight: 1, cost: 25 }),
    g({ id: 'holy_symbol', name: { en: 'Holy Symbol', tr: 'Kutsal Sembol' }, description: { en: 'A focus for divine magic.', tr: 'İlahi büyü için odak.' }, weight: 1, cost: 5 }),
    g({ id: 'spellbook', name: { en: 'Spellbook', tr: 'Büyü Kitabı' }, description: { en: 'Your arcane notes.', tr: 'Arkan notların.' }, weight: 3, cost: 50 }),
    g({ id: 'crowbar', name: { en: 'Crowbar', tr: 'Levye' }, description: { en: 'Advantage on Strength checks to pry things open.', tr: 'Bir şeyi kanırtarak açarken Güç kontrollerinde avantaj.' }, weight: 5, cost: 2 }),
    g({ id: 'lantern', name: { en: 'Hooded Lantern', tr: 'Kapaklı Fener' }, description: { en: 'Bright light in a 30 ft radius.', tr: '9 metre yarıçapta parlak ışık.' }, use: { kind: 'light' }, weight: 2, cost: 5 }),
  ].map((d) => [d.id, d]),
);

export function getItem(id: string): ItemDef | undefined {
  return ITEMS[id];
}

export function isWeapon(def: ItemDef | undefined): def is WeaponDef {
  return def?.type === 'weapon';
}

export function isArmor(def: ItemDef | undefined): def is ArmorDef {
  return def?.type === 'armor';
}
