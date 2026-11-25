# Guciocraft

Polska strona one page serwera Minecraft Create. Next.js App Router i React, zwykły CSS, API whitelisty przez RCON, status Minecraft Server List Ping i trwałe limity w SQLite. Konfiguracja i pliki pobierania są lokalne; aplikacja nie wymaga dodatkowego serwera bazy danych.

**Pełna instrukcja od pustego LXC do działającej strony: [docs/KONFIGURACJA.md](docs/KONFIGURACJA.md).**

## Uruchomienie

Wymagany Node.js **24 lub nowszy** (SQLite przez `node:sqlite`).

```sh
npm install
cp .env.example .env.local
npm run dev
```

Otwórz `http://127.0.0.1:3000`. Whitelista domyślnie jest wyłączona. Wersje docelowe zależności są w `package.json`; po instalacji zachowaj wygenerowany `package-lock.json` i przy kolejnych wdrożeniach używaj `npm ci`.

```sh
npm test
npm run build
npm start
```

## Dane i paczki

- `config/site.mjs`: adresy, publiczne informacje o własnej paczce, zalecana pamięć i nazwy plików. Nieuzupełnione informacje o wersji i RAM są ukrywane. Po zmianach przebuduj aplikację.
- `downloads/guciocraft-modpack.zip`: zgodny ZIP instancji/modpacka do importu w Prism; nie sam folder `mods` i nie serverpack.
- `downloads/guciocraft-prism-windows.zip`: gotowy, wypakowywany zestaw portable Prism dla Windows. Przygotuj czystą kopię bez zapisanych kont i tokenów. Każdy gracz dodaje swoje konto.
- `DOWNLOAD_DIR` pozwala trzymać paczki poza kodem. Pliki należy publikować atomowo: zapisz pod tymczasową nazwą i dopiero potem zmień nazwę na docelową. Archiwa puste, brakujące lub będące symlinkiem nie są udostępniane.
- Wersja własnej paczki i RAM są celowo do uzupełnienia po sprawdzeniu twojej konfiguracji. Portable jest dla Windows; import do Prism opisany również dla Linux/macOS.

Przyciski pobierania aktywują się, gdy odpowiednie pliki istnieją. Archiwa są strumieniowane, bez ładowania całego ZIP-a do pamięci. Po podmianie paczek odśwież stronę. Endpointy nie przyjmują ścieżek od gracza.

## Whitelista

W środowisku serwera ustaw:

```dotenv
SITE_ORIGIN=https://twoja-domena.pl
CLIENT_IP_HEADER=x-real-ip
WHITELIST_ENABLED=true
RCON_HOST=prywatny-adres-serwera-minecraft
RCON_PORT=25575
RCON_PASSWORD=unikalne-losowe-haslo-minimum-24-znaki
DATABASE_PATH=/var/lib/guciocraft/guciocraft.sqlite
DOWNLOAD_DIR=/var/lib/guciocraft/downloads
```

Na serwerze Minecraft włącz RCON i whitelistę w `server.properties` oraz ustaw to samo hasło. Hasło wygeneruj np. `openssl rand -hex 32`. `RCON_HOST` jest adresem widocznym **z LXC aplikacji**; `127.0.0.1` działa tylko, jeśli Minecraft działa w tej samej przestrzeni sieciowej. Nigdy nie wpisuj sekretów do `config/site.mjs`, `NEXT_PUBLIC_*` ani repozytorium.

### Granica zaufania proxy

Next.js wiążemy do `127.0.0.1`; publiczny ruch dociera wyłącznie przez Nginx, który **nadpisuje** `X-Real-IP` własną wartością `$remote_addr`. API ignoruje `X-Forwarded-For`. Bez nagłówka poprawnego IP zapis kończy się 503. Samo ustawienie `CLIENT_IP_HEADER` nie wystarcza, jeśli ktoś może ominąć Nginx i połączyć się bezpośrednio z Node.

