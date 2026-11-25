import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import net from 'node:net';
import { addToWhitelist } from '../lib/rcon.mjs';
import { pingMinecraft } from '../lib/status.mjs';

function frame(id, type, body = '') {
  const text = Buffer.from(body), bytes = Buffer.alloc(text.length + 14);
  bytes.writeInt32LE(text.length + 10); bytes.writeInt32LE(id, 4); bytes.writeInt32LE(type, 8); text.copy(bytes, 12);
  return bytes;
}
// TCP is unavailable in restricted environments. Replace only the transport;
// exercise the production packet parsing, validation, timeouts and command bytes.
function transport(t, script) {
  const socket = new EventEmitter();
  socket.destroyed = false;
  socket.destroy = () => { socket.destroyed = true; };
  socket.write = data => { queueMicrotask(() => { if (!socket.destroyed) script(socket, data); }); return true; };
  t.mock.method(net, 'createConnection', () => { queueMicrotask(() => socket.emit('connect')); return socket; });
  t.after(() => t.mock.restoreAll());
}
const options = { host: 'test.invalid', password: 'local-test-only', timeoutMs: 100 };

test('pakiety RCON: fragmenty autoryzacji i dokładna komenda whitelist', async t => {
  const commands = [];
  transport(t, (socket, data) => {
    const id = data.readInt32LE(4), type = data.readInt32LE(8), text = data.subarray(12, -2).toString();
    if (type === 3) {
      assert.equal(text, 'local-test-only');
      const response = Buffer.concat([frame(id, 0), frame(id, 2)]);
      socket.emit('data', response.subarray(0, 6)); socket.emit('data', response.subarray(6));
    } else { commands.push(text); const response = frame(id, 0, 'Added Gucio to the whitelist'); socket.emit('data', response.subarray(0, 11)); socket.emit('data', response.subarray(11)); }
  });
  assert.equal(await addToWhitelist('Gucio', options), 'added');
  assert.deepEqual(commands, ['whitelist add Gucio']);
  await assert.rejects(addToWhitelist('Gucio\nstop', options));
});

test('pakiety RCON: odmowa, błędny ID, zbyt duży pakiet i nieznana odpowiedź', async t => {
  for (const response of [frame(-1, 2), frame(999, 2), Buffer.from([255, 255, 255, 127])]) {
    transport(t, socket => socket.emit('data', response));
    await assert.rejects(addToWhitelist('Gucio', options)); t.mock.restoreAll();
  }
  transport(t, (socket, data) => socket.emit('data', data.readInt32LE(8) === 3 ? frame(1, 2) : frame(2, 0, 'Unknown command')));
  await assert.rejects(addToWhitelist('Gucio', options));
});

test('pakiety RCON: timeout i zerwane połączenie nie dają sukcesu', async t => {
  transport(t, () => {});
  await assert.rejects(addToWhitelist('Gucio', { ...options, timeoutMs: 10 }), /timeout/);
  t.mock.restoreAll();
  transport(t, socket => socket.emit('close'));
  await assert.rejects(addToWhitelist('Gucio', options), /closed/);
});

test('pakiety RCON: potwierdzenie istniejącego wpisu', async t => {
  transport(t, (socket, data) => socket.emit('data', data.readInt32LE(8) === 3 ? frame(1, 2) : frame(2, 0, 'Player is already whitelisted')));
  assert.equal(await addToWhitelist('Gucio', options), 'already');
});

test('pakiety statusu: fragmentacja, liczniki i brak listy graczy', async t => {
  let sent = false;
  transport(t, socket => {
    if (sent) return; sent = true;
    const text = Buffer.from('{"players":{"online":2,"max":20,"sample":[{"name":"secret"}]}}');
    const data = Buffer.concat([Buffer.from([text.length + 2, 0, text.length]), text]);
    socket.emit('data', data.subarray(0, 2)); socket.emit('data', data.subarray(2));
  });
  const result = await pingMinecraft({ host: 'test.invalid', port: 25565, timeoutMs: 100 });
  assert.equal(result.state, 'online'); assert.equal(result.online, 2); assert.equal(result.max, 20);
  assert.equal(JSON.stringify(result).includes('secret'), false);
});

test('pakiety statusu: odmowa połączenia offline, timeout nieznany', async t => {
  transport(t, socket => socket.emit('error', { code: 'ECONNREFUSED' }));
  assert.equal((await pingMinecraft({ host: 'test.invalid', port: 25565 })).state, 'offline');
  t.mock.restoreAll(); transport(t, () => {});
  assert.equal((await pingMinecraft({ host: 'test.invalid', port: 25565, timeoutMs: 10 })).state, 'unknown');
});
