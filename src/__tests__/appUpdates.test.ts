import { describe, expect, it } from 'vitest';
import {
  buildReleaseNotesDocument,
  computeCheckIntervalMs,
  formatAssetSize,
  isVersionSkipped,
  normalizeVersionString,
  resolvePrimaryAutoUpdateUrl,
  shouldShowAutoUpdateNotification,
  shouldTriggerPeriodicUpdateCheck,
} from '../components/UpdateModal';
import type { AppUpdateInfo } from '../types';

const SAMPLE_UPDATE: AppUpdateInfo = {
  currentVersion: '1.3.3',
  latestVersion: '1.4.0',
  hasUpdate: true,
  releaseUrl: 'https://github.com/StayHomeLabNet/Onigiri-Editor/releases/tag/v1.4.0',
  releaseName: 'Onigiri Editor v1.4.0',
  publishedAt: '2026-11-22T00:00:00Z',
  notes: '### New Features\n- Auto-update support',
  downloadUrl: 'https://example.com/Onigiri.Editor_1.4.0_universal.dmg',
  autoUpdateUrl: 'https://example.com/Onigiri_Editor_v1.4.0_macos-universal.app.tar.gz',
  canInPlaceUpdate: true,
  assets: [],
  checkedAtMs: 1_700_000_000_000,
};

describe('App update & auto-update helpers', () => {
  it('normalizes version strings and checks skipped versions accurately', () => {
    expect(normalizeVersionString('v1.4.0')).toBe('1.4.0');
    expect(normalizeVersionString(' V1.4.0 ')).toBe('1.4.0');
    expect(isVersionSkipped('v1.4.0', '1.4.0')).toBe(true);
    expect(isVersionSkipped('1.4.0', 'v1.4.0')).toBe(true);
    expect(isVersionSkipped('1.4.1', '1.4.0')).toBe(false);
    expect(isVersionSkipped('1.4.0', '')).toBe(false);
  });

  it('determines whether to show auto-update notifications based on skip & dismiss state', () => {
    expect(shouldShowAutoUpdateNotification(SAMPLE_UPDATE, '', false)).toBe(true);
    expect(shouldShowAutoUpdateNotification(SAMPLE_UPDATE, '', true)).toBe(false);
    expect(shouldShowAutoUpdateNotification(SAMPLE_UPDATE, '1.4.0', false)).toBe(false);
    expect(shouldShowAutoUpdateNotification(SAMPLE_UPDATE, '1.3.9', false)).toBe(true);
    expect(
      shouldShowAutoUpdateNotification({ ...SAMPLE_UPDATE, hasUpdate: false }, '', false)
    ).toBe(false);
  });

  it('computes periodic check intervals and triggers periodic checks when elapsed', () => {
    expect(computeCheckIntervalMs(0)).toBeNull();
    expect(computeCheckIntervalMs(-1)).toBeNull();
    expect(computeCheckIntervalMs(6)).toBe(6 * 3600 * 1000);

    const sixHoursMs = 6 * 3600 * 1000;
    const baseTime = 1_700_000_000_000;

    expect(
      shouldTriggerPeriodicUpdateCheck({
        autoCheckEnabled: true,
        intervalHours: 6,
        lastCheckedAtMs: baseTime,
        nowMs: baseTime + sixHoursMs - 1000,
        isChecking: false,
      })
    ).toBe(false);

    expect(
      shouldTriggerPeriodicUpdateCheck({
        autoCheckEnabled: true,
        intervalHours: 6,
        lastCheckedAtMs: baseTime,
        nowMs: baseTime + sixHoursMs + 1000,
        isChecking: false,
      })
    ).toBe(true);

    expect(
      shouldTriggerPeriodicUpdateCheck({
        autoCheckEnabled: false,
        intervalHours: 6,
        lastCheckedAtMs: baseTime,
        nowMs: baseTime + sixHoursMs * 2,
        isChecking: false,
      })
    ).toBe(false);

    expect(
      shouldTriggerPeriodicUpdateCheck({
        autoCheckEnabled: true,
        intervalHours: 0,
        lastCheckedAtMs: baseTime,
        nowMs: baseTime + sixHoursMs * 2,
        isChecking: false,
      })
    ).toBe(false);
  });

  it('resolves primary auto-update URL and formats release notes document for editor tabs', () => {
    expect(resolvePrimaryAutoUpdateUrl(SAMPLE_UPDATE)).toBe(
      'https://example.com/Onigiri_Editor_v1.4.0_macos-universal.app.tar.gz'
    );
    expect(
      resolvePrimaryAutoUpdateUrl({
        ...SAMPLE_UPDATE,
        autoUpdateUrl: null,
      })
    ).toBe('https://example.com/Onigiri.Editor_1.4.0_universal.dmg');

    const docJa = buildReleaseNotesDocument(SAMPLE_UPDATE, 'ja');
    expect(docJa.title).toBe('Release Notes v1.4.0.md');
    expect(docJa.content).toContain('# Onigiri Editor v1.4.0');
    expect(docJa.content).toContain('Auto-update support');
    expect(formatAssetSize(21_505_280)).toBe('20.5 MB');
  });
});
