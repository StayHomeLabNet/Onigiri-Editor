mod ai;
mod apple_fm;
mod browser;
mod images;
mod live_preview;
mod menu;
mod project;
mod terminal;
mod updates;
mod window_state;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use tauri::{Emitter, Manager, State};
use walkdir::WalkDir;

struct OpenedFilesState(Mutex<Vec<String>>);

struct GlobalHotkeyState(Mutex<Option<String>>);

#[tauri::command]
fn set_global_hotkey(
    app: tauri::AppHandle,
    state: State<'_, GlobalHotkeyState>,
    enabled: bool,
    shortcut: String,
) -> Result<String, String> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

    let gs = app.global_shortcut();
    let mut guard = state.0.lock().map_err(|_| "Hotkey lock poisoned".to_string())?;

    if let Some(prev) = guard.take() {
        let _ = gs.unregister(prev.as_str());
    }

    let trimmed = shortcut.trim().to_string();
    if !enabled || trimmed.is_empty() {
        return Ok(String::new());
    }

    gs.on_shortcut(trimmed.as_str(), move |app_handle, _shortcut, event| {
        if event.state == ShortcutState::Pressed {
            if let Some(win) = app_handle.get_webview_window(window_state::MAIN_WINDOW_LABEL) {
                let _ = win.unminimize();
                let _ = win.show();
                let _ = win.set_focus();
            }
            let _ = app_handle.emit("global-hotkey-triggered", ());
        }
    })
    .map_err(|e| format!("Failed to register global shortcut '{}': {}", trimmed, e))?;

    *guard = Some(trimmed.clone());
    Ok(trimmed)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceEntry {
    name: String,
    path: String,
    relative_path: String,
    is_dir: bool,
    size: u64,
    modified_ms: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatch {
    path: String,
    relative_path: String,
    name: String,
    line: usize,
    snippet: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceGrepLineMatch {
    line: usize,
    col: usize,
    match_text: String,
    snippet: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceGrepFile {
    path: String,
    relative_path: String,
    name: String,
    total_matches: usize,
    matches: Vec<WorkspaceGrepLineMatch>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceGrepResult {
    files: Vec<WorkspaceGrepFile>,
    total_files: usize,
    total_matches: usize,
    truncated: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceNoteLinkRef {
    target: String,
    kind: String,
    line: usize,
    snippet: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceNoteTagRef {
    tag: String,
    line: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceNoteIndexEntry {
    path: String,
    relative_path: String,
    name: String,
    title: String,
    tags: Vec<WorkspaceNoteTagRef>,
    outgoing_links: Vec<WorkspaceNoteLinkRef>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchedUrlContent {
    final_url: String,
    status: u16,
    content_type: String,
    html: String,
}

fn is_supported_text_file(path: &Path) -> bool {
    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
        if name.eq_ignore_ascii_case(".editorconfig") {
            return true;
        }
    }
    let Some(ext) = path.extension().and_then(|e| e.to_str()) else {
        return false;
    };
    matches!(
        ext.to_ascii_lowercase().as_str(),
        "md"
            | "markdown"
            | "mdown"
            | "mdx"
            | "txt"
            | "php"
            | "phtml"
            | "html"
            | "htm"
            | "css"
            | "scss"
            | "sass"
            | "less"
            | "js"
            | "jsx"
            | "mjs"
            | "cjs"
            | "ts"
            | "tsx"
            | "mts"
            | "cts"
            | "json"
            | "jsonc"
            | "yaml"
            | "yml"
            | "toml"
            | "xml"
            | "svg"
            | "sql"
            | "py"
            | "rs"
            | "go"
            | "java"
            | "kt"
            | "swift"
            | "rb"
            | "c"
            | "h"
            | "cpp"
            | "hpp"
            | "cs"
            | "sh"
            | "bash"
            | "zsh"
            | "vue"
            | "svelte"
            | "ini"
            | "conf"
            | "env"
            | "csv"
            | "tsv"
    )
}

pub(crate) fn is_supported_image_file(path: &Path) -> bool {
    let Some(ext) = path.extension().and_then(|e| e.to_str()) else {
        return false;
    };
    matches!(
        ext.to_ascii_lowercase().as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp" | "ico" | "avif"
    )
}

fn is_workspace_visible_file(path: &Path) -> bool {
    is_supported_text_file(path) || is_supported_image_file(path)
}

pub(crate) fn should_skip_dir(name: &str) -> bool {
    matches!(
        name,
        "node_modules"
            | ".git"
            | "target"
            | "dist"
            | "build"
            | ".next"
            | ".nuxt"
            | ".venv"
            | "venv"
            | "vendor"
            | "__pycache__"
            | "coverage"
    ) || name.starts_with('.')
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DecodedTextFile {
    content: String,
    encoding: String,
    eol: String,
}

fn normalize_encoding_id(raw: &str) -> Option<&'static str> {
    let lower = raw.trim().to_ascii_lowercase().replace('_', "-");
    match lower.as_str() {
        "auto" => Some("auto"),
        "utf-8" | "utf8" => Some("utf-8"),
        "utf-8-bom" | "utf8-bom" | "utf-8-sig" => Some("utf-8-bom"),
        "shift-jis" | "shiftjis" | "sjis" | "cp932" | "ms932" | "windows-31j" => Some("shift_jis"),
        "euc-jp" | "eucjp" => Some("euc-jp"),
        "iso-2022-jp" | "iso2022jp" | "jis" => Some("iso-2022-jp"),
        "utf-16le" | "utf16le" | "utf-16-le" => Some("utf-16le"),
        "utf-16be" | "utf16be" | "utf-16-be" => Some("utf-16be"),
        _ => None,
    }
}

fn has_iso2022_jp_escape(bytes: &[u8]) -> bool {
    bytes.contains(&0x1b)
        && bytes.windows(3).any(|w| {
            w == b"\x1b$B" || w == b"\x1b$@" || w == b"\x1b(B" || w == b"\x1b(J" || w == b"\x1b(I"
        })
}

fn map_encoding_rs_to_id(enc: &'static encoding_rs::Encoding) -> &'static str {
    if enc == encoding_rs::SHIFT_JIS {
        "shift_jis"
    } else if enc == encoding_rs::EUC_JP {
        "euc-jp"
    } else if enc == encoding_rs::ISO_2022_JP {
        "iso-2022-jp"
    } else if enc == encoding_rs::UTF_16LE {
        "utf-16le"
    } else if enc == encoding_rs::UTF_16BE {
        "utf-16be"
    } else {
        "utf-8"
    }
}

fn detect_eol(text: &str) -> &'static str {
    if text.contains("\r\n") {
        "\r\n"
    } else {
        "\n"
    }
}

pub(crate) fn decode_bytes_with_encoding(
    bytes: &[u8],
    requested_encoding: Option<&str>,
) -> Result<DecodedTextFile, String> {
    let normalized = match requested_encoding {
        Some(raw) if !raw.trim().is_empty() => normalize_encoding_id(raw)
            .ok_or_else(|| format!("Unsupported encoding: {}", raw))?,
        _ => "auto",
    };

    let (decoded, resolved_id): (String, &'static str) = match normalized {
        "auto" => {
            if let Some(rest) = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]) {
                let (cow, _) = encoding_rs::UTF_8.decode_without_bom_handling(rest);
                (cow.into_owned(), "utf-8-bom")
            } else if let Some(rest) = bytes.strip_prefix(&[0xFF, 0xFE]) {
                let (cow, _) = encoding_rs::UTF_16LE.decode_without_bom_handling(rest);
                (cow.into_owned(), "utf-16le")
            } else if let Some(rest) = bytes.strip_prefix(&[0xFE, 0xFF]) {
                let (cow, _) = encoding_rs::UTF_16BE.decode_without_bom_handling(rest);
                (cow.into_owned(), "utf-16be")
            } else if has_iso2022_jp_escape(bytes) {
                let (cow, _) = encoding_rs::ISO_2022_JP.decode_without_bom_handling(bytes);
                (cow.into_owned(), "iso-2022-jp")
            } else if let Ok(utf8_str) = std::str::from_utf8(bytes) {
                (utf8_str.to_string(), "utf-8")
            } else {
                let mut detector = chardetng::EncodingDetector::new();
                detector.feed(bytes, true);
                let guessed = detector.guess(None, true);
                let (cow, _) = guessed.decode_without_bom_handling(bytes);
                (cow.into_owned(), map_encoding_rs_to_id(guessed))
            }
        }
        "utf-8" => {
            let slice = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(bytes);
            let (cow, _) = encoding_rs::UTF_8.decode_without_bom_handling(slice);
            (cow.into_owned(), "utf-8")
        }
        "utf-8-bom" => {
            let slice = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(bytes);
            let (cow, _) = encoding_rs::UTF_8.decode_without_bom_handling(slice);
            (cow.into_owned(), "utf-8-bom")
        }
        "shift_jis" => {
            let (cow, _) = encoding_rs::SHIFT_JIS.decode_without_bom_handling(bytes);
            (cow.into_owned(), "shift_jis")
        }
        "euc-jp" => {
            let (cow, _) = encoding_rs::EUC_JP.decode_without_bom_handling(bytes);
            (cow.into_owned(), "euc-jp")
        }
        "iso-2022-jp" => {
            let (cow, _) = encoding_rs::ISO_2022_JP.decode_without_bom_handling(bytes);
            (cow.into_owned(), "iso-2022-jp")
        }
        "utf-16le" => {
            let slice = bytes.strip_prefix(&[0xFF, 0xFE]).unwrap_or(bytes);
            let (cow, _) = encoding_rs::UTF_16LE.decode_without_bom_handling(slice);
            (cow.into_owned(), "utf-16le")
        }
        "utf-16be" => {
            let slice = bytes.strip_prefix(&[0xFE, 0xFF]).unwrap_or(bytes);
            let (cow, _) = encoding_rs::UTF_16BE.decode_without_bom_handling(slice);
            (cow.into_owned(), "utf-16be")
        }
        _ => unreachable!(),
    };

    let eol = detect_eol(&decoded).to_string();
    Ok(DecodedTextFile {
        content: decoded,
        encoding: resolved_id.to_string(),
        eol,
    })
}

fn encode_text_with_encoding(content: &str, encoding: Option<&str>) -> Result<Vec<u8>, String> {
    let normalized = match encoding {
        Some(raw) if !raw.trim().is_empty() => normalize_encoding_id(raw)
            .ok_or_else(|| format!("Unsupported encoding: {}", raw))?,
        _ => "utf-8",
    };

    match normalized {
        "utf-8" | "auto" => Ok(content.as_bytes().to_vec()),
        "utf-8-bom" => {
            let mut out = Vec::with_capacity(3 + content.len());
            out.extend_from_slice(&[0xEF, 0xBB, 0xBF]);
            out.extend_from_slice(content.as_bytes());
            Ok(out)
        }
        "utf-16le" => {
            let mut out = Vec::with_capacity(2 + content.len() * 2);
            out.extend_from_slice(&[0xFF, 0xFE]);
            for unit in content.encode_utf16() {
                out.extend_from_slice(&unit.to_le_bytes());
            }
            Ok(out)
        }
        "utf-16be" => {
            let mut out = Vec::with_capacity(2 + content.len() * 2);
            out.extend_from_slice(&[0xFE, 0xFF]);
            for unit in content.encode_utf16() {
                out.extend_from_slice(&unit.to_be_bytes());
            }
            Ok(out)
        }
        "shift_jis" | "euc-jp" | "iso-2022-jp" => {
            let (enc, label) = match normalized {
                "shift_jis" => (encoding_rs::SHIFT_JIS, "Shift_JIS"),
                "euc-jp" => (encoding_rs::EUC_JP, "EUC-JP"),
                _ => (encoding_rs::ISO_2022_JP, "ISO-2022-JP"),
            };
            let (encoded, _, had_unmappable) = enc.encode(content);
            if had_unmappable {
                return Err(format!(
                    "Text contains characters that cannot be represented in {}. Switch encoding to UTF-8 to save without data loss.",
                    label
                ));
            }
            Ok(encoded.into_owned())
        }
        _ => unreachable!(),
    }
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| format!("Failed to read {}: {}", path, e))?;
    Ok(decode_bytes_with_encoding(&bytes, None)?.content)
}

#[tauri::command]
fn read_text_file_with_encoding(
    path: String,
    encoding: Option<String>,
) -> Result<DecodedTextFile, String> {
    let bytes = fs::read(&path).map_err(|e| format!("Failed to read {}: {}", path, e))?;
    decode_bytes_with_encoding(&bytes, encoding.as_deref())
}

#[tauri::command]
fn write_text_file(
    path: String,
    content: String,
    encoding: Option<String>,
) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }
    }
    let bytes = encode_text_with_encoding(&content, encoding.as_deref())?;
    fs::write(&path, bytes).map_err(|e| format!("Failed to write {}: {}", path, e))
}

#[tauri::command]
fn read_clipboard_text() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        let out = std::process::Command::new("pbpaste")
            .output()
            .map_err(|e| format!("pbpaste failed: {}", e))?;
        return Ok(String::from_utf8_lossy(&out.stdout).to_string());
    }
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let out = std::process::Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $t = Get-Clipboard -Raw; if ($null -ne $t) { [Console]::Out.Write($t) }",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| format!("Get-Clipboard failed: {}", e))?;
        return Ok(String::from_utf8_lossy(&out.stdout).to_string());
    }
    #[cfg(target_os = "linux")]
    {
        for (bin, args) in [
            ("wl-paste", vec!["--no-newline"]),
            ("xclip", vec!["-o", "-selection", "clipboard"]),
            ("xsel", vec!["-ob"]),
        ] {
            if let Ok(out) = std::process::Command::new(bin).args(&args).output() {
                if out.status.success() {
                    return Ok(String::from_utf8_lossy(&out.stdout).to_string());
                }
            }
        }
        return Err("No clipboard utility found (wl-paste, xclip, xsel)".to_string());
    }
    #[allow(unreachable_code)]
    Err("Unsupported platform".to_string())
}

