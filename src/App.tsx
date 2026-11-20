import { TaskProvider } from './context/TaskContext';
import { TopBar } from './components/TopBar';
import { Corkboard } from './components/Corkboard';
import { TrashCanWidget } from './components/TrashCanWidget';
import { FloorPhysicsLayer } from './components/FloorPhysicsLayer';
import { TaskModal } from './components/TaskModal';
import { TrashModal } from './components/TrashModal';
import { EmptySummaryModal } from './components/EmptySummaryModal';
import { ArchiveModal } from './components/ArchiveModal';
import { ContextMenu } from './components/ContextMenu';
import { Toast } from './components/Toast';

export default function App() {
  return (
    <TaskProvider>
      <div className="min-h-screen flex flex-col">
        <TopBar />
        <main className="flex-1 px-3 py-4 sm:px-6">
          <Corkboard />
        </main>
        <TrashCanWidget />
        <FloorPhysicsLayer />
        <TaskModal />
        <TrashModal />
        <EmptySummaryModal />
        <ArchiveModal />
        <ContextMenu />
        <Toast />
      </div>
    </TaskProvider>
  );
}
