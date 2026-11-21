import { useEffect } from 'react';
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from 'vitest';
import {
  render,
  screen,
  fireEvent,
  within,
  act,
} from '@testing-library/react';
import type { ArchiveEntry, Task } from '../../types/task';
import type { InitialStateSeed } from '../../context/taskReducer';
import {
  TaskProvider,
  useTasks,
  type TaskContextValue,
} from '../../context/TaskContext';
import {
  getTodayDateString,
  addDaysToDateString,
} from '../../utils/dateBuckets';
import * as soundUtils from '../../utils/sound';
import * as jsonIO from '../../utils/jsonIO';
import { TrashCanWidget } from '../TrashCanWidget';
import { FloorPhysicsLayer } from '../FloorPhysicsLayer';
import { TrashDrawer } from '../TrashDrawer';
import { NoteDragOverlay } from '../NoteDragOverlay';
import { PostItNote } from '../PostItNote';
import { EmptySummaryModal } from '../EmptySummaryModal';
import { ArchiveModal } from '../ArchiveModal';
import { ContextMenu } from '../ContextMenu';
import { Toast } from '../Toast';

function createSeedTasks(): Task[] {
  const today = getTodayDateString();
  return [
    {
      id: 1,
      tytul: 'Kolokwium z sieci komputerowych',
      opis: 'Rozdziały 3-5',
      termin: today,
      priorytet: 'wysoki',
      wykonane: false,
      tagi: ['studia', 'egzamin'],
    },
    {
      id: 2,
      tytul: 'Oddać projekt z baz danych',
      opis: 'Diagram ERD',
      termin: addDaysToDateString(today, 2),
      priorytet: 'sredni',
      wykonane: true,
      tagi: ['studia'],
    },
    {
      id: 3,
      tytul: 'Kupić zeszyt w kratkę',
      opis: '',
      termin: null,
      priorytet: 'niski',
      wykonane: true,
      tagi: [],
    },
  ];
}

function ContextObserver({
  onContext,
}: {
  onContext: (ctx: TaskContextValue) => void;
}) {
  const ctx = useTasks();
  useEffect(() => {
    onContext(ctx);
  });
  return null;
}

function renderM4Harness(
  seedOverrides: Partial<InitialStateSeed> = {},
  onContext?: (ctx: TaskContextValue) => void,
) {
  const seed: InitialStateSeed = {
    wersja: 1,
    tasks: createSeedTasks(),
    archive: [],
    muted: false,
    ...seedOverrides,
  };

  return render(
    <TaskProvider initialSeed={seed}>
      {onContext && <ContextObserver onContext={onContext} />}
      <TrashCanWidget />
      <FloorPhysicsLayer />
      <TrashDrawer />
      <EmptySummaryModal />
      <ArchiveModal />
      <ContextMenu />
      <Toast />
    </TaskProvider>,
  );
}

