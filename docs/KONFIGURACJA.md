# Konfiguracja Guciocraft — od plików do działającej strony

Instrukcja dotyczy całej strony: Next.js, pobrań, statusu, mapy BlueMap, formularza whitelisty i uruchomienia w LXC na Proxmox. Nie wymaga panelu administracyjnego. Zmiany wykonujesz w plikach.

## 1. Jak to będzie połączone

```text
Gracz → HTTPS / publiczna domena → Nginx → Next.js na 127.0.0.1:3000
                                             ├── lokalne ZIP-y
                                             ├── lokalna baza SQLite
                                             ├── Minecraft: port gry (status)
                                             └── Minecraft: prywatny port RCON (whitelista)

Przeglądarka gracza → https://mcmap.bshomelab.cc (osadzony BlueMap)
```

Możesz zakończyć HTTPS na istniejącym domowym reverse proxy. Wtedy kieruj ruch do **Nginx w LXC na porcie 80**, nie bezpośrednio do Node na 3000. Jeśli nie masz zewnętrznego proxy, skonfiguruj HTTPS na Nginx w LXC. Sam certyfikat strony nie szyfruje RCON.

Przygotuj:

- docelową domenę strony; nie musi być taka sama jak adres serwera gry;
- LXC z Node.js 24 lub nowszym, Nginx i systemd;
- prywatny adres Minecrafta widoczny z LXC oraz port RCON;
- dwa ZIP-y: import modpacka i gotowy Prism portable dla Windows;
- dostęp do ustawień serwera Minecraft i proxy BlueMap.

## 2. Przygotuj LXC i pliki aplikacji

W LXC z Debianem/Ubuntu zainstaluj podstawowe narzędzia:

```sh
apt update
apt install -y nginx ca-certificates curl openssl
```

