import { useCallback } from 'react';
import type React from 'react';
import type { EditorHandle } from '../components/EditorPane';
import type { Translations } from '../i18n/types';
import type {
  DocumentTab,
  EditorSettings,
  ProjectServerStatus,
  RightPaneMode,
  SearchMatch,
  ViewLayout,
} from '../types';
import {
  checkFilesSync,
  createFileInDir,
  createWorkspaceFolder,
  deleteWorkspaceEntry,
  duplicateWorkspaceFile,
  readFileByPath,
  renameWorkspaceEntry,
  replaceInWorkspace,
  searchWorkspaceDir,
  stopProjectDevServer,
} from '../utils/platform';
import { makeTab } from '../utils/session';

export type PendingFolderAction =
  | { type: 'open-picker' }
  | { type: 'open-path'; path: string }
  | { type: 'close-folder' };

interface UseWorkspaceActionsParams {
  t: Translations;
  layout: ViewLayout;
  rightPaneMode: RightPaneMode;
  browserUrl: string;
  workspaceRoot: string | null;
  workspaceRootRef: React.MutableRefObject<string | null>;
  tabsRef: React.MutableRefObject<DocumentTab[]>;
  editorRef: React.MutableRefObject<EditorHandle | null>;
  effectiveSettings: EditorSettings;
  projectSetupBusy: boolean;
  projectServer: ProjectServerStatus | null;
  pendingFolderActionRef: React.MutableRefObject<PendingFolderAction>;
  setTabs: React.Dispatch<React.SetStateAction<DocumentTab[]>>;
  setActiveTabId: React.Dispatch<React.SetStateAction<string>>;
  setSideTabId: React.Dispatch<React.SetStateAction<string | null>>;
  setSidePaneMode: React.Dispatch<React.SetStateAction<'edit' | 'diff'>>;
  setLayout: React.Dispatch<React.SetStateAction<ViewLayout>>;
  setRightPaneMode: React.Dispatch<React.SetStateAction<RightPaneMode>>;
  setSearchMatches: React.Dispatch<React.SetStateAction<SearchMatch[]>>;
  setFolderSwitchGuardMode: React.Dispatch<
    React.SetStateAction<'server-running' | 'setup-busy' | null>
  >;
  setStoppingServerForSwitch: React.Dispatch<React.SetStateAction<boolean>>;
  setProjectServer: React.Dispatch<React.SetStateAction<ProjectServerStatus | null>>;
  clearPendingBrowseTarget: () => void;
  proceedOpenFolderPicker: () => Promise<void>;
  proceedCloseWorkspaceFolder: () => void;
  activateWorkspaceDir: (dirPath: string) => Promise<void>;
  refreshWorkspace: (root: string) => Promise<void>;
  syncOpenTabsWithDisk: () => Promise<void>;
  openPathInTab: (filePath: string) => Promise<DocumentTab | null>;
  handleOpenTabToSide: (tabId: string) => void;
  pushRecentFile: (filePath: string) => void;
  notify: (msg: string) => void;
  formatErrorMessage: (err: unknown) => string;
}

