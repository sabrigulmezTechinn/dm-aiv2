let counter = 0;

/** Short random id, URL safe. */
export function uid(prefix = ''): string {
  counter = (counter + 1) % 1_000_000;
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36).slice(-5);
  return `${prefix}${time}${rand}${counter.toString(36)}`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function loc(l: { en: string; tr: string }, locale: 'en' | 'tr'): string {
  return l[locale] ?? l.en;
}

export function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}
