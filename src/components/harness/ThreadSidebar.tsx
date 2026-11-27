import React, { useMemo } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Folder,
  Loader2,
  MessageSquare,
  Plus,
  Trash2,
} from 'lucide-react';
import type { Translations } from '../../i18n/types';
import type { HarnessThread } from '../../types';

interface ThreadSidebarProps {
  t: Translations;
  threads: HarnessThread[];
  activeThreadId: string | null;
  workspaceRoot: string | null;
  onSelectThread: (threadId: string) => void;
  onCreateThread: () => void;
  onDeleteThread: (threadId: string) => void;
}

function formatRelativeShort(ts: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  return `${Math.floor(diffSec / 86400)}d`;
}

export const ThreadSidebar: React.FC<ThreadSidebarProps> = ({
  t,
  threads,
  activeThreadId,
  workspaceRoot,
  onSelectThread,
  onCreateThread,
  onDeleteThread,
}) => {
  const grouped = useMemo(() => {
    const map = new Map<string, HarnessThread[]>();
    for (const th of threads) {
      const key = th.workspaceRoot || '';
      const arr = map.get(key) ?? [];
      arr.push(th);
      map.set(key, arr);
    }
    const entries = Array.from(map.entries());
    // Put current workspaceRoot group at the top
    entries.sort(([a], [b]) => {
      if (workspaceRoot && a === workspaceRoot) return -1;
      if (workspaceRoot && b === workspaceRoot) return 1;
      return 0;
    });
    return entries;
  }, [threads, workspaceRoot]);

  const renderStatusIcon = (status: HarnessThread['status']) => {
    switch (status) {
      case 'running':
        return (
          <span className="harness-thread-status-icon is-running" title={t.harness.statusRunning}>
            <Loader2 size={14} className="harness-spin" />
          </span>
        );
      case 'waiting_approval':
        return (
          <span className="harness-thread-status-icon is-waiting" title={t.harness.statusWaiting}>
            <Clock size={14} />
          </span>
        );
      case 'completed':
        return (
          <span className="harness-thread-status-icon is-done" title={t.harness.statusCompleted}>
            <CheckCircle2 size={14} />
          </span>
        );
      case 'error':
        return (
          <span className="harness-thread-status-icon is-error" title={t.harness.statusError}>
            <AlertCircle size={14} />
          </span>
        );
      default:
        return (
          <span className="harness-thread-status-icon" title={t.harness.statusIdle}>
            <MessageSquare size={14} />
          </span>
        );
    }
  };

  return (
    <aside className="harness-sidebar">
      <div className="harness-sidebar-header">
        <span className="harness-sidebar-title">{t.harness.threadsHeading}</span>
        <button
          type="button"
          className="harness-new-thread-btn"
          disabled={!workspaceRoot}
          onClick={onCreateThread}
        >
          <Plus size={13} />
          <span>{t.harness.newThread}</span>
        </button>
      </div>

      <div className="harness-thread-list">
        {grouped.length === 0 ? (
          <div style={{ padding: '20px 10px', fontSize: 12, color: 'var(--fg-muted)', textAlign: 'center' }}>
            {t.harness.noThreads}
          </div>
        ) : (
          grouped.map(([wsPath, groupThreads]) => {
            const folderName = wsPath.split(/[/\\]/).filter(Boolean).pop() || wsPath;
            return (
              <div key={wsPath} className="harness-project-group">
                <div className="harness-project-group-header" title={wsPath}>
                  <Folder size={12} />
                  <span>{folderName}</span>
                </div>
                {groupThreads.map((th) => {
                  const isActive = th.id === activeThreadId;
                  return (
                    <div
                      key={th.id}
                      role="button"
                      tabIndex={0}
                      className={`harness-thread-item ${isActive ? 'is-active' : ''}`}
                      onClick={() => onSelectThread(th.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectThread(th.id);
                        }
                      }}
                    >
                      {renderStatusIcon(th.status)}
                      <div className="harness-thread-item-body">
                        <div className="harness-thread-item-title">{th.title}</div>
                        <div className="harness-thread-item-meta">
                          <span>{th.provider}</span>
                          {th.branch && <span>· {th.branch}</span>}
                          <span style={{ marginLeft: 'auto' }}>{formatRelativeShort(th.updatedAt)}</span>
                        </div>
                      </div>
                      {th.unread && <span className="harness-unread-dot" />}
                      <button
                        type="button"
                        className="harness-thread-delete-btn"
                        title={t.actions.close}
                        aria-label={t.actions.close}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(t.harness.deleteThreadConfirm)) {
                            onDeleteThread(th.id);
                          }
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
