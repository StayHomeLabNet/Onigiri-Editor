use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Write;
#[cfg(target_os = "macos")]
use std::path::Path;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager};
use url::Url;

const GITHUB_LATEST_RELEASE_API: &str =
    "https://api.github.com/repos/StayHomeLabNet/Onigiri-Editor/releases/latest";

const ALLOWED_GITHUB_REPO_PREFIX: &str = "/stayhomelabnet/onigiri-editor/";

pub struct UpdateManagerState {
    download_cancel: Arc<AtomicBool>,
    last_etag: Mutex<Option<String>>,
    cached_info: Mutex<Option<AppUpdateInfo>>,
    pending_update_on_exit: Mutex<Option<String>>,
}

impl UpdateManagerState {
    pub fn new() -> Self {
        Self {
            download_cancel: Arc::new(AtomicBool::new(false)),
            last_etag: Mutex::new(None),
            cached_info: Mutex::new(None),
            pending_update_on_exit: Mutex::new(None),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateAsset {
    pub name: String,
    pub download_url: String,
    pub size: u64,
    pub platform: String,
    pub kind: String,
    pub digest: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub has_update: bool,
    pub release_url: String,
    pub release_name: String,
    pub published_at: Option<String>,
    pub notes: String,
    pub download_url: Option<String>,
    pub auto_update_url: Option<String>,
    pub can_in_place_update: bool,
    pub assets: Vec<AppUpdateAsset>,
    pub checked_at_ms: u64,
    pub etag: Option<String>,
    pub not_modified: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateProgressEvent {
    pub phase: String,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub percent: Option<u8>,
    pub file_path: Option<String>,
    pub message: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateDownloadResult {
    pub file_path: String,
    pub file_name: String,
    pub bytes: u64,
    pub can_auto_apply: bool,
    pub sha256: String,
    pub verified: bool,
}

#[derive(Deserialize)]
struct GithubAsset {
    name: String,
    browser_download_url: String,
    #[serde(default)]
    size: u64,
    #[serde(default)]
    digest: Option<String>,
}

#[derive(Deserialize)]
struct GithubReleaseResponse {
    tag_name: String,
    name: Option<String>,
    html_url: String,
    published_at: Option<String>,
    body: Option<String>,
    #[serde(default)]
    assets: Vec<GithubAsset>,
}

pub fn parse_semver_tuple(raw: &str) -> Option<(u64, u64, u64)> {
    let trimmed = raw.trim().trim_start_matches(['v', 'V']);
    let core = trimmed.split(['-', '+']).next().unwrap_or(trimmed);
    let mut parts = core.split('.');
    let major = parts.next()?.parse::<u64>().ok()?;
    let minor = parts.next().unwrap_or("0").parse::<u64>().ok()?;
    let patch = parts.next().unwrap_or("0").parse::<u64>().ok()?;
    Some((major, minor, patch))
}

pub fn is_newer_version(current: &str, latest: &str) -> bool {
    match (parse_semver_tuple(current), parse_semver_tuple(latest)) {
        (Some(cur), Some(lat)) => lat > cur,
        _ => false,
    }
}

pub fn normalize_sha256_hex(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    let hex_part = trimmed
        .strip_prefix("sha256:")
        .or_else(|| trimmed.strip_prefix("SHA256:"))
        .unwrap_or(trimmed)
        .trim()
        .to_ascii_lowercase();
    if hex_part.len() == 64 && hex_part.chars().all(|c| c.is_ascii_hexdigit()) {
        Some(hex_part)
    } else {
        None
    }
}

pub fn is_allowed_update_download_url(raw_url: &str) -> bool {
    let Ok(parsed) = Url::parse(raw_url.trim()) else {
        return false;
    };
    if parsed.scheme() != "https" {
        return false;
    }
    let Some(host) = parsed.host_str().map(|h| h.to_ascii_lowercase()) else {
        return false;
    };
    match host.as_str() {
        "github.com" => parsed
            .path()
            .to_ascii_lowercase()
            .starts_with(ALLOWED_GITHUB_REPO_PREFIX),
        "objects.githubusercontent.com"
        | "release-assets.githubusercontent.com"
        | "github-releases.githubusercontent.com" => true,
        _ => false,
    }
}

pub fn classify_asset(name: &str) -> (String, String) {
    let lower = name.to_ascii_lowercase();
    if lower.ends_with(".app.tar.gz") {
        ("macos".to_string(), "app-archive".to_string())
    } else if lower.ends_with(".dmg") {
        ("macos".to_string(), "dmg".to_string())
    } else if lower.ends_with("-setup.exe") || lower.ends_with(".exe") {
        ("windows".to_string(), "exe".to_string())
    } else if lower.ends_with(".msi") {
        ("windows".to_string(), "msi".to_string())
    } else if lower.ends_with(".appimage") {
        ("linux".to_string(), "appimage".to_string())
    } else if lower.ends_with(".deb") {
        ("linux".to_string(), "deb".to_string())
    } else {
        ("other".to_string(), "other".to_string())
    }
}

fn pick_platform_asset_url_for_os(assets: &[GithubAsset], os: &str) -> Option<String> {
    let preferred_exts: &[&str] = match os {
        "macos" => &[".dmg", ".app.tar.gz"],
        "windows" => &["-setup.exe", ".exe", ".msi"],
        "linux" => &[".appimage", ".deb"],
        _ => &[],
    };
    for ext in preferred_exts {
        if let Some(found) = assets
            .iter()
            .find(|a| a.name.to_ascii_lowercase().ends_with(ext))
        {
            return Some(found.browser_download_url.clone());
        }
    }
    None
}

fn pick_auto_update_asset_url_for_os(assets: &[GithubAsset], os: &str) -> Option<String> {
    let preferred_exts: &[&str] = match os {
        "macos" => &[".app.tar.gz", ".dmg"],
        "windows" => &["-setup.exe", ".exe", ".msi"],
        "linux" => &[".appimage", ".deb"],
        _ => &[],
    };
    for ext in preferred_exts {
        if let Some(found) = assets
            .iter()
            .find(|a| a.name.to_ascii_lowercase().ends_with(ext))
        {
            return Some(found.browser_download_url.clone());
        }
    }
    None
}

fn current_os_name() -> &'static str {
    if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(target_os = "windows") {
        "windows"
    } else {
        "linux"
    }
}

fn now_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn resolve_downloads_dir(app: &tauri::AppHandle) -> PathBuf {
    if let Ok(dl) = app.path().download_dir() {
        if dl.is_dir() || fs::create_dir_all(&dl).is_ok() {
            return dl;
        }
    }

    #[cfg(target_os = "windows")]
    let home = std::env::var_os("USERPROFILE").map(PathBuf::from);
    #[cfg(not(target_os = "windows"))]
    let home = std::env::var_os("HOME").map(PathBuf::from);

    if let Some(h) = home {
        let dl = h.join("Downloads");
        if dl.is_dir() {
            return dl;
        }
        if fs::create_dir_all(&dl).is_ok() {
            return dl;
        }
    }
    std::env::temp_dir()
}

fn sanitize_download_file_name(raw: &str) -> String {
    let base = raw
        .rsplit('/')
        .next()
        .unwrap_or(raw)
        .split('?')
        .next()
        .unwrap_or(raw)
        .trim();
    let cleaned: String = base
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_') {
                c
            } else {
                '_'
            }
        })
        .collect();
    if cleaned.is_empty() {
        "Onigiri-Editor-Update.bin".to_string()
    } else {
        cleaned
    }
}

fn emit_update_progress(app: &tauri::AppHandle, ev: AppUpdateProgressEvent) {
    let _ = app.emit("app-update-progress", ev);
}

#[cfg(target_os = "macos")]
fn locate_current_macos_app_bundle() -> Option<PathBuf> {
    if let Ok(exe) = std::env::current_exe() {
        for ancestor in exe.ancestors() {
            if let Some(ext) = ancestor.extension().and_then(|e| e.to_str()) {
                if ext.eq_ignore_ascii_case("app") {
                    return Some(ancestor.to_path_buf());
                }
            }
        }
    }
    let default_app = PathBuf::from("/Applications/Onigiri Editor.app");
    if default_app.exists() {
        return Some(default_app);
    }
    None
}

#[cfg(any(target_os = "macos", test))]
fn build_atomic_macos_swap_script() -> &'static str {
    r#"
sleep 0.7
SRC="$1"
DST="$2"
RELAUNCH="$3"
BAK="${DST}.bak.$$"
rm -rf "$BAK"
if [ -d "$DST" ]; then
  if ! mv "$DST" "$BAK"; then
    exit 1
  fi
fi
if mv "$SRC" "$DST"; then
  rm -rf "$BAK"
  xattr -cr "$DST" >/dev/null 2>&1 || true
  if [ "$RELAUNCH" = "1" ]; then
    open -n "$DST"
  fi
else
  if [ -d "$BAK" ]; then
    mv "$BAK" "$DST" >/dev/null 2>&1 || true
  fi
  exit 1
fi
"#
}

