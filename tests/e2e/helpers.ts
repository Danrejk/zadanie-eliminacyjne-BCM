import fs from 'node:fs';
import path from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';

export type Priority = 'wysoki' | 'sredni' | 'niski';
export type TimeZone = 'overdue' | 'todayTomorrow' | 'thisWeek' | 'later' | 'noDeadline';

export const PRIORITIES: readonly Priority[] = ['wysoki', 'sredni', 'niski'] as const;
export const TIME_ZONES: readonly TimeZone[] = [
  'overdue',
  'todayTomorrow',
  'thisWeek',
  'later',
  'noDeadline',
] as const;

export interface Task {
  id: number;
  tytul: string;
  opis: string;
  termin: string | null;
  priorytet: Priority;
  wykonane: boolean;
  tagi: string[];
}

export interface TasksFile {
  wersja: number;
  zadania: Task[];
}

export interface ArchiveEntry {
  task: Task;
  oproznionoDnia: string;
}

export interface ArchiveFile {
  wersja: 1;
  archiwum: ArchiveEntry[];
}

export interface PrefsData {
  muted: boolean;
}

export const TASKS_STORAGE_KEY = 'smartapp_tasks_v1';
export const ARCHIVE_STORAGE_KEY = 'smartapp_archive_v1';
export const PREFS_STORAGE_KEY = 'smartapp_prefs_v1';

const STRICT_TASK_KEYS = ['id', 'opis', 'priorytet', 'tagi', 'termin', 'tytul', 'wykonane'];
const STRICT_TASKS_FILE_KEYS = ['wersja', 'zadania'];
const STRICT_ARCHIVE_FILE_KEYS = ['archiwum', 'wersja'];
const STRICT_ARCHIVE_ENTRY_KEYS = ['oproznionoDnia', 'task'];

export interface ErrorGuard {
  errors: string[];
  assertNoErrors: () => void;
}

/**
 * Attaches console.error and pageerror listeners to the Playwright page.
 * Call `guard.assertNoErrors()` at the end of every test to enforce a zero-error runtime.
 */
export function attachErrorGuards(page: Page): ErrorGuard {
  const errors: string[] = [];
  page.on('pageerror', (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`console.error: ${msg.text()}`);
    }
  });
  return {
    errors,
    assertNoErrors: () => {
      expect(errors, `Unexpected runtime or console errors:\n${errors.join('\n')}`).toEqual([]);
    },
  };
}

export interface SeedOptions {
  /** Raw JSON string or object for smartapp_tasks_v1; omit to use built-in sampleTasks.json */
  tasks?: TasksFile | string;
  /** Raw JSON string or object for smartapp_archive_v1 */
  archive?: ArchiveFile | string;
  /** Raw JSON string or object for smartapp_prefs_v1 */
  prefs?: PrefsData | string;
}

/**
 * Navigates to the app with clean or explicitly seeded localStorage on initial load.
 * Uses a sessionStorage sentinel so subsequent `await page.reload()` calls preserve
 * all localStorage mutations made during the test session.
 */
export async function startFreshApp(page: Page, seed?: SeedOptions): Promise<void> {
  const payload = {
    tasks:
      seed?.tasks === undefined
        ? null
        : typeof seed.tasks === 'string'
          ? seed.tasks
          : JSON.stringify(seed.tasks),
    archive:
      seed?.archive === undefined
        ? null
        : typeof seed.archive === 'string'
          ? seed.archive
          : JSON.stringify(seed.archive),
    prefs:
      seed?.prefs === undefined
        ? null
        : typeof seed.prefs === 'string'
          ? seed.prefs
          : JSON.stringify(seed.prefs),
  };

  await page.addInitScript((data) => {
    const OriginalDate = window.Date;
    const realStart = OriginalDate.now();
    const fixedStart = new OriginalDate(2026, 10, 19, 12, 0, 0, 0).getTime();
    const getPinnedNow = () => fixedStart + (OriginalDate.now() - realStart);

    function PinnedDate(this: Date, ...args: unknown[]): Date | string {
      if (!(this instanceof PinnedDate)) {
        return new OriginalDate(getPinnedNow()).toString();
      }
      if (args.length === 0) {
        return new OriginalDate(getPinnedNow());
      }
      // @ts-expect-error forwarding dynamic Date constructor args
      return new OriginalDate(...args);
    }
    PinnedDate.prototype = OriginalDate.prototype;
    PinnedDate.now = getPinnedNow;
    PinnedDate.parse = OriginalDate.parse;
    PinnedDate.UTC = OriginalDate.UTC;
    window.Date = PinnedDate as unknown as DateConstructor;

    if (!window.sessionStorage.getItem('__smartapp_e2e_seeded__')) {
      window.localStorage.clear();
      if (data.tasks !== null) {
        window.localStorage.setItem('smartapp_tasks_v1', data.tasks);
      }
      if (data.archive !== null) {
        window.localStorage.setItem('smartapp_archive_v1', data.archive);
      }
      if (data.prefs !== null) {
        window.localStorage.setItem('smartapp_prefs_v1', data.prefs);
      }
      window.sessionStorage.setItem('__smartapp_e2e_seeded__', '1');
    }
  }, payload);

  await page.goto('/');
  await expect(page.getByTestId('corkboard')).toBeVisible();
  await expect(page.getByTestId('topbar')).toBeVisible();
}

