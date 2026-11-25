import { describe, expect, it, beforeEach } from 'vitest';
import {
  appendAiAuditEntry,
  clearAiAuditLog,
  loadAiAuditLog,
} from '../utils/aiAuditLog';
import {
  addAiMemoryItem,
  buildAiMemoryPromptBlock,
  clearAiMemoryItems,
  findRelevantWorkspaceNotes,
  getActiveAiMemoryItems,
  toggleAiMemoryItem,
} from '../utils/aiMemory';
import { loadWorkspaceAiRules } from '../utils/aiProjectRules';
import type { WorkspaceNoteIndexEntry } from '../types';

describe('AI Harness utilities', () => {
  beforeEach(() => {
    clearAiAuditLog();
    clearAiMemoryItems();
  });

  it('records audit entries with secrets redacted and respects enabled flag', () => {
    const disabled = appendAiAuditEntry(
      {
        source: 'chat',
        provider: 'codex-cli',
        promptPreview: 'hello',
        responsePreview: 'world',
        durationMs: 120,
      },
      false
    );
    expect(disabled).toBeNull();
    expect(loadAiAuditLog()).toHaveLength(0);

    const saved = appendAiAuditEntry(
      {
        source: 'inline-edit',
        label: 'test.md',
        provider: 'openai-api',
        model: 'gpt-4.1',
        promptPreview: 'Use key sk-proj-abcdefghijklmnopqrstuvwxyz123456',
        responsePreview: 'Done',
        durationMs: 450,
        applied: true,
      },
      true
    );
    expect(saved).not.toBeNull();
    const list = loadAiAuditLog();
    expect(list).toHaveLength(1);
    expect(list[0].promptPreview).toContain('[REDACTED_API_KEY]');
    expect(list[0].promptPreview).not.toContain('abcdefghijklmnopqrstuvwxyz123456');

    clearAiAuditLog();
    expect(loadAiAuditLog()).toHaveLength(0);
  });

  it('returns null from loadWorkspaceAiRules when disabled or no workspaceRoot', async () => {
    expect(await loadWorkspaceAiRules(null, true)).toBeNull();
    expect(await loadWorkspaceAiRules('/tmp/some-workspace', false)).toBeNull();
  });

  it('manages global and workspace-scoped pinned AI memory items', () => {
    const g = addAiMemoryItem('日本語はです・ます調にする', 'global');
    const w1 = addAiMemoryItem('APIキーは例示でもダミーを使う', 'workspace', '/repo/a');
    const w2 = addAiMemoryItem('別のリポジトリ専用ルール', 'workspace', '/repo/b');
    expect(g).not.toBeNull();
    expect(w1).not.toBeNull();
    expect(w2).not.toBeNull();

    const activeForA = getActiveAiMemoryItems('/repo/a', true);
    expect(activeForA.map((x) => x.id)).toEqual([w1!.id, g!.id]);

    const blockA = buildAiMemoryPromptBlock('/repo/a', true);
    expect(blockA).toContain('日本語はです・ます調にする');
    expect(blockA).toContain('APIキーは例示でもダミーを使う');
    expect(blockA).not.toContain('別のリポジトリ専用ルール');

    expect(buildAiMemoryPromptBlock('/repo/a', false)).toBeNull();

    toggleAiMemoryItem(w1!.id);
    const afterToggle = getActiveAiMemoryItems('/repo/a', true);
    expect(afterToggle.map((x) => x.id)).toEqual([g!.id]);
  });

  it('finds relevant workspace notes from knowledge index and excludes activeFilePath', () => {
    const notes: WorkspaceNoteIndexEntry[] = [
      {
        path: '/repo/notes/design.md',
        relativePath: 'notes/design.md',
        name: 'design.md',
        title: 'Editor Architecture',
        tags: [
          { tag: 'architecture', line: 1 },
          { tag: 'ai', line: 2 },
        ],
        outgoingLinks: [{ target: 'AiChatPanel', kind: 'wiki', line: 3, snippet: '[[AiChatPanel]]' }],
      },
      {
        path: '/repo/notes/active.md',
        relativePath: 'notes/active.md',
        name: 'active.md',
        title: 'AI Memory Spec',
        tags: [
          { tag: 'ai', line: 1 },
          { tag: 'memory', line: 2 },
        ],
        outgoingLinks: [],
      },
      {
        path: '/repo/notes/cooking.md',
        relativePath: 'notes/cooking.md',
        name: 'cooking.md',
        title: 'Curry Recipe',
        tags: [{ tag: 'food', line: 1 }],
        outgoingLinks: [],
      },
    ];

    const matches = findRelevantWorkspaceNotes(
      'AI Harness architecture memory',
      notes,
      '/repo/notes/active.md',
      3
    );
    expect(matches.map((n) => n.relativePath)).toEqual(['notes/design.md']);
  });
});
