import React, { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { Character } from '@dmai/shared';
import { useApp } from '../../lib/app-state';
import { errorText, useI18n } from '../../lib/i18n';
import { Button, Header, Loading, Screen, Txt } from '../../components/ui';
import { colors } from '../../lib/theme';
import { CharacterSheet } from '../../components/CharacterSheet';

export default function CharacterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useApp();
  const { t, locale } = useI18n();
  const [c, setC] = useState<Character | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  useEffect(() => {
    api.character(id).then(setC).catch(() => router.replace('/characters'));
  }, [api, id]);
  if (!c) return <Loading />;
  const blocked = !!c.activeCampaignId;
  const remove = () => {
    const go = () =>
      api
        .deleteCharacter(c.id)
        .then(() => router.replace('/characters'))
        .catch((e: { status?: number; code?: string }) => {
          setDeleteError(e.status === 409 ? t('deleteBlockedActive') : e.code === 'network' ? errorText(locale, 'network') : t('deleteFailed'));
        });
    setDeleteError(null);
    if (Platform.OS === 'web') {
      if (window.confirm(`${t('delete')}: ${c.name}?\n${t('deleteCharacterConfirm')}`)) void go();
    } else Alert.alert(`${t('delete')}: ${c.name}`, t('deleteCharacterConfirm'), [{ text: t('cancel'), style: 'cancel' }, { text: t('delete'), style: 'destructive', onPress: () => void go() }]);
  };
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
      <Button title={t('delete')} icon="trash-can-outline" kind="danger" disabled={blocked} onPress={remove} testID="delete-character" />
      {blocked ? <Txt variant="muted">{t('deleteBlockedActive')}</Txt> : null}
      {deleteError ? <Txt variant="small" style={{ color: colors.red }} testID="delete-error">{deleteError}</Txt> : null}
    </Screen>
  );
}
