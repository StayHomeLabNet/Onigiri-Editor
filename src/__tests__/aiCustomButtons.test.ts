import { describe, expect, it } from 'vitest';
import {
  cleanAiCustomResponse,
  cloneDefaultAiCustomButtons,
  createNewAiCustomButton,
  createNewAiCustomSubmenuItem,
  DEFAULT_AI_CUSTOM_BUTTONS,
  DEFAULT_AI_TRANSLATE_PROMPT,
  getActiveSubmenuItems,
  getModelsForAiProvider,
  MAX_AI_CUSTOM_BUTTONS,
  MAX_AI_CUSTOM_SUBMENU_ITEMS,
  normalizeAiCustomButtons,
  resolveAiProviderCallOptions,
} from '../utils/aiCustomButtons';

describe('aiCustomButtons', () => {
  it('provides 1 default AI Translate preset with exact prompt and replaceContent=true', () => {
    expect(DEFAULT_AI_CUSTOM_BUTTONS).toHaveLength(1);
    const preset = DEFAULT_AI_CUSTOM_BUTTONS[0];
    expect(preset.name).toBe('AI翻訳');
    expect(preset.icon).toBe('languages');
    expect(preset.prompt).toBe(DEFAULT_AI_TRANSLATE_PROMPT);
    expect(preset.prompt).toContain('入力テキストの言語を自動判定し、以下のルールに従って翻訳を実行せよ。');
    expect(preset.prompt).toContain('* 英語 → 日本語（自然で読みやすい日本語に翻訳）');
    expect(preset.prompt).toContain('* 日本語 → 英語（自然で適切な英語に翻訳）');
    expect(preset.prompt).toContain('* 翻訳結果のテキストのみを出力すること。');
    expect(preset.prompt).toContain('* 「以下が翻訳結果です」などの前置き、挨拶、解説、注釈は一切禁止する。');
    expect(preset.prompt).toContain('* 原文のニュアンスと改行構造を可能な限り維持すること。');
    expect(preset.replaceContent).toBe(true);
    expect(preset.copyToClipboard).toBe(false);
    expect(preset.submenuEnabled).toBe(false);
    expect(preset.submenuItems).toEqual([]);
  });

  it('falls back to default preset when undefined, but preserves explicit empty array', () => {
    const fromUndef = normalizeAiCustomButtons(undefined);
    expect(fromUndef).toHaveLength(1);
    expect(fromUndef[0].id).toBe('preset-ai-translate');

    const fromEmpty = normalizeAiCustomButtons([]);
    expect(fromEmpty).toEqual([]);
  });

  it('clamps normalized list to MAX_AI_CUSTOM_BUTTONS (5) and sanitizes invalid icons', () => {
    const raw = Array.from({ length: 8 }, (_, idx) => ({
      id: `btn-${idx}`,
      name: `Custom ${idx + 1}`,
      icon: idx === 0 ? 'invalid-icon' : 'wand',
      prompt: `Prompt ${idx + 1}`,
      copyToClipboard: idx % 2 === 0,
      replaceContent: idx % 2 === 1,
    }));

    const normalized = normalizeAiCustomButtons(raw);
    expect(normalized).toHaveLength(MAX_AI_CUSTOM_BUTTONS);
    expect(normalized[0].icon).toBe('sparkles');
    expect(normalized[1].icon).toBe('wand');
    expect(normalized[0].copyToClipboard).toBe(true);
    expect(normalized[0].replaceContent).toBe(false);
  });

  it('creates a new custom button with localized default name', () => {
    const ja = createNewAiCustomButton(1, 'ja');
    expect(ja.name).toBe('AIカスタム 2');
    expect(ja.replaceContent).toBe(true);
    expect(ja.copyToClipboard).toBe(false);

    const en = createNewAiCustomButton(2, 'en');
    expect(en.name).toBe('AI Custom 3');
  });

  it('clones defaults without mutating original preset', () => {
    const cloned = cloneDefaultAiCustomButtons();
    cloned[0].name = 'Edited';
    expect(DEFAULT_AI_CUSTOM_BUTTONS[0].name).toBe('AI翻訳');
  });

  it('strips accidental outer markdown code fence unless original was fenced or prompt asked for code block', () => {
    expect(cleanAiCustomResponse('```markdown\nこんにちは\n```', 'Hello', '翻訳して')).toBe(
      'こんにちは'
    );
    expect(cleanAiCustomResponse('```\nHello\n```', 'こんにちは', '翻訳して')).toBe('Hello');
    expect(
      cleanAiCustomResponse('```json\n{"a":1}\n```', 'a=1', 'JSONのコードブロックに変換して')
    ).toBe('```json\n{"a":1}\n```');
    expect(
      cleanAiCustomResponse('```ts\nconst x = 1;\n```', '```ts\nconst y = 2;\n```', 'リファクタ')
    ).toBe('```ts\nconst x = 1;\n```');
  });

  it('strips <think>...</think> reasoning tags and <input_text> wrapper tags from local LLM outputs', () => {
    expect(
      cleanAiCustomResponse('<think>\nreasoning...\n</think>\n\nこんにちは', 'Hello', '翻訳して')
    ).toBe('こんにちは');
    expect(
      cleanAiCustomResponse('<input_text>\nPlease feel free to contact us.\n</input_text>', '遠慮なくお問い合わせください。', '翻訳して').trim()
    ).toBe('Please feel free to contact us.');
    expect(
      cleanAiCustomResponse('<think>only thinking</think>', 'Hello', '翻訳して').trim()
    ).toBe('');
  });

  it('normalizes submenu items, clamps to MAX_AI_CUSTOM_SUBMENU_ITEMS (10), and respects submenuEnabled', () => {
    const rawSubmenus = Array.from({ length: 14 }, (_, idx) => ({
      id: `sub-${idx}`,
      name: `Sub ${idx + 1}`,
      icon: idx === 0 ? 'bad-icon' : 'zap',
      prompt: `Sub prompt ${idx + 1}`,
      copyToClipboard: idx % 2 === 0,
      replaceContent: idx % 2 === 1,
    }));

    const [btn] = normalizeAiCustomButtons([
      {
        id: 'btn-1',
        name: 'Main',
        icon: 'languages',
        prompt: 'Main prompt',
        copyToClipboard: false,
        replaceContent: true,
        submenuEnabled: true,
        submenuItems: rawSubmenus,
      },
    ]);

    expect(btn.submenuEnabled).toBe(true);
    expect(btn.submenuItems).toHaveLength(MAX_AI_CUSTOM_SUBMENU_ITEMS);
    expect(btn.submenuItems?.[0].icon).toBe('sparkles');
    expect(btn.submenuItems?.[1].icon).toBe('zap');
    expect(getActiveSubmenuItems(btn)).toHaveLength(MAX_AI_CUSTOM_SUBMENU_ITEMS);

    const disabledBtn = { ...btn, submenuEnabled: false };
    expect(getActiveSubmenuItems(disabledBtn)).toEqual([]);
  });

  it('creates a new submenu item with localized default name and replaceContent=true', () => {
    const ja = createNewAiCustomSubmenuItem(0, 'ja');
    expect(ja.name).toBe('サブメニュー 1');
    expect(ja.replaceContent).toBe(true);
    expect(ja.copyToClipboard).toBe(false);

    const en = createNewAiCustomSubmenuItem(2, 'en');
    expect(en.name).toBe('Submenu 3');
  });

  it('resolves default model for apple-foundation-models provider', () => {
    const opts = resolveAiProviderCallOptions({
      provider: 'apple-foundation-models',
      model: '',
      apiKeys: {},
      baseUrls: {},
      customCliCmd: '',
      includeDocContext: false,
      includeFolderContext: false,
    });
    expect(opts.model).toBe('default');
    expect(opts.apiKey).toBeUndefined();
    expect(opts.baseUrl).toBeUndefined();
  });

  it('persists valid per-button and per-submenu aiProvider/aiModel overrides and resolves them', () => {
    const [btn] = normalizeAiCustomButtons([
      {
        id: 'btn-local',
        name: 'Local Translate',
        icon: 'languages',
        prompt: 'Translate',
        copyToClipboard: false,
        replaceContent: true,
        aiProvider: 'ollama',
        aiModel: 'qwen2.5:14b',
        submenuEnabled: true,
        submenuItems: [
          {
            id: 'sub-api',
            name: 'Claude Review',
            icon: 'sparkles',
            prompt: 'Review',
            copyToClipboard: true,
            replaceContent: false,
            aiProvider: 'anthropic-api',
            aiModel: 'claude-sonnet-4-5',
          },
          {
            id: 'sub-invalid',
            name: 'Invalid',
            icon: 'zap',
            prompt: 'Test',
            copyToClipboard: true,
            replaceContent: false,
            aiProvider: 'unknown-provider',
          },
        ],
      },
    ]);

    expect(btn.aiProvider).toBe('ollama');
    expect(btn.aiModel).toBe('qwen2.5:14b');
    expect(btn.submenuItems?.[0].aiProvider).toBe('anthropic-api');
    expect(btn.submenuItems?.[0].aiModel).toBe('claude-sonnet-4-5');
    expect(btn.submenuItems?.[1].aiProvider).toBeUndefined();

    const baseConfig = {
      provider: 'codex-cli' as const,
      model: 'gpt-5.4',
      models: { ollama: 'llama3.2' },
      apiKeys: { 'anthropic-api': 'sk-ant-test' },
      baseUrls: { ollama: 'http://127.0.0.1:11434' },
      customCliCmd: '',
      includeDocContext: false,
      includeFolderContext: false,
    };

    const localOpts = resolveAiProviderCallOptions(baseConfig, btn.aiProvider, btn.aiModel);
    expect(localOpts.provider).toBe('ollama');
    expect(localOpts.model).toBe('qwen2.5:14b');
    expect(localOpts.baseUrl).toBe('http://127.0.0.1:11434');

    const apiOpts = resolveAiProviderCallOptions(
      baseConfig,
      btn.submenuItems?.[0].aiProvider,
      btn.submenuItems?.[0].aiModel
    );
    expect(apiOpts.provider).toBe('anthropic-api');
    expect(apiOpts.model).toBe('claude-sonnet-4-5');
    expect(apiOpts.apiKey).toBe('sk-ant-test');

    const fallbackOpts = resolveAiProviderCallOptions(baseConfig);
    expect(fallbackOpts.provider).toBe('codex-cli');
    expect(fallbackOpts.model).toBe('gpt-5.4');

    expect(getModelsForAiProvider('ollama', null, baseConfig)).toContain('llama3.2');
    expect(getModelsForAiProvider('openai-api')).toContain('gpt-4.1');
  });
});
