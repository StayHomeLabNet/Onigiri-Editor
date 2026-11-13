import React, { useMemo, useState } from 'react';
import {
  Sparkles,
  BarChart3,
  GitCompare,
  Tags,
  SlidersHorizontal,
  ClipboardPaste,
  ClipboardCopy,
  Code2,
  Camera,
  RotateCcw,
  Trash2,
  Plus,
} from 'lucide-react';
import { diffLines } from 'diff';
import type {
  AiCleanOptions,
  DocumentStats,
  EditorSettings,
  InspectorTab,
  PreviewTheme,
  Snapshot,
} from '../types';
import type { Translations } from '../i18n/types';
import { extractFrontmatter, updateFrontmatter } from '../utils/markdown';

interface InspectorDrawerProps {
  t: Translations;
  activeTab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  markdown: string;
  savedContent: string;
  stats: DocumentStats;
  snapshots: Snapshot[];
  cleanOptions: AiCleanOptions;
  onCleanOptionsChange: (opts: AiCleanOptions) => void;
  onRunAiClean: () => void;
  onPasteHtmlAsMd: () => void;
  onCopyRichText: () => void;
  onCopyHtml: () => void;
  onCreateSnapshot: (label: string) => void;
  onRestoreSnapshot: (snap: Snapshot) => void;
  onDeleteSnapshot: (id: string) => void;
  onUpdateMarkdown: (next: string) => void;
  settings: EditorSettings;
  onSettingsChange: (next: EditorSettings) => void;
}

