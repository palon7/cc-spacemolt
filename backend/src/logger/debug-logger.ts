import consola from 'consola';
import { appendFileSync, writeFileSync } from 'fs';
import { styleText } from 'util';

const DEBUG_LOG_PATH = 'debug.log';

let enabled = false;

type StyleColor = Parameters<typeof styleText>[0];

export type LogGroup =
  | 'main'
  | 'ws'
  | 'provider'
  | 'game'
  | 'poi-cache'
  | 'game-data'
  | 'spacemolt'
  | 'session-manager'
  | 'server';

const colorByLabel: Record<LogGroup, StyleColor> = {
  main: 'green',
  ws: 'cyanBright',
  provider: 'magenta',
  game: 'blue',
  'poi-cache': 'cyan',
  'game-data': 'blueBright',
  spacemolt: 'red',
  'session-manager': 'magentaBright',
  server: 'yellow',
};

function styleLabel(label: LogGroup): string {
  const color = colorByLabel[label] || 'gray';
  return `[${styleText(color, label)}]`;
}

export function enableDebugLog(): void {
  enabled = true;
  writeFileSync(
    DEBUG_LOG_PATH,
    `=== cc-spacemolt debug log started at ${new Date().toISOString()} ===\n`,
  );
}

export function debug(label: LogGroup, ...args: unknown[]): void {
  if (!enabled) return;
  const msg = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a, null, 2))).join(' ');
  const timestamp = new Date().toISOString();
  appendFileSync(DEBUG_LOG_PATH, `[${timestamp}] [${label}] ${msg}\n`);
  consola.debug(`${styleLabel(label)} ${msg}`);
}
