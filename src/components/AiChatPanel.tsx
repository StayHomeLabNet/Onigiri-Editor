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
  FolderCheck,
  KeyRound,
  LifeBuoy,
  Loader2,
  Play,
  RefreshCw,
  Send,
  Settings2,
  Square,
  Terminal,
  Trash2,
  AlertCircle,
  Zap,
} from 'lucide-react';
import type {
  AiCapabilities,
  AiFolderMode,
  AiProviderConfig,
  AiProviderId,
  ChatMessage,
} from '../types';
import type { Translations } from '../i18n/types';
import {
  assistAiConnection,
  cancelAiChat,
  detectAiCapabilities,
  getHostOs,
  listLocalModels,
  listSubscriptionModels,
  listenAiChatProgress,
  readWorkspaceContext,
  readWorkspaceFileIfExists,
  sendAiChat,
  writeWorkspaceFile,
} from '../utils/platform';
import type { DiffPreviewRequest } from './AiDiffPreviewModal';

interface AiChatPanelProps {
  t: Translations;
  markdown: string;
  activeDocTitle?: string;
  config: AiProviderConfig;
  onConfigChange: (next: AiProviderConfig) => void;
  onInsertToEditor: (text: string) => void;
  onReplaceDocument: (text: string, createSnapshot?: boolean) => void;
  onCopyReply: (text: string) => void;
  workspaceRoot: string | null;
  aiFolderMode: AiFolderMode;
  onAiFolderModeChange?: (mode: AiFolderMode) => void;
  onWorkspaceRefresh?: () => void;
  onFileWritten?: (relativePath: string) => void;
  onCliTurnComplete?: () => void;
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
};

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
  config,
  onConfigChange,
  onInsertToEditor,
  onReplaceDocument,
  onCopyReply,
  workspaceRoot,
  aiFolderMode,
  onAiFolderModeChange,
  onWorkspaceRefresh,
  onFileWritten,
  onCliTurnComplete,
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

  const [messages, setMessages] = useState<ChatMessage[]>([]);
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
    customModelInputMode ||
    (Boolean(config.model.trim()) &&
      availableModelOptions.length > 0 &&
      !availableModelOptions.includes(config.model.trim()));

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
    setMessages(nextHistory);
    setInput('');
    setSending(true);

    const promptParts: string[] = [
      'You are a helpful Markdown writing and engineering assistant inside Onigiri Editor. When providing rewritten sections or documents, respond in clean Markdown.',
    ];

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

    const effectiveModel =
      config.model.trim() ||
      (config.provider === 'ollama' && localModels[0] ? localModels[0] : '') ||
      (config.provider === 'lmstudio' && localModels[0] ? localModels[0] : '') ||
      DEFAULT_MODELS[config.provider] ||
      '';

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

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-a`,
        role: 'assistant',
        content: res.content,
        model: res.modelUsed,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

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
        setMessages((prev) => [...prev, cancelNote]);
      } else {
        const errorMsg: ChatMessage = {
          id: `msg-${Date.now()}-err`,
          role: 'assistant',
          content: errText,
          timestamp: Date.now(),
          error: true,
        };
        setMessages((prev) => [...prev, errorMsg]);
        setShowSupportCard(true);
      }
    } finally {
      activeRequestIdRef.current = null;
      cancellingRef.current = false;
      setCancelling(false);
      setSending(false);
    }
  };

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
              <option value="ollama">
                Ollama {caps?.ollamaRunning ? '●' : ''}
              </option>
              <option value="lmstudio">
                LM Studio {caps?.lmstudioRunning ? '●' : ''}
              </option>
              <option value="openai-compat">OpenAI-Compatible</option>
            </optgroup>
          </select>

          <button
            type="button"
            className={`icon-btn-sm ${showSettings ? 'is-active' : ''}`}
            onClick={() => setShowSettings((v) => !v)}
            title={t.aiChat.configToggle}
          >
            <Settings2 size={14} />
          </button>
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
                value={isCustomModelValue ? '__custom__' : config.model}
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
                    {m}
                  </option>
                ))}
                <option value="__custom__">{t.aiChat.customModelOption}</option>
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

        {showSettings && (
          <div className="ai-settings-drawer">
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
