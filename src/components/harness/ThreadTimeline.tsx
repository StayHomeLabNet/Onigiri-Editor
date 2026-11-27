import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  FileCode2,
  FolderOpen,
  GitCompare,
  Loader2,
  Play,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Terminal,
  XCircle,
} from 'lucide-react';
import type { Translations } from '../../i18n/types';
import type {
  HarnessThread,
  HarnessTimelineEntry,
  TurnChangedFile,
} from '../../types';
import { renderMarkdownToHtml } from '../../utils/markdown';
import { isTauri } from '../../utils/platform';

interface ThreadTimelineProps {
  t: Translations;
  workspaceRoot: string | null;
  activeFilePath?: string | null;
  thread: HarnessThread | null;
  entries: HarnessTimelineEntry[];
  onChooseFolder: () => void;
  onUseCurrentFileFolder?: () => void;
  onExecutePlan: (entryId: string, rawPlan: string) => void;
  onRespondApproval: (approvalId: string, decision: 'allow' | 'allow_session' | 'deny') => void;
  onAcceptDiff: (diffEntryId: string) => void;
  onRevertDiff: (diffEntryId: string) => void;
  onInspectFile: (filePath: string) => void;
  onInspectDiffFile: (file: TurnChangedFile) => void;
  onCopyText: (text: string) => void;
}

