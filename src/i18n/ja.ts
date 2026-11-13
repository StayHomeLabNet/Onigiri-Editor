import type { Translations } from './types';

export const ja: Translations = {
  appName: 'Onigiri-Markdown',
  versionLabel: 'v0.1.0',
  modes: {
    basic: 'ベーシック',
    advanced: 'アドバンスド',
    basicHint: '書くこととプレビューに集中できるシンプルモード',
    advancedHint: 'マルチタブ・アウトライン・AI整形・Diff・設定を備えた高機能モード',
  },
  layouts: {
    editor: 'エディタ',
    split: '分割',
    preview: 'プレビュー',
  },
  themes: {
    light: 'ライト',
    dark: 'ダーク',
    sepia: 'セピア',
    midnight: 'ミッドナイト',
  },
  previewThemes: {
    editorial: 'エディトリアル',
    github: 'GitHub風',
    notion: 'Notion風',
    academic: 'アカデミック',
  },
  actions: {
    newFile: '新規作成',
    openFile: 'ファイルを開く',
    openFolder: 'フォルダを開く',
    save: '保存',
    saveAs: '名前を付けて保存',
    exportHtml: 'HTMLとして書き出し',
    exportPdf: '印刷 / PDF書き出し',
    exportText: 'テキストとして書き出し',
    copyMarkdown: 'Markdownをコピー',
    copyRichText: 'リッチテキストでコピー',
    copyHtml: 'HTMLをコピー',
    pasteHtmlAsMd: 'HTMLをMarkdownに変換して貼付',
    commandPalette: 'コマンドパレット',
    findReplace: '検索と置換',
    zenMode: '集中モード (Zen)',
    exitZen: '集中モードを終了',
    inspector: 'インスペクター',
    sidebar: 'サイドバー',
    about: 'Onigiri-Markdown について',
    close: '閉じる',
    cancel: 'キャンセル',
    apply: '適用',
    reset: 'リセット',
    undo: '元に戻す',
    redo: 'やり直し',
  },
  toolbar: {
    heading1: '見出し 1',
    heading2: '見出し 2',
    heading3: '見出し 3',
    bold: '太字',
    italic: '斜体',
    strikethrough: '取り消し線',
    inlineCode: 'インラインコード',
    codeBlock: 'コードブロック',
    link: 'リンク',
    bulletList: '箇条書き',
    numberedList: '番号付きリスト',
    taskList: 'タスクリスト',
    quote: '引用',
    table: 'テーブル',
    hr: '区切り線',
    math: '数式 (KaTeX)',
    mermaid: 'Mermaid図',
    callout: 'コールアウト',
    aiClean: 'AI出力を整形',
  },
  sidebar: {
    files: 'ファイル',
    outline: 'アウトライン',
    snippets: 'スニペット',
    noFolder: 'フォルダが開かれていません',
    openFolderPrompt: 'Markdownファイルを含むフォルダを開くと、ツリー表示や全文検索が使えます。',
    chooseFolder: 'フォルダを選択',
    filterFiles: 'ファイル名で絞り込み...',
    searchContent: '全文検索',
    searchPlaceholder: 'フォルダ内をキーワード検索...',
    noFilesFound: '該当するファイルがありません',
    noHeadings: '見出し（# 〜 ######）が見つかりません',
    newNoteInFolder: 'フォルダに新規メモ作成',
    refreshFolder: '再読み込み',
    newFilePrompt: '新しいファイル名を入力してください（例: memo.md）',
    insertSnippet: 'クリックしてカーソル位置に挿入',
  },
  inspector: {
    ai: 'AIツール',
    stats: '統計',
    diff: '履歴・差分',
    frontmatter: 'メタデータ',
    settings: '設定',
    aiCleanerTitle: 'AI出力クリーンアップ＆整形',
    aiCleanerDesc: 'ChatGPT・Claude・GeminiなどからコピーしたMarkdownの崩れや不要な空白、テーブルの列幅を一括で整えます。',
    runAiClean: 'ドキュメントを整形する',
    pasteHtmlBtn: 'クリップボードのHTMLをMarkdownで貼付',
    copyRichTextBtn: 'リッチテキストでコピー (Notion / Docs / Slack用)',
    copyHtmlBtn: 'HTMLコードとしてコピー',
    cleanOpts: {
      removeZeroWidth: 'ゼロ幅文字・不可視文字を除去',
      trimTrailingSpaces: '行末の不要なスペースを削除',
      collapseBlankLines: '3行以上の連続空行を整理',
      formatTables: 'GFMテーブルの列幅を自動整形',
      normalizeBullets: '箇条書き記号（* / +）を「-」に統一',
      fixHeadingSpacing: '見出し（#）の前後スペースを整える',
      normalizeQuotes: 'スマートクォート（“ ”）を半角に統一',
    },
    statsLabels: {
      chars: '文字数（空白含む）',
      charsNoSpaces: '文字数（空白除く）',
      words: '単語数',
      lines: '行数',
      paragraphs: '段落数',
      readingTime: '読了目安',
      estimatedTokens: '推定AIトークン数',
      headings: '見出し',
      codeBlocks: 'コードブロック',
      tables: 'テーブル',
      links: 'リンク',
      minuteUnit: '分',
      tokenNote: '※日本語・英語混在テキストに対するLLMトークン数の概算値です',
      wordGoal: '目標単語数 / 文字数目安',
      goalProgress: '目標達成率',
    },
    diffLabels: {
      createSnapshot: 'スナップショット保存',
      snapshotLabelPlaceholder: 'メモ（例: 構成案確定）',
      compareTarget: '比較対象',
      savedVersion: 'ディスク上の保存済み内容',
      noSnapshots: 'スナップショットはまだありません。編集の区切りで保存しておくと差分確認や復元ができます。',
      restore: 'この時点に戻す',
      delete: '削除',
      identical: '比較対象との差分はありません。',
      additions: '追加行',
      deletions: '削除行',
    },
    frontmatterLabels: {
      detected: 'YAML Frontmatter',
      none: 'Frontmatter（---）が見つかりませんでした。',
      addFrontmatter: 'Frontmatterを追加',
      key: 'キー',
      value: '値',
      addField: 'フィールドを追加',
      showCard: 'プレビュー上部にメタデータカードを表示',
      invalidYaml: 'YAMLの構文エラーがあります',
    },
    settingsLabels: {
      fontSize: 'エディタ文字サイズ',
      lineHeight: '行の高さ',
      previewWidth: 'プレビュー最大幅',
      editorFont: 'エディタフォント',
      fontMono: '等幅 (Monospace)',
      fontSans: 'ゴシック (Sans-serif)',
      previewTheme: 'プレビューデザイン',
      lineNumbers: '行番号を表示',
      wordWrap: '右端で折り返す',
      syncScroll: 'エディタとプレビューをスクロール同期',
      typewriterMode: 'タイプライタースクロール（編集行を中央に維持）',
      smartPasteHtml: 'リッチHTML貼付時に自動でMarkdown変換',
      wordGoal: '目標文字数（0で非表示）',
      customCss: 'カスタムCSS（プレビュー用）',
      customCssPlaceholder: '.markdown-body h1 { color: #6366f1; }',
    },
  },
  find: {
    findPlaceholder: '検索...',
    replacePlaceholder: '置換後の文字列...',
    caseSensitive: '大文字/小文字を区別',
    regex: '正規表現',
    wholeWord: '単語単位',
    previous: '前へ',
    next: '次へ',
    replace: '置換',
    replaceAll: 'すべて置換',
    matches: '件一致',
    noMatches: '一致なし',
  },
  status: {
    saved: '保存済み',
    unsaved: '未保存の変更',
    draft: '下書き',
    chars: '文字',
    words: '語',
    tokens: 'トークン(概算)',
    line: '行',
    col: '列',
    syncOn: '同期スクロール ON',
    syncOff: '同期スクロール OFF',
    dropHint: 'ファイルをドロップして開く',
  },
  toasts: {
    savedSuccess: '保存しました',
    copiedRichText: 'リッチテキストとしてコピーしました',
    copiedHtml: 'HTMLをコピーしました',
    copiedMarkdown: 'Markdownをコピーしました',
    copiedCode: 'コードをコピーしました',
    copiedSvg: 'SVG図をコピーしました',
    aiCleaned: 'Markdownを整形しました',
    htmlPasted: 'HTMLをMarkdownに変換して貼り付けました',
    noClipboardHtml: 'クリップボードにHTMLデータが見つかりませんでした',
    snapshotCreated: 'スナップショットを作成しました',
    snapshotRestored: 'スナップショットを復元しました',
    exportedSuccess: '書き出しが完了しました',
    errorPrefix: 'エラー:',
  },
  dialogs: {
    unsavedCloseConfirm: '未保存の変更があります。保存せずに閉じますか？',
    untitledName: '無題のドキュメント.md',
    commandPlaceholder: 'コマンド、ファイル、テーマを検索...',
    noCommands: '該当するコマンドがありません',
    aboutDesc: 'AI時代のドキュメント執筆・レビュー・整形のために設計された、クロスプラットフォーム対応Markdownエディタです。',
    shortcutsTitle: 'キーボードショートカット',
    shortcuts: [
      { keys: '⌘ + S', desc: 'ファイルを保存' },
      { keys: '⌘ + ⇧ + S', desc: '名前を付けて保存' },
      { keys: '⌘ + O', desc: 'ファイルを開く' },
      { keys: '⌘ + N', desc: '新規ドキュメント' },
      { keys: '⌘ + K / ⌘ + P', desc: 'コマンドパレット' },
      { keys: '⌘ + F', desc: '検索・置換' },
      { keys: '⌘ + B / ⌘ + I', desc: '太字 / 斜体' },
      { keys: '⌘ + \\', desc: 'ベーシック / アドバンスド切替' },
      { keys: '⌘ + ⇧ + F', desc: '集中モード (Zen) 切替' },
    ],
  },
  sampleDocument: `---
title: Onigiri-Markdownへようこそ — AI時代のMarkdownエディタ
author: Onigiri-Markdown Team
tags: [AI, Markdown, Productivity]
---

# Onigiri-Markdown へようこそ ✨

**Onigiri-Markdown** は、AIが生成するリッチなMarkdown（表、数式、Mermaid図、コールアウト、コード）を**ストレスなくプレビュー＆編集**するために作られたエディタです。

> [!TIP]
> 上部のスイッチで **「ベーシック」** と **「アドバンスド」** をいつでも切り替えられます。
> 普段はシンプルなベーシックモード、凝った作業をするときはアドバンスドモードをお試しください！

## 主な特徴

- [x] **リアルタイム・同期スクロールプレビュー**（チェックボックスもクリックで切り替え可能！）
- [x] **AI出力のワンクリック整形**（崩れた表の列揃え、不要な空白、ゼロ幅文字を自動クリーンアップ）
- [x] **Mermaid 図表 ＆ KaTeX 数式** のライブレンダリング
- [x] **リッチテキストコピー**：プレビューそのままの見た目で Notion / Google Docs / Slack に貼り付け

### 1. AIがよく出力するコールアウト＆テーブル

> [!NOTE]
> GitHub互換の \`[!NOTE]\` \`[!TIP]\` \`[!IMPORTANT]\` \`[!WARNING]\` \`[!CAUTION]\` 記法に対応しています。

| モード | 向いている用途 | 主な機能 |
| :--- | :--- | :--- |
| **ベーシック** | メモ・AI回答の閲覧と微修正 | シンプル書式バー、分割/切替プレビュー、テーマ切替 |
| **アドバンスド** | 仕様書・記事執筆・プロンプト設計 | マルチタブ、フォルダ検索、アウトライン、Diff、トークン数計測 |

### 2. Mermaid フローチャート（そのまま編集できます）

\`\`\`mermaid
flowchart LR
  AI["🤖 AIのMarkdown出力"] --> Paste["📋 Onigiri-Markdownに貼付"]
  Paste --> Clean["✨ ワンクリック整形"]
  Clean --> Preview["👁️ リアルタイム確認"]
  Preview --> Share["🚀 Rich Copy / HTML / PDF"]
\`\`\`

### 3. 数式（KaTeX）＆ シンタックスハイライト

注意機構（Scaled Dot-Product Attention）の式：

$$
\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V
$$

\`\`\`typescript
// Onigiri-Markdownはコードブロックの言語表示とワンクリックコピーも備えています
export function estimateTokens(text: string): number {
  const cjk = (text.match(/[\\u3040-\\u30ff\\u4e00-\\u9faf]/g) || []).length;
  const other = text.length - cjk;
  return Math.ceil(cjk * 1.4 + other / 4);
}
\`\`\`
`,
};
