'use client';
import { useState } from 'react';

export default function WhitelistForm({ enabled }) {
  const [nickname, setNickname] = useState('');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState(null);
  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    setResult(null);
    if (nickname.length < 3 || nickname.length > 16 || /[^A-Za-z0-9_]/.test(nickname)) {
      setResult({ ok: false, message: 'Wpisz 3–16 znaków: litery A–Z, cyfry lub podkreślenie.' }); return;
    }
    setPending(true);
    try {
      const response = await fetch('/api/whitelist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname }), signal: AbortSignal.timeout(10_000) });
      const data = await response.json();
      const retry = Number(response.headers.get('retry-after'));
      setResult({ ok: response.ok && data.ok === true, message: data.message + (response.status === 429 && retry ? ` Poczekaj ${retry} s.` : '') });
    } catch { setResult({ ok: false, message: 'Nie udało się potwierdzić zapisu. Spróbuj później lub napisz na Discordzie.' }); }
    finally { setPending(false); }
  }
  return <form onSubmit={submit} className="whitelist-form" aria-busy={pending}>
    <label htmlFor="nickname">Nick w Minecraft</label>
    <div className="input-row">
      <input id="nickname" name="nickname" value={nickname} onChange={event => { setNickname(event.target.value); setResult(null); }} placeholder="np. Gucio_123" autoComplete="off" autoCapitalize="none" spellCheck="false" minLength={3} maxLength={16} pattern="[A-Za-z0-9_]{3,16}" required disabled={!enabled || pending} aria-describedby="nickname-help whitelist-result" />
      <button type="submit" className="button" disabled={!enabled || pending}>{pending ? 'Dodawanie…' : 'Dodaj do whitelisty'}</button>
    </div>
    <p id="nickname-help" className="form-hint">{enabled ? 'Dodamy cię automatycznie do whitelisty.' : 'Zapisy jeszcze nie ruszyły. W sprawie dostępu napisz na Discordzie.'}</p>
    <div id="whitelist-result" className={`form-result ${result?.ok ? 'success' : 'error'}`} role="status" aria-live="polite">{result?.message}</div>
  </form>;
}
