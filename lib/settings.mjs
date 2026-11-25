import { resolve } from 'node:path';
import { site } from '../config/site.mjs';

export function resolveRuntimeEnvironment(env, directory = process.cwd()) {
  return {
    HOSTNAME: env.BIND_ADDRESS || '127.0.0.1',
    DATABASE_PATH: resolve(directory, env.DATABASE_PATH || 'data/guciocraft.sqlite'),
    DOWNLOAD_DIR: resolve(directory, env.DOWNLOAD_DIR || 'downloads'),
  };
}

export function getSettings() {
  let origin = '';
  try { origin = new URL(process.env.SITE_ORIGIN).origin; } catch { /* Fail closed. */ }
  const ipHeader = process.env.CLIENT_IP_HEADER === 'x-real-ip' ? 'x-real-ip' : '';
  const rcon = { host: process.env.RCON_HOST, port: Number(process.env.RCON_PORT || 25575), password: process.env.RCON_PASSWORD, timeoutMs: 3_000 };
  const whitelistEnabled = process.env.WHITELIST_ENABLED === 'true' && !!origin && !!ipHeader && !!rcon.host && (rcon.password?.length ?? 0) >= 24 && Number.isInteger(rcon.port) && rcon.port > 0 && rcon.port <= 65535;
  const paths = resolveRuntimeEnvironment(process.env);
  return {
    origin, ipHeader, rcon, whitelistEnabled,
    database: paths.DATABASE_PATH,
    downloads: { directory: paths.DOWNLOAD_DIR, files: site.downloads },
    minecraft: { host: process.env.MC_HOST || site.address, port: Number(process.env.MC_PORT || 25565), timeoutMs: 3_000 },
  };
}
