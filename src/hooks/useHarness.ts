import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AiCapabilities,
  AiProviderConfig,
  AiProviderId,
  EditorSettings,
  HarnessEventPayload,
  HarnessPermissionMode,
  HarnessThread,
  HarnessTimelineEntry,
} from '../types';
import { appendAiAuditEntry } from '../utils/aiAuditLog';
import { buildAiMemoryPromptBlock } from '../utils/aiMemory';
import { detectAndRedactSecrets } from '../utils/aiPrivacy';
import { loadWorkspaceAiRules } from '../utils/aiProjectRules';
import {
  detectAiCapabilities,
  harnessAcceptTurn,
  harnessCancelTurn,
  harnessCreateThread,
  harnessDeleteThread,
  harnessGetTimeline,
  harnessListThreads,
  harnessRespondApproval,
  harnessRevertTurn,
  harnessSendMessage,
  harnessUpdateThread,
  isTauri,
  listenHarnessEvents,
} from '../utils/platform';

const ACTIVE_HARNESS_THREAD_KEY = 'onigiri-markdown.harness.activeThreadId.v1';

interface UseHarnessParams {
  aiConfig: AiProviderConfig;
  settings: EditorSettings;
  dirtyFilePaths: string[];
  onWorkspaceFilesChanged?: (workspaceRoot: string, paths: string[]) => void;
}

