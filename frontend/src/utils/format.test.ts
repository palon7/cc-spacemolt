import { describe, it, expect } from 'vitest';
import { formatTokens, formatCost, formatTimestamp } from './format.js';

describe('formatTokens', () => {
  it('999 -> 999', () => {
    expect(formatTokens(999)).toBe('999');
  });
  it('1000 -> 1.0k', () => {
    expect(formatTokens(1000)).toBe('1.0k');
  });
  it('1500 -> 1.5k', () => {
    expect(formatTokens(1500)).toBe('1.5k');
  });
  it('1000000 -> 1.0M', () => {
    expect(formatTokens(1_000_000)).toBe('1.0M');
  });
});

describe('formatCost', () => {
  it('0.1234 -> $0.1234', () => {
    expect(formatCost(0.1234)).toBe('$0.1234');
  });
});

describe('formatTimestamp', () => {
  it('ISO str->ng -> HH:MM:SS format', () => {
    const result = formatTimestamp('2025-01-01T12:34:56.000Z');
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});
