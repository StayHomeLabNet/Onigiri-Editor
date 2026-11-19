import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Network, Search, X } from 'lucide-react';
import type { Translations } from '../i18n/types';
import type { KnowledgeGraphNode, WorkspaceKnowledgeReport } from '../utils/knowledge';

interface KnowledgeGraphModalProps {
  t: Translations;
  open: boolean;
  report: WorkspaceKnowledgeReport;
  activeFilePath?: string;
  onOpenFile: (path: string, line?: number) => void;
  onClose: () => void;
}

interface PositionedNode extends KnowledgeGraphNode {
  x: number;
  y: number;
}

export const KnowledgeGraphModal: React.FC<KnowledgeGraphModalProps> = ({
  t,
  open,
  report,
  activeFilePath,
  onOpenFile,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [onlyConnected, setOnlyConnected] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedPath(activeFilePath || report.nodes[0]?.path || null);
  }, [open, activeFilePath, report.nodes]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const filteredNodes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return report.nodes.filter((n) => {
      if (onlyConnected && n.inDegree + n.outDegree === 0) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.relativePath.toLowerCase().includes(q) ||
        n.tags.some((tg) => `#${tg}`.toLowerCase().includes(q))
      );
    });
  }, [report.nodes, query, onlyConnected]);

  const positioned = useMemo(() => {
    const width = 760;
    const height = 460;
    const cx = width / 2;
    const cy = height / 2;
    const items = filteredNodes.slice(0, 120);
    const total = items.length;
    if (total === 0) return { nodes: [] as PositionedNode[], width, height };

    // Deterministic radial-force hybrid layout sorted by degree
    const sorted = [...items].sort(
      (a, b) => b.inDegree + b.outDegree - (a.inDegree + a.outDegree)
    );
    const coords = sorted.map((node, idx) => {
      if (total === 1) return { ...node, x: cx, y: cy };
      const ring = idx === 0 && (node.inDegree + node.outDegree > 0) ? 0 : idx < 10 ? 1 : 2;
      const angle = (idx / Math.max(1, total)) * Math.PI * 2 + ring * 0.45;
      const rx = ring === 0 ? 0 : ring === 1 ? 135 : 265;
      const ry = ring === 0 ? 0 : ring === 1 ? 95 : 175;
      return {
        ...node,
        x: cx + Math.cos(angle) * rx,
        y: cy + Math.sin(angle) * ry,
      };
    });

    const visibleMap = new Map(coords.map((n) => [n.path, n]));
    // 18 lightweight spring relaxation steps for connected edges
    for (let iter = 0; iter < 18; iter++) {
      for (const edge of report.edges) {
        const a = visibleMap.get(edge.sourcePath);
        const b = visibleMap.get(edge.targetPath);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        const ideal = 110;
        const pull = ((dist - ideal) / dist) * 0.06;
        a.x += dx * pull;
        a.y += dy * pull;
        b.x -= dx * pull;
        b.y -= dy * pull;
      }
      for (let i = 0; i < coords.length; i++) {
        for (let j = i + 1; j < coords.length; j++) {
          const a = coords[i];
          const b = coords[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > 0 && distSq < 4200) {
            const dist = Math.sqrt(distSq);
            const push = ((65 - dist) / dist) * 0.35;
            a.x -= dx * push;
            a.y -= dy * push;
            b.x += dx * push;
            b.y += dy * push;
          }
        }
        coords[i].x = Math.max(46, Math.min(width - 46, coords[i].x));
        coords[i].y = Math.max(36, Math.min(height - 36, coords[i].y));
      }
    }

    return { nodes: coords, width, height };
  }, [filteredNodes, report.edges]);

  const nodeByPath = useMemo(
    () => new Map(positioned.nodes.map((n) => [n.path, n])),
    [positioned.nodes]
  );

  const selectedNode = useMemo(
    () => report.nodes.find((n) => n.path === selectedPath) || null,
    [report.nodes, selectedPath]
  );

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="knowledge-graph-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t.knowledgeGraphModal.title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="encoding-modal-header">
          <div className="encoding-modal-title">
            <Network size={16} />
            <h3>{t.knowledgeGraphModal.title}</h3>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            title={t.actions.close}
          >
            <X size={16} />
          </button>
        </div>

        <div className="knowledge-graph-toolbar">
          <div className="knowledge-graph-search">
            <Search size={13} />
            <input
              type="text"
              className="text-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.knowledgeGraphModal.searchPlaceholder}
            />
          </div>
          <label className="check-row compact">
            <input
              type="checkbox"
              checked={onlyConnected}
              onChange={(e) => setOnlyConnected(e.target.checked)}
            />
            <span>{t.knowledgeGraphModal.onlyConnected}</span>
          </label>
          <div className="knowledge-graph-stats">
            <span>{t.knowledgeGraphModal.nodesCount.replace('{count}', String(report.nodes.length))}</span>
            <span>{t.knowledgeGraphModal.edgesCount.replace('{count}', String(report.edges.length))}</span>
            <span className={report.brokenLinks.length > 0 ? 'is-warn' : ''}>
              {t.knowledgeGraphModal.brokenCount.replace('{count}', String(report.brokenLinks.length))}
            </span>
            <span>
              {t.knowledgeGraphModal.orphanCount.replace('{count}', String(report.orphanNotes.length))}
            </span>
          </div>
        </div>

        <div className="knowledge-graph-body">
          <div className="knowledge-graph-canvas-wrap">
            {report.nodes.length === 0 ? (
              <div className="unused-assets-empty">{t.knowledgeGraphModal.emptyHint}</div>
            ) : (
              <svg
                className="knowledge-graph-svg"
                viewBox={`0 0 ${positioned.width} ${positioned.height}`}
              >
                <defs>
                  <marker
                    id="kg-arrow"
                    markerWidth="7"
                    markerHeight="7"
                    refX="14"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 7 3.5, 0 7" fill="currentColor" />
                  </marker>
                </defs>

                {report.edges.map((edge) => {
                  const src = nodeByPath.get(edge.sourcePath);
                  const dst = nodeByPath.get(edge.targetPath);
                  if (!src || !dst) return null;
                  const isHighlighted =
                    selectedPath === edge.sourcePath || selectedPath === edge.targetPath;
                  return (
                    <line
                      key={`${edge.sourcePath}->${edge.targetPath}`}
                      x1={src.x}
                      y1={src.y}
                      x2={dst.x}
                      y2={dst.y}
                      className={`kg-edge ${isHighlighted ? 'is-highlighted' : ''}`}
                      markerEnd="url(#kg-arrow)"
                    />
                  );
                })}

                {positioned.nodes.map((node) => {
                  const isActive = node.path === activeFilePath;
                  const isSelected = node.path === selectedPath;
                  const isOrphan = node.inDegree + node.outDegree === 0;
                  const radius = Math.min(16, 7 + (node.inDegree + node.outDegree) * 1.4);
                  return (
                    <g
                      key={node.path}
                      className={`kg-node ${isActive ? 'is-active' : ''} ${
                        isSelected ? 'is-selected' : ''
                      } ${isOrphan ? 'is-orphan' : ''}`}
                      transform={`translate(${node.x}, ${node.y})`}
                      onClick={() => setSelectedPath(node.path)}
                      onDoubleClick={() => {
                        onOpenFile(node.path);
                        onClose();
                      }}
                    >
                      <circle r={radius} />
                      <text y={radius + 12} textAnchor="middle">
                        {node.title.length > 22 ? `${node.title.slice(0, 20)}…` : node.title}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
            <div className="knowledge-graph-legend">
              <span className="legend-dot is-active">{t.knowledgeGraphModal.legendActive}</span>
              <span className="legend-dot is-linked">{t.knowledgeGraphModal.legendNote}</span>
              <span className="legend-dot is-orphan">{t.knowledgeGraphModal.legendOrphan}</span>
            </div>
          </div>

          <aside className="knowledge-graph-inspector">
            {selectedNode ? (
              <div className="kg-inspector-section">
                <div className="kg-inspector-label">{t.knowledgeGraphModal.selectedNodeLabel}</div>
                <div className="kg-inspector-title">{selectedNode.title}</div>
                <div className="kg-inspector-path">{selectedNode.relativePath}</div>
                <div className="kg-inspector-counts">
                  <span>
                    {t.knowledgeGraphModal.inLinks}: {selectedNode.inDegree}
                  </span>
                  <span>
                    {t.knowledgeGraphModal.outLinks}: {selectedNode.outDegree}
                  </span>
                </div>
                {selectedNode.tags.length > 0 && (
                  <div className="kg-inspector-tags">
                    {selectedNode.tags.map((tg) => (
                      <span key={tg} className="kg-tag-chip">
                        #{tg}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  className="primary-btn sm"
                  onClick={() => {
                    onOpenFile(selectedNode.path);
                    onClose();
                  }}
                >
                  <ExternalLink size={12} />
                  <span>{t.knowledgeGraphModal.openFileBtn}</span>
                </button>
              </div>
            ) : null}

            <div className="kg-inspector-section">
              <div className="kg-inspector-label">
                {t.sidebar.diagnosticsBrokenLinks} ({report.brokenLinks.length})
              </div>
              {report.brokenLinks.length === 0 ? (
                <div className="kg-inspector-empty">{t.sidebar.noBrokenLinks}</div>
              ) : (
                <ul className="kg-diag-list">
                  {report.brokenLinks.slice(0, 30).map((b, i) => (
                    <li key={`${b.sourcePath}:${b.line}:${i}`}>
                      <button
                        type="button"
                        className="kg-diag-btn"
                        onClick={() => {
                          onOpenFile(b.sourcePath, b.line);
                          onClose();
                        }}
                      >
                        <span className="kg-diag-src">
                          {b.sourceRelativePath}:{b.line}
                        </span>
                        <span className="kg-diag-target">→ {b.target}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
