import type { Translations } from './types';

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? Array<U>
    : T[K] extends Record<string, unknown>
      ? DeepPartial<T[K]>
      : T[K];
};

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function deepMergeObjects(
  base: Record<string, unknown>,
  override: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override)) {
    const ov = override[key];
    if (ov === undefined) continue;
    const bv = base[key];
    if (isPlainObject(bv) && isPlainObject(ov)) {
      result[key] = deepMergeObjects(bv, ov);
    } else {
      result[key] = ov;
    }
  }
  return result;
}

export function mergeTranslations(
  base: Translations,
  override: DeepPartial<Translations>
): Translations {
  return deepMergeObjects(
    base as unknown as Record<string, unknown>,
    override as unknown as Record<string, unknown>
  ) as unknown as Translations;
}
