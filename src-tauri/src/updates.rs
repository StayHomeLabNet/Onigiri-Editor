use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::Emitter;

const GITHUB_LATEST_RELEASE_API: &str =
    "https://api.github.com/repos/StayHomeLabNet/Onigiri-Editor/releases/latest";

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateAsset {
    pub name: String,
    pub download_url: String,
    pub size: u64,
    pub platform: String,
    pub kind: String,
}

#[derive(Clone, Debug, Serialize)]
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

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateDownloadResult {
    pub file_path: String,
    pub file_name: String,
    pub bytes: u64,
    pub can_auto_apply: bool,
}

#[derive(Deserialize)]
struct GithubAsset {
    name: String,
    browser_download_url: String,
    #[serde(default)]
    size: u64,
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

fn resolve_downloads_dir() -> PathBuf {
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
        // Look up ancestors for a directory ending with `.app`
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

#[tauri::command]
pub async fn check_app_updates() -> Result<AppUpdateInfo, String> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent(format!("Onigiri-Editor/{}", current_version))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let resp = client
        .get(GITHUB_LATEST_RELEASE_API)
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| format!("Update check request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("GitHub API returned status {}", resp.status()));
    }

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
            }
        })
        .collect();

    let can_in_place_update = auto_update_url.is_some();

    Ok(AppUpdateInfo {
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
    })
}

