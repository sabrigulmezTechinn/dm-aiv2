import React, { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import type { Character } from '@dmai/shared';
import { useApp } from '../../lib/app-state';
import { useI18n } from '../../lib/i18n';
import { Button, Header, Loading, Screen } from '../../components/ui';
import { CharacterSheet } from '../../components/CharacterSheet';

export default function CharacterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useApp();
  const { t } = useI18n();
  const [c, setC] = useState<Character | null>(null);
  useEffect(() => {
    api.character(id).then(setC).catch(() => router.replace('/characters'));
  }, [api, id]);
  if (!c) return <Loading />;
  return (
    <Screen>
      <Header title={c.name} />
      {c.status === 'alive' ? (
        c.activeCampaignId ? (
          <Button title={t('continue')} icon="sword-cross" onPress={() => router.push(`/play/${c.activeCampaignId}`)} />
        ) : (
          <Button title={t('newAdventure')} icon="sword-cross" onPress={() => router.push({ pathname: '/campaigns/new', params: { characterId: c.id } })} testID="start-adventure" />
        )
      ) : null}
      <CharacterSheet c={c} />
    </Screen>
  );
}