Jeżeli przed Nginx masz Cloudflare/inny reverse proxy, skonfiguruj zaufane adresy `set_real_ip_from` i właściwy `real_ip_header` w Nginx. Bez tego wszyscy gracze będą współdzielili limit proxy. Nie ufaj dowolnym adresom z internetu. Dla IPv6 limit łączy adresy z tego samego prefiksu /64, a IPv4-mapped IPv6 są normalizowane.

### Zabezpieczenia

- Pełna walidacja ASCII 3–16 znaków: litery, cyfry i `_`; odrzucanie białych znaków, Unicode, NUL, dodatkowych pól i treści JSON >512 B.
- Stała operacja `whitelist add <nick>` przez TCP. Brak shella i publicznego endpointu wykonywania dowolnych komend. Brak `op`, usuwania banów i zmian konfiguracji.
- Ślizgowe limity w SQLite: 10 prób/min/IP (także błędnych), 5 operacji/h/IP, 1 operacja/min/nick, 20 operacji/min łącznie. Rezerwacja atomowa przed połączeniem RCON. Nieudana operacja też zużywa budżet.
- Dwa jednoczesne połączenia RCON, 3 s timeout całej operacji, ograniczona długość pakietów i sprawdzanie ID odpowiedzi. Nie ma nieograniczonej kolejki; zajęta usługa zwraca 503.
- Limitowane operacje i krótki log przetrwają restart. Klucze IP/nicków limitera to HMAC z kluczem zachowanym w bazie, bez surowego IP. Zdarzenia limitera są usuwane po 24 h, log nick/wynik po 7 dniach przy kolejnym zgłoszeniu.
- Wymagany dokładny `Origin`, tylko JSON i brak CORS dla innych stron. To ochrona przeglądarkowa, nie uwierzytelnienie i nie ochrona przed skryptem udającym przeglądarkę.
- API zwraca sukces tylko przy rozpoznanym potwierdzeniu RCON (dodanie albo istniejący wpis). Nierozpoznany tekst, brak profilu, błędne hasło i timeout dają stan niepotwierdzony, bez surowej konsoli i sekretów w odpowiedzi.

RCON jest nieszyfrowany i daje szerokie uprawnienia konsoli. Firewall serwera Minecraft powinien dopuszczać port RCON **wyłącznie z adresu backendu**. Między niezaufanymi sieciami użyj VPN/tunelu. Kod ogranicza wykonywane operacje, ale standardowy RCON nie ma osobnego konta z uprawnieniami tylko do whitelisty.

Formularz jest **publicznym samodzielnym zapisem**: każdy może dodać dowolny poprawny nick. Nie potwierdza, kto jest jego właścicielem. Usunięty z whitelisty nick może zostać dodany ponownie; ban nadal obowiązuje. Limity IP nie powstrzymują ataku z wielu adresów — przy takim ruchu potrzebna będzie dodatkowa ochrona na proxy lub weryfikacja bota.

## Status i mapa

Status korzysta z osobnego protokołu Server List Ping, nie z RCON. Współdzieli trwający odczyt i buforuje wynik 30 s; nie publikuje listy nicków. Odmowa połączenia oznacza offline, a timeout/błąd DNS stan nieznany. Dla serwera z rekordem SRV lub nietypowym portem wpisz rzeczywisty host i port w `MC_HOST`/`MC_PORT` — automatyczne rozwiązywanie SRV nie jest zaimplementowane.

BlueMap `https://mcmap.bshomelab.cc` ładuje się dopiero w pobliżu sekcji mapy. Host BlueMap musi pozwalać na osadzenie na domenie strony (CSP `frame-ancestors`, X-Frame-Options). Stały link otwiera pełną mapę w nowej karcie. Przeglądarka nie pozwala niezawodnie wykryć wszystkich błędów obcego iframe, dlatego link jest dostępny zawsze.

## Wdrożenie w LXC

Przykład dla Debiana/Ubuntu z zainstalowanym Node.js >=24, Nginx i systemd:

