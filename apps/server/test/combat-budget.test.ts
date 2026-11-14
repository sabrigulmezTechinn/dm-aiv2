import { describe, expect, it } from 'vitest';
import { createCharacter, seededRng } from '@dmai/rules';
import { ADVENTURES } from '../src/adventures';
import { createCampaignState } from '../src/game/state';
import { applyCombatOutcome, runTool, type TurnCtx } from '../src/dm/tools';

function mk(adventureId: string, difficulty: 'easy' | 'hard' = 'easy') {
  const character = createCharacter('u', { name: 'Sera', color: '#ddcc44', race: 'human', class: 'cleric', baseAbilities: { str: 14, dex: 10, con: 13, int: 8, wis: 15, cha: 12 }, skills: ['medicine', 'religion'] });
  const adventure = ADVENTURES[adventureId]!;
  const state = createCampaignState({ userId: 'u', character, adventure, difficulty, locale: 'en' });
  const ctx: TurnCtx = { state, character, adventure, emit: () => {}, emitState: () => {}, rng: seededRng(5) };
  return { ctx, state, character, adventure };
}

describe('encounter budget', () => {
  it('lightens an overpowered fight and tells the DM', () => {
    const { ctx, state } = mk('willow_inn');
    const r = runTool('start_combat', { enemies: [{ monster_id: 'goblin', count: 6 }] }, ctx);
    expect(r.isError).toBeFalsy();
    expect(r.content).toContain('ENCOUNTER LIGHTENED');
    const foes = Object.values(state.combat!.combatants).filter((c) => c.team === 'enemy');
    expect(foes.length).toBeGreaterThanOrEqual(1);
    expect(foes.length).toBeLessThan(6);
  });
  it('leaves a single weak enemy alone', () => {
    const { ctx, state } = mk('willow_inn');
    const r = runTool('start_combat', { enemies: [{ monster_id: 'giant_rat', count: 1 }] }, ctx);
    expect(r.content).not.toContain('LIGHTENED');
    expect(Object.values(state.combat!.combatants).filter((c) => c.team === 'enemy')).toHaveLength(1);
  });
});

describe('milestone XP', () => {
  it('awards once per new scene and reaches level 3 on the last scene', () => {
    const { ctx, character, adventure } = mk('willow_inn');
    const ids = Object.keys(adventure.scenes).filter((s) => s !== adventure.startScene);
    const first = runTool('change_scene', { scene_id: ids[0] }, ctx);
    expect(first.content).toContain('Milestone');
    const xp1 = character.xp;
    expect(xp1).toBeGreaterThan(0);
    runTool('change_scene', { scene_id: adventure.startScene }, ctx);
    runTool('change_scene', { scene_id: ids[0] }, ctx);
    expect(character.xp).toBe(xp1);
    for (const id of ids.slice(1)) runTool('change_scene', { scene_id: id }, ctx);
    expect(character.xp).toBe(900);
    expect(character.level).toBe(3);
  });
  it('gives nothing for the start scene or improvised scenes', () => {
    const { ctx, character, adventure } = mk('lost_caravan');
    runTool('change_scene', { scene_id: 'improv', name: 'Clearing', kind: 'outdoor' }, ctx);
    runTool('change_scene', { scene_id: adventure.startScene }, ctx);
    expect(character.xp).toBe(0);
  });
});

describe('combat end tone', () => {
  const last = (s: ReturnType<typeof mk>['state'], text: string) => s.log.find((l) => l.kind === 'system' && l.text.includes(text)) as { tone: string } | undefined;
  it('is good only for victory', () => {
    const v = mk('willow_inn');
    runTool('start_combat', { enemies: [{ monster_id: 'giant_rat', count: 1 }] }, v.ctx);
    applyCombatOutcome(v.ctx, 'victory', 0);
    expect(last(v.state, 'The fight is over')?.tone).toBe('good');

    const c = mk('willow_inn');
    runTool('start_combat', { enemies: [{ monster_id: 'giant_rat', count: 1 }] }, c.ctx);
    applyCombatOutcome(c.ctx, 'captured', 0);
    expect(last(c.state, 'defeated')?.tone).toBe('bad');

    const e = mk('willow_inn');
    runTool('start_combat', { enemies: [{ monster_id: 'giant_rat', count: 1 }] }, e.ctx);
    runTool('end_combat', { outcome: 'truce' }, e.ctx);
    expect(last(e.state, 'has ended')?.tone).toBe('info');
  });
});
