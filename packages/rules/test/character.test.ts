import { describe, expect, it } from 'vitest';
import {
  addItem,
  armorClass,
  awardXp,
  createCharacter,
  damageCharacter,
  healCharacter,
  longRest,
  pointBuyCost,
  removeItem,
  shortRest,
  skillMod,
  validateDraft,
  weaponProfiles,
} from '../src/character';
import { seededRng } from '../src/rng';
import { clericDraft, fighterDraft, rogueDraft, wizardDraft } from './helpers';

describe('character creation', () => {
  it('creates a dwarf fighter with correct stats', () => {
    const c = createCharacter('u1', fighterDraft);
    expect(c.abilities.con).toBe(16);
    expect(c.abilities.wis).toBe(13);
    // d10 + 3 con + 1 dwarven toughness
    expect(c.maxHp).toBe(14);
    // chain mail 16 + shield 2 + defense 1
    expect(armorClass(c)).toBe(19);
    expect(c.inventory.some((i) => i.itemId === 'longsword' && i.equipped)).toBe(true);
    expect(weaponProfiles(c)[0]!.toHit).toBe(4);
  });

  it('gives wizards spells and slots', () => {
    const c = createCharacter('u1', wizardDraft);
    expect(c.spellSlots.max).toEqual([2]);
    expect(c.spells).toContain('fire_bolt');
    expect(c.spells).toContain('magic_missile');
    expect(c.spells).not.toContain('fireball');
    expect(c.skills).toContain('perception'); // elf keen senses
    expect(armorClass(c)).toBe(13);
  });

  it('applies rogue expertise to first two skills', () => {
    const c = createCharacter('u1', rogueDraft);
    // dex 17 -> +3, prof +2, expertise +2
    expect(skillMod(c, 'acrobatics')).toBe(7);
    expect(skillMod(c, 'sleight_of_hand')).toBe(5);
  });

  it('validates drafts', () => {
    expect(validateDraft({ ...fighterDraft, skills: ['arcana', 'athletics'] }).ok).toBe(false);
    expect(validateDraft({ ...fighterDraft, name: '' }).ok).toBe(false);
    expect(validateDraft(clericDraft).ok).toBe(true);
    expect(pointBuyCost({ str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 })).toBe(27);
  });
});

describe('hp, xp and rests', () => {
  it('drops to 0 and dies from massive damage', () => {
    const c = createCharacter('u1', wizardDraft);
    const out = damageCharacter(c, c.maxHp + 1);
    expect(out.dropped).toBe(true);
    expect(c.hp).toBe(0);
    expect(c.conditions.some((x) => x.id === 'unconscious')).toBe(true);
    damageCharacter(c, 100);
    expect(c.status).toBe('dead');
  });

  it('easy mode never kills outright from massive damage', () => {
    const c = createCharacter('u1', wizardDraft);
    const out = damageCharacter(c, 100, { massiveDamage: false });
    expect(out.died).toBe(false);
    expect(c.status).toBe('alive');
    expect(c.hp).toBe(0);
    damageCharacter(c, 100, { massiveDamage: false });
    expect(c.status).toBe('alive');
    expect(c.deathSaves.failures).toBe(1);
  });

  it('half-orcs stay up once', () => {
    const c = createCharacter('u1', { ...fighterDraft, race: 'half_orc' });
    const out = damageCharacter(c, c.hp);
    expect(out.relentless).toBe(true);
    expect(c.hp).toBe(1);
  });

  it('heals and wakes', () => {
    const c = createCharacter('u1', clericDraft);
    damageCharacter(c, c.hp);
    healCharacter(c, 5);
    expect(c.hp).toBe(5);
    expect(c.conditions.length).toBe(0);
  });

  it('levels up with xp', () => {
    const c = createCharacter('u1', wizardDraft);
    const r = awardXp(c, 900);
    expect(r?.to).toBe(3);
    expect(c.level).toBe(3);
    expect(c.spellSlots.max).toEqual([4, 2]);
    expect(c.spells).toContain('scorching_ray');
    awardXp(c, 6500);
    expect(c.level).toBe(5);
    expect(c.abilities.int).toBe(18);
    expect(c.spells).toContain('fireball');
  });

  it('rests restore resources', () => {
    const c = createCharacter('u1', fighterDraft);
    awardXp(c, 300);
    c.hp = 3;
    c.featureUses.used_second_wind = 1;
    const sr = shortRest(c, seededRng(1));
    expect(sr.hitDiceSpent).toBeGreaterThan(0);
    expect(c.featureUses.used_second_wind).toBeUndefined();
    c.hp = 1;
    longRest(c);
    expect(c.hp).toBe(c.maxHp);
  });

  it('manages inventory', () => {
    const c = createCharacter('u1', fighterDraft);
    addItem(c, 'healing_potion', 2);
    expect(c.inventory.find((i) => i.itemId === 'healing_potion')!.qty).toBe(3);
    addItem(c, 'custom', 1, { name: 'Silver Key' });
    expect(removeItem(c, 'Silver Key')).toBe(1);
    expect(c.inventory.some((i) => i.name === 'Silver Key')).toBe(false);
  });
});
