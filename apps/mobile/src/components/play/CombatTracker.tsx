import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { CampaignView } from '@dmai/shared';
import { useI18n } from '../../lib/i18n';
import { colors, radius, space } from '../../lib/theme';
import { Bar, Txt } from '../ui';

export function CombatTracker({ view, onPick }: { view: CampaignView; onPick?: (id: string) => void }) {
  const { t } = useI18n();
  const combat = view.combat!;
  const current = combat.order[combat.turnIndex];
  return (
    <View style={{ paddingHorizontal: space(3), paddingTop: space(2), gap: space(1) }}>
      <Txt variant="label">{t('round', { n: combat.round })}</Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }}>
        {combat.order.map((id) => {
          const c = combat.combatants[id]!;
          if (c.fled) return null;
          const active = id === current;
          const enemy = c.team === 'enemy';
          return (
            <Pressable
              key={id}
              disabled={!enemy || !onPick || c.dead}
              onPress={() => onPick?.(id)}
              style={{
                width: 92,
                padding: space(2),
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: active ? colors.gold : colors.border,
                backgroundColor: c.dead ? colors.bg : active ? colors.surface3 : colors.surface,
                opacity: c.dead ? 0.45 : 1,
                gap: 3,
              }}
            >
              <Txt variant="small" numberOfLines={1} style={{ fontWeight: '700', color: enemy ? '#e7a197' : colors.text }}>
                {c.name}
              </Txt>
              <Bar value={c.hp} max={c.maxHp} color={enemy ? colors.red : colors.green} height={5} />
              <Txt variant="muted" style={{ fontSize: 11 }}>
                {Math.floor(c.initiative)} · {c.kind === 'player' ? `${c.hp}/${c.maxHp}` : c.dead ? '✝' : `${t('ac')} ${c.ac}`}
              </Txt>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