#[tauri::command]
pub async fn download_app_update(
    app: tauri::AppHandle,
    url: String,
    file_name: Option<String>,
) -> Result<AppUpdateDownloadResult, String> {
    let trimmed_url = url.trim();
    if !trimmed_url.starts_with("https://") && !trimmed_url.starts_with("http://") {
        return Err("Invalid download URL".to_string());
    }

    let resolved_name = file_name
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .map(sanitize_download_file_name)
        .unwrap_or_else(|| sanitize_download_file_name(trimmed_url));

    let downloads_dir = resolve_downloads_dir();
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

    let mut downloaded_bytes: u64 = 0;
    let mut last_emit = Instant::now();

    while let Some(chunk) = resp
        .chunk()
        .await
        .map_err(|e| format!("Network stream error while downloading update: {}", e))?
    {
        file.write_all(&chunk)
            .map_err(|e| format!("Failed writing downloaded data: {}", e))?;
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
    let lower_name = resolved_name.to_ascii_lowercase();
    let can_auto_apply = lower_name.ends_with(".app.tar.gz")
        || lower_name.ends_with(".dmg")
        || lower_name.ends_with(".exe")
        || lower_name.ends_with(".msi")
        || lower_name.ends_with(".appimage")
        || lower_name.ends_with(".deb");

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

#[tauri::command]
pub async fn apply_downloaded_app_update(
    app: tauri::AppHandle,
    file_path: String,
    restart_app: bool,
) -> Result<String, String> {
    let path = PathBuf::from(&file_path);
    if !path.exists() {
        return Err(format!("Downloaded update file not found: {}", file_path));
    }

    let lower = file_path.to_ascii_lowercase();

    #[cfg(target_os = "macos")]
    {
        if lower.ends_with(".app.tar.gz") {
            emit_update_progress(
                &app,
                AppUpdateProgressEvent {
                    phase: "extracting".to_string(),
                    downloaded_bytes: 0,
                    total_bytes: None,
                    percent: Some(100),
                    file_path: Some(file_path.clone()),
                    message: "Extracting update bundle...".to_string(),
                },
            );

            let staging_dir =
                std::env::temp_dir().join(format!("onigiri-update-{}", now_epoch_ms()));
            fs::create_dir_all(&staging_dir)
                .map_err(|e| format!("Failed to create staging directory: {}", e))?;

            let tar_status = std::process::Command::new("tar")
                .args([
                    "-xzf",
                    &file_path,
                    "-C",
                    &staging_dir.to_string_lossy(),
                ])
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

                if target_parent_writable && restart_app {
                    emit_update_progress(
                        &app,
                        AppUpdateProgressEvent {
                            phase: "installing".to_string(),
                            downloaded_bytes: 0,
                            total_bytes: None,
                            percent: Some(100),
                            file_path: Some(target_app.to_string_lossy().to_string()),
                            message: "Installing update and restarting...".to_string(),
                        },
                    );

                    let script = r#"
sleep 0.7
rm -rf "$2"
mv "$1" "$2"
xattr -cr "$2" >/dev/null 2>&1 || true
open -n "$2"
"#;
                    std::process::Command::new("sh")
                        .arg("-c")
                        .arg(script)
                        .arg("onigiri-updater")
                        .arg(&extracted_app)
                        .arg(&target_app)
                        .spawn()
                        .map_err(|e| format!("Failed to launch update installer script: {}", e))?;

                    let app_clone = app.clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(Duration::from_millis(250));
                        app_clone.exit(0);
                    });

                    return Ok(target_app.to_string_lossy().to_string());
                }
            }

            // Fallback: reveal extracted .app in Finder
            std::process::Command::new("open")
                .args(["-R", &extracted_app.to_string_lossy()])
                .spawn()
                .map_err(|e| format!("Failed to reveal extracted app: {}", e))?;
            return Ok(extracted_app.to_string_lossy().to_string());
        }

        // Default on macOS (e.g., .dmg): open the installer with `open`
        std::process::Command::new("open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("Failed to open installer: {}", e))?;
        return Ok(file_path);
    }

    #[cfg(target_os = "windows")]
    {
        if lower.ends_with(".msi") {
            std::process::Command::new("msiexec")
                .args(["/i", &file_path])
                .spawn()
                .map_err(|e| format!("Failed to launch MSI installer: {}", e))?;
        } else {
            std::process::Command::new("cmd")
                .args(["/C", "start", "", &file_path])
                .spawn()
                .map_err(|e| format!("Failed to launch installer: {}", e))?;
        }

        if restart_app {
            let app_clone = app.clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_millis(500));
                app_clone.exit(0);
            });
        }
        return Ok(file_path);
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
            if restart_app {
                if let Ok(current_appimage) = std::env::var("APPIMAGE") {
                    let target_path = PathBuf::from(&current_appimage);
                    if fs::copy(&path, &target_path).is_ok() {
                        let _ = std::process::Command::new(&target_path).spawn();
                        let app_clone = app.clone();
                        std::thread::spawn(move || {
                            std::thread::sleep(Duration::from_millis(300));
                            app_clone.exit(0);
                        });
                        return Ok(current_appimage);
                    }
                }
                if std::process::Command::new(&path).spawn().is_ok() {
                    let app_clone = app.clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(Duration::from_millis(300));
                        app_clone.exit(0);
                    });
                    return Ok(file_path);
                }
            }
        }
        std::process::Command::new("xdg-open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("Failed to open downloaded update package: {}", e))?;
        return Ok(file_path);
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
    fn picks_matching_os_installer_and_auto_update_assets() {
        let assets = vec![
            GithubAsset {
                name: "Onigiri.Editor_1.3.3_universal.dmg".into(),
                browser_download_url: "https://example.com/mac.dmg".into(),
                size: 21_500_000,
            },
            GithubAsset {
                name: "Onigiri_Editor_v1.3.3_macos-universal.app.tar.gz".into(),
                browser_download_url: "https://example.com/mac.app.tar.gz".into(),
                size: 20_300_000,
            },
            GithubAsset {
                name: "Onigiri.Editor_1.3.3_x64-setup.exe".into(),
                browser_download_url: "https://example.com/win.exe".into(),
                size: 7_800_000,
            },
            GithubAsset {
                name: "Onigiri.Editor_1.3.3_amd64.AppImage".into(),
                browser_download_url: "https://example.com/linux.AppImage".into(),
                size: 88_900_000,
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
}
