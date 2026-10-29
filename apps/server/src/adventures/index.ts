import type { AdventureSummary } from '@dmai/shared';
import { lostCaravan } from './lost-caravan';
import type { Adventure } from './types';
import { willowInn } from './willow-inn';

export const ADVENTURES: Record<string, Adventure> = {
  [willowInn.id]: willowInn,
  [lostCaravan.id]: lostCaravan,
};

export function getAdventure(id: string): Adventure | undefined {
  return ADVENTURES[id];
}

export function adventureSummaries(): AdventureSummary[] {
  return Object.values(ADVENTURES).map((a) => ({
    id: a.id,
    title: a.title,
    blurb: a.blurb,
    recommendedLevel: a.recommendedLevel,
    lengthHours: a.lengthHours,
  }));
}

export type { Adventure, AdventureScene, AdventureNpc } from './types';
