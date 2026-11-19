use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

use crate::{ai, decode_bytes_with_encoding, is_supported_image_file, should_skip_dir};

pub const TEMP_PASTED_IMAGE_DIR_NAME: &str = "onigiri-markdown-images";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageAssetPayload {
    pub unchanged: bool,
    pub modified_ms: u64,
    pub data_url: Option<String>,
    pub byte_len: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrateTempImagesResult {
    pub content: String,
    pub migrated_count: usize,
    pub migrated_files: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnusedAssetEntry {
    pub path: String,
    pub relative_path: String,
    pub name: String,
    pub size: u64,
    pub modified_ms: u64,
}

pub fn guess_image_mime(path: &Path) -> &'static str {
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

pub fn percent_decode_utf8(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let h1 = bytes[i + 1];
            let h2 = bytes[i + 2];
            if let (Some(d1), Some(d2)) = (
                (h1 as char).to_digit(16),
                (h2 as char).to_digit(16),
            ) {
                out.push(((d1 << 4) | d2) as u8);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).to_string()
}

pub fn strip_windows_leading_slash(s: &str) -> &str {
    let bytes = s.as_bytes();
    if bytes.len() >= 4
        && bytes[0] == b'/'
        && bytes[1].is_ascii_alphabetic()
        && bytes[2] == b':'
        && (bytes[3] == b'/' || bytes[3] == b'\\')
    {
        &s[1..]
    } else {
        s
    }
}

pub fn clean_image_path_candidates(raw_path: &str) -> Vec<String> {
    let mut cleaned = raw_path.trim();
    if cleaned.starts_with('<') && cleaned.ends_with('>') && cleaned.len() >= 2 {
        cleaned = cleaned[1..cleaned.len() - 1].trim();
    }

    let mut candidates = Vec::new();
    let lower = cleaned.to_ascii_lowercase();
    if lower.starts_with("file://") {
        if let Ok(parsed) = url::Url::parse(cleaned) {
            if let Ok(file_path) = parsed.to_file_path() {
                let s = file_path.to_string_lossy().to_string();
                let normalized = strip_windows_leading_slash(&s).to_string();
                if !normalized.is_empty() {
                    candidates.push(normalized);
                }
            }
        }
        let after_scheme = &cleaned[7..];
        let without_localhost = if after_scheme.to_ascii_lowercase().starts_with("localhost/") {
            &after_scheme[9..]
        } else {
            after_scheme
        };
        let stripped = strip_windows_leading_slash(without_localhost);
        let decoded = strip_windows_leading_slash(&percent_decode_utf8(stripped)).to_string();
        if !decoded.is_empty() && !candidates.contains(&decoded) {
            candidates.push(decoded);
        }
        if !stripped.is_empty() && !candidates.iter().any(|c| c == stripped) {
            candidates.push(stripped.to_string());
        }
    } else {
        let stripped = strip_windows_leading_slash(cleaned);
        let decoded = strip_windows_leading_slash(&percent_decode_utf8(stripped)).to_string();
        if !stripped.is_empty() {
            candidates.push(stripped.to_string());
        }
        if !decoded.is_empty() && !candidates.contains(&decoded) {
            candidates.push(decoded);
        }
    }
    candidates
}

fn resolve_candidate_image_path(path: &str, base_dir: Option<&str>) -> Result<PathBuf, String> {
    let candidates = clean_image_path_candidates(path);
    if candidates.is_empty() {
        return Err("Empty image path".to_string());
    }

    let mut resolved = ai::resolve_image_path(&candidates[0], base_dir);
    if !resolved.exists() {
        for cand in &candidates[1..] {
            let try_path = ai::resolve_image_path(cand, base_dir);
            if try_path.exists() {
                resolved = try_path;
                break;
            }
        }
    }
    Ok(resolved)
}

fn file_modified_ms(meta: &fs::Metadata) -> u64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

pub fn read_image_data_url_impl(path: &str, base_dir: Option<&str>) -> Result<String, String> {
    let resolved = resolve_candidate_image_path(path, base_dir)?;
    let bytes = fs::read(&resolved)
        .map_err(|e| format!("Failed to read image {}: {}", resolved.display(), e))?;
    if bytes.len() > 25 * 1024 * 1024 {
        return Err("Image is larger than 25MB".to_string());
    }
    let mime = guess_image_mime(&resolved);
    Ok(format!("data:{};base64,{}", mime, BASE64.encode(&bytes)))
}

pub fn read_image_asset_with_meta_impl(
    path: &str,
    base_dir: Option<&str>,
    cached_modified_ms: Option<u64>,
) -> Result<ImageAssetPayload, String> {
    let resolved = resolve_candidate_image_path(path, base_dir)?;
    let meta = fs::metadata(&resolved)
        .map_err(|e| format!("Failed to stat image {}: {}", resolved.display(), e))?;
    let modified_ms = file_modified_ms(&meta);
    let byte_len = meta.len();

    if byte_len > 25 * 1024 * 1024 {
        return Err("Image is larger than 25MB".to_string());
    }

    if let Some(prev_ms) = cached_modified_ms {
        if prev_ms > 0 && prev_ms == modified_ms {
            return Ok(ImageAssetPayload {
                unchanged: true,
                modified_ms,
                data_url: None,
                byte_len,
            });
        }
    }

    let bytes = fs::read(&resolved)
        .map_err(|e| format!("Failed to read image {}: {}", resolved.display(), e))?;
    if bytes.len() > 25 * 1024 * 1024 {
        return Err("Image is larger than 25MB".to_string());
    }
    let mime = guess_image_mime(&resolved);
    Ok(ImageAssetPayload {
        unchanged: false,
        modified_ms,
        data_url: Some(format!("data:{};base64,{}", mime, BASE64.encode(&bytes))),
        byte_len: bytes.len() as u64,
    })
}

#[tauri::command]
pub fn read_image_data_url(path: String, base_dir: Option<String>) -> Result<String, String> {
    read_image_data_url_impl(&path, base_dir.as_deref())
}

#[tauri::command]
pub fn read_image_asset_with_meta(
    path: String,
    base_dir: Option<String>,
    cached_modified_ms: Option<u64>,
) -> Result<ImageAssetPayload, String> {
    read_image_asset_with_meta_impl(&path, base_dir.as_deref(), cached_modified_ms)
}

pub fn sanitize_asset_folder(raw: Option<&str>) -> Result<(PathBuf, String), String> {
    let trimmed = raw
        .unwrap_or("assets")
        .trim()
        .trim_start_matches("./")
        .trim_start_matches(".\\");
    let effective = if trimmed.is_empty() {
        "assets"
    } else {
        trimmed
    };
    let mut rel_buf = PathBuf::new();
    let mut parts = Vec::new();
    for seg in effective.split(&['/', '\\'][..]) {
        let s = seg.trim();
        if s.is_empty() || s == "." {
            continue;
        }
        if s == ".." || s.contains(':') || s.chars().any(|c| c.is_control()) {
            return Err("Invalid asset folder path".to_string());
        }
        rel_buf.push(s);
        parts.push(s.to_string());
    }
    if parts.is_empty() {
        return Ok((PathBuf::from("assets"), "assets".to_string()));
    }
    Ok((rel_buf, parts.join("/")))
}

pub fn resolve_asset_base_dir(
    doc_path: Option<&str>,
    workspace_root: Option<&str>,
) -> Option<PathBuf> {
    if let Some(doc) = doc_path.map(str::trim).filter(|s| !s.is_empty()) {
        let doc_p = PathBuf::from(doc);
        let base_dir = if doc_p.is_dir() {
            doc_p
        } else {
            doc_p
                .parent()
                .map(|p| p.to_path_buf())
                .unwrap_or_else(|| PathBuf::from("."))
        };
        return Some(base_dir);
    }
    if let Some(ws) = workspace_root.map(str::trim).filter(|s| !s.is_empty()) {
        return Some(PathBuf::from(ws));
    }
    None
}

fn unique_dest_in_dir(assets_dir: &Path, orig_name: &str, src_for_same_check: Option<&Path>) -> PathBuf {
    let sanitized: String = orig_name
        .chars()
        .map(|c| if c.is_whitespace() { '-' } else { c })
        .collect();
    let mut dest = assets_dir.join(&sanitized);
    if dest.exists() && src_for_same_check.map(|s| s != dest).unwrap_or(true) {
        let p = Path::new(&sanitized);
        let raw_stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("image");
        let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("png");
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let mut unique_name = format!("{}-{}.{}", raw_stem, ts, ext);
        let mut counter = 1u32;
        while assets_dir.join(&unique_name).exists() {
            unique_name = format!("{}-{}-{}.{}", raw_stem, ts, counter, ext);
            counter += 1;
        }
        dest = assets_dir.join(&unique_name);
    }
    dest
}

pub fn save_image_asset_impl(
    source_path: &str,
    doc_path: Option<&str>,
    workspace_root: Option<&str>,
    asset_dir: Option<&str>,
) -> Result<String, String> {
    let src = PathBuf::from(source_path);
    if !src.exists() || !src.is_file() {
        return Err(format!("Image file not found: {}", source_path));
    }

    if let Some(base_dir) = resolve_asset_base_dir(doc_path, workspace_root) {
        let (rel_dir_path, rel_dir_posix) = sanitize_asset_folder(asset_dir)?;
        let assets_dir = base_dir.join(&rel_dir_path);
        fs::create_dir_all(&assets_dir)
            .map_err(|e| format!("Failed to create assets dir: {}", e))?;

        let orig_name = src
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("image.png");
        let dest = unique_dest_in_dir(&assets_dir, orig_name, Some(&src));
        if dest != src {
            fs::copy(&src, &dest).map_err(|e| format!("Failed to copy image: {}", e))?;
        }
        let final_name = dest
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("image.png");
        return Ok(format!("./{}/{}", rel_dir_posix, final_name));
    }

    Ok(source_path.replace('\\', "/"))
}

#[tauri::command]
pub fn save_image_asset(
    source_path: String,
    doc_path: Option<String>,
    workspace_root: Option<String>,
    asset_dir: Option<String>,
) -> Result<String, String> {
    save_image_asset_impl(
        &source_path,
        doc_path.as_deref(),
        workspace_root.as_deref(),
        asset_dir.as_deref(),
    )
}

pub fn save_pasted_image_impl(
    base64_data: &str,
    ext: &str,
    doc_path: Option<&str>,
    workspace_root: Option<&str>,
    asset_dir: Option<&str>,
) -> Result<String, String> {
    let raw_b64 = base64_data
        .split_once(',')
        .map(|(_, b)| b)
        .unwrap_or(base64_data);
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

    if let Some(base_dir) = resolve_asset_base_dir(doc_path, workspace_root) {
        let (rel_dir_path, rel_dir_posix) = sanitize_asset_folder(asset_dir)?;
        let assets_dir = base_dir.join(&rel_dir_path);
        fs::create_dir_all(&assets_dir)
            .map_err(|e| format!("Failed to create assets dir: {}", e))?;
        let dest = assets_dir.join(&file_name);
        fs::write(&dest, &bytes).map_err(|e| format!("Failed to save pasted image: {}", e))?;
        return Ok(format!("./{}/{}", rel_dir_posix, file_name));
    }

    let tmp_dir = std::env::temp_dir().join(TEMP_PASTED_IMAGE_DIR_NAME);
    fs::create_dir_all(&tmp_dir)
        .map_err(|e| format!("Failed to create temp image dir: {}", e))?;
    let dest = tmp_dir.join(&file_name);
    fs::write(&dest, &bytes).map_err(|e| format!("Failed to save temp image: {}", e))?;
    Ok(dest.to_string_lossy().replace('\\', "/"))
}

#[tauri::command]
pub fn save_pasted_image(
    base64_data: String,
    ext: String,
    doc_path: Option<String>,
    workspace_root: Option<String>,
    asset_dir: Option<String>,
) -> Result<String, String> {
    save_pasted_image_impl(
        &base64_data,
        &ext,
        doc_path.as_deref(),
        workspace_root.as_deref(),
        asset_dir.as_deref(),
    )
}

fn format_markdown_dest_rust(rel: &str) -> String {
    if rel
        .chars()
        .any(|c| c.is_whitespace() || matches!(c, '(' | ')' | '<' | '>' | '[' | ']'))
    {
        format!("<{}>", rel)
    } else {
        rel.to_string()
    }
}

pub fn migrate_temp_images_on_save_impl(
    content: &str,
    doc_path: &str,
    asset_dir: Option<&str>,
    temp_root_override: Option<&Path>,
) -> Result<MigrateTempImagesResult, String> {
    if !content.contains(TEMP_PASTED_IMAGE_DIR_NAME) {
        return Ok(MigrateTempImagesResult {
            content: content.to_string(),
            migrated_count: 0,
            migrated_files: Vec::new(),
        });
    }

    let doc_dir = Path::new(doc_path)
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .ok_or_else(|| "Invalid document path for image migration".to_string())?;
    let (rel_dir_path, rel_dir_posix) = sanitize_asset_folder(asset_dir)?;
    let tmp_dir = temp_root_override
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| std::env::temp_dir().join(TEMP_PASTED_IMAGE_DIR_NAME));
    let canonical_tmp = tmp_dir.canonicalize().unwrap_or_else(|_| tmp_dir.clone());

    // Match Markdown link/image destinations (`![alt](...)` or `<...>`) and HTML `src="..."` pointing to onigiri-markdown-images
    let re = regex::Regex::new(
        r#"(?i)(?:file://)?(?:<([^>\r\n]*onigiri-markdown-images[^>\r\n]*)>|([^\s()"'<>\r\n]*onigiri-markdown-images[^\s()"'<>\r\n]*))"#,
    )
    .map_err(|e| format!("Regex error: {}", e))?;

    let mut migrated_map: HashMap<PathBuf, String> = HashMap::new();
    let mut migrated_files: Vec<String> = Vec::new();
    let mut out = String::with_capacity(content.len());
    let mut last_end = 0usize;
    let mut created_assets_dir = false;
    let assets_dir = doc_dir.join(&rel_dir_path);

    for cap in re.captures_iter(content) {
        let full = cap.get(0).unwrap();
        let inner = cap
            .get(1)
            .or_else(|| cap.get(2))
            .map(|m| m.as_str())
            .unwrap_or("");
        let full_str = full.as_str();

        // Try resolving the matched raw string to an actual file inside tmp_dir (or already-migrated key)
        let candidates = clean_image_path_candidates(full_str);
        let mut resolved_key: Option<(PathBuf, bool)> = None;
        for cand in &candidates {
            let p = PathBuf::from(cand);
            if p.exists() && p.is_file() {
                if let Ok(canon) = p.canonicalize() {
                    if canon.starts_with(&canonical_tmp) {
                        resolved_key = Some((canon, true));
                        break;
                    }
                }
            }
        }
        // Fallback: check file_name in tmp_dir on disk or already migrated in this pass
        if resolved_key.is_none() {
            if let Some(fname) = Path::new(&percent_decode_utf8(inner)).file_name() {
                let candidate = tmp_dir.join(fname);
                if candidate.exists() && candidate.is_file() {
                    if let Ok(canon) = candidate.canonicalize() {
                        if canon.starts_with(&canonical_tmp) {
                            resolved_key = Some((canon, true));
                        }
                    }
                } else {
                    let already_key = canonical_tmp.join(fname);
                    if migrated_map.contains_key(&already_key) {
                        resolved_key = Some((already_key, false));
                    }
                }
            }
        }

        let Some((src_canon, _exists_on_disk)) = resolved_key else {
            continue;
        };

        let rel_dest = if let Some(existing_rel) = migrated_map.get(&src_canon) {
            existing_rel.clone()
        } else {
            if !created_assets_dir {
                fs::create_dir_all(&assets_dir)
                    .map_err(|e| format!("Failed to create assets dir: {}", e))?;
                created_assets_dir = true;
            }
            let orig_name = src_canon
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("pasted.png");
            let dest = unique_dest_in_dir(&assets_dir, orig_name, None);
            if fs::rename(&src_canon, &dest).is_err() {
                fs::copy(&src_canon, &dest)
                    .map_err(|e| format!("Failed to migrate temp image: {}", e))?;
                let _ = fs::remove_file(&src_canon);
            }
            let final_name = dest
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("pasted.png");
            let rel = format!("./{}/{}", rel_dir_posix, final_name);
            migrated_map.insert(src_canon.clone(), rel.clone());
            migrated_files.push(rel.clone());
            rel
        };

        out.push_str(&content[last_end..full.start()]);
        // Preserve `<...>` only when formatted destination needs it, or plain relative path
        if cap.get(1).is_some() {
            out.push_str(&format!("<{}>", rel_dest));
        } else {
            out.push_str(&format_markdown_dest_rust(&rel_dest));
        }
        last_end = full.end();
    }

    if last_end == 0 {
        return Ok(MigrateTempImagesResult {
            content: content.to_string(),
            migrated_count: 0,
            migrated_files: Vec::new(),
        });
    }

    out.push_str(&content[last_end..]);
    Ok(MigrateTempImagesResult {
        content: out,
        migrated_count: migrated_files.len(),
        migrated_files,
    })
}

#[tauri::command]
pub fn migrate_temp_images_on_save(
    content: String,
    doc_path: String,
    asset_dir: Option<String>,
) -> Result<MigrateTempImagesResult, String> {
    migrate_temp_images_on_save_impl(&content, &doc_path, asset_dir.as_deref(), None)
}

fn is_reference_scan_text_file(path: &Path) -> bool {
    let Some(ext) = path.extension().and_then(|e| e.to_str()) else {
        return false;
    };
    matches!(
        ext.to_ascii_lowercase().as_str(),
        "md" | "markdown" | "mdown" | "mdx" | "txt" | "html" | "htm" | "json" | "yaml" | "yml"
    )
}

pub fn find_unused_workspace_assets_impl(
    root_path: &str,
    extra_contents: &[String],
) -> Result<Vec<UnusedAssetEntry>, String> {
    let root = PathBuf::from(root_path)
        .canonicalize()
        .map_err(|e| format!("Invalid workspace root: {}", e))?;

    let mut image_entries: Vec<UnusedAssetEntry> = Vec::new();
    let mut doc_texts: Vec<(String, String)> = Vec::new();

    let walker = WalkDir::new(&root)
        .max_depth(8)
        .into_iter()
        .filter_entry(|e| {
            if e.depth() == 0 {
                return true;
            }
            if e.file_type().is_dir() {
                let name = e.file_name().to_string_lossy();
                return !should_skip_dir(&name);
            }
            true
        });

    for entry in walker.flatten() {
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        let Ok(rel) = path.strip_prefix(&root) else {
            continue;
        };
        let rel_posix = rel.to_string_lossy().replace('\\', "/");
        if is_supported_image_file(path)
            || path
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.eq_ignore_ascii_case("svg"))
                .unwrap_or(false)
        {
            let meta = entry.metadata().ok();
            let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
            let modified_ms = meta.as_ref().map(file_modified_ms).unwrap_or(0);
            let name = path
                .file_name()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();
            image_entries.push(UnusedAssetEntry {
                path: path.to_string_lossy().to_string(),
                relative_path: rel_posix,
                name,
                size,
                modified_ms,
            });
        } else if is_reference_scan_text_file(path) {
            if let Ok(meta) = entry.metadata() {
                if meta.len() > 4 * 1024 * 1024 {
                    continue;
                }
            }
            if let Ok(bytes) = fs::read(path) {
                if let Ok(decoded) = decode_bytes_with_encoding(&bytes, None) {
                    let doc_dir = Path::new(&rel_posix)
                        .parent()
                        .map(|p| p.to_string_lossy().replace('\\', "/"))
                        .unwrap_or_default();
                    let lower = decoded
                        .content
                        .replace("%20", " ")
                        .replace('\\', "/")
                        .to_ascii_lowercase();
                    doc_texts.push((doc_dir.to_ascii_lowercase(), lower));
                }
            }
        }
    }

    for extra in extra_contents {
        if !extra.trim().is_empty() {
            doc_texts.push((
                String::new(),
                extra
                    .replace("%20", " ")
                    .replace('\\', "/")
                    .to_ascii_lowercase(),
            ));
        }
    }

    let mut duplicate_names: HashSet<String> = HashSet::new();
    let mut seen_names: HashSet<String> = HashSet::new();
    for img in &image_entries {
        let lower_name = img.name.to_ascii_lowercase();
        if !seen_names.insert(lower_name.clone()) {
            duplicate_names.insert(lower_name);
        }
    }

    let mut unused = Vec::new();
    for img in image_entries {
        let rel_lower = img.relative_path.to_ascii_lowercase();
        let name_lower = img.name.to_ascii_lowercase();
        let encoded_rel = rel_lower.replace(' ', "%20");
        let encoded_name = name_lower.replace(' ', "%20");
        let allow_bare_name = !duplicate_names.contains(&name_lower);

        let mut is_used = false;
        for (doc_dir, text) in &doc_texts {
            if text.contains(&rel_lower)
                || text.contains(&encoded_rel)
                || (allow_bare_name
                    && (text.contains(&name_lower) || text.contains(&encoded_name)))
            {
                is_used = true;
                break;
            }
            if !doc_dir.is_empty() {
                if let Some(stripped) = rel_lower.strip_prefix(&format!("{}/", doc_dir)) {
                    if text.contains(stripped) {
                        is_used = true;
                        break;
                    }
                }
            }
        }
        if !is_used {
            unused.push(img);
        }
    }

    unused.sort_by(|a, b| {
        b.modified_ms
            .cmp(&a.modified_ms)
            .then_with(|| a.relative_path.cmp(&b.relative_path))
    });
    Ok(unused)
}

