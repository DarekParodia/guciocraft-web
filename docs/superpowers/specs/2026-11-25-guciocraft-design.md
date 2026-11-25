# Guciocraft — projekt

Ustalenia z rozmowy, zatwierdzone poleceniem rozpoczęcia implementacji. Next.js jest wymaganiem użytkownika.

## Cel i zakres

Polska strona one page spokojnego serwera Create dla znajomych i nowych graczy. Adres `mc.bshomelab.cc`, Discord `https://discord.gg/A8qsssD8VQ`, BlueMap `https://mcmap.bshomelab.cc`. Publiczny zapis na whitelistę: nick i przycisk, bez logowania. Dwie instrukcje: gotowy Prism portable dla Windows i import zgodnego ZIP do własnego Prism.

## Wygląd

Po korekcie użytkownika: jedna wąska kolumna, czytana od góry do dołu. Nazwa i krótki opis, od razu nick z przyciskiem dodania, następnie pobranie Windows i trzy kroki instalacji, rozwijana instrukcja importu oraz mapa. Discord jako zwykły link, adres i status jako dyskretne informacje. Ciemne tło, miedziany akcent, bez banera, paneli bocznych, zdjęć, animacji i kafelków. Responsywność i obsługa klawiaturą. Szczegóły o wersji i RAM tylko po uzupełnieniu konfiguracji.

Kolejna korekta użytkownika: screen z gry jako dekoracyjne tło, rozmyte i wygaszone ciemnym gradientem w stronę środkowej kolumny. Domyślnie materiał Steam ’n’ Rails, konfigurowalny adres i źródło. Środek pozostaje niemal jednolicie ciemny, bez dodawania banera ani nowych sekcji.

## Architektura i rozważone warianty

Rozważono statyczny HTML z osobnym API oraz Astro z osobnym API. Użytkownik wybrał Next.js: App Router, React i Route Handlers w jednym procesie Node.js >=24, wdrożenie w LXC. Zwykły CSS, bez dodatkowej biblioteki interfejsu. SQLite przez `node:sqlite` przechowuje atomowe limity i krótką historię; brak Redis i panelu administracyjnego.

## Backend

- API whitelisty przyjmuje wyłącznie JSON `{nickname: string}` do 512 bajtów i zapisuje tylko `whitelist add <nick>` przez TCP RCON. Backend waliduje całe wejście ASCII 3–16 znaków, bez trimowania i normalizacji Unicode. Nie używa shella.
- Limity: 10 prób/min/IP, 5 operacji/h/IP, 1 operacja/min/nick, 20 operacji/min globalnie. Atomowa rezerwacja przed RCON, trwałość po restarcie, ograniczone połączenia i timeout. Nieudane próby RCON zużywają budżet.
- Publiczny endpoint musi mieć skonfigurowane źródło rzeczywistego IP przez reverse proxy nadpisujące wskazany nagłówek. Bez tej konfiguracji zapisy są niedostępne. Origin porównywany ze skonfigurowanym adresem strony; brak Origin odrzucany. To ochrona przeglądarkowa, nie uwierzytelnianie.
- Sekrety tylko w środowisku serwera. RCON lokalnie/prywatnie, nigdy publicznie. Standardowy RCON ma szerokie uprawnienia; kod ogranicza komendy, ale nie tworzy ograniczonego konta RCON.
- Brak danych RCON oznacza wyłączony formularz z wyjaśnieniem. Brak ZIP oznacza nieaktywny przycisk z opisem. Brak odpowiedzi serwera nie jest sukcesem zapisu.
- Status i liczba graczy przez Java Server List Ping, bufor 30 s, współdzielenie trwającego odczytu, bez RCON i bez listy nicków. Odróżnienie offline od niedostępnego sprawdzenia.
- Pobrania przez kontrolowany endpoint z dwóch skonfigurowanych lokalnych plików, strumieniowanie i sprawdzanie ścieżek. Duże ZIP-y można później odciążyć na Nginx.

## Utrzymanie

Jeden plik konfiguracji publicznej i `.env` dla sekretów. Wersja modpacka i RAM opcjonalne, bez zgadywania wartości. Systemd i Nginx do LXC, instrukcja firewalla i weryfikacji wdrożenia. Brak automatycznego wdrożenia i połączeń do produkcyjnego RCON podczas prac.

## Ograniczenia

Otwarte zapisy pozwalają zgłosić dowolny poprawny nick. Limity IP nie powstrzymują rozproszonego ataku; można później dodać weryfikację bota. ZIP-y oraz dane RCON dostarcza właściciel. Embed wymaga zgody nagłówków hosta BlueMap. Publiczne API statusu nie ujawnia nazw graczy.
