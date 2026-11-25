import React, { Suspense, lazy } from 'react';
import type {
  AiProviderConfig,
  DocumentTab,
  EditorSettings,
  Locale,
  ProjectServerStatus,
  TextEncodingId,
  ThemeId,
  WorkspaceEntry,
} from '../types';
import type { Translations } from '../i18n/types';
import type { PaletteCommand } from './CommandPalette';
import type { SettingsModal as SettingsModalType, SettingsTab } from './SettingsModal';
import type { EncodingModalMode } from './EncodingModal';
import type { FolderSwitchGuardMode } from './FolderSwitchGuardModal';
import type { DiffPreviewRequest } from './AiDiffPreviewModal';
import type { WebClipModal as WebClipModalType } from './WebClipModal';
import type { TemplatePickerModal as TemplatePickerModalType } from './TemplatePickerModal';
import type { QuickOpenModal as QuickOpenModalType } from './QuickOpenModal';
import type { ExportOptionsModal as ExportOptionsModalType } from './ExportOptionsModal';
import type { KnowledgeGraphModal as KnowledgeGraphModalType } from './KnowledgeGraphModal';
import { UpdateModal, type UpdateModal as UpdateModalType } from './UpdateModal';
import { ExportOptionsModal } from './ExportOptionsModal';
import { ScratchpadModal } from './ScratchpadModal';
import { AiSendPreviewModal, type AiSendPreviewRequest } from './AiSendPreviewModal';
import { FeatureGuideModal } from './FeatureGuideModal';

const CommandPalette = lazy(() =>
  import('./CommandPalette').then((m) => ({ default: m.CommandPalette }))
);
const QuickOpenModal = lazy(() =>
  import('./QuickOpenModal').then((m) => ({ default: m.QuickOpenModal }))
);
const AboutModal = lazy(() =>
  import('./AboutModal').then((m) => ({ default: m.AboutModal }))
);
const ImageModal = lazy(() =>
  import('./ImageModal').then((m) => ({ default: m.ImageModal }))
);
const SettingsModal = lazy(() =>
  import('./SettingsModal').then((m) => ({ default: m.SettingsModal }))
);
const EncodingModal = lazy(() =>
  import('./EncodingModal').then((m) => ({ default: m.EncodingModal }))
);
const GoToLineModal = lazy(() =>
  import('./GoToLineModal').then((m) => ({ default: m.GoToLineModal }))
);
const InlineAiEditModal = lazy(() =>
  import('./InlineAiEditModal').then((m) => ({ default: m.InlineAiEditModal }))
);
const FolderSwitchGuardModal = lazy(() =>
  import('./FolderSwitchGuardModal').then((m) => ({ default: m.FolderSwitchGuardModal }))
);
const WorkspaceImageModal = lazy(() =>
  import('./WorkspaceImageModal').then((m) => ({ default: m.WorkspaceImageModal }))
);
const AiDiffPreviewModal = lazy(() =>
  import('./AiDiffPreviewModal').then((m) => ({ default: m.AiDiffPreviewModal }))
);
const SlidePresentationModal = lazy(() =>
  import('./SlidePresentationModal').then((m) => ({ default: m.SlidePresentationModal }))
);
const WorkspaceGrepModal = lazy(() =>
  import('./WorkspaceGrepModal').then((m) => ({ default: m.WorkspaceGrepModal }))
);
const TemplatePickerModal = lazy(() =>
  import('./TemplatePickerModal').then((m) => ({ default: m.TemplatePickerModal }))
);
const WebClipModal = lazy(() =>
  import('./WebClipModal').then((m) => ({ default: m.WebClipModal }))
);
const UnusedAssetsModal = lazy(() =>
  import('./UnusedAssetsModal').then((m) => ({ default: m.UnusedAssetsModal }))
);
const CitationModal = lazy(() =>
  import('./CitationModal').then((m) => ({ default: m.CitationModal }))
);
const KnowledgeGraphModal = lazy(() =>
  import('./KnowledgeGraphModal').then((m) => ({ default: m.KnowledgeGraphModal }))
);

