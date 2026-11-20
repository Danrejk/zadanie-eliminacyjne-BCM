# SmartApp — Tablica Korkowa

Interaktywny, studencki planner zadań w formie **tablicy korkowej z karteczkami Post-it, pinezkami i fizyką 2D na podłodze**, przygotowany przez drużynę **„Praktykanci”** na zadanie eliminacyjne SmartApp.

---

## 1. Jak uruchomić aplikację

Wymagania: **Node.js** (zalecane v20+) oraz **npm**.

```bash
# 1. Instalacja zależności
npm install

# 2. Uruchomienie w trybie deweloperskim
npm run dev
```

Aplikacja uruchomi się domyślnie pod adresem `http://localhost:5173`.

### Dodatkowe komendy

```bash
# Budowanie wersji produkcyjnej (TypeScript + Vite)
npm run build

# Podgląd zbudowanej wersji produkcyjnej
npm run preview

# Testy jednostkowe (Vitest + React Testing Library)
npm run test

# Testy E2E w przeglądarce Chromium (Playwright)
npm run test:e2e
```

---

## 2. Co działa, a czego nie zdążyliście zrobić

### Co działa w pełni
- **Macierz tablicy korkowej 3×5**:
  - Oś pionowa (**priorytety**, od góry do dołu): `Wysoki` (koralowy/różowy), `Średni` (klasyczny żółty), `Niski` (miętowy/błękitny).
  - Oś pozioma (**strefy czasowe**, od lewej do prawej): `Po terminie`, `Dziś i jutro`, `Ten tydzień`, `Później`, `Bez terminu`.
  - Automatyczne sortowanie w komórkach po dacie terminu, deterministyczne pochylenie karteczek (`-2.5°` do `+2.5°`) oraz czerwona pieczątka **`PO TERMINIE`** dla zaległych zadań.
- **Pełny CRUD i obsługa karteczek**:
  - Dodawanie zadań (`+ Nowe zadanie`), edycja pojedynczym kliknięciem lub przez menu kontekstowe (PPM), zmiana priorytetu, trwałe usuwanie.
  - Przeciąganie karteczek (Drag & Drop) pomiędzy komórkami tablicy (kolumna `Po terminie` jest zabezpieczona przed przypadkowym upuszczeniem z innych stref czasowych, przy jednoczesnym zachowaniu zmiany priorytetu w pionie).
- **Wyszukiwanie i filtrowanie po tagach (pinezkach)**:
  - Wyszukiwanie na żywo po tytule i opisie zadania.
  - Deterministyczne kolory pinezek wyliczane z nazwy tagu (hash FNV-1a): 0 tagów = cienki gwóźdź bez łebka, 1 tag = wyśrodkowana kolorowa pinezka, 2+ tagi = równomiernie rozłożone pinezki z podpowiedziami.
  - Tryb filtrowania (`Filtruj` — ukrywanie niepasujących / `Podświetl` — przygaszanie) oraz szybki reset filtrów.
- **Zgniecenie w kulkę, fizyka 2D na podłodze i kosz**:
  - Dwuklik na karteczkę (lub opcja PPM `Oznacz jako zrobione`) natychmiast oznacza zadanie jako `wykonane: true` (zapisywane w `localStorage`) i zrzuca zgniecioną papierową kulkę na podłogę.
  - Kulki można łapać kursorem i rzucać w stronę kosza w prawym dolnym rogu — w trakcie trzymania lub lotu kulki kosz płynnie się powiększa (`motion/react`), a po trafieniu odtwarza animację wpadania i dźwięk.
  - Karteczki można też przeciągnąć bezpośrednio na ikonę kosza.
  - Po odświeżeniu strony (`F5`) stan efemerycznej podłogi resetuje się, a wszystkie ukończone zadania czekają bezpiecznie w koszu.
