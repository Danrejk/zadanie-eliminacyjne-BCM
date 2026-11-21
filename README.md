# SmartApp: Tablica Korkowa

Interaktywny, studencki planner zadań w formie **tablicy korkowej z karteczkami Post-it, kolorowymi pinezkami, fizyką 2D na podłodze oraz wysuwaną szufladą z koszem**, przygotowany przez drużynę **"Praktykanci"** na zadanie eliminacyjne SmartApp.

Zamiast płaskiej listy to-do stworzyliśmy fizyczne biurko studenta w przeglądarce: pilne kolokwia i projekty od razu rzucają się w oczy dzięki intuicyjnemu rozmieszczeniu i atrakcyjnej prezentacji, a ukończone zadania można zgnieść w kulkę i wrzucić do metalowego kosza.

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

- [x] **Lista zadań**: wszystkie aktywne zadania prezentowane są jako karteczki Post-it na tablicy korkowej 3×5 (priorytet × strefa czasowa) z automatycznym sortowaniem po terminie w każdej komórce; ukończone zadania trafiają do kosza.
- [x] **Dodawanie zadania**: przycisk `Nowe zadanie` w górnym pasku (lub kliknięcie PPM bezpośrednio w wybraną komórkę tablicy).
- [x] **Edycja zadania**: kliknięcie karteczki otwiera jej podgląd, z którego jednym kliknięciem można przejść do edycji; priorytet i termin można też zmieniać przez przeciąganie (Drag & Drop) między komórkami lub z menu kontekstowego (PPM).
- [x] **Wykreślanie zadania jako zrobione (i cofanie tego)**: dwuklik na karteczkę, przeciągnięcie jej na kosz lub opcja w menu kontekstowym oznacza zadanie jako `wykonane: true` i zgniata je w papierową kulkę. Cofnięcie (przywrócenie na tablicę z `wykonane: false`) działa zarówno dla kulek na podłodze, jak i w wysuwanej szufladzie kosza.
- [x] **Usuwanie zadania**: trwałe usuwanie zadania dostępne z menu kontekstowego karteczki/kulki, widoku podglądu zadania oraz podczas opróżniania kosza (z przeniesieniem do osobnego archiwum).
- [x] **Wczytanie zadań z pliku JSON**: przycisk `Wczytaj JSON` z rygorystycznym walidatorem struktury, typów, poprawności dat kalendarzowych oraz unikalności `id` (z czytelnymi komunikatami błędów po polsku).
- [x] **Zapis zadań do pliku JSON w tym samym formacie**: przycisk `Eksportuj JSON` zapisuje plik `zadania.json` w 100% zgodny ze schematem `{ "wersja": number, "zadania": [...] }` (dokładnie 7 wymaganych pól na zadanie, bez wyciekania pól wewnętrznych).

### Dodatkowe działające funkcje

- **Tablica korkowa 3×5 z automatyczną kategoryzacją**:
  - Oś pionowa (**priorytety**): `Wysoki` (różowy), `Średni` (żółty), `Niski` (miętowy).
  - Oś pozioma (**strefy czasowe**): `Po terminie`, `Dziś i jutro`, `Ten tydzień`, `Później`, `Bez terminu`.
  - Czerwona pieczątka `PO TERMINIE` dla zaległych zadań.
- **Wyszukiwanie i filtrowanie po tagach (pinezkach)**:
  - Wyszukiwanie na żywo po tytule i opisie zadania.
  - Dwa tryby pracy z filtrami (`Filtruj`: ukrywanie niepasujących / `Podświetl`: przygaszanie) oraz szybki przycisk resetu.
