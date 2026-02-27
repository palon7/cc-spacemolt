import { createContext, useContext } from 'react';
import type {
  ParsedEntry,
  SessionMeta,
  AgentStatus,
  ClientMessage,
  RuntimeSettings,
} from '@cc-spacemolt/shared';

interface AgentContextValue {
  entries: ParsedEntry[];
  sessionMeta: SessionMeta | null;
  status: AgentStatus;
  connected: boolean;
  runtimeSettings: RuntimeSettings;
  startAgent: (instructions?: string) => void;
  sendMessage: (text: string) => void;
  interrupt: () => void;
  abort: () => void;
  resetSession: () => void;
  selectSession: (sessionId: string) => void;
  updateSettings: (settings: (ClientMessage & { type: 'update_settings' })['settings']) => void;
}

const noop = () => {};

export const AgentContext = createContext<AgentContextValue>({
  entries: [],
  sessionMeta: null,
  status: 'idle',
  connected: false,
  runtimeSettings: {
    autoResume: { enabled: false, timeoutMinutes: 0, startedAt: null, stopping: false },
  },
  startAgent: noop,
  sendMessage: noop,
  interrupt: noop,
  abort: noop,
  resetSession: noop,
  selectSession: noop,
  updateSettings: noop,
});

export const useAgent = () => useContext(AgentContext);
