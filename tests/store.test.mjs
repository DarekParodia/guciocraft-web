import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RateStore } from '../lib/store.mjs';

test('limity są ślizgowe i rezerwowane atomowo dla wszystkich reguł', () => {
  const store = new RateStore(':memory:');
  try {
    const rules = [{ key: 'ip:a', limit: 2, windowMs: 60_000 }, { key: 'global', limit: 3, windowMs: 60_000 }];
    assert.equal(store.consume(rules, 1_000).allowed, true);
    assert.equal(store.consume(rules, 2_000).allowed, true);
    assert.deepEqual(store.consume(rules, 3_000), { allowed: false, retryAfter: 58 });
    assert.equal(store.consume([{ key: 'global', limit: 3, windowMs: 60_000 }], 4_000).allowed, true);
    assert.equal(store.consume([{ key: 'global', limit: 3, windowMs: 60_000 }], 5_000).allowed, false);
    assert.equal(store.consume(rules, 61_001).allowed, true);
  } finally { store.close(); }
});

test('limity i klucz anonimizacji przetrwają ponowne otwarcie bazy', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gucio-limits-'));
  try {
    let store = new RateStore(join(dir, 'limits.sqlite'));
    const key = store.key('ip', '192.0.2.1');
    assert.equal(key.includes('192.0.2.1'), false);
    assert.equal(store.consume([{ key, limit: 1, windowMs: 3_600_000 }], 100).allowed, true);
    store.close();
    store = new RateStore(join(dir, 'limits.sqlite'));
    assert.equal(store.key('ip', '192.0.2.1'), key);
    assert.equal(store.consume([{ key, limit: 1, windowMs: 3_600_000 }], 200).allowed, false);
    store.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
