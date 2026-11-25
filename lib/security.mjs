import { isIP } from 'node:net';

export class HttpError extends Error {
  constructor(status, message, retryAfter) { super(message); this.status = status; this.retryAfter = retryAfter; }
}

export function validNickname(value) {
  return typeof value === 'string' && value.length >= 3 && value.length <= 16 && !/[^A-Za-z0-9_]/.test(value);
}

export function assertOrigin(request, origin) {
  if (!origin || request.headers.get('origin') !== origin || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new HttpError(403, 'Odśwież stronę i spróbuj ponownie.');
  }
}

export async function readJson(request) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new HttpError(415, 'Nieobsługiwany format zgłoszenia.');
  }
  if (Number(request.headers.get('content-length')) > 512) throw new HttpError(413, 'Zgłoszenie jest zbyt duże.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Podaj nick w Minecraft.');
  const chunks = [];
  let size = 0;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}); }, 3_000);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 512) { await reader.cancel(); throw new HttpError(413, 'Zgłoszenie jest zbyt duże.'); }
      chunks.push(Buffer.from(value));
    }
    if (timedOut) throw new HttpError(408, 'Przesyłanie zgłoszenia trwało zbyt długo. Spróbuj ponownie.');
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new HttpError(400, 'Nieprawidłowe zgłoszenie.'); }
    if (!body || Array.isArray(body) || Object.keys(body).length !== 1 || !validNickname(body.nickname)) {
      throw new HttpError(400, 'Nick musi mieć 3–16 znaków: litery A–Z, cyfry lub podkreślenie.');
    }
    return body;
  } finally { clearTimeout(timer); reader.releaseLock(); }
}

// The reverse proxy must overwrite this single-value header and be the only path to Next.js.
export function clientAddress(request, header) {
  if (!header) return null;
  let address = request.headers.get(header);
  if (!address || address.includes(',') || address !== address.trim()) return null;
  if (address.startsWith('::ffff:') && isIP(address.slice(7)) === 4) address = address.slice(7);
  const version = isIP(address);
  if (version === 4) return address;
  if (version !== 6 || address.includes('%')) return null;
  const canonical = new URL(`http://[${address}]`).hostname.slice(1, -1);
  const [left, right] = canonical.split('::');
  const a = left ? left.split(':') : [];
  const b = right ? right.split(':') : [];
  const groups = right === undefined ? a : [...a, ...Array(8 - a.length - b.length).fill('0'), ...b];
  return `${groups.slice(0, 4).map(x => Number.parseInt(x, 16).toString(16)).join(':')}::/64`;
}

export function jsonResponse(body, status = 200, extra = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
}