type UpdateModalProps = React.ComponentProps<typeof UpdateModalType>;
type SettingsModalProps = React.ComponentProps<typeof SettingsModalType>;
type QuickOpenModalProps = React.ComponentProps<typeof QuickOpenModalType>;
type TemplatePickerModalProps = React.ComponentProps<typeof TemplatePickerModalType>;
type WebClipModalProps = React.ComponentProps<typeof WebClipModalType>;
type KnowledgeGraphModalProps = React.ComponentProps<typeof KnowledgeGraphModalType>;
type ExportOptionsModalProps = React.ComponentProps<typeof ExportOptionsModalType>;

export interface AppModalsProps {
  t: Translations;
  locale: Locale;
  onLocaleChange: (next: Locale) => void;
  theme: ThemeId;
  onThemeChange: (next: ThemeId) => void;
  settings: EditorSettings;
  effectiveSettings: EditorSettings;
  onSettingsChange: React.Dispatch<React.SetStateAction<EditorSettings>>;
  aiConfig: AiProviderConfig;
  tabs: DocumentTab[];
  activeTab: DocumentTab;
  onSelectTab: (id: string) => void;
  workspaceRoot: string | null;
  workspaceEntries: WorkspaceEntry[];
  recentFiles: string[];
  headings: QuickOpenModalProps['headings'];
  totalLines: number;
  languageLabel: string;

  // UpdateModal
  showUpdateModal: boolean;
  onCloseUpdateModal: () => void;
  updateInfo: UpdateModalProps['updateInfo'];
  checkingUpdates: boolean;
  onCheckUpdates: () => void;
  updateProgress: UpdateModalProps['updateProgress'];
  downloadedUpdate: UpdateModalProps['downloadedUpdate'];
  applyOnQuitPath: UpdateModalProps['applyOnQuitPath'];
  isDownloadingUpdate: boolean;
  isApplyingUpdate: boolean;
  dirtyTabCount: number;
  pendingRestartFilePath: UpdateModalProps['pendingRestartFilePath'];
  onCancelUpdateDownload: () => void;
  onToggleApplyOnQuit: UpdateModalProps['onToggleApplyOnQuit'];
  onConfirmSaveAllAndUpdate: () => void;
  onConfirmRestartWithoutSaving: () => void;
  onCancelPendingRestart: () => void;
  onAutoUpdateNow: () => void;
  onDownloadUpdateInstaller: UpdateModalProps['onDownloadInstaller'];
  onApplyDownloadedUpdate: UpdateModalProps['onApplyDownloadedUpdate'];
  onRevealDownloadedUpdate: UpdateModalProps['onRevealDownloadedUpdate'];
  onOpenReleaseNotesInTab: UpdateModalProps['onOpenReleaseNotesInTab'];
  onOpenInBuiltinBrowser: (url: string) => void;
  onOpenExternalUrl: (url: string) => void;
  onCopyUpdateUrl: (url: string) => void;
  onSkipUpdateVersion: (ver: string) => void;
  onUnskipUpdateVersion: () => void;
  onDismissUpdateBanner: () => void;

  // QuickOpen & Palette & About
  showQuickOpen: boolean;
  onCloseQuickOpen: () => void;
  onOpenFilePath: (fp: string) => void;
  onJumpToLine: (ln: number) => void;
  showPalette: boolean;
  onClosePalette: () => void;
  paletteCommands: PaletteCommand[];
  showAbout: boolean;
  onCloseAbout: () => void;
  onOpenUpdateModal: () => void;

