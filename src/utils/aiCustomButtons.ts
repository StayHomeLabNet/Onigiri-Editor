import type {
  AiCapabilities,
  AiCustomButton,
  AiCustomButtonIconId,
  AiCustomSubmenuItem,
  AiProviderConfig,
  AiProviderId,
  Locale,
} from '../types';

export const MAX_AI_CUSTOM_BUTTONS = 5;
export const MAX_AI_CUSTOM_SUBMENU_ITEMS = 10;

export interface AiCustomIconOption {
  id: AiCustomButtonIconId;
  labelJa: string;
  labelEn: string;
}

export const AI_CUSTOM_ICON_OPTIONS: AiCustomIconOption[] = [
  { id: 'languages', labelJa: '翻訳', labelEn: 'Translate' },
  { id: 'sparkles', labelJa: 'AI / キラキラ', labelEn: 'Sparkles' },
  { id: 'wand', labelJa: '魔法の杖', labelEn: 'Magic Wand' },
  { id: 'spellcheck', labelJa: '校正', labelEn: 'Proofread' },
  { id: 'file-text', labelJa: '文書', labelEn: 'Document' },
  { id: 'align-left', labelJa: '要約 / 整形', labelEn: 'Summarize' },
  { id: 'bot', labelJa: 'ロボット', labelEn: 'Bot' },
  { id: 'zap', labelJa: 'クイック実行', labelEn: 'Quick Action' },
  { id: 'lightbulb', labelJa: 'アイデア', labelEn: 'Idea' },
  { id: 'pen-line', labelJa: 'リライト', labelEn: 'Rewrite' },
  { id: 'check-check', labelJa: 'チェック', labelEn: 'Review' },
  { id: 'list-checks', labelJa: '箇条書き', labelEn: 'Checklist' },
  { id: 'code', labelJa: 'コード', labelEn: 'Code' },
  { id: 'message-square', labelJa: '会話 / トーン', labelEn: 'Tone' },
  { id: 'book-open', labelJa: '解説', labelEn: 'Explain' },
  { id: 'refresh-cw', labelJa: '変換', labelEn: 'Convert' },
  { id: 'scissors', labelJa: '短縮', labelEn: 'Shorten' },
  { id: 'tags', labelJa: 'タグ抽出', labelEn: 'Extract Tags' },
  { id: 'mail', labelJa: 'メール', labelEn: 'Email' },
  { id: 'brain', labelJa: '分析', labelEn: 'Analyze' },
  { id: 'globe', labelJa: 'グローバル', labelEn: 'Globe' },
  { id: 'file-search', labelJa: '検索 / 調査', labelEn: 'Inspect' },
  { id: 'smile', labelJa: 'やさしい表現', labelEn: 'Friendly' },
  { id: 'terminal', labelJa: 'コマンド', labelEn: 'Terminal' },
];

const VALID_ICON_IDS = new Set<AiCustomButtonIconId>(
  AI_CUSTOM_ICON_OPTIONS.map((opt) => opt.id)
);

export const AI_PROVIDER_LABELS: Record<AiProviderId, string> = {
  'codex-cli': 'Codex CLI',
  'claude-cli': 'Claude Code CLI',
  'gemini-cli': 'Gemini CLI',
  'antigravity-cli': 'Antigravity CLI',
  'custom-cli': 'Custom CLI',
  'openai-api': 'OpenAI API',
  'anthropic-api': 'Anthropic API',
  'gemini-api': 'Gemini API',
  'apple-foundation-models': 'Apple Foundation Models',
  ollama: 'Ollama',
  lmstudio: 'LM Studio',
  'openai-compat': 'OpenAI-Compat',
};

export const AI_CUSTOM_PROVIDER_GROUPS: Array<{
  group: 'subscription' | 'api' | 'local';
  providers: AiProviderId[];
}> = [
  {
    group: 'subscription',
    providers: ['codex-cli', 'claude-cli', 'gemini-cli', 'antigravity-cli', 'custom-cli'],
  },
  {
    group: 'api',
    providers: ['openai-api', 'anthropic-api', 'gemini-api'],
  },
  {
    group: 'local',
    providers: ['ollama', 'lmstudio', 'openai-compat', 'apple-foundation-models'],
  },
];

