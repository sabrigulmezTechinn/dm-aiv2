import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { Scene } from '@dmai/shared';
import { useI18n } from '../../lib/i18n';
import { colors, space } from '../../lib/theme';
import { Icon, Txt, type IconName } from '../ui';

const ICONS: Record<string, IconName> = { outdoor: 'pine-tree', town: 'home-outline' };

export function SceneCard({ scene, large, style }: { scene: Scene; large?: boolean; style?: StyleProp<ViewStyle> }) {
  const { t } = useI18n();
  return (
    <View
      style={[
        { height: large ? undefined : 120, margin: space(3), marginBottom: 0, borderRadius: 16, backgroundColor: '#1d2418', borderWidth: 1, borderColor: '#34402a', overflow: 'hidden', padding: space(large ? 8 : 4), justifyContent: 'flex-end' },
        style,
      ]}
    >
      <View style={{ position: 'absolute', right: large ? 40 : -6, bottom: large ? 40 : -18, opacity: 0.22 }}>
        <Icon name={ICONS[scene.kind] ?? 'map-outline'} size={large ? 320 : 130} color="#8fb873" />
      </View>
      {large ? (
        <View style={{ position: 'absolute', left: 60, top: 70, opacity: 0.12 }}>
          <Icon name="pine-tree" size={180} color="#8fb873" />
        </View>
      ) : null}
      <Txt variant="label" style={{ color: '#8fb873' }}>
        {t('sceneCard')}
      </Txt>
      <Txt variant="h2" style={{ color: colors.parchment, fontSize: large ? 34 : 22 }}>
        {scene.name}
      </Txt>
    </View>
  );
}
