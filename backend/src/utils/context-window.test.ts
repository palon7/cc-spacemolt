import { describe, it, expect } from 'vitest';
import { getContextWindow } from './context-window.js';

describe('getContextWindow', () => {
  it('no betas -> 200000', () => {
    expect(getContextWindow('claude-sonnet')).toBe(200000);
  });
  it('with context-1m -> 1000000', () => {
    expect(getContextWindow('claude-sonnet', ['context-1m-2025-01-01'])).toBe(1000000);
  });
  it('empty array -> 200000', () => {
    expect(getContextWindow('claude-sonnet', [])).toBe(200000);
  });
});
