import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { download } from '../../../lib/downloads.mjs';
import { getSettings } from '../../../lib/settings.mjs';

export const config = { api: { bodyParser: false, responseLimit: false } };

export default async function handler(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD, OPTIONS');
    response.statusCode = request.method === 'OPTIONS' ? 204 : 405;
    response.end();
    return;
  }

  const file = await download(request.query.kind, getSettings().downloads);
  response.statusCode = file.status;
  // Write the locally calculated length directly to the Node HTTP response.
  for (const [name, value] of file.headers) response.setHeader(name, value);
  if (request.method === 'HEAD') {
    await file.body.cancel();
    response.end();
    return;
  }

  try {
    await pipeline(Readable.fromWeb(file.body), response);
  } catch (error) {
    if (error.code !== 'ERR_STREAM_PREMATURE_CLOSE') throw error;
  }
}
