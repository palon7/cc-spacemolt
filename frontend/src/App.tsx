import { useWebSocket } from './hooks/useWebSocket';
import { Layout } from './components/Layout';

export function App() {
  const ws = useWebSocket();

  return <Layout {...ws} />;
}
