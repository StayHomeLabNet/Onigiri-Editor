import { describe, expect, it } from 'vitest';
import {
  computeBrowserViewportBounds,
  formatBookmarkShortLabel,
  normalizeDisplayUrl,
  pushBrowserHistory,
  resolveBrowserHomeUrl,
  toggleBrowserBookmark,
  urlsShareOrigin,
} from '../components/RightBrowserPane';

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

  it('matches localhost aliases sharing the same port', () => {
    expect(urlsShareOrigin('http://localhost:5173/dashboard', 'http://127.0.0.1:5173/')).toBe(true);
    expect(urlsShareOrigin('http://localhost:5173/', 'http://localhost:5174/')).toBe(false);
    expect(urlsShareOrigin('https://www.google.com/', 'http://localhost:5173/')).toBe(false);
    expect(urlsShareOrigin(null, 'http://localhost:5173/')).toBe(false);
  });

  it('computes centered responsive viewport bounds for full, tablet (768px), and mobile (390px)', () => {
    const rect = { left: 400, top: 100, width: 1000, height: 700 };
    expect(computeBrowserViewportBounds(rect, 'full')).toEqual({
      x: 400,
      y: 100,
      width: 1000,
      height: 700,
    });
    expect(computeBrowserViewportBounds(rect, 'tablet')).toEqual({
      x: 516,
      y: 100,
      width: 768,
      height: 700,
    });
    expect(computeBrowserViewportBounds(rect, 'mobile')).toEqual({
      x: 705,
      y: 100,
      width: 390,
      height: 700,
    });
  });

  it('toggles bookmarks and maintains deduplicated recent URL history', () => {
    const bm1 = toggleBrowserBookmark([], 'localhost:5173/dashboard');
    expect(bm1).toHaveLength(1);
    expect(bm1[0].url).toBe('http://localhost:5173/dashboard');
    expect(bm1[0].label).toBe('localhost:5173/dashboard');
    const bm2 = toggleBrowserBookmark(bm1, 'http://localhost:5173/dashboard');
    expect(bm2).toHaveLength(0);

    let hist = pushBrowserHistory([], 'http://localhost:5173/');
    hist = pushBrowserHistory(hist, 'http://localhost:8000/api');
    hist = pushBrowserHistory(hist, 'http://localhost:5173/');
    expect(hist).toEqual(['http://localhost:5173/', 'http://localhost:8000/api']);
    expect(formatBookmarkShortLabel('https://www.google.com/')).toBe('google.com');
  });
});
