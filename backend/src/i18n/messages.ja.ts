import type { TranslationMessages } from './messages.js';

export const ja: TranslationMessages = {
  setup: {
    step2: {
      header: 'Step 2/5 · ワークスペース',
      desc: '  CLAUDE.md などのファイルが入った既存のSpaceMolt用ワークスペースがある場合は、ここで指定できます。',
      hasWorkspace: '既存のSpaceMolt用ワークスペースはありますか？',
      wsPath: 'ワークスペースのパス:',
      dirNotExist: (p: string) => `  ディレクトリがまだ存在しません — 作成されます: ${p}`,
      defaultWs: (p: string) => `  デフォルトのワークスペースを使用します: ${p}`,
    },
    step3: {
      header: 'Step 3/5 · SpaceMolt アカウント',
      hasCredentials: 'SpaceMolt のアカウント（ユーザー名・パスワード）はお持ちですか？',
      username: 'SpaceMolt ユーザー名:',
      password: 'SpaceMolt パスワード:',
      noAccountLine1: '  次のサイトでアカウントを作成してください:',
      noAccountLine2: (url: string) => `  ${url}`,
      noAccountLine3:
        '  登録後に登録コードを確認してください。以下に入力するか、Enter でスキップして後で入力してください。',
      registerCode: '登録コード:',
    },
    step4: {
      header: 'Step 4/5 · アクセス権限',
      permissionMode: 'パーミッションモード:',
      choiceDefault:
        'デフォルト: ワークスペース内へのアクセスのみ許可、不要なツールへのアクセスを制限（推奨）',
      choiceSkip: 'すべての操作を許可 (--dangerously-skip-permissions): 注意して使用してください',
    },
    step5: {
      header: 'Step 5/5 · Claude モデル',
      modelQuestion: '使用する Claude モデル:',
      choiceSonnet: 'Sonnet（推奨）',
      choiceOpus: 'Opus',
      choiceHaiku: 'Haiku',
      choiceCustom: 'モデル名を手動入力',
      customModelName: 'モデル名:',
      confirmEnvOverwrite: 'このワークスペースには既に .env ファイルが存在します。上書きしますか？',
      confirmEnvPreserve: (path: string) =>
        `${path} に保存しました。手動で.envにマージしてください。`,
    },
    complete: {
      pressEnter: 'Enter を押して cc-spacemolt を起動します...',
      labelConfig: '設定ファイル:     ',
      labelWorkspace: 'ワークスペース:  ',
      labelLanguage: '言語:   ',
      labelModel: 'モデル:      ',
      labelPermissions: '権限:',
      permsDefault: 'デフォルト',
      permsSkip: 'バイパス (--dangerously-skip-permissions)',
    },
  },
};
