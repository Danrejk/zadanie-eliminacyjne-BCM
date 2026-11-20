import {
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import {
  X,
  Plus,
  Calendar,
  Tag,
  Flag,
  Check,
  AlertCircle,
  Pin,
} from 'lucide-react';
import {
  PRIORITIES,
  type Priority,
  type TimeZone,
  type Task,
} from '../types/task';
import { useTasks } from '../context/TaskContext';
import {
  PRIORITY_LABELS,
  getTodayDateString,
  addDaysToDateString,
  isValidDateString,
  resolveDateForZoneDrop,
} from '../utils/dateBuckets';
import { getTagColor, normalizeTag } from '../utils/tagColors';
import { playPinClickSound } from '../utils/sound';
import { NotebookModal } from './NotebookModal';

interface InitialDeadlineState {
  noDeadline: boolean;
  dateValue: string;
}

function deduplicateTags(rawTags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of rawTags) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const norm = normalizeTag(trimmed);
    if (!seen.has(norm)) {
      seen.add(norm);
      result.push(trimmed);
    }
  }
  return result;
}

function getInitialDeadlineForCreate(
  defaultZone?: TimeZone,
): InitialDeadlineState {
  const today = getTodayDateString();
  if (defaultZone === 'noDeadline') {
    return { noDeadline: true, dateValue: '' };
  }
  if (defaultZone === 'overdue') {
    return {
      noDeadline: false,
      dateValue: addDaysToDateString(today, -1),
    };
  }
  if (defaultZone === 'thisWeek') {
    return {
      noDeadline: false,
      dateValue:
        resolveDateForZoneDrop(null, 'thisWeek', today) ??
        addDaysToDateString(today, 3),
    };
  }
  if (defaultZone === 'later') {
    return {
      noDeadline: false,
      dateValue:
        resolveDateForZoneDrop(null, 'later', today) ??
        addDaysToDateString(today, 14),
    };
  }
  return {
    noDeadline: false,
    dateValue: today,
  };
}

const PRIORITY_STYLE_VARS: Record<
  Priority,
  { bg: string; fold: string; border: string }
> = {
  wysoki: {
    bg: 'var(--color-note-high-bg)',
    fold: 'var(--color-note-high-fold)',
    border: 'var(--color-note-high-border)',
  },
  sredni: {
    bg: 'var(--color-note-medium-bg)',
    fold: 'var(--color-note-medium-fold)',
    border: 'var(--color-note-medium-border)',
  },
  niski: {
    bg: 'var(--color-note-low-bg)',
    fold: 'var(--color-note-low-fold)',
    border: 'var(--color-note-low-border)',
  },
};

interface TaskModalFormProps {
  mode: 'create' | 'edit';
  editingTask?: Task;
  defaultPriority?: Priority;
  defaultZone?: TimeZone;
  muted: boolean;
  onClose: () => void;
}

