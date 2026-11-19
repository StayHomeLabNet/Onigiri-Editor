import type { Locale } from '../types';

export interface SnippetItem {
  id: string;
  category: 'diagram' | 'structure' | 'ai' | 'math' | 'custom';
  title: Record<Locale, string>;
  description: Record<Locale, string>;
  content: string;
  isCustom?: boolean;
}

export const CUSTOM_SNIPPETS_KEY = 'onigiri-markdown.custom-snippets.v1';

export interface CustomSnippetRecord {
  id: string;
  category: 'diagram' | 'structure' | 'ai' | 'math' | 'custom';
  title: string;
  description: string;
  content: string;
}

export function loadCustomSnippets(): CustomSnippetRecord[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_SNIPPETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is CustomSnippetRecord =>
          Boolean(item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.content === 'string')
      )
      .map((item) => ({
        id: item.id,
        category: item.category || 'custom',
        title: item.title,
        description: typeof item.description === 'string' ? item.description : '',
        content: item.content,
      }));
  } catch {
    return [];
  }
}

export function saveCustomSnippets(items: CustomSnippetRecord[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (items.length === 0) {
      localStorage.removeItem(CUSTOM_SNIPPETS_KEY);
    } else {
      localStorage.setItem(CUSTOM_SNIPPETS_KEY, JSON.stringify(items));
    }
  } catch {
    // ignore quota errors
  }
}

export function customRecordToSnippetItem(rec: CustomSnippetRecord): SnippetItem {
  return {
    id: rec.id,
    category: rec.category || 'custom',
    title: { ja: rec.title, en: rec.title },
    description: { ja: rec.description, en: rec.description },
    content: rec.content,
    isCustom: true,
  };
}

export const SNIPPETS: SnippetItem[] = [
  {
    id: 'mermaid-flowchart',
    category: 'diagram',
    title: { ja: 'Mermaid フローチャート', en: 'Mermaid Flowchart' },
    description: { ja: '処理フローやアーキテクチャ図', en: 'Process flow or architecture diagram' },
    content: `\n\`\`\`mermaid\nflowchart TD\n  Start["Start / 開始"] --> Check{"Valid? / 条件判定"}\n  Check -- Yes --> Process["Execute / 実行"]\n  Check -- No --> Fix["Fix Input / 修正"]\n  Process --> Done["Done / 完了"]\n\`\`\`\n`,
  },
  {
    id: 'mermaid-sequence',
    category: 'diagram',
    title: { ja: 'Mermaid シーケンス図', en: 'Mermaid Sequence Diagram' },
    description: { ja: 'API通信やAIエージェントのやり取り', en: 'API calls or agent interactions' },
    content: `\n\`\`\`mermaid\nsequenceDiagram\n  actor User\n  participant App\n  participant LLM\n  User->>App: Send prompt\n  App->>LLM: Stream request\n  LLM-->>App: Markdown response\n  App-->>User: Live Preview\n\`\`\`\n`,
  },
  {
    id: 'mermaid-mindmap',
    category: 'diagram',
    title: { ja: 'Mermaid マインドマップ', en: 'Mermaid Mindmap' },
    description: { ja: 'アイデア出しや構造の整理', en: 'Brainstorming and topic mapping' },
    content: `\n\`\`\`mermaid\nmindmap\n  root((Central Idea))\n    Goals\n      Speed\n      Clarity\n    Features\n      Basic Mode\n      Advanced Mode\n\`\`\`\n`,
  },
  {
    id: 'callout-note',
    category: 'structure',
    title: { ja: 'コールアウト (NOTE / TIP / WARNING)', en: 'Callout Block (NOTE / TIP / WARNING)' },
    description: { ja: 'GitHub互換の強調ボックス', en: 'GitHub-style admonition block' },
    content: `\n> [!NOTE]\n> Key context or important note here.\n`,
  },
  {
    id: 'gfm-table',
    category: 'structure',
    title: { ja: '比較テーブル (3列)', en: 'Comparison Table (3 cols)' },
    description: { ja: '整形済みGFMテーブル', en: 'Clean aligned GFM table' },
    content: `\n| Item | Description | Status |\n| :--- | :--- | :---: |\n| Option A | Fast & lightweight | ✅ |\n| Option B | Feature-rich | 🚧 |\n`,
  },
  {
    id: 'katex-math',
    category: 'math',
    title: { ja: '数式ブロック (KaTeX)', en: 'KaTeX Math Block' },
    description: { ja: 'LaTeXディスプレイ数式', en: 'LaTeX display equation' },
    content: `\n$$\n\\sum_{i=1}^{n} x_i = \\frac{n(n+1)}{2}\n$$\n`,
  },
  {
    id: 'ai-prompt-template',
    category: 'ai',
    title: { ja: 'AIプロンプト設計テンプレート', en: 'AI Prompt Spec Template' },
    description: { ja: 'Role / Context / Constraints / Output', en: 'Structured Role, Context, Constraints & Output' },
    content: `\n## Prompt Specification\n\n### Role\nYou are a senior software architect and technical writer.\n\n### Context\n- **Goal**: \n- **Audience**: \n\n### Constraints\n- Respond in clear, structured Markdown.\n- Keep explanations concise and actionable.\n\n### Output Format\n1. Executive Summary\n2. Detailed Steps\n3. Edge Cases\n`,
  },
  {
    id: 'meeting-notes',
    category: 'structure',
    title: { ja: '議事録＆アクションアイテム', en: 'Meeting Notes & Action Items' },
    description: { ja: '日時・参加者・決定事項・TODO', en: 'Date, attendees, decisions & tasks' },
    content: `\n# Meeting Notes\n\n- **Date**: ${new Date().toISOString().slice(0, 10)}\n- **Attendees**: \n\n## Agenda\n1. \n\n## Decisions\n- \n\n## Action Items\n- [ ] @owner — Task description\n`,
  },
  {
    id: 'frontmatter-yaml',
    category: 'ai',
    title: { ja: 'YAML Frontmatter', en: 'YAML Frontmatter' },
    description: { ja: 'title / date / tags メタデータ', en: 'Document metadata header' },
    content: `---\ntitle: Document Title\ndate: ${new Date().toISOString().slice(0, 10)}\ntags: [markdown, notes]\n---\n\n`,
  },
];
