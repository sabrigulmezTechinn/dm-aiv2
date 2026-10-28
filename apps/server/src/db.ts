import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import type { Character } from '@dmai/shared';
import { uid } from '@dmai/shared';
import type { CampaignState, Transcript } from './game/state';

export interface UserRow {
  id: string;
  createdAt: number;
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/** Small synchronous SQLite store. Rows hold JSON documents. */
export class Store {
  private db: DatabaseSync;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        token_hash TEXT UNIQUE NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS characters (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS characters_user ON characters(user_id);
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        character_id TEXT NOT NULL,
        status TEXT NOT NULL,
        data TEXT NOT NULL,
        transcript TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS campaigns_user ON campaigns(user_id);
    `);
  }

  createUser(): { user: UserRow; token: string } {
    const token = randomBytes(32).toString('hex');
    const user = { id: uid('u'), createdAt: Date.now() };
    this.db.prepare('INSERT INTO users (id, token_hash, created_at) VALUES (?, ?, ?)').run(user.id, hash(token), user.createdAt);
    return { user, token };
  }

  userByToken(token: string): UserRow | null {
    const row = this.db.prepare('SELECT id, created_at FROM users WHERE token_hash = ?').get(hash(token)) as { id: string; created_at: number } | undefined;
    return row ? { id: row.id, createdAt: row.created_at } : null;
  }

  // Characters
  saveCharacter(c: Character): void {
    c.updatedAt = Date.now();
    this.db
      .prepare('INSERT INTO characters (id, user_id, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at')
      .run(c.id, c.userId, JSON.stringify(c), c.updatedAt);
  }

  getCharacter(id: string): Character | null {
    const row = this.db.prepare('SELECT data FROM characters WHERE id = ?').get(id) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as Character) : null;
  }

  listCharacters(userId: string): Character[] {
    const rows = this.db.prepare('SELECT data FROM characters WHERE user_id = ? ORDER BY updated_at DESC').all(userId) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as Character);
  }

  deleteCharacter(id: string): void {
    this.db.prepare('DELETE FROM characters WHERE id = ?').run(id);
  }

  // Campaigns
  saveCampaign(state: CampaignState, transcript?: Transcript): void {
    state.updatedAt = Date.now();
    if (transcript) {
      this.db
        .prepare(
          'INSERT INTO campaigns (id, user_id, character_id, status, data, transcript, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET status = excluded.status, data = excluded.data, transcript = excluded.transcript, updated_at = excluded.updated_at',
        )
        .run(state.id, state.userId, state.characterId, state.status, JSON.stringify(state), JSON.stringify(transcript), state.updatedAt);
    } else {
      this.db.prepare('UPDATE campaigns SET status = ?, data = ?, updated_at = ? WHERE id = ?').run(state.status, JSON.stringify(state), state.updatedAt, state.id);
    }
  }

  getCampaign(id: string): { state: CampaignState; transcript: Transcript } | null {
    const row = this.db.prepare('SELECT data, transcript FROM campaigns WHERE id = ?').get(id) as { data: string; transcript: string } | undefined;
    return row ? { state: JSON.parse(row.data) as CampaignState, transcript: JSON.parse(row.transcript) as Transcript } : null;
  }

  listCampaigns(userId: string): CampaignState[] {
    const rows = this.db.prepare('SELECT data FROM campaigns WHERE user_id = ? ORDER BY updated_at DESC').all(userId) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as CampaignState);
  }

  close(): void {
    this.db.close();
  }
}
