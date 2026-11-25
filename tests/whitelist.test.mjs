import test from 'node:test';
import assert from 'node:assert/strict';
import { RateStore } from '../lib/store.mjs';
import { createWhitelistHandler } from '../lib/whitelist.mjs';

function setup(t, overrides = {}) {
  const store = new RateStore(':memory:'); t.after(() => store.close());
  const calls = [];
  const handler = createWhitelistHandler({ store, origin: 'https://gucio.test', ipHeader: 'x-real-ip', enabled: true, add: async name => { calls.push(name); return 'added'; }, ...overrides });
  return { handler, calls };
}
function request(nickname, headers = {}) {
  return new Request('https://gucio.test/api/whitelist', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://gucio.test', 'x-real-ip': '192.0.2.1', ...headers }, body: JSON.stringify({ nickname }) });
}

test('API: poprawny zapis, zła komenda odrzucona przed side effect', async t => {
  const { handler, calls } = setup(t);
  assert.equal((await handler(request('Gucio'))).status, 200);
  assert.equal((await handler(request('Gucio\nstop'))).status, 400);
  assert.deepEqual(calls, ['Gucio']);
});

test('API: ten sam nick inną wielkością liter ma wspólny cooldown', async t => {
  const { handler, calls } = setup(t);
  await handler(request('Gucio'));
  const blocked = await handler(request('gUCIO', { 'x-real-ip': '192.0.2.2' }));
  assert.equal(blocked.status, 429); assert.ok(Number(blocked.headers.get('retry-after')) > 0); assert.equal(calls.length, 1);
});

test('API: spoofing XFF nie obchodzi 5 operacji/h/IP', async t => {
  const { handler, calls } = setup(t);
  for (let n = 0; n < 5; n++) assert.equal((await handler(request(`Gucio_${n}`))).status, 200);
  assert.equal((await handler(request('Another', { 'x-forwarded-for': '198.51.100.9' }))).status, 429);
  assert.equal(calls.length, 5);
});

test('API: błędne dane także zużywają limit prób', async t => {
  const { handler } = setup(t);
  for (let n = 0; n < 10; n++) assert.equal((await handler(request('!'))).status, 400);
  assert.equal((await handler(request('Gucio'))).status, 429);
});

test('API: brak konfiguracji, obcy Origin i brak IP nie wykonują RCON', async t => {
  for (const overrides of [{ enabled: false }, { ipHeader: '' }]) {
    const { handler, calls } = setup(t, overrides);
    assert.equal((await handler(request('Gucio'))).status, 503); assert.equal(calls.length, 0);
  }
  const { handler, calls } = setup(t);
  assert.equal((await handler(request('Gucio', { Origin: 'https://evil.test' }))).status, 403);
  assert.equal((await handler(request('Gucio', { 'x-real-ip': 'bad' }))).status, 503);
  assert.equal(calls.length, 0);
});

test('API: błąd RCON nie ujawnia sekretu ani nie potwierdza dodania', async t => {
  const { handler } = setup(t, { add: async () => { throw new Error('password=secret, 10.0.0.1'); } });
  const response = await handler(request('Gucio'));
  assert.equal(response.status, 503); assert.equal((await response.text()).includes('secret'), false);
});

test('API: limit globalny działa również dla różnych nicków i adresów IP', async t => {
  const { handler, calls } = setup(t);
  for (let n = 1; n <= 20; n++) assert.equal((await handler(request(`Player_${n}`, { 'x-real-ip': `192.0.2.${n}` }))).status, 200);
  assert.equal((await handler(request('Player_21', { 'x-real-ip': '192.0.2.21' }))).status, 429);
  assert.equal(calls.length, 20);
});
