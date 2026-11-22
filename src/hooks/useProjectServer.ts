import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  EditorSettings,
  ProjectInfo,
  ProjectServerStatus,
  ProjectSetupProgress,
} from '../types';
import type { Translations } from '../i18n/types';
import type { ProjectSetupActionParams } from '../components/ProjectSetupCard';
import { extractPortFromUrl } from '../components/ProjectPortInput';
import { isTargetCurrentlyActive } from '../components/ProjectTargetControls';
import {
  assistProjectSetup,
  findFreeProjectPort,
  getProjectDevServerStatus,
  inspectProjectForPath,
  inspectWorkspaceProject,
  isTauri,
  startProjectDevServer,
  stopProjectDevServer,
} from '../utils/platform';

function loadRecordFromStorage(key: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, string>;
      }
    }
  } catch {
    // ignore storage errors
  }
  return {};
}

export interface UseProjectServerOptions {
  t: Translations;
  workspaceRoot: string | null;
  activeFilePath?: string;
  settings: EditorSettings;
  setSettings: React.Dispatch<React.SetStateAction<EditorSettings>>;
  onOpenProjectUrl: (url: string, target: 'builtin' | 'external') => Promise<void> | void;
  notify: (msg: string) => void;
  formatErrorMessage: (err: unknown) => string;
}

