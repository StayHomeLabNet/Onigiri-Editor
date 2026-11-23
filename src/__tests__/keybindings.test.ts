import { describe, expect, it } from 'vitest';
import {
  buildAiCustomKeybindingDefs,
  DEFAULT_KEYBINDING_DEFS,
  findKeybindingConflicts,
  getAiCustomButtonKeybindingId,
  getAiCustomSubmenuKeybindingId,
  matchesKeybinding,
  normalizeKeyboardEventToBinding,
  resolveEffectiveKeybindings,
} from '../utils/keybindings';
import type { AiCustomButton } from '../types';

function makeKeyboardEvent(init: {
  key: string;
  code?: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}): KeyboardEvent {
  return {
    key: init.key,
    code: init.code ?? '',
    metaKey: Boolean(init.metaKey),
    ctrlKey: Boolean(init.ctrlKey),
    altKey: Boolean(init.altKey),
    shiftKey: Boolean(init.shiftKey),
  } as KeyboardEvent;
}

describe('keybindings', () => {
  it('defines dedicated shortcuts for simple, basic, and advanced modes without conflicts', () => {
    const effective = resolveEffectiveKeybindings({});
    expect(effective['mode-simple']).toBe('Mod+Alt+1');
    expect(effective['mode-basic']).toBe('Mod+Alt+2');
    expect(effective['mode-advanced']).toBe('Mod+Alt+3');
    expect(effective['cycle-mode']).toBe('Mod+\\');
    expect(findKeybindingConflicts(effective)).toEqual({});
    expect(DEFAULT_KEYBINDING_DEFS.length).toBeGreaterThan(70);
  });

  it('normalizes and matches Option/Alt shortcuts using physical key code', () => {
    const origPlatform = Object.getOwnPropertyDescriptor(window.navigator, 'platform');
    const origUserAgent = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');
    Object.defineProperty(window.navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
    });
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      configurable: true,
    });
    try {
      // On macOS, Option+1 produces '¡' and Option+T produces '†' in e.key while e.code is 'Digit1'/'KeyT'
      const evModeSimple = makeKeyboardEvent({
        key: '¡',
        code: 'Digit1',
        metaKey: true,
        altKey: true,
      });
      expect(normalizeKeyboardEventToBinding(evModeSimple)).toBe('Mod+Alt+1');
      expect(matchesKeybinding(evModeSimple, 'Mod+Alt+1')).toBe(true);
      expect(matchesKeybinding(evModeSimple, 'Mod+Alt+2')).toBe(false);

      const evAiCustom = makeKeyboardEvent({
        key: '†',
        code: 'KeyT',
        metaKey: true,
        altKey: true,
      });
      expect(normalizeKeyboardEventToBinding(evAiCustom)).toBe('Mod+Alt+T');
      expect(matchesKeybinding(evAiCustom, 'Mod+Alt+T')).toBe(true);
    } finally {
      if (origPlatform) Object.defineProperty(window.navigator, 'platform', origPlatform);
      if (origUserAgent) Object.defineProperty(window.navigator, 'userAgent', origUserAgent);
    }
  });

  it('builds dynamic keybindings for AI custom buttons and enabled submenus and detects conflicts', () => {
    const buttons: AiCustomButton[] = [
      {
        id: 'preset-ai-translate',
        name: 'AI翻訳',
        icon: 'languages',
        prompt: 'Translate',
        copyToClipboard: false,
        replaceContent: true,
        submenuEnabled: true,
        submenuItems: [
          {
            id: 'sub-1',
            name: '要約',
            icon: 'align-left',
            prompt: 'Summarize',
            copyToClipboard: true,
            replaceContent: false,
          },
        ],
      },
      {
        id: 'btn-2',
        name: '校正',
        icon: 'spellcheck',
        prompt: 'Proofread',
        copyToClipboard: false,
        replaceContent: true,
        submenuEnabled: false,
        submenuItems: [
          {
            id: 'sub-disabled',
            name: '無効項目',
            icon: 'sparkles',
            prompt: 'Ignored',
            copyToClipboard: false,
            replaceContent: true,
          },
        ],
      },
    ];

    const extraDefs = buildAiCustomKeybindingDefs(buttons, 'AIカスタム', 'サブメニュー');
    const btn1Id = getAiCustomButtonKeybindingId('preset-ai-translate');
    const sub1Id = getAiCustomSubmenuKeybindingId('preset-ai-translate', 'sub-1');
    const btn2Id = getAiCustomButtonKeybindingId('btn-2');
    const disabledSubId = getAiCustomSubmenuKeybindingId('btn-2', 'sub-disabled');

    expect(extraDefs.map((d) => d.id)).toEqual([btn1Id, sub1Id, btn2Id]);
    expect(extraDefs[1].label).toBe('AI翻訳 › 要約');

    const effective = resolveEffectiveKeybindings(
      {
        [btn1Id]: 'Mod+Alt+T',
        [sub1Id]: 'Mod+Alt+1', // conflicts with mode-simple
        [disabledSubId]: 'Mod+S', // disabled submenu should not be included or cause conflict
      },
      extraDefs
    );

    expect(effective[btn1Id]).toBe('Mod+Alt+T');
    expect(effective[sub1Id]).toBe('Mod+Alt+1');
    expect(effective[disabledSubId]).toBeUndefined();

    const conflicts = findKeybindingConflicts(effective);
    expect(conflicts[sub1Id]).toEqual(['mode-simple']);
    expect(conflicts['mode-simple']).toEqual([sub1Id]);
    expect(conflicts['save-file']).toBeUndefined();
  });
});
