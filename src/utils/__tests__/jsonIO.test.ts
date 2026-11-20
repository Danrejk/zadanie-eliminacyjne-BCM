import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sampleTasks from '../../data/sampleTasks.json';
import type { ArchiveEntry, Priority, Task, TimeZone } from '../../types/task';
import { getTimeZone } from '../dateBuckets';
import {
  ARCHIVE_STORAGE_KEY,
  getNextTaskId,
  loadArchiveFromStorage,
  loadMutedFromStorage,
  loadTasksFromStorage,
  PREFS_STORAGE_KEY,
  saveArchiveToStorage,
  saveMutedToStorage,
  saveTasksToStorage,
  serializeArchiveFile,
  serializeTasksFile,
  TASKS_STORAGE_KEY,
  validateAndParseArchiveJson,
  validateAndParseTasksJson,
} from '../jsonIO';

const EXPECTED_TASK_KEYS = [
  'id',
  'opis',
  'priorytet',
  'tagi',
  'termin',
  'tytul',
  'wykonane',
];

const SAMPLE_TASK: Task = {
  id: 1,
  tytul: 'Kolokwium z sieci komputerowych',
  opis: 'Rozdziały 3–5',
  termin: '2026-11-18',
  priorytet: 'wysoki',
  wykonane: false,
  tagi: ['studia'],
};