describe('Milestone M4 — TrashCanWidget, FloorPhysicsLayer & Archive Modals', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('TrashCanWidget', () => {
    it('renders completed-count-bar with ONLY "Ukończone: <N>"', () => {
      renderM4Harness();
      const bar = screen.getByTestId('completed-count-bar');
      expect(bar).toHaveTextContent(/^Ukończone:\s*2$/);
    });

    it('toggles data-enlarged when draggingFloorBallId or ballInFlight is set', () => {
      let latestCtx!: TaskContextValue;
      renderM4Harness({}, (ctx) => {
        latestCtx = ctx;
      });

      const widget = screen.getByTestId('trash-can-widget');
      expect(widget).toHaveAttribute('data-enlarged', 'false');

      act(() => {
        latestCtx.dispatch({
          type: 'SET_DRAGGING_FLOOR_BALL',
          payload: { id: 2 },
        });
      });
      expect(widget).toHaveAttribute('data-enlarged', 'true');

      act(() => {
        latestCtx.dispatch({
          type: 'SET_DRAGGING_FLOOR_BALL',
          payload: { id: null },
        });
      });
      expect(widget).toHaveAttribute('data-enlarged', 'false');

      act(() => {
        latestCtx.dispatch({
          type: 'SET_BALL_IN_FLIGHT',
          payload: { inFlight: true },
        });
      });
      expect(widget).toHaveAttribute('data-enlarged', 'true');
    });

    it('morphs dragged unfinished note into a crumpled ball over TrashCanWidget and completes only on drop', () => {
      const plopSpy = vi
        .spyOn(soundUtils, 'playTrashPlopSound')
        .mockImplementation(() => {});
      let latestCtx!: TaskContextValue;
      const seed: InitialStateSeed = {
        wersja: 1,
        tasks: createSeedTasks(),
        archive: [],
        muted: false,
      };

      function Wrapper() {
        const ctx = useTasks();
        latestCtx = ctx;
        const task1 = ctx.activeTasks.find((t) => t.id === 1);
        return (
          <>
            {task1 && (
              <PostItNote
                task={task1}
                zone="todayTomorrow"
                isDimmed={false}
                isDragging={ctx.state.draggingNoteId === 1}
                isModalOpen={false}
                muted={false}
                dispatch={ctx.dispatch}
              />
            )}
            <TrashCanWidget />
            <NoteDragOverlay />
          </>
        );
      }

      render(
        <TaskProvider initialSeed={seed}>
          <Wrapper />
        </TaskProvider>,
      );

      const hitbox = screen.getByTestId('trash-hitbox');
      vi.spyOn(hitbox, 'getBoundingClientRect').mockReturnValue({
        left: 900,
        top: 600,
        right: 996,
        bottom: 696,
        width: 96,
        height: 96,
        x: 900,
        y: 600,
        toJSON: () => ({}),
      });

      const note1 = screen.getByTestId('postit-note-1');
      fireEvent.pointerDown(note1, { button: 0, clientX: 100, clientY: 100 });
      fireEvent.pointerMove(window, { clientX: 200, clientY: 200 });
      expect(screen.getByTestId('drag-note-card-preview')).toBeInTheDocument();

      // Hover over trashcan -> morphs into crumpled ball without completing task yet
      fireEvent.pointerMove(window, { clientX: 940, clientY: 640 });
      expect(screen.getByTestId('drag-note-crumpled-preview')).toBeInTheDocument();
      expect(screen.getByTestId('trash-can-widget')).toHaveAttribute(
        'data-enlarged',
        'true',
      );
      expect(latestCtx.activeTasks.some((t) => t.id === 1)).toBe(true);

      // Release over trashcan -> completes to trash
      fireEvent.pointerUp(window, { clientX: 940, clientY: 640 });
      expect(plopSpy).toHaveBeenCalledWith(false);
      expect(screen.getByTestId('completed-count-bar')).toHaveTextContent(
        /^Ukończone:\s*3$/,
      );
      expect(latestCtx.inTrashTasks.map((t) => t.id)).toContain(1);
    });
  });

  describe('FloorPhysicsLayer', () => {
    it('renders floor balls, shows hover tooltip, and opens floorBall context menu on right-click', () => {
      let latestCtx!: TaskContextValue;
      renderM4Harness({}, (ctx) => {
        latestCtx = ctx;
      });

      act(() => {
        latestCtx.dispatch({
          type: 'COMPLETE_TO_FLOOR',
          payload: { id: 1, originX: 200, originY: 180 },
        });
      });

      const ballEl = screen.getByTestId('floor-ball-1');
      expect(ballEl).toBeInTheDocument();

      // Hover shows tooltip
      fireEvent.pointerEnter(ballEl);
      const tooltip = screen.getByTestId('floor-ball-tooltip-1');
      expect(tooltip).toHaveTextContent('Kolokwium z sieci komputerowych');

      fireEvent.pointerLeave(ballEl);
      expect(
        screen.queryByTestId('floor-ball-tooltip-1'),
      ).not.toBeInTheDocument();

      // Right-click opens floorBall context menu
      fireEvent.contextMenu(ballEl, { clientX: 250, clientY: 300 });
      const menu = screen.getByTestId('context-menu');
      expect(menu).toHaveAttribute('data-kind', 'floorBall');
    });

    it('keeps TrashCanWidget enlarged via SET_BALL_IN_FLIGHT sync when a second ball remains airborne after first ball drops', () => {
      vi.useFakeTimers();
      let nowMs = 1000;
      vi.spyOn(performance, 'now').mockImplementation(() => nowMs);

      let nextRafId = 1;
      const rafMap = new Map<number, FrameRequestCallback>();
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        const id = nextRafId++;
        rafMap.set(id, cb);
        return id;
      });
      vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
        rafMap.delete(id);
      });

      const flushNextFrame = () => {
        const entries = Array.from(rafMap.entries());
        rafMap.clear();
        for (const [, cb] of entries) {
          cb(nowMs);
        }
      };

      let latestCtx!: TaskContextValue;
      const twoActiveTasks = createSeedTasks().map((t) =>
        t.id === 2 ? { ...t, wykonane: false } : t,
      );
      renderM4Harness({ tasks: twoActiveTasks }, (ctx) => {
        latestCtx = ctx;
      });

      // Mock trash hitbox rect in bottom-right corner
      const hitbox = screen.getByTestId('trash-hitbox');
      vi.spyOn(hitbox, 'getBoundingClientRect').mockReturnValue({
        left: 880,
        top: 640,
        right: 980,
        bottom: 740,
        width: 100,
        height: 100,
        x: 880,
        y: 640,
        toJSON: () => ({}),
      } as DOMRect);

      // Spawn two tasks onto the floor
      act(() => {
        latestCtx.dispatch({
          type: 'COMPLETE_TO_FLOOR',
          payload: { id: 1, originX: 200, originY: 200 },
        });
        latestCtx.dispatch({
          type: 'COMPLETE_TO_FLOOR',
          payload: { id: 2, originX: 400, originY: 200 },
        });
      });

      const ball2 = screen.getByTestId('floor-ball-2');
      // Grab and throw ball 2 so it stays airborne (canScoreTrash = true)
      fireEvent.pointerDown(ball2, { button: 0, clientX: 300, clientY: 200 });
      nowMs += 30;
      fireEvent.pointerMove(ball2, { clientX: 360, clientY: 180 });
      fireEvent.pointerUp(ball2, { button: 0, clientX: 360, clientY: 180 });

      expect(latestCtx.state.ballInFlight).toBe(true);
      expect(screen.getByTestId('trash-can-widget')).toHaveAttribute(
        'data-enlarged',
        'true',
      );

      // Drop ball 1 directly into trash (which sets ballInFlight: false in reducer!)
      const ball1 = screen.getByTestId('floor-ball-1');
      fireEvent.pointerDown(ball1, { button: 0, clientX: 900, clientY: 680 });
      fireEvent.pointerUp(ball1, { button: 0, clientX: 900, clientY: 680 });

      // Advance time past TRASH_ENTER_DURATION_MS (200ms) and run rAF ticks
      act(() => {
        nowMs += 250;
        flushNextFrame();
      });

      // Even after DROP_BALL_INTO_TRASH for ball 1, ball 2 is still airborne so
      // FloorPhysicsLayer must re-sync SET_BALL_IN_FLIGHT = true!
      act(() => {
        nowMs += 16;
        flushNextFrame();
      });

      expect(latestCtx.state.floorBalls.map((b) => b.taskId)).toEqual([2]);
      expect(latestCtx.state.ballInFlight).toBe(true);
      expect(screen.getByTestId('trash-can-widget')).toHaveAttribute(
        'data-enlarged',
        'true',
      );
    });
  });

  describe('TrashDrawer, EmptySummaryModal & ArchiveModal', () => {
    it('opens TrashDrawer, restores a task via context menu, sweeps floor balls, and spills all balls back out', () => {
      const restoreSpy = vi
        .spyOn(soundUtils, 'playRestoreSound')
        .mockImplementation(() => {});
      const plopSpy = vi
        .spyOn(soundUtils, 'playTrashPlopSound')
        .mockImplementation(() => {});

      let latestCtx!: TaskContextValue;
      renderM4Harness({}, (ctx) => {
        latestCtx = ctx;
      });

      // Put task 1 on the floor
      act(() => {
        latestCtx.dispatch({
          type: 'COMPLETE_TO_FLOOR',
          payload: { id: 1, originX: 150, originY: 150 },
        });
      });

      // Open TrashDrawer by clicking completed-count-bar
      fireEvent.click(screen.getByTestId('completed-count-bar'));
      const drawer = screen.getByTestId('trash-drawer');
      expect(drawer).toBeInTheDocument();

      // Sweep floor balls into trash
      const sweepBtn = within(drawer).getByTestId('btn-sweep-floor');
      expect(sweepBtn).not.toBeDisabled();
      fireEvent.click(sweepBtn);
      expect(plopSpy).toHaveBeenCalled();
      expect(latestCtx.floorBallTasks).toHaveLength(0);
      expect(within(drawer).getByTestId('trash-ball-1')).toBeInTheDocument();

      // Click ball 2 to open trashBall context menu and restore it
      fireEvent.click(within(drawer).getByTestId('trash-ball-2'));
      const menu = screen.getByTestId('context-menu');
      expect(menu).toHaveAttribute('data-kind', 'trashBall');

      fireEvent.click(within(menu).getByTestId('context-menu-restore'));
      expect(restoreSpy).toHaveBeenCalled();
      expect(
        latestCtx.activeTasks.some((t) => t.id === 2),
      ).toBe(true);

      // Take everything out puts remaining trashed balls (1 and 3) onto the floor
      fireEvent.click(within(drawer).getByTestId('btn-take-all-out'));
      expect(latestCtx.inTrashTasks).toHaveLength(0);
      expect(latestCtx.floorBallTasks).toHaveLength(2);
      expect(latestCtx.floorBallTasks.every((t) => t.wykonane)).toBe(true);

      // Close drawer via bottom physical drawer button
      fireEvent.click(within(drawer).getByTestId('btn-close-trash-drawer'));
      expect(latestCtx.state.trashDrawerOpen).toBe(false);
    });

    it('summarizes trash, confirms empty to archive, views ArchiveModal, and exports archiwum_usunietych.json', () => {
      const downloadSpy = vi
        .spyOn(jsonIO, 'downloadJsonFile')
        .mockImplementation(() => {});

      let latestCtx!: TaskContextValue;
      const existingArchive: ArchiveEntry[] = [];
      const today = getTodayDateString();
      const seedTasks: Task[] = [
        {
          id: 1,
          tytul: 'Aktywne zadanie',
          opis: '',
          termin: today,
          priorytet: 'wysoki',
          wykonane: false,
          tagi: [],
        },
        {
          id: 2,
          tytul: 'Zadanie po terminie',
          opis: '',
          termin: addDaysToDateString(today, -1),
          priorytet: 'sredni',
          wykonane: true,
          tagi: ['studia'],
        },
        {
          id: 3,
          tytul: 'Zadanie bez terminu',
          opis: '',
          termin: null,
          priorytet: 'niski',
          wykonane: true,
          tagi: [],
        },
      ];
      renderM4Harness({ tasks: seedTasks, archive: existingArchive }, (ctx) => {
        latestCtx = ctx;
      });

      // Open TrashModal -> EmptySummaryModal
      fireEvent.click(screen.getByTestId('trash-hitbox'));
      fireEvent.click(screen.getByTestId('btn-empty-trash'));

      const summaryModal = screen.getByTestId('empty-summary-modal');
      expect(summaryModal).toBeInTheDocument();
      expect(summaryModal).toHaveTextContent('2');
      expect(summaryModal).toHaveTextContent('Na czas');
      expect(summaryModal).toHaveTextContent('Po terminie');
      expect(within(summaryModal).getByTestId('summary-on-time')).toHaveTextContent('1');
      expect(within(summaryModal).getByTestId('summary-after-deadline')).toHaveTextContent('1');

      // Confirm empty
      fireEvent.click(screen.getByTestId('btn-confirm-empty-trash'));
      expect(
        screen.queryByTestId('empty-summary-modal'),
      ).not.toBeInTheDocument();
      expect(latestCtx.completedTasks).toHaveLength(0);
      expect(latestCtx.state.archive).toHaveLength(2);
      expect(screen.getByTestId('toast-notification')).toHaveTextContent(
        'Zarchiwizowano 2 ukończonych zadań.',
      );

      // Open ArchiveModal and export JSON
      act(() => {
        latestCtx.dispatch({ type: 'OPEN_MODAL', payload: { type: 'archive' } });
      });

      const archiveModal = screen.getByTestId('archive-modal');
      expect(archiveModal).toBeInTheDocument();
      expect(screen.getByTestId('archive-entry-0')).toBeInTheDocument();
      expect(screen.getByTestId('archive-entry-1')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('btn-export-archive'));
      expect(downloadSpy).toHaveBeenCalledWith(
        'archiwum_usunietych.json',
        expect.stringContaining('"archiwum"'),
      );
    });

    it('supports per-task permanent delete ("Czy na pewno?") and clear-all ("Czy na pewno chcesz wszystko usunąć?") in ArchiveModal', () => {
      let latestCtx!: TaskContextValue;
      const existingArchive: ArchiveEntry[] = [
        {
          task: {
            id: 10,
            tytul: 'Pierwsze archiwalne',
            opis: '',
            termin: null,
            priorytet: 'niski',
            wykonane: true,
            tagi: [],
          },
          oproznionoDnia: '2026-11-18T10:00:00.000Z',
        },
        {
          task: {
            id: 11,
            tytul: 'Drugie archiwalne',
            opis: '',
            termin: null,
            priorytet: 'sredni',
            wykonane: true,
            tagi: [],
          },
          oproznionoDnia: '2026-11-19T10:00:00.000Z',
        },
        {
          task: {
            id: 12,
            tytul: 'Trzecie archiwalne',
            opis: '',
            termin: null,
            priorytet: 'wysoki',
            wykonane: true,
            tagi: [],
          },
          oproznionoDnia: '2026-11-20T10:00:00.000Z',
        },
      ];

      renderM4Harness({ tasks: [], archive: existingArchive }, (ctx) => {
        latestCtx = ctx;
      });

      act(() => {
        latestCtx.dispatch({ type: 'OPEN_MODAL', payload: { type: 'archive' } });
      });

      const archiveModal = screen.getByTestId('archive-modal');
      expect(archiveModal).toBeInTheDocument();

      // Entries are displayed in reverse chronological order: index 0 is id 12 ("Trzecie archiwalne")
      fireEvent.click(screen.getByTestId('btn-delete-archive-entry-0'));
      const entryConfirm = screen.getByTestId('confirm-delete-archive-entry-0');
      expect(entryConfirm).toHaveTextContent('Czy na pewno?');

      // Cancel single delete -> entry remains
      fireEvent.click(screen.getByTestId('btn-cancel-delete-archive-entry-0'));
      expect(screen.queryByTestId('confirm-delete-archive-entry-0')).not.toBeInTheDocument();
      expect(latestCtx.state.archive).toHaveLength(3);

      // Click delete again and confirm "Tak" -> permanently removes id 12
      fireEvent.click(screen.getByTestId('btn-delete-archive-entry-0'));
      fireEvent.click(screen.getByTestId('btn-confirm-delete-archive-entry-0'));
      expect(latestCtx.state.archive.map((e) => e.task.id)).toEqual([10, 11]);
      expect(screen.queryByText('Trzecie archiwalne')).not.toBeInTheDocument();

      // Click "Usuń wszystko" -> shows "Czy na pewno chcesz wszystko usunąć?"
      fireEvent.click(screen.getByTestId('btn-clear-archive'));
      const clearConfirm = screen.getByTestId('confirm-clear-archive');
      expect(clearConfirm).toHaveTextContent('Czy na pewno chcesz wszystko usunąć?');

      // Cancel clear-all -> remaining 2 entries still there
      fireEvent.click(screen.getByTestId('btn-cancel-clear-archive'));
      expect(screen.queryByTestId('confirm-clear-archive')).not.toBeInTheDocument();
      expect(latestCtx.state.archive).toHaveLength(2);

      // Click "Usuń wszystko" again and confirm -> empties archive
      fireEvent.click(screen.getByTestId('btn-clear-archive'));
      fireEvent.click(screen.getByTestId('btn-confirm-clear-archive'));
      expect(latestCtx.state.archive).toEqual([]);
      expect(screen.getByText('Archiwum jest puste')).toBeInTheDocument();
      expect(screen.getByTestId('btn-clear-archive')).toBeDisabled();
    });
  });

  describe('Tier 5 Adversarial Hardening', () => {
    it('keeps floor-ball tooltip upright (no rotate in ancestor transform) while inner ball wrapper rotates', () => {
      let latestCtx!: TaskContextValue;
      renderM4Harness({}, (ctx) => {
        latestCtx = ctx;
      });

      // Task 1 has rotation = (1 * 47) % 360 = 47deg
      act(() => {
        latestCtx.dispatch({
          type: 'COMPLETE_TO_FLOOR',
          payload: { id: 1, originX: 200, originY: 180 },
        });
      });

      const ballEl = screen.getByTestId('floor-ball-1');
      expect(ballEl.style.transform).not.toContain('rotate(');

      fireEvent.pointerEnter(ballEl);
      const tooltip = screen.getByTestId('floor-ball-tooltip-1');
      expect(tooltip).toBeInTheDocument();

      // Walk ancestor chain up to floor-physics-layer and verify no rotate(...) transform
      let curr: HTMLElement | null = tooltip;
      while (curr && curr.dataset.testid !== 'floor-physics-layer') {
        expect(curr.style.transform).not.toContain('rotate(');
        curr = curr.parentElement;
      }

      // Inner wrapper around CrumpledBall carries the rotation
      const innerWrapper = ballEl.firstElementChild as HTMLElement;
      expect(innerWrapper.style.transform).toContain('rotate(47deg)');
    });

    it('resets draggingFloorBallId and data-enlarged on window blur and pointercancel', () => {
      let latestCtx!: TaskContextValue;
      renderM4Harness({}, (ctx) => {
        latestCtx = ctx;
      });

      act(() => {
        latestCtx.dispatch({
          type: 'COMPLETE_TO_FLOOR',
          payload: { id: 1, originX: 200, originY: 180 },
        });
      });

      const ballEl = screen.getByTestId('floor-ball-1');
      const widget = screen.getByTestId('trash-can-widget');

      // 1. Grab ball -> window.blur cancels drag cleanly
      fireEvent.pointerDown(ballEl, { button: 0, pointerId: 1, clientX: 200, clientY: 180 });
      expect(latestCtx.state.draggingFloorBallId).toBe(1);
      expect(widget).toHaveAttribute('data-enlarged', 'true');

      act(() => {
        window.dispatchEvent(new Event('blur'));
      });
      expect(latestCtx.state.draggingFloorBallId).toBeNull();
      expect(widget).toHaveAttribute('data-enlarged', 'false');

      // 2. Grab ball again -> pointercancel cancels without throwing
      fireEvent.pointerDown(ballEl, { button: 0, pointerId: 2, clientX: 200, clientY: 180 });
      fireEvent.pointerMove(ballEl, { pointerId: 2, clientX: 600, clientY: 50 });
      expect(latestCtx.state.draggingFloorBallId).toBe(1);

      fireEvent.pointerCancel(ballEl, { pointerId: 2 });
      expect(latestCtx.state.draggingFloorBallId).toBeNull();
      expect(latestCtx.state.ballInFlight).toBe(false);
      expect(widget).toHaveAttribute('data-enlarged', 'false');
    });

    it('ignores pointerdown on a ball that is already enteringTrash', () => {
      vi.useFakeTimers();
      let nowMs = 1000;
      vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
      const plopSpy = vi
        .spyOn(soundUtils, 'playTrashPlopSound')
        .mockImplementation(() => {});

      let latestCtx!: TaskContextValue;
      renderM4Harness({}, (ctx) => {
        latestCtx = ctx;
      });

      act(() => {
        latestCtx.dispatch({
          type: 'COMPLETE_TO_FLOOR',
          payload: { id: 1, originX: 200, originY: 180 },
        });
      });

      const hitbox = screen.getByTestId('trash-hitbox');
      vi.spyOn(hitbox, 'getBoundingClientRect').mockReturnValue({
        left: 900,
        top: 600,
        right: 1000,
        bottom: 700,
        width: 100,
        height: 100,
        x: 900,
        y: 600,
        toJSON: () => ({}),
      });

      const ballEl = screen.getByTestId('floor-ball-1');
      // Drop ball directly onto trash hitbox -> enters enteringTrash state
      fireEvent.pointerDown(ballEl, { button: 0, pointerId: 1, clientX: 950, clientY: 650 });
      fireEvent.pointerUp(ballEl, { button: 0, pointerId: 1, clientX: 950, clientY: 650 });
      expect(plopSpy).toHaveBeenCalledTimes(1);
      expect(latestCtx.state.draggingFloorBallId).toBeNull();

      // Re-grabbing during 200ms plop animation must be ignored
      nowMs = 1050;
      fireEvent.pointerDown(ballEl, { button: 0, pointerId: 2, clientX: 950, clientY: 650 });
      expect(latestCtx.state.draggingFloorBallId).toBeNull();
      fireEvent.pointerUp(ballEl, { button: 0, pointerId: 2, clientX: 950, clientY: 650 });
      expect(plopSpy).toHaveBeenCalledTimes(1);
    });

    it('shows hover visual feedback on TrashCanWidget when hovered', () => {
      renderM4Harness();

      const widget = screen.getByTestId('trash-can-widget');
      const hitbox = screen.getByTestId('trash-hitbox');
      expect(widget).toHaveAttribute('data-hovered', 'false');

      fireEvent.mouseEnter(hitbox);
      expect(widget).toHaveAttribute('data-hovered', 'true');

      fireEvent.mouseLeave(hitbox);
      expect(widget).toHaveAttribute('data-hovered', 'false');
    });

    it('dismisses ONLY ContextMenu when clicking outside onto ContextMenu backdrop while TrashDrawer is open', () => {
      renderM4Harness();

      fireEvent.click(screen.getByTestId('trash-hitbox'));
      const trashDrawer = screen.getByTestId('trash-drawer');
      expect(trashDrawer).toBeInTheDocument();

      fireEvent.contextMenu(within(trashDrawer).getByTestId('trash-ball-2'), {
        clientX: 300,
        clientY: 300,
      });
      expect(screen.getByTestId('context-menu')).toBeInTheDocument();

      // Clicking the ContextMenu backdrop closes ContextMenu without closing TrashDrawer
      fireEvent.click(screen.getByTestId('context-menu-backdrop'));
      expect(screen.queryByTestId('context-menu')).not.toBeInTheDocument();
      expect(screen.getByTestId('trash-drawer')).toBeInTheDocument();
    });

    it('plays bounce sound when a crumpled ball bounces off the floor', () => {
      vi.useFakeTimers();
      let nowMs = 1000;
      vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
      const bounceSpy = vi
        .spyOn(soundUtils, 'playBallBounceSound')
        .mockImplementation(() => {});

      const rafQueue: FrameRequestCallback[] = [];
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        rafQueue.push(cb);
        return rafQueue.length;
      });
      vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

      let latestCtx!: TaskContextValue;
      renderM4Harness({}, (ctx) => {
        latestCtx = ctx;
      });

      act(() => {
        latestCtx.dispatch({
          type: 'COMPLETE_TO_FLOOR',
          payload: { id: 1, originX: 300, originY: 120 },
        });
      });

      // Step RAF frames until the ball hits the floor and bounces
      for (let i = 0; i < 60; i++) {
        const cb = rafQueue.shift();
        if (!cb) break;
        nowMs += 16;
        act(() => {
          cb(nowMs);
        });
      }

      expect(bounceSpy).toHaveBeenCalled();
      expect(bounceSpy.mock.calls[0][0]).toBe(false);
      expect(bounceSpy.mock.calls[0][1]).toBeGreaterThan(0);
    });

    it('plays drawer slide sound when opening and closing the trash drawer', () => {
      const slideSpy = vi
        .spyOn(soundUtils, 'playDrawerSlideSound')
        .mockImplementation(() => {});

      renderM4Harness();

      fireEvent.click(screen.getByTestId('trash-hitbox'));
      expect(slideSpy).toHaveBeenCalledWith(false, true);

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(slideSpy).toHaveBeenCalledWith(false, false);
    });

    it('catches a single floor ball when holding LMB and sweeping over it, without catching a second ball', () => {
      let latestCtx!: TaskContextValue;
      const twoActiveTasks = createSeedTasks().map((t) =>
        t.id === 2 ? { ...t, wykonane: false } : t,
      );
      renderM4Harness({ tasks: twoActiveTasks }, (ctx) => {
        latestCtx = ctx;
      });

      act(() => {
        latestCtx.dispatch({
          type: 'COMPLETE_TO_FLOOR',
          payload: { id: 1, originX: 200, originY: 200 },
        });
        latestCtx.dispatch({
          type: 'COMPLETE_TO_FLOOR',
          payload: { id: 2, originX: 400, originY: 200 },
        });
      });

      // Press LMB on empty space away from both balls
      fireEvent.pointerDown(document.body, {
        button: 0,
        pointerId: 10,
        clientX: 50,
        clientY: 50,
      });
      expect(latestCtx.state.draggingFloorBallId).toBeNull();

      // Sweep across ball 1 -> catches ball 1
      fireEvent.pointerMove(window, {
        pointerId: 10,
        clientX: 200,
        clientY: 200,
      });
      expect(latestCtx.state.draggingFloorBallId).toBe(1);

      // Continue sweeping across ball 2 -> still only holding ball 1 (never switches/adds ball 2)
      fireEvent.pointerMove(window, {
        pointerId: 10,
        clientX: 400,
        clientY: 200,
      });
      expect(latestCtx.state.draggingFloorBallId).toBe(1);

      // Release LMB -> releases ball 1
      fireEvent.pointerUp(window, {
        button: 0,
        pointerId: 10,
        clientX: 400,
        clientY: 200,
      });
      expect(latestCtx.state.draggingFloorBallId).toBeNull();
    });

    it('does not sweep-catch a floor ball when pointerdown started on a PostItNote', () => {
      let latestCtx!: TaskContextValue;
      const twoActiveTasks = createSeedTasks().map((t) =>
        t.id === 2 ? { ...t, wykonane: false } : t,
      );
      const seed: InitialStateSeed = {
        wersja: 1,
        tasks: twoActiveTasks,
        archive: [],
        muted: false,
      };

      function Wrapper() {
        const ctx = useTasks();
        latestCtx = ctx;
        const task2 = ctx.activeTasks.find((t) => t.id === 2);
        return (
          <>
            {task2 && (
              <PostItNote
                task={task2}
                zone="todayTomorrow"
                isDimmed={false}
                isDragging={ctx.state.draggingNoteId === 2}
                isModalOpen={false}
                muted={false}
                dispatch={ctx.dispatch}
              />
            )}
            <TrashCanWidget />
            <FloorPhysicsLayer />
          </>
        );
      }

      render(
        <TaskProvider initialSeed={seed}>
          <Wrapper />
        </TaskProvider>,
      );

      act(() => {
        latestCtx.dispatch({
          type: 'COMPLETE_TO_FLOOR',
          payload: { id: 1, originX: 300, originY: 300 },
        });
      });

      const note2 = screen.getByTestId('postit-note-2');
      fireEvent.pointerDown(note2, { button: 0, pointerId: 11, clientX: 100, clientY: 100 });
      fireEvent.pointerMove(window, { pointerId: 11, clientX: 300, clientY: 300 });
      expect(latestCtx.state.draggingFloorBallId).toBeNull();

      fireEvent.pointerUp(window, { button: 0, pointerId: 11, clientX: 300, clientY: 300 });
    });

    it('catches a floor ball when LMB hold starts over the open side TrashDrawer', () => {
      let latestCtx!: TaskContextValue;
      renderM4Harness({}, (ctx) => {
        latestCtx = ctx;
      });

      act(() => {
        latestCtx.dispatch({
          type: 'COMPLETE_TO_FLOOR',
          payload: { id: 1, originX: 300, originY: 300 },
        });
      });

      fireEvent.click(screen.getByTestId('trash-hitbox'));
      const drawer = screen.getByTestId('trash-drawer');

      fireEvent.pointerDown(drawer, { button: 0, pointerId: 12, clientX: 900, clientY: 200 });
      fireEvent.pointerMove(window, { pointerId: 12, clientX: 300, clientY: 300 });
      expect(latestCtx.state.draggingFloorBallId).toBe(1);

      fireEvent.pointerUp(window, { button: 0, pointerId: 12, clientX: 300, clientY: 300 });
      expect(latestCtx.state.draggingFloorBallId).toBeNull();
    });
  });
});