export function useHarness({
  aiConfig,
  settings,
  dirtyFilePaths,
  onWorkspaceFilesChanged,
}: UseHarnessParams) {
  const [threads, setThreads] = useState<HarnessThread[]>([]);
  const [activeThreadId, setActiveThreadIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_HARNESS_THREAD_KEY) || null;
    } catch {
      return null;
    }
  });
  const [timelineByThread, setTimelineByThread] = useState<Record<string, HarnessTimelineEntry[]>>(
    {}
  );
  const [capabilities, setCapabilities] = useState<AiCapabilities | null>(null);
  const [loadingCapabilities, setLoadingCapabilities] = useState(false);

  const activeThreadIdRef = useRef<string | null>(activeThreadId);
  activeThreadIdRef.current = activeThreadId;

  const onWsChangedRef = useRef(onWorkspaceFilesChanged);
  onWsChangedRef.current = onWorkspaceFilesChanged;

  const setActiveThreadId = useCallback((id: string | null) => {
    setActiveThreadIdState(id);
    try {
      if (id) {
        localStorage.setItem(ACTIVE_HARNESS_THREAD_KEY, id);
      } else {
        localStorage.removeItem(ACTIVE_HARNESS_THREAD_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const refreshCapabilities = useCallback(async () => {
    if (!isTauri()) return;
    setLoadingCapabilities(true);
    try {
      const caps = await detectAiCapabilities();
      setCapabilities(caps);
    } catch {
      // ignore
    } finally {
      setLoadingCapabilities(false);
    }
  }, []);

  const refreshThreads = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const list = await harnessListThreads();
      setThreads(list);
      setActiveThreadIdState((prev) => {
        if (prev && list.some((t) => t.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch {
      // ignore
    }
  }, []);

  const loadThreadTimeline = useCallback(async (threadId: string) => {
    if (!isTauri() || !threadId) return;
    try {
      const entries = await harnessGetTimeline(threadId);
      setTimelineByThread((prev) => ({ ...prev, [threadId]: entries }));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    void refreshThreads();
    void refreshCapabilities();
  }, [refreshThreads, refreshCapabilities]);

  useEffect(() => {
    if (!activeThreadId || !isTauri()) return;
    void loadThreadTimeline(activeThreadId);
    const current = threads.find((t) => t.id === activeThreadId);
    if (current?.unread) {
      void harnessUpdateThread({ threadId: activeThreadId, unread: false }).catch(() => {});
    }
  }, [activeThreadId, loadThreadTimeline, threads]);

  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | null = null;

    void listenHarnessEvents((payload: HarnessEventPayload) => {
      if (disposed) return;
      switch (payload.type) {
        case 'threads_changed': {
          const sorted = [...payload.threads].sort((a, b) => b.updatedAt - a.updatedAt);
          setThreads(sorted);
          if (
            activeThreadIdRef.current &&
            !sorted.some((t) => t.id === activeThreadIdRef.current)
          ) {
            setActiveThreadId(sorted[0]?.id ?? null);
          }
          break;
        }
        case 'thread_updated': {
          const updated = payload.thread;
          const isCurrent = activeThreadIdRef.current === updated.id;
          const normalized = isCurrent && updated.unread ? { ...updated, unread: false } : updated;
          if (isCurrent && updated.unread) {
            void harnessUpdateThread({ threadId: updated.id, unread: false }).catch(() => {});
          }
          setThreads((prev) => {
            const exists = prev.some((t) => t.id === normalized.id);
            const next = exists
              ? prev.map((t) => (t.id === normalized.id ? normalized : t))
              : [normalized, ...prev];
            return next.sort((a, b) => b.updatedAt - a.updatedAt);
          });
          break;
        }
        case 'entry_upserted': {
          const { threadId, entry } = payload;
          setTimelineByThread((prev) => {
            const list = prev[threadId] ?? [];
            const idx = list.findIndex((e) => e.id === entry.id);
            const nextList =
              idx >= 0 ? list.map((e, i) => (i === idx ? entry : e)) : [...list, entry];
            return { ...prev, [threadId]: nextList };
          });
          break;
        }
        case 'workspace_files_changed': {
          onWsChangedRef.current?.(payload.workspaceRoot, payload.paths);
          break;
        }
      }
    }).then((fn) => {
      if (disposed) {
        fn();
      } else {
        unlisten = fn;
      }
    });

    const handleCleared = () => {
      setThreads([]);
      setTimelineByThread({});
      setActiveThreadId(null);
    };
    window.addEventListener('onigiri:ai-threads-cleared', handleCleared);

    return () => {
      disposed = true;
      unlisten?.();
      window.removeEventListener('onigiri:ai-threads-cleared', handleCleared);
    };
  }, [setActiveThreadId]);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) ?? null,
    [threads, activeThreadId]
  );

  const activeTimeline = useMemo(
    () => (activeThreadId ? timelineByThread[activeThreadId] ?? [] : []),
    [activeThreadId, timelineByThread]
  );

  const selectThread = useCallback(
    (threadId: string) => {
      setActiveThreadId(threadId);
      void loadThreadTimeline(threadId);
    },
    [setActiveThreadId, loadThreadTimeline]
  );

  const createNewThread = useCallback(
    async (
      workspaceRoot: string,
      opts?: {
        title?: string;
        provider?: AiProviderId | string;
        model?: string;
        permissionMode?: HarnessPermissionMode;
      }
    ): Promise<HarnessThread> => {
      const provider = (opts?.provider || aiConfig.provider) as AiProviderId;
      const model =
        opts?.model ??
        aiConfig.models?.[provider] ??
        aiConfig.model ??
        '';
      const created = await harnessCreateThread({
        title: opts?.title,
        workspaceRoot,
        provider,
        model,
        permissionMode: opts?.permissionMode ?? 'auto-edits',
      });
      setThreads((prev) => [created, ...prev.filter((t) => t.id !== created.id)]);
      setTimelineByThread((prev) => ({ ...prev, [created.id]: [] }));
      setActiveThreadId(created.id);
      return created;
    },
    [aiConfig, setActiveThreadId]
  );

  const updateThreadSettings = useCallback(
    async (
      threadId: string,
      patch: {
        title?: string;
        provider?: string;
        model?: string;
        permissionMode?: HarnessPermissionMode;
      }
    ) => {
      const updated = await harnessUpdateThread({ threadId, ...patch });
      setThreads((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      return updated;
    },
    []
  );

  const removeThread = useCallback(
    async (threadId: string) => {
      await harnessDeleteThread(threadId);
      setThreads((prev) => {
        const remaining = prev.filter((t) => t.id !== threadId);
        if (activeThreadIdRef.current === threadId) {
          setActiveThreadId(remaining[0]?.id ?? null);
        }
        return remaining;
      });
      setTimelineByThread((prev) => {
        const copy = { ...prev };
        delete copy[threadId];
        return copy;
      });
    },
    [setActiveThreadId]
  );

  const sendPrompt = useCallback(
    async (params: {
      threadId?: string | null;
      workspaceRoot: string;
      content: string;
      provider?: string;
      model?: string;
      permissionMode?: HarnessPermissionMode;
      contextFiles?: string[];
      images?: Array<{ path: string; name: string; mimeType: string; base64: string }>;
      executePlanEntryId?: string;
    }) => {
      let targetThreadId = params.threadId || activeThreadIdRef.current;
      const existing = targetThreadId ? threads.find((t) => t.id === targetThreadId) : null;

      if (!targetThreadId || !existing) {
        const created = await createNewThread(params.workspaceRoot, {
          provider: params.provider,
          model: params.model,
          permissionMode: params.permissionMode,
        });
        targetThreadId = created.id;
      }

      const resolvedThread = threads.find((t) => t.id === targetThreadId);
      const effectiveProvider = (params.provider ||
        resolvedThread?.provider ||
        aiConfig.provider) as AiProviderId;
      const effectiveModel =
        params.model ??
        resolvedThread?.model ??
        aiConfig.models?.[effectiveProvider] ??
        aiConfig.model ??
        '';
      const wsRoot = resolvedThread?.workspaceRoot || params.workspaceRoot;

      const redactSecrets = settings.aiAutoRedactSecrets !== false;
      const promptToSend = redactSecrets
        ? detectAndRedactSecrets(params.content).redactedText
        : params.content;

      const extraBlocks: string[] = [];
      const rules = await loadWorkspaceAiRules(wsRoot, settings.aiProjectRulesEnabled !== false);
      if (rules?.promptBlock) {
        extraBlocks.push(rules.promptBlock);
      }
      const memBlock = buildAiMemoryPromptBlock(wsRoot, settings.aiMemoryEnabled !== false);
      if (memBlock) {
        extraBlocks.push(memBlock);
      }

      const startedAt = Date.now();
      const updated = await harnessSendMessage({
        threadId: targetThreadId,
        content: promptToSend,
        provider: effectiveProvider,
        model: effectiveModel,
        permissionMode: params.permissionMode,
        apiKey: aiConfig.apiKeys?.[effectiveProvider],
        baseUrl: aiConfig.baseUrls?.[effectiveProvider],
        customCliCmd: aiConfig.customCliCmd,
        systemPromptExtra: extraBlocks.length > 0 ? extraBlocks.join('\n\n') : undefined,
        contextFiles: params.contextFiles ?? [],
        dirtyPaths: dirtyFilePaths,
        images: params.images ?? [],
        executePlanEntryId: params.executePlanEntryId,
      });

      appendAiAuditEntry(
        {
          source: 'harness',
          label: updated.title,
          provider: effectiveProvider,
          model: effectiveModel,
          promptPreview: promptToSend,
          responsePreview: '(running in AI Harness thread)',
          durationMs: Date.now() - startedAt,
        },
        settings.aiAuditLogEnabled !== false
      );

      setActiveThreadId(updated.id);
      return updated;
    },
    [aiConfig, createNewThread, dirtyFilePaths, setActiveThreadId, settings, threads]
  );

  const cancelTurn = useCallback(async (threadId: string) => {
    await harnessCancelTurn(threadId);
  }, []);

  const respondApproval = useCallback(
    async (approvalId: string, decision: 'allow' | 'allow_session' | 'deny') => {
      await harnessRespondApproval(approvalId, decision);
    },
    []
  );

  const revertTurn = useCallback(async (threadId: string, diffEntryId: string) => {
    return harnessRevertTurn(threadId, diffEntryId);
  }, []);

  const acceptTurn = useCallback(async (threadId: string, diffEntryId: string) => {
    await harnessAcceptTurn(threadId, diffEntryId);
  }, []);

  return {
    threads,
    activeThreadId,
    activeThread,
    activeTimeline,
    capabilities,
    loadingCapabilities,
    refreshCapabilities,
    refreshThreads,
    selectThread,
    createNewThread,
    updateThreadSettings,
    removeThread,
    sendPrompt,
    cancelTurn,
    respondApproval,
    revertTurn,
    acceptTurn,
  };
}
