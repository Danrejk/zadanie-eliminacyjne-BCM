import { TaskProvider } from './context/TaskContext';
import { TopBar } from './components/TopBar';
import { Corkboard } from './components/Corkboard';
import { TrashCanWidget } from './components/TrashCanWidget';
import { TrashDrawer } from './components/TrashDrawer';
import { FloorPhysicsLayer } from './components/FloorPhysicsLayer';
import { NoteDragOverlay } from './components/NoteDragOverlay';
import { TaskModal } from './components/TaskModal';
import { EmptySummaryModal } from './components/EmptySummaryModal';
import { ArchiveModal } from './components/ArchiveModal';
import { ContextMenu } from './components/ContextMenu';
import { Toast } from './components/Toast';

export default function App() {
  return (
    <TaskProvider>
      <div className="min-h-screen flex flex-col">
        <TopBar />
        <main className="flex-1 px-3 py-4 m:px-6 overflow-x-clip">
          <Corkboard />
        </main>
        <TrashCanWidget />
        <TrashDrawer />
        <FloorPhysicsLayer />
        <NoteDragOverlay />
        <TaskModal />
        <EmptySummaryModal />
        <ArchiveModal />
        <ContextMenu />
        <Toast />
      </div>
    </TaskProvider>
  );
}
