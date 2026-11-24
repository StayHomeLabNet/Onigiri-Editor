import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildInitialSessionState,
  computeTabDirty,
  hydrateTabRecord,
  makeTab,
  serializeTabRecord,
  SESSION_STORAGE_KEY,
} from '../utils/session';

describe('session persistence helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('normalizes CRLF on makeTab and tracks dirty state across content/encoding/eol', () => {
    const tab = makeTab('notes.md', 'line1\r\nline2', '/tmp/notes.md', 1234);
    expect(tab.eol).toBe('\r\n');
    expect(tab.content).toBe('line1\nline2');
    expect(tab.dirty).toBe(false);

    expect(computeTabDirty(tab, 'line1\nline2', 'utf-8', '\r\n')).toBe(false);
    expect(computeTabDirty(tab, 'line1\nchanged', 'utf-8', '\r\n')).toBe(true);
    expect(computeTabDirty(tab, 'line1\nline2', 'shift_jis', '\r\n')).toBe(true);
    expect(computeTabDirty(tab, 'line1\nline2', 'utf-8', '\n')).toBe(true);
  });

  it('serializes and hydrates tabs round-trip', () => {
    const original = makeTab('draft.md', '# Hello\n\nWorld');
    original.dirty = true;
    original.cursorLine = 3;
    original.cursorCol = 5;
    original.bookmarks = [1, 3];

    const record = serializeTabRecord(original);
    const { tab: hydrated, needsDiskLoad } = hydrateTabRecord(record, 'Untitled.md');

    expect(needsDiskLoad).toBe(false);
    expect(hydrated.title).toBe('draft.md');
    expect(hydrated.content).toBe('# Hello\n\nWorld');
    expect(hydrated.dirty).toBe(true);
    expect(hydrated.cursorLine).toBe(3);
    expect(hydrated.bookmarks).toEqual([1, 3]);
  });

  it('restores saved session from localStorage and falls back safely on sample', () => {
    const fallback = buildInitialSessionState(true, 'Welcome.md', 'Welcome sample');
    expect(fallback.tabs).toHaveLength(1);
    expect(fallback.tabs[0].content).toBe('Welcome sample');

    const tab = makeTab('restored.md', '# Restored');
    tab.dirty = true;
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        activeTabId: tab.id,
        workspaceRoot: null,
        tabs: [serializeTabRecord(tab)],
      })
    );

    const restored = buildInitialSessionState(true, 'Welcome.md', 'Welcome sample');
    expect(restored.tabs).toHaveLength(1);
    expect(restored.tabs[0].title).toBe('restored.md');
    expect(restored.activeTabId).toBe(tab.id);
  });

  it('computes topBar and formatToolbar visibility correctly for simple mode defaults', () => {
    const defaultSettings = {
      showTopBar: true,
      hideTopBarInSimpleMode: true,
      showFormatToolbar: true,
      showFormatToolbarInSimpleMode: true,
    };

    const getVisibility = (mode: 'simple' | 'basic' | 'advanced', s: typeof defaultSettings) => ({
      topBar: mode === 'simple' ? !s.hideTopBarInSimpleMode && (s.showTopBar ?? true) : (s.showTopBar ?? true),
      formatToolbar: mode === 'simple' ? Boolean(s.showFormatToolbarInSimpleMode) : (s.showFormatToolbar ?? true),
    });

    // Simple mode: topBar hidden, formatToolbar visible
    expect(getVisibility('simple', defaultSettings)).toEqual({
      topBar: false,
      formatToolbar: true,
    });

    // Basic / Advanced mode: topBar visible, formatToolbar visible
    expect(getVisibility('basic', defaultSettings)).toEqual({
      topBar: true,
      formatToolbar: true,
    });
    expect(getVisibility('advanced', defaultSettings)).toEqual({
      topBar: true,
      formatToolbar: true,
    });
  });
});
