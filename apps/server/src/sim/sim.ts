/**
 * Balance simulator. Plays full adventures through the real GameEngine with the offline MockModel and a
 * simple scripted player, fully deterministically (seeded dice, seeded map seeds, seeded ids).
 *
 * Not part of the server runtime: run it with `pnpm sim` (see cli.ts).
 */
import type { CampaignView, CharacterDraft, ClassId, CombatAction, PlayerAction, TurnEvent } from '@dmai/shared';
import { CLASSES, MONSTERS, seededRng } from '@dmai/rules';
import { Store } from '../db';
import { GameEngine } from '../game/engine';
import { getAdventure, sceneEncounter } from '../adventures';
import { MockModel } from '../dm/mock';

export type Difficulty = 'easy' | 'hard';
export const CLASS_IDS: ClassId[] = ['fighter', 'rogue', 'wizard', 'cleric'];
export const ADVENTURE_IDS = ['willow_inn', 'lost_caravan'] as const;
export const DIFFICULTIES: Difficulty[] = ['easy', 'hard'];

/** Targets from docs/DUZELTME-PLANI.md ("Ölçüm ve hedefler"). */
export const TARGETS = {
  easy: { winMin: 0.85, winMax: 1, firstCombatDeathBelow: 0.03, levelMin: 3 },
  hard: { winMin: 0.35, winMax: 0.55, firstCombatDeathBelow: 0.15, levelMin: 3 },
} as const;

interface Script {
  steps: { say: string; final?: boolean }[];
}

/** The mock DM's keywords drive the story; these lines walk each adventure start to finish. */
const SCRIPTS: Record<string, Script> = {
  willow_inn: {
    steps: [
      { say: 'Go down to the cellar' },
      { say: 'attack' },
      { say: 'Climb through the broken wall' },
      { say: 'attack' },
      { say: 'Follow the drag marks' },
      { say: 'attack', final: true },
      { say: 'Free Elin' },
    ],
  },
  lost_caravan: {
    steps: [
      { say: 'attack the wolves' },
      { say: 'Follow the trail north' },
      { say: 'attack' },
      { say: 'Follow the trail deeper' },
      { say: 'attack', final: true },
      { say: 'Free Doran' },
    ],
  },
};

export interface GameResult {
  class: ClassId;
  adventure: string;
  difficulty: Difficulty;
  seed: number;
  status: CampaignView['status'];
  won: boolean;
  /** The character died during the first combat of the adventure. */
  diedInFirstCombat: boolean;
  /** Character level when the final fight began (null if never reached). */
  levelAtFinal: number | null;
  finalLevel: number;
  internalErrors: number;
  /** Script ended (or step cap hit) while the campaign was still active. */
  incomplete: boolean;
  /** One record per fight, in order (used by --breakdown). */
  combats: CombatRecord[];
}

export interface CombatRecord {
  scene: string;
  /** The encounter budget removed at least one enemy. */
  trimmed: boolean;
  /** The hero ended the fight dead (defeat). */
  died: boolean;
}

function draftFor(cls: ClassId): CharacterDraft {
  const def = CLASSES[cls];
  return { name: 'Sim', color: '#336699', race: 'human', class: cls, baseAbilities: { ...def.suggestedArray }, skills: def.skillChoices.slice(0, def.skillCount) };
}

