import { describe, it, expect } from 'vitest';
import { truncate, truncateLines } from './truncate.js';

describe('truncate', () => {
  it('returns short string as-is', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });
  it('returns string as-is when exactly maxLength', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });
  it('truncates with ... when exceeding limit', () => {
    expect(truncate('hello world', 8)).toBe('hello...');
  });
});

describe('truncateLines', () => {
  it('returns as-is when within line count', () => {
    expect(truncateLines('a\nb\nc', 5)).toEqual({ text: 'a\nb\nc', truncated: false });
  });
  it('truncates with truncated:true when exceeding', () => {
    expect(truncateLines('a\nb\nc\nd', 2)).toEqual({ text: 'a\nb', truncated: true });
  });
  it('returns as-is when exactly at boundary', () => {
    expect(truncateLines('a\nb', 2)).toEqual({ text: 'a\nb', truncated: false });
  });
});
