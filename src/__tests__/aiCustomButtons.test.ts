import { describe, expect, it } from 'vitest';
import {
  cleanAiCustomResponse,
  cloneDefaultAiCustomButtons,
  createNewAiCustomButton,
  DEFAULT_AI_CUSTOM_BUTTONS,
  DEFAULT_AI_TRANSLATE_PROMPT,
  MAX_AI_CUSTOM_BUTTONS,
  normalizeAiCustomButtons,
} from '../utils/aiCustomButtons';

describe('aiCustomButtons', () => {
  it('provides 1 default AI Translate preset with exact prompt and replaceContent=true', () => {
    expect(DEFAULT_AI_CUSTOM_BUTTONS).toHaveLength(1);
    const preset = DEFAULT_AI_CUSTOM_BUTTONS[0];
    expect(preset.name).toBe('AI翻訳');
    expect(preset.icon).toBe('languages');
    expect(preset.prompt).toBe(DEFAULT_AI_TRANSLATE_PROMPT);
    expect(preset.prompt).toContain('この文章が英文であれば、日本語に翻訳してください');
    expect(preset.prompt).toContain('この文章が日本語であれば、英文に翻訳してください');
    expect(preset.prompt).toContain('返答は、翻訳結果だけにしてください');
    expect(preset.replaceContent).toBe(true);
    expect(preset.copyToClipboard).toBe(false);
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
});
