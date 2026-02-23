import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadConfig } from './config.js';

function createTempConfig(content: object): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-spacemolt-test-'));
  const file = path.join(dir, 'config.json');
  fs.writeFileSync(file, JSON.stringify(content), 'utf-8');
  return file;
}

describe('loadConfig', () => {
  describe('claudeArgs', () => {
    it('defaults to undefined when not specified', () => {
      const config = loadConfig(createTempConfig({}));
      expect(config.claudeArgs).toBeUndefined();
    });

    it('loads claudeArgs from config file', () => {
      const config = loadConfig(
        createTempConfig({ claudeArgs: ['--max-turns', '50', '--verbose'] }),
      );
      expect(config.claudeArgs).toEqual(['--max-turns', '50', '--verbose']);
    });
  });

  describe('claudeEnv', () => {
    it('defaults to undefined when not specified', () => {
      const config = loadConfig(createTempConfig({}));
      expect(config.claudeEnv).toBeUndefined();
    });

    it('loads claudeEnv from config file', () => {
      const config = loadConfig(
        createTempConfig({ claudeEnv: { ANTHROPIC_API_KEY: 'sk-test', NODE_ENV: 'production' } }),
      );
      expect(config.claudeEnv).toEqual({
        ANTHROPIC_API_KEY: 'sk-test',
        NODE_ENV: 'production',
      });
    });
  });
});
