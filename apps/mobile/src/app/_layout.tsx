import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { AppStateProvider, useApp } from '../lib/app-state';
import { useI18n } from '../lib/i18n';
import { colors } from '../lib/theme';
import { Button, Centered, Loading, Txt } from '../components/ui';

function Gate({ children }: { children: React.ReactNode }) {
  const { ready, error, retry } = useApp();
  const { t } = useI18n();
  if (error)
    return (
      <Centered>
        <Txt variant="title">{t('appName')}</Txt>
        <Txt variant="muted" style={{ textAlign: 'center' }}>
          {t('serverDown')}
        </Txt>
        <Button title={t('retry')} icon="refresh" onPress={retry} />
      </Centered>
    );
  if (!ready) return <Loading label={t('connecting')} />;
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <Gate>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'fade' }} />
          </Gate>
        </View>
      </AppStateProvider>
    </SafeAreaProvider>
  );
}
