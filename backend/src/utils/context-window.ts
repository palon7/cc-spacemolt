const CONTEXT_1M = 1_000_000;
const CONTEXT_200K = 200_000;

/**
 * Determine the context window size from model name and enabled betas.
 * Default is 200k. Returns 1M if the context-1m beta is active.
 */
export function getContextWindow(model: string, betas?: string[]): number {
  // Explicit 1M beta takes priority
  if (betas?.some((b) => b.startsWith('context-1m'))) {
    return CONTEXT_1M;
  }

  // Claude Code with subscription often uses 1M context by default
  // for Opus and Sonnet 4.5+, but we can't detect subscription status.
  // Fallback to 200k as the conservative default.
  return CONTEXT_200K;
}
