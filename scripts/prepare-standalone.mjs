import { cp, mkdir } from 'node:fs/promises';
await mkdir('.next/standalone/.next/cache', { recursive: true });
await cp('public', '.next/standalone/public', { recursive: true });
await cp('.next/static', '.next/standalone/.next/static', { recursive: true });
console.log('Standalone: zasoby public i .next/static przygotowane.');
