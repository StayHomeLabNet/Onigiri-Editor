import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Translations } from '../../i18n/types';
import type {
  AiCapabilities,
  AiProviderConfig,
  AiProviderId,
  EditorSettings,
  HarnessPermissionMode,
  HarnessThread,
  HarnessTimelineEntry,
  Locale,
  ProjectInfo,
  ProjectServerStatus,
  ThemeId,
  TurnChangedFile,
  WorkspaceEntry,
} from '../../types';
import { browserClose } from '../../utils/platform';
import { HarnessComposer } from './HarnessComposer';
import { HarnessWorkbenchPane, type WorkbenchTabId } from './HarnessWorkbenchPane';
import { ThreadSidebar } from './ThreadSidebar';
import { ThreadTimeline } from './ThreadTimeline';

interface HarnessWorkspaceProps {
  t: Translations;
  locale: Locale;
  theme: ThemeId;
  settings: EditorSettings;
  aiConfig: AiProviderConfig;
  onAiConfigChange: (next: AiProviderConfig) => void;
  workspaceRoot: string | null;
  workspaceEntries: WorkspaceEntry[];
  activeEditorFilePath?: string | null;
  activeEditorFileTitle?: string;
  showSidebar: boolean;
  showWorkbench: boolean;
  onShowWorkbenchChange: (show: boolean) => void;
  threads: HarnessThread[];
  activeThread: HarnessThread | null;
  activeTimeline: HarnessTimelineEntry[];
  capabilities: AiCapabilities | null;
  initialDraft?: string;
  onClearInitialDraft?: () => void;
  modalOverlayOpen: boolean;
  projectInfo?: ProjectInfo | null;
  projectServer?: ProjectServerStatus | null;
  onChooseFolder: () => void;
  onUseCurrentFileFolder?: () => void;
  onSelectThread: (threadId: string) => void;
  onCreateThread: () => void;
  onDeleteThread: (threadId: string) => void;
  onUpdateThreadSettings: (
    threadId: string,
    patch: {
      title?: string;
      provider?: string;
      model?: string;
      permissionMode?: HarnessPermissionMode;
    }
  ) => Promise<HarnessThread>;
  onSendPrompt: (params: {
    threadId?: string | null;
    workspaceRoot: string;
    content: string;
    provider?: string;
    model?: string;
    permissionMode?: HarnessPermissionMode;
    contextFiles?: string[];
    executePlanEntryId?: string;
  }) => Promise<HarnessThread>;
  onCancelTurn: (threadId: string) => Promise<void>;
  onRespondApproval: (
    approvalId: string,
    decision: 'allow' | 'allow_session' | 'deny'
  ) => Promise<void>;
  onAcceptTurn: (threadId: string, diffEntryId: string) => Promise<void>;
  onRevertTurn: (threadId: string, diffEntryId: string) => Promise<string[]>;
  onOpenFileInEditor: (filePath: string) => void;
  onCopyText: (text: string) => void;
  onNotify: (msg: string) => void;
}

