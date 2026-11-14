import { useCallback, useEffect, useRef, useState } from 'react';
import type { CampaignView, PlayerAction, RollResult } from '@dmai/shared';
import { useApp } from '../../lib/app-state';
import { errorText } from '../../lib/i18n';

export interface LiveEntry {
  id: string;
  text: string;
}

export function usePlay(id: string) {
  const { api, locale } = useApp();
  const [view, setView] = useState<CampaignView | null>(null);
  const [live, setLive] = useState<LiveEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rolls, setRolls] = useState<RollResult[]>([]);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    try {
      setView(await api.campaign(id));
    } catch (e) {
      setError(errorText(locale, (e as { code?: string }).code));
    }
  }, [api, id, locale]);

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
              setError(errorText(locale, e.code));
              break;
          }
        });
      } catch (e) {
        setError(errorText(locale, (e as { code?: string }).code));
      } finally {
        busyRef.current = false;
        setBusy(false);
        setLive([]);
      }
    },
    [api, id, locale],
  );

  const shiftRoll = useCallback(() => setRolls((r) => r.slice(1)), []);

  return { view, live, busy, error, setError, act, rolls, shiftRoll, reload: load };
}
