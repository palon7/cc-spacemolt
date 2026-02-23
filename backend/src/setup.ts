import fs from 'fs';
import path from 'path';
import { styleText } from 'node:util';
import { input, select, password, confirm } from '@inquirer/prompts';
import { DEFAULT_CONFIG } from './config.js';
import type { AppConfig } from './config.js';
import { bigLogoText } from './utils/logo.js';
import { getMessages } from './i18n/setup-messages.js';

function printSectionHeader(label: string) {
  console.log('\n' + '─'.repeat(56));
  console.log('  ' + label);
  console.log('─'.repeat(56));
}

const languages: Record<string, string> = {
  en: 'English',
  ja: 'Japanese',
};

export async function runSetupWizard(configFile: string, defaultConfigDir: string): Promise<void> {
  console.log(bigLogoText);
  console.log("\nWelcome! config.json was not found. Let's configure cc-spacemolt.");

  // Step 1: Language
  printSectionHeader('Step 1/5 · Language');
  const langChoices = Object.entries(languages).map(([value, name]) => ({
    name,
    value,
  }));
  langChoices.push({ name: 'Other (custom)', value: 'custom' });

  const languageChoice = await select({
    message: 'Choose your language:',
    choices: langChoices,
  });

  let agentLanguage: string;
  let uiLanguage = 'en';

  if (languageChoice === 'custom') {
    const customLang = await input({ message: 'Enter language:' });
    agentLanguage = customLang.trim();
  } else {
    agentLanguage = languages[languageChoice];
    uiLanguage = languageChoice;
  }

  const t = getMessages(uiLanguage);

  // Step 2: Workspace
  printSectionHeader(t.setup.step2.header);
  console.log(t.setup.step2.desc);
  console.log('');

  const hasWorkspace = await confirm({
    message: t.setup.step2.hasWorkspace,
    default: false,
  });

  let workspacePath: string;
  if (hasWorkspace) {
    const defaultWs = path.join(defaultConfigDir, 'workspace');
    const wsPath = await input({
      message: t.setup.step2.wsPath,
      default: defaultWs,
    });
    workspacePath = wsPath.trim() || defaultWs;
    if (!fs.existsSync(workspacePath)) {
      console.log(t.setup.step2.dirNotExist(workspacePath));
    }
  } else {
    workspacePath = path.join(defaultConfigDir, 'workspace');
    console.log(t.setup.step2.defaultWs(workspacePath));
  }

  // Step 3: SpaceMolt account
  printSectionHeader(t.setup.step3.header);

  const hasCredentials = await confirm({
    message: t.setup.step3.hasCredentials,
    default: false,
  });

  let envContent: string;
  if (hasCredentials) {
    const username = await input({ message: t.setup.step3.username });
    const pw = await password({ message: t.setup.step3.password });
    envContent = `SPACEMOLT_USERNAME=${username.trim()}\nSPACEMOLT_PASSWORD=${pw}\n`;
  } else {
    console.log(t.setup.step3.noAccountLine1);
    console.log(t.setup.step3.noAccountLine2(styleText('cyan', 'https://spacemolt.com')));
    console.log(t.setup.step3.noAccountLine3);
    const registerCode = await input({ message: t.setup.step3.registerCode });
    envContent = `SPACEMOLT_USERNAME=\nSPACEMOLT_PASSWORD=\nREGISTER_CODE=${registerCode.trim()}\n`;
  }

  // Step 4: Permissions
  printSectionHeader(t.setup.step4.header);

  const permissionLevel = await select({
    message: t.setup.step4.permissionMode,
    choices: [
      { name: t.setup.step4.choiceDefault, value: 'default' },
      { name: t.setup.step4.choiceSkip, value: 'skip' },
    ],
  });
  const dangerouslySkipPermissions = permissionLevel === 'skip';

  // Step 5: Claude model
  printSectionHeader(t.setup.step5.header);

  const modelChoice = await select({
    message: t.setup.step5.modelQuestion,
    choices: [
      { name: t.setup.step5.choiceSonnet, value: 'sonnet' },
      { name: t.setup.step5.choiceOpus, value: 'opus' },
      { name: t.setup.step5.choiceHaiku, value: 'haiku' },
      { name: t.setup.step5.choiceCustom, value: 'custom' },
    ],
  });

  let model: string;
  if (modelChoice === 'custom') {
    const customModel = await input({ message: t.setup.step5.customModelName });
    model = customModel.trim();
  } else {
    model = modelChoice;
  }

  // Write config.json
  const config: AppConfig = {
    ...DEFAULT_CONFIG,
    language: agentLanguage,
    uiLanguage,
    workspacePath,
    dangerouslySkipPermissions,
    model,
  };

  fs.mkdirSync(path.dirname(configFile), { recursive: true });
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n', 'utf-8');

  // Write .env
  fs.mkdirSync(workspacePath, { recursive: true });
  const envPath = path.join(workspacePath, '.env');
  if (fs.existsSync(envPath)) {
    const overwriteEnv = await confirm({
      message: t.setup.step5.confirmEnvOverwrite,
      default: false,
    });
    if (overwriteEnv) {
      fs.writeFileSync(envPath, envContent, 'utf-8');
    } else {
      const envExamplePath = path.join(workspacePath, '.env.cc-spacemolt.example');
      fs.writeFileSync(envExamplePath, envContent, 'utf-8');
      console.log(t.setup.step5.confirmEnvPreserve(envExamplePath));
    }
  } else {
    fs.writeFileSync(envPath, envContent, 'utf-8');
  }

  // Complete
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║                  Setup complete!                     ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`\n  ${t.setup.complete.labelConfig}  ${configFile}`);
  console.log(`  ${t.setup.complete.labelWorkspace}  ${workspacePath}`);
  console.log(`  ${t.setup.complete.labelLanguage}  ${agentLanguage}`);
  console.log(`  ${t.setup.complete.labelModel}  ${model}`);
  console.log(
    `  ${t.setup.complete.labelPermissions}  ${dangerouslySkipPermissions ? t.setup.complete.permsSkip : t.setup.complete.permsDefault}`,
  );
  console.log('');

  await input({ message: t.setup.complete.pressEnter });
}