#[cfg(any(all(unix, not(target_os = "macos")), test))]
fn build_atomic_linux_appimage_swap_script() -> &'static str {
    r#"
sleep 0.7
SRC="$1"
DST="$2"
RELAUNCH="$3"
TMP="${DST}.new.$$"
BAK="${DST}.bak.$$"
rm -f "$TMP" "$BAK"
if ! cp "$SRC" "$TMP"; then
  exit 1
fi
chmod 755 "$TMP" 2>/dev/null || true
if [ -e "$DST" ]; then
  cp -p "$DST" "$BAK" 2>/dev/null || true
fi
if mv -f "$TMP" "$DST"; then
  rm -f "$BAK"
  if [ "$RELAUNCH" = "1" ]; then
    "$DST" >/dev/null 2>&1 &
  fi
else
  rm -f "$TMP"
  if [ -e "$BAK" ]; then
    mv -f "$BAK" "$DST" >/dev/null 2>&1 || true
  fi
  exit 1
fi
"#
}

#[cfg(any(target_os = "windows", test))]
fn build_windows_update_launch_ps(file_path: &str, is_msi: bool, delay_ms: u64) -> String {
    let escaped = file_path.replace('\'', "''");
    if is_msi {
        format!(
            "Start-Sleep -Milliseconds {}; Start-Process -FilePath 'msiexec.exe' -ArgumentList @('/i', '{}')",
            delay_ms, escaped
        )
    } else {
        format!(
            "Start-Sleep -Milliseconds {}; Start-Process -FilePath '{}'",
            delay_ms, escaped
        )
    }
}

