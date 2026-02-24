import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadConfig, applyCliOverrides, DEFAULT_CONFIG } from './config.js';
import type { CommandLineOptions } from './utils/command-line.js';
import type { AppConfig } from './config.js';

function createTempConfig(content: object): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-spacemolt-test-'));
  const file = path.join(dir, 'config.json');
  fs.writeFileSync(file, JSON.stringify(content), 'utf-8');
  return file;
}

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

const FAKE_CONFIG_DIR = '/fake/config/dir';
const FAKE_CONFIG_FILE = path.join(FAKE_CONFIG_DIR, 'config.json');

function makeCliOptions(overrides: Partial<CommandLineOptions> = {}): CommandLineOptions {
  return {
    configFile: FAKE_CONFIG_FILE,
    logDir: undefined,
    workspace: undefined,
    port: 3001,
    host: 'localhost',
    debug: undefined,
    dangerouslySkipPermissions: undefined,
    claudeEnv: {},
    claudeArgs: [],
    ...overrides,
  };
}

describe('loadConfig', () => {
  it('returns defaults for empty config', () => {
    const config = loadConfig(createTempConfig({}));
    expect(config.initialPrompt).toBe(DEFAULT_CONFIG.initialPrompt);
    expect(config.maxLogEntries).toBe(DEFAULT_CONFIG.maxLogEntries);
  });

  it('merges partial config over defaults', () => {
    const config = loadConfig(createTempConfig({ maxLogEntries: 500, model: 'opus' }));
    expect(config.maxLogEntries).toBe(500);
    expect(config.model).toBe('opus');
    expect(config.initialPrompt).toBe(DEFAULT_CONFIG.initialPrompt);
  });

  it('merges claudeEnv with defaults', () => {
    const config = loadConfig(createTempConfig({ claudeEnv: { FOO: 'bar' } }));
    expect(config.claudeEnv).toEqual({ FOO: 'bar' });
  });
});

