import { resolveRuntimeEnvironment } from '../lib/settings.mjs';
// Standalone changes cwd: resolve ZIP/database paths against the project first.
// Bind only to loopback so clients cannot bypass the trusted reverse proxy.
Object.assign(process.env, resolveRuntimeEnvironment(process.env));
await import('../.next/standalone/server.js');
