'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icons';

export default function CopyAddress({ address }) {
  const [state, setState] = useState('idle');
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    try { await navigator.clipboard.writeText(address); setState('copied'); }
    catch { setState('error'); }
    clearTimeout(timer.current); timer.current = setTimeout(() => setState('idle'), 3_000);
  }
  return <div className="address-wrap">
    <button type="button" className="address" onClick={copy} aria-label={`Kopiuj adres serwera ${address}`}>
      <code>{address}</code><Icon name={state === 'copied' ? 'check' : 'copy'} size={14} />
    </button>
    <span className="copy-feedback" role="status">{state === 'copied' ? 'Skopiowano adres' : state === 'error' ? 'Zaznacz adres i skopiuj go ręcznie.' : ''}</span>
  </div>;
}
