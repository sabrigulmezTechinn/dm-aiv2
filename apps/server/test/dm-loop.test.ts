import { describe, expect, it } from 'vitest';
import type { CampaignView, TurnEvent } from '@dmai/shared';
import { seededRng } from '@dmai/rules';
import { Store } from '../src/db';
import { GameEngine } from '../src/game/engine';
import { MockModel } from '../src/dm/mock';
import type { ContentBlock, ModelClient, ModelRequest, ModelResponse, NarrationCallbacks } from '../src/dm/model';
import { checkProtocol } from './helpers/protocol';

let n = 0;
const tu = (name: string, input: object): ContentBlock => ({ type: 'tool_use', id: `toolu_${++n}`, name, input }) as unknown as ContentBlock;

/** Replays a fixed list of responses; a function entry can throw or inspect the request. */
class ScriptedModel implements ModelClient {
  readonly name = 'scripted';
  calls: ModelRequest[] = [];
  constructor(private script: (ContentBlock[] | ((req: ModelRequest) => ContentBlock[]) | 'throw' | 'refusal')[]) {}
  async create(req: ModelRequest, cb: NarrationCallbacks): Promise<ModelResponse> {
    this.calls.push({ ...req, messages: [...req.messages] });
    const step = this.script.shift();
    if (!step || step === 'throw') throw new Error('network down');
    if (step === 'refusal') return { content: [], stopReason: 'refusal' };
    const content = typeof step === 'function' ? step(req) : step;
    content.forEach((b, i) => {
      if (b.type === 'tool_use' && (b.input as { narration?: string }).narration) {
        cb.onStart(i);
        cb.onDelta(i, (b.input as { narration: string }).narration);
      }
    });
    return { content, stopReason: content.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn' };
  }
}

function setup(model: ModelClient) {
  const store = new Store(':memory:');
  const engine = new GameEngine(store, model, seededRng(11));
  const c = engine.createCharacter('u', { name: 'Sera', color: '#ddcc44', race: 'human', class: 'cleric', baseAbilities: { str: 14, dex: 10, con: 13, int: 8, wis: 15, cha: 12 }, skills: ['medicine', 'religion'] });
  const v = engine.createCampaign('u', { characterId: c.id, adventureId: 'willow_inn', difficulty: 'hard', locale: 'tr' });
  const act = async (a: object) => {
    const ev: TurnEvent[] = [];
    await engine.act('u', v.id, a as never, (e) => ev.push(e));
    const view = ([...ev].reverse().find((e) => e.type === 'state') as { view: CampaignView }).view;
    return { view, ev };
  };
  return { store, engine, act, id: v.id, characterId: c.id };
}

describe('DM loop', () => {
  it('runs non-pausing tools, then pauses on present_choices, and answers with tool results', async () => {
    const model = new ScriptedModel([
      [tu('update_npc', { id: 'npc_marta', name: 'Marta', attitude: 2, note: 'Seni sıcak karşıladı.' }), tu('give_item', { item_id: 'custom', name: 'Mahzen Anahtarı' })],
      [tu('present_choices', { narration: 'Marta anahtarı avucuna bırakıyor.', choices: [{ id: 'cellar', label: 'Mahzene in', consequence: 'rats wait below' }, { id: 'tobin', label: "Tobin'le konuş", consequence: 'he knows the tunnels' }] })],
      [tu('request_check', { narration: 'Merdivenler kaygan.', kind: 'skill', key: 'athletics', dc: 12, reason: 'Dengeni koru' })],
      [tu('present_choices', { narration: 'Aşağıdasın.', choices: [] })],
    ]);
    const { act, store, id } = setup(model);
    let { view, ev } = await act({ type: 'begin' });
    expect(model.calls).toHaveLength(2);
    expect(view.pending).toEqual({ type: 'choice', choices: [{ id: 'cellar', label: 'Mahzene in' }, { id: 'tobin', label: "Tobin'le konuş" }] });
    expect(view.character.inventory.some((i) => i.name === 'Mahzen Anahtarı')).toBe(true);
    expect(view.npcs.find((x) => x.id === 'npc_marta')?.attitude).toBe(2);
    expect(ev.some((e) => e.type === 'narration_delta')).toBe(true);
    // Secret consequences never reach the client.
    expect(JSON.stringify(view)).not.toContain('rats wait below');

    ({ view } = await act({ type: 'choose', choiceId: 'cellar' }));
    const lastReq = model.calls[2]!.messages;
    const userMsg = lastReq[lastReq.length - 1]!;
    const blocks = userMsg.content as { type: string; content?: string }[];
    expect(blocks[0]!.type).toBe('tool_result');
    expect(blocks[0]!.content).toContain('rats wait below');
    expect(view.pending?.type).toBe('check');

    ({ view } = await act({ type: 'roll' }));
    const rollReq = model.calls[3]!.messages;
    const rb = rollReq[rollReq.length - 1]!.content as { type: string; content?: string }[];
    expect(rb[0]!.content).toMatch(/Check result .* (SUCCESS|FAILURE)/);
    expect(view.pending).toBeNull();
    checkProtocol(store.getCampaign(id)!.transcript);
  });

  it('keeps results when the model is unavailable and resumes with continue', async () => {
    const model = new ScriptedModel([
      [tu('request_check', { narration: 'Kapı kilitli.', kind: 'skill', key: 'athletics', dc: 15, reason: 'Kapıyı kır' })],
      'throw',
      [tu('present_choices', { narration: 'Kapı açılıyor.', choices: [] })],
    ]);
    const { act, store, id } = setup(model);
    await act({ type: 'begin' });
    let { view, ev } = await act({ type: 'roll' });
    expect(ev.some((e) => e.type === 'error' && e.code === 'dm_unavailable')).toBe(true);
    expect(view.needsContinue).toBe(true);
    expect(view.pending).toBeNull();
    const rolls = view.log.filter((l) => l.kind === 'roll').length;
    ({ view } = await act({ type: 'continue' }));
    expect(view.needsContinue).toBe(false);
    expect(view.log.filter((l) => l.kind === 'roll').length).toBe(rolls);
    const req = model.calls[2]!.messages;
    expect((req[req.length - 1]!.content as { type: string }[])[0]!.type).toBe('tool_result');
    checkProtocol(store.getCampaign(id)!.transcript);
  });

  it('handles refusals and invalid tool input', async () => {
    const model = new ScriptedModel([
      [tu('request_check', { narration: 'x', kind: 'skill', key: 'str', dc: 12, reason: 'bad' })],
      [tu('present_choices', { narration: 'Tamam.', choices: [] })],
      'refusal',
      [tu('present_choices', { narration: 'Devam.', choices: [] })],
    ]);
    const { act, store, id } = setup(model);
    let { view } = await act({ type: 'begin' });
    // The invalid check was rejected with an error result and the model retried.
    const second = model.calls[1]!.messages;
    const res = (second[second.length - 1]!.content as { type: string; is_error?: boolean }[])[0]!;
    expect(res.is_error).toBe(true);
    ({ view } = await act({ type: 'say', text: 'Bir şey yap' }));
    expect(view.log.some((l) => l.kind === 'system' && /duraksıyor/.test(l.text))).toBe(true);
    ({ view } = await act({ type: 'say', text: 'Tekrar dene' }));
    expect(view.log.at(-1)?.kind).toBe('dm');
    checkProtocol(store.getCampaign(id)!.transcript);
  });

  it('survives many seeded mock playthroughs without internal errors', async () => {
    for (let seed = 1; seed <= 40; seed++) {
      const store = new Store(':memory:');
      const engine = new GameEngine(store, new MockModel(), seededRng(seed));
      const cls = (['fighter', 'rogue', 'wizard', 'cleric'] as const)[seed % 4]!;
      const skills = { fighter: ['athletics', 'perception'], rogue: ['acrobatics', 'perception', 'stealth', 'deception'], wizard: ['arcana', 'history'], cleric: ['medicine', 'religion'] }[cls];
      const c = engine.createCharacter('u', { name: 'T', color: '#123456', race: 'human', class: cls, baseAbilities: { str: 14, dex: 14, con: 14, int: 12, wis: 12, cha: 10 }, skills: skills as never });
      const v = engine.createCampaign('u', { characterId: c.id, adventureId: seed % 2 ? 'willow_inn' : 'lost_caravan', difficulty: seed % 3 ? 'easy' : 'hard', locale: seed % 2 ? 'tr' : 'en' });
      let view: CampaignView = v;
      const errors: string[] = [];
      const act = async (a: object) => {
        const ev: TurnEvent[] = [];
        await engine.act('u', v.id, a as never, (e) => ev.push(e));
        for (const e of ev) if (e.type === 'error' && e.code === 'internal') errors.push(e.message);
        view = ([...ev].reverse().find((e) => e.type === 'state') as { view: CampaignView }).view;
        // Invariant: an active fight always waits on the player.
        if (view.combat && view.status === 'active') expect(view.combat.order[view.combat.turnIndex]).toBe(view.playerCombatantId);
      };
      await act({ type: 'begin' });
      for (let turn = 0; turn < 60 && view.status === 'active'; turn++) {
        if (view.pending?.type === 'check') await act({ type: 'roll' });
        else if (view.pending?.type === 'death_save') await act({ type: 'death_save' });
        else if (view.combat) {
          const foe = Object.values(view.combat.combatants).find((x) => x.team === 'enemy' && !x.dead && !x.fled);
          if (foe) {
            const spell = view.character.spells.find((s) => ['fire_bolt', 'sacred_flame', 'magic_missile'].includes(s));
            if (spell && turn % 2) await act({ type: 'combat', action: { kind: 'cast', spellId: spell, targetId: foe.id } });
            else await act({ type: 'combat', action: { kind: 'attack', targetId: foe.id } });
          }
          if (view.combat && !view.pending) await act({ type: 'combat', action: { kind: 'end_turn' } });
        } else if (view.pending?.type === 'choice') {
          const ch = view.pending.choices[turn % view.pending.choices.length]!;
          await act({ type: 'choose', choiceId: ch.id });
        } else await act({ type: 'say', text: ['attack', 'search', 'go on', 'talk'][turn % 4]! });
      }
      expect(errors).toEqual([]);
      checkProtocol(store.getCampaign(v.id)!.transcript);
    }
  }, 60_000);
});
