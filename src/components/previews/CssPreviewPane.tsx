import React, { useMemo, useState } from 'react';
import { ClipboardCopy, Palette, Sparkles } from 'lucide-react';
import type { Locale } from '../../types';
import { writeClipboardText } from '../../utils/platform';
import { extractCssColors, type CssColorToken } from '../../utils/previewParsers';

interface CssPreviewPaneProps {
  locale: Locale;
  fileName: string;
  content: string;
  onUpdateContent?: (nextContent: string) => void;
  onJumpToLine?: (line: number) => void;
  onCopyNotify: () => void;
}

function toPickerHex(color: string): string {
  const c = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c;
  if (/^#[0-9a-fA-F]{3}$/.test(c)) {
    return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
  }
  return '#3b82f6';
}

export const CssPreviewPane: React.FC<CssPreviewPaneProps> = ({
  locale,
  fileName,
  content,
  onUpdateContent,
  onJumpToLine,
  onCopyNotify,
}) => {
  const isJa = locale === 'ja';
  const [filter, setFilter] = useState('');
  const tokens = useMemo(() => extractCssColors(content), [content]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return tokens;
    return tokens.filter(
      (t) =>
        t.color.toLowerCase().includes(q) ||
        (t.variableName && t.variableName.toLowerCase().includes(q))
    );
  }, [tokens, filter]);

  const handleReplaceColor = (token: CssColorToken, nextHex: string) => {
    if (!onUpdateContent) return;
    const normalized = content.replace(/\r\n/g, '\n');
    const next = normalized.slice(0, token.from) + nextHex + normalized.slice(token.to);
    onUpdateContent(next);
  };

  const badge = /\.s[ca]ss$/i.test(fileName) ? 'SCSS' : 'CSS';

  return (
    <div className="ext-preview-pane">
      <div className="ext-preview-toolbar">
        <div className="ext-preview-toolbar-left">
          <span className="ext-preview-kind-badge">{badge}</span>
          <span className="ext-meta-pill">
            <Palette size={12} />
            <span>
              {isJa ? `${tokens.length} カラー` : `${tokens.length} colors`}
            </span>
          </span>
          <input
            type="text"
            className="ext-preview-search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={isJa ? '色コード / 変数名で検索...' : 'Filter color or variable...'}
          />
        </div>
      </div>

      <div className="ext-preview-body">
        <div className="ext-hint-bar">
          <Sparkles size={12} />
          <span>
            {isJa
              ? 'スウォッチをクリックするとカラーピッカーで色を直接変更できます'
              : 'Click any color swatch to pick a new color and update the stylesheet'}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="ext-empty-cell">
            {isJa ? 'カラーコードが見つかりません' : 'No color tokens found'}
          </div>
        ) : (
          <div className="ext-swatch-grid">
            {filtered.map((token, idx) => (
              <div key={`${token.from}-${idx}`} className="ext-swatch-card">
                <label
                  className="ext-swatch-preview"
                  style={{ backgroundColor: token.color }}
                  title={isJa ? 'クリックして色を変更' : 'Click to change color'}
                >
                  {onUpdateContent && (
                    <input
                      type="color"
                      className="ext-hidden-color-input"
                      value={toPickerHex(token.color)}
                      onChange={(e) => handleReplaceColor(token, e.target.value)}
                    />
                  )}
                </label>
                <div className="ext-swatch-info">
                  <div className="ext-swatch-code">{token.color}</div>
                  {token.variableName && (
                    <div className="ext-swatch-var">{token.variableName}</div>
                  )}
                  <div className="ext-swatch-meta">
                    <button
                      type="button"
                      className="ext-link-btn"
                      onClick={() => onJumpToLine?.(token.line)}
                    >
                      Line {token.line}
                    </button>
                    <button
                      type="button"
                      className="ext-icon-btn"
                      onClick={() => {
                        void writeClipboardText(token.color);
                        onCopyNotify();
                      }}
                      title={isJa ? 'コピー' : 'Copy'}
                    >
                      <ClipboardCopy size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