/**
 * Formats a local calendar date offset from the pinned E2E date (`2026-11-19`) as `YYYY-MM-DD`,
 * matching `dateBuckets.ts` local calendar day arithmetic.
 */
export function formatLocalDateOffset(offsetDays: number): string {
  const target = new Date(2026, 10, 19 + offsetDays);
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, '0');
  const day = String(target.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Validates that a string is a real Gregorian calendar date in `YYYY-MM-DD` format.
 */
export function isValidGregorianDate(str: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return false;
  }
  const [yStr, mStr, dStr] = str.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

/**
 * Validates that a string is a strict ISO-8601 timestamp with valid Gregorian date and timezone.
 */
export function isValidIsoTimestamp(str: string): boolean {
  const match =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|([+-])(\d{2}):(\d{2}))$/.exec(
      str,
    );
  if (!match) {
    return false;
  }
  const [, datePart, hhStr, mmStr, ssStr, tzPart, , tzHStr, tzMStr] = match;
  if (!isValidGregorianDate(datePart)) {
    return false;
  }
  const hh = Number(hhStr);
  const mm = Number(mmStr);
  const ss = Number(ssStr);
  if (hh > 23 || mm > 59 || ss > 59) {
    return false;
  }
  if (tzPart !== 'Z') {
    const tzH = Number(tzHStr);
    const tzM = Number(tzMStr);
    if (tzH > 23 || tzM > 59) {
      return false;
    }
  }
  return !Number.isNaN(Date.parse(str));
}

/**
 * Normalizes a tag string using the frozen `tag.trim().toLowerCase()` rule.
 */
export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

/**
 * Resolves an absolute path to a fixture inside `tests/e2e/fixtures/`.
 */
export function getFixturePath(filename: string): string {
  return path.resolve(process.cwd(), 'tests/e2e/fixtures', filename);
}

/**
 * Reads and parses a JSON fixture file from `tests/e2e/fixtures/`.
 */
export function readFixtureJson<T = TasksFile>(filename: string): T {
  const raw = fs.readFileSync(getFixturePath(filename), 'utf-8');
  return JSON.parse(raw) as T;
}

/**
 * Uploads a fixture file (by fixture filename or absolute path) into `import-json-input`.
 */
export async function uploadTasksJson(page: Page, fixtureNameOrPath: string): Promise<void> {
  const resolvedPath = path.isAbsolute(fixtureNameOrPath)
    ? fixtureNameOrPath
    : getFixturePath(fixtureNameOrPath);
  const input = page.getByTestId('import-json-input');
  await input.setInputFiles(resolvedPath);
}

/**
 * Uploads an in-memory JSON payload (object or raw string) via `import-json-input`
 * without creating any temporary files on disk.
 */
export async function uploadTasksJsonPayload(
  page: Page,
  filename: string,
  payload: TasksFile | string,
): Promise<void> {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  const input = page.getByTestId('import-json-input');
  await input.setInputFiles({
    name: filename,
    mimeType: 'application/json',
    buffer: Buffer.from(text, 'utf-8'),
  });
}

async function readDownloadText(download: {
  path: () => Promise<string | null>;
  createReadStream: () => Promise<NodeJS.ReadableStream | null>;
}): Promise<string> {
  const filePath = await download.path();
  if (filePath) {
    return fs.readFileSync(filePath, 'utf-8');
  }
  const stream = await download.createReadStream();
  if (!stream) {
    throw new Error('Playwright download had neither a file path nor a readable stream');
  }
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

export interface ExportResult<T> {
  filename: string;
  rawText: string;
  data: T;
}

/**
 * Clicks `btn-export-json`, captures the browser download, verifies the suggested filename
 * is `zadania.json`, parses the JSON, and validates the strict competition schema.
 */
export async function exportTasksJson(
  page: Page,
  expectedVersion?: number,
): Promise<ExportResult<TasksFile>> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('btn-export-json').click(),
  ]);
  const filename = download.suggestedFilename();
  expect(filename).toBe('zadania.json');
  const rawText = await readDownloadText(download);
  const parsed: unknown = JSON.parse(rawText);
  assertStrictTasksSchema(parsed, expectedVersion);
  return {
    filename,
    rawText,
    data: parsed,
  };
}