fn can_auto_apply_for_os(file_name: &str, os: &str) -> bool {
    let lower = file_name.to_ascii_lowercase();
    match os {
        "macos" => lower.ends_with(".app.tar.gz") || lower.ends_with(".dmg"),
        "windows" => lower.ends_with(".exe") || lower.ends_with(".msi"),
        "linux" => lower.ends_with(".appimage") || lower.ends_with(".deb"),
        _ => false,
    }
}

#[tauri::command]
pub async fn check_app_updates(
    state: tauri::State<'_, UpdateManagerState>,
    if_none_match: Option<String>,
) -> Result<AppUpdateInfo, String> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent(format!("Onigiri-Editor/{}", current_version))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let effective_etag = if_none_match
        .filter(|s| !s.trim().is_empty())
        .or_else(|| state.last_etag.lock().ok().and_then(|g| g.clone()));

    let mut req = client
        .get(GITHUB_LATEST_RELEASE_API)
        .header("Accept", "application/vnd.github+json");

    if let Some(ref etag) = effective_etag {
        req = req.header("If-None-Match", etag);
    }

    let resp = req
        .send()
        .await
        .map_err(|e| format!("Update check request failed: {}", e))?;

    if resp.status() == reqwest::StatusCode::NOT_MODIFIED {
        let now_ms = now_epoch_ms();
        if let Ok(mut guard) = state.cached_info.lock() {
            if let Some(ref mut cached) = *guard {
                cached.checked_at_ms = now_ms;
                cached.not_modified = true;
                cached.current_version = current_version.clone();
                cached.has_update = is_newer_version(&current_version, &cached.latest_version);
                return Ok(cached.clone());
            }
        }
        // Cache missed on backend (e.g., frontend passed saved ETag after restart): re-fetch without ETag once
        let fresh_resp = client
            .get(GITHUB_LATEST_RELEASE_API)
            .header("Accept", "application/vnd.github+json")
            .send()
            .await
            .map_err(|e| format!("Update check request failed: {}", e))?;
        if !fresh_resp.status().is_success() {
            return Err(format!(
                "GitHub API returned status {}",
                fresh_resp.status()
            ));
        }
        return parse_and_cache_release(&state, current_version, fresh_resp).await;
    }

    if !resp.status().is_success() {
        return Err(format!("GitHub API returned status {}", resp.status()));
    }

    parse_and_cache_release(&state, current_version, resp).await
}