1. Umieść kod w `/opt/guciocraft`. Wykonaj `npm install` (lub `npm ci` po utworzeniu lockfile), `npm test` i `npm run build`.
2. Dla `output: standalone` skopiuj zasoby do katalogu standalone:

   ```sh
   cp -r public .next/standalone/
   mkdir -p .next/standalone/.next/cache
   cp -r .next/static .next/standalone/.next/
   ```

3. Utwórz użytkownika systemowego i katalog danych:

   ```sh
   useradd --system --home /var/lib/guciocraft --shell /usr/sbin/nologin guciocraft
   install -d -o guciocraft -g guciocraft /var/lib/guciocraft/downloads
   chown -R guciocraft:guciocraft .next/standalone/.next/cache
   cp .env.example /etc/guciocraft.env
   chmod 600 /etc/guciocraft.env
   ```

4. Uzupełnij `/etc/guciocraft.env` (ścieżki absolutne jak wyżej), domenę w `deploy/nginx.conf` i ścieżkę do Node w usłudze, jeśli nie jest `/usr/bin/node`.
5. Skopiuj `deploy/guciocraft.service` do `/etc/systemd/system/`, a konfigurację Nginx do `/etc/nginx/conf.d/guciocraft.conf`. Włącz HTTPS dla swojej domeny, np. na istniejącym reverse proxy; podany plik nie instaluje certyfikatów. Jeśli terminujesz TLS przed tym Nginx, utrzymuj prawidłowy publiczny `SITE_ORIGIN`.
6. Sprawdź i uruchom:

   ```sh
   nginx -t
   systemctl daemon-reload
   systemctl enable --now guciocraft
   systemctl reload nginx
   journalctl -u guciocraft -n 50
   ```

7. Sprawdź stronę, pobrania, status i rzeczywisty zapis przez **publiczny adres HTTPS**. Próba podania fałszywego `X-Real-IP` przez publiczny adres musi być nadpisana przez proxy. Sprawdź, że port 3000 i RCON są niedostępne z internetu. Po tych kontrolach włącz `WHITELIST_ENABLED=true` i zrestartuj usługę.

Backupuj katalog danych SQLite wraz z WAL/SHM w spójny sposób (np. mechanizmem backup SQLite), a nie sam plik działającej bazy. Aktualizacja aplikacji nie powinna usuwać `/var/lib/guciocraft`.

## Materiały i weryfikacja

Strona ma jedną kolumnę: formularz whitelisty na początku, pobranie Windows i trzy kroki instalacji, rozwijana instrukcja importu oraz mapa. Dane o wersji i RAM pojawiają się tylko po uzupełnieniu konfiguracji. Kontakt jest prostym linkiem do Discorda.

Instrukcja importu oparta na [dokumentacji Prism](https://prismlauncher.org/wiki/getting-started/download-modpacks/), a ustawienia Javy na [instrukcji producenta](https://prismlauncher.org/wiki/getting-started/installing-java/).

Testy obejmują walidację, proxy i Origin, trwałość i atomowość limitów, limity równoległości, pobrania, parsowanie fragmentów pakietów i stany błędów. Testy lokalnych serwerów TCP są automatycznie pomijane wyłącznie, gdy sandbox odmawia otwarcia portu; parsery mają wtedy osobne testy transportu. Nie testowano produkcyjnego RCON ani prywatnej mapy właściciela.

W środowisku implementacji terminal nie miał dostępu do DNS/rejestru npm ani możliwości otwierania portów. Build i test produkcyjnego SSR (`npm run smoke`) wykonano przy użyciu lokalnie dostępnych kopii **Next.js 16.3.8 oraz React/React DOM 19.2.4**. Manifest celuje w nowsze **Next.js ^16.4.6 oraz React ^19.3.1**. Przed wdrożeniem wykonaj instalację docelowych zależności, zachowaj lockfile i ponów testy/build. Podgląd interaktywny w Chromium był blokowany przez sandbox; statyczny SSR znajduje się po smoke teście w `test-results/preview.html`.
