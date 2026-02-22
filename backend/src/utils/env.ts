import fs from 'fs';
import path from 'path';

/**
 * Parse a .env file and return key-value pairs.
 * Lines starting with # are ignored. Surrounding quotes on values are stripped.
 */
export function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};

  const result: Record<string, string> = {};
  const content = fs.readFileSync(filePath, 'utf-8');

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex < 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }

  return result;
}

/**
 * Load .env from a directory and return key-value pairs.
 */
export function loadEnv(dir: string): Record<string, string> {
  return parseEnvFile(path.join(dir, '.env'));
}