#[tauri::command]
fn write_clipboard_text(text: String) -> Result<(), String> {
    use std::io::Write;
    #[cfg(target_os = "macos")]
    {
        let mut child = std::process::Command::new("pbcopy")
            .stdin(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("pbcopy failed: {}", e))?;
        if let Some(mut stdin) = child.stdin.take() {
            stdin
                .write_all(text.as_bytes())
                .map_err(|e| format!("pbcopy write failed: {}", e))?;
        }
        let _ = child.wait();
        return Ok(());
    }
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let mut child = std::process::Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "[Console]::InputEncoding = [System.Text.Encoding]::UTF8; $t = [Console]::In.ReadToEnd(); Set-Clipboard -Value $t",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .stdin(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Set-Clipboard failed: {}", e))?;
        if let Some(mut stdin) = child.stdin.take() {
            stdin
                .write_all(text.as_bytes())
                .map_err(|e| format!("Set-Clipboard write failed: {}", e))?;
        }
        let _ = child.wait();
        return Ok(());
    }
    #[cfg(target_os = "linux")]
    {
        for (bin, args) in [
            ("wl-copy", vec![]),
            ("xclip", vec!["-selection", "clipboard"]),
            ("xsel", vec!["-ib"]),
        ] {
            if let Ok(mut child) = std::process::Command::new(bin)
                .args(&args)
                .stdin(std::process::Stdio::piped())
                .spawn()
            {
                if let Some(mut stdin) = child.stdin.take() {
                    let _ = stdin.write_all(text.as_bytes());
                }
                let _ = child.wait();
                return Ok(());
            }
        }
        return Err("No clipboard utility found".to_string());
    }
    #[allow(unreachable_code)]
    Err("Unsupported platform".to_string())
}

#[tauri::command]
async fn scan_workspace(root_path: String) -> Result<Vec<WorkspaceEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || -> Result<Vec<WorkspaceEntry>, String> {
        let root = PathBuf::from(&root_path);
        if !root.exists() || !root.is_dir() {
            return Err("Workspace path is not a directory".to_string());
        }

        let mut entries = Vec::new();
        let mut count = 0usize;
        let walker = WalkDir::new(&root)
            .max_depth(8)
            .sort_by_file_name()
            .into_iter()
            .filter_entry(|e| {
                if e.depth() == 0 {
                    return true;
                }
                let name = e.file_name().to_string_lossy();
                if e.file_type().is_dir() {
                    !should_skip_dir(&name)
                } else {
                    is_workspace_visible_file(e.path())
                }
            });

        for entry in walker.flatten() {
            if entry.depth() == 0 {
                continue;
            }
            let path = entry.path();
            let is_dir = entry.file_type().is_dir();
            if !is_dir && !is_workspace_visible_file(path) {
                continue;
            }

            let Ok(rel) = path.strip_prefix(&root) else {
                continue;
            };
            let meta = entry.metadata().ok();
            let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
            let modified_ms = meta
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);

            entries.push(WorkspaceEntry {
                name: entry.file_name().to_string_lossy().to_string(),
                path: path.to_string_lossy().to_string(),
                relative_path: rel.to_string_lossy().to_string(),
                is_dir,
                size,
                modified_ms,
            });

            count += 1;
            if count >= 2000 {
                break;
            }
        }

        entries.sort_by(|a, b| {
            b.is_dir
                .cmp(&a.is_dir)
                .then_with(|| a.relative_path.to_lowercase().cmp(&b.relative_path.to_lowercase()))
        });

        Ok(entries)
    })
    .await
    .map_err(|e| format!("Workspace scan task failed: {}", e))?
}

#[tauri::command]
async fn search_workspace(root_path: String, query: String) -> Result<Vec<SearchMatch>, String> {
    tauri::async_runtime::spawn_blocking(move || -> Result<Vec<SearchMatch>, String> {
        let q = query.trim().to_lowercase();
        if q.is_empty() {
            return Ok(Vec::new());
        }
        let root = PathBuf::from(&root_path);
        if !root.exists() || !root.is_dir() {
            return Err("Workspace path is not a directory".to_string());
        }

        let mut matches = Vec::new();
        let walker = WalkDir::new(&root)
            .max_depth(8)
            .into_iter()
            .filter_entry(|e| {
                if e.depth() == 0 {
                    return true;
                }
                let name = e.file_name().to_string_lossy();
                if e.file_type().is_dir() {
                    !should_skip_dir(&name)
                } else {
                    is_supported_text_file(e.path())
                }
            });

        for entry in walker.flatten() {
            if entry.file_type().is_dir() || !is_supported_text_file(entry.path()) {
                continue;
            }
            let Ok(meta) = entry.metadata() else {
                continue;
            };
            if meta.len() > 2 * 1024 * 1024 {
                continue;
            }
            let Ok(content) = fs::read_to_string(entry.path()) else {
                continue;
            };
            let rel = entry
                .path()
                .strip_prefix(&root)
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            let name = entry.file_name().to_string_lossy().to_string();
            let path_str = entry.path().to_string_lossy().to_string();

            for (idx, line) in content.lines().enumerate() {
                if line.to_lowercase().contains(&q) {
                    let snippet: String = line.trim().chars().take(140).collect();
                    matches.push(SearchMatch {
                        path: path_str.clone(),
                        relative_path: rel.clone(),
                        name: name.clone(),
                        line: idx + 1,
                        snippet,
                    });
                    if matches.len() >= 150 {
                        return Ok(matches);
                    }
                }
            }
        }

        Ok(matches)
    })
    .await
    .map_err(|e| format!("Workspace search task failed: {}", e))?
}

fn search_workspace_advanced_impl(
    root_path: &str,
    query: &str,
    case_sensitive: bool,
    use_regex: bool,
    max_files: usize,
) -> Result<WorkspaceGrepResult, String> {
    if query.trim().is_empty() {
        return Ok(WorkspaceGrepResult {
            files: Vec::new(),
            total_files: 0,
            total_matches: 0,
            truncated: false,
        });
    }
    let pattern = if use_regex {
        query.to_string()
    } else {
        regex::escape(query)
    };
    let re = regex::RegexBuilder::new(&pattern)
        .case_insensitive(!case_sensitive)
        .build()
        .map_err(|e| format!("Invalid regular expression: {}", e))?;

    let root = PathBuf::from(root_path);
    if !root.exists() || !root.is_dir() {
        return Err("Workspace path is not a directory".to_string());
    }

    let walker = WalkDir::new(&root)
        .max_depth(8)
        .into_iter()
        .filter_entry(|e| {
            if e.depth() == 0 {
                return true;
            }
            let name = e.file_name().to_string_lossy();
            if e.file_type().is_dir() {
                !should_skip_dir(&name)
            } else {
                is_supported_text_file(e.path())
            }
        });

    let mut files = Vec::new();
    let mut total_matches = 0usize;
    let mut truncated = false;
    let file_limit = max_files.clamp(1, 500);

    for entry in walker.flatten() {
        if entry.file_type().is_dir() || !is_supported_text_file(entry.path()) {
            continue;
        }
        let Ok(meta) = entry.metadata() else {
            continue;
        };
        if meta.len() > 2 * 1024 * 1024 {
            continue;
        }
        let Ok(bytes) = fs::read(entry.path()) else {
            continue;
        };
        let Ok(decoded) = decode_bytes_with_encoding(&bytes, None) else {
            continue;
        };

        let mut file_matches = Vec::new();
        let mut file_match_count = 0usize;
        for (idx, line) in decoded.content.lines().enumerate() {
            let mut found_on_line = re.find_iter(line).peekable();
            if found_on_line.peek().is_none() {
                continue;
            }
            let first = found_on_line.next().unwrap();
            let line_count = 1 + found_on_line.count();
            file_match_count += line_count;

            if file_matches.len() < 40 {
                let col = line[..first.start()].chars().count() + 1;
                let match_text: String = first.as_str().chars().take(80).collect();
                let snippet: String = line.trim().chars().take(160).collect();
                file_matches.push(WorkspaceGrepLineMatch {
                    line: idx + 1,
                    col,
                    match_text,
                    snippet,
                });
            }
        }

        if file_match_count > 0 {
            if files.len() >= file_limit {
                truncated = true;
                break;
            }
            let rel = entry
                .path()
                .strip_prefix(&root)
                .map(|p| p.to_string_lossy().replace('\\', "/"))
                .unwrap_or_default();
            let name = entry.file_name().to_string_lossy().to_string();
            let path_str = entry.path().to_string_lossy().to_string();
            total_matches += file_match_count;
            files.push(WorkspaceGrepFile {
                path: path_str,
                relative_path: rel,
                name,
                total_matches: file_match_count,
                matches: file_matches,
            });
        }
    }

    let total_files = files.len();
    Ok(WorkspaceGrepResult {
        files,
        total_files,
        total_matches,
        truncated,
    })
}

#[tauri::command]
async fn search_workspace_advanced(
    root_path: String,
    query: String,
    case_sensitive: bool,
    use_regex: bool,
) -> Result<WorkspaceGrepResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        search_workspace_advanced_impl(&root_path, &query, case_sensitive, use_regex, 250)
    })
    .await
    .map_err(|e| format!("Workspace grep task failed: {}", e))?
}

fn is_markdown_note_file(path: &Path) -> bool {
    let Some(ext) = path.extension().and_then(|e| e.to_str()) else {
        return false;
    };
    matches!(
        ext.to_ascii_lowercase().as_str(),
        "md" | "markdown" | "mdown" | "mdx"
    )
}

fn strip_inline_code_segments(line: &str) -> String {
    let mut out = String::with_capacity(line.len());
    let mut in_code = false;
    for ch in line.chars() {
        if ch == '`' {
            in_code = !in_code;
            out.push(' ');
        } else if in_code {
            out.push(' ');
        } else {
            out.push(ch);
        }
    }
    out
}

fn is_hex_color_like(tag: &str) -> bool {
    matches!(tag.len(), 3 | 4 | 6 | 8)
        && tag.chars().all(|c| c.is_ascii_hexdigit())
        && tag.chars().any(|c| c.is_ascii_digit())
}

fn clean_yaml_scalar(raw: &str) -> String {
    raw.trim()
        .trim_matches('"')
        .trim_matches('\'')
        .trim()
        .to_string()
}