#[tauri::command]
pub async fn find_unused_workspace_assets(
    root_path: String,
    extra_contents: Option<Vec<String>>,
) -> Result<Vec<UnusedAssetEntry>, String> {
    let extras = extra_contents.unwrap_or_default();
    tauri::async_runtime::spawn_blocking(move || {
        find_unused_workspace_assets_impl(&root_path, &extras)
    })
    .await
    .map_err(|e| format!("Unused asset scan failed: {}", e))?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_temp_test_dir(prefix: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "{}_{}",
            prefix,
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn save_pasted_image_supports_custom_folder_and_workspace_fallback() {
        let base = make_temp_test_dir("onigiri_asset_test");
        let png_b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        let doc_file = base.join("note.md");
        fs::write(&doc_file, "# Doc").unwrap();

        let rel = save_pasted_image_impl(
            png_b64,
            "png",
            Some(&doc_file.to_string_lossy()),
            None,
            Some("images/screens"),
        )
        .unwrap();
        assert!(rel.starts_with("./images/screens/pasted-"));
        assert!(base.join(rel.trim_start_matches("./")).exists());

        let ws_rel = save_pasted_image_impl(
            png_b64,
            "png",
            None,
            Some(&base.to_string_lossy()),
            Some("assets"),
        )
        .unwrap();
        assert!(ws_rel.starts_with("./assets/pasted-"));

        assert!(sanitize_asset_folder(Some("../escape")).is_err());

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn image_path_decoding_and_data_url_reading_handle_spaces_and_unicode() {
        assert_eq!(
            percent_decode_utf8("C:/Users/Desktop/%E7%B4%A0%E6%9D%90/KIWI%20WHITE+1.png"),
            "C:/Users/Desktop/素材/KIWI WHITE+1.png"
        );

        let win_cands = clean_image_path_candidates(
            "file:///C:/Users/Administrator/Desktop/%E7%B4%A0%E6%9D%90/KIWI%20WHITE.png",
        );
        assert!(win_cands
            .iter()
            .any(|c| c.contains("C:") && c.contains("素材/KIWI WHITE.png")));

        let angle_cands = clean_image_path_candidates("<./assets/KIWI%20WHITE.png>");
        assert!(angle_cands.contains(&"./assets/KIWI WHITE.png".to_string()));

        let base = make_temp_test_dir("onigiri_img_read_test");
        let sub = base.join("素材");
        fs::create_dir_all(&sub).unwrap();
        let img_path = sub.join("KIWI WHITE.png");
        fs::write(&img_path, b"\x89PNG\r\n\x1a\ntest").unwrap();

        let base_str = base.to_string_lossy().to_string();
        let data_url =
            read_image_data_url_impl("./%E7%B4%A0%E6%9D%90/KIWI%20WHITE.png", Some(&base_str))
                .unwrap();
        assert!(data_url.starts_with("data:image/png;base64,"));

        // Meta-aware read returns unchanged=true when modified_ms matches
        let meta_res = read_image_asset_with_meta_impl(
            "./%E7%B4%A0%E6%9D%90/KIWI%20WHITE.png",
            Some(&base_str),
            None,
        )
        .unwrap();
        assert!(!meta_res.unchanged);
        assert_eq!(meta_res.data_url.as_deref(), Some(data_url.as_str()));

        let cached_res = read_image_asset_with_meta_impl(
            "./%E7%B4%A0%E6%9D%90/KIWI%20WHITE.png",
            Some(&base_str),
            Some(meta_res.modified_ms),
        )
        .unwrap();
        assert!(cached_res.unchanged);
        assert!(cached_res.data_url.is_none());

        let file_url = url::Url::from_file_path(&img_path).unwrap().to_string();
        let data_url_from_uri = read_image_data_url_impl(&file_url, None).unwrap();
        assert_eq!(data_url, data_url_from_uri);

        let saved_rel = save_image_asset_impl(
            &img_path.to_string_lossy(),
            None,
            Some(&base_str),
            Some("assets"),
        )
        .unwrap();
        assert_eq!(saved_rel, "./assets/KIWI-WHITE.png");
        assert!(base.join("assets").join("KIWI-WHITE.png").exists());

        let saved_rel_2 = save_image_asset_impl(
            &img_path.to_string_lossy(),
            None,
            Some(&base_str),
            Some("assets"),
        )
        .unwrap();
        assert!(saved_rel_2.starts_with("./assets/KIWI-WHITE-"));
        assert!(!saved_rel_2.contains(' '));

        let fallback_path =
            save_image_asset_impl(&img_path.to_string_lossy(), None, None, Some("assets")).unwrap();
        assert!(!fallback_path.contains('\\'));

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn migrate_temp_images_on_save_moves_files_and_rewrites_markdown() {
        let base = make_temp_test_dir("onigiri_migrate_test");
        let tmp_imgs = base.join(TEMP_PASTED_IMAGE_DIR_NAME);
        fs::create_dir_all(&tmp_imgs).unwrap();
        let tmp_img_1 = tmp_imgs.join("pasted-111.png");
        fs::write(&tmp_img_1, b"png-1").unwrap();

        let save_dir = base.join("notes");
        fs::create_dir_all(&save_dir).unwrap();
        let doc_path = save_dir.join("article.md");
        let tmp_posix = tmp_img_1.to_string_lossy().replace('\\', "/");

        let md = format!(
            "# Draft\n\n![shot]({})\n\nAgain: ![shot2](<{}>)\n",
            tmp_posix, tmp_posix
        );
        let res = migrate_temp_images_on_save_impl(
            &md,
            &doc_path.to_string_lossy(),
            Some("assets"),
            Some(&tmp_imgs),
        )
        .unwrap();

        assert_eq!(res.migrated_count, 1);
        assert_eq!(res.migrated_files, vec!["./assets/pasted-111.png".to_string()]);
        assert!(res.content.contains("![shot](./assets/pasted-111.png)"));
        assert!(res.content.contains("![shot2](<./assets/pasted-111.png>)"));
        assert!(save_dir.join("assets").join("pasted-111.png").exists());
        assert!(!tmp_img_1.exists());

        let _ = fs::remove_dir_all(&base);
    }
}
