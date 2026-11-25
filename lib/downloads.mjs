import { open, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { jsonResponse } from './security.mjs';

export async function download(kind, settings) {
  const filename = ['modpack', 'portable'].includes(kind) ? settings.files[kind] : null;
  if (typeof filename !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*\.zip$/.test(filename)) {
    return jsonResponse({ message: 'Ten plik nie jest jeszcze dostępny.' }, 404);
  }
  let file;
  try {
    const directory = await realpath(settings.directory);
    file = await open(join(directory, filename), constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await file.stat();
    if (!stat.isFile() || stat.size === 0) { await file.close(); return jsonResponse({ message: 'Ten plik nie jest jeszcze dostępny.' }, 404); }
    return new Response(Readable.toWeb(file.createReadStream()), { headers: {
      'Content-Type': 'application/zip', 'Content-Length': String(stat.size),
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store',
    } });
  } catch {
    await file?.close().catch(() => {});
    return jsonResponse({ message: 'Ten plik nie jest jeszcze dostępny.' }, 404);
  }
}

export async function downloadAvailable(kind, settings) {
  const response = await download(kind, settings);
  const available = response.status === 200;
  await response.body?.cancel();
  return available;
}