fn index_workspace_notes_impl(root_path: &str) -> Result<Vec<WorkspaceNoteIndexEntry>, String> {
    let root = PathBuf::from(root_path);
    if !root.exists() || !root.is_dir() {
        return Err("Workspace path is not a directory".to_string());
    }

    let tag_re = regex::Regex::new(
        r"(?:^|[\s(\[「（])#([A-Za-z\u{3040}-\u{30ff}\u{4e00}-\u{9fff}][\w\-/\u{3040}-\u{30ff}\u{4e00}-\u{9fff}]*)"
    )
    .unwrap();
    let wiki_re = regex::Regex::new(r"\[\[([^\]|#\n]+?)(?:#[^\]|\n]*)?(?:\|[^\]\n]*)?\]\]").unwrap();
    let md_link_re = regex::Regex::new(r"!?\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)").unwrap();

    let walker = WalkDir::new(&root)
        .max_depth(8)
        .into_iter()
        .filter_entry(|e| {
            if e.depth() == 0 {
                return true;
            }
            let name = e.file_name().to_string_lossy();
            if e.file_type().is_dir() {
                !should_skip_dir(&name)
            } else {
                is_markdown_note_file(e.path())
            }
        });

    let mut notes = Vec::new();
    for entry in walker.flatten() {
        if entry.file_type().is_dir() || !is_markdown_note_file(entry.path()) {
            continue;
        }
        let Ok(meta) = entry.metadata() else {
            continue;
        };
        if meta.len() > 2 * 1024 * 1024 {
            continue;
        }
        let Ok(bytes) = fs::read(entry.path()) else {
            continue;
        };
        let Ok(decoded) = decode_bytes_with_encoding(&bytes, None) else {
            continue;
        };

        let normalized = decoded.content.replace("\r\n", "\n");
        let lines: Vec<&str> = normalized.lines().collect();
        let mut line_idx = 0usize;
        let mut fm_title: Option<String> = None;
        let mut h1_title: Option<String> = None;
        let mut tags: Vec<WorkspaceNoteTagRef> = Vec::new();
        let mut seen_tags: HashSet<String> = HashSet::new();
        let mut outgoing_links: Vec<WorkspaceNoteLinkRef> = Vec::new();

        // Parse optional YAML frontmatter at top of file
        if lines.first().map(|l| l.trim()) == Some("---") {
            let mut end_idx = None;
            for (i, line) in lines.iter().enumerate().skip(1) {
                if line.trim() == "---" {
                    end_idx = Some(i);
                    break;
                }
            }
            if let Some(end) = end_idx {
                let mut in_tags_list = false;
                for (offset, raw_line) in lines[1..end].iter().enumerate() {
                    let line_no = offset + 2;
                    let trimmed = raw_line.trim();
                    if let Some(rest) = trimmed.strip_prefix("title:") {
                        let cleaned = clean_yaml_scalar(rest);
                        if !cleaned.is_empty() {
                            fm_title = Some(cleaned);
                        }
                        in_tags_list = false;
                    } else if let Some(rest) = trimmed.strip_prefix("tags:") {
                        let rest_trim = rest.trim();
                        if rest_trim.is_empty() {
                            in_tags_list = true;
                        } else {
                            in_tags_list = false;
                            let inner = rest_trim.trim_start_matches('[').trim_end_matches(']');
                            for item in inner.split(',') {
                                let t = clean_yaml_scalar(item).trim_start_matches('#').to_string();
                                if !t.is_empty() && seen_tags.insert(t.to_lowercase()) {
                                    tags.push(WorkspaceNoteTagRef { tag: t, line: line_no });
                                }
                            }
                        }
                    } else if in_tags_list {
                        if let Some(item) = trimmed.strip_prefix('-') {
                            let t = clean_yaml_scalar(item).trim_start_matches('#').to_string();
                            if !t.is_empty() && seen_tags.insert(t.to_lowercase()) {
                                tags.push(WorkspaceNoteTagRef { tag: t, line: line_no });
                            }
                        } else if !trimmed.is_empty() && !trimmed.starts_with('#') {
                            in_tags_list = false;
                        }
                    }
                }
                line_idx = end + 1;
            }
        }

        let mut in_fence = false;
        let mut fence_char = '\0';
        for idx in line_idx..lines.len() {
            let line = lines[idx];
            let trimmed = line.trim_start();
            if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
                let ch = trimmed.chars().next().unwrap_or('`');
                if !in_fence {
                    in_fence = true;
                    fence_char = ch;
                    continue;
                } else if ch == fence_char {
                    in_fence = false;
                    continue;
                }
            }
            if in_fence {
                continue;
            }

            let line_no = idx + 1;
            if h1_title.is_none() {
                if let Some(h1) = trimmed.strip_prefix("# ") {
                    let t = h1.trim();
                    if !t.is_empty() {
                        h1_title = Some(t.to_string());
                    }
                }
            }

            let scan_line = strip_inline_code_segments(line);
            for cap in tag_re.captures_iter(&scan_line) {
                if let Some(m) = cap.get(1) {
                    let t = m.as_str().trim_end_matches('/').to_string();
                    if !t.is_empty() && !is_hex_color_like(&t) && seen_tags.insert(t.to_lowercase()) {
                        tags.push(WorkspaceNoteTagRef { tag: t, line: line_no });
                    }
                }
            }

            let snippet: String = line.trim().chars().take(140).collect();
            for cap in wiki_re.captures_iter(&scan_line) {
                if let Some(m) = cap.get(1) {
                    let target = m.as_str().trim();
                    if !target.is_empty() {
                        outgoing_links.push(WorkspaceNoteLinkRef {
                            target: target.to_string(),
                            kind: "wiki".to_string(),
                            line: line_no,
                            snippet: snippet.clone(),
                        });
                    }
                }
            }

            for cap in md_link_re.captures_iter(&scan_line) {
                if let Some(m) = cap.get(1) {
                    let raw_target = m.as_str().trim();
                    let lower = raw_target.to_ascii_lowercase();
                    if raw_target.is_empty()
                        || raw_target.starts_with('#')
                        || lower.starts_with("http://")
                        || lower.starts_with("https://")
                        || lower.starts_with("mailto:")
                        || lower.starts_with("data:")
                    {
                        continue;
                    }
                    let clean_target = raw_target
                        .split('#')
                        .next()
                        .unwrap_or(raw_target)
                        .split('?')
                        .next()
                        .unwrap_or(raw_target)
                        .trim();
                    if !clean_target.is_empty() {
                        outgoing_links.push(WorkspaceNoteLinkRef {
                            target: clean_target.to_string(),
                            kind: "md".to_string(),
                            line: line_no,
                            snippet: snippet.clone(),
                        });
                    }
                }
            }
        }

        let rel = entry
            .path()
            .strip_prefix(&root)
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_default();
        let name = entry.file_name().to_string_lossy().to_string();
        let stem = entry
            .path()
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or(&name)
            .to_string();

        notes.push(WorkspaceNoteIndexEntry {
            path: entry.path().to_string_lossy().to_string(),
            relative_path: rel,
            name,
            title: fm_title.or(h1_title).unwrap_or(stem),
            tags,
            outgoing_links,
        });

        if notes.len() >= 1500 {
            break;
        }
    }

    notes.sort_by(|a, b| a.relative_path.to_lowercase().cmp(&b.relative_path.to_lowercase()));
    Ok(notes)
}

#[tauri::command]
async fn index_workspace_notes(root_path: String) -> Result<Vec<WorkspaceNoteIndexEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || index_workspace_notes_impl(&root_path))
        .await
        .map_err(|e| format!("Workspace note indexing task failed: {}", e))?
}

fn validate_fetch_url(parsed: &url::Url) -> Result<(), String> {
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("Only http:// and https:// URLs are supported".to_string());
    }
    let Some(host) = parsed.host() else {
        return Err("URL must include a valid host".to_string());
    };
    match host {
        url::Host::Domain(domain) => {
            let lower = domain.to_ascii_lowercase();
            if lower == "metadata.google.internal"
                || lower == "metadata.azure.internal"
                || lower.ends_with(".metadata.google.internal")
            {
                return Err("Access to cloud metadata endpoints is blocked".to_string());
            }
        }
        url::Host::Ipv4(ip) => {
            if ip.is_link_local() || ip.is_unspecified() || ip.is_multicast() || ip.is_broadcast() {
                return Err("Access to link-local or unspecified IP addresses is blocked".to_string());
            }
        }
        url::Host::Ipv6(ip) => {
            let seg0 = ip.segments()[0];
            let is_link_local = (seg0 & 0xffc0) == 0xfe80;
            if is_link_local || ip.is_unspecified() || ip.is_multicast() {
                return Err("Access to link-local or unspecified IPv6 addresses is blocked".to_string());
            }
        }
    }
    Ok(())
}

#[tauri::command]
async fn fetch_url_content(url: String) -> Result<FetchedUrlContent, String> {
    let trimmed = url.trim();
    let parsed = url::Url::parse(trimmed).map_err(|e| format!("Invalid URL: {}", e))?;
    validate_fetch_url(&parsed)?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .user_agent("Mozilla/5.0 (compatible; OnigiriEditor/1.0)")
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            if attempt.previous().len() >= 5 {
                return attempt.error("Too many redirects");
            }
            if let Err(msg) = validate_fetch_url(attempt.url()) {
                return attempt.error(msg);
            }
            attempt.follow()
        }))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let resp = client
        .get(parsed)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch URL: {}", e))?;

    let status = resp.status().as_u16();
    if !resp.status().is_success() {
        return Err(format!("HTTP error {}", status));
    }

    let final_url = resp.url().to_string();
    let content_type = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("text/html")
        .to_string();

    if let Some(len) = resp.content_length() {
        if len > 5 * 1024 * 1024 {
            return Err("Response is larger than 5MB".to_string());
        }
    }

    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;
    if bytes.len() > 5 * 1024 * 1024 {
        return Err("Response is larger than 5MB".to_string());
    }

    let charset_label = content_type
        .split(';')
        .find_map(|part| {
            let trimmed = part.trim();
            trimmed
                .strip_prefix("charset=")
                .or_else(|| trimmed.strip_prefix("CHARSET="))
                .map(|s| s.trim_matches('"').trim_matches('\'').trim())
        });

    let html = if let Some(label) = charset_label {
        if let Some(enc) = encoding_rs::Encoding::for_label(label.as_bytes()) {
            let (cow, _, _) = enc.decode(&bytes);
            cow.into_owned()
        } else {
            String::from_utf8_lossy(&bytes).into_owned()
        }
    } else {
        String::from_utf8_lossy(&bytes).into_owned()
    };

    Ok(FetchedUrlContent {
        final_url,
        status,
        content_type,
        html,
    })
}

#[tauri::command]
fn take_initial_files(state: State<'_, OpenedFilesState>) -> Vec<String> {
    let mut guard = state.0.lock().unwrap();
    let items = guard.clone();
    guard.clear();
    items
}

fn is_readable_workspace_text(path: &Path) -> bool {
    let Some(ext) = path.extension().and_then(|e| e.to_str()) else {
        return false;
    };
    matches!(
        ext.to_ascii_lowercase().as_str(),
        "md" | "markdown"
            | "mdown"
            | "mdx"
            | "txt"
            | "json"
            | "yaml"
            | "yml"
            | "toml"
            | "ts"
            | "tsx"
            | "js"
            | "jsx"
            | "py"
            | "rs"
            | "php"
            | "html"
            | "css"
    )
}

#[tauri::command]
async fn read_workspace_context(
    root_path: String,
    max_bytes: Option<usize>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || -> Result<String, String> {
        let root = PathBuf::from(&root_path);
        if !root.exists() || !root.is_dir() {
            return Err("Workspace path is not a directory".to_string());
        }
        let budget = max_bytes.unwrap_or(36_000).min(120_000);
        let mut tree_list = Vec::new();
        let mut snippets = String::new();
        let mut used = 0usize;

        let walker = WalkDir::new(&root)
            .max_depth(6)
            .sort_by_file_name()
            .into_iter()
            .filter_entry(|e| {
                if e.depth() == 0 {
                    return true;
                }
                let name = e.file_name().to_string_lossy();
                if e.file_type().is_dir() {
                    !should_skip_dir(&name)
                } else {
                    is_readable_workspace_text(e.path())
                }
            });

        for entry in walker.flatten() {
            if entry.depth() == 0 || entry.file_type().is_dir() {
                continue;
            }
            let Ok(rel) = entry.path().strip_prefix(&root) else {
                continue;
            };
            let rel_str = rel.to_string_lossy().to_string();
            tree_list.push(rel_str.clone());

            if used < budget {
                if let Ok(meta) = entry.metadata() {
                    if meta.len() <= 128 * 1024 {
                        if let Ok(content) = fs::read_to_string(entry.path()) {
                            let remaining = budget - used;
                            let truncated: String = content.chars().take(remaining.min(4000)).collect();
                            let block = format!("\n--- File: {} ---\n{}\n", rel_str, truncated);
                            used += block.len();
                            snippets.push_str(&block);
                        }
                    }
                }
            }
        }

        Ok(format!(
            "Workspace root: {}\nFiles:\n{}\n{}",
            root_path,
            tree_list
                .iter()
                .take(120)
                .map(|f| format!("- {}", f))
                .collect::<Vec<_>>()
                .join("\n"),
            snippets
        ))
    })
    .await
    .map_err(|e| format!("Workspace context task failed: {}", e))?
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSyncInfo {
    path: String,
    exists: bool,
    modified_ms: u64,
    size: u64,
}

