import React, { useMemo, useState } from 'react';
import {
  Bot,
  Sparkles,
  BarChart3,
  GitCompare,
  Tags,
  SlidersHorizontal,
  ClipboardPaste,
  ClipboardCopy,
  Code2,
  Camera,
  RotateCcw,
  Trash2,
  Plus,
  Settings,
  ListChecks,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { diffLines } from 'diff';
import type {
  AiCleanOptions,
  AiFolderMode,
  AiProviderConfig,
  DocumentStats,
  EditorSettings,
  InspectorTab,
  Locale,
  MarkdownCompatTarget,
  PreviewTheme,
  ReviewFinding,
  Snapshot,
  SnapshotKind,
  SyntaxPresetId,
  TextEncodingId,
  WrapMode,
} from '../types';
import type { Translations } from '../i18n/types';
import { extractFrontmatter, updateFrontmatter } from '../utils/markdown';
import { TEXT_ENCODINGS } from '../utils/encodings';
import { formatShortcut, sendAiChat } from '../utils/platform';
import { parseAiReviewFindings, runLocalDocumentReview } from '../utils/documentReview';
import {
  checkMarkdownCompatibility,
  convertSingleBreaksForStandardMarkdown,
} from '../utils/markdownCompat';
import { AiChatPanel } from './AiChatPanel';
import type { DiffPreviewRequest } from './AiDiffPreviewModal';

interface InspectorDrawerProps {
  t: Translations;
  locale?: Locale;
  activeTab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  markdown: string;
  activeDocTitle?: string;
  activeFilePath?: string;
  activeTabId?: string;
  savedContent: string;
  stats: DocumentStats;
  snapshots: Snapshot[];
  cleanOptions: AiCleanOptions;
  onCleanOptionsChange: (opts: AiCleanOptions) => void;
  onRunAiClean: () => void;
  onPasteHtmlAsMd: () => void;
  onCopyRichText: () => void;
  onCopyHtml: () => void;
  onCreateSnapshot: (label: string) => void;
  onRestoreSnapshot: (snap: Snapshot) => void;
  onDeleteSnapshot: (id: string) => void;
  onUpdateMarkdown: (next: string) => void;
  settings: EditorSettings;
  onSettingsChange: (next: EditorSettings) => void;
  aiConfig: AiProviderConfig;
  onAiConfigChange: (next: AiProviderConfig) => void;
  onInsertToEditor: (text: string) => void;
  onReplaceDocument: (text: string, createSnapshot?: boolean) => void;
  onCopyAiReply: (text: string) => void;
  onSaveChatAsNote?: (title: string, markdown: string) => void;
  workspaceRoot: string | null;
  workspaceFilePaths?: string[];
  onWorkspaceRefresh?: () => void;
  onFileWritten?: (relativePath: string) => void;
  onCliTurnComplete?: () => void;
  onRequestDiffPreview?: (req: DiffPreviewRequest) => void;
  onJumpToLine?: (line: number) => void;
  onApplyReviewFix?: (finding: ReviewFinding) => void;
  onOpenFullSettings: () => void;
}

export const InspectorDrawer: React.FC<InspectorDrawerProps> = ({
  t,
  locale = 'ja',
  activeTab,
  onTabChange,
  markdown,
  activeDocTitle,
  activeFilePath,
  activeTabId,
  savedContent,
  stats,
  snapshots,
  cleanOptions,
  onCleanOptionsChange,
  onRunAiClean,
  onPasteHtmlAsMd,
  onCopyRichText,
  onCopyHtml,
  onCreateSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  onUpdateMarkdown,
  settings,
  onSettingsChange,
  aiConfig,
  onAiConfigChange,
  onInsertToEditor,
  onReplaceDocument,
  onCopyAiReply,
  onSaveChatAsNote,
  workspaceRoot,
  workspaceFilePaths,
  onWorkspaceRefresh,
  onFileWritten,
  onCliTurnComplete,
  onRequestDiffPreview,
  onJumpToLine,
  onApplyReviewFix,
  onOpenFullSettings,
}) => {
  const [snapLabel, setSnapLabel] = useState('');
  const [compareId, setCompareId] = useState<string>('saved');
  const [newFmKey, setNewFmKey] = useState('');
  const [newFmVal, setNewFmVal] = useState('');
  const [reviewRefreshTick, setReviewRefreshTick] = useState(0);
  const [aiFindings, setAiFindings] = useState<ReviewFinding[]>([]);
  const [aiReviewBusy, setAiReviewBusy] = useState(false);
  const [aiReviewError, setAiReviewError] = useState<string | null>(null);

  const localFindings = useMemo(() => {
    if (activeTab !== 'review') return [];
    void reviewRefreshTick;
    return runLocalDocumentReview({
      markdown,
      filePath: activeFilePath,
      workspaceRoot,
      workspaceFilePaths,
      locale,
    });
  }, [activeTab, markdown, activeFilePath, workspaceRoot, workspaceFilePaths, locale, reviewRefreshTick]);

  const combinedFindings = useMemo(
    () => [...localFindings, ...aiFindings].sort((a, b) => a.line - b.line),
    [localFindings, aiFindings]
  );

  const handleRunAiReview = async () => {
    if (aiReviewBusy) return;
    setAiReviewBusy(true);
    setAiReviewError(null);
    const numberedDoc = markdown
      .split(/\r?\n/)
      .slice(0, 400)
      .map((line, i) => `${i + 1}: ${line}`)
      .join('\n');
    const systemPrompt =
      locale === 'ja'
        ? 'あなたは技術ドキュメント・文章の校正レビュアーです。誤字脱字、文法誤り、用語の不統一、曖昧な表現、論理の飛躍を見つけ、必ずJSON配列のみを返してください。各要素は {"line": 行番号(整数), "severity": "error"|"warning"|"info", "category": "typo"|"consistency"|"structure"|"ai", "title": "短い指摘タイトル", "detail": "具体的な改善提案", "original": "置換元の文字列(任意)", "replacement": "置換後の文字列(任意)"} の形式にしてください。問題がなければ [] を返してください。'
        : 'You are a meticulous technical proofreader. Identify typos, grammar errors, inconsistent terminology, or unclear phrasing. Return ONLY a JSON array of objects: [{"line": number, "severity": "error"|"warning"|"info", "category": "typo"|"consistency"|"structure"|"ai", "title": string, "detail": string, "original"?: string, "replacement"?: string}]. Return [] if none.';
    try {
      const res = await sendAiChat({
        requestId: `doc-review-${Date.now()}`,
        provider: aiConfig.provider,
        model: aiConfig.model.trim() || undefined,
        apiKey: aiConfig.apiKeys[aiConfig.provider],
        baseUrl: aiConfig.baseUrls[aiConfig.provider] || undefined,
        customCliCmd: aiConfig.customCliCmd,
        systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Document (${activeDocTitle || 'Untitled'}):\n\n${numberedDoc}`,
          },
        ],
        workspaceDir: workspaceRoot,
        allowWorkspaceWrite: false,
      });
      setAiFindings(parseAiReviewFindings(res.content));
    } catch (err) {
      setAiReviewError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiReviewBusy(false);
    }
  };

  const frontmatter = useMemo(() => extractFrontmatter(markdown), [markdown]);

  const compareSource = useMemo(() => {
    if (compareId === 'saved') return savedContent;
    const found = snapshots.find((s) => s.id === compareId);
    return found ? found.content : savedContent;
  }, [compareId, savedContent, snapshots]);

  const diffResult = useMemo(() => {
    if (activeTab !== 'diff') return { parts: [], additions: 0, deletions: 0 };
    const parts = diffLines(compareSource, markdown);
    let additions = 0;
    let deletions = 0;
    for (const p of parts) {
      if (p.added) additions += p.count || 0;
      if (p.removed) deletions += p.count || 0;
    }
    return { parts, additions, deletions };
  }, [activeTab, compareSource, markdown]);

  const handleRestoreDiffChunk = (partIndex: number) => {
    const parts = diffResult.parts;
    if (partIndex < 0 || partIndex >= parts.length) return;
    // Reconstruct markdown with this specific chunk reverted to its `compareSource` state:
    // - If part is `added` (present in current markdown only): omit it
    // - If part is `removed` (present in compareSource only): keep/restore it
    // - Otherwise keep parts that are already in current markdown (not `removed`)
    const nextText = parts
      .map((p, idx) => {
        if (idx === partIndex) {
          if (p.added) return '';
          if (p.removed) return p.value;
          return p.value;
        }
        return p.removed ? '' : p.value;
      })
      .join('');
    onUpdateMarkdown(nextText);
  };

  const compatTarget: MarkdownCompatTarget = settings.markdownCompatTarget ?? 'github';
  const compatIssues = useMemo(() => {
    if (activeTab !== 'review' || settings.markdownCompatCheckEnabled === false) return [];
    return checkMarkdownCompatibility(
      markdown,
      compatTarget,
      locale,
      settings.previewSingleLineBreak ?? true
    );
  }, [
    activeTab,
    markdown,
    compatTarget,
    locale,
    settings.markdownCompatCheckEnabled,
    settings.previewSingleLineBreak,
  ]);

  const getSnapshotKindBadge = (kind?: SnapshotKind): string => {
    const ja = locale === 'ja';
    switch (kind) {
      case 'auto':
        return ja ? '自動' : 'Auto';
      case 'ai-before':
        return ja ? 'AI前' : 'Pre-AI';
      case 'save-backup':
        return ja ? '保存前' : 'Pre-Save';
      default:
        return ja ? '手動' : 'Manual';
    }
  };

  const goalMetric = stats.words;
  const goalPct =
    settings.wordGoal > 0 ? Math.min(100, Math.round((goalMetric / settings.wordGoal) * 100)) : 0;

  const handleFmValueChange = (key: string, val: string) => {
    if (!frontmatter.data) return;
    const nextData = { ...frontmatter.data };
    if (val.startsWith('[') && val.endsWith(']')) {
      nextData[key] = val
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      nextData[key] = val;
    }
    onUpdateMarkdown(updateFrontmatter(markdown, nextData));
  };

  const handleFmDelete = (key: string) => {
    if (!frontmatter.data) return;
    const nextData = { ...frontmatter.data };
    delete nextData[key];
    onUpdateMarkdown(updateFrontmatter(markdown, nextData));
  };

  const handleAddFmField = () => {
    if (!newFmKey.trim()) return;
    const base = frontmatter.data ? { ...frontmatter.data } : {};
    base[newFmKey.trim()] = newFmVal.trim();
    onUpdateMarkdown(updateFrontmatter(markdown, base));
    setNewFmKey('');
    setNewFmVal('');
  };

  const tabStyle = settings.inspectorTabStyle ?? 'icons';
  const inspectorTabDefs: Array<{
    key: InspectorTab;
    label: string;
    icon: React.ReactNode;
  }> = [
    { key: 'chat', label: t.inspector.chat, icon: <Bot size={15} /> },
    { key: 'ai', label: t.inspector.ai, icon: <Sparkles size={15} /> },
    { key: 'stats', label: t.inspector.stats, icon: <BarChart3 size={15} /> },
    { key: 'diff', label: t.inspector.diff, icon: <GitCompare size={15} /> },
    { key: 'frontmatter', label: t.inspector.frontmatter, icon: <Tags size={15} /> },
    { key: 'review', label: t.inspector.review, icon: <ListChecks size={15} /> },
    { key: 'settings', label: t.inspector.settings, icon: <SlidersHorizontal size={15} /> },
  ];

  return (
    <aside className="inspector">
      <div className={`inspector-tabs is-style-${tabStyle}`} role="tablist">
        {inspectorTabDefs.map((tab) => {
          const isActive = activeTab === tab.key;
          const showLabel =
            tabStyle === 'labels' || (tabStyle === 'active-label' && isActive);
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={tab.label}
              className={`ins-tab-btn ${isActive ? 'is-active' : ''} ${
                showLabel ? 'has-label' : 'is-icon-only'
              }`}
              onClick={() => onTabChange(tab.key)}
              title={tab.label}
            >
              {tab.icon}
              {showLabel && <span className="ins-tab-label">{tab.label}</span>}
            </button>
          );
        })}
      </div>

      <div className={`inspector-body ${activeTab === 'chat' ? 'is-chat' : ''}`}>
        {activeTab === 'chat' && (
          <AiChatPanel
            t={t}
            markdown={markdown}
            activeDocTitle={activeDocTitle}
            activeTabId={activeTabId}
            config={aiConfig}
            onConfigChange={onAiConfigChange}
            onInsertToEditor={onInsertToEditor}
            onReplaceDocument={onReplaceDocument}
            onCopyReply={onCopyAiReply}
            onSaveChatAsNote={onSaveChatAsNote}
            workspaceRoot={workspaceRoot}
            aiFolderMode={settings.aiFolderMode}
            onAiFolderModeChange={(nextMode) =>
              onSettingsChange({ ...settings, aiFolderMode: nextMode })
            }
            onWorkspaceRefresh={onWorkspaceRefresh}
            onFileWritten={onFileWritten}
            onCliTurnComplete={onCliTurnComplete}
            onRequestDiffPreview={onRequestDiffPreview}
          />
        )}

        {activeTab === 'ai' && (
          <div className="ins-panel">
            <h4 className="ins-title">{t.inspector.aiCleanerTitle}</h4>
            <p className="ins-desc">{t.inspector.aiCleanerDesc}</p>

            <div className="check-list">
              {(Object.keys(t.inspector.cleanOpts) as Array<keyof AiCleanOptions>).map((key) => (
                <label key={key} className="check-row">
                  <input
                    type="checkbox"
                    checked={cleanOptions[key]}
                    onChange={(e) =>
                      onCleanOptionsChange({ ...cleanOptions, [key]: e.target.checked })
                    }
                  />
                  <span>{t.inspector.cleanOpts[key]}</span>
                </label>
              ))}
            </div>

            <button type="button" className="primary-btn full-w" onClick={onRunAiClean}>
              <Sparkles size={14} />
              <span>{t.inspector.runAiClean}</span>
            </button>

            <div className="ins-divider" />

            <div className="action-stack">
              <button type="button" className="secondary-btn" onClick={onPasteHtmlAsMd}>
                <ClipboardPaste size={14} />
                <span>{t.inspector.pasteHtmlBtn}</span>
              </button>
              <button type="button" className="secondary-btn" onClick={onCopyRichText}>
                <ClipboardCopy size={14} />
                <span>{t.inspector.copyRichTextBtn}</span>
              </button>
              <button type="button" className="secondary-btn" onClick={onCopyHtml}>
                <Code2 size={14} />
                <span>{t.inspector.copyHtmlBtn}</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="ins-panel">
            <div className="token-highlight-card">
              <div className="token-label">{t.inspector.statsLabels.estimatedTokens}</div>
              <div className="token-value">~{stats.estimatedTokens.toLocaleString()}</div>
              <div className="token-note">{t.inspector.statsLabels.tokenNote}</div>
            </div>

            {settings.wordGoal > 0 && (
              <div className="goal-card">
                <div className="goal-head">
                  <span>{t.inspector.statsLabels.goalProgress}</span>
                  <span>
                    {goalMetric.toLocaleString()} / {settings.wordGoal.toLocaleString()} ({goalPct}%)
                  </span>
                </div>
                <div className="goal-bar">
                  <div className="goal-fill" style={{ width: `${goalPct}%` }} />
                </div>
              </div>
            )}

            <div className="stats-grid">
              <div className="stat-box">
                <span className="stat-k">{t.inspector.statsLabels.words}</span>
                <span className="stat-v">{stats.words.toLocaleString()}</span>
              </div>
              <div className="stat-box">
                <span className="stat-k">{t.inspector.statsLabels.chars}</span>
                <span className="stat-v">{stats.chars.toLocaleString()}</span>
              </div>
              <div className="stat-box">
                <span className="stat-k">{t.inspector.statsLabels.charsNoSpaces}</span>
                <span className="stat-v">{stats.charsNoSpaces.toLocaleString()}</span>
              </div>
              <div className="stat-box">
                <span className="stat-k">{t.inspector.statsLabels.lines}</span>
                <span className="stat-v">{stats.lines.toLocaleString()}</span>
              </div>
              <div className="stat-box">
                <span className="stat-k">{t.inspector.statsLabels.paragraphs}</span>
                <span className="stat-v">{stats.paragraphs.toLocaleString()}</span>
              </div>
              <div className="stat-box">
                <span className="stat-k">{t.inspector.statsLabels.readingTime}</span>
                <span className="stat-v">
                  ~{stats.readingMinutes} {t.inspector.statsLabels.minuteUnit}
                </span>
              </div>
              <div className="stat-box">
                <span className="stat-k">{t.inspector.statsLabels.headings}</span>
                <span className="stat-v">{stats.headings}</span>
              </div>
              <div className="stat-box">
                <span className="stat-k">{t.inspector.statsLabels.codeBlocks}</span>
                <span className="stat-v">{stats.codeBlocks}</span>
              </div>
              <div className="stat-box">
                <span className="stat-k">{t.inspector.statsLabels.tables}</span>
                <span className="stat-v">{stats.tables}</span>
              </div>
              <div className="stat-box">
                <span className="stat-k">{t.inspector.statsLabels.links}</span>
                <span className="stat-v">{stats.links}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'diff' && (
          <div className="ins-panel">
            <div className="snap-create-row">
              <input
                type="text"
                className="text-input"
                value={snapLabel}
                onChange={(e) => setSnapLabel(e.target.value)}
                placeholder={t.inspector.diffLabels.snapshotLabelPlaceholder}
              />
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  onCreateSnapshot(snapLabel.trim() || new Date().toLocaleTimeString());
                  setSnapLabel('');
                }}
              >
                <Camera size={14} />
                <span>{t.inspector.diffLabels.createSnapshot}</span>
              </button>
            </div>

            {snapshots.length === 0 ? (
              <p className="muted-msg">{t.inspector.diffLabels.noSnapshots}</p>
            ) : (
              <div className="snapshot-list snapshot-timeline">
                {snapshots.map((s) => (
                  <div key={s.id} className="snapshot-item">
                    <div className="snap-meta">
                      <span className={`snap-kind-badge is-${s.kind ?? 'manual'}`}>
                        {getSnapshotKindBadge(s.kind)}
                      </span>
                      <span className="snap-label">{s.label}</span>
                      <span className="snap-time">
                        {new Date(s.timestamp).toLocaleTimeString()} · {s.content.length}c
                      </span>
                    </div>
                    <div className="snap-actions">
                      <button
                        type="button"
                        className="icon-btn-sm"
                        onClick={() => setCompareId(s.id)}
                        title={locale === 'ja' ? 'この履歴と差分を比較' : 'Compare diff with this snapshot'}
                      >
                        <GitCompare size={13} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn-sm"
                        onClick={() => onRestoreSnapshot(s)}
                        title={t.inspector.diffLabels.restore}
                      >
                        <RotateCcw size={13} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn-sm"
                        onClick={() => onDeleteSnapshot(s.id)}
                        title={t.inspector.diffLabels.delete}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="ins-divider" />

            <div className="field-row">
              <label>{t.inspector.diffLabels.compareTarget}</label>
              <select
                className="select-input"
                value={compareId}
                onChange={(e) => setCompareId(e.target.value)}
              >
                <option value="saved">{t.inspector.diffLabels.savedVersion}</option>
                {snapshots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({new Date(s.timestamp).toLocaleTimeString()})
                  </option>
                ))}
              </select>
            </div>

            <div className="diff-summary">
              <span className="diff-add">
                +{diffResult.additions} {t.inspector.diffLabels.additions}
              </span>
              <span className="diff-del">
                -{diffResult.deletions} {t.inspector.diffLabels.deletions}
              </span>
            </div>

            {diffResult.additions === 0 && diffResult.deletions === 0 ? (
              <p className="muted-msg">{t.inspector.diffLabels.identical}</p>
            ) : (
              <div className="diff-viewer">
                {diffResult.parts.map((part, idx) => {
                  const cls = part.added ? 'is-added' : part.removed ? 'is-removed' : 'is-same';
                  const canPartialRestore = Boolean(part.added || part.removed);
                  return (
                    <div key={idx} className={`diff-chunk-wrap ${cls}`}>
                      {canPartialRestore && (
                        <button
                          type="button"
                          className="diff-chunk-restore-btn"
                          onClick={() => handleRestoreDiffChunk(idx)}
                          title={
                            part.added
                              ? locale === 'ja'
                                ? 'この追加部分を取り消す'
                                : 'Revert this added chunk'
                              : locale === 'ja'
                                ? 'この削除された部分を復元する'
                                : 'Restore this removed chunk'
                          }
                        >
                          <RotateCcw size={10} />
                          <span>
                            {part.added
                              ? locale === 'ja'
                                ? '追加を取消'
                                : 'Undo'
                              : locale === 'ja'
                                ? '部分復元'
                                : 'Restore'}
                          </span>
                        </button>
                      )}
                      <pre className={`diff-chunk ${cls}`}>{part.value}</pre>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'frontmatter' && (
          <div className="ins-panel">
            <label className="check-row">
              <input
                type="checkbox"
                checked={settings.showFrontmatterCard}
                onChange={(e) =>
                  onSettingsChange({ ...settings, showFrontmatterCard: e.target.checked })
                }
              />
              <span>{t.inspector.frontmatterLabels.showCard}</span>
            </label>

            <div className="ins-divider" />

            {frontmatter.error ? (
              <div className="error-box">
                {t.inspector.frontmatterLabels.invalidYaml}: {frontmatter.error}
              </div>
            ) : !frontmatter.data ? (
              <div className="fm-empty">
                <p className="muted-msg">{t.inspector.frontmatterLabels.none}</p>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() =>
                    onUpdateMarkdown(
                      updateFrontmatter(markdown, {
                        title: 'Untitled',
                        date: new Date().toISOString().slice(0, 10),
                        tags: ['markdown'],
                      })
                    )
                  }
                >
                  <Plus size={14} />
                  <span>{t.inspector.frontmatterLabels.addFrontmatter}</span>
                </button>
              </div>
            ) : (
              <div className="fm-editor-list">
                {Object.entries(frontmatter.data).map(([k, v]) => (
                  <div key={k} className="fm-field-card">
                    <div className="fm-field-head">
                      <span>{k}</span>
                      <button
                        type="button"
                        className="icon-btn-sm"
                        onClick={() => handleFmDelete(k)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <input
                      type="text"
                      className="text-input"
                      value={Array.isArray(v) ? `[${v.join(', ')}]` : String(v ?? '')}
                      onChange={(e) => handleFmValueChange(k, e.target.value)}
                    />
                  </div>
                ))}

                <div className="fm-add-box">
                  <input
                    type="text"
                    className="text-input"
                    value={newFmKey}
                    onChange={(e) => setNewFmKey(e.target.value)}
                    placeholder={t.inspector.frontmatterLabels.key}
                  />
                  <input
                    type="text"
                    className="text-input"
                    value={newFmVal}
                    onChange={(e) => setNewFmVal(e.target.value)}
                    placeholder={t.inspector.frontmatterLabels.value}
                  />
                  <button type="button" className="secondary-btn" onClick={handleAddFmField}>
                    <Plus size={13} />
                    <span>{t.inspector.frontmatterLabels.addField}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'review' && (
          <div className="ins-panel">
            <h4 className="ins-title">{t.reviewPanel.title}</h4>
            <p className="ins-desc">{t.reviewPanel.desc}</p>

            <div className="review-actions-row">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setReviewRefreshTick((v) => v + 1)}
              >
                <ListChecks size={14} />
                <span>{t.reviewPanel.runLocalBtn}</span>
              </button>
              <button
                type="button"
                className="primary-btn"
                disabled={aiReviewBusy}
                onClick={handleRunAiReview}
              >
                {aiReviewBusy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
                <span>{aiReviewBusy ? t.reviewPanel.runningAiBtn : t.reviewPanel.runAiBtn}</span>
              </button>
            </div>

            {aiReviewError && <div className="error-box">{aiReviewError}</div>}

            {(settings.markdownCompatCheckEnabled ?? true) && (
              <div className="compat-check-box">
                <div className="compat-check-header">
                  <span className="sub-label">
                    {locale === 'ja' ? 'Markdown 互換性チェック' : 'Markdown Compatibility'}
                  </span>
                  <select
                    className="compat-target-select"
                    value={compatTarget}
                    onChange={(e) =>
                      onSettingsChange({
                        ...settings,
                        markdownCompatTarget: e.target.value as MarkdownCompatTarget,
                      })
                    }
                  >
                    <option value="github">GitHub (GFM)</option>
                    <option value="commonmark">CommonMark (標準)</option>
                    <option value="onigiri">Onigiri (拡張)</option>
                  </select>
                </div>

                {compatIssues.some((iss) => iss.code === 'single-line-break') && (
                  <button
                    type="button"
                    className="mini-pill-btn compat-fix-btn"
                    onClick={() => onUpdateMarkdown(convertSingleBreaksForStandardMarkdown(markdown))}
                  >
                    <Sparkles size={11} />
                    <span>
                      {locale === 'ja'
                        ? '単一改行を標準Markdown互換（行末2スペース）に変換'
                        : 'Convert single breaks to 2 trailing spaces'}
                    </span>
                  </button>
                )}

                {compatIssues.length === 0 ? (
                  <div className="compat-ok-msg">
                    <CheckCircle2 size={13} />
                    <span>
                      {locale === 'ja'
                        ? `${compatTarget === 'github' ? 'GitHub' : compatTarget === 'commonmark' ? 'CommonMark' : 'Onigiri'} との非互換記法はありません`
                        : `Compatible with ${compatTarget}`}
                    </span>
                  </div>
                ) : (
                  <div className="compat-issues-list">
                    {compatIssues.slice(0, 20).map((iss) => (
                      <div
                        key={iss.id}
                        className={`compat-issue-row is-${iss.severity}`}
                        onClick={() => onJumpToLine?.(iss.line)}
                      >
                        <span className="compat-issue-line">L{iss.line}</span>
                        <div className="compat-issue-body">
                          <div className="compat-issue-title">{iss.title}</div>
                          <div className="compat-issue-detail">{iss.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="review-summary-row">
              <span className="sub-label">
                {t.reviewPanel.countSummary.replace('{count}', String(combinedFindings.length))}
              </span>
              {aiFindings.length > 0 && (
                <button
                  type="button"
                  className="mini-pill-btn"
                  onClick={() => setAiFindings([])}
                >
                  AI Clear
                </button>
              )}
            </div>

            {combinedFindings.length === 0 ? (
              <div className="review-empty-state">
                <CheckCircle2 size={20} />
                <span>{t.reviewPanel.noFindings}</span>
              </div>
            ) : (
              <div className="review-findings-list">
                {combinedFindings.map((finding) => {
                  const SevIcon =
                    finding.severity === 'error'
                      ? AlertCircle
                      : finding.severity === 'warning'
                        ? AlertTriangle
                        : Info;
                  return (
                    <div key={finding.id} className={`review-finding-card is-${finding.severity}`}>
                      <div
                        className="review-finding-head"
                        onClick={() => onJumpToLine?.(finding.line)}
                        title={t.reviewPanel.jumpToLineTitle}
                      >
                        <SevIcon size={14} className={`review-sev-icon is-${finding.severity}`} />
                        <span className="review-finding-title">{finding.title}</span>
                        <span className="review-finding-line">L{finding.line}</span>
                      </div>
                      {finding.detail && <div className="review-finding-detail">{finding.detail}</div>}
                      <div className="review-finding-footer">
                        <span className="review-cat-pill">{finding.category}</span>
                        {finding.original && finding.replacement !== undefined && onApplyReviewFix && (
                          <button
                            type="button"
                            className="mini-pill-btn is-active"
                            onClick={() => {
                              onApplyReviewFix(finding);
                              if (finding.id.startsWith('ai-rev-')) {
                                setAiFindings((prev) => prev.filter((f) => f.id !== finding.id));
                              }
                            }}
                          >
                            {t.reviewPanel.applyFixBtn}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="ins-panel">
            <div className="field-row">
              <label>{t.inspector.settingsLabels.previewTheme}</label>
              <select
                className="select-input"
                value={settings.previewTheme}
                onChange={(e) =>
                  onSettingsChange({
                    ...settings,
                    previewTheme: e.target.value as PreviewTheme,
                  })
                }
              >
                <option value="editorial">{t.previewThemes.editorial}</option>
                <option value="github">{t.previewThemes.github}</option>
                <option value="notion">{t.previewThemes.notion}</option>
                <option value="academic">{t.previewThemes.academic}</option>
              </select>
            </div>

            <div className="field-row">
              <label>{t.inspector.settingsLabels.editorFont}</label>
              <select
                className="select-input"
                value={settings.editorFont}
                onChange={(e) =>
                  onSettingsChange({
                    ...settings,
                    editorFont: e.target.value as 'mono' | 'sans',
                  })
                }
              >
                <option value="mono">{t.inspector.settingsLabels.fontMono}</option>
                <option value="sans">{t.inspector.settingsLabels.fontSans}</option>
              </select>
            </div>

            <div className="field-row">
              <label>
                {t.inspector.settingsLabels.fontSize}: {settings.fontSize}px
              </label>
              <input
                type="range"
                min={12}
                max={24}
                value={settings.fontSize}
                onChange={(e) =>
                  onSettingsChange({ ...settings, fontSize: Number(e.target.value) })
                }
              />
            </div>

            <div className="field-row">
              <label>
                {t.inspector.settingsLabels.lineHeight}: {settings.lineHeight}
              </label>
              <input
                type="range"
                min={1.3}
                max={2.2}
                step={0.05}
                value={settings.lineHeight}
                onChange={(e) =>
                  onSettingsChange({ ...settings, lineHeight: Number(e.target.value) })
                }
              />
            </div>

            <div className="field-row">
              <label>
                {t.inspector.settingsLabels.previewWidth}: {settings.previewWidth}px
              </label>
              <input
                type="range"
                min={600}
                max={1100}
                step={20}
                value={settings.previewWidth}
                onChange={(e) =>
                  onSettingsChange({ ...settings, previewWidth: Number(e.target.value) })
                }
              />
            </div>

            <div className="field-row">
              <label>{t.inspector.settingsLabels.wordGoal}</label>
              <input
                type="number"
                min={0}
                step={100}
                className="text-input"
                value={settings.wordGoal}
                onChange={(e) =>
                  onSettingsChange({ ...settings, wordGoal: Math.max(0, Number(e.target.value)) })
                }
              />
            </div>

            <div className="field-row">
              <label>{t.inspector.settingsLabels.imageAssetFolder}</label>
              <input
                type="text"
                className="text-input"
                value={settings.imageAssetFolder ?? 'assets'}
                onChange={(e) =>
                  onSettingsChange({ ...settings, imageAssetFolder: e.target.value })
                }
                placeholder="assets"
              />
            </div>

            <div className="field-row">
              <label>{t.inspector.settingsLabels.dailyNotesFolder}</label>
              <input
                type="text"
                className="text-input"
                value={settings.dailyNotesFolder ?? ''}
                onChange={(e) =>
                  onSettingsChange({ ...settings, dailyNotesFolder: e.target.value })
                }
                placeholder="daily"
              />
            </div>

            <div className="field-row">
              <label>{t.inspector.settingsLabels.wrapMode}</label>
              <select
                className="select-input"
                value={settings.wrapMode ?? (settings.wordWrap ? 'window' : 'none')}
                onChange={(e) => {
                  const mode = e.target.value as WrapMode;
                  onSettingsChange({
                    ...settings,
                    wrapMode: mode,
                    wordWrap: mode !== 'none',
                  });
                }}
              >
                <option value="window">{t.inspector.settingsLabels.wrapModeWindow}</option>
                <option value="column">{t.inspector.settingsLabels.wrapModeColumn}</option>
                <option value="none">{t.inspector.settingsLabels.wrapModeNone}</option>
              </select>
            </div>

            {(settings.wrapMode ?? (settings.wordWrap ? 'window' : 'none')) === 'column' && (
              <div className="field-row">
                <label>{t.inspector.settingsLabels.wrapColumn}</label>
                <input
                  type="number"
                  min={20}
                  max={240}
                  step={5}
                  className="text-input"
                  value={settings.wrapColumn ?? 80}
                  onChange={(e) =>
                    onSettingsChange({
                      ...settings,
                      wrapColumn: Math.max(20, Math.min(240, Number(e.target.value) || 80)),
                    })
                  }
                />
              </div>
            )}

            <div className="field-row">
              <label>{t.inspector.settingsLabels.defaultNewFileEncoding}</label>
              <select
                className="select-input"
                value={settings.defaultNewFileEncoding ?? 'utf-8'}
                onChange={(e) =>
                  onSettingsChange({
                    ...settings,
                    defaultNewFileEncoding: e.target.value as TextEncodingId,
                  })
                }
              >
                {TEXT_ENCODINGS.map((enc) => (
                  <option key={enc.id} value={enc.id}>
                    {enc.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-row">
              <label>{t.inspector.settingsLabels.defaultNewFileEol}</label>
              <select
                className="select-input"
                value={settings.defaultNewFileEol ?? '\n'}
                onChange={(e) =>
                  onSettingsChange({
                    ...settings,
                    defaultNewFileEol: e.target.value as '\n' | '\r\n',
                  })
                }
              >
                <option value={'\n'}>LF (\n)</option>
                <option value={'\r\n'}>CRLF (\r\n)</option>
              </select>
            </div>

            <div className="check-list">
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={settings.showRuler}
                  onChange={(e) =>
                    onSettingsChange({ ...settings, showRuler: e.target.checked })
                  }
                />
                <span>{t.inspector.settingsLabels.showRuler}</span>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={settings.lineNumbers}
                  onChange={(e) =>
                    onSettingsChange({ ...settings, lineNumbers: e.target.checked })
                  }
                />
                <span>{t.inspector.settingsLabels.lineNumbers}</span>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={settings.showNewlineSymbols}
                  onChange={(e) =>
                    onSettingsChange({ ...settings, showNewlineSymbols: e.target.checked })
                  }
                />
                <span>{t.inspector.settingsLabels.showNewlineSymbols}</span>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={settings.showWhitespaceSymbols}
                  onChange={(e) =>
                    onSettingsChange({ ...settings, showWhitespaceSymbols: e.target.checked })
                  }
                />
                <span>{t.inspector.settingsLabels.showWhitespaceSymbols}</span>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={settings.bracketMatchingEnabled ?? true}
                  onChange={(e) =>
                    onSettingsChange({ ...settings, bracketMatchingEnabled: e.target.checked })
                  }
                />
                <span>{t.inspector.settingsLabels.bracketMatchingEnabled}</span>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={settings.codeFoldingEnabled ?? true}
                  onChange={(e) =>
                    onSettingsChange({ ...settings, codeFoldingEnabled: e.target.checked })
                  }
                />
                <span>{t.inspector.settingsLabels.codeFoldingEnabled}</span>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={settings.highlightSelectionMatches ?? true}
                  onChange={(e) =>
                    onSettingsChange({
                      ...settings,
                      highlightSelectionMatches: e.target.checked,
                    })
                  }
                />
                <span>{t.inspector.settingsLabels.highlightSelectionMatches}</span>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={settings.autoCloseBrackets ?? true}
                  onChange={(e) =>
                    onSettingsChange({ ...settings, autoCloseBrackets: e.target.checked })
                  }
                />
                <span>{t.inspector.settingsLabels.autoCloseBrackets}</span>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={settings.showStatusBar ?? true}
                  onChange={(e) =>
                    onSettingsChange({ ...settings, showStatusBar: e.target.checked })
                  }
                />
                <span>{t.inspector.settingsLabels.showStatusBar}</span>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={settings.syncScroll}
                  onChange={(e) =>
                    onSettingsChange({ ...settings, syncScroll: e.target.checked })
                  }
                />
                <span>{t.inspector.settingsLabels.syncScroll}</span>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={settings.typewriterMode}
                  onChange={(e) =>
                    onSettingsChange({ ...settings, typewriterMode: e.target.checked })
                  }
                />
                <span>{t.inspector.settingsLabels.typewriterMode}</span>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={settings.focusMode ?? false}
                  onChange={(e) =>
                    onSettingsChange({ ...settings, focusMode: e.target.checked })
                  }
                />
                <span>{t.inspector.settingsLabels.focusMode}</span>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={settings.smartPasteHtml}
                  onChange={(e) =>
                    onSettingsChange({ ...settings, smartPasteHtml: e.target.checked })
                  }
                />
                <span>{t.inspector.settingsLabels.smartPasteHtml}</span>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={settings.activeLineSyncHighlight}
                  onChange={(e) =>
                    onSettingsChange({
                      ...settings,
                      activeLineSyncHighlight: e.target.checked,
                    })
                  }
                />
                <span>{t.inspector.settingsLabels.activeLineSyncHighlight}</span>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={settings.oeditLineCopyEnabled}
                  onChange={(e) =>
                    onSettingsChange({
                      ...settings,
                      oeditLineCopyEnabled: e.target.checked,
                    })
                  }
                />
                <span>{t.inspector.settingsLabels.oeditLineCopyEnabled}</span>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={settings.restoreSessionEnabled}
                  onChange={(e) =>
                    onSettingsChange({
                      ...settings,
                      restoreSessionEnabled: e.target.checked,
                    })
                  }
                />
                <span>{t.inspector.settingsLabels.restoreSessionEnabled}</span>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={settings.autoSaveEnabled}
                  onChange={(e) =>
                    onSettingsChange({
                      ...settings,
                      autoSaveEnabled: e.target.checked,
                    })
                  }
                />
                <span>{t.inspector.settingsLabels.autoSaveEnabled}</span>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={settings.hideTopBarInSimpleMode}
                  onChange={(e) =>
                    onSettingsChange({
                      ...settings,
                      hideTopBarInSimpleMode: e.target.checked,
                    })
                  }
                />
                <span>{t.inspector.settingsLabels.hideTopBarInSimpleMode}</span>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={settings.showFormatToolbarInSimpleMode}
                  onChange={(e) =>
                    onSettingsChange({
                      ...settings,
                      showFormatToolbarInSimpleMode: e.target.checked,
                    })
                  }
                />
                <span>{t.inspector.settingsLabels.showFormatToolbarInSimpleMode}</span>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={settings.checkUpdatesOnStartup ?? true}
                  onChange={(e) =>
                    onSettingsChange({
                      ...settings,
                      checkUpdatesOnStartup: e.target.checked,
                    })
                  }
                />
                <span>{t.inspector.settingsLabels.checkUpdatesOnStartup}</span>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={settings.autoUpdateEnabled ?? false}
                  onChange={(e) =>
                    onSettingsChange({
                      ...settings,
                      autoUpdateEnabled: e.target.checked,
                    })
                  }
                />
                <span>{t.inspector.settingsLabels.autoUpdateEnabled}</span>
              </label>
            </div>

            <div className="field-row">
              <label>{t.inspector.settingsLabels.syntaxPreset}</label>
              <select
                className="select-input"
                value={settings.syntaxPreset}
                onChange={(e) =>
                  onSettingsChange({
                    ...settings,
                    syntaxPreset: e.target.value as SyntaxPresetId,
                  })
                }
              >
                <option value="auto">Auto</option>
                <option value="github">GitHub</option>
                <option value="one-dark">One Dark</option>
                <option value="dracula">Dracula</option>
                <option value="nord">Nord</option>
                <option value="monokai">Monokai</option>
                <option value="solarized">Solarized</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div className="field-row">
              <label>{t.inspector.settingsLabels.aiFolderMode}</label>
              <select
                className="select-input"
                value={settings.aiFolderMode}
                onChange={(e) =>
                  onSettingsChange({
                    ...settings,
                    aiFolderMode: e.target.value as AiFolderMode,
                  })
                }
              >
                <option value="disabled">
                  {t.inspector.settingsLabels.aiFolderModes.disabled}
                </option>
                <option value="read-only">
                  {t.inspector.settingsLabels.aiFolderModes.readOnly}
                </option>
                <option value="read-write-approve">
                  {t.inspector.settingsLabels.aiFolderModes.readWriteApprove}
                </option>
                <option value="cli-direct">
                  {t.inspector.settingsLabels.aiFolderModes.cliDirect}
                </option>
              </select>
            </div>

            <button
              type="button"
              className="secondary-btn full-w"
              onClick={onOpenFullSettings}
            >
              <Settings size={14} />
              <span>{t.actions.settings} ({formatShortcut('⌘,')})</span>
            </button>

            <div className="field-row">
              <label>{t.inspector.settingsLabels.customCss}</label>
              <textarea
                rows={4}
                className="textarea-input"
                value={settings.customCss}
                onChange={(e) =>
                  onSettingsChange({ ...settings, customCss: e.target.value })
                }
                placeholder={t.inspector.settingsLabels.customCssPlaceholder}
              />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