const VALID_PROVIDER_IDS = new Set<AiProviderId>(
  Object.keys(AI_PROVIDER_LABELS) as AiProviderId[]
);

export function isValidAiProviderId(val: unknown): val is AiProviderId {
  return typeof val === 'string' && VALID_PROVIDER_IDS.has(val as AiProviderId);
}

export interface AiPromptVariableContext {
  selection?: string;
  clipboard?: string;
  fileName?: string;
  filePath?: string;
  language?: string;
  date?: string;
  time?: string;
}

export const AI_PROMPT_VARIABLE_TOKENS = [
  { token: '{{selection}}', labelJa: '選択テキスト', labelEn: 'Selection' },
  { token: '{{clipboard}}', labelJa: 'クリップボード', labelEn: 'Clipboard' },
  { token: '{{fileName}}', labelJa: 'ファイル名', labelEn: 'File Name' },
  { token: '{{filePath}}', labelJa: 'ファイルパス', labelEn: 'File Path' },
  { token: '{{language}}', labelJa: '言語', labelEn: 'Language' },
  { token: '{{date}}', labelJa: '今日の日付', labelEn: 'Today Date' },
  { token: '{{time}}', labelJa: '現在時刻', labelEn: 'Current Time' },
] as const;

export function hasClipboardVariable(prompt: string): boolean {
  return /\{\{\s*clipboard\s*\}\}/i.test(prompt);
}

/**
 * Expands `{{variable}}` placeholders inside an AI Custom prompt.
 */
export function expandAiPromptVariables(
  prompt: string,
  ctx: AiPromptVariableContext
): string {
  if (!prompt || !prompt.includes('{{')) return prompt;
  const now = new Date();
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const defaultDate = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const defaultTime = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

  const map: Record<string, string> = {
    selection: ctx.selection ?? '',
    clipboard: ctx.clipboard ?? '',
    filename: ctx.fileName ?? '',
    filepath: ctx.filePath ?? '',
    language: ctx.language ?? '',
    date: ctx.date ?? defaultDate,
    time: ctx.time ?? defaultTime,
  };

  return prompt.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (full, rawKey: string) => {
    const key = rawKey.toLowerCase();
    return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : full;
  });
}

export const DEFAULT_AI_TRANSLATE_PROMPT = [
  '# 命令',
  '',
  '入力テキストの言語を自動判定し、以下のルールに従って翻訳を実行せよ。',
  '* 英語 → 日本語（自然で読みやすい日本語に翻訳）',
  '* 日本語 → 英語（自然で適切な英語に翻訳）',
  '',
  '',
  '# 制約事項',
  '',
  '* 翻訳結果のテキストのみを出力すること。',
  '* 「以下が翻訳結果です」などの前置き、挨拶、解説、注釈は一切禁止する。',
  '* 原文のニュアンスと改行構造を可能な限り維持すること。',
].join('\n');

export interface AiTranslatePresetSpec {
  name: string;
  prompt: string;
}

