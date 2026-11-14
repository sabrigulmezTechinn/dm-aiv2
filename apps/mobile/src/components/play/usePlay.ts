import { useCallback, useEffect, useRef, useState } from 'react';
import type { CampaignView, PlayerAction, RollResult } from '@dmai/shared';
import { useApp } from '../../lib/app-state';
import { errorText as baseErrorText } from '../../lib/i18n';

// The server keeps the unsent DM message; the UI offers Retry instead of Continue.
const errorText = (locale: Parameters<typeof baseErrorText>[0], code: string | undefined) => baseErrorText(locale, code === 'dm_unavailable' ? 'dm_retry' : code);

export interface LiveEntry {
  id: string;
  text: string;
}

export function usePlay(id: string) {
  const { api, locale } = useApp();
  const [view, setView] = useState<CampaignView | null>(null);
  const [live, setLive] = useState<LiveEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setErrorText] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState(false);
  const setError = useCallback((m: string | null) => {
    setErrorText(m);
    if (m === null) setNetworkError(false);
  }, []);
  const fail = useCallback(
    (code: string | undefined) => {
      setErrorText(errorText(locale, code));
      setNetworkError(code === 'network');
    },
    [locale],
  );
  const [rolls, setRolls] = useState<RollResult[]>([]);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    try {
      setView(await api.campaign(id));
    } catch (e) {
      fail((e as { code?: string }).code);
    }
  }, [api, id, fail]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (action: PlayerAction) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setError(null);
      try {
        await api.act(id, action, (e) => {
          switch (e.type) {
            case 'narration_start':
              setLive((s) => [...s, { id: e.entryId, text: '' }]);
              break;
            case 'narration_delta':
              setLive((s) => s.map((x) => (x.id === e.entryId ? { ...x, text: x.text + e.text } : x)));
              break;
            case 'roll':
              setRolls((r) => [...r, e.roll]);
              break;
            case 'state':
              setView(e.view);
              setLive((s) => s.filter((x) => !e.view.log.some((l) => l.id === x.id)));
              break;
            case 'error':
              fail(e.code);
              break;
          }
        });
      } catch (e) {
        fail((e as { code?: string }).code);
      } finally {
        busyRef.current = false;
        setBusy(false);
        setLive([]);
      }
    },
    [api, id, fail],
  );

  const shiftRoll = useCallback(() => setRolls((r) => r.slice(1)), []);

  return { view, live, busy, error, setError, act, rolls, shiftRoll, reload: load, networkError };
}
