import React, { useEffect, useRef } from 'react';
import { ScrollView, View, type ScrollViewInstance } from 'react-native';
import type { LogEntry, RollResult } from '@dmai/shared';
import { useI18n } from '../../lib/i18n';
import { colors, fonts, radius, space } from '../../lib/theme';
import { Icon, Txt } from '../ui';
import type { LiveEntry } from './usePlay';

export function rollSummary(r: RollResult, t: ReturnType<typeof useI18n>['t']): string {
  const faces = r.dice.map((d) => (d.dropped ? `(${d.value})` : String(d.value))).join(' ');
  const mod = r.modifier ? ` ${r.modifier > 0 ? '+' : '−'} ${Math.abs(r.modifier)}` : '';
  let s = `${faces}${mod} = ${r.total}`;
  if (r.dc !== undefined && r.dcVisible) s += ` · ${t('dc', { n: r.dc })}`;
  return s;
}

function RollLine({ r }: { r: RollResult }) {
  const { t } = useI18n();
  const ok = r.success === true;
  const bad = r.success === false;
  const tone = r.critical === 'hit' ? colors.gold : ok ? colors.green : bad ? colors.red : colors.muted;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2), paddingVertical: 2 }}>
      <Icon name="dice-d20-outline" size={16} color={tone} />
      <Txt variant="small" style={{ color: colors.muted, flexShrink: 1 }}>
        <Txt variant="small" style={{ color: colors.text, fontWeight: '600' }}>
          {r.actor ? `${r.actor}: ` : ''}
          {r.label}
        </Txt>{' '}
        {rollSummary(r, t)}
        {r.critical === 'hit' ? ` · ${t('crit')}` : r.critical === 'miss' ? ` · ${t('fumble')}` : ''}
        {r.success !== undefined ? ` · ${ok ? t('success') : t('failure')}` : ''}
      </Txt>
    </View>
  );
}

function Entry({ e }: { e: LogEntry }) {
  if (e.kind === 'dm') {
    return (
      <Txt variant="serif" style={{ marginVertical: space(1) }}>
        {e.text}
      </Txt>
    );
  }
  if (e.kind === 'player') {
    return (
      <View style={{ alignSelf: 'flex-end', maxWidth: '85%', backgroundColor: colors.surface3, borderRadius: radius.lg, borderBottomRightRadius: 4, paddingHorizontal: space(3), paddingVertical: space(2), marginVertical: space(1) }}>
        <Txt variant="body">{e.text}</Txt>
      </View>
    );
  }
  if (e.kind === 'roll') return <RollLine r={e.roll} />;
  const tone = e.tone === 'good' ? colors.green : e.tone === 'bad' ? colors.red : colors.muted;
  return (
    <Txt variant="small" style={{ color: tone, fontStyle: 'italic', paddingVertical: 1 }}>
      {e.text}
    </Txt>
  );
}

export function NarrativeLog({ log, live, busy }: { log: LogEntry[]; live: LiveEntry[]; busy: boolean }) {
  const { t } = useI18n();
  const ref = useRef<ScrollViewInstance>(null);
  const liveLen = live.reduce((s, l) => s + l.text.length, 0);
  useEffect(() => {
    const id = setTimeout(() => ref.current?.scrollToEnd({ animated: true }), 30);
    return () => clearTimeout(id);
  }, [log.length, liveLen, busy]);
  const shown = log.slice(-120);
  return (
    <ScrollView ref={ref} style={{ flex: 1 }} contentContainerStyle={{ padding: space(4), paddingBottom: space(6), gap: 2 }}>
      {shown.map((e) => (
        <Entry key={e.id} e={e} />
      ))}
      {live
        .filter((l) => l.text && !log.some((x) => x.id === l.id))
        .map((l) => (
          <Txt key={l.id} variant="serif" style={{ marginVertical: space(1) }}>
            {l.text}
            <Txt variant="serif" style={{ color: colors.gold }}>
              ▍
            </Txt>
          </Txt>
        ))}
      {busy && !live.some((l) => l.text) ? (
        <Txt variant="muted" style={{ fontFamily: fonts.serif, fontStyle: 'italic', marginTop: space(2) }}>
          {t('dmThinking')}
        </Txt>
      ) : null}
    </ScrollView>
  );
}
