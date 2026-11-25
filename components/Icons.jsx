export function Icon({ name, size = 18, ...props }) {
  const paths = {
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    right: <><path d="M4 12h16m-6-6 6 6-6 6" /></>,
    down: <><path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4" /></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V4H4v12h4" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15" /></>,
    gear: <><path d="m9 3-.7 3-2 .9-2.7-.8-2 3.5L4 12l-2.4 2.4 2 3.5 2.7-.8 2 .9.7 3h6l.7-3 2-.9 2.7.8 2-3.5L20 12l2.4-2.4-2-3.5-2.7.8-2-.9L15 3H9Z" /><circle cx="12" cy="12" r="3" /></>,
    windows: <><path d="m3 5 8-1v8H3V5Zm10-1 8-1v9h-8V4ZM3 14h8v7l-8-1v-6Zm10 0h8v8l-8-1v-7Z" /></>,
    box: <><path d="m12 3 9 5-9 5-9-5 9-5Zm9 5v10l-9 5-9-5V8m9 5v10m-4-17 9 5" /></>,
    chat: <><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 4V6a2 2 0 0 1 2-2Z" /><path d="M7 9h10M7 13h7" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] ?? paths.arrow}</svg>;
}
