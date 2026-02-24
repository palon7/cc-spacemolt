export interface TranslationMessages {
  setup: {
    step2: {
      header: string;
      desc: string;
      hasWorkspace: string;
      wsPath: string;
      dirNotExist: (p: string) => string;
      defaultWs: (p: string) => string;
    };
    step3: {
      header: string;
      hasCredentials: string;
      username: string;
      password: string;
      noAccountLine1: string;
      noAccountLine2: (url: string) => string;
      noAccountLine3: string;
      registerCode: string;
    };
    step4: {
      header: string;
      permissionMode: string;
      choiceDefault: string;
      choiceSkip: string;
    };
    step5: {
      header: string;
      modelQuestion: string;
      choiceSonnet: string;
      choiceOpus: string;
      choiceHaiku: string;
      choiceCustom: string;
      customModelName: string;
      confirmEnvOverwrite: string;
      confirmEnvPreserve: (path: string) => string;
    };
    complete: {
      pressEnter: string;
      labelConfig: string;
      labelWorkspace: string;
      labelLanguage: string;
      labelModel: string;
      labelPermissions: string;
      permsDefault: string;
      permsSkip: string;
    };
  };
}

import { en } from './messages.en.js';
import { ja } from './messages.ja.js';

export function getMessages(language: string): TranslationMessages {
  return language === 'ja' ? ja : en;
}
