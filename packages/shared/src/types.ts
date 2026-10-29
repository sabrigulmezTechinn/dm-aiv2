// Core domain types shared by server, rules engine, map generator and app.

export type Locale = 'en' | 'tr';
export const LOCALES: Locale[] = ['en', 'tr'];
/** A localized string. */
export interface Loc {
  en: string;
  tr: string;
}

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export type Skill =
  | 'acrobatics'
  | 'animal_handling'
  | 'arcana'
  | 'athletics'
  | 'deception'
  | 'history'
  | 'insight'
  | 'intimidation'
  | 'investigation'
  | 'medicine'
  | 'nature'
  | 'perception'
  | 'performance'
  | 'persuasion'
  | 'religion'
  | 'sleight_of_hand'
  | 'stealth'
  | 'survival';

export type AbilityScores = Record<Ability, number>;
export type Difficulty = 'easy' | 'hard';
export type RaceId = 'human' | 'high_elf' | 'hill_dwarf' | 'lightfoot_halfling' | 'half_orc';
export type ClassId = 'fighter' | 'rogue' | 'wizard' | 'cleric';
export type DamageType =
  | 'slashing'
  | 'piercing'
  | 'bludgeoning'
  | 'fire'
  | 'cold'
  | 'radiant'
  | 'necrotic'
  | 'poison'
  | 'force'
  | 'acid'
  | 'lightning'
  | 'thunder'
  | 'psychic';

export type ConditionId =
  | 'prone'
  | 'poisoned'
  | 'unconscious'
  | 'dodging'
  | 'asleep'
  | 'blessed'
  | 'shielded'
  | 'disengaged'
  | 'stable'
  | 'spirit_guardians'
  | 'frightened';

export interface ActiveCondition {
  id: ConditionId;
  /** Rounds remaining; undefined means until removed. */
  rounds?: number;
}

// ---------------------------------------------------------------------------
// Character

export interface InventoryItem {
  /** Unique id of this stack within the inventory. */
  uid: string;
  /** Catalog item id, or 'custom' for DM-granted unique items. */
  itemId: string;
  qty: number;
  equipped?: boolean;
  /** Only for custom items. */
  name?: string;
  description?: string;
}

export interface SpellSlots {
  /** Index = spell level (1..3). */
  max: number[];
  used: number[];
}

