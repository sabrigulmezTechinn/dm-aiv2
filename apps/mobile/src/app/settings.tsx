import React from 'react';
import { useApp } from '../lib/app-state';
import { useI18n } from '../lib/i18n';
import { Card, Chip, Header, Row, Screen, Section, Txt } from '../components/ui';

export default function Settings() {
  const { locale, setLocale, viewMode, setViewMode, api, dmMode } = useApp();
  const { t } = useI18n();
  return (
    <Screen>
      <Header title={t('settings')} />
      <Section title={t('interfaceLanguage')}>
        <Row>
          <Chip label="Türkçe" selected={locale === 'tr'} onPress={() => setLocale('tr')} testID="lang-tr" />
          <Chip label="English" selected={locale === 'en'} onPress={() => setLocale('en')} testID="lang-en" />
        </Row>
      </Section>
      <Section title={t('defaultView')}>
        <Row>
          <Chip label={t('view3d')} icon="cube-outline" selected={viewMode === '3d'} onPress={() => setViewMode('3d')} />
          <Chip label={t('view2d')} icon="grid" selected={viewMode === '2d'} onPress={() => setViewMode('2d')} />
        </Row>
      </Section>
      <Card>
        <Txt variant="label">{t('serverUrl')}</Txt>
        <Txt variant="small">{api.baseUrl}</Txt>
        <Txt variant="label">{t('dmMode')}</Txt>
        <Txt variant="small">{dmMode === 'mock' ? 'Mock (offline)' : 'Claude'}</Txt>
      </Card>
      <Txt variant="muted">{t('attribution')}</Txt>
    </Screen>
  );
}
