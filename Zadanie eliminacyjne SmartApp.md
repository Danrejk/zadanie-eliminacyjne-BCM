# **SmartApp**

Zadanie eliminacyjne · kategoria SmartApp

# **O co chodzi**

Student ma na głowie kolokwia, projekty i codzienne sprawy. Zróbcie planner zadań (to-do), który pomoże mu to ogarnąć.

Forma dowolna: strona, aplikacja mobilna albo program na komputer. Na oddanie macie **3 dni**.

# **Co dostajecie**

Plik zadania.json z 20 przykładowymi zadaniami. Wygląda tak:

```json
{
  "wersja": 1,
  "zadania": [
    {
      "id": 1,
      "tytul": "Kolokwium z sieci komputerowych",
      "opis": "Rozdziały 3–5",
      "termin": "2026-11-18",
      "priorytet": "wysoki",
      "wykonane": false,
      "tagi": ["studia"]
    }
  ]
}
```

* opis może być pusty, a tagi mogą być pustą listą
* termin to data albo null, gdy zadanie nie ma terminu
* priorytet to niski, sredni albo wysoki

# **Co zrobić**

1. Lista zadań.
2. Dodawanie zadania.
3. Edycja zadania.
4. Wykreślanie zadania jako zrobione (i cofanie tego).
5. Usuwanie zadania.
6. Wczytanie zadań z pliku JSON.
7. Zapis zadań do pliku JSON w tym samym formacie.

Wczytywanie i zapis sprawdzimy na naszym własnym pliku w tym samym formacie, więc trzymajcie się go.

# **Wasz własny wkład! Na tym zależy nam najbardziej**

**Najbardziej zależy nam na waszym własnym wkładzie i pomysłach. Na to będziemy patrzeć najuważniej.**

Wymyślcie, co sprawi, że aplikacja będzie naprawdę „smart” oraz pomoże studentowi lepiej niż zwykła lista. Liczy się, żeby pomysł był przemyślany i wasz.

Nie musi to być kompletne ani idealne rozwiązanie. Jeśli coś zaczęliście i nie zdążyliście dokończyć, pokażcie to i opiszcie, co chcieliście osiągnąć, a to też weźmiemy to pod uwagę.

Przykładowo: widok „na dziś”, zadania po terminie, sortowanie, statystyki. Najbardziej ciekawią nas jednak pomysły spoza tej listy. Śmiało dodajcie coś kojarzącego się np. z nazwą waszej drużyny, aby pokazało waszą tożsamość i motywację.

# **Repozytorium**

Całe rozwiązanie wrzućcie do repozytorium na GitHubie:

* repozytorium publiczne,
* cały kod w repozytorium, nie w spakowanym pliku,
* plik README.md, a w nim:

1. jak uruchomić aplikację,
2. co działa, a czego nie zdążyliście zrobić,
3. co dodaliście od siebie i dlaczego akurat to.

# **Co oddajecie**

* link do repozytorium
* 2min prezentacja (forma dowolna: film/pdf...): pokażcie, co umie wasza aplikacja i co dodaliście od siebie

Termin: **22.11.26 14:00**.

# **Zasady**

* Zadanie jest dla całej drużyny.
* Technologia dowolna.
* Możecie korzystać z AI.
* Pytania: e-mail: **oliwia.pawledzio@best.gdansk.pl**
