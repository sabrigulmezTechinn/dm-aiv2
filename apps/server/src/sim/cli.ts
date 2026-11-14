import { writeFileSync } from 'node:fs';
import type { ClassId } from '@dmai/shared';
import { ADVENTURE_IDS, CLASS_IDS, DIFFICULTIES, formatReport, runMatrix, toJson, type Difficulty } from './sim';

const HELP = `Balance simulator (offline mock DM, deterministic).
Usage: pnpm sim [--games N] [--class fighter,rogue,...] [--adventure willow_inn,lost_caravan] [--difficulty easy,hard] [--json out.json] [--quiet]
  --games N   games per class x difficulty, split over the selected adventures (default 40 -> 320 total)`;

const argv = process.argv.slice(2).filter((a) => a !== '--');
const opt = (name: string): string | undefined => {
  const i = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i < 0) return undefined;
  return argv[i]!.includes('=') ? argv[i]!.split('=').slice(1).join('=') : argv[i + 1];
};
const list = <T extends string>(name: string, valid: readonly T[]): T[] | undefined => {
  const v = opt(name);
  if (v === undefined) return undefined;
  const items = v.split(',').filter(Boolean) as T[];
  const bad = items.filter((x) => !valid.includes(x));
  if (bad.length || items.length === 0) {
    console.error(`Invalid --${name}: ${bad.join(',') || '(empty)'}. Valid: ${valid.join(', ')}`);
    process.exit(2);
  }
  return items;
};

if (argv.includes('--help') || argv.includes('-h')) {
  console.log(HELP);
  process.exit(0);
}
const games = opt('games') === undefined ? 40 : Number(opt('games'));
if (!Number.isInteger(games) || games < 1) {
  console.error('--games must be a positive integer');
  process.exit(2);
}
const filters = { classes: list<ClassId>('class', CLASS_IDS), adventures: list<string>('adventure', ADVENTURE_IDS), difficulties: list<Difficulty>('difficulty', DIFFICULTIES) };
const jsonPath = opt('json');
const quiet = argv.includes('--quiet');

const t0 = Date.now();
let done = 0;
const results = await runMatrix({
  gamesPerClassDifficulty: games,
  filters,
  onGame: () => {
    done++;
    if (!quiet && process.stderr.isTTY && done % 10 === 0) process.stderr.write(`\r${done} games...`);
  },
});
if (!quiet && process.stderr.isTTY) process.stderr.write('\r');
const seconds = (Date.now() - t0) / 1000;
console.log(formatReport(results));
console.log(`wall time: ${seconds.toFixed(1)}s`);
if (jsonPath) {
  writeFileSync(jsonPath, JSON.stringify(toJson(results, { gamesPerClassDifficulty: games, filters, seconds }), null, 2));
  console.log(`wrote ${jsonPath}`);
}
