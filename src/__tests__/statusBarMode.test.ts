import { describe, expect, it } from 'vitest';
import { getNextStatusBarMode } from '../components/StatusBar';

describe('getNextStatusBarMode', () => {
  it('moves from simple to basic', () => {
    expect(getNextStatusBarMode('simple')).toBe('basic');
  });

  it('moves from basic to advanced', () => {
    expect(getNextStatusBarMode('basic')).toBe('advanced');
  });

  it('moves from advanced back to basic', () => {
    expect(getNextStatusBarMode('advanced')).toBe('basic');
  });
});
