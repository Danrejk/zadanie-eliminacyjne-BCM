import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import sampleTasksRaw from '../data/sampleTasks.json';
import type { NoteDragState, Task, TaskAction, TasksFile, TaskState } from '../types/task';
import {
  loadArchiveFromStorage,
  loadMutedFromStorage,
  loadTasksFromStorage,
  saveArchiveToStorage,
  saveMutedToStorage,
  saveTasksToStorage,
} from '../utils/jsonIO';
import {
  createInitialState,
  type InitialStateSeed,
  selectActiveTasks,
  selectAllTags,
  selectCompletedTasks,
  selectFloorBallIds,
  selectFloorBallTasks,
  selectInTrashTasks,
  selectMatchingTaskIds,
  taskReducer,
} from './taskReducer';

const SAMPLE_TASKS_FILE = sampleTasksRaw as TasksFile;

export interface TaskContextValue {
  state: TaskState;
  dispatch: React.Dispatch<TaskAction>;
  activeTasks: Task[];
  completedTasks: Task[];
  floorBallIds: Set<number>;
  floorBallTasks: Task[];
  inTrashTasks: Task[];
  matchingTaskIds: Set<number>;
  allTags: string[];
  trashHitboxRef: React.MutableRefObject<HTMLElement | null>;
  trashHoopRef: React.MutableRefObject<HTMLElement | null>;
  trashBodyRef: React.MutableRefObject<HTMLElement | null>;
  trashDrawerBoxRef: React.MutableRefObject<HTMLElement | null>;
  noteDrag: NoteDragState | null;
  setNoteDrag: React.Dispatch<React.SetStateAction<NoteDragState | null>>;
}

const TaskContext = createContext<TaskContextValue | null>(null);

function hydrateInitialState(): TaskState {
  const storedTasks = loadTasksFromStorage();
  const baseTasks = storedTasks ?? SAMPLE_TASKS_FILE;
  const archive = loadArchiveFromStorage();
  const muted = loadMutedFromStorage();

  return createInitialState({
    wersja: baseTasks.wersja,
    tasks: baseTasks.zadania,
    archive,
    muted,
  });
}

export interface TaskProviderProps {
  children: React.ReactNode;
  initialSeed?: InitialStateSeed;
}

export function TaskProvider({ children, initialSeed }: TaskProviderProps) {
  const [state, dispatch] = useReducer(
    taskReducer,
    initialSeed,
    (seed) => (seed ? createInitialState(seed) : hydrateInitialState()),
  );

  const trashHitboxRef = useRef<HTMLElement | null>(null);
  const trashHoopRef = useRef<HTMLElement | null>(null);
  const trashBodyRef = useRef<HTMLElement | null>(null);
  const trashDrawerBoxRef = useRef<HTMLElement | null>(null);
  const [noteDrag, setNoteDrag] = useState<NoteDragState | null>(null);

  // Three isolated persistence effects — NEVER persist ephemeral UI or floorBalls state
  useEffect(() => {
    saveTasksToStorage(state.wersja, state.tasks);
  }, [state.wersja, state.tasks]);

  useEffect(() => {
    saveArchiveToStorage(state.archive);
  }, [state.archive]);

  useEffect(() => {
    saveMutedToStorage(state.muted);
  }, [state.muted]);

  const activeTasks = useMemo(() => selectActiveTasks(state.tasks), [state.tasks]);
  const completedTasks = useMemo(() => selectCompletedTasks(state.tasks), [state.tasks]);
  const floorBallIds = useMemo(() => selectFloorBallIds(state.floorBalls), [state.floorBalls]);
  const floorBallTasks = useMemo(
    () => selectFloorBallTasks(state.tasks, floorBallIds),
    [state.tasks, floorBallIds],
  );
  const inTrashTasks = useMemo(
    () => selectInTrashTasks(state.tasks, floorBallIds),
    [state.tasks, floorBallIds],
  );
  const matchingTaskIds = useMemo(
    () => selectMatchingTaskIds(activeTasks, state.filters),
    [activeTasks, state.filters],
  );
  const allTags = useMemo(
    () => selectAllTags(activeTasks, state.filters.selectedTags),
    [activeTasks, state.filters.selectedTags],
  );

  const value = useMemo<TaskContextValue>(
    () => ({
      state,
      dispatch,
      activeTasks,
      completedTasks,
      floorBallIds,
      floorBallTasks,
      inTrashTasks,
      matchingTaskIds,
      allTags,
      trashHitboxRef,
      trashHoopRef,
      trashBodyRef,
      trashDrawerBoxRef,
      noteDrag,
      setNoteDrag,
    }),
    [
      state,
      activeTasks,
      completedTasks,
      floorBallIds,
      floorBallTasks,
      inTrashTasks,
      matchingTaskIds,
      allTags,
      noteDrag,
    ],
  );

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTasks(): TaskContextValue {
  const ctx = useContext(TaskContext);
  if (ctx === null) {
    throw new Error('useTasks must be used within a TaskProvider');
  }
  return ctx;
}
