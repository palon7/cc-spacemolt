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
import { readFile } from 'fs/promises';
import { networkInterfaces } from 'os';
import { resolve, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { styleText } from 'util';

const __dirname = dirname(fileURLToPath(import.meta.url));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getNetworkAddresses(bindHost: string): string[] {
  const isIPv4 = bindHost === '0.0.0.0';
  const addresses: string[] = [];
  for (const infos of Object.values(networkInterfaces())) {
    if (!infos) continue;
    for (const info of infos) {
      if (info.internal) continue;
      if (isIPv4 && info.family !== 'IPv4') continue;
      if (!isIPv4 && info.family !== 'IPv6') continue;
      addresses.push(info.family === 'IPv6' ? `[${info.address}]` : info.address);
    }
  }
  return addresses;
}

const AVATAR_MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

export interface ServerOptions {
  port: number;
  host: string;
  sessionManager: SessionManager;
  gameConnectionManager: GameConnectionManager;
  initialPrompt: string;
  gameData: CachedGameData;
  logDir: string;
  workspacePath: string;
  userName?: string;
  userAvatarPath?: string;
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
  workspacePath,
  userName,
  userAvatarPath,
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

  app.get('/api/agent-avatar', async (c) => {
    const avatarPath = resolve(workspacePath, 'avatar.png');
    try {
      const data = await readFile(avatarPath);
      c.header('Content-Type', 'image/png');
      c.header('Cache-Control', 'no-cache');
      return c.body(data);
    } catch {
      return c.json({ error: 'Not found' }, 404);
    }
  });

  app.get('/api/user-avatar', async (c) => {
    if (!userAvatarPath) {
      return c.json({ error: 'Not found' }, 404);
    }
    const ext = extname(userAvatarPath).toLowerCase();
    const contentType = AVATAR_MIME_TYPES[ext];
    if (!contentType) {
      return c.json({ error: 'Unsupported image type' }, 400);
    }
    try {
      const data = await readFile(userAvatarPath);
      c.header('Content-Type', contentType);
      c.header('Cache-Control', 'no-cache');
      return c.body(data);
    } catch {
      return c.json({ error: 'Not found' }, 404);
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
    const isWildcard = host === '0.0.0.0' || host === '::';
    const portStr = String(info.port);
    const localUrl = `http://localhost:${portStr}`;
    const verb = existsSync(frontendDist) ? 'Open' : 'Backend running at';

    if (isWildcard) {
      // Show local + actual network addresses (like Vite)
      console.log(`\n🚀 Started!\n`);
      console.log(`    Local:   ${styleText('blue', localUrl)}`);
      for (const addr of getNetworkAddresses(host)) {
        console.log(`    Network: ${styleText('blue', `http://${addr}:${portStr}`)}`);
      }
      console.log();
    } else {
      const url = `http://${host}:${portStr}`;
      console.log(`\n🚀 Started! \n\n    ${verb} ${styleText('blue', url)}\n`);
    }
  });

  setupWebSocket({
    server: server as never,
    sessionManager,
    gameConnectionManager,
    initialPrompt,
    logDir,
    workspacePath,
    userName,
    userAvatarPath,
  });

  return { server };
}
