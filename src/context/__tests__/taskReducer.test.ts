import React from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArchiveEntry, Task, TasksFile } from '../../types/task';
import {
  ARCHIVE_STORAGE_KEY,
  isValidIsoTimestamp,
  loadArchiveFromStorage,
  PREFS_STORAGE_KEY,
  TASKS_STORAGE_KEY,
  validateAndParseTasksJson,
} from '../../utils/jsonIO';
import { TaskProvider, type TaskContextValue, useTasks } from '../TaskContext';
import {
  createInitialState,
  selectActiveTasks,
  selectAllTags,
  selectCompletedTasks,
  selectFloorBallIds,
  selectFloorBallTasks,
  selectInTrashTasks,
  selectMatchingTaskIds,
  taskReducer,
} from '../taskReducer';

const TODAY = '2026-11-19';

const EXPECTED_TASK_KEYS = [
  'id',
  'opis',
  'priorytet',
  'tagi',
  'termin',
  'tytul',
  'wykonane',
];

function makeTask(id: number, overrides: Partial<Task> = {}): Task {
  return {
    id,
    tytul: `Zadanie ${id}`,
    opis: `Opis zadania ${id}`,
    termin: '2026-11-20',
    priorytet: 'sredni',
    wykonane: false,
    tagi: ['studia'],
    ...overrides,
  };
}

