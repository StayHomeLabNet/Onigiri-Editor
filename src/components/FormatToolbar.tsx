import React from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  FileCode,
  Link,
  ImagePlus,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Table,
  Minus,
  Heading1,
  Heading2,
  Heading3,
  Undo2,
  Redo2,
  Sparkles,
  Sigma,
  GitFork,
  MessageSquareQuote,
  ClipboardCopy,
  Search,
  TextSelect,
  Copy,
  ClipboardPaste,
  ZoomOut,
  ZoomIn,
} from 'lucide-react';
import type { AppMode } from '../types';
import type { Translations } from '../i18n/types';
import { formatShortcut } from '../utils/platform';

interface FormatToolbarProps {
  t: Translations;
  mode: AppMode;
  onAction: (action: string) => void;
}

export const FormatToolbar: React.FC<FormatToolbarProps> = ({ t, mode, onAction }) => {
  const keepFocusMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
  };

  return (
    <div className="format-toolbar">
      <div className="tb-group">
        <button type="button" className="tb-btn" onClick={() => onAction('undo')} title={t.actions.undo}>
          <Undo2 size={15} />
        </button>
        <button type="button" className="tb-btn" onClick={() => onAction('redo')} title={t.actions.redo}>
          <Redo2 size={15} />
        </button>
      </div>

      <span className="tb-sep" />

      <div className="tb-group">
        <button
          type="button"
          className="tb-btn"
          onMouseDown={keepFocusMouseDown}
          onClick={() => onAction('selectAll')}
          title={`${t.actions.selectAll} (${formatShortcut('⌘A')})`}
        >
          <TextSelect size={15} />
        </button>
        <button
          type="button"
          className="tb-btn"
          onMouseDown={keepFocusMouseDown}
          onClick={() => onAction('copy')}
          title={`${t.actions.copy} (${formatShortcut('⌘C')})`}
        >
          <Copy size={15} />
        </button>
        <button
          type="button"
          className="tb-btn"
          onMouseDown={keepFocusMouseDown}
          onClick={() => onAction('paste')}
          title={`${t.actions.paste} (${formatShortcut('⌘V')})`}
        >
          <ClipboardPaste size={15} />
        </button>
      </div>

      <span className="tb-sep" />

      <div className="tb-group">
        <button type="button" className="tb-btn" onClick={() => onAction('h1')} title={t.toolbar.heading1}>
          <Heading1 size={15} />
        </button>
        <button type="button" className="tb-btn" onClick={() => onAction('h2')} title={t.toolbar.heading2}>
          <Heading2 size={15} />
        </button>
        {mode === 'advanced' && (
          <button type="button" className="tb-btn" onClick={() => onAction('h3')} title={t.toolbar.heading3}>
            <Heading3 size={15} />
          </button>
        )}
      </div>

      <span className="tb-sep" />

      <div className="tb-group">
        <button type="button" className="tb-btn" onClick={() => onAction('bold')} title={`${t.toolbar.bold} (${formatShortcut('⌘B')})`}>
          <Bold size={15} />
        </button>
        <button type="button" className="tb-btn" onClick={() => onAction('italic')} title={`${t.toolbar.italic} (${formatShortcut('⌘I')})`}>
          <Italic size={15} />
        </button>
        {mode === 'advanced' && (
          <button type="button" className="tb-btn" onClick={() => onAction('strike')} title={t.toolbar.strikethrough}>
            <Strikethrough size={15} />
          </button>
        )}
        <button type="button" className="tb-btn" onClick={() => onAction('code')} title={t.toolbar.inlineCode}>
          <Code size={15} />
        </button>
        <button type="button" className="tb-btn" onClick={() => onAction('codeblock')} title={t.toolbar.codeBlock}>
          <FileCode size={15} />
        </button>
        <button type="button" className="tb-btn" onClick={() => onAction('link')} title={t.toolbar.link}>
          <Link size={15} />
        </button>
        <button type="button" className="tb-btn" onClick={() => onAction('image')} title={t.toolbar.image}>
          <ImagePlus size={15} />
        </button>
      </div>

      <span className="tb-sep" />

      <div className="tb-group">
        <button type="button" className="tb-btn" onClick={() => onAction('ul')} title={t.toolbar.bulletList}>
          <List size={15} />
        </button>
        {mode === 'advanced' && (
          <button type="button" className="tb-btn" onClick={() => onAction('ol')} title={t.toolbar.numberedList}>
            <ListOrdered size={15} />
          </button>
        )}
        <button type="button" className="tb-btn" onClick={() => onAction('task')} title={t.toolbar.taskList}>
          <ListTodo size={15} />
        </button>
        <button type="button" className="tb-btn" onClick={() => onAction('quote')} title={t.toolbar.quote}>
          <Quote size={15} />
        </button>
        <button type="button" className="tb-btn" onClick={() => onAction('table')} title={t.toolbar.table}>
          <Table size={15} />
        </button>
        {mode === 'advanced' && (
          <button type="button" className="tb-btn" onClick={() => onAction('hr')} title={t.toolbar.hr}>
            <Minus size={15} />
          </button>
        )}
      </div>

      {mode === 'advanced' && (
        <>
          <span className="tb-sep" />
          <div className="tb-group">
            <button type="button" className="tb-btn" onClick={() => onAction('math')} title={t.toolbar.math}>
              <Sigma size={15} />
            </button>
            <button type="button" className="tb-btn" onClick={() => onAction('mermaid')} title={t.toolbar.mermaid}>
              <GitFork size={15} />
            </button>
            <button type="button" className="tb-btn" onClick={() => onAction('callout')} title={t.toolbar.callout}>
              <MessageSquareQuote size={15} />
            </button>
          </div>
        </>
      )}

      <div className="tb-spacer" />

      <div className="tb-group">
        {mode === 'advanced' && (
          <>
            <button
              type="button"
              className="tb-pill"
              onClick={() => onAction('aiClean')}
              title={t.toolbar.aiClean}
            >
              <Sparkles size={13} />
              <span>{t.toolbar.aiClean}</span>
            </button>
            <button
              type="button"
              className="tb-pill"
              onClick={() => onAction('copyRich')}
              title={t.actions.copyRichText}
            >
              <ClipboardCopy size={13} />
              <span className="hide-md">{t.actions.copyRichText}</span>
            </button>
            <span className="tb-sep" />
          </>
        )}
        <button
          type="button"
          className="tb-btn"
          onMouseDown={keepFocusMouseDown}
          onClick={() => onAction('zoomOut')}
          title={`${t.actions.zoomOut} (${formatShortcut('⌘-')})`}
        >
          <ZoomOut size={15} />
        </button>
        <button
          type="button"
          className="tb-btn"
          onMouseDown={keepFocusMouseDown}
          onClick={() => onAction('zoomIn')}
          title={`${t.actions.zoomIn} (${formatShortcut('⌘+')})`}
        >
          <ZoomIn size={15} />
        </button>
        <span className="tb-sep" />
        <button
          type="button"
          className="tb-btn"
          onClick={() => onAction('find')}
          title={`${t.actions.findReplace} (${formatShortcut('⌘F')})`}
        >
          <Search size={15} />
        </button>
      </div>
    </div>
  );
};
