import net from 'node:net';
import { validNickname } from './security.mjs';

function packet(id, type, text) {
  const body = Buffer.from(text, 'utf8');
  const data = Buffer.alloc(body.length + 14);
  data.writeInt32LE(body.length + 10, 0); data.writeInt32LE(id, 4); data.writeInt32LE(type, 8);
  body.copy(data, 12); return data;
}

// Intentionally no generic execute(command) interface exposed to HTTP callers.
export function addToWhitelist(nickname, { host, port = 25575, password, timeoutMs = 3_000 }) {
  if (!validNickname(nickname) || !host || !password) return Promise.reject(new Error('RCON: invalid configuration or nickname'));
  return new Promise((resolve, reject) => {
    let bytes = Buffer.alloc(0), authenticated = false, finished = false;
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => finish(new Error('RCON: timeout')), timeoutMs);
    function finish(error, result) {
      if (finished) return;
      finished = true; clearTimeout(timer); socket.destroy();
      if (error) reject(error); else resolve(result);
    }
    socket.on('connect', () => socket.write(packet(1, 3, password)));
    socket.on('error', () => finish(new Error('RCON: connection failed')));
    socket.on('close', () => finish(new Error('RCON: connection closed')));
    socket.on('data', chunk => {
      if (finished) return;
      bytes = Buffer.concat([bytes, chunk]);
      if (bytes.length > 32_768) return finish(new Error('RCON: response too large'));
      while (!finished && bytes.length >= 4) {
        const length = bytes.readInt32LE(0);
        if (length < 10 || length > 16_384) return finish(new Error('RCON: invalid packet length'));
        if (bytes.length < length + 4) return;
        const current = bytes.subarray(0, length + 4); bytes = bytes.subarray(length + 4);
        if (current.at(-1) !== 0 || current.at(-2) !== 0) return finish(new Error('RCON: invalid terminator'));
        const id = current.readInt32LE(4), type = current.readInt32LE(8);
        if (!authenticated) {
          if (id === -1) return finish(new Error('RCON: authentication refused'));
          if (id !== 1) return finish(new Error('RCON: unexpected response'));
          if (type === 0) continue; // Some implementations send an empty response before auth.
          if (type !== 2) return finish(new Error('RCON: invalid authentication response'));
          authenticated = true;
          socket.write(packet(2, 2, `whitelist add ${nickname}`));
        } else {
          if (id !== 2 || type !== 0) return finish(new Error('RCON: unexpected response'));
          const text = current.subarray(12, -2).toString('utf8').replace(/§[0-9A-FK-OR]/gi, '').trim();
          const added = /^Added ([A-Za-z0-9_]+) to the whitelist$/.exec(text);
          if (added && added[1].toLowerCase() === nickname.toLowerCase()) return finish(null, 'added');
          if (text === 'Player is already whitelisted') return finish(null, 'already');
          return finish(new Error('RCON: unconfirmed whitelist result'));
        }
      }
    });
  });
}
