import { useState } from 'react';
import { useTelemetrySocket } from './hooks/useTelemetrySocket';
import { TopBar } from './components/TopBar';
import { Dashboard } from './components/Dashboard';
import { ReplayControls } from './components/replay/ReplayControls';
import { SessionBrowser } from './components/sessions/SessionBrowser';

export function App() {
  useTelemetrySocket();
  const [sessionsOpen, setSessionsOpen] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <TopBar onOpenSessions={() => setSessionsOpen(true)} />
      <main className="flex-1 overflow-y-auto">
        <Dashboard />
      </main>
      <ReplayControls />
      <SessionBrowser open={sessionsOpen} onClose={() => setSessionsOpen(false)} />
    </div>
  );
}
