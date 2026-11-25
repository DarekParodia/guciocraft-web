import { site } from '../config/site.mjs';
import { getSettings } from '../lib/settings.mjs';
import { downloadAvailable } from '../lib/downloads.mjs';
import CopyAddress from '../components/CopyAddress';
import ServerStatus from '../components/ServerStatus';
import WhitelistForm from '../components/WhitelistForm';
import InstallGuide from '../components/InstallGuide';
import WorldMap from '../components/WorldMap';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function Page() {
  const settings = getSettings();
  const [portableAvailable, modpackAvailable] = await Promise.all(
    ['portable', 'modpack'].map(kind => downloadAvailable(kind, settings.downloads)),
  );
  const pack = site.modpack;
  const packDetails = [
    pack.version && `Paczka ${pack.version}`,
    pack.ramGiB && `${pack.ramGiB} GB RAM dla gry`,
    pack.systemRamGiB && `${pack.systemRamGiB} GB RAM w komputerze`,
  ].filter(Boolean);

  return <main id="tresc" className="page">
    <header className="site-header">
      <h1>{site.name}<span>.</span></h1>
      <a href={site.discord} target="_blank" rel="noreferrer">Discord ↗</a>
    </header>

    <section id="dolacz" className="join" aria-label="Dołącz do serwera">
      <p className="intro">Spokojny serwer Minecraft z Create. Wpisz nick i dołącz.</p>
      <WhitelistForm enabled={settings.whitelistEnabled} />
      <div className="server-info">
        <CopyAddress address={site.address} />
        <ServerStatus />
      </div>
    </section>

    <section id="instalacja" className="section" aria-labelledby="install-heading">
      <h2 id="install-heading">Pobierz i zagraj</h2>
      <p>Gotowy Prism Launcher z naszą paczką dla Windows.</p>
      <InstallGuide portableAvailable={portableAvailable} modpackAvailable={modpackAvailable} ramGiB={pack.ramGiB} address={site.address} />
      {packDetails.length > 0 && <p className="pack-details">{packDetails.join(' · ')}</p>}
    </section>

    <section id="mapa" className="section" aria-labelledby="map-heading">
      <h2 id="map-heading">Mapa świata</h2>
      <WorldMap url={site.map} />
    </section>

    <footer className="footer">
      <p>Potrzebujesz pomocy? <a href={site.discord} target="_blank" rel="noreferrer">Napisz na Discordzie ↗</a></p>
      <small>Nieoficjalny serwer Minecraft. Bez powiązania z Mojang i Microsoft. Tło: <a href={site.background.source} target="_blank" rel="noreferrer">Steam ’n’ Rails ↗</a></small>
    </footer>
  </main>;
}
