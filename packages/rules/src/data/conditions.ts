import type { ConditionId, Loc } from '@dmai/shared';

export const CONDITIONS: Record<ConditionId, { name: Loc; description: Loc }> = {
  prone: { name: { en: 'Prone', tr: 'Yerde' }, description: { en: 'Melee attacks against you have advantage.', tr: 'Sana yakın saldırılar avantajlı.' } },
  poisoned: { name: { en: 'Poisoned', tr: 'Zehirli' }, description: { en: 'Disadvantage on attacks and checks.', tr: 'Saldırı ve kontrollerde dezavantaj.' } },
  unconscious: { name: { en: 'Unconscious', tr: 'Baygın' }, description: { en: 'You are dying.', tr: 'Ölüyorsun.' } },
  dodging: { name: { en: 'Dodging', tr: 'Kaçınıyor' }, description: { en: 'Attacks against you have disadvantage.', tr: 'Sana saldırılar dezavantajlı.' } },
  asleep: { name: { en: 'Asleep', tr: 'Uykuda' }, description: { en: 'Helpless until damaged.', tr: 'Hasar alana kadar savunmasız.' } },
  blessed: { name: { en: 'Blessed', tr: 'Kutsanmış' }, description: { en: '+1d4 to attacks and saves.', tr: 'Saldırı ve kurtarmalara +1d4.' } },
  shielded: { name: { en: 'Shielded', tr: 'Kalkanlı' }, description: { en: '+5 AC.', tr: '+5 ZS.' } },
  disengaged: { name: { en: 'Disengaged', tr: 'Geri çekiliyor' }, description: { en: 'Your movement provokes no opportunity attacks.', tr: 'Hareketin fırsat saldırısı tetiklemez.' } },
  stable: { name: { en: 'Stable', tr: 'Stabil' }, description: { en: 'Unconscious but no longer dying.', tr: 'Baygın ama artık ölmüyor.' } },
  spirit_guardians: { name: { en: 'Spirit Guardians', tr: 'Ruh Muhafızları' }, description: { en: 'Spirits harm enemies near you.', tr: 'Ruhlar yakınındaki düşmanlara zarar verir.' } },
  frightened: { name: { en: 'Frightened', tr: 'Korkmuş' }, description: { en: 'Flees from its source.', tr: 'Kaynağından kaçar.' } },
};
