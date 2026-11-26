import React, { useMemo, useState } from 'react';
import { Loader2, Play } from 'lucide-react';
import type { Locale } from '../../types';
import { parseHttpRequests, type HttpRequestBlock } from '../../utils/previewParsers';

interface HttpPreviewPaneProps {
  locale: Locale;
  content: string;
  onJumpToLine?: (line: number) => void;
}

interface HttpExecutionResult {
  loading: boolean;
  status?: number;
  statusText?: string;
  durationMs?: number;
  headers?: Array<[string, string]>;
  bodyText?: string;
  error?: string;
}

export const HttpPreviewPane: React.FC<HttpPreviewPaneProps> = ({
  locale,
  content,
  onJumpToLine,
}) => {
  const isJa = locale === 'ja';
  const requests = useMemo(() => parseHttpRequests(content), [content]);
  const [results, setResults] = useState<Record<string, HttpExecutionResult>>({});

  const handleSend = async (req: HttpRequestBlock) => {
    setResults((prev) => ({ ...prev, [req.id]: { loading: true } }));
    const started = performance.now();
    try {
      const canHaveBody = !['GET', 'HEAD'].includes(req.method);
      const res = await fetch(req.url, {
        method: req.method,
        headers: req.headers,
        body: canHaveBody && req.body ? req.body : undefined,
      });
      const durationMs = Math.round(performance.now() - started);
      const rawText = await res.text();
      let formattedBody = rawText;
      try {
        formattedBody = JSON.stringify(JSON.parse(rawText), null, 2);
      } catch {
        // keep plain text
      }
      const resHeaders: Array<[string, string]> = [];
      res.headers.forEach((v, k) => resHeaders.push([k, v]));
      setResults((prev) => ({
        ...prev,
        [req.id]: {
          loading: false,
          status: res.status,
          statusText: res.statusText,
          durationMs,
          headers: resHeaders,
          bodyText: formattedBody,
        },
      }));
    } catch (err) {
      setResults((prev) => ({
        ...prev,
        [req.id]: {
          loading: false,
          durationMs: Math.round(performance.now() - started),
          error: err instanceof Error ? err.message : String(err),
        },
      }));
    }
  };

  return (
    <div className="ext-preview-pane">
      <div className="ext-preview-toolbar">
        <div className="ext-preview-toolbar-left">
          <span className="ext-preview-kind-badge">HTTP / REST</span>
          <span className="ext-meta-pill">
            {requests.length} {isJa ? 'リクエスト' : 'requests'}
          </span>
        </div>
      </div>

      <div className="ext-preview-body">
        {requests.length === 0 ? (
          <div className="ext-empty-cell">
            {isJa
              ? '例: GET https://httpbin.org/get'
              : 'Example: GET https://httpbin.org/get'}
          </div>
        ) : (
          <div className="ext-card-list">
            {requests.map((req) => {
              const res = results[req.id];
              const headerEntries = Object.entries(req.headers);
              return (
                <div key={req.id} className="ext-http-card">
                  <div className="ext-http-card-header">
                    <div className="ext-http-title-row">
                      <span className={`ext-method-badge is-${req.method.toLowerCase()}`}>
                        {req.method}
                      </span>
                      <button
                        type="button"
                        className="ext-link-btn ext-http-url"
                        onClick={() => onJumpToLine?.(req.line)}
                        title={isJa ? 'エディタへジャンプ' : 'Jump to line'}
                      >
                        {req.url}
                      </button>
                    </div>
                    <button
                      type="button"
                      className="ext-tool-btn is-primary"
                      disabled={res?.loading}
                      onClick={() => void handleSend(req)}
                    >
                      {res?.loading ? (
                        <Loader2 size={13} className="spin" />
                      ) : (
                        <Play size={13} />
                      )}
                      <span>{isJa ? '送信' : 'Send'}</span>
                    </button>
                  </div>

                  {req.name && req.name !== `${req.method} ${req.url}` && (
                    <div className="ext-http-name">{req.name}</div>
                  )}

                  {headerEntries.length > 0 && (
                    <div className="ext-http-section">
                      <div className="ext-http-section-title">Headers</div>
                      <div className="ext-kv-mini">
                        {headerEntries.map(([k, v]) => (
                          <div key={k} className="ext-kv-mini-row">
                            <span className="ext-kv-k">{k}:</span>
                            <span className="ext-kv-v">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {req.body && (
                    <div className="ext-http-section">
                      <div className="ext-http-section-title">Body</div>
                      <pre className="ext-code-mini">{req.body}</pre>
                    </div>
                  )}

                  {res && !res.loading && (
                    <div className="ext-http-response">
                      {res.error ? (
                        <div className="ext-error-message">
                          {isJa ? '送信エラー: ' : 'Request error: '}
                          {res.error}
                        </div>
                      ) : (
                        <>
                          <div className="ext-http-res-status">
                            <span
                              className={`ext-status-pill ${
                                (res.status ?? 0) >= 200 && (res.status ?? 0) < 300
                                  ? 'is-ok'
                                  : 'is-err'
                              }`}
                            >
                              {res.status} {res.statusText}
                            </span>
                            {typeof res.durationMs === 'number' && (
                              <span className="ext-meta-pill">{res.durationMs} ms</span>
                            )}
                          </div>
                          {res.bodyText && <pre className="ext-code-mini">{res.bodyText}</pre>}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
