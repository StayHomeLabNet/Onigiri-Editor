import { describe, expect, it } from 'vitest';
import {
  SUPPORTED_LOCALES,
  dictionaries,
  getTranslations,
  isSupportedLocale,
  localeNames,
  localeShortLabels,
  normalizeLocaleTag,
} from '../i18n';
import { en } from '../i18n/en';
import { mergeTranslations } from '../i18n/merge';

describe('i18n multi-language support', () => {
  it('exposes all 8 supported locales with dictionaries, names, and short labels', () => {
    expect(SUPPORTED_LOCALES).toEqual(['en', 'ja', 'zh-CN', 'zh-TW', 'ko', 'es', 'fr', 'de']);
    for (const loc of SUPPORTED_LOCALES) {
      expect(isSupportedLocale(loc)).toBe(true);
      expect(dictionaries[loc]).toBeDefined();
      expect(localeNames[loc]).toBeTruthy();
      expect(localeShortLabels[loc]).toBeTruthy();
      const t = getTranslations(loc);
      expect(t.appName).toBeTruthy();
      expect(t.actions.save).toBeTruthy();
      expect(t.settingsModal.title).toBeTruthy();
      expect(t.sampleDocument).toBeTruthy();
    }
    expect(isSupportedLocale('pt')).toBe(false);
    expect(isSupportedLocale(null)).toBe(false);
  });

  it('falls back to English for missing nested keys in mergeTranslations', () => {
    const merged = mergeTranslations(en, {
      actions: {
        save: 'Guardar',
      },
    });
    expect(merged.actions.save).toBe('Guardar');
    expect(merged.actions.openFile).toBe(en.actions.openFile);
    expect(merged.settingsModal.title).toBe(en.settingsModal.title);
    expect(merged.sampleDocument).toBe(en.sampleDocument);
  });

  it('normalizes OS and browser locale tags to supported locales', () => {
    expect(normalizeLocaleTag('ja')).toBe('ja');
    expect(normalizeLocaleTag('ja-JP')).toBe('ja');
    expect(normalizeLocaleTag('zh-CN')).toBe('zh-CN');
    expect(normalizeLocaleTag('zh_Hans_CN')).toBe('zh-CN');
    expect(normalizeLocaleTag('zh-SG')).toBe('zh-CN');
    expect(normalizeLocaleTag('zh-TW')).toBe('zh-TW');
    expect(normalizeLocaleTag('zh-Hant-TW')).toBe('zh-TW');
    expect(normalizeLocaleTag('zh-HK')).toBe('zh-TW');
    expect(normalizeLocaleTag('ko')).toBe('ko');
    expect(normalizeLocaleTag('ko-KR')).toBe('ko');
    expect(normalizeLocaleTag('es-ES')).toBe('es');
    expect(normalizeLocaleTag('fr-FR')).toBe('fr');
    expect(normalizeLocaleTag('de-DE')).toBe('de');
    expect(normalizeLocaleTag('en-US')).toBe('en');
    expect(normalizeLocaleTag('pt-BR')).toBe('en');
    expect(normalizeLocaleTag('')).toBe('en');
  });
});
