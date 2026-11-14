import { MONSTERS, adjustedXp, encounterBudget, levelForXp, milestoneXpPlan } from '@dmai/rules';
import { describe, expect, it } from 'vitest';
import { ADVENTURES, npcDescription, npcName, sceneEncounter } from '../src/adventures';

const enc = (adv: string, scene: string, d: 'easy' | 'hard' = 'easy') =>
  (sceneEncounter(ADVENTURES[adv]!.scenes[scene]!, d) ?? []).map((e) => `${e.count}x${e.monsterId}`).sort().join(',');

describe('adventure encounters are balanced for a solo level 1 hero', () => {
  it('Willow Inn', () => {
    expect(enc('willow_inn', 'inn_cellar')).toBe('1xgiant_rat');
    expect(enc('willow_inn', 'old_tunnels')).toBe('1xskeleton');
    expect(enc('willow_inn', 'old_tunnels', 'hard')).toBe('1xcultist,1xskeleton');
    expect(enc('willow_inn', 'ritual_chamber')).toBe('1xvarek_thorn');
    expect(enc('willow_inn', 'ritual_chamber', 'hard')).toBe('1xvarek_thorn,1xzombie');
  });
  it('Varek profile is weak (about CR 1/2, 22 HP)', () => {
    const v = MONSTERS.varek_thorn!;
    expect(v.cr).toBe('1/2');
    expect(v.hp).toBe('4d8+4');
  });
  it('Lost Caravan', () => {
    expect(enc('lost_caravan', 'forest_road')).toBe('1xwolf');
    expect(enc('lost_caravan', 'forest_road', 'hard')).toBe('1xwolf');
    expect(enc('lost_caravan', 'goblin_cave')).toBe('1xskrag');
    expect(enc('lost_caravan', 'goblin_cave', 'hard')).toBe('1xgoblin,1xskrag');
    expect(ADVENTURES.lost_caravan!.scenes.ogre_den!.encounter).toBeUndefined();
    expect(ADVENTURES.lost_caravan!.brief).toMatch(/OBSTACLE/);
  });
  it('every encounter monster exists', () => {
    for (const a of Object.values(ADVENTURES))
      for (const s of Object.values(a.scenes))
        for (const e of [...(s.encounter ?? []), ...(s.encounterHard ?? [])]) expect(MONSTERS[e.monsterId]).toBeDefined();
  });
});

describe('designed encounters fit the budget at the level the hero has on arrival', () => {
  for (const a of Object.values(ADVENTURES))
    for (const d of ['easy', 'hard'] as const)
      it(`${a.id} (${d})`, () => {
        const plan = milestoneXpPlan(Object.keys(a.scenes), a.startScene);
        let xp = 0;
        for (const [id, scene] of Object.entries(a.scenes)) {
          xp += plan[id] ?? 0;
          const e = sceneEncounter(scene, d);
          if (!e) continue;
          expect(adjustedXp(e), `${a.id}/${id}`).toBeLessThanOrEqual(encounterBudget(levelForXp(xp), d));
        }
      });
});

describe('bilingual NPCs', () => {
  it('has Turkish names and descriptions', () => {
    const tobin = ADVENTURES.willow_inn!.scenes.willow_inn!.npcs.find((n) => n.id === 'npc_tobin')!;
    expect(npcName(tobin, 'en')).toBe('Old Tobin');
    expect(npcName(tobin, 'tr')).toBe('Yaşlı Tobin');
    expect(npcDescription(tobin, 'tr')).not.toBe(npcDescription(tobin, 'en'));
    for (const a of Object.values(ADVENTURES))
      for (const s of Object.values(a.scenes))
        for (const n of s.npcs) {
          expect(n.nameTr).toBeTruthy();
          expect(n.descriptionTr).toBeTruthy();
          expect(n.descriptionTr).not.toBe(n.description);
        }
  });
});