export function useProjectServer({
  t,
  workspaceRoot,
  activeFilePath,
  settings,
  setSettings,
  onOpenProjectUrl,
  notify,
  formatErrorMessage,
}: UseProjectServerOptions) {
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [projectServer, setProjectServer] = useState<ProjectServerStatus | null>(null);
  const [projectPortOverrides, setProjectPortOverrides] = useState<Record<string, string>>(() =>
    loadRecordFromStorage('onigiri-markdown.projectPortOverrides')
  );
  const [projectSelectedTargets, setProjectSelectedTargets] = useState<Record<string, string>>(() =>
    loadRecordFromStorage('onigiri-markdown.projectSelectedTargets')
  );
  const [projectSelectedScripts, setProjectSelectedScripts] = useState<Record<string, string>>(() =>
    loadRecordFromStorage('onigiri-markdown.projectSelectedScripts')
  );
  const [projectSetupBusy, setProjectSetupBusy] = useState(false);
  const [projectSetupActionId, setProjectSetupActionId] = useState<string | null>(null);
  const [projectSetupLogs, setProjectSetupLogs] = useState<string[]>([]);
  const [projectSetupFeedback, setProjectSetupFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [projectRechecking, setProjectRechecking] = useState(false);

  const pendingBrowseTargetRef = useRef<'builtin' | 'external' | null>(null);
  const notifiedPortMismatchRef = useRef<string | null>(null);

  const openProjectUrlRef = useRef(onOpenProjectUrl);
  openProjectUrlRef.current = onOpenProjectUrl;

  const activeProjectPortKey = projectInfo?.rootPath || workspaceRoot || '';
  const activeProjectCustomPort = activeProjectPortKey
    ? (projectPortOverrides[activeProjectPortKey] ?? '')
    : '';

  const handleChangeProjectCustomPort = useCallback(
    (nextPort: string) => {
      const key = projectInfo?.rootPath || workspaceRoot;
      if (!key) return;
      const sanitized = nextPort.replace(/[^\d]/g, '').slice(0, 5);
      setProjectPortOverrides((prev) => {
        const next = { ...prev };
        if (sanitized) {
          next[key] = sanitized;
        } else {
          delete next[key];
        }
        try {
          localStorage.setItem('onigiri-markdown.projectPortOverrides', JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [projectInfo?.rootPath, workspaceRoot]
  );

  const refreshProjectInfo = useCallback(
    async (
      overrideTargetRoot?: string | null,
      overrideScript?: string | null
    ): Promise<ProjectInfo | null> => {
      if (!isTauri()) {
        setProjectInfo(null);
        return null;
      }
      let info: ProjectInfo | null = null;
      if (workspaceRoot) {
        const chosenTarget =
          overrideTargetRoot !== undefined
            ? overrideTargetRoot
            : (projectSelectedTargets[workspaceRoot] ?? null);
        const scriptKey = chosenTarget || projectInfo?.rootPath || workspaceRoot;
        const chosenScript =
          overrideScript !== undefined
            ? overrideScript
            : (projectSelectedScripts[scriptKey] ?? null);
        info = await inspectWorkspaceProject(workspaceRoot, chosenTarget, chosenScript);
      } else if (activeFilePath && /[/\\]/.test(activeFilePath)) {
        const scriptKey = projectInfo?.rootPath || '';
        const chosenScript =
          overrideScript !== undefined
            ? overrideScript
            : (scriptKey ? (projectSelectedScripts[scriptKey] ?? null) : null);
        info = await inspectProjectForPath(activeFilePath, chosenScript);
      }
      setProjectInfo(info);
      if (info?.alreadyRunning && info.defaultUrl) {
        setProjectServer((prev) => {
          if (prev?.running && prev.rootPath === info.rootPath) return prev;
          if (prev?.running && !prev.external) return prev;
          return {
            running: true,
            starting: false,
            external: true,
            allowLan: false,
            lanUrls: [],
            rootPath: info.rootPath,
            kind: info.kind,
            url: info.defaultUrl,
            commandLabel: info.devCommandLabel,
            requestedPort: null,
            requestedScript: info.devScript ?? null,
            logs: [`Connected to already-running server at ${info.defaultUrl}`],
            error: null,
          };
        });
      }
      return info;
    },
    [
      workspaceRoot,
      activeFilePath,
      projectInfo?.rootPath,
      projectSelectedTargets,
      projectSelectedScripts,
    ]
  );

  // Inspect project structure from workspace folder or active file path
  useEffect(() => {
    if (!isTauri()) {
      setProjectInfo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      let info: ProjectInfo | null = null;
      if (workspaceRoot) {
        const chosenTarget = projectSelectedTargets[workspaceRoot] ?? null;
        const chosenScript = chosenTarget ? (projectSelectedScripts[chosenTarget] ?? null) : null;
        info = await inspectWorkspaceProject(workspaceRoot, chosenTarget, chosenScript);
      } else if (activeFilePath && /[/\\]/.test(activeFilePath)) {
        info = await inspectProjectForPath(activeFilePath, null);
      }
      if (!cancelled) {
        setProjectInfo(info);
        if (info?.alreadyRunning && info.defaultUrl) {
          setProjectServer((prev) => {
            if (prev?.running && prev.rootPath === info.rootPath) return prev;
            if (prev?.running && !prev.external) return prev;
            return {
              running: true,
              starting: false,
              external: true,
              allowLan: false,
              lanUrls: [],
              rootPath: info.rootPath,
              kind: info.kind,
              url: info.defaultUrl,
              commandLabel: info.devCommandLabel,
              requestedPort: null,
              requestedScript: info.devScript ?? null,
              logs: [`Connected to already-running server at ${info.defaultUrl}`],
              error: null,
            };
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceRoot, activeFilePath, projectSelectedTargets, projectSelectedScripts]);

  const handleSelectTargetRoot = useCallback(
    async (nextTargetRoot: string) => {
      if (workspaceRoot) {
        setProjectSelectedTargets((prev) => {
          const next = { ...prev, [workspaceRoot]: nextTargetRoot };
          try {
            localStorage.setItem('onigiri-markdown.projectSelectedTargets', JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
      }
      await refreshProjectInfo(nextTargetRoot, projectSelectedScripts[nextTargetRoot] ?? null);
    },
    [workspaceRoot, projectSelectedScripts, refreshProjectInfo]
  );

  const handleSelectScript = useCallback(
    async (nextScript: string) => {
      const targetRoot = projectInfo?.rootPath || workspaceRoot;
      if (targetRoot) {
        setProjectSelectedScripts((prev) => {
          const next = { ...prev, [targetRoot]: nextScript };
          try {
            localStorage.setItem('onigiri-markdown.projectSelectedScripts', JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
      }
      await refreshProjectInfo(targetRoot ?? null, nextScript);
    },
    [projectInfo?.rootPath, workspaceRoot, refreshProjectInfo]
  );

  useEffect(() => {
    setProjectSetupLogs([]);
    setProjectSetupFeedback(null);
    setProjectSetupActionId(null);
  }, [projectInfo?.rootPath]);

  const handleRefreshProjectInfo = useCallback(async () => {
    setProjectRechecking(true);
    try {
      const info = await refreshProjectInfo();
      if (!info?.diagnostics || info.diagnostics.length === 0) {
        setProjectSetupLogs([]);
        setProjectSetupFeedback(null);
      }
    } finally {
      setProjectRechecking(false);
    }
  }, [refreshProjectInfo]);

  const maybeNotifyPortMismatch = useCallback(
    (st: ProjectServerStatus | null | undefined) => {
      if (!st?.running) {
        notifiedPortMismatchRef.current = null;
        return;
      }
      if (!st.url || !st.requestedPort) return;
      const actualPort = extractPortFromUrl(st.url);
      if (!actualPort || Number(actualPort) === st.requestedPort) return;
      const key = `${st.url}:${st.requestedPort}`;
      if (notifiedPortMismatchRef.current === key) return;
      notifiedPortMismatchRef.current = key;
      notify(
        t.project.portMismatchNotice
          .replace('{requested}', String(st.requestedPort))
          .replace('{actual}', actualPort)
      );
    },
    [notify, t.project.portMismatchNotice]
  );
  const maybeNotifyPortMismatchRef = useRef(maybeNotifyPortMismatch);
  maybeNotifyPortMismatchRef.current = maybeNotifyPortMismatch;

  // Listen to project dev server status updates
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;
    (async () => {
      try {
        const initial = await getProjectDevServerStatus();
        if (initial) setProjectServer(initial);
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<ProjectServerStatus>('project-server-update', (ev) => {
          const st = ev.payload;
          setProjectServer(st);
          maybeNotifyPortMismatchRef.current(st);
          if (st?.url && pendingBrowseTargetRef.current) {
            const target = pendingBrowseTargetRef.current;
            pendingBrowseTargetRef.current = null;
            void openProjectUrlRef.current(st.url, target);
            notify(t.toasts.devServerStarted);
          } else if (st?.error && pendingBrowseTargetRef.current) {
            pendingBrowseTargetRef.current = null;
            notify(`${t.toasts.errorPrefix} ${st.error}`);
          }
        });
      } catch {
        // ignore
      }
    })();
    return () => {
      unlisten?.();
    };
  }, [notify, t.toasts.devServerStarted, t.toasts.errorPrefix]);

  // Listen to project setup streaming logs
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;
    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<ProjectSetupProgress>('project-setup-progress', (ev) => {
          const p = ev.payload;
          if (!p) return;
          if (p.line) {
            setProjectSetupLogs((prev) => [...prev.slice(-150), p.line!]);
          }
          if (p.done) {
            setProjectSetupBusy(false);
            setProjectSetupActionId(null);
            if (p.message) {
              setProjectSetupFeedback({ ok: Boolean(p.ok), text: p.message });
            }
          }
        });
      } catch {
        // ignore
      }
    })();
    return () => {
      unlisten?.();
    };
  }, []);

  const handleAssistProjectSetup = useCallback(
    async (params: ProjectSetupActionParams) => {
      if (params.action === 'open-url') {
        try {
          await assistProjectSetup(params);
        } catch (err) {
          notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
        }
        return;
      }

      setProjectSetupBusy(true);
      setProjectSetupActionId(`${params.diagId || params.action}:${params.action}`);
      setProjectSetupLogs([]);
      setProjectSetupFeedback(null);

      try {
        const res = await assistProjectSetup(params);
        if (res.output && res.output.length > 0) {
          setProjectSetupLogs((prev) => (prev.length > 0 ? prev : res.output));
        }
        setProjectSetupFeedback({ ok: res.ok, text: res.message });
        if (res.ok) {
          notify(res.message);
          if (params.action !== 'run-terminal-command') {
            const updated = await refreshProjectInfo();
            if (!updated?.diagnostics || updated.diagnostics.length === 0) {
              setProjectSetupLogs([]);
              setProjectSetupFeedback(null);
            }
          }
          if (params.action === 'launch-docker') {
            window.setTimeout(() => {
              void refreshProjectInfo();
            }, 3000);
          }
        }
      } catch (err) {
        const msg = formatErrorMessage(err);
        setProjectSetupFeedback({ ok: false, text: msg });
        notify(`${t.toasts.errorPrefix} ${msg}`);
      } finally {
        setProjectSetupBusy(false);
        setProjectSetupActionId(null);
      }
    },
    [formatErrorMessage, notify, refreshProjectInfo, t.toasts.errorPrefix]
  );

  const resolveRequestedPort = useCallback(
    (rootPath: string): { valid: boolean; port: number | null } => {
      const raw = (projectPortOverrides[rootPath] ?? '').trim();
      if (!raw) return { valid: true, port: null };
      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
        return { valid: false, port: null };
      }
      return { valid: true, port: parsed };
    },
    [projectPortOverrides]
  );

  const handleStartProjectAndBrowse = useCallback(
    async (
      target: 'builtin' | 'external',
      explicitPort?: number | null,
      explicitTargetRoot?: string | null
    ) => {
      const root = explicitTargetRoot || projectInfo?.rootPath || workspaceRoot;
      if (!root) return;
      if (explicitTargetRoot && explicitTargetRoot !== projectInfo?.rootPath) {
        void handleSelectTargetRoot(explicitTargetRoot);
      }
      if (projectServer?.starting && projectServer.rootPath === root) {
        pendingBrowseTargetRef.current = target;
        return;
      }
      if (explicitPort === undefined) {
        const existingTarget = projectServer?.runningTargets?.find(
          (rt) => rt.rootPath === root && !rt.starting && rt.url
        );
        if (existingTarget?.url) {
          await openProjectUrlRef.current(existingTarget.url, target);
          return;
        }
        if (projectServer?.running && projectServer.rootPath === root && projectServer.url) {
          await openProjectUrlRef.current(projectServer.url, target);
          return;
        }
      }
      const { valid, port: storedPort } = resolveRequestedPort(root);
      if (explicitPort === undefined && !valid) {
        notify(`${t.toasts.errorPrefix} ${t.project.invalidPortError}`);
        return;
      }
      const requestedPort = explicitPort !== undefined ? explicitPort : storedPort;
      const matchedTarget = projectInfo?.targets?.find((tgt) => tgt.rootPath === root);
      const chosenScript =
        projectSelectedScripts[root] ??
        (root === projectInfo?.rootPath ? projectInfo?.devScript : matchedTarget?.devScript) ??
        undefined;
      try {
        pendingBrowseTargetRef.current = target;
        const st = await startProjectDevServer(
          root,
          chosenScript,
          settings.projectServerAllowLan,
          requestedPort
        );
        setProjectServer(st);
        maybeNotifyPortMismatch(st);
        if (st.url && pendingBrowseTargetRef.current) {
          const dest = pendingBrowseTargetRef.current;
          pendingBrowseTargetRef.current = null;
          await openProjectUrlRef.current(st.url, dest);
          notify(t.toasts.devServerStarted);
        }
      } catch (err) {
        pendingBrowseTargetRef.current = null;
        const msg = formatErrorMessage(err);
        setProjectServer((prev) => ({
          running: false,
          starting: false,
          external: false,
          allowLan: settings.projectServerAllowLan,
          lanUrls: [],
          rootPath: root,
          kind: matchedTarget?.kind ?? projectInfo?.kind ?? prev?.kind ?? null,
          url: null,
          commandLabel: projectInfo?.devCommandLabel ?? prev?.commandLabel ?? null,
          requestedPort: requestedPort ?? null,
          logs: prev?.rootPath === root && prev.logs.length > 0 ? prev.logs : [msg],
          error: msg,
          runningTargets: prev?.runningTargets?.filter((rt) => rt.rootPath !== root),
        }));
        notify(`${t.toasts.errorPrefix} ${msg}`);
      }
    },
    [
      formatErrorMessage,
      handleSelectTargetRoot,
      maybeNotifyPortMismatch,
      notify,
      projectInfo,
      projectSelectedScripts,
      projectServer,
      resolveRequestedPort,
      settings.projectServerAllowLan,
      t.project.invalidPortError,
      t.toasts.devServerStarted,
      t.toasts.errorPrefix,
      workspaceRoot,
    ]
  );

  // One-click restart of a specific (or active) project dev server
  const handleRestartProjectServer = useCallback(
    async (targetRoot?: string) => {
      const root = targetRoot || projectInfo?.rootPath || projectServer?.rootPath || workspaceRoot;
      if (!root) return;
      const { valid, port: storedPort } = resolveRequestedPort(root);
      if (!valid) {
        notify(`${t.toasts.errorPrefix} ${t.project.invalidPortError}`);
        return;
      }
      const matchedTarget = projectInfo?.targets?.find((tgt) => tgt.rootPath === root);
      const chosenScript =
        projectSelectedScripts[root] ??
        (root === projectInfo?.rootPath ? projectInfo?.devScript : matchedTarget?.devScript) ??
        undefined;
      try {
        pendingBrowseTargetRef.current = null;
        await stopProjectDevServer(root);
        const st = await startProjectDevServer(
          root,
          chosenScript,
          settings.projectServerAllowLan,
          storedPort
        );
        setProjectServer(st);
        maybeNotifyPortMismatch(st);
        const restartedUrl =
          st.runningTargets?.find((rt) => rt.rootPath === root)?.url || st.url;
        if (restartedUrl && root === projectInfo?.rootPath) {
          await openProjectUrlRef.current(restartedUrl, 'builtin');
        }
        notify(t.toasts.devServerStarted);
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
      }
    },
    [
      formatErrorMessage,
      maybeNotifyPortMismatch,
      notify,
      projectInfo,
      projectSelectedScripts,
      projectServer?.rootPath,
      resolveRequestedPort,
      settings.projectServerAllowLan,
      t.project.invalidPortError,
      t.toasts.devServerStarted,
      t.toasts.errorPrefix,
      workspaceRoot,
    ]
  );

  // Monorepo batch start all targets
  const handleStartAllProjectTargets = useCallback(async () => {
    const targets = projectInfo?.targets || [];
    if (targets.length === 0) {
      await handleStartProjectAndBrowse('builtin');
      return;
    }
    let firstUrl: string | null = null;
    for (const tgt of targets) {
      if (isTargetCurrentlyActive(tgt.rootPath, projectServer)) continue;
      const chosenScript = projectSelectedScripts[tgt.rootPath] ?? tgt.devScript ?? undefined;
      const { valid, port } = resolveRequestedPort(tgt.rootPath);
      try {
        const st = await startProjectDevServer(
          tgt.rootPath,
          chosenScript,
          settings.projectServerAllowLan,
          valid ? port : null
        );
        setProjectServer(st);
        if (!firstUrl && st.url) firstUrl = st.url;
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${tgt.label}: ${formatErrorMessage(err)}`);
      }
    }
    if (firstUrl) {
      await openProjectUrlRef.current(firstUrl, 'builtin');
      notify(t.toasts.devServerStarted);
    }
  }, [
    formatErrorMessage,
    handleStartProjectAndBrowse,
    notify,
    projectInfo?.targets,
    projectSelectedScripts,
    projectServer,
    resolveRequestedPort,
    settings.projectServerAllowLan,
    t.toasts.devServerStarted,
    t.toasts.errorPrefix,
  ]);

  const handleStopProjectServer = useCallback(
    async (targetRoot?: string) => {
      try {
        pendingBrowseTargetRef.current = null;
        const st = await stopProjectDevServer(targetRoot);
        setProjectServer(st);
        notify(t.toasts.devServerStopped);
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
      }
    },
    [formatErrorMessage, notify, t.toasts.devServerStopped, t.toasts.errorPrefix]
  );

  const handleStopAllProjectTargets = useCallback(async () => {
    await handleStopProjectServer(undefined);
  }, [handleStopProjectServer]);

  // Port conflict auto-retry on free port
  const handleRetryWithFreePort = useCallback(
    async (conflictPort: number) => {
      const root = projectInfo?.rootPath || workspaceRoot;
      if (!root) return;
      try {
        const freePort = await findFreeProjectPort(Math.min(65534, conflictPort + 1));
        handleChangeProjectCustomPort(String(freePort));
        await handleStartProjectAndBrowse('builtin', freePort);
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
      }
    },
    [
      formatErrorMessage,
      handleChangeProjectCustomPort,
      handleStartProjectAndBrowse,
      notify,
      projectInfo?.rootPath,
      t.toasts.errorPrefix,
      workspaceRoot,
    ]
  );

  const handleToggleProjectServerLan = useCallback(() => {
    setSettings((s) => ({
      ...s,
      projectServerAllowLan: !s.projectServerAllowLan,
    }));
  }, [setSettings]);

  // Rebind/restart project dev server cleanly when LAN access setting changes while running
  const lastProjectLanRef = useRef(settings.projectServerAllowLan);
  useEffect(() => {
    const prev = lastProjectLanRef.current;
    lastProjectLanRef.current = settings.projectServerAllowLan;
    if (prev === settings.projectServerAllowLan || !isTauri()) return;
    if (!projectServer?.running || !projectServer.rootPath) {
      notify(
        settings.projectServerAllowLan
          ? t.toasts.devServerLanEnabled
          : t.toasts.devServerLanDisabled
      );
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const scriptArg =
          projectInfo?.rootPath === projectServer.rootPath ? projectInfo.devScript : undefined;
        const { valid, port: requestedPort } = resolveRequestedPort(projectServer.rootPath!);
        const st = await startProjectDevServer(
          projectServer.rootPath!,
          scriptArg,
          settings.projectServerAllowLan,
          valid ? requestedPort : null
        );
        if (!cancelled) {
          setProjectServer(st);
          if (settings.projectServerAllowLan) {
            if (st.lanUrls && st.lanUrls.length > 0) {
              notify(`${t.toasts.devServerLanEnabled}: ${st.lanUrls[0]}`);
            } else if (st.external) {
              notify(t.project.externalLanUnavailableHint);
            } else {
              notify(t.toasts.devServerLanEnabled);
            }
          } else {
            notify(t.toasts.devServerLanDisabled);
          }
        }
      } catch (err) {
        if (!cancelled) {
          const msg = formatErrorMessage(err);
          const failedRoot = projectServer.rootPath ?? null;
          setProjectServer((prevState) =>
            prevState
              ? {
                  ...prevState,
                  running: false,
                  starting: false,
                  external: false,
                  lanUrls: [],
                  url: null,
                  error: msg,
                  logs: prevState.logs.length > 0 ? prevState.logs : [msg],
                }
              : {
                  running: false,
                  starting: false,
                  external: false,
                  allowLan: settings.projectServerAllowLan,
                  lanUrls: [],
                  rootPath: failedRoot,
                  kind: projectInfo?.kind ?? null,
                  url: null,
                  commandLabel: projectInfo?.devCommandLabel ?? null,
                  logs: [msg],
                  error: msg,
                }
          );
          notify(`${t.toasts.errorPrefix} ${msg}`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    formatErrorMessage,
    notify,
    projectInfo?.devCommandLabel,
    projectInfo?.devScript,
    projectInfo?.kind,
    projectInfo?.rootPath,
    projectServer?.rootPath,
    projectServer?.running,
    resolveRequestedPort,
    settings.projectServerAllowLan,
    t.project.externalLanUnavailableHint,
    t.toasts.devServerLanDisabled,
    t.toasts.devServerLanEnabled,
    t.toasts.errorPrefix,
  ]);

  const clearProjectSetupState = useCallback(() => {
    setProjectSetupLogs([]);
    setProjectSetupFeedback(null);
    setProjectSetupActionId(null);
  }, []);

  const clearPendingBrowseTarget = useCallback(() => {
    pendingBrowseTargetRef.current = null;
  }, []);

  return {
    projectInfo,
    setProjectInfo,
    projectServer,
    setProjectServer,
    activeProjectCustomPort,
    projectSetupBusy,
    projectSetupActionId,
    projectSetupLogs,
    projectSetupFeedback,
    projectRechecking,
    clearProjectSetupState,
    clearPendingBrowseTarget,
    handleChangeProjectCustomPort,
    handleSelectTargetRoot,
    handleSelectScript,
    handleRefreshProjectInfo,
    handleAssistProjectSetup,
    handleStartProjectAndBrowse,
    handleRestartProjectServer,
    handleStartAllProjectTargets,
    handleStopProjectServer,
    handleStopAllProjectTargets,
    handleRetryWithFreePort,
    handleToggleProjectServerLan,
  };
}
