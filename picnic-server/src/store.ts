import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { decrypt, encrypt } from './crypto.js'

export type Baseline = Record<string, number>

export interface StoredRequest {
  state: 'started' | 'done'
  baseline: Baseline
  result: unknown | null
}

/**
 * Wat de server onthoudt, in een lokale SQLite:
 *  - per huishouden de Picnic-sleutel (versleuteld; het wachtwoord wordt nooit bewaard);
 *  - per "voeg toe aan mandje"-verzoek de uitgangssituatie en het resultaat, zodat een
 *    herhaald verzoek nooit dubbel toevoegt.
 */
export class Store {
  private db: DatabaseSync

  constructor(
    path: string,
    private key: Buffer,
  ) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    this.db = new DatabaseSync(path)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS picnic_accounts (
        household_id TEXT PRIMARY KEY,
        auth_key_enc TEXT NOT NULL,
        updated_at   TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS cart_requests (
        household_id  TEXT NOT NULL,
        request_id    TEXT NOT NULL,
        state         TEXT NOT NULL,
        baseline_json TEXT NOT NULL,
        result_json   TEXT,
        created_at    TEXT NOT NULL,
        PRIMARY KEY (household_id, request_id)
      );
    `)
  }

  getAuthKey(householdId: string): string | null {
    const row = this.db
      .prepare('SELECT auth_key_enc FROM picnic_accounts WHERE household_id = ?')
      .get(householdId) as { auth_key_enc: string } | undefined
    if (!row) return null
    try {
      return decrypt(row.auth_key_enc, this.key)
    } catch {
      // Andere encryptiesleutel of beschadigde rij: behandel als niet gekoppeld.
      return null
    }
  }

  setAuthKey(householdId: string, authKey: string): void {
    this.db
      .prepare(
        `INSERT INTO picnic_accounts (household_id, auth_key_enc, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(household_id) DO UPDATE SET auth_key_enc = excluded.auth_key_enc, updated_at = excluded.updated_at`,
      )
      .run(householdId, encrypt(authKey, this.key), new Date().toISOString())
  }

  clearAuthKey(householdId: string): void {
    this.db.prepare('DELETE FROM picnic_accounts WHERE household_id = ?').run(householdId)
  }

  findRequest(householdId: string, requestId: string): StoredRequest | null {
    const row = this.db
      .prepare('SELECT state, baseline_json, result_json FROM cart_requests WHERE household_id = ? AND request_id = ?')
      .get(householdId, requestId) as { state: 'started' | 'done'; baseline_json: string; result_json: string | null } | undefined
    if (!row) return null
    return {
      state: row.state,
      baseline: JSON.parse(row.baseline_json) as Baseline,
      result: row.result_json ? (JSON.parse(row.result_json) as unknown) : null,
    }
  }

  startRequest(householdId: string, requestId: string, baseline: Baseline): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO cart_requests (household_id, request_id, state, baseline_json, created_at)
         VALUES (?, ?, 'started', ?, ?)`,
      )
      .run(householdId, requestId, JSON.stringify(baseline), new Date().toISOString())
  }

  finishRequest(householdId: string, requestId: string, result: unknown): void {
    this.db
      .prepare(`UPDATE cart_requests SET state = 'done', result_json = ? WHERE household_id = ? AND request_id = ?`)
      .run(JSON.stringify(result), householdId, requestId)
  }

  /** Oude verzoeken opruimen; een herhaling na meer dan een paar dagen is niet realistisch. */
  pruneRequests(olderThanDays = 14): void {
    const cutoff = new Date(Date.now() - olderThanDays * 86_400_000).toISOString()
    this.db.prepare('DELETE FROM cart_requests WHERE created_at < ?').run(cutoff)
  }

  close(): void {
    this.db.close()
  }
}