describe('applyCliOverrides', () => {
  describe('workspacePath', () => {
    it('CLI workspace overrides config workspacePath', () => {
      const config = makeConfig({ workspacePath: '/config/workspace' });
      const result = applyCliOverrides(
        config,
        makeCliOptions({ workspace: '/cli/workspace' }),
        FAKE_CONFIG_DIR,
      );
      expect(result.workspacePath).toBe('/cli/workspace');
      expect(result.config.workspacePath).toBe('/cli/workspace');
    });

    it('config workspacePath is used when CLI workspace is not provided', () => {
      const config = makeConfig({ workspacePath: '/config/workspace' });
      const result = applyCliOverrides(config, makeCliOptions(), FAKE_CONFIG_DIR);
      expect(result.workspacePath).toBe('/config/workspace');
    });

    it('falls back to default when config workspacePath is empty string', () => {
      const config = makeConfig({ workspacePath: '' });
      const result = applyCliOverrides(config, makeCliOptions(), FAKE_CONFIG_DIR);
      expect(result.workspacePath).toBe(path.join(os.homedir(), '.cc-spacemolt', 'workspace'));
    });
  });

  describe('logDir', () => {
    it('CLI logDir overrides default', () => {
      const result = applyCliOverrides(
        makeConfig(),
        makeCliOptions({ logDir: '/cli/logs' }),
        FAKE_CONFIG_DIR,
      );
      expect(result.logDir).toBe('/cli/logs');
    });

    it('falls back to default when CLI logDir is not provided', () => {
      const result = applyCliOverrides(makeConfig(), makeCliOptions(), FAKE_CONFIG_DIR);
      expect(result.logDir).toBe(path.join(FAKE_CONFIG_DIR, 'logs'));
    });
  });

  describe('bypassPermissions', () => {
    it('is true when CLI flag is set', () => {
      const result = applyCliOverrides(
        makeConfig({ dangerouslySkipPermissions: false }),
        makeCliOptions({ dangerouslySkipPermissions: true }),
        FAKE_CONFIG_DIR,
      );
      expect(result.bypassPermissions).toBe(true);
    });

    it('is true when config flag is set', () => {
      const result = applyCliOverrides(
        makeConfig({ dangerouslySkipPermissions: true }),
        makeCliOptions(),
        FAKE_CONFIG_DIR,
      );
      expect(result.bypassPermissions).toBe(true);
    });

    it('is true when both flags are set', () => {
      const result = applyCliOverrides(
        makeConfig({ dangerouslySkipPermissions: true }),
        makeCliOptions({ dangerouslySkipPermissions: true }),
        FAKE_CONFIG_DIR,
      );
      expect(result.bypassPermissions).toBe(true);
    });

    it('is false when neither flag is set', () => {
      const result = applyCliOverrides(
        makeConfig({ dangerouslySkipPermissions: false }),
        makeCliOptions(),
        FAKE_CONFIG_DIR,
      );
      expect(result.bypassPermissions).toBe(false);
    });
  });

  describe('claudeEnv', () => {
    it('CLI env overrides config env on key conflict', () => {
      const config = makeConfig({ claudeEnv: { KEY: 'from-config', OTHER: 'keep' } });
      const result = applyCliOverrides(
        config,
        makeCliOptions({ claudeEnv: { KEY: 'from-cli' } }),
        FAKE_CONFIG_DIR,
      );
      expect(result.config.claudeEnv).toEqual({ KEY: 'from-cli', OTHER: 'keep' });
    });

    it('CLI env adds new keys alongside config env', () => {
      const config = makeConfig({ claudeEnv: { EXISTING: 'val' } });
      const result = applyCliOverrides(
        config,
        makeCliOptions({ claudeEnv: { NEW: 'cli-val' } }),
        FAKE_CONFIG_DIR,
      );
      expect(result.config.claudeEnv).toEqual({ EXISTING: 'val', NEW: 'cli-val' });
    });

    it('config env is preserved when no CLI env is provided', () => {
      const config = makeConfig({ claudeEnv: { FOO: 'bar' } });
      const result = applyCliOverrides(config, makeCliOptions(), FAKE_CONFIG_DIR);
      expect(result.config.claudeEnv).toEqual({ FOO: 'bar' });
    });

    it('empty CLI env object does not clear config env', () => {
      const config = makeConfig({ claudeEnv: { FOO: 'bar' } });
      const result = applyCliOverrides(config, makeCliOptions({ claudeEnv: {} }), FAKE_CONFIG_DIR);
      expect(result.config.claudeEnv).toEqual({ FOO: 'bar' });
    });
  });

  describe('claudeArgs', () => {
    it('CLI args are appended after config args', () => {
      const config = makeConfig({ claudeArgs: ['--config-arg'] });
      const result = applyCliOverrides(
        config,
        makeCliOptions({ claudeArgs: ['--cli-arg'] }),
        FAKE_CONFIG_DIR,
      );
      expect(result.config.claudeArgs).toEqual(['--config-arg', '--cli-arg']);
    });

    it('config args are preserved when no CLI args are provided', () => {
      const config = makeConfig({ claudeArgs: ['--config-arg'] });
      const result = applyCliOverrides(config, makeCliOptions(), FAKE_CONFIG_DIR);
      expect(result.config.claudeArgs).toEqual(['--config-arg']);
    });
  });

  it('resolves full priority chain: CLI > config > default', () => {
    const config = makeConfig({
      workspacePath: '/config/ws',
      dangerouslySkipPermissions: false,
      claudeEnv: { A: 'config', B: 'config' },
      claudeArgs: ['--from-config'],
    });

    const result = applyCliOverrides(
      config,
      makeCliOptions({
        workspace: '/cli/ws',
        logDir: '/cli/logs',
        dangerouslySkipPermissions: true,
        claudeEnv: { B: 'cli', C: 'cli' },
        claudeArgs: ['--from-cli'],
      }),
      FAKE_CONFIG_DIR,
    );

    expect(result.workspacePath).toBe('/cli/ws');
    expect(result.logDir).toBe('/cli/logs');
    expect(result.bypassPermissions).toBe(true);
    expect(result.config.claudeEnv).toEqual({ A: 'config', B: 'cli', C: 'cli' });
    expect(result.config.claudeArgs).toEqual(['--from-config', '--from-cli']);
  });
});
