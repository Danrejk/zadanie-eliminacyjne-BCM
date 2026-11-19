import type { Priority, Task, TimeZone } from '../types/task';

export const MS_PER_DAY = 86_400_000;

export const TIME_ZONE_LABELS: Record<TimeZone, string> = {
  overdue: 'Po terminie',
  todayTomorrow: 'Dziś i jutro',
  thisWeek: 'Ten tydzień',
  later: 'Później',
  noDeadline: 'Bez terminu',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  wysoki: 'Wysoki',
  sredni: 'Średni',
  niski: 'Niski',
};

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Formats the local calendar date as "YYYY-MM-DD" without UTC drift.
 */
export function getTodayDateString(now: Date = new Date()): string {
  const year = String(now.getFullYear()).padStart(4, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a strict "YYYY-MM-DD" calendar date into an integer UTC day number.
 * Returns null for malformed strings or non-existent calendar dates (e.g. 2026-02-29).
 */
export function parseDateStringToDayNumber(dateStr: string): number | null {
  if (typeof dateStr !== 'string') {
    return null;
  }

  const match = ISO_DATE_RE.exec(dateStr);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const check = new Date(0);
  check.setUTCFullYear(year, month - 1, day);
  const utcMs = check.getTime();

  if (
    Number.isNaN(utcMs) ||
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }

  return Math.floor(utcMs / MS_PER_DAY);
}

/**
 * Validates that a string is an exact, real calendar date in "YYYY-MM-DD" format.
 */
export function isValidDateString(dateStr: string): boolean {
  return typeof dateStr === 'string' && parseDateStringToDayNumber(dateStr) !== null;
}

/**
 * Computes exact signed integer calendar day difference (target - today).
 * Returns NaN if either date string is invalid.
 */
export function diffCalendarDays(
  targetDateStr: string,
  todayStr: string = getTodayDateString(),
): number {
  const targetDay = parseDateStringToDayNumber(targetDateStr);
  const todayDay = parseDateStringToDayNumber(todayStr);

  if (targetDay === null || todayDay === null) {
    return Number.NaN;
  }

  return targetDay - todayDay;
}

/**
 * Adds a signed integer number of calendar days to a valid "YYYY-MM-DD" string.
 */
export function addDaysToDateString(baseDateStr: string, days: number): string {
  const baseDay = parseDateStringToDayNumber(baseDateStr);
  if (baseDay === null) {
    throw new Error(`Invalid base date string: "${baseDateStr}"`);
  }
  if (!Number.isFinite(days)) {
    throw new RangeError(`Invalid day offset: ${days}`);
  }

  const targetDate = new Date((baseDay + Math.trunc(days)) * MS_PER_DAY);
  if (Number.isNaN(targetDate.getTime())) {
    throw new RangeError(`Date offset out of range: "${baseDateStr}" + ${days}d`);
  }

  const targetYear = targetDate.getUTCFullYear();
  if (targetYear < 0 || targetYear > 9999) {
    throw new RangeError(`Resulting year out of 4-digit ISO range: ${targetYear}`);
  }

  const year = String(targetYear).padStart(4, '0');
  const month = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Classifies a task deadline into one of the 5 corkboard X-axis time buckets.
 */
export function getTimeZone(
  termin: string | null,
  todayStr: string = getTodayDateString(),
): TimeZone {
  if (termin === null) {
    return 'noDeadline';
  }

  const diff = diffCalendarDays(termin, todayStr);
  if (Number.isNaN(diff)) {
    return 'noDeadline';
  }
  if (diff < 0) {
    return 'overdue';
  }
  if (diff === 0 || diff === 1) {
    return 'todayTomorrow';
  }
  if (diff >= 2 && diff <= 7) {
    return 'thisWeek';
  }
  return 'later';
}

/**
 * Returns true strictly when termin is a valid date earlier than todayStr.
 */
export function isOverdue(
  termin: string | null,
  todayStr: string = getTodayDateString(),
): boolean {
  return termin !== null && getTimeZone(termin, todayStr) === 'overdue';
}

/**
 * Enforces the read-only "Po terminie" rule:
 * non-overdue tasks cannot be dragged into the overdue column, while already-overdue
 * tasks may move vertically across priority rows inside the overdue column.
 */
export function canDropIntoZone(
  currentTermin: string | null,
  targetZone: TimeZone,
  todayStr: string = getTodayDateString(),
): boolean {
  if (targetZone === 'overdue') {
    return isOverdue(currentTermin, todayStr);
  }
  return true;
}

/**
 * Resolves the new deadline when dropping a note into a target time zone:
 * - Same zone: preserves exact existing date
 * - Target 'overdue': preserves existing date (read-only protection)
 * - Cross-column: today (+0d), thisWeek (+3d), later (+14d), noDeadline (null)
 */
export function resolveDateForZoneDrop(
  currentTermin: string | null,
  targetZone: TimeZone,
  todayStr: string = getTodayDateString(),
): string | null {
  if (targetZone === 'noDeadline') {
    return null;
  }

  const currentZone = getTimeZone(currentTermin, todayStr);

  if (currentZone === targetZone) {
    return currentTermin;
  }

  if (targetZone === 'overdue') {
    return currentTermin;
  }

  switch (targetZone) {
    case 'todayTomorrow':
      return todayStr;
    case 'thisWeek':
      return addDaysToDateString(todayStr, 3);
    case 'later':
      return addDaysToDateString(todayStr, 14);
  }
}

/**
 * Deterministic cell comparator: earliest termin first, null dates last, tie-break by ascending id.
 */
export function compareTasksInCell(a: Task, b: Task): number {
  if (a.termin === null && b.termin === null) {
    return a.id - b.id;
  }
  if (a.termin === null) {
    return 1;
  }
  if (b.termin === null) {
    return -1;
  }
  if (a.termin !== b.termin) {
    return a.termin < b.termin ? -1 : 1;
  }
  return a.id - b.id;
}

/**
 * Formats a task deadline for Polish UI display without timezone shift.
 */
export function formatDisplayDate(
  termin: string | null,
  todayStr: string = getTodayDateString(),
): string {
  if (termin === null) {
    return 'Bez terminu';
  }

  const diff = diffCalendarDays(termin, todayStr);
  if (Number.isNaN(diff)) {
    return termin;
  }
  if (diff === 0) {
    return 'Dziś';
  }
  if (diff === 1) {
    return 'Jutro';
  }
  if (diff === -1) {
    return 'Wczoraj';
  }

  const [year, month, day] = termin.split('-');
  return `${day}.${month}.${year}`;
}
