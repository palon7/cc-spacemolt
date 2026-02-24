import { useState, useEffect } from 'react';
import type { GameState, GameConnectionStatus } from '@cc-spacemolt/shared';
import { getVersion } from '../utils/version';

interface TopBarProps {
  connected: boolean;
  gameStatus: { status: GameConnectionStatus; message?: string };
  gameState: GameState | null;
}

const gameIndicator: Record<GameConnectionStatus, { dot: string; text: string; label: string }> = {
  connecting: {
    dot: 'bg-amber-400 animate-pulse',
    text: 'text-amber-500',
    label: 'Connecting',
  },
  connected: {
    dot: 'bg-emerald-400',
    text: 'text-emerald-500',
    label: 'Connected',
  },
  error: {
    dot: 'bg-red-400',
    text: 'text-red-500',
    label: 'Error',
  },
  paused: {
    dot: 'bg-zinc-500',
    text: 'text-zinc-500',
    label: 'Paused',
  },
};

export function TopBar({ connected, gameStatus, gameState }: TopBarProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const gi = gameIndicator[gameStatus.status];
  const gameTooltip = gameStatus.message
    ? `Game: ${gi.label} — ${gameStatus.message}`
    : `Game: ${gi.label}`;

  return (
    <div className="flex items-center justify-between px-3 sm:px-5 py-2 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold tracking-widest text-zinc-400 uppercase">
            cc-spacemolt
          </span>
        </div>
        <span className="text-zinc-800 hidden sm:inline">|</span>
        <span className="text-xs text-zinc-600 font-mono hidden sm:inline">v{getVersion()}</span>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <div
          className="flex items-center gap-1.5"
          title={connected ? 'WebSocket: Connected' : 'WebSocket: Disconnected'}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`}
          />
          <span
            className={`text-xs tracking-wider uppercase hidden sm:inline ${connected ? 'text-emerald-500' : 'text-red-500'}`}
          >
            WS
          </span>
        </div>
        <div className="flex items-center gap-1.5" title={gameTooltip}>
          <div className={`w-1.5 h-1.5 rounded-full ${gi.dot}`} />
          <span className={`text-xs tracking-wider uppercase hidden sm:inline ${gi.text}`}>
            Game
          </span>
        </div>
        <span className="font-mono text-sm text-zinc-500">
          {time.toLocaleTimeString('en-US', { hour12: false })}
        </span>
        {gameState && (
          <span className="font-mono text-xs text-zinc-600 hidden sm:inline">
            T{gameState.tick.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}
