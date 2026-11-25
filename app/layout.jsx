import './globals.css';
import { site } from '../config/site.mjs';

export const metadata = {
  title: 'Guciocraft — serwer Minecraft z Create',
  description: 'Spokojny serwer Minecraft z Create. Dołącz do whitelisty, pobierz paczkę, sprawdź mapę świata i spotkaj nas na Discordzie.',
  robots: { index: true, follow: true },
};
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#111211' };

export default function RootLayout({ children }) {
  return <html lang="pl"><body style={{ '--world-background': `url("${site.background.image}")` }}><a className="skip-link" href="#tresc">Przejdź do treści</a>{children}</body></html>;
}
