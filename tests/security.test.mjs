import test from 'node:test';
import assert from 'node:assert/strict';
import { validNickname, readJson, clientAddress, assertOrigin } from '../lib/security.mjs';

test('nick: pełne dopasowanie ASCII, bez newline, Unicode i dodatkowych argumentów', () => {
  for (const name of ['Ab_', 'Gucio_123', 'abcdefghijklmnop']) assert.equal(validNickname(name), true, name);
  for (const name of ['', 'ab', 'abcdefghijklmnopq', 'Gucio\n', 'Gucio\r\n', 'Gucio\0', ' Gucio', 'Gucio ', 'Gucio op', 'Gucio;stop', 'Ｇucio', 'Żucio', null, 123, {}]) {
    assert.equal(validNickname(name), false, String(name));
  }
});

test('JSON: schemat nicku, content type i limit również dla strumienia bez Content-Length', async () => {
  const req = (body, type = 'application/json') => new Request('https://gucio.test/api/whitelist', { method: 'POST', headers: { 'content-type': type }, body });
  assert.deepEqual(await readJson(req('{"nickname":"Gucio"}')), { nickname: 'Gucio' });
  for (const data of ['null', '[]', '{"nickname":"Gucio","command":"op"}', '{"nickname":1}', '{oops']) {
    await assert.rejects(readJson(req(data)), { status: 400 });
  }
  await assert.rejects(readJson(req(' '.repeat(513))), { status: 413 });
  await assert.rejects(readJson(req('{"nickname":"Gucio"}', 'text/plain')), { status: 415 });
});

test('Origin: wyłącznie skonfigurowany origin, brak nagłówka i obce źródło odrzucane', () => {
  const request = (origin) => new Request('https://gucio.test', { headers: origin ? { origin } : {} });
  assert.doesNotThrow(() => assertOrigin(request('https://gucio.test'), 'https://gucio.test'));
  for (const origin of [undefined, 'null', 'https://evil.test', 'https://gucio.test.evil.test']) {
    assert.throws(() => assertOrigin(request(origin), 'https://gucio.test'), { status: 403 });
  }
});

test('IP: brak zgadywania i ignorowanie podszytego X-Forwarded-For', () => {
  const req = (headers) => new Request('https://gucio.test', { headers });
  assert.equal(clientAddress(req({ 'x-forwarded-for': '1.2.3.4' }), 'x-real-ip'), null);
  assert.equal(clientAddress(req({ 'x-real-ip': '192.0.2.1', 'x-forwarded-for': '1.2.3.4' }), 'x-real-ip'), '192.0.2.1');
  assert.equal(clientAddress(req({ 'x-real-ip': '192.0.2.1, 1.2.3.4' }), 'x-real-ip'), null);
  assert.equal(clientAddress(req({ 'x-real-ip': 'garbage' }), 'x-real-ip'), null);
  assert.equal(clientAddress(req({ 'x-real-ip': '::ffff:192.0.2.1' }), 'x-real-ip'), '192.0.2.1');
  assert.equal(clientAddress(req({ 'x-real-ip': '2001:db8:abcd:12::1' }), 'x-real-ip'), clientAddress(req({ 'x-real-ip': '2001:0db8:abcd:0012:ffff::2' }), 'x-real-ip'));
  assert.equal(clientAddress(req({ 'x-real-ip': '192.0.2.1' }), ''), null);
});

test('JSON: timeout strumienia odrzuca również kompletny JSON przed zakończeniem body', async () => {
  const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{"nickname":"Gucio"}')); } });
  const request = new Request('https://gucio.test', { method: 'POST', headers: { 'content-type': 'application/json' }, body, duplex: 'half' });
  await assert.rejects(readJson(request), { status: 408 });
});
