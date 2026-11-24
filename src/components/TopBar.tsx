import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Compass,
} from 'lucide-react';
import type { AppMode, Locale, ThemeId, ViewLayout } from '../types';
import type { Translations } from '../i18n/types';
import { formatShortcut, isMacOs } from '../utils/platform';
import {
  computeNextTopBarLevel,
  DEFAULT_TOPBAR_SAVED_WIDTHS,
  measureFlexChildrenNaturalWidth,
  type TopBarCollapseLevel,
  type TopBarSavedWidths,
} from '../utils/toolbarLayout';

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
  onOpenExportOptions?: (initialMode: 'html' | 'pdf') => void;
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
  onOpenFeatureGuide?: () => void;
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
  onOpenExportOptions,
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
  onOpenFeatureGuide,
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
  const topbarRef = useRef<HTMLElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const themeBtnRef = useRef<HTMLButtonElement>(null);
  const localeBtnRef = useRef<HTMLButtonElement>(null);
  const layoutSwitchRef = useRef<HTMLDivElement>(null);

  const [collapseLevel, setCollapseLevel] = useState<TopBarCollapseLevel>(0);
  const savedWidthsRef = useRef<TopBarSavedWidths>({ ...DEFAULT_TOPBAR_SAVED_WIDTHS });
  const hasLayoutSwitch = mode !== 'simple';

  const evaluateLayout = useCallback(() => {
    const header = topbarRef.current;
    if (!header) return;

    const headerStyle = window.getComputedStyle(header);
    const padL = parseFloat(headerStyle.paddingLeft || '0') || 0;
    const padR = parseFloat(headerStyle.paddingRight || '0') || 0;
    const gap = parseFloat(headerStyle.columnGap || headerStyle.gap || '0') || 0;
    const availableWidth = header.clientWidth - padL - padR - gap * 2;
    if (availableWidth <= 0) return;

    const leftWidth = measureFlexChildrenNaturalWidth(leftRef.current);
    const centerWidth = measureFlexChildrenNaturalWidth(centerRef.current);
    const rightWidth = measureFlexChildrenNaturalWidth(rightRef.current);

    setCollapseLevel((prev) => {
      const next = computeNextTopBarLevel(
        prev,
        { availableWidth, leftWidth, centerWidth, rightWidth },
        savedWidthsRef.current,
        hasLayoutSwitch
      );

      // Record actual saved width right before collapsing a stage
      if (next > prev) {
        if (prev < 2 && next >= 2) {
          const themeW = themeBtnRef.current?.getBoundingClientRect().width ?? 0;
          const localeW = localeBtnRef.current?.getBoundingClientRect().width ?? 0;
          const delta = Math.max(0, themeW - 28) + Math.max(0, localeW - 28);
          if (delta > 16) savedWidthsRef.current[2] = Math.ceil(delta);
        }
        if (prev < 3 && next >= 3 && layoutSwitchRef.current) {
          const labels = layoutSwitchRef.current.querySelectorAll('.topbar-layout-label');
          let labelDelta = 0;
          labels.forEach((el) => {
            const w = el.getBoundingClientRect().width;
            if (w > 0) labelDelta += w + 5;
          });
          if (labelDelta > 16) savedWidthsRef.current[3] = Math.ceil(labelDelta);
        }
      }

      return next;
    });
  }, [hasLayoutSwitch]);

  useEffect(() => {
    const el = topbarRef.current;
    if (!el) return;

    const rafId = window.requestAnimationFrame(evaluateLayout);

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => evaluateLayout());
      ro.observe(el);
      return () => {
        window.cancelAnimationFrame(rafId);
        ro.disconnect();
      };
    }

    window.addEventListener('resize', evaluateLayout);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', evaluateLayout);
    };
  }, [evaluateLayout]);

  // Re-evaluate after a level change or content change so multi-step collapses settle smoothly
  useEffect(() => {
    const rafId = window.requestAnimationFrame(evaluateLayout);
    return () => window.cancelAnimationFrame(rafId);
  }, [collapseLevel, mode, locale, theme, updateAvailableVersion, updateReadyToInstall, isMarkdown, evaluateLayout]);

  const nextTheme = (): ThemeId => {
    const order: ThemeId[] = ['light', 'dark', 'sepia', 'midnight'];
    const idx = order.indexOf(theme);
    return order[(idx + 1) % order.length];
  };

  const ThemeIcon =
    theme === 'light' ? Sun : theme === 'sepia' ? BookOpen : theme === 'midnight' ? MoonStar : Moon;

  const isRelaxedCenter = collapseLevel >= 1;
  const isRightLabelsHidden = collapseLevel >= 2;
  const isLayoutLabelsHidden = collapseLevel >= 3;
  const isVersionHidden = collapseLevel >= 4;

  const themeTooltip =
    locale === 'ja' ? `テーマ: ${t.themes[theme]}` : `Theme: ${t.themes[theme]}`;
  const localeTooltip =
    locale === 'ja' ? '言語切替 (日本語 / English)' : 'Switch Language (English / 日本語)';

  return (
    <header
      ref={topbarRef}
      className={[
        'topbar',
        isRelaxedCenter ? 'is-relaxed-center' : '',
        isLayoutLabelsHidden ? 'is-layout-compact' : '',
        isVersionHidden ? 'is-version-hidden' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="topbar-left" ref={leftRef}>
        <button
          type="button"
          className="brand-btn"
          onClick={onOpenAbout}
          data-tooltip={t.actions.about}
          aria-label={t.actions.about}
        >
          <img src="/icon.png" alt="Onigiri Editor" className="brand-icon" />
          <span className="brand-name">{t.appName}</span>
        </button>

        {updateAvailableVersion && onOpenUpdateModal && (
          <button
            type="button"
            className={`topbar-update-pill ${updateReadyToInstall ? 'is-ready' : ''}`}
            onClick={onOpenUpdateModal}
            data-tooltip={t.updates.availableBannerTitle.replace('{version}', updateAvailableVersion)}
            aria-label={t.updates.availableBannerTitle.replace('{version}', updateAvailableVersion)}
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
            data-tooltip={t.actions.sidebar}
            aria-label={t.actions.sidebar}
          >
            <PanelLeft size={16} />
          </button>
        )}

        <div className="topbar-group">
          <button
            type="button"
            className="icon-btn"
            onClick={onNewFile}
            data-tooltip={t.actions.newFile}
            data-tooltip-shortcut={formatShortcut('⌘N')}
            aria-label={t.actions.newFile}
          >
            <FilePlus2 size={16} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onOpenFile}
            data-tooltip={t.actions.openFile}
            data-tooltip-shortcut={formatShortcut('⌘O')}
            aria-label={t.actions.openFile}
          >
            <FileCode2 size={16} />
          </button>
          {mode === 'advanced' && (
            <button
              type="button"
              className="icon-btn"
              onClick={onOpenFolder}
              data-tooltip={t.actions.openFolder}
              aria-label={t.actions.openFolder}
            >
              <FolderOpen size={16} />
            </button>
          )}
          <button
            type="button"
            className={`icon-btn ${isDirty ? 'is-accent' : ''}`}
            onClick={onSave}
            data-tooltip={t.actions.save}
            data-tooltip-shortcut={formatShortcut('⌘S')}
            aria-label={t.actions.save}
          >
            <Save size={16} />
          </button>
        </div>

        {mode !== 'advanced' && (
          <span className="basic-doc-title" data-tooltip={activeTitle}>
            {activeTitle}
            {isDirty ? <span className="dirty-dot" /> : null}
          </span>
        )}
      </div>

      <div className="topbar-center" ref={centerRef}>
        <div className="segmented-control mode-switch" role="tablist">
          <button
            type="button"
            className={`seg-btn ${mode === 'simple' ? 'is-active' : ''}`}
            onClick={() => onModeChange('simple')}
            data-tooltip={t.modes.simpleHint}
            aria-label={t.modes.simple}
          >
            {t.modes.simple}
          </button>
          <button
            type="button"
            className={`seg-btn ${mode === 'basic' ? 'is-active' : ''}`}
            onClick={() => onModeChange('basic')}
            data-tooltip={t.modes.basicHint}
            aria-label={t.modes.basic}
          >
            {t.modes.basic}
          </button>
          <button
            type="button"
            className={`seg-btn ${mode === 'advanced' ? 'is-active' : ''}`}
            onClick={() => onModeChange('advanced')}
            data-tooltip={t.modes.advancedHint}
            aria-label={t.modes.advanced}
          >
            <Sparkles size={13} />
            {t.modes.advanced}
          </button>
        </div>

        {mode !== 'simple' && (
          <div className="segmented-control layout-switch" ref={layoutSwitchRef}>
            <button
              type="button"
              className={`seg-btn ${layout === 'editor' ? 'is-active' : ''}`}
              onClick={() => onLayoutChange('editor')}
              data-tooltip={t.layouts.editor}
              aria-label={t.layouts.editor}
            >
              <PenLine size={14} />
              <span className="topbar-layout-label">{t.layouts.editor}</span>
            </button>
            <button
              type="button"
              className={`seg-btn ${layout === 'split' ? 'is-active' : ''}`}
              onClick={() => onLayoutChange('split')}
              data-tooltip={t.layouts.split}
              aria-label={t.layouts.split}
            >
              <Columns2 size={14} />
              <span className="topbar-layout-label">{t.layouts.split}</span>
            </button>
            <button
              type="button"
              className={`seg-btn ${layout === 'preview' ? 'is-active' : ''}`}
              onClick={() => onLayoutChange('preview')}
              data-tooltip={t.layouts.preview}
              aria-label={t.layouts.preview}
            >
              <Eye size={14} />
              <span className="topbar-layout-label">{t.layouts.preview}</span>
            </button>
          </div>
        )}
      </div>

      <div className="topbar-right" ref={rightRef}>
        {mode === 'advanced' && (
          <>
            <button
              type="button"
              className="pill-btn"
              onClick={onOpenCommandPalette}
              data-tooltip={t.actions.commandPalette}
              data-tooltip-shortcut={formatShortcut('⌘K')}
              aria-label={t.actions.commandPalette}
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
                <button
                  type="button"
                  className="icon-btn"
                  data-tooltip={t.actions.newFromTemplate}
                  aria-label={t.actions.newFromTemplate}
                >
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
                data-tooltip={t.actions.slidePresentation}
                aria-label={t.actions.slidePresentation}
              >
                <Presentation size={15} />
              </button>
            )}
            <div className="dropdown-wrapper">
              <button
                type="button"
                className="icon-btn"
                data-tooltip={t.actions.exportHtml}
                aria-label={t.actions.exportHtml}
              >
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
                {onOpenExportOptions && (
                  <button type="button" onClick={() => onOpenExportOptions('pdf')}>
                    {locale === 'ja' ? 'ページ設定して書き出し (PDF / HTML)...' : 'Page Setup & Export (PDF / HTML)...'}
                  </button>
                )}
              </div>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={onToggleZen}
              data-tooltip={t.actions.zenMode}
              data-tooltip-shortcut={formatShortcut('⌘⇧F')}
              aria-label={t.actions.zenMode}
            >
              <Maximize2 size={15} />
            </button>
          </>
        )}

        <button
          ref={themeBtnRef}
          type="button"
          className={`pill-btn topbar-theme-btn ${isRightLabelsHidden ? 'is-icon-only' : ''}`}
          onClick={() => onThemeChange(nextTheme())}
          data-tooltip={themeTooltip}
          aria-label={themeTooltip}
        >
          <ThemeIcon size={14} />
          <span className="topbar-btn-label">{t.themes[theme]}</span>
        </button>

        <button
          ref={localeBtnRef}
          type="button"
          className={`pill-btn topbar-locale-btn ${isRightLabelsHidden ? 'is-icon-only' : ''}`}
          onClick={() => onLocaleChange(locale === 'ja' ? 'en' : 'ja')}
          data-tooltip={localeTooltip}
          aria-label={localeTooltip}
        >
          <Languages size={14} />
          <span className="topbar-btn-label">{locale === 'ja' ? '日本語' : 'EN'}</span>
        </button>

        {onOpenFeatureGuide && (
          <button
            type="button"
            className="icon-btn"
            onClick={onOpenFeatureGuide}
            data-tooltip={locale === 'ja' ? '機能を探すガイド' : 'Feature Finder Guide'}
            aria-label={locale === 'ja' ? '機能を探すガイド' : 'Feature Finder Guide'}
          >
            <Compass size={15} />
          </button>
        )}

        <button
          type="button"
          className="icon-btn"
          onClick={onOpenSettings}
          data-tooltip={t.actions.settings}
          data-tooltip-shortcut={formatShortcut('⌘,')}
          aria-label={t.actions.settings}
        >
          <Settings size={15} />
        </button>

        {mode !== 'simple' && (
          <button
            type="button"
            className={`pill-btn options-toggle-btn ${showInspector ? 'is-active' : ''}`}
            onClick={onToggleInspector}
            data-tooltip={t.actions.optionsPanel}
            aria-label={t.actions.optionsPanel}
          >
            <Bot size={14} />
            <PanelRight size={14} />
          </button>
        )}
      </div>
    </header>
  );
};
