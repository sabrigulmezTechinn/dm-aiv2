import { describe, expect, it } from 'vitest';
import type { CampaignView, TurnEvent } from '@dmai/shared';
import { seededRng } from '@dmai/rules';
import { Store } from '../src/db';
import { GameEngine } from '../src/game/engine';
import { MockModel } from '../src/dm/mock';
import { createApp } from '../src/app';
import { JsonFieldStreamer } from '../src/dm/stream-json';
import { checkProtocol } from './helpers/protocol';

function setup(seed = 3) {
  const store = new Store(':memory:');
  const engine = new GameEngine(store, new MockModel(), seededRng(seed));
  const app = createApp(store, engine, { corsOrigin: '*', provider: 'mock' });
  return { store, engine, app };
}

async function json(res: Response) {
  return (await res.json()) as any;
}

describe('JsonFieldStreamer', () => {
  it('decodes a field across chunks with escapes', () => {
    const s = new JsonFieldStreamer(['narration']);
    const full = JSON.stringify({ narration: 'Merhaba "dünya"\nİkinci satır ç 😀', choices: [] });
    let out = '';
    for (let i = 0; i < full.length; i += 3) out += s.push(full.slice(i, i + 3));
    expect(out).toBe('Merhaba "dünya"\nİkinci satır ç 😀');
  });
});