export const AI_TRANSLATE_PRESETS: Record<Locale, AiTranslatePresetSpec> = {
  ja: {
    name: 'AI翻訳',
    prompt: DEFAULT_AI_TRANSLATE_PROMPT,
  },
  en: {
    name: 'AI Translate',
    prompt: [
      '# Instructions',
      '',
      'Automatically detect the language of the input text and translate it according to the following rules:',
      '* English → Japanese (natural, easy-to-read Japanese)',
      '* Japanese → English (natural, idiomatic English)',
      '',
      '# Constraints',
      '',
      '* Output ONLY the translated text.',
      '* Do NOT include any preambles, greetings, explanations, or notes.',
      '* Preserve the original nuance and line-break structure as much as possible.',
    ].join('\n'),
  },
  'zh-CN': {
    name: 'AI 翻译',
    prompt: [
      '# 指令',
      '',
      '自动识别输入文本的语言，并按照以下规则进行翻译：',
      '* 英语 → 简体中文（翻译为自然流畅的简体中文）',
      '* 简体中文 → 英语（翻译为自然地道的英语）',
      '',
      '# 约束条件',
      '',
      '* 仅输出翻译后的文本。',
      '* 严禁添加“以下是翻译结果”等前缀、问候、解释或注释。',
      '* 尽可能保留原文的语气与换行结构。',
    ].join('\n'),
  },
  'zh-TW': {
    name: 'AI 翻譯',
    prompt: [
      '# 指令',
      '',
      '自動辨識輸入文字的語言，並依下列規則執行翻譯：',
      '* 英語 → 繁體中文（翻譯為自然流暢的繁體中文）',
      '* 繁體中文 → 英語（翻譯為自然道地的英語）',
      '',
      '# 限制條件',
      '',
      '* 僅輸出翻譯後的文字。',
      '* 嚴禁加入「以下為翻譯結果」等前導語、問候、說明或註解。',
      '* 盡可能保留原文的語氣與換行結構。',
    ].join('\n'),
  },
  ko: {
    name: 'AI 번역',
    prompt: [
      '# 지시사항',
      '',
      '입력 텍스트의 언어를 자동으로 감지하고 다음 규칙에 따라 번역하세요:',
      '* 영어 → 한국어 (자연스럽고 읽기 쉬운 한국어로 번역)',
      '* 한국어 → 영어 (자연스럽고 적절한 영어로 번역)',
      '',
      '# 제약 조건',
      '',
      '* 번역된 텍스트만 출력하세요.',
      '* "다음은 번역 결과입니다"와 같은 서두, 인사, 설명, 주석을 절대 포함하지 마세요.',
      '* 원문의 뉘앙스와 줄바꿈 구조를 가능한 한 유지하세요.',
    ].join('\n'),
  },
  es: {
    name: 'Traducir IA',
    prompt: [
      '# Instrucciones',
      '',
      'Detecta automáticamente el idioma del texto de entrada y tradúcelo según las siguientes reglas:',
      '* Inglés → Español (español natural y fluido)',
      '* Español → Inglés (inglés natural e idiomático)',
      '',
      '# Restricciones',
      '',
      '* Devuelve ÚNICAMENTE el texto traducido.',
      '* No incluyas introducciones, saludos, explicaciones ni notas.',
      '* Conserva el matiz original y la estructura de saltos de línea en la medida de lo posible.',
    ].join('\n'),
  },
  fr: {
    name: 'Traduction IA',
    prompt: [
      '# Instructions',
      '',
      "Détecte automatiquement la langue du texte d'entrée et traduis-le selon les règles suivantes :",
      '* Anglais → Français (français naturel et fluide)',
      '* Français → Anglais (anglais naturel et idiomatique)',
      '',
      '# Contraintes',
      '',
      '* Affiche UNIQUEMENT le texte traduit.',
      "* N'ajoute aucun préambule, salutation, explication ou note.",
      "* Préserve autant que possible les nuances et la structure des sauts de ligne d'origine.",
    ].join('\n'),
  },
  de: {
    name: 'KI-Übersetzen',
    prompt: [
      '# Anweisungen',
      '',
      'Erkenne die Sprache des Eingabetextes automatisch und übersetze nach folgenden Regeln:',
      '* Englisch → Deutsch (natürliches, gut lesbares Deutsch)',
      '* Deutsch → Englisch (natürliches, idiomatisches Englisch)',
      '',
      '# Vorgaben',
      '',
      '* Gib AUSSCHLIESSLICH den übersetzten Text aus.',
      '* Keine Einleitungen, Begrüßungen, Erklärungen oder Anmerkungen.',
      '* Bewahre Nuancen und Zeilenumbruch-Struktur des Originals so weit wie möglich.',
    ].join('\n'),
  },
};

export function getDefaultAiTranslatePreset(locale: Locale = 'ja'): AiTranslatePresetSpec {
  return AI_TRANSLATE_PRESETS[locale] ?? AI_TRANSLATE_PRESETS.en;
}

export const DEFAULT_AI_CUSTOM_BUTTONS: AiCustomButton[] = [
  {
    id: 'preset-ai-translate',
    name: 'AI翻訳',
    icon: 'languages',
    prompt: DEFAULT_AI_TRANSLATE_PROMPT,
    copyToClipboard: false,
    replaceContent: true,
    submenuEnabled: false,
    submenuItems: [],
  },
];

