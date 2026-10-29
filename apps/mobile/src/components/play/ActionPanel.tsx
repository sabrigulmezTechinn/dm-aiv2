import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import type { CampaignView, PlayerAction } from '@dmai/shared';
import {
  ABILITY_NAMES,
  SKILLS,
  SPELLS,
  checkModifier,
  featureUsesLeft,
  getItem,
  hasFeature,
  isSkill,
  itemName,
  slotAvailable,
} from '@dmai/rules';
import { useI18n } from '../../lib/i18n';
import { colors, radius, space } from '../../lib/theme';
import { Button, Chip, Row, Txt } from '../ui';

export type Targeting = { kind: 'attack' } | { kind: 'cast'; spellId: string } | null;

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

export function ActionPanel({
  view,
  busy,
  act,
  targeting,
  setTargeting,
  onHome,
}: {
  view: CampaignView;
  busy: boolean;
  act: (a: PlayerAction) => void;
  targeting: Targeting;
  setTargeting: (t: Targeting) => void;
  onHome: () => void;
}) {
  const { t, locale } = useI18n();
  const [text, setText] = useState('');
  const [menu, setMenu] = useState<'spells' | 'items' | 'rest' | null>(null);
  const c = view.character;
  const pending = view.pending;

  // Ended campaign.
  if (view.status !== 'active') {
    return (
      <View style={panel}>
        <Txt variant="h2" style={{ color: view.status === 'victory' ? colors.gold : colors.red, textAlign: 'center' }}>
          {view.status === 'victory' ? t('victoryTitle') : t('defeatTitle')}
        </Txt>
        <Button title={t('backHome')} icon="home-outline" onPress={onHome} testID="back-home" />
      </View>
    );
  }

  if (pending?.type === 'check') {
    const label = isSkill(pending.key) ? SKILLS[pending.key].name[locale] : ABILITY_NAMES[pending.key as keyof typeof ABILITY_NAMES][locale];
    const modv = checkModifier(c, { kind: pending.kind, key: pending.key });
    const showDc = view.difficulty === 'easy';
    return (
      <View style={panel}>
        <Txt variant="small" style={{ textAlign: 'center', color: colors.muted }}>
          {pending.reason}
        </Txt>
        <Button
          testID="roll"
          title={`${t('roll')}: ${label} ${signed(modv)}${showDc ? ` · ${t('dc', { n: Math.max(5, pending.dc - 2) })}` : ''}${pending.advantage !== 'none' ? ` · ${t(pending.advantage)}` : ''}`}
          icon="dice-d20"
          loading={busy}
          onPress={() => act({ type: 'roll' })}
        />
      </View>
    );
  }

  if (pending?.type === 'death_save') {
    return (
      <View style={panel}>
        <Txt variant="small" style={{ textAlign: 'center', color: colors.red }}>
          {t('deathSaveHint')} ({c.deathSaves.successes}✓ / {c.deathSaves.failures}✗)
        </Txt>
        <Button title={t('deathSave')} icon="skull" kind="danger" loading={busy} onPress={() => act({ type: 'death_save' })} testID="death-save" />
      </View>
    );
  }

  if (view.combat) {
    const myTurn = view.combat.order[view.combat.turnIndex] === view.playerCombatantId;
    const b = view.combat.budget;
    const enemies = Object.values(view.combat.combatants).filter((x) => x.team === 'enemy' && !x.dead && !x.fled);
    const spells = c.spells.map((id) => SPELLS[id]!).filter((sp) => sp.level === 0 || slotAvailable(c, sp.level));
    const consumables = c.inventory.filter((i) => {
      const d = getItem(i.itemId);
      return d?.type === 'gear' && d.use && d.use.kind !== 'light';
    });
    const combat = (action: Extract<PlayerAction, { type: 'combat' }>['action']) => act({ type: 'combat', action });
    if (!myTurn) {
      return (
        <View style={panel}>
          <Txt variant="muted" style={{ textAlign: 'center' }}>
            {t('enemyTurn')}
          </Txt>
        </View>
      );
    }
    if (targeting) {
      return (
        <View style={panel}>
          <Txt variant="small" style={{ color: colors.gold, textAlign: 'center' }}>
            {targeting.kind === 'cast' ? `${SPELLS[targeting.spellId]?.name[locale]} · ` : ''}
            {t('chooseTarget')}
          </Txt>
          <Row style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
            {enemies.map((e) => (
              <Chip
                key={e.id}
                label={e.name}
                icon="target"
                tone={colors.red}
                testID={`target-${e.id}`}
                onPress={() => {
                  setTargeting(null);
                  combat(targeting.kind === 'attack' ? { kind: 'attack', targetId: e.id } : { kind: 'cast', spellId: targeting.spellId, targetId: e.id });
                }}
              />
            ))}
          </Row>
          <Button title={t('cancel')} kind="ghost" small onPress={() => setTargeting(null)} />
        </View>
      );
    }
    if (menu === 'spells') {
      return (
        <View style={panel}>
          <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={{ gap: space(2) }}>
            {spells.map((sp) => (
              <Button
                key={sp.id}
                kind="secondary"
                small
                title={`${sp.name[locale]}${sp.level ? ` (${t('spellLevel', { n: sp.level })})` : ''}`}
                disabled={sp.castingTime === 'action' ? !b.action : !b.bonusAction}
                onPress={() => {
                  setMenu(null);
                  if (sp.target === 'enemy') setTargeting({ kind: 'cast', spellId: sp.id });
                  else combat({ kind: 'cast', spellId: sp.id });
                }}
              />
            ))}
          </ScrollView>
          <Button title={t('cancel')} kind="ghost" small onPress={() => setMenu(null)} />
        </View>
      );
    }
    if (menu === 'items') {
      return (
        <View style={panel}>
          {consumables.map((i) => (
            <Button
              key={i.uid}
              kind="secondary"
              small
              title={`${itemName(i, locale)} ×${i.qty}`}
              onPress={() => {
                setMenu(null);
                combat({ kind: 'use_item', itemUid: i.uid });
              }}
            />
          ))}
          <Button title={t('cancel')} kind="ghost" small onPress={() => setMenu(null)} />
        </View>
      );
    }
    const dot = (on: boolean) => (on ? '●' : '○');
    return (
      <View style={panel}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="small" style={{ color: colors.gold, fontWeight: '700' }}>
            {t('yourTurn')}
          </Txt>
          <Txt variant="muted">
            {t('movement', { n: b.movement })} · {t('action')} {dot(b.action || b.attacksLeft > 0)} · {t('bonus')} {dot(b.bonusAction)}
          </Txt>
        </Row>
        <Txt variant="muted" style={{ fontSize: 12 }}>
          {t('tapToMove')}
        </Txt>
        <Row style={{ flexWrap: 'wrap' }} gap={2}>
          <Chip label={t('attack')} icon="sword" testID="act-attack" onPress={() => setTargeting({ kind: 'attack' })} />
          {spells.length ? <Chip label={t('cast')} icon="auto-fix" testID="act-cast" onPress={() => setMenu('spells')} /> : null}
          <Chip label={t('dash')} icon="run-fast" onPress={() => combat({ kind: 'dash' })} />
          <Chip label={t('dodge')} icon="shield-half-full" onPress={() => combat({ kind: 'dodge' })} />
          <Chip label={t('disengage')} icon="walk" onPress={() => combat({ kind: 'disengage' })} />
          {consumables.length ? <Chip label={t('item')} icon="flask-outline" onPress={() => setMenu('items')} /> : null}
          {hasFeature(c, 'second_wind') && featureUsesLeft(c, 'second_wind') > 0 ? <Chip label={t('secondWind')} icon="heart-pulse" onPress={() => combat({ kind: 'second_wind' })} /> : null}
          {hasFeature(c, 'action_surge') && featureUsesLeft(c, 'action_surge') > 0 ? <Chip label={t('actionSurge')} icon="fire" onPress={() => combat({ kind: 'action_surge' })} /> : null}
          {hasFeature(c, 'turn_undead') && featureUsesLeft(c, 'turn_undead') > 0 ? <Chip label={t('turnUndead')} icon="hand-heart" onPress={() => combat({ kind: 'turn_undead' })} /> : null}
        </Row>
        <Button title={t('endTurn')} icon="timer-sand" loading={busy} onPress={() => combat({ kind: 'end_turn' })} testID="end-turn" />
      </View>
    );
  }

  const send = () => {
    const v = text.trim();
    if (!v || busy) return;
    setText('');
    act({ type: 'say', text: v });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={panel}>
        {view.needsContinue ? <Button title={t('continueStory')} icon="play" kind="secondary" loading={busy} onPress={() => act({ type: 'continue' })} testID="continue" /> : null}
        {pending?.type === 'choice' ? (
          <View style={{ gap: space(2) }}>
            {pending.choices.map((ch) => (
              <Button
                key={ch.id}
                kind="secondary"
                title={`${ch.label}${ch.skill ? ` · ${isSkill(ch.skill) ? SKILLS[ch.skill].name[locale] : ABILITY_NAMES[ch.skill as keyof typeof ABILITY_NAMES]?.[locale] ?? ch.skill}` : ''}`}
                disabled={busy}
                onPress={() => act({ type: 'choose', choiceId: ch.id })}
                testID={`choice-${ch.id}`}
                style={{ justifyContent: 'flex-start' }}
              />
            ))}
          </View>
        ) : null}
        {menu === 'rest' ? (
          <Row>
            <Button title={t('shortRest')} small kind="secondary" style={{ flex: 1 }} testID="rest-short" onPress={() => (setMenu(null), act({ type: 'rest', kind: 'short' }))} />
            <Button title={t('longRest')} small kind="secondary" style={{ flex: 1 }} testID="rest-long" onPress={() => (setMenu(null), act({ type: 'rest', kind: 'long' }))} />
            <Button title="×" small kind="ghost" onPress={() => setMenu(null)} />
          </Row>
        ) : null}
        <Row gap={2}>
          <Button title={t('rest')} icon="campfire" kind="ghost" small testID="rest-menu" onPress={() => setMenu(menu === 'rest' ? null : 'rest')} disabled={busy} />
          <TextInput
            testID="action-input"
            value={text}
            onChangeText={setText}
            onSubmitEditing={send}
            placeholder={t('typeAction')}
            placeholderTextColor={colors.faint}
            editable={!busy}
            returnKeyType="send"
            maxLength={600}
            style={{ flex: 1, minHeight: 44, backgroundColor: colors.surface2, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space(3), color: colors.text, fontSize: 15 }}
          />
          <Button title="" icon="send" small onPress={send} disabled={busy || !text.trim()} testID="send" />
        </Row>
      </View>
    </KeyboardAvoidingView>
  );
}

const panel = {
  padding: space(3),
  gap: space(2),
  borderTopWidth: 1,
  borderTopColor: colors.border,
  backgroundColor: colors.surface,
} as const;
