import type { Locale } from '../types';
import type { Translations } from './types';
import { ja } from './ja';
import { en } from './en';

export const dictionaries: Record<Locale, Translations> = {
  ja,
  en,
};

export const localeNames: Record<Locale, string> = {
  ja: '日本語',
  en: 'English',
};

export function hasSavedLocalePreference(): boolean {
  try {
    const saved = localStorage.getItem('onigiri-markdown.locale');
    return saved === 'ja' || saved === 'en';
  } catch {
    return false;
  }
}

export function detectInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem('onigiri-markdown.locale');
    if (saved === 'ja' || saved === 'en') {
      return saved;
    }
  } catch {
    // ignore
  }
  const navLang = (
    navigator.languages?.[0] ||
    navigator.language ||
    Intl.DateTimeFormat().resolvedOptions().locale ||
    'en'
  ).toLowerCase();
  return navLang.startsWith('ja') ? 'ja' : 'en';
}

export function getTranslations(locale: Locale): Translations {
  return dictionaries[locale] || en;
}
