import { serve } from '@hono/node-server';
import { loadConfig } from './config';
import { Store } from './db';
import { GameEngine } from './game/engine';
import { AnthropicModel, type ModelClient } from './dm/model';
import { MockModel } from './dm/mock';
import { createApp } from './app';

const config = loadConfig();
const store = new Store(config.databasePath);
const model: ModelClient = config.provider === 'anthropic' ? new AnthropicModel({ apiKey: config.apiKey, model: config.model, effort: config.effort }) : new MockModel();
const engine = new GameEngine(store, model);
const app = createApp(store, engine, { corsOrigin: config.corsOrigin, provider: config.provider });

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`DM-AI server on http://localhost:${info.port} (dm: ${config.provider}${config.provider === 'anthropic' ? `, model ${config.model}, effort ${config.effort}` : ''})`);
});

const shutdown = () => {
  store.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
