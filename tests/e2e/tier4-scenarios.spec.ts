import { expect, test } from '@playwright/test';
import {
  attachErrorGuards,
  createTaskViaModal,
  doubleClickNoteAndVerifyNoModal,
  dragPostItToCell,
  dragPostItToTrash,
  editTaskViaModal,
  exportArchiveJson,
  exportTasksJson,
  formatLocalDateOffset,
  getCompletedCountFromBar,
  grabAndDropFloorBallIntoTrash,
  grabAndThrowFloorBallIntoTrashArc,
  readArchiveFromLocalStorage,
  startFreshApp,
  uploadTasksJson,
  uploadTasksJsonPayload,
  waitForFloorBallSettled,
} from './helpers';

test.describe('Tier 4 — Real-World Student & Competition Judge Scenarios', () => {
  test('T4-01: Scenariusz 1: Poranny przegląd kolokwiów i priorytetów', async ({ page }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    // 1. Verify initial 3x5 board and overdue stamps
    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(16);
    expect(await getCompletedCountFromBar(page)).toBe(4);
    await expect(page.getByTestId('postit-overdue-stamp-1')).toBeVisible();

    // 2. Filter by "studia" tag + search "kolokwium" to isolate overdue exam task 1
    await page.getByTestId('tag-filter-studia').click();
    await page.getByTestId('search-input').fill('kolokwium');
    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(1);
    await expect(page.getByTestId('postit-note-1')).toBeVisible();

    // 3. Reset filters and reschedule task 1 to today
    await page.getByTestId('tag-filter-reset').click();
    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(16);

    const todayStr = formatLocalDateOffset(0);
    await editTaskViaModal(page, 1, {
      tytul: 'Kolokwium z sieci komputerowych — drugi termin dziś',
      opis: 'Powtórzyć routing OSPF, BGP oraz adresację IPv6',
      termin: todayStr,
      priorytet: 'wysoki',
    });
    await expect(page.getByTestId('postit-overdue-stamp-1')).toHaveCount(0);
    await expect(
      page.getByTestId('zone-cell-wysoki-todayTomorrow').getByTestId('postit-note-1'),
    ).toBeVisible();

    // 4. Drag task 15 (sredni, noDeadline) to wysoki-thisWeek
    await dragPostItToCell(page, 15, 'wysoki', 'thisWeek');
    await expect(page.getByTestId('postit-note-15')).toHaveAttribute('data-priority', 'wysoki');
    await expect(page.getByTestId('postit-note-15')).toHaveAttribute('data-zone', 'thisWeek');

    // 5. Add new exam task 21
    await createTaskViaModal(page, {
      tytul: 'Kolokwium zaliczeniowe z kryptografii',
      opis: 'Szyfry blokowe, RSA i podpisy cyfrowe',
      termin: formatLocalDateOffset(5),
      priorytet: 'wysoki',
      tagi: ['studia', 'egzamin'],
    });
    await expect(page.getByTestId('postit-note-21')).toBeVisible();

    // 6. Reload and confirm full persistence
    await page.reload();
    await expect(page.getByTestId('corkboard')).toBeVisible();
    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(17);
    await expect(page.getByTestId('postit-overdue-stamp-1')).toHaveCount(0);
    await expect(
      page.getByTestId('zone-cell-wysoki-todayTomorrow').getByTestId('postit-note-1'),
    ).toBeVisible();
    await expect(
      page.getByTestId('zone-cell-wysoki-thisWeek').getByTestId('postit-note-15'),
    ).toBeVisible();
    await expect(
      page.getByTestId('zone-cell-wysoki-thisWeek').getByTestId('postit-note-21'),
    ).toBeVisible();

    guard.assertNoErrors();
  });

  test('T4-02: Scenariusz 2: Sesja sprzątania tablicy — wielokrotny rzut kulkami do kosza', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    // 1. Double-click 4 active notes in sequence without any edit modal flash
    for (const id of [1, 2, 6, 7]) {
      await doubleClickNoteAndVerifyNoModal(page, id);
    }
    for (const id of [1, 2, 6, 7]) {
      await waitForFloorBallSettled(page, id);
    }
    await expect(page.locator('[data-testid^="floor-ball-"]:not([data-testid^="floor-ball-tooltip-"])')).toHaveCount(4);
    expect(await getCompletedCountFromBar(page)).toBe(8);

    // 2. Throw 2 balls into the enlarging trash can (1 direct drop, 1 airborne arc throw)
    await grabAndDropFloorBallIntoTrash(page, 1);
    await grabAndThrowFloorBallIntoTrashArc(page, 2);
    await expect(page.locator('[data-testid^="floor-ball-"]:not([data-testid^="floor-ball-tooltip-"])')).toHaveCount(2);

    // 3. Restore ball 6 back to the corkboard via floor-ball right-click menu
    await page.getByTestId('floor-ball-6').click({ button: 'right' });
    await page.getByTestId('context-menu-restore').click();
    await expect(page.getByTestId('postit-note-6')).toBeVisible();
    await expect(page.locator('[data-testid^="floor-ball-"]:not([data-testid^="floor-ball-tooltip-"])')).toHaveCount(1);
    expect(await getCompletedCountFromBar(page)).toBe(7);

    // 4. Leave floor-ball-7 on the floor and press F5 reload -> moves into trash
    await page.reload();
    await expect(page.getByTestId('corkboard')).toBeVisible();
    await expect(page.locator('[data-testid^="floor-ball-"]:not([data-testid^="floor-ball-tooltip-"])')).toHaveCount(0);
    await expect(page.getByTestId('postit-note-6')).toBeVisible();
    expect(await getCompletedCountFromBar(page)).toBe(7);

    await page.getByTestId('trash-can-widget').click();
    await expect(page.getByTestId('trash-modal')).toBeVisible();
    for (const trashId of [1, 2, 7, 17, 18, 19, 20]) {
      await expect(page.getByTestId(`trash-ball-${trashId}`)).toBeVisible();
    }
    await page.getByTestId('btn-close-trash').click();

    guard.assertNoErrors();
  });

  test('T4-03: Scenariusz 3: Organizator konkursu — pełny test round-trip zadania.json v2', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    // 1. Import competition fixture valid-v2.json (wersja: 2, 4 active, 2 completed)
    await uploadTasksJson(page, 'valid-v2.json');
    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(4);
    expect(await getCompletedCountFromBar(page)).toBe(2);

    // 2. Perform CRUD + DnD + completion mutations
    await editTaskViaModal(page, 101, {
      tytul: 'Obrona projektu z inżynierii oprogramowania — komisja A',
    });
    await dragPostItToCell(page, 104, 'sredni', 'todayTomorrow');
    await dragPostItToTrash(page, 103);

    await createTaskViaModal(page, {
      tytul: 'Nowe zadanie dodane przez jurora konkursu',
      opis: 'Weryfikacja pełnego cyklu zapisu i odczytu JSON',
      termin: formatLocalDateOffset(3),
      priorytet: 'wysoki',
      tagi: ['konkurs'],
    });
    await expect(page.getByTestId('postit-note-107')).toBeVisible();
    expect(await getCompletedCountFromBar(page)).toBe(3);

    // 3. Export zadania.json and verify strict 7-field competition schema & wersja: 2
    const exported = await exportTasksJson(page, 2);
    expect(exported.data.wersja).toBe(2);
    expect(exported.data.zadania).toHaveLength(7);

    // 4. Wipe board with empty-tasks.json, then re-import exported JSON payload
    await uploadTasksJson(page, 'empty-tasks.json');
    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(0);
    expect(await getCompletedCountFromBar(page)).toBe(0);

    await uploadTasksJsonPayload(page, 'zadania-roundtrip.json', exported.rawText);

    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(4);
    for (const activeId of [101, 102, 104, 107]) {
      await expect(page.getByTestId(`postit-note-${activeId}`)).toBeVisible();
    }
    await expect(page.getByTestId('postit-note-101')).toContainText(
      'Obrona projektu z inżynierii oprogramowania — komisja A',
    );
    await expect(page.getByTestId('postit-note-104')).toHaveAttribute('data-priority', 'sredni');
    await expect(page.getByTestId('postit-note-104')).toHaveAttribute('data-zone', 'todayTomorrow');
    expect(await getCompletedCountFromBar(page)).toBe(3);

    guard.assertNoErrors();
  });

  test('T4-04: Scenariusz 4: Archiwizacja ukończonego tygodnia i analiza podsumowania', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    // 1. Complete 2 more tasks (1 via direct drag to trash, 1 via double-click to floor)
    await dragPostItToTrash(page, 4);
    await doubleClickNoteAndVerifyNoModal(page, 8);
    await waitForFloorBallSettled(page, 8);
    expect(await getCompletedCountFromBar(page)).toBe(6);

    // 2. Open TrashModal, sweep floor ball 8 into trash, and open EmptySummaryModal
    await page.getByTestId('trash-can-widget').click();
    await expect(page.getByTestId('trash-modal')).toBeVisible();
    await page.getByTestId('btn-sweep-floor').click();
    await expect(page.getByTestId('trash-ball-8')).toBeVisible();

    await page.getByTestId('btn-empty-trash').click();
    const summaryModal = page.getByTestId('empty-summary-modal');
    await expect(summaryModal).toBeVisible();

    // 3. Confirm emptying trash -> tasks move from main zadania to archive
    await page.getByTestId('btn-confirm-empty-trash').click();
    if ((await page.getByTestId('trash-modal').count()) > 0) {
      await page.getByTestId('btn-close-trash').click();
    }

    expect(await getCompletedCountFromBar(page)).toBe(0);
    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(14);

    // 4. Verify exported zadania.json contains strictly the 14 active tasks
    const exportedMain = await exportTasksJson(page, 1);
    expect(exportedMain.data.zadania).toHaveLength(14);
    expect(exportedMain.data.zadania.every((t) => !t.wykonane)).toBe(true);

    // 5. Open ArchiveModal, verify 6 archived items, export archiwum_usunietych.json, and reload
    await page.getByTestId('btn-open-archive').click();
    await expect(page.getByTestId('archive-modal')).toBeVisible();
    for (let i = 0; i < 6; i += 1) {
      await expect(page.getByTestId(`archive-entry-${i}`)).toBeVisible();
    }

    const exportedArchive = await exportArchiveJson(page);
    expect(exportedArchive.data.archiwum).toHaveLength(6);
    expect(exportedArchive.data.archiwum.map((e) => e.task.id).sort((a, b) => a - b)).toEqual([
      4, 8, 17, 18, 19, 20,
    ]);
    await page.getByTestId('btn-close-archive').click();

    await page.reload();
    expect((await readArchiveFromLocalStorage(page)).archiwum).toHaveLength(6);

    guard.assertNoErrors();
  });

  test('T4-05: Scenariusz 5: Praca z filtrami, edycją i cofaniem pomyłkowego ukończenia', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    // 1. Toggle mute, switch to highlight mode, and filter by tag "projekt"
    await page.getByTestId('btn-toggle-mute').click();
    await page.getByTestId('filter-mode-toggle').click();
    await page.getByTestId('tag-filter-projekt').click();

    await expect(page.getByTestId('postit-note-8')).toHaveAttribute('data-dimmed', 'false');
    await expect(page.getByTestId('postit-note-1')).toHaveAttribute('data-dimmed', 'true');

    // 2. Accidentally double-click note 8 -> crumples to floor -> immediately restore via floor-ball PPM
    await doubleClickNoteAndVerifyNoModal(page, 8);
    await waitForFloorBallSettled(page, 8);
    expect(await getCompletedCountFromBar(page)).toBe(5);

    await page.getByTestId('floor-ball-8').click({ button: 'right' });
    await page.getByTestId('context-menu-restore').click();
    await expect(page.getByTestId('postit-note-8')).toBeVisible();
    await expect(page.getByTestId('postit-note-8')).toHaveAttribute('data-dimmed', 'false');
    expect(await getCompletedCountFromBar(page)).toBe(4);

    // 3. Permanently delete task 16 via board PPM
    await page.getByTestId('postit-note-16').click({ button: 'right' });
    await page.getByTestId('context-menu-delete').click();
    await expect(page.getByTestId('postit-note-16')).toHaveCount(0);

    // 4. Reset filters and edit task 14 to add a deadline and new tag "kariera"
    await page.getByTestId('tag-filter-reset').click();
    const tomorrowStr = formatLocalDateOffset(1);
    await editTaskViaModal(page, 14, {
      tytul: 'Zaktualizować CV i profil GitHub przed targami pracy',
      termin: tomorrowStr,
      tagi: ['kariera'],
    });
    await expect(page.getByTestId('postit-note-14')).toHaveAttribute('data-zone', 'todayTomorrow');
    await expect(page.getByTestId('tag-filter-kariera')).toBeVisible();

    // 5. Verify exported zadania.json has 19 tasks and archive remains empty
    const exported = await exportTasksJson(page, 1);
    expect(exported.data.zadania).toHaveLength(19);
    expect(exported.data.zadania.some((t) => t.id === 16)).toBe(false);
    expect(exported.data.zadania.find((t) => t.id === 8)?.wykonane).toBe(false);
    expect(exported.data.zadania.find((t) => t.id === 14)?.tagi).toContain('kariera');

    const archive = await readArchiveFromLocalStorage(page);
    expect(archive.archiwum).toHaveLength(0);

    guard.assertNoErrors();
  });
});
