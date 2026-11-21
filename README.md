# SmartApp — Tablica Korkowa

Interaktywny, studencki planner zadań w formie **tablicy korkowej z karteczkami Post-it, kolorowymi pinezkami, fizyką 2D na podłodze oraz wysuwaną szufladą z koszem**, przygotowany przez drużynę **„Praktykanci”** na zadanie eliminacyjne SmartApp.

Zamiast kolejnej płaskiej listy to-do stworzyliśmy fizyczne biurko studenta w przeglądarce: pilne kolokwia i projekty od razu rzucają się w oczy dzięki osi czasu i priorytetu, a ukończone zadania można zgnieść w kulkę i wrzucić do metalowego kosza.

**Stack technologiczny:** React 19 · TypeScript · Vite · Tailwind CSS · Motion (`motion/react`) · Web Audio API · Vitest · Playwright

---

## Prezentacja i zrzuty ekranu

- **Prezentacja wideo (2 min):** `[TODO: wstaw link do prezentacji]`

> `[TODO: dodaj zrzut ekranu głównej tablicy korkowej 3×5]`
>
> `[TODO: dodaj zrzut ekranu z wysuniętą szufladą kosza i kulkami na podłodze / podglądem zadania w stylu zeszytu]`

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

### Wymagania bazowe (7/7)

- [x] **Lista zadań** — wszystkie aktywne zadania prezentowane są jako karteczki Post-it na tablicy korkowej 3×5 (priorytet × strefa czasowa) z automatycznym sortowaniem po terminie w każdej komórce; ukończone zadania trafiają do kosza.
- [x] **Dodawanie zadania** — przycisk `+ Nowe zadanie` w górnym pasku (lub kliknięcie bezpośrednio w wybraną komórkę tablicy z domyślnym priorytetem i strefą czasową).
- [x] **Edycja zadania** — kliknięcie karteczki otwiera jej podgląd, z którego jednym kliknięciem można przejść do edycji; priorytet i termin można też zmieniać przez przeciąganie (Drag & Drop) między komórkami lub z menu kontekstowego (PPM).
- [x] **Wykreślanie zadania jako zrobione (i cofanie tego)** — dwuklik na karteczkę, przeciągnięcie jej na kosz lub opcja w menu kontekstowym oznacza zadanie jako `wykonane: true` i zgniata je w papierową kulkę. Cofnięcie (przywrócenie na tablicę z `wykonane: false`) działa zarówno dla kulek na podłodze, jak i w wysuwanej szufladzie kosza.
- [x] **Usuwanie zadania** — trwałe usuwanie zadania dostępne z menu kontekstowego karteczki/kulki, widoku podglądu zadania oraz podczas opróżniania kosza (z przeniesieniem do osobnego archiwum).
- [x] **Wczytanie zadań z pliku JSON** — przycisk `Wczytaj JSON` z rygorystycznym walidatorem struktury, typów, poprawności dat kalendarzowych oraz unikalności `id` (z czytelnymi komunikatami błędów po polsku).
- [x] **Zapis zadań do pliku JSON w tym samym formacie** — przycisk `Eksportuj JSON` zapisuje plik `zadania.json` w 100% zgodny ze schematem `{ "wersja": number, "zadania": [...] }` (dokładnie 7 wymaganych pól na zadanie, bez wyciekania pól wewnętrznych).

### Dodatkowe działające funkcje

- **Tablica korkowa 3×5 z automatyczną kategoryzacją**:
  - Oś pionowa (**priorytety**): `Wysoki` (koralowy/różowy), `Średni` (żółty), `Niski` (miętowy/błękitny).
  - Oś pozioma (**strefy czasowe**): `Po terminie`, `Dziś i jutro`, `Ten tydzień`, `Później`, `Bez terminu`.
  - Deterministyczne pochylenie karteczek (`-2.5°` do `+2.5°`), czerwona pieczątka `PO TERMINIE` dla zaległych zadań oraz zabezpieczenie kolumny `Po terminie` przed przypadkowym upuszczeniem zadań z innych stref czasowych.
