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
  constructor(private script: (ContentBlock[] | 'throw')[]) {}
  async create(req: ModelRequest, cb: NarrationCallbacks): Promise<ModelResponse> {
    this.calls.push({ ...req, messages: [...req.messages] });
    const step = this.script.shift();
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
});
