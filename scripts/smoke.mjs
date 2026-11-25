// Exercise Next's production HTTP handler without opening a TCP port.
import next from 'next';
import assert from 'node:assert/strict';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Duplex } from 'node:stream';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { site } from '../config/site.mjs';

const app = next({ dev: false, dir: process.cwd(), quiet: true });
const secretMarker = 'smoke-only-secret-not-for-real-rcon';
process.env.RCON_PASSWORD = secretMarker;
await app.prepare();
const handler = app.getRequestHandler();

async function get(path, method = 'GET') {
  const socket = new Duplex({ read() {}, write(chunk, encoding, callback) { callback(); } });
  const request = new IncomingMessage(socket);
  request.method = method; request.url = path; request.headers = { host: 'localhost:3000' };
  if (path.startsWith('/api/downloads/')) request.headers['accept-encoding'] = 'gzip, br';
  const response = new ServerResponse(request);
  response.assignSocket(socket);
  const chunks = [];
  const originalWrite = response.write.bind(response), originalEnd = response.end.bind(response);
  response.write = (chunk, ...args) => { if (chunk) chunks.push(Buffer.from(chunk)); return originalWrite(chunk, ...args); };
  response.end = (chunk, ...args) => { if (chunk && typeof chunk !== 'function') chunks.push(Buffer.from(chunk)); return originalEnd(chunk, ...args); };
  const finished = new Promise((resolve, reject) => { response.once('finish', resolve); response.once('error', reject); });
  try { await handler(request, response); await finished; return { status: response.statusCode, headers: response.getHeaders(), body: Buffer.concat(chunks).toString('utf8') }; }
  finally { socket.destroy(); }
}

const downloadDir = await mkdtemp(join(tmpdir(), 'guciocraft-smoke-'));
try {
  process.env.DOWNLOAD_DIR = downloadDir;
  for (const [kind, filename] of Object.entries(site.downloads)) {
    const payload = `testowy plik ${kind}`;
    await writeFile(join(downloadDir, filename), payload);
    const path = `/api/downloads/${kind}`;
    const download = await get(path);
    assert.equal(download.status, 200);
    assert.equal(download.headers['content-length'], String(Buffer.byteLength(payload)));
    assert.equal(download.body, payload);
    const head = await get(path, 'HEAD');
    assert.equal(head.status, 200);
    assert.equal(head.headers['content-length'], download.headers['content-length']);
    assert.equal(head.body, '');
  }
  const page = await get('/');
  assert.equal(page.status, 200);
  for (const text of ['guciocraft', 'Dodaj do whitelisty', 'Pobierz i zagraj', 'mc.bshomelab.cc', 'mcmap.bshomelab.cc', 'nickname', 'lang="pl"']) assert.ok(page.body.includes(text), `Missing ${text}`);
  assert.ok(page.body.indexOf('<form') < page.body.indexOf('id="instalacja"'), 'Formularz musi być przed instalacją');
  assert.ok(!page.body.includes('RCON_PASSWORD'));
  assert.ok(!page.body.includes(secretMarker));
  for (const match of page.body.matchAll(/(?:src|href)="(\/_next\/static\/[^"?]+)(?:\?[^\"]*)?"/g)) {
    const asset = await stat(join(process.cwd(), '.next/standalone/.next/static', match[1].replace('/_next/static/', '')));
    assert.ok(asset.isFile(), `Missing standalone asset: ${match[1]}`);
  }
  const missing = await get('/api/downloads/unknown'); assert.equal(missing.status, 404);
  const cssDirectory = join(process.cwd(), '.next/static/css');
  let css = '';
  for (const name of await readdir(cssDirectory)) if (name.endsWith('.css')) css += await readFile(join(cssDirectory, name), 'utf8');
  await mkdir('test-results', { recursive: true });
  // A file preview for restricted environments; no scripts, remote iframe or hydration.
  const preview = page.body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').replace(/<link\b[^>]*>/g, '').replace('</head>', `<style>${css}</style></head>`);
  await writeFile('test-results/preview.html', preview);
  console.log('PASS: produkcyjny SSR, treści strony, brak nazw sekretów, długości ZIP dla GET i HEAD oraz API pobrań 404.');
  console.log('Statyczny podgląd SSR: test-results/preview.html');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await app.close();
  await rm(downloadDir, { recursive: true, force: true });
}
