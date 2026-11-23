import React from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownAZ,
  ArrowUpZA,
  Columns2,
  Rows2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { Locale } from '../../types';
import type { TableAlignment, TableEditOperation } from '../../utils/markdownTable';

interface MarkdownTableBarProps {
  locale: Locale;
  currentAlignment: TableAlignment;
  rowCount: number;
  colCount: number;
  canDeleteRow: boolean;
  canDeleteCol: boolean;
  onOp: (op: TableEditOperation) => void;
}

export const MarkdownTableBar: React.FC<MarkdownTableBarProps> = ({
  locale,
  currentAlignment,
  rowCount,
  colCount,
  canDeleteRow,
  canDeleteCol,
  onOp,
}) => {
  const ja = locale === 'ja';
  const keepFocus = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
  };

  return (
    <div
      className="md-table-bar"
      role="toolbar"
      aria-label={ja ? 'Markdownテーブル編集バー' : 'Markdown Table Toolbar'}
    >
      <span className="md-table-bar-badge">
        {ja ? `表 ${rowCount}×${colCount}` : `Table ${rowCount}×${colCount}`}
      </span>

      <span className="md-table-bar-sep" />

      <button
        type="button"
        className="md-table-bar-btn"
        onMouseDown={keepFocus}
        onClick={() => onOp('addRowAbove')}
        data-tooltip={ja ? '上に行を追加' : 'Insert Row Above'}
      >
        <Rows2 size={12} />
        <span>+↑</span>
      </button>
      <button
        type="button"
        className="md-table-bar-btn"
        onMouseDown={keepFocus}
        onClick={() => onOp('addRowBelow')}
        data-tooltip={ja ? '下に行を追加' : 'Insert Row Below'}
      >
        <Rows2 size={12} />
        <span>+↓</span>
      </button>
      <button
        type="button"
        className="md-table-bar-btn"
        disabled={!canDeleteRow}
        onMouseDown={keepFocus}
        onClick={() => onOp('deleteRow')}
        data-tooltip={ja ? '現在行を削除' : 'Delete Row'}
      >
        <Trash2 size={12} />
        <span>{ja ? '行' : 'Row'}</span>
      </button>

      <span className="md-table-bar-sep" />

      <button
        type="button"
        className="md-table-bar-btn"
        onMouseDown={keepFocus}
        onClick={() => onOp('addColLeft')}
        data-tooltip={ja ? '左に列を追加' : 'Insert Column Left'}
      >
        <Columns2 size={12} />
        <span>+←</span>
      </button>
      <button
        type="button"
        className="md-table-bar-btn"
        onMouseDown={keepFocus}
        onClick={() => onOp('addColRight')}
        data-tooltip={ja ? '右に列を追加' : 'Insert Column Right'}
      >
        <Columns2 size={12} />
        <span>+→</span>
      </button>
      <button
        type="button"
        className="md-table-bar-btn"
        disabled={!canDeleteCol}
        onMouseDown={keepFocus}
        onClick={() => onOp('deleteCol')}
        data-tooltip={ja ? '現在列を削除' : 'Delete Column'}
      >
        <Trash2 size={12} />
        <span>{ja ? '列' : 'Col'}</span>
      </button>

      <span className="md-table-bar-sep" />

      <button
        type="button"
        className={`md-table-bar-btn ${currentAlignment === 'left' ? 'is-active' : ''}`}
        onMouseDown={keepFocus}
        onClick={() => onOp('alignLeft')}
        data-tooltip={ja ? '左揃え' : 'Align Left'}
      >
        <AlignLeft size={12} />
      </button>
      <button
        type="button"
        className={`md-table-bar-btn ${currentAlignment === 'center' ? 'is-active' : ''}`}
        onMouseDown={keepFocus}
        onClick={() => onOp('alignCenter')}
        data-tooltip={ja ? '中央揃え' : 'Align Center'}
      >
        <AlignCenter size={12} />
      </button>
      <button
        type="button"
        className={`md-table-bar-btn ${currentAlignment === 'right' ? 'is-active' : ''}`}
        onMouseDown={keepFocus}
        onClick={() => onOp('alignRight')}
        data-tooltip={ja ? '右揃え' : 'Align Right'}
      >
        <AlignRight size={12} />
      </button>

      <span className="md-table-bar-sep" />

      <button
        type="button"
        className="md-table-bar-btn"
        onMouseDown={keepFocus}
        onClick={() => onOp('sortAsc')}
        data-tooltip={ja ? 'この列で昇順ソート' : 'Sort Column Ascending'}
      >
        <ArrowDownAZ size={13} />
      </button>
      <button
        type="button"
        className="md-table-bar-btn"
        onMouseDown={keepFocus}
        onClick={() => onOp('sortDesc')}
        data-tooltip={ja ? 'この列で降順ソート' : 'Sort Column Descending'}
      >
        <ArrowUpZA size={13} />
      </button>
      <button
        type="button"
        className="md-table-bar-btn"
        onMouseDown={keepFocus}
        onClick={() => onOp('format')}
        data-tooltip={ja ? '表の列幅を整形' : 'Format Table'}
      >
        <Sparkles size={12} />
      </button>
    </div>
  );
};