describe('taskReducer & selectors', () => {
  describe('createInitialState & CRUD actions', () => {
    it('creates defensive initial state with empty floorBalls and preserved wersja', () => {
      const seedTasks = [makeTask(1, { tagi: ['studia'] })];
      const seedArchive: ArchiveEntry[] = [
        { task: makeTask(9, { wykonane: true }), oproznionoDnia: '2026-11-18T12:00:00.000Z' },
      ];
      const state = createInitialState({
        wersja: 2,
        tasks: seedTasks,
        archive: seedArchive,
        muted: true,
      });

      expect(state.wersja).toBe(2);
      expect(state.floorBalls).toEqual([]);
      expect(state.muted).toBe(true);
      expect(state.archive).toHaveLength(1);

      // Mutating original seed does not mutate state
      seedTasks[0].tagi.push('mutated');
      expect(state.tasks[0].tagi).toEqual(['studia']);
    });

    it('ADD_TASK computes max(tasks, archive) + 1, trims title, sanitizes tags, and ignores blank title', () => {
      const empty = createInitialState({ wersja: 1, tasks: [] });
      const ignored = taskReducer(empty, {
        type: 'ADD_TASK',
        payload: {
          tytul: '   ',
          opis: '',
          termin: null,
          priorytet: 'niski',
          wykonane: false,
          tagi: [],
        },
      });
      expect(ignored).toBe(empty);

      const first = taskReducer(empty, {
        type: 'ADD_TASK',
        payload: {
          tytul: '  Nowe zadanie  ',
          opis: 'Szczegóły',
          termin: '2026-11-22',
          priorytet: 'wysoki',
          wykonane: false,
          tagi: [' Studia ', 'studia', '', '  projekt'],
        },
      });
      expect(first.tasks).toHaveLength(1);
      expect(first.tasks[0]).toEqual({
        id: 1,
        tytul: 'Nowe zadanie',
        opis: 'Szczegóły',
        termin: '2026-11-22',
        priorytet: 'wysoki',
        wykonane: false,
        tagi: ['Studia', 'projekt'],
      });

      const withGapsAndArchive = createInitialState({
        wersja: 1,
        tasks: [makeTask(1), makeTask(5)],
        archive: [{ task: makeTask(12, { wykonane: true }), oproznionoDnia: '2026-11-18T10:00:00Z' }],
      });
      const added = taskReducer(withGapsAndArchive, {
        type: 'ADD_TASK',
        payload: {
          tytul: 'Kolejne',
          opis: '',
          termin: null,
          priorytet: 'niski',
          wykonane: false,
          tagi: [],
        },
      });
      expect(added.tasks[added.tasks.length - 1].id).toBe(13);
    });

    it('UPDATE_TASK merges fields preserving id, rejects blank title, and clears floorBall when wykonane=false', () => {
      let state = createInitialState({ wersja: 1, tasks: [makeTask(1)] });
      state = taskReducer(state, {
        type: 'COMPLETE_TO_FLOOR',
        payload: { id: 1, originX: 200, originY: 200 },
      });
      state = taskReducer(state, { type: 'SET_BALL_IN_FLIGHT', payload: { inFlight: true } });

      state = taskReducer(state, {
        type: 'OPEN_CONTEXT_MENU',
        payload: { kind: 'floorBall', taskId: 1, x: 50, y: 50 },
      });

      // Unknown id or blank title -> unchanged
      expect(
        taskReducer(state, { type: 'UPDATE_TASK', payload: { id: 999, patch: { tytul: 'X' } } }),
      ).toBe(state);
      expect(
        taskReducer(state, { type: 'UPDATE_TASK', payload: { id: 1, patch: { tytul: '   ' } } }),
      ).toBe(state);

      const updated = taskReducer(state, {
        type: 'UPDATE_TASK',
        payload: {
          id: 1,
          patch: { tytul: '  Zmieniony  ', wykonane: false, tagi: ['dom', 'DOM', ' '] },
        },
      });
      expect(updated.tasks[0].id).toBe(1);
      expect(updated.tasks[0].tytul).toBe('Zmieniony');
      expect(updated.tasks[0].wykonane).toBe(false);
      expect(updated.tasks[0].tagi).toEqual(['dom']);
      expect(updated.floorBalls).toEqual([]);
      expect(updated.ballInFlight).toBe(false);
      expect(updated.contextMenu).toBeNull();
    });

    it('normalizes empty-string termin to null and rejects invalid non-empty termin in ADD_TASK and UPDATE_TASK', () => {
      const initial = createInitialState({ wersja: 1, tasks: [makeTask(1, { termin: '2026-11-20' })] });

      // ADD_TASK with "" normalizes to null
      const addedEmptyDate = taskReducer(initial, {
        type: 'ADD_TASK',
        payload: {
          tytul: 'Bez daty z formularza',
          opis: '',
          termin: '',
          priorytet: 'sredni',
          wykonane: false,
          tagi: [],
        },
      });
      expect(addedEmptyDate.tasks).toHaveLength(2);
      expect(addedEmptyDate.tasks[1].termin).toBeNull();

      // ADD_TASK with invalid non-empty date is rejected
      const addedBadDate = taskReducer(initial, {
        type: 'ADD_TASK',
        payload: {
          tytul: 'Zła data',
          opis: '',
          termin: '2026-02-29',
          priorytet: 'sredni',
          wykonane: false,
          tagi: [],
        },
      });
      expect(addedBadDate).toBe(initial);

      // UPDATE_TASK with "" normalizes to null
      const updatedEmptyDate = taskReducer(initial, {
        type: 'UPDATE_TASK',
        payload: { id: 1, patch: { termin: '' } },
      });
      expect(updatedEmptyDate.tasks[0].termin).toBeNull();

      // UPDATE_TASK with invalid non-empty date is rejected
      const updatedBadDate = taskReducer(initial, {
        type: 'UPDATE_TASK',
        payload: { id: 1, patch: { termin: '2026-02-30' } },
      });
      expect(updatedBadDate).toBe(initial);
    });

    it('DELETE_TASK removes task and related ephemeral UI references without touching archive', () => {
      let state = createInitialState({ wersja: 1, tasks: [makeTask(1), makeTask(2)] });
      state = taskReducer(state, {
        type: 'COMPLETE_TO_FLOOR',
        payload: { id: 1, originX: 100, originY: 100 },
      });
      state = taskReducer(state, { type: 'SET_DRAGGING_FLOOR_BALL', payload: { id: 1 } });
      state = taskReducer(state, { type: 'OPEN_MODAL', payload: { type: 'edit', taskId: 1 } });
      state = taskReducer(state, {
        type: 'OPEN_CONTEXT_MENU',
        payload: { kind: 'floorBall', taskId: 1, x: 50, y: 50 },
      });

      const deleted = taskReducer(state, { type: 'DELETE_TASK', payload: { id: 1 } });
      expect(deleted.tasks.map((t) => t.id)).toEqual([2]);
      expect(deleted.floorBalls).toEqual([]);
      expect(deleted.draggingFloorBallId).toBeNull();
      expect(deleted.contextMenu).toBeNull();
      expect(deleted.activeModal).toEqual({ type: 'none' });
      expect(deleted.archive).toEqual([]);
    });

    it('SET_PRIORITY changes priority while preserving termin', () => {
      const state = createInitialState({
        wersja: 1,
        tasks: [makeTask(1, { priorytet: 'niski', termin: '2026-11-25' })],
      });
      const updated = taskReducer(state, {
        type: 'SET_PRIORITY',
        payload: { id: 1, priorytet: 'wysoki' },
      });
      expect(updated.tasks[0].priorytet).toBe('wysoki');
      expect(updated.tasks[0].termin).toBe('2026-11-25');
      expect(
        taskReducer(updated, { type: 'SET_PRIORITY', payload: { id: 1, priorytet: 'wysoki' } }),
      ).toBe(updated);
    });
  });

  describe('MOVE_TASK_TO_ZONE', () => {
    it('updates priority and termin on cross-column moves', () => {
      const state = createInitialState({
        wersja: 1,
        tasks: [makeTask(1, { priorytet: 'niski', termin: '2026-11-19' })],
      });

      const toWeek = taskReducer(state, {
        type: 'MOVE_TASK_TO_ZONE',
        payload: { id: 1, targetPriority: 'wysoki', targetZone: 'thisWeek', todayStr: TODAY },
      });
      expect(toWeek.tasks[0].priorytet).toBe('wysoki');
      expect(toWeek.tasks[0].termin).toBe('2026-11-22');

      const toLater = taskReducer(toWeek, {
        type: 'MOVE_TASK_TO_ZONE',
        payload: { id: 1, targetPriority: 'sredni', targetZone: 'later', todayStr: TODAY },
      });
      expect(toLater.tasks[0].termin).toBe('2026-12-03');

      const toNoDeadline = taskReducer(toLater, {
        type: 'MOVE_TASK_TO_ZONE',
        payload: { id: 1, targetPriority: 'niski', targetZone: 'noDeadline', todayStr: TODAY },
      });
      expect(toNoDeadline.tasks[0].termin).toBeNull();

      const backToday = taskReducer(toNoDeadline, {
        type: 'MOVE_TASK_TO_ZONE',
        payload: { id: 1, targetPriority: 'wysoki', targetZone: 'todayTomorrow', todayStr: TODAY },
      });
      expect(backToday.tasks[0].termin).toBe(TODAY);
    });

    it('preserves exact date on vertical moves and blocks cross-column drop into overdue', () => {
      const state = createInitialState({
        wersja: 1,
        tasks: [
          makeTask(1, { priorytet: 'niski', termin: '2026-11-20' }),
          makeTask(2, { priorytet: 'niski', termin: '2026-11-15' }),
        ],
      });

      // Vertical move in todayTomorrow keeps tomorrow's exact date
      const verticalTomorrow = taskReducer(state, {
        type: 'MOVE_TASK_TO_ZONE',
        payload: { id: 1, targetPriority: 'wysoki', targetZone: 'todayTomorrow', todayStr: TODAY },
      });
      expect(verticalTomorrow.tasks[0].priorytet).toBe('wysoki');
      expect(verticalTomorrow.tasks[0].termin).toBe('2026-11-20');

      // Vertical move in overdue preserves original overdue date
      const verticalOverdue = taskReducer(verticalTomorrow, {
        type: 'MOVE_TASK_TO_ZONE',
        payload: { id: 2, targetPriority: 'wysoki', targetZone: 'overdue', todayStr: TODAY },
      });
      expect(verticalOverdue.tasks[1].priorytet).toBe('wysoki');
      expect(verticalOverdue.tasks[1].termin).toBe('2026-11-15');

      // Non-overdue dropped into overdue is rejected (read-only rule)
      const blocked = taskReducer(verticalOverdue, {
        type: 'MOVE_TASK_TO_ZONE',
        payload: { id: 1, targetPriority: 'sredni', targetZone: 'overdue', todayStr: TODAY },
      });
      expect(blocked).toBe(verticalOverdue);

      // Same-cell drop is a no-op
      const sameCell = taskReducer(verticalOverdue, {
        type: 'MOVE_TASK_TO_ZONE',
        payload: { id: 1, targetPriority: 'wysoki', targetZone: 'todayTomorrow', todayStr: TODAY },
      });
      expect(sameCell).toBe(verticalOverdue);

      // Blocked drop into overdue clears draggingNoteId without modifying task
      const whileDragging = taskReducer(verticalOverdue, {
        type: 'SET_DRAGGING_NOTE',
        payload: { id: 1 },
      });
      const blockedWhileDragging = taskReducer(whileDragging, {
        type: 'MOVE_TASK_TO_ZONE',
        payload: { id: 1, targetPriority: 'niski', targetZone: 'overdue', todayStr: TODAY },
      });
      expect(blockedWhileDragging.draggingNoteId).toBeNull();
      expect(blockedWhileDragging.tasks).toEqual(verticalOverdue.tasks);
    });
  });

  describe('floor-ball & trash lifecycle', () => {
    it('handles COMPLETE_TO_FLOOR idempotently and partitions floor vs trash cleanly', () => {
      const initial = createInitialState({
        wersja: 1,
        tasks: [makeTask(1), makeTask(2), makeTask(3, { wykonane: true })],
      });

      const afterDrop = taskReducer(initial, {
        type: 'COMPLETE_TO_FLOOR',
        payload: { id: 1, originX: 300, originY: 200 },
      });
      expect(afterDrop.tasks[0].wykonane).toBe(true);
      expect(afterDrop.floorBalls).toHaveLength(1);
      expect(selectCompletedTasks(afterDrop.tasks).map((t) => t.id)).toEqual([1, 3]);

      const floorIds = selectFloorBallIds(afterDrop.floorBalls);
      expect(selectFloorBallTasks(afterDrop.tasks, floorIds).map((t) => t.id)).toEqual([1]);
      expect(selectInTrashTasks(afterDrop.tasks, floorIds).map((t) => t.id)).toEqual([3]);

      // Duplicate COMPLETE_TO_FLOOR on already-done task is a no-op
      const duplicate = taskReducer(afterDrop, {
        type: 'COMPLETE_TO_FLOOR',
        payload: { id: 1, originX: 300, originY: 200 },
      });
      expect(duplicate).toBe(afterDrop);
    });

    it('handles COMPLETE_TO_TRASH, DROP_BALL_INTO_TRASH, SWEEP_FLOOR_TO_TRASH, and RESTORE_TASK', () => {
      let state = createInitialState({
        wersja: 1,
        tasks: [makeTask(1), makeTask(2), makeTask(3), makeTask(4)],
      });

      // Direct drag to trash
      state = taskReducer(state, { type: 'COMPLETE_TO_TRASH', payload: { id: 1 } });
      expect(state.trashBounceCount).toBe(1);
      expect(selectInTrashTasks(state.tasks, selectFloorBallIds(state.floorBalls)).map((t) => t.id)).toEqual([1]);

      // Crumple 3 tasks to floor
      state = taskReducer(state, { type: 'COMPLETE_TO_FLOOR', payload: { id: 2, originX: 100, originY: 100 } });
      state = taskReducer(state, { type: 'COMPLETE_TO_FLOOR', payload: { id: 3, originX: 200, originY: 100 } });
      state = taskReducer(state, { type: 'COMPLETE_TO_FLOOR', payload: { id: 4, originX: 300, originY: 100 } });
      state = taskReducer(state, { type: 'SET_DRAGGING_FLOOR_BALL', payload: { id: 2 } });
      state = taskReducer(state, { type: 'SET_BALL_IN_FLIGHT', payload: { inFlight: true } });

      // Score ball #2 into trash
      state = taskReducer(state, { type: 'DROP_BALL_INTO_TRASH', payload: { id: 2 } });
      expect(state.trashBounceCount).toBe(2);
      expect(state.draggingFloorBallId).toBeNull();
      expect(state.ballInFlight).toBe(false);
      expect(selectFloorBallIds(state.floorBalls)).toEqual(new Set([3, 4]));

      // Idempotent duplicate drop
      expect(taskReducer(state, { type: 'DROP_BALL_INTO_TRASH', payload: { id: 2 } })).toBe(state);

      // Restore ball #3 directly from floor
      state = taskReducer(state, { type: 'RESTORE_TASK', payload: { id: 3 } });
      expect(selectActiveTasks(state.tasks).map((t) => t.id)).toEqual([3]);
      expect(selectFloorBallIds(state.floorBalls)).toEqual(new Set([4]));

      // Restore task #1 from trash
      state = taskReducer(state, { type: 'RESTORE_TASK', payload: { id: 1 } });
      expect(selectActiveTasks(state.tasks).map((t) => t.id)).toEqual([1, 3]);

      // Sweep remaining floor balls (#4) into trash
      state = taskReducer(state, { type: 'SWEEP_FLOOR_TO_TRASH' });
      expect(state.floorBalls).toEqual([]);
      expect(selectInTrashTasks(state.tasks, selectFloorBallIds(state.floorBalls)).map((t) => t.id)).toEqual([2, 4]);

      // Open and close trash drawer
      state = taskReducer(state, { type: 'SET_TRASH_DRAWER_OPEN', payload: { open: true } });
      expect(state.trashDrawerOpen).toBe(true);

      // Spill all trashed balls (#2, #4) back onto the floor while keeping wykonane: true
      state = taskReducer(state, {
        type: 'SPILL_TRASH_TO_FLOOR',
        payload: { originX: 900, originY: 360 },
      });
      expect(selectInTrashTasks(state.tasks, selectFloorBallIds(state.floorBalls))).toEqual([]);
      expect(selectFloorBallIds(state.floorBalls)).toEqual(new Set([2, 4]));
      expect(state.floorBalls.every((b) => typeof b.vx === 'number' && b.vx < 0)).toBe(true);

      state = taskReducer(state, { type: 'SET_TRASH_DRAWER_OPEN', payload: { open: false } });
      expect(state.trashDrawerOpen).toBe(false);
    });

    it('EMPTY_TRASH archives and removes ONLY inTrashTasks while keeping active and floor-ball tasks', () => {
      let state = createInitialState({
        wersja: 1,
        tasks: [
          makeTask(1, { wykonane: false }),
          makeTask(2, { wykonane: true }),
          makeTask(3, { wykonane: false }),
          makeTask(4, { wykonane: true }),
        ],
      });

      // Crumple task #3 to floor (so #2 and #4 are in trash, #3 is on floor, #1 is active)
      state = taskReducer(state, {
        type: 'COMPLETE_TO_FLOOR',
        payload: { id: 3, originX: 250, originY: 150 },
      });

      const emptiedAt = '2026-11-19T18:00:00.000Z';
      const afterEmpty = taskReducer(state, { type: 'EMPTY_TRASH', payload: { emptiedAt } });

      expect(afterEmpty.tasks.map((t) => t.id)).toEqual([1, 3]);
      expect(afterEmpty.floorBalls.map((b) => b.taskId)).toEqual([3]);
      expect(afterEmpty.archive).toHaveLength(2);
      expect(afterEmpty.archive.map((e) => e.task.id)).toEqual([2, 4]);
      expect(afterEmpty.archive.every((e) => e.oproznionoDnia === emptiedAt)).toBe(true);
      expect(Object.keys(afterEmpty.archive[0].task).sort()).toEqual(EXPECTED_TASK_KEYS);

      // Empty again when inTrash is empty -> no-op
      expect(taskReducer(afterEmpty, { type: 'EMPTY_TRASH', payload: { emptiedAt } })).toBe(afterEmpty);
    });

    it('EMPTY_TRASH falls back to a valid ISO-8601 timestamp when emptiedAt is invalid', () => {
      const state = createInitialState({
        wersja: 1,
        tasks: [makeTask(2, { wykonane: true })],
      });

      const afterEmpty = taskReducer(state, {
        type: 'EMPTY_TRASH',
        payload: { emptiedAt: 'not-a-date' },
      });

      expect(afterEmpty.archive).toHaveLength(1);
      expect(isValidIsoTimestamp(afterEmpty.archive[0].oproznionoDnia)).toBe(true);
    });

    it('DELETE_ARCHIVE_ENTRY removes only the matching archive entry and no-ops when missing', () => {
      const state = createInitialState({
        wersja: 1,
        tasks: [],
        archive: [
          { task: makeTask(1, { wykonane: true }), oproznionoDnia: '2026-11-18T10:00:00.000Z' },
          { task: makeTask(2, { wykonane: true }), oproznionoDnia: '2026-11-18T10:00:00.000Z' },
        ],
      });

      const missing = taskReducer(state, {
        type: 'DELETE_ARCHIVE_ENTRY',
        payload: { taskId: 999, oproznionoDnia: '2026-11-18T10:00:00.000Z' },
      });
      expect(missing).toBe(state);

      const afterDelete = taskReducer(state, {
        type: 'DELETE_ARCHIVE_ENTRY',
        payload: { taskId: 1, oproznionoDnia: '2026-11-18T10:00:00.000Z' },
      });
      expect(afterDelete.archive).toHaveLength(1);
      expect(afterDelete.archive[0].task.id).toBe(2);
    });

    it('CLEAR_ARCHIVE empties archive and no-ops when already empty', () => {
      const state = createInitialState({
        wersja: 1,
        tasks: [makeTask(1)],
        archive: [
          { task: makeTask(2, { wykonane: true }), oproznionoDnia: '2026-11-18T10:00:00.000Z' },
          { task: makeTask(3, { wykonane: true }), oproznionoDnia: '2026-11-19T10:00:00.000Z' },
        ],
      });

      const cleared = taskReducer(state, { type: 'CLEAR_ARCHIVE' });
      expect(cleared.archive).toEqual([]);
      expect(cleared.tasks).toHaveLength(1);

      expect(taskReducer(cleared, { type: 'CLEAR_ARCHIVE' })).toBe(cleared);
    });
  });

  describe('LOAD_TASKS_FILE, RESET_TO_SAMPLE, filters, modals, and toasts', () => {
    it('loads external file preserving wersja, archive, and muted while resetting floorBalls and filters', () => {
      let state = createInitialState({
        wersja: 1,
        tasks: [makeTask(1)],
        archive: [{ task: makeTask(99, { wykonane: true }), oproznionoDnia: '2026-11-18T00:00:00Z' }],
        muted: true,
      });
      state = taskReducer(state, { type: 'COMPLETE_TO_FLOOR', payload: { id: 1, originX: 100, originY: 100 } });
      state = taskReducer(state, { type: 'SET_SEARCH_QUERY', payload: { query: 'test' } });
      state = taskReducer(state, { type: 'TOGGLE_TAG_FILTER', payload: { tag: 'Studia' } });

      const imported: TasksFile = {
        wersja: 2,
        zadania: [makeTask(10, { wykonane: false }), makeTask(11, { wykonane: true })],
      };

      const loaded = taskReducer(state, {
        type: 'LOAD_TASKS_FILE',
        payload: { file: imported, sourceLabel: 'zadania.json' },
      });

      expect(loaded.wersja).toBe(2);
      expect(loaded.tasks.map((t) => t.id)).toEqual([10, 11]);
      expect(loaded.floorBalls).toEqual([]);
      expect(loaded.archive).toHaveLength(1);
      expect(loaded.muted).toBe(true);
      expect(loaded.filters).toEqual({ searchQuery: '', selectedTags: [], filterMode: 'filter' });
      expect(loaded.toast?.type).toBe('success');
      expect(loaded.toast?.text).toContain('2');
      expect(selectInTrashTasks(loaded.tasks, selectFloorBallIds(loaded.floorBalls)).map((t) => t.id)).toEqual([11]);
    });

    it('handles filter, mute, modal, context menu, and toast transitions cleanly', () => {
      let state = createInitialState({ wersja: 1, tasks: [makeTask(1)] });

      state = taskReducer(state, { type: 'TOGGLE_TAG_FILTER', payload: { tag: '  Studia ' } });
      expect(state.filters.selectedTags).toEqual(['studia']);
      state = taskReducer(state, { type: 'TOGGLE_TAG_FILTER', payload: { tag: 'STUDIA' } });
      expect(state.filters.selectedTags).toEqual([]);
      expect(taskReducer(state, { type: 'TOGGLE_TAG_FILTER', payload: { tag: '   ' } })).toBe(state);

      state = taskReducer(state, { type: 'SET_FILTER_MODE', payload: { mode: 'highlight' } });
      state = taskReducer(state, { type: 'SET_SEARCH_QUERY', payload: { query: 'kolokwium' } });
      state = taskReducer(state, { type: 'RESET_FILTERS' });
      expect(state.filters.searchQuery).toBe('');
      expect(state.filters.selectedTags).toEqual([]);
      expect(state.filters.filterMode).toBe('highlight');

      state = taskReducer(state, {
        type: 'OPEN_CONTEXT_MENU',
        payload: { kind: 'note', taskId: 1, x: 10, y: 20 },
      });
      state = taskReducer(state, { type: 'OPEN_MODAL', payload: { type: 'archive' } });
      expect(state.activeModal).toEqual({ type: 'archive' });
      expect(state.contextMenu).toBeNull();

      state = taskReducer(state, { type: 'SHOW_TOAST', payload: { type: 'info', text: 'Pierwszy' } });
      const firstToastId = state.toast?.id ?? 0;
      state = taskReducer(state, { type: 'SHOW_TOAST', payload: { type: 'error', text: 'Drugi' } });
      expect((state.toast?.id ?? 0)).toBeGreaterThan(firstToastId);

      state = taskReducer(state, { type: 'TOGGLE_MUTE' });
      expect(state.muted).toBe(true);

      const reset = taskReducer(state, {
        type: 'RESET_TO_SAMPLE',
        payload: { file: { wersja: 1, zadania: [makeTask(5)] } },
      });
      expect(reset.tasks.map((t) => t.id)).toEqual([5]);
      expect(reset.muted).toBe(true);
    });
  });

  describe('pure selectors', () => {
    it('enforces search (title+opis), OR multi-tag, AND combination, and selectAllTags union', () => {
      const tasks: Task[] = [
        makeTask(1, { tytul: 'Kolokwium z sieci', opis: 'Rozdziały 3–5', tagi: ['studia'] }),
        makeTask(2, { tytul: 'Sprawozdanie', opis: 'Błędy pomiarowe ćwiczenia', tagi: ['ćwiczenia', 'studia'] }),
        makeTask(3, { tytul: 'Zakupy', opis: 'Kawa i mleko', tagi: ['dom'] }),
        makeTask(4, { tytul: 'Biblioteka', opis: '', tagi: [] }),
      ];

      // Whitespace-only query matches all
      expect(
        selectMatchingTaskIds(tasks, { searchQuery: '   ', selectedTags: [], filterMode: 'filter' }),
      ).toEqual(new Set([1, 2, 3, 4]));

      // Case-insensitive search across title & opis with Polish diacritics
      expect(
        selectMatchingTaskIds(tasks, { searchQuery: 'ĆWICZENIA', selectedTags: [], filterMode: 'filter' }),
      ).toEqual(new Set([2]));

      // Multi-tag OR matching excludes tagless tasks
      expect(
        selectMatchingTaskIds(tasks, { searchQuery: '', selectedTags: ['dom', 'ćwiczenia'], filterMode: 'filter' }),
      ).toEqual(new Set([2, 3]));

      // Search AND tag combination
      const filterIds = selectMatchingTaskIds(tasks, {
        searchQuery: 'kolokwium',
        selectedTags: ['studia', 'dom'],
        filterMode: 'filter',
      });
      const highlightIds = selectMatchingTaskIds(tasks, {
        searchQuery: 'kolokwium',
        selectedTags: ['studia', 'dom'],
        filterMode: 'highlight',
      });
      expect(filterIds).toEqual(new Set([1]));
      expect(highlightIds).toEqual(filterIds);

      // selectAllTags unions active tags with selectedTags so active filter chip never disappears
      expect(selectAllTags(tasks, ['archiwalny'])).toEqual([
        'archiwalny',
        'ćwiczenia',
        'dom',
        'studia',
      ]);
    });
  });
});

