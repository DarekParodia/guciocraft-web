# Guciocraft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uruchamialna strona Next.js z instrukcją Prism, pobraniami, mapą, statusem i bezpiecznym zapisem RCON.

**Architecture:** Next.js App Router z komponentami serwerowymi i małymi komponentami interaktywnymi. Route Handlers używają modułów Node.js; SQLite utrwala limity, TCP obsługuje RCON i status. Konfiguracja nie ujawnia sekretów przeglądarce.

**Tech Stack:** Next.js 16, React 19, Node.js >=24, node:sqlite, CSS, node:test.

**Spec:** `docs/superpowers/specs/2026-11-25-guciocraft-design.md`

## Global Constraints

- Wyłącznie język polski; portable tylko Windows.
- Serwer `mc.bshomelab.cc`, mapa `https://mcmap.bshomelab.cc`, Discord `https://discord.gg/A8qsssD8VQ`.
- Nick ASCII `[A-Za-z0-9_]`, 3–16 znaków, dopasowanie całego wejścia.
- 10 prób/min/IP; 5 operacji/h/IP; 1 operacja/min/nick; 20 operacji/min globalnie.
- Bez połączeń do produkcyjnego RCON, bez sekretów klienta, bez shella.
- Brak ZIP i danych RCON ma widoczny stan niedostępności, bez pozorowanych sukcesów.

## Review Focus

1. Nick zakończony newline, Unicode, NUL i dodatkowe pola JSON: odrzucenie przed RCON.
2. Fałszywy X-Forwarded-For, brak Origin, restart i równoległe zapisy: brak obejścia limitów.
3. Fragmenty pakietów TCP, odmowa logowania i timeout: brak fałszywego sukcesu i wycieku sekretów.
4. Brak ZIP, próby path traversal i duże pliki: kontrolowana odpowiedź i strumieniowanie.
5. Niedostępny status/mapa, mobile i reduced motion: czytelne stany i działająca nawigacja.

## Pliki i interfejsy

- `app/`: layout, strona, CSS, endpointy whitelist/status/downloads.
- `components/`: formularz, kopiowanie, instrukcje, mapa, status, ASCII.
- `config/site.mjs`: publiczne dane, opcjonalna wersja i RAM.
- `lib/security.mjs`: walidacja nicku, bounded JSON, IP i Origin.
- `lib/store.mjs`: `RateStore(path)`, `consume(rules, now)`, `audit(...)`.
- `lib/rcon.mjs`: `addToWhitelist(nickname, options)` — jedyna publiczna operacja RCON.
- `lib/status.mjs`: `getStatus(options)` — buforowany Server List Ping.
- `lib/whitelist.mjs`: `createWhitelistHandler(deps)` -> `(Request) => Promise<Response>`.
- `lib/downloads.mjs`: `download(kind, request, settings)`.
- `tests/`: testy bezpieczeństwa, trwałości, rzeczywiste lokalne serwery TCP, API i pobrania.
- `deploy/`, `.env.example`, `README.md`: wdrożenie i konfiguracja.

### Task 1: Bezpieczeństwo i trwałe limity

- [x] Napisać testy dla poprawnych nicków, newline/Unicode/whitespace, JSON >512 B, złego Origin i fałszywego nagłówka proxy. Uruchomić i potwierdzić RED.
- [x] Dodać `security.mjs` i `store.mjs`; sprawdzić wszystkie limity, atomowość i odtworzenie bazy po restarcie.
- [x] Uruchomić testy bezpieczeństwa i trwałości; PASS. Dodano `--test-isolation=none` dla czytelnych wyników w sandboxie.

### Task 2: RCON, status i API

- [x] Napisać testy z lokalnym serwerem TCP: autoryzacja, dokładna komenda, fragmentacja, niezgodny ID, odmowa i timeout. Potwierdzić RED.
- [x] Dodać `addToWhitelist`, ping Minecraft i `createWhitelistHandler`. API sprawdza Origin, IP, próbę, JSON, konfigurację, limity operacji i dopiero RCON.
- [x] Sprawdzić, że nieznana odpowiedź i błędne dane nie dają sukcesu, stan bez konfiguracji daje 503, a nadmiar 429 + Retry-After.
- [x] Uruchomić `npm test`; parsery i API PASS, 5 testów TCP pomijanych przy wykrytym EPERM.

