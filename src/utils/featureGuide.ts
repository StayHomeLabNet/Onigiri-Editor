import type { Locale } from '../types';

export interface FeatureGuideEntry {
  id: string;
  titleJa: string;
  titleEn: string;
  descJa: string;
  descEn: string;
  howToJa: string;
  howToEn: string;
  keywords: string[];
  shortcut?: string;
  actionId: string;
}

export const FEATURE_GUIDE_ENTRIES: FeatureGuideEntry[] = [
  {
    id: 'insert-image',
    titleJa: '画像を貼り付ける・サイズ最適化する',
    titleEn: 'Paste & Optimize Images',
    descJa: 'クリップボード画像を自動保存してMarkdownへ挿入し、必要に応じて軽量化します。',
    descEn: 'Auto-save pasted screenshots into assets/ with optional resize & WebP compression.',
    howToJa: 'エディタへ画像を直接ペースト（⌘V / Ctrl+V）またはD&D。「設定 → エディタ」で貼り付け時リサイズ・圧縮をONにできます。',
    howToEn: 'Paste (⌘V / Ctrl+V) or drop images directly. Enable resize/compression in Settings → Editor.',
    keywords: ['画像', '貼', 'ペースト', 'スクショ', 'スクリーンショット', '圧縮', '最適化', 'image', 'paste', 'optimize'],
    actionId: 'insert-image',
  },
  {
    id: 'export-pdf',
    titleJa: 'PDF / HTML として綺麗に書き出す',
    titleEn: 'Export as PDF / Styled HTML',
    descJa: '用紙サイズ・余白・ページ番号・ビジネス/学術デザインを選んで出力します。',
    descEn: 'Export with custom paper size, margins, page numbers, headers/footers, and design themes.',
    howToJa: '上部バー右のダウンロードアイコン →「ページ設定して書き出し (PDF / HTML)...」から設定して出力できます。',
    howToEn: 'Click Export in the TopBar → "Page Setup & Export (PDF / HTML)...".',
    keywords: ['pdf', '印刷', 'プリント', '書き出し', 'エクスポート', 'html', 'a4', 'ページ番号', 'export', 'print'],
    actionId: 'export-page-setup',
  },
  {
    id: 'mobile-preview',
    titleJa: 'スマホ・タブレット幅で Web プレビュー確認',
    titleEn: 'Check Responsive Mobile / Tablet Layout',
    descJa: '内蔵ブラウザまたはQRコードでスマホ実機・モバイル幅（数値指定可）を確認します。',
    descEn: 'Preview in Mobile/Tablet/Custom pixel width or share via LAN QR code to your phone.',
    howToJa: '右ペインの「内蔵ブラウザ」アイコンからスマートフォン・タブレット・数値幅指定を切り替えられます。',
    howToEn: 'Open the Built-in Browser pane to switch Mobile, Tablet, or custom pixel widths.',
    keywords: ['スマホ', '携帯', 'モバイル', 'タブレット', '確認', 'プレビュー', 'qr', 'lan', 'mobile', 'responsive', 'browser'],
    actionId: 'toggle-browser-preview',
  },
  {
    id: 'table-edit',
    titleJa: 'Markdown の表（テーブル）を簡単に編集・ソート',
    titleEn: 'Edit & Sort Markdown Tables with GUI',
    descJa: '行・列の追加削除、左/中央/右揃え、列ソートをボタン1つで実行できます。',
    descEn: 'Add/remove rows & columns, align text, and sort columns with one click.',
    howToJa: 'Markdown の表（| ... |）の中にカーソルを置くと、エディタ上部にテーブル編集バーが自動で現れます。',
    howToEn: 'Place your cursor inside any Markdown table to show the Table GUI Toolbar above the editor.',
    keywords: ['表', 'テーブル', 'ソート', '並び替え', '列', '行', 'table', 'sort', 'align'],
    actionId: 'open-editor-settings',
  },
  {
    id: 'single-break',
    titleJa: 'Enter 1 回の改行をプレビューに反映する',
    titleEn: 'Render Single Enter Line Breaks in Preview',
    descJa: '空行を入れずに Enter 1 回で改行表示するか、厳密な Markdown 仕様にするか切り替えます。',
    descEn: 'Toggle whether single Enter line breaks render as <br> in Preview.',
    howToJa: '「設定 → エディタ」→「Enter 1 回の改行をそのままプレビューに反映する」で ON/OFF できます。',
    howToEn: 'Toggle "Render single line breaks as <br> in Preview" under Settings → Editor.',
    keywords: ['改行', 'enter', 'エンター', 'プレビュー', '反映', 'br', 'line break', 'newline'],
    actionId: 'open-editor-settings',
  },
  {
    id: 'snapshots',
    titleJa: '自動スナップショットのタイムライン・部分復元',
    titleEn: 'Auto Snapshot Timeline & Partial Restore',
    descJa: '自動保存された過去の状態を時系列で確認し、差分を見ながら全文または一部を復元します。',
    descEn: 'Browse automatic snapshots over time, inspect diffs, and restore full or partial chunks.',
    howToJa: '右インスペクターの「差分 / 履歴」タブからタイムライン確認・復元ができます。',
    howToEn: 'Open the Diff / History tab in the right Inspector drawer to view the timeline.',
    keywords: ['履歴', 'スナップショット', 'タイムライン', '復元', '戻す', '上書き', '差分', 'snapshot', 'history', 'restore'],
    actionId: 'open-diff-inspector',
  },
  {
    id: 'compat-check',
    titleJa: 'GitHub / 一般 Markdown との互換性チェック',
    titleEn: 'Markdown Compatibility Check',
    descJa: 'GitHub や標準 CommonMark に貼り付けたとき表示が変わる記法を事前検出します。',
    descEn: 'Detect syntax differences when publishing to GitHub or strict CommonMark.',
    howToJa: '右インスペクターの「校正 / レビュー」タブ内にある互換性チェックから対象を選んで確認できます。',
    howToEn: 'Open the Review tab in the right Inspector drawer to run compatibility checks.',
    keywords: ['互換', 'github', 'commonmark', 'チェック', '違い', '崩れ', 'compatibility', 'lint'],
    actionId: 'open-review-inspector',
  },
  {
    id: 'ai-privacy',
    titleJa: 'AI 送信内容プレビュー・機密情報の自動マスク',
    titleEn: 'Preview AI Payload & Mask Secrets',
    descJa: 'AI に送る前のテキスト・添付内容を確認し、API キー等を伏せ字にできます。',
    descEn: 'Review text and redact API keys/tokens before sending to external AI providers.',
    howToJa: '「設定 → 一般」→「AI 送信前に送信内容プレビューを確認する」を ON にします。',
    howToEn: 'Enable "Preview payload before sending to AI" in Settings → General.',
    keywords: ['ai', '送信', 'プレビュー', '機密', '秘密', 'apiキー', 'マスク', 'privacy', 'secret', 'redact'],
    actionId: 'open-general-settings',
  },
  {
    id: 'shortcuts-modes',
    titleJa: 'シンプル／標準／拡張モードのショートカット設定',
    titleEn: 'Customize Mode & Feature Shortcuts',
    descJa: 'シンプル・標準・拡張モード切替や全112コマンドに好きなショートカットを割り当てます。',
    descEn: 'Assign custom shortcuts to Simple, Basic, Advanced modes and 112+ commands.',
    howToJa: '「設定 → キーボード」の「モード」カテゴリから各モードのキーをクリックして設定できます。',
    howToEn: 'Open Settings → Keybindings and click any Mode command to assign a key.',
    shortcut: '⌘⌥1 / ⌘⌥2 / ⌘⌥3',
    keywords: ['ショートカット', 'キー', 'シンプル', '標準', '拡張', 'モード', '割り当て', 'shortcut', 'keybinding', 'mode'],
    actionId: 'open-keybindings-settings',
  },
  {
    id: 'scratchpad',
    titleJa: '保存不要のメモ（スクラッチパッド）＆一発呼び出し',
    titleEn: 'Quick Scratchpad & Global Summon Hotkey',
    descJa: '思いついたメモを自動保存で書き留め、他アプリからもホットキーで呼び出せます。',
    descEn: 'Auto-persisted quick notes plus an optional global summon shortcut.',
    howToJa: '下部ステータスバー右の「メモ」ボタン、またはコマンドパレットから開けます。',
    howToEn: 'Click "Scratchpad" in the Status Bar or launch from the Command Palette.',
    keywords: ['メモ', 'スクラッチ', '下書き', '呼び出し', 'ホットキー', 'scratchpad', 'note', 'hotkey'],
    actionId: 'open-scratchpad',
  },
  {
    id: 'terminal',
    titleJa: 'アプリ内でコマンド実行（軽量統合ターミナル）',
    titleEn: 'Run Shell Commands in Integrated Terminal',
    descJa: '画面下部のドロワーから git や npm などのコマンドを実行し、エラーをAI解析できます。',
    descEn: 'Run commands in the bottom drawer with history and 1-click AI error diagnosis.',
    howToJa: '拡張モードの下部ステータスバー右にある「ターミナル」ボタンで開閉できます。',
    howToEn: 'Click "Terminal" in the Advanced Mode Status Bar.',
    keywords: ['ターミナル', 'コマンド', 'シェル', 'npm', 'git', 'terminal', 'shell', 'cli'],
    actionId: 'toggle-integrated-terminal',
  },
];

export function searchFeatureGuide(
  query: string,
  _locale: Locale
): FeatureGuideEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return FEATURE_GUIDE_ENTRIES;
  const tokens = q.split(/\s+/).filter(Boolean);
  return FEATURE_GUIDE_ENTRIES.filter((entry) => {
    const haystack = [
      entry.titleJa,
      entry.titleEn,
      entry.descJa,
      entry.descEn,
      entry.howToJa,
      entry.howToEn,
      ...entry.keywords,
    ]
      .join(' ')
      .toLowerCase();
    if (tokens.every((tk) => haystack.includes(tk))) {
      return true;
    }
    // Natural-language Japanese phrase fallback: match if query contains any entry keyword (>= 2 chars)
    return entry.keywords.some(
      (kw) => kw.length >= 2 && q.includes(kw.toLowerCase())
    );
  });
}
