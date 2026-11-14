import { describe, expect, it } from 'vitest';
import { ADVENTURE_IDS, CLASS_IDS, gameSeed, playGame, runMatrix, summarize } from '../src/sim/sim';

describe('balance simulator', () => {
  it('plays a few games per class without internal errors', async () => {
    const results = await runMatrix({ gamesPerClassDifficulty: 2, filters: { difficulties: ['easy'] } });
    expect(results).toHaveLength(CLASS_IDS.length * 2);
    expect(results.reduce((a, r) => a + r.internalErrors, 0)).toBe(0);
    expect(results.every((r) => !r.incomplete)).toBe(true);
    expect(summarize(results).length).toBe(CLASS_IDS.length);
  }, 60_000);

  it('is deterministic for the same seed', async () => {
    for (const adv of ADVENTURE_IDS) {
      const seed = gameSeed('fighter', adv, 'hard', 3);
      const a = await playGame('fighter', adv, 'hard', seed);
      const b = await playGame('fighter', adv, 'hard', seed);
      expect(b).toEqual(a);
    }
    const x = await runMatrix({ gamesPerClassDifficulty: 3, filters: { classes: ['wizard'] } });
    const y = await runMatrix({ gamesPerClassDifficulty: 3, filters: { classes: ['wizard'] } });
    expect(y).toEqual(x);
  }, 60_000);
});