- **Wyszukiwanie i filtrowanie po tagach (pinezkach)**:
  - Wyszukiwanie na żywo po tytule i opisie zadania.
  - Dwa tryby pracy z filtrami (`Filtruj` — ukrywanie niepasujących / `Podświetl` — przygaszanie) oraz szybki przycisk resetu.
- **Fizyka 2D, 3-warstwowy kosz i wysuwana drewniana szuflada**:
  - Zgniecione kulki spadają na podłogę, gdzie można je łapać i rzucać w stronę kosza — fizyka odwzorowuje stożkowy, otwarty od góry kosz z dwiema ściankami bocznymi i strefą zaliczenia rzutu na dnie.
  - Kliknięcie kosza wysuwa drewnianą szufladę z metalowym koszem z siatki, w którym kulki układają się w ciasny plaster miodu. Każdą kulkę w koszu można podejrzeć (tooltip + pełny podgląd zadania), przywrócić na tablicę lub trwale usunąć.
  - Dostępne są też akcje zbiorcze: wysypanie kulek z kosza na podłogę, zebranie wszystkich kulek z podłogi jednym kliknięciem oraz opróżnienie kosza.
  - Po odświeżeniu strony (`F5`) stan efemerycznej podłogi resetuje się, a wszystkie ukończone zadania bezpiecznie czekają w koszu (autozapis w `localStorage`).
- **Zeszytowe modale, podsumowanie i oddzielne archiwum**:
  - Wszystkie okna dialogowe mają spójną stylistykę kartki z zeszytu (linie, dziurki na segregator, ołówkowe obramowania), a podgląd zadania prezentuje je w formie karteczki Post-it.
  - Opróżnianie kosza wyświetla podsumowanie z podziałem na **priorytety** oraz **terminowość (`Na czas` / `Po terminie`)**, usuwa zadania z głównego `zadania.json` i przenosi je z datą do osobnego archiwum (`smartapp_archive_v1` / eksport do `archiwum_usunietych.json`).
- **Syntetyczne dźwięki Web Audio API**:
  - Zróżnicowane efekty dźwiękowe generowane w locie (zgniatanie papieru, klik pinezki, lekkie odbicie kulki od podłogi, odgłosy uderzeń o ścianki kosza i drewnianą szufladę, wysuwanie/wsuwanie szuflady, wpadanie do kosza i przywracanie zadania), z przełącznikiem wyciszenia w górnym pasku.

### Czego nie zdążyliśmy zrobić / znane ograniczenia

#### Pomysły, na które zabrakło czasu (co chcieliśmy osiągnąć)
1. **Konfigurowalne kolumny i przedziały czasowe tablicy** — chcieliśmy dodać ustawienia pozwalające studentowi samodzielnie określić liczbę kolumn oraz dokładne granice przedziałów czasowych (zamiast sztywnego podziału na *Dziś i jutro*, *Ten tydzień*, *Później*), żeby każdy mógł dopasować tablicę do swojego rytmu semestru.
2. **Druga, lewa szuflada z zegarem / timerem pracy** — planowaliśmy symetryczną szufladę po lewej stronie ekranu z wbudowanym timerem do mierzenia czasu spędzonego nad konkretnym zadaniem lub sesją nauki, aby później uwzględniać te statystyki czasu w podsumowaniu pracy.
3. **Kategorie zadań oparte na modelu równowagi zajęciowej (*occupational balance*) i zarządzania energią (*energy management*)** — chcieliśmy wprowadzić podział zadań na 5 kategorii energetycznych (nawiązujących m.in. do modelu Siegela): *intelektualne*, *kreatywne*, *fizyczne*, *społeczne* oraz *bytowe / logistyka*, aby pomagać studentowi świadomie balansować różne rodzaje wysiłku w ciągu tygodnia. Zrezygnowaliśmy z tego zarówno przez limit 3 dni, jak i wymóg ścisłego trzymania się narzuconego schematu `zadania.json` bez dodatkowych pól.

#### Znane ograniczenia techniczne
- **Gest rzutu kulką na ekranach dotykowych (mobile)** — na urządzeniach bez myszy fizyczny rzut kulką z nadaniem prędkości bywa mniej wygodny niż na desktopie; jako niezawodny zamiennik na każdym urządzeniu działa menu kontekstowe oraz przycisk „Zbierz kulki z podłogi” w szufladzie kosza.
- **Brak synchronizacji między urządzeniami (backend)** — aplikacja działa w pełni lokalnie w przeglądarce (`localStorage` + import/eksport JSON) bez zewnętrznego serwera.