describe('mock playthrough', () => {
  it('plays the Willow Inn from start to finish', async () => {
    const { app, store } = setup();
    const auth = await json(await app.request('/api/auth/anonymous', { method: 'POST' }));
    const H = { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' };
    const ch = await json(
      await app.request('/api/characters', {
        method: 'POST',
        headers: H,
        body: JSON.stringify({ name: 'Brom', color: '#aa3322', race: 'half_orc', class: 'fighter', baseAbilities: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 }, skills: ['athletics', 'perception'] }),
      }),
    );
    expect(ch.id).toBeTruthy();
    const view0: CampaignView = await json(await app.request('/api/campaigns', { method: 'POST', headers: H, body: JSON.stringify({ characterId: ch.id, adventureId: 'willow_inn', difficulty: 'easy', locale: 'en' }) }));
    expect(view0.map?.kind).toBe('tavern');
    const id = view0.id;

    const act = async (action: object): Promise<{ view: CampaignView; events: TurnEvent[] }> => {
      const res = await json(await app.request(`/api/campaigns/${id}/actions?stream=0`, { method: 'POST', headers: H, body: JSON.stringify(action) }));
      const events = res.events as TurnEvent[];
      const last = [...events].reverse().find((e) => e.type === 'state') as { view: CampaignView };
      return { view: last.view, events };
    };

    let { view } = await act({ type: 'begin' });
    expect(view.pending?.type).toBe('choice');
    expect(view.log.some((l) => l.kind === 'dm')).toBe(true);

    ({ view } = await act({ type: 'choose', choiceId: 'c1' }));
    expect(view.npcs.some((n) => n.name === 'Marta')).toBe(true);

    ({ view } = await act({ type: 'say', text: 'I search the common room' }));
    expect(view.pending?.type).toBe('check');
    const bad = await act({ type: 'say', text: 'nope' });
    expect(bad.events.some((e) => e.type === 'error')).toBe(true);
    ({ view } = await act({ type: 'roll' }));
    expect(view.log.some((l) => l.kind === 'roll')).toBe(true);
    expect(view.pending?.type).toBe('choice');

    const fightUntilOver = async () => {
      for (let i = 0; i < 80 && view.combat; i++) {
        if (view.pending?.type === 'death_save') {
          ({ view } = await act({ type: 'death_save' }));
          continue;
        }
        const pid = view.playerCombatantId!;
        expect(view.combat.order[view.combat.turnIndex]).toBe(pid);
        const me = view.combat.combatants[pid]!;
        const foe = Object.values(view.combat.combatants).find((c) => c.team === 'enemy' && !c.dead && !c.fled);
        if (foe) {
          const cheb = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
          const near = view.moveTargets.filter((t) => cheb(t, foe) === 1).sort((a, b) => cheb(a, me) - cheb(b, me));
          if (cheb(me, foe) > 1 && near[0]) ({ view } = await act({ type: 'combat', action: { kind: 'move', x: near[0].x, y: near[0].y } }));
          if (view.combat && view.pending?.type !== 'death_save') ({ view } = await act({ type: 'combat', action: { kind: 'attack', targetId: foe.id } }));
        }
        if (view.combat && view.pending?.type !== 'death_save' && view.combat.order[view.combat.turnIndex] === view.playerCombatantId) ({ view } = await act({ type: 'combat', action: { kind: 'end_turn' } }));
        if (view.status !== 'active') return;
      }
    };

    for (const step of ['Go down to the cellar', 'attack', 'Climb through the broken wall', 'attack', 'Follow the drag marks', 'attack', 'Free Elin']) {
      if (view.status !== 'active') break;
      if (view.character.hp < view.character.maxHp / 2 && !view.combat) ({ view } = await act({ type: 'rest', kind: 'long' }));
      ({ view } = await act({ type: 'say', text: step }));
      if (view.pending?.type === 'check') ({ view } = await act({ type: 'roll' }));
      if (view.combat) await fightUntilOver();
    }
    expect(['victory', 'defeat']).toContain(view.status);
    expect(view.ending).toBeTruthy();
    const row = store.getCampaign(id)!;
    checkProtocol(row.transcript);
    const after = store.getCharacter(ch.id)!;
    if (after.status === 'alive') expect(after.activeCampaignId).toBeNull();
    else expect(after.epitaph).toBeTruthy();
  }, 30_000);

  it('rejects other users and bad input', async () => {
    const { app } = setup();
    const a = await json(await app.request('/api/auth/anonymous', { method: 'POST' }));
    const b = await json(await app.request('/api/auth/anonymous', { method: 'POST' }));
    const HA = { Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json' };
    const HB = { Authorization: `Bearer ${b.token}`, 'Content-Type': 'application/json' };
    const ch = await json(await app.request('/api/characters', { method: 'POST', headers: HA, body: JSON.stringify({ name: 'X', color: '#123456', race: 'human', class: 'wizard', baseAbilities: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 }, skills: ['arcana', 'history'] }) }));
    expect((await app.request(`/api/characters/${ch.id}`, { headers: HB })).status).toBe(404);
    expect((await app.request('/api/characters', { headers: {} })).status).toBe(401);
    const badDraft = await app.request('/api/characters', { method: 'POST', headers: HA, body: JSON.stringify({ name: 'Y', color: '#123456', race: 'human', class: 'wizard', baseAbilities: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 }, skills: ['stealth', 'history'] }) });
    expect(badDraft.status).toBe(400);
    const cmp = await json(await app.request('/api/campaigns', { method: 'POST', headers: HA, body: JSON.stringify({ characterId: ch.id, adventureId: 'lost_caravan', difficulty: 'hard', locale: 'tr' }) }));
    expect(cmp.scene.kind).toBe('outdoor');
    expect(cmp.map).toBeNull();
    const busy = await app.request('/api/campaigns', { method: 'POST', headers: HA, body: JSON.stringify({ characterId: ch.id, adventureId: 'willow_inn', difficulty: 'hard', locale: 'tr' }) });
    expect(busy.status).toBe(400);
    expect((await app.request(`/api/campaigns/${cmp.id}`, { headers: HB })).status).toBe(404);
  });

  it('runs outdoor fights on a generated battlefield', async () => {
    const { app } = setup(5);
    const a = await json(await app.request('/api/auth/anonymous', { method: 'POST' }));
    const H = { Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json' };
    const ch = await json(await app.request('/api/characters', { method: 'POST', headers: H, body: JSON.stringify({ name: 'Ilyra', color: '#3355cc', race: 'high_elf', class: 'wizard', baseAbilities: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 }, skills: ['arcana', 'history'] }) }));
    const cmp = await json(await app.request('/api/campaigns', { method: 'POST', headers: H, body: JSON.stringify({ characterId: ch.id, adventureId: 'lost_caravan', difficulty: 'easy', locale: 'en' }) }));
    const act = async (action: object) => {
      const res = await json(await app.request(`/api/campaigns/${cmp.id}/actions?stream=0`, { method: 'POST', headers: H, body: JSON.stringify(action) }));
      return ([...res.events].reverse().find((e: TurnEvent) => e.type === 'state') as { view: CampaignView }).view;
    };
    await act({ type: 'begin' });
    let view = await act({ type: 'say', text: 'attack the wolves' });
    expect(view.combat).not.toBeNull();
    expect(view.map?.kind).toBe('battlefield');
    const foe = Object.values(view.combat!.combatants).find((c) => c.team === 'enemy' && !c.dead)!;
    if (view.combat!.order[view.combat!.turnIndex] === view.playerCombatantId && view.character.hp > 0) {
      view = await act({ type: 'combat', action: { kind: 'cast', spellId: 'magic_missile', targetId: foe.id } });
      expect(view.character.spellSlots.used[0]).toBe(1);
    }
  });
});
