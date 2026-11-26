import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  ClipboardCopy,
  CornerDownLeft,
  Cpu,
  ExternalLink,
  Eye,
  EyeOff,
  FileInput,
  FilePenLine,
  FilePlus2,
  FolderCheck,
  KeyRound,
  LifeBuoy,
  Loader2,
  MessageSquare,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  Settings2,
  Square,
  Terminal,
  Trash2,
  AlertCircle,
  BookmarkPlus,
  FileText,
  Minimize2,
  Pin,
  Zap,
} from 'lucide-react';
import type {
  AiCapabilities,
  AiFolderMode,
  AiProviderConfig,
  AiProviderId,
  ChatMessage,
  WorkspaceNoteIndexEntry,
} from '../types';
import type { Translations } from '../i18n/types';
import {
  assistAiConnection,
  cancelAiChat,
  deleteWorkspaceFiles,
  detectAiCapabilities,
  getGitStatus,
  getHostOs,
  gitDiscardFiles,
  listLocalModels,
  listSubscriptionModels,
  listenAiChatProgress,
  readWorkspaceContext,
  readWorkspaceFileIfExists,
  sendAiChat,
  writeWorkspaceFile,
} from '../utils/platform';
import { formatAiErrorHint } from '../utils/aiErrorHint';
import { appendWorkspaceAiRule, loadWorkspaceAiRules } from '../utils/aiProjectRules';
import {
  addAiMemoryItem,
  buildAiMemoryPromptBlock,
  findRelevantWorkspaceNotes,
  getActiveAiMemoryItems,
  subscribeAiMemory,
} from '../utils/aiMemory';
import { appendAiAuditEntry } from '../utils/aiAuditLog';
import type { DiffPreviewRequest } from './AiDiffPreviewModal';

export const AI_THREADS_STORAGE_KEY = 'onigiri-markdown.ai-threads.v1';

interface AiThreadsStore {
  mode: 'tab' | 'shared';
  shared: ChatMessage[];
  byTab: Record<string, ChatMessage[]>;
  summaries?: {
    shared?: string;
    byTab?: Record<string, string>;
  };
}

function loadAiThreadsStore(): AiThreadsStore {
  try {
    const raw = localStorage.getItem(AI_THREADS_STORAGE_KEY);
    if (!raw) return { mode: 'tab', shared: [], byTab: {}, summaries: { byTab: {} } };
    const parsed = JSON.parse(raw);
    return {
      mode: parsed?.mode === 'shared' ? 'shared' : 'tab',
      shared: Array.isArray(parsed?.shared) ? parsed.shared.slice(-50) : [],
      byTab:
        parsed?.byTab && typeof parsed.byTab === 'object'
          ? Object.fromEntries(
              Object.entries(parsed.byTab)
                .filter(([, v]) => Array.isArray(v))
                .slice(-30)
                .map(([k, v]) => [k, (v as ChatMessage[]).slice(-50)])
            )
          : {},
      summaries: {
        shared: typeof parsed?.summaries?.shared === 'string' ? parsed.summaries.shared : undefined,
        byTab:
          parsed?.summaries?.byTab && typeof parsed.summaries.byTab === 'object'
            ? (parsed.summaries.byTab as Record<string, string>)
            : {},
      },
    };
  } catch {
    return { mode: 'tab', shared: [], byTab: {}, summaries: { byTab: {} } };
  }
}

export function countSavedAiThreadEntries(): number {
  const store = loadAiThreadsStore();
  let count = store.shared.length > 0 ? 1 : 0;
  for (const msgs of Object.values(store.byTab)) {
    if (Array.isArray(msgs) && msgs.length > 0) count += 1;
  }
  return count;
}

