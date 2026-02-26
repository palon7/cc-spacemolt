import { createContext, useContext } from 'react';
import type { ParsedEntry, SessionMeta, AgentStatus } from '@cc-spacemolt/shared';

interface AgentContextValue {
  entries: ParsedEntry[];
  sessionMeta: SessionMeta | null;
  status: AgentStatus;
  connected: boolean;
  startAgent: (instructions?: string) => void;
  sendMessage: (text: string) => void;
  interrupt: () => void;
  abort: () => void;
  resetSession: () => void;
  selectSession: (sessionId: string) => void;
}

const noop = () => {};

export const AgentContext = createContext<AgentContextValue>({
  entries: [],
  sessionMeta: null,
  status: 'idle',
  connected: false,
  startAgent: noop,
  sendMessage: noop,
  interrupt: noop,
  abort: noop,
  resetSession: noop,
  selectSession: noop,
});

export const useAgent = () => useContext(AgentContext);
