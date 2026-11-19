import { describe, expect, it } from 'vitest';
import {
  buildMarkdownDropLink,
  computeRelativePath,
  formatMarkdownImageSyntax,
  formatMarkdownLinkDestination,
  normalizeLocalMarkdownPath,
} from '../utils/paths';

describe('paths utilities', () => {
  it('computes relative paths across Unix and Windows paths', () => {
    expect(computeRelativePath('/docs/notes/a.md', true, '/docs/assets/pic.png')).toBe(
      '../assets/pic.png'
    );
    expect(computeRelativePath('/docs/a.md', true, '/docs/assets/pic.png')).toBe(
      './assets/pic.png'
    );
    expect(
      computeRelativePath('C:\\Users\\Alice\\Docs\\note.md', true, 'C:\\Users\\Alice\\Docs\\img\\a.png')
    ).toBe('./img/a.png');
  });

  it('formats Markdown destinations with spaces/parens safely in angle brackets', () => {
    expect(formatMarkdownLinkDestination('./assets/my photo (1).png')).toBe(
      '<./assets/my photo (1).png>'
    );
    expect(formatMarkdownLinkDestination('./assets/simple.png')).toBe('./assets/simple.png');
    expect(normalizeLocalMarkdownPath('<C:\\Desktop\\素材\\KIWI WHITE.png>')).toBe(
      'C:/Desktop/素材/KIWI WHITE.png'
    );
  });

  it('builds Markdown image syntax and drop links', () => {
    expect(formatMarkdownImageSyntax('C:\\Desktop\\KIWI WHITE.png', 'KIWI WHITE')).toBe(
      '![KIWI WHITE](<C:/Desktop/KIWI WHITE.png>)'
    );
    expect(
      buildMarkdownDropLink({
        targetPath: '/ws/images/hero banner.png',
        targetName: 'hero banner.png',
        activeDocPath: '/ws/README.md',
      })
    ).toBe('![hero banner](<./images/hero banner.png>)');
    expect(
      buildMarkdownDropLink({
        targetPath: '/ws/notes/ref.md',
        targetName: 'ref.md',
        activeDocPath: '/ws/README.md',
      })
    ).toBe('[ref.md](./notes/ref.md)');
  });
});
