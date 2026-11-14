import { expect } from 'vitest';
import type { Transcript } from '../../src/game/state';

/** Every assistant tool_use must be answered by tool_results at the start of the next user message. */
export function checkProtocol(t: Transcript) {
  for (let i = 0; i < t.length; i++) {
    const m = t[i]!;
    if (i === 0) expect(m.role).toBe('user');
    if (m.role !== 'assistant' || !Array.isArray(m.content)) continue;
    const ids = (m.content as any[]).filter((b) => b.type === 'tool_use').map((b) => b.id);
    if (ids.length === 0) continue;
    const next = t[i + 1];
    if (!next) continue; // last message may still be waiting for the player
    expect(next.role).toBe('user');
    const blocks = next.content as any[];
    const resultIds = blocks.filter((b) => b.type === 'tool_result').map((b) => b.tool_use_id);
    expect(new Set(resultIds)).toEqual(new Set(ids));
    const firstNonResult = blocks.findIndex((b) => b.type !== 'tool_result');
    if (firstNonResult >= 0) expect(blocks.slice(firstNonResult).every((b) => b.type !== 'tool_result')).toBe(true);
  }
}