/**
 * Clicks `btn-export-archive` inside `ArchiveModal`, captures the browser download,
 * verifies the suggested filename is `archiwum_usunietych.json`, parses the JSON,
 * and validates the strict archive schema.
 */
export async function exportArchiveJson(page: Page): Promise<ExportResult<ArchiveFile>> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('btn-export-archive').click(),
  ]);
  const filename = download.suggestedFilename();
  expect(filename).toBe('archiwum_usunietych.json');
  const rawText = await readDownloadText(download);
  const parsed: unknown = JSON.parse(rawText);
  assertStrictArchiveSchema(parsed);
  return {
    filename,
    rawText,
    data: parsed,
  };
}

/**
 * Asserts that a single task object has strictly the 7 competition fields with valid types
 * and zero leaked UI, physics, or archive fields.
 */
export function assertStrictTaskObject(
  task: unknown,
  contextLabel = 'task',
): asserts task is Task {
  expect(typeof task === 'object' && task !== null && !Array.isArray(task), `${contextLabel} must be a plain object`).toBe(
    true,
  );
  const record = task as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  expect(keys, `${contextLabel} must contain strictly the 7 competition keys`).toEqual(
    STRICT_TASK_KEYS,
  );

  expect(
    typeof record.id === 'number' && Number.isSafeInteger(record.id) && record.id >= 0,
    `${contextLabel}.id must be a safe integer >= 0`,
  ).toBe(true);

  expect(
    typeof record.tytul === 'string' && record.tytul.trim().length > 0,
    `${contextLabel}.tytul must be a non-empty string`,
  ).toBe(true);

  expect(typeof record.opis === 'string', `${contextLabel}.opis must be a string`).toBe(true);

  expect(
    record.termin === null ||
      (typeof record.termin === 'string' && isValidGregorianDate(record.termin)),
    `${contextLabel}.termin must be null or valid YYYY-MM-DD`,
  ).toBe(true);

  expect(
    record.priorytet === 'niski' || record.priorytet === 'sredni' || record.priorytet === 'wysoki',
    `${contextLabel}.priorytet must be niski | sredni | wysoki`,
  ).toBe(true);

  expect(typeof record.wykonane === 'boolean', `${contextLabel}.wykonane must be a boolean`).toBe(
    true,
  );

  expect(
    Array.isArray(record.tagi) && record.tagi.every((t) => typeof t === 'string'),
    `${contextLabel}.tagi must be an array of strings`,
  ).toBe(true);
}

/**
 * Asserts that a parsed JSON value strictly conforms to `{ wersja: number, zadania: Task[] }`
 * with unique task IDs and zero extra keys at root or task level.
 */
export function assertStrictTasksSchema(
  parsed: unknown,
  expectedVersion?: number,
): asserts parsed is TasksFile {
  expect(
    typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed),
    'Tasks JSON root must be a plain object',
  ).toBe(true);
  const root = parsed as Record<string, unknown>;
  expect(Object.keys(root).sort(), 'Tasks JSON root must have strictly [wersja, zadania]').toEqual(
    STRICT_TASKS_FILE_KEYS,
  );

  expect(
    typeof root.wersja === 'number' && Number.isSafeInteger(root.wersja) && root.wersja >= 1,
    'Tasks JSON wersja must be a safe integer >= 1',
  ).toBe(true);

  if (expectedVersion !== undefined) {
    expect(root.wersja).toBe(expectedVersion);
  }

  expect(Array.isArray(root.zadania), 'Tasks JSON zadania must be an array').toBe(true);
  const tasks = root.zadania as unknown[];
  const seenIds = new Set<number>();

  tasks.forEach((item, index) => {
    assertStrictTaskObject(item, `zadania[${index}]`);
    expect(seenIds.has(item.id), `Duplicate task ID ${item.id} at zadania[${index}]`).toBe(false);
    seenIds.add(item.id);
  });
}

/**
 * Asserts that a parsed JSON value strictly conforms to `{ wersja: 1, archiwum: ArchiveEntry[] }`
 * with valid ISO-8601 `oproznionoDnia` and strict 7-field completed `task` objects.
 */