export const InspectorDrawer: React.FC<InspectorDrawerProps> = ({
  t,
  activeTab,
  onTabChange,
  markdown,
  savedContent,
  stats,
  snapshots,
  cleanOptions,
  onCleanOptionsChange,
  onRunAiClean,
  onPasteHtmlAsMd,
  onCopyRichText,
  onCopyHtml,
  onCreateSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  onUpdateMarkdown,
  settings,
  onSettingsChange,
}) => {
  const [snapLabel, setSnapLabel] = useState('');
  const [compareId, setCompareId] = useState<string>('saved');
  const [newFmKey, setNewFmKey] = useState('');
  const [newFmVal, setNewFmVal] = useState('');

  const frontmatter = useMemo(() => extractFrontmatter(markdown), [markdown]);

  const compareSource = useMemo(() => {
    if (compareId === 'saved') return savedContent;
    const found = snapshots.find((s) => s.id === compareId);
    return found ? found.content : savedContent;
  }, [compareId, savedContent, snapshots]);

  const diffResult = useMemo(() => {
    if (activeTab !== 'diff') return { parts: [], additions: 0, deletions: 0 };
    const parts = diffLines(compareSource, markdown);
    let additions = 0;
    let deletions = 0;
    for (const p of parts) {
      if (p.added) additions += p.count || 0;
      if (p.removed) deletions += p.count || 0;
    }
    return { parts, additions, deletions };
  }, [activeTab, compareSource, markdown]);

  const goalMetric = stats.words;
  const goalPct =
    settings.wordGoal > 0 ? Math.min(100, Math.round((goalMetric / settings.wordGoal) * 100)) : 0;

  const handleFmValueChange = (key: string, val: string) => {
    if (!frontmatter.data) return;
    const nextData = { ...frontmatter.data };
    if (val.startsWith('[') && val.endsWith(']')) {
      nextData[key] = val
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      nextData[key] = val;
    }
    onUpdateMarkdown(updateFrontmatter(markdown, nextData));
  };

  const handleFmDelete = (key: string) => {
    if (!frontmatter.data) return;
    const nextData = { ...frontmatter.data };
    delete nextData[key];
    onUpdateMarkdown(updateFrontmatter(markdown, nextData));
  };

  const handleAddFmField = () => {
    if (!newFmKey.trim()) return;
    const base = frontmatter.data ? { ...frontmatter.data } : {};
    base[newFmKey.trim()] = newFmVal.trim();
    onUpdateMarkdown(updateFrontmatter(markdown, base));
    setNewFmKey('');
    setNewFmVal('');
  };

  return (
    <aside className="inspector">
      <div className="inspector-tabs">
        <button
          type="button"
          className={`ins-tab-btn ${activeTab === 'ai' ? 'is-active' : ''}`}
          onClick={() => onTabChange('ai')}
          title={t.inspector.ai}
        >
          <Sparkles size={14} />
          <span>{t.inspector.ai}</span>
        </button>
        <button
          type="button"
          className={`ins-tab-btn ${activeTab === 'stats' ? 'is-active' : ''}`}
          onClick={() => onTabChange('stats')}
          title={t.inspector.stats}
        >
          <BarChart3 size={14} />
          <span>{t.inspector.stats}</span>
        </button>
        <button
          type="button"
          className={`ins-tab-btn ${activeTab === 'diff' ? 'is-active' : ''}`}
          onClick={() => onTabChange('diff')}
          title={t.inspector.diff}
        >
          <GitCompare size={14} />
          <span>{t.inspector.diff}</span>
        </button>
        <button
          type="button"
          className={`ins-tab-btn ${activeTab === 'frontmatter' ? 'is-active' : ''}`}
          onClick={() => onTabChange('frontmatter')}
          title={t.inspector.frontmatter}
        >
          <Tags size={14} />
          <span>{t.inspector.frontmatter}</span>
        </button>
        <button
          type="button"
          className={`ins-tab-btn ${activeTab === 'settings' ? 'is-active' : ''}`}
          onClick={() => onTabChange('settings')}
          title={t.inspector.settings}
        >
          <SlidersHorizontal size={14} />
          <span>{t.inspector.settings}</span>
        </button>
      </div>

      <div className="inspector-body">
        {activeTab === 'ai' && (
          <div className="ins-panel">
            <h4 className="ins-title">{t.inspector.aiCleanerTitle}</h4>
            <p className="ins-desc">{t.inspector.aiCleanerDesc}</p>

            <div className="check-list">
              {(Object.keys(t.inspector.cleanOpts) as Array<keyof AiCleanOptions>).map((key) => (
                <label key={key} className="check-row">
                  <input
                    type="checkbox"
                    checked={cleanOptions[key]}
                    onChange={(e) =>
                      onCleanOptionsChange({ ...cleanOptions, [key]: e.target.checked })
                    }
                  />
                  <span>{t.inspector.cleanOpts[key]}</span>
                </label>
              ))}
            </div>

            <button type="button" className="primary-btn full-w" onClick={onRunAiClean}>
              <Sparkles size={14} />
              <span>{t.inspector.runAiClean}</span>
            </button>

            <div className="ins-divider" />

            <div className="action-stack">
              <button type="button" className="secondary-btn" onClick={onPasteHtmlAsMd}>
                <ClipboardPaste size={14} />
                <span>{t.inspector.pasteHtmlBtn}</span>
              </button>
              <button type="button" className="secondary-btn" onClick={onCopyRichText}>
                <ClipboardCopy size={14} />
                <span>{t.inspector.copyRichTextBtn}</span>
              </button>
              <button type="button" className="secondary-btn" onClick={onCopyHtml}>
                <Code2 size={14} />
                <span>{t.inspector.copyHtmlBtn}</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="ins-panel">
            <div className="token-highlight-card">
              <div className="token-label">{t.inspector.statsLabels.estimatedTokens}</div>
              <div className="token-value">~{stats.estimatedTokens.toLocaleString()}</div>
              <div className="token-note">{t.inspector.statsLabels.tokenNote}</div>
            </div>

            {settings.wordGoal > 0 && (
              <div className="goal-card">
                <div className="goal-head">
                  <span>{t.inspector.statsLabels.goalProgress}</span>
                  <span>
                    {goalMetric.toLocaleString()} / {settings.wordGoal.toLocaleString()} ({goalPct}%)
                  </span>
                </div>
                <div className="goal-bar">
                  <div className="goal-fill" style={{ width: `${goalPct}%` }} />
                </div>
              </div>
            )}

            <div className="stats-grid">
              <div className="stat-box">
                <span className="stat-k">{t.inspector.statsLabels.words}</span>
                <span className="stat-v">{stats.words.toLocaleString()}</span>
              </div>
              <div className="stat-box">
                <span className="stat-k">{t.inspector.statsLabels.chars}</span>
                <span className="stat-v">{stats.chars.toLocaleString()}</span>
              </div>
              <div className="stat-box">
                <span className="stat-k">{t.inspector.statsLabels.charsNoSpaces}</span>
                <span className="stat-v">{stats.charsNoSpaces.toLocaleString()}</span>
              </div>
              <div className="stat-box">
                <span className="stat-k">{t.inspector.statsLabels.lines}</span>
                <span className="stat-v">{stats.lines.toLocaleString()}</span>
              </div>
              <div className="stat-box">
                <span className="stat-k">{t.inspector.statsLabels.paragraphs}</span>
                <span className="stat-v">{stats.paragraphs.toLocaleString()}</span>
              </div>
              <div className="stat-box">
                <span className="stat-k">{t.inspector.statsLabels.readingTime}</span>
                <span className="stat-v">
                  ~{stats.readingMinutes} {t.inspector.statsLabels.minuteUnit}
                </span>
              </div>
              <div className="stat-box">
                <span className="stat-k">{t.inspector.statsLabels.headings}</span>
                <span className="stat-v">{stats.headings}</span>
              </div>
              <div className="stat-box">
                <span className="stat-k">{t.inspector.statsLabels.codeBlocks}</span>
                <span className="stat-v">{stats.codeBlocks}</span>
              </div>
              <div className="stat-box">
                <span className="stat-k">{t.inspector.statsLabels.tables}</span>
                <span className="stat-v">{stats.tables}</span>
              </div>
              <div className="stat-box">
                <span className="stat-k">{t.inspector.statsLabels.links}</span>
                <span className="stat-v">{stats.links}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'diff' && (
          <div className="ins-panel">
            <div className="snap-create-row">
              <input
                type="text"
                className="text-input"
                value={snapLabel}
                onChange={(e) => setSnapLabel(e.target.value)}
                placeholder={t.inspector.diffLabels.snapshotLabelPlaceholder}
              />
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  onCreateSnapshot(snapLabel.trim() || new Date().toLocaleTimeString());
                  setSnapLabel('');
                }}
              >
                <Camera size={14} />
                <span>{t.inspector.diffLabels.createSnapshot}</span>
              </button>
            </div>

            {snapshots.length === 0 ? (
              <p className="muted-msg">{t.inspector.diffLabels.noSnapshots}</p>
            ) : (
              <div className="snapshot-list">
                {snapshots.map((s) => (
                  <div key={s.id} className="snapshot-item">
                    <div className="snap-meta">
                      <span className="snap-label">{s.label}</span>
                      <span className="snap-time">
                        {new Date(s.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="snap-actions">
                      <button
                        type="button"
                        className="icon-btn-sm"
                        onClick={() => onRestoreSnapshot(s)}
                        title={t.inspector.diffLabels.restore}
                      >
                        <RotateCcw size={13} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn-sm"
                        onClick={() => onDeleteSnapshot(s.id)}
                        title={t.inspector.diffLabels.delete}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="ins-divider" />

            <div className="field-row">
              <label>{t.inspector.diffLabels.compareTarget}</label>
              <select
                className="select-input"
                value={compareId}
                onChange={(e) => setCompareId(e.target.value)}
              >
                <option value="saved">{t.inspector.diffLabels.savedVersion}</option>
                {snapshots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({new Date(s.timestamp).toLocaleTimeString()})
                  </option>
                ))}
              </select>
            </div>

            <div className="diff-summary">
              <span className="diff-add">
                +{diffResult.additions} {t.inspector.diffLabels.additions}
              </span>
              <span className="diff-del">
                -{diffResult.deletions} {t.inspector.diffLabels.deletions}
              </span>
            </div>

            {diffResult.additions === 0 && diffResult.deletions === 0 ? (
              <p className="muted-msg">{t.inspector.diffLabels.identical}</p>
            ) : (
              <div className="diff-viewer">
                {diffResult.parts.map((part, idx) => {
                  const cls = part.added ? 'is-added' : part.removed ? 'is-removed' : 'is-same';
                  return (
                    <pre key={idx} className={`diff-chunk ${cls}`}>
                      {part.value}
                    </pre>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'frontmatter' && (
          <div className="ins-panel">
            <label className="check-row">
              <input
                type="checkbox"
                checked={settings.showFrontmatterCard}
                onChange={(e) =>
                  onSettingsChange({ ...settings, showFrontmatterCard: e.target.checked })
                }
              />
              <span>{t.inspector.frontmatterLabels.showCard}</span>
            </label>

            <div className="ins-divider" />

            {frontmatter.error ? (
              <div className="error-box">
                {t.inspector.frontmatterLabels.invalidYaml}: {frontmatter.error}
              </div>
            ) : !frontmatter.data ? (
              <div className="fm-empty">
                <p className="muted-msg">{t.inspector.frontmatterLabels.none}</p>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() =>
                    onUpdateMarkdown(
                      updateFrontmatter(markdown, {
                        title: 'Untitled',
                        date: new Date().toISOString().slice(0, 10),
                        tags: ['markdown'],
                      })
                    )
                  }
                >
                  <Plus size={14} />
                  <span>{t.inspector.frontmatterLabels.addFrontmatter}</span>
                </button>
              </div>
            ) : (
              <div className="fm-editor-list">
                {Object.entries(frontmatter.data).map(([k, v]) => (
                  <div key={k} className="fm-field-card">
                    <div className="fm-field-head">
                      <span>{k}</span>
                      <button
                        type="button"
                        className="icon-btn-sm"
                        onClick={() => handleFmDelete(k)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <input
                      type="text"
                      className="text-input"
                      value={Array.isArray(v) ? `[${v.join(', ')}]` : String(v ?? '')}
                      onChange={(e) => handleFmValueChange(k, e.target.value)}
                    />
                  </div>
                ))}

                <div className="fm-add-box">
                  <input
                    type="text"
                    className="text-input"
                    value={newFmKey}
                    onChange={(e) => setNewFmKey(e.target.value)}
                    placeholder={t.inspector.frontmatterLabels.key}
                  />
                  <input
                    type="text"
                    className="text-input"
                    value={newFmVal}
                    onChange={(e) => setNewFmVal(e.target.value)}
                    placeholder={t.inspector.frontmatterLabels.value}
                  />
                  <button type="button" className="secondary-btn" onClick={handleAddFmField}>
                    <Plus size={13} />
                    <span>{t.inspector.frontmatterLabels.addField}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="ins-panel">
            <div className="field-row">
              <label>{t.inspector.settingsLabels.previewTheme}</label>
              <select
                className="select-input"
                value={settings.previewTheme}
                onChange={(e) =>
                  onSettingsChange({
                    ...settings,
                    previewTheme: e.target.value as PreviewTheme,
                  })
                }
              >
                <option value="editorial">{t.previewThemes.editorial}</option>
                <option value="github">{t.previewThemes.github}</option>
                <option value="notion">{t.previewThemes.notion}</option>
                <option value="academic">{t.previewThemes.academic}</option>
              </select>
            </div>

            <div className="field-row">
              <label>{t.inspector.settingsLabels.editorFont}</label>
              <select
                className="select-input"
                value={settings.editorFont}
                onChange={(e) =>
                  onSettingsChange({
                    ...settings,
                    editorFont: e.target.value as 'mono' | 'sans',
                  })
                }
              >
                <option value="mono">{t.inspector.settingsLabels.fontMono}</option>
                <option value="sans">{t.inspector.settingsLabels.fontSans}</option>
              </select>
            </div>

            <div className="field-row">
              <label>
                {t.inspector.settingsLabels.fontSize}: {settings.fontSize}px
              </label>
              <input
                type="range"
                min={12}
                max={24}
                value={settings.fontSize}
                onChange={(e) =>
                  onSettingsChange({ ...settings, fontSize: Number(e.target.value) })
                }
              />
            </div>

            <div className="field-row">
              <label>
                {t.inspector.settingsLabels.lineHeight}: {settings.lineHeight}
              </label>
              <input
                type="range"
                min={1.3}
                max={2.2}
                step={0.05}
                value={settings.lineHeight}
                onChange={(e) =>
                  onSettingsChange({ ...settings, lineHeight: Number(e.target.value) })
                }
              />
            </div>

            <div className="field-row">
              <label>
                {t.inspector.settingsLabels.previewWidth}: {settings.previewWidth}px
              </label>
              <input
                type="range"
                min={600}
                max={1100}
                step={20}
                value={settings.previewWidth}
                onChange={(e) =>
                  onSettingsChange({ ...settings, previewWidth: Number(e.target.value) })
                }
              />
            </div>

            <div className="field-row">
              <label>{t.inspector.settingsLabels.wordGoal}</label>
              <input
                type="number"
                min={0}
                step={100}
                className="text-input"
                value={settings.wordGoal}
                onChange={(e) =>
                  onSettingsChange({ ...settings, wordGoal: Math.max(0, Number(e.target.value)) })
                }
              />
            </div>

            <div className="check-list">
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={settings.lineNumbers}
                  onChange={(e) =>
                    onSettingsChange({ ...settings, lineNumbers: e.target.checked })
                  }
                />
                <span>{t.inspector.settingsLabels.lineNumbers}</span>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={settings.wordWrap}
                  onChange={(e) =>
                    onSettingsChange({ ...settings, wordWrap: e.target.checked })
                  }
                />
                <span>{t.inspector.settingsLabels.wordWrap}</span>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={settings.syncScroll}
                  onChange={(e) =>
                    onSettingsChange({ ...settings, syncScroll: e.target.checked })
                  }
                />
                <span>{t.inspector.settingsLabels.syncScroll}</span>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={settings.typewriterMode}
                  onChange={(e) =>
                    onSettingsChange({ ...settings, typewriterMode: e.target.checked })
                  }
                />
                <span>{t.inspector.settingsLabels.typewriterMode}</span>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={settings.smartPasteHtml}
                  onChange={(e) =>
                    onSettingsChange({ ...settings, smartPasteHtml: e.target.checked })
                  }
                />
                <span>{t.inspector.settingsLabels.smartPasteHtml}</span>
              </label>
            </div>

            <div className="field-row">
              <label>{t.inspector.settingsLabels.customCss}</label>
              <textarea
                rows={4}
                className="textarea-input"
                value={settings.customCss}
                onChange={(e) =>
                  onSettingsChange({ ...settings, customCss: e.target.value })
                }
                placeholder={t.inspector.settingsLabels.customCssPlaceholder}
              />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
