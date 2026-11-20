import { expect, test } from '@playwright/test';
import {
  attachErrorGuards,
  createTaskViaModal,
  doubleClickNoteAndVerifyNoModal,
  exportTasksJson,
  formatLocalDateOffset,
  readArchiveFromLocalStorage,
  readPrefsFromLocalStorage,
  readTasksFromLocalStorage,
  startFreshApp,
  uploadTasksJsonPayload,
  waitForFloorBallSettled,
  type TasksFile,
} from './helpers';

test.describe('Tier 5 — Adversarial Hardening & Regression Guards', () => {
  test('T5-01: floor ball tooltip stays upright (0 deg) above rotated floor ball', async ({ page }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    // Task #4 spawns with rotation (4 * 47) % 360 = 188 deg
    await doubleClickNoteAndVerifyNoModal(page, 4);
    const ballBox = await waitForFloorBallSettled(page, 4);

    const ball = page.getByTestId('floor-ball-4');
    await page.mouse.move(ballBox.x + ballBox.width / 2, ballBox.y + ballBox.height / 2);

    const tooltip = page.getByTestId('floor-ball-tooltip-4');
    await expect(tooltip).toBeVisible();

    const tooltipBox = await tooltip.boundingBox();
    expect(tooltipBox).not.toBeNull();
    expect(tooltipBox!.y + tooltipBox!.height).toBeLessThanOrEqual(ballBox.y + 4);

    // Verify no ancestor between tooltip and floor-physics-layer has a rotation transform
    const hasRotation = await tooltip.evaluate((el) => {
      let curr: HTMLElement | null = el as HTMLElement;
      while (curr && curr.dataset.testid !== 'floor-physics-layer') {
        const transform = window.getComputedStyle(curr).transform;
        if (transform && transform !== 'none') {
          const match = /^matrix\(([^)]+)\)$/.exec(transform);
          if (match) {
            const parts = match[1].split(',').map((n) => Number.parseFloat(n.trim()));
            // b and c components must be ~0 for non-rotated 2D matrix
            if (Math.abs(parts[1]) > 0.01 || Math.abs(parts[2]) > 0.01) {
              return true;
            }
          } else if (transform.includes('matrix3d(')) {
            return true;
          }
        }
        curr = curr.parentElement;
      }
      return false;
    });
    expect(hasRotation).toBe(false);
    await expect(ball).toBeVisible();

    guard.assertNoErrors();
  });

  test('T5-02: window.blur cancels active floor-ball drag and resets trash-can-widget enlargement', async ({ page }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    await doubleClickNoteAndVerifyNoModal(page, 1);
    const ballBox = await waitForFloorBallSettled(page, 1);
    const cx = ballBox.x + ballBox.width / 2;
    const cy = ballBox.y + ballBox.height / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx - 80, cy - 120, { steps: 4 });

    const trashWidget = page.getByTestId('trash-can-widget');
    await expect(trashWidget).toHaveAttribute('data-enlarged', 'true');

    await page.evaluate(() => {
      window.dispatchEvent(new Event('blur'));
    });

    await expect(trashWidget).toHaveAttribute('data-enlarged', 'false');
    await waitForFloorBallSettled(page, 1);
    await expect(page.getByTestId('floor-ball-1')).toBeVisible();

    guard.assertNoErrors();
  });

  test('T5-03: 230ms single-click debounce does not overwrite TrashModal opened within 50ms', async ({ page }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    await page.getByTestId('postit-note-1').click();
    await page.waitForTimeout(30);
    await page.getByTestId('trash-hitbox').click();

    await expect(page.getByTestId('trash-drawer')).toBeVisible();
    await page.waitForTimeout(320);

    await expect(page.getByTestId('trash-drawer')).toBeVisible();
    await expect(page.getByTestId('task-modal')).not.toBeVisible();

    guard.assertNoErrors();
  });

  test('T5-04: corrupted smartapp_archive_v1 and smartapp_prefs_v1 recover cleanly while preserving valid tasks', async ({ page }) => {
    const guard = attachErrorGuards(page);
    const validTasks: TasksFile = {
      wersja: 3,
      zadania: [
        {
          id: 42,
          tytul: 'Przetrwałe zadanie',
          opis: 'Powinno pozostać po odzyskaniu archiwum',
          termin: formatLocalDateOffset(1),
          priorytet: 'wysoki',
          wykonane: false,
          tagi: ['test'],
        },
      ],
    };

    await startFreshApp(page, {
      tasks: validTasks,
      archive: '{corrupted_archive_json',
      prefs: '{"muted": "not-a-boolean"}',
    });

    await expect(page.getByTestId('postit-note-42')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('postit-note-42')).toBeVisible();

    const storedTasks = await readTasksFromLocalStorage(page);
    expect(storedTasks.wersja).toBe(3);
    expect(storedTasks.zadania).toHaveLength(1);
    expect(storedTasks.zadania[0].id).toBe(42);

    const archive = await readArchiveFromLocalStorage(page);
    expect(archive).toEqual({ wersja: 1, archiwum: [] });

    const prefs = await readPrefsFromLocalStorage(page);
    expect(prefs.muted).toBe(false);

    guard.assertNoErrors();
  });

  test('T5-05: importing zadania.json while modal is open and floor balls exist clears floorBalls and closes modals', async ({ page }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    await doubleClickNoteAndVerifyNoModal(page, 1);
    await doubleClickNoteAndVerifyNoModal(page, 4);
    await expect(page.getByTestId('floor-ball-1')).toBeVisible();
    await expect(page.getByTestId('floor-ball-4')).toBeVisible();

    // Open TrashModal
    await page.getByTestId('trash-hitbox').click();
    await expect(page.getByTestId('trash-drawer')).toBeVisible();

    const importedPayload: TasksFile = {
      wersja: 4,
      zadania: [
        {
          id: 101,
          tytul: 'Nowe zadanie po imporcie',
          opis: '',
          termin: formatLocalDateOffset(2),
          priorytet: 'sredni',
          wykonane: false,
          tagi: ['import'],
        },
      ],
    };

    await uploadTasksJsonPayload(page, 'zadania-v4.json', importedPayload);

    await expect(page.getByTestId('trash-drawer')).not.toBeVisible();
    await expect(page.getByTestId('floor-ball-1')).not.toBeVisible();
    await expect(page.getByTestId('floor-ball-4')).not.toBeVisible();
    await expect(page.getByTestId('postit-note-101')).toBeVisible();

    const exported = await exportTasksJson(page, 4);
    expect(exported.data.zadania).toEqual(importedPayload.zadania);

    guard.assertNoErrors();
  });

  test('T5-UI-01: imported case-variant duplicate tags deduplicate without React duplicate-key console.error', async ({ page }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    const payload: TasksFile = {
      wersja: 1,
      zadania: [
        {
          id: 77,
          tytul: 'Zadanie ze zduplikowanymi tagami',
          opis: 'Test deduplikacji',
          termin: formatLocalDateOffset(0),
          priorytet: 'wysoki',
          wykonane: false,
          tagi: ['Studia', 'studia', '  STUDIA  '],
        },
      ],
    };

    await uploadTasksJsonPayload(page, 'dup-tags.json', payload);
    await page.getByTestId('postit-note-77').click();
    await expect(page.getByTestId('task-modal')).toBeVisible();

    // Only one deduplicated chip should render
    await expect(page.getByTestId('task-tag-chip-studia')).toHaveCount(1);

    // Trying to add another case variant should not duplicate
    await page.getByTestId('task-input-tag').fill('  STUDIA  ');
    await page.getByTestId('task-btn-add-tag').click();
    await expect(page.getByTestId('task-tag-chip-studia')).toHaveCount(1);

    await page.getByTestId('task-btn-save').click();
    await expect(page.getByTestId('task-modal')).not.toBeVisible();

    const exported = await exportTasksJson(page, 1);
    expect(exported.data.zadania[0].tagi).toEqual(['Studia']);

    guard.assertNoErrors();
  });

  test('T5-UI-02: long unbroken 200-char title and 60-char tag do not expand PostItNote past 196px', async ({ page }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page, { tasks: { wersja: 1, zadania: [] } });

    const longTitle = 'A'.repeat(200);
    const longTag = 'b'.repeat(60);

    await createTaskViaModal(page, {
      tytul: longTitle,
      termin: null,
      priorytet: 'sredni',
      tagi: [longTag],
    });

    const note = page.getByTestId('postit-note-1');
    await expect(note).toBeVisible();

    const noteBox = await note.boundingBox();
    const cellBox = await page.getByTestId('zone-cell-sredni-noDeadline').boundingBox();
    expect(noteBox).not.toBeNull();
    expect(cellBox).not.toBeNull();

    // 196px card width + small tolerance for deterministic rotation bounding box
    expect(noteBox!.width).toBeLessThanOrEqual(210);
    expect(noteBox!.x + noteBox!.width).toBeLessThanOrEqual(cellBox!.x + cellBox!.width + 4);

    guard.assertNoErrors();
  });

  test('T5-UI-03: stacked TrashModal + ContextMenu dismisses ONLY ContextMenu on Escape and backdrop click', async ({ page }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    await page.getByTestId('trash-hitbox').click();
    const trashModal = page.getByTestId('trash-drawer');
    await expect(trashModal).toBeVisible();

    const firstTrashBall = trashModal.locator('[data-testid^="trash-ball-"]').first();
    await firstTrashBall.click({ button: 'right' });
    await expect(page.getByTestId('context-menu')).toBeVisible();

    // 1. Escape closes ONLY ContextMenu
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('context-menu')).not.toBeVisible();
    await expect(trashModal).toBeVisible();

    // 2. Backdrop outside-click closes ONLY ContextMenu
    await firstTrashBall.click({ button: 'right' });
    await expect(page.getByTestId('context-menu')).toBeVisible();

    await page.mouse.click(10, 10);
    await expect(page.getByTestId('context-menu')).not.toBeVisible();
    await expect(trashModal).toBeVisible();

    guard.assertNoErrors();
  });

  test('T5-UI-04: stale selected tag filter stays visible and recoverable after completing last matching task', async ({ page }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    await createTaskViaModal(page, {
      tytul: 'Zadanie z unikalnym tagiem',
      termin: null,
      priorytet: 'niski',
      tagi: ['jedynytag'],
    });

    const uniqueChip = page.getByTestId('tag-filter-jedynytag');
    await uniqueChip.click();

    await expect(page.locator('[data-testid^="postit-note-"]')).toHaveCount(1);

    const matchingNote = page.locator('[data-testid^="postit-note-"]').first();
    await matchingNote.click({ button: 'right' });
    await page.getByTestId('context-menu-complete').click();

    await expect(uniqueChip).toBeVisible();
    await expect(page.getByTestId('corkboard-empty-filter-hint')).toBeVisible();

    await page.getByTestId('tag-filter-reset').click();
    await expect(page.getByTestId('corkboard-empty-filter-hint')).not.toBeVisible();
    expect(await page.locator('[data-testid^="postit-note-"]').count()).toBeGreaterThan(10);

    guard.assertNoErrors();
  });

  test('T5-UI-05: Enter in TaskModal tag input adds tag without submitting; Enter in empty title shows validation error', async ({ page }) => {
    const guard = attachErrorGuards(page);
    await startFreshApp(page);

    await page.getByTestId('btn-new-task').click();
    await expect(page.getByTestId('task-modal')).toBeVisible();

    const tagInput = page.getByTestId('task-input-tag');
    await tagInput.fill('nowytag');
    await tagInput.press('Enter');

    await expect(page.getByTestId('task-modal')).toBeVisible();
    await expect(page.getByTestId('task-tag-chip-nowytag')).toBeVisible();

    const titleInput = page.getByTestId('task-input-title');
    await titleInput.fill('   ');
    await titleInput.press('Enter');

    await expect(page.getByTestId('task-title-error')).toBeVisible();
    await expect(page.getByTestId('task-modal')).toBeVisible();

    guard.assertNoErrors();
  });
});
