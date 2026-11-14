import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { AdventureSummary, Character, Difficulty, Locale } from '@dmai/shared';
import { useApp } from '../../lib/app-state';
import { errorText, useI18n } from '../../lib/i18n';
import { colors, space } from '../../lib/theme';
import { Button, Card, Chip, Header, Loading, Row, Screen, Section, Txt } from '../../components/ui';
import { CharacterCard } from '../../components/CharacterCard';

export default function NewCampaign() {
  const params = useLocalSearchParams<{ characterId?: string }>();
  const { api, locale: uiLocale } = useApp();
  const { t, locale } = useI18n();
  const [chars, setChars] = useState<Character[] | null>(null);
  const [advs, setAdvs] = useState<AdventureSummary[]>([]);
  const [characterId, setCharacterId] = useState<string | null>(params.characterId ?? null);
  const [adventureId, setAdventureId] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [lang, setLang] = useState<Locale>(uiLocale);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.characters(), api.adventures()])
      .then(([c, a]) => {
        const free = c.filter((x) => x.status === 'alive' && !x.activeCampaignId);
        setChars(free);
        setAdvs(a);
        if (!characterId && free[0]) setCharacterId(free[0].id);
        if (a[0]) setAdventureId(a[0].id);
      })
      .catch(() => setChars([]));
  }, [api]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!chars) return <Loading />;

  const start = async () => {
    if (!characterId || !adventureId) return;
    setBusy(true);
    setError(null);
    try {
      const v = await api.createCampaign({ characterId, adventureId, difficulty, locale: lang });
      router.replace({ pathname: '/play/[id]', params: { id: v.id, begin: '1' } });
    } catch (e) {
      setError(errorText(locale, (e as { code?: string }).code));
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title={t('newAdventure')} />
      <Section title={t('chooseCharacter')}>
        {chars.length === 0 ? (
          <View style={{ gap: space(2) }}>
            <Txt variant="muted">{t('needCharacter')}</Txt>
            <Button title={t('createCharacter')} icon="plus" onPress={() => router.push('/characters/new')} testID="create-character" />
          </View>
        ) : (
          chars.map((c) => <CharacterCard key={c.id} c={c} selected={characterId === c.id} onPress={() => setCharacterId(c.id)} />)
        )}
      </Section>
      <Section title={t('chooseAdventure')}>
        {advs.map((a) => (
          <Card key={a.id} selected={adventureId === a.id} onPress={() => setAdventureId(a.id)} testID={`adventure-${a.id}`}>
            <Txt variant="h3">{a.title[locale]}</Txt>
            <Txt variant="muted">{a.blurb[locale]}</Txt>
            <Txt variant="small" style={{ color: colors.gold }}>
              {t('recommendedLevel', { n: a.recommendedLevel })} · {t('hours', { n: a.lengthHours })}
            </Txt>
          </Card>
        ))}
      </Section>
      <Section title={t('difficulty')}>
        <Row>
          <Chip label={t('easy')} selected={difficulty === 'easy'} onPress={() => setDifficulty('easy')} testID="difficulty-easy" />
          <Chip label={t('hard')} selected={difficulty === 'hard'} onPress={() => setDifficulty('hard')} testID="difficulty-hard" />
        </Row>
        <Txt variant="muted">{difficulty === 'easy' ? t('easyDesc') : t('hardDesc')}</Txt>
      </Section>
      <Section title={t('language')}>
        <Row>
          <Chip label="Türkçe" selected={lang === 'tr'} onPress={() => setLang('tr')} />
          <Chip label="English" selected={lang === 'en'} onPress={() => setLang('en')} />
        </Row>
      </Section>
      {error ? <Txt style={{ color: colors.red }}>{error}</Txt> : null}
      <Button title={t('start')} icon="sword-cross" disabled={!characterId || !adventureId} loading={busy} onPress={start} testID="start" />
    </Screen>
  );
}
