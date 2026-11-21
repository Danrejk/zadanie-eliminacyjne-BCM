import type {
  ArchiveEntry,
  FilterState,
  FloorBallSpawn,
  Task,
  TaskAction,
  TaskState,
} from '../types/task';
import { canDropIntoZone, isValidDateString, resolveDateForZoneDrop } from '../utils/dateBuckets';
import { getNextTaskId, isValidIsoTimestamp } from '../utils/jsonIO';
import { normalizeTag } from '../utils/tagColors';

const VALID_PRIORITIES: ReadonlySet<string> = new Set(['niski', 'sredni', 'wysoki']);

export interface InitialStateSeed {
  wersja: number;
  tasks: Task[];
  archive?: ArchiveEntry[];
  muted?: boolean;
}

const DEFAULT_FILTERS: FilterState = {
  searchQuery: '',
  selectedTags: [],
  filterMode: 'filter',
};

function sanitizeTags(tags: string[]): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];

  for (let i = 0; i < tags.length; i++) {
    const raw = tags[i];
    if (typeof raw !== 'string') {
      continue;
    }
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const norm = normalizeTag(trimmed);
    if (!seen.has(norm)) {
      seen.add(norm);
      result.push(trimmed);
    }
  }

  return result;
}

function normalizeAndValidateTermin(
  termin: string | null | undefined,
): { valid: true; value: string | null } | { valid: false } {
  if (termin === null || termin === undefined || termin === '') {
    return { valid: true, value: null };
  }
  if (typeof termin === 'string' && isValidDateString(termin)) {
    return { valid: true, value: termin };
  }
  return { valid: false };
}

function cloneTaskStrict(t: Task): Task {
  return {
    id: t.id,
    tytul: t.tytul,
    opis: t.opis,
    termin: t.termin,
    priorytet: t.priorytet,
    wykonane: Boolean(t.wykonane),
    tagi: [...t.tagi],
  };
}

export function createInitialState(seed: InitialStateSeed): TaskState {
  return {
    wersja: seed.wersja,
    tasks: seed.tasks.map(cloneTaskStrict),
    archive: (seed.archive ?? []).map((entry) => ({
      task: cloneTaskStrict(entry.task),
      oproznionoDnia: entry.oproznionoDnia,
    })),
    muted: Boolean(seed.muted ?? false),
    floorBalls: [],
    draggingFloorBallId: null,
    ballInFlight: false,
    draggingNoteId: null,
    trashDrawerOpen: false,
    trashBounceCount: 0,
    filters: { ...DEFAULT_FILTERS, selectedTags: [] },
    activeModal: { type: 'none' },
    contextMenu: null,
    toast: null,
  };
}

export function selectActiveTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.wykonane);
}

export function selectCompletedTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.wykonane);
}

export function selectFloorBallIds(floorBalls: FloorBallSpawn[]): Set<number> {
  return new Set(floorBalls.map((b) => b.taskId));
}

export function selectFloorBallTasks(tasks: Task[], floorBallIds: Set<number>): Task[] {
  return tasks.filter((t) => t.wykonane && floorBallIds.has(t.id));
}

export function selectInTrashTasks(tasks: Task[], floorBallIds: Set<number>): Task[] {
  return tasks.filter((t) => t.wykonane && !floorBallIds.has(t.id));
}

export function selectMatchingTaskIds(activeTasks: Task[], filters: FilterState): Set<number> {
  const query = filters.searchQuery.trim().toLowerCase();
  const selected = filters.selectedTags.map(normalizeTag).filter((t) => t.length > 0);
  const matching = new Set<number>();

  for (let i = 0; i < activeTasks.length; i++) {
    const task = activeTasks[i];
    const matchesSearch =
      query === '' ||
      task.tytul.toLowerCase().includes(query) ||
      task.opis.toLowerCase().includes(query);

    const matchesTags =
      selected.length === 0 ||
      task.tagi.some((tag) => selected.includes(normalizeTag(tag)));

    if (matchesSearch && matchesTags) {
      matching.add(task.id);
    }
  }

  return matching;
}