- **Rozszerzony widok kosza, podsumowanie i oddzielne archiwum**:
  - Kliknięcie kosza otwiera modal z podglądem kulek, możliwością przywrócenia na tablicę, zebrania wszystkich kulek z podłogi jednym kliknięciem oraz opróżnienia kosza.
  - Opróżnianie kosza wyświetla modal podsumowania (liczba zadań, rozbicie po priorytetach i tagach), usuwa zadania z głównego `zadania.json` i zapisuje je z datą w oddzielnym rejestrze (`smartapp_archive_v1` / `archiwum_usunietych.json`).
  - Modal **Archiwum** pozwala przeglądać historię i pobrać plik `archiwum_usunietych.json`.
- **Ścisły import/eksport `zadania.json` i autozapis**:
  - Pełna zgodność ze schematem `{ "wersja": number, "zadania": [...] }` (tylko 7 wymaganych pól na zadanie, bez wyciekania pól wewnętrznych).
  - Rygorystyczny walidator JSON z czytelnymi komunikatami błędów po polsku oraz 20 realistycznych studenckich zadań startowych.
- **Syntetyczne dźwięki Web Audio API**:
  - Dźwięki zgniatania papieru, kliknięcia pinezki, wpadania do kosza i przywracania zadania, z przełącznikiem wyciszenia w górnym pasku.

### Czego nie zdążyliście zrobić / znane ograniczenia
- **Gest rzutu kulką na ekranach dotykowych (mobile)**: na urządzeniach mobilnych bez myszy fizyczny rzut kulką z nadaniem prędkości bywa mniej wygodny niż na desktopie — jako pewny zamiennik na każdym urządzeniu działa menu kontekstowe (kliknięcie / PPM) oraz przycisk „Zbierz kulki z podłogi” w widoku kosza.
- **Synchronizacja między urządzeniami (backend)**: aplikacja działa w pełni lokalnie w przeglądarce (`localStorage` + pliki JSON) bez zewnętrznego serwera.

---

## 3. Co dodaliście od siebie i dlaczego akurat to

1. **Tablica korkowa 3×5 zamiast zwykłej listy** — student od razu widzi nie tylko *co* ma zrobić, ale *jak pilne* to jest (oś priorytetu) i *kiedy* wypada termin (oś czasu). Kolory karteczek naturalnie kodują priorytet, a czerwona pieczątka `PO TERMINIE` natychmiast przykuwa wzrok do zaległych kolokwiów czy projektów.
2. **Deterministyczne kolory pinezek (FNV-1a) i gwóźdź dla zadań bez tagów** — dzięki stałemu hashowaniu nazw tagów, tag np. `studia` ma zawsze ten sam kolor pinezki zarówno na tablicy, w filtrach, w formularzu, jak i w podsumowaniu kosza. Zadania bez tagów dostają skromny gwóźdź bez łebka, co wizualnie wyróżnia je od razu.
3. **Fizyka 2D na podłodze i mini-gra z rzutem do kosza** — odhaczanie ukończonych zadań bywa nudne; zgniecenie karteczki w kulkę po dwukliku i możliwość rzucenia jej do powiększającego się kosza daje natychmiastową satysfakcję z ukończenia pracy. Jednocześnie zachowaliśmy pełną użyteczność: nawet jeśli kulki zostaną na podłodze, zadanie jest już oznaczone jako ukończone i po odświeżeniu strony trafia prosto do kosza.
4. **Oddzielny plik `archiwum_usunietych.json` + podsumowanie przed opróżnieniem** — zamiast bezpowrotnie tracić historię wykonanych zadań lub zaśmiecać główny plik `zadania.json`, opróżnienie kosza przenosi je do osobnego archiwum z dokładnym znacznikiem czasu. Dzięki temu `zadania.json` pozostaje w 100% czysty i zgodny z wymaganym formatem.
5. **Syntezator dźwięków Web Audio API bez zewnętrznych plików audio** — lekkie, generowane w locie efekty dźwiękowe (szelest papieru, klik pinezki, „plop” w koszu) wzmacniają wrażenie pracy na prawdziwej tablicy, bez ładowania dodatkowych zasobów sieciowych.
6. **Rygorystyczny walidator importu JSON** — przy wczytywaniu własnych plików `zadania.json` aplikacja dokładnie sprawdza strukturę, typy, poprawność dat kalendarzowych oraz unikalność `id`, chroniąc stan tablicy przed uszkodzonymi danymi.
