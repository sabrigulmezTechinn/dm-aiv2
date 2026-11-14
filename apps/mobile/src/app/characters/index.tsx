import React, { useCallback, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { Character } from '@dmai/shared';
import { useApp } from '../../lib/app-state';
import { useI18n } from '../../lib/i18n';
import { Button, Header, Screen, Section, Txt } from '../../components/ui';
import { CharacterCard } from '../../components/CharacterCard';

export default function Characters() {
  const { api } = useApp();
  const { t } = useI18n();
  const [list, setList] = useState<Character[] | null>(null);
  const load = useCallback(() => {
    api.characters().then(setList).catch(() => setList([]));
  }, [api]);
  useFocusEffect(load);

  const remove = (c: Character) => {
    const go = () => api.deleteCharacter(c.id).then(load).catch(() => undefined);
    if (Platform.OS === 'web') {
      if (window.confirm(`${t('delete')}: ${c.name}?`)) void go();
    } else Alert.alert(t('delete'), c.name, [{ text: t('cancel'), style: 'cancel' }, { text: t('delete'), style: 'destructive', onPress: () => void go() }]);
  };

  const alive = (list ?? []).filter((c) => c.status === 'alive');
  const dead = (list ?? []).filter((c) => c.status === 'dead');
  return (
    <Screen>
      <Header title={t('characters')} />
      <Button title={t('createCharacter')} icon="plus" onPress={() => router.push('/characters/new')} testID="create-character" />
      {list && alive.length === 0 ? <Txt variant="muted">{t('noCharacters')}</Txt> : null}
      {alive.map((c) => (
        <CharacterCard key={c.id} c={c} onPress={() => router.push(`/characters/${c.id}`)} />
      ))}
      {dead.length > 0 ? (
        <Section title={t('fallen')}>
          {dead.map((c) => (
            <CharacterCard key={c.id} c={c} right={<Button title={t('delete')} kind="danger" small onPress={() => remove(c)} />} />
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}
