import { describe, expect, it } from 'vitest';
import type { Task } from '../../types/task';
import {
  addDaysToDateString,
  canDropIntoZone,
  compareTasksInCell,
  diffCalendarDays,
  formatDisplayDate,
  getTimeZone,
  getTodayDateString,
  isOverdue,
  isValidDateString,
  parseDateStringToDayNumber,
  PRIORITY_LABELS,
  resolveDateForZoneDrop,
  TIME_ZONE_LABELS,
} from '../dateBuckets';

const TODAY = '2026-11-19';

function makeTask(id: number, termin: string | null): Task {
  return {
    id,
    tytul: `Zadanie ${id}`,
    opis: '',
    termin,
    priorytet: 'sredni',
    wykonane: false,
    tagi: [],
  };
}

describe('dateBuckets', () => {
  describe('labels', () => {
    it('exports Polish labels for all time zones and priorities', () => {
      expect(TIME_ZONE_LABELS.overdue).toBe('Po terminie');
      expect(TIME_ZONE_LABELS.todayTomorrow).toBe('Dziś i jutro');
      expect(TIME_ZONE_LABELS.thisWeek).toBe('Ten tydzień');
      expect(TIME_ZONE_LABELS.later).toBe('Później');
      expect(TIME_ZONE_LABELS.noDeadline).toBe('Bez terminu');

      expect(PRIORITY_LABELS.wysoki).toBe('Wysoki');
      expect(PRIORITY_LABELS.sredni).toBe('Średni');
      expect(PRIORITY_LABELS.niski).toBe('Niski');
    });
  });

  describe('getTodayDateString', () => {
    it('formats single-digit month and day with leading zeros', () => {
      expect(getTodayDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
      expect(getTodayDateString(new Date(2026, 8, 9))).toBe('2026-09-09');
    });

    it('uses local calendar date even at 23:59:59 local time', () => {
      const lateLocal = new Date(2026, 10, 19, 23, 59, 59);
      expect(getTodayDateString(lateLocal)).toBe('2026-11-19');
    });
  });

  describe('parseDateStringToDayNumber & isValidDateString', () => {
    it('accepts valid ISO calendar dates including leap years', () => {
      for (const valid of [
        '2026-11-19',
        '2024-02-29',
        '2000-02-29',
        '2028-02-29',
        '2026-01-01',
        '2026-12-31',
        '0000-01-01',
        '0000-02-29',
        '0001-01-01',
        '0050-06-15',
        '0099-12-31',
        '0100-01-01',
        '9999-12-31',
      ]) {
        expect(isValidDateString(valid)).toBe(true);
        expect(parseDateStringToDayNumber(valid)).toBeTypeOf('number');
      }
      expect(isValidDateString('0001-02-29')).toBe(false);
      expect(
        (parseDateStringToDayNumber('0100-01-01') as number) -
          (parseDateStringToDayNumber('0099-12-31') as number),
      ).toBe(1);
    });

    it('advances by exactly 1 across month end, year end, and DST transitions', () => {
      const pairs: [string, string][] = [
        ['2026-11-30', '2026-12-01'],
        ['2026-12-31', '2027-01-01'],
        ['2026-03-28', '2026-03-29'],
        ['2026-03-29', '2026-03-30'],
        ['2026-10-24', '2026-10-25'],
        ['2026-10-25', '2026-10-26'],
      ];

      for (const [a, b] of pairs) {
        const dayA = parseDateStringToDayNumber(a);
        const dayB = parseDateStringToDayNumber(b);
        expect(dayA).not.toBeNull();
        expect(dayB).not.toBeNull();
        expect((dayB as number) - (dayA as number)).toBe(1);
      }
    });

    it('rejects non-existent calendar dates', () => {
      for (const invalid of [
        '2026-02-29',
        '2026-02-30',
        '2100-02-29',
        '2026-04-31',
        '2026-13-01',
        '2026-00-10',
        '2026-11-00',
      ]) {
        expect(isValidDateString(invalid)).toBe(false);
        expect(parseDateStringToDayNumber(invalid)).toBeNull();
      }
    });

    it('rejects malformed date strings and runtime non-strings', () => {
      for (const malformed of [
        '',
        '19-11-2026',
        '2026/11/19',
        '2026-1-9',
        '2026-11-19T00:00:00Z',
        'abc',
      ]) {
        expect(isValidDateString(malformed)).toBe(false);
        expect(parseDateStringToDayNumber(malformed)).toBeNull();
      }
      expect(isValidDateString(null as unknown as string)).toBe(false);
      expect(parseDateStringToDayNumber(undefined as unknown as string)).toBeNull();
    });
  });

  describe('diffCalendarDays & addDaysToDateString', () => {
    it('computes exact signed integer calendar day differences', () => {
      expect(diffCalendarDays('2026-11-19', TODAY)).toBe(0);
      expect(diffCalendarDays('2026-11-20', TODAY)).toBe(1);
      expect(diffCalendarDays('2026-11-18', TODAY)).toBe(-1);
      expect(diffCalendarDays('2026-11-26', TODAY)).toBe(7);
      expect(diffCalendarDays('2026-12-03', TODAY)).toBe(14);
      expect(diffCalendarDays('2026-10-20', TODAY)).toBe(-30);
      expect(Number.isNaN(diffCalendarDays('2026-02-30', TODAY))).toBe(true);
    });

    it('adds positive and negative days across month, year, and leap-year boundaries', () => {
      expect(addDaysToDateString(TODAY, 3)).toBe('2026-11-22');
      expect(addDaysToDateString(TODAY, 14)).toBe('2026-12-03');
      expect(addDaysToDateString(TODAY, -1)).toBe('2026-11-18');
      expect(addDaysToDateString('2026-12-30', 5)).toBe('2027-01-04');
      expect(addDaysToDateString('2024-02-28', 1)).toBe('2024-02-29');
      expect(addDaysToDateString('2026-02-28', 1)).toBe('2026-03-01');
      expect(addDaysToDateString('0100-01-01', -1)).toBe('0099-12-31');
      expect(isValidDateString(addDaysToDateString('0100-01-01', -1))).toBe(true);
      expect(() => addDaysToDateString('2026-02-30', 1)).toThrow();
    });

    it('throws RangeError for non-finite offsets and out-of-range ISO years', () => {
      expect(() => addDaysToDateString(TODAY, Number.NaN)).toThrow(RangeError);
      expect(() => addDaysToDateString(TODAY, Number.POSITIVE_INFINITY)).toThrow(RangeError);
      expect(() => addDaysToDateString(TODAY, Number.NEGATIVE_INFINITY)).toThrow(RangeError);
      expect(() => addDaysToDateString(TODAY, 1e9)).toThrow(RangeError);
      expect(() => addDaysToDateString(TODAY, -1e9)).toThrow(RangeError);
      expect(() => addDaysToDateString(TODAY, Number.MAX_SAFE_INTEGER)).toThrow(RangeError);
      expect(() => addDaysToDateString('9999-12-31', 1)).toThrow(RangeError);
      expect(() => addDaysToDateString('0000-01-01', -1)).toThrow(RangeError);
    });
  });

  describe('getTimeZone & isOverdue', () => {
    it('partitions all deadlines into exact time zones without gaps or overlaps', () => {
      expect(getTimeZone(null, TODAY)).toBe('noDeadline');
      expect(getTimeZone('2026-11-01', TODAY)).toBe('overdue');
      expect(getTimeZone('2026-11-18', TODAY)).toBe('overdue');
      expect(getTimeZone('2026-11-19', TODAY)).toBe('todayTomorrow');
      expect(getTimeZone('2026-11-20', TODAY)).toBe('todayTomorrow');
      expect(getTimeZone('2026-11-21', TODAY)).toBe('thisWeek');
      expect(getTimeZone('2026-11-26', TODAY)).toBe('thisWeek');
      expect(getTimeZone('2026-11-27', TODAY)).toBe('later');
      expect(getTimeZone('2027-01-15', TODAY)).toBe('later');
      expect(getTimeZone('invalid-date', TODAY)).toBe('noDeadline');
    });

    it('marks isOverdue true strictly for dates earlier than today', () => {
      expect(isOverdue('2026-11-18', TODAY)).toBe(true);
      expect(isOverdue('2026-11-01', TODAY)).toBe(true);
      expect(isOverdue('2026-11-19', TODAY)).toBe(false);
      expect(isOverdue('2026-11-20', TODAY)).toBe(false);
      expect(isOverdue('2026-12-01', TODAY)).toBe(false);
      expect(isOverdue(null, TODAY)).toBe(false);
    });
  });

  describe('canDropIntoZone', () => {
    it('allows overdue tasks to drop into any zone including overdue (vertical row moves)', () => {
      expect(canDropIntoZone('2026-11-18', 'overdue', TODAY)).toBe(true);
      expect(canDropIntoZone('2026-11-18', 'todayTomorrow', TODAY)).toBe(true);
      expect(canDropIntoZone('2026-11-18', 'thisWeek', TODAY)).toBe(true);
      expect(canDropIntoZone('2026-11-18', 'later', TODAY)).toBe(true);
      expect(canDropIntoZone('2026-11-18', 'noDeadline', TODAY)).toBe(true);
    });

    it('blocks non-overdue tasks from dropping into overdue while allowing other zones', () => {
      for (const date of ['2026-11-19', '2026-11-22', '2026-12-10', null] as const) {
        expect(canDropIntoZone(date, 'overdue', TODAY)).toBe(false);
        expect(canDropIntoZone(date, 'todayTomorrow', TODAY)).toBe(true);
        expect(canDropIntoZone(date, 'thisWeek', TODAY)).toBe(true);
        expect(canDropIntoZone(date, 'later', TODAY)).toBe(true);
        expect(canDropIntoZone(date, 'noDeadline', TODAY)).toBe(true);
      }
    });
  });

  describe('resolveDateForZoneDrop', () => {
    it('preserves exact date when moving vertically within the same time zone', () => {
      expect(resolveDateForZoneDrop('2026-11-20', 'todayTomorrow', TODAY)).toBe('2026-11-20');
      expect(resolveDateForZoneDrop('2026-11-25', 'thisWeek', TODAY)).toBe('2026-11-25');
      expect(resolveDateForZoneDrop('2026-12-20', 'later', TODAY)).toBe('2026-12-20');
      expect(resolveDateForZoneDrop('2026-11-15', 'overdue', TODAY)).toBe('2026-11-15');
      expect(resolveDateForZoneDrop(null, 'noDeadline', TODAY)).toBeNull();
    });

    it('protects read-only overdue column from backdating non-overdue tasks', () => {
      expect(resolveDateForZoneDrop('2026-11-19', 'overdue', TODAY)).toBe('2026-11-19');
      expect(resolveDateForZoneDrop('2026-11-25', 'overdue', TODAY)).toBe('2026-11-25');
      expect(resolveDateForZoneDrop(null, 'overdue', TODAY)).toBeNull();
    });

    it('assigns canonical default dates on cross-column drops', () => {
      expect(resolveDateForZoneDrop('2026-11-25', 'todayTomorrow', TODAY)).toBe('2026-11-19');
      expect(resolveDateForZoneDrop('2026-11-19', 'thisWeek', TODAY)).toBe('2026-11-22');
      expect(resolveDateForZoneDrop('2026-11-19', 'later', TODAY)).toBe('2026-12-03');
      expect(resolveDateForZoneDrop('2026-11-19', 'noDeadline', TODAY)).toBeNull();
      expect(resolveDateForZoneDrop(null, 'thisWeek', TODAY)).toBe('2026-11-22');
    });

    it('heals malformed date strings to null when dropped into noDeadline', () => {
      expect(resolveDateForZoneDrop('2026-02-29', 'noDeadline', TODAY)).toBeNull();
      expect(resolveDateForZoneDrop('not-a-date', 'noDeadline', TODAY)).toBeNull();
    });
  });

  describe('compareTasksInCell', () => {
    it('sorts ascending by termin, puts null last, and breaks ties by ascending id', () => {
      const tasks = [
        makeTask(5, null),
        makeTask(4, '2026-11-20'),
        makeTask(2, '2026-11-19'),
        makeTask(1, '2026-11-20'),
        makeTask(3, null),
      ];

      const sorted = [...tasks].sort(compareTasksInCell);
      expect(sorted.map((t) => t.id)).toEqual([2, 1, 4, 3, 5]);
    });
  });

  describe('formatDisplayDate', () => {
    it('formats null, relative days, and DD.MM.YYYY calendar dates cleanly', () => {
      expect(formatDisplayDate(null, TODAY)).toBe('Bez terminu');
      expect(formatDisplayDate('2026-11-19', TODAY)).toBe('Dziś');
      expect(formatDisplayDate('2026-11-20', TODAY)).toBe('Jutro');
      expect(formatDisplayDate('2026-11-18', TODAY)).toBe('Wczoraj');
      expect(formatDisplayDate('2026-11-25', TODAY)).toBe('25.11.2026');
      expect(formatDisplayDate('2026-11-15', TODAY)).toBe('15.11.2026');
      expect(formatDisplayDate('bad-date', TODAY)).toBe('bad-date');
    });
  });
});
