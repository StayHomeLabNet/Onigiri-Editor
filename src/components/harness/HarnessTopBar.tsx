import React from 'react';
import {
  BookOpen,
  Bot,
  FolderOpen,
  GitBranch,
  Languages,
  Moon,
  MoonStar,
  PanelLeft,
  PanelRight,
  PenLine,
  Settings,
  Sun,
  Terminal,
} from 'lucide-react';
import { localeNames, localeShortLabels, SUPPORTED_LOCALES } from '../../i18n';
import type { Translations } from '../../i18n/types';
import type { Locale, ThemeId, WorkspaceSurface } from '../../types';
import { formatShortcut } from '../../utils/platform';

interface HarnessTopBarProps {
  t: Translations;
  surface: WorkspaceSurface;
  onSurfaceChange: (surface: WorkspaceSurface) => void;
  workspaceRoot: string | null;
  branch?: string | null;
  onChooseFolder: () => void;
  showSidebar: boolean;
  onToggleSidebar: () => void;
  showWorkbench: boolean;
  onToggleWorkbench: () => void;
  showTerminal: boolean;
  onToggleTerminal: () => void;
  theme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
}

export const HarnessTopBar: React.FC<HarnessTopBarProps> = ({
  t,
  surface,
  onSurfaceChange,
  workspaceRoot,
  branch,
  onChooseFolder,
  showSidebar,
  onToggleSidebar,
  showWorkbench,
  onToggleWorkbench,
  showTerminal,
  onToggleTerminal,
  theme,
  onThemeChange,
  locale,
  onLocaleChange,
  onOpenSettings,
  onOpenAbout,
}) => {
  const nextTheme = (): ThemeId => {
    const order: ThemeId[] = ['light', 'dark', 'sepia', 'midnight'];
    return order[(order.indexOf(theme) + 1) % order.length];
  };

  const ThemeIcon =
    theme === 'light'
      ? Sun
      : theme === 'sepia'
        ? BookOpen
        : theme === 'midnight'
          ? MoonStar
          : Moon;

  const folderLabel = workspaceRoot
    ? workspaceRoot.split(/[/\\]/).filter(Boolean).pop() || workspaceRoot
    : t.harness.openFolderBtn;

  return (
    <header className="harness-topbar">
      <div className="harness-topbar-left">
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

        <button
          type="button"
          className={`icon-btn ${showSidebar ? 'is-active' : ''}`}
          onClick={onToggleSidebar}
          data-tooltip={t.actions.sidebar}
          aria-label={t.actions.sidebar}
        >
          <PanelLeft size={16} />
        </button>

        <button
          type="button"
          className="harness-folder-pill"
          onClick={onChooseFolder}
          data-tooltip={workspaceRoot || t.harness.openFolderBtn}
        >
          <FolderOpen size={14} />
          <span>{folderLabel}</span>
        </button>

        {branch && (
          <span className="harness-branch-chip" title={branch}>
            <GitBranch size={11} />
            <span>{branch}</span>
          </span>
        )}
      </div>

      <div className="harness-topbar-center">
        <div className="topbar-surface-switch" role="tablist">
          <button
            type="button"
            className={`topbar-surface-btn ${surface === 'editor' ? 'is-active' : ''}`}
            onClick={() => onSurfaceChange('editor')}
            data-tooltip={formatShortcut('⌘⇧H')}
          >
            <PenLine size={13} />
            <span>{t.harness.editorLabel}</span>
          </button>
          <button
            type="button"
            className={`topbar-surface-btn ${surface === 'harness' ? 'is-active' : ''}`}
            onClick={() => onSurfaceChange('harness')}
            data-tooltip={t.harness.modeHint}
          >
            <Bot size={13} />
            <span>{t.harness.modeLabel}</span>
          </button>
        </div>
      </div>

      <div className="harness-topbar-right">
        <button
          type="button"
          className={`icon-btn ${showTerminal ? 'is-active' : ''}`}
          onClick={onToggleTerminal}
          data-tooltip="Terminal"
          aria-label="Terminal"
        >
          <Terminal size={15} />
        </button>

        <button
          type="button"
          className={`pill-btn ${showWorkbench ? 'is-active' : ''}`}
          onClick={onToggleWorkbench}
          data-tooltip={t.harness.toggleWorkbench}
          aria-label={t.harness.toggleWorkbench}
        >
          <PanelRight size={14} />
          <span>{t.harness.workbenchTitle}</span>
        </button>

        <button
          type="button"
          className="icon-btn"
          onClick={() => onThemeChange(nextTheme())}
          data-tooltip={`${t.actions.theme}: ${t.themes[theme]}`}
          aria-label={t.actions.theme}
        >
          <ThemeIcon size={15} />
        </button>

        <div className="dropdown-wrapper">
          <button
            type="button"
            className="pill-btn"
            data-tooltip={`${t.actions.language}: ${localeNames[locale]}`}
            aria-label={t.actions.language}
          >
            <Languages size={14} />
            <span>{localeShortLabels[locale] || locale}</span>
          </button>
          <div className="dropdown-menu dropdown-right">
            {SUPPORTED_LOCALES.map((loc) => (
              <button
                key={loc}
                type="button"
                className={loc === locale ? 'is-active' : undefined}
                onClick={() => onLocaleChange(loc)}
              >
                <span>{localeNames[loc]}</span>
                {loc === locale ? <span style={{ marginLeft: 'auto' }}>✓</span> : null}
              </button>
            ))}
          </div>
        </div>

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
      </div>
    </header>
  );
};
