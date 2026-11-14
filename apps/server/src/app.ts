import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { stream } from 'hono/streaming';
import type { CampaignSummary, CharacterDraft, PlayerAction, TurnEvent } from '@dmai/shared';
import { validateDraft } from '@dmai/rules';
import type { Store } from './db';
import { GameEngine, GameError } from './game/engine';
import { adventureSummaries, getAdventure } from './adventures';
import { characterDraftSchema, newCampaignSchema, playerActionSchema } from './validation';

type Env = { Variables: { userId: string } };

export function createApp(store: Store, engine: GameEngine, opts: { corsOrigin: string; provider: string }) {
  const app = new Hono<Env>();
  app.use('*', cors({ origin: opts.corsOrigin, allowHeaders: ['Authorization', 'Content-Type'], allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'] }));

  app.onError((err, c) => {
    if (err instanceof GameError) return c.json({ error: err.code, message: err.message }, err.status as 400);
    console.error('[http]', err);
    return c.json({ error: 'internal' }, 500);
  });

  app.get('/health', (c) => c.json({ ok: true, dm: opts.provider }));

  app.post('/api/auth/anonymous', (c) => {
    const { user, token } = store.createUser();
    return c.json({ userId: user.id, token });
  });

  app.use('/api/*', async (c, next) => {
    if (c.req.path === '/api/auth/anonymous' || c.req.method === 'OPTIONS') return next();
    const header = c.req.header('Authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const user = token ? store.userByToken(token) : null;
    if (!user) return c.json({ error: 'unauthorized' }, 401);
    c.set('userId', user.id);
    return next();
  });

  app.get('/api/me', (c) => c.json({ userId: c.get('userId'), dm: opts.provider }));
  app.get('/api/adventures', (c) => c.json(adventureSummaries()));

  // Characters --------------------------------------------------------------
  app.get('/api/characters', (c) => c.json(store.listCharacters(c.get('userId'))));

  app.post('/api/characters', async (c) => {
    const body = characterDraftSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'invalid', issues: body.error.issues }, 400);
    const draft = body.data as CharacterDraft;
    const v = validateDraft(draft);
    if (!v.ok) return c.json({ error: 'invalid', issues: v.errors }, 400);
    return c.json(engine.createCharacter(c.get('userId'), draft), 201);
  });

  app.get('/api/characters/:id', (c) => {
    const ch = store.getCharacter(c.req.param('id'));
    if (!ch || ch.userId !== c.get('userId')) return c.json({ error: 'not_found' }, 404);
    return c.json(ch);
  });

  app.delete('/api/characters/:id', (c) => {
    const ch = store.getCharacter(c.req.param('id'));
    if (!ch || ch.userId !== c.get('userId')) return c.json({ error: 'not_found' }, 404);
    if (ch.activeCampaignId) {
      const cmp = store.getCampaign(ch.activeCampaignId);
      if (cmp?.state.status === 'active') return c.json({ error: 'character_busy' }, 409);
    }
    store.deleteCharacter(ch.id);
    return c.json({ ok: true });
  });

  // Campaigns ---------------------------------------------------------------
  app.get('/api/campaigns', (c) => {
    const userId = c.get('userId');
    const out: CampaignSummary[] = store.listCampaigns(userId).map((s) => {
      const ch = store.getCharacter(s.characterId);
      const adv = getAdventure(s.adventureId);
      return {
        id: s.id,
        adventureId: s.adventureId,
        adventureTitle: adv?.title[s.locale] ?? s.adventureId,
        characterId: s.characterId,
        characterName: ch?.name ?? '?',
        status: s.status,
        difficulty: s.difficulty,
        sceneName: s.scene.name,
        updatedAt: s.updatedAt,
      };
    });
    return c.json(out);
  });

  app.post('/api/campaigns', async (c) => {
    const body = newCampaignSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'invalid', issues: body.error.issues }, 400);
    return c.json(engine.createCampaign(c.get('userId'), body.data), 201);
  });

  app.get('/api/campaigns/:id', (c) => c.json(engine.view(c.get('userId'), c.req.param('id'))));
  app.post('/api/campaigns/:id/abandon', (c) => c.json(engine.abandon(c.get('userId'), c.req.param('id'))));

  app.post('/api/campaigns/:id/actions', async (c: Context<Env>) => {
    const body = playerActionSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'invalid', issues: body.error.issues }, 400);
    const userId = c.get('userId');
    const id = c.req.param('id')!;
    const action = body.data as PlayerAction;
    if (c.req.query('stream') === '0') {
      const events: TurnEvent[] = [];
      await engine.act(userId, id, action, (e) => events.push(e));
      return c.json({ events });
    }
    c.header('Content-Type', 'application/x-ndjson; charset=utf-8');
    c.header('Cache-Control', 'no-cache');
    c.header('X-Accel-Buffering', 'no');
    return stream(c, async (s) => {
      let chain: Promise<unknown> = Promise.resolve();
      const emit = (e: TurnEvent) => {
        chain = chain.then(() => s.write(`${JSON.stringify(e)}\n`)).catch(() => undefined);
      };
      await engine.act(userId, id, action, emit);
      await chain;
    });
  });

  return app;
}
