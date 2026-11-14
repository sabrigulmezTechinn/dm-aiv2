import type { Difficulty, Loc, Locale, SceneKind } from '@dmai/shared';
import type { EnemySpec } from '@dmai/rules';

export interface AdventureNpc {
  id: string;
  /** English name (also the default). */
  name: string;
  /** English description. */
  description: string;
  /** Turkish name, e.g. "Yaşlı Tobin". */
  nameTr: string;
  /** Turkish description. */
  descriptionTr: string;
  attitude: number;
  /** Map anchor to place the NPC at when the scene loads. */
  anchor?: string;
}

export interface AdventureScene {
  id: string;
  name: Loc;
  kind: SceneKind;
  /** English description for the DM. */
  description: string;
  npcs: AdventureNpc[];
  /** Suggested encounter for this location (easy / default). */
  encounter?: EnemySpec[];
  /** Replaces `encounter` on the given difficulty (e.g. two wolves on hard). */
  encounterHard?: EnemySpec[];
  /** Scenes reachable from here. */
  exits: string[];
}

export interface Adventure {
  id: string;
  title: Loc;
  blurb: Loc;
  recommendedLevel: number;
  lengthHours: number;
  /** English brief for the DM: premise, secrets, structure, ending. */
  brief: string;
  startScene: string;
  scenes: Record<string, AdventureScene>;
  startQuest: { id: string; title: Loc };
  /** Data used only by the offline mock DM. */
  mock: {
    opening: Loc;
    choices: Record<string, Loc[]>;
  };
}

export function npcName(npc: AdventureNpc, locale: Locale): string {
  return locale === 'tr' ? npc.nameTr : npc.name;
}

export function npcDescription(npc: AdventureNpc, locale: Locale): string {
  return locale === 'tr' ? npc.descriptionTr : npc.description;
}

/** Suggested encounter for a scene on the given difficulty. */
export function sceneEncounter(scene: AdventureScene, difficulty: Difficulty): EnemySpec[] | undefined {
  return difficulty === 'hard' && scene.encounterHard ? scene.encounterHard : scene.encounter;
}
