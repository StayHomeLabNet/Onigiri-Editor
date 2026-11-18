mod ai;
mod browser;
mod live_preview;
mod menu;
mod project;
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

fn is_supported_text_file(path: &Path) -> bool {
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
    )
}

fn is_supported_image_file(path: &Path) -> bool {
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

fn should_skip_dir(name: &str) -> bool {
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

fn decode_bytes_with_encoding(
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

#[tauri::command]
fn take_initial_files(state: State<'_, OpenedFilesState>) -> Vec<String> {
    let mut guard = state.0.lock().unwrap();
    let items = guard.clone();
    guard.clear();
    items
}

fn guess_image_mime(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("svg") => "image/svg+xml",
        Some("bmp") => "image/bmp",
        Some("ico") => "image/x-icon",
        Some("avif") => "image/avif",
        _ => "application/octet-stream",
    }
}

#[tauri::command]
fn read_image_data_url(path: String, base_dir: Option<String>) -> Result<String, String> {
    let cleaned = path
        .strip_prefix("file://")
        .unwrap_or(&path)
        .trim();
    let decoded = cleaned.replace("%20", " ");
    let resolved = ai::resolve_image_path(&decoded, base_dir.as_deref());
    let bytes = fs::read(&resolved)
        .map_err(|e| format!("Failed to read image {}: {}", resolved.display(), e))?;
    if bytes.len() > 25 * 1024 * 1024 {
        return Err("Image is larger than 25MB".to_string());
    }
    let mime = guess_image_mime(&resolved);
    Ok(format!("data:{};base64,{}", mime, BASE64.encode(&bytes)))
}

#[tauri::command]
fn save_image_asset(source_path: String, doc_path: Option<String>) -> Result<String, String> {
    let src = PathBuf::from(&source_path);
    if !src.exists() || !src.is_file() {
        return Err(format!("Image file not found: {}", source_path));
    }

    if let Some(doc) = doc_path {
        let doc_p = PathBuf::from(&doc);
        let base_dir = if doc_p.is_dir() {
            doc_p
        } else {
            doc_p
                .parent()
                .map(|p| p.to_path_buf())
                .unwrap_or_else(|| PathBuf::from("."))
        };
        let assets_dir = base_dir.join("assets");
        fs::create_dir_all(&assets_dir)
            .map_err(|e| format!("Failed to create assets dir: {}", e))?;

        let orig_name = src
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("image.png");
        let sanitized: String = orig_name
            .chars()
            .map(|c| if c.is_whitespace() { '-' } else { c })
            .collect();
        let mut dest = assets_dir.join(&sanitized);
        if dest.exists() && dest != src {
            let stem = src
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("image");
            let ext = src.extension().and_then(|e| e.to_str()).unwrap_or("png");
            let ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0);
            let unique_name = format!("{}-{}.{}", stem, ts, ext);
            dest = assets_dir.join(&unique_name);
        }
        if dest != src {
            fs::copy(&src, &dest).map_err(|e| format!("Failed to copy image: {}", e))?;
        }
        let final_name = dest
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("image.png");
        return Ok(format!("./assets/{}", final_name));
    }

    Ok(source_path)
}

#[tauri::command]
fn save_pasted_image(
    base64_data: String,
    ext: String,
    doc_path: Option<String>,
) -> Result<String, String> {
    let raw_b64 = base64_data
        .split_once(',')
        .map(|(_, b)| b)
        .unwrap_or(&base64_data);
    let bytes = BASE64
        .decode(raw_b64)
        .map_err(|e| format!("Invalid image base64: {}", e))?;
    let safe_ext = ext
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect::<String>();
    let ext_final = if safe_ext.is_empty() {
        "png".to_string()
    } else {
        safe_ext
    };
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let file_name = format!("pasted-{}.{}", ts, ext_final);

    if let Some(doc) = doc_path {
        let doc_p = PathBuf::from(&doc);
        let base_dir = if doc_p.is_dir() {
            doc_p
        } else {
            doc_p
                .parent()
                .map(|p| p.to_path_buf())
                .unwrap_or_else(|| PathBuf::from("."))
        };
        let assets_dir = base_dir.join("assets");
        fs::create_dir_all(&assets_dir)
            .map_err(|e| format!("Failed to create assets dir: {}", e))?;
        let dest = assets_dir.join(&file_name);
        fs::write(&dest, &bytes).map_err(|e| format!("Failed to save pasted image: {}", e))?;
        return Ok(format!("./assets/{}", file_name));
    }

    let tmp_dir = std::env::temp_dir().join("onigiri-markdown-images");
    fs::create_dir_all(&tmp_dir).map_err(|e| format!("Failed to create temp image dir: {}", e))?;
    let dest = tmp_dir.join(&file_name);
    fs::write(&dest, &bytes).map_err(|e| format!("Failed to save temp image: {}", e))?;
    Ok(dest.to_string_lossy().to_string())
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
) -> Result<WorkspaceReplaceResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        replace_in_workspace_impl(&root_path, &query, &replacement, case_sensitive, use_regex)
    })
    .await
    .map_err(|e| format!("Workspace replace task failed: {}", e))?
}

