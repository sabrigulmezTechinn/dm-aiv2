import type Anthropic from '@anthropic-ai/sdk';
import type {
  CampaignStatus,
  CampaignView,
  Character,
  CombatState,
  Difficulty,
  Fact,
  GameMap,
  Locale,
  LogEntry,
  NpcMemory,
  PendingInput,
  Quest,
  Scene,
  SceneKind,
  Token,
} from '@dmai/shared';
import { uid } from '@dmai/shared';
import { MapGrid, computeVisible, emptyExplored, generateMap, maskMap, nearestFree, updateFog } from '@dmai/mapgen';
import { MONSTERS, darkvision, movableTiles, playerCombatantId, isPlayerTurn, type CombatCtx } from '@dmai/rules';
import type { Adventure } from '../adventures';

export type Transcript = Anthropic.Beta.Messages.BetaMessageParam[];
export type ToolResult = Anthropic.Beta.Messages.BetaToolResultBlockParam;

export interface SceneMemory {
  map: GameMap | null;
  explored: string[] | null;
  playerPos: { x: number; y: number } | null;
}

export interface HiddenChoice {
  id: string;
  label: string;
  consequence: string;
}

export interface CampaignState {
  id: string;
  userId: string;
  characterId: string;
  adventureId: string;
  difficulty: Difficulty;
  locale: Locale;
  status: CampaignStatus;
  turn: number;
  seed: number;
  scene: Scene;
  /** Adventure scene id, or a generated id for improvised scenes. */
  sceneId: string;
  map: GameMap | null;
  explored: string[] | null;
  playerPos: { x: number; y: number } | null;
  /** The current map exists only for a fight (outdoor scene). */
  combatOnlyMap: boolean;
  scenes: Record<string, SceneMemory>;
  npcs: Record<string, NpcMemory>;
  quests: Record<string, Quest>;
  facts: Fact[];
  combat: CombatState | null;
  pending: PendingInput | null;
  hiddenChoices: HiddenChoice[];
  /** Tool results waiting to be sent with the next user message. */
  heldResults: ToolResult[];
  /** A turn-ending tool call (present_choices / request_check) awaiting the player. */
  waitingTool: { id: string; name: string } | null;
  /** Mechanical notes for the DM to see on the next call. */
  notes: string[];
  log: LogEntry[];
  ending: string | null;
  createdAt: number;
  updatedAt: number;
}

export const MAP_KINDS: SceneKind[] = ['tavern', 'dungeon', 'cellar', 'cave', 'battlefield'];

export function hasLight(c: Character): boolean {
  return c.inventory.some((i) => i.itemId === 'torch' || i.itemId === 'lantern') || darkvision(c) > 0;
}

function seedFor(state: Pick<CampaignState, 'seed'>, sceneId: string): number {
  let h = state.seed;
  for (const ch of sceneId) h = (Math.imul(h ^ ch.charCodeAt(0), 2654435761) >>> 0) % 2147483647;
  return h || 1;
}

export function createCampaignState(params: {
  userId: string;
  character: Character;
  adventure: Adventure;
  difficulty: Difficulty;
  locale: Locale;
}): CampaignState {
  const now = Date.now();
  const { adventure } = params;
  const state: CampaignState = {
    id: uid('cmp'),
    userId: params.userId,
    characterId: params.character.id,
    adventureId: adventure.id,
    difficulty: params.difficulty,
    locale: params.locale,
    status: 'active',
    turn: 0,
    seed: Math.floor(Math.random() * 2_000_000_000) + 1,
    scene: { id: '', name: '', kind: 'outdoor', description: '' },
    sceneId: '',
    map: null,
    explored: null,
    playerPos: null,
    combatOnlyMap: false,
    scenes: {},
    npcs: {},
    quests: {},
    facts: [],
    combat: null,
    pending: null,
    hiddenChoices: [],
    heldResults: [],
    waitingTool: null,
    notes: [],
    log: [],
    ending: null,
    createdAt: now,
    updatedAt: now,
  };
  const q = adventure.startQuest;
  state.quests[q.id] = { id: q.id, title: q.title[params.locale], status: 'active', notes: [] };
  enterScene(state, params.character, adventure, adventure.startScene);
  return state;
}

