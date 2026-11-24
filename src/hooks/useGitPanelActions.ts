import { useCallback, useEffect, useState } from 'react';
import type React from 'react';
import type { Translations } from '../i18n/types';
import type { AiProviderConfig, GitPanelState, Locale, SidebarTab } from '../types';
import {
  getGitPanelState,
  getGitStatus,
  gitCommit,
  gitDiscardFiles,
  gitGetDiff,
  gitPull,
  gitPush,
  gitStageFiles,
  gitUnstageFiles,
  isTauri,
  sendAiChat,
} from '../utils/platform';

export interface GitDiffTarget {
  path: string;
  staged: boolean;
  content: string;
}

interface UseGitPanelActionsParams {
  t: Translations;
  locale: Locale;
  aiConfig: AiProviderConfig;
  sidebarTab: SidebarTab;
  workspaceRoot: string | null;
  workspaceRootRef: React.MutableRefObject<string | null>;
  refreshWorkspaceRef: React.MutableRefObject<(root: string) => Promise<void>>;
  syncOpenTabsWithDiskRef: React.MutableRefObject<() => Promise<void>>;
  notify: (msg: string) => void;
  formatErrorMessage: (err: unknown) => string;
}

export function useGitPanelActions({
  t,
  locale,
  aiConfig,
  sidebarTab,
  workspaceRoot,
  workspaceRootRef,
  refreshWorkspaceRef,
  syncOpenTabsWithDiskRef,
  notify,
  formatErrorMessage,
}: UseGitPanelActionsParams) {
  const [gitStatusEntries, setGitStatusEntries] = useState<Record<string, string>>({});
  const [gitBranch, setGitBranch] = useState<string | null>(null);
  const [gitPanelState, setGitPanelState] = useState<GitPanelState | null>(null);
  const [gitPanelBusy, setGitPanelBusy] = useState(false);
  const [gitDiffTarget, setGitDiffTarget] = useState<GitDiffTarget | null>(null);

  const resetGitState = useCallback(() => {
    setGitStatusEntries({});
    setGitBranch(null);
    setGitPanelState(null);
    setGitDiffTarget(null);
  }, []);

  const refreshGitPanel = useCallback(async (root: string | null) => {
    if (!root || !isTauri()) {
      setGitPanelState(null);
      return;
    }
    try {
      const panel = await getGitPanelState(root);
      setGitPanelState(panel);
    } catch {
      setGitPanelState(null);
    }
  }, []);

  const refreshGitStatus = useCallback(
    async (root: string | null) => {
      if (!root || !isTauri()) {
        setGitStatusEntries({});
        setGitBranch(null);
        setGitPanelState(null);
        return;
      }
      try {
        const st = await getGitStatus(root);
        if (st.isRepo) {
          setGitStatusEntries(st.entries || {});
          setGitBranch(st.branch || null);
          void refreshGitPanel(root);
        } else {
          setGitStatusEntries({});
          setGitBranch(null);
          setGitPanelState(null);
        }
      } catch {
        setGitStatusEntries({});
        setGitBranch(null);
        setGitPanelState(null);
      }
    },
    [refreshGitPanel]
  );

  useEffect(() => {
    if (sidebarTab === 'git' && workspaceRoot) {
      void refreshGitPanel(workspaceRoot);
    }
  }, [sidebarTab, workspaceRoot, refreshGitPanel]);

  const handleGitStageFiles = useCallback(
    async (paths: string[]) => {
      const root = workspaceRootRef.current;
      if (!root || paths.length === 0) return;
      setGitPanelBusy(true);
      try {
        await gitStageFiles(root, paths);
        await refreshGitStatus(root);
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
      } finally {
        setGitPanelBusy(false);
      }
    },
    [workspaceRootRef, refreshGitStatus, notify, t.toasts.errorPrefix, formatErrorMessage]
  );

  const handleGitUnstageFiles = useCallback(
    async (paths: string[]) => {
      const root = workspaceRootRef.current;
      if (!root || paths.length === 0) return;
      setGitPanelBusy(true);
      try {
        await gitUnstageFiles(root, paths);
        await refreshGitStatus(root);
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
      } finally {
        setGitPanelBusy(false);
      }
    },
    [workspaceRootRef, refreshGitStatus, notify, t.toasts.errorPrefix, formatErrorMessage]
  );

  const handleGitDiscardFiles = useCallback(
    async (paths: string[]) => {
      const root = workspaceRootRef.current;
      if (!root || paths.length === 0) return;
      setGitPanelBusy(true);
      try {
        await gitDiscardFiles(root, paths);
        setGitDiffTarget(null);
        await refreshWorkspaceRef.current(root);
        await syncOpenTabsWithDiskRef.current();
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
      } finally {
        setGitPanelBusy(false);
      }
    },
    [
      workspaceRootRef,
      refreshWorkspaceRef,
      syncOpenTabsWithDiskRef,
      notify,
      t.toasts.errorPrefix,
      formatErrorMessage,
    ]
  );

  const handleGitViewDiff = useCallback(
    async (filePath: string, staged: boolean) => {
      const root = workspaceRootRef.current;
      if (!root) return;
      try {
        const content = await gitGetDiff(root, staged, filePath);
        setGitDiffTarget({ path: filePath, staged, content });
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
      }
    },
    [workspaceRootRef, notify, t.toasts.errorPrefix, formatErrorMessage]
  );

  const handleGitCommit = useCallback(
    async (message: string): Promise<boolean> => {
      const root = workspaceRootRef.current;
      if (!root || !message.trim()) return false;
      setGitPanelBusy(true);
      try {
        await gitCommit(root, message.trim());
        setGitDiffTarget(null);
        await refreshGitStatus(root);
        notify(t.gitPanel.committedToast);
        return true;
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
        return false;
      } finally {
        setGitPanelBusy(false);
      }
    },
    [
      workspaceRootRef,
      refreshGitStatus,
      notify,
      t.gitPanel.committedToast,
      t.toasts.errorPrefix,
      formatErrorMessage,
    ]
  );

  const handleGitPush = useCallback(async () => {
    const root = workspaceRootRef.current;
    if (!root) return;
    setGitPanelBusy(true);
    try {
      await gitPush(root);
      await refreshGitStatus(root);
      notify(t.gitPanel.pushedToast);
    } catch (err) {
      notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
    } finally {
      setGitPanelBusy(false);
    }
  }, [workspaceRootRef, refreshGitStatus, notify, t.gitPanel.pushedToast, t.toasts.errorPrefix, formatErrorMessage]);

  const handleGitPull = useCallback(async () => {
    const root = workspaceRootRef.current;
    if (!root) return;
    setGitPanelBusy(true);
    try {
      await gitPull(root);
      setGitDiffTarget(null);
      await refreshWorkspaceRef.current(root);
      await syncOpenTabsWithDiskRef.current();
      notify(t.gitPanel.pulledToast);
    } catch (err) {
      notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
    } finally {
      setGitPanelBusy(false);
    }
  }, [
    workspaceRootRef,
    refreshWorkspaceRef,
    syncOpenTabsWithDiskRef,
    notify,
    t.gitPanel.pulledToast,
    t.toasts.errorPrefix,
    formatErrorMessage,
  ]);

  const handleGitAiCommitMessage = useCallback(async (): Promise<string> => {
    const root = workspaceRootRef.current;
    if (!root) return '';
    try {
      const [stagedDiff, unstagedDiff] = await Promise.all([
        gitGetDiff(root, true).catch(() => ''),
        gitGetDiff(root, false).catch(() => ''),
      ]);
      const combined = (stagedDiff.trim() ? stagedDiff : unstagedDiff).slice(0, 12000);
      if (!combined.trim()) return '';
      const sysPrompt =
        locale === 'ja'
          ? '以下の git diff に対して、簡潔で明確な Conventional Commits 形式のコミットメッセージを1つだけ（説明やコードブロックなし、1行目50文字目安）生成してください。'
          : 'Generate a single concise, clear Conventional Commits style commit message for the following git diff. Return only the commit message text without code fences or explanations.';
      const reply = await sendAiChat({
        requestId: `git-commit-${Date.now()}`,
        provider: aiConfig.provider,
        model: aiConfig.model.trim() || undefined,
        apiKey: aiConfig.apiKeys[aiConfig.provider] || undefined,
        baseUrl: aiConfig.baseUrls[aiConfig.provider] || undefined,
        customCliCmd: aiConfig.customCliCmd,
        systemPrompt: sysPrompt,
        messages: [{ role: 'user', content: combined }],
        workspaceDir: root,
        allowWorkspaceWrite: false,
      });
      return reply.content.replace(/^```[^\n]*\n?|\n?```$/g, '').trim();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        !aiConfig.apiKeys[aiConfig.provider] &&
        ['openai', 'anthropic', 'gemini'].includes(aiConfig.provider)
      ) {
        notify(t.gitPanel.noAiProviderToast);
      } else {
        notify(`${t.toasts.errorPrefix} ${msg}`);
      }
      return '';
    }
  }, [workspaceRootRef, aiConfig, locale, notify, t.gitPanel.noAiProviderToast, t.toasts.errorPrefix]);

  return {
    gitStatusEntries,
    setGitStatusEntries,
    gitBranch,
    setGitBranch,
    gitPanelState,
    setGitPanelState,
    gitPanelBusy,
    gitDiffTarget,
    setGitDiffTarget,
    resetGitState,
    refreshGitPanel,
    refreshGitStatus,
    handleGitStageFiles,
    handleGitUnstageFiles,
    handleGitDiscardFiles,
    handleGitViewDiff,
    handleGitCommit,
    handleGitPush,
    handleGitPull,
    handleGitAiCommitMessage,
  };
}
