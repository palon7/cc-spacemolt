# claude-code-client ライブラリ設計案

## 背景

cc-spacemoltというNode.js/TypeScriptプロジェクトのバックエンドで、Claude Code CLIをサブプロセスとして起動・制御しているコードを、汎用ライブラリとして切り出すことを検討しています。

## 現行コード概要

- `ClaudeCliProvider` (300行): cross-spawnでclaudeプロセスを起動、stdin/stdoutをパイプ、readline+NDJSONでストリーム解析
- `message-parser.ts` (472行): stream-json形式のNDJSONをParsedEntry[]に変換。モジュールグローバルな状態(toolNameMap, streamingBlockMap)を持ち、resetParserState()でリセットが必要
- `ProviderCallbacks`インターフェース(onMessage, onRawMessage, onError, onStderr, onUserInput)でイベントを通知

## 提案する設計

### パッケージ配置

```
cc-spacemolt/
  packages/
    claude-code-client/
      src/
        index.ts
        client.ts    — ClaudeCodeClient
        session.ts   — ClaudeCodeSession
        parser.ts    — message-parser (インスタンス化)
        types.ts     — ParsedEntry等のコア型
```

### ClaudeCodeClient (セッションファクトリ)

```typescript
interface ClaudeCodeClientOptions {
  workspacePath: string
  model?: string
  systemPrompt?: string
  mcpConfig?: Record<string, McpServerConfig>
  allowedTools?: string[]
  disallowedTools?: string[]
  bypassPermissions?: boolean
  env?: Record<string, string>
  extraArgs?: string[]
}

class ClaudeCodeClient {
  constructor(options: ClaudeCodeClientOptions)
  /** 新規セッション開始。プロセス起動は非同期だが即座にセッションを返す */
  start(prompt: string): ClaudeCodeSession
  /** 既存セッションを再開。--resume <sessionId> + messageを送る */
  resume(sessionId: string, message?: string): ClaudeCodeSession
}
```

### ClaudeCodeSession (Anthropic SDK MessageStream相当)

```typescript
interface ClaudeCodeSessionEvents {
  connect:   []                       // プロセス起動完了
  entry:     [entry: ParsedEntry]     // 解析済みエントリ (UIに流す)
  text:      [text: string]           // テキストチャンクのみ (便利イベント)
  raw:       [raw: unknown]           // 生JSONライン (ロギング用)
  stderr:    [line: string]           // stderrの行
  error:     [error: Error]           // 致命的エラー
  end:       []                       // プロセス終了 (exitReasonで理由確認)
}

type ExitReason = 'complete' | 'interrupted' | 'aborted' | 'error'

class ClaudeCodeSession {
  readonly sessionId: string          // system/init受信後に確定
  readonly exitReason: ExitReason | null  // end後に確定

  // 型付きEventEmitter
  on<E extends keyof ClaudeCodeSessionEvents>(
    event: E,
    listener: (...args: ClaudeCodeSessionEvents[E]) => void
  ): this
  off<E extends keyof ClaudeCodeSessionEvents>(event: E, listener: ...): this
  once<E extends keyof ClaudeCodeSessionEvents>(event: E, listener: ...): this

  // AsyncIterator (for await対応)
  [Symbol.asyncIterator](): AsyncIterator<ParsedEntry>

  // Promise (完了まで待つ、Anthropic SDK finalMessage()相当)
  done(): Promise<ResultEntry | undefined>

  // 制御
  send(text: string): void   // stdinにフォローアップメッセージ
  interrupt(): void          // SIGINT → exitReason = 'interrupted'
  abort(): void              // SIGTERM → exitReason = 'aborted'
}
```

### 使用例

```typescript
// 基本的な使い方
const client = new ClaudeCodeClient({
  workspacePath: '/path/to/workspace',
  model: 'claude-sonnet-4-6',
  allowedTools: ['Read', 'Write', 'Bash'],
})

const session = client.start('タスクを実行して')
session.on('entry', (entry) => broadcastToWebSocket(entry))
session.on('raw',   (raw)   => fileLogger.write(JSON.stringify(raw) + '\n'))
const result = await session.done()

// AsyncIterator として使う
for await (const entry of client.start('何かして')) {
  console.log(entry.kind, entry)
}

// 中断 → 再開フロー
const session = client.start('長いタスク')
session.on('entry', (e) => ui.update(e))
session.on('end', async () => {
  if (session.exitReason === 'interrupted') {
    const resumed = client.resume(session.sessionId)
    resumed.on('entry', (e) => ui.update(e))
    await resumed.done()
  }
})
setTimeout(() => session.interrupt(), 5000)
```

### アプリ側アダプター (移行後のClaudeCliProvider)

```typescript
class ClaudeCliProvider implements AgentProvider {
  private client: ClaudeCodeClient
  private currentSession: ClaudeCodeSession | null = null

  constructor({ config, bypassPermissions, workspacePath }: ClaudeCliOptions) {
    this.client = new ClaudeCodeClient({
      workspacePath,
      model:            config.model,
      systemPrompt:     buildSystemPrompt(config),  // app固有ロジックはここに残る
      mcpConfig:        config.mcpServers,
      allowedTools:     buildAllowedTools(config),  // app固有ロジックはここに残る
      bypassPermissions,
      env:              config.claudeEnv,
      extraArgs:        config.claudeArgs,
    })
  }

  async start(callbacks: ProviderCallbacks, prompt?: string): Promise<void> {
    const session = this.resumeId
      ? this.client.resume(this.resumeId)
      : this.client.start(prompt ?? '')
    this.currentSession = session
    session.on('entry',  (e)    => callbacks.onMessage(e))
    session.on('raw',    (raw)  => callbacks.onRawMessage(raw))
    session.on('error',  (err)  => callbacks.onError(err))
    session.on('stderr', (line) => callbacks.onStderr?.(line))
    await session.done()
  }

  sendMessage(text: string) { this.currentSession?.send(text) }
  interrupt()               { this.currentSession?.interrupt() }
  abort()                   { this.currentSession?.abort() }
}
```

## 主な改善点

| 項目 | 現行 | 新設計 |
|---|---|---|
| パーサー状態 | モジュールグローバル → resetParserState()必要 | セッションインスタンスに閉じ込め |
| 複数リスナー | callbacksは1セット | .on()で複数登録可能 |
| resume | isResuming フラグ管理が複雑 | client.resume()で新セッションとして明確に分離 |
| 型安全性 | ProviderCallbacksはプレーンな関数型 | ClaudeCodeSessionEventsによる型付きイベント |
| テスト | プロセスをモックする必要 | セッションをEventEmitterとしてモック可能 |

## 質問・懸念点

1. この設計で問題になりそうな点はありますか？
2. interrupt→resumeフローで、endイベント後に手動でresumeを呼ぶ設計は適切ですか？
3. AsyncIteratorとEventEmitterを同時に持つことで起きうる問題はありますか？
4. 型付きEventEmitterの実装にはどのアプローチが良いですか？(Node.js標準のEventEmitter拡張 vs 独自実装)
5. ParsedEntry等の型はライブラリが所有し、sharedから再エクスポートする方向は適切ですか？
