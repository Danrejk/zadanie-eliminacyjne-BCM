import { useRef, type ChangeEvent } from 'react';
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
} from 'lucide-react';
import { useTasks } from '../context/TaskContext';
import { getTagColor, normalizeTag } from '../utils/tagColors';
import {
  validateAndParseTasksJson,
  serializeTasksFile,
  downloadJsonFile,
} from '../utils/jsonIO';

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

  const { searchQuery, selectedTags, filterMode } = state.filters;
  const hasActiveFilters = searchQuery.length > 0 || selectedTags.length > 0;

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

  const handleToggleFilterMode = () => {
    dispatch({
      type: 'SET_FILTER_MODE',
      payload: { mode: filterMode === 'filter' ? 'highlight' : 'filter' },
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
    fileInputRef.current?.click();
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
    dispatch({ type: 'TOGGLE_MUTE' });
  };

  return (
    <header
      data-testid="topbar"
      className="sticky top-0 z-30 w-full border-b-2 shadow-md select-none"
      style={{
        zIndex: 'var(--z-topbar)',
        background:
          'linear-gradient(180deg, var(--color-wood-frame) 0%, var(--color-wood-dark) 100%)',
        borderBottomColor: 'var(--color-wood-highlight)',
        color: '#fef3c7',
      }}
    >
      <div className="mx-auto max-w-[1600px] px-4 py-2.5 flex flex-col gap-2">
        {/* Top Row: Brand Title, Live Search, Primary Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Brand Title */}
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border shadow-inner"
              style={{
                backgroundColor: 'var(--color-wood-dark)',
                borderColor: 'var(--color-wood-highlight)',
              }}
              aria-hidden="true"
            >
              <Pin className="h-4 w-4 text-red-400 -rotate-12" />
            </span>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-amber-50 drop-shadow-xs">
              Tablica Korkowa
            </h1>
          </div>

          {/* Live Search Input */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-200/70"
              aria-hidden="true"
            />
            <input
              type="text"
              data-testid="search-input"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Szukaj w tytule lub opisie..."
              aria-label="Szukaj w tytule lub opisie"
              className="w-full rounded-lg border py-1.5 pl-9 pr-8 text-sm text-amber-50 placeholder:text-amber-200/60 focus:outline-none focus:ring-2 focus:ring-amber-300/70 transition-colors"
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
          <div className="flex flex-wrap items-center gap-2">
            {/* + Nowe zadanie */}
            <button
              type="button"
              data-testid="btn-new-task"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold shadow-xs transition-all hover:brightness-105 active:scale-95 cursor-pointer"
              style={{
                backgroundColor: 'var(--color-note-medium-bg)',
                borderColor: 'var(--color-note-medium-border)',
                color: 'var(--color-ink)',
              }}
            >
              <Plus className="h-4 w-4 stroke-[2.5]" aria-hidden="true" />
              <span>+ Nowe zadanie</span>
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

            {/* Wczytaj JSON */}
            <button
              type="button"
              data-testid="btn-import-json"
              onClick={handleTriggerImport}
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs sm:text-sm font-medium text-amber-50 transition-colors hover:bg-amber-100/15 active:scale-95 cursor-pointer"
              style={{
                backgroundColor: 'rgba(46, 32, 24, 0.65)',
                borderColor: 'var(--color-wood-highlight)',
              }}
              title="Wczytaj zadania z pliku JSON"
            >
              <Upload className="h-4 w-4 text-amber-200" aria-hidden="true" />
              <span>Wczytaj JSON</span>
            </button>

            {/* Eksportuj JSON */}
            <button
              type="button"
              data-testid="btn-export-json"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs sm:text-sm font-medium text-amber-50 transition-colors hover:bg-amber-100/15 active:scale-95 cursor-pointer"
              style={{
                backgroundColor: 'rgba(46, 32, 24, 0.65)',
                borderColor: 'var(--color-wood-highlight)',
              }}
              title="Zapisz zadania do pliku zadania.json"
            >
              <Download className="h-4 w-4 text-amber-200" aria-hidden="true" />
              <span>Eksportuj JSON</span>
            </button>

            {/* Archiwum */}
            <button
              type="button"
              data-testid="btn-open-archive"
              onClick={handleOpenArchive}
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs sm:text-sm font-medium text-amber-50 transition-colors hover:bg-amber-100/15 active:scale-95 cursor-pointer"
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
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-amber-100 transition-colors hover:bg-amber-100/15 active:scale-95 cursor-pointer"
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
        <div
          className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs"
          style={{ borderTopColor: 'rgba(139, 90, 43, 0.5)' }}
        >
          {/* Tag Pin Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-medium text-amber-200/80">
              Pinezki (tagi):
            </span>
            {allTags.length === 0 ? (
              <span className="italic text-amber-200/50">
                Brak tagów na aktywnych zadaniach
              </span>
            ) : (
              allTags.map((tag) => {
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
                    title={`Filtruj po tagu: #${normalized} (${color.name})`}
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all cursor-pointer"
                    style={
                      isSelected
                        ? {
                            backgroundColor: color.bg,
                            borderColor: '#fef3c7',
                            color: color.text,
                            boxShadow: '0 0 0 2px rgba(254, 243, 199, 0.45)',
                          }
                        : {
                            backgroundColor: 'rgba(46, 32, 24, 0.72)',
                            borderColor: color.bg,
                            color: '#fef3c7',
                          }
                    }
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                      style={{
                        background: `radial-gradient(circle at 35% 30%, ${color.light}, ${color.bg} 65%, ${color.dark})`,
                        border: `1px solid ${isSelected ? '#ffffff' : color.dark}`,
                      }}
                      aria-hidden="true"
                    />
                    <span>#{normalized}</span>
                  </button>
                );
              })
            )}
          </div>

          {/* Filter Mode Toggle & Quick Reset */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              data-testid="filter-mode-toggle"
              data-mode={filterMode}
              onClick={handleToggleFilterMode}
              title={
                filterMode === 'filter'
                  ? 'Tryb filtrowania: ukrywa niepasujące notatki (kliknij, aby przełączyć na podświetlanie)'
                  : 'Tryb podświetlania: przygasza niepasujące notatki (kliknij, aby przełączyć na ukrywanie)'
              }
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium text-amber-100 transition-colors hover:bg-amber-100/15 cursor-pointer"
              style={{
                backgroundColor: 'rgba(46, 32, 24, 0.65)',
                borderColor: 'var(--color-wood-highlight)',
              }}
            >
              {filterMode === 'filter' ? (
                <>
                  <Filter
                    className="h-3.5 w-3.5 text-amber-300"
                    aria-hidden="true"
                  />
                  <span>Tryb: Filtruj (ukryj inne)</span>
                </>
              ) : (
                <>
                  <Eye
                    className="h-3.5 w-3.5 text-amber-300"
                    aria-hidden="true"
                  />
                  <span>Tryb: Podświetl (przygaś inne)</span>
                </>
              )}
            </button>

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
