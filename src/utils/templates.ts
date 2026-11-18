import type { DocumentTemplate, Locale } from '../types';

const CUSTOM_TEMPLATES_KEY = 'onigiri-markdown.custom-templates.v1';

export function formatLocalDateYmd(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatLocalTimeHm(date = new Date()): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${min}`;
}

export function expandTemplateVariables(
  templateContent: string,
  params?: { title?: string; date?: Date }
): string {
  const d = params?.date ?? new Date();
  const ymd = formatLocalDateYmd(d);
  const time = formatLocalTimeHm(d);
  const title = params?.title || ymd;
  return templateContent
    .replace(/\{\{\s*date\s*\}\}/gi, ymd)
    .replace(/\{\{\s*time\s*\}\}/gi, time)
    .replace(/\{\{\s*title\s*\}\}/gi, title);
}

export function generateDailyNoteContent(dateStr: string, locale: Locale): string {
  if (locale === 'ja') {
    return `---
title: Daily Note ${dateStr}
date: ${dateStr}
tags: [daily]
---

# ${dateStr}

## 今日の目標 / Focus

- [ ] 

## メモ・作業ログ

- 

## 振り返り

- 
`;
  }
  return `---
title: Daily Note ${dateStr}
date: ${dateStr}
tags: [daily]
---

# ${dateStr}

## Focus Today

- [ ] 

## Notes & Log

- 

## Reflection

- 
`;
}

export const BUILTIN_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'meeting-notes',
    title: 'Meeting Notes',
    titleJa: '議事録',
    description: 'Agenda, attendees, discussion notes, and action items',
    descriptionJa: '参加者・議題・決定事項・ネクストアクションのテンプレート',
    fileNamePattern: '{{date}}-meeting.md',
    isBuiltin: true,
    content: `---
title: 議事録 - {{date}}
date: {{date}}
tags: [meeting]
---

# 議事録 ({{date}})

- **日時**: {{date}} {{time}}
- **参加者**: 
- **テーマ**: 

## アジェンダ

1. 
2. 

## 決定事項

- 

## アクションアイテム

- [ ] 担当者: タスク内容 (期限: )
`,
  },
  {
    id: 'tech-spec',
    title: 'Technical Design Doc',
    titleJa: '技術設計書',
    description: 'Background, goals, architecture, API & test plan',
    descriptionJa: '背景・目的・設計方針・テスト計画を含む設計ドキュメント',
    fileNamePattern: '{{date}}-design-doc.md',
    isBuiltin: true,
    content: `---
title: 設計書 - {{title}}
date: {{date}}
status: draft
tags: [design, spec]
---

# {{title}}

## 背景・課題

## ゴール / 非ゴール

- **Goal**: 
- **Non-Goal**: 

## アーキテクチャ・設計

\`\`\`mermaid
flowchart LR
  Client --> API --> Storage
\`\`\`

## 影響範囲・リスク

- 

## テスト・検証計画

- [ ] ユニットテスト
- [ ] 結合テスト
`,
  },
  {
    id: 'adr',
    title: 'ADR (Architecture Decision)',
    titleJa: 'ADR（設計意思決定記録）',
    description: 'Context, decision, and consequences',
    descriptionJa: 'コンテキスト・決定事項・トレードオフの記録',
    fileNamePattern: '{{date}}-adr.md',
    isBuiltin: true,
    content: `---
title: ADR - {{date}}
date: {{date}}
status: proposed
tags: [adr, architecture]
---

# ADR: タイトル

## ステータス

Proposed / Accepted

## コンテキスト（背景）

## 決定事項

## 結果・トレードオフ

- **メリット**: 
- **注意点 / コスト**: 
`,
  },
  {
    id: 'weekly-report',
    title: 'Weekly / Daily Report',
    titleJa: '週報・日報',
    description: 'Done, in progress, blockers, and next steps',
    descriptionJa: '完了したこと・進行中・課題・今後の予定',
    fileNamePattern: '{{date}}-report.md',
    isBuiltin: true,
    content: `---
title: 進捗報告 {{date}}
date: {{date}}
tags: [report]
---

# 進捗報告 ({{date}})

## 完了したこと

- 

## 進行中

- 

## 課題・相談事項

- 

## 次回の予定

- [ ] 
`,
  },
  {
    id: 'blog-article',
    title: 'Article / Blog Draft',
    titleJa: '記事・ブログ下書き',
    description: 'Hook, outline sections, summary, and references',
    descriptionJa: '導入・見出し構成・まとめ・参考リンク',
    fileNamePattern: '{{date}}-article.md',
    isBuiltin: true,
    content: `---
title: {{title}}
date: {{date}}
tags: [article]
---

# {{title}}

## はじめに

## 本題 1

## 本題 2

## まとめ

## 参考リンク

- 
`,
  },
];

export function loadCustomTemplates(): DocumentTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item) =>
          item &&
          typeof item.id === 'string' &&
          typeof item.title === 'string' &&
          typeof item.content === 'string'
      )
      .map((item) => ({
        id: item.id,
        title: item.title,
        description: typeof item.description === 'string' ? item.description : '',
        fileNamePattern:
          typeof item.fileNamePattern === 'string' && item.fileNamePattern.trim()
            ? item.fileNamePattern
            : '{{date}}-note.md',
        content: item.content,
        isBuiltin: false,
      }));
  } catch {
    return [];
  }
}

export function saveCustomTemplates(templates: DocumentTemplate[]): void {
  try {
    const customOnly = templates.filter((t) => !t.isBuiltin);
    localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(customOnly));
  } catch {
    // ignore storage errors
  }
}
