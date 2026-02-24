import os from 'os';
import fs from 'fs';
import path from 'path';
import { program, InvalidArgumentError } from 'commander';
import consola from 'consola';
import ora from 'ora';
import updateNotifier from 'update-notifier';
import packageJson from '../../package.json' with { type: 'json' };
import { loadConfig } from './config.js';
import { ClaudeCliProvider } from './agent/providers/claude-cli.js';
import { SessionManager } from './state/session-manager.js';
import { enableDebugLog, debug } from './logger/debug-logger.js';
import { startServer } from './server.js';
import { GameConnectionManager } from './game/game-connection-manager.js';
import { fetchGameData } from './game/game-data-cache.js';
import { bigLogoText } from './utils/logo.js';

// Default base directory
const defaultConfigDir = path.join(os.homedir(), '.cc-spacemolt');

program
  .name('cc-spacemolt')
  .description('Monitor tool for Claude Code CLI playing SpaceMolt')
  .option('--config-file <path>', 'Config file path', path.join(defaultConfigDir, 'config.json'))
  .option('--log-dir <path>', 'Log output directory')
  .option('--workspace <path>', 'Working directory')
  .option(
    '--port <number>',
    'Server port',
    (value) => {
      const n = parseInt(value, 10);
      if (isNaN(n) || n < 1 || n > 65535) {
        throw new InvalidArgumentError('Port must be an integer between 1 and 65535.');
      }
      return n;
    },
    3001,
  )
  .option('--host <hostname>', 'Bind hostname', 'localhost')
  .option('--debug', 'Write debug log to debug.log')
  .option('--dangerously-skip-permissions', 'Bypass all permission checks')
  .option(
    '--claude-env <KEY=VALUE>',
    'Environment variable for Claude CLI (repeatable)',
    (value: string, prev: Record<string, string>) => {
      const eqIndex = value.indexOf('=');
      if (eqIndex < 1) {
        throw new InvalidArgumentError('Must be in KEY=VALUE format.');
      }
      const key = value.slice(0, eqIndex);
      const val = value.slice(eqIndex + 1);
      return { ...prev, [key]: val };
    },
    {} as Record<string, string>,
  )
  .option(
    '--claude-args <args>',
    'Additional args for Claude CLI, space-separated (repeatable)',
    (value: string, prev: string[]) => [...prev, ...value.split(/\s+/).filter(Boolean)],
    [] as string[],
  );

const argv = process.argv.slice(2);
if (argv[0] === '--') argv.shift();
program.parse(argv, { from: 'user' });
const opts = program.opts();
const port: number = opts.port;
const host: string = opts.host;

if (opts.debug) {
  enableDebugLog();
  debug('main', 'CLI args:', process.argv.slice(2));
  consola.level = 5; // verbose
} else {
  consola.level = 2; // normal logs
}

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

const config = loadConfig(opts.configFile);

// Resolve paths: CLI > config > default
const logDir = opts.logDir ?? path.join(defaultConfigDir, 'logs');
const workspacePath =
  opts.workspace || config.workspacePath || path.join(defaultConfigDir, 'workspace');
config.workspacePath = workspacePath;

// Ensure directories exist
fs.mkdirSync(logDir, { recursive: true });
fs.mkdirSync(workspacePath, { recursive: true });

// Workaround: pre-create Claude auto-memory directory for the subprocess workspace.
// Without this, the subprocess reads MEMORY.md concurrently with WebFetch on
// startup; the "file not found" error cascades to WebFetch via the
// "Sibling tool call errored" mechanism in Claude Code.
// https://github.com/anthropics/claude-code/issues/22264
try {
  const projectDirName = workspacePath
    .replace(/\\/g, '/') // normalize Windows backslashes to forward slashes
    .replace(/:/g, '') // remove Windows drive letter colon (e.g. "C:")
    .replace(/[/.]/g, '-'); // replace / and . with -
  const claudeMemoryDir = path.join(os.homedir(), '.claude', 'projects', projectDirName, 'memory');

  fs.mkdirSync(claudeMemoryDir, { recursive: true });
  const claudeMemoryFile = path.join(claudeMemoryDir, 'MEMORY.md');
  if (!fs.existsSync(claudeMemoryFile)) {
    fs.writeFileSync(claudeMemoryFile, '', 'utf-8');
  }
} catch (err) {
  debug(
    'main',
    'Failed to create Claude memory directory',
    err instanceof Error ? err.message : err,
  );
}

if (!fs.existsSync(path.join(workspacePath, '.env'))) {
  // Create .env template
  fs.writeFileSync(
    path.join(workspacePath, '.env'),
    'SPACEMOLT_USERNAME=\nSPACEMOLT_PASSWORD=\n',
    'utf-8',
  );
}

debug('main', 'Resolved paths:', { configFile: opts.configFile, logDir, workspacePath });

const bypassPermissions =
  opts.dangerouslySkipPermissions || config.dangerouslySkipPermissions === true;

// Merge CLI --claude-env into config (CLI overrides config)
const cliClaudeEnv: Record<string, string> = opts.claudeEnv;
if (Object.keys(cliClaudeEnv).length > 0) {
  config.claudeEnv = { ...config.claudeEnv, ...cliClaudeEnv };
}

// Merge CLI --claude-args into config (appended after config args)
const cliClaudeArgs: string[] = opts.claudeArgs;
if (cliClaudeArgs.length > 0) {
  config.claudeArgs = [...(config.claudeArgs ?? []), ...cliClaudeArgs];
}

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