Zainstaluj Node.js **24 lub nowszy**, korzystając z [oficjalnych instrukcji Node.js](https://nodejs.org/en/download). Stara wersja Node z repozytorium systemu może nie obsługiwać `node:sqlite`.

```sh
node --version
npm --version
command -v node
```

Umieść ten projekt w `/opt/guciocraft`, bez kopiowania cudzych `node_modules`, `.next`, `.env.local` i plików bazy. Dalej wykonuj polecenia z tego katalogu:

```sh
cd /opt/guciocraft
npm install
```

Pierwsza instalacja tworzy `package-lock.json`. Zachowaj go w repozytorium. Przy kolejnych wdrożeniach z tym samym lockfile używaj `npm ci`. Wersje Next i React zadeklarowane w `package.json` powinny być instalowane i testowane na maszynie z dostępem do npm.

## 3. Uzupełnij publiczne dane strony

Edytuj `config/site.mjs`. Ten plik może być w repozytorium, bo zawiera wyłącznie publiczne informacje.

| Pole | Znaczenie |
| --- | --- |
| `name` | Nazwa wyświetlana na początku strony. |
| `address` | Adres wpisywany w Minecraft: obecnie `mc.bshomelab.cc`. |
| `discord` | Zaproszenie Discord: obecnie `https://discord.gg/A8qsssD8VQ`. |
| `map` | Pełny adres HTTPS BlueMap. |
| `background.image` | Screen w tle: adres CDN albo własny plik, np. `/images/tlo.webp` umieszczony w `public/images/`. |
| `background.source` | Link do źródła screena, wyświetlany w stopce. |
| `modpack.version` | Własna nazwa lub numer wydania paczki. `null` ukrywa tę informację. |
| `modpack.ramGiB` | Ile GB przydzielić **samej grze** w Prism; wpływa też na instrukcję. |
| `modpack.systemRamGiB` | Zalecana całkowita pamięć komputera gracza. |
| `downloads.modpack` | Nazwa ZIP-a do importu, bez ścieżki. |
| `downloads.portable` | Nazwa ZIP-a z gotowym Prism dla Windows, bez ścieżki. |

Nie wpisuj wymagań RAM na podstawie pamięci przydzielonej serwerowi. Sprawdź je po stronie gracza na swojej paczce. Wartość `null` ukrywa tę informację w skrócie wymagań pod instrukcją.

Wygląd jest celowo prosty: formularz na górze, potem pobranie, krótka instrukcja i mapa. Treść znajduje się w `app/page.jsx` i `components/InstallGuide.jsx`, a style w `app/globals.css`. Nie wpisuj do konfiguracji publicznej haseł ani adresu administracyjnego RCON.

Tło korzysta ze screena z galerii Steam ’n’ Rails, z rozmyciem i ciemnym przejściem do środka. Siłę rozmycia i przyciemnienia zmienisz w `body::before` i `body::after` w CSS. Własny screen można umieścić w `public/images/` i zmienić `background.image`. Dla innego zewnętrznego hosta obrazu uzupełnij również `img-src` w `next.config.mjs`.

Po zmianach tego pliku wykonaj ponownie build i restart usługi. Po zmianie domeny BlueMap zmień także `frame-src` w `next.config.mjs`.

## 4. Przygotuj katalog danych i konto systemowe

```sh
useradd --system --home /var/lib/guciocraft --shell /usr/sbin/nologin guciocraft
install -d -o guciocraft -g guciocraft /var/lib/guciocraft/downloads
cp .env.example /etc/guciocraft.env
chmod 600 /etc/guciocraft.env
```

Konto tworzysz tylko raz. SQLite utworzy bazę przy pierwszym zgłoszeniu, jeśli whitelista jest włączona. Nie udostępniaj katalogu `/var/lib/guciocraft` jako katalogu statycznego Nginx.

W `/etc/guciocraft.env` ustaw:

```dotenv
SITE_ORIGIN=https://twoja-domena.pl
CLIENT_IP_HEADER=x-real-ip
WHITELIST_ENABLED=false
RCON_HOST=10.0.0.20
RCON_PORT=25575
RCON_PASSWORD=TU_WSTAW_WLASNE_DLUGIE_LOSOWE_HASLO
MC_HOST=mc.bshomelab.cc
MC_PORT=25565
DATABASE_PATH=/var/lib/guciocraft/guciocraft.sqlite
DOWNLOAD_DIR=/var/lib/guciocraft/downloads
BIND_ADDRESS=127.0.0.1
NEXT_TELEMETRY_DISABLED=1
```

Powyższy adres `10.0.0.20` jest przykładem — zastąp go adresem twojego Minecrafta. Hasło wygeneruj lokalnie, np. `openssl rand -hex 32`, i wpisz to samo do serwera gry. Minimum wymagane przez aplikację to 24 znaki. Nie przesyłaj hasła w adresie URL.

| Zmienna | Jak ustawić |
| --- | --- |
| `SITE_ORIGIN` | Publiczny adres strony: protokół i domena, ewentualnie port. Przy HTTPS wpisz `https://`, nawet jeśli wewnętrzne proxy używa HTTP. |
| `CLIENT_IP_HEADER` | `x-real-ip`, ale dopiero po poprawnym ustawieniu Nginx. Bez tego zapisy nie działają. |
| `WHITELIST_ENABLED` | Na początku `false`, po sprawdzeniu wdrożenia `true`. Wartość musi być dokładnie `true`, aby włączyć zapis. |
| `RCON_HOST` / `RCON_PORT` | Prywatny adres i port RCON. `127.0.0.1` oznacza ten sam LXC, nie host Proxmox ani inny kontener. |
| `RCON_PASSWORD` | Sekret połączenia RCON, tylko po stronie backendu. |
| `MC_HOST` / `MC_PORT` | Rzeczywisty adres i port gry dla Server List Ping. Przy nieudanym pingu aplikacja próbuje odczytać liczniki przez skonfigurowane RCON. |
| `DATABASE_PATH` | Bezwzględna ścieżka bazy na trwałym, zapisywalnym woluminie. |
| `DOWNLOAD_DIR` | Bezwzględna ścieżka katalogu z archiwami. |
| `BIND_ADDRESS` | Zostaw `127.0.0.1`, aby gracze nie mogli ominąć proxy. |
| `NEXT_TELEMETRY_DISABLED` | `1` wyłącza telemetrię Next.js. |

Plik `/etc/guciocraft.env` jest ładowany przez systemd. Do lokalnego `npm run dev`/`npm start` służy osobny `.env.local` w katalogu projektu. Nie zakładaj, że lokalna komenda automatycznie odczyta plik z `/etc/`.

## 5. Umieść dwa archiwa ZIP

W katalogu wskazanym przez `DOWNLOAD_DIR` umieść:

```text
/var/lib/guciocraft/downloads/
├── guciocraft.zip
└── guciocraft-prism-windows.zip
```

Nazwy muszą odpowiadać `config/site.mjs`.

- **Modpack:** zgodny eksport instancji Prism lub inny format paczki obsługiwany przez import Prism. Nie wypakowuje się go przed importem.
- **Portable Windows:** kompletny folder Prism z przygotowaną instancją. Użytkownik wypakowuje archiwum w całości i uruchamia `prismlauncher.exe`.

Przygotuj portable z czystego profilu, bez zalogowanych kont, `accounts.json` z tokenami i prywatnych danych. Instrukcja strony zakłada, że każdy gracz doda swoje konto. Przetestuj archiwum na innym koncie Windows, żeby wykryć zależności od twoich lokalnych ścieżek.

Przyznaj usłudze dostęp do odczytu:

```sh
chown guciocraft:guciocraft /var/lib/guciocraft/downloads/*.zip
chmod 640 /var/lib/guciocraft/downloads/*.zip
```

Brakujący lub pusty plik powoduje nieaktywny przycisk „Plik w przygotowaniu”. Endpoint udostępnia wyłącznie dwa skonfigurowane pliki, bez symlinków. ZIP-y można podmieniać bez buildu; zapisuj nową paczkę pod nazwą tymczasową, a po zakończeniu przenieś na docelową nazwę. Użytkownik odświeża stronę, aby zobaczyć aktualną dostępność.

## 6. Włącz RCON i zainstaluj mod whitelisty

W `server.properties` serwera gry ustaw:

```properties
enable-rcon=true
rcon.port=25575
rcon.password=TO_SAMO_LOSOWE_HASLO_CO_W_APLIKACJI
white-list=true
enable-status=true
```

Mod jest przeznaczony dla serwera **Minecraft 1.21.1, NeoForge 21.1.267, Java 21**, działającego z `online-mode=false`. Zbuduj go poleceniem `gradle -p server-mod build` z JDK 21 i Gradle 9. Plik `server-mod/build/libs/guciocraft-offline-whitelist-1.0.0.jar` wgraj do katalogu `mods/` serwera Minecraft. Zrestartuj serwer gry przed wdrożeniem nowej wersji strony. Gracze mogą korzystać z dotychczasowej paczki.

Mod rejestruje komendę `whitelist-offline add <nick>`. Tworzy profil offline z dosłownie przekazanego nicku i zapisuje go przez mechanizm whitelisty Minecrafta. `tester` i `Tester` mają osobne UUID. Kod strony potwierdza wyłącznie odpowiedź moda zawierającą dokładnie zgłoszony nick. Wcześniej zapisane wpisy pozostają w `whitelist.json`.

Na firewallu Minecrafta/Proxmoxa:

- port gry udostępnij graczom zgodnie z istniejącą konfiguracją;
- port RCON dopuść **tylko z adresu LXC aplikacji**;
- zablokuj dostęp do RCON z internetu i innych niezaufanych urządzeń;
- jeśli ruch idzie przez niezaufaną sieć, użyj VPN/tunelu, bo RCON nie szyfruje hasła i komend.

Nie musisz zmieniać konfiguracji uwierzytelniania graczy. Formularz nigdy nie wykonuje `op` ani nie usuwa banów.

Publiczny zapis oznacza, że każdy odwiedzający może dopisać poprawny nick. Wymazanie kogoś wyłącznie z whitelisty nie blokuje mu ponownego zapisu; do odmowy dostępu służy ban lub późniejsze rozszerzenie polityki zapisów.

## 7. Skonfiguruj domenę i proxy Nginx

Skieruj DNS domeny strony na swój reverse proxy lub publiczny serwer. Skopiuj szablon:

```sh
cp deploy/nginx.conf /etc/nginx/conf.d/guciocraft.conf
```

Zmień `server_name guciocraft.example.com;` na rzeczywistą domenę. Plik ma strefy limitów wymagające kontekstu `http`; standardowe `/etc/nginx/conf.d/*.conf` w Debianie/Ubuntu jest w tym kontekście.

Szablon:

- kieruje ruch do `127.0.0.1:3000`;
- **nadpisuje** `X-Real-IP` i `X-Forwarded-For` adresem ustalonym przez Nginx;
- limituje formularz i odczyty statusu;
- ogranicza rozmiar body do 512 B;
- strumieniuje pobrania i ogranicza równoległe pobrania z jednego IP.

Jeśli przed tym Nginx stoi drugi reverse proxy, skonfiguruj rzeczywiste IP. Przykład dla **jednego zaufanego proxy** (adres dokumentacyjny, zastąp własnym):

```nginx
set_real_ip_from 192.0.2.10;
real_ip_header X-Forwarded-For;
real_ip_recursive on;
```

Ten upstream musi prawidłowo ustawiać nagłówek klienta. Nie wpisuj `0.0.0.0/0` ani wszystkich sieci jako zaufanych. Przy Cloudflare zastosuj ich aktualną listę zaufanych adresów i właściwy nagłówek zgodnie z dokumentacją dostawcy.

Jeżeli HTTPS kończy się na zewnętrznym proxy, jego celem jest port 80 Nginx z tego pliku. Jeżeli kończy się w tym LXC, dodaj certyfikat i przekierowanie HTTP→HTTPS, np. przy użyciu Certbota. Zadbaj o automatyczne odnawianie certyfikatu.

```sh
nginx -t
```

Oczekiwany wynik: konfiguracja poprawna. Nie uruchamiaj strony publicznie z niepoprawną granicą zaufania IP.

## 8. Zbuduj i uruchom usługę

```sh
cd /opt/guciocraft
npm test
npm run build
chown -R guciocraft:guciocraft .next/standalone/.next/cache
cp deploy/guciocraft.service /etc/systemd/system/guciocraft.service
systemctl daemon-reload
systemctl enable --now guciocraft
systemctl reload nginx
```

Build przygotowuje katalog standalone i automatycznie kopiuje `public` oraz `.next/static`. Nie pomijaj skryptu przygotowującego zasoby, jeśli uruchamiasz samo `next build` ręcznie. Usługa startuje przez `scripts/start.mjs`, który ustala ścieżki danych przed zmianą katalogu roboczego przez Next.js.

Jeśli `command -v node` pokazało inną ścieżkę niż `/usr/bin/node`, zmień `ExecStart` w usłudze. Użytkownik systemowy musi mieć możliwość odczytu kodu w `/opt/guciocraft`.

```sh
systemctl status guciocraft
journalctl -u guciocraft -n 50 --no-pager
```

W niektórych konfiguracjach nieuprzywilejowanego LXC ograniczenia namespace/systemd mogą uniemożliwiać użycie `PrivateTmp` lub innych ustawień izolacji. W takim przypadku sprawdź konkretny błąd w dzienniku i ustawienia kontenera; nie uruchamiaj całej aplikacji jako root w celu obejścia problemu.

## 9. Podłącz mapę

Otwórz `https://mcmap.bshomelab.cc` bezpośrednio w przeglądarce. Musi działać przez HTTPS z poprawnym certyfikatem.

Na proxy obsługującym BlueMap sprawdź:

- `Content-Security-Policy: frame-ancestors` musi zezwalać na publiczny origin strony;
- `X-Frame-Options: DENY` albo `SAMEORIGIN` uniemożliwi osadzenie pod inną domeną;
- jeśli mapa wymaga logowania, sprawdź, czy mechanizm logowania działa w iframe.

Nie zmieniaj globalnie polityki osadzania wszystkich usług w homelabie — zmiana dotyczy wyłącznie BlueMap. Przycisk otwarcia osobno działa niezależnie od embedu.

## 10. Sprawdź całość i włącz zapisy

Otwórz publiczny adres HTTPS w zwykłej przeglądarce oraz na telefonie.

1. Strona ma style i przyciski, formularz jest od razu widoczny, a dodatkowa instrukcja importu rozwija się po kliknięciu; konsola przeglądarki nie pokazuje brakujących plików JS/CSS.
2. Adres serwera kopiuje się, a Discord otwiera właściwe zaproszenie.
3. Oba ZIP-y pobierają się i dają się użyć zgodnie z instrukcją na innym komputerze.
4. Status pokazuje rzeczywiste dane; `MC_HOST` i port nie wskazują RCON. Przy niestandardowym porcie/rekordzie SRV wpisz rzeczywisty host i port — aplikacja nie rozwiązuje SRV automatycznie.
5. BlueMap działa wewnątrz strony i w nowej karcie.
6. Port 3000 Next.js oraz port RCON nie są dostępne z internetu.
7. Przy poprawnej konfiguracji proxy ustaw `WHITELIST_ENABLED=true` w `/etc/guciocraft.env` i wykonaj `systemctl restart guciocraft`.
8. Dodaj `tester` przez publiczną stronę. Sprawdź, czy `whitelist.json` ma pole `name` równe `tester` i `uuid` równy `dd823a0c-b94a-369f-acd6-ddd287e3180e`. Następnie połącz się w grze jako `tester`.
9. Sprawdź błędny nick i ponowny zapis tego samego nicku. Błąd nie może być przedstawiony jako sukces, a szybkie ponowienia powinny dostać limit z czasem oczekiwania.

Po każdej zmianie `.env` zrestartuj usługę. Zmiana `.env` nie wymaga buildu. Zmiana kodu, CSS, `config/site.mjs` lub `next.config.mjs` wymaga buildu i restartu.

## 11. Utrzymanie, aktualizacje i backup

**Nowy modpack:** opublikuj ZIP-y, zaktualizuj publiczny numer paczki i RAM, jeśli się zmienił, wykonaj build/restart. Gracze instalują paczkę od nowa jako osobną instancję. Zachowują własne światy i ustawienia ze starej instalacji według potrzeb.

**Nowy kod strony:** po wykonaniu kopii danych zatrzymaj usługę na czas przebudowy w tym samym katalogu, zaktualizuj kod, wykonaj `npm ci`, testy i build, nadaj prawa do cache i uruchom usługę. Przy potrzebie aktualizacji bez przerwy użyj osobnych katalogów kolejnych wydań.

**Backup:** przechowuj konfigurację `/etc/guciocraft.env` w bezpiecznym miejscu, ZIP-y i spójną kopię SQLite. Dla prostej kopii przy zatrzymanej aplikacji zatrzymaj usługę, skopiuj cały katalog `/var/lib/guciocraft` (wraz z ewentualnymi plikami `-wal`/`-shm`) i uruchom usługę. Nie publikuj kopii bazy ani `.env` przez WWW. Przywrócenie bazy zachowuje dotychczasowe limity.

**Zmiana limitów:** reguły aplikacji są w `lib/whitelist.mjs`; limit równoległych połączeń również tam, a timeout RCON w `lib/settings.mjs`. Po zmianach uruchom testy, build i restart. Limity przed aplikacją są dodatkowo w `deploy/nginx.conf`; po ich zmianie wykonaj `nginx -t` i reload. Ograniczenie 10 prób/min/IP obejmuje także błędne nicki. Nicki mają limit niezależny od wielkości liter.

## 12. Najczęstsze problemy

| Objaw | Co sprawdzić |
| --- | --- |
| Formularz jest wyłączony | `WHITELIST_ENABLED`, publiczny `SITE_ORIGIN`, `CLIENT_IP_HEADER`, host/port RCON i hasło minimum 24 znaki; restart usługi. |
| Zapis zwraca 403 | Publiczny protokół/domena nie zgadza się z `SITE_ORIGIN`, brak Origin lub żądanie z innej strony. |
| Zapis zwraca 429 | Limity IP, nicku lub globalne. `Retry-After` podaje czas oczekiwania. Zweryfikuj rzeczywiste IP za proxy. |
| Zapis zwraca 503 | Sprawdź, czy mod jest załadowany na serwerze z `online-mode=false`, czy odpowiada RCON i czy serwer może zapisać `whitelist.json`. Sprawdź też dzienniki Minecrafta i systemd pod kątem problemów z proxy, konfiguracją i bazą SQLite. |
| Pobranie jest nieaktywne | Nazwa i katalog ZIP, niezerowy rozmiar, prawa odczytu oraz brak symlinka. |
| Status jest niedostępny | Sprawdź `enable-status`, `MC_HOST`, `MC_PORT` i dostęp do portu gry z LXC aplikacji. Jeżeli publiczny adres działa spoza sieci, a LXC nie może się z nim połączyć, ustaw `MC_HOST` na prywatny adres serwera Minecraft dostępny z LXC. |
| Wszyscy trafiają na wspólny limit | Nginx widzi tylko adres zewnętrznego proxy. Ustaw zaufane rzeczywiste IP dla konkretnego upstreamu. |
| Brak CSS/JS po wdrożeniu | Uruchom pełne `npm run build`; sprawdź `.next/standalone/.next/static` i konfigurację proxy. |
| Baza lub paczki „zniknęły” po restarcie | Użyj bezwzględnych ścieżek; startuj przez dołączony wrapper/usługę. |
| Błąd zapisu SQLite | Właściciel katalogu, zapisywalny wolumin, wolne miejsce i `ReadWritePaths` w usłudze. |
| BlueMap działa osobno, ale embed jest pusty | Nagłówki CSP/X-Frame-Options po stronie mapy oraz poprawne HTTPS. |

Weryfikację kodu wykonuj `npm test`, build przez `npm run build`, a test produkcyjnego renderowania bez otwierania portu przez `npm run smoke`. Szczegóły ograniczeń testowania w środowisku implementacji znajdują się na końcu `README.md`.
