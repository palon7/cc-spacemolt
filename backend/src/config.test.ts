import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadConfig, DEFAULT_CONFIG } from './config.js';

function createTempConfig(content: object): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-spacemolt-test-'));
  const file = path.join(dir, 'config.json');
  fs.writeFileSync(file, JSON.stringify(content), 'utf-8');
  return file;
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