describe('TaskProvider persistence & F5 hydration simulation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mountProvider() {
    let latest!: TaskContextValue;
    function Probe() {
      latest = useTasks();
      return null;
    }
    const rendered = render(React.createElement(TaskProvider, null, React.createElement(Probe)));
    return {
      get ctx() {
        return latest;
      },
      unmount: rendered.unmount,
    };
  }

  it('hydrates from sampleTasks.json on empty localStorage and persists to smartapp_tasks_v1', () => {
    const mounted = mountProvider();
    expect(mounted.ctx.state.wersja).toBe(1);
    expect(mounted.ctx.state.tasks).toHaveLength(20);
    expect(mounted.ctx.state.floorBalls).toEqual([]);
    expect(mounted.ctx.trashHitboxRef.current).toBeNull();

    const stored = JSON.parse(localStorage.getItem(TASKS_STORAGE_KEY) ?? '{}') as TasksFile;
    expect(stored.wersja).toBe(1);
    expect(stored.zadania).toHaveLength(20);
  });

  it('falls back gracefully on corrupted localStorage values', () => {
    localStorage.setItem(TASKS_STORAGE_KEY, '{not-json');
    localStorage.setItem(ARCHIVE_STORAGE_KEY, '{not-json');
    localStorage.setItem(PREFS_STORAGE_KEY, '{not-json');

    const mounted = mountProvider();
    expect(mounted.ctx.state.tasks).toHaveLength(20);
    expect(mounted.ctx.state.archive).toEqual([]);
    expect(mounted.ctx.state.muted).toBe(false);
  });

  it('preserves a valid empty tasks list from localStorage without falling back to sampleTasks', () => {
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify({ wersja: 2, zadania: [] }));

    const mounted = mountProvider();
    expect(mounted.ctx.state.wersja).toBe(2);
    expect(mounted.ctx.state.tasks).toEqual([]);
  });

  it('persists strictly 7 fields to smartapp_tasks_v1 and isolates archive and prefs keys', () => {
    const mounted = mountProvider();

    act(() => {
      mounted.ctx.dispatch({
        type: 'COMPLETE_TO_FLOOR',
        payload: { id: 1, originX: 300, originY: 200 },
      });
      mounted.ctx.dispatch({
        type: 'EMPTY_TRASH',
        payload: { emptiedAt: '2026-11-19T19:00:00.000Z' },
      });
      mounted.ctx.dispatch({ type: 'TOGGLE_MUTE' });
    });

    const rawTasks = JSON.parse(localStorage.getItem(TASKS_STORAGE_KEY) ?? '{}') as Record<
      string,
      unknown
    >;
    expect(Object.keys(rawTasks).sort()).toEqual(['wersja', 'zadania']);
    const zadania = rawTasks.zadania as Record<string, unknown>[];
    for (const item of zadania) {
      expect(Object.keys(item).sort()).toEqual(EXPECTED_TASK_KEYS);
    }

    const rawArchive = JSON.parse(localStorage.getItem(ARCHIVE_STORAGE_KEY) ?? '{}') as {
      wersja: number;
      archiwum: ArchiveEntry[];
    };
    expect(rawArchive.wersja).toBe(1);
    expect(rawArchive.archiwum).toHaveLength(4);

    const rawPrefs = JSON.parse(localStorage.getItem(PREFS_STORAGE_KEY) ?? '{}') as {
      muted: boolean;
    };
    expect(rawPrefs).toEqual({ muted: true });
  });

  it('F5 reload invariant: floor balls persist as wykonane=true and reappear inside trash after remount', () => {
    const firstMount = mountProvider();
    const initialCompletedCount = firstMount.ctx.completedTasks.length;

    act(() => {
      firstMount.ctx.dispatch({
        type: 'COMPLETE_TO_FLOOR',
        payload: { id: 1, originX: 250, originY: 180 },
      });
      firstMount.ctx.dispatch({
        type: 'COMPLETE_TO_FLOOR',
        payload: { id: 2, originX: 450, originY: 180 },
      });
    });

    expect(firstMount.ctx.floorBallTasks.map((t) => t.id)).toEqual([1, 2]);
    expect(firstMount.ctx.completedTasks).toHaveLength(initialCompletedCount + 2);

    // Simulate page refresh (F5): unmount and mount fresh TaskProvider
    firstMount.unmount();
    const reloaded = mountProvider();

    expect(reloaded.ctx.state.floorBalls).toEqual([]);
    expect(reloaded.ctx.floorBallTasks).toEqual([]);
    expect(reloaded.ctx.inTrashTasks.some((t) => t.id === 1)).toBe(true);
    expect(reloaded.ctx.inTrashTasks.some((t) => t.id === 2)).toBe(true);
    expect(reloaded.ctx.completedTasks).toHaveLength(initialCompletedCount + 2);
  });

  it('throws an explicit error if useTasks is called outside TaskProvider', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function BadConsumer() {
      useTasks();
      return null;
    }
    expect(() => render(React.createElement(BadConsumer))).toThrow(
      'useTasks must be used within a TaskProvider',
    );
    consoleErrorSpy.mockRestore();
  });

  it('prevents invalid termin and invalid emptiedAt from corrupting localStorage across F5 reload', () => {
    const firstMount = mountProvider();

    act(() => {
      firstMount.ctx.dispatch({
        type: 'ADD_TASK',
        payload: {
          tytul: 'Ważne zadanie',
          opis: 'Musi przetrwać F5',
          termin: '',
          priorytet: 'wysoki',
          wykonane: false,
          tagi: ['egzamin'],
        },
      });
      firstMount.ctx.dispatch({
        type: 'ADD_TASK',
        payload: {
          tytul: 'Zła data',
          opis: '',
          termin: '2026-02-29',
          priorytet: 'niski',
          wykonane: false,
          tagi: [],
        },
      });
      firstMount.ctx.dispatch({
        type: 'UPDATE_TASK',
        payload: { id: 1, patch: { termin: '' } },
      });
      firstMount.ctx.dispatch({
        type: 'UPDATE_TASK',
        payload: { id: 2, patch: { termin: '2026-02-30' } },
      });
      firstMount.ctx.dispatch({
        type: 'EMPTY_TRASH',
        payload: { emptiedAt: 'not-a-date' },
      });
    });

    const rawStored = localStorage.getItem(TASKS_STORAGE_KEY) ?? '';
    expect(validateAndParseTasksJson(rawStored).ok).toBe(true);
    expect(loadArchiveFromStorage()).toHaveLength(4);

    firstMount.unmount();
    const reloaded = mountProvider();

    expect(reloaded.ctx.state.tasks.some((t) => t.tytul === 'Ważne zadanie' && t.termin === null)).toBe(true);
    expect(reloaded.ctx.state.tasks.some((t) => t.tytul === 'Zła data')).toBe(false);
    expect(reloaded.ctx.state.tasks.find((t) => t.id === 1)?.termin).toBeNull();
    expect(reloaded.ctx.state.archive).toHaveLength(4);
  });
});
