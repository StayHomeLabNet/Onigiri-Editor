Onigiri Editor `v1.5.1` is a maintenance and architecture modularization release that splits `SettingsModal` into 7 focused tab components and extracts 7 domain custom hooks from `App.tsx` for improved maintainability with zero behavior regressions.

### Highlights (`v1.5.1`)
- **Architecture Modularization & Maintainability**:
  - **Settings Modal Tab Decomposition (`src/components/settings/`)**: Split `SettingsModal.tsx` (4,094 → 439 lines) into `GeneralTab`, `EditorTab`, `SyntaxTab`, `KeybindingsTab`, `AiCustomTab`, `IntegrationsTab`, and `DataTab`.
  - **Custom Hooks Extraction (`src/hooks/`)**: Extracted `useGitPanelActions`, `useMacroRecorder`, `useAiCustomRunner`, `useExportActions`, `useBackupAndReset`, `useExternalPreview`, and `useWorkspaceActions` from `App.tsx` (8,739 → 7,283 lines), and consolidated clean-tab reload logic after workspace replace operations.

### Downloads
- **macOS (Universal: Apple Silicon & Intel, includes Apple Foundation Models support on macOS 26+)**: `.dmg` / `.app.tar.gz`
- **Windows (x64)**: `.exe` (NSIS installer) / `.msi`
- **Linux (x64)**: `.AppImage` / `.deb`

---

Onigiri Editor `v1.5.1` は、`SettingsModal` のタブ別コンポーネント分割と `App.tsx` からのカスタムフック抽出による保守性向上・メンテナンスリリースです（既存の動作・テストはすべて維持されています）。

### 主な変更点（`v1.5.1`）
- **フロントエンド構成のモジュール分割＆保守性向上**:
  - **設定モーダルのタブ別分割（`src/components/settings/`）**: `SettingsModal.tsx`（4,094 行 → 439 行）を `GeneralTab` / `EditorTab` / `SyntaxTab` / `KeybindingsTab` / `AiCustomTab` / `IntegrationsTab` / `DataTab` の 7 コンポーネントへ分割しました。
  - **カスタムフック抽出（`src/hooks/`）**: `App.tsx`（8,739 行 → 7,283 行）から `useGitPanelActions` / `useMacroRecorder` / `useAiCustomRunner` / `useExportActions` / `useBackupAndReset` / `useExternalPreview` / `useWorkspaceActions` を抽出し、ワークスペース一括置換後のクリーンタブ再読み込み処理も共通化しました。

### ダウンロード（バイナリ一覧）
- **macOS（Universal: Apple Silicon / Intel 両対応・macOS 26+ Apple Foundation Models 対応）**: `.dmg` / `.app.tar.gz`
- **Windows（x64）**: `.exe`（インストーラ） / `.msi`
- **Linux（x64）**: `.AppImage` / `.deb`
