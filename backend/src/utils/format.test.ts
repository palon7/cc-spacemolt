import { describe, it, expect } from 'vitest';
import { formatDuration, formatCost, formatJson } from './format.js';

describe('formatDuration', () => {
  it('1000ms -> 1s', () => {
    expect(formatDuration(1000)).toBe('1s');
  });
  it('60000ms -> 1m 0s', () => {
    expect(formatDuration(60000)).toBe('1m 0s');
  });
  it('3600000ms -> 1h 0m', () => {
    expect(formatDuration(3600000)).toBe('1h 0m');
  });
  it('90000ms -> 1m 30s', () => {
    expect(formatDuration(90000)).toBe('1m 30s');
  });
});

describe('formatCost', () => {
  it('formats to 4 decimal places', () => {
    expect(formatCost(0.1234)).toBe('$0.1234');
  });
  it('0 is $0.0000', () => {
    expect(formatCost(0)).toBe('$0.0000');
  });
});

describe('formatJson', () => {
  it('converts object to JSON string', () => {
    expect(formatJson({ a: 1 })).toBe(JSON.stringify({ a: 1 }, null, 2));
  });
  it('circular reference falls back to String conversion', () => {
    const obj: Record<string, unknown> = {};
    obj['self'] = obj;
    const result = formatJson(obj);
    expect(typeof result).toBe('string');
  });
});
