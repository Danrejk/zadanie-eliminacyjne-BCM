import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TaskProvider,
  useTasks,
  type TaskContextValue,
} from '../../context/TaskContext';
import { PRIORITIES, TIME_ZONES, type Task } from '../../types/task';
import * as soundUtils from '../../utils/sound';
import { getNoteRotation, getTagColor } from '../../utils/tagColors';
import { Corkboard } from '../Corkboard';
import { CLICK_DELAY_MS, DRAG_END_RESET_MS } from '../PostItNote';
import { computePinLeftPercent } from '../PushPin';

const TODAY = '2026-11-19';

function renderCorkboard(seedTasks?: Task[], todayStr = TODAY) {
  let latestCtx!: TaskContextValue;

  function ContextProbe() {
    latestCtx = useTasks();
    return null;
  }

  const utils = render(
    <TaskProvider
      initialSeed={seedTasks ? { wersja: 1, tasks: seedTasks } : undefined}
    >
      <ContextProbe />
      <Corkboard todayStr={todayStr} />
    </TaskProvider>,
  );

  return {
    ...utils,
    get ctx() {
      return latestCtx;
    },
  };
}

function createMockDataTransfer(
  initial: Record<string, string> = {},
  types?: string[],
) {
  const store: Record<string, string> = { ...initial };
  return {
    data: store,
    types: types ?? Object.keys(store),
    effectAllowed: 'all',
    dropEffect: 'move',
    setData: vi.fn((type: string, val: string) => {
      store[type] = String(val);
    }),
    getData: vi.fn((type: string) => store[type] ?? ''),
    clearData: vi.fn(),
  };
}

function dragNoteToCell(noteEl: HTMLElement, targetCellEl: HTMLElement) {
  const dataTransfer = createMockDataTransfer();
  fireEvent.dragStart(noteEl, { dataTransfer });
  fireEvent.dragEnter(targetCellEl, { dataTransfer });
  fireEvent.dragOver(targetCellEl, { dataTransfer });
  fireEvent.drop(targetCellEl, { dataTransfer });
  fireEvent.dragEnd(noteEl, { dataTransfer });
  return dataTransfer;
}

