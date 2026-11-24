import { useCallback, useEffect, useRef, useState } from 'react';
import type { Translations } from '../i18n/types';
import type {
  DocumentTab,
  EditorSettings,
  ProjectInfo,
  ThemeId,
} from '../types';
import { escapeHtmlText, getDocumentPreviewKind, renderMarkdownToHtml } from '../utils/markdown';
import {
  isTauri,
  startExternalPreview,
  stopExternalPreview,
  updateExternalPreview,
  writeClipboardText,
} from '../utils/platform';

interface UseExternalPreviewParams {
  t: Translations;
  theme: ThemeId;
  activeTab: DocumentTab;
  previewKind: ReturnType<typeof getDocumentPreviewKind>;
  workspaceRoot: string | null;
  projectInfo: ProjectInfo | null;
  settings: EditorSettings;
  effectiveSettings: EditorSettings;
  notify: (msg: string) => void;
  formatErrorMessage: (err: unknown) => string;
}

export function useExternalPreview({
  t,
  theme,
  activeTab,
  previewKind,
  workspaceRoot,
  projectInfo,
  settings,
  effectiveSettings,
  notify,
  formatErrorMessage,
}: UseExternalPreviewParams) {
  const [externalPreviewUrl, setExternalPreviewUrl] = useState<string | null>(null);
  const [externalPreviewLanUrls, setExternalPreviewLanUrls] = useState<string[]>([]);

  const buildExternalPreviewPayload = useCallback(async () => {
    if (previewKind === 'webpage') {
      return { bodyHtml: activeTab.content, isRawPage: true };
    }
    if (previewKind === 'code') {
      return {
        bodyHtml: `<pre><code>${escapeHtmlText(activeTab.content)}</code></pre>`,
        isRawPage: false,
      };
    }
    return {
      bodyHtml: await renderMarkdownToHtml(activeTab.content, {
        breaks: Boolean(effectiveSettings.previewSingleLineBreak),
      }),
      isRawPage: false,
    };
  }, [previewKind, activeTab.content, effectiveSettings.previewSingleLineBreak]);

  const handleToggleExternalPreview = useCallback(async () => {
    try {
      if (externalPreviewUrl) {
        await stopExternalPreview();
        setExternalPreviewUrl(null);
        setExternalPreviewLanUrls([]);
      } else {
        const res = await startExternalPreview(
          settings.externalBrowserPort,
          true,
          settings.externalBrowserAllowLan
        );
        setExternalPreviewUrl(res.url);
        setExternalPreviewLanUrls(res.lanUrls ?? []);
        const { bodyHtml, isRawPage } = await buildExternalPreviewPayload();
        const docDir = activeTab.filePath
          ? activeTab.filePath.replace(/[/\\][^/\\]+$/, '')
          : workspaceRoot || null;
        await updateExternalPreview({
          title: activeTab.title,
          bodyHtml,
          theme,
          customCss: settings.customCss,
          docDir,
          workspaceRoot: workspaceRoot || projectInfo?.rootPath || null,
          isRawPage,
        });
        notify(t.toasts.externalPreviewStarted);
      }
    } catch (err) {
      notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
    }
  }, [
    externalPreviewUrl,
    settings.externalBrowserPort,
    settings.externalBrowserAllowLan,
    settings.customCss,
    activeTab.title,
    activeTab.filePath,
    workspaceRoot,
    projectInfo?.rootPath,
    theme,
    buildExternalPreviewPayload,
    notify,
    t.toasts.externalPreviewStarted,
    t.toasts.errorPrefix,
    formatErrorMessage,
  ]);

  // Rebind live preview server cleanly when LAN access or port setting changes while running
  const externalPreviewRunning = Boolean(externalPreviewUrl);
  const lastPreviewNetConfigRef = useRef({
    allowLan: settings.externalBrowserAllowLan,
    port: settings.externalBrowserPort,
  });
  useEffect(() => {
    const prev = lastPreviewNetConfigRef.current;
    const changed =
      prev.allowLan !== settings.externalBrowserAllowLan ||
      prev.port !== settings.externalBrowserPort;
    lastPreviewNetConfigRef.current = {
      allowLan: settings.externalBrowserAllowLan,
      port: settings.externalBrowserPort,
    };
    if (!changed || !externalPreviewRunning || !isTauri()) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await startExternalPreview(
          settings.externalBrowserPort,
          false,
          settings.externalBrowserAllowLan
        );
        if (!cancelled) {
          setExternalPreviewUrl(res.url);
          setExternalPreviewLanUrls(res.lanUrls ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    externalPreviewRunning,
    settings.externalBrowserAllowLan,
    settings.externalBrowserPort,
    notify,
    t.toasts.errorPrefix,
    formatErrorMessage,
  ]);

  const handleCopyLanUrl = useCallback(
    async (lanUrl: string) => {
      await writeClipboardText(lanUrl);
      notify(`${t.toasts.copiedLanUrl}: ${lanUrl}`);
    },
    [notify, t.toasts.copiedLanUrl]
  );

  // Push debounced HTML updates to external live preview server
  useEffect(() => {
    if (!externalPreviewUrl) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const { bodyHtml, isRawPage } = await buildExternalPreviewPayload();
        if (cancelled) return;
        const docDir = activeTab.filePath
          ? activeTab.filePath.replace(/[/\\][^/\\]+$/, '')
          : workspaceRoot || null;
        await updateExternalPreview({
          title: activeTab.title,
          bodyHtml,
          theme,
          customCss: settings.customCss,
          docDir,
          workspaceRoot: workspaceRoot || projectInfo?.rootPath || null,
          isRawPage,
        });
      } catch {
        // ignore
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    externalPreviewUrl,
    activeTab.title,
    activeTab.filePath,
    workspaceRoot,
    projectInfo?.rootPath,
    theme,
    settings.customCss,
    buildExternalPreviewPayload,
  ]);

  return {
    externalPreviewUrl,
    setExternalPreviewUrl,
    externalPreviewLanUrls,
    setExternalPreviewLanUrls,
    handleToggleExternalPreview,
    handleCopyLanUrl,
  };
}
