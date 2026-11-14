import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { CampaignSummary } from '@dmai/shared';
import { useApp } from '../lib/app-state';
import { useI18n } from '../lib/i18n';
import { colors, space } from '../lib/theme';
import { Button, Card, Icon, IconButton, Row, Screen, Section, Txt } from '../components/ui';

export default function Home() {
  const { api } = useApp();
  const { t } = useI18n();
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      api.campaigns().then((c) => alive && setCampaigns(c)).catch(() => alive && setCampaigns([]));
      return () => {
        alive = false;
      };
    }, [api]),
  );

  const active = (campaigns ?? []).filter((c) => c.status === 'active');
  const past = (campaigns ?? []).filter((c) => c.status !== 'active').slice(0, 6);

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="title">{t('appName')}</Txt>
          <Txt variant="muted">{t('tagline')}</Txt>
        </View>
        <IconButton icon="cog" label={t('settings')} onPress={() => router.push('/settings')} testID="settings" />
      </Row>

      <View style={{ height: 160, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, justifyContent: 'flex-end', padding: space(4) }}>
        <View style={{ position: 'absolute', right: -10, top: -10, opacity: 0.18 }}>
          <Icon name="dice-d20" size={170} color={colors.gold} />
        </View>
        <Txt variant="serif" style={{ fontSize: 19, maxWidth: 280 }}>
          {t('heroLine')}
        </Txt>
      </View>

      <Row gap={3}>
        <Button title={t('newAdventure')} icon="sword-cross" style={{ flex: 1 }} onPress={() => router.push('/campaigns/new')} testID="new-adventure" />
        <Button title={t('characters')} icon="account-circle-outline" kind="secondary" style={{ flex: 1 }} onPress={() => router.push('/characters')} testID="characters" />
      </Row>

      <Section title={t('activeAdventures')}>
        {campaigns && active.length === 0 ? <Txt variant="muted">{t('noCampaigns')}</Txt> : null}
        {active.map((c) => (
          <Card key={c.id} onPress={() => router.push(`/play/${c.id}`)} testID={`campaign-${c.id}`}>
            <Row>
              <Icon name="map-marker-outline" color={colors.gold} />
              <View style={{ flex: 1 }}>
                <Txt variant="h3">{c.adventureTitle}</Txt>
                <Txt variant="muted">
                  {c.characterName} · {c.sceneName} · {t(c.difficulty)}
                </Txt>
              </View>
              <Txt variant="small" style={{ color: colors.gold, fontWeight: '700' }}>
                {t('continue')}
              </Txt>
            </Row>
          </Card>
        ))}
      </Section>

      {past.length > 0 ? (
        <Section title={t('pastAdventures')}>
          {past.map((c) => (
            <Card key={c.id} onPress={() => router.push(`/play/${c.id}`)}>
              <Row>
                <Icon name={c.status === 'victory' ? 'crown' : c.status === 'defeat' ? 'skull' : 'flag-checkered'} color={c.status === 'victory' ? colors.gold : colors.muted} />
                <View style={{ flex: 1 }}>
                  <Txt variant="h3">{c.adventureTitle}</Txt>
                  <Txt variant="muted">
                    {c.characterName} · {t(`status_${c.status}` as never)}
                  </Txt>
                </View>
              </Row>
            </Card>
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}
