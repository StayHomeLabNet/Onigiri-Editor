import React, { useEffect, useMemo, useState } from 'react';
import {
  ExternalLink,
  Eye,
  FileCode2,
  FolderTree,
  GitCompare,
  Globe,
  X,
} from 'lucide-react';
import type { Translations } from '../../i18n/types';
import type {
  EditorSettings,
  Locale,
  ProjectInfo,
  ProjectServerStatus,
  TextEncodingId,
  ThemeId,
  TurnChangedFile,
  WorkspaceEntry,
} from '../../types';
import { getDocumentPreviewKind } from '../../utils/markdown';
import { readFileByPath, saveMarkdownFile } from '../../utils/platform';
import { CodePreviewPane } from '../CodePreviewPane';
import { DataPreviewPane } from '../DataPreviewPane';
import { PreviewPane } from '../PreviewPane';
import { DiffPreviewPane } from '../previews/DiffPreviewPane';
import { RightBrowserPane } from '../RightBrowserPane';

export type WorkbenchTabId = 'diff' | 'preview' | 'files' | 'browser';

interface HarnessWorkbenchPaneProps {
  t: Translations;
  locale: Locale;
  theme: ThemeId;
  settings: EditorSettings;
  widthPercent: number;
  activeTab: WorkbenchTabId;
  onTabChange: (tab: WorkbenchTabId) => void;
  onClose: () => void;
  workspaceRoot: string | null;
  workspaceEntries: WorkspaceEntry[];
  inspectedFilePath: string | null;
  onSelectFilePath: (filePath: string) => void;
  inspectedDiff: TurnChangedFile | null;
  onOpenInEditor: (filePath: string) => void;
  browserUrl: string;
  onBrowserUrlChange: (url: string) => void;
  browserVisible: boolean;
  projectInfo?: ProjectInfo | null;
  projectServer?: ProjectServerStatus | null;
  onNotify: (msg: string) => void;
}