fn parse_locale_tag_is_ja(tag: &str) -> bool {
    let lower = tag.trim().trim_matches('"').trim_matches('\'').to_ascii_lowercase();
    let first = lower.split(':').next().unwrap_or("").trim();
    first == "ja"
        || first.starts_with("ja-")
        || first.starts_with("ja_")
        || first.starts_with("ja.")
        || first.starts_with("japanese")
}

fn detect_env_locale_is_ja() -> bool {
    for key in ["LC_ALL", "LC_MESSAGES", "LANGUAGE", "LANG"] {
        if let Ok(val) = std::env::var(key) {
            let trimmed = val.trim();
            if !trimmed.is_empty() && trimmed != "C" && trimmed != "POSIX" {
                return parse_locale_tag_is_ja(trimmed);
            }
        }
    }
    false
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
                    return if parse_locale_tag_is_ja(trimmed) {
                        "ja"
                    } else {
                        "en"
                    };
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
            return if primary_lang == 0x11 { "ja" } else { "en" };
        }
    }

    if detect_env_locale_is_ja() {
        "ja"
    } else {
        "en"
    }
}

#[tauri::command]
fn get_os_locale() -> String {
    detect_os_locale_impl().to_string()
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
        .manage(OpenedFilesState(Mutex::new(initial_files)))
        .manage(live_preview::LivePreviewState::new())
        .manage(project::ProjectServerState::new())
        .manage(window_state::WindowStateManager::new())
        .manage(ai::AiChatState::new())
        .setup(|app| {
            window_state::restore_main_window_state(app.handle());
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
            read_clipboard_text,
            write_clipboard_text,
            scan_workspace,
            search_workspace,
            read_workspace_context,
            check_files_sync,
            read_workspace_file_if_exists,
            write_workspace_file,
            reveal_in_file_manager,
            create_workspace_folder,
            rename_workspace_entry,
            duplicate_workspace_file,
            delete_workspace_entry,
            replace_in_workspace,
            take_initial_files,
            read_image_data_url,
            save_image_asset,
            save_pasted_image,
            get_os_locale,
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
            browser::browser_close,
            browser::open_in_external_browser,
            live_preview::start_external_preview,
            live_preview::update_external_preview,
            live_preview::stop_external_preview,
            live_preview::get_external_preview_status,
            project::inspect_workspace_project,
            project::inspect_project_for_path,
            project::start_project_dev_server,
            project::stop_project_dev_server,
            project::get_project_dev_server_status,
            project::assist_project_setup
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
            tauri::RunEvent::Exit | tauri::RunEvent::ExitRequested { .. } => {
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
    fn parse_locale_tag_detects_japanese_and_defaults_other() {
        assert!(parse_locale_tag_is_ja("ja"));
        assert!(parse_locale_tag_is_ja("\"ja-JP\""));
        assert!(parse_locale_tag_is_ja("ja_JP.UTF-8"));
        assert!(parse_locale_tag_is_ja("ja:en"));
        assert!(!parse_locale_tag_is_ja("en-US"));
        assert!(!parse_locale_tag_is_ja("fr_FR.UTF-8"));
        assert!(!parse_locale_tag_is_ja("zh-Hans"));
        assert!(!parse_locale_tag_is_ja("C.UTF-8"));
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

        let rep = replace_in_workspace_impl(&root, "hello", "Hi", false, false).unwrap();
        assert_eq!(rep.files_modified, 2);
        assert_eq!(rep.replacements, 4);

        let updated = fs::read_to_string(&file_a).unwrap();
        assert_eq!(updated, "Hi world\nHi again\n");

        assert!(rename_workspace_entry_impl(&root, &renamed, "../escape.md").is_err());
        delete_workspace_entry_impl(&root, &renamed).unwrap();
        assert!(!Path::new(&renamed).exists());

        let _ = fs::remove_dir_all(&base);
    }
}