describe('Milestone M2 — Corkboard 3x5, PostItNote & PushPin', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('1. 3x5 Matrix Architecture & Sample Dataset Placement', () => {
    it('renders root corkboard, 3 priority rows TOP->BOTTOM, 5 time-zone columns LEFT->RIGHT, and all 15 zone cells in row-major order', () => {
      renderCorkboard();

      const board = screen.getByTestId('corkboard');
      expect(board).toBeInTheDocument();

      // Verify Polish row labels exist in TOP -> BOTTOM order
      const highHeader = screen.getByText('Wysoki');
      const medHeader = screen.getByText('Średni');
      const lowHeader = screen.getByText('Niski');
      expect(
        highHeader.compareDocumentPosition(medHeader) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        medHeader.compareDocumentPosition(lowHeader) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();

      // Verify Polish column headers exist in LEFT -> RIGHT order
      const colLabels = [
        'Po terminie',
        'Dziś i jutro',
        'Ten tydzień',
        'Później',
        'Bez terminu',
      ];
      const colNodes = colLabels.map((label) => screen.getAllByText(label)[0]);
      for (let i = 0; i < colNodes.length - 1; i++) {
        expect(
          colNodes[i].compareDocumentPosition(colNodes[i + 1]) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      }

      // Verify all 15 drop-zone cells exist in exact row-major DOM order
      const allCells = board.querySelectorAll('[data-testid^="zone-cell-"]');
      expect(allCells).toHaveLength(15);

      const expectedCellIds: string[] = [];
      for (const priority of PRIORITIES) {
        for (const zone of TIME_ZONES) {
          expectedCellIds.push(`zone-cell-${priority}-${zone}`);
        }
      }

      expect(
        Array.from(allCells).map((el) => el.getAttribute('data-testid')),
      ).toEqual(expectedCellIds);
    });

    it('populates all 15 cells from default 20-task sampleTasks.json (16 active placed accurately, 4 completed excluded)', () => {
      renderCorkboard();

      // Expected mapping of the 16 active sample tasks at todayStr = 2026-11-19
      const expectedPlacements: Array<{
        id: number;
        priority: 'wysoki' | 'sredni' | 'niski';
        zone: 'overdue' | 'todayTomorrow' | 'thisWeek' | 'later' | 'noDeadline';
      }> = [
        { id: 1, priority: 'wysoki', zone: 'overdue' },
        { id: 2, priority: 'sredni', zone: 'overdue' },
        { id: 3, priority: 'niski', zone: 'overdue' },
        { id: 4, priority: 'wysoki', zone: 'todayTomorrow' },
        { id: 5, priority: 'wysoki', zone: 'todayTomorrow' },
        { id: 6, priority: 'sredni', zone: 'todayTomorrow' },
        { id: 7, priority: 'niski', zone: 'todayTomorrow' },
        { id: 8, priority: 'wysoki', zone: 'thisWeek' },
        { id: 9, priority: 'sredni', zone: 'thisWeek' },
        { id: 10, priority: 'niski', zone: 'thisWeek' },
        { id: 11, priority: 'wysoki', zone: 'later' },
        { id: 12, priority: 'sredni', zone: 'later' },
        { id: 13, priority: 'niski', zone: 'later' },
        { id: 14, priority: 'wysoki', zone: 'noDeadline' },
        { id: 15, priority: 'sredni', zone: 'noDeadline' },
        { id: 16, priority: 'niski', zone: 'noDeadline' },
      ];

      for (const { id, priority, zone } of expectedPlacements) {
        const cell = screen.getByTestId(`zone-cell-${priority}-${zone}`);
        const note = within(cell).getByTestId(`postit-note-${id}`);
        expect(note).toHaveAttribute('data-priority', priority);
        expect(note).toHaveAttribute('data-zone', zone);
        expect(note).toHaveAttribute('data-dimmed', 'false');
        expect(note).toHaveAttribute('draggable', 'true');
      }

      // 4 completed tasks (#17..#20) must NOT appear on the corkboard
      for (const completedId of [17, 18, 19, 20]) {
        expect(
          screen.queryByTestId(`postit-note-${completedId}`),
        ).not.toBeInTheDocument();
      }
    });

    it('sorts multiple tasks within the same cell by earliest termin first, then ascending id', () => {
      const customTasks: Task[] = [
        {
          id: 30,
          tytul: 'Zadanie później w tym samym koszyku',
          opis: '',
          termin: '2026-11-20',
          priorytet: 'wysoki',
          wykonane: false,
          tagi: [],
        },
        {
          id: 25,
          tytul: 'Zadanie dziś (większe ID)',
          opis: '',
          termin: '2026-11-19',
          priorytet: 'wysoki',
          wykonane: false,
          tagi: [],
        },
        {
          id: 10,
          tytul: 'Zadanie dziś (mniejsze ID)',
          opis: '',
          termin: '2026-11-19',
          priorytet: 'wysoki',
          wykonane: false,
          tagi: [],
        },
      ];

      renderCorkboard(customTasks);

      const cell = screen.getByTestId('zone-cell-wysoki-todayTomorrow');
      const notes = cell.querySelectorAll('[data-testid^="postit-note-"]');
      expect(
        Array.from(notes).map((n) => n.getAttribute('data-testid')),
      ).toEqual(['postit-note-10', 'postit-note-25', 'postit-note-30']);
    });
  });

  describe('2. PushPin Rendering (0 / 1 / 2+ / 8 Tags & Tooltips)', () => {
    it('renders 1 centered headless metallic nail (nail-pin-${id}) and 0 pushpins when a task has 0 tags', () => {
      renderCorkboard();

      // Sample task #3 has 0 tags
      const note3 = screen.getByTestId('postit-note-3');
      const nail = within(note3).getByTestId('nail-pin-3');
      expect(nail).toBeInTheDocument();
      expect(nail).toHaveAttribute('title', 'Gwoździk (brak tagów)');
      expect(
        within(note3).queryByTestId(/^pushpin-3-/),
      ).not.toBeInTheDocument();
    });

    it('renders 1 centered colored push-pin (pushpin-${id}-0) with tag tooltip when a task has 1 tag', () => {
      renderCorkboard();

      // Sample task #1 has 1 tag: ["studia"]
      const note1 = screen.getByTestId('postit-note-1');
      expect(within(note1).queryByTestId('nail-pin-1')).not.toBeInTheDocument();

      const pin0 = within(note1).getByTestId('pushpin-1-0');
      expect(pin0).toBeInTheDocument();
      expect(pin0).toHaveAttribute('title', 'studia');
      expect(pin0).toHaveAttribute('data-tag', 'studia');
      expect(within(pin0).getByRole('tooltip')).toHaveTextContent('studia');
      expect(pin0.parentElement).toHaveStyle({ left: '50%' });
    });

    it('renders evenly spaced colored push-pins for 2+ tags with deterministic getTagColor colors', () => {
      renderCorkboard();

      // Sample task #4 has 3 tags: ["studia", "projekt", "egzamin"]
      const note4 = screen.getByTestId('postit-note-4');
      const expectedTags = ['studia', 'projekt', 'egzamin'];

      expectedTags.forEach((tag, index) => {
        const pin = within(note4).getByTestId(`pushpin-4-${index}`);
        expect(pin).toBeInTheDocument();
        expect(pin).toHaveAttribute('title', tag);
        expect(within(pin).getByRole('tooltip')).toHaveTextContent(tag);

        const color = getTagColor(tag);
        expect(pin).toHaveAttribute(
          'aria-label',
          `Tag: ${tag} (${color.name})`,
        );
        expect(pin).toHaveAttribute('data-color', color.bg);
        const describedBy = pin.getAttribute('aria-describedby');
        expect(describedBy).toBeTruthy();
        expect(within(pin).getByRole('tooltip')).toHaveAttribute(
          'id',
          describedBy!,
        );
      });
    });

    it('clamps horizontal pin positions gracefully within [12%, 88%] and scales pin heads when a task has 8 tags', () => {
      const eightTags = [
        'studia',
        'projekt',
        'egzamin',
        'hackathon',
        'dom',
        'finanse',
        'zdrowie',
        'ćwiczenia',
      ];
      const manyTagsTask: Task = {
        id: 99,
        tytul: 'Zadanie z ośmioma tagami',
        opis: 'Test wielu pinezek',
        termin: '2026-11-19',
        priorytet: 'wysoki',
        wykonane: false,
        tagi: eightTags,
      };

      renderCorkboard([manyTagsTask]);

      const note = screen.getByTestId('postit-note-99');
      eightTags.forEach((tag, index) => {
        const pin = within(note).getByTestId(`pushpin-99-${index}`);
        expect(pin).toBeInTheDocument();
        expect(pin).toHaveClass('pushpin-head--xs');
        expect(pin).toHaveAttribute('title', tag);

        const pct = computePinLeftPercent(index, eightTags.length);
        expect(pct).toBeGreaterThanOrEqual(12);
        expect(pct).toBeLessThanOrEqual(88);
      });
    });
  });

  describe('3. PO TERMINIE Overdue Red Stamp & Note Content', () => {
    it('renders PO TERMINIE overdue stamp strictly on overdue active tasks and never on today, future, or null deadline tasks', () => {
      renderCorkboard();

      // Overdue sample tasks: #1 (2026-11-18), #2 (2026-11-17), #3 (2026-11-16)
      for (const overdueId of [1, 2, 3]) {
        const stamp = screen.getByTestId(`postit-overdue-stamp-${overdueId}`);
        expect(stamp).toBeInTheDocument();
        expect(stamp).toHaveTextContent('PO TERMINIE');
      }

      // Non-overdue active tasks: #4..#16 (today, tomorrow, thisWeek, later, noDeadline)
      for (let id = 4; id <= 16; id++) {
        expect(
          screen.queryByTestId(`postit-overdue-stamp-${id}`),
        ).not.toBeInTheDocument();
      }
    });

    it('omits description paragraph cleanly when opis is empty, formats dates in Polish, and applies deterministic tilt', () => {
      renderCorkboard();

      // Task #3 has empty opis ("") and termin "2026-11-16"
      const note3 = screen.getByTestId('postit-note-3');
      expect(note3.querySelector('.postit-desc')).toBeNull();
      expect(within(note3).getByText('16.11.2026')).toBeInTheDocument();
      expect(note3.style.getPropertyValue('--note-rotation')).toBe(
        `${getNoteRotation(3)}deg`,
      );

      // Task #1 has non-empty opis and termin "2026-11-18" (Wczoraj relative to 2026-11-19)
      const note1 = screen.getByTestId('postit-note-1');
      expect(note1.querySelector('.postit-desc')).not.toBeNull();
      expect(within(note1).getByText('Wczoraj')).toBeInTheDocument();

      // Task #4 has termin "2026-11-19" (Dziś)
      const note4 = screen.getByTestId('postit-note-4');
      expect(within(note4).getByText('Dziś')).toBeInTheDocument();

      // Task #5 has termin "2026-11-20" (Jutro)
      const note5 = screen.getByTestId('postit-note-5');
      expect(within(note5).getByText('Jutro')).toBeInTheDocument();

      // Task #14 has termin null (Bez terminu)
      const note14 = screen.getByTestId('postit-note-14');
      expect(within(note14).getByText('Bez terminu')).toBeInTheDocument();
    });
  });

  describe('4. 4-Way Event Disambiguation on PostItNote', () => {
    it('debounces single-click by 230ms before dispatching OPEN_MODAL (edit)', () => {
      vi.useFakeTimers();
      const harness = renderCorkboard();

      const note1 = screen.getByTestId('postit-note-1');
      fireEvent.click(note1, { detail: 1 });

      // Before 230ms, edit modal must not be open
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(harness.ctx.state.activeModal).toEqual({ type: 'none' });

      // At 230ms, edit modal opens for task #1
      act(() => {
        vi.advanceTimersByTime(CLICK_DELAY_MS - 100);
      });
      expect(harness.ctx.state.activeModal).toEqual({
        type: 'edit',
        taskId: 1,
      });
    });

    it('double-click cancels pending single-click timer, plays crumple sound, and dispatches COMPLETE_TO_FLOOR without opening edit modal', () => {
      vi.useFakeTimers();
      const crumpleSpy = vi.spyOn(soundUtils, 'playCrumpleSound');
      const harness = renderCorkboard();

      const note1 = screen.getByTestId('postit-note-1');

      // First click of a double-click sequence
      fireEvent.click(note1, { detail: 1 });
      act(() => {
        vi.advanceTimersByTime(60);
      });

      // Second click + doubleClick event
      fireEvent.click(note1, { detail: 2 });
      fireEvent.doubleClick(note1, { clientX: 250, clientY: 180 });

      // Task #1 immediately marked done and spawned as a floor ball
      expect(crumpleSpy).toHaveBeenCalledTimes(1);
      expect(
        harness.ctx.state.tasks.find((t) => t.id === 1)?.wykonane,
      ).toBe(true);
      expect(harness.ctx.state.floorBalls).toHaveLength(1);
      expect(harness.ctx.state.floorBalls[0].taskId).toBe(1);
      expect(screen.queryByTestId('postit-note-1')).not.toBeInTheDocument();

      // Advancing past 230ms must NEVER open the edit modal
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(harness.ctx.state.activeModal).toEqual({ type: 'none' });
    });

    it('guards against rapid triple-click / duplicate doubleClick events via isCrumplingRef', () => {
      const crumpleSpy = vi.spyOn(soundUtils, 'playCrumpleSound');
      renderCorkboard();

      const note1 = screen.getByTestId('postit-note-1');
      // Dispatch two back-to-back doubleClick events synchronously in the same act batch
      act(() => {
        note1.dispatchEvent(
          new MouseEvent('dblclick', { bubbles: true, cancelable: true }),
        );
        note1.dispatchEvent(
          new MouseEvent('dblclick', { bubbles: true, cancelable: true }),
        );
      });

      expect(crumpleSpy).toHaveBeenCalledTimes(1);
    });

    it('right-click (PPM) cancels pending single-click timer and dispatches OPEN_CONTEXT_MENU', () => {
      vi.useFakeTimers();
      const harness = renderCorkboard();

      const note2 = screen.getByTestId('postit-note-2');
      fireEvent.click(note2, { detail: 1 });
      fireEvent.contextMenu(note2, { clientX: 320, clientY: 410 });

      expect(harness.ctx.state.contextMenu).toEqual({
        kind: 'note',
        taskId: 2,
        x: 320,
        y: 410,
      });

      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(harness.ctx.state.activeModal).toEqual({ type: 'none' });
    });

    it('suppresses trailing click right after dragEnd via wasDraggingRef (50ms window)', () => {
      vi.useFakeTimers();
      const harness = renderCorkboard();

      const note4 = screen.getByTestId('postit-note-4');
      const dataTransfer = createMockDataTransfer();

      fireEvent.dragStart(note4, { dataTransfer });
      fireEvent.dragEnd(note4, { dataTransfer });

      // Synthetic trailing click immediately after dragEnd (within 50ms)
      fireEvent.click(note4, { detail: 1 });
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(harness.ctx.state.activeModal).toEqual({ type: 'none' });

      // After the 50ms reset window has elapsed, a normal single-click opens the edit modal
      act(() => {
        vi.advanceTimersByTime(DRAG_END_RESET_MS + 10);
      });
      fireEvent.click(note4, { detail: 1 });
      act(() => {
        vi.advanceTimersByTime(CLICK_DELAY_MS + 10);
      });
      expect(harness.ctx.state.activeModal).toEqual({
        type: 'edit',
        taskId: 4,
      });
    });
  });

  describe('5. Corkboard 3x5 Drag & Drop & Read-Only Po terminie Guard', () => {
    it('moves a task across priority and time-zone columns (updating priorytet and termin to +3d for thisWeek)', () => {
      const pinSoundSpy = vi.spyOn(soundUtils, 'playPinClickSound');
      const harness = renderCorkboard();

      // Task #7 starts at (niski, todayTomorrow, 2026-11-20)
      const note7 = screen.getByTestId('postit-note-7');
      const targetCell = screen.getByTestId('zone-cell-wysoki-thisWeek');

      dragNoteToCell(note7, targetCell);

      expect(pinSoundSpy).toHaveBeenCalledTimes(1);
      const updatedTask7 = harness.ctx.state.tasks.find((t) => t.id === 7);
      expect(updatedTask7?.priorytet).toBe('wysoki');
      expect(updatedTask7?.termin).toBe('2026-11-22'); // 2026-11-19 + 3 days

      const movedNote = within(targetCell).getByTestId('postit-note-7');
      expect(movedNote).toHaveAttribute('data-priority', 'wysoki');
      expect(movedNote).toHaveAttribute('data-zone', 'thisWeek');
    });

    it('updates termin to +14d when dropped into later and null when dropped into noDeadline', () => {
      const harness = renderCorkboard();

      // Drop task #6 (sredni, todayTomorrow) into (sredni, later) -> 2026-11-19 + 14d = 2026-12-03
      dragNoteToCell(
        screen.getByTestId('postit-note-6'),
        screen.getByTestId('zone-cell-sredni-later'),
      );
      expect(harness.ctx.state.tasks.find((t) => t.id === 6)?.termin).toBe(
        '2026-12-03',
      );

      // Drop task #6 into (niski, noDeadline) -> null
      dragNoteToCell(
        screen.getByTestId('postit-note-6'),
        screen.getByTestId('zone-cell-niski-noDeadline'),
      );
      const task6After = harness.ctx.state.tasks.find((t) => t.id === 6);
      expect(task6After?.priorytet).toBe('niski');
      expect(task6After?.termin).toBeNull();
    });

    it('preserves exact termin when dragged vertically within the same time-zone column', () => {
      const harness = renderCorkboard();

      // Task #5 has termin "2026-11-20" (tomorrow) in (wysoki, todayTomorrow)
      const note5 = screen.getByTestId('postit-note-5');
      const targetCell = screen.getByTestId('zone-cell-niski-todayTomorrow');

      dragNoteToCell(note5, targetCell);

      const updatedTask5 = harness.ctx.state.tasks.find((t) => t.id === 5);
      expect(updatedTask5?.priorytet).toBe('niski');
      // Must preserve "2026-11-20" rather than resetting to today "2026-11-19"
      expect(updatedTask5?.termin).toBe('2026-11-20');
    });

    it('rejects cross-column drop of a non-overdue task into read-only Po terminie (overdue) column', () => {
      const pinSoundSpy = vi.spyOn(soundUtils, 'playPinClickSound');
      const harness = renderCorkboard();

      // Task #4 is due today (2026-11-19, todayTomorrow) - NOT overdue
      const note4 = screen.getByTestId('postit-note-4');
      const overdueCell = screen.getByTestId('zone-cell-niski-overdue');
      const dataTransfer = createMockDataTransfer();

      fireEvent.dragStart(note4, { dataTransfer });
      fireEvent.dragEnter(overdueCell, { dataTransfer });
      fireEvent.dragOver(overdueCell, { dataTransfer });

      // Cell shows blocked visual cue
      expect(overdueCell).toHaveAttribute('data-drop-state', 'blocked');

      fireEvent.drop(overdueCell, { dataTransfer });
      fireEvent.dragEnd(note4, { dataTransfer });

      // Task #4 remains untouched in (wysoki, todayTomorrow) and no sound plays
      expect(pinSoundSpy).not.toHaveBeenCalled();
      const task4 = harness.ctx.state.tasks.find((t) => t.id === 4);
      expect(task4?.priorytet).toBe('wysoki');
      expect(task4?.termin).toBe('2026-11-19');
      expect(
        within(screen.getByTestId('zone-cell-wysoki-todayTomorrow')).getByTestId(
          'postit-note-4',
        ),
      ).toBeInTheDocument();
    });

    it('allows vertical priority change of an already-overdue task within Po terminie while preserving its overdue date', () => {
      const pinSoundSpy = vi.spyOn(soundUtils, 'playPinClickSound');
      const harness = renderCorkboard();

      // Task #3 is already overdue (niski, 2026-11-16)
      const note3 = screen.getByTestId('postit-note-3');
      const highOverdueCell = screen.getByTestId('zone-cell-wysoki-overdue');
      const dataTransfer = createMockDataTransfer();

      fireEvent.dragStart(note3, { dataTransfer });
      fireEvent.dragEnter(highOverdueCell, { dataTransfer });
      fireEvent.dragOver(highOverdueCell, { dataTransfer });

      // Cell shows valid drop state because task #3 is already overdue
      expect(highOverdueCell).toHaveAttribute('data-drop-state', 'valid');

      fireEvent.drop(highOverdueCell, { dataTransfer });
      fireEvent.dragEnd(note3, { dataTransfer });

      expect(pinSoundSpy).toHaveBeenCalledTimes(1);
      const task3 = harness.ctx.state.tasks.find((t) => t.id === 3);
      expect(task3?.priorytet).toBe('wysoki');
      expect(task3?.termin).toBe('2026-11-16');
      expect(
        within(highOverdueCell).getByTestId('postit-note-3'),
      ).toBeInTheDocument();
    });

    it('treats dropping a note back onto its own (priority, zone) cell as a clean no-op without playing sound', () => {
      const pinSoundSpy = vi.spyOn(soundUtils, 'playPinClickSound');
      renderCorkboard();

      const note1 = screen.getByTestId('postit-note-1');
      const sameCell = screen.getByTestId('zone-cell-wysoki-overdue');

      dragNoteToCell(note1, sameCell);

      expect(pinSoundSpy).not.toHaveBeenCalled();
    });

    it('prevents dragLeave highlight flicker when pointer moves over a child element inside the same cell', () => {
      renderCorkboard();

      const note4 = screen.getByTestId('postit-note-4');
      const targetCell = screen.getByTestId('zone-cell-wysoki-thisWeek');
      const childInsideTarget = screen.getByTestId('postit-note-8');
      const dataTransfer = createMockDataTransfer();

      fireEvent.dragStart(note4, { dataTransfer });
      fireEvent.dragEnter(targetCell, { dataTransfer });
      fireEvent.dragOver(targetCell, { dataTransfer });
      expect(targetCell).toHaveAttribute('data-drop-state', 'valid');

      // Leaving cell into a child note inside the same cell must keep data-drop-state="valid"
      fireEvent(
        targetCell,
        new MouseEvent('dragleave', {
          bubbles: true,
          cancelable: true,
          relatedTarget: childInsideTarget,
        }),
      );
      expect(targetCell).toHaveAttribute('data-drop-state', 'valid');

      // Leaving cell to an element outside the cell resets data-drop-state="idle"
      fireEvent(
        targetCell,
        new MouseEvent('dragleave', {
          bubbles: true,
          cancelable: true,
          relatedTarget: document.body,
        }),
      );
      expect(targetCell).toHaveAttribute('data-drop-state', 'idle');
    });
  });

  describe('6. filter vs highlight Modes & Empty States', () => {
    it('hides non-matching notes in filter mode and keeps matching notes with data-dimmed="false"', () => {
      const harness = renderCorkboard();

      act(() => {
        harness.ctx.dispatch({
          type: 'SET_SEARCH_QUERY',
          payload: { query: 'Kolokwium' },
        });
      });

      // Task #1 ("Kolokwium z sieci komputerowych") matches; task #4 does not
      const note1 = screen.getByTestId('postit-note-1');
      expect(note1).toBeInTheDocument();
      expect(note1).toHaveAttribute('data-dimmed', 'false');
      expect(screen.queryByTestId('postit-note-4')).not.toBeInTheDocument();
    });

    it('keeps all active notes mounted in highlight mode and sets data-dimmed="true" on non-matching notes', () => {
      const harness = renderCorkboard();

      act(() => {
        harness.ctx.dispatch({
          type: 'SET_FILTER_MODE',
          payload: { mode: 'highlight' },
        });
        harness.ctx.dispatch({
          type: 'TOGGLE_TAG_FILTER',
          payload: { tag: 'zdrowie' },
        });
      });

      // All 16 active notes remain in the DOM
      const allRenderedNotes = screen.getAllByTestId(/^postit-note-\d+$/);
      expect(allRenderedNotes).toHaveLength(16);

      // Only task #10 has tag "zdrowie" -> data-dimmed="false"
      expect(screen.getByTestId('postit-note-10')).toHaveAttribute(
        'data-dimmed',
        'false',
      );
      // Non-matching task #1 -> data-dimmed="true"
      expect(screen.getByTestId('postit-note-1')).toHaveAttribute(
        'data-dimmed',
        'true',
      );
    });

    it('renders Polish empty-filter hint and resets filters when clicking "Wyczyść filtry"', () => {
      const harness = renderCorkboard();

      act(() => {
        harness.ctx.dispatch({
          type: 'SET_SEARCH_QUERY',
          payload: { query: 'brak_takiego_zadania_xyz_987' },
        });
      });

      const hint = screen.getByTestId('corkboard-empty-filter-hint');
      expect(hint).toBeInTheDocument();
      expect(hint).toHaveTextContent(
        'Brak zadań pasujących do aktywnych filtrów.',
      );

      const resetBtn = within(hint).getByRole('button', {
        name: /Wyczyść filtry/i,
      });
      fireEvent.click(resetBtn);

      expect(
        screen.queryByTestId('corkboard-empty-filter-hint'),
      ).not.toBeInTheDocument();
      expect(screen.getAllByTestId(/^postit-note-\d+$/)).toHaveLength(16);
    });

    it('renders Polish empty-board message when there are 0 active tasks while still mounting all 15 zone cells', () => {
      renderCorkboard([]);

      const emptyBanner = screen.getByTestId('corkboard-empty-state');
      expect(emptyBanner).toBeInTheDocument();
      expect(emptyBanner).toHaveTextContent(
        'Tablica jest pusta — dodaj nowe zadanie lub wczytaj plik JSON.',
      );

      // All 15 drop-zone cells remain mounted
      expect(screen.getAllByTestId(/^zone-cell-/)).toHaveLength(15);
    });
  });

  describe('7. Iteration 2 Regression & Hardening Guards', () => {
    it('enforces responsive non-overflow grid sizing (min-w-[1240px] and minmax(222px,1fr) column tracks)', () => {
      renderCorkboard();

      const board = screen.getByTestId('corkboard');
      const gridWrapper = board.querySelector('.min-w-\\[1240px\\]');
      expect(gridWrapper).not.toBeNull();

      const gridRows = board.querySelectorAll(
        '.grid-cols-\\[128px_repeat\\(5\\,minmax\\(222px\\,1fr\\)\\)\\]',
      );
      // 1 X-axis header row + 3 Y-axis priority rows = 4 aligned grid rows
      expect(gridRows).toHaveLength(4);
    });

    it('treats whitespace-only drop payloads as clean no-ops when Task id: 0 exists, while falling back from whitespace custom MIME to valid text/plain', () => {
      const pinSoundSpy = vi.spyOn(soundUtils, 'playPinClickSound');
      const tasksWithZero: Task[] = [
        {
          id: 0,
          tytul: 'Zadanie o ID zero',
          opis: '',
          termin: TODAY,
          priorytet: 'wysoki',
          wykonane: false,
          tagi: [],
        },
        {
          id: 4,
          tytul: 'Zadanie o ID cztery',
          opis: '',
          termin: TODAY,
          priorytet: 'wysoki',
          wykonane: false,
          tagi: [],
        },
      ];

      const harness = renderCorkboard(tasksWithZero);
      const targetCell = screen.getByTestId('zone-cell-niski-later');

      // Whitespace-only payloads must NOT coerce to id: 0
      for (const badPayload of ['   ', '\t\n', ' ']) {
        const dt = createMockDataTransfer({ 'text/plain': badPayload });
        fireEvent.drop(targetCell, { dataTransfer: dt });
      }

      expect(pinSoundSpy).not.toHaveBeenCalled();
      expect(harness.ctx.state.tasks.find((t) => t.id === 0)).toMatchObject({
        priorytet: 'wysoki',
        termin: TODAY,
      });

      // Whitespace custom MIME must fall back to trimmed valid text/plain ("4")
      const fallbackDt = createMockDataTransfer({
        'application/x-smartapp-task-id': '   ',
        'text/plain': ' 4 ',
      });
      fireEvent.drop(targetCell, { dataTransfer: fallbackDt });

      expect(pinSoundSpy).toHaveBeenCalledTimes(1);
      expect(harness.ctx.state.tasks.find((t) => t.id === 0)).toMatchObject({
        priorytet: 'wysoki',
        termin: TODAY,
      });
      expect(harness.ctx.state.tasks.find((t) => t.id === 4)).toMatchObject({
        priorytet: 'niski',
        termin: '2026-12-03',
      });
    });

    it('never leaks stale hoveredCell.draggedTaskId into malformed or empty drops when draggingNoteId is null', () => {
      const pinSoundSpy = vi.spyOn(soundUtils, 'playPinClickSound');
      const harness = renderCorkboard([
        {
          id: 4,
          tytul: 'Zadanie testowe',
          opis: '',
          termin: TODAY,
          priorytet: 'wysoki',
          wykonane: false,
          tagi: [],
        },
      ]);

      const hoverCell = screen.getByTestId('zone-cell-sredni-thisWeek');
      const dropCell = screen.getByTestId('zone-cell-niski-later');

      // Hover with valid dataTransfer while state.draggingNoteId === null
      const hoverDt = createMockDataTransfer({
        'application/x-smartapp-task-id': '4',
      });
      fireEvent.dragEnter(hoverCell, { dataTransfer: hoverDt });
      fireEvent.dragOver(hoverCell, { dataTransfer: hoverDt });
      expect(hoverCell).toHaveAttribute('data-drop-state', 'valid');

      // Malformed ("abc") and empty ("") drops onto another cell must be safe no-ops
      fireEvent.drop(dropCell, {
        dataTransfer: createMockDataTransfer({ 'text/plain': 'abc' }),
      });
      fireEvent.drop(dropCell, {
        dataTransfer: createMockDataTransfer({ 'text/plain': '' }),
      });

      expect(pinSoundSpy).not.toHaveBeenCalled();
      expect(harness.ctx.state.tasks.find((t) => t.id === 4)).toMatchObject({
        priorytet: 'wysoki',
        termin: TODAY,
      });
    });

    it('rejects non-decimal numeric drop payloads (0x1, 1e0, +1, 0b1, -0, 1.5) when Task id: 1 exists', () => {
      const pinSoundSpy = vi.spyOn(soundUtils, 'playPinClickSound');
      const harness = renderCorkboard([
        {
          id: 1,
          tytul: 'Zadanie numer jeden',
          opis: '',
          termin: TODAY,
          priorytet: 'wysoki',
          wykonane: false,
          tagi: [],
        },
      ]);

      const targetCell = screen.getByTestId('zone-cell-niski-later');
      for (const nonDecimal of ['0x1', '1e0', '+1', '0b1', '-0', '1.5']) {
        fireEvent.drop(targetCell, {
          dataTransfer: createMockDataTransfer({ 'text/plain': nonDecimal }),
        });
      }

      expect(pinSoundSpy).not.toHaveBeenCalled();
      expect(harness.ctx.state.tasks.find((t) => t.id === 1)).toMatchObject({
        priorytet: 'wysoki',
        termin: TODAY,
      });
    });

    it('ignores external non-task drags (e.g. OS Files) during dragEnter/dragOver without highlighting or calling preventDefault', () => {
      renderCorkboard();

      const cell = screen.getByTestId('zone-cell-sredni-thisWeek');
      const filesDt = createMockDataTransfer({}, ['Files']);

      fireEvent.dragEnter(cell, { dataTransfer: filesDt });
      const dragOverEvent = new Event('dragover', {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(dragOverEvent, 'dataTransfer', { value: filesDt });
      act(() => {
        cell.dispatchEvent(dragOverEvent);
      });

      expect(dragOverEvent.defaultPrevented).toBe(false);
      expect(cell).toHaveAttribute('data-drop-state', 'idle');
    });

    it('omits whitespace-only opis cleanly and updates termin to today (+0d) on cross-column drop into todayTomorrow', () => {
      const harness = renderCorkboard([
        {
          id: 50,
          tytul: 'Zadanie z białymi znakami w opisie',
          opis: '   \n\t   ',
          termin: '2026-12-03',
          priorytet: 'sredni',
          wykonane: false,
          tagi: [],
        },
      ]);

      const note50 = screen.getByTestId('postit-note-50');
      expect(note50.querySelector('.postit-desc')).toBeNull();

      const todayCell = screen.getByTestId('zone-cell-wysoki-todayTomorrow');
      dragNoteToCell(note50, todayCell);

      expect(harness.ctx.state.tasks.find((t) => t.id === 50)).toMatchObject({
        priorytet: 'wysoki',
        termin: TODAY,
      });
    });

    it('cancels pending single-click timer on detail >= 2 even without dblclick and cleans up timers/rAF on unmount', () => {
      vi.useFakeTimers();

      const cancelRafSpy = vi.spyOn(window, 'cancelAnimationFrame');
      let latestCtx!: TaskContextValue;
      function Probe() {
        latestCtx = useTasks();
        return null;
      }

      const { rerender } = render(
        <TaskProvider>
          <Probe />
          <Corkboard todayStr={TODAY} />
        </TaskProvider>,
      );

      // 1. click(detail=1) followed by click(detail=2) without dblclick cancels the edit-modal timer
      const note1 = screen.getByTestId('postit-note-1');
      fireEvent.click(note1, { detail: 1 });
      act(() => {
        vi.advanceTimersByTime(80);
      });
      fireEvent.click(note1, { detail: 2 });
      act(() => {
        vi.advanceTimersByTime(CLICK_DELAY_MS + 100);
      });
      expect(latestCtx.state.activeModal).toEqual({ type: 'none' });

      // 2. Arm click timer + dragStart rAF + dragEnd reset timer, then unmount Corkboard before they fire
      const note4 = screen.getByTestId('postit-note-4');
      const dt = createMockDataTransfer();
      fireEvent.dragStart(note4, { dataTransfer: dt });
      fireEvent.dragEnd(note4, { dataTransfer: dt });

      // Schedule a fresh rAF on note2 and a click timer on note3
      const note2 = screen.getByTestId('postit-note-2');
      fireEvent.dragStart(note2, { dataTransfer: createMockDataTransfer() });
      const note3 = screen.getByTestId('postit-note-3');
      fireEvent.click(note3, { detail: 1 });

      // Unmount Corkboard while TaskProvider remains mounted to observe any leaked dispatches
      rerender(
        <TaskProvider>
          <Probe />
        </TaskProvider>,
      );

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(cancelRafSpy).toHaveBeenCalled();
      expect(latestCtx.state.activeModal).toEqual({ type: 'none' });
      expect(latestCtx.state.draggingNoteId).toBeNull();
    });

    it('does not overwrite an already-open modal when 230ms single-click timer fires', () => {
      vi.useFakeTimers();
      let latestCtx!: ReturnType<typeof useTasks>;
      function Probe() {
        latestCtx = useTasks();
        return null;
      }

      render(
        <TaskProvider>
          <Corkboard />
          <Probe />
        </TaskProvider>,
      );

      const note1 = screen.getByTestId('postit-note-1');
      fireEvent.click(note1, { detail: 1 });

      // Within < 230ms, another modal (e.g. trash) opens
      act(() => {
        vi.advanceTimersByTime(50);
        latestCtx.dispatch({ type: 'OPEN_MODAL', payload: { type: 'trash' } });
      });
      expect(latestCtx.state.activeModal).toEqual({ type: 'trash' });

      // After 230ms elapses, activeModal must remain 'trash' (not overwritten with 'edit')
      act(() => {
        vi.advanceTimersByTime(CLICK_DELAY_MS + 50);
      });
      expect(latestCtx.state.activeModal).toEqual({ type: 'trash' });
    });
  });
});
