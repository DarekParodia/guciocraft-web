'use client';
import { useEffect, useRef, useState } from 'react';

export default function WorldMap({ url }) {
  const container = useRef(null);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setShow(true); observer.disconnect(); } }, { rootMargin: '200px' });
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  return <div className="map-frame" ref={container}>
    <a className="map-link" href={url} target="_blank" rel="noreferrer">Otwórz mapę w nowej karcie ↗</a>
    <div className="map-canvas">
      {loading && <div className="map-placeholder">Wczytywanie mapy…</div>}
      {show && <iframe src={url} title="Interaktywna mapa świata Guciocraft — BlueMap" loading="lazy" referrerPolicy="no-referrer" onLoad={() => setLoading(false)} onError={() => setLoading(true)} />}
    </div>
  </div>;
}
