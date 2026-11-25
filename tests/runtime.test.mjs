import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRuntimeEnvironment } from '../lib/settings.mjs';

test('standalone: ścieżki danych i ZIP pozostają w katalogu projektu po zmianie cwd', () => {
  const env = resolveRuntimeEnvironment({ DATABASE_PATH: './data/guciocraft.sqlite', DOWNLOAD_DIR: './downloads' }, '/opt/guciocraft');
  assert.equal(env.DATABASE_PATH, '/opt/guciocraft/data/guciocraft.sqlite');
  assert.equal(env.DOWNLOAD_DIR, '/opt/guciocraft/downloads');
  assert.equal(env.HOSTNAME, '127.0.0.1');
});

test('standalone: zachowuje absolutne ścieżki LXC i bezpieczne wartości domyślne', () => {
  const env = resolveRuntimeEnvironment({ DATABASE_PATH: '/var/lib/gucio/limits.sqlite', DOWNLOAD_DIR: '/var/lib/gucio/zip', HOSTNAME: 'host-systemowy' }, '/opt/guciocraft');
  assert.equal(env.DATABASE_PATH, '/var/lib/gucio/limits.sqlite');
  assert.equal(env.DOWNLOAD_DIR, '/var/lib/gucio/zip');
  assert.equal(env.HOSTNAME, '127.0.0.1');
  assert.equal(resolveRuntimeEnvironment({}, '/opt/guciocraft').DOWNLOAD_DIR, '/opt/guciocraft/downloads');
});