export interface Character {
  id: string;
  userId: string;
  name: string;
  color: string;
  race: RaceId;
  class: ClassId;
  level: number;
  xp: number;
  /** Final scores including racial bonuses. */
  abilities: AbilityScores;
  maxHp: number;
  hp: number;
  tempHp: number;
  hitDice: number;
  skills: Skill[];
  inventory: InventoryItem[];
  gold: number;
  spells: string[];
  spellSlots: SpellSlots;
  /** Per-rest feature uses, e.g. { second_wind: 1 }. */
  featureUses: Record<string, number>;
  conditions: ActiveCondition[];
  deathSaves: { successes: number; failures: number };
  status: 'alive' | 'dead';
  activeCampaignId: string | null;
  /** Where and how the character died, for the fallen heroes archive. */
  epitaph?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CharacterDraft {
  name: string;
  color: string;
  race: RaceId;
  class: ClassId;
  /** Base scores before racial bonuses. */
  baseAbilities: AbilityScores;
  skills: Skill[];
}

// ---------------------------------------------------------------------------
// Dice

export type AdvantageMode = 'none' | 'advantage' | 'disadvantage';

export interface RollResult {
  id: string;
  /** e.g. "1d20+5" */
  expression: string;
  /** Individual die faces. For advantage both d20s are listed. */
  dice: { sides: number; value: number; dropped?: boolean }[];
  modifier: number;
  total: number;
  label: string;
  kind: 'check' | 'save' | 'attack' | 'damage' | 'initiative' | 'death_save' | 'heal' | 'other';
  advantage?: AdvantageMode;
  dc?: number;
  /** Whether the DC was visible to the player. */
  dcVisible?: boolean;
  success?: boolean;
  critical?: 'hit' | 'miss';
  actor?: string;
}

// ---------------------------------------------------------------------------
// Maps

export type MapKind = 'tavern' | 'dungeon' | 'cellar' | 'cave' | 'battlefield';
export type SceneKind = MapKind | 'outdoor' | 'town';

/**
 * Tile codes, one char per tile:
 * ' ' void, '.' floor, '#' wall, '+' closed door, '/' open door,
 * '~' water, '"' grass, ',' dirt, '>' stairs down, '<' stairs up, '=' wooden floor
 */
export type TileChar = ' ' | '.' | '#' | '+' | '/' | '~' | '"' | ',' | '>' | '<' | '=';

export type PropKind =
  | 'bar_counter'
  | 'table'
  | 'chair'
  | 'fireplace'
  | 'barrel'
  | 'crate'
  | 'chest'
  | 'bed'
  | 'altar'
  | 'statue'
  | 'pillar'
  | 'rubble'
  | 'torch'
  | 'tree'
  | 'rock'
  | 'bookshelf'
  | 'stool'
  | 'bones'
  | 'campfire';

export interface Prop {
  id: string;
  kind: PropKind;
  x: number;
  y: number;
  /** Rotation in quarter turns (0..3). */
  rot?: number;
  blocksMove: boolean;
  blocksSight: boolean;
  /** Optional story tag, e.g. "locked", "secret". */
  tag?: string;
}

export interface Room {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LightSource {
  x: number;
  y: number;
  radius: number;
  color?: string;
}

export interface GameMap {
  id: string;
  kind: MapKind;
  seed: number;
  width: number;
  height: number;
  tiles: string[];
  props: Prop[];
  rooms: Room[];
  lights: LightSource[];
  spawn: { x: number; y: number };
  /** Ambient light 0..1. Taverns are bright, dungeons dark. */
  ambient: number;
  /** Named spots used for placing NPCs and story objects, e.g. "behind_bar". */
  anchors: Record<string, { x: number; y: number }>;
}

export interface Token {
  id: string;
  kind: 'player' | 'npc' | 'monster';
  name: string;
  x: number;
  y: number;
  color: string;
  hp?: number;
  maxHp?: number;
  hostile?: boolean;
  dead?: boolean;
  /** Marks the token whose turn it is in combat. */
  active?: boolean;
}

/**
 * Fog rows, one char per tile: '0' unexplored, '1' explored (remembered), '2' visible now.
 */
export type FogRows = string[];

// ---------------------------------------------------------------------------
// Campaign memory

export interface NpcMemory {
  id: string;
  name: string;
  description: string;
  /** -3 hostile .. +3 devoted */
  attitude: number;
  notes: string[];
  /** Whether the NPC is currently in the scene. */
  present: boolean;
  /** The player has met this NPC (shown in the journal). */
  known?: boolean;
  alive: boolean;
  x?: number;
  y?: number;
}

export interface Quest {
  id: string;
  title: string;
  status: 'active' | 'completed' | 'failed';
  notes: string[];
}

export interface Fact {
  id: string;
  text: string;
  importance: 'minor' | 'major';
  turn: number;
}

export interface Scene {
  id: string;
  name: string;
  kind: SceneKind;
  description: string;
}

// ---------------------------------------------------------------------------
// Combat

export interface Combatant {
  id: string;
  kind: 'player' | 'monster' | 'npc';
  team: 'party' | 'enemy';
  name: string;
  /** Monster catalog id for monsters. */
  refId: string;
  hp: number;
  maxHp: number;
  ac: number;
  speed: number;
  initiative: number;
  x: number;
  y: number;
  conditions: ActiveCondition[];
  dead: boolean;
  fled: boolean;
}

export interface TurnBudget {
  /** Remaining movement in feet. */
  movement: number;
  action: boolean;
  bonusAction: boolean;
  reaction: boolean;
  /** Extra attacks left in the current Attack action. */
  attacksLeft: number;
  sneakAttackUsed: boolean;
}

export interface CombatState {
  round: number;
  turnIndex: number;
  order: string[];
  combatants: Record<string, Combatant>;
  budget: TurnBudget;
  /** Combatant ids that used their reaction this round. */
  reactionUsed: string[];
  /** Mechanical events since the last DM narration. */
  pendingEvents: string[];
}

export type CombatAction =
  | { kind: 'move'; x: number; y: number }
  | { kind: 'attack'; targetId: string; weaponUid?: string }
  | { kind: 'cast'; spellId: string; targetId?: string }
  | { kind: 'dash' }
  | { kind: 'dodge' }
  | { kind: 'disengage' }
  | { kind: 'use_item'; itemUid: string }
  | { kind: 'second_wind' }
  | { kind: 'action_surge' }
  | { kind: 'turn_undead' }
  | { kind: 'end_turn' };

// ---------------------------------------------------------------------------
// Turn flow

export interface Choice {
  id: string;
  label: string;
  /** Optional mechanical hint shown to the player, e.g. a skill. */
  skill?: Skill | Ability;
  dc?: number;
}

export type PendingInput =
  | {
      type: 'check';
      kind: 'skill' | 'ability' | 'save';
      key: Skill | Ability;
      dc: number;
      advantage: AdvantageMode;
      reason: string;
    }
  | { type: 'choice'; choices: Choice[] }
  | { type: 'death_save' };

export type LogEntry =
  | { id: string; kind: 'dm'; text: string; turn: number }
  | { id: string; kind: 'player'; text: string; turn: number }
  | { id: string; kind: 'roll'; roll: RollResult; turn: number }
  | { id: string; kind: 'system'; text: string; turn: number; tone?: 'info' | 'good' | 'bad' };

export type PlayerAction =
  | { type: 'begin' }
  | { type: 'say'; text: string }
  | { type: 'choose'; choiceId: string }
  | { type: 'roll' }
  | { type: 'move'; x: number; y: number }
  | { type: 'combat'; action: CombatAction }
  | { type: 'death_save' }
  | { type: 'rest'; kind: 'short' | 'long' }
  | { type: 'continue' }
  | { type: 'use_item'; itemUid: string }
  | { type: 'cast'; spellId: string }
  | { type: 'equip'; itemUid: string };

export type CampaignStatus = 'active' | 'victory' | 'defeat' | 'abandoned';

/** What the client sees of a campaign. Secrets are stripped. */
export interface CampaignView {
  id: string;
  adventureId: string;
  adventureTitle: string;
  difficulty: Difficulty;
  locale: Locale;
  status: CampaignStatus;
  turn: number;
  scene: Scene;
  map: GameMap | null;
  fog: FogRows | null;
  tokens: Token[];
  character: Character;
  combat: CombatState | null;
  /** Combatant id of the player in combat. */
  playerCombatantId: string | null;
  /** Tiles the player can move to right now (combat only). */
  moveTargets: { x: number; y: number }[];
  /** The DM has unanswered work queued (e.g. after a network error). */
  needsContinue: boolean;
  /** Short line shown when the campaign has ended. */
  ending: string | null;
  pending: PendingInput | null;
  log: LogEntry[];
  npcs: NpcMemory[];
  quests: Quest[];
  facts: Fact[];
  busy: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CampaignSummary {
  id: string;
  adventureId: string;
  adventureTitle: string;
  characterId: string;
  characterName: string;
  status: CampaignStatus;
  difficulty: Difficulty;
  sceneName: string;
  updatedAt: number;
}

export interface AdventureSummary {
  id: string;
  title: Loc;
  blurb: Loc;
  recommendedLevel: number;
  lengthHours: number;
}

/** Events streamed (NDJSON) while a turn is processed. */
export type TurnEvent =
  | { type: 'narration_start'; entryId: string }
  | { type: 'narration_delta'; entryId: string; text: string }
  | { type: 'roll'; roll: RollResult }
  | { type: 'state'; view: CampaignView }
  | { type: 'error'; message: string; code?: string }
  | { type: 'done' };