const MarkdownBubble: React.FC<{ markdown: string }> = ({ markdown }) => {
  const [html, setHtml] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    void renderMarkdownToHtml(markdown, { breaks: true })
      .then((rendered) => {
        if (!cancelled) setHtml(rendered);
      })
      .catch(() => {
        if (!cancelled) setHtml('');
      });
    return () => {
      cancelled = true;
    };
  }, [markdown]);

  if (!html) {
    return <div style={{ whiteSpace: 'pre-wrap' }}>{markdown}</div>;
  }

  return (
    <div
      className="harness-assistant-md"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export const ThreadTimeline: React.FC<ThreadTimelineProps> = ({
  t,
  workspaceRoot,
  activeFilePath,
  thread,
  entries,
  onChooseFolder,
  onUseCurrentFileFolder,
  onExecutePlan,
  onRespondApproval,
  onAcceptDiff,
  onRevertDiff,
  onInspectFile,
  onInspectDiffFile,
  onCopyText,
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 260) {
      el.scrollTop = el.scrollHeight;
    }
  }, [entries]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!isTauri()) {
    return (
      <div className="harness-timeline-scroll">
        <div className="harness-empty-state">
          <div className="harness-empty-icon">
            <Bot size={22} />
          </div>
          <h3 className="harness-empty-title">{t.harness.desktopOnlyTitle}</h3>
          <p className="harness-empty-desc">{t.harness.desktopOnlyDesc}</p>
        </div>
      </div>
    );
  }

  if (!workspaceRoot && !thread) {
    return (
      <div className="harness-timeline-scroll">
        <div className="harness-empty-state">
          <div className="harness-empty-icon">
            <FolderOpen size={22} />
          </div>
          <h3 className="harness-empty-title">{t.harness.selectFolderTitle}</h3>
          <p className="harness-empty-desc">{t.harness.selectFolderDesc}</p>
          <div className="harness-empty-actions">
            <button type="button" className="primary-btn" onClick={onChooseFolder}>
              <FolderOpen size={14} />
              <span>{t.harness.openFolderBtn}</span>
            </button>
            {activeFilePath && onUseCurrentFileFolder && (
              <button
                type="button"
                className="secondary-btn"
                onClick={onUseCurrentFileFolder}
              >
                <FileCode2 size={14} />
                <span>{t.harness.useCurrentDocFolderBtn}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="harness-timeline-scroll" ref={scrollRef}>
      <div className="harness-timeline-inner">
        {entries.length === 0 ? (
          <div className="harness-empty-state" style={{ marginTop: 28 }}>
            <div className="harness-empty-icon">
              <Sparkles size={22} />
            </div>
            <h3 className="harness-empty-title">{t.harness.modeLabel}</h3>
            <p className="harness-empty-desc">{t.harness.modeHint}</p>
          </div>
        ) : (
          entries.map((entry) => {
            switch (entry.kind) {
              case 'user_message':
                return (
                  <div key={entry.id} className="harness-user-card">
                    <div>{entry.content}</div>
                    {entry.contextFiles.length > 0 && (
                      <div className="harness-context-chips">
                        {entry.contextFiles.map((fp) => {
                          const name = fp.split(/[/\\]/).pop() || fp;
                          return (
                            <button
                              key={fp}
                              type="button"
                              className="harness-file-chip"
                              onClick={() => onInspectFile(fp)}
                              title={fp}
                            >
                              <FileCode2 size={11} />
                              <span>{name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );

              case 'thinking': {
                const open = Boolean(expandedIds[entry.id]);
                return (
                  <div key={entry.id} className="harness-thinking-box">
                    <button
                      type="button"
                      className="harness-compact-toggle"
                      onClick={() => toggleExpand(entry.id)}
                    >
                      {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      <Sparkles size={13} />
                      <span>{t.harness.thinkingLabel}</span>
                    </button>
                    {open && <div className="harness-expand-body">{entry.content}</div>}
                  </div>
                );
              }

              case 'tool_call': {
                const open = Boolean(expandedIds[entry.id]);
                return (
                  <div key={entry.id} className="harness-tool-row">
                    <button
                      type="button"
                      className="harness-compact-toggle"
                      onClick={() => toggleExpand(entry.id)}
                    >
                      {entry.status === 'running' ? (
                        <Loader2 size={13} className="harness-spin" />
                      ) : entry.status === 'done' ? (
                        <CheckCircle2 size={13} style={{ color: '#10b981' }} />
                      ) : (
                        <XCircle size={13} style={{ color: '#ef4444' }} />
                      )}
                      <Terminal size={12} />
                      <span className="harness-tool-summary">{entry.summary}</span>
                      {entry.targetPath && (
                        <span
                          className="harness-file-chip"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (entry.targetPath) onInspectFile(entry.targetPath);
                          }}
                        >
                          {t.harness.tabPreview}
                        </span>
                      )}
                      {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>
                    {open && (entry.argsPreview || entry.outputPreview) && (
                      <div className="harness-expand-body">
                        {entry.argsPreview ? `Args: ${entry.argsPreview}\n` : ''}
                        {entry.outputPreview ? `\n${entry.outputPreview}` : ''}
                      </div>
                    )}
                  </div>
                );
              }

              case 'assistant_message':
                return (
                  <div key={entry.id} className="harness-assistant-card">
                    <div className="harness-assistant-header">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <Bot size={13} />
                        <span>{entry.model || thread?.provider || 'Assistant'}</span>
                        {entry.streaming && <Loader2 size={11} className="harness-spin" />}
                      </span>
                      <button
                        type="button"
                        className="icon-btn"
                        style={{ width: 24, height: 24 }}
                        onClick={() => onCopyText(entry.content)}
                        title={t.actions.copy}
                        aria-label={t.actions.copy}
                      >
                        <ClipboardCopy size={12} />
                      </button>
                    </div>
                    <MarkdownBubble markdown={entry.content} />
                  </div>
                );

              case 'plan_card':
                return (
                  <div key={entry.id} className="harness-plan-card">
                    <div className="harness-card-head">
                      <span className="harness-card-title">
                        <Sparkles size={14} style={{ color: 'var(--accent)' }} />
                        <span>{t.harness.planCardTitle}</span>
                      </span>
                      {entry.executed && (
                        <span className="harness-branch-chip">{t.harness.planExecutedBadge}</span>
                      )}
                    </div>
                    {entry.summary && (
                      <div style={{ fontSize: 12.5, color: 'var(--fg-secondary)' }}>
                        {entry.summary}
                      </div>
                    )}
                    {entry.steps.length > 0 && (
                      <ol className="harness-plan-steps">
                        {entry.steps.map((st, idx) => (
                          <li key={idx}>{st}</li>
                        ))}
                      </ol>
                    )}
                    {!entry.executed && (
                      <div className="harness-card-actions">
                        <button
                          type="button"
                          className="primary-btn compact-btn"
                          disabled={thread?.status === 'running'}
                          onClick={() => onExecutePlan(entry.id, entry.rawPlan)}
                        >
                          <Play size={12} />
                          <span>{t.harness.executePlanBtn}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );

              case 'approval_request': {
                const resolved = Boolean(entry.decision);
                return (
                  <div key={entry.id} className="harness-approval-card">
                    <div className="harness-card-head">
                      <span className="harness-card-title">
                        <ShieldAlert size={15} style={{ color: '#f59e0b' }} />
                        <span>{entry.summary}</span>
                      </span>
                      {entry.decision && (
                        <span className="harness-branch-chip">{entry.decision}</span>
                      )}
                    </div>
                    {entry.isDirtyConflict && (
                      <div className="harness-conflict-banner">
                        <AlertTriangle size={14} />
                        <span>{t.harness.dirtyConflictWarn}</span>
                      </div>
                    )}
                    {entry.command && (
                      <pre className="harness-expand-body" style={{ margin: 0, borderRadius: 6 }}>
                        $ {entry.command}
                      </pre>
                    )}
                    {entry.diffPreview && (
                      <pre className="harness-expand-body" style={{ margin: 0, borderRadius: 6 }}>
                        {entry.diffPreview}
                      </pre>
                    )}
                    {!resolved && (
                      <div className="harness-card-actions">
                        <button
                          type="button"
                          className="primary-btn compact-btn"
                          onClick={() => onRespondApproval(entry.approvalId, 'allow')}
                        >
                          <Check size={12} />
                          <span>{t.harness.approveAllowBtn}</span>
                        </button>
                        {!entry.isDirtyConflict && entry.toolName !== 'run_command' && (
                          <button
                            type="button"
                            className="secondary-btn compact-btn"
                            onClick={() => onRespondApproval(entry.approvalId, 'allow_session')}
                          >
                            <span>{t.harness.approveSessionBtn}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className="secondary-btn compact-btn"
                          onClick={() => onRespondApproval(entry.approvalId, 'deny')}
                        >
                          <span>{t.harness.approveDenyBtn}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              case 'turn_diff':
                return (
                  <div key={entry.id} className="harness-diff-card">
                    <div className="harness-card-head">
                      <span className="harness-card-title">
                        <GitCompare size={14} />
                        <span>
                          {t.harness.diffCardTitle} ({entry.files.length})
                        </span>
                      </span>
                      {entry.reverted ? (
                        <span className="harness-branch-chip">{t.harness.revertedBadge}</span>
                      ) : entry.accepted ? (
                        <span className="harness-branch-chip">{t.harness.acceptedBadge}</span>
                      ) : null}
                    </div>

                    {entry.dirtyConflicts.length > 0 && !entry.reverted && (
                      <div className="harness-conflict-banner">
                        <AlertTriangle size={14} />
                        <span>{t.harness.dirtyConflictWarn}</span>
                      </div>
                    )}

                    <div className="harness-diff-file-list">
                      {entry.files.map((f) => (
                        <button
                          key={f.path}
                          type="button"
                          className="harness-diff-file-row"
                          onClick={() => onInspectDiffFile(f)}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.relativePath}
                          </span>
                          <span className="harness-diff-counts">
                            <span className="harness-add-count">+{f.additions}</span>
                            <span className="harness-del-count">-{f.deletions}</span>
                          </span>
                        </button>
                      ))}
                    </div>

                    {!entry.reverted && (
                      <div className="harness-card-actions">
                        {!entry.accepted && (
                          <button
                            type="button"
                            className="primary-btn compact-btn"
                            onClick={() => onAcceptDiff(entry.id)}
                          >
                            <Check size={12} />
                            <span>{t.harness.acceptChangesBtn}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className="secondary-btn compact-btn"
                          onClick={() => onRevertDiff(entry.id)}
                        >
                          <RotateCcw size={12} />
                          <span>{t.harness.revertTurnBtn}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );

              case 'notice':
                return (
                  <div
                    key={entry.id}
                    className={`harness-notice-banner ${entry.level === 'error' ? 'is-error' : ''}`}
                  >
                    <AlertTriangle size={14} />
                    <span>{entry.message}</span>
                  </div>
                );
            }
          })
        )}
      </div>
    </div>
  );
};
