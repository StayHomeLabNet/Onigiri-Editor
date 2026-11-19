import { renderMarkdownToHtml } from './markdown';

export interface RichTextCopyOptions {
  isDark?: boolean;
}

const LIGHT_PALETTE = {
  text: '#1f2328',
  muted: '#57606a',
  border: '#d0d7de',
  codeBg: '#f6f8fa',
  tableHeaderBg: '#f3f4f6',
  quoteBg: '#f8fafc',
  quoteBorder: '#3b82f6',
  link: '#0969da',
};

function applyInlineStyles(container: HTMLElement): void {
  const p = LIGHT_PALETTE;
  // Always use clean light-mode readable styles for pasted rich text (Word, Google Docs, Notion, Gmail)
  container.style.fontFamily =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Sans', 'Yu Gothic UI', sans-serif";
  container.style.fontSize = '14px';
  container.style.lineHeight = '1.65';
  container.style.color = p.text;

  const styleMap: Array<[string, Record<string, string>]> = [
    [
      'h1',
      {
        fontSize: '22px',
        fontWeight: '700',
        margin: '18px 0 10px',
        paddingBottom: '4px',
        borderBottom: `1px solid ${p.border}`,
        color: p.text,
      },
    ],
    [
      'h2',
      {
        fontSize: '18px',
        fontWeight: '700',
        margin: '16px 0 8px',
        paddingBottom: '3px',
        borderBottom: `1px solid ${p.border}`,
        color: p.text,
      },
    ],
    ['h3', { fontSize: '15.5px', fontWeight: '700', margin: '14px 0 6px', color: p.text }],
    ['h4, h5, h6', { fontSize: '14px', fontWeight: '700', margin: '12px 0 4px', color: p.text }],
    ['p', { margin: '0 0 10px', color: p.text }],
    ['ul, ol', { margin: '0 0 10px', paddingLeft: '22px' }],
    ['li', { margin: '3px 0' }],
    ['a', { color: p.link, textDecoration: 'underline' }],
    [
      'blockquote',
      {
        margin: '10px 0',
        padding: '8px 14px',
        borderLeft: `4px solid ${p.quoteBorder}`,
        backgroundColor: p.quoteBg,
        color: p.muted,
      },
    ],
    [
      'pre',
      {
        margin: '10px 0',
        padding: '10px 12px',
        backgroundColor: p.codeBg,
        border: `1px solid ${p.border}`,
        borderRadius: '6px',
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        fontSize: '12.5px',
        lineHeight: '1.5',
        whiteSpace: 'pre-wrap',
        color: p.text,
      },
    ],
    [
      ':not(pre) > code',
      {
        padding: '1px 5px',
        backgroundColor: p.codeBg,
        border: `1px solid ${p.border}`,
        borderRadius: '4px',
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        fontSize: '0.9em',
        color: '#b42318',
      },
    ],
    [
      'table',
      {
        borderCollapse: 'collapse',
        margin: '12px 0',
        width: '100%',
        fontSize: '13.5px',
      },
    ],
    [
      'th',
      {
        border: `1px solid ${p.border}`,
        padding: '6px 10px',
        backgroundColor: p.tableHeaderBg,
        fontWeight: '700',
        textAlign: 'left',
      },
    ],
    [
      'td',
      {
        border: `1px solid ${p.border}`,
        padding: '6px 10px',
        textAlign: 'left',
      },
    ],
    ['hr', { border: 'none', borderTop: `1px solid ${p.border}`, margin: '16px 0' }],
    ['img', { maxWidth: '100%', height: 'auto' }],
  ];

  for (const [selector, styles] of styleMap) {
    container.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      for (const [k, v] of Object.entries(styles)) {
        el.style[k as unknown as number] = v;
      }
    });
  }

  // Convert HTML task list checkboxes into Unicode symbols so Word/Docs/Slack retain checkmarks cleanly
  container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb) => {
    const marker = document.createTextNode(cb.checked ? '☑ ' : '☐ ');
    cb.parentNode?.replaceChild(marker, cb);
  });
}

export async function buildRichClipboardPayload(markdown: string): Promise<{
  html: string;
  plain: string;
}> {
  const rawHtml = await renderMarkdownToHtml(markdown);
  const wrapper = document.createElement('div');
  wrapper.innerHTML = rawHtml;
  applyInlineStyles(wrapper);
  const styledHtml = wrapper.outerHTML;
  const plain = wrapper.innerText?.trim() || markdown;
  return { html: styledHtml, plain };
}