async fn parse_and_cache_release(
    state: &UpdateManagerState,
    current_version: String,
    resp: reqwest::Response,
) -> Result<AppUpdateInfo, String> {
    let etag = resp
        .headers()
        .get(reqwest::header::ETAG)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let release: GithubReleaseResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse release JSON: {}", e))?;

    let latest_version = release
        .tag_name
        .trim()
        .trim_start_matches(['v', 'V'])
        .to_string();
    let has_update = is_newer_version(&current_version, &latest_version);
    let os_name = current_os_name();
    let download_url = pick_platform_asset_url_for_os(&release.assets, os_name);
    let auto_update_url = pick_auto_update_asset_url_for_os(&release.assets, os_name);

    let assets: Vec<AppUpdateAsset> = release
        .assets
        .iter()
        .map(|a| {
            let (platform, kind) = classify_asset(&a.name);
            AppUpdateAsset {
                name: a.name.clone(),
                download_url: a.browser_download_url.clone(),
                size: a.size,
                platform,
                kind,
                digest: a.digest.clone(),
            }
        })
        .collect();

    let can_in_place_update = auto_update_url.is_some();

    let info = AppUpdateInfo {
        current_version,
        latest_version,
        has_update,
        release_url: release.html_url,
        release_name: release.name.unwrap_or_else(|| release.tag_name.clone()),
        published_at: release.published_at,
        notes: release.body.unwrap_or_default(),
        download_url,
        auto_update_url,
        can_in_place_update,
        assets,
        checked_at_ms: now_epoch_ms(),
        etag: etag.clone(),
        not_modified: false,
    };

    if let Ok(mut guard) = state.last_etag.lock() {
        *guard = etag;
    }
    if let Ok(mut guard) = state.cached_info.lock() {
        *guard = Some(info.clone());
    }

    Ok(info)
}

#[tauri::command]
pub fn cancel_app_update_download(state: tauri::State<'_, UpdateManagerState>) -> Result<bool, String> {
    state.download_cancel.store(true, Ordering::SeqCst);
    Ok(true)
}

#[tauri::command]
pub fn schedule_app_update_on_exit(
    state: tauri::State<'_, UpdateManagerState>,
    file_path: Option<String>,
) -> Result<Option<String>, String> {
    if let Some(ref p) = file_path {
        if !PathBuf::from(p).exists() {
            return Err(format!("Update file not found: {}", p));
        }
    }
    if let Ok(mut guard) = state.pending_update_on_exit.lock() {
        *guard = file_path.clone();
    }
    Ok(file_path)
}

#[tauri::command]
pub fn check_file_exists_local(path: String) -> bool {
    !path.trim().is_empty() && PathBuf::from(path).is_file()
}

