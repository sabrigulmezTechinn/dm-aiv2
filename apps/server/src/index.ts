import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
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

if (config.webDist) {
  // serveStatic resolves roots relative to the working directory.
  const root = relative(process.cwd(), resolve(config.webDist)) || '.';
  if (!existsSync(join(root, 'index.html'))) console.warn(`WEB_DIST has no index.html: ${root}`);
  app.use('/*', serveStatic({ root }));
  app.get('*', serveStatic({ path: join(root, 'index.html') }));
}

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`DM-AI server on http://localhost:${info.port} (dm: ${config.provider}${config.provider === 'anthropic' ? `, model ${config.model}, effort ${config.effort}` : ''})`);
});

const shutdown = () => {
  store.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