export function selectAllTags(activeTasks: Task[], selectedTags: string[] = []): string[] {
  const tagSet = new Set<string>();

  for (let i = 0; i < activeTasks.length; i++) {
    const tags = activeTasks[i].tagi;
    for (let j = 0; j < tags.length; j++) {
      const norm = normalizeTag(tags[j]);
      if (norm.length > 0) {
        tagSet.add(norm);
      }
    }
  }

  for (let i = 0; i < selectedTags.length; i++) {
    const norm = normalizeTag(selectedTags[i]);
    if (norm.length > 0) {
      tagSet.add(norm);
    }
  }

  return Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'pl'));
}

function isContextMenuForTask(
  menu: TaskState['contextMenu'],
  taskId: number,
): boolean {
  return menu !== null && 'taskId' in menu && menu.taskId === taskId;
}

export function taskReducer(state: TaskState, action: TaskAction): TaskState {
  switch (action.type) {
    case 'ADD_TASK': {
      const trimmedTitle = action.payload.tytul.trim();
      if (trimmedTitle.length === 0) {
        return state;
      }

      if (!VALID_PRIORITIES.has(action.payload.priorytet)) {
        return state;
      }

      const terminCheck = normalizeAndValidateTermin(action.payload.termin);
      if (!terminCheck.valid) {
        return state;
      }

      const nextId = getNextTaskId(state.tasks, state.archive);
      const newTask: Task = {
        id: nextId,
        tytul: trimmedTitle,
        opis: action.payload.opis ?? '',
        termin: terminCheck.value,
        priorytet: action.payload.priorytet,
        wykonane: Boolean(action.payload.wykonane),
        tagi: sanitizeTags(action.payload.tagi),
      };

      return {
        ...state,
        tasks: [...state.tasks, newTask],
      };
    }

    case 'UPDATE_TASK': {
      const { id, patch } = action.payload;
      const existing = state.tasks.find((t) => t.id === id);
      if (!existing) {
        return state;
      }
      if (patch.tytul !== undefined && patch.tytul.trim().length === 0) {
        return state;
      }
      if (patch.priorytet !== undefined && !VALID_PRIORITIES.has(patch.priorytet)) {
        return state;
      }

      let nextTermin: string | null = existing.termin;
      if (patch.termin !== undefined) {
        const terminCheck = normalizeAndValidateTermin(patch.termin);
        if (!terminCheck.valid) {
          return state;
        }
        nextTermin = terminCheck.value;
      }

      const updatedTask: Task = {
        id: existing.id,
        tytul: patch.tytul !== undefined ? patch.tytul.trim() : existing.tytul,
        opis: patch.opis !== undefined ? patch.opis : existing.opis,
        termin: nextTermin,
        priorytet: patch.priorytet !== undefined ? patch.priorytet : existing.priorytet,
        wykonane: patch.wykonane !== undefined ? Boolean(patch.wykonane) : existing.wykonane,
        tagi: patch.tagi !== undefined ? sanitizeTags(patch.tagi) : [...existing.tagi],
      };

      const nextTasks = state.tasks.map((t) => (t.id === id ? updatedTask : t));

      if (patch.wykonane === false) {
        const nextFloorBalls = state.floorBalls.filter((b) => b.taskId !== id);
        return {
          ...state,
          tasks: nextTasks,
          floorBalls: nextFloorBalls,
          draggingFloorBallId: state.draggingFloorBallId === id ? null : state.draggingFloorBallId,
          ballInFlight: nextFloorBalls.length === 0 ? false : state.ballInFlight,
          contextMenu: isContextMenuForTask(state.contextMenu, id) ? null : state.contextMenu,
        };
      }

      return {
        ...state,
        tasks: nextTasks,
      };
    }

    case 'DELETE_TASK': {
      const { id } = action.payload;
      if (!state.tasks.some((t) => t.id === id)) {
        return state;
      }

      const nextTasks = state.tasks.filter((t) => t.id !== id);
      const nextFloorBalls = state.floorBalls.filter((b) => b.taskId !== id);

      return {
        ...state,
        tasks: nextTasks,
        floorBalls: nextFloorBalls,
        draggingFloorBallId: state.draggingFloorBallId === id ? null : state.draggingFloorBallId,
        draggingNoteId: state.draggingNoteId === id ? null : state.draggingNoteId,
        ballInFlight: nextFloorBalls.length === 0 ? false : state.ballInFlight,
        contextMenu: isContextMenuForTask(state.contextMenu, id) ? null : state.contextMenu,
        activeModal:
          (state.activeModal.type === 'edit' ||
            state.activeModal.type === 'view') &&
          state.activeModal.taskId === id
            ? { type: 'none' }
            : state.activeModal,
      };
    }

    case 'SET_PRIORITY': {
      const { id, priorytet } = action.payload;
      if (!VALID_PRIORITIES.has(priorytet)) {
        return state;
      }
      const existing = state.tasks.find((t) => t.id === id);
      if (!existing || existing.priorytet === priorytet) {
        return state;
      }

      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === id ? { ...t, priorytet } : t)),
      };
    }

    case 'MOVE_TASK_TO_ZONE': {
      const { id, targetPriority, targetZone, todayStr } = action.payload;
      const existing = state.tasks.find((t) => t.id === id);
      if (!existing) {
        return state;
      }

      if (!canDropIntoZone(existing.termin, targetZone, todayStr)) {
        if (state.draggingNoteId === id) {
          return { ...state, draggingNoteId: null };
        }
        return state;
      }

      const nextTermin = resolveDateForZoneDrop(existing.termin, targetZone, todayStr);
      if (existing.priorytet === targetPriority && existing.termin === nextTermin) {
        if (state.draggingNoteId === id) {
          return { ...state, draggingNoteId: null };
        }
        return state;
      }

      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === id ? { ...t, priorytet: targetPriority, termin: nextTermin } : t,
        ),
        draggingNoteId: state.draggingNoteId === id ? null : state.draggingNoteId,
      };
    }

    case 'COMPLETE_TO_FLOOR': {
      const { id, originX, originY } = action.payload;
      const existing = state.tasks.find((t) => t.id === id);
      if (!existing || existing.wykonane) {
        return state;
      }

      const alreadyOnFloor = state.floorBalls.some((b) => b.taskId === id);
      const nextFloorBalls = alreadyOnFloor
        ? state.floorBalls
        : [
            ...state.floorBalls,
            {
              taskId: id,
              originX,
              originY,
              spawnedAt: Date.now(),
            },
          ];

      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === id ? { ...t, wykonane: true } : t)),
        floorBalls: nextFloorBalls,
        draggingNoteId: state.draggingNoteId === id ? null : state.draggingNoteId,
        contextMenu: isContextMenuForTask(state.contextMenu, id) ? null : state.contextMenu,
      };
    }

    case 'COMPLETE_TO_TRASH': {
      const { id } = action.payload;
      const existing = state.tasks.find((t) => t.id === id);
      if (!existing) {
        return state;
      }

      const onFloor = state.floorBalls.some((b) => b.taskId === id);
      if (existing.wykonane && !onFloor) {
        return state;
      }

      const nextFloorBalls = onFloor
        ? state.floorBalls.filter((b) => b.taskId !== id)
        : state.floorBalls;

      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === id ? { ...t, wykonane: true } : t)),
        floorBalls: nextFloorBalls,
        trashBounceCount: state.trashBounceCount + 1,
        draggingNoteId: state.draggingNoteId === id ? null : state.draggingNoteId,
        draggingFloorBallId: state.draggingFloorBallId === id ? null : state.draggingFloorBallId,
        ballInFlight: nextFloorBalls.length === 0 ? false : state.ballInFlight,
        contextMenu: isContextMenuForTask(state.contextMenu, id) ? null : state.contextMenu,
      };
    }

    case 'DROP_BALL_INTO_TRASH': {
      const { id } = action.payload;
      if (!state.floorBalls.some((b) => b.taskId === id)) {
        return state;
      }

      const nextFloorBalls = state.floorBalls.filter((b) => b.taskId !== id);

      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === id ? { ...t, wykonane: true } : t)),
        floorBalls: nextFloorBalls,
        trashBounceCount: state.trashBounceCount + 1,
        draggingFloorBallId: state.draggingFloorBallId === id ? null : state.draggingFloorBallId,
        ballInFlight: false,
        contextMenu: isContextMenuForTask(state.contextMenu, id) ? null : state.contextMenu,
      };
    }

    case 'SWEEP_FLOOR_TO_TRASH': {
      if (state.floorBalls.length === 0) {
        return state;
      }

      return {
        ...state,
        floorBalls: [],
        draggingFloorBallId: null,
        ballInFlight: false,
        trashBounceCount: state.trashBounceCount + 1,
        contextMenu: state.contextMenu?.kind === 'floorBall' ? null : state.contextMenu,
      };
    }

    case 'SPILL_TRASH_TO_FLOOR': {
      const floorIds = selectFloorBallIds(state.floorBalls);
      const inTrash = selectInTrashTasks(state.tasks, floorIds);
      if (inTrash.length === 0) {
        return state;
      }

      const { originX, originY } = action.payload;
      const now = Date.now();
      const spilled: FloorBallSpawn[] = inTrash.map((task, idx) => {
        const spread = idx % 7;
        const row = Math.floor(idx / 7);
        const vx = -210 - spread * 42 - (task.id % 4) * 20;
        const vy = -260 - ((idx * 53) % 240) - row * 35;
        return {
          taskId: task.id,
          originX: originX - (idx % 3) * 10,
          originY: originY + ((idx % 4) - 1) * 8,
          spawnedAt: now,
          vx,
          vy,
        };
      });

      return {
        ...state,
        floorBalls: [...state.floorBalls, ...spilled],
        contextMenu: state.contextMenu?.kind === 'trashBall' ? null : state.contextMenu,
      };
    }

    case 'RESTORE_TASK': {
      const { id } = action.payload;
      const existing = state.tasks.find((t) => t.id === id);
      if (!existing) {
        return state;
      }

      const onFloor = state.floorBalls.some((b) => b.taskId === id);
      if (!existing.wykonane && !onFloor) {
        return state;
      }

      const nextFloorBalls = onFloor
        ? state.floorBalls.filter((b) => b.taskId !== id)
        : state.floorBalls;

      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === id ? { ...t, wykonane: false } : t)),
        floorBalls: nextFloorBalls,
        draggingFloorBallId: state.draggingFloorBallId === id ? null : state.draggingFloorBallId,
        ballInFlight: nextFloorBalls.length === 0 ? false : state.ballInFlight,
        contextMenu: isContextMenuForTask(state.contextMenu, id) ? null : state.contextMenu,
      };
    }

    case 'EMPTY_TRASH': {
      const floorIds = selectFloorBallIds(state.floorBalls);
      const inTrash = selectInTrashTasks(state.tasks, floorIds);
      if (inTrash.length === 0) {
        return state;
      }

      const safeEmptiedAt = isValidIsoTimestamp(action.payload.emptiedAt)
        ? action.payload.emptiedAt
        : new Date().toISOString();

      const inTrashIds = new Set(inTrash.map((t) => t.id));
      const newEntries: ArchiveEntry[] = inTrash.map((t) => ({
        task: cloneTaskStrict({ ...t, wykonane: true }),
        oproznionoDnia: safeEmptiedAt,
      }));

      return {
        ...state,
        tasks: state.tasks.filter((t) => !inTrashIds.has(t.id)),
        archive: [...state.archive, ...newEntries],
        contextMenu:
          state.contextMenu &&
          'taskId' in state.contextMenu &&
          inTrashIds.has(state.contextMenu.taskId)
            ? null
            : state.contextMenu,
      };
    }

    case 'DELETE_ARCHIVE_ENTRY': {
      const { taskId, oproznionoDnia } = action.payload;
      const idx = state.archive.findIndex(
        (entry) =>
          entry.task.id === taskId && entry.oproznionoDnia === oproznionoDnia,
      );
      if (idx === -1) {
        return state;
      }

      return {
        ...state,
        archive: state.archive.filter((_, i) => i !== idx),
      };
    }

    case 'CLEAR_ARCHIVE': {
      if (state.archive.length === 0) {
        return state;
      }

      return {
        ...state,
        archive: [],
      };
    }

    case 'LOAD_TASKS_FILE': {
      const { file, sourceLabel } = action.payload;
      return {
        ...state,
        wersja: file.wersja,
        tasks: file.zadania.map(cloneTaskStrict),
        floorBalls: [],
        draggingFloorBallId: null,
        ballInFlight: false,
        draggingNoteId: null,
        trashDrawerOpen: false,
        filters: { ...DEFAULT_FILTERS, selectedTags: [] },
        activeModal: { type: 'none' },
        contextMenu: null,
        toast: sourceLabel
          ? {
              id: (state.toast?.id ?? 0) + 1,
              type: 'success',
              text: `Wczytano ${file.zadania.length} zadań (${sourceLabel}).`,
            }
          : state.toast,
      };
    }

    case 'RESET_TO_SAMPLE': {
      const { file } = action.payload;
      return {
        ...state,
        wersja: file.wersja,
        tasks: file.zadania.map(cloneTaskStrict),
        floorBalls: [],
        draggingFloorBallId: null,
        ballInFlight: false,
        draggingNoteId: null,
        trashDrawerOpen: false,
        filters: { ...DEFAULT_FILTERS, selectedTags: [] },
        activeModal: { type: 'none' },
        contextMenu: null,
      };
    }

    case 'SET_DRAGGING_FLOOR_BALL': {
      if (state.draggingFloorBallId === action.payload.id) {
        return state;
      }
      return {
        ...state,
        draggingFloorBallId: action.payload.id,
      };
    }

    case 'SET_BALL_IN_FLIGHT': {
      if (state.ballInFlight === action.payload.inFlight) {
        return state;
      }
      return {
        ...state,
        ballInFlight: action.payload.inFlight,
      };
    }

    case 'SET_DRAGGING_NOTE': {
      if (state.draggingNoteId === action.payload.id) {
        return state;
      }
      return {
        ...state,
        draggingNoteId: action.payload.id,
      };
    }

    case 'SET_TRASH_DRAWER_OPEN': {
      if (state.trashDrawerOpen === action.payload.open) {
        return state;
      }
      return {
        ...state,
        trashDrawerOpen: action.payload.open,
        contextMenu:
          !action.payload.open && state.contextMenu?.kind === 'trashBall'
            ? null
            : state.contextMenu,
      };
    }

    case 'SET_SEARCH_QUERY': {
      if (state.filters.searchQuery === action.payload.query) {
        return state;
      }
      return {
        ...state,
        filters: {
          ...state.filters,
          searchQuery: action.payload.query,
        },
      };
    }

    case 'TOGGLE_TAG_FILTER': {
      const norm = normalizeTag(action.payload.tag);
      if (norm.length === 0) {
        return state;
      }

      const exists = state.filters.selectedTags.includes(norm);
      const nextSelected = exists
        ? state.filters.selectedTags.filter((t) => t !== norm)
        : [...state.filters.selectedTags, norm];

      return {
        ...state,
        filters: {
          ...state.filters,
          selectedTags: nextSelected,
        },
      };
    }

    case 'SET_FILTER_MODE': {
      if (state.filters.filterMode === action.payload.mode) {
        return state;
      }
      return {
        ...state,
        filters: {
          ...state.filters,
          filterMode: action.payload.mode,
        },
      };
    }

    case 'RESET_FILTERS': {
      if (state.filters.searchQuery === '' && state.filters.selectedTags.length === 0) {
        return state;
      }
      return {
        ...state,
        filters: {
          ...state.filters,
          searchQuery: '',
          selectedTags: [],
        },
      };
    }

    case 'TOGGLE_MUTE': {
      return {
        ...state,
        muted: !state.muted,
      };
    }

    case 'OPEN_MODAL': {
      if (action.payload.type === 'trash') {
        return {
          ...state,
          trashDrawerOpen: true,
          contextMenu: null,
        };
      }
      return {
        ...state,
        activeModal: action.payload,
        contextMenu: null,
      };
    }

    case 'CLOSE_MODAL': {
      if (state.activeModal.type === 'none') {
        return state;
      }
      return {
        ...state,
        activeModal: { type: 'none' },
      };
    }

    case 'OPEN_CONTEXT_MENU': {
      return {
        ...state,
        contextMenu: action.payload,
      };
    }

    case 'CLOSE_CONTEXT_MENU': {
      if (state.contextMenu === null) {
        return state;
      }
      return {
        ...state,
        contextMenu: null,
      };
    }

    case 'SHOW_TOAST': {
      return {
        ...state,
        toast: {
          ...action.payload,
          id: (state.toast?.id ?? 0) + 1,
        },
      };
    }

    case 'DISMISS_TOAST': {
      if (state.toast === null) {
        return state;
      }
      return {
        ...state,
        toast: null,
      };
    }
  }
}