#[tauri::command]
pub async fn download_app_update(
    app: tauri::AppHandle,
    state: tauri::State<'_, UpdateManagerState>,
    url: String,
    file_name: Option<String>,
    expected_sha256: Option<String>,
) -> Result<AppUpdateDownloadResult, String> {
    let trimmed_url = url.trim();
    if !is_allowed_update_download_url(trimmed_url) {
        return Err(
            "Download blocked: URL must belong to official Onigiri Editor GitHub Releases."
                .to_string(),
        );
    }

    let expected_hex = expected_sha256
        .as_deref()
        .and_then(normalize_sha256_hex);

    state.download_cancel.store(false, Ordering::SeqCst);

    let resolved_name = file_name
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .map(sanitize_download_file_name)
        .unwrap_or_else(|| sanitize_download_file_name(trimmed_url));

    let downloads_dir = resolve_downloads_dir(&app);
    let dest_path = downloads_dir.join(&resolved_name);
    let part_path = downloads_dir.join(format!("{}.part", resolved_name));

    let current_version = env!("CARGO_PKG_VERSION");
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(600))
        .user_agent(format!("Onigiri-Editor/{}", current_version))
        .build()
        .map_err(|e| format!("Failed to initialize download client: {}", e))?;

    emit_update_progress(
        &app,
        AppUpdateProgressEvent {
            phase: "downloading".to_string(),
            downloaded_bytes: 0,
            total_bytes: None,
            percent: Some(0),
            file_path: None,
            message: format!("Downloading {}...", resolved_name),
        },
    );

    let mut resp = client
        .get(trimmed_url)
        .send()
        .await
        .map_err(|e| format!("Download request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Download failed with HTTP {}", resp.status()));
    }

    let total_bytes = resp.content_length();
    let mut file = fs::File::create(&part_path)
        .map_err(|e| format!("Failed to create download file {}: {}", part_path.display(), e))?;

    let mut hasher = Sha256::new();
    let mut downloaded_bytes: u64 = 0;
    let mut last_emit = Instant::now();

    while let Some(chunk) = resp
        .chunk()
        .await
        .map_err(|e| {
            let _ = fs::remove_file(&part_path);
            format!("Network stream error while downloading update: {}", e)
        })?
    {
        if state.download_cancel.load(Ordering::SeqCst) {
            drop(file);
            let _ = fs::remove_file(&part_path);
            emit_update_progress(
                &app,
                AppUpdateProgressEvent {
                    phase: "cancelled".to_string(),
                    downloaded_bytes,
                    total_bytes,
                    percent: None,
                    file_path: None,
                    message: "Download cancelled".to_string(),
                },
            );
            return Err("Download cancelled by user".to_string());
        }

        file.write_all(&chunk).map_err(|e| {
            let _ = fs::remove_file(&part_path);
            format!("Failed writing downloaded data: {}", e)
        })?;
        hasher.update(&chunk);
        downloaded_bytes += chunk.len() as u64;

        if last_emit.elapsed() >= Duration::from_millis(80) {
            let percent = total_bytes.and_then(|total| {
                if total > 0 {
                    Some(((downloaded_bytes.saturating_mul(100)) / total).min(100) as u8)
                } else {
                    None
                }
            });
            emit_update_progress(
                &app,
                AppUpdateProgressEvent {
                    phase: "downloading".to_string(),
                    downloaded_bytes,
                    total_bytes,
                    percent,
                    file_path: None,
                    message: format!("Downloading {}...", resolved_name),
                },
            );
            last_emit = Instant::now();
        }
    }

    file.flush()
        .map_err(|e| format!("Failed to flush downloaded file: {}", e))?;
    drop(file);

    let computed_sha256: String = hasher
        .finalize()
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect();

    let mut verified = false;
    if let Some(expected) = expected_hex {
        emit_update_progress(
            &app,
            AppUpdateProgressEvent {
                phase: "verifying".to_string(),
                downloaded_bytes,
                total_bytes: Some(downloaded_bytes),
                percent: Some(100),
                file_path: None,
                message: "Verifying SHA-256 checksum...".to_string(),
            },
        );
        if computed_sha256 != expected {
            let _ = fs::remove_file(&part_path);
            emit_update_progress(
                &app,
                AppUpdateProgressEvent {
                    phase: "error".to_string(),
                    downloaded_bytes,
                    total_bytes: Some(downloaded_bytes),
                    percent: None,
                    file_path: None,
                    message: "SHA-256 checksum mismatch".to_string(),
                },
            );
            return Err(format!(
                "SHA-256 verification failed (expected {}, got {}). Downloaded file was removed.",
                &expected[..12],
                &computed_sha256[..12]
            ));
        }
        verified = true;
    }

    if dest_path.exists() {
        let _ = fs::remove_file(&dest_path);
    }
    fs::rename(&part_path, &dest_path)
        .map_err(|e| format!("Failed to finalize downloaded file: {}", e))?;

    #[cfg(unix)]
    {
        if resolved_name.to_ascii_lowercase().ends_with(".appimage") {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(meta) = fs::metadata(&dest_path) {
                let mut perms = meta.permissions();
                perms.set_mode(0o755);
                let _ = fs::set_permissions(&dest_path, perms);
            }
        }
    }

    let final_path_str = dest_path.to_string_lossy().to_string();
    let can_auto_apply = can_auto_apply_for_os(&resolved_name, current_os_name());

    emit_update_progress(
        &app,
        AppUpdateProgressEvent {
            phase: "ready".to_string(),
            downloaded_bytes,
            total_bytes: Some(downloaded_bytes),
            percent: Some(100),
            file_path: Some(final_path_str.clone()),
            message: format!("Downloaded {}", resolved_name),
        },
    );

    Ok(AppUpdateDownloadResult {
        file_path: final_path_str,
        file_name: resolved_name,
        bytes: downloaded_bytes,
        can_auto_apply,
        sha256: computed_sha256,
        verified,
    })
}

#[cfg(target_os = "macos")]
fn find_extracted_app_bundle(dir: &Path) -> Option<PathBuf> {
    let entries = fs::read_dir(dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if path
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.eq_ignore_ascii_case("app"))
                .unwrap_or(false)
            {
                return Some(path);
            }
            if let Some(nested) = find_extracted_app_bundle(&path) {
                return Some(nested);
            }
        }
    }
    None
}

