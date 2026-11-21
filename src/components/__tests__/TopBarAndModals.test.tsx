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
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  Task,
  TaskAction,
  ArchiveEntry,
} from '../../types/task';
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
import { TopBar } from '../TopBar';
import { TaskModal } from '../TaskModal';
import { ContextMenu } from '../ContextMenu';
import { Toast } from '../Toast';

function createSampleSeedTasks(): Task[] {
  const today = getTodayDateString();
  return [
    {
      id: 1,
      tytul: 'Kolokwium z analizy matematycznej',
      opis: 'Powtórzyć szeregi potęgowe i całki oznaczone',
      termin: today,
      priorytet: 'wysoki',
      wykonane: false,
      tagi: ['studia', 'egzamin'],
    },
    {
      id: 2,
      tytul: 'Kupić kawę do akademika',
      opis: 'Ziarna arabica 1kg w promocji',
      termin: addDaysToDateString(today, 3),
      priorytet: 'sredni',
      wykonane: false,
      tagi: ['dom', 'zakupy'],
    },
    {
      id: 3,
      tytul: 'Przeczytać dokumentację React 19',
      opis: '',
      termin: null,
      priorytet: 'niski',
      wykonane: false,
      tagi: ['studia', 'projekt'],
    },
    {
      id: 4,
      tytul: 'Oddana wejściówka z fizyki',
      opis: 'Zaliczone na 5.0',
      termin: addDaysToDateString(today, -2),
      priorytet: 'sredni',
      wykonane: true,
      tagi: ['studia'],
    },
  ];
}

interface HarnessOptions {
  seed?: InitialStateSeed;
  initialActions?: TaskAction[];
}

function StateProbe({
  onUpdate,
}: {
  onUpdate: (ctx: TaskContextValue) => void;
}) {
  const ctx = useTasks();
  useEffect(() => {
    onUpdate(ctx);
  });
  return null;
}

