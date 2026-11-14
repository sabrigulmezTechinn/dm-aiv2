import Anthropic from '@anthropic-ai/sdk';
import type { Character } from '@dmai/shared';
import type { Adventure } from '../adventures';
import type { CampaignState, Transcript } from '../game/state';
import type { Effort } from '../config';
import { JsonFieldStreamer } from './stream-json';

export type ContentBlock = Anthropic.Beta.Messages.BetaContentBlock;

export interface ModelRequest {
  system: string;
  tools: Anthropic.Beta.Messages.BetaToolUnion[];
  messages: Transcript;
  /** Only used by the mock model. */
  meta?: { state: CampaignState; character: Character; adventure: Adventure };
}

export interface NarrationCallbacks {
  /** A new narration segment starts at content block `index`. */
  onStart(index: number): void;
  onDelta(index: number, text: string): void;
}

export interface ModelResponse {
  content: ContentBlock[];
  stopReason: string | null;
  usage?: { input: number; output: number; cacheRead: number; cacheWrite: number };
}

export interface ModelClient {
  readonly name: string;
  create(req: ModelRequest, cb: NarrationCallbacks): Promise<ModelResponse>;
}

/** Tools whose input carries user-facing narration. */
export const NARRATION_FIELDS: Record<string, string[]> = {
  present_choices: ['narration'],
  request_check: ['narration'],
  end_adventure: ['epilogue'],
};

function supportsDefaultFallback(model: string): boolean {
  return /^claude-(opus-5|fable-5|sonnet-5-5)/.test(model);
}

function supportsCompaction(model: string): boolean {
  return /^claude-(opus-(5|4-[678])|fable-5|sonnet-(5|4-6)|haiku-5-5)/.test(model);
}

export class AnthropicModel implements ModelClient {
  readonly name = 'anthropic';
  private client: Anthropic;

  constructor(private readonly opts: { apiKey?: string; model: string; effort: Effort }) {
    this.client = new Anthropic(opts.apiKey ? { apiKey: opts.apiKey } : {});
  }

  async create(req: ModelRequest, cb: NarrationCallbacks): Promise<ModelResponse> {
    const betas: Anthropic.Beta.AnthropicBeta[] = [];
    const params: Anthropic.Beta.Messages.MessageCreateParamsStreaming = {
      model: this.opts.model,
      max_tokens: 16000,
      stream: true,
      system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
      tools: req.tools,
      messages: req.messages,
      output_config: { effort: this.opts.effort },
      // Caches the growing conversation automatically (prefix stays append-only).
      cache_control: { type: 'ephemeral' },
    };
    if (supportsCompaction(this.opts.model)) {
      betas.push('compact-2026-01-12');
      params.context_management = { edits: [{ type: 'compact_20260112' }] };
    }
    if (supportsDefaultFallback(this.opts.model)) {
      betas.push('server-side-fallback-2026-07-01');
      params.fallbacks = 'default';
    }
    if (betas.length) params.betas = betas;

    const stream = this.client.beta.messages.stream(params);
    const streamers = new Map<number, JsonFieldStreamer>();
    const textBlocks = new Set<number>();
    for await (const ev of stream) {
      if (ev.type === 'content_block_start') {
        const b = ev.content_block;
        if (b.type === 'text') {
          textBlocks.add(ev.index);
          cb.onStart(ev.index);
          if (b.text) cb.onDelta(ev.index, b.text);
        } else if (b.type === 'tool_use' && NARRATION_FIELDS[b.name]) {
          streamers.set(ev.index, new JsonFieldStreamer(NARRATION_FIELDS[b.name]!));
          cb.onStart(ev.index);
        }
      } else if (ev.type === 'content_block_delta') {
        if (ev.delta.type === 'text_delta' && textBlocks.has(ev.index)) cb.onDelta(ev.index, ev.delta.text);
        else if (ev.delta.type === 'input_json_delta') {
          const s = streamers.get(ev.index);
          if (s) {
            const out = s.push(ev.delta.partial_json);
            if (out) cb.onDelta(ev.index, out);
          }
        }
      }
    }
    const msg = await stream.finalMessage();
    return {
      content: msg.content,
      stopReason: msg.stop_reason,
      usage: {
        input: msg.usage.input_tokens,
        output: msg.usage.output_tokens,
        cacheRead: msg.usage.cache_read_input_tokens ?? 0,
        cacheWrite: msg.usage.cache_creation_input_tokens ?? 0,
      },
    };
  }
}
