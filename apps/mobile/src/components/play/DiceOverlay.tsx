import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { RollResult } from '@dmai/shared';
import { useI18n } from '../../lib/i18n';
import { colors, fonts, space } from '../../lib/theme';
import { Icon, Txt } from '../ui';
import { rollSummary } from './NarrativeLog';

/** Shows the player's own d20 rolls with a short tumble animation. */
export function DiceOverlay({ rolls, playerName, onDone }: { rolls: RollResult[]; playerName: string; onDone: () => void }) {
  const { t } = useI18n();
  const current = rolls[0];
  const show = !!current && current.actor === playerName && current.dice.some((d) => d.sides === 20);
  const spin = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const [face, setFace] = useState(20);
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    if (!current) return;
    if (!show) {
      onDone();
      return;
    }
    setLanded(false);
    spin.setValue(0);
    fade.setValue(1);
    const ticker = setInterval(() => setFace(1 + Math.floor(Math.random() * 20)), 60);
    Animated.timing(spin, { toValue: 1, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start(() => {
      clearInterval(ticker);
      const kept = current.dice.find((d) => d.sides === 20 && !d.dropped);
      setFace(kept?.value ?? current.total);
      setLanded(true);
      if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      Animated.timing(fade, { toValue: 0, delay: 1100, duration: 300, useNativeDriver: Platform.OS !== 'web' }).start(() => onDone());
    });
    return () => clearInterval(ticker);
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!current || !show) return null;
  const tone = current.critical === 'hit' ? colors.gold : current.success === true ? colors.green : current.success === false ? colors.red : colors.parchment;
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '720deg'] });
  const scale = spin.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.4, 1.15, 1] });
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', opacity: fade, backgroundColor: 'rgba(8,6,5,0.45)' }}>
      <Animated.View style={{ transform: [{ rotate }, { scale }] }}>
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="hexagon" size={150} color={landed ? tone : colors.goldDim} />
          <View style={{ position: 'absolute' }}>
            <Txt style={{ fontFamily: fonts.serif, fontSize: 40, fontWeight: '800', color: '#140f0a' }}>{face}</Txt>
          </View>
        </View>
      </Animated.View>
      {landed ? (
        <View style={{ marginTop: space(3), alignItems: 'center', backgroundColor: 'rgba(20,16,13,0.92)', paddingHorizontal: space(4), paddingVertical: space(2), borderRadius: 12, borderWidth: 1, borderColor: tone }}>
          <Txt variant="h3" style={{ color: tone }}>
            {current.critical === 'hit' ? t('crit') : current.critical === 'miss' ? t('fumble') : current.success === undefined ? current.total : current.success ? t('success') : t('failure')}
          </Txt>
          <Txt variant="small">{current.label}</Txt>
          <Txt variant="muted">{rollSummary(current, t)}</Txt>
        </View>
      ) : null}
    </Animated.View>
  );
}