export function cloneDefaultAiCustomButtons(locale: Locale = 'ja'): AiCustomButton[] {
  const preset = getDefaultAiTranslatePreset(locale);
  return DEFAULT_AI_CUSTOM_BUTTONS.map((btn) => ({
    ...btn,
    ...(btn.id === 'preset-ai-translate' ? { name: preset.name, prompt: preset.prompt } : {}),
    submenuItems: (btn.submenuItems ?? []).map((item) => ({ ...item })),
  }));
}

/**
 * If the default `preset-ai-translate` button is present and still has an unmodified
 * built-in name & prompt for some locale, updates it to `targetLocale`'s preset.
 * Returns `null` if no change is needed (or if the user customized the preset).
 */
export function syncDefaultAiTranslateButtonLocale(
  buttons: AiCustomButton[] | undefined,
  targetLocale: Locale
): AiCustomButton[] | null {
  if (!Array.isArray(buttons)) return null;
  const target = getDefaultAiTranslatePreset(targetLocale);
  let changed = false;
  const next = buttons.map((btn) => {
    if (btn.id !== 'preset-ai-translate') return btn;
    const isUnmodifiedPreset = Object.values(AI_TRANSLATE_PRESETS).some(
      (spec) => spec.name === btn.name && spec.prompt === btn.prompt
    );
    if (!isUnmodifiedPreset) return btn;
    if (btn.name === target.name && btn.prompt === target.prompt) return btn;
    changed = true;
    return {
      ...btn,
      name: target.name,
      prompt: target.prompt,
    };
  });
  return changed ? next : null;
}

export function isValidAiCustomIconId(val: unknown): val is AiCustomButtonIconId {
  return typeof val === 'string' && VALID_ICON_IDS.has(val as AiCustomButtonIconId);
}

export function normalizeAiCustomSubmenuItems(raw: unknown): AiCustomSubmenuItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: AiCustomSubmenuItem[] = [];
  for (let i = 0; i < raw.length && result.length < MAX_AI_CUSTOM_SUBMENU_ITEMS; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object') continue;
    const obj = item as Partial<AiCustomSubmenuItem>;
    const baseId =
      typeof obj.id === 'string' && obj.id.trim()
        ? obj.id.trim()
        : `ai-custom-sub-${i + 1}`;
    const id = seen.has(baseId) ? `${baseId}-${i + 1}` : baseId;
    seen.add(id);
    const aiProvider = isValidAiProviderId(obj.aiProvider) ? obj.aiProvider : undefined;
    const aiModel =
      typeof obj.aiModel === 'string' && obj.aiModel.trim() ? obj.aiModel.trim() : undefined;
    result.push({
      id,
      name: typeof obj.name === 'string' ? obj.name : '',
      icon: isValidAiCustomIconId(obj.icon) ? obj.icon : 'sparkles',
      prompt: typeof obj.prompt === 'string' ? obj.prompt : '',
      copyToClipboard: Boolean(obj.copyToClipboard),
      replaceContent:
        typeof obj.replaceContent === 'boolean' ? obj.replaceContent : false,
      ...(aiProvider ? { aiProvider } : {}),
      ...(aiModel ? { aiModel } : {}),
    });
  }
  return result;
}

/**
 * Normalizes a persisted or imported `aiCustomButtons` value.
 * - `undefined` / non-array falls back to the default preset (1 AI Translate button).
 * - An explicit empty array `[]` is preserved so users can remove all buttons if desired.
 * - Truncates to `MAX_AI_CUSTOM_BUTTONS` (5).
 */