const cheb = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export function gameSeed(cls: ClassId, adventure: string, difficulty: Difficulty, index: number): number {
  const key = `${cls}|${adventure}|${difficulty}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return (Math.imul(h >>> 0, 31) + index * 7919 + 17) >>> 0;
}

export async function playGame(cls: ClassId, adventureId: string, difficulty: Difficulty, seed: number): Promise<GameResult> {
  // Map seeds and ids use Math.random; make them reproducible for the duration of the game.
  const realRandom = Math.random;
  Math.random = seededRng(seed ^ 0x9e3779b9);
  try {
    return await playGameInner(cls, adventureId, difficulty, seed);
  } finally {
    Math.random = realRandom;
  }
}

async function playGameInner(cls: ClassId, adventureId: string, difficulty: Difficulty, seed: number): Promise<GameResult> {
  const realConsoleError = console.error;
  console.error = () => {}; // internal errors are counted from events instead
  const store = new Store(':memory:');
  try {
    const engine = new GameEngine(store, new MockModel(), seededRng(seed));
    const userId = 'sim-user';
    const ch = engine.createCharacter(userId, draftFor(cls));
    let view = engine.createCampaign(userId, { characterId: ch.id, adventureId, difficulty, locale: 'en' });
    const id = view.id;
    let internalErrors = 0;
    let lastError: string | null = null as string | null;

    const act = async (action: PlayerAction): Promise<void> => {
      const events: TurnEvent[] = [];
      await engine.act(userId, id, action, (e) => events.push(e));
      lastError = null;
      for (const e of events) {
        if (e.type === 'error') {
          lastError = e.code ?? 'error';
          if (e.code === 'internal' || e.code === 'dm_unavailable') internalErrors++;
        }
      }
      const st = [...events].reverse().find((e) => e.type === 'state') as { view: CampaignView } | undefined;
      if (st) view = st.view;
    };
    const combatAct = (action: CombatAction) => act({ type: 'combat', action });

    let combatsFought = 0;
    const combats: CombatRecord[] = [];
    let turnTried = false;
    let diedInFirstCombat = false;
    let levelAtFinal: number | null = null;

    const hpFrac = () => view.character.hp / view.character.maxHp;
    const potion = () => view.character.inventory.find((i) => i.itemId === 'healing_potion' && i.qty > 0);
    const slotsLeft = (lvl: number) => (view.character.spellSlots.max[lvl - 1] ?? 0) - (view.character.spellSlots.used[lvl - 1] ?? 0);
    const knows = (s: string) => view.character.spells.includes(s);

    const playerTurn = async () => {
      const c = view.combat!;
      const me = c.combatants[view.playerCombatantId!]!;
      const foes = Object.values(c.combatants).filter((x) => x.team === 'enemy' && !x.dead && !x.fled);
      if (foes.length === 0) return act({ type: 'combat', action: { kind: 'end_turn' } });
      const foe = [...foes].sort((a, b) => cheb(a, me) - cheb(b, me) || a.hp - b.hp)[0]!;
      const frac = hpFrac();

      // Healing first when hurt.
      if (frac < 0.5 && cls === 'fighter') {
        await combatAct({ kind: 'second_wind' });
        if (!view.combat || view.pending?.type === 'death_save') return;
      }
      // Cleric: Healing Word is a bonus action: heal, then (5e) only a cantrip or weapon attack this turn.
      let bonusSpell = false;
      if (frac < 0.65 && cls === 'cleric' && slotsLeft(1) > 0 && knows('healing_word') && view.combat?.order[view.combat.turnIndex] === view.playerCombatantId) {
        await combatAct({ kind: 'cast', spellId: 'healing_word', targetId: me.id });
        bonusSpell = !lastError;
        if (!view.combat || view.pending?.type === 'death_save') return;
      }
      if (frac < 0.4 && !bonusSpell && cls === 'cleric' && slotsLeft(1) > 0 && knows('cure_wounds')) {
        await combatAct({ kind: 'cast', spellId: 'cure_wounds', targetId: me.id });
        if (!lastError) return finishTurn();
      }
      if (frac < 0.35 && potion()) {
        await combatAct({ kind: 'use_item', itemUid: potion()!.uid });
        if (!lastError) return finishTurn();
      }

      // Cleric signature feature: Turn Undead (level 2+) once per fight when an undead foe is near.
      if (cls === 'cleric' && !turnTried && view.character.level >= 2 && foes.some((f) => MONSTERS[f.refId]?.traits.includes('undead') && cheb(f, me) <= 6)) {
        turnTried = true;
        await combatAct({ kind: 'turn_undead' });
        if (!view.combat || view.pending?.type === 'death_save') return;
      }

      // Spells for casters.
      const spells: string[] = [];
      if (cls === 'wizard') {
        if (slotsLeft(1) > 0 && knows('magic_missile')) spells.push('magic_missile');
        spells.push('fire_bolt');
      } else if (cls === 'cleric') {
        if (!bonusSpell && slotsLeft(1) > (view.character.level >= 2 ? 1 : 0) && knows('guiding_bolt')) spells.push('guiding_bolt'); // keep one slot for healing
        spells.push('sacred_flame');
      }
      for (const spellId of spells) {
        await combatAct({ kind: 'cast', spellId, targetId: foe.id });
        if (!view.combat || view.pending?.type === 'death_save') return;
        if (!lastError) return finishTurn();
      }

      // Melee / weapon attack, closing the distance first.
      const me2 = view.combat!.combatants[view.playerCombatantId!]!;
      if (cheb(me2, foe) > 1) {
        const near = view.moveTargets.filter((t) => cheb(t, foe) === 1).sort((a, b) => cheb(a, me2) - cheb(b, me2));
        if (near[0]) {
          await combatAct({ kind: 'move', x: near[0].x, y: near[0].y });
          if (!view.combat || view.pending?.type === 'death_save') return;
        }
      }
      await combatAct({ kind: 'attack', targetId: foe.id });
      if (!view.combat || view.pending?.type === 'death_save') return;
      return finishTurn();
    };

    const finishTurn = async () => {
      if (view.combat && view.pending?.type !== 'death_save' && view.combat.order[view.combat.turnIndex] === view.playerCombatantId) {
        await act({ type: 'combat', action: { kind: 'end_turn' } });
      }
    };

    const fightUntilOver = async () => {
      combatsFought++;
      const rec: CombatRecord = {
        scene: view.scene.id,
        trimmed: false,
        died: false,
      };
      const wanted = ((getAdventure(adventureId)!.scenes[view.scene.id] ? sceneEncounter(getAdventure(adventureId)!.scenes[view.scene.id]!, difficulty) : undefined) ?? []).reduce((n, e) => n + e.count, 0);
      const present = Object.values(view.combat!.combatants).filter((x) => x.team === 'enemy').length;
      rec.trimmed = wanted > 0 && present < wanted;
      combats.push(rec);
      turnTried = false;
      let guard = 0;
      while (view.combat && view.status === 'active' && guard++ < 150) {
        if (view.pending?.type === 'death_save') {
          await act({ type: 'death_save' });
          continue;
        }
        if (view.combat.order[view.combat.turnIndex] !== view.playerCombatantId) {
          // Should not happen (the engine auto-plays enemies); avoid spinning.
          await act({ type: 'combat', action: { kind: 'end_turn' } });
          if (lastError) break;
          continue;
        }
        await playerTurn();
      }
      rec.died = store.getCharacter(ch.id)!.status === 'dead' || view.status === 'defeat';
      if (combatsFought === 1 && (store.getCharacter(ch.id)!.status === 'dead' || view.status === 'defeat')) diedInFirstCombat = true;
    };

    await act({ type: 'begin' });
    const script = SCRIPTS[adventureId]!;
    for (const step of script.steps) {
      if (view.status !== 'active') break;
      if (!view.combat && hpFrac() < 0.6) await act({ type: 'rest', kind: 'long' });
      if (step.final) levelAtFinal = view.character.level;
      await act({ type: 'say', text: step.say });
      if (view.pending?.type === 'check') await act({ type: 'roll' });
      if (view.combat) await fightUntilOver();
    }
    return {
      class: cls,
      adventure: adventureId,
      difficulty,
      seed,
      status: view.status,
      won: view.status === 'victory',
      diedInFirstCombat,
      levelAtFinal,
      finalLevel: view.character.level,
      internalErrors,
      incomplete: view.status === 'active',
      combats,
    };
  } finally {
    console.error = realConsoleError;
  }
}

// ---------------------------------------------------------------------------
// Aggregation

export interface Filters {
  classes?: ClassId[];
  adventures?: string[];
  difficulties?: Difficulty[];
}

export interface CellSummary {
  class: ClassId;
  difficulty: Difficulty;
  games: number;
  wins: number;
  winRate: number;
  firstCombatDeaths: number;
  firstCombatDeathRate: number;
  /** Average level when the final fight began; null when no game reached it. */
  avgLevelAtFinal: number | null;
  reachedFinal: number;
  internalErrors: number;
  incomplete: number;
  met: { win: boolean; firstCombatDeath: boolean; level: boolean };
}

export function summarize(results: GameResult[]): CellSummary[] {
  const out: CellSummary[] = [];
  for (const cls of CLASS_IDS) {
    for (const difficulty of DIFFICULTIES) {
      const rs = results.filter((r) => r.class === cls && r.difficulty === difficulty);
      if (rs.length === 0) continue;
      const t = TARGETS[difficulty];
      const wins = rs.filter((r) => r.won).length;
      const deaths = rs.filter((r) => r.diedInFirstCombat).length;
      const lv = rs.filter((r) => r.levelAtFinal !== null).map((r) => r.levelAtFinal!);
      const avg = lv.length ? lv.reduce((a, b) => a + b, 0) / lv.length : null;
      const winRate = wins / rs.length;
      const deathRate = deaths / rs.length;
      out.push({
        class: cls,
        difficulty,
        games: rs.length,
        wins,
        winRate,
        firstCombatDeaths: deaths,
        firstCombatDeathRate: deathRate,
        avgLevelAtFinal: avg,
        reachedFinal: lv.length,
        internalErrors: rs.reduce((a, r) => a + r.internalErrors, 0),
        incomplete: rs.filter((r) => r.incomplete).length,
        met: {
          win: winRate >= t.winMin && winRate <= t.winMax,
          firstCombatDeath: deathRate < t.firstCombatDeathBelow,
          level: avg !== null && avg >= t.levelMin,
        },
      });
    }
  }
  return out;
}

export async function runMatrix(opts: { gamesPerClassDifficulty?: number; filters?: Filters; onGame?: (r: GameResult) => void } = {}): Promise<GameResult[]> {
  const n = opts.gamesPerClassDifficulty ?? 40;
  const f = opts.filters ?? {};
  const classes = CLASS_IDS.filter((c) => !f.classes || f.classes.includes(c));
  const adventures = ADVENTURE_IDS.filter((a) => !f.adventures || f.adventures.includes(a));
  const diffs = DIFFICULTIES.filter((d) => !f.difficulties || f.difficulties.includes(d));
  const results: GameResult[] = [];
  for (const cls of classes) {
    for (const difficulty of diffs) {
      // N games per class x difficulty, spread evenly over the adventures (40 -> 20 + 20).
      for (let k = 0; k < adventures.length; k++) {
        const adv = adventures[k]!;
        const count = Math.floor(n / adventures.length) + (k < n % adventures.length ? 1 : 0);
        for (let i = 0; i < count; i++) {
          const r = await playGame(cls, adv, difficulty, gameSeed(cls, adv, difficulty, i));
          results.push(r);
          opts.onGame?.(r);
        }
      }
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Reporting

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const mark = (ok: boolean) => (ok ? 'ok' : 'NO');
const pad = (s: string, n: number) => s.padEnd(n);

export function formatReport(results: GameResult[]): string {
  const cells = summarize(results);
  const lines: string[] = [];
  const cell = (cls: ClassId, d: Difficulty) => cells.find((c) => c.class === cls && c.difficulty === d);
  const classesPresent = CLASS_IDS.filter((c) => cells.some((x) => x.class === c));

  lines.push('Adventure win rate (wins/games)', `${pad('class', 10)}${pad('easy', 16)}hard`);
  for (const c of classesPresent) {
    const f = (d: Difficulty) => {
      const x = cell(c, d);
      return x ? `${x.wins}/${x.games} ${pct(x.winRate)}`.padEnd(16) : '-'.padEnd(16);
    };
    lines.push(`${pad(c, 10)}${f('easy')}${f('hard').trimEnd()}`);
  }

  lines.push('', 'Detail per class and difficulty  [met?]');
  lines.push(`${pad('class', 9)}${pad('diff', 6)}${pad('win rate', 14)}${pad('1st-combat death', 21)}${pad('avg lvl @ final', 20)}${pad('internal', 9)}incomplete`);
  for (const x of cells) {
    const win = `${pct(x.winRate)} [${mark(x.met.win)}]`;
    const death = `${x.firstCombatDeaths}/${x.games} ${pct(x.firstCombatDeathRate)} [${mark(x.met.firstCombatDeath)}]`;
    const lvl = x.avgLevelAtFinal === null ? 'n/a [NO]' : `${x.avgLevelAtFinal.toFixed(2)} (${x.reachedFinal}) [${mark(x.met.level)}]`;
    lines.push(`${pad(x.class, 9)}${pad(x.difficulty, 6)}${pad(win, 14)}${pad(death, 21)}${pad(lvl, 20)}${pad(String(x.internalErrors), 9)}${x.incomplete}`);
  }

  lines.push(
    '',
    'Targets (docs/DUZELTME-PLANI.md)',
    `${pad('metric', 28)}${pad('easy', 14)}hard`,
    `${pad('adventure win rate', 28)}${pad('>= 85%', 14)}35-55%`,
    `${pad('death in first combat', 28)}${pad('< 3%', 14)}< 15%`,
    `${pad('avg level before final', 28)}${pad('3', 14)}3`,
  );
  const total = results.length;
  const errs = results.reduce((a, r) => a + r.internalErrors, 0);
  const inc = results.filter((r) => r.incomplete).length;
  lines.push('', `${total} games, ${errs} internal errors, ${inc} incomplete (script ended while campaign still active)`);
  const allMet = cells.length > 0 && cells.every((c) => c.met.win && c.met.firstCombatDeath && c.met.level);
  lines.push(allMet ? 'ALL TARGETS MET' : 'targets not met in every cell');
  return lines.join('\n');
}

export function toJson(results: GameResult[], meta: Record<string, unknown> = {}) {
  return { meta, targets: TARGETS, summary: summarize(results), games: results };
}

/** Deaths per scene for each class x difficulty (and how often the budget trimmed the fight). */
export function formatBreakdown(results: GameResult[]): string {
  const lines: string[] = ['Combat breakdown per class x difficulty (deaths/fights per scene; trimmed = budget removed enemies)'];
  lines.push(`${pad('class', 9)}${pad('diff', 6)}${pad('adventure', 14)}${pad('scene', 18)}${pad('fights', 8)}${pad('deaths', 8)}trimmed`);
  for (const cls of CLASS_IDS) {
    for (const d of DIFFICULTIES) {
      for (const adv of ADVENTURE_IDS) {
        const rs = results.filter((r) => r.class === cls && r.difficulty === d && r.adventure === adv);
        const scenes = new Map<string, { fights: number; deaths: number; trimmed: number }>();
        for (const r of rs) {
          for (const c of r.combats) {
            const e = scenes.get(c.scene) ?? { fights: 0, deaths: 0, trimmed: 0 };
            e.fights++;
            if (c.died) e.deaths++;
            if (c.trimmed) e.trimmed++;
            scenes.set(c.scene, e);
          }
        }
        for (const [scene, e] of scenes) lines.push(`${pad(cls, 9)}${pad(d, 6)}${pad(adv, 14)}${pad(scene, 18)}${pad(String(e.fights), 8)}${pad(String(e.deaths), 8)}${e.trimmed}`);
      }
    }
  }
  return lines.join('\n');
}