function saveAiThreadsStore(store: AiThreadsStore): void {
  try {
    const hasMessages =
      store.shared.length > 0 ||
      Object.values(store.byTab).some((list) => Array.isArray(list) && list.length > 0);
    if (!hasMessages && store.mode === 'tab') {
      localStorage.removeItem(AI_THREADS_STORAGE_KEY);
      return;
    }
    localStorage.setItem(AI_THREADS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore quota errors
  }
}

interface AiChatPanelProps {
  t: Translations;
  markdown: string;
  activeDocTitle?: string;
  activeTabId?: string;
  config: AiProviderConfig;
  onConfigChange: (next: AiProviderConfig) => void;
  onInsertToEditor: (text: string) => void;
  onReplaceDocument: (text: string, createSnapshot?: boolean) => void;
  onCopyReply: (text: string) => void;
  onSaveChatAsNote?: (title: string, markdown: string) => void;
  workspaceRoot: string | null;
  aiFolderMode: AiFolderMode;
  onAiFolderModeChange?: (mode: AiFolderMode) => void;
  onWorkspaceRefresh?: () => void;
  onFileWritten?: (relativePath: string) => void;
  onCliTurnComplete?: () => void;
  onBeforeCliDirectRun?: () => void;
  aiProjectRulesEnabled?: boolean;
  aiCliDirectCheckpointEnabled?: boolean;
  aiAuditLogEnabled?: boolean;
  aiMemoryEnabled?: boolean;
  aiNoteSuggestEnabled?: boolean;
  workspaceNoteIndex?: WorkspaceNoteIndexEntry[];
  activeFilePath?: string | null;
  onRequestDiffPreview?: (req: DiffPreviewRequest) => void;
}

interface WriteProposal {
  id: string;
  path: string;
  content: string;
}

function parseWriteProposals(text: string): WriteProposal[] {
  const proposals: WriteProposal[] = [];
  const regex =
    /<!--\s*onigiri-write\s+path=["']([^"']+)["']\s*-->\s*\n*```[^\n]*\n([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = regex.exec(text)) !== null) {
    proposals.push({
      id: `prop-${idx++}-${match[1]}`,
      path: match[1].trim(),
      content: match[2],
    });
  }
  return proposals;
}

const DEFAULT_BASE_URLS: Partial<Record<AiProviderId, string>> = {
  'openai-api': 'https://api.openai.com/v1',
  'anthropic-api': 'https://api.anthropic.com',
  ollama: 'http://127.0.0.1:11434',
  lmstudio: 'http://127.0.0.1:1234/v1',
  'openai-compat': 'http://127.0.0.1:8080/v1',
};

const DEFAULT_MODELS: Partial<Record<AiProviderId, string>> = {
  'openai-api': 'gpt-4.1',
  'anthropic-api': 'claude-sonnet-4-5',
  'gemini-api': 'gemini-2.5-flash',
  'apple-foundation-models': 'default',
};

const APPLE_FM_MODELS = ['default', 'permissive'] as const;

const CURATED_SUBSCRIPTION_MODELS: Partial<Record<AiProviderId, string[]>> = {
  'codex-cli': ['gpt-5.4', 'gpt-5.3-codex', 'gpt-5.2-codex', 'o4-mini', 'o3'],
  'claude-cli': [
    'sonnet',
    'opus',
    'haiku',
    'claude-sonnet-4-5',
    'claude-opus-4-1',
    'claude-haiku-4-5',
  ],
  'gemini-cli': [
    'auto',
    'gemini-3.8-flash',
    'gemini-3.5-flash',
    'gemini-3.1-pro-preview',
    'gemini-3-flash-preview',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-pro',
  ],
  'antigravity-cli': [
    'gemini-4-hydrogen-high',
    'gemini-4-hydrogen-medium',
    'gemini-4-argon-high',
    'gemini-4-argon-medium',
    'gemini-3.8-flash-high',
    'gemini-3.8-flash-medium',
    'claude-opus-5-5-high',
    'claude-sonnet-5-5-medium',
    'gpt-oss-120b-medium',
  ],
};

const CLOUD_API_MODELS: Partial<Record<AiProviderId, string[]>> = {
  'openai-api': ['gpt-4.1', 'gpt-4.1-mini', 'o4-mini', 'gpt-4o'],
  'anthropic-api': ['claude-sonnet-4-5', 'claude-opus-4-1', 'claude-haiku-4-5'],
  'gemini-api': [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-3.1-pro-preview',
    'gemini-3-flash-preview',
    'gemini-2.5-flash-lite',
  ],
};

const PROVIDER_LABELS: Record<AiProviderId, string> = {
  'codex-cli': 'Codex CLI',
  'claude-cli': 'Claude Code CLI',
  'gemini-cli': 'Gemini CLI',
  'antigravity-cli': 'Antigravity CLI',
  'custom-cli': 'Custom CLI',
  'openai-api': 'OpenAI API',
  'anthropic-api': 'Anthropic API',
  'gemini-api': 'Gemini API',
  'apple-foundation-models': 'Apple Foundation Models',
  ollama: 'Ollama',
  lmstudio: 'LM Studio',
  'openai-compat': 'OpenAI-Compat',
};

const API_KEY_URLS: Partial<Record<AiProviderId, string>> = {
  'openai-api': 'https://platform.openai.com/api-keys',
  'anthropic-api': 'https://console.anthropic.com/settings/keys',
  'gemini-api': 'https://aistudio.google.com/apikey',
};

function isSubscriptionCliProvider(provider: AiProviderId): boolean {
  return (
    provider === 'codex-cli' ||
    provider === 'claude-cli' ||
    provider === 'gemini-cli' ||
    provider === 'antigravity-cli'
  );
}

function formatElapsed(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}m${rem.toString().padStart(2, '0')}s`;
}

interface ProgressLogItem {
  id: string;
  kind: string;
  text: string;
  elapsedSecs: number;
}

export const AiChatPanel: React.FC<AiChatPanelProps> = ({
  t,
  markdown,
  activeDocTitle,
  activeTabId = 'default',
  config,
  onConfigChange,
  onInsertToEditor,
  onReplaceDocument,
  onCopyReply,
  onSaveChatAsNote,
  workspaceRoot,
  aiFolderMode,
  onAiFolderModeChange,
  onWorkspaceRefresh,
  onFileWritten,
  onCliTurnComplete,
  onBeforeCliDirectRun,
  aiProjectRulesEnabled = true,
  aiCliDirectCheckpointEnabled = true,
  aiAuditLogEnabled = true,
  aiMemoryEnabled = true,
  aiNoteSuggestEnabled = true,
  workspaceNoteIndex = [],
  activeFilePath,
  onRequestDiffPreview,
}) => {
  const [caps, setCaps] = useState<AiCapabilities | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [subscriptionModels, setSubscriptionModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [customModelInputMode, setCustomModelInputMode] = useState(false);

  const [assistBusy, setAssistBusy] = useState<string | null>(null);
  const [assistFeedback, setAssistFeedback] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const [showSupportCard, setShowSupportCard] = useState(false);
  const [muteProjectRules, setMuteProjectRules] = useState(false);
  const [mutePinnedMemory, setMutePinnedMemory] = useState(false);
  const [detectedRuleFile, setDetectedRuleFile] = useState<string | null>(null);
  const [pinnedMemoryCount, setPinnedMemoryCount] = useState<number>(
    () => getActiveAiMemoryItems(workspaceRoot, aiMemoryEnabled).length
  );
  const [compacting, setCompacting] = useState(false);
  const [showSummaryBox, setShowSummaryBox] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!workspaceRoot || !aiProjectRulesEnabled) {
      setDetectedRuleFile(null);
      return;
    }
    void loadWorkspaceAiRules(workspaceRoot, true).then((res) => {
      if (!cancelled) {
        setDetectedRuleFile(res?.sourceFile ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceRoot, aiProjectRulesEnabled]);

  useEffect(() => {
    const sync = () => {
      setPinnedMemoryCount(getActiveAiMemoryItems(workspaceRoot, aiMemoryEnabled).length);
    };
    sync();
    return subscribeAiMemory(sync);
  }, [workspaceRoot, aiMemoryEnabled]);

  const initialStore = useMemo(() => loadAiThreadsStore(), []);
  const threadsStoreRef = useRef<AiThreadsStore>(initialStore);
  const [threadMode, setThreadMode] = useState<'tab' | 'shared'>(initialStore.mode);
  const [messages, setMessagesState] = useState<ChatMessage[]>(() =>
    initialStore.mode === 'shared'
      ? initialStore.shared
      : initialStore.byTab[activeTabId] || []
  );

  const activeThreadKeyRef = useRef<{ mode: 'tab' | 'shared'; tabId: string }>({
    mode: initialStore.mode,
    tabId: activeTabId,
  });
  activeThreadKeyRef.current = { mode: threadMode, tabId: activeTabId };

  const updateMessages = useCallback(
    (
      updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
      overrideKey?: { mode: 'tab' | 'shared'; tabId: string }
    ) => {
      const mode = overrideKey?.mode ?? threadMode;
      const tabId = overrideKey?.tabId ?? activeTabId;
      const store = threadsStoreRef.current;
      const prevList =
        mode === 'shared' ? store.shared : store.byTab[tabId] || [];
      const nextList =
        typeof updater === 'function' ? updater(prevList) : updater;
      const trimmed = nextList.slice(-50);
      if (mode === 'shared') {
        store.shared = trimmed;
      } else {
        store.byTab[tabId] = trimmed;
      }
      store.mode = activeThreadKeyRef.current.mode;
      saveAiThreadsStore(store);
      const cur = activeThreadKeyRef.current;
      const stillViewing =
        cur.mode === mode && (mode === 'shared' || cur.tabId === tabId);
      if (stillViewing) {
        setMessagesState(trimmed);
      }
    },
    [threadMode, activeTabId]
  );

  const setMessages = useCallback(
    (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
      updateMessages(updater);
    },
    [updateMessages]
  );

  useEffect(() => {
    const store = threadsStoreRef.current;
    store.mode = threadMode;
    saveAiThreadsStore(store);
    const list =
      threadMode === 'shared' ? store.shared : store.byTab[activeTabId] || [];
    setMessagesState(list);
  }, [activeTabId, threadMode]);

  useEffect(() => {
    const onCleared = () => {
      threadsStoreRef.current = { mode: 'tab', shared: [], byTab: {} };
      setThreadMode('tab');
      setMessagesState([]);
    };
    window.addEventListener('onigiri:ai-threads-cleared', onCleared);
    return () => window.removeEventListener('onigiri:ai-threads-cleared', onCleared);
  }, []);

  const handleSaveChatAsNote = useCallback(() => {
    if (!onSaveChatAsNote || messages.length === 0) return;
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const docLabel = activeDocTitle || 'Chat';
    const noteTitle = `AI Chat - ${docLabel} (${dateStr})`;
    const body = messages
      .map((m) => {
        const who = m.role === 'user' ? 'User' : `Assistant${m.model ? ` (${m.model})` : ''}`;
        return `## ${who}\n\n${m.content.trim()}`;
      })
      .join('\n\n---\n\n');
    const fullMd = `---\ntitle: "${noteTitle.replace(/"/g, '\\"')}"\ndate: ${dateStr}\ntags: [ai-chat]\n---\n\n# ${noteTitle}\n\n${body}\n`;
    onSaveChatAsNote(noteTitle, fullMd);
  }, [onSaveChatAsNote, messages, activeDocTitle]);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [progressItems, setProgressItems] = useState<ProgressLogItem[]>([]);
  const [appliedProposals, setAppliedProposals] = useState<Record<string, boolean>>({});

  const threadRef = useRef<HTMLDivElement | null>(null);
  const progressLogRef = useRef<HTMLDivElement | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const cancellingRef = useRef(false);

  const runDetect = useCallback(async () => {
    setDetecting(true);
    try {
      const res = await detectAiCapabilities();
      setCaps(res);
      if (config.provider === 'ollama') {
        setLocalModels(res.ollamaModels);
      } else if (config.provider === 'lmstudio') {
        setLocalModels(res.lmstudioModels);
      }
    } catch {
      // ignore
    } finally {
      setDetecting(false);
    }
  }, [config.provider]);

  useEffect(() => {
    runDetect();
  }, [runDetect]);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, sending, progressItems.length]);

  useEffect(() => {
    if (progressLogRef.current) {
      progressLogRef.current.scrollTop = progressLogRef.current.scrollHeight;
    }
  }, [progressItems]);

  useEffect(() => {
    if (!sending) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const localElapsed = Math.floor((Date.now() - startedAt) / 1000);
      setElapsedSecs((prev) => Math.max(prev, localElapsed));
    }, 1000);

    let disposed = false;
    let unlisten: (() => void) | null = null;
    listenAiChatProgress((ev) => {
      if (disposed) return;
      if (!activeRequestIdRef.current || ev.requestId !== activeRequestIdRef.current) return;
      if (typeof ev.elapsedSecs === 'number') {
        setElapsedSecs((prev) => Math.max(prev, ev.elapsedSecs));
      }
      const text = ev.text?.trim();
      if (ev.kind === 'heartbeat' || !text) return;
      setProgressItems((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.text === text && last.kind === ev.kind) {
          return prev;
        }
        const next: ProgressLogItem = {
          id: `prog-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          kind: ev.kind,
          text,
          elapsedSecs: ev.elapsedSecs ?? 0,
        };
        return [...prev.slice(-29), next];
      });
    }).then((fn) => {
      if (disposed) {
        fn();
      } else {
        unlisten = fn;
      }
    });

    return () => {
      disposed = true;
      window.clearInterval(timer);
      if (unlisten) unlisten();
    };
  }, [sending]);

  // Sync discovered local / subscription models when switching provider or updating caps
  useEffect(() => {
    if (!caps) return;
    if (config.provider === 'ollama') {
      setLocalModels(caps.ollamaModels);
      setSubscriptionModels([]);
    } else if (config.provider === 'lmstudio') {
      setLocalModels(caps.lmstudioModels);
      setSubscriptionModels([]);
    } else if (config.provider === 'codex-cli') {
      setSubscriptionModels(
        caps.codexModels.length > 0
          ? caps.codexModels
          : CURATED_SUBSCRIPTION_MODELS['codex-cli'] || []
      );
      setLocalModels([]);
    } else if (config.provider === 'claude-cli') {
      setSubscriptionModels(
        caps.claudeModels.length > 0
          ? caps.claudeModels
          : CURATED_SUBSCRIPTION_MODELS['claude-cli'] || []
      );
      setLocalModels([]);
    } else if (config.provider === 'gemini-cli') {
      setSubscriptionModels(
        caps.geminiModels.length > 0
          ? caps.geminiModels
          : CURATED_SUBSCRIPTION_MODELS['gemini-cli'] || []
      );
      setLocalModels([]);
    } else if (config.provider === 'antigravity-cli') {
      setSubscriptionModels(
        caps.antigravityModels.length > 0
          ? caps.antigravityModels
          : CURATED_SUBSCRIPTION_MODELS['antigravity-cli'] || []
      );
      setLocalModels([]);
    } else {
      setLocalModels([]);
      setSubscriptionModels([]);
    }
  }, [config.provider, caps]);

  const updateModelChoice = useCallback(
    (nextModel: string) => {
      onConfigChange({
        ...config,
        model: nextModel,
        models: {
          ...(config.models || {}),
          [config.provider]: nextModel,
        },
      });
    },
    [config, onConfigChange]
  );

  const handleProviderChange = (nextProvider: AiProviderId) => {
    const rememberedModel = config.models?.[nextProvider] ?? '';
    setCustomModelInputMode(false);
    setAssistFeedback(null);
    onConfigChange({
      ...config,
      provider: nextProvider,
      model: rememberedModel,
      models: {
        ...(config.models || {}),
        [config.provider]: config.model,
      },
    });
    if (
      (nextProvider === 'openai-api' ||
        nextProvider === 'anthropic-api' ||
        nextProvider === 'gemini-api') &&
      !config.apiKeys[nextProvider]
    ) {
      setShowSettings(true);
    }
  };

  const handleRefreshModels = async () => {
    setLoadingModels(true);
    setAssistFeedback(null);
    try {
      if (isSubscriptionCliProvider(config.provider)) {
        const models = await listSubscriptionModels(config.provider);
        if (models.length > 0) {
          setSubscriptionModels(models);
        }
      } else if (
        config.provider === 'ollama' ||
        config.provider === 'lmstudio' ||
        config.provider === 'openai-compat'
      ) {
        const models = await listLocalModels(
          config.provider,
          config.baseUrls[config.provider] || DEFAULT_BASE_URLS[config.provider],
          config.apiKeys[config.provider]
        );
        setLocalModels(models);
        if (models.length > 0 && !config.model) {
          updateModelChoice(models[0]);
        }
      }
    } catch {
      if (
        config.provider === 'ollama' ||
        config.provider === 'lmstudio' ||
        config.provider === 'openai-compat'
      ) {
        setLocalModels([]);
      }
    } finally {
      setLoadingModels(false);
    }
  };

  const availableModelOptions = useMemo(() => {
    if (config.provider === 'apple-foundation-models') {
      return [...APPLE_FM_MODELS];
    }
    if (isSubscriptionCliProvider(config.provider)) {
      if (subscriptionModels.length > 0) return subscriptionModels;
      return CURATED_SUBSCRIPTION_MODELS[config.provider] || [];
    }
    if (
      config.provider === 'openai-api' ||
      config.provider === 'anthropic-api' ||
      config.provider === 'gemini-api'
    ) {
      return CLOUD_API_MODELS[config.provider] || [];
    }
    if (
      config.provider === 'ollama' ||
      config.provider === 'lmstudio' ||
      config.provider === 'openai-compat'
    ) {
      return localModels;
    }
    return [];
  }, [config.provider, subscriptionModels, localModels]);

  const isCustomModelValue =
    config.provider !== 'apple-foundation-models' &&
    (customModelInputMode ||
      (Boolean(config.model.trim()) &&
        availableModelOptions.length > 0 &&
        !availableModelOptions.includes(config.model.trim())));

  const providerStatus = useMemo(() => {
    if (!caps) return null;
    switch (config.provider) {
      case 'codex-cli':
        if (!caps.codexCli) {
          return { ok: false, reason: 'missing-cli' as const, text: t.aiChat.notFound };
        }
        if (!caps.codexLoggedIn) {
          return { ok: false, reason: 'missing-auth' as const, text: t.aiChat.loginNeeded };
        }
        return { ok: true, reason: 'ok' as const, text: t.aiChat.detected };
      case 'claude-cli':
        if (!caps.claudeCli) {
          return { ok: false, reason: 'missing-cli' as const, text: t.aiChat.notFound };
        }
        if (!caps.claudeLoggedIn) {
          return { ok: false, reason: 'missing-auth' as const, text: t.aiChat.loginNeeded };
        }
        return { ok: true, reason: 'ok' as const, text: t.aiChat.detected };
      case 'gemini-cli':
        if (!caps.geminiCli) {
          return { ok: false, reason: 'missing-cli' as const, text: t.aiChat.notFound };
        }
        if (!caps.geminiLoggedIn) {
          return { ok: false, reason: 'missing-auth' as const, text: t.aiChat.loginNeeded };
        }
        return { ok: true, reason: 'ok' as const, text: t.aiChat.detected };
      case 'antigravity-cli':
        if (!caps.antigravityCli) {
          return { ok: false, reason: 'missing-cli' as const, text: t.aiChat.notFound };
        }
        if (!caps.antigravityLoggedIn) {
          return { ok: false, reason: 'missing-auth' as const, text: t.aiChat.loginNeeded };
        }
        return { ok: true, reason: 'ok' as const, text: t.aiChat.detected };
      case 'apple-foundation-models': {
        if (getHostOs() !== 'macos') {
          return {
            ok: false,
            reason: 'apple-fm-unavailable' as const,
            text: t.aiChat.appleFmUnavailable,
          };
        }
        if (caps.appleFoundationModelsAvailable) {
          return { ok: true, reason: 'ok' as const, text: t.aiChat.appleFmReady };
        }
        const status = caps.appleFoundationModelsStatus;
        if (status === 'apple_intelligence_not_enabled') {
          return {
            ok: false,
            reason: 'apple-fm-not-enabled' as const,
            text: t.aiChat.appleFmUnavailable,
          };
        }
        if (status === 'model_not_ready') {
          return {
            ok: false,
            reason: 'apple-fm-model-not-ready' as const,
            text: t.aiChat.appleFmUnavailable,
          };
        }
        if (status === 'device_not_eligible') {
          return {
            ok: false,
            reason: 'apple-fm-device-not-eligible' as const,
            text: t.aiChat.appleFmUnavailable,
          };
        }
        if (status === 'unsupported_os') {
          return {
            ok: false,
            reason: 'apple-fm-unsupported-os' as const,
            text: t.aiChat.appleFmUnavailable,
          };
        }
        return {
          ok: false,
          reason: 'apple-fm-unavailable' as const,
          text: t.aiChat.appleFmUnavailable,
        };
      }
      case 'ollama':
        if (!caps.ollamaRunning) {
          return {
            ok: false,
            reason: caps.ollamaInstalled
              ? ('ollama-not-running' as const)
              : ('ollama-not-installed' as const),
            text: t.aiChat.offline,
          };
        }
        if (caps.ollamaModels.length === 0) {
          return {
            ok: false,
            reason: 'ollama-no-models' as const,
            text: `${t.aiChat.running} (0)`,
          };
        }
        return {
          ok: true,
          reason: 'ok' as const,
          text: `${t.aiChat.running} (${caps.ollamaModels.length})`,
        };
      case 'lmstudio':
        if (!caps.lmstudioRunning) {
          return { ok: false, reason: 'lmstudio-not-running' as const, text: t.aiChat.offline };
        }
        return {
          ok: true,
          reason: 'ok' as const,
          text: `${t.aiChat.running} (${caps.lmstudioModels.length})`,
        };
      case 'openai-api':
      case 'anthropic-api':
      case 'gemini-api': {
        const hasKey = Boolean(config.apiKeys[config.provider]?.trim());
        return {
          ok: hasKey,
          reason: hasKey ? ('ok' as const) : ('missing-apikey' as const),
          text: hasKey ? 'API Key OK' : 'API Key ?',
        };
      }
      case 'custom-cli': {
        const hasCmd = Boolean(config.customCliCmd.trim());
        return {
          ok: hasCmd,
          reason: hasCmd ? ('ok' as const) : ('missing-custom-cli' as const),
          text: hasCmd ? 'CLI OK' : t.aiChat.notFound,
        };
      }
      case 'openai-compat':
        return {
          ok: localModels.length > 0 || Boolean(config.baseUrls['openai-compat']?.trim()),
          reason: 'ok' as const,
          text:
            localModels.length > 0
              ? `${t.aiChat.running} (${localModels.length})`
              : 'OpenAI-Compat',
        };
      default:
        return null;
    }
  }, [caps, config.provider, config.apiKeys, config.customCliCmd, config.baseUrls, localModels, t]);

  const readyAlternatives = useMemo(() => {
    if (!caps) return [] as AiProviderId[];
    const list: AiProviderId[] = [];
    if (caps.codexCli && caps.codexLoggedIn) list.push('codex-cli');
    if (caps.claudeCli && caps.claudeLoggedIn) list.push('claude-cli');
    if (caps.geminiCli && caps.geminiLoggedIn) list.push('gemini-cli');
    if (caps.antigravityCli && caps.antigravityLoggedIn) list.push('antigravity-cli');
    if (getHostOs() === 'macos' && caps.appleFoundationModelsAvailable) {
      list.push('apple-foundation-models');
    }
    if (caps.ollamaRunning && caps.ollamaModels.length > 0) list.push('ollama');
    if (caps.lmstudioRunning && caps.lmstudioModels.length > 0) list.push('lmstudio');
    if (config.apiKeys['openai-api']?.trim()) list.push('openai-api');
    if (config.apiKeys['anthropic-api']?.trim()) list.push('anthropic-api');
    if (config.apiKeys['gemini-api']?.trim()) list.push('gemini-api');
    return list.filter((id) => id !== config.provider);
  }, [caps, config.apiKeys, config.provider]);

  const needsApiKey =
    config.provider === 'openai-api' ||
    config.provider === 'anthropic-api' ||
    config.provider === 'gemini-api' ||
    config.provider === 'openai-compat';

  const supportsBaseUrl =
    config.provider === 'openai-api' ||
    config.provider === 'anthropic-api' ||
    config.provider === 'ollama' ||
    config.provider === 'lmstudio' ||
    config.provider === 'openai-compat';

  const hasConnectionSettings =
    config.provider === 'apple-foundation-models' ||
    config.provider === 'custom-cli' ||
    needsApiKey ||
    supportsBaseUrl;

  const isLocalModelProvider =
    config.provider === 'ollama' ||
    config.provider === 'lmstudio' ||
    config.provider === 'openai-compat';

  const canRefreshModels = isSubscriptionCliProvider(config.provider) || isLocalModelProvider;

  const folderBadgeLabel = useMemo(() => {
    switch (aiFolderMode) {
      case 'read-only':
        return t.aiChat.folderBadgeRead;
      case 'read-write-approve':
        return t.aiChat.folderBadgeApprove;
      case 'cli-direct':
        return t.aiChat.folderBadgeCliDirect;
      default:
        return t.aiChat.folderBadgeDisabled;
    }
  }, [aiFolderMode, t]);

  const handleAssistAction = async (
    action: string,
    target?: string,
    copyFallbackCmd?: string
  ) => {
    setAssistBusy(target || action);
    setAssistFeedback(null);
    try {
      const res = await assistAiConnection(action, target);
      if (action === 'start-ollama') {
        await runDetect();
        setAssistFeedback({ ok: true, text: res });
      } else if (action === 'run-terminal-setup') {
        setAssistFeedback({ ok: true, text: `$ ${res}` });
      } else {
        setAssistFeedback({ ok: true, text: res });
      }
    } catch (err) {
      if (copyFallbackCmd) {
        try {
          await navigator.clipboard.writeText(copyFallbackCmd);
        } catch {
          // ignore
        }
      }
      setAssistFeedback({
        ok: false,
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setAssistBusy(null);
    }
  };

  const handleCopyCommand = async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setAssistFeedback({ ok: true, text: `${t.aiChat.commandCopied}: ${cmd}` });
    } catch {
      setAssistFeedback({ ok: false, text: cmd });
    }
  };

  const handleTestConnection = async () => {
    setAssistBusy('test');
    setAssistFeedback(null);
    try {
      if (isLocalModelProvider) {
        const models = await listLocalModels(
          config.provider,
          config.baseUrls[config.provider] || DEFAULT_BASE_URLS[config.provider],
          config.apiKeys[config.provider]
        );
        setLocalModels(models);
        await runDetect();
        setAssistFeedback({
          ok: true,
          text: `${t.aiChat.connectionOk} (${models.length})`,
        });
      } else {
        const effectiveModel =
          config.model.trim() || DEFAULT_MODELS[config.provider] || undefined;
        const res = await sendAiChat({
          provider: config.provider,
          model: effectiveModel,
          apiKey: config.apiKeys[config.provider],
          baseUrl: config.baseUrls[config.provider] || DEFAULT_BASE_URLS[config.provider],
          customCliCmd: config.customCliCmd,
          systemPrompt: 'Reply concisely with OK.',
          messages: [{ role: 'user', content: 'OK' }],
          workspaceDir: null,
          allowWorkspaceWrite: false,
        });
        await runDetect();
        setAssistFeedback({
          ok: true,
          text: `${t.aiChat.connectionOk} (${res.modelUsed})`,
        });
      }
    } catch (err) {
      setAssistFeedback({
        ok: false,
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setAssistBusy(null);
    }
  };

  const [summaryRevision, setSummaryRevision] = useState(0);
  const activeThreadSummary = useMemo(() => {
    void summaryRevision;
    const store = threadsStoreRef.current;
    return threadMode === 'shared'
      ? store.summaries?.shared || ''
      : store.summaries?.byTab?.[activeTabId] || '';
  }, [threadMode, activeTabId, summaryRevision]);

  const updateThreadSummary = useCallback(
    (summary: string | undefined, target?: { mode: 'tab' | 'shared'; tabId: string }) => {
      const store = threadsStoreRef.current;
      const useMode = target?.mode ?? threadMode;
      const useTab = target?.tabId ?? activeTabId;
      const prevSummaries = store.summaries ?? { byTab: {} };
      store.summaries =
        useMode === 'shared'
          ? { ...prevSummaries, shared: summary }
          : {
              ...prevSummaries,
              byTab: { ...(prevSummaries.byTab ?? {}), [useTab]: summary ?? '' },
            };
      saveAiThreadsStore(store);
      setSummaryRevision((v) => v + 1);
    },
    [threadMode, activeTabId]
  );

  useEffect(() => {
    let cancelled = false;
    if (!workspaceRoot || !aiProjectRulesEnabled) {
      setDetectedRuleFile(null);
      return;
    }
    void loadWorkspaceAiRules(workspaceRoot, true).then((r) => {
      if (!cancelled) setDetectedRuleFile(r?.sourceFile ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceRoot, aiProjectRulesEnabled]);

  const showTempToast = useCallback((msg: string) => {
    setActionToast(msg);
    window.setTimeout(() => {
      setActionToast((cur) => (cur === msg ? null : cur));
    }, 2600);
  }, []);

  const handlePinToMemory = useCallback(
    (text: string) => {
      const cleaned = text.trim().replace(/\s+/g, ' ').slice(0, 400);
      if (!cleaned) return;
      const scope = workspaceRoot ? 'workspace' : 'global';
      addAiMemoryItem(cleaned, scope, workspaceRoot);
      const isJa = t.actions.close === '閉じる';
      showTempToast(
        isJa
          ? `📌 ${scope === 'workspace' ? 'ワークスペース' : 'グローバル'}メモリーに保存しました`
          : `📌 Saved to ${scope} AI memory`
      );
    },
    [workspaceRoot, t.actions.close, showTempToast]
  );

  const handleSaveAsProjectRule = useCallback(
    async (text: string) => {
      if (!workspaceRoot) return;
      const snippet = text.trim().split(/\r?\n/).slice(0, 8).join('\n').slice(0, 600);
      if (!snippet) return;
      const isJa = t.actions.close === '閉じる';
      try {
        const targetFile = await appendWorkspaceAiRule(workspaceRoot, snippet);
        setDetectedRuleFile(targetFile);
        onWorkspaceRefresh?.();
        showTempToast(
          isJa ? `📝 ${targetFile} にルールを追記しました` : `📝 Appended rule to ${targetFile}`
        );
      } catch (err) {
        showTempToast(err instanceof Error ? err.message : String(err));
      }
    },
    [workspaceRoot, t.actions.close, onWorkspaceRefresh, showTempToast]
  );

  const handleCompactOlderTurns = useCallback(async () => {
    if (compacting || sending) return;
    const validMsgs = messages.filter((m) => !m.error);
    if (validMsgs.length <= 6) return;
    const older = validMsgs.slice(0, -6);
    const keep = messages.slice(-6);
    const capturedKey = { mode: threadMode, tabId: activeTabId };
    setCompacting(true);
    const isJa = t.actions.close === '閉じる';
    try {
      const transcript = older
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 1200)}`)
        .join('\n\n');
      const existingNote = activeThreadSummary
        ? `Previous summary:\n${activeThreadSummary}\n\n`
        : '';
      const effectiveModel =
        config.model.trim() ||
        (config.provider === 'ollama' && localModels[0] ? localModels[0] : '') ||
        (config.provider === 'lmstudio' && localModels[0] ? localModels[0] : '') ||
        DEFAULT_MODELS[config.provider] ||
        '';
      const res = await sendAiChat({
        requestId: `compact-${Date.now()}`,
        provider: config.provider,
        model: effectiveModel || undefined,
        apiKey: config.apiKeys[config.provider],
        baseUrl: config.baseUrls[config.provider] || DEFAULT_BASE_URLS[config.provider],
        customCliCmd: config.customCliCmd,
        systemPrompt: isJa
          ? 'これまでの会話履歴を、今後の回答に必要な前提・決定事項・好みのルールを中心に簡潔な箇条書き（400文字以内）で要約してください。'
          : 'Summarize the earlier conversation into concise bullet points (under 200 words) preserving key decisions, constraints, and user preferences.',
        messages: [{ role: 'user', content: `${existingNote}${transcript}` }],
        workspaceDir: null,
        allowWorkspaceWrite: false,
      });
      if (res.content.trim()) {
        updateThreadSummary(res.content.trim(), capturedKey);
        updateMessages(keep, capturedKey);
        showTempToast(
          isJa ? '🗜️ 古い会話を要約して圧縮しました' : '🗜️ Compacted older turns into summary'
        );
      }
    } catch (err) {
      showTempToast(err instanceof Error ? err.message : String(err));
    } finally {
      setCompacting(false);
    }
  }, [
    compacting,
    sending,
    messages,
    threadMode,
    activeTabId,
    activeThreadSummary,
    config,
    localModels,
    t.actions.close,
    updateThreadSummary,
    updateMessages,
    showTempToast,
  ]);

  const suggestedNotes = useMemo(() => {
    if (!aiNoteSuggestEnabled || workspaceNoteIndex.length === 0) return [];
    const query = input.trim().length >= 2 ? input : `${activeDocTitle || ''}`;
    return findRelevantWorkspaceNotes(query, workspaceNoteIndex, activeFilePath, 3);
  }, [aiNoteSuggestEnabled, workspaceNoteIndex, input, activeDocTitle, activeFilePath]);

  const historyTurnCount = useMemo(
    () => messages.filter((m) => !m.error).length,
    [messages]
  );

  const handleCancelSending = async () => {
    const reqId = activeRequestIdRef.current;
    if (!sending || !reqId || cancellingRef.current) return;
    cancellingRef.current = true;
    setCancelling(true);
    await cancelAiChat(reqId);
  };

  const sendMessage = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || sending) return;

    const capturedKey = { mode: threadMode, tabId: activeTabId };
    const reqId = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    activeRequestIdRef.current = reqId;
    cancellingRef.current = false;
    setCancelling(false);
    setElapsedSecs(0);
    setProgressItems([]);

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };
    const nextHistory = [...messages, userMsg];
    updateMessages(nextHistory, capturedKey);
    setInput('');
    setSending(true);

    const isJa = t.actions.close === '閉じる';
    const promptParts: string[] = [
      'You are a helpful Markdown writing and engineering assistant inside Onigiri Editor. When providing rewritten sections or documents, respond in clean Markdown.',
    ];

    const projectRules = await loadWorkspaceAiRules(
      workspaceRoot,
      aiProjectRulesEnabled && !muteProjectRules
    );
    if (projectRules) {
      promptParts.push(projectRules.promptBlock);
    }

    const pinnedMemory = buildAiMemoryPromptBlock(
      workspaceRoot,
      aiMemoryEnabled && !mutePinnedMemory
    );
    if (pinnedMemory) {
      promptParts.push(pinnedMemory);
    }

    const currentSummary =
      threadMode === 'shared'
        ? threadsStoreRef.current.summaries?.shared
        : threadsStoreRef.current.summaries?.byTab?.[activeTabId];
    if (currentSummary && currentSummary.trim()) {
      promptParts.push(`# Earlier Conversation Summary\n${currentSummary.trim()}`);
    }

    if (config.includeDocContext) {
      promptParts.push(
        `Current document:\n\`\`\`markdown\n${markdown.slice(0, 36000)}\n\`\`\``
      );
    }

    if (workspaceRoot && aiFolderMode !== 'disabled') {
      if (config.includeFolderContext) {
        try {
          const wsCtx = await readWorkspaceContext(workspaceRoot, 24000);
          if (wsCtx.trim()) {
            promptParts.push(wsCtx);
          }
        } catch {
          // ignore context failure
        }
      }
      if (aiFolderMode === 'read-write-approve') {
        promptParts.push(
          'To propose creating or updating a file inside the opened workspace folder, output a marker comment immediately followed by a fenced code block:\n<!-- onigiri-write path="relative/path.md" -->\n```markdown\n...file content...\n```'
        );
      } else if (aiFolderMode === 'cli-direct') {
        promptParts.push(
          `Workspace root directory: ${workspaceRoot}. Direct folder operations are enabled for CLI tools.`
        );
      }
    }

    // Capture pre-run checkpoint & git status baseline for cli-direct mode
    let baselineStatus: Map<string, string> | null = null;
    if (workspaceRoot && aiFolderMode === 'cli-direct' && aiCliDirectCheckpointEnabled) {
      onBeforeCliDirectRun?.();
      try {
        const gs = await getGitStatus(workspaceRoot);
        if (gs.isRepo) {
          baselineStatus = new Map(Object.entries(gs.entries));
        }
      } catch {
        // non-git or unavailable
      }
    }

    const effectiveModel =
      config.model.trim() ||
      (config.provider === 'ollama' && localModels[0] ? localModels[0] : '') ||
      (config.provider === 'lmstudio' && localModels[0] ? localModels[0] : '') ||
      DEFAULT_MODELS[config.provider] ||
      '';
    const startedAt = Date.now();

    try {
      const res = await sendAiChat({
        requestId: reqId,
        provider: config.provider,
        model: effectiveModel || undefined,
        apiKey: config.apiKeys[config.provider],
        baseUrl: config.baseUrls[config.provider] || DEFAULT_BASE_URLS[config.provider],
        customCliCmd: config.customCliCmd,
        systemPrompt: promptParts.join('\n\n'),
        messages: nextHistory
          .filter((m) => !m.error)
          .slice(-12)
          .map((m) => ({ role: m.role, content: m.content })),
        workspaceDir: workspaceRoot && aiFolderMode !== 'disabled' ? workspaceRoot : null,
        allowWorkspaceWrite: Boolean(workspaceRoot && aiFolderMode === 'cli-direct'),
      });

      let cliChanges: ChatMessage['cliChanges'] = undefined;
      if (workspaceRoot && aiFolderMode === 'cli-direct' && aiCliDirectCheckpointEnabled && baselineStatus) {
        try {
          const afterGs = await getGitStatus(workspaceRoot);
          if (afterGs.isRepo) {
            const changed = Object.entries(afterGs.entries)
              .filter(([path, status]) => baselineStatus!.get(path) !== status)
              .map(([path, status]) => ({ path, status }));
            if (changed.length > 0) {
              cliChanges = { files: changed, rolledBack: false };
            }
          }
        } catch {
          // ignore
        }
      }

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-a`,
        role: 'assistant',
        content: res.content,
        model: res.modelUsed,
        timestamp: Date.now(),
        cliChanges,
      };
      updateMessages((prev) => [...prev, assistantMsg], capturedKey);
      appendAiAuditEntry(
        {
          source: 'chat',
          label: activeDocTitle || 'AI Chat',
          provider: config.provider,
          model: res.modelUsed || effectiveModel || undefined,
          promptPreview: trimmed,
          responsePreview: res.content,
          durationMs: Date.now() - startedAt,
        },
        aiAuditLogEnabled
      );

      if (workspaceRoot && aiFolderMode === 'cli-direct') {
        onWorkspaceRefresh?.();
        onCliTurnComplete?.();
      }
    } catch (err) {
      const errText = err instanceof Error ? err.message : String(err);
      if (cancellingRef.current || errText === 'CLI_CANCELLED') {
        const cancelNote: ChatMessage = {
          id: `msg-${Date.now()}-cancel`,
          role: 'assistant',
          content: t.aiChat.cancelledMsg,
          timestamp: Date.now(),
          error: true,
        };
        updateMessages((prev) => [...prev, cancelNote], capturedKey);
      } else {
        const info = formatAiErrorHint(err, config.provider, isJa);
        appendAiAuditEntry(
          {
            source: 'chat',
            label: activeDocTitle || 'AI Chat',
            provider: config.provider,
            model: effectiveModel || undefined,
            promptPreview: trimmed,
            responsePreview: '',
            durationMs: Date.now() - startedAt,
            error: info.message,
          },
          aiAuditLogEnabled
        );
        const errorMsg: ChatMessage = {
          id: `msg-${Date.now()}-err`,
          role: 'assistant',
          content: info.hint ? `${info.message}\n\n💡 ${info.hint}` : info.message,
          timestamp: Date.now(),
          error: true,
        };
        updateMessages((prev) => [...prev, errorMsg], capturedKey);
        setShowSupportCard(true);
      }
    } finally {
      activeRequestIdRef.current = null;
      cancellingRef.current = false;
      setCancelling(false);
      setSending(false);
    }
  };

  const sendMessageRef = useRef(sendMessage);
  sendMessageRef.current = sendMessage;

  useEffect(() => {
    const consumePendingPrompt = (explicitPrompt?: string) => {
      const win = window as unknown as { __onigiriPendingAiPrompt?: string };
      const text = explicitPrompt || win.__onigiriPendingAiPrompt;
      if (!text) return;
      delete win.__onigiriPendingAiPrompt;
      setInput(text);
      void sendMessageRef.current(text);
    };
    consumePendingPrompt();
    const onPromptEvent = (ev: Event) => {
      const custom = ev as CustomEvent<{ prompt?: string }>;
      consumePendingPrompt(custom.detail?.prompt);
    };
    window.addEventListener('onigiri:ask-ai-with-prompt', onPromptEvent);
    return () => window.removeEventListener('onigiri:ask-ai-with-prompt', onPromptEvent);
  }, []);

  const applyProposalNow = async (msgId: string, prop: WriteProposal) => {
    if (!workspaceRoot) return;
    const key = `${msgId}::${prop.id}`;
    try {
      await writeWorkspaceFile(workspaceRoot, prop.path, prop.content);
      setAppliedProposals((prev) => ({ ...prev, [key]: true }));
      onWorkspaceRefresh?.();
      onFileWritten?.(prop.path);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-werr`,
        role: 'assistant',
        content: err instanceof Error ? err.message : String(err),
        timestamp: Date.now(),
        error: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  };

  const handleApplyProposal = async (msgId: string, prop: WriteProposal) => {
    if (!workspaceRoot) return;
    if (!onRequestDiffPreview) {
      await applyProposalNow(msgId, prop);
      return;
    }
    try {
      const existingContent = await readWorkspaceFileIfExists(workspaceRoot, prop.path);
      onRequestDiffPreview({
        title: t.aiDiffModal.writeFileTitle,
        targetPath: prop.path,
        isNewFile: existingContent === null,
        originalText: existingContent ?? '',
        proposedText: prop.content,
        originalLabel: existingContent === null ? undefined : t.aiDiffModal.beforeLabel,
        proposedLabel: t.aiDiffModal.afterLabel,
        showSnapshotOption: false,
        confirmLabel: t.aiDiffModal.confirmWriteBtn,
        onConfirm: async () => {
          await applyProposalNow(msgId, prop);
        },
      });
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-werr`,
        role: 'assistant',
        content: err instanceof Error ? err.message : String(err),
        timestamp: Date.now(),
        error: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  };

  const hostOs = getHostOs();

  const setupInfo = useMemo(() => {
    switch (config.provider) {
      case 'codex-cli':
        return {
          installKey: 'codex-install',
          loginKey: 'codex-login',
          installCmd: 'npm install -g @openai/codex && codex login',
          loginCmd: 'codex login',
        };
      case 'claude-cli':
        return {
          installKey: 'claude-install',
          loginKey: 'claude-login',
          installCmd: 'npm install -g @anthropic-ai/claude-code && claude',
          loginCmd: 'claude',
        };
      case 'gemini-cli':
        return {
          installKey: 'gemini-install',
          loginKey: 'gemini-login',
          installCmd: 'npm install -g @google/gemini-cli && gemini',
          loginCmd: 'gemini',
        };
      case 'antigravity-cli':
        return {
          installKey: 'antigravity-install',
          loginKey: 'antigravity-login',
          installCmd:
            hostOs === 'windows'
              ? 'powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://antigravity.google/cli/install.ps1 | iex"'
              : 'curl -fsSL https://antigravity.google/cli/install.sh | bash && agy',
          loginCmd: 'agy',
        };
      default:
        return null;
    }
  }, [config.provider, hostOs]);

  const ollamaInstallCmd =
    hostOs === 'windows'
      ? 'winget install Ollama.Ollama'
      : hostOs === 'linux'
        ? 'curl -fsSL https://ollama.com/install.sh | sh'
        : 'brew install ollama';

  const shouldRenderSupportCard =
    Boolean(caps && providerStatus && !providerStatus.ok) || showSupportCard;

  const renderConnectionSupportCard = () => {
    if (!providerStatus) return null;
    const reason = providerStatus.reason;

    let problemText = '';
    if (reason === 'missing-cli') {
      if (config.provider === 'codex-cli') problemText = t.aiChat.missingCliCodex;
      else if (config.provider === 'claude-cli') problemText = t.aiChat.missingCliClaude;
      else if (config.provider === 'gemini-cli') problemText = t.aiChat.missingCliGemini;
      else if (config.provider === 'antigravity-cli') problemText = t.aiChat.missingCliAntigravity;
      else problemText = t.aiChat.notInstalledCli;
    } else if (reason === 'missing-auth') problemText = t.aiChat.notLoggedInCli;
    else if (reason === 'ollama-not-running') problemText = t.aiChat.ollamaNotRunningDesc;
    else if (reason === 'ollama-no-models') problemText = t.aiChat.ollamaNoModelsDesc;
    else if (reason === 'ollama-not-installed') problemText = t.aiChat.ollamaNotInstalledDesc;
    else if (reason === 'lmstudio-not-running') problemText = t.aiChat.lmstudioNotRunningDesc;
    else if (reason === 'apple-fm-not-enabled') problemText = t.aiChat.appleFmNotEnabledDesc;
    else if (reason === 'apple-fm-model-not-ready') problemText = t.aiChat.appleFmModelNotReadyDesc;
    else if (reason === 'apple-fm-device-not-eligible')
      problemText = t.aiChat.appleFmDeviceNotEligibleDesc;
    else if (reason === 'apple-fm-unsupported-os') problemText = t.aiChat.appleFmUnsupportedOsDesc;
    else if (reason === 'apple-fm-unavailable') problemText = t.aiChat.appleFmUnavailableDesc;
    else if (reason === 'missing-apikey') problemText = t.aiChat.apiKeyMissingDesc;
    else if (reason === 'missing-custom-cli') problemText = t.aiChat.customCliMissingDesc;
    else problemText = `${PROVIDER_LABELS[config.provider]} (${providerStatus.text})`;

    const authHint =
      config.provider === 'codex-cli'
        ? t.aiChat.authHintCodex
        : config.provider === 'claude-cli'
          ? t.aiChat.authHintClaude
          : config.provider === 'gemini-cli'
            ? t.aiChat.authHintGemini
            : config.provider === 'antigravity-cli'
              ? t.aiChat.authHintAntigravity
              : null;

    return (
      <div className="ai-connect-card">
        <div className="ai-connect-head">
          <div className="ai-connect-title">
            <LifeBuoy size={14} />
            <span>{t.aiChat.setupGuideTitle}</span>
          </div>
          {providerStatus.ok && (
            <button
              type="button"
              className="ai-clear-btn"
              onClick={() => setShowSupportCard(false)}
            >
              {t.actions.close}
            </button>
          )}
        </div>

        <p className="ai-connect-desc">{problemText}</p>

        {/* Action buttons for the currently selected provider */}
        <div className="ai-connect-actions">
          {reason === 'missing-cli' && setupInfo && (
            <>
              <code className="ai-connect-cmd">{setupInfo.installCmd}</code>
              {config.provider !== 'antigravity-cli' && caps && caps.nodeInstalled === false && (
                <div className="ai-node-prereq-box">
                  <AlertCircle size={12} />
                  <span>{t.aiChat.nodeRequiredHint}</span>
                </div>
              )}
              <div className="ai-connect-btn-row">
                <button
                  type="button"
                  className="mini-pill-btn is-active"
                  disabled={Boolean(assistBusy)}
                  onClick={() =>
                    handleAssistAction(
                      'run-terminal-setup',
                      setupInfo.installKey,
                      setupInfo.installCmd
                    )
                  }
                >
                  <Terminal size={11} />
                  <span>{t.aiChat.openTerminalSetupBtn}</span>
                </button>
                {config.provider !== 'antigravity-cli' && caps && caps.nodeInstalled === false && (
                  <button
                    type="button"
                    className="mini-pill-btn"
                    onClick={() => handleAssistAction('open-url', 'https://nodejs.org/')}
                  >
                    <ExternalLink size={11} />
                    <span>{t.aiChat.downloadNodeBtn}</span>
                  </button>
                )}
                {config.provider === 'antigravity-cli' && caps?.antigravityApp && (
                  <button
                    type="button"
                    className="mini-pill-btn"
                    disabled={Boolean(assistBusy)}
                    onClick={() => handleAssistAction('open-antigravity')}
                  >
                    <Play size={11} />
                    <span>{hostOs === 'macos' ? 'Antigravity.app' : 'Antigravity'}</span>
                  </button>
                )}
                {config.provider === 'antigravity-cli' && (
                  <button
                    type="button"
                    className="mini-pill-btn"
                    onClick={() => handleAssistAction('open-url', 'https://antigravity.google/download')}
                  >
                    <ExternalLink size={11} />
                    <span>antigravity.google</span>
                  </button>
                )}
                <button
                  type="button"
                  className="mini-pill-btn"
                  onClick={() => handleCopyCommand(setupInfo.installCmd)}
                >
                  <ClipboardCopy size={11} />
                  <span>{t.aiChat.copyCommandBtn}</span>
                </button>
              </div>
            </>
          )}

          {reason === 'missing-auth' && setupInfo && (
            <>
              {authHint && (
                <div className="platform-hint-note">
                  <span>{authHint}</span>
                </div>
              )}
              <div className="ai-connect-btn-row">
                <button
                  type="button"
                  className="mini-pill-btn is-active"
                  disabled={Boolean(assistBusy)}
                  onClick={() =>
                    handleAssistAction('run-terminal-setup', setupInfo.loginKey, setupInfo.loginCmd)
                  }
                >
                  <Terminal size={11} />
                  <span>{t.aiChat.openTerminalLoginBtn}</span>
                </button>
                <button
                  type="button"
                  className="mini-pill-btn"
                  onClick={() => handleCopyCommand(setupInfo.loginCmd)}
                >
                  <ClipboardCopy size={11} />
                  <span>{setupInfo.loginCmd}</span>
                </button>
              </div>
            </>
          )}

          {reason === 'ollama-not-running' && (
            <div className="ai-connect-btn-row">
              <button
                type="button"
                className="mini-pill-btn is-active"
                disabled={Boolean(assistBusy)}
                onClick={() => handleAssistAction('start-ollama')}
              >
                {assistBusy === 'start-ollama' ? (
                  <Loader2 size={11} className="spin" />
                ) : (
                  <Play size={11} />
                )}
                <span>
                  {assistBusy === 'start-ollama'
                    ? t.aiChat.startingOllama
                    : t.aiChat.startOllamaBtn}
                </span>
              </button>
            </div>
          )}

          {reason === 'ollama-no-models' && (
            <>
              <div className="platform-hint-note">
                <span>{t.aiChat.ollamaNoModelsHint}</span>
              </div>
              <div className="ai-connect-btn-row">
                <button
                  type="button"
                  className="mini-pill-btn is-active"
                  disabled={Boolean(assistBusy)}
                  onClick={() =>
                    handleAssistAction(
                      'run-terminal-setup',
                      'ollama-pull-llama3.2',
                      'ollama pull llama3.2'
                    )
                  }
                >
                  <Terminal size={11} />
                  <span>{t.aiChat.pullLlamaBtn}</span>
                </button>
                <button
                  type="button"
                  className="mini-pill-btn"
                  disabled={Boolean(assistBusy)}
                  onClick={() =>
                    handleAssistAction(
                      'run-terminal-setup',
                      'ollama-pull-qwen2.5',
                      'ollama pull qwen2.5:7b'
                    )
                  }
                >
                  <Terminal size={11} />
                  <span>{t.aiChat.pullQwenBtn}</span>
                </button>
              </div>
            </>
          )}

          {reason === 'ollama-not-installed' && (
            <div className="ai-connect-btn-row">
              <button
                type="button"
                className="mini-pill-btn is-active"
                onClick={() => handleAssistAction('open-url', 'https://ollama.com/download')}
              >
                <ExternalLink size={11} />
                <span>{t.aiChat.downloadOllamaBtn}</span>
              </button>
              <button
                type="button"
                className="mini-pill-btn"
                onClick={() => handleCopyCommand(ollamaInstallCmd)}
              >
                <ClipboardCopy size={11} />
                <span>{ollamaInstallCmd}</span>
              </button>
            </div>
          )}

          {reason === 'lmstudio-not-running' && (
            <>
              <div className="platform-hint-note">
                <span>{t.aiChat.lmstudioServerSteps}</span>
              </div>
              <div className="ai-connect-btn-row">
                {caps?.lmstudioInstalled ? (
                  <button
                    type="button"
                    className="mini-pill-btn is-active"
                    disabled={Boolean(assistBusy)}
                    onClick={() => handleAssistAction('open-lmstudio')}
                  >
                    <Play size={11} />
                    <span>{t.aiChat.openLmStudioBtn}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="mini-pill-btn is-active"
                    onClick={() => handleAssistAction('open-url', 'https://lmstudio.ai/')}
                  >
                    <ExternalLink size={11} />
                    <span>LM Studio</span>
                  </button>
                )}
              </div>
            </>
          )}

          {(reason === 'apple-fm-not-enabled' || reason === 'apple-fm-model-not-ready') && (
            <div className="ai-connect-btn-row">
              <button
                type="button"
                className="mini-pill-btn is-active"
                disabled={Boolean(assistBusy)}
                onClick={() => handleAssistAction('open-apple-intelligence-settings')}
              >
                <Settings2 size={11} />
                <span>{t.aiChat.appleFmOpenSettingsBtn}</span>
              </button>
            </div>
          )}

          {config.provider === 'apple-foundation-models' && providerStatus.ok && (
            <div className="platform-hint-note">
              <span>{t.aiChat.appleFmContextHint}</span>
            </div>
          )}

          {reason === 'missing-apikey' && (
            <div className="ai-connect-inline-key">
              <div className="ai-key-input-wrap">
                <KeyRound size={12} />
                <input
                  type={showKey ? 'text' : 'password'}
                  className="text-input"
                  value={config.apiKeys[config.provider] || ''}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      apiKeys: {
                        ...config.apiKeys,
                        [config.provider]: e.target.value,
                      },
                    })
                  }
                  placeholder={t.aiChat.apiKeyPlaceholder}
                />
                <button
                  type="button"
                  className="icon-btn-sm"
                  onClick={() => setShowKey((v) => !v)}
                >
                  {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>
              {API_KEY_URLS[config.provider] && (
                <button
                  type="button"
                  className="mini-pill-btn"
                  onClick={() => handleAssistAction('open-url', API_KEY_URLS[config.provider])}
                >
                  <ExternalLink size={11} />
                  <span>{t.aiChat.getApiKeyBtn}</span>
                </button>
              )}
            </div>
          )}

          <div className="ai-connect-btn-row">
            <button
              type="button"
              className="mini-pill-btn"
              disabled={detecting}
              onClick={runDetect}
            >
              <RefreshCw size={11} className={detecting ? 'spin' : ''} />
              <span>{t.aiChat.detectRefresh}</span>
            </button>
            <button
              type="button"
              className="mini-pill-btn"
              disabled={Boolean(assistBusy)}
              onClick={handleTestConnection}
            >
              {assistBusy === 'test' ? (
                <Loader2 size={11} className="spin" />
              ) : (
                <Zap size={11} />
              )}
              <span>
                {assistBusy === 'test' ? t.aiChat.testingConnection : t.aiChat.testConnectionBtn}
              </span>
            </button>
          </div>
        </div>

        {assistFeedback && (
          <div className={`ai-connect-feedback ${assistFeedback.ok ? 'is-ok' : 'is-err'}`}>
            {assistFeedback.text}
          </div>
        )}

        {(reason === 'missing-cli' ||
          reason === 'missing-auth' ||
          reason === 'ollama-not-installed' ||
          reason === 'ollama-no-models') && (
          <div className="platform-hint-note">
            <span>
              {hostOs === 'windows'
                ? t.aiChat.platformNoteWindows
                : hostOs === 'linux'
                  ? t.aiChat.platformNoteLinux
                  : t.aiChat.platformNoteMacos}
            </span>
          </div>
        )}

        {/* Quick switch to already-ready providers */}
        {readyAlternatives.length > 0 && (
          <div className="ai-switch-section">
            <div className="ai-switch-title">{t.aiChat.availableSwitchTitle}</div>
            <div className="ai-switch-chips">
              {readyAlternatives.map((alt) => (
                <button
                  key={alt}
                  type="button"
                  className="ai-switch-pill"
                  onClick={() => handleProviderChange(alt)}
                >
                  <CheckCircle2 size={11} />
                  <span>
                    {PROVIDER_LABELS[alt]} {t.aiChat.switchToProvider}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="ai-chat-panel">
      {/* Provider & Model Selector Header */}
      <div className="ai-chat-config-bar">
        <div className="ai-provider-row">
          <select
            className="select-input ai-provider-select"
            value={config.provider}
            onChange={(e) => handleProviderChange(e.target.value as AiProviderId)}
            aria-label={t.aiChat.providerLabel}
          >
            <optgroup label={t.aiChat.catSubscription}>
              <option value="codex-cli">
                Codex CLI {caps?.codexCli ? (caps.codexLoggedIn ? '✓' : '!') : ''}
              </option>
              <option value="claude-cli">
                Claude Code CLI {caps?.claudeCli ? (caps.claudeLoggedIn ? '✓' : '!') : ''}
              </option>
              <option value="gemini-cli">
                Gemini CLI {caps?.geminiCli ? (caps.geminiLoggedIn ? '✓' : '!') : ''}
              </option>
              <option value="antigravity-cli">
                Antigravity CLI{' '}
                {caps?.antigravityCli ? (caps.antigravityLoggedIn ? '✓' : '!') : ''}
              </option>
              <option value="custom-cli">Custom CLI...</option>
            </optgroup>
            <optgroup label={t.aiChat.catCloudApi}>
              <option value="openai-api">OpenAI API</option>
              <option value="anthropic-api">Anthropic Claude API</option>
              <option value="gemini-api">Google Gemini API</option>
            </optgroup>
            <optgroup label={t.aiChat.catLocal}>
              {hostOs === 'macos' && (
                <option value="apple-foundation-models">
                  Apple Foundation Models {caps?.appleFoundationModelsAvailable ? '●' : ''}
                </option>
              )}
              <option value="ollama">
                Ollama {caps?.ollamaRunning ? '●' : ''}
              </option>
              <option value="lmstudio">
                LM Studio {caps?.lmstudioRunning ? '●' : ''}
              </option>
              <option value="openai-compat">OpenAI-Compatible</option>
            </optgroup>
          </select>

          {hasConnectionSettings && (
            <button
              type="button"
              className={`icon-btn-sm ${showSettings ? 'is-active' : ''}`}
              onClick={() => setShowSettings((v) => !v)}
              title={t.aiChat.configToggle}
            >
              <Settings2 size={14} />
            </button>
          )}
          <button
            type="button"
            className="icon-btn-sm"
            onClick={runDetect}
            title={t.aiChat.detectRefresh}
          >
            <RefreshCw size={13} className={detecting ? 'spin' : ''} />
          </button>
        </div>

        {/* Direct Model Selector Row (visible for subscription CLIs, Cloud APIs, Local LLMs) */}
        {config.provider !== 'custom-cli' && (
          <div className="ai-model-bar">
            <span className="ai-model-bar-label" title={t.aiChat.modelLabel}>
              <Cpu size={12} />
            </span>
            {availableModelOptions.length > 0 ? (
              <select
                className="select-input ai-model-select"
                value={
                  config.provider === 'apple-foundation-models'
                    ? config.model === 'permissive'
                      ? 'permissive'
                      : 'default'
                    : isCustomModelValue
                      ? '__custom__'
                      : config.model
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__custom__') {
                    setCustomModelInputMode(true);
                  } else {
                    setCustomModelInputMode(false);
                    updateModelChoice(val);
                  }
                }}
                aria-label={t.aiChat.modelLabel}
              >
                {isSubscriptionCliProvider(config.provider) && (
                  <option value="">
                    {config.provider === 'codex-cli' && caps?.codexDefaultModel
                      ? `${t.aiChat.defaultModelOption} (${caps.codexDefaultModel})`
                      : config.provider === 'antigravity-cli' && caps?.antigravityDefaultModel
                        ? `${t.aiChat.defaultModelOption} (${caps.antigravityDefaultModel})`
                        : t.aiChat.defaultModelOption}
                  </option>
                )}
                {availableModelOptions.map((m) => (
                  <option key={m} value={m}>
                    {config.provider === 'apple-foundation-models'
                      ? m === 'permissive'
                        ? t.aiChat.appleFmModelPermissive
                        : t.aiChat.appleFmModelDefault
                      : m}
                  </option>
                ))}
                {config.provider !== 'apple-foundation-models' && (
                  <option value="__custom__">{t.aiChat.customModelOption}</option>
                )}
              </select>
            ) : (
              <input
                type="text"
                className="text-input ai-model-select"
                value={config.model}
                onChange={(e) => updateModelChoice(e.target.value)}
                placeholder={DEFAULT_MODELS[config.provider] || t.aiChat.modelPlaceholder}
              />
            )}

            {canRefreshModels && (
              <button
                type="button"
                className="icon-btn-sm"
                onClick={handleRefreshModels}
                disabled={loadingModels}
                title={t.aiChat.refreshModels}
              >
                <RefreshCw size={12} className={loadingModels ? 'spin' : ''} />
              </button>
            )}
          </div>
        )}

        {config.provider !== 'custom-cli' &&
          availableModelOptions.length > 0 &&
          isCustomModelValue && (
            <input
              type="text"
              className="text-input ai-custom-model-input"
              value={config.model}
              onChange={(e) => updateModelChoice(e.target.value)}
              placeholder={t.aiChat.modelPlaceholder}
            />
          )}

        {providerStatus && (
          <div className="ai-status-line">
            <span className={`ai-status-pill ${providerStatus.ok ? 'is-ok' : 'is-warn'}`}>
              {providerStatus.ok ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
              <span>{providerStatus.text}</span>
            </span>
            <div className="ai-status-actions">
              <button
                type="button"
                className={`ai-clear-btn ${showSupportCard ? 'is-active' : ''}`}
                onClick={() => setShowSupportCard((v) => !v)}
                title={t.aiChat.setupGuideBtn}
              >
                <LifeBuoy size={12} />
                <span>{t.aiChat.setupGuideBtn}</span>
              </button>
              {messages.length > 0 && (
                <button
                  type="button"
                  className="ai-clear-btn"
                  onClick={() => setMessages([])}
                  title={t.aiChat.clearChat}
                >
                  <Trash2 size={12} />
                  <span>{t.aiChat.clearChat}</span>
                </button>
              )}
            </div>
          </div>
        )}

        <div className="ai-thread-bar">
          <div className="ai-thread-mode-group">
            <button
              type="button"
              className={`mini-pill-btn ${threadMode === 'tab' ? 'is-active' : ''}`}
              onClick={() => setThreadMode('tab')}
            >
              <MessageSquare size={11} />
              <span>{t.aiChat.threadModeTab}</span>
            </button>
            <button
              type="button"
              className={`mini-pill-btn ${threadMode === 'shared' ? 'is-active' : ''}`}
              onClick={() => setThreadMode('shared')}
            >
              <span>{t.aiChat.threadModeShared}</span>
            </button>
          </div>
          {onSaveChatAsNote && messages.length > 0 && (
            <button
              type="button"
              className="mini-pill-btn"
              onClick={handleSaveChatAsNote}
              title={t.aiChat.saveAsNoteBtn}
            >
              <FilePlus2 size={11} />
              <span>{t.aiChat.saveAsNoteBtn}</span>
            </button>
          )}
        </div>

        {showSettings && hasConnectionSettings && (
          <div className="ai-settings-drawer">
            {config.provider === 'apple-foundation-models' && (
              <div className="platform-hint-note">
                <span>{t.aiChat.appleFmContextHint}</span>
              </div>
            )}
            {config.provider === 'custom-cli' && (
              <div className="field-row">
                <label>{t.aiChat.customCliLabel}</label>
                <input
                  type="text"
                  className="text-input"
                  value={config.customCliCmd}
                  onChange={(e) =>
                    onConfigChange({ ...config, customCliCmd: e.target.value })
                  }
                  placeholder="codex exec - || ollama run llama3.2"
                />
                <span className="ai-hint-text">{t.aiChat.customCliHint}</span>
              </div>
            )}

            {needsApiKey && (
              <div className="field-row">
                <label>{t.aiChat.apiKeyLabel}</label>
                <div className="ai-key-input-wrap">
                  <input
                    type={showKey ? 'text' : 'password'}
                    className="text-input"
                    value={config.apiKeys[config.provider] || ''}
                    onChange={(e) =>
                      onConfigChange({
                        ...config,
                        apiKeys: {
                          ...config.apiKeys,
                          [config.provider]: e.target.value,
                        },
                      })
                    }
                    placeholder={t.aiChat.apiKeyPlaceholder}
                  />
                  <button
                    type="button"
                    className="icon-btn-sm"
                    onClick={() => setShowKey((v) => !v)}
                  >
                    {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>
            )}

            {supportsBaseUrl && (
              <div className="field-row">
                <label>{t.aiChat.baseUrlLabel}</label>
                <input
                  type="text"
                  className="text-input"
                  value={
                    config.baseUrls[config.provider] ??
                    DEFAULT_BASE_URLS[config.provider] ??
                    ''
                  }
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      baseUrls: {
                        ...config.baseUrls,
                        [config.provider]: e.target.value,
                      },
                    })
                  }
                />
              </div>
            )}
          </div>
        )}

        <div className="ai-context-row">
          <label className="check-row ai-doc-toggle">
            <input
              type="checkbox"
              checked={config.includeDocContext}
              onChange={(e) =>
                onConfigChange({ ...config, includeDocContext: e.target.checked })
              }
            />
            <span>{t.aiChat.includeDoc}</span>
          </label>
          {workspaceRoot && aiFolderMode !== 'disabled' && (
            <label className="check-row ai-doc-toggle">
              <input
                type="checkbox"
                checked={config.includeFolderContext}
                onChange={(e) =>
                  onConfigChange({ ...config, includeFolderContext: e.target.checked })
                }
              />
              <span>{t.aiChat.includeFolder}</span>
            </label>
          )}
          <div className="ai-folder-badge-row">
            {onAiFolderModeChange ? (
              <label
                className={`ai-folder-badge is-${aiFolderMode} is-interactive`}
                title={t.aiChat.folderModeTooltip}
              >
                <FolderCheck size={11} />
                <select
                  className="ai-folder-badge-select"
                  value={aiFolderMode}
                  aria-label={t.aiChat.folderModeTooltip}
                  onChange={(e) => onAiFolderModeChange(e.target.value as AiFolderMode)}
                >
                  <option value="disabled">{t.aiChat.folderBadgeDisabled}</option>
                  <option value="read-only">{t.aiChat.folderBadgeRead}</option>
                  <option value="read-write-approve">{t.aiChat.folderBadgeApprove}</option>
                  <option value="cli-direct">{t.aiChat.folderBadgeCliDirect}</option>
                </select>
              </label>
            ) : (
              <span className={`ai-folder-badge is-${aiFolderMode}`}>
                <FolderCheck size={11} />
                <span>{folderBadgeLabel}</span>
              </span>
            )}
          </div>
          {workspaceRoot &&
            aiFolderMode === 'read-write-approve' &&
            (isSubscriptionCliProvider(config.provider) || config.provider === 'custom-cli') && (
              <div className="ai-folder-cli-hint">{t.aiChat.cliReadOnlyHint}</div>
            )}
        </div>
      </div>

      {/* Quick Prompts */}
      <div className="ai-quick-chips">
        <button
          type="button"
          className="ai-chip-btn"
          disabled={sending}
          onClick={() => sendMessage(t.aiChat.quickPrompts.proofreadPrompt)}
        >
          {t.aiChat.quickPrompts.proofread}
        </button>
        <button
          type="button"
          className="ai-chip-btn"
          disabled={sending}
          onClick={() => sendMessage(t.aiChat.quickPrompts.summarizePrompt)}
        >
          {t.aiChat.quickPrompts.summarize}
        </button>
        <button
          type="button"
          className="ai-chip-btn"
          disabled={sending}
          onClick={() => sendMessage(t.aiChat.quickPrompts.improvePrompt)}
        >
          {t.aiChat.quickPrompts.improve}
        </button>
        <button
          type="button"
          className="ai-chip-btn"
          disabled={sending}
          onClick={() => sendMessage(t.aiChat.quickPrompts.translatePrompt)}
        >
          {t.aiChat.quickPrompts.translate}
        </button>
      </div>

      {/* Message Thread */}
      <div ref={threadRef} className="ai-chat-thread">
        {shouldRenderSupportCard && renderConnectionSupportCard()}

        {messages.length === 0 && !shouldRenderSupportCard ? (
          <div className="ai-chat-empty">
            <Bot size={26} className="ai-empty-icon" />
            <p>{t.aiChat.emptyState}</p>
          </div>
        ) : (
          messages.map((msg) => {
            const proposals =
              msg.role === 'assistant' &&
              !msg.error &&
              workspaceRoot &&
              aiFolderMode === 'read-write-approve'
                ? parseWriteProposals(msg.content)
                : [];
            return (
              <div
                key={msg.id}
                className={`ai-msg ai-msg-${msg.role} ${msg.error ? 'is-error' : ''}`}
              >
                <div className="ai-msg-content">{msg.content}</div>
                {proposals.length > 0 && (
                  <div className="ai-write-proposals">
                    {proposals.map((prop) => {
                      const applied = Boolean(appliedProposals[`${msg.id}::${prop.id}`]);
                      return (
                        <div key={prop.id} className="ai-write-proposal-card">
                          <span className="ai-write-proposal-path" title={prop.path}>
                            <FilePenLine size={12} />
                            <span>{prop.path}</span>
                          </span>
                          <button
                            type="button"
                            className={`mini-pill-btn ${applied ? 'is-applied' : 'is-primary'}`}
                            disabled={applied}
                            onClick={() => handleApplyProposal(msg.id, prop)}
                          >
                            {applied ? t.aiChat.appliedFileBtn : t.aiChat.applyFileBtn}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {msg.cliChanges && msg.cliChanges.files.length > 0 && workspaceRoot && (
                  <div className="ai-cli-guard-box">
                    <div className="ai-cli-guard-head">
                      <span>
                        {t.actions.close === '閉じる'
                          ? `CLI 変更ファイル (${msg.cliChanges.files.length})`
                          : `CLI Modified Files (${msg.cliChanges.files.length})`}
                      </span>
                      <button
                        type="button"
                        className={`mini-pill-btn ${msg.cliChanges.rolledBack ? '' : 'is-active'}`}
                        disabled={Boolean(msg.cliChanges.rolledBack)}
                        onClick={async () => {
                          const tracked = msg.cliChanges!.files
                            .filter((f) => f.status !== '?' && f.status !== '??')
                            .map((f) => f.path);
                          const untracked = msg.cliChanges!.files
                            .filter((f) => f.status === '?' || f.status === '??')
                            .map((f) => f.path);
                          try {
                            if (tracked.length > 0) {
                              await gitDiscardFiles(workspaceRoot, tracked);
                            }
                            if (untracked.length > 0) {
                              const absUntracked = untracked.map((rel) =>
                                `${workspaceRoot.replace(/[/\\]+$/, '')}/${rel}`
                              );
                              await deleteWorkspaceFiles(workspaceRoot, absUntracked);
                            }
                            updateMessages((prev) =>
                              prev.map((m) =>
                                m.id === msg.id && m.cliChanges
                                  ? { ...m, cliChanges: { ...m.cliChanges, rolledBack: true } }
                                  : m
                              )
                            );
                            onWorkspaceRefresh?.();
                            onCliTurnComplete?.();
                          } catch {
                            // ignore rollback error
                          }
                        }}
                      >
                        <RotateCcw size={11} />
                        <span>
                          {msg.cliChanges.rolledBack
                            ? t.actions.close === '閉じる'
                              ? 'ロールバック済み'
                              : 'Rolled Back'
                            : t.actions.close === '閉じる'
                              ? '変更を元に戻す'
                              : 'Rollback Changes'}
                        </span>
                      </button>
                    </div>
                    <div className="ai-cli-guard-files">
                      {msg.cliChanges.files.map((f) => (
                        <div key={f.path} className="ai-cli-guard-file">
                          <span className="ai-cli-guard-status">{f.status}</span>
                          <span>{f.path}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {msg.role === 'assistant' && !msg.error && (
                  <div className="ai-msg-actions">
                    {msg.model && <span className="ai-msg-model">{msg.model}</span>}
                    <div className="ai-msg-btns">
                      <button
                        type="button"
                        className="ai-act-btn"
                        onClick={() => onInsertToEditor(msg.content)}
                        title={t.aiChat.insertAtCursor}
                      >
                        <CornerDownLeft size={11} />
                        <span>{t.aiChat.insertAtCursor}</span>
                      </button>
                      <button
                        type="button"
                        className="ai-act-btn"
                        onClick={() => {
                          if (!onRequestDiffPreview) {
                            onReplaceDocument(msg.content, true);
                            return;
                          }
                          onRequestDiffPreview({
                            title: t.aiDiffModal.replaceDocTitle,
                            targetPath: activeDocTitle,
                            originalText: markdown,
                            proposedText: msg.content,
                            originalLabel: t.aiDiffModal.beforeLabel,
                            proposedLabel: t.aiDiffModal.afterLabel,
                            showSnapshotOption: true,
                            defaultCreateSnapshot: true,
                            confirmLabel: t.aiDiffModal.confirmReplaceBtn,
                            onConfirm: (createSnapshot) => {
                              onReplaceDocument(msg.content, createSnapshot);
                            },
                          });
                        }}
                        title={t.aiChat.replaceDoc}
                      >
                        <FileInput size={11} />
                        <span>{t.aiChat.replaceDoc}</span>
                      </button>
                      <button
                        type="button"
                        className="ai-act-btn"
                        onClick={() => onCopyReply(msg.content)}
                        title={t.aiChat.copyReply}
                      >
                        <ClipboardCopy size={11} />
                      </button>
                      <button
                        type="button"
                        className="ai-act-btn"
                        onClick={() => handlePinToMemory(msg.content)}
                        title={
                          t.actions.close === '閉じる'
                            ? 'ピン留め AI メモリーに記憶'
                            : 'Pin to AI Memory'
                        }
                      >
                        <Pin size={11} />
                      </button>
                      {workspaceRoot && (
                        <button
                          type="button"
                          className="ai-act-btn"
                          onClick={() => void handleSaveAsProjectRule(msg.content)}
                          title={
                            t.actions.close === '閉じる'
                              ? 'AGENTS.md / ルールに追記'
                              : 'Append to AGENTS.md / Project Rules'
                          }
                        >
                          <BookmarkPlus size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {msg.role === 'user' && !msg.error && (
                  <div className="ai-msg-actions" style={{ justifyContent: 'flex-end' }}>
                    <div className="ai-msg-btns">
                      <button
                        type="button"
                        className="ai-act-btn"
                        onClick={() => handlePinToMemory(msg.content)}
                        title={
                          t.actions.close === '閉じる'
                            ? 'この指示を AI メモリーに記憶'
                            : 'Pin instruction to AI Memory'
                        }
                      >
                        <Pin size={11} />
                      </button>
                      {workspaceRoot && (
                        <button
                          type="button"
                          className="ai-act-btn"
                          onClick={() => void handleSaveAsProjectRule(msg.content)}
                          title={
                            t.actions.close === '閉じる'
                              ? 'AGENTS.md / ルールに追記'
                              : 'Save as AGENTS.md rule'
                          }
                        >
                          <BookmarkPlus size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {sending && (
          <div className="ai-msg ai-msg-assistant is-loading">
            <div className="ai-progress-header">
              <span className="ai-progress-title">
                <Loader2 size={13} className="spin" />
                <span>{t.aiChat.sending}</span>
                <span className="ai-progress-elapsed">{formatElapsed(elapsedSecs)}</span>
              </span>
              <button
                type="button"
                className="ai-stop-btn"
                disabled={cancelling}
                onClick={handleCancelSending}
              >
                <Square size={10} />
                <span>{cancelling ? t.aiChat.cancellingBtn : t.aiChat.cancelBtn}</span>
              </button>
            </div>
            {progressItems.length > 0 ? (
              <div ref={progressLogRef} className="ai-progress-log">
                {progressItems.map((item) => (
                  <div key={item.id} className={`ai-progress-line is-${item.kind}`}>
                    <span className="ai-progress-line-time">{formatElapsed(item.elapsedSecs)}</span>
                    <span className="ai-progress-line-text">{item.text}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ai-progress-placeholder">{t.aiChat.progressStarting}</div>
            )}
          </div>
        )}
      </div>

      {actionToast && <div className="ai-memory-toast">{actionToast}</div>}

      {activeThreadSummary && (
        <div className="ai-summary-pill">
          <button
            type="button"
            className="ai-summary-toggle"
            onClick={() => setShowSummaryBox((v) => !v)}
          >
            <Minimize2 size={11} />
            <span>
              {t.actions.close === '閉じる' ? '圧縮済み会話要約あり' : 'Conversation Summary Active'}
            </span>
          </button>
          <button
            type="button"
            className="ai-summary-clear"
            onClick={() => updateThreadSummary(undefined)}
            title={t.actions.close === '閉じる' ? '要約をクリア' : 'Clear summary'}
          >
            ×
          </button>
          {showSummaryBox && <div className="ai-summary-body">{activeThreadSummary}</div>}
        </div>
      )}

      {suggestedNotes.length > 0 && (
        <div className="ai-note-suggest-bar">
          <span className="ai-note-suggest-label">
            {t.actions.close === '閉じる' ? '関連ノート:' : 'Related:'}
          </span>
          {suggestedNotes.map((note) => (
            <button
              key={note.path}
              type="button"
              className="ai-ctx-chip"
              onClick={() => {
                const token = `@${note.relativePath}`;
                setInput((prev) => (prev.includes(token) ? prev : `${prev ? `${prev} ` : ''}${token} `));
              }}
              title={note.relativePath}
            >
              <FileText size={10} />
              <span>{note.title || note.name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="ai-context-bar">
        <button
          type="button"
          className={`ai-ctx-chip ${config.includeDocContext ? 'is-on' : ''}`}
          onClick={() =>
            onConfigChange({ ...config, includeDocContext: !config.includeDocContext })
          }
          title={t.actions.close === '閉じる' ? '現在の文書を文脈に含める' : 'Toggle current document context'}
        >
          <span>{t.actions.close === '閉じる' ? '📄 文書' : '📄 Doc'}</span>
        </button>
        {workspaceRoot && aiFolderMode !== 'disabled' && (
          <button
            type="button"
            className={`ai-ctx-chip ${config.includeFolderContext ? 'is-on' : ''}`}
            onClick={() =>
              onConfigChange({ ...config, includeFolderContext: !config.includeFolderContext })
            }
            title={t.actions.close === '閉じる' ? 'ワークスペース文脈を含める' : 'Toggle folder context'}
          >
            <span>{t.actions.close === '閉じる' ? '📁 フォルダ' : '📁 Folder'}</span>
          </button>
        )}
        {detectedRuleFile && aiProjectRulesEnabled && (
          <button
            type="button"
            className={`ai-ctx-chip ${!muteProjectRules ? 'is-on' : ''}`}
            onClick={() => setMuteProjectRules((v) => !v)}
            title={
              t.actions.close === '閉じる'
                ? `${detectedRuleFile} の注入を一時切替`
                : `Toggle ${detectedRuleFile} injection`
            }
          >
            <span>📜 {detectedRuleFile}</span>
          </button>
        )}
        {aiMemoryEnabled && pinnedMemoryCount > 0 && (
          <button
            type="button"
            className={`ai-ctx-chip ${!mutePinnedMemory ? 'is-on' : ''}`}
            onClick={() => setMutePinnedMemory((v) => !v)}
            title={
              t.actions.close === '閉じる'
                ? 'ピン留めメモリーの注入を一時切替'
                : 'Toggle pinned AI memory injection'
            }
          >
            <span>
              📌 {t.actions.close === '閉じる' ? `記憶 (${pinnedMemoryCount})` : `Memory (${pinnedMemoryCount})`}
            </span>
          </button>
        )}
        <span className="ai-ctx-stat">
          {t.actions.close === '閉じる'
            ? `履歴 ${Math.min(historyTurnCount, 12)}/12`
            : `History ${Math.min(historyTurnCount, 12)}/12`}
        </span>
        {historyTurnCount > 10 && (
          <button
            type="button"
            className="ai-ctx-chip is-action"
            disabled={compacting || sending}
            onClick={() => void handleCompactOlderTurns()}
            title={
              t.actions.close === '閉じる'
                ? '古い会話を要約圧縮して文脈を保持'
                : 'Summarize & compact older turns'
            }
          >
            <Minimize2 size={10} />
            <span>
              {compacting
                ? t.actions.close === '閉じる'
                  ? '圧縮中…'
                  : 'Compacting…'
                : t.actions.close === '閉じる'
                  ? '要約圧縮'
                  : 'Compact'}
            </span>
          </button>
        )}
      </div>

      {/* Input Composer */}
      <form
        className="ai-chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
      >
        <textarea
          rows={3}
          className="textarea-input ai-chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.aiChat.inputPlaceholder}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              sendMessage(input);
            }
          }}
        />
        {sending ? (
          <button
            type="button"
            className="primary-btn ai-send-btn is-stop"
            disabled={cancelling}
            onClick={handleCancelSending}
          >
            <Square size={12} />
            <span>{cancelling ? t.aiChat.cancellingBtn : t.aiChat.cancelBtn}</span>
          </button>
        ) : (
          <button
            type="submit"
            className="primary-btn ai-send-btn"
            disabled={!input.trim()}
          >
            <Send size={13} />
            <span>{t.aiChat.send}</span>
          </button>
        )}
      </form>
    </div>
  );
};
