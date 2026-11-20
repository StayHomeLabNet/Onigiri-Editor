import { describe, expect, it } from 'vitest';
import { normalizeDisplayUrl, resolveBrowserHomeUrl } from '../components/RightBrowserPane';

describe('RightBrowserPane home URL resolution', () => {
  it('falls back to Google when home URL is empty or whitespace', () => {
    expect(resolveBrowserHomeUrl(undefined)).toBe('https://www.google.com');
    expect(resolveBrowserHomeUrl(null)).toBe('https://www.google.com');
    expect(resolveBrowserHomeUrl('')).toBe('https://www.google.com');
    expect(resolveBrowserHomeUrl('   ')).toBe('https://www.google.com');
  });

  it('normalizes localhost, IP, and domain home URLs cleanly', () => {
    expect(resolveBrowserHomeUrl('http://localhost:5173/')).toBe('http://localhost:5173/');
    expect(resolveBrowserHomeUrl('localhost:8000')).toBe('http://localhost:8000');
    expect(resolveBrowserHomeUrl('127.0.0.1:3000/docs')).toBe('http://127.0.0.1:3000/docs');
    expect(resolveBrowserHomeUrl('example.com')).toBe('https://example.com');
    expect(normalizeDisplayUrl('react docs')).toBe('https://www.google.com/search?q=react%20docs');
  });
});
