import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Globe } from 'lucide-react';
import type { Locale } from '../../types';
import { parseOpenApiDocument } from '../../utils/previewParsers';

interface OpenApiPreviewPaneProps {
  locale: Locale;
  content: string;
}

export const OpenApiPreviewPane: React.FC<OpenApiPreviewPaneProps> = ({ locale, content }) => {
  const isJa = locale === 'ja';
  const [query, setQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const spec = useMemo(() => parseOpenApiDocument(content), [content]);

  const filteredEndpoints = useMemo(() => {
    const q = query.trim().toLowerCase();
    return spec.endpoints.filter((ep) => {
      if (methodFilter !== 'ALL' && ep.method !== methodFilter) return false;
      if (
        q &&
        !ep.path.toLowerCase().includes(q) &&
        !ep.summary.toLowerCase().includes(q) &&
        !ep.tags.some((t) => t.toLowerCase().includes(q))
      ) {
        return false;
      }
      return true;
    });
  }, [spec.endpoints, query, methodFilter]);

  const toggleEndpoint = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="ext-preview-pane">
      <div className="ext-preview-toolbar">
        <div className="ext-preview-toolbar-left">
          <span className="ext-preview-kind-badge">OpenAPI</span>
          <select
            className="ext-select-compact"
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
          >
            <option value="ALL">ALL</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>
          <input
            type="text"
            className="ext-preview-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isJa ? 'パス / 概要 / タグで検索...' : 'Filter path, summary, or tag...'}
          />
        </div>
      </div>

      <div className="ext-preview-body">
        {!spec.ok ? (
          <div className="ext-error-box">
            <div className="ext-error-header">
              <AlertTriangle size={16} />
              <span>{isJa ? 'OpenAPI パースエラー' : 'OpenAPI Parse Error'}</span>
            </div>
            <div className="ext-error-message">{spec.error}</div>
          </div>
        ) : (
          <div className="ext-openapi-wrap">
            <div className="ext-openapi-header">
              <div className="ext-openapi-title-row">
                <h3>{spec.title}</h3>
                {spec.version && <span className="ext-meta-pill">v{spec.version}</span>}
              </div>
              {spec.description && <p className="ext-openapi-desc">{spec.description}</p>}
              {spec.servers.length > 0 && (
                <div className="ext-openapi-servers">
                  {spec.servers.map((srv) => (
                    <span key={srv} className="ext-meta-pill">
                      <Globe size={11} />
                      <span>{srv}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="ext-card-list">
              {filteredEndpoints.map((ep) => {
                const isOpen = expandedIds.has(ep.id);
                return (
                  <div key={ep.id} className="ext-endpoint-card">
                    <button
                      type="button"
                      className="ext-endpoint-row"
                      onClick={() => toggleEndpoint(ep.id)}
                    >
                      <span className="ext-endpoint-left">
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span className={`ext-method-badge is-${ep.method.toLowerCase()}`}>
                          {ep.method}
                        </span>
                        <code className="ext-endpoint-path">{ep.path}</code>
                      </span>
                      <span className="ext-endpoint-summary">{ep.summary}</span>
                    </button>

                    {isOpen && (
                      <div className="ext-endpoint-body">
                        {ep.description && (
                          <p className="ext-endpoint-desc">{ep.description}</p>
                        )}
                        {ep.parameters.length > 0 && (
                          <div className="ext-http-section">
                            <div className="ext-http-section-title">Parameters</div>
                            <table className="ext-table">
                              <thead>
                                <tr>
                                  <th>Name</th>
                                  <th>In</th>
                                  <th>Type</th>
                                  <th>Required</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ep.parameters.map((p, idx) => (
                                  <tr key={`${p.name}-${idx}`}>
                                    <td className="ext-mono-cell">{p.name}</td>
                                    <td>{p.in}</td>
                                    <td>{p.type || '-'}</td>
                                    <td>{p.required ? 'Yes' : 'No'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {ep.requestBodySchema !== undefined && (
                          <div className="ext-http-section">
                            <div className="ext-http-section-title">Request Body Schema</div>
                            <pre className="ext-code-mini">
                              {JSON.stringify(ep.requestBodySchema, null, 2)}
                            </pre>
                          </div>
                        )}

                        {ep.responses.length > 0 && (
                          <div className="ext-http-section">
                            <div className="ext-http-section-title">Responses</div>
                            <div className="ext-openapi-responses">
                              {ep.responses.map((r) => (
                                <div key={r.status} className="ext-openapi-resp-item">
                                  <div className="ext-openapi-resp-head">
                                    <span className="ext-meta-pill">{r.status}</span>
                                    <span>{r.description}</span>
                                  </div>
                                  {r.schema !== undefined && (
                                    <pre className="ext-code-mini">
                                      {JSON.stringify(r.schema, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredEndpoints.length === 0 && (
                <div className="ext-empty-cell">
                  {isJa ? 'エンドポイントが見つかりません' : 'No endpoints found'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