fn inspect_file_sync(path: &str) -> FileSyncInfo {
    match fs::metadata(path) {
        Ok(meta) if meta.is_file() => {
            let modified_ms = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            FileSyncInfo {
                path: path.to_string(),
                exists: true,
                modified_ms,
                size: meta.len(),
            }
        }
        _ => FileSyncInfo {
            path: path.to_string(),
            exists: false,
            modified_ms: 0,
            size: 0,
        },
    }
}

#[tauri::command]
fn check_files_sync(paths: Vec<String>) -> Vec<FileSyncInfo> {
    paths.into_iter().map(|p| inspect_file_sync(&p)).collect()
}

fn read_workspace_file_if_exists_impl(
    root_path: &str,
    relative_path: &str,
) -> Result<Option<String>, String> {
    let root = PathBuf::from(root_path)
        .canonicalize()
        .map_err(|e| format!("Invalid workspace root: {}", e))?;

    let trimmed = relative_path.trim();
    if trimmed.is_empty() {
        return Err("Relative path must not be empty".to_string());
    }
    let rel = Path::new(trimmed);
    if rel.is_absolute()
        || rel
            .components()
            .any(|c| matches!(c, Component::ParentDir | Component::RootDir | Component::Prefix(_)))
    {
        return Err("Relative path must stay inside the workspace folder".to_string());
    }

    let dest = root.join(rel);
    if !dest.exists() {
        return Ok(None);
    }
    let canon_dest = dest
        .canonicalize()
        .map_err(|e| format!("Failed to resolve {}: {}", dest.display(), e))?;
    if !canon_dest.starts_with(&root) {
        return Err("Target path escapes workspace folder".to_string());
    }
    if canon_dest.is_dir() {
        return Err("Target path is a directory".to_string());
    }
    let content = fs::read_to_string(&canon_dest)
        .map_err(|e| format!("Failed to read {}: {}", canon_dest.display(), e))?;
    Ok(Some(content))
}

#[tauri::command]
fn read_workspace_file_if_exists(
    root_path: String,
    relative_path: String,
) -> Result<Option<String>, String> {
    read_workspace_file_if_exists_impl(&root_path, &relative_path)
}

#[tauri::command]
fn write_workspace_file(
    root_path: String,
    relative_path: String,
    content: String,
) -> Result<String, String> {
    let root = PathBuf::from(&root_path)
        .canonicalize()
        .map_err(|e| format!("Invalid workspace root: {}", e))?;

    let rel = Path::new(relative_path.trim());
    if rel.is_absolute()
        || rel.components().any(|c| matches!(c, Component::ParentDir | Component::RootDir | Component::Prefix(_)))
    {
        return Err("Relative path must stay inside the workspace folder".to_string());
    }

    let dest = root.join(rel);
    if let Some(parent) = dest.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent folder: {}", e))?;
        }
        let canon_parent = parent
            .canonicalize()
            .map_err(|e| format!("Invalid destination folder: {}", e))?;
        if !canon_parent.starts_with(&root) {
            return Err("Destination escapes workspace folder".to_string());
        }
    }

    fs::write(&dest, content).map_err(|e| format!("Failed to write {}: {}", dest.display(), e))?;
    Ok(dest.to_string_lossy().to_string())
}

fn resolve_existing_workspace_entry(root_path: &str, target_path: &str) -> Result<(PathBuf, PathBuf), String> {
    let root = PathBuf::from(root_path)
        .canonicalize()
        .map_err(|e| format!("Invalid workspace root: {}", e))?;
    let target = PathBuf::from(target_path)
        .canonicalize()
        .map_err(|e| format!("Target does not exist: {}", e))?;
    if !target.starts_with(&root) {
        return Err("Target path escapes workspace folder".to_string());
    }
    Ok((root, target))
}

fn validate_single_entry_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty()
        || trimmed == "."
        || trimmed == ".."
        || trimmed.contains('/')
        || trimmed.contains('\\')
    {
        return Err("Invalid file or folder name".to_string());
    }
    Ok(trimmed.to_string())
}

#[tauri::command]
fn reveal_in_file_manager(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| format!("Failed to reveal in Finder: {}", e))?;
        return Ok(());
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(format!("/select,{}", path))
            .spawn()
            .map_err(|e| format!("Failed to reveal in Explorer: {}", e))?;
        return Ok(());
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let dir = if p.is_dir() {
            p
        } else {
            p.parent().map(|d| d.to_path_buf()).unwrap_or(p)
        };
        std::process::Command::new("xdg-open")
            .arg(dir)
            .spawn()
            .map_err(|e| format!("Failed to open file manager: {}", e))?;
        return Ok(());
    }
}

#[tauri::command]
fn create_workspace_folder(root_path: String, relative_path: String) -> Result<String, String> {
    let root = PathBuf::from(&root_path)
        .canonicalize()
        .map_err(|e| format!("Invalid workspace root: {}", e))?;
    let trimmed = relative_path.trim();
    if trimmed.is_empty() {
        return Err("Folder name must not be empty".to_string());
    }
    let rel = Path::new(trimmed);
    if rel.is_absolute()
        || rel
            .components()
            .any(|c| matches!(c, Component::ParentDir | Component::RootDir | Component::Prefix(_)))
    {
        return Err("Relative path must stay inside the workspace folder".to_string());
    }
    let dest = root.join(rel);
    if dest.exists() {
        return Err("Target folder already exists".to_string());
    }
    fs::create_dir_all(&dest).map_err(|e| format!("Failed to create folder: {}", e))?;
    let canon = dest
        .canonicalize()
        .map_err(|e| format!("Invalid folder: {}", e))?;
    if !canon.starts_with(&root) {
        return Err("Destination escapes workspace folder".to_string());
    }
    Ok(canon.to_string_lossy().to_string())
}

