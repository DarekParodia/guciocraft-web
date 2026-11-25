import { assertOrigin, clientAddress, HttpError, jsonResponse, readJson } from './security.mjs';

export function createWhitelistHandler({ store, origin, ipHeader, enabled, add }) {
  return async function handle(request) {
    try {
      if (request.method !== 'POST') return jsonResponse({ message: 'Niedozwolona metoda.' }, 405, { Allow: 'POST' });
      assertOrigin(request, origin);
      if (!enabled || !ipHeader) throw new HttpError(503, 'Zapisy będą dostępne po uruchomieniu usługi. Odezwij się na Discordzie.');
      const ip = clientAddress(request, ipHeader);
      if (!ip) throw new HttpError(503, 'Zapisy są chwilowo niedostępne. Odezwij się na Discordzie.');
      const attempts = store.consume([{ key: store.key('attempt', ip), limit: 10, windowMs: 60_000 }]);
      if (!attempts.allowed) throw new HttpError(429, 'Za dużo prób. Poczekaj chwilę.', attempts.retryAfter);
      const { nickname } = await readJson(request);
      const budget = store.consume([
        { key: store.key('operation', ip), limit: 5, windowMs: 3_600_000 },
        { key: store.key('nickname', nickname.toLowerCase()), limit: 1, windowMs: 60_000 },
        { key: 'global', limit: 20, windowMs: 60_000 },
      ]);
      if (!budget.allowed) throw new HttpError(429, 'Limit zapisów został osiągnięty. Spróbuj później.', budget.retryAfter);
      const lease = store.acquire(2);
      if (!lease) throw new HttpError(503, 'Serwer obsługuje inne zgłoszenia. Spróbuj ponownie za chwilę.', 5);
      let result;
      try { result = await add(nickname); }
      catch {
        store.audit(nickname, 'unconfirmed');
        throw new HttpError(503, 'Nie udało się potwierdzić zapisu. Spróbuj ponownie później lub napisz na Discordzie.');
      }
      finally { store.release(lease); }
      if (result !== 'added' && result !== 'already') throw new HttpError(503, 'Nie udało się potwierdzić zapisu.');
      store.audit(nickname, result);
      return jsonResponse({ ok: true, message: result === 'already' ? 'Ten nick jest już na whiteliście. Możesz dołączyć!' : 'Dodano do whitelisty. Możesz dołączyć do serwera!' });
    } catch (error) {
      if (error instanceof HttpError) return jsonResponse({ ok: false, message: error.message }, error.status, error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {});
      return jsonResponse({ ok: false, message: 'Zapisy są chwilowo niedostępne. Spróbuj ponownie później.' }, 503);
    }
  };
}
