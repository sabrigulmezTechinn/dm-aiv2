import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Platform, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../lib/app-state';
import { useI18n } from '../../lib/i18n';
import { colors, space } from '../../lib/theme';
import { Bar, Button, Header, IconButton, Loading, Row, Txt } from '../../components/ui';
import { CharacterSheet } from '../../components/CharacterSheet';
import { usePlay } from '../../components/play/usePlay';
import { NarrativeLog } from '../../components/play/NarrativeLog';
import { MapPanel } from '../../components/play/MapPanel';
import { SceneCard } from '../../components/play/SceneCard';
import { CombatTracker } from '../../components/play/CombatTracker';
import { ActionPanel, type Targeting } from '../../components/play/ActionPanel';
import { DiceOverlay } from '../../components/play/DiceOverlay';
import { JournalView } from '../../components/play/JournalView';

export default function Play() {
  const { id, begin } = useLocalSearchParams<{ id: string; begin?: string }>();
  const { viewMode, setViewMode, api } = useApp();
  const { t } = useI18n();
  const { view, live, busy, error, setError, act, rolls, shiftRoll } = usePlay(id);
  const [targeting, setTargeting] = useState<Targeting>(null);
  const [drawer, setDrawer] = useState<'sheet' | 'journal' | null>(null);
  const { width, height } = useWindowDimensions();
  const wide = width >= 900;
  const began = useRef(false);

  // Start the story on a fresh campaign.
  useEffect(() => {
    if (!view || began.current) return;
    if (view.status === 'active' && view.turn === 0 && view.log.length === 0) {
      began.current = true;
      void act({ type: 'begin' });
    }
  }, [view, act, begin]);

  // Leave targeting mode when the turn changes.
  useEffect(() => {
    if (!view?.combat) setTargeting(null);
  }, [view?.combat]);

  const targetIds = useMemo(() => {
    if (!view?.combat || !targeting) return [];
    return Object.values(view.combat.combatants)
      .filter((c) => c.team === 'enemy' && !c.dead && !c.fled)
      .map((c) => c.id);
  }, [view?.combat, targeting]);

  if (!view) return error ? <Loading label={error} /> : <Loading />;

  const myTurn = !!view.combat && view.combat.order[view.combat.turnIndex] === view.playerCombatantId;
  const onTileTap = (x: number, y: number) => {
    if (busy || view.status !== 'active' || view.pending?.type === 'check' || view.pending?.type === 'death_save') return;
    if (view.combat) {
      if (!myTurn || targeting) return;
      if (view.moveTargets.some((m) => m.x === x && m.y === y)) void act({ type: 'combat', action: { kind: 'move', x, y } });
      return;
    }
    void act({ type: 'move', x, y });
  };
  const onTokenTap = (tokenId: string) => {
    if (busy || view.status !== 'active') return;
    const enemy = view.combat?.combatants[tokenId];
    if (view.combat && enemy && enemy.team === 'enemy' && !enemy.dead && myTurn && !view.pending) {
      const tg = targeting ?? { kind: 'attack' as const };
      setTargeting(null);
      void act({ type: 'combat', action: tg.kind === 'attack' ? { kind: 'attack', targetId: tokenId } : { kind: 'cast', spellId: tg.spellId, targetId: tokenId } });
    }
  };

  const abandon = () => {
    const go = () => api.abandon(view.id).then(() => router.dismissTo('/'));
    if (Platform.OS === 'web') {
      if (window.confirm(t('abandonConfirm'))) void go();
    } else Alert.alert(t('abandon'), t('abandonConfirm'), [{ text: t('cancel'), style: 'cancel' }, { text: t('abandon'), style: 'destructive', onPress: () => void go() }]);
  };

  const c = view.character;
  const mapHeight = wide ? undefined : Math.round(height * (view.combat ? 0.42 : 0.36));
  const visual = view.map ? (
    <MapPanel
      view={view}
      mode={viewMode}
      onToggleMode={() => setViewMode(viewMode === '3d' ? '2d' : '3d')}
      targetIds={targetIds}
      onTileTap={onTileTap}
      onTokenTap={onTokenTap}
      style={wide ? { flex: 1, marginBottom: space(3) } : { height: mapHeight }}
    />
  ) : (
    <SceneCard scene={view.scene} large={wide} style={wide ? { flex: 1, marginBottom: space(3) } : undefined} />
  );

  const story = (
    <View style={{ flex: 1 }}>
      {view.combat ? <CombatTracker view={view} onPick={myTurn ? (tid) => onTokenTap(tid) : undefined} /> : null}
      <NarrativeLog log={view.log} live={live} busy={busy} />
      {view.ending && view.status !== 'active' ? (
        <View style={{ paddingHorizontal: space(4), paddingBottom: space(2) }}>
          <Txt variant="label">{t('adventureOver')}</Txt>
        </View>
      ) : null}
      {error ? (
        <Row style={{ backgroundColor: '#3a1f1b', paddingHorizontal: space(3), paddingVertical: space(2) }}>
          <Txt variant="small" style={{ flex: 1, color: '#f0b4aa' }}>
            {error}
          </Txt>
          <IconButton icon="close" label={t('close')} onPress={() => setError(null)} />
        </Row>
      ) : null}
      <ActionPanel view={view} busy={busy} act={(a) => void act(a)} targeting={targeting} setTargeting={setTargeting} onHome={() => router.dismissTo('/')} />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right', 'bottom']}>
      <View style={{ paddingHorizontal: space(3), paddingTop: space(2), gap: space(2) }}>
        <Header
          title={view.scene.name}
          onBack={() => router.dismissTo('/')}
          right={
            <Row gap={2}>
              <IconButton icon="book-open-page-variant" label={t('journal')} onPress={() => setDrawer('journal')} testID="open-journal" />
              <IconButton icon="account-circle-outline" label={t('sheet')} onPress={() => setDrawer('sheet')} testID="open-sheet" />
            </Row>
          }
        />
        <Row gap={2}>
          <Txt variant="small" style={{ fontWeight: '700' }}>
            {c.name}
          </Txt>
          <Bar value={c.hp} max={c.maxHp} style={{ flex: 1 }} height={7} color={c.hp / c.maxHp > 0.5 ? colors.green : c.hp / c.maxHp > 0.25 ? colors.gold : colors.red} />
          <Txt variant="muted">
            {t('hp')} {c.hp}/{c.maxHp}
          </Txt>
        </Row>
      </View>
      {wide ? (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={{ flex: 1.3 }}>{visual}</View>
          <View style={{ flex: 1, maxWidth: 560, borderLeftWidth: 1, borderLeftColor: colors.border }}>{story}</View>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {visual}
          {story}
        </View>
      )}
      <DiceOverlay rolls={rolls} playerName={c.name} onDone={shiftRoll} />
      <Modal visible={drawer !== null} animationType="slide" transparent={false} onRequestClose={() => setDrawer(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ padding: space(4), paddingBottom: 0 }}>
            <Header title={drawer === 'sheet' ? t('sheet') : t('journal')} onBack={() => setDrawer(null)} />
          </View>
          <ScrollView contentContainerStyle={{ padding: space(4), gap: space(4), maxWidth: 760, width: '100%', alignSelf: 'center' }}>
            {drawer === 'sheet' ? (
              <CharacterSheet
                c={c}
                onEquip={view.combat || busy ? undefined : (uid) => void act({ type: 'equip', itemUid: uid })}
                onUse={busy ? undefined : (uid) => void act(view.combat ? { type: 'combat', action: { kind: 'use_item', itemUid: uid } } : { type: 'use_item', itemUid: uid })}
                onCast={view.combat || busy ? undefined : (spellId) => void act({ type: 'cast', spellId })}
              />
            ) : (
              <JournalView view={view} />
            )}
            {drawer === 'sheet' && view.status === 'active' ? <Button title={t('abandon')} kind="danger" icon="flag-checkered" onPress={abandon} testID="abandon" /> : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
