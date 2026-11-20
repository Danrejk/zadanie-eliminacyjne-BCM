import { expect, test } from '@playwright/test';
import {
  attachErrorGuards,
  createTaskViaModal,
  dragPostItToCell,
  dragPostItToTrash,
  editTaskViaModal,
  exportArchiveJson,
  exportTasksJson,
  formatLocalDateOffset,
  getCompletedCountFromBar,
  grabAndDropFloorBallIntoTrash,
  readArchiveFromLocalStorage,
  startFreshApp,
  uploadTasksJson,
  waitForFloorBallSettled,
} from './helpers';

test.describe('Tier 3 — Cross-Feature Pairwise Combinations', () => {
  test('T3-01: create task with new tag -> appears in TopBar filter -> filter & edit tags -> nail/pin transition', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    await createTaskViaModal(page, {
      tytul: 'Prezentacja finałowa konkursu',
      opis: 'Przygotować slajdy i scenariusz wystąpienia',
      termin: formatLocalDateOffset(3),
      priorytet: 'wysoki',
      tagi: ['konkurs'],
    });

    const note21 = page.getByTestId('postit-note-21');
    await expect(note21).toBeVisible();
    await expect(page.getByTestId('pushpin-21-0')).toBeVisible();
    await expect(page.getByTestId('nail-pin-21')).toHaveCount(0);

    // Newly introduced tag chip appears in TopBar and filters the board
    const konkursFilter = page.getByTestId('tag-filter-konkurs');
    await expect(konkursFilter).toBeVisible();
    await konkursFilter.click();
    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(1);
    await expect(note21).toBeVisible();

    // Edit note 21 to remove its only tag -> transitions from colored pushpin to headless nail
    await editTaskViaModal(page, 21, {
      tytul: 'Prezentacja finałowa konkursu (bez tagów)',
      removeTags: ['konkurs'],
    });

    await page.getByTestId('tag-filter-reset').click();
    await expect(note21).toBeVisible();
    await expect(page.getByTestId('nail-pin-21')).toBeVisible();
    await expect(page.locator('[data-testid^="pushpin-21-"]')).toHaveCount(0);

    // Edit note 21 to add 2 tags -> transitions back from headless nail to 2 colored pushpins
    await editTaskViaModal(page, 21, {
      tytul: 'Prezentacja finałowa konkursu (2 tagi)',
      tagi: ['studia', 'projekt'],
    });
    await expect(page.getByTestId('nail-pin-21')).toHaveCount(0);
    await expect(page.getByTestId('pushpin-21-0')).toBeVisible();
    await expect(page.getByTestId('pushpin-21-1')).toBeVisible();

    guard.assertNoErrors();
  });

  test('T3-02: search + multi-tag OR filter + highlight mode + drag note across zones', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    // Multi-tag selection uses OR semantics: "zdrowie" (id 10) OR "finanse" (ids 6, 12) -> 3 tasks
    await page.getByTestId('tag-filter-zdrowie').click();
    await page.getByTestId('tag-filter-finanse').click();
    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(3);
    for (const id of [6, 10, 12]) {
      await expect(page.getByTestId(`postit-note-${id}`)).toBeVisible();
    }

    // Toggle to highlight mode -> all 16 active notes visible, matching ones undimmed
    await page.getByTestId('filter-mode-toggle').click();
    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(16);
    for (const matchId of [6, 10, 12]) {
      await expect(page.getByTestId(`postit-note-${matchId}`)).toHaveAttribute(
        'data-dimmed',
        'false',
      );
    }
    await expect(page.getByTestId('postit-note-1')).toHaveAttribute('data-dimmed', 'true');

    // Combine with search query "akademik" (AND with selectedTags) -> only task 6 stays undimmed
    await page.getByTestId('search-input').fill('akademik');
    await expect(page.getByTestId('postit-note-6')).toHaveAttribute('data-dimmed', 'false');
    await expect(page.getByTestId('postit-note-10')).toHaveAttribute('data-dimmed', 'true');
    await expect(page.getByTestId('postit-note-12')).toHaveAttribute('data-dimmed', 'true');

    // Drag highlighted task 6 across priority and time zones while filter is active
    await dragPostItToCell(page, 6, 'wysoki', 'thisWeek');
    await expect(page.getByTestId('postit-note-6')).toHaveAttribute('data-priority', 'wysoki');
    await expect(page.getByTestId('postit-note-6')).toHaveAttribute('data-zone', 'thisWeek');
    await expect(page.getByTestId('postit-note-6')).toHaveAttribute('data-dimmed', 'false');

    guard.assertNoErrors();
  });

  test('T3-03: crumple 3 notes -> export JSON -> throw 1, restore 1 via PPM, reload F5 -> verify trash & export parity', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    for (const id of [1, 2, 6]) {
      await page.getByTestId(`postit-note-${id}`).dblclick();
    }
    for (const id of [1, 2, 6]) {
      await waitForFloorBallSettled(page, id);
    }
    expect(await getCompletedCountFromBar(page)).toBe(7);

    // Export while all 3 sit on floor -> all 3 are marked wykonane: true with strict 7-field schema
    const firstExport = await exportTasksJson(page, 1);
    for (const id of [1, 2, 6]) {
      expect(firstExport.data.zadania.find((t) => t.id === id)?.wykonane).toBe(true);
    }

    // Throw ball 1 into trash
    await grabAndDropFloorBallIntoTrash(page, 1);

    // Restore ball 2 back to corkboard via floor-ball PPM
    await page.getByTestId('floor-ball-2').click({ button: 'right' });
    await page.getByTestId('context-menu-restore').click();
    await expect(page.getByTestId('postit-note-2')).toBeVisible();
    expect(await getCompletedCountFromBar(page)).toBe(6);

    // Reload page with ball 6 still sitting on floor -> ball 6 moves into trash
    await page.reload();
    await expect(page.getByTestId('corkboard')).toBeVisible();
    await expect(page.locator('[data-testid^="floor-ball-"]:not([data-testid^="floor-ball-tooltip-"])')).toHaveCount(0);
    await expect(page.getByTestId('postit-note-2')).toBeVisible();
    expect(await getCompletedCountFromBar(page)).toBe(6);

    await page.getByTestId('trash-can-widget').click();
    await expect(page.getByTestId('trash-ball-1')).toBeVisible();
    await expect(page.getByTestId('trash-ball-6')).toBeVisible();
    await expect(page.getByTestId('trash-ball-2')).toHaveCount(0);
    await page.getByTestId('btn-close-trash-drawer').click();

    const secondExport = await exportTasksJson(page, 1);
    expect(secondExport.data.zadania.find((t) => t.id === 1)?.wykonane).toBe(true);
    expect(secondExport.data.zadania.find((t) => t.id === 2)?.wykonane).toBe(false);
    expect(secondExport.data.zadania.find((t) => t.id === 6)?.wykonane).toBe(true);

    guard.assertNoErrors();
  });

  test('T3-04: import external JSON v2 -> edit -> direct drag to trash -> empty to archive -> export both JSONs', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    await uploadTasksJson(page, 'valid-v2.json');
    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(4);
    expect(await getCompletedCountFromBar(page)).toBe(2);

    // Edit active task 102
    await editTaskViaModal(page, 102, {
      tytul: 'Rozwiązać zestaw zadań z analizy — zaktualizowane',
      priorytet: 'wysoki',
    });

    // Direct-drag active task 104 to trash
    await dragPostItToTrash(page, 104);
    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(3);
    expect(await getCompletedCountFromBar(page)).toBe(3);

    // Empty trash into archive
    await page.getByTestId('trash-can-widget').click();
    await page.getByTestId('btn-empty-trash').click();
    await page.getByTestId('btn-confirm-empty-trash').click();
    if ((await page.getByTestId('trash-drawer').count()) > 0) {
      await page.getByTestId('btn-close-trash-drawer').click();
    }
    expect(await getCompletedCountFromBar(page)).toBe(0);

    // Export main zadania.json (preserves wersja: 2 and contains strictly the 3 remaining active tasks)
    const exportedTasks = await exportTasksJson(page, 2);
    expect(exportedTasks.data.wersja).toBe(2);
    expect(exportedTasks.data.zadania.map((t) => t.id).sort((a, b) => a - b)).toEqual([
      101, 102, 103,
    ]);
    const task102 = exportedTasks.data.zadania.find((t) => t.id === 102);
    expect(task102?.tytul).toBe('Rozwiązać zestaw zadań z analizy — zaktualizowane');
    expect(task102?.priorytet).toBe('wysoki');

    // Open ArchiveModal and export archiwum_usunietych.json (contains 104, 105, 106)
    await page.getByTestId('btn-open-archive').click();
    await expect(page.getByTestId('archive-modal')).toBeVisible();
    const exportedArchive = await exportArchiveJson(page);
    expect(exportedArchive.data.archiwum.map((e) => e.task.id).sort((a, b) => a - b)).toEqual([
      104, 105, 106,
    ]);
    await page.getByTestId('btn-close-archive').click();

    guard.assertNoErrors();
  });

  test('T3-05: archive persistence survives reload and subsequent main zadania.json import', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    // Empty initial 4 trash tasks (17..20) to archive
    await page.getByTestId('trash-can-widget').click();
    await page.getByTestId('btn-empty-trash').click();
    await page.getByTestId('btn-confirm-empty-trash').click();
    if ((await page.getByTestId('trash-drawer').count()) > 0) {
      await page.getByTestId('btn-close-trash-drawer').click();
    }

    await page.reload();
    await expect(page.getByTestId('corkboard')).toBeVisible();
    expect((await readArchiveFromLocalStorage(page)).archiwum).toHaveLength(4);

    // Importing a new main zadania.json file must NOT wipe the separate archive storage
    await uploadTasksJson(page, 'valid-v2.json');
    expect((await readArchiveFromLocalStorage(page)).archiwum).toHaveLength(4);

    await page.getByTestId('btn-open-archive').click();
    await expect(page.getByTestId('archive-modal')).toBeVisible();
    for (let i = 0; i < 4; i += 1) {
      await expect(page.getByTestId(`archive-entry-${i}`)).toBeVisible();
    }
    await page.getByTestId('btn-close-archive').click();

    guard.assertNoErrors();
  });

  test('T3-06: invalid JSON import after unsaved-to-file mutations preserves localStorage edits', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    await createTaskViaModal(page, {
      tytul: 'Notatka z wykładu o kompilatorach',
      termin: null,
      priorytet: 'wysoki',
      tagi: ['studia'],
    });
    await editTaskViaModal(page, 1, {
      tytul: 'Kolokwium z sieci — termin przesunięty',
    });

    await uploadTasksJson(page, 'invalid-priority.json');
    await expect(page.getByTestId('toast-notification')).toBeVisible();

    await uploadTasksJson(page, 'invalid-syntax.json');
    await expect(page.getByTestId('toast-notification')).toBeVisible();

    await expect(page.getByTestId('postit-note-21')).toContainText(
      'Notatka z wykładu o kompilatorach',
    );
    await expect(page.getByTestId('postit-note-1')).toContainText(
      'Kolokwium z sieci — termin przesunięty',
    );

    await page.reload();
    await expect(page.getByTestId('postit-note-21')).toBeVisible();
    await expect(page.getByTestId('postit-note-1')).toContainText(
      'Kolokwium z sieci — termin przesunięty',
    );

    guard.assertNoErrors();
  });

  test('T3-07: sweep floor balls inside TrashModal -> restore one -> delete one -> empty rest to archive', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    await page.getByTestId('postit-note-1').dblclick();
    await page.getByTestId('postit-note-4').dblclick();
    await waitForFloorBallSettled(page, 1);
    await waitForFloorBallSettled(page, 4);
    expect(await getCompletedCountFromBar(page)).toBe(6);

    await page.getByTestId('trash-can-widget').click();
    await expect(page.getByTestId('trash-drawer')).toBeVisible();

    // Sweep floor balls 1 & 4 into trash bin
    await page.getByTestId('btn-sweep-floor').click();
    await expect(page.locator('[data-testid^="floor-ball-"]:not([data-testid^="floor-ball-tooltip-"])')).toHaveCount(0);
    await expect(page.getByTestId('trash-ball-1')).toBeVisible();
    await expect(page.getByTestId('trash-ball-4')).toBeVisible();

    // Restore ball 1 back to board
    await page.getByTestId('trash-ball-1').click({ button: 'right' });
    await page.getByTestId('context-menu-restore').click();
    await expect(page.getByTestId('trash-ball-1')).toHaveCount(0);

    // Permanently delete ball 4
    await page.getByTestId('trash-ball-4').click({ button: 'right' });
    await page.getByTestId('context-menu-delete').click();
    await expect(page.getByTestId('trash-ball-4')).toHaveCount(0);

    // Empty remaining 4 trash tasks (17..20) to archive
    await page.getByTestId('btn-empty-trash').click();
    await page.getByTestId('btn-confirm-empty-trash').click();
    if ((await page.getByTestId('trash-drawer').count()) > 0) {
      await page.getByTestId('btn-close-trash-drawer').click();
    }

    await expect(page.getByTestId('postit-note-1')).toBeVisible();
    await expect(page.getByTestId('postit-note-4')).toHaveCount(0);
    expect(await getCompletedCountFromBar(page)).toBe(0);

    const archive = await readArchiveFromLocalStorage(page);
    expect(archive.archiwum.map((e) => e.task.id).sort((a, b) => a - b)).toEqual([17, 18, 19, 20]);

    guard.assertNoErrors();
  });

  test('T3-08: edit overdue task to future removes red stamp, backdating another adds red stamp + reload', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    await expect(page.getByTestId('postit-overdue-stamp-1')).toBeVisible();
    await expect(page.getByTestId('postit-overdue-stamp-4')).toHaveCount(0);

    // Move overdue task 1 to future (+4d -> thisWeek) -> overdue stamp disappears
    await editTaskViaModal(page, 1, {
      tytul: 'Kolokwium z sieci komputerowych (nowy termin)',
      termin: formatLocalDateOffset(4),
    });
    await expect(page.getByTestId('postit-note-1')).toHaveAttribute('data-zone', 'thisWeek');
    await expect(page.getByTestId('postit-overdue-stamp-1')).toHaveCount(0);

    // Backdate task 4 to past (-2d -> overdue) -> overdue stamp appears
    await editTaskViaModal(page, 4, {
      tytul: 'Oddać projekt z baz danych (zaległy)',
      termin: formatLocalDateOffset(-2),
    });
    await expect(page.getByTestId('postit-note-4')).toHaveAttribute('data-zone', 'overdue');
    await expect(page.getByTestId('postit-overdue-stamp-4')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('postit-overdue-stamp-1')).toHaveCount(0);
    await expect(page.getByTestId('postit-overdue-stamp-4')).toBeVisible();

    guard.assertNoErrors();
  });
});
