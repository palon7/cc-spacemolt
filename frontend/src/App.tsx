import { useWebSocket } from './hooks/useWebSocket';
import { Layout } from './components/Layout';
import { AgentContext } from './contexts/AgentContext';
import { GameContext } from './contexts/GameContext';
import { ConfigContext } from './contexts/ConfigContext';

export function App() {
  const {
    entries,
    sessionMeta,
    status,
    connected,
    gameState,
    gameStatus,
    events,
    travelHistory,
    initialPrompt,
    agentAvatarUrl,
    userName,
    userAvatarUrl,
    startAgent,
    sendMessage,
    interrupt,
    abort,
    resetSession,
    selectSession,
  } = useWebSocket();

  return (
    <AgentContext.Provider
      value={{
        entries,
        sessionMeta,
        status,
        connected,
        startAgent,
        sendMessage,
        interrupt,
        abort,
        resetSession,
        selectSession,
      }}
    >
      <GameContext.Provider value={{ gameState, gameStatus, events, travelHistory }}>
        <ConfigContext.Provider value={{ agentAvatarUrl, userName, userAvatarUrl, initialPrompt }}>
          <Layout />
        </ConfigContext.Provider>
      </GameContext.Provider>
    </AgentContext.Provider>
  );
}
