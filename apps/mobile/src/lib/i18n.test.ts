import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TEXT_KEYS, tx } from '@dmai/rules';
import { DICTS } from './i18n';

// English words that must never show up in the Turkish UI. Case-sensitive on purpose:
// "ac"/"init" lower-case fragments appear inside legitimate Turkish words.
// HP / XP are intentionally allowed (standard in Turkish D&D). Distance is "fit", never "ft".
export const BANNED_WORDS = ['INIT', 'Init', 'PROF', 'Prof', 'prof', 'melee', 'AC', 'DC', 'Mock', 'offline', 'ft', 'passive', 'perception', 'Level', 'Victory', 'Move'];

export function findEnglish(text: string): string[] {
  // Strip {placeholders} before matching.
  const clean = text.replace(/\{[^}]*\}/g, '');
  return BANNED_WORDS.filter((w) => new RegExp(`(^|[^\\p{L}\\p{N}])${w}($|[^\\p{L}\\p{N}])`, 'u').test(clean));
}

describe('Turkish UI has no English leftovers', () => {
  it('tr dictionary', () => {
    const bad = Object.entries(DICTS.tr).flatMap(([k, v]) => findEnglish(v).map((w) => `${k}: "${v}" contains ${w}`));
    expect(bad).toEqual([]);
  });

  it('tr rules text (combat log)', () => {
    const params = { a: 'A', t: 'T', w: 'W', d: 1, n: 1, s: 'S', xp: 1, order: 'O', type: 'ateş', f: 1 };
    const bad = TEXT_KEYS.flatMap((k) => findEnglish(tx('tr', k, params)).map((w) => `${k} contains ${w}`));
    expect(bad).toEqual([]);
  });

  it('component sources have no hardcoded English labels', () => {
    const roots = ['../components', '../app'].map((d) => join(__dirname, d));
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx$/.test(f)) files.push(p);
      }
    };
    roots.forEach(walk);
    const bad: string[] = [];
    for (const f of files) {
      readFileSync(f, 'utf8').split('\n').forEach((raw, i) => {
        const line = raw.replace(/\bt\((['"])\w+\1/g, 't(');  // translation keys are not UI text
        // string literals / JSX attribute strings / template text
        for (const m of line.matchAll(/(["'`])((?:(?!\1).)*)\1/g)) {
          const w = findEnglish(m[2]!);
          if (w.length) bad.push(`${f}:${i + 1} "${m[2]}" contains ${w.join(',')}`);
        }
      });
    }
    expect(bad).toEqual([]);
  });

  it('detector catches planted English words', () => {
    for (const w of ['INIT', 'PROF', 'melee', 'AC', 'Mock (offline)', '30 ft']) expect(findEnglish(w).length).toBeGreaterThan(0);
    expect(findEnglish('Yeterlilik 30 fit İnisiyatif')).toEqual([]);
  });
});
