import React, { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { CampaignView } from '@dmai/shared';
import BoardView, { type BoardCommand } from '../map/BoardView.dom';
import { useI18n } from '../../lib/i18n';
import { colors, radius, space } from '../../lib/theme';
import { IconButton } from '../ui';

export function MapPanel({
  view,
  mode,
  onToggleMode,
  targetIds,
  onTileTap,
  onTokenTap,
  style,
}: {
  view: CampaignView;
  mode: '2d' | '3d';
  onToggleMode: () => void;
  targetIds: string[];
  onTileTap: (x: number, y: number) => void;
  onTokenTap: (id: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useI18n();
  const [command, setCommand] = useState<BoardCommand | null>(null);
  const send = (kind: BoardCommand['kind']) => setCommand({ id: Date.now(), kind });
  const player = view.tokens.find((x) => x.kind === 'player');
  if (!view.map) return null;
  return (
    <View style={[{ overflow: 'hidden', borderRadius: radius.lg, margin: space(3), marginBottom: 0, borderWidth: 1, borderColor: colors.border, backgroundColor: '#0d0a08' }, style]}>
      <BoardView
        map={view.map}
        fog={view.fog}
        tokens={view.tokens}
        moveTargets={view.moveTargets}
        targetIds={targetIds}
        focusId={player?.id ?? null}
        mode={mode}
        command={command}
        onTileTap={async (x, y) => onTileTap(x, y)}
        onTokenTap={async (id) => onTokenTap(id)}
        dom={{ style: { flex: 1 }, scrollEnabled: false, bounces: false, containerStyle: { flex: 1 } } as never}
      />
      <View style={{ position: 'absolute', right: space(2), top: space(2), gap: space(2) }}>
        <IconButton icon={mode === '3d' ? 'grid' : 'cube-outline'} label={mode === '3d' ? t('view2d') : t('view3d')} onPress={onToggleMode} testID="toggle-view" />
        <IconButton icon="plus" label="zoom in" onPress={() => send('zoomIn')} />
        <IconButton icon="minus" label="zoom out" onPress={() => send('zoomOut')} />
        <IconButton icon="crosshairs-gps" label="recenter" onPress={() => send('recenter')} />
      </View>
    </View>
  );
}
