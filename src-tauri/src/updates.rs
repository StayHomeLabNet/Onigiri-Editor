use serde::{Deserialize, Serialize};
use std::time::Duration;

const GITHUB_LATEST_RELEASE_API: &str =
    "https://api.github.com/repos/StayHomeLabNet/Onigiri-Editor/releases/latest";

#[derive(Serialize)]
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
}

#[derive(Deserialize)]
struct GithubAsset {
    name: String,
    browser_download_url: String,
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

fn current_os_name() -> &'static str {
    if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(target_os = "windows") {
        "windows"
    } else {
        "linux"
    }
}

#[tauri::command]
pub async fn check_app_updates() -> Result<AppUpdateInfo, String> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
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
    let download_url = pick_platform_asset_url_for_os(&release.assets, current_os_name());

    Ok(AppUpdateInfo {
        current_version,
        latest_version,
        has_update,
        release_url: release.html_url,
        release_name: release.name.unwrap_or_else(|| release.tag_name.clone()),
        published_at: release.published_at,
        notes: release.body.unwrap_or_default(),
        download_url,
    })
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
    fn picks_matching_os_installer_asset() {
        let assets = vec![
            GithubAsset {
                name: "Onigiri.Editor_1.3.0_universal.dmg".into(),
                browser_download_url: "https://example.com/mac.dmg".into(),
            },
            GithubAsset {
                name: "Onigiri.Editor_1.3.0_x64-setup.exe".into(),
                browser_download_url: "https://example.com/win.exe".into(),
            },
            GithubAsset {
                name: "Onigiri.Editor_1.3.0_amd64.AppImage".into(),
                browser_download_url: "https://example.com/linux.AppImage".into(),
            },
        ];

        assert_eq!(
            pick_platform_asset_url_for_os(&assets, "macos").as_deref(),
            Some("https://example.com/mac.dmg")
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
}
