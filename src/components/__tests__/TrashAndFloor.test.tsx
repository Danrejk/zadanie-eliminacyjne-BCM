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
import { TrashModal } from '../TrashModal';
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
      <TrashModal />
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

    it('accepts direct HTML5 drop of an active task, dispatches COMPLETE_TO_TRASH, and plays plop sound', () => {
      const plopSpy = vi
        .spyOn(soundUtils, 'playTrashPlopSound')
        .mockImplementation(() => {});
      let latestCtx!: TaskContextValue;
      renderM4Harness({}, (ctx) => {
        latestCtx = ctx;
      });

      const hitbox = screen.getByTestId('trash-hitbox');
      const dataTransfer = {
        dropEffect: 'none',
        getData: (type: string) =>
          type === 'application/x-smartapp-task-id' ? '1' : '',
      };

      fireEvent.dragOver(hitbox, { dataTransfer });
      expect(screen.getByTestId('trash-can-widget')).toHaveAttribute(
        'data-enlarged',
        'true',
      );

      fireEvent.drop(hitbox, { dataTransfer });

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

  describe('TrashModal, EmptySummaryModal & ArchiveModal', () => {
    it('opens TrashModal, restores a task via context menu, and sweeps floor balls', () => {
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

      // Open TrashModal by clicking completed-count-bar
      fireEvent.click(screen.getByTestId('completed-count-bar'));
      const modal = screen.getByTestId('trash-modal');
      expect(modal).toBeInTheDocument();

      // Sweep floor balls into trash
      const sweepBtn = within(modal).getByTestId('btn-sweep-floor');
      expect(sweepBtn).not.toBeDisabled();
      fireEvent.click(sweepBtn);
      expect(plopSpy).toHaveBeenCalled();
      expect(latestCtx.floorBallTasks).toHaveLength(0);
      expect(within(modal).getByTestId('trash-ball-1')).toBeInTheDocument();

      // Click ball 2 to open trashBall context menu and restore it
      fireEvent.click(within(modal).getByTestId('trash-ball-2'));
      const menu = screen.getByTestId('context-menu');
      expect(menu).toHaveAttribute('data-kind', 'trashBall');

      fireEvent.click(within(menu).getByTestId('context-menu-restore'));
      expect(restoreSpy).toHaveBeenCalled();
      expect(
        latestCtx.activeTasks.some((t) => t.id === 2),
      ).toBe(true);
    });

    it('summarizes trash, confirms empty to archive, views ArchiveModal, and exports archiwum_usunietych.json', () => {
      const downloadSpy = vi
        .spyOn(jsonIO, 'downloadJsonFile')
        .mockImplementation(() => {});

      let latestCtx!: TaskContextValue;
      const existingArchive: ArchiveEntry[] = [];
      renderM4Harness({ archive: existingArchive }, (ctx) => {
        latestCtx = ctx;
      });

      // Open TrashModal -> EmptySummaryModal
      fireEvent.click(screen.getByTestId('trash-hitbox'));
      fireEvent.click(screen.getByTestId('btn-empty-trash'));

      const summaryModal = screen.getByTestId('empty-summary-modal');
      expect(summaryModal).toBeInTheDocument();
      expect(summaryModal).toHaveTextContent('2');
      expect(summaryModal).toHaveTextContent('#studia');
      expect(summaryModal).toHaveTextContent('Bez tagów');

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

    it('rejects non-numeric dragged task IDs like "1abc" on TrashCanWidget drop', () => {
      let latestCtx!: TaskContextValue;
      renderM4Harness({}, (ctx) => {
        latestCtx = ctx;
      });

      const hitbox = screen.getByTestId('trash-hitbox');
      const dataTransfer = {
        dropEffect: 'none',
        getData: (type: string) => (type === 'text/plain' ? '1abc' : ''),
      };

      fireEvent.drop(hitbox, { dataTransfer });
      expect(latestCtx.activeTasks.some((t) => t.id === 1)).toBe(true);
      expect(latestCtx.inTrashTasks.some((t) => t.id === 1)).toBe(false);
    });

    it('dismisses ONLY ContextMenu when clicking outside onto ContextMenu backdrop while TrashModal is open', () => {
      renderM4Harness();

      fireEvent.click(screen.getByTestId('trash-hitbox'));
      const trashModal = screen.getByTestId('trash-modal');
      expect(trashModal).toBeInTheDocument();

      fireEvent.contextMenu(within(trashModal).getByTestId('trash-ball-2'), {
        clientX: 300,
        clientY: 300,
      });
      expect(screen.getByTestId('context-menu')).toBeInTheDocument();

      // Clicking the ContextMenu backdrop closes ContextMenu without closing TrashModal
      fireEvent.click(screen.getByTestId('context-menu-backdrop'));
      expect(screen.queryByTestId('context-menu')).not.toBeInTheDocument();
      expect(screen.getByTestId('trash-modal')).toBeInTheDocument();
    });
  });
});