fn apply_update_internal(
    app: Option<&tauri::AppHandle>,
    file_path: &str,
    restart_app: bool,
    exit_after_spawn: bool,
) -> Result<String, String> {
    let path = PathBuf::from(file_path);
    if !path.exists() {
        return Err(format!("Downloaded update file not found: {}", file_path));
    }

    let lower = file_path.to_ascii_lowercase();

    #[cfg(target_os = "macos")]
    {
        if lower.ends_with(".app.tar.gz") {
            if let Some(handle) = app {
                emit_update_progress(
                    handle,
                    AppUpdateProgressEvent {
                        phase: "extracting".to_string(),
                        downloaded_bytes: 0,
                        total_bytes: None,
                        percent: Some(100),
                        file_path: Some(file_path.to_string()),
                        message: "Extracting update bundle...".to_string(),
                    },
                );
            }

            let staging_dir =
                std::env::temp_dir().join(format!("onigiri-update-{}", now_epoch_ms()));
            fs::create_dir_all(&staging_dir)
                .map_err(|e| format!("Failed to create staging directory: {}", e))?;

            let tar_status = std::process::Command::new("tar")
                .args(["-xzf", file_path, "-C", &staging_dir.to_string_lossy()])
                .status()
                .map_err(|e| format!("Failed to run tar to extract update: {}", e))?;

            if !tar_status.success() {
                return Err("Failed to extract .app.tar.gz archive".to_string());
            }

            let extracted_app = find_extracted_app_bundle(&staging_dir)
                .ok_or_else(|| "Extracted archive did not contain an .app bundle".to_string())?;

            let _ = std::process::Command::new("xattr")
                .args(["-cr", &extracted_app.to_string_lossy()])
                .status();

            if let Some(target_app) = locate_current_macos_app_bundle() {
                let target_parent_writable = target_app
                    .parent()
                    .and_then(|p| fs::metadata(p).ok())
                    .map(|m| !m.permissions().readonly())
                    .unwrap_or(false);

                if target_parent_writable && (restart_app || !exit_after_spawn) {
                    if let Some(handle) = app {
                        emit_update_progress(
                            handle,
                            AppUpdateProgressEvent {
                                phase: "installing".to_string(),
                                downloaded_bytes: 0,
                                total_bytes: None,
                                percent: Some(100),
                                file_path: Some(target_app.to_string_lossy().to_string()),
                                message: "Installing update...".to_string(),
                            },
                        );
                    }

                    let script = build_atomic_macos_swap_script();
                    std::process::Command::new("sh")
                        .arg("-c")
                        .arg(script)
                        .arg("onigiri-updater")
                        .arg(&extracted_app)
                        .arg(&target_app)
                        .arg(if restart_app { "1" } else { "0" })
                        .spawn()
                        .map_err(|e| format!("Failed to launch update installer script: {}", e))?;

                    if exit_after_spawn {
                        if let Some(handle) = app {
                            let app_clone = handle.clone();
                            std::thread::spawn(move || {
                                std::thread::sleep(Duration::from_millis(250));
                                app_clone.exit(0);
                            });
                        }
                    }

                    return Ok(target_app.to_string_lossy().to_string());
                }
            }

            std::process::Command::new("open")
                .args(["-R", &extracted_app.to_string_lossy()])
                .spawn()
                .map_err(|e| format!("Failed to reveal extracted app: {}", e))?;
            return Ok(extracted_app.to_string_lossy().to_string());
        }

        std::process::Command::new("open")
            .arg(file_path)
            .spawn()
            .map_err(|e| format!("Failed to open installer: {}", e))?;
        return Ok(file_path.to_string());
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;

        let is_msi = lower.ends_with(".msi");
        let delay_ms = if restart_app || !exit_after_spawn { 900 } else { 0 };
        let ps_cmd = build_windows_update_launch_ps(file_path, is_msi, delay_ms);
        let launched = std::process::Command::new("powershell")
            .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &ps_cmd])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();

        if launched.is_err() {
            if is_msi {
                std::process::Command::new("msiexec")
                    .args(["/i", file_path])
                    .creation_flags(CREATE_NO_WINDOW)
                    .spawn()
                    .map_err(|e| format!("Failed to launch MSI installer: {}", e))?;
            } else {
                std::process::Command::new("explorer.exe")
                    .arg(file_path)
                    .creation_flags(CREATE_NO_WINDOW)
                    .spawn()
                    .map_err(|e| format!("Failed to launch installer: {}", e))?;
            }
        }

        if restart_app && exit_after_spawn {
            if let Some(handle) = app {
                let app_clone = handle.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(Duration::from_millis(250));
                    app_clone.exit(0);
                });
            }
        }
        return Ok(file_path.to_string());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        if lower.ends_with(".appimage") {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(meta) = fs::metadata(&path) {
                let mut perms = meta.permissions();
                perms.set_mode(0o755);
                let _ = fs::set_permissions(&path, perms);
            }
            if let Ok(current_appimage) = std::env::var("APPIMAGE") {
                let target_path = PathBuf::from(&current_appimage);
                let target_parent_writable = target_path
                    .parent()
                    .and_then(|p| fs::metadata(p).ok())
                    .map(|m| !m.permissions().readonly())
                    .unwrap_or(false);

                if target_parent_writable {
                    let script = build_atomic_linux_appimage_swap_script();
                    std::process::Command::new("sh")
                        .arg("-c")
                        .arg(script)
                        .arg("onigiri-updater")
                        .arg(&path)
                        .arg(&target_path)
                        .arg(if restart_app { "1" } else { "0" })
                        .spawn()
                        .map_err(|e| format!("Failed to launch Linux AppImage updater: {}", e))?;

                    if exit_after_spawn {
                        if let Some(handle) = app {
                            let app_clone = handle.clone();
                            std::thread::spawn(move || {
                                std::thread::sleep(Duration::from_millis(250));
                                app_clone.exit(0);
                            });
                        }
                    }
                    return Ok(current_appimage);
                }
            }
            if restart_app {
                std::process::Command::new("sh")
                    .arg("-c")
                    .arg("sleep 0.7; \"$1\" >/dev/null 2>&1 &")
                    .arg("onigiri-updater")
                    .arg(&path)
                    .spawn()
                    .map_err(|e| format!("Failed to launch downloaded AppImage: {}", e))?;
                if exit_after_spawn {
                    if let Some(handle) = app {
                        let app_clone = handle.clone();
                        std::thread::spawn(move || {
                            std::thread::sleep(Duration::from_millis(250));
                            app_clone.exit(0);
                        });
                    }
                }
                return Ok(file_path.to_string());
            }
        }
        std::process::Command::new("xdg-open")
            .arg(file_path)
            .spawn()
            .map_err(|e| format!("Failed to open downloaded update package: {}", e))?;
        return Ok(file_path.to_string());
    }
}