### Task 3: One page i pobrania

- [x] Dodać testy pobrań: brak pliku, nieznany rodzaj, plik spoza katalogu, poprawne bajty archiwum. Potwierdzić RED.
- [x] Zbudować App Router: sekcje start/dołącz/instalacja/mapa/pomoc, dostępne komponenty interaktywne, prawdziwe stany API i pobrań.
- [x] Dodać responsywny CSS, ilustracje modów z atrybucją i lazy loading mapy; obsłużyć prefers-reduced-motion.
- [x] Uruchomić `npm test`, `npm run build`; produkcyjny SSR sprawdzony przez `npm run smoke`. Chromium zablokowany przez sandbox; desktop/mobile wymagają kontroli poza nim.

### Task 4: Wdrożenie i przegląd

- [x] Dodać `.env.example`, `README.md`, pełne `docs/KONFIGURACJA.md`, Nginx i systemd; określić katalog ZIP i SQLite oraz zaufany nagłówek IP.
- [x] Uruchomić pełne testy, build i smoke test strony/API; sprawdzić brak sekretów w HTML i obecność zasobów standalone.
- [x] Wykonać niezależny przegląd bezpieczeństwa, poprawić ważne ustalenia i ponownie zweryfikować odpowiednie testy.
- [x] Podać gotowe komendy uruchomienia i rzeczywiste ograniczenia weryfikacji w dokumentacji.

## Dziennik wykonania

- Plan i specyfikacja odzwierciedlają polecenie: rozpisać plan i od razu implementować; bez dodatkowej rundy akceptacji.
- Brak repozytorium Git (widoczny `.git` jest pustym katalogiem tylko do odczytu). Prace w bieżącym pustym katalogu, bez tworzenia worktree i commitów.
- Rejestr npm i CDN są niedostępne z terminala (DNS). Możliwe użycie odczytanych lokalnych zależności wyłącznie do weryfikacji; wersje docelowe i ograniczenia zostaną udokumentowane.
- Task 1: complete — testy walidacji, Origin/IP i trwałości SQLite przechodzą.
- Task 2: complete — testy parserów i handlera przechodzą; testy prawdziwych socketów zachowano z automatycznym skip przy EPERM, co jawnie ogranicza weryfikację transportu.
- Task 3: complete — build i produkcyjny render bez portu przechodzą. Przeglądarkowy podgląd nie był dostępny (Chromium: setsockopt EPERM); statyczny artefakt SSR jest w `test-results/preview.html`.
- Task 4: complete — niezależny reviewer nie znalazł dodatkowych ważnych usterek bezpieczeństwa. Poprawiono domknięcie timeoutu JSON oraz ścieżki i kopiowanie zasobów standalone; regresje zweryfikowano.
- Ruling: Zależności użyte offline do weryfikacji to Next 16.3.8 / React 19.2.4, a docelowe w manifeście ^16.4.6 / ^19.3.1. Wdrożenie wymaga instalacji docelowych zależności i ponownej weryfikacji; nie utworzono fałszywego lockfile dla wersji, których nie pobrano.
- Ruling: Brak repozytorium Git uniemożliwia commity/worktree, więc zachowano plan i dziennik w katalogu projektu. Nie wykonano publikacji ani połączenia do produkcyjnego RCON.
- Final: ważne uwagi przeglądu rozwiązane — testy ścieżek runtime RED→GREEN; obecność public/.next/static sprawdzana w smoke po buildzie. Brak odłożonych drobnych uwag reviewera.
- Korekta UI na polecenie użytkownika: układ jednej kolumny, formularz od razu pod nazwą, krótka instrukcja Windows, rozwijany import i mapa. Usunięto baner, ASCII, kafelki, zakładki, materiały z CDN i rozbudowaną sekcję społeczności. Zaktualizowano dokumentację oraz istniejący smoke test sprawdzający kolejność formularza i instalacji.
