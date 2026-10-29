import type { Loc, SceneKind } from '@dmai/shared';
import type { EnemySpec } from '@dmai/rules';

export interface AdventureNpc {
  id: string;
  name: string;
  description: string;
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
  /** Suggested encounter for this location. */
  encounter?: EnemySpec[];
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
