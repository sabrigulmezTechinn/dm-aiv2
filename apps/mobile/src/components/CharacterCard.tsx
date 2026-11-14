import React from 'react';
import { View } from 'react-native';
import type { Character } from '@dmai/shared';
import { CLASSES, RACES, armorClass } from '@dmai/rules';
import { useI18n } from '../lib/i18n';
import { colors } from '../lib/theme';
import { Bar, Card, Icon, Row, Txt } from './ui';

export function CharacterCard({ c, onPress, selected, right }: { c: Character; onPress?: () => void; selected?: boolean; right?: React.ReactNode }) {
  const { t, locale } = useI18n();
  return (
    <Card onPress={onPress} selected={selected} testID={`character-${c.name}`}>
      <Row>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.color, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.status === 'dead' ? colors.faint : colors.gold }}>
          <Icon name={c.status === 'dead' ? 'skull' : 'shield-sword'} size={20} color="#1b1408" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="h3">{c.name}</Txt>
          <Txt variant="muted">
            {RACES[c.race].name[locale]} {CLASSES[c.class].name[locale]} · {t('lv')} {c.level}
            {c.activeCampaignId ? ` · ${t('inCampaign')}` : ''}
          </Txt>
          {c.status === 'alive' ? (
            <Row gap={2}>
              <Bar value={c.hp} max={c.maxHp} style={{ flex: 1 }} />
              <Txt variant="muted">
                {c.hp}/{c.maxHp} · {t('ac')} {armorClass(c)}
              </Txt>
            </Row>
          ) : c.epitaph ? (
            <Txt variant="muted" style={{ fontStyle: 'italic' }}>
              {c.epitaph}
            </Txt>
          ) : null}
        </View>
        {right}
      </Row>
    </Card>
  );
}