fn rename_workspace_entry_impl(
    root_path: &str,
    target_path: &str,
    new_name: &str,
) -> Result<String, String> {
    let (root, src) = resolve_existing_workspace_entry(root_path, target_path)?;
    if src == root {
        return Err("Cannot rename the workspace root folder".to_string());
    }
    let clean_name = validate_single_entry_name(new_name)?;
    let parent = src
        .parent()
        .ok_or_else(|| "Target has no parent directory".to_string())?;
    let dest = parent.join(&clean_name);
    let same_case_insensitive = src
        .to_string_lossy()
        .eq_ignore_ascii_case(&dest.to_string_lossy());
    if dest.exists() && !same_case_insensitive {
        return Err("A file or folder with that name already exists".to_string());
    }
    fs::rename(&src, &dest).map_err(|e| format!("Failed to rename: {}", e))?;
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
fn rename_workspace_entry(
    root_path: String,
    target_path: String,
    new_name: String,
) -> Result<String, String> {
    rename_workspace_entry_impl(&root_path, &target_path, &new_name)
}

fn duplicate_workspace_file_impl(root_path: &str, target_path: &str) -> Result<String, String> {
    let (_root, src) = resolve_existing_workspace_entry(root_path, target_path)?;
    if !src.is_file() {
        return Err("Only files can be duplicated".to_string());
    }
    let parent = src
        .parent()
        .ok_or_else(|| "Target has no parent directory".to_string())?;
    let stem = src
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("file");
    let ext = src.extension().and_then(|e| e.to_str());
    let mut index = 1usize;
    let dest = loop {
        let suffix = if index == 1 {
            " copy".to_string()
        } else {
            format!(" copy {}", index)
        };
        let candidate_name = match ext {
            Some(e) if !e.is_empty() => format!("{}{}.{}", stem, suffix, e),
            _ => format!("{}{}", stem, suffix),
        };
        let candidate = parent.join(candidate_name);
        if !candidate.exists() {
            break candidate;
        }
        index += 1;
    };
    fs::copy(&src, &dest).map_err(|e| format!("Failed to duplicate file: {}", e))?;
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
fn duplicate_workspace_file(root_path: String, target_path: String) -> Result<String, String> {
    duplicate_workspace_file_impl(&root_path, &target_path)
}

fn delete_workspace_entry_impl(root_path: &str, target_path: &str) -> Result<(), String> {
    let (root, target) = resolve_existing_workspace_entry(root_path, target_path)?;
    if target == root {
        return Err("Cannot delete the workspace root folder".to_string());
    }
    if target.is_dir() {
        fs::remove_dir_all(&target).map_err(|e| format!("Failed to delete folder: {}", e))?;
    } else {
        fs::remove_file(&target).map_err(|e| format!("Failed to delete file: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn delete_workspace_entry(root_path: String, target_path: String) -> Result<(), String> {
    delete_workspace_entry_impl(&root_path, &target_path)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceReplaceResult {
    files_modified: usize,
    replacements: usize,
    modified_paths: Vec<String>,
}

fn replace_in_workspace_impl(
    root_path: &str,
    query: &str,
    replacement: &str,
    case_sensitive: bool,
    use_regex: bool,
    included_paths: Option<&[String]>,
) -> Result<WorkspaceReplaceResult, String> {
    if query.is_empty() {
        return Err("Search query must not be empty".to_string());
    }
    let pattern = if use_regex {
        query.to_string()
    } else {
        regex::escape(query)
    };
    let re = regex::RegexBuilder::new(&pattern)
        .case_insensitive(!case_sensitive)
        .multi_line(true)
        .build()
        .map_err(|e| format!("Invalid regular expression: {}", e))?;

    let root = PathBuf::from(root_path);
    if !root.exists() || !root.is_dir() {
        return Ok(WorkspaceReplaceResult {
            files_modified: 0,
            replacements: 0,
            modified_paths: Vec::new(),
        });
    }

    let allowed_paths: Option<HashSet<PathBuf>> = included_paths.map(|list| {
        list.iter()
            .map(|p| {
                let pb = PathBuf::from(p);
                pb.canonicalize().unwrap_or(pb)
            })
            .collect()
    });
    if let Some(ref set) = allowed_paths {
        if set.is_empty() {
            return Ok(WorkspaceReplaceResult {
                files_modified: 0,
                replacements: 0,
                modified_paths: Vec::new(),
            });
        }
    }

    let mut files_modified = 0usize;
    let mut replacements = 0usize;
    let mut modified_paths = Vec::new();

    let walker = WalkDir::new(&root)
        .max_depth(8)
        .into_iter()
        .filter_entry(|e| {
            if e.depth() == 0 {
                return true;
            }
            let name = e.file_name().to_string_lossy();
            if e.file_type().is_dir() {
                !should_skip_dir(&name)
            } else {
                is_supported_text_file(e.path())
            }
        });

    for entry in walker.flatten() {
        if entry.depth() == 0 || entry.file_type().is_dir() {
            continue;
        }
        if let Some(ref set) = allowed_paths {
            let entry_canon = entry
                .path()
                .canonicalize()
                .unwrap_or_else(|_| entry.path().to_path_buf());
            if !set.contains(&entry_canon) {
                continue;
            }
        }
        if let Ok(meta) = entry.metadata() {
            if meta.len() > 2 * 1024 * 1024 {
                continue;
            }
        }
        let Ok(bytes) = fs::read(entry.path()) else {
            continue;
        };
        let Ok(decoded) = decode_bytes_with_encoding(&bytes, None) else {
            continue;
        };
        let normalized_content = decoded.content.replace("\r\n", "\n");
        let count = re.find_iter(&normalized_content).count();
        if count == 0 {
            continue;
        }
        let next_normalized = if use_regex {
            re.replace_all(&normalized_content, replacement).into_owned()
        } else {
            re.replace_all(&normalized_content, regex::NoExpand(replacement))
                .into_owned()
        };
        if next_normalized == normalized_content {
            continue;
        }
        let next_with_eol = if decoded.eol == "\r\n" {
            next_normalized.replace('\n', "\r\n")
        } else {
            next_normalized
        };
        let encoded = encode_text_with_encoding(&next_with_eol, Some(&decoded.encoding))?;
        fs::write(entry.path(), encoded)
            .map_err(|e| format!("Failed to write {}: {}", entry.path().display(), e))?;
        files_modified += 1;
        replacements += count;
        modified_paths.push(entry.path().to_string_lossy().to_string());
    }

    Ok(WorkspaceReplaceResult {
        files_modified,
        replacements,
        modified_paths,
    })
}

#[tauri::command]
async fn replace_in_workspace(
    root_path: String,
    query: String,
    replacement: String,
    case_sensitive: bool,
    use_regex: bool,
    included_paths: Option<Vec<String>>,
) -> Result<WorkspaceReplaceResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        replace_in_workspace_impl(
            &root_path,
            &query,
            &replacement,
            case_sensitive,
            use_regex,
            included_paths.as_deref(),
        )
    })
    .await
    .map_err(|e| format!("Workspace replace task failed: {}", e))?
}

fn parse_locale_tag(tag: &str) -> &'static str {
    let lower = tag.trim().trim_matches('"').trim_matches('\'').to_ascii_lowercase();
    let first = lower.split(':').next().unwrap_or("").trim();
    if first == "ja"
        || first.starts_with("ja-")
        || first.starts_with("ja_")
        || first.starts_with("ja.")
        || first.starts_with("japanese")
    {
        return "ja";
    }
    if first.starts_with("zh-tw")
        || first.starts_with("zh_tw")
        || first.starts_with("zh-hant")
        || first.starts_with("zh_hant")
        || first.starts_with("zh-hk")
        || first.starts_with("zh_hk")
        || first.starts_with("zh-mo")
        || first.starts_with("zh_mo")
    {
        return "zh-TW";
    }
    if first == "zh"
        || first.starts_with("zh-")
        || first.starts_with("zh_")
        || first.starts_with("zh.")
        || first.starts_with("chinese")
    {
        return "zh-CN";
    }
    if first == "ko"
        || first.starts_with("ko-")
        || first.starts_with("ko_")
        || first.starts_with("ko.")
        || first.starts_with("korean")
    {
        return "ko";
    }
    if first == "es"
        || first.starts_with("es-")
        || first.starts_with("es_")
        || first.starts_with("es.")
        || first.starts_with("spanish")
    {
        return "es";
    }
    if first == "fr"
        || first.starts_with("fr-")
        || first.starts_with("fr_")
        || first.starts_with("fr.")
        || first.starts_with("french")
    {
        return "fr";
    }
    if first == "de"
        || first.starts_with("de-")
        || first.starts_with("de_")
        || first.starts_with("de.")
        || first.starts_with("german")
    {
        return "de";
    }
    "en"
}

fn detect_env_locale() -> &'static str {
    for key in ["LC_ALL", "LC_MESSAGES", "LANGUAGE", "LANG"] {
        if let Ok(val) = std::env::var(key) {
            let trimmed = val.trim();
            if !trimmed.is_empty() && trimmed != "C" && trimmed != "POSIX" {
                return parse_locale_tag(trimmed);
            }
        }
    }
    "en"
}

fn detect_os_locale_impl() -> &'static str {
    #[cfg(target_os = "macos")]
    {
        if let Ok(output) = std::process::Command::new("defaults")
            .args(["read", "-g", "AppleLanguages"])
            .output()
        {
            if output.status.success() {
                let text = String::from_utf8_lossy(&output.stdout);
                for line in text.lines() {
                    let trimmed = line.trim().trim_end_matches(',');
                    if trimmed.is_empty() || trimmed == "(" || trimmed == ")" {
                        continue;
                    }
                    return parse_locale_tag(trimmed);
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        #[link(name = "kernel32")]
        extern "system" {
            fn GetUserDefaultUILanguage() -> u16;
        }
        // SAFETY: GetUserDefaultUILanguage takes no pointers and returns a u16 LANGID.
        let lang_id = unsafe { GetUserDefaultUILanguage() };
        if lang_id != 0 {
            let primary_lang = lang_id & 0x03FF;
            let sub_lang = (lang_id >> 10) & 0x3F;
            return match primary_lang {
                0x11 => "ja",
                0x12 => "ko",
                0x04 => match sub_lang {
                    0x01 | 0x03 | 0x05 => "zh-TW",
                    _ => "zh-CN",
                },
                0x0A => "es",
                0x0C => "fr",
                0x07 => "de",
                _ => "en",
            };
        }
    }

    detect_env_locale()
}

#[tauri::command]
fn get_os_locale() -> String {
    detect_os_locale_impl().to_string()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusResult {
    is_repo: bool,
    branch: Option<String>,
    entries: std::collections::HashMap<String, String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHeadFileResult {
    exists_in_head: bool,
    content: String,
    branch: Option<String>,
}

fn run_git_command(dir: &Path, args: &[&str]) -> Result<std::process::Output, String> {
    let mut cmd = std::process::Command::new("git");
    cmd.arg("-C").arg(dir).args(args);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    cmd.output()
        .map_err(|e| format!("Failed to execute git: {}", e))
}

fn normalize_git_code(x: char, y: char) -> String {
    if x == '?' && y == '?' {
        return "?".to_string();
    }
    if x == 'U' || y == 'U' || (x == 'A' && y == 'A') || (x == 'D' && y == 'D') {
        return "U".to_string();
    }
    if x == 'R' || y == 'R' {
        return "R".to_string();
    }
    if x == 'D' || y == 'D' {
        return "D".to_string();
    }
    if x == 'A' || y == 'A' {
        return "A".to_string();
    }
    if x == 'M' || y == 'M' {
        return "M".to_string();
    }
    format!("{}{}", x, y).trim().to_string()
}

fn get_git_status_impl(root_path: &str) -> GitStatusResult {
    let Ok(root_canon) = PathBuf::from(root_path).canonicalize() else {
        return GitStatusResult {
            is_repo: false,
            branch: None,
            entries: std::collections::HashMap::new(),
        };
    };

    let Ok(top_out) = run_git_command(&root_canon, &["rev-parse", "--show-toplevel"]) else {
        return GitStatusResult {
            is_repo: false,
            branch: None,
            entries: std::collections::HashMap::new(),
        };
    };
    if !top_out.status.success() {
        return GitStatusResult {
            is_repo: false,
            branch: None,
            entries: std::collections::HashMap::new(),
        };
    }

    let top_raw = String::from_utf8_lossy(&top_out.stdout).trim().to_string();
    let repo_top = PathBuf::from(&top_raw)
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from(&top_raw));

    let branch = run_git_command(&root_canon, &["rev-parse", "--abbrev-ref", "HEAD"])
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|s| !s.is_empty());

    let mut entries = std::collections::HashMap::new();
    let Ok(status_out) = run_git_command(
        &root_canon,
        &["status", "--porcelain=v1", "-z", "-uall", "."],
    ) else {
        return GitStatusResult {
            is_repo: true,
            branch,
            entries,
        };
    };
    if !status_out.status.success() {
        return GitStatusResult {
            is_repo: true,
            branch,
            entries,
        };
    }

    let tokens: Vec<&[u8]> = status_out.stdout.split(|&b| b == 0).collect();
    let mut i = 0;
    while i < tokens.len() {
        let tok = tokens[i];
        i += 1;
        if tok.len() < 4 {
            continue;
        }
        let s = String::from_utf8_lossy(tok);
        let mut chars = s.chars();
        let Some(x) = chars.next() else { continue };
        let Some(y) = chars.next() else { continue };
        let Some(_sp) = chars.next() else { continue };
        let rel_from_repo: String = chars.collect();
        if rel_from_repo.is_empty() {
            continue;
        }
        // Renames/copies in -z output have an extra NUL-terminated source path following the new path
        if x == 'R' || x == 'C' || y == 'R' || y == 'C' {
            i += 1;
        }

        let abs_candidate = repo_top.join(rel_from_repo.replace('/', std::path::MAIN_SEPARATOR_STR));
        let norm_rel = if let Ok(stripped) = abs_candidate.strip_prefix(&root_canon) {
            stripped.to_string_lossy().replace('\\', "/")
        } else {
            continue;
        };
        if norm_rel.is_empty() {
            continue;
        }
        entries.insert(norm_rel, normalize_git_code(x, y));
    }

    GitStatusResult {
        is_repo: true,
        branch,
        entries,
    }
}

#[tauri::command]
fn get_git_status(root_path: String) -> GitStatusResult {
    get_git_status_impl(&root_path)
}

fn get_git_head_file_impl(
    root_path: Option<&str>,
    file_path: &str,
) -> Result<GitHeadFileResult, String> {
    let target = PathBuf::from(file_path)
        .canonicalize()
        .map_err(|e| format!("Target file does not exist: {}", e))?;

    if let Some(root) = root_path {
        let root_canon = PathBuf::from(root)
            .canonicalize()
            .map_err(|e| format!("Invalid workspace root: {}", e))?;
        if !target.starts_with(&root_canon) {
            return Err("Target path escapes workspace folder".to_string());
        }
    }

    let parent_dir = target
        .parent()
        .ok_or_else(|| "Invalid file path".to_string())?;
    let top_out = run_git_command(parent_dir, &["rev-parse", "--show-toplevel"])?;
    if !top_out.status.success() {
        return Err("Not inside a Git repository".to_string());
    }
    let top_raw = String::from_utf8_lossy(&top_out.stdout).trim().to_string();
    let repo_top = PathBuf::from(&top_raw)
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from(&top_raw));

    let rel = target
        .strip_prefix(&repo_top)
        .map_err(|_| "File is outside repository root".to_string())?;
    let rel_posix = rel.to_string_lossy().replace('\\', "/");

    let branch = run_git_command(&repo_top, &["rev-parse", "--abbrev-ref", "HEAD"])
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|s| !s.is_empty());

    let spec = format!("HEAD:{}", rel_posix);
    let show_out = run_git_command(&repo_top, &["show", &spec])?;
    if !show_out.status.success() {
        return Ok(GitHeadFileResult {
            exists_in_head: false,
            content: String::new(),
            branch,
        });
    }

    let decoded = decode_bytes_with_encoding(&show_out.stdout, None)?;
    Ok(GitHeadFileResult {
        exists_in_head: true,
        content: decoded.content,
        branch,
    })
}

#[tauri::command]
fn get_git_head_file(
    root_path: Option<String>,
    file_path: String,
) -> Result<GitHeadFileResult, String> {
    get_git_head_file_impl(root_path.as_deref(), &file_path)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClearAppCacheResult {
    removed_files: usize,
    removed_bytes: u64,
}

fn clear_dir_contents(dir: &Path) -> (usize, u64) {
    if !dir.exists() || !dir.is_dir() {
        return (0, 0);
    }
    let mut removed_files = 0usize;
    let mut removed_bytes = 0u64;
    let Ok(entries) = fs::read_dir(dir) else {
        return (0, 0);
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let (sub_files, sub_bytes) = clear_dir_contents(&path);
            removed_files += sub_files;
            removed_bytes += sub_bytes;
            let _ = fs::remove_dir(&path);
        } else {
            let size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
            if fs::remove_file(&path).is_ok() {
                removed_files += 1;
                removed_bytes += size;
            }
        }
    }
    (removed_files, removed_bytes)
}

fn clear_temp_prefix_files(temp_dir: &Path) -> (usize, u64) {
    if !temp_dir.exists() || !temp_dir.is_dir() {
        return (0, 0);
    }
    let mut removed_files = 0usize;
    let mut removed_bytes = 0u64;
    let Ok(entries) = fs::read_dir(temp_dir) else {
        return (0, 0);
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|s| s.to_str()) else {
            continue;
        };
        if name.starts_with("onigiri_ai_setup_")
            || name.starts_with("onigiri_project_setup.")
            || name.starts_with("onigiri_codex_")
        {
            let size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
            if fs::remove_file(&path).is_ok() {
                removed_files += 1;
                removed_bytes += size;
            }
        }
    }
    (removed_files, removed_bytes)
}

#[tauri::command]
fn clear_app_caches(app: tauri::AppHandle) -> Result<ClearAppCacheResult, String> {
    let mut removed_files = 0usize;
    let mut removed_bytes = 0u64;

    let temp_dir = std::env::temp_dir();
    let (img_files, img_bytes) = clear_dir_contents(&temp_dir.join("onigiri-markdown-images"));
    removed_files += img_files;
    removed_bytes += img_bytes;

    let (tmp_files, tmp_bytes) = clear_temp_prefix_files(&temp_dir);
    removed_files += tmp_files;
    removed_bytes += tmp_bytes;

    if let Ok(cache_dir) = app.path().app_cache_dir() {
        let (cache_files, cache_bytes) = clear_dir_contents(&cache_dir);
        removed_files += cache_files;
        removed_bytes += cache_bytes;
    }

    Ok(ClearAppCacheResult {
        removed_files,
        removed_bytes,
    })
}

