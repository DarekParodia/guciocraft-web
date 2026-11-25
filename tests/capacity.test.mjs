import test from 'node:test';
import assert from 'node:assert/strict';
import { RateStore } from '../lib/store.mjs';
import { createWhitelistHandler } from '../lib/whitelist.mjs';

test('API: maksymalnie dwa jednoczesne połączenia RCON, również przy różnych handlerach', async t => {
  const store = new RateStore(':memory:'); t.after(() => store.close());
  const waiting = [];
  const deps = { store, origin: 'https://gucio.test', ipHeader: 'x-real-ip', enabled: true, add: () => new Promise(resolve => waiting.push(resolve)) };
  const handlerA = createWhitelistHandler(deps), handlerB = createWhitelistHandler(deps);
  const req = n => new Request('https://gucio.test/api/whitelist', { method: 'POST', headers: { origin: 'https://gucio.test', 'x-real-ip': `192.0.2.${n}`, 'content-type': 'application/json' }, body: JSON.stringify({ nickname: `Player_${n}` }) });
  const first = handlerA(req(1)), second = handlerB(req(2));
  // Wait for both JSON streams to be consumed, rather than sleeping.
  while (waiting.length < 2) await new Promise(resolve => setImmediate(resolve));
  const third = await handlerB(req(3));
  assert.equal(third.status, 503);
  for (const resolve of waiting) resolve('added');
  assert.equal((await first).status, 200); assert.equal((await second).status, 200);
  const final = handlerA(req(4));
  while (waiting.length < 3) await new Promise(resolve => setImmediate(resolve));
  waiting[2]('added'); assert.equal((await final).status, 200);
});

test('SQLite: wygasająca rezerwacja nie blokuje zapisów po awarii procesu', () => {
  const store = new RateStore(':memory:');
  try {
    assert.ok(store.acquire(2, 100)); assert.ok(store.acquire(2, 100));
    assert.equal(store.acquire(2, 101), null);
    assert.ok(store.acquire(2, 5_101));
  } finally { store.close(); }
});
