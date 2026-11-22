import type {
  AiCustomButton,
  AiCustomButtonIconId,
  AiProviderConfig,
  AiProviderId,
  Locale,
} from '../types';

export const MAX_AI_CUSTOM_BUTTONS = 5;

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

export const DEFAULT_AI_TRANSLATE_PROMPT = [
  'この文章が英文であれば、日本語に翻訳してください',
  'この文章が日本語であれば、英文に翻訳してください',
  '返答は、翻訳結果だけにしてください',
].join('\n');

export const DEFAULT_AI_CUSTOM_BUTTONS: AiCustomButton[] = [
  {
    id: 'preset-ai-translate',
    name: 'AI翻訳',
    icon: 'languages',
    prompt: DEFAULT_AI_TRANSLATE_PROMPT,
    copyToClipboard: false,
    replaceContent: true,
  },
];

export function cloneDefaultAiCustomButtons(): AiCustomButton[] {
  return DEFAULT_AI_CUSTOM_BUTTONS.map((btn) => ({ ...btn }));
}

export function isValidAiCustomIconId(val: unknown): val is AiCustomButtonIconId {
  return typeof val === 'string' && VALID_ICON_IDS.has(val as AiCustomButtonIconId);
}

/**
 * Normalizes a persisted or imported `aiCustomButtons` value.
 * - `undefined` / non-array falls back to the default preset (1 AI Translate button).
 * - An explicit empty array `[]` is preserved so users can remove all buttons if desired.
 * - Truncates to `MAX_AI_CUSTOM_BUTTONS` (5).
 */
export function normalizeAiCustomButtons(raw: unknown): AiCustomButton[] {
  if (!Array.isArray(raw)) {
    return cloneDefaultAiCustomButtons();
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
    result.push({
      id,
      name: typeof obj.name === 'string' ? obj.name : '',
      icon: isValidAiCustomIconId(obj.icon) ? obj.icon : 'sparkles',
      prompt: typeof obj.prompt === 'string' ? obj.prompt : '',
      copyToClipboard: Boolean(obj.copyToClipboard),
      replaceContent:
        typeof obj.replaceContent === 'boolean' ? obj.replaceContent : false,
    });
  }
  return result;
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
  ollama: 'llama3.2',
  lmstudio: 'local-model',
  'openai-compat': 'gpt-4.1-mini',
};

export function resolveAiProviderCallOptions(aiConfig: AiProviderConfig): {
  model: string | undefined;
  apiKey: string | undefined;
  baseUrl: string | undefined;
  customCliCmd: string;
} {
  const providerModel = aiConfig.models?.[aiConfig.provider]?.trim();
  const effectiveModel =
    aiConfig.model.trim() || providerModel || DEFAULT_MODELS[aiConfig.provider] || '';
  return {
    model: effectiveModel || undefined,
    apiKey: aiConfig.apiKeys[aiConfig.provider] || undefined,
    baseUrl:
      aiConfig.baseUrls[aiConfig.provider] || DEFAULT_BASE_URLS[aiConfig.provider] || undefined,
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
  const trimmed = output.trim();
  if (!trimmed.startsWith('```') || original.trim().startsWith('```')) {
    return output;
  }
  if (/```|コードブロック|code\s*block|fenced/i.test(prompt)) {
    return output;
  }
  const match = trimmed.match(/^```[^\n]*\n([\s\S]*?)\n```$/);
  if (!match) return output;
  return match[1];
}
