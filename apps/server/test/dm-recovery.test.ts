import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import type { CampaignView, TurnEvent } from '@dmai/shared';
import { seededRng } from '@dmai/rules';
import { Store } from '../src/db';
import { GameEngine } from '../src/game/engine';
import type { ContentBlock, ModelClient, ModelRequest, ModelResponse, NarrationCallbacks } from '../src/dm/model';
import { checkProtocol } from './helpers/protocol';

let n = 0;
const tu = (name: string, input: object): ContentBlock => ({ type: 'tool_use', id: `toolu_r${++n}`, name, input }) as unknown as ContentBlock;
const choices = (narration: string) => [tu('present_choices', { narration, choices: [{ id: 'a', label: 'Go on', consequence: 'x' }] })];

class ScriptedModel implements ModelClient {
  readonly name = 'scripted';
  calls: ModelRequest[] = [];
  constructor(private script: (ContentBlock[] | 'throw' | Error)[]) {}
  async create(req: ModelRequest, cb: NarrationCallbacks): Promise<ModelResponse> {
    this.calls.push({ ...req, messages: [...req.messages] });
    const step = this.script.shift();
    if (step instanceof Error) throw step;
    if (!step || step === 'throw') throw new Error('network down');
    step.forEach((b, i) => {
      if (b.type === 'tool_use') {
        cb.onStart(i);
        cb.onDelta(i, (b.input as { narration: string }).narration);
      }
    });
    return { content: step, stopReason: 'tool_use', usage: { input: 100, output: 20, cacheRead: 0, cacheWrite: 0 } };
  }
}

const firstText = (req: ModelRequest) => {
  const m = req.messages[0]!;
  const blocks = m.content as { type: string; text?: string }[];
  return blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
};

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
  return { store, act, id: v.id };
}