export const HarnessWorkbenchPane: React.FC<HarnessWorkbenchPaneProps> = ({
  t,
  locale,
  theme,
  settings,
  widthPercent,
  activeTab,
  onTabChange,
  onClose,
  workspaceRoot,
  workspaceEntries,
  inspectedFilePath,
  onSelectFilePath,
  inspectedDiff,
  onOpenInEditor,
  browserUrl,
  onBrowserUrlChange,
  browserVisible,
  projectInfo,
  projectServer,
  onNotify,
}) => {
  const [fileContent, setFileContent] = useState<string>('');
  const [fileEncoding, setFileEncoding] = useState<TextEncodingId>('utf-8');
  const [fileEol, setFileEol] = useState<'\n' | '\r\n'>('\n');
  const [loadingFile, setLoadingFile] = useState(false);
  const [fileFilter, setFileFilter] = useState('');

  useEffect(() => {
    if (!inspectedFilePath || activeTab !== 'preview') return;
    let cancelled = false;
    setLoadingFile(true);
    void readFileByPath(inspectedFilePath)
      .then((opened) => {
        if (!cancelled) {
          setFileContent(opened.content);
          setFileEncoding(opened.encoding);
          setFileEol(opened.eol);
        }
      })
      .catch(() => {
        if (!cancelled) setFileContent('');
      })
      .finally(() => {
        if (!cancelled) setLoadingFile(false);
      });
    return () => {
      cancelled = true;
    };
  }, [inspectedFilePath, activeTab]);

  const filteredFiles = useMemo(() => {
    const q = fileFilter.trim().toLowerCase();
    const filesOnly = workspaceEntries.filter((e) => !e.isDir);
    if (!q) return filesOnly.slice(0, 250);
    return filesOnly
      .filter(
        (e) =>
          e.relativePath.toLowerCase().includes(q) ||
          e.name.toLowerCase().includes(q)
      )
      .slice(0, 250);
  }, [workspaceEntries, fileFilter]);

  const currentTargetFile =
    activeTab === 'diff'
      ? inspectedDiff?.path || inspectedFilePath
      : inspectedFilePath || inspectedDiff?.path || null;

  const fileName = currentTargetFile
    ? currentTargetFile.split(/[/\\]/).pop() || currentTargetFile
    : '';

  const previewKind = useMemo(
    () =>
      currentTargetFile
        ? getDocumentPreviewKind(fileName, currentTargetFile, null, fileContent)
        : 'markdown',
    [currentTargetFile, fileName, fileContent]
  );

  const handleSaveInlineEdit = async (nextContent: string) => {
    setFileContent(nextContent);
    if (inspectedFilePath) {
      try {
        const normalized =
          fileEol === '\r\n'
            ? nextContent.replace(/\r?\n/g, '\r\n')
            : nextContent.replace(/\r\n/g, '\n');
        await saveMarkdownFile(normalized, inspectedFilePath, fileName || 'Untitled.md', fileEncoding);
      } catch {
        // ignore transient write errors
      }
    }
  };

  return (
    <section
      className="harness-workbench"
      style={{ width: `${widthPercent}%` }}
    >
      <div className="harness-workbench-header">
        <div className="segmented-control">
          <button
            type="button"
            className={`seg-btn ${activeTab === 'diff' ? 'is-active' : ''}`}
            onClick={() => onTabChange('diff')}
          >
            <GitCompare size={13} />
            <span>{t.harness.tabDiff}</span>
          </button>
          <button
            type="button"
            className={`seg-btn ${activeTab === 'preview' ? 'is-active' : ''}`}
            onClick={() => onTabChange('preview')}
          >
            <Eye size={13} />
            <span>{t.harness.tabPreview}</span>
          </button>
          <button
            type="button"
            className={`seg-btn ${activeTab === 'files' ? 'is-active' : ''}`}
            onClick={() => onTabChange('files')}
          >
            <FolderTree size={13} />
            <span>{t.harness.tabFiles}</span>
          </button>
          <button
            type="button"
            className={`seg-btn ${activeTab === 'browser' ? 'is-active' : ''}`}
            onClick={() => onTabChange('browser')}
          >
            <Globe size={13} />
            <span>{t.harness.tabBrowser}</span>
          </button>
        </div>

        <button
          type="button"
          className="icon-btn"
          onClick={onClose}
          title={t.actions.close}
          aria-label={t.actions.close}
        >
          <X size={14} />
        </button>
      </div>

      {currentTargetFile && activeTab !== 'files' && activeTab !== 'browser' && (
        <div className="harness-workbench-subheader">
          <span
            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={currentTargetFile}
          >
            {fileName}
          </span>
          <button
            type="button"
            className="mini-pill-btn is-primary"
            onClick={() => onOpenInEditor(currentTargetFile)}
          >
            <ExternalLink size={11} />
            <span>{t.harness.openInEditorBtn}</span>
          </button>
        </div>
      )}

      <div className="harness-workbench-body">
        {activeTab === 'diff' && (
          inspectedDiff?.unifiedDiff ? (
            <DiffPreviewPane locale={locale} content={inspectedDiff.unifiedDiff} />
          ) : (
            <div style={{ padding: 24, fontSize: 12.5, color: 'var(--fg-secondary)', textAlign: 'center' }}>
              {t.harness.diffCardTitle}
            </div>
          )
        )}

        {activeTab === 'preview' && (
          !inspectedFilePath ? (
            <div style={{ padding: 24, fontSize: 12.5, color: 'var(--fg-secondary)', textAlign: 'center' }}>
              {t.harness.tabFiles}
            </div>
          ) : loadingFile ? (
            <div style={{ padding: 24, fontSize: 12.5, color: 'var(--fg-secondary)', textAlign: 'center' }}>
              Loading…
            </div>
          ) : previewKind === 'data' ? (
            <DataPreviewPane
              t={t}
              fileName={fileName}
              content={fileContent}
              activeLine={1}
              onUpdateContent={(next) => void handleSaveInlineEdit(next)}
              onCopyNotify={() => onNotify(t.toasts.copiedMarkdown)}
            />
          ) : previewKind === 'markdown' ? (
            <PreviewPane
              docId={`harness-${inspectedFilePath}`}
              markdown={fileContent}
              docPath={inspectedFilePath}
              workspaceRoot={workspaceRoot}
              theme={theme}
              settings={settings}
              onMarkdownChange={(next) => void handleSaveInlineEdit(next)}
              onCopyNotify={() => onNotify(t.toasts.copiedMarkdown)}
            />
          ) : (
            <CodePreviewPane
              t={t}
              locale={locale}
              fileName={fileName}
              content={fileContent}
              activeLine={1}
              settings={settings}
              onCopyNotify={() => onNotify(t.toasts.copiedMarkdown)}
            />
          )
        )}

        {activeTab === 'files' && (
          <div className="harness-files-pane">
            <input
              type="text"
              className="harness-files-filter"
              placeholder={t.sidebar.filterFiles}
              value={fileFilter}
              onChange={(e) => setFileFilter(e.target.value)}
            />
            <div>
              {filteredFiles.map((entry) => (
                <div
                  key={entry.path}
                  role="button"
                  tabIndex={0}
                  className="harness-files-row"
                  onClick={() => {
                    onSelectFilePath(entry.path);
                    onTabChange('preview');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onSelectFilePath(entry.path);
                      onTabChange('preview');
                    }
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <FileCode2 size={13} style={{ flexShrink: 0, color: 'var(--fg-muted)' }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.relativePath}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="mini-pill-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenInEditor(entry.path);
                    }}
                  >
                    {t.harness.editorLabel}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'browser' && (
          <RightBrowserPane
            t={t}
            locale={locale}
            url={browserUrl}
            homeUrl={settings.builtinBrowserDefaultUrl}
            onUrlChange={onBrowserUrlChange}
            visible={browserVisible && activeTab === 'browser'}
            projectInfo={projectInfo}
            projectServer={projectServer}
            projectServerAllowLan={settings.projectServerAllowLan}
          />
        )}
      </div>
    </section>
  );
};
