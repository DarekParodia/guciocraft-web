import { RateStore } from './store.mjs';
import { getSettings } from './settings.mjs';
import { addToWhitelist } from './rcon.mjs';
import { cachedStatus, pingMinecraft } from './status.mjs';
import { createWhitelistHandler } from './whitelist.mjs';
import { jsonResponse } from './security.mjs';

const shared = globalThis;
export function whitelist(request) {
  const settings = getSettings();
  if (!settings.whitelistEnabled) return jsonResponse({ ok: false, message: 'Zapisy będą dostępne po uruchomieniu usługi. Odezwij się na Discordzie.' }, 503);
  try {
    shared.__gucioStore ??= new RateStore(settings.database);
    return createWhitelistHandler({ store: shared.__gucioStore, origin: settings.origin, ipHeader: settings.ipHeader, enabled: settings.whitelistEnabled, add: nickname => addToWhitelist(nickname, settings.rcon) })(request);
  } catch { return jsonResponse({ ok: false, message: 'Zapisy są chwilowo niedostępne.' }, 503); }
}
export function status() {
  shared.__gucioStatus ??= cachedStatus(() => pingMinecraft(getSettings().minecraft));
  return shared.__gucioStatus();
}
