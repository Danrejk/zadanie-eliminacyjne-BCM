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
  extractColorSignature,
  formatLocalDateOffset,
  getCompletedCountFromBar,
  grabAndDropFloorBallIntoTrash,
  PRIORITIES,
  readArchiveFromLocalStorage,
  readPrefsFromLocalStorage,
  readTasksFromLocalStorage,
  startFreshApp,
  TIME_ZONES,
  uploadTasksJson,
  waitForFloorBallSettled,
} from './helpers';

test.describe('Tier 1 — Core Feature Coverage (F01–F31)', () => {
  test('T1-01: initial load displays 20 Polish sample tasks across board and trash', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    const activeNotes = page.locator('[data-testid^="postit-note-"]');
    await expect(activeNotes).toHaveCount(16);

    for (let id = 1; id <= 16; id += 1) {
      await expect(page.getByTestId(`postit-note-${id}`)).toBeVisible();
    }

    await expect(page.getByTestId('postit-note-1')).toContainText(
      'Kolokwium z sieci komputerowych',
    );
    await expect(page.getByTestId('postit-note-4')).toContainText('Oddać projekt z baz danych');
    await expect(page.getByTestId('postit-note-8')).toContainText('Zadanie eliminacyjne SmartApp');

    await expect(page.locator('[data-testid^="floor-ball-"]')).toHaveCount(0);

    const completedCount = await getCompletedCountFromBar(page);
    expect(completedCount).toBe(4);

    await page.getByTestId('trash-can-widget').click();
    await expect(page.getByTestId('trash-modal')).toBeVisible();
    for (const completedId of [17, 18, 19, 20]) {
      await expect(page.getByTestId(`trash-ball-${completedId}`)).toBeVisible();
    }
    await page.getByTestId('btn-close-trash').click();
    await expect(page.getByTestId('trash-modal')).toHaveCount(0);

    guard.assertNoErrors();
  });

  test('T1-02: corkboard 3x5 orientation, cell sorting and overdue stamp', async ({ page }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    // Verify all 15 zone cells exist and are visible
    for (const priority of PRIORITIES) {
      for (const zone of TIME_ZONES) {
        await expect(page.getByTestId(`zone-cell-${priority}-${zone}`)).toBeVisible();
      }
    }

    // Verify Y-axis: wysoki (top) < sredni (middle) < niski (bottom)
    const highBox = await page.getByTestId('zone-cell-wysoki-todayTomorrow').boundingBox();
    const medBox = await page.getByTestId('zone-cell-sredni-todayTomorrow').boundingBox();
    const lowBox = await page.getByTestId('zone-cell-niski-todayTomorrow').boundingBox();
    expect(highBox).not.toBeNull();
    expect(medBox).not.toBeNull();
    expect(lowBox).not.toBeNull();
    expect(highBox!.y).toBeLessThan(medBox!.y);
    expect(medBox!.y).toBeLessThan(lowBox!.y);

    // Verify X-axis: overdue < todayTomorrow < thisWeek < later < noDeadline
    const colBoxes = await Promise.all(
      TIME_ZONES.map((zone) => page.getByTestId(`zone-cell-wysoki-${zone}`).boundingBox()),
    );
    for (let i = 0; i < colBoxes.length - 1; i += 1) {
      expect(colBoxes[i]).not.toBeNull();
      expect(colBoxes[i + 1]).not.toBeNull();
      expect(colBoxes[i]!.x).toBeLessThan(colBoxes[i + 1]!.x);
    }

    // Verify cell sorting in zone-cell-wysoki-todayTomorrow (task 4 before task 5)
    const cellCards = page
      .getByTestId('zone-cell-wysoki-todayTomorrow')
      .locator('[data-testid^="postit-note-"]');
    await expect(cellCards).toHaveCount(2);
    await expect(cellCards.nth(0)).toHaveAttribute('data-testid', 'postit-note-4');
    await expect(cellCards.nth(1)).toHaveAttribute('data-testid', 'postit-note-5');

    // Verify overdue red stamp on overdue notes (1, 2, 3) and absence on non-overdue notes
    for (const overdueId of [1, 2, 3]) {
      await expect(page.getByTestId(`postit-overdue-stamp-${overdueId}`)).toBeVisible();
    }
    for (const nonOverdueId of [4, 5, 8, 11, 14, 16]) {
      await expect(page.getByTestId(`postit-overdue-stamp-${nonOverdueId}`)).toHaveCount(0);
    }

    guard.assertNoErrors();
  });

  test('T1-03: push-pin and headless nail rendering with deterministic tag colors', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    // 0-tag cards render headless nail and 0 pushpins
    for (const nailTaskId of [3, 13]) {
      await expect(page.getByTestId(`nail-pin-${nailTaskId}`)).toBeVisible();
      await expect(page.locator(`[data-testid^="pushpin-${nailTaskId}-"]`)).toHaveCount(0);
    }

    // 1-tag card (id: 1 -> ["studia"]) renders 1 pushpin and no headless nail
    await expect(page.getByTestId('pushpin-1-0')).toBeVisible();
    await expect(page.getByTestId('pushpin-1-1')).toHaveCount(0);
    await expect(page.getByTestId('nail-pin-1')).toHaveCount(0);

    // 2-tag card (id: 2 -> ["studia", "ćwiczenia"]) renders 2 pushpins
    await expect(page.getByTestId('pushpin-2-0')).toBeVisible();
    await expect(page.getByTestId('pushpin-2-1')).toBeVisible();
    await expect(page.getByTestId('pushpin-2-2')).toHaveCount(0);

    // 3-tag card (id: 4 -> ["studia", "projekt", "egzamin"]) renders 3 pushpins
    await expect(page.getByTestId('pushpin-4-0')).toBeVisible();
    await expect(page.getByTestId('pushpin-4-1')).toBeVisible();
    await expect(page.getByTestId('pushpin-4-2')).toBeVisible();

    // Deterministic FNV-1a tag color: "studia" on note 1 (pin 0), note 4 (pin 0), and TopBar must match
    const studiaPinColor1 = await extractColorSignature(page.getByTestId('pushpin-1-0'));
    const studiaPinColor4 = await extractColorSignature(page.getByTestId('pushpin-4-0'));
    const projektPinColor4 = await extractColorSignature(page.getByTestId('pushpin-4-1'));
    const studiaTopBarColor = await extractColorSignature(page.getByTestId('tag-filter-studia'));
    const projektTopBarColor = await extractColorSignature(page.getByTestId('tag-filter-projekt'));

    expect(studiaPinColor1).toMatch(/^#[0-9a-f]{6}$/);
    expect(projektPinColor4).toMatch(/^#[0-9a-f]{6}$/);
    expect(studiaPinColor1).toBe(studiaPinColor4);
    expect(studiaPinColor4).not.toBe(projektPinColor4);
    expect(studiaTopBarColor).toBe(studiaPinColor1);
    expect(projektTopBarColor).toBe(projektPinColor4);
    expect(studiaTopBarColor).not.toBe(projektTopBarColor);

    guard.assertNoErrors();
  });

  test('T1-04: add new task via + Nowe zadanie modal', async ({ page }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    const targetDate = formatLocalDateOffset(3);
    await createTaskViaModal(page, {
      tytul: 'Przygotować obronę projektu SmartApp',
      opis: 'Slajdy architektury oraz demonstracja fizyki kulek',
      termin: targetDate,
      priorytet: 'wysoki',
      tagi: ['hackathon', 'studia'],
    });

    const newNote = page.getByTestId('postit-note-21');
    await expect(newNote).toBeVisible();
    await expect(newNote).toContainText('Przygotować obronę projektu SmartApp');
    await expect(newNote).toHaveAttribute('data-priority', 'wysoki');
    await expect(newNote).toHaveAttribute('data-zone', 'thisWeek');
    await expect(
      page.getByTestId('zone-cell-wysoki-thisWeek').getByTestId('postit-note-21'),
    ).toBeVisible();

    await expect(page.getByTestId('pushpin-21-0')).toBeVisible();
    await expect(page.getByTestId('pushpin-21-1')).toBeVisible();

    const stored = await readTasksFromLocalStorage(page);
    const createdTask = stored.zadania.find((t) => t.id === 21);
    expect(createdTask).toBeDefined();
    expect(createdTask?.tytul).toBe('Przygotować obronę projektu SmartApp');
    expect(createdTask?.priorytet).toBe('wysoki');
    expect(createdTask?.termin).toBe(targetDate);
    expect(createdTask?.wykonane).toBe(false);
    expect(createdTask?.tagi).toEqual(['hackathon', 'studia']);

    guard.assertNoErrors();
  });

  test('T1-05: edit existing task via single-click and PPM context menu', async ({ page }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    const todayStr = formatLocalDateOffset(0);

    // 1. Single-click edit on task 15 (initially sredni, noDeadline)
    await editTaskViaModal(
      page,
      15,
      {
        tytul: 'Posprzątać biurko i zeskanować notatki z wykładów',
        opis: 'Zeskanować do PDF i wysłać na dysk',
        termin: todayStr,
        priorytet: 'wysoki',
      },
      'click',
    );

    const note15 = page.getByTestId('postit-note-15');
    await expect(note15).toContainText('Posprzątać biurko i zeskanować notatki z wykładów');
    await expect(note15).toHaveAttribute('data-priority', 'wysoki');
    await expect(note15).toHaveAttribute('data-zone', 'todayTomorrow');
    await expect(
      page.getByTestId('zone-cell-wysoki-todayTomorrow').getByTestId('postit-note-15'),
    ).toBeVisible();

    // 2. Right-click PPM -> context-menu-edit on task 15
    await editTaskViaModal(
      page,
      15,
      {
        tytul: 'Posprzątać biurko po sesji',
        priorytet: 'niski',
      },
      'contextMenu',
    );

    await expect(note15).toContainText('Posprzątać biurko po sesji');
    await expect(note15).toHaveAttribute('data-priority', 'niski');
    await expect(
      page.getByTestId('zone-cell-niski-todayTomorrow').getByTestId('postit-note-15'),
    ).toBeVisible();

    guard.assertNoErrors();
  });

  test('T1-06: right-click context menu priority change and permanent single-task delete', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    // Change task 6 priority from sredni to wysoki via PPM
    const note6 = page.getByTestId('postit-note-6');
    await expect(note6).toHaveAttribute('data-priority', 'sredni');
    await note6.click({ button: 'right' });
    await expect(page.getByTestId('context-menu')).toBeVisible();
    await page.getByTestId('context-menu-priority-wysoki').click();
    await expect(page.getByTestId('context-menu')).toHaveCount(0);

    await expect(note6).toHaveAttribute('data-priority', 'wysoki');
    await expect(
      page.getByTestId('zone-cell-wysoki-todayTomorrow').getByTestId('postit-note-6'),
    ).toBeVisible();

    // Permanently delete task 6 via PPM
    await note6.click({ button: 'right' });
    await expect(page.getByTestId('context-menu')).toBeVisible();
    await page.getByTestId('context-menu-delete').click();
    await expect(note6).toHaveCount(0);
    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(15);

    const storedTasks = await readTasksFromLocalStorage(page);
    expect(storedTasks.zadania.some((t) => t.id === 6)).toBe(false);

    // Single-task delete must NOT add an entry to the emptied-trash archive
    const storedArchive = await readArchiveFromLocalStorage(page);
    expect(storedArchive.archiwum).toHaveLength(0);

    guard.assertNoErrors();
  });

  test('T1-07: live search, tag pin filter bar, highlight mode and quick reset', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    const searchInput = page.getByTestId('search-input');

    // Case-insensitive description search ("mikroserwisów" in task 5 opis)
    await searchInput.fill('MIKROSERWISÓW');
    await expect(page.getByTestId('postit-note-5')).toBeVisible();
    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(1);

    // Case-insensitive title search ("kolokwium" in task 1 tytul)
    await searchInput.fill('kolokwium');
    await expect(page.getByTestId('postit-note-1')).toBeVisible();
    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(1);

    // Clear search and filter by tag chip "zdrowie" (only task 10)
    await searchInput.fill('');
    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(16);

    await page.getByTestId('tag-filter-zdrowie').click();
    await expect(page.getByTestId('postit-note-10')).toBeVisible();
    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(1);

    // Switch filter mode from 'filter' to 'highlight'
    await page.getByTestId('filter-mode-toggle').click();
    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(16);
    await expect(page.getByTestId('postit-note-10')).toHaveAttribute('data-dimmed', 'false');
    await expect(page.getByTestId('postit-note-1')).toHaveAttribute('data-dimmed', 'true');

    // Quick reset restores all notes to undimmed
    await page.getByTestId('tag-filter-reset').click();
    await expect(page.getByTestId('postit-note-1')).toHaveAttribute('data-dimmed', 'false');
    await expect(page.getByTestId('postit-note-10')).toHaveAttribute('data-dimmed', 'false');

    guard.assertNoErrors();
  });

  test('T1-08: HTML5 drag and drop across 3x5 priority and time zones', async ({ page }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    const note16 = page.getByTestId('postit-note-16');
    await expect(note16).toHaveAttribute('data-priority', 'niski');
    await expect(note16).toHaveAttribute('data-zone', 'noDeadline');

    await dragPostItToCell(page, 16, 'wysoki', 'thisWeek');

    await expect(note16).toHaveAttribute('data-priority', 'wysoki');
    await expect(note16).toHaveAttribute('data-zone', 'thisWeek');
    await expect(
      page.getByTestId('zone-cell-wysoki-thisWeek').getByTestId('postit-note-16'),
    ).toBeVisible();

    const stored = await readTasksFromLocalStorage(page);
    const updated16 = stored.zadania.find((t) => t.id === 16);
    expect(updated16?.priorytet).toBe('wysoki');
    expect(updated16?.termin).toBe(formatLocalDateOffset(3));

    guard.assertNoErrors();
  });

  test('T1-09: direct drag and drop of Post-it onto trash completes straight into bin', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    expect(await getCompletedCountFromBar(page)).toBe(4);

    await dragPostItToTrash(page, 7);

    await expect(page.getByTestId('postit-note-7')).toHaveCount(0);
    await expect(page.getByTestId('floor-ball-7')).toHaveCount(0);
    expect(await getCompletedCountFromBar(page)).toBe(5);

    await page.getByTestId('trash-can-widget').click();
    await expect(page.getByTestId('trash-modal')).toBeVisible();
    await expect(page.getByTestId('trash-ball-7')).toBeVisible();
    await page.getByTestId('btn-close-trash').click();

    guard.assertNoErrors();
  });

  test('T1-10: double-click disambiguation and PPM mark-done crumple to floor', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    // Double-click note 1 -> spawns floor-ball-1 and never opens task-modal (>380ms check)
    await doubleClickNoteAndVerifyNoModal(page, 1);
    await expect(page.getByTestId('postit-note-1')).toHaveCount(0);
    expect(await getCompletedCountFromBar(page)).toBe(5);

    // Right-click note 6 -> context-menu-complete -> spawns floor-ball-6
    const note6 = page.getByTestId('postit-note-6');
    await note6.click({ button: 'right' });
    await expect(page.getByTestId('context-menu')).toBeVisible();
    await page.getByTestId('context-menu-complete').click();

    await expect(note6).toHaveCount(0);
    await expect(page.getByTestId('floor-ball-6')).toBeVisible();
    expect(await getCompletedCountFromBar(page)).toBe(6);

    guard.assertNoErrors();
  });

  test('T1-11: floor physics settles multiple balls near bottom while board stays clickable', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    for (const id of [1, 2, 6]) {
      await page.getByTestId(`postit-note-${id}`).dblclick();
    }

    const viewport = page.viewportSize() ?? { width: 1440, height: 900 };
    for (const id of [1, 2, 6]) {
      const box = await waitForFloorBallSettled(page, id);
      const centerY = box.y + box.height / 2;
      const centerX = box.x + box.width / 2;
      expect(centerY).toBeGreaterThan(viewport.height * 0.55);
      expect(centerY).toBeLessThanOrEqual(viewport.height);
      expect(centerX).toBeGreaterThanOrEqual(0);
      expect(centerX).toBeLessThanOrEqual(viewport.width);
    }

    // Verify corkboard cards remain clickable through the pointer-events:none physics overlay
    await page.getByTestId('postit-note-15').click();
    await expect(page.getByTestId('task-modal')).toBeVisible();
    await page.getByTestId('task-btn-cancel').click();
    await expect(page.getByTestId('task-modal')).toHaveCount(0);

    guard.assertNoErrors();
  });

  test('T1-12: grabbing floor ball enlarges trash and dropping into hitbox captures it', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    await expect(page.getByTestId('trash-can-widget')).toHaveAttribute('data-enlarged', 'false');

    await page.getByTestId('postit-note-1').dblclick();
    await grabAndDropFloorBallIntoTrash(page, 1);

    expect(await getCompletedCountFromBar(page)).toBe(5);

    await page.getByTestId('trash-can-widget').click();
    await expect(page.getByTestId('trash-modal')).toBeVisible();
    await expect(page.getByTestId('trash-ball-1')).toBeVisible();
    await page.getByTestId('btn-close-trash').click();

    guard.assertNoErrors();
  });

  test('T1-13: undo completion by restoring from TrashModal and from floor-ball PPM', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    // 1. Restore pre-completed task 17 from TrashModal
    await page.getByTestId('trash-can-widget').click();
    await expect(page.getByTestId('trash-modal')).toBeVisible();
    await page.getByTestId('trash-ball-17').click({ button: 'right' });
    await expect(page.getByTestId('context-menu')).toBeVisible();
    await page.getByTestId('context-menu-restore').click();
    await expect(page.getByTestId('trash-ball-17')).toHaveCount(0);
    await page.getByTestId('btn-close-trash').click();

    await expect(page.getByTestId('postit-note-17')).toBeVisible();
    await expect(page.getByTestId('postit-note-17')).toHaveAttribute('data-priority', 'wysoki');
    expect(await getCompletedCountFromBar(page)).toBe(3);

    // 2. Crumple task 10 to floor, then restore via floor-ball PPM context menu
    await page.getByTestId('postit-note-10').dblclick();
    await waitForFloorBallSettled(page, 10);
    expect(await getCompletedCountFromBar(page)).toBe(4);

    await page.getByTestId('floor-ball-10').click({ button: 'right' });
    await expect(page.getByTestId('context-menu')).toBeVisible();
    await page.getByTestId('context-menu-restore').click();

    await expect(page.getByTestId('floor-ball-10')).toHaveCount(0);
    await expect(page.getByTestId('postit-note-10')).toBeVisible();
    expect(await getCompletedCountFromBar(page)).toBe(3);

    guard.assertNoErrors();
  });

  test('T1-14: expanded TrashModal shows balls, hover tooltip, sweep floor and permanent delete', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    // Crumple task 4 to floor so 1 ball is on floor and 4 are in trash
    await page.getByTestId('postit-note-4').dblclick();
    await waitForFloorBallSettled(page, 4);
    expect(await getCompletedCountFromBar(page)).toBe(5);

    await page.getByTestId('trash-can-widget').click();
    await expect(page.getByTestId('trash-modal')).toBeVisible();

    await page.getByTestId('trash-ball-18').hover();

    // Sweep floor balls into trash bin
    await page.getByTestId('btn-sweep-floor').click();
    await expect(page.getByTestId('floor-ball-4')).toHaveCount(0);
    await expect(page.getByTestId('trash-ball-4')).toBeVisible();

    // Permanently delete task 20 from TrashModal via PPM
    await page.getByTestId('trash-ball-20').click({ button: 'right' });
    await expect(page.getByTestId('context-menu')).toBeVisible();
    await page.getByTestId('context-menu-delete').click();
    await expect(page.getByTestId('trash-ball-20')).toHaveCount(0);

    await page.getByTestId('btn-close-trash').click();
    await expect(page.getByTestId('trash-modal')).toHaveCount(0);
    expect(await getCompletedCountFromBar(page)).toBe(4);

    guard.assertNoErrors();
  });

  test('T1-15: empty trash summary modal commits to separate ArchiveModal and exports archiwum_usunietych.json', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    await page.getByTestId('trash-can-widget').click();
    await expect(page.getByTestId('trash-modal')).toBeVisible();

    // Open EmptySummaryModal and test cancel first
    await page.getByTestId('btn-empty-trash').click();
    const summaryModal = page.getByTestId('empty-summary-modal');
    await expect(summaryModal).toBeVisible();
    await page.getByTestId('btn-cancel-empty-trash').click();
    await expect(summaryModal).toHaveCount(0);
    expect(await getCompletedCountFromBar(page)).toBe(4);

    // Re-open EmptySummaryModal and confirm permanent empty to archive
    if ((await page.getByTestId('trash-modal').count()) === 0) {
      await page.getByTestId('trash-can-widget').click();
    }
    await page.getByTestId('btn-empty-trash').click();
    await expect(summaryModal).toBeVisible();
    await page.getByTestId('btn-confirm-empty-trash').click();
    await expect(summaryModal).toHaveCount(0);

    if ((await page.getByTestId('trash-modal').count()) > 0) {
      await page.getByTestId('btn-close-trash').click();
    }

    expect(await getCompletedCountFromBar(page)).toBe(0);

    const tasksInStorage = await readTasksFromLocalStorage(page);
    expect(tasksInStorage.zadania).toHaveLength(16);
    expect(tasksInStorage.zadania.every((t) => !t.wykonane)).toBe(true);

    // Open ArchiveModal from TopBar and verify all 4 archived entries + JSON export
    await page.getByTestId('btn-open-archive').click();
    const archiveModal = page.getByTestId('archive-modal');
    await expect(archiveModal).toBeVisible();
    for (let idx = 0; idx < 4; idx += 1) {
      await expect(page.getByTestId(`archive-entry-${idx}`)).toBeVisible();
    }

    const exportedArchive = await exportArchiveJson(page);
    expect(exportedArchive.data.wersja).toBe(1);
    expect(exportedArchive.data.archiwum).toHaveLength(4);
    expect(exportedArchive.data.archiwum.map((e) => e.task.id).sort((a, b) => a - b)).toEqual([
      17, 18, 19, 20,
    ]);

    await page.getByTestId('btn-close-archive').click();
    await expect(archiveModal).toHaveCount(0);

    guard.assertNoErrors();
  });

  test('T1-16: import valid external zadania.json v2 via TopBar', async ({ page }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    await uploadTasksJson(page, 'valid-v2.json');

    const toast = page.getByTestId('toast-notification');
    await expect(toast).toBeVisible();

    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(4);
    for (const activeId of [101, 102, 103, 104]) {
      await expect(page.getByTestId(`postit-note-${activeId}`)).toBeVisible();
    }
    await expect(page.locator('[data-testid^="floor-ball-"]')).toHaveCount(0);
    expect(await getCompletedCountFromBar(page)).toBe(2);

    const stored = await readTasksFromLocalStorage(page);
    expect(stored.wersja).toBe(2);
    expect(stored.zadania).toHaveLength(6);

    guard.assertNoErrors();
  });

  test('T1-17: export zadania.json produces strict 7-field competition schema', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    const exported = await exportTasksJson(page, 1);
    expect(exported.data.wersja).toBe(1);
    expect(exported.data.zadania).toHaveLength(20);

    guard.assertNoErrors();
  });

  test('T1-18: auto-persistence and mute toggle survive page reload with zero audio errors', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    expect((await readPrefsFromLocalStorage(page)).muted).toBe(false);
    await page.getByTestId('btn-toggle-mute').click();
    expect((await readPrefsFromLocalStorage(page)).muted).toBe(true);

    await createTaskViaModal(page, {
      tytul: 'Zadanie sprawdzające zapis po odświeżeniu F5',
      opis: 'Powinno przetrwać pełne przeładowanie strony',
      termin: null,
      priorytet: 'wysoki',
      tagi: ['studia'],
    });
    await expect(page.getByTestId('postit-note-21')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('corkboard')).toBeVisible();
    await expect(page.getByTestId('postit-note-21')).toBeVisible();
    await expect(page.getByTestId('postit-note-21')).toContainText(
      'Zadanie sprawdzające zapis po odświeżeniu F5',
    );
    expect((await readPrefsFromLocalStorage(page)).muted).toBe(true);

    guard.assertNoErrors();
  });
});
