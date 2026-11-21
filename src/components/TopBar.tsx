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
  Bot,
  Settings,
  Presentation,
  CalendarDays,
  FileStack,
  Globe,
  TextSearch,
  Focus,
  Wrench,
  BookMarked,
  Network,
  Images,
} from 'lucide-react';
import type { AppMode, Locale, ThemeId, ViewLayout } from '../types';
import type { Translations } from '../i18n/types';
import { formatShortcut, isMacOs } from '../utils/platform';

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
  onExportDocx?: () => void;
  onOpenCommandPalette: () => void;
  onToggleZen: () => void;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
  onOpenSlidePresentation?: () => void;
  onOpenDailyNote?: () => void;
  onOpenTemplateModal?: () => void;
  onOpenWebClip?: () => void;
  onOpenWorkspaceGrep?: () => void;
  onOpenCitationModal?: () => void;
  onOpenKnowledgeGraph?: () => void;
  onOpenUnusedAssets?: () => void;
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
  isMarkdown?: boolean;
  isDirty: boolean;
  activeTitle: string;
  updateAvailableVersion?: string | null;
  updateReadyToInstall?: boolean;
  onOpenUpdateModal?: () => void;
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
  onExportDocx,
  onOpenCommandPalette,
  onToggleZen,
  onOpenSettings,
  onOpenAbout,
  onOpenSlidePresentation,
  onOpenDailyNote,
  onOpenTemplateModal,
  onOpenWebClip,
  onOpenWorkspaceGrep,
  onOpenCitationModal,
  onOpenKnowledgeGraph,
  onOpenUnusedAssets,
  focusMode,
  onToggleFocusMode,
  isMarkdown = true,
  isDirty,
  activeTitle,
  updateAvailableVersion,
  updateReadyToInstall,
  onOpenUpdateModal,
}) => {
  const isMac = isMacOs();
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
          <img src="/icon.png" alt="Onigiri Editor" className="brand-icon" />
          <span className="brand-name">{t.appName}</span>
          <span className="version-pill">{t.versionLabel}</span>
        </button>

        {updateAvailableVersion && onOpenUpdateModal && (
          <button
            type="button"
            className={`topbar-update-pill ${updateReadyToInstall ? 'is-ready' : ''}`}
            onClick={onOpenUpdateModal}
            title={t.updates.availableBannerTitle.replace('{version}', updateAvailableVersion)}
          >
            <Download size={11} />
            <span>
              {updateReadyToInstall
                ? t.updates.statusBadgeReady.replace('{version}', updateAvailableVersion)
                : t.updates.statusBadgeAvailable.replace('{version}', updateAvailableVersion)}
            </span>
          </button>
        )}

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
            title={`${t.actions.newFile} (${formatShortcut('⌘N')})`}
          >
            <FilePlus2 size={16} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onOpenFile}
            title={`${t.actions.openFile} (${formatShortcut('⌘O')})`}
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
            title={`${t.actions.save} (${formatShortcut('⌘S')})`}
          >
            <Save size={16} />
          </button>
        </div>

        {mode !== 'advanced' && (
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
            className={`seg-btn ${mode === 'simple' ? 'is-active' : ''}`}
            onClick={() => onModeChange('simple')}
            title={t.modes.simpleHint}
          >
            {t.modes.simple}
          </button>
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

        {mode !== 'simple' && (
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
        )}
      </div>

      <div className="topbar-right">
        {mode === 'advanced' && (
          <>
            <button
              type="button"
              className="pill-btn"
              onClick={onOpenCommandPalette}
              title={`${t.actions.commandPalette} (${formatShortcut('⌘K')})`}
            >
              {isMac ? <Command size={13} /> : <span>Ctrl+</span>}
              <span>K</span>
            </button>
            {(onOpenSlidePresentation ||
              onOpenDailyNote ||
              onOpenTemplateModal ||
              onOpenWebClip ||
              onOpenWorkspaceGrep ||
              onOpenCitationModal ||
              onOpenKnowledgeGraph ||
              onOpenUnusedAssets ||
              onToggleFocusMode) && (
              <div className="dropdown-wrapper">
                <button type="button" className="icon-btn" title={t.actions.newFromTemplate}>
                  <Wrench size={15} />
                </button>
                <div className="dropdown-menu">
                  {onOpenDailyNote && (
                    <button type="button" onClick={onOpenDailyNote}>
                      <CalendarDays size={13} />
                      <span>{t.actions.openDailyNote}</span>
                    </button>
                  )}
                  {onOpenTemplateModal && (
                    <button type="button" onClick={onOpenTemplateModal}>
                      <FileStack size={13} />
                      <span>{t.actions.newFromTemplate}</span>
                    </button>
                  )}
                  {onOpenWebClip && (
                    <button type="button" onClick={onOpenWebClip}>
                      <Globe size={13} />
                      <span>{t.actions.webClipUrl}</span>
                    </button>
                  )}
                  {onOpenCitationModal && (
                    <button type="button" onClick={onOpenCitationModal}>
                      <BookMarked size={13} />
                      <span>{t.actions.insertCitation}</span>
                    </button>
                  )}
                  {onOpenWorkspaceGrep && (
                    <button type="button" onClick={onOpenWorkspaceGrep}>
                      <TextSearch size={13} />
                      <span>{t.actions.workspaceGrep}</span>
                    </button>
                  )}
                  {onOpenKnowledgeGraph && (
                    <button type="button" onClick={onOpenKnowledgeGraph}>
                      <Network size={13} />
                      <span>{t.actions.knowledgeGraph}</span>
                    </button>
                  )}
                  {onOpenUnusedAssets && (
                    <button type="button" onClick={onOpenUnusedAssets}>
                      <Images size={13} />
                      <span>{t.actions.findUnusedAssets}</span>
                    </button>
                  )}
                  {onOpenSlidePresentation && isMarkdown && (
                    <button type="button" onClick={onOpenSlidePresentation}>
                      <Presentation size={13} />
                      <span>{t.actions.slidePresentation}</span>
                    </button>
                  )}
                  {onToggleFocusMode && (
                    <button type="button" onClick={onToggleFocusMode}>
                      <Focus size={13} />
                      <span>
                        {t.actions.toggleFocusMode} {focusMode ? '✓' : ''}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}
            {onOpenSlidePresentation && isMarkdown && (
              <button
                type="button"
                className="icon-btn"
                onClick={onOpenSlidePresentation}
                title={t.actions.slidePresentation}
              >
                <Presentation size={15} />
              </button>
            )}
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
                {onExportDocx && (
                  <button type="button" onClick={onExportDocx}>
                    {t.actions.exportDocx}
                  </button>
                )}
              </div>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={onToggleZen}
              title={`${t.actions.zenMode} (${formatShortcut('⌘⇧F')})`}
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

        <button
          type="button"
          className="icon-btn"
          onClick={onOpenSettings}
          title={`${t.actions.settings} (${formatShortcut('⌘,')})`}
        >
          <Settings size={15} />
        </button>

        {mode !== 'simple' && (
          <button
            type="button"
            className={`pill-btn options-toggle-btn ${showInspector ? 'is-active' : ''}`}
            onClick={onToggleInspector}
            title={t.actions.optionsPanel}
          >
            <Bot size={14} />
            <PanelRight size={14} />
          </button>
        )}
      </div>
    </header>
  );
};
