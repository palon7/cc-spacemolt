import { Command, InvalidArgumentError } from '@commander-js/extra-typings';
import path from 'path';
import { defaultConfigDir } from '../config.js';

function createCommand() {
  return new Command()
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
}

export function parseCommandLine(argv: string[]) {
  const command = createCommand();
  const args = argv.slice(2);
  if (args[0] === '--') args.shift();
  command.parse(args, { from: 'user' });
  return command.opts() as CommandLineOptions;
}

export type CommandLineOptions = ReturnType<ReturnType<typeof createCommand>['opts']>;
