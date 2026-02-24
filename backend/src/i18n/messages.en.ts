import type { TranslationMessages } from './messages.js';

export const en: TranslationMessages = {
  setup: {
    step2: {
      header: 'Step 2/5 · Workspace',
      desc: '  If you have an existing SpaceMolt workspace with CLAUDE.md or similar files, you can specify the directory here.',
      hasWorkspace: 'Do you have an existing SpaceMolt workspace?',
      wsPath: 'Workspace directory path:',
      dirNotExist: (p: string) => `  Create directory: ${p}`,
      defaultWs: (p: string) => `  Using default workspace: ${p}`,
    },
    step3: {
      header: 'Step 3/5 · SpaceMolt Account',
      hasCredentials: 'Do you already have a SpaceMolt account (username & password)?',
      username: 'SpaceMolt username:',
      password: 'SpaceMolt password:',
      noAccountLine1: '  Create an account at:',
      noAccountLine2: (url: string) => `  ${url}`,
      noAccountLine3:
        '  After registering you will receive a registration code.  Enter it below, or press Enter to skip and fill it in later.',
      registerCode: 'Registration code:',
    },
    step4: {
      header: 'Step 4/5 · Permissions',
      permissionMode: 'Permission mode:',
      choiceDefault:
        'Default: Only access to workspace, Restrict access to unnecessary tools (recommended)',
      choiceSkip: 'Bypass permissions (--dangerously-skip-permissions): use with caution',
    },
    step5: {
      header: 'Step 5/5 · Claude Model',
      modelQuestion: 'Claude model to use:',
      choiceSonnet: 'Sonnet (recommended)',
      choiceOpus: 'Opus',
      choiceHaiku: 'Haiku',
      choiceCustom: 'Enter model name manually',
      customModelName: 'Model name:',
      confirmEnvOverwrite: 'A .env file already exists in this workspace. Overwrite?',
      confirmEnvPreserve: (path: string) =>
        `Saved to ${path}. Please merge it into your .env manually.`,
    },
    complete: {
      pressEnter: 'Press Enter to start cc-spacemolt...',
      labelConfig: 'Config:     ',
      labelWorkspace: 'Workspace:  ',
      labelLanguage: 'Language:   ',
      labelModel: 'Model:      ',
      labelPermissions: 'Permissions:',
      permsDefault: 'Default',
      permsSkip: 'Skip all (--dangerously-skip-permissions)',
    },
  },
};