export function assertStrictArchiveSchema(parsed: unknown): asserts parsed is ArchiveFile {
  expect(
    typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed),
    'Archive JSON root must be a plain object',
  ).toBe(true);
  const root = parsed as Record<string, unknown>;
  expect(
    Object.keys(root).sort(),
    'Archive JSON root must have strictly [archiwum, wersja]',
  ).toEqual(STRICT_ARCHIVE_FILE_KEYS);

  expect(root.wersja, 'Archive JSON wersja must be strictly 1').toBe(1);
  expect(Array.isArray(root.archiwum), 'Archive JSON archiwum must be an array').toBe(true);

  const entries = root.archiwum as unknown[];
  entries.forEach((entry, index) => {
    expect(
      typeof entry === 'object' && entry !== null && !Array.isArray(entry),
      `archiwum[${index}] must be a plain object`,
    ).toBe(true);
    const rec = entry as Record<string, unknown>;
    expect(
      Object.keys(rec).sort(),
      `archiwum[${index}] must have strictly [oproznionoDnia, task]`,
    ).toEqual(STRICT_ARCHIVE_ENTRY_KEYS);

    expect(
      typeof rec.oproznionoDnia === 'string' && isValidIsoTimestamp(rec.oproznionoDnia),
      `archiwum[${index}].oproznionoDnia must be a valid ISO-8601 timestamp`,
    ).toBe(true);

    assertStrictTaskObject(rec.task, `archiwum[${index}].task`);
    expect(rec.task.wykonane, `archiwum[${index}].task.wykonane must be true`).toBe(true);
  });
}

/**
 * Reads and validates `smartapp_tasks_v1` from the page's localStorage.
 */
export async function readTasksFromLocalStorage(page: Page): Promise<TasksFile> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), TASKS_STORAGE_KEY);
  expect(raw, `${TASKS_STORAGE_KEY} should exist in localStorage`).not.toBeNull();
  const parsed: unknown = JSON.parse(raw!);
  assertStrictTasksSchema(parsed);
  return parsed;
}

/**
 * Reads and validates `smartapp_archive_v1` from the page's localStorage.
 */
export async function readArchiveFromLocalStorage(page: Page): Promise<ArchiveFile> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), ARCHIVE_STORAGE_KEY);
  expect(raw, `${ARCHIVE_STORAGE_KEY} should exist in localStorage`).not.toBeNull();
  const parsed: unknown = JSON.parse(raw!);
  assertStrictArchiveSchema(parsed);
  return parsed;
}

/**
 * Reads `smartapp_prefs_v1` from the page's localStorage.
 */
export async function readPrefsFromLocalStorage(page: Page): Promise<PrefsData> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), PREFS_STORAGE_KEY);
  expect(raw, `${PREFS_STORAGE_KEY} should exist in localStorage`).not.toBeNull();
  const parsed = JSON.parse(raw!) as unknown;
  expect(
    typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as Record<string, unknown>).muted === 'boolean',
  ).toBe(true);
  return parsed as PrefsData;
}

/**
 * Parses and validates the integer N from `completed-count-bar`,
 * enforcing the strict user constraint that ONLY `Ukończone: <N>` is shown in the bar.
 */
export async function getCompletedCountFromBar(page: Page): Promise<number> {
  const bar = page.getByTestId('completed-count-bar');
  await expect(bar).toBeVisible();
  const text = (await bar.textContent()) ?? '';
  const match = /^\s*Ukończone:\s*(\d+)\s*$/.exec(text);
  expect(
    match,
    `completed-count-bar must display strictly "Ukończone: <N>", got: "${text}"`,
  ).not.toBeNull();
  return Number(match![1]);
}

async function performHtml5Drag(
  page: Page,
  taskId: number,
  targetTestId: string,
  mode: 'drop' | 'leave',
): Promise<{ transferredTaskId: string }> {
  const sourceTestId = `postit-note-${taskId}`;
  await expect(page.getByTestId(sourceTestId)).toBeVisible();
  await expect(page.getByTestId(targetTestId)).toBeVisible();

  const result = await page.evaluate(
    async ({ srcId, dstId, dragMode }) => {
      const waitFrames = (n: number) =>
        new Promise<void>((resolve) => {
          const step = (rem: number) =>
            rem <= 0 ? resolve() : requestAnimationFrame(() => step(rem - 1));
          step(n);
        });

      const noteEl = document.querySelector(`[data-testid="${srcId}"]`) as HTMLElement | null;
      const targetEl = document.querySelector(`[data-testid="${dstId}"]`) as HTMLElement | null;
      if (!noteEl) {
        throw new Error(`Source note not found: ${srcId}`);
      }
      if (!targetEl) {
        throw new Error(`Drop target not found: ${dstId}`);
      }

      const dragEl =
        (noteEl.getAttribute('draggable') === 'true' ? noteEl : null) ??
        (noteEl.querySelector('[draggable="true"]') as HTMLElement | null) ??
        (noteEl.closest('[draggable="true"]') as HTMLElement | null);
      if (!dragEl) {
        throw new Error(`No [draggable="true"] element found for ${srcId}`);
      }

      const dt = new DataTransfer();
      // Do NOT pre-populate dt — let the application's own onDragStart populate it!
      dragEl.dispatchEvent(
        new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }),
      );
      await waitFrames(2);

      const transferredTaskId =
        dt.getData('application/x-smartapp-task-id') || dt.getData('text/plain') || '';

      targetEl.dispatchEvent(
        new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }),
      );
      targetEl.dispatchEvent(
        new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }),
      );
      await waitFrames(2);

      if (dragMode === 'drop') {
        targetEl.dispatchEvent(
          new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }),
        );
      } else {
        targetEl.dispatchEvent(
          new DragEvent('dragleave', {
            bubbles: true,
            cancelable: true,
            dataTransfer: dt,
            relatedTarget: document.body,
          }),
        );
      }
      await waitFrames(1);

      dragEl.dispatchEvent(
        new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt }),
      );
      await waitFrames(2);

      return { transferredTaskId };
    },
    { srcId: sourceTestId, dstId: targetTestId, dragMode: mode },
  );

  expect(result.transferredTaskId, 'App onDragStart must populate task ID in DataTransfer').toBe(
    String(taskId),
  );
  await page.waitForTimeout(80);
  return result;
}