/** Saves the current scene's map memory so revisits keep explored areas. */
function stashScene(state: CampaignState): void {
  if (!state.sceneId) return;
  state.scenes[state.sceneId] = {
    map: state.combatOnlyMap ? null : state.map,
    explored: state.combatOnlyMap ? null : state.explored,
    playerPos: state.combatOnlyMap ? null : state.playerPos,
  };
}

/**
 * Moves the party to a scene. Adventure scenes load their NPCs; improvised scenes
 * pass name/kind/description. Indoor kinds get a generated map.
 */
export function enterScene(
  state: CampaignState,
  character: Character,
  adventure: Adventure,
  sceneId: string,
  improvised?: { name: string; kind: SceneKind; description: string },
): void {
  stashScene(state);
  // NPCs from the previous scene are no longer present.
  for (const n of Object.values(state.npcs)) {
    n.present = false;
    delete n.x;
    delete n.y;
  }
  const def = adventure.scenes[sceneId];
  const kind: SceneKind = def?.kind ?? improvised?.kind ?? 'outdoor';
  state.sceneId = sceneId;
  state.scene = {
    id: sceneId,
    name: def ? def.name[state.locale] : improvised?.name ?? sceneId,
    kind,
    description: def?.description ?? improvised?.description ?? '',
  };
  state.combatOnlyMap = false;
  const memory = state.scenes[sceneId];
  if (memory?.map) {
    state.map = memory.map;
    state.explored = memory.explored;
    state.playerPos = memory.playerPos ?? memory.map.spawn;
  } else if (MAP_KINDS.includes(kind)) {
    const map = generateMap({ kind: kind as GameMap['kind'], seed: seedFor(state, sceneId), id: `map_${sceneId}` });
    state.map = map;
    state.explored = emptyExplored(map);
    state.playerPos = { ...map.spawn };
  } else {
    state.map = null;
    state.explored = null;
    state.playerPos = null;
  }
  // Load adventure NPCs for this scene.
  for (const npc of def?.npcs ?? []) {
    const existing = state.npcs[npc.id];
    if (existing && !existing.alive) continue;
    const mem: NpcMemory = existing ?? { id: npc.id, name: npc.name, description: npc.description, attitude: npc.attitude, notes: [], present: true, alive: true };
    mem.present = true;
    state.npcs[npc.id] = mem;
    if (state.map) placeNpc(state, mem, npc.anchor);
  }
  refreshVision(state, character);
}

export function occupied(state: CampaignState, exceptNpc?: string): Set<string> {
  const s = new Set<string>();
  if (state.playerPos) s.add(`${state.playerPos.x},${state.playerPos.y}`);
  for (const n of Object.values(state.npcs)) if (n.present && n.x !== undefined && n.id !== exceptNpc) s.add(`${n.x},${n.y}`);
  if (state.combat) for (const cb of Object.values(state.combat.combatants)) if (!cb.dead && !cb.fled) s.add(`${cb.x},${cb.y}`);
  return s;
}

export function placeNpc(state: CampaignState, npc: NpcMemory, anchor?: string): void {
  if (!state.map) return;
  const near = (anchor && state.map.anchors[anchor]) || state.playerPos || state.map.spawn;
  const spot = nearestFree(state.map, near, occupied(state, npc.id));
  npc.x = spot.x;
  npc.y = spot.y;
}

export function visibleSet(state: CampaignState, character: Character): Set<string> {
  if (!state.map || !state.playerPos) return new Set();
  return computeVisible(state.map, state.playerPos, { darkvision: darkvision(character), hasLight: hasLight(character) });
}

