import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  Plus,
  Search,
  X,
  Upload,
  Download,
  Archive,
  Volume2,
  VolumeX,
  Filter,
  Eye,
  RotateCcw,
  Pin,
  ChevronDown,
  FileText,
} from 'lucide-react';
import { useTasks } from '../context/TaskContext';
import { getTagColor, normalizeTag } from '../utils/tagColors';
import {
  validateAndParseTasksJson,
  serializeTasksFile,
  downloadJsonFile,
} from '../utils/jsonIO';
import { unlockAudioContext } from '../utils/sound';

async function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return await file.text();
  }
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () =>
      reject(reader.error ?? new Error('Błąd odczytu pliku'));
    reader.readAsText(file, 'utf-8');
  });
}

export function TopBar() {
  const { state, dispatch, allTags } = useTasks();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const filesMenuRef = useRef<HTMLDivElement | null>(null);
  const filesMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const [isFilesMenuOpen, setIsFilesMenuOpen] = useState(false);

  const { searchQuery, selectedTags, filterMode } = state.filters;
  const hasActiveFilters = searchQuery.length > 0 || selectedTags.length > 0;

  useEffect(() => {
    if (!isFilesMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !filesMenuRef.current?.contains(event.target)
      ) {
        setIsFilesMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFilesMenuOpen(false);
        filesMenuButtonRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    filesMenuRef.current
      ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
      ?.focus();

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFilesMenuOpen]);

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    dispatch({
      type: 'SET_SEARCH_QUERY',
      payload: { query: e.target.value },
    });
  };

  const handleClearSearch = () => {
    dispatch({
      type: 'SET_SEARCH_QUERY',
      payload: { query: '' },
    });
  };

  const handleToggleTag = (tag: string) => {
    dispatch({
      type: 'TOGGLE_TAG_FILTER',
      payload: { tag },
    });
  };

  const handleSetFilterMode = (mode: 'filter' | 'highlight') => {
    dispatch({
      type: 'SET_FILTER_MODE',
      payload: { mode },
    });
  };

  const handleResetFilters = () => {
    dispatch({ type: 'RESET_FILTERS' });
  };

  const handleOpenCreateModal = () => {
    dispatch({
      type: 'OPEN_MODAL',
      payload: { type: 'create' },
    });
  };

  const handleTriggerImport = () => {
    setIsFilesMenuOpen(false);
    fileInputRef.current?.click();
  };

  const closeFilesMenu = () => {
    setIsFilesMenuOpen(false);
    filesMenuButtonRef.current?.focus();
  };

  const handleFileImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    try {
      let rawText: string;
      try {
        rawText = await readFileText(file);
      } catch {
        dispatch({
          type: 'SHOW_TOAST',
          payload: {
            type: 'error',
            text: 'Nie udało się odczytać wybranego pliku JSON.',
          },
        });
        return;
      }

      const result = validateAndParseTasksJson(rawText);
      if (!result.ok) {
        dispatch({
          type: 'SHOW_TOAST',
          payload: {
            type: 'error',
            text: result.error,
            details: result.details.length > 0 ? result.details : undefined,
          },
        });
        return;
      }

      dispatch({
        type: 'LOAD_TASKS_FILE',
        payload: { file: result.data },
      });

      const taskCount = result.data.zadania.length;
      const warningCount = result.warnings.length;
      const toastText =
        warningCount > 0
          ? `Wczytano ${taskCount} zadań z pliku „${file.name}” (ostrzeżenia: ${warningCount}).`
          : `Wczytano ${taskCount} zadań z pliku „${file.name}”.`;

      dispatch({
        type: 'SHOW_TOAST',
        payload: {
          type: 'success',
          text: toastText,
          details:
            warningCount > 0 ? result.warnings.slice(0, 10) : undefined,
        },
      });
    } finally {
      input.value = '';
    }
  };

  const handleExportJson = () => {
    const content = serializeTasksFile(state.wersja, state.tasks);
    downloadJsonFile('zadania.json', content);
    dispatch({
      type: 'SHOW_TOAST',
      payload: {
        type: 'success',
        text: `Wyeksportowano ${state.tasks.length} zadań do pliku zadania.json.`,
      },
    });
  };

  const handleOpenArchive = () => {
    dispatch({
      type: 'OPEN_MODAL',
      payload: { type: 'archive' },
    });
  };

  const handleToggleMute = () => {
    if (state.muted) {
      unlockAudioContext(false);
    }
    dispatch({ type: 'TOGGLE_MUTE' });
  };

  return (
    <header
      data-testid="topbar"
      className="sticky top-0 z-30 w-full border-b-2 shadow-md select-none"
      style={{
        zIndex: 'var(--z-topbar)',
        backgroundColor: 'var(--color-wood-dark)',
        backgroundImage:
          'repeating-linear-gradient(178deg, rgba(255, 215, 160, 0.045) 0px, rgba(255, 215, 160, 0.045) 1px, transparent 2px, transparent 12px, rgba(20, 10, 4, 0.11) 15px, transparent 18px, transparent 31px), repeating-linear-gradient(180deg, transparent 0px, transparent 7px, rgba(21, 10, 4, 0.12) 8px, transparent 9px, transparent 14px), linear-gradient(180deg, rgba(34, 18, 8, 0.28), rgba(30, 14, 6, 0.45)), linear-gradient(180deg, #754a27 0%, #5a381e 48%, #472b16 100%)',
        borderBottomColor: 'var(--color-wood-highlight)',
        color: '#fef3c7',
      }}
    >
      <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-3 py-2 sm:px-4">
        {/* Top Row: Brand Title, Live Search, Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 border-b pb-2.5 sm:gap-3" style={{ borderBottomColor: 'rgba(218, 150, 78, 0.38)' }}>
          {/* Brand Title */}
          <div className="flex shrink-0 items-center gap-2.5">
            <span
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border shadow-inner"
              style={{
                backgroundColor: 'var(--color-wood-dark)',
                borderColor: 'var(--color-wood-highlight)',
              }}
              aria-hidden="true"
            >
              <Pin className="h-4 w-4 text-red-400 -rotate-12" />
            </span>
            <h1 className="whitespace-nowrap text-lg font-bold tracking-tight text-amber-50 drop-shadow-xs sm:text-xl">
              Praktyczna Tablica
            </h1>
          </div>

          {/* Live Search Input */}
          <div className="relative order-3 min-w-0 basis-full flex-1 sm:order-none sm:min-w-[180px] sm:basis-auto sm:max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-200/70"
              aria-hidden="true"
            />
            <input
              type="text"
              data-testid="search-input"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Szukaj zadań…"
              aria-label="Szukaj zadań"
              className="h-10 w-full rounded-md border py-1.5 pl-9 pr-8 text-sm text-amber-50 placeholder:text-amber-200/60 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-300/70"
              style={{
                backgroundColor: 'rgba(46, 32, 24, 0.75)',
                borderColor: 'var(--color-wood-highlight)',
              }}
            />
            {searchQuery.length > 0 && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Wyczyść wyszukiwanie"
                title="Wyczyść wyszukiwanie"
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-5 w-5 items-center justify-center rounded-full text-amber-200/80 hover:bg-amber-100/15 hover:text-amber-50 transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* + Nowe zadanie */}
            <button
              type="button"
              data-testid="btn-new-task"
              onClick={handleOpenCreateModal}
              className="inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold text-[#2b231d] shadow-sm transition-all hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-wood-dark)] active:scale-95 cursor-pointer"
              style={{
                backgroundColor: 'var(--color-note-medium-bg)',
                borderColor: 'var(--color-note-medium-border)',
                color: 'var(--color-ink)',
              }}
            >
              <Plus className="h-4 w-4 stroke-[2.5]" aria-hidden="true" />
              <span>Nowe zadanie</span>
            </button>

            {/* Hidden File Input for JSON Import */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              data-testid="import-json-input"
              onChange={handleFileImport}
              className="hidden"
              aria-label="Wybierz plik JSON z zadaniami"
            />

            {/* Archiwum */}
            <button
              type="button"
              data-testid="btn-open-archive"
              onClick={handleOpenArchive}
              className="inline-flex h-10 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium text-amber-50 transition-colors hover:bg-amber-100/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-wood-dark)] active:scale-95 cursor-pointer"
              style={{
                backgroundColor: 'rgba(46, 32, 24, 0.65)',
                borderColor: 'var(--color-wood-highlight)',
              }}
              title="Przeglądaj archiwum opróżnionych zadań"
            >
              <Archive className="h-4 w-4 text-amber-200" aria-hidden="true" />
              <span>Archiwum</span>
              {state.archive.length > 0 && (
                <span
                  data-testid="archive-count-badge"
                  className="ml-0.5 inline-flex items-center justify-center rounded-full px-1.5 py-0.2 text-[11px] font-bold leading-tight"
                  style={{
                    backgroundColor: 'var(--color-cork-light)',
                    color: 'var(--color-ink)',
                  }}
                >
                  {state.archive.length}
                </span>
              )}
            </button>

            {/* Files Menu */}
            <div className="relative" ref={filesMenuRef}>
            <button
              ref={filesMenuButtonRef}
              type="button"
              data-testid="btn-files-menu"
              aria-haspopup="menu"
              aria-expanded={isFilesMenuOpen}
              aria-controls="files-menu"
              onClick={() => setIsFilesMenuOpen((open) => !open)}
              className="inline-flex h-10 items-center gap-2 rounded-md border px-2.5 text-sm font-medium text-amber-50 transition-colors hover:bg-amber-100/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-wood-dark)] cursor-pointer"
              style={{
                backgroundColor: 'rgba(46, 32, 24, 0.65)',
                borderColor: 'var(--color-wood-highlight)',
              }}
            >
              <FileText className="h-4 w-4 text-amber-200" aria-hidden="true" />
              <span>Pliki</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${isFilesMenuOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>
            {isFilesMenuOpen && (
              <div
                id="files-menu"
                role="menu"
                aria-label="Pliki"
                className="absolute right-0 top-full z-50 mt-1 flex min-w-44 flex-col gap-1 rounded-md border p-1.5 text-sm shadow-xl"
                style={{
                  backgroundColor: 'var(--color-wood-dark)',
                  borderColor: 'var(--color-wood-highlight)',
                }}
              >
                <button
                  type="button"
                  role="menuitem"
                  data-testid="btn-import-json"
                  onClick={handleTriggerImport}
                  className="inline-flex h-9 items-center gap-2 rounded px-2 text-left text-amber-50 transition-colors hover:bg-amber-100/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 cursor-pointer"
                >
                  <Upload className="h-4 w-4 text-amber-200" aria-hidden="true" />
                  <span>Wczytaj JSON</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  data-testid="btn-export-json"
                  onClick={() => {
                    closeFilesMenu();
                    handleExportJson();
                  }}
                  className="inline-flex h-9 items-center gap-2 rounded px-2 text-left text-amber-50 transition-colors hover:bg-amber-100/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 cursor-pointer"
                >
                  <Download className="h-4 w-4 text-amber-200" aria-hidden="true" />
                  <span>Eksportuj JSON</span>
                </button>
              </div>
            )}
            </div>

            {/* Mute / Unmute Toggle */}
            <button
              type="button"
              data-testid="btn-toggle-mute"
              onClick={handleToggleMute}
              aria-pressed={state.muted}
              data-muted={state.muted ? 'true' : 'false'}
              aria-label={state.muted ? 'Włącz dźwięki' : 'Wycisz dźwięki'}
              title={
                state.muted
                  ? 'Dźwięki wyciszone (kliknij, aby włączyć)'
                  : 'Dźwięki włączone (kliknij, aby wyciszyć)'
              }
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border text-amber-100 transition-colors hover:bg-amber-100/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-wood-dark)] active:scale-95 cursor-pointer"
              style={{
                backgroundColor: state.muted
                  ? 'rgba(198, 40, 40, 0.35)'
                  : 'rgba(46, 32, 24, 0.65)',
                borderColor: state.muted
                  ? '#ef5350'
                  : 'var(--color-wood-highlight)',
              }}
            >
              {state.muted ? (
                <VolumeX className="h-4 w-4 text-red-300" aria-hidden="true" />
              ) : (
                <Volume2
                  className="h-4 w-4 text-amber-200"
                  aria-hidden="true"
                />
              )}
            </button>
          </div>
        </div>

        {/* Second Row: Push-pin / Tag Filter Bar + Filter Mode Toggle + Quick Reset */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-xs">
          {/* Tag Pin Chips */}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="whitespace-nowrap font-medium text-amber-200/80">
              Filtruj po tagach
            </span>
            {allTags.length === 0 ? (
              <span className="italic text-amber-200/50">
                Brak tagów na aktywnych zadaniach
              </span>
            ) : (
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {allTags.map((tag) => {
                  const normalized = normalizeTag(tag);
                  const color = getTagColor(normalized);
                  const isSelected = selectedTags.includes(normalized);

                  return (
                    <button
                      key={normalized}
                      type="button"
                      data-testid={`tag-filter-${normalized}`}
                      data-active={isSelected ? 'true' : 'false'}
                      aria-pressed={isSelected}
                      onClick={() => handleToggleTag(normalized)}
                      title={`Filtruj po tagu: ${normalized} (${color.name})`}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold text-[#2b231d] shadow-sm transition-colors hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-wood-dark)] cursor-pointer"
                      style={{
                        backgroundColor: isSelected ? '#fff3a1' : '#fff3d6',
                        borderColor: isSelected ? '#4a2d16' : '#e5d2a8',
                        boxShadow: isSelected
                          ? '0 0 0 1px #4a2d16, 0 2px 4px rgba(0, 0, 0, 0.25)'
                          : '0 2px 4px rgba(0, 0, 0, 0.2)',
                      }}
                    >
                      <span
                        className="relative inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center"
                        aria-hidden="true"
                      >
                        <span className="absolute bottom-0 h-1 w-1.5 rounded-full bg-black/35" />
                        <span
                          className="relative z-10 h-3.5 w-3.5 rounded-full border"
                          style={{
                            background: `radial-gradient(circle at 32% 30%, ${color.light} 0%, ${color.bg} 55%, ${color.dark} 100%)`,
                            borderColor: color.dark,
                            boxShadow:
                              '0 2px 3px rgba(0, 0, 0, 0.38), inset 0 1px 1.5px rgba(255, 255, 255, 0.65)',
                          }}
                        >
                          <span className="absolute left-[3px] top-[2px] h-1 w-1 rounded-full bg-white/80" />
                        </span>
                      </span>
                      <span>{normalized}</span>
                      <span
                        data-testid={`tag-filter-indicator-${normalized}`}
                        className={`inline-flex w-3 justify-center text-sm leading-none ${isSelected ? 'opacity-100' : 'opacity-0'}`}
                        aria-hidden="true"
                      >
                        ✓
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Filter Mode Toggle & Quick Reset */}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Tryb filtrowania"
              className="inline-flex items-center rounded-md border p-0.5"
              style={{
                backgroundColor: 'rgba(46, 32, 24, 0.65)',
                borderColor: 'var(--color-wood-highlight)',
              }}
            >
              <button
                type="button"
                data-testid="filter-mode-hide"
                data-mode={filterMode}
                aria-pressed={filterMode === 'filter'}
                onClick={() => handleSetFilterMode('filter')}
                className="inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-wood-dark)] cursor-pointer"
                style={{
                  backgroundColor:
                    filterMode === 'filter' ? 'var(--color-cork-light)' : 'transparent',
                  color:
                    filterMode === 'filter' ? 'var(--color-ink)' : '#fef3c7',
                }}
              >
                <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Ukryj</span>
              </button>
              <button
                type="button"
                data-testid="filter-mode-highlight"
                data-mode={filterMode}
                aria-pressed={filterMode === 'highlight'}
                onClick={() => handleSetFilterMode('highlight')}
                className="inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-wood-dark)] cursor-pointer"
                style={{
                  backgroundColor:
                    filterMode === 'highlight' ? 'var(--color-cork-light)' : 'transparent',
                  color:
                    filterMode === 'highlight' ? 'var(--color-ink)' : '#fef3c7',
                }}
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Podświetl</span>
              </button>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                data-testid="tag-filter-reset"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold text-amber-950 transition-all hover:brightness-105 cursor-pointer"
                style={{
                  backgroundColor: 'var(--color-cork-light)',
                  borderColor: 'var(--color-cork-base)',
                }}
                title="Wyczyść wyszukiwanie oraz wybrane tagi"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Resetuj filtry</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default TopBar;
