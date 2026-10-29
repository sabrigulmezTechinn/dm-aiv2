import type { Locale } from '@dmai/shared';

const S = {
  gotItem: { en: 'You receive: {item} ×{n}.', tr: 'Aldın: {item} ×{n}.' },
  lostItem: { en: 'You lose: {item} ×{n}.', tr: 'Kaybettin: {item} ×{n}.' },
  gold: { en: 'Gold {sign}{n} (now {total}).', tr: 'Altın {sign}{n} (şimdi {total}).' },
  xp: { en: '+{n} XP ({reason}).', tr: '+{n} XP ({reason}).' },
  levelUp: { en: 'Level up! You are now level {n} (+{hp} max HP).', tr: 'Seviye atladın! Artık {n}. seviyesin (+{hp} azami HP).' },
  damage: { en: 'You take {n} {type} damage ({reason}).', tr: '{n} {type} hasarı aldın ({reason}).' },
  heal: { en: 'You regain {n} HP.', tr: '{n} HP kazandın.' },
  blackout: { en: 'You black out... and come to later with 1 HP.', tr: 'Bayılıyorsun... ve bir süre sonra 1 HP ile kendine geliyorsun.' },
  died: { en: '{name} has died.', tr: '{name} öldü.' },
  questNew: { en: 'New quest: {t}', tr: 'Yeni görev: {t}' },
  questDone: { en: 'Quest completed: {t}', tr: 'Görev tamamlandı: {t}' },
  questFailed: { en: 'Quest failed: {t}', tr: 'Görev başarısız: {t}' },
  sceneChange: { en: 'Location: {name}', tr: 'Konum: {name}' },
  combatStart: { en: 'Combat begins!', tr: 'Savaş başladı!' },
  combatEnd: { en: 'The fight is over.', tr: 'Çatışma sona erdi.' },
  restShort: { en: 'Short rest: +{hp} HP.', tr: 'Kısa dinlenme: +{hp} HP.' },
  restLong: { en: 'Long rest: fully restored.', tr: 'Uzun dinlenme: tamamen toparlandın.' },
  restDenied: { en: 'You cannot rest here.', tr: 'Burada dinlenemezsin.' },
  captured: { en: 'You fall unconscious as the enemies close in...', tr: 'Düşmanlar etrafını sararken bilincini kaybediyorsun...' },
  victory: { en: 'Adventure complete!', tr: 'Macera tamamlandı!' },
  defeat: { en: 'Your story ends here.', tr: 'Hikâyen burada sona eriyor.' },
  dmError: { en: 'The Dungeon Master lost the thread for a moment. Tap Continue to try again.', tr: 'Zindan Efendisi bir anlığına ipin ucunu kaçırdı. Tekrar denemek için Devam\'a dokun.' },
  dmRefusal: { en: 'The Dungeon Master pauses and steers the story elsewhere.', tr: 'Zindan Efendisi duraksıyor ve hikâyeyi başka bir yöne çeviriyor.' },
  condition: { en: '{c}: {state}.', tr: '{c}: {state}.' },
  equipped: { en: 'Equipped: {item}.', tr: 'Kuşandın: {item}.' },
  unequipped: { en: 'Unequipped: {item}.', tr: 'Çıkardın: {item}.' },
} as const;

export type ServerTextKey = keyof typeof S;

export function sx(locale: Locale, k: ServerTextKey, p: Record<string, string | number> = {}): string {
  let s: string = S[k][locale] ?? S[k].en;
  for (const [key, v] of Object.entries(p)) s = s.split(`{${key}}`).join(String(v));
  return s;
}
