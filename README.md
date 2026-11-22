# Praktyczna Tablica (SmartApp)


Interaktywny, studencki planner zadań w formie **tablicy korkowej z karteczkami Post-it, kolorowymi pinezkami, fizyką 2D oraz wysuwaną szufladą z koszem**, przygotowany przez drużynę **"Praktykanci"** na zadanie eliminacyjne SmartApp.

Zamiast kolejnej płaskiej listy to-do stworzyliśmy fizyczne biurko studenta w przeglądarce. Pilne kolokwia i projekty od razu rzucają się w oczy dzięki intuicyjnej tablicy, a to, co najbardziej wyróżnia aplikację, to **mechanika zgniatania ukończonych zadań w papierowe kulki i rzucania nimi do kosza**: jest po prostu zabawna, daje satysfakcję i **wizualnie pokazuje, ile pracy masz już za sobą**, co świetnie napędza motywację.

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
npm install      # instalacja zależności
npm run dev      # uruchomienie w trybie dev (http://localhost:5173)
```

Dodatkowe komendy: `npm run build` (build produkcyjny), `npm run preview` (podgląd buildu), `npm run test` (testy jednostkowe Vitest), `npm run test:e2e` (testy E2E Playwright).

---

## 2. Co działa, a czego nie zdążyliście zrobić

### Wymagania bazowe (7/7)

- [x] **Lista zadań**: aktywne zadania jako karteczki Post-it na tablicy 3×5 (sortowane po terminie); ukończone trafiają do kosza.
- [x] **Dodawanie zadania**: przycisk `Nowe zadanie` w górnym pasku lub kliknięcie PPM bezpośrednio w komórkę tablicy.
- [x] **Edycja zadania**: kliknięcie otwiera podgląd karteczki z przejściem do edycji; priorytet i termin można też zmieniać przez Drag & Drop lub menu kontekstowe (PPM).
- [x] **Wykreślanie zadania jako zrobione (i cofanie tego)**: dwuklik, przeciągnięcie na kosz lub PPM zgniata karteczkę w kulkę (`wykonane: true`); cofnięcie (`wykonane: false`) działa z poziomu podłogi i szuflady kosza.
- [x] **Usuwanie zadania**: dostępne w menu kontekstowym karteczki/kulki, podglądzie zadania oraz przy opróżnianiu kosza (z przeniesieniem do archiwum).
- [x] **Wczytanie zadań z pliku JSON**: przycisk `Wczytaj JSON` z rygorystycznym walidatorem struktury, dat i unikalności `id` (czytelne błędy po polsku).
- [x] **Zapis zadań do pliku JSON w tym samym formacie**: `Eksportuj JSON` generuje `zadania.json` w 100% zgodny z `{ "wersja": number, "zadania": [...] }` (dokładnie 7 pól na zadanie).

### Dodatkowe działające funkcje

- **Tablica korkowa 3×5**: oś pionowa to priorytety (`Wysoki` różowy, `Średni` żółty, `Niski` miętowy), oś pozioma to strefy czasowe (`Po terminie`, `Dziś i jutro`, `Ten tydzień`, `Później`, `Bez terminu`) z czerwoną pieczątką `PO TERMINIE`.
- **Wyszukiwanie i pinezki (tagi)**: wyszukiwanie na żywo po tytule/opisie oraz filtrowanie po tagach w dwóch trybach (`Filtruj`: ukryj inne / `Podświetl`: przygaś inne) + szybki reset.
- **Zgniecione kulki, fizyka 2D i wysuwana szuflada z koszem**: ukończone zadania spadają na podłogę jako papierowe kulki, które można łapać i wrzucać do metalowego kosza. Kliknięcie kosza wysuwa drewnianą szufladę, w której kulki układają się automatycznie; każdą można podejrzeć (tooltip + pełny podgląd), przywrócić lub usunąć. Działają też akcje zbiorcze (wysypanie kulek, zebranie z podłogi, opróżnienie kosza), a po odświeżeniu (`F5`) stan jest bezpiecznie odtwarzany z `localStorage`.
- **Zeszytowe modale, podsumowanie i archiwum**: okna dialogowe stylizowane na kartki z zeszytu (podgląd zadania jako Post-it). Opróżnianie kosza pokazuje podsumowanie (priorytety + terminowość liczona względem dnia opróżnienia) i przenosi zadania do osobnego archiwum (`smartapp_archive_v1` / eksport `archiwum_usunietych.json`).
- **Syntetyczne dźwięki Web Audio API**: generowane w locie efekty (zgniatanie papieru, klik pinezki, różne odbicia od podłogi, kosza i szuflady, wysuwanie szuflady, wpadanie do kosza) z przyciskiem wyciszenia.

### Czego nie zdążyliśmy zrobić / znane ograniczenia

#### Pomysły, na które zabrakło czasu (co chcieliśmy osiągnąć)
1. **Konfigurowalne kolumny i przedziały czasowe tablicy**: ustawienia pozwalające samodzielnie wybrać liczbę kolumn i dokładne granice przedziałów czasowych, aby dopasować tablicę do własnego trybu pracy.
2. **Druga, lewa szuflada z zegarem / timerem pracy**: symetryczna szuflada po lewej stronie ekranu z timerem mierzącym czas spędzony nad zadaniem lub nauką, z wykorzystaniem tych danych w podsumowaniu.
3. **Kategorie zadań oparte na modelu równowagi zajęciowej (*occupational balance*) i zarządzania energią (*energy management*)**: podział zadań na 5 kategorii energetycznych (m.in. w nawiązaniu do modelu Siegela): *intelektualne*, *kreatywne*, *fizyczne*, *społeczne* oraz *bytowe / logistyka*, aby student mógł świadomie balansować wysiłek w tygodniu. Zrezygnowaliśmy z tego przez limit czasowy oraz wymóg ścisłego trzymania się schematu `zadania.json`.
4. **Dokładna terminowość względem chwili ukończenia**: obecne podsumowanie liczy `Na czas` / `Po terminie` względem dnia opróżniania kosza (zakłada codzienne opróżnianie), ponieważ schemat `zadania.json` nie przechowuje daty wykonania zadania.
5. **Dodatkowy polish wizualny**: Wiele elementów na stronie nie zostało idealnie dopasowane do ogólnego stylu, lub występują niektóre sytuacje, gdzie coś nie jest do końca tak jak powinno być, ale staraliśmy sie wyeliminować jak najwięcej takich sytuacji. 

#### Znane ograniczenia techniczne
- **Brak synchronizacji między urządzeniami (backend)**: aplikacja działa w pełni lokalnie w przeglądarce (`localStorage` + pliki JSON).

---

## 3. Co dodaliście od siebie i dlaczego akurat to

1. **Zgniecione kulki, rzut do kosza i wysuwana drewniana szuflada (główny wyróżnik)**: odhaczanie zwykłych checkboxów jest nudne i po chwili znika z oczu. U nas ukończenie zadania to fizyczny, zabawny gest: karteczka zamienia się w kulkę, którą można rzucić do kosza z fizyką 2D. Co ważniejsze, **zapełniający się kulkami kosz wizualnie pokazuje, ile zadań udało się już zrobić**, co daje konkretną satysfakcję i motywuje do kolejnego kroku. Szuflada pozwala zajrzeć do środka, podejrzeć wyrzucone zadania i w razie potrzeby je cofnąć, a nawet bez rzutu zadanie od razu zapisuje się jako wykonane.
2. **Tablica korkowa 3×5 zamiast płaskiej listy**: macierz *priorytet × termin* od razu eksponuje najpilniejsze kolokwia w lewym górnym rogu, kolory karteczek kodują wagę, a pieczątka `PO TERMINIE` natychmiast ostrzega o zaległościach.
3. **Deterministyczne kolory pinezek (hash FNV-1a) i gwóźdź bez tagów**: ten sam tag (np. `#studia`) ma zawsze identyczny kolor w całej aplikacji bez ręcznej konfiguracji, a zadania bez tagów dostają cienki gwóźdź bez łebka.
4. **Zeszytowe modale i podgląd zadania jako Post-it**: okna przypominają wyrwane kartki z zeszytu z ołówkowymi obramowaniami, a kliknięcie zadania najpierw otwiera bezpieczny podgląd karteczki, co chroni przed przypadkową edycją i wzmacnia studencki klimat.
5. **Podsumowanie przed opróżnieniem i osobne archiwum `archiwum_usunietych.json`**: student dostaje szybki bilans wykonanej pracy, a historia trafia z datą do osobnego pliku, dzięki czemu główny `zadania.json` pozostaje w 100% czysty i zgodny ze specyfikacją.
6. **Syntezator dźwięków Web Audio API bez zewnętrznych plików**: lekkie, proceduralne dźwięki (papier, pinezka, odbicia od podłogi, metalowej siatki i drewna, wysuwanie szuflady) potęgują wrażenie fizycznego biurka bez obciążania sieci.
7. **Rygorystyczny walidator importu `zadania.json`**: weryfikuje strukturę, typy, daty kalendarzowe i unikalność `id`, chroniąc tablicę przed uszkodzonymi plikami.

**Jakość techniczna:** zadbaliśmy o płynność (usypianie fizyki w spoczynku, pre-renderowane warstwy kosza 2x, animacje GPU) oraz pokrycie testami jednostkowymi (`Vitest`) i 5-poziomowym zestawem testów E2E (`Playwright`).
