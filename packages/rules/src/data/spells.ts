import type { Ability, ClassId, ConditionId, DamageType, Loc } from '@dmai/shared';

export type SpellEffect =
  | { kind: 'attack'; damage: string; damageType: DamageType; rays?: number; upcast?: string; cantrip?: boolean }
  | { kind: 'save'; ability: Ability; damage: string; damageType: DamageType; half: boolean; upcast?: string; cantrip?: boolean; radius?: number; aroundCaster?: boolean }
  | { kind: 'missiles'; darts: number; damage: string; damageType: DamageType }
  | { kind: 'heal'; dice: string; upcast: string }
  | { kind: 'sleep'; pool: string; upcast: string; radius: number }
  | { kind: 'buff'; condition: ConditionId; rounds: number }
  | { kind: 'aura'; condition: ConditionId; rounds: number }
  | { kind: 'self_buff'; buff: 'mage_armor' | 'aid' };

export interface SpellDef {
  id: string;
  name: Loc;
  description: Loc;
  level: 0 | 1 | 2 | 3;
  classes: ClassId[];
  castingTime: 'action' | 'bonus';
  /** Range in feet. 0 = self, 5 = touch. */
  range: number;
  target: 'enemy' | 'self' | 'ally' | 'none';
  effect: SpellEffect;
  /** Whether it can be cast outside combat from the character sheet. */
  outOfCombat?: boolean;
}

const s = (d: SpellDef) => d;

