import React from 'react';
import { View } from 'react-native';
import type { CampaignView } from '@dmai/shared';
import { useI18n } from '../../lib/i18n';
import { colors, space } from '../../lib/theme';
import { Card, Row, Section, Txt } from '../ui';

export function JournalView({ view }: { view: CampaignView }) {
  const { t } = useI18n();
  const attitudeColor = (a: number) => (a > 0 ? colors.green : a < 0 ? colors.red : colors.muted);
  return (
    <View style={{ gap: space(4) }}>
      <Section title={t('quests')}>
        {view.quests.length === 0 ? <Txt variant="muted">{t('nothingYet')}</Txt> : null}
        {view.quests.map((q) => (
          <Card key={q.id}>
            <Row>
              <Txt variant="h3" style={{ flex: 1, color: q.status === 'completed' ? colors.green : q.status === 'failed' ? colors.red : colors.text }}>
                {q.title}
              </Txt>
              <Txt variant="muted">{q.status === 'active' ? '•' : q.status === 'completed' ? '✓' : '✗'}</Txt>
            </Row>
            {q.notes.map((n, i) => (
              <Txt key={i} variant="muted">
                – {n}
              </Txt>
            ))}
          </Card>
        ))}
      </Section>
      <Section title={t('people')}>
        {view.npcs.length === 0 ? <Txt variant="muted">{t('nothingYet')}</Txt> : null}
        {view.npcs.map((n) => (
          <Card key={n.id}>
            <Row>
              <Txt variant="h3" style={{ flex: 1 }}>
                {n.name}
                {!n.alive ? ' ✝' : ''}
              </Txt>
              <Row gap={1}>
                {[-3, -2, -1, 0, 1, 2, 3].map((v) => (
                  <View key={v} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: v === n.attitude ? attitudeColor(n.attitude) : colors.surface3 }} />
                ))}
              </Row>
            </Row>
            {n.description ? <Txt variant="muted">{n.description}</Txt> : null}
            {n.notes.slice(-4).map((x, i) => (
              <Txt key={i} variant="small">
                – {x}
              </Txt>
            ))}
          </Card>
        ))}
      </Section>
      <Section title={t('events')}>
        {view.facts.length === 0 ? <Txt variant="muted">{t('nothingYet')}</Txt> : null}
        {view.facts
          .slice()
          .reverse()
          .map((f) => (
            <Txt key={f.id} variant="small" style={{ color: f.importance === 'major' ? colors.gold : colors.text }}>
              • {f.text}
            </Txt>
          ))}
      </Section>
    </View>
  );
}
