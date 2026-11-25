import net from 'node:net';

function encodeVarInt(value) {
  const bytes = [];
  do { let byte = value & 127; value >>>= 7; if (value) byte |= 128; bytes.push(byte); } while (value);
  return Buffer.from(bytes);
}
function decodeVarInt(buffer, offset = 0) {
  let result = 0;
  for (let i = 0; i < 5; i++) {
    if (offset + i >= buffer.length) return null;
    const byte = buffer[offset + i]; result |= (byte & 127) << (i * 7);
    if (!(byte & 128)) return { value: result >>> 0, length: i + 1 };
  }
  throw new Error('Invalid VarInt');
}

export function pingMinecraft({ host, port = 25565, timeoutMs = 3_000 }) {
  return new Promise(resolve => {
    let bytes = Buffer.alloc(0), finished = false;
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => finish({ state: 'unknown' }), timeoutMs);
    function finish(result) {
      if (finished) return;
      finished = true; clearTimeout(timer); socket.destroy(); resolve({ ...result, checkedAt: new Date().toISOString() });
    }
    socket.on('connect', () => {
      const address = Buffer.from(host), portBytes = Buffer.alloc(2); portBytes.writeUInt16BE(port);
      const handshake = Buffer.concat([Buffer.from([0]), encodeVarInt(0xffffffff), encodeVarInt(address.length), address, portBytes, Buffer.from([1])]);
      socket.write(Buffer.concat([encodeVarInt(handshake.length), handshake, Buffer.from([1, 0])]));
    });
    socket.on('error', error => finish({ state: error.code === 'ECONNREFUSED' ? 'offline' : 'unknown' }));
    socket.on('close', () => finish({ state: 'unknown' }));
    socket.on('data', chunk => {
      if (finished) return;
      try {
        bytes = Buffer.concat([bytes, chunk]);
        if (bytes.length > 65_536) throw new Error('Oversize status');
        const frame = decodeVarInt(bytes);
        if (!frame) return;
        if (frame.value > 65_536) throw new Error('Oversize frame');
        if (bytes.length < frame.length + frame.value) return;
        const data = bytes.subarray(frame.length, frame.length + frame.value);
        if (data[0] !== 0) throw new Error('Invalid status packet');
        const string = decodeVarInt(data, 1);
        if (!string || 1 + string.length + string.value !== data.length) throw new Error('Invalid status JSON length');
        const result = JSON.parse(data.subarray(1 + string.length).toString('utf8'));
        const { online, max } = result.players ?? {};
        if (![online, max].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 1_000_000)) throw new Error('Invalid player count');
        finish({ state: 'online', online, max });
      } catch { finish({ state: 'unknown' }); }
    });
  });
}

export function cachedStatus(load, ttlMs = 30_000) {
  let value, expiry = 0, pending;
  return async () => {
    if (value && Date.now() < expiry) return value;
    if (!pending) pending = Promise.resolve().then(load).then(result => {
      value = result; expiry = Date.now() + ttlMs; return value;
    }).finally(() => { pending = null; });
    return pending;
  };
}