  // SettingsModal
  showSettings: boolean;
  settingsInitialTab: SettingsTab;
  onCloseSettings: () => void;
  externalPreviewUrl: string | null;
  externalPreviewLanUrls: string[];
  onToggleExternalPreview: () => void;
  onCopyLanUrl: (url: string) => void;
  projectServer: ProjectServerStatus | null;
  storedDataSummary: SettingsModalProps['dataSummary'];
  onResetSelectedSettings: SettingsModalProps['onResetSelectedSettings'];
  onClearSelectedUserData: SettingsModalProps['onClearSelectedUserData'];
  customKeybindings: Record<string, string>;
  onCustomKeybindingsChange: (next: Record<string, string>) => void;
  onExportBackupJson: SettingsModalProps['onExportBackupJson'];
  onReadBackupJsonFile: SettingsModalProps['onReadBackupJsonFile'];
  onApplyBackupImport: SettingsModalProps['onApplyBackupImport'];
  backupCounts: SettingsModalProps['backupCounts'];
  projectConfigInfo: SettingsModalProps['projectConfigInfo'];
  onCreateOnigiriJson: () => void;

  // Image, Diff, Encoding, GoToLine
  showImageModal: boolean;
  onCloseImageModal: () => void;
  onInsertImage: (src: string, alt?: string) => void;
  diffPreview: DiffPreviewRequest | null;
  onCloseDiffPreview: () => void;
  encodingModalMode: EncodingModalMode | null;
  onCloseEncodingModal: () => void;
  onCreateNewWithEncoding: (encoding: TextEncodingId, eol: '\n' | '\r\n') => void;
  onReopenWithEncoding: (encoding: TextEncodingId) => void;
  onChangeSaveEncoding: (encoding: TextEncodingId) => void;
  showGoToLine: boolean;
  onCloseGoToLine: () => void;

  // Inline AI Edit
  inlineAiSelectedText: string | null;
  onCloseInlineAi: () => void;
  onInlineAiResultReady: (proposedText: string, instruction: string) => void;

  // FolderSwitchGuard
  folderSwitchGuardMode: FolderSwitchGuardMode | null;
  projectCommandLabel: string | null;
  stoppingServerForSwitch: boolean;
  onCloseFolderSwitchGuard: () => void;
  onConfirmStopAndSwitchFolder: () => void;

  // WorkspaceImage, Slide, WorkspaceGrep
  previewWorkspaceImagePath: string | null;
  onSelectWorkspaceImagePath: (p: string | null) => void;
  onCloseWorkspaceImage: () => void;
  showSlideModal: boolean;
  onCloseSlideModal: () => void;
  showWorkspaceGrep: boolean;
  onCloseWorkspaceGrep: () => void;
  onOpenFileAtLine: (fp: string, ln: number) => void;
  onAfterWorkspaceGrepReplace: (paths: string[], count: number) => void;

  // Template, WebClip, UnusedAssets, Citation, KnowledgeGraph
  showTemplateModal: boolean;
  onCloseTemplateModal: () => void;
  onOpenDailyNote: () => void;
  onCreateFromTemplate: TemplatePickerModalProps['onCreateFromTemplate'];
  showWebClipModal: boolean;
  onCloseWebClipModal: () => void;
  onOpenClippedNote: WebClipModalProps['onOpenClippedNote'];
  showUnusedAssetsModal: boolean;
  unusedAssetExtraContents: string[];
  onCloseUnusedAssetsModal: () => void;
  onUnusedAssetsDeleted: (count: number) => void;
  showCitationModal: boolean;
  citationSelectedText: string;
  onCloseCitationModal: () => void;
  onInsertCitationInline: (text: string) => void;
  onInsertFootnote: (inlineRef: string, footnoteDef: string) => void;
  showKnowledgeGraphModal: boolean;
  workspaceKnowledgeReport: KnowledgeGraphModalProps['report'];
  onCloseKnowledgeGraphModal: () => void;

  // ExportOptions, Scratchpad, AiSendPreview, FeatureGuide
  exportOptionsModalMode: 'pdf' | 'html' | null;
  defaultExportPageSettings: ExportOptionsModalProps['settings'];
  onCloseExportOptionsModal: () => void;
  onExportHtml: ExportOptionsModalProps['onExportHtml'];
  onExportPdf: ExportOptionsModalProps['onExportPdf'];
  showScratchpad: boolean;
  scratchpadContent: string;
  onScratchpadChange: (next: string) => void;
  onCopyScratchpad: (txt: string) => void;
  onPromoteScratchpadToTab: (txt: string) => void;
  onCloseScratchpad: () => void;
  aiSendPreviewRequest: AiSendPreviewRequest | null;
  onCloseAiSendPreview: () => void;
  showFeatureGuideModal: boolean;
  onRunFeatureGuideAction: (actionId: string) => void;
  onCloseFeatureGuideModal: () => void;
}