#[tauri::command]
fn reset_window_state(app: tauri::AppHandle) -> Result<(), String> {
    window_state::reset_main_window_state(&app)
}

#[tauri::command]
fn write_binary_file(path: String, data_base64: String) -> Result<(), String> {
    let bytes = BASE64
        .decode(data_base64.trim())
        .map_err(|e| format!("Invalid base64 payload: {}", e))?;
    if let Some(parent) = Path::new(&path).parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent folder: {}", e))?;
        }
    }
    fs::write(&path, bytes).map_err(|e| format!("Failed to write {}: {}", path, e))
}

fn delete_workspace_files_impl(
    root_path: &str,
    paths: &[String],
) -> Result<ClearAppCacheResult, String> {
    let root = PathBuf::from(root_path)
        .canonicalize()
        .map_err(|e| format!("Invalid workspace root: {}", e))?;
    let mut removed_files = 0usize;
    let mut removed_bytes = 0u64;
    for raw in paths {
        let Ok(target) = PathBuf::from(raw).canonicalize() else {
            continue;
        };
        if !target.starts_with(&root) || target == root || !target.is_file() {
            continue;
        }
        let size = fs::metadata(&target).map(|m| m.len()).unwrap_or(0);
        if fs::remove_file(&target).is_ok() {
            removed_files += 1;
            removed_bytes += size;
        }
    }
    Ok(ClearAppCacheResult {
        removed_files,
        removed_bytes,
    })
}

#[tauri::command]
fn delete_workspace_files(
    root_path: String,
    paths: Vec<String>,
) -> Result<ClearAppCacheResult, String> {
    delete_workspace_files_impl(&root_path, &paths)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitWorkingFile {
    path: String,
    relative_path: String,
    index_status: String,
    worktree_status: String,
    staged: bool,
    unstaged: bool,
    untracked: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitSummary {
    hash: String,
    message: String,
    author: String,
    date: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitPanelState {
    is_repo: bool,
    branch: Option<String>,
    ahead: u32,
    behind: u32,
    has_remote: bool,
    files: Vec<GitWorkingFile>,
    recent_commits: Vec<GitCommitSummary>,
}

fn resolve_git_repo_and_root(root_path: &str) -> Result<(PathBuf, PathBuf), String> {
    let root_canon = PathBuf::from(root_path)
        .canonicalize()
        .map_err(|e| format!("Invalid workspace root: {}", e))?;
    let top_out = run_git_command(&root_canon, &["rev-parse", "--show-toplevel"])?;
    if !top_out.status.success() {
        return Err("Not inside a Git repository".to_string());
    }
    let top_raw = String::from_utf8_lossy(&top_out.stdout).trim().to_string();
    let repo_top = PathBuf::from(&top_raw)
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from(&top_raw));
    Ok((root_canon, repo_top))
}

fn validate_git_rel_paths(
    root_canon: &Path,
    repo_top: &Path,
    paths: &[String],
) -> Result<Vec<String>, String> {
    let mut repo_rels = Vec::new();
    for raw in paths {
        let p = Path::new(raw);
        let candidate = if p.is_absolute() {
            p.to_path_buf()
        } else {
            root_canon.join(raw.replace('/', std::path::MAIN_SEPARATOR_STR))
        };
        let resolved = candidate.canonicalize().unwrap_or(candidate);
        if !resolved.starts_with(repo_top) {
            return Err("Path escapes git repository".to_string());
        }
        let rel = resolved
            .strip_prefix(repo_top)
            .map_err(|_| "Path outside repository".to_string())?;
        repo_rels.push(rel.to_string_lossy().replace('\\', "/"));
    }
    Ok(repo_rels)
}

fn get_git_panel_state_impl(root_path: &str) -> GitPanelState {
    let Ok((root_canon, repo_top)) = resolve_git_repo_and_root(root_path) else {
        return GitPanelState {
            is_repo: false,
            branch: None,
            ahead: 0,
            behind: 0,
            has_remote: false,
            files: Vec::new(),
            recent_commits: Vec::new(),
        };
    };

    let branch = run_git_command(&repo_top, &["rev-parse", "--abbrev-ref", "HEAD"])
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|s| !s.is_empty());

    let has_remote = run_git_command(&repo_top, &["remote"])
        .ok()
        .filter(|o| o.status.success())
        .map(|o| !String::from_utf8_lossy(&o.stdout).trim().is_empty())
        .unwrap_or(false);

    let mut ahead = 0u32;
    let mut behind = 0u32;
    if let Ok(ab) = run_git_command(&repo_top, &["rev-list", "--left-right", "--count", "HEAD...@{u}"]) {
        if ab.status.success() {
            let txt = String::from_utf8_lossy(&ab.stdout);
            let parts: Vec<&str> = txt.split_whitespace().collect();
            if parts.len() == 2 {
                ahead = parts[0].parse::<u32>().unwrap_or(0);
                behind = parts[1].parse::<u32>().unwrap_or(0);
            }
        }
    }

    let mut files = Vec::new();
    if let Ok(status_out) = run_git_command(&repo_top, &["status", "--porcelain=v1", "-z", "-uall"]) {
        if status_out.status.success() {
            let tokens: Vec<&[u8]> = status_out.stdout.split(|&b| b == 0).collect();
            let mut i = 0;
            while i < tokens.len() {
                let tok = tokens[i];
                i += 1;
                if tok.len() < 4 {
                    continue;
                }
                let s = String::from_utf8_lossy(tok);
                let mut chars = s.chars();
                let Some(x) = chars.next() else { continue };
                let Some(y) = chars.next() else { continue };
                let Some(_sp) = chars.next() else { continue };
                let rel_from_repo: String = chars.collect();
                if rel_from_repo.is_empty() {
                    continue;
                }
                if x == 'R' || x == 'C' || y == 'R' || y == 'C' {
                    i += 1;
                }
                let abs_candidate =
                    repo_top.join(rel_from_repo.replace('/', std::path::MAIN_SEPARATOR_STR));
                let display_rel = if let Ok(stripped) = abs_candidate.strip_prefix(&root_canon) {
                    stripped.to_string_lossy().replace('\\', "/")
                } else {
                    rel_from_repo.clone()
                };
                let untracked = x == '?' && y == '?';
                let staged = !untracked && x != ' ';
                let unstaged = untracked || y != ' ';
                files.push(GitWorkingFile {
                    path: abs_candidate.to_string_lossy().to_string(),
                    relative_path: display_rel,
                    index_status: x.to_string(),
                    worktree_status: y.to_string(),
                    staged,
                    unstaged,
                    untracked,
                });
            }
        }
    }

    let mut recent_commits = Vec::new();
    if let Ok(log_out) = run_git_command(
        &repo_top,
        &["log", "-n", "10", "--pretty=format:%h\x1f%s\x1f%an\x1f%cr"],
    ) {
        if log_out.status.success() {
            let log_str = String::from_utf8_lossy(&log_out.stdout);
            for line in log_str.lines() {
                let cols: Vec<&str> = line.split('\x1f').collect();
                if cols.len() >= 4 {
                    recent_commits.push(GitCommitSummary {
                        hash: cols[0].to_string(),
                        message: cols[1].to_string(),
                        author: cols[2].to_string(),
                        date: cols[3].to_string(),
                    });
                }
            }
        }
    }

    GitPanelState {
        is_repo: true,
        branch,
        ahead,
        behind,
        has_remote,
        files,
        recent_commits,
    }
}

#[tauri::command]
fn get_git_panel_state(root_path: String) -> GitPanelState {
    get_git_panel_state_impl(&root_path)
}

fn git_stage_files_impl(root_path: &str, paths: &[String]) -> Result<(), String> {
    if paths.is_empty() {
        return Ok(());
    }
    let (root_canon, repo_top) = resolve_git_repo_and_root(root_path)?;
    let rels = validate_git_rel_paths(&root_canon, &repo_top, paths)?;
    let mut args: Vec<&str> = vec!["add", "-A", "--"];
    for r in &rels {
        args.push(r.as_str());
    }
    let out = run_git_command(&repo_top, &args)?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }
    Ok(())
}

#[tauri::command]
fn git_stage_files(root_path: String, paths: Vec<String>) -> Result<(), String> {
    git_stage_files_impl(&root_path, &paths)
}

fn git_unstage_files_impl(root_path: &str, paths: &[String]) -> Result<(), String> {
    if paths.is_empty() {
        return Ok(());
    }
    let (root_canon, repo_top) = resolve_git_repo_and_root(root_path)?;
    let rels = validate_git_rel_paths(&root_canon, &repo_top, paths)?;
    let has_head = run_git_command(&repo_top, &["rev-parse", "--verify", "HEAD"])
        .map(|o| o.status.success())
        .unwrap_or(false);
    let mut args: Vec<&str> = if has_head {
        vec!["reset", "HEAD", "--"]
    } else {
        vec!["rm", "--cached", "--"]
    };
    for r in &rels {
        args.push(r.as_str());
    }
    let out = run_git_command(&repo_top, &args)?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }
    Ok(())
}

#[tauri::command]
fn git_unstage_files(root_path: String, paths: Vec<String>) -> Result<(), String> {
    git_unstage_files_impl(&root_path, &paths)
}

#[tauri::command]
fn git_discard_files(root_path: String, paths: Vec<String>) -> Result<(), String> {
    if paths.is_empty() {
        return Ok(());
    }
    let (root_canon, repo_top) = resolve_git_repo_and_root(&root_path)?;
    let rels = validate_git_rel_paths(&root_canon, &repo_top, &paths)?;
    for rel in rels {
        let abs = repo_top.join(rel.replace('/', std::path::MAIN_SEPARATOR_STR));
        // Check if file is tracked
        let tracked = run_git_command(&repo_top, &["ls-files", "--error-unmatch", "--", &rel])
            .map(|o| o.status.success())
            .unwrap_or(false);
        if tracked {
            let out = run_git_command(&repo_top, &["checkout", "--", &rel])?;
            if !out.status.success() {
                return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
            }
        } else if abs.exists() && abs.is_file() {
            fs::remove_file(&abs).map_err(|e| format!("Failed to remove untracked file: {}", e))?;
        }
    }
    Ok(())
}

