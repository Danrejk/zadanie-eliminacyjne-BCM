import { TaskProvider, useTasks } from './context/TaskContext';

function AppShell() {
  const { activeTasks, completedTasks } = useTasks();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-amber-50">
      <h1 className="text-2xl font-bold tracking-tight">Tablica Korkowa</h1>
      <p className="mt-2 text-sm text-amber-200/80">
        Aktywne: {activeTasks.length} · Ukończone: {completedTasks.length}
      </p>
    </main>
  );
}

export default function App() {
  return (
    <TaskProvider>
      <AppShell />
    </TaskProvider>
  );
}