- **Fizyka 2D, 3-warstwowy kosz i wysuwana drewniana szuflada**:
  - Zgniecione kulki spadają na podłogę, gdzie można je łapać i rzucać w stronę kosza.
  - Kliknięcie kosza wysuwa drewnianą szufladę z metalowym koszem, w którym kulki układają się automatycznie. Każdą kulkę w koszu można podejrzeć (tooltip + pełny podgląd zadania), przywrócić na tablicę lub trwale usunąć.
  - Dostępne są też akcje zbiorcze: wysypanie kulek z kosza na podłogę, zebranie wszystkich kulek z podłogi jednym kliknięciem oraz opróżnienie kosza.
  - Po odświeżeniu strony (`F5`) stan podłogi resetuje się, a wszystkie ukończone zadania bezpiecznie czekają w koszu (autozapis w `localStorage`).
- **Zeszytowe modale, podsumowanie i oddzielne archiwum**:
  - Wszystkie okna dialogowe mają spójną stylistykę kartki z zeszytu (linie, dziurki na segregator, ołówkowe obramowania), a podgląd zadania prezentuje je w formie karteczki Post-it.
  - Opróżnianie kosza wyświetla podsumowanie z podziałem na **priorytety** oraz **terminowość (`Na czas` / `Po terminie`)** (liczoną względem dnia opróżniania kosza), usuwa zadania z głównego `zadania.json` i przenosi je z datą do osobnego archiwum (`smartapp_archive_v1` / eksport do `archiwum_usunietych.json`).
- **Syntetyczne dźwięki Web Audio API**:
  - Zróżnicowane efekty dźwiękowe generowane w locie (zgniatanie papieru, klik pinezki, lekkie odbicie kulki od podłogi, odgłosy uderzeń o ścianki kosza i drewnianą szufladę, wysuwanie/wsuwanie szuflady, wpadanie do kosza i przywracanie zadania), z przełącznikiem wyciszenia w górnym pasku.

### Czego nie zdążyliśmy zrobić / znane ograniczenia

#### Pomysły, na które zabrakło czasu (co chcieliśmy osiągnąć)
1. **Konfigurowalne kolumny i przedziały czasowe tablicy**: chcieliśmy dodać ustawienia pozwalające studentowi samodzielnie określić liczbę kolumn oraz dokładne granice przedziałów czasowych (zamiast sztywnego podziału na *Dziś i jutro*, *Ten tydzień*, *Później*), żeby każdy mógł dopasować tablicę do swojego trybu pracy.
2. **Druga, lewa szuflada z zegarem / timerem pracy**: planowaliśmy symetryczną szufladę po lewej stronie ekranu z wbudowanym timerem do mierzenia czasu spędzonego nad konkretnym zadaniem lub sesją nauki, aby później uwzględniać te statystyki czasu w podsumowaniu pracy.
3. **Kategorie zadań oparte na modelu równowagi zajęciowej (*occupational balance*) i zarządzania energią (*energy management*)**: chcieliśmy wprowadzić podział zadań na 5 kategorii energetycznych (nawiązujących m.in. do modelu Siegela): *intelektualne*, *kreatywne*, *fizyczne*, *społeczne* oraz *bytowe / logistyka*, aby pomagać studentowi świadomie balansować różne rodzaje wysiłku w ciągu tygodnia. Zrezygnowaliśmy z tego zarówno przez limit czasowy, jak i wymóg ścisłego trzymania się narzuconego schematu `zadania.json` bez dodatkowych pól.
4. **Dokładna terminowość względem chwili ukończenia zadania**: obecne podsumowanie przy opróżnianiu kosza liczy status `Na czas` / `Po terminie` względem dnia opróżnienia kosza (co zakłada, że kosz jest opróżniany codziennie). Nie zdążyliśmy wdrożyć śledzenia dokładnej daty wykonania zadania (ograniczonego też brakiem takiego pola w schemacie `zadania.json`).

#### Znane ograniczenia techniczne
- **Brak synchronizacji między urządzeniami (backend)**: aplikacja działa w pełni lokalnie w przeglądarce (`localStorage` + import/eksport JSON) bez zewnętrznego serwera.

---

## 3. Co dodaliście od siebie i dlaczego akurat to

