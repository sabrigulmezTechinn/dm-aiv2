import type { Locale } from '@dmai/shared';

const T = {
  initiative: { en: 'Initiative: {order}.', tr: 'İnisiyatif: {order}.' },
  round: { en: 'Round {n}.', tr: '{n}. tur.' },
  turn: { en: "{a}'s turn.", tr: 'Sıra {a} karakterinde.' },
  hit: { en: '{a} hits {t} with {w} for {d} damage.', tr: '{a}, {w} ile {t} hedefini vurdu ({d} hasar).' },
  crit: { en: '{a} lands a critical hit on {t} with {w} for {d} damage!', tr: '{a}, {w} ile {t} hedefine kritik vuruş yaptı ({d} hasar)!' },
  miss: { en: '{a} misses {t} with {w}.', tr: '{a}, {w} ile {t} hedefini ıskaladı.' },
  falls: { en: '{t} falls.', tr: '{t} yere yığıldı.' },
  downed: { en: '{t} drops to 0 HP and is dying!', tr: '{t} 0 HP\'ye düştü ve ölüyor!' },
  relentless: { en: '{t} refuses to fall and stays at 1 HP!', tr: '{t} düşmeyi reddediyor ve 1 HP ile ayakta kalıyor!' },
  fortitude: { en: '{t} staggers but keeps coming (1 HP).', tr: '{t} sendeliyor ama ilerlemeye devam ediyor (1 HP).' },
  moves: { en: '{a} moves.', tr: '{a} hareket etti.' },
  flees: { en: '{a} panics and tries to flee!', tr: '{a} paniğe kapılıp kaçmaya çalışıyor!' },
  escaped: { en: '{a} escapes the fight.', tr: '{a} çatışmadan kaçtı.' },
  sleeps: { en: '{a} is fast asleep.', tr: '{a} derin uykuda.' },
  fallsAsleep: { en: '{t} falls asleep.', tr: '{t} uykuya daldı.' },
  wakes: { en: '{t} wakes up!', tr: '{t} uyandı!' },
  waits: { en: '{a} looms over the fallen.', tr: '{a} yere düşenin başında bekliyor.' },
  dash: { en: '{a} dashes.', tr: '{a} koşuyor.' },
  dodge: { en: '{a} takes a defensive stance.', tr: '{a} savunma pozisyonu aldı.' },
  disengage: { en: '{a} disengages.', tr: '{a} geri çekiliyor.' },
  opportunity: { en: '{a} gets an opportunity attack on {t}!', tr: '{a}, {t} hedefine fırsat saldırısı yapıyor!' },
  heal: { en: '{a} regains {d} HP.', tr: '{a} {d} HP kazandı.' },
  secondWind: { en: '{a} catches a second wind.', tr: '{a} ikinci nefesini buldu.' },
  surge: { en: '{a} surges with renewed vigor!', tr: '{a} yeni bir güçle atılıyor!' },
  cast: { en: '{a} casts {s}.', tr: '{a}, {s} büyüsünü yaptı.' },
  saveOk: { en: '{t} resists ({d} damage).', tr: '{t} direndi ({d} hasar).' },
  saveFail: { en: '{t} takes {d} {type} damage.', tr: '{t} {d} {type} hasarı aldı.' },
  saveNone: { en: '{t} avoids the effect.', tr: '{t} etkiden kurtuldu.' },
  prone: { en: '{t} is knocked prone.', tr: '{t} yere devrildi.' },
  poisoned: { en: '{t} is poisoned.', tr: '{t} zehirlendi.' },
  stands: { en: '{a} gets back up.', tr: '{a} ayağa kalktı.' },
  uncanny: { en: '{t} twists away, halving the damage.', tr: '{t} kıvrılarak hasarı yarıya indirdi.' },
  deathSaveOk: { en: 'Death save success ({s}/{n}).', tr: 'Ölüm kurtarması başarılı ({s}/{n}).' },
  deathSaveFail: { en: 'Death save failure ({f}/3).', tr: 'Ölüm kurtarması başarısız ({f}/3).' },
  stable: { en: '{a} is stable.', tr: '{a} stabil durumda.' },
  revive: { en: '{a} surges back to consciousness with 1 HP!', tr: '{a} 1 HP ile bilincine kavuştu!' },
  died: { en: '{a} has died.', tr: '{a} öldü.' },
  victory: { en: 'Victory! {xp} XP.', tr: 'Zafer! {xp} XP.' },
  guardians: { en: 'Spirit guardians sear {t}.', tr: 'Ruh muhafızları {t} hedefini yakıyor.' },
  turned: { en: '{t} recoils from the holy symbol!', tr: '{t} kutsal sembolden geri çekiliyor!' },
  destroyed: { en: '{t} crumbles to dust!', tr: '{t} toza dönüştü!' },
  missiles: { en: '{n} glowing darts strike {t} for {d} force damage.', tr: '{n} parlak ok {t} hedefine çarptı ({d} güç hasarı).' },
  buff: { en: '{a} is wrapped in {s}.', tr: '{a}, {s} ile kuşatıldı.' },
} as const;

export type TextKey = keyof typeof T;

export function tx(locale: Locale, k: TextKey, params: Record<string, string | number> = {}): string {
  let s: string = T[k][locale] ?? T[k].en;
  for (const [p, v] of Object.entries(params)) s = s.split(`{${p}}`).join(String(v));
  return s;
}

const DAMAGE_TR: Record<string, string> = {
  slashing: 'kesme', piercing: 'delme', bludgeoning: 'ezme', fire: 'ateş', cold: 'soğuk', radiant: 'ışıltı',
  necrotic: 'nekrotik', poison: 'zehir', force: 'güç', acid: 'asit', lightning: 'şimşek', thunder: 'gök gürültüsü', psychic: 'psişik',
};

export function damageTypeName(type: string, locale: Locale): string {
  return locale === 'tr' ? DAMAGE_TR[type] ?? type : type;
}