export function useWorkspaceActions({
  t,
  layout,
  rightPaneMode,
  browserUrl,
  workspaceRoot,
  workspaceRootRef,
  tabsRef,
  editorRef,
  effectiveSettings,
  projectSetupBusy,
  projectServer,
  pendingFolderActionRef,
  setTabs,
  setActiveTabId,
  setSideTabId,
  setSidePaneMode,
  setLayout,
  setRightPaneMode,
  setSearchMatches,
  setFolderSwitchGuardMode,
  setStoppingServerForSwitch,
  setProjectServer,
  clearPendingBrowseTarget,
  proceedOpenFolderPicker,
  proceedCloseWorkspaceFolder,
  activateWorkspaceDir,
  refreshWorkspace,
  syncOpenTabsWithDisk,
  openPathInTab,
  handleOpenTabToSide,
  pushRecentFile,
  notify,
  formatErrorMessage,
}: UseWorkspaceActionsParams) {
  const handleOpenFolder = useCallback(() => {
    if (projectSetupBusy) {
      setFolderSwitchGuardMode('setup-busy');
      return;
    }
    if (projectServer?.running || projectServer?.starting) {
      pendingFolderActionRef.current = { type: 'open-picker' };
      setFolderSwitchGuardMode('server-running');
      return;
    }
    void proceedOpenFolderPicker();
  }, [
    projectSetupBusy,
    projectServer?.running,
    projectServer?.starting,
    pendingFolderActionRef,
    setFolderSwitchGuardMode,
    proceedOpenFolderPicker,
  ]);

  const handleCloseFolder = useCallback(() => {
    if (!workspaceRoot) return;
    if (projectSetupBusy) {
      setFolderSwitchGuardMode('setup-busy');
      return;
    }
    if (projectServer?.running || projectServer?.starting) {
      pendingFolderActionRef.current = { type: 'close-folder' };
      setFolderSwitchGuardMode('server-running');
      return;
    }
    proceedCloseWorkspaceFolder();
  }, [
    workspaceRoot,
    projectSetupBusy,
    projectServer?.running,
    projectServer?.starting,
    pendingFolderActionRef,
    setFolderSwitchGuardMode,
    proceedCloseWorkspaceFolder,
  ]);

  const handleConfirmStopAndSwitchFolder = useCallback(async () => {
    const stoppedUrl = projectServer?.url;
    setStoppingServerForSwitch(true);
    try {
      clearPendingBrowseTarget();
      const st = await stopProjectDevServer();
      setProjectServer(st);
      notify(t.toasts.devServerStopped);

      if (
        rightPaneMode === 'browser' &&
        stoppedUrl &&
        browserUrl.startsWith(stoppedUrl.replace(/\/+$/, ''))
      ) {
        setRightPaneMode('markdown');
      }

      setFolderSwitchGuardMode(null);
      const pending = pendingFolderActionRef.current;
      pendingFolderActionRef.current = { type: 'open-picker' };
      if (pending.type === 'close-folder') {
        proceedCloseWorkspaceFolder();
      } else if (pending.type === 'open-path') {
        await activateWorkspaceDir(pending.path);
      } else {
        await proceedOpenFolderPicker();
      }
    } catch (err) {
      notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
    } finally {
      setStoppingServerForSwitch(false);
    }
  }, [
    projectServer?.url,
    rightPaneMode,
    browserUrl,
    pendingFolderActionRef,
    setStoppingServerForSwitch,
    clearPendingBrowseTarget,
    setProjectServer,
    setRightPaneMode,
    setFolderSwitchGuardMode,
    notify,
    t.toasts.devServerStopped,
    t.toasts.errorPrefix,
    formatErrorMessage,
    activateWorkspaceDir,
    proceedCloseWorkspaceFolder,
    proceedOpenFolderPicker,
  ]);

  const handleCreateFileInFolder = useCallback(
    async (fileName: string) => {
      if (!workspaceRoot) return;
      try {
        const starter = '';
        const encoding = effectiveSettings.defaultNewFileEncoding ?? 'utf-8';
        const eol = effectiveSettings.defaultNewFileEol ?? '\n';
        const fullPath = await createFileInDir(workspaceRoot, fileName, starter, encoding);
        await refreshWorkspace(workspaceRoot);
        const syncRes = await checkFilesSync([fullPath]).catch(() => []);
        const modifiedMs = syncRes[0]?.exists ? syncRes[0].modifiedMs : undefined;
        const created = makeTab(fileName, starter, fullPath, modifiedMs, {
          encoding,
          eol,
        });
        setTabs((prev) => [...prev, created]);
        setActiveTabId(created.id);
        pushRecentFile(fullPath);
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
      }
    },
    [
      workspaceRoot,
      effectiveSettings.defaultNewFileEncoding,
      effectiveSettings.defaultNewFileEol,
      refreshWorkspace,
      setTabs,
      setActiveTabId,
      pushRecentFile,
      notify,
      t.toasts.errorPrefix,
      formatErrorMessage,
    ]
  );

  const handleOpenFileToSide = useCallback(
    async (filePath: string) => {
      const existing = tabsRef.current.find((tb) => tb.filePath === filePath);
      if (existing) {
        handleOpenTabToSide(existing.id);
        pushRecentFile(filePath);
        return;
      }
      try {
        const res = await readFileByPath(filePath);
        const syncInfo = await checkFilesSync([res.path]).catch(() => []);
        const modifiedMs = syncInfo[0]?.exists ? syncInfo[0].modifiedMs : undefined;
        const created = makeTab(res.name, res.content, res.path, modifiedMs, {
          encoding: res.encoding,
          eol: res.eol,
        });
        setTabs((prev) => [...prev, created]);
        pushRecentFile(res.path);
        if (layout === 'editor') setLayout('split');
        setRightPaneMode('markdown');
        setSideTabId(created.id);
        setSidePaneMode('edit');
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
      }
    },
    [
      tabsRef,
      handleOpenTabToSide,
      pushRecentFile,
      layout,
      setTabs,
      setLayout,
      setRightPaneMode,
      setSideTabId,
      setSidePaneMode,
      notify,
      t.toasts.errorPrefix,
      formatErrorMessage,
    ]
  );

  const handleCreateFileInDir = useCallback(
    async (targetDir: string, fileName: string) => {
      if (!workspaceRoot) return;
      try {
        const starter = '';
        const encoding = effectiveSettings.defaultNewFileEncoding ?? 'utf-8';
        const eol = effectiveSettings.defaultNewFileEol ?? '\n';
        const fullPath = await createFileInDir(targetDir, fileName, starter, encoding);
        await refreshWorkspace(workspaceRoot);
        const syncRes = await checkFilesSync([fullPath]).catch(() => []);
        const modifiedMs = syncRes[0]?.exists ? syncRes[0].modifiedMs : undefined;
        const baseName = fileName.split(/[/\\]/).pop() || fileName;
        const created = makeTab(baseName, starter, fullPath, modifiedMs, {
          encoding,
          eol,
        });
        setTabs((prev) => [...prev, created]);
        setActiveTabId(created.id);
        pushRecentFile(fullPath);
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
      }
    },
    [
      workspaceRoot,
      effectiveSettings.defaultNewFileEncoding,
      effectiveSettings.defaultNewFileEol,
      refreshWorkspace,
      setTabs,
      setActiveTabId,
      pushRecentFile,
      notify,
      t.toasts.errorPrefix,
      formatErrorMessage,
    ]
  );

  const handleCreateFolderInDir = useCallback(
    async (targetDir: string, folderName: string) => {
      if (!workspaceRoot) return;
      try {
        const normRoot = workspaceRoot.replace(/\\/g, '/').replace(/\/+$/, '');
        const normTarget = targetDir.replace(/\\/g, '/').replace(/\/+$/, '');
        const relPrefix = normTarget.toLowerCase().startsWith(`${normRoot.toLowerCase()}/`)
          ? normTarget.slice(normRoot.length + 1)
          : '';
        const relPath = relPrefix
          ? `${relPrefix}/${folderName.replace(/^\/+/, '')}`
          : folderName.replace(/^\/+/, '');
        await createWorkspaceFolder(workspaceRoot, relPath);
        await refreshWorkspace(workspaceRoot);
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
      }
    },
    [workspaceRoot, refreshWorkspace, notify, t.toasts.errorPrefix, formatErrorMessage]
  );

  const handleRenameEntry = useCallback(
    async (oldPath: string, newName: string) => {
      if (!workspaceRoot) return;
      try {
        const newPath = await renameWorkspaceEntry(workspaceRoot, oldPath, newName);
        const oldPrefixForward = `${oldPath.replace(/\\/g, '/')}/`;
        const newPrefixForward = `${newPath.replace(/\\/g, '/')}/`;
        setTabs((prev) =>
          prev.map((tb) => {
            if (!tb.filePath) return tb;
            if (tb.filePath === oldPath) {
              const title = newPath.split(/[/\\]/).pop() || newName;
              return { ...tb, title, filePath: newPath, updatedAt: Date.now() };
            }
            const norm = tb.filePath.replace(/\\/g, '/');
            if (norm.startsWith(oldPrefixForward)) {
              const suffix = norm.slice(oldPrefixForward.length);
              return { ...tb, filePath: `${newPrefixForward}${suffix}`, updatedAt: Date.now() };
            }
            return tb;
          })
        );
        await refreshWorkspace(workspaceRoot);
        notify(t.toasts.renamedSuccess);
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
      }
    },
    [
      workspaceRoot,
      setTabs,
      refreshWorkspace,
      notify,
      t.toasts.renamedSuccess,
      t.toasts.errorPrefix,
      formatErrorMessage,
    ]
  );

  const handleDuplicateEntry = useCallback(
    async (filePath: string) => {
      if (!workspaceRoot) return;
      try {
        const dupPath = await duplicateWorkspaceFile(workspaceRoot, filePath);
        await refreshWorkspace(workspaceRoot);
        await openPathInTab(dupPath);
        notify(t.toasts.duplicatedSuccess);
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
      }
    },
    [
      workspaceRoot,
      refreshWorkspace,
      openPathInTab,
      notify,
      t.toasts.duplicatedSuccess,
      t.toasts.errorPrefix,
      formatErrorMessage,
    ]
  );

  const handleDeleteEntry = useCallback(
    async (targetPath: string, _isDir: boolean, name: string) => {
      if (!workspaceRoot) return;
      if (!window.confirm(t.sidebar.deleteConfirm.replace('{name}', name))) return;
      try {
        await deleteWorkspaceEntry(workspaceRoot, targetPath);
        const normTarget = targetPath.replace(/\\/g, '/');
        setTabs((prev) =>
          prev.map((tb) => {
            if (!tb.filePath) return tb;
            const normFile = tb.filePath.replace(/\\/g, '/');
            if (normFile === normTarget || normFile.startsWith(`${normTarget}/`)) {
              return { ...tb, externalStatus: 'deleted' };
            }
            return tb;
          })
        );
        await refreshWorkspace(workspaceRoot);
        notify(t.toasts.deletedSuccess);
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
      }
    },
    [
      workspaceRoot,
      setTabs,
      refreshWorkspace,
      notify,
      t.sidebar.deleteConfirm,
      t.toasts.deletedSuccess,
      t.toasts.errorPrefix,
      formatErrorMessage,
    ]
  );

  const handleSearchWorkspace = useCallback(
    async (q: string) => {
      if (!workspaceRoot || !q.trim()) {
        setSearchMatches([]);
        return;
      }
      try {
        const res = await searchWorkspaceDir(workspaceRoot, q);
        setSearchMatches(res);
      } catch {
        setSearchMatches([]);
      }
    },
    [workspaceRoot, setSearchMatches]
  );

  const reloadCleanModifiedTabs = useCallback(
    async (modifiedPaths: string[]) => {
      if (modifiedPaths.length === 0) return;
      const modifiedSet = new Set(modifiedPaths);
      const cleanTargets = tabsRef.current.filter(
        (tb) => tb.filePath && modifiedSet.has(tb.filePath) && !tb.dirty
      );
      for (const tb of cleanTargets) {
        try {
          const reloaded = await readFileByPath(tb.filePath!, tb.encoding);
          const norm = reloaded.content.includes('\r\n')
            ? reloaded.content.replace(/\r\n/g, '\n')
            : reloaded.content;
          const syncInfo = await checkFilesSync([tb.filePath!]).catch(() => []);
          const mtime = syncInfo[0]?.exists ? syncInfo[0].modifiedMs : tb.diskModifiedMs;
          setTabs((prev) =>
            prev.map((item) =>
              item.id === tb.id
                ? {
                    ...item,
                    content: norm,
                    savedContent: norm,
                    dirty: false,
                    diskModifiedMs: mtime,
                    externalStatus: null,
                  }
                : item
            )
          );
        } catch {
          // ignore individual reload failure
        }
      }
      void syncOpenTabsWithDisk();
    },
    [tabsRef, setTabs, syncOpenTabsWithDisk]
  );

  const handleReplaceInWorkspace = useCallback(
    async (query: string, replacement: string, caseSensitive: boolean, useRegex: boolean) => {
      if (!workspaceRoot || !query) return;
      const confirmed = window.confirm(
        t.sidebar.replaceConfirm.replace('{query}', query).replace('{replacement}', replacement)
      );
      if (!confirmed) return;
      try {
        const res = await replaceInWorkspace({
          rootPath: workspaceRoot,
          query,
          replacement,
          caseSensitive,
          useRegex,
        });
        await refreshWorkspace(workspaceRoot);
        await reloadCleanModifiedTabs(res.modifiedPaths);
        await handleSearchWorkspace(query);
        notify(
          t.sidebar.replaceDoneToast
            .replace('{files}', String(res.filesModified))
            .replace('{count}', String(res.replacements))
        );
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
      }
    },
    [
      workspaceRoot,
      refreshWorkspace,
      reloadCleanModifiedTabs,
      handleSearchWorkspace,
      notify,
      t.sidebar.replaceConfirm,
      t.sidebar.replaceDoneToast,
      t.toasts.errorPrefix,
      formatErrorMessage,
    ]
  );

  const handleAfterWorkspaceGrepReplace = useCallback(
    async (modifiedPaths: string[], count: number) => {
      if (workspaceRootRef.current) {
        await refreshWorkspace(workspaceRootRef.current);
      }
      await reloadCleanModifiedTabs(modifiedPaths);
      notify(
        t.grepModal.doneToast
          .replace('{files}', String(modifiedPaths.length))
          .replace('{count}', String(count))
      );
    },
    [workspaceRootRef, refreshWorkspace, reloadCleanModifiedTabs, notify, t.grepModal.doneToast]
  );

  const handleOpenFileAtLine = useCallback(
    async (filePath: string, line: number) => {
      const opened = await openPathInTab(filePath);
      if (opened) {
        window.setTimeout(() => {
          editorRef.current?.scrollToLine(line, 1);
        }, 60);
      }
    },
    [openPathInTab, editorRef]
  );

  return {
    handleOpenFolder,
    handleCloseFolder,
    handleConfirmStopAndSwitchFolder,
    handleCreateFileInFolder,
    handleOpenFileToSide,
    handleCreateFileInDir,
    handleCreateFolderInDir,
    handleRenameEntry,
    handleDuplicateEntry,
    handleDeleteEntry,
    handleSearchWorkspace,
    handleReplaceInWorkspace,
    handleAfterWorkspaceGrepReplace,
    handleOpenFileAtLine,
  };
}
