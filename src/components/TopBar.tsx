import React from 'react';
import {
  FilePlus2,
  FolderOpen,
  FileCode2,
  Save,
  Columns2,
  PenLine,
  Eye,
  PanelLeft,
  PanelRight,
  Sparkles,
  Sun,
  Moon,
  BookOpen,
  MoonStar,
  Command,
  Maximize2,
  Download,
  Languages,
  Info,
} from 'lucide-react';
import type { AppMode, Locale, ThemeId, ViewLayout } from '../types';
import type { Translations } from '../i18n/types';

interface TopBarProps {
  t: Translations;
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  layout: ViewLayout;
  onLayoutChange: (layout: ViewLayout) => void;
  theme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  showSidebar: boolean;
  onToggleSidebar: () => void;
  showInspector: boolean;
  onToggleInspector: () => void;
  onNewFile: () => void;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onSave: () => void;
  onExportHtml: () => void;
  onExportPdf: () => void;
  onOpenCommandPalette: () => void;
  onToggleZen: () => void;
  onOpenAbout: () => void;
  isDirty: boolean;
  activeTitle: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  t,
  mode,
  onModeChange,
  layout,
  onLayoutChange,
  theme,
  onThemeChange,
  locale,
  onLocaleChange,
  showSidebar,
  onToggleSidebar,
  showInspector,
  onToggleInspector,
  onNewFile,
  onOpenFile,
  onOpenFolder,
  onSave,
  onExportHtml,
  onExportPdf,
  onOpenCommandPalette,
  onToggleZen,
  onOpenAbout,
  isDirty,
  activeTitle,
}) => {
  const nextTheme = (): ThemeId => {
    const order: ThemeId[] = ['light', 'dark', 'sepia', 'midnight'];
    const idx = order.indexOf(theme);
    return order[(idx + 1) % order.length];
  };

  const ThemeIcon =
    theme === 'light' ? Sun : theme === 'sepia' ? BookOpen : theme === 'midnight' ? MoonStar : Moon;

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="brand-btn"
          onClick={onOpenAbout}
          title={t.actions.about}
        >
          <img src="/icon.png" alt="Onigiri-Markdown" className="brand-icon" />
          <span className="brand-name">{t.appName}</span>
          <span className="version-pill">{t.versionLabel}</span>
        </button>

        {mode === 'advanced' && (
          <button
            type="button"
            className={`icon-btn ${showSidebar ? 'is-active' : ''}`}
            onClick={onToggleSidebar}
            title={t.actions.sidebar}
          >
            <PanelLeft size={16} />
          </button>
        )}

        <div className="topbar-group">
          <button
            type="button"
            className="icon-btn"
            onClick={onNewFile}
            title={`${t.actions.newFile} (⌘N)`}
          >
            <FilePlus2 size={16} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onOpenFile}
            title={`${t.actions.openFile} (⌘O)`}
          >
            <FileCode2 size={16} />
          </button>
          {mode === 'advanced' && (
            <button
              type="button"
              className="icon-btn"
              onClick={onOpenFolder}
              title={t.actions.openFolder}
            >
              <FolderOpen size={16} />
            </button>
          )}
          <button
            type="button"
            className={`icon-btn ${isDirty ? 'is-accent' : ''}`}
            onClick={onSave}
            title={`${t.actions.save} (⌘S)`}
          >
            <Save size={16} />
          </button>
        </div>

        {mode === 'basic' && (
          <span className="basic-doc-title" title={activeTitle}>
            {activeTitle}
            {isDirty ? <span className="dirty-dot" /> : null}
          </span>
        )}
      </div>

      <div className="topbar-center">
        <div className="segmented-control mode-switch" role="tablist">
          <button
            type="button"
            className={`seg-btn ${mode === 'basic' ? 'is-active' : ''}`}
            onClick={() => onModeChange('basic')}
            title={t.modes.basicHint}
          >
            {t.modes.basic}
          </button>
          <button
            type="button"
            className={`seg-btn ${mode === 'advanced' ? 'is-active' : ''}`}
            onClick={() => onModeChange('advanced')}
            title={t.modes.advancedHint}
          >
            <Sparkles size={13} />
            {t.modes.advanced}
          </button>
        </div>

        <div className="segmented-control layout-switch">
          <button
            type="button"
            className={`seg-btn ${layout === 'editor' ? 'is-active' : ''}`}
            onClick={() => onLayoutChange('editor')}
            title={t.layouts.editor}
          >
            <PenLine size={14} />
            <span className="hide-sm">{t.layouts.editor}</span>
          </button>
          <button
            type="button"
            className={`seg-btn ${layout === 'split' ? 'is-active' : ''}`}
            onClick={() => onLayoutChange('split')}
            title={t.layouts.split}
          >
            <Columns2 size={14} />
            <span className="hide-sm">{t.layouts.split}</span>
          </button>
          <button
            type="button"
            className={`seg-btn ${layout === 'preview' ? 'is-active' : ''}`}
            onClick={() => onLayoutChange('preview')}
            title={t.layouts.preview}
          >
            <Eye size={14} />
            <span className="hide-sm">{t.layouts.preview}</span>
          </button>
        </div>
      </div>

      <div className="topbar-right">
        {mode === 'advanced' && (
          <>
            <button
              type="button"
              className="pill-btn"
              onClick={onOpenCommandPalette}
              title={`${t.actions.commandPalette} (⌘K)`}
            >
              <Command size={13} />
              <span>K</span>
            </button>
            <div className="dropdown-wrapper">
              <button type="button" className="icon-btn" title={t.actions.exportHtml}>
                <Download size={16} />
              </button>
              <div className="dropdown-menu">
                <button type="button" onClick={onExportHtml}>
                  {t.actions.exportHtml}
                </button>
                <button type="button" onClick={onExportPdf}>
                  {t.actions.exportPdf}
                </button>
              </div>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={onToggleZen}
              title={`${t.actions.zenMode} (⌘⇧F)`}
            >
              <Maximize2 size={15} />
            </button>
          </>
        )}

        <button
          type="button"
          className="pill-btn"
          onClick={() => onThemeChange(nextTheme())}
          title={t.themes[theme]}
        >
          <ThemeIcon size={14} />
          <span className="hide-md">{t.themes[theme]}</span>
        </button>

        <button
          type="button"
          className="pill-btn"
          onClick={() => onLocaleChange(locale === 'ja' ? 'en' : 'ja')}
          title="Switch Language (日本語 / English)"
        >
          <Languages size={14} />
          <span>{locale === 'ja' ? '日本語' : 'EN'}</span>
        </button>

        {mode === 'advanced' ? (
          <button
            type="button"
            className={`icon-btn ${showInspector ? 'is-active' : ''}`}
            onClick={onToggleInspector}
            title={t.actions.inspector}
          >
            <PanelRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            className="icon-btn"
            onClick={onOpenAbout}
            title={t.actions.about}
          >
            <Info size={16} />
          </button>
        )}
      </div>
    </header>
  );
};
