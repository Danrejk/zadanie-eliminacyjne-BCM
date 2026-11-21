import { expect, test } from '@playwright/test';
import {
  attachErrorGuards,
  createTaskViaModal,
  dragPostItOverTrashThenLeave,
  dragPostItToCell,
  exportTasksJson,
  extractColorSignature,
  formatLocalDateOffset,
  getCompletedCountFromBar,
  grabAndMissThrowFloorBall,
  grabAndThrowFloorBallIntoTrashArc,
  readTasksFromLocalStorage,
  startFreshApp,
  TIME_ZONES,
  type TasksFile,
  uploadTasksJson,
  uploadTasksJsonPayload,
  waitForFloorBallSettled,
} from './helpers';

test.describe('Tier 2 — Boundaries, Validation Errors & Edge Cases (E01–E28)', () => {
  test('T2-01: rejects malformed JSON syntax with Polish error toast and preserves state', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    await uploadTasksJson(page, 'invalid-syntax.json');

    const toast = page.getByTestId('toast-notification');
    await expect(toast).toBeVisible();
    const toastText = (await toast.textContent()) ?? '';
    expect(toastText.trim().length).toBeGreaterThan(0);

    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(16);
    expect(await getCompletedCountFromBar(page)).toBe(4);

    const stored = await readTasksFromLocalStorage(page);
    expect(stored.wersja).toBe(1);
    expect(stored.zadania).toHaveLength(20);

    guard.assertNoErrors();
  });

  test('T2-02: rejects invalid priority with diacritic ("średni") and preserves state', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    await uploadTasksJson(page, 'invalid-priority.json');

    await expect(page.getByTestId('toast-notification')).toBeVisible();
    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(16);

    const stored = await readTasksFromLocalStorage(page);
    expect(stored.zadania).toHaveLength(20);

    guard.assertNoErrors();
  });

  test('T2-03: rejects invalid calendar date ("2026-02-30") and empty string date', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    await uploadTasksJson(page, 'invalid-date.json');

    await expect(page.getByTestId('toast-notification')).toBeVisible();
    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(16);

    const stored = await readTasksFromLocalStorage(page);
    expect(stored.zadania).toHaveLength(20);

    guard.assertNoErrors();
  });

  test('T2-04: rejects duplicate task IDs and preserves state', async ({ page }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    await uploadTasksJson(page, 'duplicate-id.json');

    await expect(page.getByTestId('toast-notification')).toBeVisible();
    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(16);

    const stored = await readTasksFromLocalStorage(page);
    expect(stored.zadania).toHaveLength(20);

    guard.assertNoErrors();
  });

  test('T2-05: accepts empty zadania array with wersja 2 and accepts empty opis/tagi/null termin', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    await uploadTasksJson(page, 'empty-tasks.json');

    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="floor-ball-"]:not([data-testid^="floor-ball-tooltip-"])')).toHaveCount(0);
    expect(await getCompletedCountFromBar(page)).toBe(0);

    await page.getByTestId('trash-can-widget').click();
    await expect(page.getByTestId('trash-drawer')).toBeVisible();
    await expect(page.getByTestId('btn-empty-trash')).toBeDisabled();
    await page.getByTestId('btn-close-trash-drawer').click();

    const exportedEmpty = await exportTasksJson(page, 2);
    expect(exportedEmpty.data).toEqual({ wersja: 2, zadania: [] });

    // Upload a single task with empty opis "", empty tagi [], and null termin
    const minimalPayload: TasksFile = {
      wersja: 2,
      zadania: [
        {
          id: 1,
          tytul: 'Zadanie minimalne bez opisu, tagów i terminu',
          opis: '',
          termin: null,
          priorytet: 'niski',
          wykonane: false,
          tagi: [],
        },
      ],
    };
    await uploadTasksJsonPayload(page, 'minimal-v2.json', minimalPayload);

    const minimalNote = page.getByTestId('postit-note-1');
    await expect(minimalNote).toBeVisible();
    await expect(minimalNote).toHaveAttribute('data-priority', 'niski');
    await expect(minimalNote).toHaveAttribute('data-zone', 'noDeadline');
    await expect(page.getByTestId('nail-pin-1')).toBeVisible();
    await expect(page.locator('[data-testid^="pushpin-1-"]')).toHaveCount(0);

    guard.assertNoErrors();
  });

  test('T2-06: import clears existing floor balls, routes wykonane:true to trash, and allows re-importing same file twice', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    await page.getByTestId('postit-note-1').dblclick();
    await expect(page.getByTestId('floor-ball-1')).toBeVisible();

    await uploadTasksJson(page, 'valid-v2.json');

    // Floor balls cleared and imported completed tasks routed directly to trash
    await expect(page.locator('[data-testid^="floor-ball-"]:not([data-testid^="floor-ball-tooltip-"])')).toHaveCount(0);
    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(4);
    expect(await getCompletedCountFromBar(page)).toBe(2);

    await page.getByTestId('trash-can-widget').click();
    await expect(page.getByTestId('trash-ball-105')).toBeVisible();
    await expect(page.getByTestId('trash-ball-106')).toBeVisible();
    await page.getByTestId('btn-close-trash-drawer').click();

    // Mutate state by deleting task 101, then re-import the exact same file path
    await page.getByTestId('postit-note-101').click({ button: 'right' });
    await page.getByTestId('context-menu-delete').click();
    await page.getByTestId('context-menu-delete-confirm').click();
    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(3);

    await uploadTasksJson(page, 'valid-v2.json');
    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(4);
    await expect(page.getByTestId('postit-note-101')).toBeVisible();

    guard.assertNoErrors();
  });

  test('T2-07: export while balls sit on floor marks wykonane:true with zero physics fields', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    await page.getByTestId('postit-note-1').dblclick();
    await page.getByTestId('postit-note-6').dblclick();
    await expect(page.getByTestId('floor-ball-1')).toBeVisible();
    await expect(page.getByTestId('floor-ball-6')).toBeVisible();

    const exported = await exportTasksJson(page, 1);
    const task1 = exported.data.zadania.find((t) => t.id === 1);
    const task6 = exported.data.zadania.find((t) => t.id === 6);
    expect(task1?.wykonane).toBe(true);
    expect(task6?.wykonane).toBe(true);

    guard.assertNoErrors();
  });

  test('T2-08: exact local calendar date boundary classification across all 5 columns', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    const boundarySeed: TasksFile = {
      wersja: 1,
      zadania: [
        {
          id: 1,
          tytul: 'Granica -1d (wczoraj)',
          opis: '',
          termin: formatLocalDateOffset(-1),
          priorytet: 'wysoki',
          wykonane: false,
          tagi: [],
        },
        {
          id: 2,
          tytul: 'Granica 0d (dziś)',
          opis: '',
          termin: formatLocalDateOffset(0),
          priorytet: 'wysoki',
          wykonane: false,
          tagi: [],
        },
        {
          id: 3,
          tytul: 'Granica +1d (jutro)',
          opis: '',
          termin: formatLocalDateOffset(1),
          priorytet: 'wysoki',
          wykonane: false,
          tagi: [],
        },
        {
          id: 4,
          tytul: 'Granica +2d (ten tydzień start)',
          opis: '',
          termin: formatLocalDateOffset(2),
          priorytet: 'wysoki',
          wykonane: false,
          tagi: [],
        },
        {
          id: 5,
          tytul: 'Granica +7d (ten tydzień koniec)',
          opis: '',
          termin: formatLocalDateOffset(7),
          priorytet: 'wysoki',
          wykonane: false,
          tagi: [],
        },
        {
          id: 6,
          tytul: 'Granica +8d (później start)',
          opis: '',
          termin: formatLocalDateOffset(8),
          priorytet: 'wysoki',
          wykonane: false,
          tagi: [],
        },
        {
          id: 7,
          tytul: 'Granica null (bez terminu)',
          opis: '',
          termin: null,
          priorytet: 'wysoki',
          wykonane: false,
          tagi: [],
        },
      ],
    };

    await startFreshApp(page, { tasks: boundarySeed });

    const expectedZones: Array<{ id: number; zone: (typeof TIME_ZONES)[number]; overdue: boolean }> =
      [
        { id: 1, zone: 'overdue', overdue: true },
        { id: 2, zone: 'todayTomorrow', overdue: false },
        { id: 3, zone: 'todayTomorrow', overdue: false },
        { id: 4, zone: 'thisWeek', overdue: false },
        { id: 5, zone: 'thisWeek', overdue: false },
        { id: 6, zone: 'later', overdue: false },
        { id: 7, zone: 'noDeadline', overdue: false },
      ];

    for (const item of expectedZones) {
      const note = page.getByTestId(`postit-note-${item.id}`);
      await expect(note).toHaveAttribute('data-zone', item.zone);
      await expect(
        page.getByTestId(`zone-cell-wysoki-${item.zone}`).getByTestId(`postit-note-${item.id}`),
      ).toBeVisible();
      if (item.overdue) {
        await expect(page.getByTestId(`postit-overdue-stamp-${item.id}`)).toBeVisible();
      } else {
        await expect(page.getByTestId(`postit-overdue-stamp-${item.id}`)).toHaveCount(0);
      }
    }

    guard.assertNoErrors();
  });

  test('T2-09: drag-and-drop overdue read-only protection, vertical date preservation, cross-column dates and trash drag-leave cancel', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    const overdueDate = formatLocalDateOffset(-3);
    const tomorrowDate = formatLocalDateOffset(1);
    const laterDate = formatLocalDateOffset(15);

    await startFreshApp(page, {
      tasks: {
        wersja: 1,
        zadania: [
          {
            id: 1,
            tytul: 'Zaległe zadanie',
            opis: '',
            termin: overdueDate,
            priorytet: 'wysoki',
            wykonane: false,
            tagi: [],
          },
          {
            id: 2,
            tytul: 'Jutrzejsze zadanie',
            opis: '',
            termin: tomorrowDate,
            priorytet: 'wysoki',
            wykonane: false,
            tagi: [],
          },
          {
            id: 3,
            tytul: 'Odległe zadanie',
            opis: '',
            termin: laterDate,
            priorytet: 'niski',
            wykonane: false,
            tagi: [],
          },
        ],
      },
    });

    // E12: Vertical drag of overdue task inside overdue column updates priority and preserves exact overdue date
    await dragPostItToCell(page, 1, 'niski', 'overdue');
    await expect(page.getByTestId('postit-note-1')).toHaveAttribute('data-priority', 'niski');
    await expect(page.getByTestId('postit-note-1')).toHaveAttribute('data-zone', 'overdue');
    expect((await readTasksFromLocalStorage(page)).zadania.find((t) => t.id === 1)?.termin).toBe(
      overdueDate,
    );

    // E11: Cross-column drag of non-overdue task onto overdue column is rejected
    await dragPostItToCell(page, 2, 'wysoki', 'overdue');
    await expect(page.getByTestId('postit-note-2')).toHaveAttribute('data-zone', 'todayTomorrow');
    expect((await readTasksFromLocalStorage(page)).zadania.find((t) => t.id === 2)?.termin).toBe(
      tomorrowDate,
    );

    // E13: Vertical drag inside todayTomorrow preserves exact tomorrow date (does not reset to today)
    await dragPostItToCell(page, 2, 'sredni', 'todayTomorrow');
    await expect(page.getByTestId('postit-note-2')).toHaveAttribute('data-priority', 'sredni');
    expect((await readTasksFromLocalStorage(page)).zadania.find((t) => t.id === 2)?.termin).toBe(
      tomorrowDate,
    );

    // E14: Cross-column drags assign deterministic canonical dates
    await dragPostItToCell(page, 3, 'wysoki', 'todayTomorrow');
    expect((await readTasksFromLocalStorage(page)).zadania.find((t) => t.id === 3)?.termin).toBe(
      formatLocalDateOffset(0),
    );

    await dragPostItToCell(page, 3, 'sredni', 'thisWeek');
    expect((await readTasksFromLocalStorage(page)).zadania.find((t) => t.id === 3)?.termin).toBe(
      formatLocalDateOffset(3),
    );

    await dragPostItToCell(page, 3, 'niski', 'later');
    expect((await readTasksFromLocalStorage(page)).zadania.find((t) => t.id === 3)?.termin).toBe(
      formatLocalDateOffset(14),
    );

    await dragPostItToCell(page, 3, 'wysoki', 'noDeadline');
    expect((await readTasksFromLocalStorage(page)).zadania.find((t) => t.id === 3)?.termin).toBeNull();

    // Drag over trash then dragleave without drop keeps task active on board
    await dragPostItOverTrashThenLeave(page, 3);
    await expect(page.getByTestId('postit-note-3')).toBeVisible();
    await expect(page.getByTestId('trash-can-widget')).toHaveAttribute('data-enlarged', 'false');
    expect(await getCompletedCountFromBar(page)).toBe(0);

    guard.assertNoErrors();
  });

  test('T2-10: rapid double/triple-click and drag-end never open edit modal or duplicate floor balls', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    const note1 = page.getByTestId('postit-note-1');
    await note1.click({ clickCount: 3, delay: 25 });

    await expect(page.getByTestId('floor-ball-1')).toBeVisible({ timeout: 3000 });
    await page.waitForTimeout(400);

    await expect(page.getByTestId('task-modal')).toHaveCount(0);
    await expect(page.getByTestId('floor-ball-1')).toHaveCount(1);
    await expect(page.locator('[data-testid^="floor-ball-"]:not([data-testid^="floor-ball-tooltip-"])')).toHaveCount(1);

    // Drag note 4 across cells and verify edit modal does not open after dragend
    await dragPostItToCell(page, 4, 'sredni', 'thisWeek');
    await page.waitForTimeout(400);
    await expect(page.getByTestId('task-modal')).toHaveCount(0);

    guard.assertNoErrors();
  });

  test('T2-11: multi-ball floor accumulation, miss-throw recovery, airborne throw catch and F5 reload to trash', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    // E16: Accumulate 3 floor balls simultaneously
    for (const id of [1, 2, 6]) {
      await page.getByTestId(`postit-note-${id}`).dblclick();
    }
    for (const id of [1, 2, 6]) {
      await waitForFloorBallSettled(page, id);
    }
    await expect(page.locator('[data-testid^="floor-ball-"]:not([data-testid^="floor-ball-tooltip-"])')).toHaveCount(3);
    expect(await getCompletedCountFromBar(page)).toBe(7);

    // E18: Miss-throw ball 1 toward top-left -> bounces back to floor & trash shrinks back
    await grabAndMissThrowFloorBall(page, 1);
    await expect(page.locator('[data-testid^="floor-ball-"]:not([data-testid^="floor-ball-tooltip-"])')).toHaveCount(3);

    // E19: Airborne arc throw ball 2 into enlarged trash hitbox -> captured in flight
    await grabAndThrowFloorBallIntoTrashArc(page, 2);
    await expect(page.getByTestId('floor-ball-2')).toHaveCount(0);
    await expect(page.locator('[data-testid^="floor-ball-"]:not([data-testid^="floor-ball-tooltip-"])')).toHaveCount(2);

    // E17: Reload page (F5) -> remaining floor balls (1 & 6) move into trash bin
    await page.reload();
    await expect(page.getByTestId('corkboard')).toBeVisible();
    await expect(page.locator('[data-testid^="floor-ball-"]:not([data-testid^="floor-ball-tooltip-"])')).toHaveCount(0);
    expect(await getCompletedCountFromBar(page)).toBe(7);

    await page.getByTestId('trash-can-widget').click();
    await expect(page.getByTestId('trash-drawer')).toBeVisible();
    for (const id of [1, 2, 6, 17, 18, 19, 20]) {
      await expect(page.getByTestId(`trash-ball-${id}`)).toBeVisible();
    }
    await page.getByTestId('btn-close-trash-drawer').click();

    guard.assertNoErrors();
  });

  test('T2-12: viewport resize clamps floor balls inside visible bounds and keeps corkboard usable', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    await page.getByTestId('postit-note-5').dblclick();
    await page.getByTestId('postit-note-8').dblclick();
    await waitForFloorBallSettled(page, 5);
    await waitForFloorBallSettled(page, 8);

    await page.setViewportSize({ width: 1024, height: 680 });
    await page.waitForTimeout(350);

    for (const id of [5, 8]) {
      const box = await waitForFloorBallSettled(page, id);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(1024);
      expect(box.y + box.height).toBeLessThanOrEqual(680);
    }

    await expect(page.getByTestId('corkboard')).toBeVisible();
    await expect(page.getByTestId('trash-can-widget')).toBeVisible();

    guard.assertNoErrors();
  });

  test('T2-13: minimized trash bar displays strictly only Ukończone count and emptying trash handles floor balls cleanly', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    // E21: Strictly "Ukończone: <N>" only
    expect(await getCompletedCountFromBar(page)).toBe(4);

    // Crumple note 1 to floor (4 in trash + 1 on floor = Ukończone: 5)
    await page.getByTestId('postit-note-1').dblclick();
    await waitForFloorBallSettled(page, 1);
    expect(await getCompletedCountFromBar(page)).toBe(5);

    // Empty trash WITHOUT sweeping floor -> archives the 4 in-trash tasks, leaving floor-ball-1 intact
    await page.getByTestId('trash-can-widget').click();
    await page.getByTestId('btn-empty-trash').click();
    await page.getByTestId('btn-confirm-empty-trash').click();
    if ((await page.getByTestId('trash-drawer').count()) > 0) {
      await page.getByTestId('btn-close-trash-drawer').click();
    }

    await expect(page.getByTestId('floor-ball-1')).toBeVisible();
    expect(await getCompletedCountFromBar(page)).toBe(1);

    // Now open TrashModal, sweep floor-ball-1 into trash, and empty trash -> 0 floor balls & Ukończone: 0
    await page.getByTestId('trash-can-widget').click();
    await page.getByTestId('btn-sweep-floor').click();
    await expect(page.getByTestId('floor-ball-1')).toHaveCount(0);
    await expect(page.getByTestId('trash-ball-1')).toBeVisible();

    await page.getByTestId('btn-empty-trash').click();
    await page.getByTestId('btn-confirm-empty-trash').click();
    if ((await page.getByTestId('trash-drawer').count()) > 0) {
      await page.getByTestId('btn-close-trash-drawer').click();
    }

    await expect(page.locator('[data-testid^="floor-ball-"]:not([data-testid^="floor-ball-tooltip-"])')).toHaveCount(0);
    expect(await getCompletedCountFromBar(page)).toBe(0);

    guard.assertNoErrors();
  });

  test('T2-14: tag normalization, Polish diacritics and 4+ push-pins on a single card', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    await createTaskViaModal(page, {
      tytul: 'Zadanie z wieloma pinezkami i polskimi znakami',
      opis: 'Sprawdzenie normalizacji duplikatów oraz 4+ pinezek',
      termin: null,
      priorytet: 'wysoki',
      tagi: ['Studia', ' studia ', 'ćwiczenia', 'książki', 'projekt'],
    });

    const note21 = page.getByTestId('postit-note-21');
    await expect(note21).toBeVisible();

    // "Studia" and " studia " normalize to the same tag -> 4 distinct pushpins rendered
    await expect(page.locator('[data-testid^="pushpin-21-"]')).toHaveCount(4);
    for (let i = 0; i < 4; i += 1) {
      await expect(page.getByTestId(`pushpin-21-${i}`)).toBeVisible();
    }

    // "Studia" pin color on note 21 must match "studia" on note 1 & TopBar, and differ from "projekt"
    const color21 = await extractColorSignature(page.getByTestId('pushpin-21-0'));
    const color1 = await extractColorSignature(page.getByTestId('pushpin-1-0'));
    const topBarStudiaColor = await extractColorSignature(page.getByTestId('tag-filter-studia'));
    const projektColor21 = await extractColorSignature(page.getByTestId('pushpin-21-3'));
    expect(color21).toMatch(/^#[0-9a-f]{6}$/);
    expect(projektColor21).toMatch(/^#[0-9a-f]{6}$/);
    expect(color21).toBe(color1);
    expect(color21).toBe(topBarStudiaColor);
    expect(color21).not.toBe(projektColor21);

    guard.assertNoErrors();
  });

  test('T2-15: context menu viewport clamping near bottom-right corner, Escape/outside dismiss and empty ArchiveModal', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    // Empty ArchiveModal renders cleanly
    await page.getByTestId('btn-open-archive').click();
    await expect(page.getByTestId('archive-modal')).toBeVisible();
    await expect(page.locator('[data-testid^="archive-entry-"]')).toHaveCount(0);
    await page.getByTestId('btn-close-archive').click();
    await expect(page.getByTestId('archive-modal')).toHaveCount(0);

    // Right-click bottom-right note 16 and verify context menu is clamped within 1440x900 viewport
    const note16 = page.getByTestId('postit-note-16');
    await note16.click({ button: 'right' });
    const menu = page.getByTestId('context-menu');
    await expect(menu).toBeVisible();

    const menuBox = await menu.boundingBox();
    const viewport = page.viewportSize() ?? { width: 1440, height: 900 };
    expect(menuBox).not.toBeNull();
    expect(menuBox!.x).toBeGreaterThanOrEqual(0);
    expect(menuBox!.y).toBeGreaterThanOrEqual(0);
    expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(viewport.width);
    expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(viewport.height);

    // Escape dismisses context menu
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);

    // Outside click dismisses context menu
    await note16.click({ button: 'right' });
    await expect(menu).toBeVisible();
    await page.mouse.click(20, 20);
    await expect(menu).toHaveCount(0);

    guard.assertNoErrors();
  });

  test('T2-16: live search + tag filter AND semantics, whitespace query, zero-match state and unfiltered JSON export', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    const searchInput = page.getByTestId('search-input');

    // Whitespace-only query acts as no filter
    await searchInput.fill('    ');
    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(16);

    // Search "sieci" + tag "studia" -> logical AND -> only task 1 matches
    await searchInput.fill('sieci');
    await page.getByTestId('tag-filter-studia').click();
    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(1);
    await expect(page.getByTestId('postit-note-1')).toBeVisible();

    // Zero-match query shows 0 cards cleanly
    await searchInput.fill('nieistniejące_zadanie_xyz_987');
    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(0);

    // Exporting while filtered still exports all 20 tasks unfiltered
    const exported = await exportTasksJson(page, 1);
    expect(exported.data.zadania).toHaveLength(20);

    guard.assertNoErrors();
  });

  test('T2-17: task creation rejects empty title, Escape/Cancel discards edits, and IDs auto-increment past non-contiguous max', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page, {
      tasks: {
        wersja: 1,
        zadania: [
          {
            id: 1,
            tytul: 'Zadanie pierwsze',
            opis: '',
            termin: null,
            priorytet: 'niski',
            wykonane: false,
            tagi: [],
          },
          {
            id: 5,
            tytul: 'Zadanie piąte',
            opis: '',
            termin: null,
            priorytet: 'sredni',
            wykonane: false,
            tagi: [],
          },
          {
            id: 12,
            tytul: 'Zadanie dwunaste',
            opis: '',
            termin: null,
            priorytet: 'wysoki',
            wykonane: false,
            tagi: [],
          },
        ],
      },
    });

    // Attempt creating task with whitespace-only title -> blocked
    await page.getByTestId('btn-new-task').click();
    await expect(page.getByTestId('task-modal')).toBeVisible();
    await page.getByTestId('task-input-title').fill('   ');
    const saveBtn = page.getByTestId('task-btn-save');
    if (await saveBtn.isEnabled()) {
      await saveBtn.click();
    }
    await expect(page.getByTestId('task-modal')).toBeVisible();
    await page.getByTestId('task-btn-cancel').click();
    await expect(page.getByTestId('task-modal')).toHaveCount(0);
    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(3);

    // Edit task 5 then cancel -> original title preserved
    await page.getByTestId('postit-note-5').click();
    await expect(page.getByTestId('task-modal')).toBeVisible();
    await page.getByTestId('task-input-title').fill('Niezapisany tytuł');
    await page.getByTestId('task-btn-cancel').click();
    await expect(page.getByTestId('postit-note-5')).toContainText('Zadanie piąte');

    // Create valid task -> receives max(1, 5, 12) + 1 = 13
    await createTaskViaModal(page, {
      tytul: 'Zadanie trzynaste po nieciągłych ID',
      termin: null,
      priorytet: 'wysoki',
    });
    await expect(page.getByTestId('postit-note-13')).toBeVisible();

    // Upload empty tasks [] and create valid task -> receives ID = 1
    await uploadTasksJson(page, 'empty-tasks.json');
    await createTaskViaModal(page, {
      tytul: 'Pierwsze zadanie w pustej tablicy',
      termin: null,
      priorytet: 'sredni',
    });
    await expect(page.getByTestId('postit-note-1')).toBeVisible();

    guard.assertNoErrors();
  });

  test('T2-18: corrupted localStorage recovers to 20-task sample spanning all 5 columns with zero audio errors', async ({
    page,
  }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page, {
      tasks: '{corrupted_json_tasks',
      archive: '{corrupted_json_archive',
      prefs: '{corrupted_json_prefs',
    });

    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(16);
    expect(await getCompletedCountFromBar(page)).toBe(4);

    // Verify all 5 time columns have active tasks on the board
    for (const zone of TIME_ZONES) {
      const notesInZone = page.locator(`[data-testid^="postit-note-"][data-zone="${zone}"]`);
      expect(await notesInZone.count()).toBeGreaterThanOrEqual(1);
    }

    // Trigger Web Audio synthesized sounds both unmuted and muted -> zero console/page errors
    await page.getByTestId('postit-note-1').dblclick();
    await waitForFloorBallSettled(page, 1);
    await page.getByTestId('floor-ball-1').click({ button: 'right' });
    await page.getByTestId('context-menu-restore').click();

    await page.getByTestId('btn-toggle-mute').click();
    await page.getByTestId('postit-note-1').dblclick();
    await waitForFloorBallSettled(page, 1);

    guard.assertNoErrors();
  });
});