export const HarnessWorkspace: React.FC<HarnessWorkspaceProps> = ({
  t,
  locale,
  theme,
  settings,
  aiConfig,
  onAiConfigChange,
  workspaceRoot,
  workspaceEntries,
  activeEditorFilePath,
  activeEditorFileTitle,
  showSidebar,
  showWorkbench,
  onShowWorkbenchChange,
  threads,
  activeThread,
  activeTimeline,
  capabilities,
  initialDraft,
  onClearInitialDraft,
  modalOverlayOpen,
  projectInfo,
  projectServer,
  onChooseFolder,
  onUseCurrentFileFolder,
  onSelectThread,
  onCreateThread,
  onDeleteThread,
  onUpdateThreadSettings,
  onSendPrompt,
  onCancelTurn,
  onRespondApproval,
  onAcceptTurn,
  onRevertTurn,
  onOpenFileInEditor,
  onCopyText,
  onNotify,
}) => {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [workbenchTab, setWorkbenchTab] = useState<WorkbenchTabId>('diff');
  const [workbenchWidthPct, setWorkbenchWidthPct] = useState<number>(38);
  const [inspectedFilePath, setInspectedFilePath] = useState<string | null>(
    activeEditorFilePath || null
  );
  const [inspectedDiff, setInspectedDiff] = useState<TurnChangedFile | null>(null);
  const [draftPermissionMode, setDraftPermissionMode] =
    useState<HarnessPermissionMode>('auto-edits');
  const [browserUrl, setBrowserUrl] = useState<string>(
    settings.builtinBrowserDefaultUrl || 'https://www.google.com'
  );

  // Close native child webview whenever workbench or browser tab hides, or on unmount
  useEffect(() => {
    if (!showWorkbench || workbenchTab !== 'browser' || modalOverlayOpen) {
      void browserClose().catch(() => {});
    }
  }, [showWorkbench, workbenchTab, modalOverlayOpen]);

  useEffect(() => {
    return () => {
      void browserClose().catch(() => {});
    };
  }, []);

  // Automatically surface latest diff in workbench when a TurnDiff arrives
  useEffect(() => {
    for (let i = activeTimeline.length - 1; i >= 0; i--) {
      const entry = activeTimeline[i];
      if (entry.kind === 'turn_diff' && entry.files.length > 0 && !entry.reverted) {
        setInspectedDiff(entry.files[0]);
        break;
      }
    }
  }, [activeTimeline]);

  const effectiveWorkspaceRoot = activeThread?.workspaceRoot || workspaceRoot;
  const effectiveProvider = (activeThread?.provider || aiConfig.provider) as AiProviderId;
  const effectiveModel =
    activeThread?.model ??
    aiConfig.models?.[effectiveProvider] ??
    aiConfig.model ??
    '';
  const effectivePermMode: HarnessPermissionMode =
    activeThread?.permissionMode || draftPermissionMode;

  const isRunning =
    activeThread?.status === 'running' || activeThread?.status === 'waiting_approval';

  const startWorkbenchResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const shell = shellRef.current;
    if (!shell) return;

    const onMove = (ev: MouseEvent) => {
      const rect = shell.getBoundingClientRect();
      if (rect.width <= 0) return;
      const rightPx = rect.right - ev.clientX;
      const pct = Math.min(62, Math.max(24, (rightPx / rect.width) * 100));
      setWorkbenchWidthPct(pct);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const handleChangeProvider = (nextProvider: AiProviderId) => {
    const nextModel = aiConfig.models?.[nextProvider] ?? '';
    onAiConfigChange({
      ...aiConfig,
      provider: nextProvider,
      model: nextModel,
    });
    if (activeThread) {
      void onUpdateThreadSettings(activeThread.id, {
        provider: nextProvider,
        model: nextModel,
      }).catch((err) => onNotify(String(err)));
    }
  };

  const handleChangeModel = (nextModel: string) => {
    onAiConfigChange({
      ...aiConfig,
      model: nextModel,
      models: { ...(aiConfig.models || {}), [effectiveProvider]: nextModel },
    });
    if (activeThread) {
      void onUpdateThreadSettings(activeThread.id, { model: nextModel }).catch(() => {});
    }
  };

  const handleChangePermissionMode = (nextMode: HarnessPermissionMode) => {
    setDraftPermissionMode(nextMode);
    if (activeThread) {
      void onUpdateThreadSettings(activeThread.id, { permissionMode: nextMode }).catch(() => {});
    }
  };

  const handleSend = (content: string, contextFiles: string[]) => {
    if (!effectiveWorkspaceRoot) return;
    void onSendPrompt({
      threadId: activeThread?.id ?? null,
      workspaceRoot: effectiveWorkspaceRoot,
      content,
      provider: effectiveProvider,
      model: effectiveModel,
      permissionMode: effectivePermMode,
      contextFiles,
    }).catch((err) => onNotify(String(err)));
  };

  const handleExecutePlan = (planEntryId: string, rawPlan: string) => {
    if (!effectiveWorkspaceRoot) return;
    const execPrompt =
      locale === 'ja'
        ? `上記の計画に従って実装・編集を実行してください。\n\n# 承認された計画\n${rawPlan}`
        : `Proceed to implement the approved plan step by step.\n\n# Approved Plan\n${rawPlan}`;
    setDraftPermissionMode('auto-edits');
    void onSendPrompt({
      threadId: activeThread?.id ?? null,
      workspaceRoot: effectiveWorkspaceRoot,
      content: execPrompt,
      provider: effectiveProvider,
      model: effectiveModel,
      permissionMode: 'auto-edits',
      executePlanEntryId: planEntryId,
    }).catch((err) => onNotify(String(err)));
  };

  return (
    <div className="harness-shell" ref={shellRef}>
      {showSidebar && (
        <ThreadSidebar
          t={t}
          threads={threads}
          activeThreadId={activeThread?.id ?? null}
          workspaceRoot={workspaceRoot}
          onSelectThread={onSelectThread}
          onCreateThread={onCreateThread}
          onDeleteThread={onDeleteThread}
        />
      )}

      <main className="harness-center">
        {activeThread && (
          <div className="harness-thread-header">
            <div className="harness-thread-header-title">{activeThread.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--fg-muted)' }}>
              <span>{activeThread.provider}</span>
              {activeThread.model && <span>· {activeThread.model}</span>}
            </div>
          </div>
        )}

        <ThreadTimeline
          t={t}
          workspaceRoot={effectiveWorkspaceRoot}
          activeFilePath={activeEditorFilePath}
          thread={activeThread}
          entries={activeTimeline}
          onChooseFolder={onChooseFolder}
          onUseCurrentFileFolder={onUseCurrentFileFolder}
          onExecutePlan={handleExecutePlan}
          onRespondApproval={(aid, dec) => {
            void onRespondApproval(aid, dec).catch((err) => onNotify(String(err)));
          }}
          onAcceptDiff={(diffId) => {
            if (!activeThread) return;
            void onAcceptTurn(activeThread.id, diffId).catch((err) => onNotify(String(err)));
          }}
          onRevertDiff={(diffId) => {
            if (!activeThread) return;
            void onRevertTurn(activeThread.id, diffId)
              .then(() => onNotify(t.harness.revertedToast))
              .catch((err) => onNotify(String(err)));
          }}
          onInspectFile={(fp) => {
            setInspectedFilePath(fp);
            setWorkbenchTab('preview');
            onShowWorkbenchChange(true);
          }}
          onInspectDiffFile={(df) => {
            setInspectedDiff(df);
            setInspectedFilePath(df.path);
            setWorkbenchTab('diff');
            onShowWorkbenchChange(true);
          }}
          onCopyText={onCopyText}
        />

        <HarnessComposer
          t={t}
          disabled={!effectiveWorkspaceRoot}
          isRunning={isRunning}
          provider={effectiveProvider}
          model={effectiveModel}
          permissionMode={effectivePermMode}
          aiConfig={aiConfig}
          capabilities={capabilities}
          activeEditorFilePath={activeEditorFilePath}
          activeEditorFileTitle={activeEditorFileTitle}
          initialDraft={initialDraft}
          onClearInitialDraft={onClearInitialDraft}
          onChangeProvider={handleChangeProvider}
          onChangeModel={handleChangeModel}
          onChangePermissionMode={handleChangePermissionMode}
          onSend={handleSend}
          onStop={() => {
            if (activeThread) void onCancelTurn(activeThread.id);
          }}
        />
      </main>

      {showWorkbench && (
        <>
          <div
            className="split-resizer"
            onMouseDown={startWorkbenchResize}
            role="separator"
            aria-orientation="vertical"
          />
          <HarnessWorkbenchPane
            t={t}
            locale={locale}
            theme={theme}
            settings={settings}
            widthPercent={workbenchWidthPct}
            activeTab={workbenchTab}
            onTabChange={setWorkbenchTab}
            onClose={() => onShowWorkbenchChange(false)}
            workspaceRoot={effectiveWorkspaceRoot}
            workspaceEntries={workspaceEntries}
            inspectedFilePath={inspectedFilePath}
            onSelectFilePath={setInspectedFilePath}
            inspectedDiff={inspectedDiff}
            onOpenInEditor={onOpenFileInEditor}
            browserUrl={browserUrl}
            onBrowserUrlChange={setBrowserUrl}
            browserVisible={showWorkbench && !modalOverlayOpen}
            projectInfo={projectInfo}
            projectServer={projectServer}
            onNotify={onNotify}
          />
        </>
      )}
    </div>
  );
};