/**
 * Drags a Post-it note via genuine HTML5 DragEvent sequence onto a target `(priority, zone)` cell.
 */
export async function dragPostItToCell(
  page: Page,
  taskId: number,
  targetPriority: Priority,
  targetZone: TimeZone,
): Promise<void> {
  await performHtml5Drag(
    page,
    taskId,
    `zone-cell-${targetPriority}-${targetZone}`,
    'drop',
  );
}

/**
 * Drags a Post-it note directly onto `trash-can-widget` and drops it.
 */
export async function dragPostItToTrash(page: Page, taskId: number): Promise<void> {
  await performHtml5Drag(page, taskId, 'trash-can-widget', 'drop');
}

/**
 * Drags a Post-it note over `trash-can-widget` (`dragenter` + `dragover`) and then leaves
 * (`dragleave` + `dragend`) without dropping.
 */
export async function dragPostItOverTrashThenLeave(page: Page, taskId: number): Promise<void> {
  await performHtml5Drag(page, taskId, 'trash-can-widget', 'leave');
}

/**
 * Double-clicks a Post-it note, verifies it crumples into a floor ball, and waits strictly
 * past the 230ms single-click debounce timer (>= 380ms) to prove `task-modal` never opens.
 */
export async function doubleClickNoteAndVerifyNoModal(
  page: Page,
  taskId: number,
): Promise<void> {
  const note = page.getByTestId(`postit-note-${taskId}`);
  await expect(note).toBeVisible();
  await note.dblclick();
  await expect(page.getByTestId(`floor-ball-${taskId}`)).toBeVisible({ timeout: 3000 });
  await page.waitForTimeout(380);
  await expect(page.getByTestId('task-modal')).toHaveCount(0);
  await expect(page.getByTestId(`floor-ball-${taskId}`)).toHaveCount(1);
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Polls the bounding box of `floor-ball-${taskId}` until its position stabilizes near the floor.
 */
export async function waitForFloorBallSettled(
  page: Page,
  taskId: number,
  timeoutMs = 5000,
): Promise<BoundingBox> {
  const ball = page.getByTestId(`floor-ball-${taskId}`);
  await expect(ball).toBeVisible({ timeout: 3000 });

  const viewportSize = page.viewportSize() ?? { width: 1440, height: 900 };
  const deadline = Date.now() + timeoutMs;
  let prevBox = await ball.boundingBox();
  let stableTicks = 0;

  while (Date.now() < deadline) {
    await page.waitForTimeout(100);
    const currBox = await ball.boundingBox();
    if (currBox && prevBox) {
      const dx = Math.abs(currBox.x - prevBox.x);
      const dy = Math.abs(currBox.y - prevBox.y);
      const nearFloor = currBox.y + currBox.height / 2 > viewportSize.height * 0.55;
      if (dx < 2 && dy < 2 && nearFloor) {
        stableTicks += 1;
        if (stableTicks >= 2) {
          return currBox;
        }
      } else {
        stableTicks = 0;
      }
    }
    prevBox = currBox;
  }

  const finalBox = await ball.boundingBox();
  expect(finalBox, `floor-ball-${taskId} boundingBox should exist after settling`).not.toBeNull();
  return finalBox!;
}

/**
 * Grabs a settled floor ball with the pointer, verifies `trash-can-widget` enlarges
 * (`data-enlarged="true"`), drags the ball into `trash-hitbox`, releases, and verifies
 * the ball is captured and the trash widget returns to `data-enlarged="false"`.
 */
export async function grabAndDropFloorBallIntoTrash(page: Page, taskId: number): Promise<void> {
  const box = await waitForFloorBallSettled(page, taskId);
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down({ button: 'left' });

  await expect(page.getByTestId('trash-can-widget')).toHaveAttribute('data-enlarged', 'true');
  await page.waitForTimeout(150);

  const hitbox = await page.getByTestId('trash-hitbox').boundingBox();
  expect(hitbox, 'trash-hitbox boundingBox must be available').not.toBeNull();

  const targetX = hitbox!.x + hitbox!.width / 2;
  const targetY = hitbox!.y + hitbox!.height / 2;

  await page.mouse.move(targetX, targetY, { steps: 10 });
  await page.mouse.up({ button: 'left' });

  await expect(page.getByTestId(`floor-ball-${taskId}`)).toHaveCount(0, { timeout: 3500 });
  await expect(page.getByTestId('trash-can-widget')).toHaveAttribute('data-enlarged', 'false', {
    timeout: 3500,
  });
}

/**
 * Grabs a settled floor ball, verifies `trash-can-widget` enlarges, positions the ball
 * outside the enlarged `trash-hitbox`, and performs a rapid high-velocity pointer flick
 * releasing airborne outside the hitbox aimed straight through the hitbox center so
 * swept segment collision (`doesSegmentHitRect`) captures the ball in flight.
 */
export async function grabAndThrowFloorBallIntoTrashArc(
  page: Page,
  taskId: number,
): Promise<void> {
  const box = await waitForFloorBallSettled(page, taskId);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down({ button: 'left' });

  await expect(page.getByTestId('trash-can-widget')).toHaveAttribute('data-enlarged', 'true');
  await page.waitForTimeout(160);

  const hitbox = await page.getByTestId('trash-hitbox').boundingBox();
  expect(hitbox, 'trash-hitbox boundingBox must be available').not.toBeNull();

  const ty = hitbox!.y + hitbox!.height / 2;

  // Move to a launch position anchored to the hitbox's left edge and pause >80ms
  // so old pointer velocity samples expire outside VELOCITY_WINDOW_MS (80ms).
  // Anchoring to hitbox.x keeps horizontal flick velocity positive across all enlarged hitbox widths.
  const launchX = Math.max(40, hitbox!.x - 160);
  const launchY = Math.max(40, ty - 50);
  await page.mouse.move(launchX, launchY, { steps: 8 });
  await page.waitForTimeout(110);

  // Rapid 4-step flick toward the hitbox, releasing outside the left edge of the hitbox
  const releaseX = Math.max(launchX + 40, hitbox!.x - 24);
  const releaseY = Math.max(40, ty - 18);
  await page.mouse.move(releaseX, releaseY, { steps: 4 });
  await page.mouse.up({ button: 'left' });

  await expect(page.getByTestId(`floor-ball-${taskId}`)).toHaveCount(0, { timeout: 3500 });
  await expect(page.getByTestId('trash-can-widget')).toHaveAttribute('data-enlarged', 'false', {
    timeout: 3500,
  });
}

/**
 * Grabs a settled floor ball, verifies `trash-can-widget` enlarges (`data-enlarged="true"`),
 * throws the ball away toward the top-left of the viewport (missing the bottom-right trash),
 * waits for it to settle back on the floor, and verifies the ball remains on the floor while
 * `trash-can-widget` shrinks back (`data-enlarged="false"`).
 */
export async function grabAndMissThrowFloorBall(page: Page, taskId: number): Promise<void> {
  const box = await waitForFloorBallSettled(page, taskId);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down({ button: 'left' });

  await expect(page.getByTestId('trash-can-widget')).toHaveAttribute('data-enlarged', 'true');

  await page.mouse.move(360, 360, { steps: 6 });
  await page.mouse.move(300, 200, { steps: 6 });
  await page.mouse.up({ button: 'left' });

  await waitForFloorBallSettled(page, taskId, 5000);
  await expect(page.getByTestId(`floor-ball-${taskId}`)).toHaveCount(1);
  await expect(page.getByTestId('trash-can-widget')).toHaveAttribute('data-enlarged', 'false', {
    timeout: 4000,
  });
}

export interface TaskFormInput {
  tytul: string;
  opis?: string;
  /** Pass null for no-deadline (`task-checkbox-no-deadline`), or `YYYY-MM-DD` string */
  termin?: string | null;
  priorytet?: Priority;
  tagi?: string[];
  removeTags?: string[];
}

/**
 * Fills out the currently open `TaskModal` form fields and optionally clicks Save.
 */
export async function fillTaskModalForm(
  page: Page,
  input: TaskFormInput,
  submit = true,
): Promise<void> {
  const modal = page.getByTestId('task-modal');
  await expect(modal).toBeVisible();

  await page.getByTestId('task-input-title').fill(input.tytul);

  if (input.opis !== undefined) {
    await page.getByTestId('task-input-desc').fill(input.opis);
  }

  if (input.termin !== undefined) {
    const noDeadlineCheckbox = page.getByTestId('task-checkbox-no-deadline');
    if (input.termin === null) {
      const isChecked = await noDeadlineCheckbox.isChecked();
      if (!isChecked) {
        await noDeadlineCheckbox.check();
      }
    } else {
      const isChecked = await noDeadlineCheckbox.isChecked();
      if (isChecked) {
        await noDeadlineCheckbox.uncheck();
      }
      await page.getByTestId('task-input-date').fill(input.termin);
    }
  }

  if (input.priorytet !== undefined) {
    await page.getByTestId(`task-priority-${input.priorytet}`).click();
  }

  if (input.removeTags && input.removeTags.length > 0) {
    for (const rawTag of input.removeTags) {
      const norm = normalizeTag(rawTag);
      const chip = page.getByTestId(`task-tag-chip-${norm}`);
      if ((await chip.count()) > 0) {
        const innerBtn = chip.locator('button').first();
        if ((await innerBtn.count()) > 0) {
          await innerBtn.click();
        } else {
          await chip.click();
        }
      }
    }
  }

  if (input.tagi && input.tagi.length > 0) {
    const tagInput = page.getByTestId('task-input-tag');
    const addTagBtn = page.getByTestId('task-btn-add-tag');
    for (const tag of input.tagi) {
      await tagInput.fill(tag);
      await addTagBtn.click();
    }
  }

  if (submit) {
    await page.getByTestId('task-btn-save').click();
    await expect(modal).toHaveCount(0);
  }
}

/**
 * Clicks `btn-new-task`, fills out `TaskModal`, saves, and waits for modal closure.
 */
export async function createTaskViaModal(page: Page, input: TaskFormInput): Promise<void> {
  await page.getByTestId('btn-new-task').click();
  await fillTaskModalForm(page, input, true);
}

/**
 * Opens `TaskModal` for an existing task (via single-click or right-click context menu),
 * applies the requested updates, and saves.
 */
export async function editTaskViaModal(
  page: Page,
  taskId: number,
  updates: TaskFormInput,
  openVia: 'click' | 'contextMenu' = 'click',
): Promise<void> {
  const note = page.getByTestId(`postit-note-${taskId}`);
  await expect(note).toBeVisible();

  if (openVia === 'click') {
    await note.click();
  } else {
    await note.click({ button: 'right' });
    await expect(page.getByTestId('context-menu')).toBeVisible();
    await page.getByTestId('context-menu-edit').click();
  }

  await fillTaskModalForm(page, updates, true);
}

/**
 * Extracts a normalized visual color signature from a pin or tag chip locator
 * so tests can verify deterministic tag color consistency across cards, TopBar, and TaskModal
 * without coupling to internal SVG/CSS class implementation details.
 */
export async function extractColorSignature(locator: Locator): Promise<string> {
  await expect(locator).toBeVisible();
  return locator.evaluate((el) => {
    interface ParsedColor {
      hex: string;
      a: number;
    }

    const CSS_KEYWORDS = new Set([
      'none',
      'transparent',
      'currentcolor',
      'initial',
      'inherit',
      'unset',
      'revert',
      'revert-layer',
      'auto',
    ]);

    const parseCssColor = (val: string): ParsedColor | null => {
      const trimmed = val.trim().toLowerCase();
      if (!trimmed || CSS_KEYWORDS.has(trimmed)) {
        return null;
      }

      const hexMatch = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(trimmed);
      if (hexMatch) {
        const raw = hexMatch[1];
        let rHex: string;
        let gHex: string;
        let bHex: string;
        let alpha = 1;
        if (raw.length === 3 || raw.length === 4) {
          rHex = raw[0] + raw[0];
          gHex = raw[1] + raw[1];
          bHex = raw[2] + raw[2];
          if (raw.length === 4) {
            alpha = parseInt(raw[3] + raw[3], 16) / 255;
          }
        } else {
          rHex = raw.slice(0, 2);
          gHex = raw.slice(2, 4);
          bHex = raw.slice(4, 6);
          if (raw.length === 8) {
            alpha = parseInt(raw.slice(6, 8), 16) / 255;
          }
        }
        if (alpha <= 0) {
          return null;
        }
        return { hex: `#${rHex}${gHex}${bHex}`, a: alpha };
      }

      const rgbMatch =
        /^rgba?\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})(?:\s*[,/]\s*([0-9.]+%?))?\s*\)$/.exec(
          trimmed,
        );
      if (rgbMatch) {
        const r = Math.min(255, Number(rgbMatch[1]));
        const g = Math.min(255, Number(rgbMatch[2]));
        const b = Math.min(255, Number(rgbMatch[3]));
        let alpha = 1;
        if (rgbMatch[4] !== undefined) {
          alpha = rgbMatch[4].endsWith('%')
            ? parseFloat(rgbMatch[4]) / 100
            : parseFloat(rgbMatch[4]);
        }
        if (!Number.isFinite(alpha) || alpha <= 0) {
          return null;
        }
        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        return { hex, a: alpha };
      }

      return null;
    };

    const isUsableColor = (
      parsed: ParsedColor | null,
      requireOpaque = true,
    ): parsed is ParsedColor => {
      if (!parsed) {
        return false;
      }
      if (requireOpaque && parsed.a < 0.99) {
        return false;
      }
      return parsed.hex !== '#ffffff' && parsed.hex !== '#000000';
    };

    const extractGradientPrimaryColor = (value: string): string | null => {
      if (!value || !value.includes('gradient(')) {
        return null;
      }
      const matches = value.match(/rgba?\([^)]+\)|#[0-9a-f]{3,8}\b/gi);
      if (!matches || matches.length === 0) {
        return null;
      }
      const stops: string[] = [];
      for (const token of matches) {
        const parsed = parseCssColor(token);
        if (isUsableColor(parsed, true)) {
          stops.push(parsed.hex);
        }
      }
      if (stops.length === 0) {
        return null;
      }
      // For 3+ stop 3D gradients (highlight -> primary -> shadow), the middle stop is the primary color.
      return stops.length >= 3 ? stops[Math.floor(stops.length / 2)] : stops[0];
    };

    // 1. Explicit semantic color attribute if present on the target element
    const dataColor = el.getAttribute('data-color') || el.getAttribute('data-pin-color');
    if (dataColor) {
      const parsed = parseCssColor(dataColor);
      if (isUsableColor(parsed, true)) {
        return parsed.hex;
      }
    }

    const descendants = Array.from(el.querySelectorAll('*')) as HTMLElement[];

    // 2. Prioritize child visual swatches/dots/spheres/SVGs over shared outer button chrome
    for (const node of descendants) {
      const fillAttr = node.getAttribute('fill');
      if (fillAttr && !fillAttr.startsWith('url(')) {
        const parsed = parseCssColor(fillAttr);
        if (isUsableColor(parsed, true)) {
          return parsed.hex;
        }
      }
      const inlineBg = node.style?.backgroundColor;
      if (inlineBg) {
        const parsed = parseCssColor(inlineBg);
        if (isUsableColor(parsed, true)) {
          return parsed.hex;
        }
      }
      const inlineGradient = node.style?.backgroundImage || node.style?.background;
      if (inlineGradient) {
        const gradColor = extractGradientPrimaryColor(inlineGradient);
        if (gradColor) {
          return gradColor;
        }
      }
    }

    // 3. Inspect outer element inline accent styles (opaque background, gradient, or border)
    const outerEl = el as HTMLElement;
    const outerFill = outerEl.getAttribute('fill');
    if (outerFill && !outerFill.startsWith('url(')) {
      const parsed = parseCssColor(outerFill);
      if (isUsableColor(parsed, true)) {
        return parsed.hex;
      }
    }
    if (outerEl.style?.backgroundColor) {
      const parsed = parseCssColor(outerEl.style.backgroundColor);
      if (isUsableColor(parsed, true)) {
        return parsed.hex;
      }
    }
    const outerGradient = outerEl.style?.backgroundImage || outerEl.style?.background;
    if (outerGradient) {
      const gradColor = extractGradientPrimaryColor(outerGradient);
      if (gradColor) {
        return gradColor;
      }
    }
    if (outerEl.style?.borderColor) {
      const parsed = parseCssColor(outerEl.style.borderColor);
      if (isUsableColor(parsed, true)) {
        return parsed.hex;
      }
    }

    // 4. Descendant inline border color fallback (e.g. outlined swatch)
    for (const node of descendants) {
      const inlineBorder = node.style?.borderColor;
      if (inlineBorder) {
        const parsed = parseCssColor(inlineBorder);
        if (isUsableColor(parsed, true)) {
          return parsed.hex;
        }
      }
    }

    // 5. Computed styles fallback (preferring child swatches and opaque accents first)
    const orderedNodes: HTMLElement[] = [...descendants, outerEl];
    for (const node of orderedNodes) {
      const style = window.getComputedStyle(node);
      if (style.backgroundImage) {
        const gradColor = extractGradientPrimaryColor(style.backgroundImage);
        if (gradColor) {
          return gradColor;
        }
      }
      for (const prop of [style.fill, style.backgroundColor, style.borderColor]) {
        if (prop && !prop.startsWith('url(')) {
          const parsed = parseCssColor(prop);
          if (isUsableColor(parsed, true)) {
            return parsed.hex;
          }
        }
      }
    }

    for (const node of orderedNodes) {
      const style = window.getComputedStyle(node);
      for (const prop of [style.fill, style.backgroundColor, style.borderColor, style.color]) {
        if (prop && !prop.startsWith('url(')) {
          const parsed = parseCssColor(prop);
          if (isUsableColor(parsed, false)) {
            return parsed.hex;
          }
        }
      }
    }

    return '';
  });
}