export const AppModals: React.FC<AppModalsProps> = (props) => {
  const { t, locale, theme, settings, effectiveSettings, activeTab, workspaceRoot, workspaceEntries } =
    props;

  return (
    <>
      <UpdateModal
        t={t}
        locale={locale}
        open={props.showUpdateModal}
        onClose={props.onCloseUpdateModal}
        updateInfo={props.updateInfo}
        checkingUpdates={props.checkingUpdates}
        onCheckUpdates={props.onCheckUpdates}
        updateProgress={props.updateProgress}
        downloadedUpdate={props.downloadedUpdate}
        applyOnQuitPath={props.applyOnQuitPath}
        isDownloadingUpdate={props.isDownloadingUpdate}
        isApplyingUpdate={props.isApplyingUpdate}
        dirtyTabCount={props.dirtyTabCount}
        pendingRestartFilePath={props.pendingRestartFilePath}
        onCancelDownload={props.onCancelUpdateDownload}
        onToggleApplyOnQuit={props.onToggleApplyOnQuit}
        onConfirmSaveAllAndUpdate={props.onConfirmSaveAllAndUpdate}
        onConfirmRestartWithoutSaving={props.onConfirmRestartWithoutSaving}
        onCancelPendingRestart={props.onCancelPendingRestart}
        onAutoUpdateNow={props.onAutoUpdateNow}
        onDownloadInstaller={props.onDownloadUpdateInstaller}
        onApplyDownloadedUpdate={props.onApplyDownloadedUpdate}
        onRevealDownloadedUpdate={props.onRevealDownloadedUpdate}
        onOpenReleaseNotesInTab={props.onOpenReleaseNotesInTab}
        onOpenInBuiltinBrowser={props.onOpenInBuiltinBrowser}
        onOpenExternalUrl={props.onOpenExternalUrl}
        onCopyUrl={props.onCopyUpdateUrl}
        onSkipVersion={props.onSkipUpdateVersion}
        onUnskipVersion={props.onUnskipUpdateVersion}
        onRemindLater={props.onDismissUpdateBanner}
        settings={settings}
        onSettingsChange={props.onSettingsChange}
      />

      <Suspense fallback={null}>
        <QuickOpenModal
          t={t}
          open={props.showQuickOpen}
          onClose={props.onCloseQuickOpen}
          tabs={props.tabs}
          activeTabId={activeTab.id}
          workspaceEntries={workspaceEntries}
          recentFiles={props.recentFiles}
          headings={props.headings}
          onSelectTab={props.onSelectTab}
          onOpenFilePath={props.onOpenFilePath}
          onJumpToLine={props.onJumpToLine}
        />

        <CommandPalette
          t={t}
          open={props.showPalette}
          onClose={props.onClosePalette}
          commands={props.paletteCommands}
        />

        <AboutModal
          t={t}
          open={props.showAbout}
          onClose={props.onCloseAbout}
          updateInfo={props.updateInfo}
          checkingUpdates={props.checkingUpdates}
          onCheckUpdates={props.onCheckUpdates}
          onOpenExternalUrl={props.onOpenExternalUrl}
          onOpenUpdateModal={props.onOpenUpdateModal}
          onAutoUpdateNow={props.onAutoUpdateNow}
          isUpdatingApp={props.isDownloadingUpdate || props.isApplyingUpdate}
        />

        <SettingsModal
          t={t}
          open={props.showSettings}
          initialTab={props.settingsInitialTab}
          onClose={props.onCloseSettings}
          locale={locale}
          onLocaleChange={props.onLocaleChange}
          theme={theme}
          onThemeChange={props.onThemeChange}
          settings={settings}
          onSettingsChange={props.onSettingsChange}
          aiConfig={props.aiConfig}
          externalPreviewUrl={props.externalPreviewUrl}
          externalPreviewLanUrls={props.externalPreviewLanUrls}
          onToggleExternalPreview={props.onToggleExternalPreview}
          onCopyLanUrl={props.onCopyLanUrl}
          projectServer={props.projectServer}
          dataSummary={props.storedDataSummary}
          onResetSelectedSettings={props.onResetSelectedSettings}
          onClearSelectedUserData={props.onClearSelectedUserData}
          customKeybindings={props.customKeybindings}
          onCustomKeybindingsChange={props.onCustomKeybindingsChange}
          onExportBackupJson={props.onExportBackupJson}
          onReadBackupJsonFile={props.onReadBackupJsonFile}
          onApplyBackupImport={props.onApplyBackupImport}
          backupCounts={props.backupCounts}
          workspaceRoot={workspaceRoot}
          projectConfigInfo={props.projectConfigInfo}
          onCreateOnigiriJson={props.onCreateOnigiriJson}
          onOpenProjectConfigFile={props.onOpenFilePath}
          updateInfo={props.updateInfo}
          checkingUpdates={props.checkingUpdates}
          onCheckUpdates={props.onCheckUpdates}
          onOpenExternalUrl={props.onOpenExternalUrl}
          onOpenUpdateModal={() => {
            props.onCloseSettings();
            props.onOpenUpdateModal();
          }}
          onAutoUpdateNow={props.onAutoUpdateNow}
          isUpdatingApp={props.isDownloadingUpdate || props.isApplyingUpdate}
        />

        <ImageModal
          t={t}
          open={props.showImageModal}
          docPath={activeTab.filePath}
          workspaceRoot={workspaceRoot}
          imageAssetFolder={effectiveSettings.imageAssetFolder}
          onClose={props.onCloseImageModal}
          onInsert={props.onInsertImage}
        />

        <AiDiffPreviewModal
          t={t}
          request={props.diffPreview}
          onClose={props.onCloseDiffPreview}
        />

        <EncodingModal
          t={t}
          locale={locale}
          mode={props.encodingModalMode}
          currentEncoding={activeTab.encoding ?? 'utf-8'}
          currentEol={activeTab.eol ?? '\n'}
          onClose={props.onCloseEncodingModal}
          onCreateNewWithEncoding={props.onCreateNewWithEncoding}
          onReopenWithEncoding={props.onReopenWithEncoding}
          onChangeSaveEncoding={props.onChangeSaveEncoding}
        />

        <GoToLineModal
          t={t}
          open={props.showGoToLine}
          currentLine={activeTab.cursorLine}
          totalLines={props.totalLines}
          onClose={props.onCloseGoToLine}
          onJump={props.onJumpToLine}
        />

        <InlineAiEditModal
          t={t}
          open={props.inlineAiSelectedText !== null}
          selectedText={props.inlineAiSelectedText ?? ''}
          fileName={activeTab.title}
          languageLabel={props.languageLabel}
          aiConfig={props.aiConfig}
          workspaceRoot={workspaceRoot}
          aiProjectRulesEnabled={settings.aiProjectRulesEnabled ?? true}
          aiMemoryEnabled={settings.aiMemoryEnabled ?? true}
          aiAuditLogEnabled={settings.aiAuditLogEnabled ?? true}
          onClose={props.onCloseInlineAi}
          onResultReady={props.onInlineAiResultReady}
        />

        <FolderSwitchGuardModal
          t={t}
          mode={props.folderSwitchGuardMode}
          externalServer={Boolean(props.projectServer?.external)}
          commandLabel={props.projectCommandLabel}
          serverUrl={props.projectServer?.url || null}
          rootPath={props.projectServer?.rootPath || workspaceRoot || null}
          stopping={props.stoppingServerForSwitch}
          onClose={props.onCloseFolderSwitchGuard}
          onConfirmStopAndSwitch={props.onConfirmStopAndSwitchFolder}
        />

        <WorkspaceImageModal
          t={t}
          imagePath={props.previewWorkspaceImagePath}
          workspaceRoot={workspaceRoot}
          entries={workspaceEntries}
          activeDocPath={activeTab.filePath}
          onSelectImagePath={props.onSelectWorkspaceImagePath}
          onClose={props.onCloseWorkspaceImage}
          onInsertToEditor={props.onInsertImage}
        />

        <SlidePresentationModal
          t={t}
          open={props.showSlideModal}
          title={activeTab.title}
          markdown={activeTab.content}
          docPath={activeTab.filePath}
          workspaceRoot={workspaceRoot}
          theme={theme}
          onClose={props.onCloseSlideModal}
        />

        <WorkspaceGrepModal
          t={t}
          open={props.showWorkspaceGrep}
          workspaceRoot={workspaceRoot}
          onClose={props.onCloseWorkspaceGrep}
          onOpenFileAtLine={props.onOpenFileAtLine}
          onAfterReplace={props.onAfterWorkspaceGrepReplace}
        />

        <TemplatePickerModal
          t={t}
          locale={locale}
          open={props.showTemplateModal}
          onClose={props.onCloseTemplateModal}
          onOpenDailyNote={props.onOpenDailyNote}
          onCreateFromTemplate={props.onCreateFromTemplate}
        />

        <WebClipModal
          t={t}
          open={props.showWebClipModal}
          onClose={props.onCloseWebClipModal}
          onOpenClippedNote={props.onOpenClippedNote}
        />

        <UnusedAssetsModal
          t={t}
          locale={locale}
          open={props.showUnusedAssetsModal}
          workspaceRoot={workspaceRoot}
          workspaceEntries={workspaceEntries}
          extraContents={props.unusedAssetExtraContents}
          onClose={props.onCloseUnusedAssetsModal}
          onDeleted={props.onUnusedAssetsDeleted}
        />

        <CitationModal
          t={t}
          open={props.showCitationModal}
          currentMarkdown={activeTab.content}
          selectedText={props.citationSelectedText}
          onClose={props.onCloseCitationModal}
          onInsertInline={props.onInsertCitationInline}
          onInsertFootnote={props.onInsertFootnote}
        />

        <KnowledgeGraphModal
          t={t}
          open={props.showKnowledgeGraphModal}
          report={props.workspaceKnowledgeReport}
          activeFilePath={activeTab.filePath}
          onOpenFile={(fp, ln) => {
            if (ln) {
              props.onOpenFileAtLine(fp, ln);
            } else {
              props.onOpenFilePath(fp);
            }
          }}
          onClose={props.onCloseKnowledgeGraphModal}
        />
      </Suspense>

      <ExportOptionsModal
        open={props.exportOptionsModalMode !== null}
        locale={locale}
        initialMode={props.exportOptionsModalMode ?? 'pdf'}
        settings={settings.exportPageSettings ?? props.defaultExportPageSettings}
        onSaveSettings={(next) =>
          props.onSettingsChange((s) => ({ ...s, exportPageSettings: next }))
        }
        onExportHtml={props.onExportHtml}
        onExportPdf={props.onExportPdf}
        onClose={props.onCloseExportOptionsModal}
      />

      <ScratchpadModal
        open={props.showScratchpad}
        locale={locale}
        content={props.scratchpadContent}
        onChange={props.onScratchpadChange}
        onCopy={props.onCopyScratchpad}
        onPromoteToTab={props.onPromoteScratchpadToTab}
        onClose={props.onCloseScratchpad}
      />

      <AiSendPreviewModal
        request={props.aiSendPreviewRequest}
        locale={locale}
        defaultAutoRedact={settings.aiAutoRedactSecrets ?? true}
        onClose={props.onCloseAiSendPreview}
      />

      <FeatureGuideModal
        open={props.showFeatureGuideModal}
        locale={locale}
        onRunAction={props.onRunFeatureGuideAction}
        onClose={props.onCloseFeatureGuideModal}
      />
    </>
  );
};