fn git_get_diff_impl(
    root_path: &str,
    staged: bool,
    file_path: Option<&str>,
) -> Result<String, String> {
    let (root_canon, repo_top) = resolve_git_repo_and_root(root_path)?;
    let mut args: Vec<String> = vec!["diff".to_string()];
    if staged {
        args.push("--cached".to_string());
    }
    if let Some(fp) = file_path {
        if !fp.trim().is_empty() {
            let rels = validate_git_rel_paths(&root_canon, &repo_top, &[fp.to_string()])?;
            args.push("--".to_string());
            args.extend(rels);
        }
    }
    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = run_git_command(&repo_top, &arg_refs)?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

#[tauri::command]
fn git_get_diff(
    root_path: String,
    staged: bool,
    file_path: Option<String>,
) -> Result<String, String> {
    git_get_diff_impl(&root_path, staged, file_path.as_deref())
}

fn git_commit_impl(root_path: &str, message: &str) -> Result<String, String> {
    let trimmed = message.trim();
    if trimmed.is_empty() {
        return Err("Commit message is empty".to_string());
    }
    let (_root_canon, repo_top) = resolve_git_repo_and_root(root_path)?;
    let out = run_git_command(&repo_top, &["commit", "-m", trimmed])?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
        return Err(if err.is_empty() { stdout } else { err });
    }
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

#[tauri::command]
fn git_commit(root_path: String, message: String) -> Result<String, String> {
    git_commit_impl(&root_path, &message)
}

#[tauri::command]
async fn git_push(root_path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || -> Result<String, String> {
        let (_root_canon, repo_top) = resolve_git_repo_and_root(&root_path)?;
        let out = run_git_command(&repo_top, &["push"])?;
        if !out.status.success() {
            let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            return Err(if err.is_empty() { stdout } else { err });
        }
        let msg = String::from_utf8_lossy(&out.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
        Ok(if !stdout.is_empty() { stdout } else { msg })
    })
    .await
    .map_err(|e| format!("Git push failed: {}", e))?
}

#[tauri::command]
async fn git_pull(root_path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || -> Result<String, String> {
        let (_root_canon, repo_top) = resolve_git_repo_and_root(&root_path)?;
        let out = run_git_command(&repo_top, &["pull"])?;
        if !out.status.success() {
            let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            return Err(if err.is_empty() { stdout } else { err });
        }
        let msg = String::from_utf8_lossy(&out.stdout).trim().to_string();
        Ok(msg)
    })
    .await
    .map_err(|e| format!("Git pull failed: {}", e))?
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorConfigFileEntry {
    dir: String,
    content: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectConfigBundle {
    onigiri_json: Option<String>,
    onigiri_json_path: Option<String>,
    editorconfigs: Vec<EditorConfigFileEntry>,
}

fn read_project_config_bundle_impl(
    workspace_root: Option<&str>,
    target_path: Option<&str>,
) -> ProjectConfigBundle {
    let root_canon = workspace_root.and_then(|r| PathBuf::from(r).canonicalize().ok());
    let mut onigiri_json = None;
    let mut onigiri_json_path = None;
    if let Some(ref root) = root_canon {
        let cfg_path = root.join(".onigiri.json");
        if cfg_path.is_file() {
            if let Ok(txt) = fs::read_to_string(&cfg_path) {
                onigiri_json = Some(txt);
                onigiri_json_path = Some(cfg_path.to_string_lossy().to_string());
            }
        }
    }

    let start_dir: Option<PathBuf> = target_path
        .and_then(|tp| {
            let p = PathBuf::from(tp);
            if p.exists() {
                p.canonicalize().ok()
            } else {
                p.parent().and_then(|par| par.canonicalize().ok())
            }
        })
        .map(|p| if p.is_file() { p.parent().unwrap_or(&p).to_path_buf() } else { p })
        .or_else(|| root_canon.clone());

    let mut editorconfigs = Vec::new();
    if let Some(mut cur) = start_dir {
        let mut guard = 0usize;
        while guard < 16 {
            guard += 1;
            let ec_path = cur.join(".editorconfig");
            if ec_path.is_file() {
                if let Ok(content) = fs::read_to_string(&ec_path) {
                    editorconfigs.push(EditorConfigFileEntry {
                        dir: cur.to_string_lossy().to_string(),
                        content,
                    });
                }
            }
            if let Some(ref root) = root_canon {
                if &cur == root {
                    break;
                }
            }
            let Some(parent) = cur.parent() else {
                break;
            };
            if parent == cur {
                break;
            }
            cur = parent.to_path_buf();
        }
    }
    // Order from outermost ancestor down to target directory so standard overrides apply naturally
    editorconfigs.reverse();

    ProjectConfigBundle {
        onigiri_json,
        onigiri_json_path,
        editorconfigs,
    }
}

#[tauri::command]
fn read_project_config_bundle(
    workspace_root: Option<String>,
    target_path: Option<String>,
) -> ProjectConfigBundle {
    read_project_config_bundle_impl(workspace_root.as_deref(), target_path.as_deref())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut initial_files = Vec::new();
    let mut seen = HashSet::new();
    for arg in std::env::args().skip(1) {
        if !arg.starts_with('-') {
            let p = PathBuf::from(&arg);
            if p.exists() && p.is_file() && seen.insert(arg.clone()) {
                initial_files.push(arg);
            }
        }
    }

    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default();

    #[cfg(not(target_os = "macos"))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            let mut new_paths = Vec::new();
            let mut seen = HashSet::new();
            for arg in args.into_iter().skip(1) {
                if !arg.starts_with('-') {
                    let raw = PathBuf::from(&arg);
                    let candidate = if raw.is_absolute() {
                        raw
                    } else {
                        PathBuf::from(&cwd).join(raw)
                    };
                    if candidate.exists() && candidate.is_file() {
                        let raw_str = candidate
                            .canonicalize()
                            .unwrap_or(candidate)
                            .to_string_lossy()
                            .to_string();
                        let resolved = raw_str.strip_prefix(r"\\?\").unwrap_or(&raw_str).to_string();
                        if seen.insert(resolved.clone()) {
                            new_paths.push(resolved);
                        }
                    }
                }
            }
            if !new_paths.is_empty() {
                if let Some(state) = app.try_state::<OpenedFilesState>() {
                    let mut guard = state.0.lock().unwrap();
                    guard.extend(new_paths.clone());
                }
                let _ = app.emit("open-files", new_paths);
            }
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.unminimize();
                let _ = win.show();
                let _ = win.set_focus();
            }
        }));
    }

    let app = builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(OpenedFilesState(Mutex::new(initial_files)))
        .manage(GlobalHotkeyState(Mutex::new(None)))
        .manage(live_preview::LivePreviewState::new())
        .manage(project::ProjectServerState::new())
        .manage(window_state::WindowStateManager::new())
        .manage(ai::AiChatState::new())
        .manage(terminal::TerminalState::new())
        .manage(updates::UpdateManagerState::new())
        .setup(|app| {
            window_state::restore_main_window_state(app.handle());
            #[cfg(all(target_os = "windows", not(debug_assertions)))]
            if let Some(main_win) = app.get_webview_window("main") {
                let _ = main_win.with_webview(|pwv| unsafe {
                    if let Ok(core) = pwv.controller().CoreWebView2() {
                        if let Ok(settings) = core.Settings() {
                            let _ = settings.SetAreDevToolsEnabled(false);
                        }
                    }
                });
            }
            #[cfg(all(target_os = "macos", not(debug_assertions)))]
            if let Some(main_win) = app.get_webview_window("main") {
                let _ = main_win.with_webview(|pwv| unsafe {
                    use objc2::msg_send;
                    use objc2::runtime::AnyObject;
                    use objc2_foundation::NSString;
                    let wk = pwv.inner() as *mut AnyObject;
                    if !wk.is_null() {
                        let config: *mut AnyObject = msg_send![wk, configuration];
                        if !config.is_null() {
                            let prefs: *mut AnyObject = msg_send![config, preferences];
                            if !prefs.is_null() {
                                let key = NSString::from_str("developerExtrasEnabled");
                                let no_val: *mut AnyObject =
                                    msg_send![objc2::class!(NSNumber), numberWithBool: false];
                                let () = msg_send![prefs, setValue: no_val, forKey: &*key];
                            }
                        }
                    }
                });
            }
            let initial_locale = detect_os_locale_impl();
            let menu = menu::build_app_menu(app.handle(), initial_locale)?;
            app.set_menu(menu)?;
            app.on_menu_event(|app_handle, event| {
                menu::handle_menu_event(app_handle, event.id().as_ref());
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            read_text_file_with_encoding,
            write_text_file,
            write_binary_file,
            read_clipboard_text,
            write_clipboard_text,
            scan_workspace,
            search_workspace,
            search_workspace_advanced,
            index_workspace_notes,
            fetch_url_content,
            read_workspace_context,
            check_files_sync,
            read_workspace_file_if_exists,
            write_workspace_file,
            reveal_in_file_manager,
            create_workspace_folder,
            rename_workspace_entry,
            duplicate_workspace_file,
            delete_workspace_entry,
            delete_workspace_files,
            images::find_unused_workspace_assets,
            replace_in_workspace,
            take_initial_files,
            images::read_image_data_url,
            images::read_image_asset_with_meta,
            images::save_image_asset,
            images::save_pasted_image,
            images::migrate_temp_images_on_save,
            updates::check_app_updates,
            updates::download_app_update,
            updates::cancel_app_update_download,
            updates::apply_downloaded_app_update,
            updates::schedule_app_update_on_exit,
            updates::check_file_exists_local,
            get_os_locale,
            get_git_status,
            get_git_head_file,
            get_git_panel_state,
            git_stage_files,
            git_unstage_files,
            git_discard_files,
            git_get_diff,
            git_commit,
            git_push,
            git_pull,
            read_project_config_bundle,
            ai::detect_ai_capabilities,
            ai::list_subscription_models,
            ai::list_local_models,
            ai::assist_ai_connection,
            ai::ai_chat,
            ai::cancel_ai_chat,
            menu::rebuild_app_menu,
            browser::browser_open_or_update,
            browser::browser_set_bounds,
            browser::browser_navigate,
            browser::browser_nav_action,
            browser::browser_open_devtools,
            browser::browser_close,
            browser::browser_capture_screenshot,
            browser::open_in_external_browser,
            live_preview::start_external_preview,
            live_preview::update_external_preview,
            live_preview::stop_external_preview,
            live_preview::get_external_preview_status,
            project::inspect_workspace_project,
            project::inspect_project_for_path,
            project::start_project_dev_server,
            project::stop_project_dev_server,
            project::clear_project_dev_server_logs,
            project::get_project_dev_server_status,
            project::find_free_project_port,
            project::assist_project_setup,
            terminal::terminal_run_command,
            terminal::terminal_kill_command,
            set_global_hotkey,
            clear_app_caches,
            reset_window_state
        ])
        .build(tauri::generate_context!())
        .expect("error while building Onigiri Editor");

    app.run(|app_handle, event| {
        match &event {
            tauri::RunEvent::WindowEvent {
                label,
                event: win_event,
                ..
            } if label == window_state::MAIN_WINDOW_LABEL => match win_event {
                tauri::WindowEvent::Resized(_) | tauri::WindowEvent::Moved(_) => {
                    window_state::capture_main_window_state(app_handle, false);
                }
                tauri::WindowEvent::CloseRequested { .. } => {
                    window_state::capture_main_window_state(app_handle, true);
                }
                tauri::WindowEvent::Destroyed => {
                    window_state::flush_window_state(app_handle);
                    project::stop_project_dev_server_sync(app_handle);
                }
                _ => {}
            },
            tauri::RunEvent::WindowEvent {
                event: tauri::WindowEvent::Destroyed,
                ..
            } => {
                project::stop_project_dev_server_sync(app_handle);
            }
            tauri::RunEvent::Exit => {
                window_state::capture_main_window_state(app_handle, true);
                window_state::flush_window_state(app_handle);
                project::stop_project_dev_server_sync(app_handle);
                updates::run_pending_update_on_exit_sync(app_handle);
            }
            tauri::RunEvent::ExitRequested { .. } => {
                window_state::capture_main_window_state(app_handle, true);
                window_state::flush_window_state(app_handle);
                project::stop_project_dev_server_sync(app_handle);
            }
            _ => {}
        }
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = event {
            let paths: Vec<String> = urls
                .into_iter()
                .filter_map(|u| u.to_file_path().ok())
                .map(|p| p.to_string_lossy().to_string())
                .collect();
            if !paths.is_empty() {
                if let Some(state) = app_handle.try_state::<OpenedFilesState>() {
                    let mut guard = state.0.lock().unwrap();
                    guard.extend(paths.clone());
                }
                let _ = app_handle.emit("open-files", paths);
            }
        }
        #[cfg(not(target_os = "macos"))]
        let _ = (app_handle, event);
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn check_files_sync_handles_existing_and_missing_files() {
        let base = std::env::temp_dir().join(format!(
            "onigiri_sync_test_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&base).unwrap();
        let file_a = base.join("a.md");
        fs::write(&file_a, "hello").unwrap();
        let missing = base.join("missing.md");

        let res = check_files_sync(vec![
            file_a.to_string_lossy().to_string(),
            missing.to_string_lossy().to_string(),
        ]);
        assert_eq!(res.len(), 2);
        assert!(res[0].exists);
        assert_eq!(res[0].size, 5);
        assert!(res[0].modified_ms > 0);
        assert!(!res[1].exists);
        assert_eq!(res[1].size, 0);

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn read_workspace_file_if_exists_checks_existence_and_traversal() {
        let base = std::env::temp_dir().join(format!(
            "onigiri_ws_read_test_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&base).unwrap();
        let file_path = base.join("note.md");
        fs::write(&file_path, "# Note").unwrap();

        let root = base.to_string_lossy().to_string();
        assert_eq!(
            read_workspace_file_if_exists_impl(&root, "note.md").unwrap(),
            Some("# Note".to_string())
        );
        assert_eq!(
            read_workspace_file_if_exists_impl(&root, "new-note.md").unwrap(),
            None
        );
        assert!(read_workspace_file_if_exists_impl(&root, "../escape.md").is_err());

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn parse_locale_tag_detects_supported_locales_and_defaults_en() {
        assert_eq!(parse_locale_tag("ja"), "ja");
        assert_eq!(parse_locale_tag("\"ja-JP\""), "ja");
        assert_eq!(parse_locale_tag("ja_JP.UTF-8"), "ja");
        assert_eq!(parse_locale_tag("ja:en"), "ja");
        assert_eq!(parse_locale_tag("zh-Hans"), "zh-CN");
        assert_eq!(parse_locale_tag("zh_CN.UTF-8"), "zh-CN");
        assert_eq!(parse_locale_tag("zh-Hant"), "zh-TW");
        assert_eq!(parse_locale_tag("zh-TW"), "zh-TW");
        assert_eq!(parse_locale_tag("ko-KR"), "ko");
        assert_eq!(parse_locale_tag("es-ES"), "es");
        assert_eq!(parse_locale_tag("fr_FR.UTF-8"), "fr");
        assert_eq!(parse_locale_tag("de-DE"), "de");
        assert_eq!(parse_locale_tag("en-US"), "en");
        assert_eq!(parse_locale_tag("C.UTF-8"), "en");
    }

    #[test]
    fn encode_and_decode_supported_encodings_round_trip() {
        let sample = "こんにちは、Onigiri Editor！\r\n日本語テストABC123";
        for enc in [
            "utf-8",
            "utf-8-bom",
            "shift_jis",
            "euc-jp",
            "iso-2022-jp",
            "utf-16le",
            "utf-16be",
        ] {
            let bytes = encode_text_with_encoding(sample, Some(enc)).unwrap();
            let auto_decoded = decode_bytes_with_encoding(&bytes, None).unwrap();
            assert_eq!(auto_decoded.content, sample, "auto round-trip failed for {}", enc);
            assert_eq!(auto_decoded.encoding, enc, "auto detected wrong encoding for {}", enc);
            assert_eq!(auto_decoded.eol, "\r\n");

            let explicit_decoded = decode_bytes_with_encoding(&bytes, Some(enc)).unwrap();
            assert_eq!(explicit_decoded.content, sample);
            assert_eq!(explicit_decoded.encoding, enc);
        }
    }

    #[test]
    fn encode_rejects_unmappable_characters_without_silent_loss() {
        let with_emoji = "おにぎり🍙";
        let err = encode_text_with_encoding(with_emoji, Some("shift_jis")).unwrap_err();
        assert!(err.contains("Shift_JIS"));
    }

    #[test]
    fn workspace_entry_ops_and_replace_work_safely() {
        let base = std::env::temp_dir().join(format!(
            "onigiri_ws_ops_test_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&base).unwrap();
        let file_a = base.join("draft.md");
        fs::write(&file_a, "Hello world\nhello again\n").unwrap();

        let root = base.to_string_lossy().to_string();
        let dup = duplicate_workspace_file_impl(&root, &file_a.to_string_lossy()).unwrap();
        assert!(dup.ends_with("draft copy.md"));

        let renamed = rename_workspace_entry_impl(&root, &dup, "renamed.md").unwrap();
        assert!(renamed.ends_with("renamed.md"));

        let rep = replace_in_workspace_impl(&root, "hello", "Hi", false, false, None).unwrap();
        assert_eq!(rep.files_modified, 2);
        assert_eq!(rep.replacements, 4);

        let updated = fs::read_to_string(&file_a).unwrap();
        assert_eq!(updated, "Hi world\nHi again\n");

        // Selective replace only updates included_paths
        let included = vec![file_a.to_string_lossy().to_string()];
        let grep = search_workspace_advanced_impl(&root, "Hi\\s+(world|again)", false, true, 50).unwrap();
        assert_eq!(grep.total_files, 2);
        assert_eq!(grep.total_matches, 4);

        let selective = replace_in_workspace_impl(
            &root,
            "Hi",
            "Hey",
            true,
            false,
            Some(&included),
        )
        .unwrap();
        assert_eq!(selective.files_modified, 1);
        assert_eq!(fs::read_to_string(&file_a).unwrap(), "Hey world\nHey again\n");
        assert_eq!(fs::read_to_string(&renamed).unwrap(), "Hi world\nHi again\n");

        assert!(rename_workspace_entry_impl(&root, &renamed, "../escape.md").is_err());
        delete_workspace_entry_impl(&root, &renamed).unwrap();
        assert!(!Path::new(&renamed).exists());

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn index_workspace_notes_extracts_tags_and_links() {
        let base = std::env::temp_dir().join(format!(
            "onigiri_index_test_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&base).unwrap();
        fs::write(
            base.join("daily.md"),
            "---\ntitle: Daily Note\ntags: [journal, dev-log]\n---\n# Heading\nSee [[Architecture]] and [Spec](./spec.md#top) #focus #日本語タグ\n`#ignored-inline`\n```\n#ignored-fence\n```\n",
        )
        .unwrap();
        fs::write(base.join("spec.md"), "# Spec\n#api\n").unwrap();

        let notes = index_workspace_notes_impl(&base.to_string_lossy()).unwrap();
        assert_eq!(notes.len(), 2);
        let daily = notes.iter().find(|n| n.name == "daily.md").unwrap();
        assert_eq!(daily.title, "Daily Note");
        let tag_names: Vec<&str> = daily.tags.iter().map(|t| t.tag.as_str()).collect();
        assert!(tag_names.contains(&"journal"));
        assert!(tag_names.contains(&"dev-log"));
        assert!(tag_names.contains(&"focus"));
        assert!(tag_names.contains(&"日本語タグ"));
        assert!(!tag_names.contains(&"ignored-inline"));
        assert!(!tag_names.contains(&"ignored-fence"));
        assert_eq!(daily.outgoing_links.len(), 2);
        assert_eq!(daily.outgoing_links[0].kind, "wiki");
        assert_eq!(daily.outgoing_links[0].target, "Architecture");
        assert_eq!(daily.outgoing_links[1].kind, "md");
        assert_eq!(daily.outgoing_links[1].target, "./spec.md");

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn git_status_and_head_file_work_on_repo_and_non_repo() {
        let base = std::env::temp_dir().join(format!(
            "onigiri_git_test_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&base).unwrap();
        let root_str = base.to_string_lossy().to_string();

        // Non-repo returns is_repo = false gracefully
        let non_repo = get_git_status_impl(&root_str);
        assert!(!non_repo.is_repo);
        assert!(non_repo.entries.is_empty());

        // Initialize git repo, commit a file, modify it, add untracked file
        if std::process::Command::new("git").arg("--version").output().is_ok() {
            let _ = run_git_command(&base, &["init"]);
            let _ = run_git_command(&base, &["config", "user.name", "Test"]);
            let _ = run_git_command(&base, &["config", "user.email", "test@example.com"]);
            let tracked = base.join("doc.md");
            fs::write(&tracked, "# Initial\n").unwrap();
            let _ = run_git_command(&base, &["add", "doc.md"]);
            let _ = run_git_command(&base, &["commit", "-m", "init"]);

            fs::write(&tracked, "# Updated\n").unwrap();
            fs::write(base.join("new.md"), "# New\n").unwrap();

            let st = get_git_status_impl(&root_str);
            assert!(st.is_repo);
            assert_eq!(st.entries.get("doc.md").map(String::as_str), Some("M"));
            assert_eq!(st.entries.get("new.md").map(String::as_str), Some("?"));

            let head_tracked =
                get_git_head_file_impl(Some(&root_str), &tracked.to_string_lossy()).unwrap();
            assert!(head_tracked.exists_in_head);
            assert_eq!(head_tracked.content, "# Initial\n");

            let head_untracked =
                get_git_head_file_impl(Some(&root_str), &base.join("new.md").to_string_lossy())
                    .unwrap();
            assert!(!head_untracked.exists_in_head);
        }

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn clear_dir_and_temp_prefix_cleanup_works() {
        let base = std::env::temp_dir().join(format!(
            "onigiri_cache_clean_test_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let sub = base.join("nested");
        fs::create_dir_all(&sub).unwrap();
        fs::write(base.join("img1.png"), b"12345").unwrap();
        fs::write(sub.join("img2.png"), b"67890").unwrap();

        let (files, bytes) = clear_dir_contents(&base);
        assert_eq!(files, 2);
        assert_eq!(bytes, 10);
        assert!(base.exists());
        assert!(!sub.exists());

        fs::write(base.join("onigiri_ai_setup_123.sh"), b"echo hi").unwrap();
        fs::write(base.join("onigiri_project_setup.sh"), b"echo dev").unwrap();
        fs::write(base.join("unrelated.txt"), b"keep").unwrap();
        let (tfiles, tbytes) = clear_temp_prefix_files(&base);
        assert_eq!(tfiles, 2);
        assert_eq!(tbytes, 15);
        assert!(base.join("unrelated.txt").exists());

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn unused_assets_scan_and_delete_works_safely() {
        let base = std::env::temp_dir().join(format!(
            "onigiri_unused_assets_test_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let assets = base.join("assets");
        fs::create_dir_all(&assets).unwrap();
        let used_img = assets.join("used.png");
        let unsaved_img = assets.join("unsaved_tab.png");
        let unused_img = assets.join("orphan.png");
        fs::write(&used_img, b"used-bytes").unwrap();
        fs::write(&unsaved_img, b"unsaved-bytes").unwrap();
        fs::write(&unused_img, b"orphan-123456").unwrap();
        fs::write(base.join("doc.md"), "# Doc\n![alt](assets/used.png)\n").unwrap();

        let root_str = base.to_string_lossy().to_string();
        let found = images::find_unused_workspace_assets_impl(
            &root_str,
            &["Draft with ![draft](assets/unsaved_tab.png)".to_string()],
        )
        .unwrap();
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].name, "orphan.png");

        let del = delete_workspace_files_impl(
            &root_str,
            &[unused_img.to_string_lossy().to_string()],
        )
        .unwrap();
        assert_eq!(del.removed_files, 1);
        assert_eq!(del.removed_bytes, 13);
        assert!(used_img.exists());
        assert!(!unused_img.exists());

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn git_panel_stage_diff_commit_and_project_config_work() {
        let base = std::env::temp_dir().join(format!(
            "onigiri_git_panel_test_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let nested = base.join("docs");
        fs::create_dir_all(&nested).unwrap();
        fs::write(base.join(".editorconfig"), "root = true\n[*]\nindent_size = 2\n").unwrap();
        fs::write(nested.join(".editorconfig"), "[*.md]\nindent_size = 4\n").unwrap();
        fs::write(base.join(".onigiri.json"), "{\"imageAssetFolder\":\"img\"}\n").unwrap();

        let root_str = base.to_string_lossy().to_string();
        let target_md = nested.join("note.md");
        fs::write(&target_md, "# Note\n").unwrap();

        let bundle = read_project_config_bundle_impl(
            Some(&root_str),
            Some(&target_md.to_string_lossy()),
        );
        assert!(bundle.onigiri_json.is_some());
        assert_eq!(bundle.editorconfigs.len(), 2);

        if std::process::Command::new("git").arg("--version").output().is_ok() {
            let _ = run_git_command(&base, &["init"]);
            let _ = run_git_command(&base, &["config", "user.name", "Tester"]);
            let _ = run_git_command(&base, &["config", "user.email", "tester@example.com"]);
            git_stage_files_impl(&root_str, &["docs/note.md".to_string()]).unwrap();
            let state1 = get_git_panel_state_impl(&root_str);
            assert!(state1.is_repo);
            assert!(state1.files.iter().any(|f| f.relative_path == "docs/note.md" && f.staged));
            let _ = git_commit_impl(&root_str, "Add note").unwrap();

            fs::write(&target_md, "# Updated Note\n").unwrap();
            let diff_unstaged = git_get_diff_impl(&root_str, false, Some("docs/note.md")).unwrap();
            assert!(diff_unstaged.contains("Updated Note"));
            git_stage_files_impl(&root_str, &["docs/note.md".to_string()]).unwrap();
            let diff_staged = git_get_diff_impl(&root_str, true, Some("docs/note.md")).unwrap();
            assert!(diff_staged.contains("Updated Note"));
            git_unstage_files_impl(&root_str, &["docs/note.md".to_string()]).unwrap();
            let state2 = get_git_panel_state_impl(&root_str);
            assert!(state2.files.iter().any(|f| f.relative_path == "docs/note.md" && !f.staged && f.unstaged));
        }

        let _ = fs::remove_dir_all(&base);
    }
}
