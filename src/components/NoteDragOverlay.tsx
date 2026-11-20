import { motion } from 'motion/react';
import { useTasks } from '../context/TaskContext';
import { CrumpledBall } from './CrumpledBall';

const PRIORITY_CARD_BG: Record<string, string> = {
  wysoki: 'var(--color-note-high-bg)',
  sredni: 'var(--color-note-medium-bg)',
  niski: 'var(--color-note-low-bg)',
};

const PRIORITY_CARD_BORDER: Record<string, string> = {
  wysoki: 'var(--color-note-high-border)',
  sredni: 'var(--color-note-medium-border)',
  niski: 'var(--color-note-low-border)',
};

export function NoteDragOverlay() {
  const { noteDrag, activeTasks } = useTasks();

  if (!noteDrag) {
    return null;
  }

  const task = activeTasks.find((t) => t.id === noteDrag.taskId);
  if (!task) {
    return null;
  }

  return (
    <div
      data-testid="drag-note-overlay"
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        transform: `translate3d(${noteDrag.clientX}px, ${noteDrag.clientY}px, 0)`,
        pointerEvents: 'none',
        zIndex: 'var(--z-floor-physics)',
      }}
    >
      {noteDrag.isOverTrash ? (
        <motion.div
          key="crumpled-preview"
          data-testid="drag-note-crumpled-preview"
          initial={{ scale: 0.72, rotate: -18 }}
          animate={{ scale: 1.08, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 450, damping: 22 }}
          className="-translate-x-1/2 -translate-y-1/2 drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)]"
        >
          <CrumpledBall priority={task.priorytet} taskId={task.id} size={52} />
        </motion.div>
      ) : (
        <div
          data-testid="drag-note-card-preview"
          style={{
            backgroundColor: PRIORITY_CARD_BG[task.priorytet] ?? 'var(--color-note-medium-bg)',
            borderColor: PRIORITY_CARD_BORDER[task.priorytet] ?? 'var(--color-note-medium-border)',
          }}
          className="-translate-x-1/2 -translate-y-1/2 w-40 rotate-2 rounded-md border-2 p-2.5 text-xs text-[#2b231d] shadow-2xl opacity-95"
        >
          <div className="line-clamp-2 font-bold leading-snug">{task.tytul}</div>
          {task.opis.trim() !== '' && (
            <div className="mt-1 line-clamp-1 text-[10px] opacity-75">{task.opis}</div>
          )}
        </div>
      )}
    </div>
  );
}
