'use client';
import { useEffect, useState } from 'react';

export default function ServerStatus() {
  const [status, setStatus] = useState({ state: 'loading' });
  useEffect(() => {
    let active = true, timer;
    const controller = new AbortController();
    async function update() {
      try {
        const response = await fetch('/api/status', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8_000)]) });
        if (!response.ok) throw new Error('Status unavailable');
        const data = await response.json();
        if (active) setStatus(data);
      } catch { if (active) setStatus({ state: 'unknown' }); }
      if (active) timer = setTimeout(update, 30_000);
    }
    void update();
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, []);
  const label = { loading: 'Sprawdzam serwer', unknown: 'Status niedostępny', offline: 'Serwer offline', online: 'Serwer online' }[status.state] || 'Status niedostępny';
  return <div className={`server-status ${status.state}`} role="status">
    <span className="status-dot" /><span>{label}</span>
    {status.state === 'online' && <><span className="status-divider">/</span><span className="players"><strong>{status.online}</strong> / {status.max} graczy</span></>}
  </div>;
}
