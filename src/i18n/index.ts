import type { Locale } from '../types';
import type { Translations } from './types';
import { ja } from './ja';
import { en } from './en';
import { zhCN } from './zh-CN';
import { zhTW } from './zh-TW';
import { ko } from './ko';
import { es } from './es';
import { fr } from './fr';
import { de } from './de';
import { mergeTranslations } from './merge';

export const SUPPORTED_LOCALES: Locale[] = [
  'en',
  'ja',
  'zh-CN',
  'zh-TW',
  'ko',
  'es',
  'fr',
  'de',
];

export const dictionaries: Record<Locale, Translations> = {
  en,
  ja,
  'zh-CN': mergeTranslations(en, zhCN),
  'zh-TW': mergeTranslations(en, zhTW),
  ko: mergeTranslations(en, ko),
  es: mergeTranslations(en, es),
  fr: mergeTranslations(en, fr),
  de: mergeTranslations(en, de),
};

export const localeNames: Record<Locale, string> = {
  en: 'English',
  ja: '日本語',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  ko: '한국어',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
};

export const localeShortLabels: Record<Locale, string> = {
  en: 'EN',
  ja: '日本語',
  'zh-CN': '简中',
  'zh-TW': '繁中',
  ko: '한국어',
  es: 'ES',
  fr: 'FR',
  de: 'DE',
};

export function isSupportedLocale(val: unknown): val is Locale {
  return typeof val === 'string' && SUPPORTED_LOCALES.includes(val as Locale);
}

export function normalizeLocaleTag(tag: string): Locale {
  const lower = tag.trim().toLowerCase();
  if (lower === 'ja' || lower.startsWith('ja-') || lower.startsWith('ja_')) return 'ja';
  if (
    lower === 'zh-tw' ||
    lower === 'zh_tw' ||
    lower.startsWith('zh-hant') ||
    lower.startsWith('zh-hk') ||
    lower.startsWith('zh-mo')
  ) {
    return 'zh-TW';
  }
  if (lower === 'zh' || lower.startsWith('zh-') || lower.startsWith('zh_')) return 'zh-CN';
  if (lower === 'ko' || lower.startsWith('ko-') || lower.startsWith('ko_')) return 'ko';
  if (lower === 'es' || lower.startsWith('es-') || lower.startsWith('es_')) return 'es';
  if (lower === 'fr' || lower.startsWith('fr-') || lower.startsWith('fr_')) return 'fr';
  if (lower === 'de' || lower.startsWith('de-') || lower.startsWith('de_')) return 'de';
  return 'en';
}

export function hasSavedLocalePreference(): boolean {
  try {
    const saved = localStorage.getItem('onigiri-markdown.locale');
    return isSupportedLocale(saved);
  } catch {
    return false;
  }
}

export function detectInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem('onigiri-markdown.locale');
    if (isSupportedLocale(saved)) {
      return saved;
    }
  } catch {
    // ignore
  }
  const navLang =
    navigator.languages?.[0] ||
    navigator.language ||
    Intl.DateTimeFormat().resolvedOptions().locale ||
    'en';
  return normalizeLocaleTag(navLang);
}

export function getTranslations(locale: Locale): Translations {
  return dictionaries[locale] || en;
}
