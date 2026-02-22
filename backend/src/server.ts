import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import type { SessionManager } from './state/session-manager.js';
import type { GameConnectionManager } from './game/game-connection-manager.js';
import type { CachedGameData } from './game/game-data-cache.js';
import { setupWebSocket } from './ws-handler.js';
import { debug } from './logger/debug-logger.js';
import { listSessions, replaySession } from './state/session-history.js';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { styleText } from 'util';

const __dirname = dirname(fileURLToPath(import.meta.url));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ServerOptions {
  port: number;
  host: string;
  sessionManager: SessionManager;
  gameConnectionManager: GameConnectionManager;
  initialPrompt: string;
  gameData: CachedGameData;
  logDir: string;
}

export interface ServerResult {
  server: ReturnType<typeof serve>;
}

export function startServer({
  port,
  host,
  sessionManager,
  gameConnectionManager,
  initialPrompt,
  gameData,
  logDir,
}: ServerOptions): ServerResult {
  const app = new Hono();

  app.get('/api/health', (c) => {
    return c.json({
      status: 'ok',
      agentStatus: sessionManager.status,
      sessionMeta: sessionManager.currentMeta,
    });
  });

  app.get('/api/map', (c) => {
    return c.json(gameData);
  });

  app.get('/api/sessions', async (c) => {
    const sessions = await listSessions(logDir);
    return c.json(sessions);
  });

  app.get('/api/sessions/:id', async (c) => {
    const id = c.req.param('id');
    if (!UUID_RE.test(id)) {
      return c.json({ error: 'Invalid session ID format' }, 400);
    }
    try {
      const data = await replaySession(logDir, id);
      return c.json(data);
    } catch {
      return c.json({ error: 'Session not found' }, 404);
    }
  });

  // Serve frontend static files (production mode)
  const frontendDist = resolve(__dirname, '../../frontend/dist');
  if (existsSync(frontendDist)) {
    app.use('*', serveStatic({ root: frontendDist }));
    // SPA fallback: serve index.html for unmatched routes
    app.get('*', async (c) => {
      const { readFile } = await import('fs/promises');
      const html = await readFile(resolve(frontendDist, 'index.html'), 'utf-8');
      return c.html(html);
    });
    debug('server', `Serving frontend from ${frontendDist}`);
  }

  const server = serve({ fetch: app.fetch, port, hostname: host }, (info) => {
    // Display the user-specified hostname rather than the raw address from
    // server.address(), which may be an IPv6 address like "::1" on Node 18+.
    // This matches how Vite and Next.js display startup URLs.
    const displayHost = host === '0.0.0.0' || host === '::' ? 'localhost' : host;
    const url = `http://${displayHost}:${info.port}`;
    if (existsSync(frontendDist)) {
      console.log(`\n🚀 Started! \n\n    Open ${styleText('blue', url)} in your browser\n\n`);
    } else {
      console.log(`\n🚀 Started! \n\n    Backend running at ${styleText('blue', url)}\n\n`);
    }
    const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(host);
    const isWildcard = host === '0.0.0.0' || host === '::';
    if (!isLoopback && !isWildcard) {
      console.log(
        `    Listening on ${styleText('yellow', host + ':' + String(info.port))} (external access enabled)\n`,
      );
    }
  });

  setupWebSocket({
    server: server as never,
    sessionManager,
    gameConnectionManager,
    initialPrompt,
    logDir,
  });

  return { server };
}
