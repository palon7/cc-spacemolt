import { useState } from 'react';
import { useGame } from '../contexts/GameContext';
import { TopBar } from './TopBar';
import { MobileTabBar, type TabKey } from './MobileTabBar';
import { ShipPanel } from './ShipPanel';
import { ShipDetailModal } from './ShipDetailModal';
import { ClaudePanel } from './ClaudePanel';
import { EventsPanel } from './EventsPanel';

export function Layout() {
  const { gameState, events, travelHistory } = useGame();
  const [mobileTab, setMobileTab] = useState<TabKey>('claude');
  const [showDetail, setShowDetail] = useState(false);

  return (
    <div className="h-dvh w-screen flex flex-col overflow-hidden">
      <TopBar />
      <MobileTabBar active={mobileTab} onChange={setMobileTab} />

      <div className="flex-1 overflow-hidden">
        {/* Desktop: 3-panel grid */}
        <div className="hidden md:grid md:grid-cols-12 gap-px bg-zinc-800 h-full">
          <div className="col-span-3 bg-zinc-900 overflow-hidden">
            {gameState ? (
              <ShipPanel
                state={gameState}
                travelHistory={travelHistory}
                onOpenDetail={() => setShowDetail(true)}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-zinc-600">
                Waiting for game data...
              </div>
            )}
          </div>
          <div className="col-span-5 bg-zinc-900 overflow-hidden">
            <ClaudePanel />
          </div>
          <div className="col-span-4 bg-zinc-900 overflow-hidden">
            <EventsPanel events={events} />
          </div>
        </div>

        {/* Mobile: tab switching */}
        <div className="md:hidden h-full bg-zinc-900">
          {mobileTab === 'ship' &&
            (gameState ? (
              <ShipPanel
                state={gameState}
                travelHistory={travelHistory}
                onOpenDetail={() => setShowDetail(true)}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-zinc-600">
                Waiting for game data...
              </div>
            ))}
          {mobileTab === 'claude' && <ClaudePanel />}
          {mobileTab === 'events' && <EventsPanel events={events} />}
        </div>
      </div>

      {showDetail && gameState && (
        <ShipDetailModal state={gameState} onClose={() => setShowDetail(false)} />
      )}
    </div>
  );
}
