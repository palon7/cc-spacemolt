import fs from 'fs';
import consola from 'consola';
import ora from 'ora';
import updateNotifier from 'update-notifier';
import packageJson from '../../package.json' with { type: 'json' };
import type { AppConfig } from './config.js';
import { loadConfig, applyCliOverrides, defaultConfigDir } from './config.js';
import { ClaudeCliProvider } from './agent/providers/claude-cli.js';
import { SessionManager } from './state/session-manager.js';
import { enableDebugLog, debug } from './logger/debug-logger.js';
import { startServer } from './server.js';
import { GameConnectionManager } from './game/game-connection-manager.js';
import { fetchGameData } from './game/game-data-cache.js';
import { bigLogoText } from './utils/logo.js';
import { parseCommandLine } from './utils/command-line.js';

const opts = parseCommandLine(process.argv);
const port: number = opts.port;
const host: string = opts.host;

if (opts.debug) {
  enableDebugLog();
  debug('main', 'CLI args:', process.argv.slice(2));
  consola.level = 5; // verbose
} else {
  consola.level = 2; // normal logs
}

async function loadAppConfig(): Promise<AppConfig> {
  try {
    // Ensure config directory exists
    fs.mkdirSync(defaultConfigDir, { recursive: true });

    // Run setup wizard if config file doesn't exist
    if (!fs.existsSync(opts.configFile)) {
      if (process.stdin.isTTY && process.stdout.isTTY) {
        const { runSetupWizard } = await import('./setup.js');
        await runSetupWizard(opts.configFile, defaultConfigDir);
      } else {
        // Non-interactive environment: create a default config
        const { DEFAULT_CONFIG } = await import('./config.js');
        fs.writeFileSync(opts.configFile, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n', 'utf-8');
        consola.info('No config found. Created default config at: ' + opts.configFile);
      }
    }

    return loadConfig(opts.configFile);
  } catch (err) {
    consola.error('Failed to load config:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

const loadedConfig = await loadAppConfig();
const { config, workspacePath, logDir, bypassPermissions } = applyCliOverrides(loadedConfig, opts);

debug('main', 'Resolved paths:', { configFile: opts.configFile, logDir, workspacePath });
debug('main', 'Creating ClaudeCliProvider');
const provider = new ClaudeCliProvider({
  config,
  bypassPermissions,
  workspacePath,
});

const sessionManager = new SessionManager(provider, config.maxLogEntries, logDir);
const gameConnectionManager = new GameConnectionManager(workspacePath);

console.log(`${bigLogoText}\n`);
const notifier = updateNotifier({ pkg: packageJson });
if (notifier.update) {
  notifier.notify({ defer: false });
}
console.log(`Workspace: ${workspacePath}`);
console.log(`Config: ${opts.configFile}\n`);

const gameDataSpinner = ora('Fetching game data...').start();
let gameData;
try {
  gameData = await fetchGameData();
  gameDataSpinner.succeed(
    `Game data loaded: ${gameData.systems.length} systems, ${gameData.stations.length} stations`,
  );
} catch (err) {
  gameDataSpinner.fail('Failed to fetch game data');
  throw err;
}

// Fetch initial game state via REST API (non-blocking)
gameConnectionManager.fetchInitialState().catch((err) => {
  debug('main', `Initial game state fetch failed: ${err}`);
});

startServer({
  port,
  host,
  sessionManager,
  gameConnectionManager,
  initialPrompt: config.initialPrompt,
  gameData,
  logDir,
});

// Graceful shutdown
const shutdown = () => {
  gameConnectionManager.cleanup();
  sessionManager.abort();
  process.exit(0);
};

process.on('SIGINT', () => {
  debug('main', 'SIGINT received, shutting down');
  shutdown();
});

process.on('SIGTERM', () => {
  debug('main', 'SIGTERM received, shutting down');
  shutdown();
});
