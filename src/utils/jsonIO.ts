import type { ArchiveEntry, ArchiveFile, Priority, Task, TasksFile } from '../types/task';
import { isValidDateString } from './dateBuckets';
import { normalizeTag } from './tagColors';

export const TASKS_STORAGE_KEY = 'smartapp_tasks_v1';
export const ARCHIVE_STORAGE_KEY = 'smartapp_archive_v1';
export const PREFS_STORAGE_KEY = 'smartapp_prefs_v1';

export type JsonValidationResult<T> =
  | { ok: true; data: T; warnings: string[] }
  | { ok: false; error: string; details: string[] };

const VALID_PRIORITIES: ReadonlySet<string> = new Set<Priority>(['niski', 'sredni', 'wysoki']);

const ISO_TIMESTAMP_RE =
  /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/;

/**
 * Strictly validates an ISO-8601 timestamp with timezone designator (Z or ±HH:MM)
 * and a valid Gregorian calendar date.
 */
export function isValidIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const match = ISO_TIMESTAMP_RE.exec(value);
  if (!match) {
    return false;
  }

  const datePart = match[1];
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  const second = Number(match[4]);

  if (!isValidDateString(datePart) || hour > 23 || minute > 59 || second > 59) {
    return false;
  }

  if (match[5] !== undefined && match[6] !== undefined) {
    const offsetHour = Number(match[5]);
    const offsetMinute = Number(match[6]);
    if (offsetHour > 23 || offsetMinute > 59) {
      return false;
    }
  }

  return !Number.isNaN(Date.parse(value));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stripTaskToStrictFields(task: Task): Task {
  return {
    id: task.id === 0 ? 0 : task.id,
    tytul: task.tytul,
    opis: task.opis,
    termin: task.termin,
    priorytet: task.priorytet,
    wykonane: Boolean(task.wykonane),
    tagi: Array.isArray(task.tagi)
      ? task.tagi.filter((t): t is string => typeof t === 'string')
      : [],
  };
}

function validateSingleTask(
  item: unknown,
  label: string,
  errors: string[],
  warnings: string[],
  seenIds: Set<number> | null,
): Task | null {
  if (!isPlainObject(item)) {
    errors.push(`${label}: element musi być obiektem JSON.`);
    return null;
  }

  let itemValid = true;

  const rawId = item.id;
  let cleanId = 0;
  if (typeof rawId !== 'number' || !Number.isSafeInteger(rawId) || rawId < 0) {
    errors.push(`${label}: pole "id" musi być bezpieczną liczbą całkowitą większą lub równą 0.`);
    itemValid = false;
  } else {
    cleanId = rawId === 0 ? 0 : rawId;
    if (seenIds !== null) {
      if (seenIds.has(cleanId)) {
        errors.push(`${label}: zduplikowane pole "id" (${cleanId}). Każde zadanie musi mieć unikalny numer.`);
        itemValid = false;
      } else {
        seenIds.add(cleanId);
      }
    }
  }

  const rawTytul = item.tytul;
  if (typeof rawTytul !== 'string' || rawTytul.trim().length === 0) {
    errors.push(`${label}: pole "tytul" musi być niepustym tekstem.`);
    itemValid = false;
  }

  const rawOpis = item.opis;
  if (typeof rawOpis !== 'string') {
    errors.push(`${label}: pole "opis" musi być tekstem (może być puste).`);
    itemValid = false;
  }

  const rawTermin = item.termin;
  const terminValid =
    rawTermin === null || (typeof rawTermin === 'string' && isValidDateString(rawTermin));
  if (!terminValid) {
    errors.push(`${label}: pole "termin" musi mieć format "RRRR-MM-DD" lub wartość null.`);
    itemValid = false;
  }

  const rawPriorytet = item.priorytet;
  if (typeof rawPriorytet !== 'string' || !VALID_PRIORITIES.has(rawPriorytet)) {
    errors.push(
      `${label}: nieprawidłowy priorytet "${String(rawPriorytet)}" (dozwolone: "niski", "sredni", "wysoki").`,
    );
    itemValid = false;
  }

  const rawWykonane = item.wykonane;
  if (typeof rawWykonane !== 'boolean') {
    errors.push(`${label}: pole "wykonane" musi być wartością true lub false.`);
    itemValid = false;
  }

  const rawTagi = item.tagi;
  const cleanTagi: string[] = [];
  if (!Array.isArray(rawTagi) || !rawTagi.every((t) => typeof t === 'string')) {
    errors.push(`${label}: pole "tagi" musi być tablicą tekstów.`);
    itemValid = false;
  } else {
    const seenTags = new Set<string>();
    let droppedEmpty = false;
    let droppedDuplicate = false;

    for (let i = 0; i < rawTagi.length; i++) {
      const trimmed = rawTagi[i].trim();
      if (trimmed.length === 0) {
        droppedEmpty = true;
        continue;
      }
      const norm = normalizeTag(trimmed);
      if (seenTags.has(norm)) {
        droppedDuplicate = true;
        continue;
      }
      seenTags.add(norm);
      cleanTagi.push(trimmed);
    }

    if (droppedEmpty) {
      warnings.push(`${label}: pominięto puste tagi w polu "tagi".`);
    }
    if (droppedDuplicate) {
      warnings.push(`${label}: pominięto zduplikowane tagi w polu "tagi".`);
    }
  }

  if (!itemValid) {
    return null;
  }

  return {
    id: cleanId,
    tytul: rawTytul as string,
    opis: rawOpis as string,
    termin: rawTermin as string | null,
    priorytet: rawPriorytet as Priority,
    wykonane: rawWykonane as boolean,
    tagi: cleanTagi,
  };
}