#[tauri::command]
pub async fn apply_downloaded_app_update(
    app: tauri::AppHandle,
    file_path: String,
    restart_app: bool,
) -> Result<String, String> {
    apply_update_internal(Some(&app), &file_path, restart_app, restart_app)
}

pub fn run_pending_update_on_exit_sync(app: &tauri::AppHandle) {
    let Some(state) = app.try_state::<UpdateManagerState>() else {
        return;
    };
    let pending = state
        .pending_update_on_exit
        .lock()
        .ok()
        .and_then(|mut g| g.take());
    if let Some(file_path) = pending {
        let _ = apply_update_internal(None, &file_path, false, false);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compares_semver_strings_accurately() {
        assert!(is_newer_version("1.2.1", "1.2.2"));
        assert!(is_newer_version("1.2.1", "v1.3.0"));
        assert!(is_newer_version("1.2.1", "2.0.0"));
        assert!(!is_newer_version("1.2.1", "v1.2.1"));
        assert!(!is_newer_version("1.2.1", "1.2.0"));
        assert!(!is_newer_version("1.10.0", "1.9.9"));
    }

    #[test]
    fn enforces_official_github_download_allowlist() {
        assert!(is_allowed_update_download_url(
            "https://github.com/StayHomeLabNet/Onigiri-Editor/releases/download/v1.3.3/Onigiri.Editor_1.3.3_universal.dmg"
        ));
        assert!(is_allowed_update_download_url(
            "https://objects.githubusercontent.com/github-production-release-asset-2e65be/12345"
        ));
        assert!(is_allowed_update_download_url(
            "https://release-assets.githubusercontent.com/github-production-release-asset/12345"
        ));
        assert!(!is_allowed_update_download_url(
            "http://github.com/StayHomeLabNet/Onigiri-Editor/releases/download/v1.3.3/file.dmg"
        ));
        assert!(!is_allowed_update_download_url(
            "https://github.com/OtherUser/MaliciousRepo/releases/download/v1.0.0/file.dmg"
        ));
        assert!(!is_allowed_update_download_url(
            "https://github.com.evil.com/StayHomeLabNet/Onigiri-Editor/file.dmg"
        ));
    }

    #[test]
    fn normalizes_and_validates_sha256_digests() {
        let valid = "sha256:902be4c5d15dec9831dbd5c79161b15304277e0e03649f530205b78670986c28";
        assert_eq!(
            normalize_sha256_hex(valid).as_deref(),
            Some("902be4c5d15dec9831dbd5c79161b15304277e0e03649f530205b78670986c28")
        );
        assert_eq!(
            normalize_sha256_hex("SHA256:ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789")
                .as_deref(),
            Some("abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789")
        );
        assert_eq!(normalize_sha256_hex("sha256:short"), None);
        assert_eq!(normalize_sha256_hex("not-a-hash"), None);
    }

    #[test]
    fn picks_matching_os_installer_and_auto_update_assets() {
        let assets = vec![
            GithubAsset {
                name: "Onigiri.Editor_1.3.3_universal.dmg".into(),
                browser_download_url: "https://example.com/mac.dmg".into(),
                size: 21_500_000,
                digest: None,
            },
            GithubAsset {
                name: "Onigiri_Editor_v1.3.3_macos-universal.app.tar.gz".into(),
                browser_download_url: "https://example.com/mac.app.tar.gz".into(),
                size: 20_300_000,
                digest: None,
            },
            GithubAsset {
                name: "Onigiri.Editor_1.3.3_x64-setup.exe".into(),
                browser_download_url: "https://example.com/win.exe".into(),
                size: 7_800_000,
                digest: None,
            },
            GithubAsset {
                name: "Onigiri.Editor_1.3.3_amd64.AppImage".into(),
                browser_download_url: "https://example.com/linux.AppImage".into(),
                size: 88_900_000,
                digest: None,
            },
        ];

        assert_eq!(
            pick_platform_asset_url_for_os(&assets, "macos").as_deref(),
            Some("https://example.com/mac.dmg")
        );
        assert_eq!(
            pick_auto_update_asset_url_for_os(&assets, "macos").as_deref(),
            Some("https://example.com/mac.app.tar.gz")
        );
        assert_eq!(
            pick_platform_asset_url_for_os(&assets, "windows").as_deref(),
            Some("https://example.com/win.exe")
        );
        assert_eq!(
            pick_platform_asset_url_for_os(&assets, "linux").as_deref(),
            Some("https://example.com/linux.AppImage")
        );
    }

    #[test]
    fn classifies_release_assets_by_platform_and_kind() {
        assert_eq!(
            classify_asset("Onigiri_Editor_v1.3.3_macos-universal.app.tar.gz"),
            ("macos".to_string(), "app-archive".to_string())
        );
        assert_eq!(
            classify_asset("Onigiri.Editor_1.3.3_universal.dmg"),
            ("macos".to_string(), "dmg".to_string())
        );
        assert_eq!(
            classify_asset("Onigiri.Editor_1.3.3_x64-setup.exe"),
            ("windows".to_string(), "exe".to_string())
        );
        assert_eq!(
            classify_asset("Onigiri.Editor_1.3.3_x64_en-US.msi"),
            ("windows".to_string(), "msi".to_string())
        );
        assert_eq!(
            classify_asset("Onigiri.Editor_1.3.3_amd64.AppImage"),
            ("linux".to_string(), "appimage".to_string())
        );
        assert_eq!(
            classify_asset("Onigiri.Editor_1.3.3_amd64.deb"),
            ("linux".to_string(), "deb".to_string())
        );
    }

    #[test]
    fn sanitizes_download_filenames_safely() {
        assert_eq!(
            sanitize_download_file_name(
                "https://github.com/StayHomeLabNet/Onigiri-Editor/releases/download/v1.3.3/Onigiri.Editor_1.3.3_universal.dmg?raw=1"
            ),
            "Onigiri.Editor_1.3.3_universal.dmg"
        );
        assert_eq!(
            sanitize_download_file_name("../evil/path/file name.dmg"),
            "file_name.dmg"
        );
    }

    #[test]
    fn builds_safe_windows_and_linux_update_launchers() {
        let exe_ps = build_windows_update_launch_ps(
            r"C:\Users\O'Brien & Co\Downloads\Onigiri.Editor_1.3.3_x64-setup.exe",
            false,
            900,
        );
        assert!(exe_ps.contains("Start-Sleep -Milliseconds 900"));
        assert!(exe_ps.contains("O''Brien & Co"));
        assert!(exe_ps.contains("Start-Process -FilePath"));

        let msi_ps = build_windows_update_launch_ps(
            r"C:\Users\山田\Downloads\Onigiri.msi",
            true,
            900,
        );
        assert!(msi_ps.contains("'msiexec.exe'"));
        assert!(msi_ps.contains("'/i'"));

        let linux_sh = build_atomic_linux_appimage_swap_script();
        assert!(linux_sh.contains("mv -f \"$TMP\" \"$DST\""));
        assert!(linux_sh.contains("sleep 0.7"));

        assert!(can_auto_apply_for_os("Onigiri_1.3.3_x64-setup.exe", "windows"));
        assert!(!can_auto_apply_for_os("Onigiri_1.3.3_universal.dmg", "windows"));
        assert!(can_auto_apply_for_os("Onigiri_1.3.3_amd64.AppImage", "linux"));
        assert!(!can_auto_apply_for_os("Onigiri_1.3.3_x64-setup.exe", "linux"));
    }
}
