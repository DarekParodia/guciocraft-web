import { DatabaseSync } from 'node:sqlite';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export class RateStore {
  constructor(path) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS events (subject TEXT NOT NULL, time INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS events_lookup ON events(subject, time);
      CREATE TABLE IF NOT EXISTS metadata (name TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit (time INTEGER NOT NULL, nickname TEXT NOT NULL, outcome TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS leases (token TEXT PRIMARY KEY, expires INTEGER NOT NULL);`);
    this.db.prepare('INSERT OR IGNORE INTO metadata VALUES (?, ?)').run('key', randomBytes(32).toString('hex'));
    this.secret = this.db.prepare('SELECT value FROM metadata WHERE name = ?').get('key').value;
    this.count = this.db.prepare('SELECT count(*) AS n, min(time) AS first FROM events WHERE subject = ? AND time > ?');
    this.insert = this.db.prepare('INSERT INTO events VALUES (?, ?)');
  }

  key(kind, subject) { return `${kind}:${createHmac('sha256', this.secret).update(subject).digest('hex')}`; }

  consume(rules, now = Date.now()) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('DELETE FROM events WHERE time <= ?').run(now - 86_400_000);
      this.db.prepare('DELETE FROM audit WHERE time <= ?').run(now - 7 * 86_400_000);
      let retryAfter = 0;
      for (const { key, limit, windowMs } of rules) {
        const row = this.count.get(key, now - windowMs);
        if (row.n >= limit) retryAfter = Math.max(retryAfter, Math.max(1, Math.ceil((row.first + windowMs - now) / 1_000)));
      }
      if (!retryAfter) for (const rule of rules) this.insert.run(rule.key, now);
      this.db.exec('COMMIT');
      return retryAfter ? { allowed: false, retryAfter } : { allowed: true };
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  audit(nickname, outcome, now = Date.now()) {
    this.db.prepare('INSERT INTO audit VALUES (?, ?, ?)').run(now, nickname, outcome);
  }

  acquire(max, now = Date.now()) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('DELETE FROM leases WHERE expires <= ?').run(now);
      let token = null;
      if (this.db.prepare('SELECT count(*) AS n FROM leases').get().n < max) {
        token = randomUUID(); this.db.prepare('INSERT INTO leases VALUES (?, ?)').run(token, now + 5_000);
      }
      this.db.exec('COMMIT'); return token;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  release(token) { this.db.prepare('DELETE FROM leases WHERE token = ?').run(token); }

  close() { this.db.close(); }
}