describe('jsonIO', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateAndParseTasksJson — valid inputs', () => {
    it('parses the competition specification example accurately', () => {
      const raw = JSON.stringify({
        wersja: 1,
        zadania: [SAMPLE_TASK],
      });
      const result = validateAndParseTasksJson(raw);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.warnings).toEqual([]);
        expect(result.data.wersja).toBe(1);
        expect(result.data.zadania).toEqual([SAMPLE_TASK]);
      }
    });

    it('accepts empty zadania array and preserves custom wersja', () => {
      const result = validateAndParseTasksJson(JSON.stringify({ wersja: 2, zadania: [] }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ wersja: 2, zadania: [] });
        expect(result.warnings).toEqual([]);
      }
    });

    it('accepts empty opis, empty tagi, null termin, id 0, and all priorities', () => {
      const tasks: Task[] = [
        {
          id: 0,
          tytul: 'Zerowe ID',
          opis: '',
          termin: null,
          priorytet: 'niski',
          wykonane: false,
          tagi: [],
        },
        {
          id: 2,
          tytul: 'Średni priorytet',
          opis: 'Opis',
          termin: '2026-11-20',
          priorytet: 'sredni',
          wykonane: true,
          tagi: ['studia'],
        },
        {
          id: 3,
          tytul: 'Wysoki priorytet',
          opis: '',
          termin: '2024-02-29',
          priorytet: 'wysoki',
          wykonane: false,
          tagi: ['egzamin', 'projekt'],
        },
      ];
      const result = validateAndParseTasksJson(JSON.stringify({ wersja: 1, zadania: tasks }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.zadania).toEqual(tasks);
      }
    });

    it('strips unknown extra properties on root and task objects', () => {
      const raw = JSON.stringify({
        wersja: 3,
        extraRoot: 'ignored',
        zadania: [
          {
            ...SAMPLE_TASK,
            onFloor: true,
            x: 120,
            y: 340,
            tilt: -1.5,
          },
        ],
      });
      const result = validateAndParseTasksJson(raw);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(Object.keys(result.data).sort()).toEqual(['wersja', 'zadania']);
        expect(Object.keys(result.data.zadania[0]).sort()).toEqual(EXPECTED_TASK_KEYS);
      }
    });

    it('drops whitespace-only tags and records a non-fatal warning', () => {
      const raw = JSON.stringify({
        wersja: 1,
        zadania: [
          {
            ...SAMPLE_TASK,
            tagi: [' studia ', '', '   ', 'egzamin'],
          },
        ],
      });
      const result = validateAndParseTasksJson(raw);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.zadania[0].tagi).toEqual(['studia', 'egzamin']);
        expect(result.warnings.length).toBe(1);
        expect(result.warnings[0]).toContain('pominięto puste tagi');
      }
    });
  });

  describe('validateAndParseTasksJson — Polish error paths', () => {
    it('rejects malformed JSON syntax', () => {
      const result = validateAndParseTasksJson('{ broken json');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('Nieprawidłowa składnia pliku JSON.');
        expect(result.details.length).toBe(1);
      }
    });

    it('rejects non-object roots', () => {
      for (const raw of ['[]', 'null', '"tekst"', '123']) {
        const result = validateAndParseTasksJson(raw);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toContain('obiekt główny');
        }
      }
    });

    it('rejects invalid wersja values', () => {
      for (const bad of [{ zadania: [] }, { wersja: 0, zadania: [] }, { wersja: -1, zadania: [] }, { wersja: 1.5, zadania: [] }, { wersja: '1', zadania: [] }]) {
        const result = validateAndParseTasksJson(JSON.stringify(bad));
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toContain('"wersja"');
        }
      }
    });

    it('rejects non-array zadania field', () => {
      for (const bad of [{ wersja: 1 }, { wersja: 1, zadania: null }, { wersja: 1, zadania: {} }]) {
        const result = validateAndParseTasksJson(JSON.stringify(bad));
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toContain('"zadania"');
        }
      }
    });

    it('rejects non-object task items', () => {
      const result = validateAndParseTasksJson(JSON.stringify({ wersja: 1, zadania: [null, 42] }));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.details.some((d) => d.includes('obiektem JSON'))).toBe(true);
      }
    });

    it('rejects invalid and duplicate id values', () => {
      const invalidIds = [
        { ...SAMPLE_TASK, id: '1' },
        { ...SAMPLE_TASK, id: 1.5 },
        { ...SAMPLE_TASK, id: -1 },
      ];
      for (const item of invalidIds) {
        const res = validateAndParseTasksJson(JSON.stringify({ wersja: 1, zadania: [item] }));
        expect(res.ok).toBe(false);
        if (!res.ok) {
          expect(res.details[0]).toContain('"id"');
        }
      }

      const dupRes = validateAndParseTasksJson(
        JSON.stringify({
          wersja: 1,
          zadania: [SAMPLE_TASK, { ...SAMPLE_TASK, id: 2 }, { ...SAMPLE_TASK, id: 1 }],
        }),
      );
      expect(dupRes.ok).toBe(false);
      if (!dupRes.ok) {
        expect(dupRes.details[0]).toContain('zduplikowane pole "id" (1)');
      }
    });

    it('rejects unsafe integers (> MAX_SAFE_INTEGER) in id and wersja and normalizes -0 id to +0', () => {
      const unsafeIdRaw =
        '{"wersja":1,"zadania":[{"id":9007199254740992,"tytul":"UnsafeID","opis":"","termin":null,"priorytet":"niski","wykonane":false,"tagi":[]}]}';
      const unsafeIdRes = validateAndParseTasksJson(unsafeIdRaw);
      expect(unsafeIdRes.ok).toBe(false);
      if (!unsafeIdRes.ok) {
        expect(unsafeIdRes.details[0]).toContain('"id"');
      }

      const hugeWersjaRes = validateAndParseTasksJson('{"wersja":1e30,"zadania":[]}');
      expect(hugeWersjaRes.ok).toBe(false);
      if (!hugeWersjaRes.ok) {
        expect(hugeWersjaRes.error).toContain('"wersja"');
      }

      const maxSafeWersjaRes = validateAndParseTasksJson(
        `{"wersja":${Number.MAX_SAFE_INTEGER},"zadania":[]}`,
      );
      expect(maxSafeWersjaRes.ok).toBe(true);

      const negZeroRaw =
        '{"wersja":1,"zadania":[{"id":-0,"tytul":"NegZero","opis":"","termin":null,"priorytet":"niski","wykonane":false,"tagi":[]}]}';
      const negZeroRes = validateAndParseTasksJson(negZeroRaw);
      expect(negZeroRes.ok).toBe(true);
      if (negZeroRes.ok) {
        expect(Object.is(negZeroRes.data.zadania[0].id, 0)).toBe(true);
        expect(Object.is(negZeroRes.data.zadania[0].id, -0)).toBe(false);
      }

      const dupNegZeroRaw =
        '{"wersja":1,"zadania":[{"id":0,"tytul":"Zero","opis":"","termin":null,"priorytet":"niski","wykonane":false,"tagi":[]},{"id":-0,"tytul":"NegZero","opis":"","termin":null,"priorytet":"niski","wykonane":false,"tagi":[]}]}';
      expect(validateAndParseTasksJson(dupNegZeroRaw).ok).toBe(false);
    });

    it('rejects invalid tytul, opis, termin, priorytet, wykonane, and tagi', () => {
      const badCases: Array<{ patch: Record<string, unknown>; expectedFragment: string }> = [
        { patch: { tytul: '' }, expectedFragment: '"tytul"' },
        { patch: { tytul: '   ' }, expectedFragment: '"tytul"' },
        { patch: { tytul: 123 }, expectedFragment: '"tytul"' },
        { patch: { opis: null }, expectedFragment: '"opis"' },
        { patch: { opis: 42 }, expectedFragment: '"opis"' },
        { patch: { termin: '' }, expectedFragment: '"termin"' },
        { patch: { termin: '2026-02-30' }, expectedFragment: '"termin"' },
        { patch: { termin: '18-11-2026' }, expectedFragment: '"termin"' },
        { patch: { termin: '2026/11/18' }, expectedFragment: '"termin"' },
        { patch: { termin: 123 }, expectedFragment: '"termin"' },
        { patch: { priorytet: 'średni' }, expectedFragment: 'nieprawidłowy priorytet' },
        { patch: { priorytet: 'HIGH' }, expectedFragment: 'nieprawidłowy priorytet' },
        { patch: { priorytet: '' }, expectedFragment: 'nieprawidłowy priorytet' },
        { patch: { priorytet: null }, expectedFragment: 'nieprawidłowy priorytet' },
        { patch: { wykonane: 'true' }, expectedFragment: '"wykonane"' },
        { patch: { wykonane: 1 }, expectedFragment: '"wykonane"' },
        { patch: { wykonane: null }, expectedFragment: '"wykonane"' },
        { patch: { tagi: null }, expectedFragment: '"tagi"' },
        { patch: { tagi: 'studia' }, expectedFragment: '"tagi"' },
        { patch: { tagi: [123] }, expectedFragment: '"tagi"' },
      ];

      for (const { patch, expectedFragment } of badCases) {
        const res = validateAndParseTasksJson(
          JSON.stringify({ wersja: 1, zadania: [{ ...SAMPLE_TASK, ...patch }] }),
        );
        expect(res.ok).toBe(false);
        if (!res.ok) {
          expect(res.details.some((d) => d.includes(expectedFragment))).toBe(true);
        }
      }
    });

    it('caps item validation details at 10 entries', () => {
      const badTasks = Array.from({ length: 15 }, (_, i) => ({
        ...SAMPLE_TASK,
        id: i + 1,
        tytul: '',
      }));
      const res = validateAndParseTasksJson(JSON.stringify({ wersja: 1, zadania: badTasks }));
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.details.length).toBe(10);
      }
    });
  });

  describe('serializeTasksFile & round-trip fidelity', () => {
    it('preserves wersja verbatim and strips injected extra properties strictly to 7 fields', () => {
      const polluted = {
        ...SAMPLE_TASK,
        onFloor: true,
        x: 50,
        y: 60,
        tilt: 2.1,
        archivedAt: '2026-11-19T10:00:00Z',
      } as unknown as Task;

      const serialized = serializeTasksFile(2, [polluted]);
      const parsed = JSON.parse(serialized) as { wersja: number; zadania: Record<string, unknown>[] };

      expect(Object.keys(parsed).sort()).toEqual(['wersja', 'zadania']);
      expect(parsed.wersja).toBe(2);
      expect(Object.keys(parsed.zadania[0]).sort()).toEqual(EXPECTED_TASK_KEYS);

      const roundTrip = validateAndParseTasksJson(serialized);
      expect(roundTrip.ok).toBe(true);
      if (roundTrip.ok) {
        expect(roundTrip.data).toEqual({ wersja: 2, zadania: [SAMPLE_TASK] });
      }
    });

    it('serializes empty zadania cleanly', () => {
      const serialized = serializeTasksFile(1, []);
      expect(JSON.parse(serialized)).toEqual({ wersja: 1, zadania: [] });
    });

    it('sanitizes sparse tagi arrays and unsafe wersja on serialize so output always re-imports cleanly', () => {
      const sparseTags = new Array<string>(3);
      sparseTags[1] = 'studia';
      const taskWithSparse: Task = {
        ...SAMPLE_TASK,
        id: -0,
        tagi: sparseTags,
      };

      const serialized = serializeTasksFile(Number.MAX_SAFE_INTEGER + 1, [taskWithSparse]);
      const parsed = JSON.parse(serialized) as { wersja: number; zadania: Task[] };
      expect(parsed.wersja).toBe(1);
      expect(parsed.zadania[0].tagi).toEqual(['studia']);
      expect(Object.is(parsed.zadania[0].id, 0)).toBe(true);

      const reimported = validateAndParseTasksJson(serialized);
      expect(reimported.ok).toBe(true);
    });
  });

  describe('getNextTaskId', () => {
    it('returns 1 for empty tasks and handles gaps and archive IDs', () => {
      expect(getNextTaskId([])).toBe(1);
      expect(
        getNextTaskId([
          { ...SAMPLE_TASK, id: 1 },
          { ...SAMPLE_TASK, id: 5 },
          { ...SAMPLE_TASK, id: 12 },
        ]),
      ).toBe(13);

      const archive: ArchiveEntry[] = [
        { task: { ...SAMPLE_TASK, id: 9, wykonane: true }, oproznionoDnia: '2026-11-19T12:00:00.000Z' },
      ];
      expect(
        getNextTaskId(
          [
            { ...SAMPLE_TASK, id: 1 },
            { ...SAMPLE_TASK, id: 2 },
          ],
          archive,
        ),
      ).toBe(10);
    });

    it('never returns a colliding ID when MAX_SAFE_INTEGER is present and ignores unsafe integer IDs', () => {
      const tasksAtMax: Task[] = [
        { ...SAMPLE_TASK, id: 1 },
        { ...SAMPLE_TASK, id: Number.MAX_SAFE_INTEGER },
      ];
      const archiveWithTwo: ArchiveEntry[] = [
        {
          task: { ...SAMPLE_TASK, id: 2, wykonane: true },
          oproznionoDnia: '2026-11-19T12:00:00.000Z',
        },
      ];
      const nextId = getNextTaskId(tasksAtMax, archiveWithTwo);
      expect(nextId).toBe(3);
      expect(Number.isSafeInteger(nextId)).toBe(true);
      expect(tasksAtMax.some((t) => t.id === nextId)).toBe(false);

      // Unsafe integer (> MAX_SAFE_INTEGER) is ignored rather than causing collision
      const unsafeTasks: Task[] = [
        { ...SAMPLE_TASK, id: 5 },
        { ...SAMPLE_TASK, id: 9007199254740992 },
      ];
      expect(getNextTaskId(unsafeTasks)).toBe(6);
    });
  });

  describe('Archive JSON validation & serialization', () => {
    it('round-trips archive entries cleanly and strips extra task fields', () => {
      const entries: ArchiveEntry[] = [
        {
          task: {
            ...SAMPLE_TASK,
            wykonane: true,
            extra: 'drop-me',
          } as unknown as Task,
          oproznionoDnia: '2026-11-19T15:30:00.000Z',
        },
      ];

      const serialized = serializeArchiveFile(entries);
      const parsed = validateAndParseArchiveJson(serialized);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.data.wersja).toBe(1);
        expect(parsed.data.archiwum).toHaveLength(1);
        expect(Object.keys(parsed.data.archiwum[0].task).sort()).toEqual(EXPECTED_TASK_KEYS);
        expect(parsed.data.archiwum[0].oproznionoDnia).toBe('2026-11-19T15:30:00.000Z');
      }
    });

    it('rejects malformed archive syntax, bad wersja, non-array archiwum, invalid dates, and invalid nested tasks', () => {
      expect(validateAndParseArchiveJson('{ invalid').ok).toBe(false);
      expect(validateAndParseArchiveJson('[]').ok).toBe(false);
      expect(validateAndParseArchiveJson(JSON.stringify({ wersja: 2, archiwum: [] })).ok).toBe(false);
      expect(validateAndParseArchiveJson(JSON.stringify({ wersja: 1, archiwum: {} })).ok).toBe(false);
      expect(
        validateAndParseArchiveJson(
          JSON.stringify({
            wersja: 1,
            archiwum: [{ task: SAMPLE_TASK, oproznionoDnia: 'not-a-date' }],
          }),
        ).ok,
      ).toBe(false);
      expect(
        validateAndParseArchiveJson(
          JSON.stringify({
            wersja: 1,
            archiwum: [{ task: { ...SAMPLE_TASK, tytul: '' }, oproznionoDnia: '2026-11-19T12:00:00.000Z' }],
          }),
        ).ok,
      ).toBe(false);
    });

    it('enforces strict ISO-8601 timestamps on archive oproznionoDnia', () => {
      for (const badDate of [
        '1',
        'foo 2026',
        '2026-11-19',
        '2026-02-30T10:00:00Z',
        '2026-11-19T25:00:00Z',
        '',
        '   ',
      ]) {
        const res = validateAndParseArchiveJson(
          JSON.stringify({
            wersja: 1,
            archiwum: [{ task: SAMPLE_TASK, oproznionoDnia: badDate }],
          }),
        );
        expect(res.ok).toBe(false);
      }

      for (const goodDate of [
        '2026-11-19T12:00:00Z',
        '2026-11-19T12:00:00.000Z',
        '2026-11-19T12:00:00+01:00',
        '2026-11-19T12:00:00.123456-05:30',
      ]) {
        const res = validateAndParseArchiveJson(
          JSON.stringify({
            wersja: 1,
            archiwum: [{ task: SAMPLE_TASK, oproznionoDnia: goodDate }],
          }),
        );
        expect(res.ok).toBe(true);
      }
    });
  });

  describe('localStorage persistence helpers', () => {
    it('round-trips tasks, archive, and muted preference under canonical keys', () => {
      saveTasksToStorage(2, [SAMPLE_TASK]);
      expect(localStorage.getItem(TASKS_STORAGE_KEY)).not.toBeNull();
      expect(loadTasksFromStorage()).toEqual({ wersja: 2, zadania: [SAMPLE_TASK] });

      const archiveEntries: ArchiveEntry[] = [
        { task: { ...SAMPLE_TASK, wykonane: true }, oproznionoDnia: '2026-11-19T18:00:00.000Z' },
      ];
      saveArchiveToStorage(archiveEntries);
      expect(localStorage.getItem(ARCHIVE_STORAGE_KEY)).not.toBeNull();
      expect(loadArchiveFromStorage()).toEqual(archiveEntries);

      saveMutedToStorage(true);
      expect(localStorage.getItem(PREFS_STORAGE_KEY)).toBe('{"muted":true}');
      expect(loadMutedFromStorage()).toBe(true);
    });

    it('falls back safely when localStorage contains corrupted JSON', () => {
      localStorage.setItem(TASKS_STORAGE_KEY, '{corrupt');
      localStorage.setItem(ARCHIVE_STORAGE_KEY, '{corrupt');
      localStorage.setItem(PREFS_STORAGE_KEY, '{corrupt');

      expect(loadTasksFromStorage()).toBeNull();
      expect(loadArchiveFromStorage()).toEqual([]);
      expect(loadMutedFromStorage()).toBe(false);
    });

    it('catches QuotaExceededError without throwing', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      });

      expect(() => saveTasksToStorage(1, [SAMPLE_TASK])).not.toThrow();
      expect(() => saveArchiveToStorage([])).not.toThrow();
      expect(() => saveMutedToStorage(true)).not.toThrow();
    });
  });

  describe('src/data/sampleTasks.json dataset audit', () => {
    const TODAY = '2026-11-19';

    it('satisfies every schema and coverage requirement', () => {
      const validated = validateAndParseTasksJson(JSON.stringify(sampleTasks));
      expect(validated.ok).toBe(true);
      if (!validated.ok) {
        return;
      }

      expect(validated.warnings).toEqual([]);
      expect(validated.data.wersja).toBe(1);
      expect(validated.data.zadania).toHaveLength(20);

      for (const rawTask of sampleTasks.zadania) {
        expect(Object.keys(rawTask).sort()).toEqual(EXPECTED_TASK_KEYS);
      }

      const active = validated.data.zadania.filter((t) => !t.wykonane);
      const completed = validated.data.zadania.filter((t) => t.wykonane);
      expect(completed.length).toBe(4);
      expect(active.length).toBe(16);

      const activePriorities = new Set<Priority>(active.map((t) => t.priorytet));
      expect(activePriorities).toEqual(new Set<Priority>(['wysoki', 'sredni', 'niski']));

      const activeZones = new Set<TimeZone>(active.map((t) => getTimeZone(t.termin, TODAY)));
      expect(activeZones).toEqual(
        new Set<TimeZone>(['overdue', 'todayTomorrow', 'thisWeek', 'later', 'noDeadline']),
      );

      // All 15 cells of the 3x5 corkboard have at least 1 active task
      const coveredCells = new Set(
        active.map((t) => `${t.priorytet}:${getTimeZone(t.termin, TODAY)}`),
      );
      expect(coveredCells.size).toBe(15);

      // Tag lengths: 0, 1, 2, 3 all present
      const tagLengths = new Set(validated.data.zadania.map((t) => t.tagi.length));
      expect(tagLengths.has(0)).toBe(true);
      expect(tagLengths.has(1)).toBe(true);
      expect(tagLengths.has(2)).toBe(true);
      expect(tagLengths.has(3)).toBe(true);

      // At least one task with empty opis
      expect(validated.data.zadania.some((t) => t.opis === '')).toBe(true);
    });

    it('deduplicates case-insensitive duplicate tags on import while preserving first casing', () => {
      const payload = JSON.stringify({
        wersja: 1,
        zadania: [
          {
            ...SAMPLE_TASK,
            tagi: ['  Studia ', 'studia', 'STUDIA', '', 'Egzamin', 'egzamin'],
          },
        ],
      });

      const result = validateAndParseTasksJson(payload);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.zadania[0].tagi).toEqual(['Studia', 'Egzamin']);
        expect(result.warnings.length).toBeGreaterThanOrEqual(2);
      }
    });
  });
});
