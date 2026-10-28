import type Anthropic from '@anthropic-ai/sdk';
import type { Locale } from '@dmai/shared';
import { uid } from '@dmai/shared';
import type { Adventure } from '../adventures';
import type { CampaignState } from '../game/state';
import type { ContentBlock, ModelClient, ModelRequest, ModelResponse, NarrationCallbacks } from './model';

type Block = Anthropic.Beta.Messages.BetaContentBlockParam;

const L = (locale: Locale, en: string, tr: string) => (locale === 'tr' ? tr : en);

function textOf(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (!Array.isArray(raw)) return '';
  const content = raw as Block[];
  return content
    .map((b) => (b.type === 'text' ? b.text : b.type === 'tool_result' ? (typeof b.content === 'string' ? b.content : (b.content ?? []).map((c) => (c.type === 'text' ? c.text : '')).join(' ')) : ''))
    .join('\n');
}

function toolUse(name: string, input: Record<string, unknown>): ContentBlock {
  return { type: 'tool_use', id: `toolu_mock_${uid('')}`, name, input, caller: { type: 'direct' } } as unknown as ContentBlock;
}

/**
 * Offline, rule-based Dungeon Master used when no API key is configured and in tests.
 * It exercises the same tool protocol as the real model.
 */
export class MockModel implements ModelClient {
  readonly name = 'mock';

  async create(req: ModelRequest, cb: NarrationCallbacks): Promise<ModelResponse> {
    const meta = req.meta;
    const last = req.messages[req.messages.length - 1];
    const prev = req.messages[req.messages.length - 2];
    if (!meta || !last) return this.finish([toolUse('present_choices', { narration: '...', choices: [] })], cb);
    const { state, adventure } = meta;
    const locale = state.locale;
    const lastText = textOf(last.content);
    // A follow-up call after non-pausing tools ran: just end the turn.
    const onlyResults = Array.isArray(last.content) && (last.content as Block[]).every((b) => b.type === 'tool_result');
    if (onlyResults && prev?.role === 'assistant') {
      return this.finish([toolUse('present_choices', { narration: this.afterTools(state, lastText), choices: this.choices(state, adventure) })], cb);
    }
    const blocks = this.decide(state, adventure, lastText, locale);
    return this.finish(blocks, cb);
  }

  private afterTools(state: CampaignState, results: string): string {
    const locale = state.locale;
    if (/Combat started/.test(results)) return L(locale, 'Steel flashes as your foes close in!', 'Düşmanların üzerine atılırken çelik parlıyor!');
    if (/Now at/.test(results)) return this.sceneIntro(state);
    if (/Rested/.test(results)) return L(locale, 'You rest a while and feel your strength return.', 'Bir süre dinleniyor ve gücünün geri geldiğini hissediyorsun.');
    return L(locale, 'The moment passes. What do you do next?', 'An geçiyor. Şimdi ne yapıyorsun?');
  }

  private sceneIntro(state: CampaignState): string {
    const locale = state.locale;
    const npcs = Object.values(state.npcs).filter((n) => n.present).map((n) => n.name);
    return L(
      locale,
      `You arrive at ${state.scene.name}. ${state.scene.description}${npcs.length ? ` You notice ${npcs.join(', ')}.` : ''}`,
      `${state.scene.name} konumuna varıyorsun. Etrafı dikkatle süzüyorsun.${npcs.length ? ` Burada ${npcs.join(', ')} var.` : ''}`,
    );
  }

  private choices(state: CampaignState, adventure: Adventure) {
    if (state.combat) return [];
    const list = adventure.mock.choices[state.sceneId] ?? [];
    return list.map((c, i) => ({ id: `c${i + 1}`, label: c[state.locale], consequence: 'mock' }));
  }

