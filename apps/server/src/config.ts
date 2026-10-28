export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface Config {
  port: number;
  apiKey: string | undefined;
  provider: 'anthropic' | 'mock';
  model: string;
  effort: Effort;
  databasePath: string;
  corsOrigin: string;
  /** Optional path to the exported web app (apps/mobile/dist) to serve from this server. */
  webDist: string | undefined;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const apiKey = env.ANTHROPIC_API_KEY?.trim() || undefined;
  const authToken = env.ANTHROPIC_AUTH_TOKEN?.trim() || undefined;
  const requested = env.DM_PROVIDER?.trim();
  const provider = requested === 'anthropic' || requested === 'mock' ? requested : apiKey || authToken ? 'anthropic' : 'mock';
  const effort = (env.DM_EFFORT?.trim() || 'medium') as Effort;
  return {
    port: Number(env.PORT ?? 8787),
    apiKey,
    provider,
    model: env.ANTHROPIC_MODEL?.trim() || 'claude-opus-5-5',
    effort: ['low', 'medium', 'high', 'xhigh', 'max'].includes(effort) ? effort : 'medium',
    databasePath: env.DATABASE_PATH?.trim() || './data/dmai.db',
    corsOrigin: env.CORS_ORIGIN?.trim() || '*',
    webDist: env.WEB_DIST?.trim() || undefined,
  };
}