export const SPELLS: Record<string, SpellDef> = Object.fromEntries(
  [
    // Cantrips
    s({ id: 'fire_bolt', name: { en: 'Fire Bolt', tr: 'Ateş Oku' }, description: { en: 'Ranged spell attack, 1d10 fire.', tr: 'Menzilli büyü saldırısı, 1d10 ateş.' }, level: 0, classes: ['wizard'], castingTime: 'action', range: 120, target: 'enemy', effect: { kind: 'attack', damage: '1d10', damageType: 'fire', cantrip: true } }),
    s({ id: 'ray_of_frost', name: { en: 'Ray of Frost', tr: 'Ayaz Işını' }, description: { en: 'Ranged spell attack, 1d8 cold.', tr: 'Menzilli büyü saldırısı, 1d8 soğuk.' }, level: 0, classes: ['wizard'], castingTime: 'action', range: 60, target: 'enemy', effect: { kind: 'attack', damage: '1d8', damageType: 'cold', cantrip: true } }),
    s({ id: 'sacred_flame', name: { en: 'Sacred Flame', tr: 'Kutsal Alev' }, description: { en: 'Dexterity save or 1d8 radiant.', tr: 'Çeviklik kurtarması ya da 1d8 ışıltı.' }, level: 0, classes: ['cleric'], castingTime: 'action', range: 60, target: 'enemy', effect: { kind: 'save', ability: 'dex', damage: '1d8', damageType: 'radiant', half: false, cantrip: true } }),
    // Level 1
    s({ id: 'magic_missile', name: { en: 'Magic Missile', tr: 'Büyülü Füze' }, description: { en: 'Three darts that always hit, 1d4+1 force each.', tr: 'Her zaman isabet eden üç ok, her biri 1d4+1 güç.' }, level: 1, classes: ['wizard'], castingTime: 'action', range: 120, target: 'enemy', effect: { kind: 'missiles', darts: 3, damage: '1d4+1', damageType: 'force' } }),
    s({ id: 'burning_hands', name: { en: 'Burning Hands', tr: 'Yakan Eller' }, description: { en: 'Enemies within 10 ft make a Dexterity save or take 3d6 fire (half on success).', tr: '3 metre içindeki düşmanlar Çeviklik kurtarması yapar, başarısızsa 3d6 ateş (başarıda yarısı).' }, level: 1, classes: ['wizard'], castingTime: 'action', range: 0, target: 'none', effect: { kind: 'save', ability: 'dex', damage: '3d6', damageType: 'fire', half: true, upcast: '1d6', radius: 10, aroundCaster: true } }),
    s({ id: 'sleep', name: { en: 'Sleep', tr: 'Uyku' }, description: { en: 'Puts creatures with a total of 5d8 HP near the target to sleep.', tr: 'Hedefin yakınında toplam 5d8 HP\'lik yaratığı uyutur.' }, level: 1, classes: ['wizard'], castingTime: 'action', range: 90, target: 'enemy', effect: { kind: 'sleep', pool: '5d8', upcast: '2d8', radius: 20 } }),
    s({ id: 'mage_armor', name: { en: 'Mage Armor', tr: 'Büyü Zırhı' }, description: { en: 'Your AC becomes 13 + Dex until a long rest (no armor).', tr: 'Uzun dinlenmeye kadar ZS\'n 13 + Çeviklik olur (zırhsızken).' }, level: 1, classes: ['wizard'], castingTime: 'action', range: 0, target: 'self', effect: { kind: 'self_buff', buff: 'mage_armor' }, outOfCombat: true }),
    s({ id: 'cure_wounds', name: { en: 'Cure Wounds', tr: 'Yaraları İyileştir' }, description: { en: 'Touch: heal 1d8 + Wisdom.', tr: 'Dokunuş: 1d8 + Bilgelik iyileştir.' }, level: 1, classes: ['cleric'], castingTime: 'action', range: 5, target: 'self', effect: { kind: 'heal', dice: '1d8', upcast: '1d8' }, outOfCombat: true }),
    s({ id: 'healing_word', name: { en: 'Healing Word', tr: 'Şifa Sözü' }, description: { en: 'Bonus action: heal 1d4 + Wisdom.', tr: 'Bonus aksiyon: 1d4 + Bilgelik iyileştir.' }, level: 1, classes: ['cleric'], castingTime: 'bonus', range: 60, target: 'self', effect: { kind: 'heal', dice: '1d4', upcast: '1d4' }, outOfCombat: true }),
    s({ id: 'guiding_bolt', name: { en: 'Guiding Bolt', tr: 'Yol Gösteren Şimşek' }, description: { en: 'Ranged spell attack, 4d6 radiant.', tr: 'Menzilli büyü saldırısı, 4d6 ışıltı.' }, level: 1, classes: ['cleric'], castingTime: 'action', range: 120, target: 'enemy', effect: { kind: 'attack', damage: '4d6', damageType: 'radiant', upcast: '1d6' } }),
    s({ id: 'inflict_wounds', name: { en: 'Inflict Wounds', tr: 'Yara Aç' }, description: { en: 'Melee spell attack, 3d10 necrotic.', tr: 'Yakın büyü saldırısı, 3d10 nekrotik.' }, level: 1, classes: ['cleric'], castingTime: 'action', range: 5, target: 'enemy', effect: { kind: 'attack', damage: '3d10', damageType: 'necrotic', upcast: '1d10' } }),
    s({ id: 'bless', name: { en: 'Bless', tr: 'Kutsama' }, description: { en: '+1d4 to your attack rolls and saves for 10 rounds.', tr: '10 tur boyunca saldırı ve kurtarma zarlarına +1d4.' }, level: 1, classes: ['cleric'], castingTime: 'action', range: 30, target: 'self', effect: { kind: 'buff', condition: 'blessed', rounds: 10 } }),
    // Level 2
    s({ id: 'scorching_ray', name: { en: 'Scorching Ray', tr: 'Kavurucu Işın' }, description: { en: 'Three ranged spell attacks, 2d6 fire each.', tr: 'Üç menzilli büyü saldırısı, her biri 2d6 ateş.' }, level: 2, classes: ['wizard'], castingTime: 'action', range: 120, target: 'enemy', effect: { kind: 'attack', damage: '2d6', damageType: 'fire', rays: 3 } }),
    s({ id: 'shatter', name: { en: 'Shatter', tr: 'Paramparça' }, description: { en: 'Creatures within 10 ft of the target make a Constitution save or take 3d8 thunder.', tr: 'Hedefin 3 metre çevresindekiler Dayanıklılık kurtarması yapar ya da 3d8 gök gürültüsü hasarı alır.' }, level: 2, classes: ['wizard'], castingTime: 'action', range: 60, target: 'enemy', effect: { kind: 'save', ability: 'con', damage: '3d8', damageType: 'thunder', half: true, upcast: '1d8', radius: 10 } }),
    s({ id: 'aid', name: { en: 'Aid', tr: 'Yardım' }, description: { en: '+5 maximum and current HP until a long rest.', tr: 'Uzun dinlenmeye kadar +5 azami ve mevcut HP.' }, level: 2, classes: ['cleric'], castingTime: 'action', range: 30, target: 'self', effect: { kind: 'self_buff', buff: 'aid' }, outOfCombat: true }),
    // Level 3
    s({ id: 'fireball', name: { en: 'Fireball', tr: 'Ateş Topu' }, description: { en: 'Creatures within 20 ft of the target make a Dexterity save or take 8d6 fire.', tr: 'Hedefin 6 metre çevresindekiler Çeviklik kurtarması yapar ya da 8d6 ateş hasarı alır.' }, level: 3, classes: ['wizard'], castingTime: 'action', range: 150, target: 'enemy', effect: { kind: 'save', ability: 'dex', damage: '8d6', damageType: 'fire', half: true, upcast: '1d6', radius: 20 } }),
    s({ id: 'spirit_guardians', name: { en: 'Spirit Guardians', tr: 'Ruh Muhafızları' }, description: { en: 'Enemies starting their turn within 15 ft make a Wisdom save or take 3d8 radiant.', tr: 'Sırasına 4,5 metre içinde başlayan düşmanlar Bilgelik kurtarması yapar ya da 3d8 ışıltı hasarı alır.' }, level: 3, classes: ['cleric'], castingTime: 'action', range: 0, target: 'self', effect: { kind: 'aura', condition: 'spirit_guardians', rounds: 10 } }),
  ].map((d) => [d.id, d]),
);

export function spellsFor(cls: ClassId, maxSlotLevel: number): SpellDef[] {
  return Object.values(SPELLS).filter((sp) => sp.classes.includes(cls) && sp.level <= maxSlotLevel);
}
