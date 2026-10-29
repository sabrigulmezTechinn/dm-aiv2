import { Platform } from 'react-native';
import { fetch as expoFetch } from 'expo/fetch';
import type {
  AdventureSummary,
  CampaignSummary,
  CampaignView,
  Character,
  CharacterDraft,
  Difficulty,
  Locale,
  PlayerAction,
  TurnEvent,
} from '@dmai/shared';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

export function defaultApiUrl(): string {
  const env = process.env.EXPO_PUBLIC_API_URL;
  if (env) return env.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:8787`;
  }
  // Android emulators reach the host machine through 10.0.2.2.
  return Platform.OS === 'android' ? 'http://10.0.2.2:8787' : 'http://localhost:8787';
}

export class Api {
  constructor(public baseUrl: string, public token: string | null = null) {}

  private headers(json = true): Record<string, string> {
    const h: Record<string, string> = {};
    if (json) h['Content-Type'] = 'application/json';
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    return h;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, { method, headers: this.headers(body !== undefined), body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) {
      throw new ApiError(0, 'network', (e as Error).message);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? 'http_error');
    return data as T;
  }

  health() {
    return this.request<{ ok: boolean; dm: string }>('GET', '/health');
  }
  anonymous() {
    return this.request<{ userId: string; token: string }>('POST', '/api/auth/anonymous');
  }
  me() {
    return this.request<{ userId: string; dm: string }>('GET', '/api/me');
  }
  adventures() {
    return this.request<AdventureSummary[]>('GET', '/api/adventures');
  }
  characters() {
    return this.request<Character[]>('GET', '/api/characters');
  }
  character(id: string) {
    return this.request<Character>('GET', `/api/characters/${id}`);
  }
  createCharacter(draft: CharacterDraft) {
    return this.request<Character>('POST', '/api/characters', draft);
  }
  deleteCharacter(id: string) {
    return this.request<{ ok: boolean }>('DELETE', `/api/characters/${id}`);
  }
  campaigns() {
    return this.request<CampaignSummary[]>('GET', '/api/campaigns');
  }
  campaign(id: string) {
    return this.request<CampaignView>('GET', `/api/campaigns/${id}`);
  }
  createCampaign(p: { characterId: string; adventureId: string; difficulty: Difficulty; locale: Locale }) {
    return this.request<CampaignView>('POST', '/api/campaigns', p);
  }
  abandon(id: string) {
    return this.request<CampaignView>('POST', `/api/campaigns/${id}/abandon`);
  }

  /**
   * Sends a player action and streams turn events (NDJSON). Falls back to a
   * buffered read when the platform cannot stream response bodies.
   */
  async act(id: string, action: PlayerAction, onEvent: (e: TurnEvent) => void): Promise<void> {
    const url = `${this.baseUrl}/api/campaigns/${id}/actions`;
    const init = { method: 'POST', headers: this.headers(true), body: JSON.stringify(action) };
    let res: { ok: boolean; status: number; body: ReadableStream<Uint8Array> | null; text(): Promise<string> };
    try {
      res = Platform.OS === 'web' ? await fetch(url, init) : ((await expoFetch(url, init)) as unknown as typeof res);
    } catch (e) {
      throw new ApiError(0, 'network', (e as Error).message);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let code = 'http_error';
      try {
        code = (JSON.parse(text) as { error?: string }).error ?? code;
      } catch {
        // not json
      }
      throw new ApiError(res.status, code);
    }
    const emitLines = (chunk: string, flush: boolean) => {
      const lines = chunk.split('\n');
      const rest = flush ? '' : lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          onEvent(JSON.parse(line) as TurnEvent);
        } catch {
          // ignore malformed line
        }
      }
      return rest;
    };
    if (res.body && typeof res.body.getReader === 'function') {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        buf = emitLines(buf, false);
      }
      buf += decoder.decode();
      emitLines(buf, true);
    } else {
      emitLines(await res.text(), true);
    }
  }
}
