import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { download } from '../lib/downloads.mjs';

test('pobrania: brak pliku i nieznany typ to kontrolowane 404', async () => {
  const settings = { directory: '/nonexistent', files: { modpack: 'pack.zip', portable: 'portable.zip' } };
  assert.equal((await download('modpack', settings)).status, 404);
  assert.equal((await download('../../.env', settings)).status, 404);
  assert.equal((await download('toString', settings)).status, 404);
});

test('pobrania: strumieniuje ZIP i odrzuca traversal oraz symlink', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'gucio-downloads-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'pack.zip'), Buffer.from([0x50, 0x4b, 3, 4]));
  const settings = { directory: dir, files: { modpack: 'pack.zip' } };
  const response = await download('modpack', settings);
  assert.equal(response.status, 200); assert.equal(response.headers.get('content-length'), '4');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from([0x50, 0x4b, 3, 4]));
  assert.equal((await download('modpack', { ...settings, files: { modpack: '../pack.zip' } })).status, 404);
  await symlink(join(dir, 'pack.zip'), join(dir, 'link.zip'));
  assert.equal((await download('modpack', { ...settings, files: { modpack: 'link.zip' } })).status, 404);
});
