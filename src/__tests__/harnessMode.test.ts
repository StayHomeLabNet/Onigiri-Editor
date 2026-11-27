import { describe, expect, it } from 'vitest';
import { getTranslations, SUPPORTED_LOCALES } from '../i18n';
import { DEFAULT_KEYBINDING_DEFS, resolveEffectiveKeybindings } from '../utils/keybindings';

describe('v2.0.0 AI Harness configuration & i18n', () => {
  it('provides complete AI Harness translations and v2.0.0 label across all 8 locales', () => {
    for (const loc of SUPPORTED_LOCALES) {
      const t = getTranslations(loc);
      expect(t.versionLabel).toBe('v2.0.0');
      expect(t.harness.modeLabel.length).toBeGreaterThan(0);
      expect(t.harness.editorLabel.length).toBeGreaterThan(0);
      expect(t.harness.executePlanBtn.length).toBeGreaterThan(0);
      expect(t.harness.revertTurnBtn.length).toBeGreaterThan(0);
      expect(t.harness.openInEditorBtn.length).toBeGreaterThan(0);
    }
    expect(getTranslations('ja').harness.modeLabel).toBe('AIエージェント');
    expect(getTranslations('en').harness.modeLabel).toBe('AI Agent');
  });

  it('registers the toggle-harness default keybinding (Mod+Shift+H)', () => {
    const def = DEFAULT_KEYBINDING_DEFS.find((d) => d.id === 'toggle-harness');
    expect(def).toBeDefined();
    expect(def?.defaultBinding).toBe('Mod+Shift+H');

    const effective = resolveEffectiveKeybindings({});
    expect(effective['toggle-harness']).toBe('Mod+Shift+H');
  });
});