---

## 3. Co dodaliście od siebie i dlaczego akurat to

1. **Tablica korkowa 3×5 zamiast zwykłej listy** — zwykła lista to-do wymaga czytania każdego wiersza, żeby ocenić, co pali się najbardziej. Macierz *priorytet × termin* pozwala studentowi jednym rzutem oka zobaczyć pilne kolokwia w lewym górnym rogu, kolory karteczek naturalnie kodują wagę zadania, a czerwona pieczątka `PO TERMINIE` natychmiast przyciąga wzrok do zaległości.
2. **Deterministyczne kolory pinezek (hash FNV-1a) i gwóźdź dla zadań bez tagów** — dzięki proceduralnemu wyliczaniu koloru z nazwy tagu, dany tag (np. `#studia`) ma zawsze ten sam kolor pinezki na tablicy, w filtrach i w formularzu — bez ręcznej konfiguracji. Zadania bez tagów dostają cienki gwóźdź bez łebka, co od razu wizualnie je odróżnia.
3. **Fizyka 2D na podłodze, 3-warstwowy kosz i wysuwana drewniana szuflada** — odhaczanie checkboxów szybko staje się mechaniczne. Zgniecenie karteczki w kulkę po dwukliku i wrzucenie jej do stożkowego kosza z fizyką odbić daje natychmiastową satysfakcję z domknięcia zadania, a wysuwana drewniana szuflada pozwala zajrzeć do środka, podejrzeć wyrzucone zadania i w razie potrzeby cofnąć ukończenie. Jednocześnie nie tracimy użyteczności: nawet jeśli kulki zostaną na podłodze, zadanie jest już zapisane jako wykonane.
4. **Zeszytowe modale i podgląd zadania jako karteczka Post-it** — zamiast surowych okienek formularzy, wszystkie modale przypominają wyrwane kartki z zeszytu z ołówkowymi obramowaniami, a kliknięcie zadania najpierw otwiera czytelny podgląd stylizowany na karteczkę Post-it. Dzięki temu przypadkowe kliknięcie nie psuje treści, a cała aplikacja utrzymuje spójny, studencki klimat.
5. **Podsumowanie terminowości (`Na czas` / `Po terminie`) i oddzielne archiwum `archiwum_usunietych.json`** — przed opróżnieniem kosza student widzi szybki bilans ukończonych zadań (według priorytetów oraz tego, ile udało się dowieźć przed terminem). Zamiast bezpowrotnie kasować historię albo zaśmiecać główny plik `zadania.json`, opróżnione zadania trafiają z datą do oddzielnego archiwum, dzięki czemu główny plik pozostaje w 100% czysty i zgodny ze specyfikacją.
6. **Syntezator dźwięków Web Audio API bez zewnętrznych plików audio** — lekkie, syntetyzowane w locie efekty (szelest papieru, klik pinezki, różne brzmienia odbić od podłogi, metalowej siatki kosza i drewnianej szuflady oraz dźwięk jej wysuwania) wzmacniają fizyczność interfejsu bez ładowania dodatkowych plików sieciowych i z możliwością wyciszenia jednym kliknięciem.
7. **Rygorystyczny walidator importu `zadania.json`** — przy wczytywaniu własnych plików aplikacja dokładnie sprawdza strukturę, typy, poprawność dat kalendarzowych oraz unikalność `id`, chroniąc stan tablicy przed uszkodzonymi danymi i jasno informując użytkownika, co wymaga poprawy.

**Jakość techniczna:** zadbaliśmy również o płynność działania i niezawodność — warstwa fizyki usypia się, gdy kulki spoczywają, warstwy siatki kosza są pre-renderowane jako bitmapy 2×, komórki tablicy są memoizowane, a animacje szuflady korzystają z płynnych transformacji GPU. Logika aplikacji, walidator JSON, fizyka, dźwięki i kluczowe ścieżki użytkownika są pokryte testami jednostkowymi (`Vitest`) oraz 5-poziomowym zestawem testów E2E (`Playwright`).