export function normalizeAiCustomButtons(raw: unknown, locale: Locale = 'ja'): AiCustomButton[] {
  if (!Array.isArray(raw)) {
    return cloneDefaultAiCustomButtons(locale);
  }
  const seen = new Set<string>();
  const result: AiCustomButton[] = [];
  for (let i = 0; i < raw.length && result.length < MAX_AI_CUSTOM_BUTTONS; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object') continue;
    const obj = item as Partial<AiCustomButton>;
    const baseId =
      typeof obj.id === 'string' && obj.id.trim()
        ? obj.id.trim()
        : `ai-custom-${i + 1}`;
    const id = seen.has(baseId) ? `${baseId}-${i + 1}` : baseId;
    seen.add(id);
    const aiProvider = isValidAiProviderId(obj.aiProvider) ? obj.aiProvider : undefined;
    const aiModel =
      typeof obj.aiModel === 'string' && obj.aiModel.trim() ? obj.aiModel.trim() : undefined;
    result.push({
      id,
      name: typeof obj.name === 'string' ? obj.name : '',
      icon: isValidAiCustomIconId(obj.icon) ? obj.icon : 'sparkles',
      prompt: typeof obj.prompt === 'string' ? obj.prompt : '',
      copyToClipboard: Boolean(obj.copyToClipboard),
      replaceContent:
        typeof obj.replaceContent === 'boolean' ? obj.replaceContent : false,
      ...(aiProvider ? { aiProvider } : {}),
      ...(aiModel ? { aiModel } : {}),
      submenuEnabled: Boolean(obj.submenuEnabled),
      submenuItems: normalizeAiCustomSubmenuItems(obj.submenuItems),
    });
  }
  return result;
}

export function getActiveSubmenuItems(button: AiCustomButton): AiCustomSubmenuItem[] {
  if (!button.submenuEnabled || !Array.isArray(button.submenuItems)) return [];
  return button.submenuItems;
}

export function createNewAiCustomButton(
  existingCount: number,
  locale: Locale
): AiCustomButton {
  const num = existingCount + 1;
  return {
    id: `ai-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: locale === 'ja' ? `AIカスタム ${num}` : `AI Custom ${num}`,
    icon: 'sparkles',
    prompt: '',
    copyToClipboard: false,
    replaceContent: true,
    submenuEnabled: false,
    submenuItems: [],
  };
}

export function createNewAiCustomSubmenuItem(
  existingCount: number,
  locale: Locale
): AiCustomSubmenuItem {
  const num = existingCount + 1;
  return {
    id: `ai-custom-sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: locale === 'ja' ? `サブメニュー ${num}` : `Submenu ${num}`,
    icon: 'sparkles',
    prompt: '',
    copyToClipboard: false,
    replaceContent: true,
  };
}

const DEFAULT_BASE_URLS: Partial<Record<AiProviderId, string>> = {
  'openai-api': 'https://api.openai.com/v1',
  'anthropic-api': 'https://api.anthropic.com',
  ollama: 'http://127.0.0.1:11434',
  lmstudio: 'http://127.0.0.1:1234/v1',
  'openai-compat': 'http://127.0.0.1:8080/v1',
};

const DEFAULT_MODELS: Partial<Record<AiProviderId, string>> = {
  'openai-api': 'gpt-4.1',
  'anthropic-api': 'claude-sonnet-4-5',
  'gemini-api': 'gemini-2.5-flash',
  'apple-foundation-models': 'default',
  ollama: 'llama3.2',
  lmstudio: 'local-model',
  'openai-compat': 'gpt-4.1-mini',
};

const CURATED_PROVIDER_MODELS: Partial<Record<AiProviderId, string[]>> = {
  'codex-cli': ['gpt-5.4', 'gpt-5.3-codex', 'gpt-5.2-codex', 'o4-mini', 'o3'],
  'claude-cli': [
    'sonnet',
    'opus',
    'haiku',
    'claude-sonnet-4-5',
    'claude-opus-4-1',
    'claude-haiku-4-5',
  ],
  'gemini-cli': [
    'auto',
    'gemini-3.8-flash',
    'gemini-3.5-flash',
    'gemini-3.1-pro-preview',
    'gemini-3-flash-preview',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-pro',
  ],
  'antigravity-cli': [
    'gemini-4-hydrogen-high',
    'gemini-4-hydrogen-medium',
    'gemini-4-argon-high',
    'gemini-4-argon-medium',
    'gemini-3.8-flash-high',
    'gemini-3.8-flash-medium',
    'claude-opus-5-5-high',
    'claude-sonnet-5-5-medium',
    'gpt-oss-120b-medium',
  ],
  'openai-api': ['gpt-4.1', 'gpt-4.1-mini', 'o4-mini', 'gpt-4o'],
  'anthropic-api': ['claude-sonnet-4-5', 'claude-opus-4-1', 'claude-haiku-4-5'],
  'gemini-api': [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-3.1-pro-preview',
    'gemini-3-flash-preview',
    'gemini-2.5-flash-lite',
  ],
  'apple-foundation-models': ['default', 'permissive'],
};

