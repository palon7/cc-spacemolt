import { createContext, useContext } from 'react';

interface ConfigContextValue {
  agentAvatarUrl?: string;
  userName?: string;
  userAvatarUrl?: string;
  initialPrompt: string;
}

export const ConfigContext = createContext<ConfigContextValue>({ initialPrompt: '' });

export const useConfig = () => useContext(ConfigContext);
