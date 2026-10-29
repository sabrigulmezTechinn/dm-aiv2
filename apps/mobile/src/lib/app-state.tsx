import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getLocales } from 'expo-localization';
import type { Locale } from '@dmai/shared';
import { Api, ApiError, defaultApiUrl } from './api';
import { getItem, removeItem, setItem } from './storage';
import { I18nProvider } from './i18n';

export type ViewMode = '2d' | '3d';

interface AppState {
  api: Api;
  ready: boolean;
  error: string | null;
  locale: Locale;
  viewMode: ViewMode;
  dmMode: string;
  setLocale(l: Locale): void;
  setViewMode(m: ViewMode): void;
  retry(): void;
}

const Ctx = createContext<AppState | null>(null);

function deviceLocale(): Locale {
  try {
    return getLocales()[0]?.languageCode === 'tr' ? 'tr' : 'en';
  } catch {
    return 'en';
  }
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [api] = useState(() => new Api(defaultApiUrl()));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locale, setLocaleState] = useState<Locale>(deviceLocale());
  const [viewMode, setViewModeState] = useState<ViewMode>('3d');
  const [dmMode, setDmMode] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      const [savedLocale, savedView, savedToken] = await Promise.all([getItem('locale'), getItem('viewMode'), getItem('token')]);
      if (savedLocale === 'tr' || savedLocale === 'en') setLocaleState(savedLocale);
      if (savedView === '2d' || savedView === '3d') setViewModeState(savedView);
      try {
        if (savedToken) {
          api.token = savedToken;
          try {
            const me = await api.me();
            if (!cancelled) setDmMode(me.dm);
          } catch (e) {
            if (e instanceof ApiError && e.status === 401) {
              api.token = null;
              await removeItem('token');
            } else throw e;
          }
        }
        if (!api.token) {
          const { token } = await api.anonymous();
          api.token = token;
          await setItem('token', token);
          const me = await api.me();
          if (!cancelled) setDmMode(me.dm);
        }
        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) setError((e as Error).message || 'network');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, attempt]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    void setItem('locale', l);
  }, []);
  const setViewMode = useCallback((m: ViewMode) => {
    setViewModeState(m);
    void setItem('viewMode', m);
  }, []);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  const value = useMemo<AppState>(() => ({ api, ready, error, locale, viewMode, dmMode, setLocale, setViewMode, retry }), [api, ready, error, locale, viewMode, dmMode, setLocale, setViewMode, retry]);
  return (
    <Ctx.Provider value={value}>
      <I18nProvider locale={locale}>{children}</I18nProvider>
    </Ctx.Provider>
  );
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside provider');
  return v;
}