export function getModelsForAiProvider(
  provider: AiProviderId,
  caps?: AiCapabilities | null,
  aiConfig?: AiProviderConfig | null
): string[] {
  const detected: string[] = [];
  if (caps) {
    switch (provider) {
      case 'codex-cli':
        detected.push(...caps.codexModels);
        if (caps.codexDefaultModel) detected.unshift(caps.codexDefaultModel);
        break;
      case 'claude-cli':
        detected.push(...caps.claudeModels);
        break;
      case 'gemini-cli':
        detected.push(...caps.geminiModels);
        break;
      case 'antigravity-cli':
        detected.push(...caps.antigravityModels);
        if (caps.antigravityDefaultModel) detected.unshift(caps.antigravityDefaultModel);
        break;
      case 'ollama':
        detected.push(...caps.ollamaModels);
        break;
      case 'lmstudio':
        detected.push(...caps.lmstudioModels);
        break;
      default:
        break;
    }
  }
  const curated = CURATED_PROVIDER_MODELS[provider] ?? [];
  const savedForProvider = aiConfig?.models?.[provider]?.trim();
  const activeIfSame =
    aiConfig && aiConfig.provider === provider ? aiConfig.model.trim() : '';
  const def = DEFAULT_MODELS[provider];

  const merged = [...detected, ...curated, savedForProvider, activeIfSame, def]
    .map((m) => (m ?? '').trim())
    .filter(Boolean);
  return Array.from(new Set(merged));
}

export function resolveAiProviderCallOptions(
  aiConfig: AiProviderConfig,
  overrideProvider?: AiProviderId,
  overrideModel?: string
): {
  provider: AiProviderId;
  model: string | undefined;
  apiKey: string | undefined;
  baseUrl: string | undefined;
  customCliCmd: string;
} {
  const effectiveProvider: AiProviderId = overrideProvider ?? aiConfig.provider;
  const providerModel = aiConfig.models?.[effectiveProvider]?.trim();
  const activeModel =
    effectiveProvider === aiConfig.provider ? aiConfig.model.trim() : '';
  const effectiveModel =
    overrideModel?.trim() ||
    activeModel ||
    providerModel ||
    DEFAULT_MODELS[effectiveProvider] ||
    '';
  return {
    provider: effectiveProvider,
    model: effectiveModel || undefined,
    apiKey: aiConfig.apiKeys[effectiveProvider] || undefined,
    baseUrl:
      aiConfig.baseUrls[effectiveProvider] ||
      DEFAULT_BASE_URLS[effectiveProvider] ||
      undefined,
    customCliCmd: aiConfig.customCliCmd,
  };
}

/**
 * Strips an accidental single outer Markdown code fence added by an LLM
 * when the original input did not start with a code fence and the prompt
 * did not explicitly request code blocks.
 */
export function cleanAiCustomResponse(
  output: string,
  original: string,
  prompt: string
): string {
  let cleaned = output;
  // Strip <think>...</think> reasoning blocks emitted by local thinking models (Qwen3, DeepSeek-R1, etc.)
  if (!/<think>/i.test(original) && !/<think>/i.test(prompt)) {
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>\s*/gi, '');
  }
  // Strip accidental <input_text>...</input_text> wrapper tags if echoed by small local models
  cleaned = cleaned.replace(/<\/?input_text>\s*/gi, '');

  const trimmed = cleaned.trim();
  if (!trimmed.startsWith('```') || original.trim().startsWith('```')) {
    return cleaned;
  }
  if (/```|コードブロック|code\s*block|fenced/i.test(prompt)) {
    return cleaned;
  }
  const match = trimmed.match(/^```[^\n]*\n([\s\S]*?)\n```$/);
  if (!match) return cleaned;
  return match[1];
}
