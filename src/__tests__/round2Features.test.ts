import { describe, expect, it } from 'vitest';
import {
  checkMarkdownCompatibility,
  convertSingleBreaksForStandardMarkdown,
} from '../utils/markdownCompat';
import { buildOrganizedImageName } from '../utils/imageOptimizer';
import { detectAndRedactSecrets } from '../utils/aiPrivacy';
import { searchFeatureGuide } from '../utils/featureGuide';
import { computeBrowserViewportBounds } from '../components/RightBrowserPane';

describe('Markdown compatibility checker', () => {
  it('flags single line breaks and wikilinks for GitHub target, and can auto-fix single breaks', () => {
    const md = [
      'いつもお世話になっております。',
      '早速ですが [[MeetingNote]] を確認してください。',
      '',
      '```ts',
      'const a = 1;',
      'const b = 2;',
      '```',
    ].join('\n');

    const issues = checkMarkdownCompatibility(md, 'github', 'ja', true);
    expect(issues.some((i) => i.code === 'single-line-break')).toBe(true);
    expect(issues.some((i) => i.code === 'wikilink')).toBe(true);

    const fixed = convertSingleBreaksForStandardMarkdown(md);
    expect(fixed).toContain('いつもお世話になっております。  \n早速ですが');
    // Code blocks must remain untouched
    expect(fixed).toContain('const a = 1;\nconst b = 2;');
  });
});

describe('Image optimizer filename organizer', () => {
  it('generates clean timestamped filenames', () => {
    const dt = new Date(2026, 10, 23, 18, 5, 9);
    expect(buildOrganizedImageName('Screenshot 2026.png', 'webp', dt)).toBe(
      '20261123-180509-screenshot-2026.webp'
    );
    expect(buildOrganizedImageName('image.png', 'png', dt)).toBe('20261123-180509-img.png');
  });
});

describe('AI secret detection and redaction', () => {
  it('masks OpenAI/GitHub/AWS keys and env secrets cleanly', () => {
    const raw = [
      'OPENAI_API_KEY=sk-proj-1234567890abcdef1234567890abcdef',
      'token: ghp_1234567890abcdefghij1234567890',
      'aws: AKIAIOSFODNN7EXAMPLE',
    ].join('\n');

    const res = detectAndRedactSecrets(raw);
    expect(res.count).toBeGreaterThanOrEqual(3);
    expect(res.redactedText).not.toContain('sk-proj-');
    expect(res.redactedText).not.toContain('ghp_123456');
    expect(res.redactedText).not.toContain('AKIAIOSFODNN7EXAMPLE');
  });
});

describe('Feature finder guide search', () => {
  it('matches natural-language Japanese and English intents', () => {
    const imgHits = searchFeatureGuide('画像を貼りたい', 'ja');
    expect(imgHits.some((e) => e.id === 'insert-image')).toBe(true);

    const pdfHits = searchFeatureGuide('PDFにしたい', 'ja');
    expect(pdfHits.some((e) => e.id === 'export-pdf')).toBe(true);

    const mobileHits = searchFeatureGuide('mobile preview', 'en');
    expect(mobileHits.some((e) => e.id === 'mobile-preview')).toBe(true);
  });
});

describe('RightBrowserPane custom numeric viewport width', () => {
  it('clamps custom viewport width within available container bounds', () => {
    const rect = { left: 100, top: 80, width: 900, height: 700 };
    expect(computeBrowserViewportBounds(rect, 'custom', 'portrait', 520)).toEqual({
      x: 290,
      y: 80,
      width: 520,
      height: 700,
    });
    expect(computeBrowserViewportBounds(rect, 'custom', 'portrait', 1200)).toEqual({
      x: 100,
      y: 80,
      width: 900,
      height: 700,
    });
  });
});