function TaskModalForm({
  mode,
  editingTask,
  defaultPriority,
  defaultZone,
  muted,
  onClose,
}: TaskModalFormProps) {
  const { dispatch } = useTasks();

  const initialDeadline =
    mode === 'edit' && editingTask
      ? {
          noDeadline: editingTask.termin === null,
          dateValue: editingTask.termin ?? '',
        }
      : getInitialDeadlineForCreate(defaultZone);

  const [title, setTitle] = useState<string>(
    mode === 'edit' && editingTask ? editingTask.tytul : '',
  );
  const [desc, setDesc] = useState<string>(
    mode === 'edit' && editingTask ? editingTask.opis : '',
  );
  const [noDeadline, setNoDeadline] = useState<boolean>(
    initialDeadline.noDeadline,
  );
  const [dateValue, setDateValue] = useState<string>(initialDeadline.dateValue);
  const [priority, setPriority] = useState<Priority>(
    mode === 'edit' && editingTask
      ? editingTask.priorytet
      : (defaultPriority ?? 'sredni'),
  );
  const [tags, setTags] = useState<string[]>(
    mode === 'edit' && editingTask ? deduplicateTags(editingTask.tagi) : [],
  );
  const [tagInput, setTagInput] = useState<string>('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  const handleNoDeadlineToggle = (checked: boolean) => {
    setNoDeadline(checked);
    setDateError(null);
    if (!checked && !isValidDateString(dateValue)) {
      setDateValue(getTodayDateString());
    }
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed) {
      setTagInput('');
      return;
    }
    const normalizedNew = normalizeTag(trimmed);
    const alreadyExists = tags.some(
      (existing) => normalizeTag(existing) === normalizedNew,
    );
    if (!alreadyExists) {
      setTags((prev) => [...prev, trimmed]);
    }
    setTagInput('');
  };

  const handleTagInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleAddTag();
    }
  };

  const handleRemoveTag = (normalizedTarget: string) => {
    setTags((prev) =>
      prev.filter((t) => normalizeTag(t) !== normalizedTarget),
    );
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmedTitle = title.trim();
    let hasError = false;

    if (trimmedTitle.length === 0) {
      setTitleError('Tytuł zadania jest wymagany i nie może być pusty.');
      hasError = true;
    } else {
      setTitleError(null);
    }

    if (!noDeadline) {
      if (!dateValue || !isValidDateString(dateValue)) {
        setDateError(
          'Podaj prawidłową datę w formacie RRRR-MM-DD lub zaznacz „Bez terminu”.',
        );
        hasError = true;
      } else {
        setDateError(null);
      }
    } else {
      setDateError(null);
    }

    if (hasError) {
      return;
    }

    const finalTermin = noDeadline ? null : dateValue;

    playPinClickSound(muted);

    if (mode === 'create') {
      dispatch({
        type: 'ADD_TASK',
        payload: {
          tytul: trimmedTitle,
          opis: desc,
          termin: finalTermin,
          priorytet: priority,
          wykonane: false,
          tagi: tags,
        },
      });
    } else if (mode === 'edit' && editingTask) {
      dispatch({
        type: 'UPDATE_TASK',
        payload: {
          id: editingTask.id,
          patch: {
            tytul: trimmedTitle,
            opis: desc,
            termin: finalTermin,
            priorytet: priority,
            tagi: tags,
          },
        },
      });
    }

    onClose();
  };

  const currentPriorityVars = PRIORITY_STYLE_VARS[priority];

  return (
    <NotebookModal
      isOpen
      onClose={onClose}
      testId="task-modal"
      labelledBy="task-modal-heading"
      maxWidthClass="max-w-lg"
      icon={
        <Pin
          className="h-5 w-5 text-red-600 -rotate-12 shrink-0"
          aria-hidden="true"
        />
      }
      title={mode === 'create' ? 'Nowe zadanie' : 'Edytuj zadanie'}
      closeAriaLabel="Zamknij okno zadania"
      topAccent={
        <div
          className="h-2.5 w-full transition-colors"
          style={{
            backgroundColor: currentPriorityVars.fold,
            borderBottom: `1px solid ${currentPriorityVars.border}`,
          }}
        />
      }
      onSubmit={handleSubmit}
      footer={
        <>
          <button
            type="button"
            data-testid="task-btn-cancel"
            onClick={onClose}
            className="notebook-surface rounded-lg border px-4 py-2 text-sm font-semibold transition-colors hover:bg-amber-900/10 cursor-pointer"
            style={{
              color: 'var(--color-ink)',
            }}
          >
            Anuluj
          </button>
          <button
            type="submit"
            data-testid="task-btn-save"
            className="rounded-lg border px-5 py-2 text-sm font-bold text-amber-50 shadow-sm transition-all hover:brightness-110 active:scale-95 cursor-pointer"
            style={{
              backgroundColor: 'var(--color-wood-frame)',
              borderColor: 'var(--color-wood-dark)',
            }}
          >
            {mode === 'create' ? 'Dodaj zadanie' : 'Zapisz zmiany'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Title Field */}
        <div>
          <label
            htmlFor="task-input-title"
            className="block text-xs font-bold uppercase tracking-wider mb-1"
            style={{ color: 'var(--color-ink-muted)' }}
          >
            Tytuł zadania <span className="text-red-600">*</span>
          </label>
          <input
            id="task-input-title"
            type="text"
            data-testid="task-input-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (titleError && e.target.value.trim().length > 0) {
                setTitleError(null);
              }
            }}
            placeholder="Np. Oddać sprawozdanie z laboratorium fizyki"
            autoFocus
            aria-invalid={titleError !== null}
            className="notebook-surface w-full rounded-lg border px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-600/50"
            style={{
              borderColor: titleError
                ? 'var(--color-stamp-red)'
                : undefined,
              color: 'var(--color-ink)',
            }}
          />
          {titleError && (
            <p
              data-testid="task-title-error"
              role="alert"
              className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold"
              style={{ color: 'var(--color-stamp-red)' }}
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{titleError}</span>
            </p>
          )}
        </div>

        {/* Description Field */}
        <div>
          <label
            htmlFor="task-input-desc"
            className="block text-xs font-bold uppercase tracking-wider mb-1"
            style={{ color: 'var(--color-ink-muted)' }}
          >
            Opis (opcjonalnie)
          </label>
          <textarea
            id="task-input-desc"
            data-testid="task-input-desc"
            rows={3}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Dodatkowe szczegóły, notatki, linki lub sala..."
            className="notebook-surface w-full rounded-lg border px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-amber-600/50"
            style={{
              color: 'var(--color-ink)',
            }}
          />
        </div>

        {/* Deadline & Bez terminu */}
        <div>
          <span
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-1.5"
            style={{ color: 'var(--color-ink-muted)' }}
          >
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Termin wykonania</span>
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="task-input-date"
              type="date"
              data-testid="task-input-date"
              aria-label="Termin wykonania"
              value={noDeadline ? '' : dateValue}
              disabled={noDeadline}
              onChange={(e) => {
                setDateValue(e.target.value);
                if (dateError && isValidDateString(e.target.value)) {
                  setDateError(null);
                }
              }}
              aria-invalid={dateError !== null}
              className={`${
                noDeadline ? 'notebook-surface-muted' : 'notebook-surface'
              } flex-1 min-w-[170px] rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-600/50`}
              style={{
                borderColor: dateError
                  ? 'var(--color-stamp-red)'
                  : undefined,
                color: 'var(--color-ink)',
              }}
            />

            <label
              htmlFor="task-checkbox-no-deadline"
              className="notebook-surface inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium select-none cursor-pointer transition-colors"
              style={{
                backgroundColor: noDeadline
                  ? 'rgba(200, 157, 108, 0.28)'
                  : undefined,
                color: 'var(--color-ink)',
              }}
            >
              <input
                id="task-checkbox-no-deadline"
                type="checkbox"
                data-testid="task-checkbox-no-deadline"
                checked={noDeadline}
                onChange={(e) => handleNoDeadlineToggle(e.target.checked)}
                className="h-4 w-4 accent-amber-800 rounded cursor-pointer"
              />
              <span>Bez terminu</span>
            </label>
          </div>
          {dateError && (
            <p
              data-testid="task-date-error"
              role="alert"
              className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold"
              style={{ color: 'var(--color-stamp-red)' }}
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{dateError}</span>
            </p>
          )}
        </div>

        {/* Priority Selector Buttons */}
        <div>
          <span
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-1.5"
            style={{ color: 'var(--color-ink-muted)' }}
          >
            <Flag className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Priorytet (kolor karteczki)</span>
          </span>
          <div className="grid grid-cols-3 gap-2.5">
            {PRIORITIES.map((p) => {
              const isSelected = priority === p;
              const vars = PRIORITY_STYLE_VARS[p];
              return (
                <button
                  key={p}
                  type="button"
                  data-testid={`task-priority-${p}`}
                  data-active={isSelected ? 'true' : 'false'}
                  aria-pressed={isSelected}
                  onClick={() => setPriority(p)}
                  className="flex items-center justify-center gap-1.5 rounded-lg border-2 py-2 px-3 text-sm font-bold transition-all cursor-pointer"
                  style={{
                    backgroundColor: isSelected ? vars.fold : vars.bg,
                    borderColor: isSelected
                      ? 'var(--color-wood-dark)'
                      : vars.border,
                    color: 'var(--color-ink)',
                    boxShadow: isSelected
                      ? '0 0 0 2px rgba(74, 45, 22, 0.25)'
                      : 'none',
                  }}
                >
                  {isSelected && (
                    <Check className="h-4 w-4 stroke-[2.5]" aria-hidden="true" />
                  )}
                  <span>{PRIORITY_LABELS[p]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tags Editor with Colored Push-Pin Preview */}
        <div>
          <label
            htmlFor="task-input-tag"
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-1.5"
            style={{ color: 'var(--color-ink-muted)' }}
          >
            <Tag className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Tagi (kolorowe pinezki)</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              id="task-input-tag"
              type="text"
              data-testid="task-input-tag"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagInputKeyDown}
              placeholder="Dodaj tag (np. studia, egzamin) i naciśnij Enter..."
              className="notebook-surface flex-1 rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/50"
              style={{
                color: 'var(--color-ink)',
              }}
            />
            <button
              type="button"
              data-testid="task-btn-add-tag"
              onClick={handleAddTag}
              className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors hover:brightness-95 cursor-pointer"
              style={{
                backgroundColor: 'var(--color-cork-light)',
                borderColor: 'var(--color-cork-dark)',
                color: 'var(--color-ink)',
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Dodaj tag</span>
            </button>
          </div>

          {/* Removable Tag Chips with Live Push-Pin Preview */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 min-h-[28px]">
            {tags.length === 0 ? (
              <span
                className="text-xs italic"
                style={{ color: 'var(--color-ink-muted)' }}
              >
                Brak tagów — notatka zostanie przypięta cienkim gwoździkiem
              </span>
            ) : (
              tags.map((tag) => {
                const normalized = normalizeTag(tag);
                const color = getTagColor(normalized);
                return (
                  <span
                    key={normalized}
                    data-testid={`task-tag-chip-${normalized}`}
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-2xs"
                    style={{
                      backgroundColor: color.bg,
                      borderColor: color.dark,
                      color: color.text,
                    }}
                    title={`Kolor pinezki: ${color.name}`}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                      style={{
                        background: `radial-gradient(circle at 35% 30%, ${color.light}, ${color.bg} 60%, ${color.dark})`,
                        border: '1px solid #ffffff',
                      }}
                      aria-hidden="true"
                    />
                    <span>#{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(normalized)}
                      aria-label={`Usuń tag ${tag}`}
                      title={`Usuń tag ${tag}`}
                      className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-black/20 transition-colors cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })
            )}
          </div>
        </div>
      </div>
    </NotebookModal>
  );
}

export function TaskModal() {
  const { state, dispatch } = useTasks();
  const { activeModal } = state;

  const isOpen =
    activeModal.type === 'create' || activeModal.type === 'edit';

  const editingTask =
    activeModal.type === 'edit'
      ? state.tasks.find((t) => t.id === activeModal.taskId)
      : undefined;

  if (!isOpen) {
    return null;
  }

  // Edit mode safety guard: if target task does not exist, safely render null without crashing
  if (activeModal.type === 'edit' && !editingTask) {
    return null;
  }

  const handleClose = () => {
    dispatch({ type: 'CLOSE_MODAL' });
  };

  const modalKey =
    activeModal.type === 'create'
      ? `create-${activeModal.defaultPriority ?? 'sredni'}-${activeModal.defaultZone ?? 'default'}`
      : `edit-${editingTask!.id}`;

  return (
    <TaskModalForm
      key={modalKey}
      mode={activeModal.type}
      editingTask={editingTask}
      defaultPriority={
        activeModal.type === 'create'
          ? activeModal.defaultPriority
          : undefined
      }
      defaultZone={
        activeModal.type === 'create' ? activeModal.defaultZone : undefined
      }
      muted={state.muted}
      onClose={handleClose}
    />
  );
}

export default TaskModal;