describe('DM failure recovery', () => {
  it('a failed opening can be retried and still carries the adventure setup', async () => {
    const model = new ScriptedModel(['throw', choices('Han sessiz.')]);
    const { act, store, id } = setup(model);
    let { view, ev } = await act({ type: 'begin' });
    expect(ev.some((e) => e.type === 'error' && e.code === 'dm_unavailable')).toBe(true);
    expect(view.needsRetry).toBe(true);
    expect(view.needsContinue).toBe(true);
    // The text input is locked server-side too.
    ({ ev } = await act({ type: 'say', text: 'hello' }));
    expect(ev.some((e) => e.type === 'error' && e.code === 'retry_pending')).toBe(true);
    expect(model.calls).toHaveLength(1);

    ({ view } = await act({ type: 'continue' }));
    expect(model.calls).toHaveLength(2);
    expect(firstText(model.calls[1]!)).toBe(firstText(model.calls[0]!));
    expect(firstText(model.calls[1]!)).toContain('Begin the adventure');
    expect(firstText(model.calls[1]!)).toContain('willow_inn');
    expect(view.needsRetry).toBe(false);
    expect(view.pending?.type).toBe('choice');
    expect(view.log.some((l) => l.kind === 'dm' && l.text === 'Han sessiz.')).toBe(true);
    expect(store.getCampaign(id)!.transcript).toHaveLength(2);
    checkProtocol(store.getCampaign(id)!.transcript);
  });

  it('a mid-game failure keeps the player text, retry delivers it, and the log has it once', async () => {
    const model = new ScriptedModel([choices('Başlangıç.'), 'throw', choices('Marta yanıtlıyor.')]);
    const { act, store, id } = setup(model);
    await act({ type: 'begin' });
    let { view } = await act({ type: 'say', text: 'Marta ile konuşuyorum' });
    expect(view.needsRetry).toBe(true);
    const said = () => view.log.filter((l) => l.kind === 'player' && l.text === 'Marta ile konuşuyorum').length;
    expect(said()).toBe(1);

    ({ view } = await act({ type: 'continue' }));
    expect(model.calls).toHaveLength(3);
    const last = model.calls[2]!.messages.at(-1)!;
    const text = (last.content as { type: string; text?: string }[]).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    expect(text).toContain('Marta ile konuşuyorum');
    expect(said()).toBe(1);
    expect(view.needsRetry).toBe(false);
    expect(view.log.some((l) => l.kind === 'dm' && l.text === 'Marta yanıtlıyor.')).toBe(true);
    checkProtocol(store.getCampaign(id)!.transcript);
  });

  it('logs turn duration and token usage', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      const { act } = setup(new ScriptedModel([choices('Merhaba.')]));
      await act({ type: 'begin' });
      const line = spy.mock.calls.map((c) => String(c[0])).find((l) => l.startsWith('[dm] turn='));
      expect(line).toMatch(/ms=\d+ calls=1 in=100 out=20/);
    } finally {
      spy.mockRestore();
    }
  });

  it('the opening message says turn 1, also when it is retried', async () => {
    const model = new ScriptedModel(['throw', choices('Han sessiz.')]);
    const { act } = setup(model);
    await act({ type: 'begin' });
    await act({ type: 'continue' });
    for (const call of model.calls) {
      expect(firstText(call)).toContain('Turn 1.');
      expect(firstText(call)).not.toContain('Turn 0');
    }
  });

  it('a failure after the first call tells the player to act, and the UI agrees', async () => {
    const model = new ScriptedModel([choices('Başlangıç.'), [tu('award_xp', { amount: 5, reason: 'x' })], 'throw', choices('Devam.')]);
    const { act, store, id } = setup(model);
    await act({ type: 'begin' });
    let { view } = await act({ type: 'say', text: 'bakıyorum' });
    expect(model.calls).toHaveLength(3);
    expect(view.needsContinue).toBe(false);
    expect(view.needsRetry).toBe(false);
    const last = view.log.filter((l) => l.kind === 'system').at(-1)!;
    expect(last.kind === 'system' && last.text).toContain('hamleni gönder');
    expect(last.kind === 'system' && last.text).not.toMatch(/Devam'a dokun|Continue/);
    ({ view } = await act({ type: 'say', text: 'devam ediyorum' }));
    expect(model.calls).toHaveLength(4);
    expect(view.log.some((l) => l.kind === 'dm' && l.text === 'Devam.')).toBe(true);
    expect(store.getCampaign(id)).toBeTruthy();
  });

  it('a failed closing narration on an ended campaign can be retried', async () => {
    const model = new ScriptedModel(['throw', choices('Son.')]);
    const { act, store, id } = setup(model);
    // Simulate: the hero died and the narration call failed.
    const row = store.getCampaign(id)!;
    row.state.status = 'defeat';
    row.state.unsent = { text: 'The hero has fallen. Narrate the end.' };
    store.saveCampaign(row.state, row.transcript);
    let { view, ev } = await act({ type: 'say', text: 'hello' });
    expect(ev.some((e) => e.type === 'error' && e.code === 'campaign_over')).toBe(true);
    expect(view.needsRetry).toBe(true);
    expect(view.needsContinue).toBe(true);
    expect(model.calls).toHaveLength(0);

    ({ view, ev } = await act({ type: 'continue' })); // still failing
    expect(ev.some((e) => e.type === 'error' && e.code === 'dm_unavailable')).toBe(true);
    expect(view.needsRetry).toBe(true);
    ({ view, ev } = await act({ type: 'continue' }));
    expect(ev.some((e) => e.type === 'error')).toBe(false);
    expect(model.calls).toHaveLength(2);
    expect(view.needsRetry).toBe(false);
    expect(view.needsContinue).toBe(false);
    expect(view.status).toBe('defeat');
    expect(view.log.some((l) => l.kind === 'dm' && l.text === 'Son.')).toBe(true);
    checkProtocol(store.getCampaign(id)!.transcript);
  });

  it('transient errors keep the retry flow, non-transient ones free the player', async () => {
    const hdr = new Headers();
    const api = (status: number, type: string) => new Anthropic.APIError(status, { type: 'error', error: { type, message: 'm' } }, 'm', hdr);
    for (const err of [api(429, 'rate_limit_error'), api(500, 'api_error'), api(529, 'overloaded_error'), new Anthropic.APIConnectionError({ message: 'down' })]) {
      const { act } = setup(new ScriptedModel([choices('Başlangıç.'), err]));
      await act({ type: 'begin' });
      const { view, ev } = await act({ type: 'say', text: 'merhaba' });
      expect(ev.some((e) => e.type === 'error' && e.code === 'dm_unavailable')).toBe(true);
      expect(view.needsRetry).toBe(true);
    }

    const model = new ScriptedModel([choices('Başlangıç.'), api(400, 'invalid_request_error'), choices('Tamam.')]);
    const { act, store, id } = setup(model);
    await act({ type: 'begin' });
    let { view, ev } = await act({ type: 'say', text: 'bozuk' });
    expect(ev.some((e) => e.type === 'error' && e.code === 'dm_rejected')).toBe(true);
    expect(view.needsRetry).toBe(false);
    expect(store.getCampaign(id)!.state.unsent).toBeNull();
    ({ view, ev } = await act({ type: 'say', text: 'başka' }));
    expect(ev.some((e) => e.type === 'error')).toBe(false);
    expect(view.log.some((l) => l.kind === 'dm' && l.text === 'Tamam.')).toBe(true);
    checkProtocol(store.getCampaign(id)!.transcript);
  });

  it('a rejected opening can be begun again', async () => {
    const err = new Anthropic.APIError(400, { type: 'error', error: { type: 'invalid_request_error', message: 'm' } }, 'm', new Headers());
    const model = new ScriptedModel([err, choices('Han sessiz.')]);
    const { act } = setup(model);
    let { view, ev } = await act({ type: 'begin' });
    expect(ev.some((e) => e.type === 'error' && e.code === 'dm_rejected')).toBe(true);
    expect(view.turn).toBe(0);
    expect(view.needsRetry).toBe(false);
    ({ view, ev } = await act({ type: 'begin' }));
    expect(ev.some((e) => e.type === 'error')).toBe(false);
    expect(view.turn).toBe(1);
    expect(firstText(model.calls[1]!)).toContain('Turn 1.');
  });
});
