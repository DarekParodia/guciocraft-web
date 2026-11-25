# Whitelista dla Minecrafta w trybie offline

NeoForge 21.1.267 rejestruje komendę `whitelist-offline add <nick>` dla konsoli. Komenda działa przy wyłączonym uwierzytelnianiu Minecraft i zapisuje profil offline utworzony z dokładnie wpisanego nicku. Backend wysyła tę komendę przez istniejące połączenie RCON i wymaga potwierdzenia dokładnego nicku.

- [x] Zaktualizować testy RCON, w tym sprawdzenie `tester` i `Tester` oraz odpowiedzi z innej komendy.
- [x] Zaimplementować mod serwerowy dla Java 21 i klienta nowej komendy w `lib/rcon.mjs`.
- [x] Zbudować mod, uruchomić testy strony i opisać kolejność wdrożenia oraz weryfikację wpisu po UUID.