/**
 * Strictly validates and parses a zadania.json payload, stripping any unknown keys.
 */
export function validateAndParseTasksJson(rawText: string): JsonValidationResult<TasksFile> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    return {
      ok: false,
      error: 'Nieprawidłowa składnia pliku JSON.',
      details: [err instanceof Error ? err.message : String(err)],
    };
  }

  if (!isPlainObject(parsed)) {
    return {
      ok: false,
      error: 'Plik JSON musi zawierać obiekt główny { "wersja": ..., "zadania": [...] }.',
      details: [],
    };
  }

  if (
    typeof parsed.wersja !== 'number' ||
    !Number.isSafeInteger(parsed.wersja) ||
    parsed.wersja < 1
  ) {
    return {
      ok: false,
      error: 'Pole "wersja" musi być bezpieczną liczbą całkowitą większą lub równą 1.',
      details: [],
    };
  }
  const cleanWersja = parsed.wersja === 0 ? 0 : parsed.wersja;

  if (!Array.isArray(parsed.zadania)) {
    return {
      ok: false,
      error: 'Pole "zadania" musi być tablicą.',
      details: [],
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const cleanTasks: Task[] = [];
  const seenIds = new Set<number>();

  for (let i = 0; i < parsed.zadania.length; i++) {
    const label = `Zadanie #${i + 1}`;
    const validTask = validateSingleTask(parsed.zadania[i], label, errors, warnings, seenIds);
    if (validTask !== null) {
      cleanTasks.push(validTask);
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: 'Plik JSON zawiera błędy struktury zadań.',
      details: errors.slice(0, 10),
    };
  }

  return {
    ok: true,
    data: {
      wersja: cleanWersja,
      zadania: cleanTasks,
    },
    warnings,
  };
}

/**
 * Serializes tasks strictly to { wersja, zadania } with ONLY the 7 competition fields per task.
 */
export function serializeTasksFile(wersja: number, tasks: Task[]): string {
  const safeWersja = Number.isSafeInteger(wersja) && wersja >= 1 ? wersja : 1;
  const zadania = tasks.map(stripTaskToStrictFields);
  return `${JSON.stringify({ wersja: safeWersja, zadania }, null, 2)}\n`;
}

/**
 * Returns max(0, ...taskIds, ...archiveIds) + 1 safely without spread stack overflow.
 * Falls back to the smallest unused positive safe integer when MAX_SAFE_INTEGER is occupied.
 */
export function getNextTaskId(tasks: Task[], archive?: ArchiveEntry[]): number {
  let maxId = 0;
  for (let i = 0; i < tasks.length; i++) {
    const id = tasks[i].id;
    if (Number.isSafeInteger(id) && id > maxId) {
      maxId = id;
    }
  }
  if (archive) {
    for (let i = 0; i < archive.length; i++) {
      const id = archive[i].task.id;
      if (Number.isSafeInteger(id) && id > maxId) {
        maxId = id;
      }
    }
  }
  if (maxId < Number.MAX_SAFE_INTEGER) {
    return maxId + 1;
  }

  const usedIds = new Set<number>();
  for (let i = 0; i < tasks.length; i++) {
    const id = tasks[i].id;
    if (Number.isSafeInteger(id) && id >= 1) {
      usedIds.add(id);
    }
  }
  if (archive) {
    for (let i = 0; i < archive.length; i++) {
      const id = archive[i].task.id;
      if (Number.isSafeInteger(id) && id >= 1) {
        usedIds.add(id);
      }
    }
  }

  let candidate = 1;
  while (usedIds.has(candidate) && candidate < Number.MAX_SAFE_INTEGER) {
    candidate += 1;
  }
  return candidate;
}

/**
 * Strictly validates and parses an archiwum_usunietych.json payload.
 */
export function validateAndParseArchiveJson(rawText: string): JsonValidationResult<ArchiveFile> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    return {
      ok: false,
      error: 'Nieprawidłowa składnia pliku JSON archiwum.',
      details: [err instanceof Error ? err.message : String(err)],
    };
  }

  if (!isPlainObject(parsed)) {
    return {
      ok: false,
      error: 'Plik archiwum musi zawierać obiekt główny { "wersja": 1, "archiwum": [...] }.',
      details: [],
    };
  }

  if (parsed.wersja !== 1) {
    return {
      ok: false,
      error: 'Pole "wersja" w pliku archiwum musi mieć wartość 1.',
      details: [],
    };
  }

  if (!Array.isArray(parsed.archiwum)) {
    return {
      ok: false,
      error: 'Pole "archiwum" musi być tablicą.',
      details: [],
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const cleanEntries: ArchiveEntry[] = [];

  for (let i = 0; i < parsed.archiwum.length; i++) {
    const label = `Wpis #${i + 1}`;
    const rawEntry = parsed.archiwum[i];

    if (!isPlainObject(rawEntry)) {
      errors.push(`${label}: element archiwum musi być obiektem JSON.`);
      continue;
    }

    const rawDate = rawEntry.oproznionoDnia;
    const dateValid = isValidIsoTimestamp(rawDate);
    if (!dateValid) {
      errors.push(`${label}: pole "oproznionoDnia" musi być poprawną datą ISO-8601.`);
    }

    const validTask = validateSingleTask(rawEntry.task, label, errors, warnings, null);
    if (dateValid && validTask !== null) {
      cleanEntries.push({
        task: validTask,
        oproznionoDnia: rawDate,
      });
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: 'Plik archiwum zawiera błędy struktury.',
      details: errors.slice(0, 10),
    };
  }

  return {
    ok: true,
    data: {
      wersja: 1,
      archiwum: cleanEntries,
    },
    warnings,
  };
}

/**
 * Serializes archive entries strictly to { wersja: 1, archiwum } with 7-field tasks.
 */
export function serializeArchiveFile(entries: ArchiveEntry[]): string {
  const archiwum = entries.map((entry) => ({
    task: stripTaskToStrictFields(entry.task),
    oproznionoDnia: entry.oproznionoDnia,
  }));
  return `${JSON.stringify({ wersja: 1, archiwum }, null, 2)}\n`;
}

/**
 * Triggers a browser file download for a JSON string. No-op in headless/non-DOM environments.
 */
export function downloadJsonFile(filename: string, content: string): void {
  if (
    typeof document === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return;
  }

  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.download = filename;
  anchor.href = url;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

export function loadTasksFromStorage(): TasksFile | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    const raw = window.localStorage.getItem(TASKS_STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    const result = validateAndParseTasksJson(raw);
    return result.ok ? result.data : null;
  } catch {
    return null;
  }
}

export function saveTasksToStorage(wersja: number, tasks: Task[]): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(TASKS_STORAGE_KEY, serializeTasksFile(wersja, tasks));
  } catch {
    // Ignore storage quota or private-browsing security errors
  }
}

export function loadArchiveFromStorage(): ArchiveEntry[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [];
    }
    const raw = window.localStorage.getItem(ARCHIVE_STORAGE_KEY);
    if (raw === null) {
      return [];
    }
    const result = validateAndParseArchiveJson(raw);
    return result.ok ? result.data.archiwum : [];
  } catch {
    return [];
  }
}

export function saveArchiveToStorage(entries: ArchiveEntry[]): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(ARCHIVE_STORAGE_KEY, serializeArchiveFile(entries));
  } catch {
    // Ignore storage quota or private-browsing security errors
  }
}

export function loadMutedFromStorage(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (raw === null) {
      return false;
    }
    const parsed: unknown = JSON.parse(raw);
    if (isPlainObject(parsed) && typeof parsed.muted === 'boolean') {
      return parsed.muted;
    }
    return false;
  } catch {
    return false;
  }
}

export function saveMutedToStorage(muted: boolean): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ muted: Boolean(muted) }));
  } catch {
    // Ignore storage quota or private-browsing security errors
  }
}