export function refreshVision(state: CampaignState, character: Character): void {
  if (!state.map || !state.explored) return;
  const vis = visibleSet(state, character);
  state.explored = updateFog(state.map, state.explored, vis).explored;
}

export function combatCtx(state: CampaignState, character: Character): CombatCtx {
  if (!state.map) throw new Error('no map for combat');
  return { character, grid: new MapGrid(state.map), difficulty: state.difficulty, locale: state.locale };
}

export function tokens(state: CampaignState, character: Character, visible: Set<string>): Token[] {
  const out: Token[] = [];
  if (!state.map) return out;
  const pid = playerCombatantId(character);
  if (state.combat) {
    const cur = state.combat.order[state.combat.turnIndex];
    for (const cb of Object.values(state.combat.combatants)) {
      if (cb.fled) continue;
      if (cb.kind !== 'player' && !visible.has(`${cb.x},${cb.y}`)) continue;
      out.push({
        id: cb.id,
        kind: cb.kind === 'player' ? 'player' : 'monster',
        name: cb.name,
        x: cb.x,
        y: cb.y,
        color: cb.kind === 'player' ? character.color : MONSTERS[cb.refId]?.color ?? '#b33a3a',
        hp: cb.hp,
        maxHp: cb.maxHp,
        hostile: cb.team === 'enemy',
        dead: cb.dead,
        active: cb.id === cur,
      });
    }
  } else if (state.playerPos) {
    out.push({ id: pid, kind: 'player', name: character.name, x: state.playerPos.x, y: state.playerPos.y, color: character.color, hp: character.hp, maxHp: character.maxHp });
  }
  for (const n of Object.values(state.npcs)) {
    if (!n.present || n.x === undefined || n.y === undefined) continue;
    if (!visible.has(`${n.x},${n.y}`)) continue;
    out.push({ id: n.id, kind: 'npc', name: n.name, x: n.x, y: n.y, color: n.attitude < 0 ? '#c98a3a' : '#d8c27a', dead: !n.alive, hostile: n.attitude <= -2 });
  }
  return out;
}

export function toView(state: CampaignState, character: Character, adventure: Adventure, busy = false): CampaignView {
  const visible = visibleSet(state, character);
  let map: GameMap | null = null;
  let fog: string[] | null = null;
  if (state.map && state.explored) {
    const f = updateFog(state.map, state.explored, visible);
    map = maskMap(state.map, f.explored);
    fog = f.fog;
  }
  let moveTargets: { x: number; y: number }[] = [];
  if (state.combat && state.map) {
    const ctx = combatCtx(state, character);
    if (isPlayerTurn(state.combat, ctx) && character.hp > 0) moveTargets = movableTiles(state.combat, ctx);
  }
  // Hide exact monster HP in the client except as a fraction (kept as numbers for the bar).
  return {
    id: state.id,
    adventureId: state.adventureId,
    adventureTitle: adventure.title[state.locale],
    difficulty: state.difficulty,
    locale: state.locale,
    status: state.status,
    turn: state.turn,
    scene: state.scene,
    map,
    fog,
    tokens: tokens(state, character, visible),
    character,
    combat: state.combat ? { ...state.combat, pendingEvents: [] } : null,
    playerCombatantId: state.combat ? playerCombatantId(character) : null,
    moveTargets,
    pending: state.pending,
    log: state.log.slice(-200),
    npcs: Object.values(state.npcs).filter((n) => n.known),
    quests: Object.values(state.quests),
    facts: state.facts,
    busy,
    needsContinue: state.heldResults.length > 0 && !state.waitingTool && state.status === 'active',
    ending: state.ending,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
  };
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type NewLogEntry = DistributiveOmit<LogEntry, 'id' | 'turn'> & { id?: string };

export function addLog(state: CampaignState, entry: NewLogEntry): LogEntry {
  const e = { ...entry, id: entry.id ?? uid('l'), turn: state.turn } as LogEntry;
  state.log.push(e);
  if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
  return e;
}