1. **Tablica korkowa 3×5 zamiast zwykłej listy**: zwykła lista to-do wymaga czytania każdego wiersza, żeby ocenić, co pali się najbardziej. Macierz *priorytet × termin* pozwala studentowi jednym rzutem oka zobaczyć pilne kolokwia w lewym górnym rogu, kolory karteczek naturalnie kodują wagę zadania, a czerwona pieczątka `PO TERMINIE` natychmiast przyciąga wzrok do zaległości.
2. **Deterministyczne kolory pinezek (hash FNV-1a) i gwóźdź dla zadań bez tagów**: dzięki proceduralnemu wyliczaniu koloru z nazwy tagu, dany tag (np. `#studia`) ma zawsze ten sam kolor pinezki na tablicy, w filtrach i w formularzu, bez ręcznej konfiguracji. Zadania bez tagów dostają cienki gwóźdź bez łebka, co od razu wizualnie je odróżnia.
3. **Fizyka 2D na podłodze, 3-warstwowy kosz i wysuwana drewniana szuflada**: odhaczanie checkboxów szybko staje się mechaniczne. Zgniecenie karteczki w kulkę po dwukliku i wrzucenie jej do stożkowego kosza z fizyką odbić daje natychmiastową satysfakcję z domknięcia zadania, a wysuwana drewniana szuflada pozwala zajrzeć do środka, podejrzeć wyrzucone zadania i w razie potrzeby cofnąć ukończenie. Jednocześnie nie tracimy użyteczności: nawet jeśli kulki zostaną na podłodze, zadanie jest już zapisane jako wykonane.
4. **Zeszytowe modale i podgląd zadania jako karteczka Post-it**: zamiast surowych okienek formularzy, wszystkie modale przypominają wyrwane kartki z zeszytu z ołówkowymi obramowaniami, a kliknięcie zadania najpierw otwiera czytelny podgląd stylizowany na karteczkę Post-it. Dzięki temu przypadkowe kliknięcie nie psuje treści, a cała aplikacja utrzymuje spójny, studencki klimat.
5. **Podsumowanie przed opróżnieniem kosza i oddzielne archiwum `archiwum_usunietych.json`**: przed opróżnieniem kosza student widzi szybki bilans ukończonych zadań według priorytetów (oraz terminowości przy codziennym opróżnianiu). Zamiast bezpowrotnie kasować historię albo zaśmiecać główny plik `zadania.json`, opróżnione zadania trafiają z datą do oddzielnego archiwum, dzięki czemu główny plik pozostaje w 100% czysty i zgodny ze specyfikacją.
6. **Syntezator dźwięków Web Audio API bez zewnętrznych plików audio**: lekkie, syntetyzowane w locie efekty (szelest papieru, klik pinezki, różne brzmienia odbić od podłogi, metalowej siatki kosza i drewnianej szuflady oraz dźwięk jej wysuwania) wzmacniają fizyczność interfejsu bez ładowania dodatkowych plików sieciowych i z możliwością wyciszenia jednym kliknięciem.
7. **Rygorystyczny walidator importu `zadania.json`**: przy wczytywaniu własnych plików aplikacja dokładnie sprawdza strukturę, typy, poprawność dat kalendarzowych oraz unikalność `id`, chroniąc stan tablicy przed uszkodzonymi danymi i jasno informując użytkownika, co wymaga poprawy.

**Jakość techniczna:** zadbaliśmy również o płynność działania i niezawodność: warstwa fizyki usypia się, gdy kulki spoczywają, warstwy siatki kosza są pre-renderowane jako bitmapy 2x, a animacje szuflady korzystają z płynnych transformacji GPU. Logika aplikacji, walidator JSON, fizyka, dźwięki i kluczowe ścieżki użytkownika są pokryte testami jednostkowymi (`Vitest`) oraz 5-poziomowym zestawem testów E2E (`Playwright`).
