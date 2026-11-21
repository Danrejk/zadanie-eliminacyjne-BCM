// src/types/task.ts

/** Priority ordered TOP -> BOTTOM on the corkboard Y-axis */
export type Priority = 'wysoki' | 'sredni' | 'niski';
export const PRIORITIES: readonly Priority[] = ['wysoki', 'sredni', 'niski'] as const;

/** Time buckets ordered LEFT -> RIGHT on the corkboard X-axis */
export type TimeZone = 'overdue' | 'todayTomorrow' | 'thisWeek' | 'later' | 'noDeadline';
export const TIME_ZONES: readonly TimeZone[] = [
  'overdue',
  'todayTomorrow',
  'thisWeek',
  'later',
  'noDeadline',
] as const;

/** Strict zadania.json item schema — NEVER add internal fields here */
export interface Task {
  id: number;
  tytul: string;
  opis: string;
  termin: string | null; // "YYYY-MM-DD" | null
  priorytet: Priority;
  wykonane: boolean;
  tagi: string[];
}

export type TaskInput = Omit<Task, 'id'>;
export type TaskPatch = Partial<Omit<Task, 'id'>>;

/** Strict root schema for zadania.json */
export interface TasksFile {
  wersja: number;
  zadania: Task[];
}

/** Secondary archive JSON (archiwum_usunietych.json) */
export interface ArchiveEntry {
  task: Task;
  oproznionoDnia: string; // ISO-8601 UTC timestamp, e.g. new Date().toISOString()
}

export interface ArchiveFile {
  wersja: 1;
  archiwum: ArchiveEntry[];
}

/** Ephemeral spawn descriptor stored in TaskState (NEVER persisted) */
export interface FloorBallSpawn {
  taskId: number;
  originX: number; // viewport clientX (px)
  originY: number; // viewport clientY (px)
  spawnedAt: number; // Date.now()
  vx?: number; // optional initial X velocity (px/s)
  vy?: number; // optional initial Y velocity (px/s)
}

/** Active pointer-drag state for an unfinished Post-it note */
export interface NoteDragState {
  taskId: number;
  clientX: number;
  clientY: number;
  isOverTrash: boolean;
  hoveredCell: { priority: Priority; zone: TimeZone } | null;
}

/** Mutable 60fps 2D physics state owned by FloorPhysicsLayer via useRef (pure logic in floorPhysics.ts) */
export interface FloorBall {
  taskId: number;
  x: number;              // center X in viewport px
  y: number;              // center Y in viewport px
  vx: number;             // velocity X in px/s
  vy: number;             // velocity Y in px/s
  rotation: number;       // degrees
  vRot: number;           // angular velocity in deg/s
  radius: number;         // collision radius in px (default 24)
  isDragging: boolean;
  canScoreTrash: boolean; // false on initial double-click fall; true once grabbed/thrown
  enteringTrash: boolean; // true during ~200ms shrink-into-bin "plop" transition
  enterStartTime: number | null;
  enterStartX: number;
  enterStartY: number;
}

export type FilterMode = 'filter' | 'highlight';

export interface FilterState {
  searchQuery: string;
  selectedTags: string[]; // normalized lowercase tags; OR-matched across selected tags
  filterMode: FilterMode; // 'filter' hides non-matching; 'highlight' dims non-matching
}

export type ContextMenuTarget =
  | { kind: 'note'; taskId: number; x: number; y: number }
  | { kind: 'floorBall'; taskId: number; x: number; y: number }
  | { kind: 'trashBall'; taskId: number; x: number; y: number }
  | { kind: 'cell'; priority: Priority; zone: TimeZone; x: number; y: number };

export type ActiveModal =
  | { type: 'none' }
  | { type: 'create'; defaultPriority?: Priority; defaultZone?: TimeZone }
  | { type: 'view'; taskId: number }
  | { type: 'edit'; taskId: number }
  | { type: 'trash' }
  | { type: 'emptySummary' }
  | { type: 'archive' };

export interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info';
  text: string;
  details?: string[];
}

export interface TaskState {
  // Persisted slices (saved to separate localStorage keys)
  wersja: number;
  tasks: Task[];
  archive: ArchiveEntry[];
  muted: boolean;

  // Ephemeral in-memory slices (NEVER persisted to localStorage or zadania.json)
  floorBalls: FloorBallSpawn[];
  draggingFloorBallId: number | null;
  ballInFlight: boolean;          // keeps TrashCanWidget enlarged while a thrown ball is airborne
  draggingNoteId: number | null;  // highlights board cells & trash direct-drop zone
  trashDrawerOpen: boolean;       // expanded right-side trashcan drawer state
  trashBounceCount: number;       // monotonic counter to trigger catch-bounce in TrashCanWidget
  filters: FilterState;
  activeModal: ActiveModal;
  contextMenu: ContextMenuTarget | null;
  toast: ToastMessage | null;
}

export type TaskAction =
  | { type: 'ADD_TASK'; payload: TaskInput }
  | { type: 'UPDATE_TASK'; payload: { id: number; patch: TaskPatch } }
  | { type: 'DELETE_TASK'; payload: { id: number } }
  | { type: 'SET_PRIORITY'; payload: { id: number; priorytet: Priority } }
  | {
      type: 'MOVE_TASK_TO_ZONE';
      payload: {
        id: number;
        targetPriority: Priority;
        targetZone: TimeZone;
        todayStr?: string; // optional injection for deterministic unit tests
      };
    }
  | { type: 'COMPLETE_TO_FLOOR'; payload: { id: number; originX: number; originY: number } }
  | { type: 'COMPLETE_TO_TRASH'; payload: { id: number } }
  | { type: 'DROP_BALL_INTO_TRASH'; payload: { id: number } }
  | { type: 'SWEEP_FLOOR_TO_TRASH' }
  | { type: 'SPILL_TRASH_TO_FLOOR'; payload: { originX: number; originY: number } }
  | { type: 'RESTORE_TASK'; payload: { id: number } }
  | { type: 'EMPTY_TRASH'; payload: { emptiedAt: string } }
  | { type: 'LOAD_TASKS_FILE'; payload: { file: TasksFile; sourceLabel?: string } }
  | { type: 'RESET_TO_SAMPLE'; payload: { file: TasksFile } }
  | { type: 'SET_DRAGGING_FLOOR_BALL'; payload: { id: number | null } }
  | { type: 'SET_BALL_IN_FLIGHT'; payload: { inFlight: boolean } }
  | { type: 'SET_DRAGGING_NOTE'; payload: { id: number | null } }
  | { type: 'SET_TRASH_DRAWER_OPEN'; payload: { open: boolean } }
  | { type: 'SET_SEARCH_QUERY'; payload: { query: string } }
  | { type: 'TOGGLE_TAG_FILTER'; payload: { tag: string } }
  | { type: 'SET_FILTER_MODE'; payload: { mode: FilterMode } }
  | { type: 'RESET_FILTERS' }
  | { type: 'TOGGLE_MUTE' }
  | { type: 'OPEN_MODAL'; payload: ActiveModal }
  | { type: 'CLOSE_MODAL' }
  | { type: 'OPEN_CONTEXT_MENU'; payload: ContextMenuTarget }
  | { type: 'CLOSE_CONTEXT_MENU' }
  | { type: 'SHOW_TOAST'; payload: Omit<ToastMessage, 'id'> }
  | { type: 'DISMISS_TOAST' };
