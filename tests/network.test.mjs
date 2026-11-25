import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { addToWhitelist } from '../lib/rcon.mjs';
import { pingMinecraft, cachedStatus } from '../lib/status.mjs';

const canListen = await new Promise(resolve => {
  const probe = net.createServer();
  probe.once('error', error => { if (error.code === 'EPERM') resolve(false); else throw error; });
  probe.listen(0, '127.0.0.1', () => probe.close(() => resolve(true)));
});
const localNetwork = { skip: !canListen && 'Sandbox blokuje listen(127.0.0.1); uruchom również poza sandboxem.' };

function packet(id, type, body = '') {
  const text = Buffer.from(body);
  const data = Buffer.alloc(text.length + 14);
  data.writeInt32LE(text.length + 10, 0); data.writeInt32LE(id, 4); data.writeInt32LE(type, 8);
  text.copy(data, 12); return data;
}

async function fixture(t, onPacket) {
  const sockets = new Set();
  const server = net.createServer(socket => {
    sockets.add(socket); socket.on('close', () => sockets.delete(socket)); socket.on('error', () => {});
    let bytes = Buffer.alloc(0);
    socket.on('data', chunk => {
      bytes = Buffer.concat([bytes, chunk]);
      while (bytes.length >= 4 && bytes.length >= bytes.readInt32LE(0) + 4) {
        const size = bytes.readInt32LE(0) + 4;
        const current = bytes.subarray(0, size); bytes = bytes.subarray(size);
        onPacket(socket, current.readInt32LE(4), current.readInt32LE(8), current.subarray(12, -2).toString());
      }
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { for (const socket of sockets) socket.destroy(); server.close(); });
  return { host: '127.0.0.1', port: server.address().port, password: 'test-only-password', timeoutMs: 200 };
}

test('RCON: autoryzuje, składa fragmenty TCP i wysyła tylko whitelist-offline add', localNetwork, async t => {
  const commands = [];
  const options = await fixture(t, (socket, id, type, text) => {
    if (type === 3) {
      assert.equal(text, 'test-only-password');
      const data = Buffer.concat([packet(id, 0), packet(id, 2)]);
      socket.write(data.subarray(0, 7)); setTimeout(() => socket.write(data.subarray(7)), 5);
    } else {
      commands.push(text); socket.write(packet(id, 0, 'GUCIOCRAFT_WHITELIST added Gucio_1'));
    }
  });
  assert.equal(await addToWhitelist('Gucio_1', options), 'added');
  assert.deepEqual(commands, ['whitelist-offline add Gucio_1']);
  await assert.rejects(addToWhitelist('Gucio\nstop', options));
  assert.equal(commands.length, 1);
});

test('RCON: odmowa autoryzacji i timeout nie dają sukcesu', localNetwork, async t => {
  const denied = await fixture(t, socket => socket.write(packet(-1, 2)));
  await assert.rejects(addToWhitelist('Gucio', denied), /RCON/);
  const silent = await fixture(t, () => {});
  await assert.rejects(addToWhitelist('Gucio', { ...silent, timeoutMs: 30 }), /RCON/);
});

test('RCON: odrzuca nieznany wynik, obcy request ID i nieprawidłowy pakiet', localNetwork, async t => {
  for (const reply of [packet(2, 0, 'Unknown command'), packet(999, 0, 'GUCIOCRAFT_WHITELIST added Gucio'), Buffer.from([255, 255, 255, 127])]) {
    const options = await fixture(t, (socket, id, type) => socket.write(type === 3 ? packet(id, 2) : reply));
    await assert.rejects(addToWhitelist('Gucio', options));
  }
});

test('RCON: nick już na whiteliście to poprawna odpowiedź idempotentna', localNetwork, async t => {
  const options = await fixture(t, (socket, id, type) => socket.write(type === 3 ? packet(id, 2) : packet(id, 0, 'GUCIOCRAFT_WHITELIST already Gucio')));
  assert.equal(await addToWhitelist('Gucio', options), 'already');
});

function vi(n) { const bytes = []; do { let b = n & 127; n >>>= 7; if (n) b |= 128; bytes.push(b); } while (n); return Buffer.from(bytes); }

test('Minecraft status: prawdziwy odczyt protokołu i tylko publiczne liczniki', localNetwork, async t => {
  const sockets = new Set();
  const server = net.createServer(socket => {
    sockets.add(socket); socket.on('close', () => sockets.delete(socket)); socket.on('error', () => {});
    socket.once('data', () => {
      const json = Buffer.from(JSON.stringify({ players: { online: 3, max: 20, sample: [{ name: 'SecretPlayer' }] } }));
      const data = Buffer.concat([Buffer.from([0]), vi(json.length), json]);
      const frame = Buffer.concat([vi(data.length), data]);
      socket.write(frame.subarray(0, 2)); setTimeout(() => socket.write(frame.subarray(2)), 5);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { for (const s of sockets) s.destroy(); server.close(); });
  const result = await pingMinecraft({ host: '127.0.0.1', port: server.address().port, timeoutMs: 200 });
  assert.equal(result.state, 'online'); assert.equal(result.online, 3); assert.equal(result.max, 20);
  assert.equal(JSON.stringify(result).includes('SecretPlayer'), false);
});

test('status: współdzieli trwający odczyt i buforuje wynik', async () => {
  let calls = 0;
  const status = cachedStatus(async () => { calls++; await new Promise(r => setTimeout(r, 5)); return { state: 'online', online: 2, max: 10 }; }, 30_000);
  await Promise.all([status(), status(), status()]); await status();
  assert.equal(calls, 1);
});