function InitialActionRunner({ actions }: { actions?: TaskAction[] }) {
  const { dispatch } = useTasks();
  useEffect(() => {
    if (actions && actions.length > 0) {
      for (const action of actions) {
        dispatch(action);
      }
    }
    // Run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function renderM3Harness(options: HarnessOptions = {}) {
  const seed: InitialStateSeed = options.seed ?? {
    wersja: 1,
    tasks: createSampleSeedTasks(),
    archive: [],
    muted: false,
  };

  let latestCtx: TaskContextValue | null = null;

  const utils = render(
    <TaskProvider initialSeed={seed}>
      <InitialActionRunner actions={options.initialActions} />
      <StateProbe
        onUpdate={(ctx) => {
          latestCtx = ctx;
        }}
      />
      <TopBar />
      <TaskModal />
      <ContextMenu />
      <Toast />
    </TaskProvider>,
  );

  const getCtx = (): TaskContextValue => {
    if (!latestCtx) {
      throw new Error('TaskContextValue not captured yet');
    }
    return latestCtx;
  };

  return {
    ...utils,
    getCtx,
  };
}

describe('Milestone M3 — TopBar, TaskModal, ContextMenu & Toast', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. TopBar Tests
  // =========================================================================
  describe('TopBar component', () => {
    it('renders clean Polish title "Tablica Korkowa" without forcing team name into header', () => {
      renderM3Harness();
      const topbar = screen.getByTestId('topbar');
      expect(topbar).toBeInTheDocument();
      expect(within(topbar).getByText('Tablica Korkowa')).toBeInTheDocument();
      expect(topbar.textContent).not.toMatch(/Praktykanci/i);
    });

    it('filters tasks via live search input (matching title & description) and clears via quick clear button', async () => {
      const user = userEvent.setup();
      const { getCtx } = renderM3Harness();

      const searchInput = screen.getByTestId('search-input');
      expect(searchInput).toHaveValue('');
      expect(
        screen.queryByRole('button', { name: /Wyczyść wyszukiwanie/i }),
      ).not.toBeInTheDocument();

      // Search by title substring
      await user.type(searchInput, 'analizy');
      expect(searchInput).toHaveValue('analizy');
      expect(getCtx().state.filters.searchQuery).toBe('analizy');
      expect(Array.from(getCtx().matchingTaskIds)).toEqual([1]);

      // Clear button appears and clears search query
      const clearBtn = screen.getByRole('button', {
        name: /Wyczyść wyszukiwanie/i,
      });
      await user.click(clearBtn);
      expect(searchInput).toHaveValue('');
      expect(getCtx().state.filters.searchQuery).toBe('');
      expect(Array.from(getCtx().matchingTaskIds).sort()).toEqual([1, 2, 3]);

      // Search by description substring (case-insensitive)
      await user.type(searchInput, 'ARABICA');
      expect(Array.from(getCtx().matchingTaskIds)).toEqual([2]);
    });

    it('renders colored tag pin chips for active tags, toggles tag selection, switches filter mode, and resets filters preserving filterMode', async () => {
      const user = userEvent.setup();
      const { getCtx } = renderM3Harness();

      // Active tasks have tags: dom, egzamin, projekt, studia, zakupy
      const studiaChip = screen.getByTestId('tag-filter-studia');
      const domChip = screen.getByTestId('tag-filter-dom');
      expect(studiaChip).toHaveAttribute('aria-pressed', 'false');
      expect(domChip).toHaveAttribute('aria-pressed', 'false');

      // Reset button not shown when no filters active
      expect(
        screen.queryByTestId('tag-filter-reset'),
      ).not.toBeInTheDocument();

      // Toggle 'studia' tag filter
      await user.click(studiaChip);
      expect(studiaChip).toHaveAttribute('aria-pressed', 'true');
      expect(getCtx().state.filters.selectedTags).toEqual(['studia']);
      expect(Array.from(getCtx().matchingTaskIds).sort()).toEqual([1, 3]);

      // Toggle 'dom' tag filter (OR match across selected tags)
      await user.click(domChip);
      expect(domChip).toHaveAttribute('aria-pressed', 'true');
      expect(getCtx().state.filters.selectedTags).toEqual(['studia', 'dom']);
      expect(Array.from(getCtx().matchingTaskIds).sort()).toEqual([1, 2, 3]);

      // Switch filter mode from 'filter' to 'highlight'
      const modeToggle = screen.getByTestId('filter-mode-toggle');
      expect(modeToggle).toHaveAttribute('data-mode', 'filter');
      expect(modeToggle).toHaveTextContent(/Filtruj/i);

      await user.click(modeToggle);
      expect(getCtx().state.filters.filterMode).toBe('highlight');
      expect(modeToggle).toHaveAttribute('data-mode', 'highlight');
      expect(modeToggle).toHaveTextContent(/Podświetl/i);

      // Quick reset button clears searchQuery & selectedTags but preserves filterMode === 'highlight'
      await user.type(screen.getByTestId('search-input'), 'kawa');
      const resetBtn = screen.getByTestId('tag-filter-reset');
      await user.click(resetBtn);

      expect(getCtx().state.filters.searchQuery).toBe('');
      expect(getCtx().state.filters.selectedTags).toEqual([]);
      expect(getCtx().state.filters.filterMode).toBe('highlight');
      expect(
        screen.queryByTestId('tag-filter-reset'),
      ).not.toBeInTheDocument();
    });

    it('opens create TaskModal when clicking "+ Nowe zadanie"', async () => {
      const user = userEvent.setup();
      const { getCtx } = renderM3Harness();

      expect(screen.queryByTestId('task-modal')).not.toBeInTheDocument();
      await user.click(screen.getByTestId('btn-new-task'));

      expect(getCtx().state.activeModal).toEqual({ type: 'create' });
      expect(screen.getByTestId('task-modal')).toBeInTheDocument();
    });

    it('imports a valid JSON file, updates wersja and tasks, shows success toast, and resets file input for re-import', async () => {
      const user = userEvent.setup();
      const { getCtx } = renderM3Harness();

      const validPayload = JSON.stringify({
        wersja: 2,
        zadania: [
          {
            id: 10,
            tytul: 'Zadanie z pliku zewnętrznego',
            opis: 'Test importu v2',
            termin: '2026-11-25',
            priorytet: 'wysoki',
            wykonane: false,
            tagi: ['konkurs'],
          },
          {
            id: 11,
            tytul: 'Ukończone zadanie z pliku',
            opis: '',
            termin: null,
            priorytet: 'niski',
            wykonane: true,
            tagi: [],
          },
        ],
      });

      const fileInput = screen.getByTestId(
        'import-json-input',
      ) as HTMLInputElement;
      const file = new File([validPayload], 'organizer_v2.json', {
        type: 'application/json',
      });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(getCtx().state.wersja).toBe(2);
      });
      expect(getCtx().state.tasks).toHaveLength(2);
      expect(getCtx().activeTasks).toHaveLength(1);
      expect(getCtx().inTrashTasks).toHaveLength(1);

      // File input value is reset to empty string so re-importing the same file works
      expect(fileInput.value).toBe('');

      const toast = screen.getByTestId('toast-notification');
      expect(toast).toHaveAttribute('data-toast-type', 'success');
      expect(toast).toHaveTextContent(/Wczytano 2 zadań/i);
    });

    it('imports a valid JSON file with empty-tag warnings and displays warning details in Toast (also exercising FileReader fallback)', async () => {
      const { getCtx } = renderM3Harness();

      const payloadWithEmptyTag = JSON.stringify({
        wersja: 1,
        zadania: [
          {
            id: 1,
            tytul: 'Zadanie z pustym tagiem',
            opis: '',
            termin: null,
            priorytet: 'sredni',
            wykonane: false,
            tagi: ['studia', '   '],
          },
        ],
      });

      const fileInput = screen.getByTestId(
        'import-json-input',
      ) as HTMLInputElement;
      const syntheticFile = new File([payloadWithEmptyTag], 'warn.json', {
        type: 'application/json',
      });
      // Remove .text() method on this instance to exercise the FileReader fallback branch
      Object.defineProperty(syntheticFile, 'text', {
        value: undefined,
        configurable: true,
      });

      fireEvent.change(fileInput, { target: { files: [syntheticFile] } });

      await waitFor(() => {
        expect(getCtx().state.tasks).toHaveLength(1);
      });
      expect(getCtx().state.tasks[0].tagi).toEqual(['studia']);

      const toast = screen.getByTestId('toast-notification');
      expect(toast).toHaveAttribute('data-toast-type', 'success');
      expect(toast).toHaveTextContent(/ostrzeżenia: 1/i);
      expect(screen.getByTestId('toast-details')).toHaveTextContent(
        /pominięto puste tagi/i,
      );
    });

    it('rejects invalid JSON syntax and invalid task schema with Polish error toast while leaving existing tasks untouched', async () => {
      const user = userEvent.setup();
      const { getCtx } = renderM3Harness();
      const initialTasksSnapshot = getCtx().state.tasks;

      const fileInput = screen.getByTestId(
        'import-json-input',
      ) as HTMLInputElement;

      // 1. Broken JSON syntax
      const brokenFile = new File(['{ "wersja": 1, '], 'broken.json', {
        type: 'application/json',
      });
      await user.upload(fileInput, brokenFile);

      await waitFor(() => {
        expect(screen.getByTestId('toast-notification')).toBeInTheDocument();
      });
      expect(screen.getByTestId('toast-notification')).toHaveAttribute(
        'data-toast-type',
        'error',
      );
      expect(screen.getByTestId('toast-notification')).toHaveTextContent(
        'Nieprawidłowa składnia pliku JSON.',
      );
      expect(getCtx().state.tasks).toEqual(initialTasksSnapshot);

      // 2. Invalid schema (bad priority "średni" with Polish diacritic)
      const invalidSchemaPayload = JSON.stringify({
        wersja: 1,
        zadania: [
          {
            id: 1,
            tytul: 'Błędny priorytet',
            opis: '',
            termin: null,
            priorytet: 'średni',
            wykonane: false,
            tagi: [],
          },
        ],
      });
      const badSchemaFile = new File(
        [invalidSchemaPayload],
        'bad-priority.json',
        { type: 'application/json' },
      );
      await user.upload(fileInput, badSchemaFile);

      await waitFor(() => {
        expect(screen.getByTestId('toast-notification')).toHaveTextContent(
          'Plik JSON zawiera błędy struktury zadań.',
        );
      });
      expect(screen.getByTestId('toast-details')).toHaveTextContent(
        /nieprawidłowy priorytet "średni"/i,
      );
      expect(getCtx().state.tasks).toEqual(initialTasksSnapshot);

      // 3. Unreadable file error handling
      const unreadableFile = new File(['{}'], 'unreadable.json', {
        type: 'application/json',
      });
      Object.defineProperty(unreadableFile, 'text', {
        value: () => Promise.reject(new Error('Disk read error')),
      });
      await user.upload(fileInput, unreadableFile);

      await waitFor(() => {
        expect(screen.getByTestId('toast-notification')).toHaveTextContent(
          'Nie udało się odczytać wybranego pliku JSON.',
        );
      });
      expect(getCtx().state.tasks).toEqual(initialTasksSnapshot);
    });

    it('exports tasks to zadania.json with strict 7-field schema and shows feedback toast', async () => {
      const user = userEvent.setup();
      let capturedBlob: Blob | null = null;
      let clickedDownloadAttr = '';

      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;

      URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => {
        capturedBlob = blob as Blob;
        return 'blob:smartapp-zadania-export';
      });
      URL.revokeObjectURL = vi.fn();

      const clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(function (this: HTMLAnchorElement) {
          clickedDownloadAttr = this.download;
        });

      try {
        renderM3Harness({
          seed: {
            wersja: 3,
            tasks: createSampleSeedTasks(),
          },
        });

        await user.click(screen.getByTestId('btn-export-json'));

        expect(clickSpy).toHaveBeenCalledTimes(1);
        expect(clickedDownloadAttr).toBe('zadania.json');
        expect(capturedBlob).not.toBeNull();

        const exportedText = await capturedBlob!.text();
        const parsed = JSON.parse(exportedText);

        expect(Object.keys(parsed)).toEqual(['wersja', 'zadania']);
        expect(parsed.wersja).toBe(3);
        expect(parsed.zadania).toHaveLength(4);
        for (const item of parsed.zadania) {
          expect(Object.keys(item)).toEqual([
            'id',
            'tytul',
            'opis',
            'termin',
            'priorytet',
            'wykonane',
            'tagi',
          ]);
        }

        const toast = screen.getByTestId('toast-notification');
        expect(toast).toHaveTextContent(
          /Wyeksportowano 4 zadań do pliku zadania\.json/i,
        );
      } finally {
        URL.createObjectURL = originalCreateObjectURL;
        URL.revokeObjectURL = originalRevokeObjectURL;
      }
    });

    it('opens archive modal and displays archive count badge when archive entries exist', async () => {
      const user = userEvent.setup();
      const archiveEntries: ArchiveEntry[] = [
        {
          task: createSampleSeedTasks()[3],
          oproznionoDnia: '2026-11-19T12:00:00.000Z',
        },
      ];

      const { getCtx } = renderM3Harness({
        seed: {
          wersja: 1,
          tasks: createSampleSeedTasks(),
          archive: archiveEntries,
        },
      });

      const archiveBtn = screen.getByTestId('btn-open-archive');
      expect(within(archiveBtn).getByText('1')).toBeInTheDocument();

      await user.click(archiveBtn);
      expect(getCtx().state.activeModal).toEqual({ type: 'archive' });
    });

    it('toggles sound mute state when clicking btn-toggle-mute', async () => {
      const user = userEvent.setup();
      const { getCtx } = renderM3Harness();

      const muteBtn = screen.getByTestId('btn-toggle-mute');
      expect(muteBtn).toHaveAttribute('aria-pressed', 'false');
      expect(getCtx().state.muted).toBe(false);

      await user.click(muteBtn);
      expect(muteBtn).toHaveAttribute('aria-pressed', 'true');
      expect(getCtx().state.muted).toBe(true);

      await user.click(muteBtn);
      expect(muteBtn).toHaveAttribute('aria-pressed', 'false');
      expect(getCtx().state.muted).toBe(false);
    });
  });

  // =========================================================================
  // 2. TaskModal Tests
  // =========================================================================
  describe('TaskModal component', () => {
    it('opens notes in read-only view and enters edit mode only after pressing Edytuj', async () => {
      const user = userEvent.setup();
      const { getCtx } = renderM3Harness({
        initialActions: [
          { type: 'OPEN_MODAL', payload: { type: 'view', taskId: 3 } },
        ],
      });

      expect(screen.getByTestId('task-modal').querySelector('.notebook-sheet'))
        .not.toBeNull();
      expect(screen.getByTestId('task-view-title')).toHaveTextContent(
        'Przeczytać dokumentację React 19',
      );
      expect(screen.getByTestId('task-view-deadline')).toHaveTextContent(
        'Bez terminu',
      );
      expect(screen.getByTestId('task-view-priority')).toHaveTextContent(
        'Niski',
      );
      expect(screen.getByTestId('task-view-tag-studia')).toHaveTextContent(
        '#studia',
      );
      expect(screen.getByTestId('task-view-tag-projekt')).toHaveTextContent(
        '#projekt',
      );
      expect(screen.queryByTestId('task-input-title')).not.toBeInTheDocument();
      expect(screen.queryByTestId('task-btn-add-tag')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('task-btn-edit'));

      expect(screen.getByTestId('task-input-title')).toHaveValue(
        'Przeczytać dokumentację React 19',
      );
      expect(getCtx().state.activeModal).toEqual({ type: 'edit', taskId: 3 });
    });

    it('validates empty/whitespace title and invalid date before saving, keeping modal open on error', async () => {
      const user = userEvent.setup();
      const { getCtx } = renderM3Harness({
        initialActions: [{ type: 'OPEN_MODAL', payload: { type: 'create' } }],
      });

      const initialTaskCount = getCtx().state.tasks.length;
      const modal = screen.getByTestId('task-modal');
      expect(modal).toBeInTheDocument();

      // Clear title or type whitespace only and click save
      const titleInput = screen.getByTestId('task-input-title');
      await user.type(titleInput, '    ');
      await user.click(screen.getByTestId('task-btn-save'));

      expect(screen.getByTestId('task-title-error')).toHaveTextContent(
        /Tytuł zadania jest wymagany/i,
      );
      expect(getCtx().state.tasks).toHaveLength(initialTaskCount);
      expect(screen.getByTestId('task-modal')).toBeInTheDocument();

      // Typing valid title clears title error
      await user.clear(titleInput);
      await user.type(titleInput, 'Poprawny tytuł');
      expect(screen.queryByTestId('task-title-error')).not.toBeInTheDocument();

      // Set empty date while "Bez terminu" is unchecked
      const dateInput = screen.getByTestId('task-input-date');
      fireEvent.change(dateInput, { target: { value: '' } });
      await user.click(screen.getByTestId('task-btn-save'));

      expect(screen.getByTestId('task-date-error')).toHaveTextContent(
        /Podaj prawidłową datę/i,
      );
      expect(getCtx().state.tasks).toHaveLength(initialTaskCount);
      expect(screen.getByTestId('task-modal')).toBeInTheDocument();
    });

    it('handles "Bez terminu" checkbox toggling, disabling date input and restoring today date when unchecked', async () => {
      const user = userEvent.setup();
      const today = getTodayDateString();
      renderM3Harness({
        initialActions: [{ type: 'OPEN_MODAL', payload: { type: 'create' } }],
      });

      const dateInput = screen.getByTestId(
        'task-input-date',
      ) as HTMLInputElement;
      const noDeadlineCheckbox = screen.getByTestId(
        'task-checkbox-no-deadline',
      ) as HTMLInputElement;

      expect(noDeadlineCheckbox.checked).toBe(false);
      expect(dateInput).not.toBeDisabled();
      expect(dateInput.value).toBe(today);

      // Clear date, check "Bez terminu" -> disabled
      fireEvent.change(dateInput, { target: { value: '' } });
      await user.click(noDeadlineCheckbox);
      expect(noDeadlineCheckbox.checked).toBe(true);
      expect(dateInput).toBeDisabled();
      expect(dateInput.value).toBe('');

      // Uncheck "Bez terminu" -> re-enables and populates today's date
      await user.click(noDeadlineCheckbox);
      expect(noDeadlineCheckbox.checked).toBe(false);
      expect(dateInput).not.toBeDisabled();
      expect(dateInput.value).toBe(today);
    });

    it('supports priority selection, adding tags via button and Enter key (without submitting form), case-insensitive deduplication, tag removal, and saving new task', async () => {
      const user = userEvent.setup();
      const pinSoundSpy = vi.spyOn(soundUtils, 'playPinClickSound');
      const { getCtx } = renderM3Harness({
        initialActions: [
          {
            type: 'OPEN_MODAL',
            payload: {
              type: 'create',
              defaultPriority: 'niski',
              defaultZone: 'thisWeek',
            },
          },
        ],
      });

      const today = getTodayDateString();
      expect(screen.getByTestId('task-input-date')).toHaveValue(
        addDaysToDateString(today, 3),
      );
      expect(screen.getByTestId('task-priority-niski')).toHaveAttribute(
        'aria-pressed',
        'true',
      );

      // Switch priority to 'wysoki'
      await user.click(screen.getByTestId('task-priority-wysoki'));
      expect(screen.getByTestId('task-priority-wysoki')).toHaveAttribute(
        'aria-pressed',
        'true',
      );

      // Fill title & description
      await user.type(
        screen.getByTestId('task-input-title'),
        '  Projekt z sieci komputerowych  ',
      );
      await user.type(
        screen.getByTestId('task-input-desc'),
        'Skonfigurować routing OSPF',
      );

      // Add tag via Enter key (must NOT submit form!)
      const tagInput = screen.getByTestId('task-input-tag');
      await user.type(tagInput, 'Sieci{Enter}');
      expect(screen.getByTestId('task-modal')).toBeInTheDocument();
      expect(screen.getByTestId('task-tag-chip-sieci')).toBeInTheDocument();
      expect(tagInput).toHaveValue('');

      // Attempt to add duplicate tag with different casing via button -> deduplicated
      await user.type(tagInput, '  sIeCi  ');
      await user.click(screen.getByTestId('task-btn-add-tag'));
      expect(screen.getAllByTestId('task-tag-chip-sieci')).toHaveLength(1);

      // Add second tag via button and a third tag that we then remove
      await user.type(tagInput, 'Lab');
      await user.click(screen.getByTestId('task-btn-add-tag'));
      await user.type(tagInput, 'Tymczasowy');
      await user.click(screen.getByTestId('task-btn-add-tag'));
      expect(
        screen.getByTestId('task-tag-chip-tymczasowy'),
      ).toBeInTheDocument();

      // Remove 'Tymczasowy' tag chip
      const removeTempBtn = within(
        screen.getByTestId('task-tag-chip-tymczasowy'),
      ).getByRole('button', { name: /Usuń tag Tymczasowy/i });
      await user.click(removeTempBtn);
      expect(
        screen.queryByTestId('task-tag-chip-tymczasowy'),
      ).not.toBeInTheDocument();

      // Save task
      await user.click(screen.getByTestId('task-btn-save'));

      expect(pinSoundSpy).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('task-modal')).not.toBeInTheDocument();

      const createdTask = getCtx().state.tasks.find((t) => t.id === 5);
      expect(createdTask).toBeDefined();
      expect(createdTask).toEqual({
        id: 5,
        tytul: 'Projekt z sieci komputerowych',
        opis: 'Skonfigurować routing OSPF',
        termin: addDaysToDateString(today, 3),
        priorytet: 'wysoki',
        wykonane: false,
        tagi: ['Sieci', 'Lab'],
      });
    });

    it('respects defaultZone variants (noDeadline, later, overdue) in create mode', () => {
      const today = getTodayDateString();

      // 1. noDeadline
      const { unmount: unmount1 } = renderM3Harness({
        initialActions: [
          {
            type: 'OPEN_MODAL',
            payload: { type: 'create', defaultZone: 'noDeadline' },
          },
        ],
      });
      expect(screen.getByTestId('task-checkbox-no-deadline')).toBeChecked();
      expect(screen.getByTestId('task-input-date')).toBeDisabled();
      unmount1();

      // 2. later (+14d)
      const { unmount: unmount2 } = renderM3Harness({
        initialActions: [
          {
            type: 'OPEN_MODAL',
            payload: { type: 'create', defaultZone: 'later' },
          },
        ],
      });
      expect(screen.getByTestId('task-input-date')).toHaveValue(
        addDaysToDateString(today, 14),
      );
      unmount2();

      // 3. overdue (-1d)
      const { unmount: unmount3 } = renderM3Harness({
        initialActions: [
          {
            type: 'OPEN_MODAL',
            payload: { type: 'create', defaultZone: 'overdue' },
          },
        ],
      });
      expect(screen.getByTestId('task-input-date')).toHaveValue(
        addDaysToDateString(today, -1),
      );
      unmount3();
    });

    it('pre-fills task fields in edit mode, saves changes, and preserves wykonane: true when editing a completed floorBall task', async () => {
      const user = userEvent.setup();
      const { getCtx } = renderM3Harness({
        initialActions: [
          {
            type: 'COMPLETE_TO_FLOOR',
            payload: { id: 1, originX: 200, originY: 180 },
          },
          {
            type: 'OPEN_MODAL',
            payload: { type: 'edit', taskId: 1 },
          },
        ],
      });

      // Verify Task #1 is currently completed and on the floor
      expect(getCtx().state.tasks.find((t) => t.id === 1)?.wykonane).toBe(true);
      expect(getCtx().floorBallIds.has(1)).toBe(true);

      const titleInput = screen.getByTestId('task-input-title');
      expect(titleInput).toHaveValue('Kolokwium z analizy matematycznej');

      await user.clear(titleInput);
      await user.type(titleInput, 'Kolokwium z analizy (poprawione)');
      await user.click(screen.getByTestId('task-priority-sredni'));
      await user.click(screen.getByTestId('task-checkbox-no-deadline'));
      await user.click(screen.getByTestId('task-btn-save'));

      expect(screen.queryByTestId('task-modal')).not.toBeInTheDocument();

      const updatedTask = getCtx().state.tasks.find((t) => t.id === 1)!;
      expect(updatedTask.tytul).toBe('Kolokwium z analizy (poprawione)');
      expect(updatedTask.priorytet).toBe('sredni');
      expect(updatedTask.termin).toBeNull();
      // CRITICAL invariant: editing a floorBall task must NOT reset wykonane to false!
      expect(updatedTask.wykonane).toBe(true);
      expect(getCtx().floorBallIds.has(1)).toBe(true);
    });

    it('closes on Cancel button, backdrop click, and Escape key, and safely returns null if edit taskId is missing', async () => {
      const user = userEvent.setup();
      const { getCtx } = renderM3Harness({
        initialActions: [{ type: 'OPEN_MODAL', payload: { type: 'create' } }],
      });

      // 1. Cancel button
      await user.click(screen.getByTestId('task-btn-cancel'));
      expect(screen.queryByTestId('task-modal')).not.toBeInTheDocument();

      // 2. Backdrop click
      act(() => {
        getCtx().dispatch({ type: 'OPEN_MODAL', payload: { type: 'create' } });
      });
      const modalBackdrop = screen.getByTestId('task-modal');
      fireEvent.click(modalBackdrop);
      expect(screen.queryByTestId('task-modal')).not.toBeInTheDocument();

      // 3. Escape key
      act(() => {
        getCtx().dispatch({ type: 'OPEN_MODAL', payload: { type: 'create' } });
      });
      expect(screen.getByTestId('task-modal')).toBeInTheDocument();
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByTestId('task-modal')).not.toBeInTheDocument();

      // 4. Non-existent taskId in edit mode -> safely renders null without throwing
      act(() => {
        getCtx().dispatch({
          type: 'OPEN_MODAL',
          payload: { type: 'edit', taskId: 9999 },
        });
      });
      expect(screen.queryByTestId('task-modal')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // 3. ContextMenu Tests
  // =========================================================================
  describe('ContextMenu component', () => {
    it('renders note context menu items, highlights current priority, changes priority with sound + closes menu, completes to floor, opens task preview, and deletes task', async () => {
      const user = userEvent.setup();
      const pinSoundSpy = vi.spyOn(soundUtils, 'playPinClickSound');
      const crumpleSoundSpy = vi.spyOn(soundUtils, 'playCrumpleSound');

      const { getCtx } = renderM3Harness({
        initialActions: [
          {
            type: 'OPEN_CONTEXT_MENU',
            payload: { kind: 'note', taskId: 1, x: 150, y: 160 },
          },
        ],
      });

      const menu = screen.getByTestId('context-menu');
      expect(menu).toBeInTheDocument();
      expect(
        screen.getByTestId('context-menu-priority-wysoki'),
      ).toHaveAttribute('aria-current', 'true');
      expect(
        screen.getByTestId('context-menu-priority-niski'),
      ).not.toHaveAttribute('aria-current');

      // 1. Change priority via PPM -> plays pin click sound, updates priority, AND closes context menu
      await user.click(screen.getByTestId('context-menu-priority-niski'));
      expect(pinSoundSpy).toHaveBeenCalledTimes(1);
      expect(getCtx().state.tasks.find((t) => t.id === 1)?.priorytet).toBe(
        'niski',
      );
      expect(screen.queryByTestId('context-menu')).not.toBeInTheDocument();

      // 2. Complete task to floor via PPM
      act(() => {
        getCtx().dispatch({
          type: 'OPEN_CONTEXT_MENU',
          payload: { kind: 'note', taskId: 1, x: 240, y: 260 },
        });
      });
      await user.click(screen.getByTestId('context-menu-complete'));
      expect(crumpleSoundSpy).toHaveBeenCalledTimes(1);
      expect(getCtx().state.tasks.find((t) => t.id === 1)?.wykonane).toBe(true);
      expect(getCtx().floorBallIds.has(1)).toBe(true);
      expect(screen.queryByTestId('context-menu')).not.toBeInTheDocument();

      // 3. Edit task via PPM on note #2
      act(() => {
        getCtx().dispatch({
          type: 'OPEN_CONTEXT_MENU',
          payload: { kind: 'note', taskId: 2, x: 100, y: 100 },
        });
      });
      await user.click(screen.getByTestId('context-menu-view'));
      expect(screen.queryByTestId('context-menu')).not.toBeInTheDocument();
      expect(screen.getByTestId('task-modal')).toBeInTheDocument();
      expect(screen.queryByTestId('task-input-title')).not.toBeInTheDocument();
      await user.click(screen.getByTestId('task-btn-edit'));
      expect(screen.getByTestId('task-input-title')).toHaveValue(
        'Kupić kawę do akademika',
      );

      // Close modal and test permanent delete via PPM on note #3
      await user.click(screen.getByTestId('task-btn-cancel'));
      act(() => {
        getCtx().dispatch({
          type: 'OPEN_CONTEXT_MENU',
          payload: { kind: 'note', taskId: 3, x: 120, y: 120 },
        });
      });
      await user.click(screen.getByTestId('context-menu-delete'));
      expect(
        screen.getByTestId('context-menu-delete-confirmation'),
      ).toHaveTextContent('Czy na pewno?');
      await user.click(screen.getByTestId('context-menu-delete-cancel'));
      expect(
        screen.queryByTestId('context-menu-delete-confirmation'),
      ).not.toBeInTheDocument();
      expect(
        getCtx().state.tasks.find((t) => t.id === 3),
      ).toBeDefined();

      await user.click(screen.getByTestId('context-menu-delete'));
      await user.click(screen.getByTestId('context-menu-delete-confirm'));
      expect(
        getCtx().state.tasks.find((t) => t.id === 3),
      ).toBeUndefined();
      expect(screen.queryByTestId('context-menu')).not.toBeInTheDocument();
    });

    it('renders floorBall context menu items and handles drop-trash, restore, edit, and delete', async () => {
      const user = userEvent.setup();
      const plopSoundSpy = vi.spyOn(soundUtils, 'playTrashPlopSound');
      const restoreSoundSpy = vi.spyOn(soundUtils, 'playRestoreSound');

      const { getCtx } = renderM3Harness({
        initialActions: [
          {
            type: 'COMPLETE_TO_FLOOR',
            payload: { id: 1, originX: 200, originY: 200 },
          },
          {
            type: 'COMPLETE_TO_FLOOR',
            payload: { id: 2, originX: 300, originY: 200 },
          },
          {
            type: 'COMPLETE_TO_FLOOR',
            payload: { id: 3, originX: 400, originY: 200 },
          },
          {
            type: 'OPEN_CONTEXT_MENU',
            payload: { kind: 'floorBall', taskId: 1, x: 200, y: 500 },
          },
        ],
      });

      // 1. Drop floor ball #1 into trash
      await user.click(screen.getByTestId('context-menu-drop-trash'));
      expect(plopSoundSpy).toHaveBeenCalledTimes(1);
      expect(getCtx().floorBallIds.has(1)).toBe(false);
      expect(getCtx().inTrashTasks.some((t) => t.id === 1)).toBe(true);
      expect(screen.queryByTestId('context-menu')).not.toBeInTheDocument();

      // 2. Restore floor ball #2 back to corkboard
      act(() => {
        getCtx().dispatch({
          type: 'OPEN_CONTEXT_MENU',
          payload: { kind: 'floorBall', taskId: 2, x: 300, y: 500 },
        });
      });
      await user.click(screen.getByTestId('context-menu-restore'));
      expect(restoreSoundSpy).toHaveBeenCalledTimes(1);
      expect(getCtx().floorBallIds.has(2)).toBe(false);
      expect(getCtx().state.tasks.find((t) => t.id === 2)?.wykonane).toBe(
        false,
      );

      // 3. Delete floor ball #3 permanently
      act(() => {
        getCtx().dispatch({
          type: 'OPEN_CONTEXT_MENU',
          payload: { kind: 'floorBall', taskId: 3, x: 400, y: 500 },
        });
      });
      await user.click(screen.getByTestId('context-menu-delete'));
      expect(
        screen.getByTestId('context-menu-delete-confirmation'),
      ).toHaveTextContent('Czy na pewno?');
      await user.click(screen.getByTestId('context-menu-delete-confirm'));
      expect(getCtx().floorBallIds.has(3)).toBe(false);
      expect(
        getCtx().state.tasks.find((t) => t.id === 3),
      ).toBeUndefined();
    });

    it('renders trashBall context menu items (view, restore & delete) and executes actions cleanly', async () => {
      const user = userEvent.setup();
      const restoreSoundSpy = vi.spyOn(soundUtils, 'playRestoreSound');

      const { getCtx } = renderM3Harness({
        initialActions: [
          {
            type: 'OPEN_CONTEXT_MENU',
            payload: { kind: 'trashBall', taskId: 4, x: 500, y: 400 },
          },
        ],
      });

      expect(screen.getByTestId('context-menu-view')).toBeInTheDocument();
      expect(screen.getByTestId('context-menu-restore')).toBeInTheDocument();
      expect(screen.getByTestId('context-menu-delete')).toBeInTheDocument();
      expect(
        screen.queryByTestId('context-menu-complete'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('context-menu-drop-trash'),
      ).not.toBeInTheDocument();

      await user.click(screen.getByTestId('context-menu-view'));
      expect(screen.getByTestId('task-modal')).toBeInTheDocument();
      expect(screen.getByTestId('task-view-title')).toHaveTextContent(
        getCtx().state.tasks.find((t) => t.id === 4)?.tytul ?? '',
      );
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByTestId('task-modal')).not.toBeInTheDocument();

      act(() => {
        getCtx().dispatch({
          type: 'OPEN_CONTEXT_MENU',
          payload: { kind: 'trashBall', taskId: 4, x: 500, y: 400 },
        });
      });
      await user.click(screen.getByTestId('context-menu-restore'));
      expect(restoreSoundSpy).toHaveBeenCalledTimes(1);
      expect(
        getCtx().state.tasks.find((t) => t.id === 4)?.wykonane,
      ).toBe(false);
      expect(screen.queryByTestId('context-menu')).not.toBeInTheDocument();
    });

    it('renders cell context menu with single create option and opens TaskModal with prefilled priority and deadline (and empty title)', async () => {
      const user = userEvent.setup();

      const { getCtx } = renderM3Harness({
        initialActions: [
          {
            type: 'OPEN_CONTEXT_MENU',
            payload: {
              kind: 'cell',
              priority: 'wysoki',
              zone: 'todayTomorrow',
              x: 300,
              y: 200,
            },
          },
        ],
      });

      const menu = screen.getByTestId('context-menu');
      expect(menu).toHaveAttribute('data-kind', 'cell');
      expect(within(menu).getAllByRole('menuitem')).toHaveLength(1);
      expect(screen.getByTestId('context-menu-create')).toHaveTextContent(
        'Utwórz nową notatkę',
      );
      expect(screen.queryByTestId('context-menu-view')).not.toBeInTheDocument();
      expect(screen.queryByTestId('context-menu-delete')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('context-menu-create'));

      expect(screen.queryByTestId('context-menu')).not.toBeInTheDocument();
      expect(screen.getByTestId('task-modal')).toBeInTheDocument();
      expect(screen.getByTestId('task-input-title')).toHaveValue('');
      expect(screen.getByTestId('task-input-desc')).toHaveValue('');
      expect(screen.getByTestId('task-priority-wysoki')).toHaveAttribute(
        'data-active',
        'true',
      );
      expect(screen.getByTestId('task-input-date')).toHaveValue(
        getTodayDateString(),
      );
      expect(
        screen.getByTestId('task-checkbox-no-deadline'),
      ).not.toBeChecked();

      // Also verify noDeadline cell shortcut
      fireEvent.keyDown(window, { key: 'Escape' });
      act(() => {
        getCtx().dispatch({
          type: 'OPEN_CONTEXT_MENU',
          payload: {
            kind: 'cell',
            priority: 'niski',
            zone: 'noDeadline',
            x: 350,
            y: 250,
          },
        });
      });
      await user.click(screen.getByTestId('context-menu-create'));
      expect(screen.getByTestId('task-input-title')).toHaveValue('');
      expect(screen.getByTestId('task-priority-niski')).toHaveAttribute(
        'data-active',
        'true',
      );
      expect(screen.getByTestId('task-checkbox-no-deadline')).toBeChecked();
    });

    it('clamps coordinates inside viewport boundaries near right/bottom and negative edges, and dismisses on outside click, Escape, scroll, and resize', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 1024,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(window, 'innerHeight', {
        value: 768,
        configurable: true,
        writable: true,
      });

      const { getCtx } = renderM3Harness({
        initialActions: [
          {
            type: 'OPEN_CONTEXT_MENU',
            payload: { kind: 'note', taskId: 1, x: 1400, y: 950 },
          },
        ],
      });

      const menu = screen.getByTestId('context-menu');
      const leftPx = Number.parseFloat(menu.style.left);
      const topPx = Number.parseFloat(menu.style.top);
      // Fallback width 220, height 240, padding 8 -> maxLeft = 1024 - 220 - 8 = 796, maxTop = 768 - 240 - 8 = 520
      expect(leftPx).toBeLessThanOrEqual(796);
      expect(topPx).toBeLessThanOrEqual(520);

      // Negative coordinates clamp to padding (8px)
      act(() => {
        getCtx().dispatch({
          type: 'OPEN_CONTEXT_MENU',
          payload: { kind: 'note', taskId: 1, x: -40, y: -25 },
        });
      });
      expect(Number.parseFloat(screen.getByTestId('context-menu').style.left)).toBe(8);
      expect(Number.parseFloat(screen.getByTestId('context-menu').style.top)).toBe(8);

      // Outside mousedown dismisses menu
      fireEvent.mouseDown(document.body);
      expect(screen.queryByTestId('context-menu')).not.toBeInTheDocument();

      // Escape key dismisses menu
      act(() => {
        getCtx().dispatch({
          type: 'OPEN_CONTEXT_MENU',
          payload: { kind: 'note', taskId: 1, x: 100, y: 100 },
        });
      });
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByTestId('context-menu')).not.toBeInTheDocument();

      // Scroll dismisses menu
      act(() => {
        getCtx().dispatch({
          type: 'OPEN_CONTEXT_MENU',
          payload: { kind: 'note', taskId: 1, x: 100, y: 100 },
        });
      });
      fireEvent.scroll(window);
      expect(screen.queryByTestId('context-menu')).not.toBeInTheDocument();

      // Resize dismisses menu
      act(() => {
        getCtx().dispatch({
          type: 'OPEN_CONTEXT_MENU',
          payload: { kind: 'note', taskId: 1, x: 100, y: 100 },
        });
      });
      fireEvent(window, new Event('resize'));
      expect(screen.queryByTestId('context-menu')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // 4. Toast Tests
  // =========================================================================
  describe('Toast component', () => {
    it('renders success, error, and info variants with optional details list and supports manual dismiss', () => {
      const { getCtx } = renderM3Harness({
        initialActions: [
          {
            type: 'SHOW_TOAST',
            payload: {
              type: 'error',
              text: 'Plik JSON zawiera błędy struktury zadań.',
              details: [
                'Zadanie #1: pole "tytul" musi być niepustym tekstem.',
                'Zadanie #2: nieprawidłowy priorytet.',
              ],
            },
          },
        ],
      });

      const toast = screen.getByTestId('toast-notification');
      expect(toast).toHaveAttribute('data-toast-type', 'error');
      expect(toast).toHaveTextContent(
        'Plik JSON zawiera błędy struktury zadań.',
      );

      const detailsList = screen.getByTestId('toast-details');
      expect(within(detailsList).getAllByRole('listitem')).toHaveLength(2);

      // Manual close button
      fireEvent.click(screen.getByTestId('toast-close-btn'));
      expect(
        screen.queryByTestId('toast-notification'),
      ).not.toBeInTheDocument();
      expect(getCtx().state.toast).toBeNull();
    });

    it('auto-dismisses after 3500ms for success/info, 6000ms for error, and resets timer when a new toast is shown', () => {
      vi.useFakeTimers();

      const { getCtx } = renderM3Harness({
        initialActions: [
          {
            type: 'SHOW_TOAST',
            payload: {
              type: 'info',
              text: 'Pierwszy komunikat info',
            },
          },
        ],
      });

      expect(screen.getByTestId('toast-notification')).toHaveTextContent(
        'Pierwszy komunikat info',
      );

      // Advance 2000ms (not yet 3500ms) -> still visible
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(screen.getByTestId('toast-notification')).toBeInTheDocument();

      // Replace with another success toast at t=2000ms -> timer resets to a full 3500ms
      act(() => {
        getCtx().dispatch({
          type: 'SHOW_TOAST',
          payload: {
            type: 'success',
            text: 'Drugi komunikat sukcesu',
          },
        });
      });
      expect(screen.getByTestId('toast-notification')).toHaveTextContent(
        'Drugi komunikat sukcesu',
      );

      // Advance 2000ms (total 4000ms from start, but only 2000ms since replacement) -> still visible!
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(screen.getByTestId('toast-notification')).toBeInTheDocument();

      // Advance remaining 1500ms -> auto-dismisses
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(
        screen.queryByTestId('toast-notification'),
      ).not.toBeInTheDocument();

      // Show an error toast (note: toast.id restarts at 1 after null) -> stays for 6000ms
      act(() => {
        getCtx().dispatch({
          type: 'SHOW_TOAST',
          payload: {
            type: 'error',
            text: 'Błąd walidacji pliku',
          },
        });
      });
      expect(screen.getByTestId('toast-notification')).toHaveTextContent(
        'Błąd walidacji pliku',
      );

      // At 4000ms error toast is still visible
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(screen.getByTestId('toast-notification')).toBeInTheDocument();

      // At 6000ms error toast auto-dismisses
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(
        screen.queryByTestId('toast-notification'),
      ).not.toBeInTheDocument();
    });
  });
});
