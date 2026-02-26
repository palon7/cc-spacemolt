import { createContext, useContext } from 'react';
import type {
  GameState,
  GameEvent,
  GameConnectionStatus,
  TravelHistoryEntry,
} from '@cc-spacemolt/shared';

interface GameContextValue {
  gameState: GameState | null;
  gameStatus: { status: GameConnectionStatus; message?: string };
  events: GameEvent[];
  travelHistory: TravelHistoryEntry[];
}

export const GameContext = createContext<GameContextValue>({
  gameState: null,
  gameStatus: { status: 'connecting' },
  events: [],
  travelHistory: [],
});

export const useGame = () => useContext(GameContext);