  private decide(state: CampaignState, adventure: Adventure, text: string, locale: Locale): ContentBlock[] {
    const choices = this.choices(state, adventure);
    const scene = adventure.scenes[state.sceneId];
    if (text.includes('<setup>')) {
      return [toolUse('present_choices', { narration: adventure.mock.opening[locale], choices })];
    }
    if (text.includes('Check result')) {
      const ok = /SUCCESS/.test(text);
      const narration = ok
        ? L(locale, 'It works. You find exactly what you were looking for, and a little more.', 'İşe yarıyor. Aradığını, hatta biraz fazlasını buluyorsun.')
        : L(locale, 'It does not go as planned. Something shifts in the shadows, and time is slipping away.', 'Planladığın gibi gitmiyor. Gölgelerde bir şey kıpırdıyor ve zaman daralıyor.');
      const blocks: ContentBlock[] = [];
      if (ok) blocks.push(toolUse('award_xp', { amount: 25, reason: L(locale, 'clever play', 'akıllıca hamle') }));
      if (ok && /Investigation|Araştırma|Perception|Algı/.test(text)) blocks.push(toolUse('give_item', { item_id: 'healing_potion', quantity: 1 }));
      blocks.push(toolUse('present_choices', { narration, choices }));
      return blocks;
    }
    if (text.includes('<combat_round>')) {
      const events = /<combat_round>([\s\S]*?)<\/combat_round>/.exec(text)?.[1]?.trim().split('\n').slice(-3).join(' ') ?? '';
      const over = /victory|Zafer|is over|sona erdi|fell and the enemies won/i.test(text);
      const narration = over
        ? L(locale, `The last foe falls and silence returns. ${events}`, `Son düşman da düşüyor ve sessizlik geri dönüyor. ${events}`)
        : L(locale, `Blades and bodies collide. ${events}`, `Kılıçlar ve bedenler çarpışıyor. ${events}`);
      if (/DIED|has died|öldü/.test(text)) {
        return [toolUse('end_adventure', { outcome: 'defeat', epilogue: L(locale, 'Your hero falls. The tale ends here.', 'Kahramanın düşüyor. Hikâye burada bitiyor.') })];
      }
      return [toolUse('present_choices', { narration, choices: over ? choices : [] })];
    }
    const action = (
      /Player: "([\s\S]*?)"\s*$/.exec(text)?.[1] ??
      /The player chose: "([^"]+)"/.exec(text)?.[1] ??
      (/Player requests a (short|long) rest/.test(text) ? 'rest' : '')
    ).toLowerCase();
    const tokens = action.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    // Short words must match exactly; longer ones may be stems ("saldır" matches "saldırıyorum").
    const has = (...words: string[]) => words.some((w) => (w.includes(' ') ? action.includes(w.trim()) : tokens.some((t) => (w.length <= 3 ? t === w : t.startsWith(w)))));

    if (has('free', 'rescue', 'kurtar', 'save elin', 'serbest') && !state.combat && !scene?.exits.some((e) => !state.scenes[e])) {
      return [
        toolUse('award_xp', { amount: 200, reason: L(locale, 'adventure complete', 'macera tamamlandı') }),
        toolUse('end_adventure', { outcome: 'victory', epilogue: L(locale, 'You lead the captive back into the light. The village will tell this story for years.', 'Tutsağı ışığa geri götürüyorsun. Köy bu hikâyeyi yıllarca anlatacak.') }),
      ];
    }
    if (has('attack', 'fight', 'charge', 'saldır', 'hücum', 'vur', 'savaş') && !state.combat) {
      const enc = scene?.encounter ?? [{ monsterId: 'goblin', count: 2 }];
      return [
        toolUse('start_combat', { enemies: enc.map((e) => ({ monster_id: e.monsterId, count: e.count, name: e.name })), surprise: 'none' }),
        toolUse('present_choices', { narration: L(locale, 'Weapons flash in the gloom as the fight begins!', 'Karanlıkta silahlar parlıyor, savaş başlıyor!'), choices: [] }),
      ];
    }
    if (has('rest', 'dinlen')) {
      return [toolUse('rest', { kind: 'short', allowed: true, reason: 'safe' }), toolUse('present_choices', { narration: L(locale, 'You find a quiet corner and catch your breath.', 'Sessiz bir köşe bulup soluklanıyorsun.'), choices })];
    }
    if (has('talk', 'ask', 'speak', 'drink', 'demand', 'bargain', 'konuş', 'sor', 'ısmarla', 'iste', 'pazarlık', 'ikna')) {
      const npc = Object.values(state.npcs).find((n) => n.present && n.alive && n.attitude >= -1);
      if (npc) {
        return [
          toolUse('update_npc', { id: npc.id, name: npc.name, attitude: Math.min(3, npc.attitude + 1), note: L(locale, 'Talked with the hero.', 'Kahramanla konuştu.'), present: true }),
          toolUse('present_choices', {
            narration: L(locale, `${npc.name} leans closer. "You want to help? Then listen. Whatever you seek lies below, where the old roads run. Be careful down there."`, `${npc.name} sana doğru eğiliyor. "Yardım etmek mi istiyorsun? O zaman dinle. Aradığın şey aşağıda, eski yolların uzandığı yerde. Orada dikkatli ol."`),
            choices,
          }),
        ];
      }
    }
    if (has('go', 'cellar', 'descend', 'climb', 'follow', 'trail', 'enter', 'mahzen', 'in', 'geç', 'takip', 'git', 'dön', 'ilerle', 'sneak toward', 'yaklaş', 'tünel')) {
      const unvisited = scene?.exits.find((e) => !state.scenes[e] && e !== state.sceneId);
      const back = has('back', 'dön', 'yukarı');
      const target = back ? scene?.exits[0] : unvisited ?? scene?.exits[scene.exits.length - 1];
      if (target && target !== state.sceneId) {
        return [toolUse('change_scene', { scene_id: target })];
      }
    }
    if (has('search', 'look', 'examine', 'study', 'ara', 'incele', 'bak', 'etraf', 'track', 'iz ')) {
      return [toolUse('request_check', { narration: L(locale, 'You take your time and study your surroundings closely.', 'Acele etmeden çevreni dikkatle inceliyorsun.'), kind: 'skill', key: has('track', 'iz ') ? 'survival' : 'investigation', dc: 12, reason: L(locale, 'Search carefully', 'Dikkatle ara') })];
    }
    if (has('sneak', 'gizli', 'watch', 'gözle')) {
      return [toolUse('request_check', { narration: L(locale, 'You keep to the shadows and watch.', 'Gölgelerde kalıp izliyorsun.'), kind: 'skill', key: 'stealth', dc: 13, reason: L(locale, 'Stay unseen', 'Görünmeden kal') })];
    }
    return [
      toolUse('present_choices', {
        narration: L(locale, 'You act, and the world answers in its own way. Nothing dramatic happens, but you sense the story waiting for your next move.', 'Harekete geçiyorsun ve dünya kendi bildiği gibi karşılık veriyor. Büyük bir şey olmuyor ama hikâyenin bir sonraki hamleni beklediğini hissediyorsun.'),
        choices,
      }),
    ];
  }

  private async finish(blocks: ContentBlock[], cb: NarrationCallbacks): Promise<ModelResponse> {
    // Simulate streaming of the narration field.
    blocks.forEach((b, i) => {
      if (b.type === 'tool_use' && (b.name === 'present_choices' || b.name === 'request_check' || b.name === 'end_adventure')) {
        const input = b.input as { narration?: string; epilogue?: string };
        const text = input.narration ?? input.epilogue ?? '';
        cb.onStart(i);
        for (let k = 0; k < text.length; k += 24) cb.onDelta(i, text.slice(k, k + 24));
      }
    });
    const hasTool = blocks.some((b) => b.type === 'tool_use');
    return { content: blocks, stopReason: hasTool ? 'tool_use' : 'end_turn' };
  }
}
