use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::{mpsc, watch};

pub struct AiChatState(Mutex<HashMap<String, watch::Sender<bool>>>);

impl AiChatState {
    pub fn new() -> Self {
        Self(Mutex::new(HashMap::new()))
    }

    pub fn register(&self, request_id: &str) -> (watch::Receiver<bool>, ActiveAiChatGuard<'_>) {
        let (tx, rx) = watch::channel(false);
        if !request_id.is_empty() {
            let mut guard = self.0.lock().unwrap();
            guard.insert(request_id.to_string(), tx);
        }
        (
            rx,
            ActiveAiChatGuard {
                state: self,
                request_id: request_id.to_string(),
            },
        )
    }

    pub fn cancel(&self, request_id: &str) -> bool {
        let guard = self.0.lock().unwrap();
        if let Some(tx) = guard.get(request_id) {
            let _ = tx.send(true);
            true
        } else {
            false
        }
    }
}

pub struct ActiveAiChatGuard<'a> {
    state: &'a AiChatState,
    request_id: String,
}

impl Drop for ActiveAiChatGuard<'_> {
    fn drop(&mut self) {
        if !self.request_id.is_empty() {
            let mut guard = self.state.0.lock().unwrap();
            guard.remove(&self.request_id);
        }
    }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiChatProgressEvent {
    pub request_id: String,
    pub kind: String,
    pub text: String,
    pub elapsed_secs: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCapabilities {
    pub codex_cli: Option<String>,
    pub codex_logged_in: bool,
    pub codex_models: Vec<String>,
    pub codex_default_model: Option<String>,
    pub claude_cli: Option<String>,
    pub claude_logged_in: bool,
    pub claude_models: Vec<String>,
    pub gemini_cli: Option<String>,
    pub gemini_logged_in: bool,
    pub gemini_models: Vec<String>,
    pub antigravity_cli: Option<String>,
    pub antigravity_logged_in: bool,
    pub antigravity_models: Vec<String>,
    pub antigravity_default_model: Option<String>,
    pub antigravity_app: bool,
    pub ollama_installed: bool,
    pub ollama_running: bool,
    pub ollama_models: Vec<String>,
    pub lmstudio_installed: bool,
    pub lmstudio_running: bool,
    pub lmstudio_models: Vec<String>,
    pub apple_foundation_models_supported: bool,
    pub apple_foundation_models_available: bool,
    pub apple_foundation_models_status: Option<String>,
    pub node_installed: bool,
    pub homebrew_installed: bool,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessageInput {
    pub role: String,
    pub content: String,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AiImageAttachment {
    #[serde(default)]
    pub path: String,
    #[serde(default)]
    pub name: String,
    pub mime_type: String,
    pub base64: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatRequest {
    #[serde(default)]
    pub request_id: Option<String>,
    pub provider: String,
    pub model: Option<String>,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub custom_cli_cmd: Option<String>,
    pub system_prompt: Option<String>,
    pub messages: Vec<ChatMessageInput>,
    pub workspace_dir: Option<String>,
    pub allow_workspace_write: Option<bool>,
    #[serde(default)]
    pub images: Vec<AiImageAttachment>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatResponse {
    pub content: String,
    pub model_used: String,
}

fn home_dir() -> Option<PathBuf> {
    env::var("HOME")
        .ok()
        .filter(|s| !s.is_empty())
        .map(PathBuf::from)
        .or_else(|| {
            env::var("USERPROFILE")
                .ok()
                .filter(|s| !s.is_empty())
                .map(PathBuf::from)
        })
}

pub(crate) fn extended_path() -> String {
    let mut dirs: Vec<PathBuf> = Vec::new();

    #[cfg(unix)]
    {
        let home = env::var("HOME").unwrap_or_default();
        if !home.is_empty() {
            for rel in [
                ".local/bin",
                ".antigravity/bin",
                ".cargo/bin",
                ".npm-global/bin",
                ".volta/bin",
                ".asdf/shims",
                ".local/share/mise/shims",
                ".bun/bin",
                ".fnm/aliases/default/bin",
                ".nvm/versions/node/current/bin",
            ] {
                dirs.push(PathBuf::from(&home).join(rel));
            }

            let nvm_dir = PathBuf::from(&home).join(".nvm/versions/node");
            if let Ok(read_dir) = std::fs::read_dir(&nvm_dir) {
                let mut versions: Vec<PathBuf> = read_dir
                    .flatten()
                    .map(|e| e.path().join("bin"))
                    .filter(|p| p.is_dir())
                    .collect();
                versions.sort();
                if let Some(latest) = versions.pop() {
                    dirs.push(latest);
                }
            }
        }

        #[cfg(target_os = "macos")]
        {
            for p in [
                "/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS",
                "/Applications/Antigravity.app/Contents/Resources/app/bin",
                "/opt/homebrew/bin",
                "/opt/homebrew/sbin",
            ] {
                dirs.push(PathBuf::from(p));
            }
        }

        #[cfg(target_os = "linux")]
        {
            if !home.is_empty() {
                dirs.push(PathBuf::from(&home).join(".local/share/flatpak/exports/bin"));
            }
            for p in [
                "/home/linuxbrew/.linuxbrew/bin",
                "/home/linuxbrew/.linuxbrew/sbin",
                "/var/lib/flatpak/exports/bin",
            ] {
                dirs.push(PathBuf::from(p));
            }
        }

        for p in ["/usr/local/bin", "/usr/bin", "/bin", "/snap/bin"] {
            dirs.push(PathBuf::from(p));
        }
    }

    #[cfg(target_os = "windows")]
    {
        let user_profile = env::var("USERPROFILE").unwrap_or_default();
        let appdata = env::var("APPDATA").unwrap_or_default();
        let local_appdata = env::var("LOCALAPPDATA").unwrap_or_default();
        let program_files =
            env::var("ProgramFiles").unwrap_or_else(|_| r"C:\Program Files".to_string());
        let program_data =
            env::var("ProgramData").unwrap_or_else(|_| r"C:\ProgramData".to_string());

        if !appdata.is_empty() {
            dirs.push(PathBuf::from(&appdata).join("npm"));
            dirs.push(PathBuf::from(&appdata).join("nvm"));
        }
        if !local_appdata.is_empty() {
            dirs.push(PathBuf::from(&local_appdata).join(r"Microsoft\WinGet\Links"));
            dirs.push(PathBuf::from(&local_appdata).join(r"agy\bin"));
            dirs.push(PathBuf::from(&local_appdata).join("pnpm"));
            dirs.push(PathBuf::from(&local_appdata).join(r"Volta\bin"));
            dirs.push(PathBuf::from(&local_appdata).join(r"Programs\Antigravity\bin"));
            dirs.push(PathBuf::from(&local_appdata).join(r"Programs\Ollama"));
            for py_ver in ["Python313", "Python312", "Python311", "Python310", "Python39"] {
                let py_base = PathBuf::from(&local_appdata)
                    .join("Programs")
                    .join("Python")
                    .join(py_ver);
                if py_base.is_dir() {
                    dirs.push(py_base.clone());
                    dirs.push(py_base.join("Scripts"));
                }
            }
        }
        if !user_profile.is_empty() {
            for rel in [r".cargo\bin", r".bun\bin", r".local\bin", r"scoop\shims"] {
                dirs.push(PathBuf::from(&user_profile).join(rel));
            }
        }
        dirs.push(PathBuf::from(&program_data).join(r"chocolatey\bin"));
        dirs.push(PathBuf::from(&program_files).join("nodejs"));
        dirs.push(PathBuf::from(&program_files).join("PHP"));
        dirs.push(PathBuf::from(&program_files).join(r"Docker\Docker\resources\bin"));
        dirs.push(PathBuf::from(&program_files).join(r"Antigravity\bin"));
        for reg_dir in crate::project::windows_registry_path_entries() {
            let lower = reg_dir.to_string_lossy().to_ascii_lowercase();
            if !lower.ends_with(r"microsoft\windowsapps") {
                dirs.push(reg_dir);
            }
        }
    }

    if let Some(current) = env::var_os("PATH") {
        dirs.extend(env::split_paths(&current));
    }

    #[cfg(target_os = "windows")]
    {
        let local_appdata = env::var("LOCALAPPDATA").unwrap_or_default();
        if !local_appdata.is_empty() {
            dirs.push(PathBuf::from(&local_appdata).join(r"Microsoft\WindowsApps"));
        }
    }

    let mut deduped: Vec<PathBuf> = Vec::with_capacity(dirs.len());
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
    for dir in dirs {
        if dir.as_os_str().is_empty() {
            continue;
        }
        #[cfg(target_os = "windows")]
        let key = dir.to_string_lossy().to_ascii_lowercase();
        #[cfg(not(target_os = "windows"))]
        let key = dir.to_string_lossy().to_string();
        if seen.insert(key) {
            deduped.push(dir);
        }
    }

    env::join_paths(deduped)
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|_| env::var("PATH").unwrap_or_default())
}

fn new_background_command<S: AsRef<std::ffi::OsStr>>(exe: &str, args: &[S]) -> Command {
    let mut cmd = Command::new(exe);
    cmd.args(args);
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

/// Extracts the relative Node script path referenced via `%dp0%` / `%~dp0` inside an npm/pnpm `.cmd` shim.
#[allow(dead_code)]
fn extract_dp0_js_rel(text: &str) -> Option<String> {
    let lower = text.to_ascii_lowercase();
    for marker in ["%dp0%", "%~dp0"] {
        let mut search_from = 0usize;
        while let Some(rel_idx) = lower[search_from..].find(marker) {
            let abs_start = search_from + rel_idx + marker.len();
            let rest = &text[abs_start..];
            let end_offset = rest
                .find(|c: char| c == '"' || c == '\'' || c == '\r' || c == '\n')
                .unwrap_or(rest.len());
            let raw_candidate = rest[..end_offset].trim();
            let candidate = if ["js", "mjs", "cjs"].iter().any(|ext| {
                raw_candidate
                    .to_ascii_lowercase()
                    .ends_with(&format!(".{}", ext))
            }) {
                raw_candidate
            } else {
                raw_candidate.split_whitespace().next().unwrap_or("")
            };
            let candidate_lower = candidate.to_ascii_lowercase();
            if candidate_lower.ends_with(".js")
                || candidate_lower.ends_with(".mjs")
                || candidate_lower.ends_with(".cjs")
            {
                let cleaned = candidate.trim_start_matches(['\\', '/']);
                if !cleaned.is_empty() {
                    return Some(cleaned.to_string());
                }
            }
            search_from = abs_start;
        }
    }
    None
}

#[allow(dead_code)]
fn parse_windows_cmd_shim_rel(content: &str) -> Option<String> {
    let mut set_vars: Vec<(String, String)> = Vec::new();
    for raw_line in content.lines() {
        let trimmed = raw_line.trim().trim_start_matches('@').trim_start();
        let lower = trimmed.to_ascii_lowercase();
        if !lower.starts_with("set ") && !lower.starts_with("set\t") {
            continue;
        }
        let assign = trimmed[3..].trim();
        let assign = if assign.starts_with('"') && assign.ends_with('"') && assign.len() >= 2 {
            &assign[1..assign.len() - 1]
        } else {
            assign
        };
        if let Some((lhs, rhs)) = assign.split_once('=') {
            let var_name = lhs.trim().trim_matches('"').to_ascii_uppercase();
            if !var_name.is_empty() {
                if let Some(rel) = extract_dp0_js_rel(rhs) {
                    if let Some(existing) = set_vars.iter_mut().find(|(k, _)| k == &var_name) {
                        existing.1 = rel;
                    } else {
                        set_vars.push((var_name, rel));
                    }
                }
            }
        }
    }

    for arg_marker in ["%*", "%1"] {
        for raw_line in content.lines() {
            let trimmed = raw_line.trim();
            if trimmed.is_empty()
                || trimmed.starts_with("::")
                || trimmed.to_ascii_lowercase().starts_with("rem ")
            {
                continue;
            }
            if !trimmed.contains(arg_marker) {
                continue;
            }
            if let Some(rel) = extract_dp0_js_rel(trimmed) {
                return Some(rel);
            }
            let mut rest = trimmed;
            while let Some(open) = rest.find('%') {
                let after_open = &rest[open + 1..];
                if let Some(close) = after_open.find('%') {
                    let token = &after_open[..close];
                    if !token.is_empty()
                        && !token.contains([' ', '\t', '\\', '/', '*', '~'])
                    {
                        let upper = token.to_ascii_uppercase();
                        if let Some((_, rel)) = set_vars.iter().find(|(k, _)| k == &upper) {
                            return Some(rel.clone());
                        }
                    }
                    rest = &after_open[close + 1..];
                } else {
                    break;
                }
            }
        }
    }

    None
}

#[cfg(target_os = "windows")]
fn resolve_windows_cmd_shim(bin: &str, args: &[String]) -> Option<(String, Vec<String>)> {
    let lower = bin.to_ascii_lowercase();
    if !lower.ends_with(".cmd") && !lower.ends_with(".bat") {
        return None;
    }
    let content = std::fs::read_to_string(bin).ok()?;
    let rel_script = parse_windows_cmd_shim_rel(&content)?;
    let bin_dir = Path::new(bin).parent()?;
    let mut script_path = bin_dir.to_path_buf();
    for part in rel_script.split(['\\', '/']).filter(|p| !p.is_empty()) {
        script_path.push(part);
    }
    if !script_path.is_file() {
        return None;
    }
    let bundled_node = bin_dir.join("node.exe");
    let node_exe = if bundled_node.is_file() {
        bundled_node.to_string_lossy().to_string()
    } else {
        find_executable(&["node"])?
    };
    let mut full_args = Vec::with_capacity(args.len() + 1);
    full_args.push(script_path.to_string_lossy().to_string());
    full_args.extend(args.iter().cloned());
    Some((node_exe, full_args))
}

pub(crate) fn build_cli_command(bin: &str, args: &[String]) -> Command {
    #[cfg(target_os = "windows")]
    {
        if let Some((node_exe, node_args)) = resolve_windows_cmd_shim(bin, args) {
            return new_background_command(&node_exe, &node_args);
        }
    }
    new_background_command(bin, args)
}

#[allow(dead_code)]
fn has_windows_runnable_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|ext| matches!(ext.to_ascii_lowercase().as_str(), "exe" | "com" | "cmd" | "bat"))
        .unwrap_or(false)
}

#[allow(dead_code)]
fn resolve_windows_executable_candidate(dir: &Path, name: &str) -> Option<PathBuf> {
    let name_path = Path::new(name);
    if has_windows_runnable_extension(name_path) {
        let candidate = dir.join(name);
        if candidate.exists() && candidate.is_file() {
            return Some(candidate);
        }
        return None;
    }
    for ext in ["exe", "com", "cmd", "bat"] {
        let candidate = dir.join(format!("{}.{}", name, ext));
        if candidate.exists() && candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

pub(crate) fn find_executable(names: &[&str]) -> Option<String> {
    #[cfg(target_os = "windows")]
    for name in names {
        let raw = Path::new(name);
        if name.contains('\\') || name.contains('/') || raw.is_absolute() {
            if has_windows_runnable_extension(raw) && raw.exists() && raw.is_file() {
                return Some(raw.to_string_lossy().to_string());
            }
            for ext in ["exe", "com", "cmd", "bat"] {
                let candidate = PathBuf::from(format!("{}.{}", name, ext));
                if candidate.exists() && candidate.is_file() {
                    return Some(candidate.to_string_lossy().to_string());
                }
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    for name in names {
        let raw = Path::new(name);
        if (name.contains('/') || raw.is_absolute()) && raw.exists() && raw.is_file() {
            return Some(raw.to_string_lossy().to_string());
        }
    }

    let path_var = extended_path();
    for dir in env::split_paths(&path_var) {
        for name in names {
            #[cfg(target_os = "windows")]
            {
                if let Some(found) = resolve_windows_executable_candidate(&dir, name) {
                    return Some(found.to_string_lossy().to_string());
                }
            }
            #[cfg(not(target_os = "windows"))]
            {
                let candidate = dir.join(name);
                if candidate.exists() && candidate.is_file() {
                    return Some(candidate.to_string_lossy().to_string());
                }
            }
        }
    }
    None
}

fn curated_codex_models() -> Vec<String> {
    vec![
        "gpt-5.4".to_string(),
        "gpt-5.3-codex".to_string(),
        "gpt-5.2-codex".to_string(),
        "o4-mini".to_string(),
        "o3".to_string(),
    ]
}

fn curated_claude_models() -> Vec<String> {
    vec![
        "sonnet".to_string(),
        "opus".to_string(),
        "haiku".to_string(),
        "claude-sonnet-4-5".to_string(),
        "claude-opus-4-1".to_string(),
        "claude-haiku-4-5".to_string(),
    ]
}

fn curated_gemini_models() -> Vec<String> {
    vec![
        "auto".to_string(),
        "gemini-3.8-flash".to_string(),
        "gemini-3.5-flash".to_string(),
        "gemini-3.1-pro-preview".to_string(),
        "gemini-3-flash-preview".to_string(),
        "gemini-3.5-flash-lite".to_string(),
        "gemini-3.1-flash-lite".to_string(),
        "gemini-2.5-pro".to_string(),
    ]
}

fn curated_antigravity_models() -> Vec<String> {
    vec![
        "gemini-4-hydrogen-high".to_string(),
        "gemini-4-hydrogen-medium".to_string(),
        "gemini-4-argon-high".to_string(),
        "gemini-4-argon-medium".to_string(),
        "gemini-3.8-flash-high".to_string(),
        "gemini-3.8-flash-medium".to_string(),
        "claude-opus-5-5-high".to_string(),
        "claude-sonnet-5-5-medium".to_string(),
        "gpt-oss-120b-medium".to_string(),
    ]
}

fn parse_codex_default_model_toml(raw: &str) -> Option<String> {
    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        // Stop before sections
        if trimmed.starts_with('[') {
            break;
        }
        if let Some(rest) = trimmed.strip_prefix("model") {
            let rest = rest.trim_start();
            if let Some(val_raw) = rest.strip_prefix('=') {
                let val = val_raw
                    .trim()
                    .trim_matches(|c| c == '"' || c == '\'')
                    .trim();
                if !val.is_empty() {
                    return Some(val.to_string());
                }
            }
        }
    }
    None
}

fn parse_codex_models_cache_json(raw: &str) -> Vec<String> {
    let Ok(json) = serde_json::from_str::<serde_json::Value>(raw) else {
        return Vec::new();
    };
    let Some(arr) = json["models"].as_array() else {
        return Vec::new();
    };
    let mut listed = Vec::new();
    let mut fallback = Vec::new();
    for item in arr {
        let Some(slug) = item["slug"]
            .as_str()
            .or_else(|| item["id"].as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
        else {
            continue;
        };
        let vis = item["visibility"].as_str().unwrap_or("list");
        if vis == "list" {
            if !listed.iter().any(|x| x == slug) {
                listed.push(slug.to_string());
            }
        } else if vis != "hide" && !fallback.iter().any(|x| x == slug) {
            fallback.push(slug.to_string());
        }
    }
    if listed.is_empty() {
        fallback
    } else {
        listed
    }
}

fn read_codex_models_and_default(codex_installed: bool) -> (Vec<String>, Option<String>) {
    let Some(home) = home_dir() else {
        return (
            if codex_installed {
                curated_codex_models()
            } else {
                Vec::new()
            },
            None,
        );
    };
    let codex_dir = home.join(".codex");
    let default_model = std::fs::read_to_string(codex_dir.join("config.toml"))
        .ok()
        .and_then(|s| parse_codex_default_model_toml(&s));

    let mut models = std::fs::read_to_string(codex_dir.join("models_cache.json"))
        .ok()
        .map(|s| parse_codex_models_cache_json(&s))
        .unwrap_or_default();

    if models.is_empty() && codex_installed {
        models = curated_codex_models();
    }
    if let Some(ref def) = default_model {
        if !models.iter().any(|m| m == def) {
            models.insert(0, def.clone());
        }
    }
    (models, default_model)
}

async fn check_codex_logged_in(codex_bin: Option<&str>) -> bool {
    if env::var("OPENAI_API_KEY")
        .map(|v| !v.trim().is_empty())
        .unwrap_or(false)
    {
        return true;
    }
    if let Some(home) = home_dir() {
        let auth_file = home.join(".codex/auth.json");
        if let Ok(meta) = std::fs::metadata(&auth_file) {
            if meta.len() > 2 {
                return true;
            }
        }
    }
    let Some(bin) = codex_bin else {
        return false;
    };
    let args = ["login".to_string(), "status".to_string()];
    let mut cmd = build_cli_command(bin, &args);
    cmd.env("PATH", extended_path())
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    let Ok(Ok(out)) = tokio::time::timeout(Duration::from_secs(3), cmd.output()).await else {
        return false;
    };
    if out.status.success() {
        let combined = format!(
            "{} {}",
            String::from_utf8_lossy(&out.stdout),
            String::from_utf8_lossy(&out.stderr)
        )
        .to_ascii_lowercase();
        return combined.contains("logged in") || !combined.contains("not logged in");
    }
    false
}

async fn check_claude_logged_in(claude_bin: Option<&str>) -> bool {
    if env::var("ANTHROPIC_API_KEY")
        .map(|v| !v.trim().is_empty())
        .unwrap_or(false)
    {
        return true;
    }
    if let Some(home) = home_dir() {
        for rel in [
            ".claude/.credentials.json",
            ".claude/credentials.json",
            ".claude.json",
        ] {
            if let Ok(meta) = std::fs::metadata(home.join(rel)) {
                if meta.len() > 10 {
                    return true;
                }
            }
        }
    }
    if claude_bin.is_none() {
        return false;
    }
    #[cfg(target_os = "macos")]
    {
        let mut cmd = Command::new("security");
        cmd.args(["find-generic-password", "-s", "Claude Code-credentials"])
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null());
        if let Ok(Ok(out)) = tokio::time::timeout(Duration::from_secs(2), cmd.output()).await {
            return out.status.success();
        }
        return false;
    }
    #[cfg(not(target_os = "macos"))]
    {
        false
    }
}

fn parse_gemini_models_json(raw: &str) -> Vec<String> {
    let Ok(json) = serde_json::from_str::<serde_json::Value>(raw) else {
        return Vec::new();
    };
    let Some(arr) = json.as_array() else {
        return Vec::new();
    };
    let mut models = Vec::new();
    for item in arr {
        if let Some(id) = item["modelId"]
            .as_str()
            .or_else(|| item["id"].as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
        {
            if !models.iter().any(|m| m == id) {
                models.push(id.to_string());
            }
        }
    }
    models
}

fn parse_gemini_list_models(output: &str) -> Vec<String> {
    let mut models = Vec::new();
    for line in output.lines() {
        if line.is_empty() || line.starts_with(' ') || line.starts_with('\t') {
            continue;
        }
        let trimmed = line.trim();
        if trimmed.is_empty()
            || trimmed.starts_with("Available")
            || trimmed.starts_with("Usage:")
            || trimmed.starts_with("Error")
        {
            continue;
        }
        let token = trimmed.split_whitespace().next().unwrap_or("");
        if token.is_empty() || token.ends_with(':') {
            continue;
        }
        if (token == "auto" || token.starts_with("gemini-") || token.contains("gemma"))
            && !models.iter().any(|m| m == token)
        {
            models.push(token.to_string());
        }
    }
    models
}

fn merge_modern_gemini_models(mut cli_models: Vec<String>) -> Vec<String> {
    if cli_models.is_empty() {
        return curated_gemini_models();
    }
    // Ensure modern Gemini 3.x models supported by gemini-cli 0.67+ are also selectable
    // alongside the models reported by `gemini models`.
    for candidate in [
        "gemini-3.8-flash",
        "gemini-3.5-flash",
        "gemini-3.1-pro-preview",
        "gemini-3-flash-preview",
        "gemini-3.1-flash-lite",
        "gemini-2.5-pro",
    ] {
        if !cli_models.iter().any(|m| m == candidate) {
            cli_models.push(candidate.to_string());
        }
    }
    cli_models
}

async fn read_gemini_models(gemini_bin: Option<&str>) -> Vec<String> {
    let Some(bin) = gemini_bin else {
        return Vec::new();
    };
    let json_args = ["models".to_string(), "-o".to_string(), "json".to_string()];
    let mut json_cmd = build_cli_command(bin, &json_args);
    json_cmd
        .env("PATH", extended_path())
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    if let Ok(Ok(out)) = tokio::time::timeout(Duration::from_secs(8), json_cmd.output()).await {
        let stdout = String::from_utf8_lossy(&out.stdout);
        let parsed = parse_gemini_models_json(&stdout);
        if !parsed.is_empty() {
            return merge_modern_gemini_models(parsed);
        }
    }

    let list_args = ["--list-models".to_string()];
    let mut cmd = build_cli_command(bin, &list_args);
    cmd.env("PATH", extended_path())
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    if let Ok(Ok(out)) = tokio::time::timeout(Duration::from_secs(8), cmd.output()).await {
        let stdout = String::from_utf8_lossy(&out.stdout);
        let parsed = parse_gemini_list_models(&stdout);
        if !parsed.is_empty() {
            return merge_modern_gemini_models(parsed);
        }
    }
    curated_gemini_models()
}

fn check_gemini_logged_in() -> bool {
    if env::var("GEMINI_API_KEY")
        .map(|v| !v.trim().is_empty())
        .unwrap_or(false)
        || env::var("GOOGLE_API_KEY")
            .map(|v| !v.trim().is_empty())
            .unwrap_or(false)
    {
        return true;
    }
    if let Some(home) = home_dir() {
        let gemini_dir = home.join(".gemini");
        if let Ok(meta) = std::fs::metadata(gemini_dir.join("oauth_creds.json")) {
            if meta.len() > 20 {
                return true;
            }
        }
        if let Ok(raw) = std::fs::read_to_string(gemini_dir.join("google_accounts.json")) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&raw) {
                if json["active"]
                    .as_str()
                    .map(|s| !s.trim().is_empty())
                    .unwrap_or(false)
                {
                    return true;
                }
            }
        }
    }
    false
}

fn parse_agy_models(output: &str) -> Vec<String> {
    let mut models = Vec::new();
    for raw_line in output.lines() {
        // Spinner frames use `\r` before printing the real line.
        let segment = raw_line.rsplit('\r').next().unwrap_or(raw_line).trim();
        if segment.is_empty()
            || segment.starts_with("Fetching")
            || segment.starts_with("Usage")
            || segment.starts_with("Error")
        {
            continue;
        }
        let token = segment.split_whitespace().next().unwrap_or("");
        if token.is_empty() || token.len() < 3 {
            continue;
        }
        let is_valid_slug = token
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.');
        if is_valid_slug
            && token.contains('-')
            && !models.iter().any(|m| m == token)
        {
            models.push(token.to_string());
        }
    }
    models
}

async fn read_agy_models(agy_bin: Option<&str>) -> Vec<String> {
    let Some(bin) = agy_bin else {
        return Vec::new();
    };
    let args = ["models".to_string()];
    let mut cmd = build_cli_command(bin, &args);
    cmd.env("PATH", extended_path())
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    if let Ok(Ok(out)) = tokio::time::timeout(Duration::from_secs(10), cmd.output()).await {
        let combined = format!(
            "{}\n{}",
            String::from_utf8_lossy(&out.stdout),
            String::from_utf8_lossy(&out.stderr)
        );
        let parsed = parse_agy_models(&combined);
        if !parsed.is_empty() {
            return parsed;
        }
    }
    curated_antigravity_models()
}

fn read_antigravity_default_model() -> Option<String> {
    let home = home_dir()?;
    let raw = std::fs::read_to_string(home.join(".gemini/antigravity-cli/settings.json")).ok()?;
    let json = serde_json::from_str::<serde_json::Value>(&raw).ok()?;
    json["model"]
        .as_str()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
}

fn check_antigravity_logged_in(agy_installed: bool, agy_models: &[String]) -> bool {
    if !agy_installed {
        return false;
    }
    if !agy_models.is_empty() {
        return true;
    }
    if let Some(home) = home_dir() {
        let onboarding = home.join(".gemini/antigravity-cli/cache/onboarding.json");
        if let Ok(raw) = std::fs::read_to_string(onboarding) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&raw) {
                if json["onboardingComplete"].as_bool().unwrap_or(false) {
                    return true;
                }
            }
        }
        if home.join(".gemini/jetski-standalone-oauth-token").is_file() {
            return true;
        }
    }
    false
}

async fn fetch_ollama_models(base_url: &str) -> (bool, Vec<String>) {
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
    {
        Ok(c) => c,
        Err(_) => return (false, vec![]),
    };
    let url = format!("{}/api/tags", base_url.trim_end_matches('/'));
    let Ok(resp) = client.get(&url).send().await else {
        return (false, vec![]);
    };
    if !resp.status().is_success() {
        return (false, vec![]);
    }
    let Ok(json) = resp.json::<serde_json::Value>().await else {
        return (true, vec![]);
    };
    let models = json["models"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m["name"].as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();
    (true, models)
}

async fn fetch_openai_compat_models(base_url: &str, api_key: Option<&str>) -> (bool, Vec<String>) {
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
    {
        Ok(c) => c,
        Err(_) => return (false, vec![]),
    };
    let trimmed = base_url.trim_end_matches('/');
    let url = if trimmed.ends_with("/v1") {
        format!("{}/models", trimmed)
    } else {
        format!("{}/v1/models", trimmed)
    };
    let mut req = client.get(&url);
    if let Some(key) = api_key {
        if !key.trim().is_empty() {
            req = req.bearer_auth(key.trim());
        }
    }
    let Ok(resp) = req.send().await else {
        return (false, vec![]);
    };
    if !resp.status().is_success() {
        return (false, vec![]);
    }
    let Ok(json) = resp.json::<serde_json::Value>().await else {
        return (true, vec![]);
    };
    let models = json["data"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m["id"].as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();
    (true, models)
}

fn find_antigravity_app_path() -> Option<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        for p in [
            "/Applications/Antigravity.app",
            "/Applications/Antigravity IDE.app",
        ] {
            let path = PathBuf::from(p);
            if path.exists() {
                return Some(path);
            }
        }
        return None;
    }
    #[cfg(target_os = "windows")]
    {
        let local_appdata = env::var("LOCALAPPDATA").unwrap_or_default();
        let program_files =
            env::var("ProgramFiles").unwrap_or_else(|_| r"C:\Program Files".to_string());
        let mut candidates = Vec::new();
        if !local_appdata.is_empty() {
            candidates.push(PathBuf::from(&local_appdata).join(r"Programs\Antigravity\Antigravity.exe"));
            candidates.push(PathBuf::from(&local_appdata).join(r"Programs\Antigravity\Antigravity IDE.exe"));
            candidates.push(PathBuf::from(&local_appdata).join(r"Programs\Antigravity IDE\Antigravity IDE.exe"));
        }
        candidates.push(PathBuf::from(&program_files).join(r"Antigravity\Antigravity.exe"));
        candidates.push(PathBuf::from(&program_files).join(r"Antigravity IDE\Antigravity IDE.exe"));
        return candidates.into_iter().find(|p| p.is_file());
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        if let Some(bin) = find_executable(&["antigravity"]) {
            return Some(PathBuf::from(bin));
        }
        for p in [
            "/opt/Antigravity/antigravity",
            "/usr/bin/antigravity",
            "/usr/local/bin/antigravity",
        ] {
            let path = PathBuf::from(p);
            if path.is_file() {
                return Some(path);
            }
        }
        None
    }
}

fn find_ollama_app_path() -> Option<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        let p = PathBuf::from("/Applications/Ollama.app");
        if p.exists() {
            return Some(p);
        }
        return None;
    }
    #[cfg(target_os = "windows")]
    {
        let local_appdata = env::var("LOCALAPPDATA").unwrap_or_default();
        let program_files =
            env::var("ProgramFiles").unwrap_or_else(|_| r"C:\Program Files".to_string());
        let mut candidates = Vec::new();
        if !local_appdata.is_empty() {
            candidates.push(PathBuf::from(&local_appdata).join(r"Programs\Ollama\ollama app.exe"));
            candidates.push(PathBuf::from(&local_appdata).join(r"Programs\Ollama\Ollama app.exe"));
        }
        candidates.push(PathBuf::from(&program_files).join(r"Ollama\ollama app.exe"));
        return candidates.into_iter().find(|p| p.is_file());
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        None
    }
}

fn find_lmstudio_app_path() -> Option<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        let p = PathBuf::from("/Applications/LM Studio.app");
        if p.exists() {
            return Some(p);
        }
        return None;
    }
    #[cfg(target_os = "windows")]
    {
        let local_appdata = env::var("LOCALAPPDATA").unwrap_or_default();
        let program_files =
            env::var("ProgramFiles").unwrap_or_else(|_| r"C:\Program Files".to_string());
        let mut candidates = Vec::new();
        if !local_appdata.is_empty() {
            candidates.push(PathBuf::from(&local_appdata).join(r"Programs\LM Studio\LM Studio.exe"));
            candidates.push(PathBuf::from(&local_appdata).join(r"LM-Studio\LM Studio.exe"));
        }
        candidates.push(PathBuf::from(&program_files).join(r"LM Studio\LM Studio.exe"));
        return candidates.into_iter().find(|p| p.is_file());
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        if let Some(bin) = find_executable(&["lm-studio", "lmstudio"]) {
            return Some(PathBuf::from(bin));
        }
        for p in ["/opt/LM Studio/lm-studio", "/usr/bin/lm-studio"] {
            let path = PathBuf::from(p);
            if path.is_file() {
                return Some(path);
            }
        }
        None
    }
}

#[cfg(all(unix, not(target_os = "macos")))]
fn launch_linux_terminal(script_path: &str) -> Result<(), String> {
    let candidates: &[(&str, &[&str])] = &[
        ("x-terminal-emulator", &["-e"]),
        ("gnome-terminal", &["--"]),
        ("konsole", &["-e"]),
        ("xfce4-terminal", &["-e"]),
        ("mate-terminal", &["-e"]),
        ("lxterminal", &["-e"]),
        ("alacritty", &["-e"]),
        ("kitty", &[]),
        ("wezterm", &["start", "--"]),
        ("xterm", &["-e"]),
    ];
    for (term, prefix) in candidates {
        if let Some(bin) = find_executable(&[term]) {
            let mut cmd = std::process::Command::new(bin);
            cmd.args(*prefix).arg(script_path);
            if cmd.spawn().is_ok() {
                return Ok(());
            }
        }
    }
    Err("No supported Linux terminal emulator was found (tried x-terminal-emulator, gnome-terminal, konsole, xfce4-terminal, xterm).".to_string())
}

#[tauri::command]
pub async fn detect_ai_capabilities() -> AiCapabilities {
    let codex_cli = find_executable(&["codex"]);
    let claude_cli = find_executable(&["claude"]);
    let gemini_cli = find_executable(&["gemini"]);
    let antigravity_cli = find_executable(&["agy"]);
    let antigravity_app = find_antigravity_app_path().is_some();

    let ollama_installed =
        find_executable(&["ollama"]).is_some() || find_ollama_app_path().is_some();
    let lmstudio_installed = find_lmstudio_app_path().is_some();

    let (codex_models, codex_default_model) = read_codex_models_and_default(codex_cli.is_some());
    let claude_models = if claude_cli.is_some() {
        curated_claude_models()
    } else {
        Vec::new()
    };
    let gemini_logged_in = gemini_cli.is_some() && check_gemini_logged_in();
    let antigravity_default_model = read_antigravity_default_model();

    let codex_for_task = codex_cli.clone();
    let claude_for_task = claude_cli.clone();
    let gemini_for_task = gemini_cli.clone();
    let agy_for_task = antigravity_cli.clone();

    let t_codex = tokio::spawn(async move { check_codex_logged_in(codex_for_task.as_deref()).await });
    let t_claude = tokio::spawn(async move { check_claude_logged_in(claude_for_task.as_deref()).await });
    let t_gemini = tokio::spawn(async move { read_gemini_models(gemini_for_task.as_deref()).await });
    let t_agy = tokio::spawn(async move { read_agy_models(agy_for_task.as_deref()).await });
    let t_ollama = tokio::spawn(async move { fetch_ollama_models("http://127.0.0.1:11434").await });
    let t_lm = tokio::spawn(async move { fetch_openai_compat_models("http://127.0.0.1:1234/v1", None).await });

    let codex_logged_in = t_codex.await.unwrap_or(false);
    let claude_logged_in = t_claude.await.unwrap_or(false);
    let gemini_models = t_gemini.await.unwrap_or_default();
    let antigravity_models = t_agy.await.unwrap_or_default();
    let antigravity_logged_in =
        check_antigravity_logged_in(antigravity_cli.is_some(), &antigravity_models);
    let ollama_res = t_ollama.await.unwrap_or((false, Vec::new()));
    let lmstudio_res = t_lm.await.unwrap_or((false, Vec::new()));
    let apple_fm = crate::apple_fm::check_availability();
    let node_installed =
        find_executable(&["node"]).is_some() && find_executable(&["npm"]).is_some();
    let homebrew_installed = find_executable(&["brew"]).is_some();

    AiCapabilities {
        codex_cli,
        codex_logged_in,
        codex_models,
        codex_default_model,
        claude_cli,
        claude_logged_in,
        claude_models,
        gemini_cli,
        gemini_logged_in,
        gemini_models,
        antigravity_cli,
        antigravity_logged_in,
        antigravity_models,
        antigravity_default_model,
        antigravity_app,
        ollama_installed,
        ollama_running: ollama_res.0,
        ollama_models: ollama_res.1,
        lmstudio_installed,
        lmstudio_running: lmstudio_res.0,
        lmstudio_models: lmstudio_res.1,
        apple_foundation_models_supported: apple_fm.supported,
        apple_foundation_models_available: apple_fm.available,
        apple_foundation_models_status: Some(apple_fm.status),
        node_installed,
        homebrew_installed,
    }
}

#[tauri::command]
pub async fn list_subscription_models(provider: String) -> Result<Vec<String>, String> {
    match provider.as_str() {
        "codex-cli" => {
            let codex_cli = find_executable(&["codex"]);
            let (models, _) = read_codex_models_and_default(codex_cli.is_some());
            Ok(if models.is_empty() {
                curated_codex_models()
            } else {
                models
            })
        }
        "claude-cli" => Ok(curated_claude_models()),
        "gemini-cli" => {
            let gemini_cli = find_executable(&["gemini"]);
            let models = read_gemini_models(gemini_cli.as_deref()).await;
            Ok(if models.is_empty() {
                curated_gemini_models()
            } else {
                models
            })
        }
        "antigravity-cli" => {
            let agy_cli = find_executable(&["agy"]);
            let models = read_agy_models(agy_cli.as_deref()).await;
            Ok(if models.is_empty() {
                curated_antigravity_models()
            } else {
                models
            })
        }
        _ => Ok(Vec::new()),
    }
}

#[tauri::command]
pub async fn list_local_models(
    provider: String,
    base_url: Option<String>,
    api_key: Option<String>,
) -> Result<Vec<String>, String> {
    if provider == "ollama" {
        let base = base_url.unwrap_or_else(|| "http://127.0.0.1:11434".to_string());
        let (ok, models) = fetch_ollama_models(&base).await;
        if !ok {
            return Err(format!("Ollama is not reachable at {}", base));
        }
        return Ok(models);
    }

    let base = base_url.unwrap_or_else(|| "http://127.0.0.1:1234/v1".to_string());
    let (ok, models) = fetch_openai_compat_models(&base, api_key.as_deref()).await;
    if !ok {
        return Err(format!("Server is not reachable at {}", base));
    }
    Ok(models)
}

#[tauri::command]
pub async fn assist_ai_connection(
    action: String,
    target: Option<String>,
) -> Result<String, String> {
    match action.as_str() {
        "start-ollama" => {
            #[cfg(target_os = "macos")]
            let launched = if Path::new("/Applications/Ollama.app").exists() {
                Command::new("open")
                    .args(["-a", "Ollama"])
                    .spawn()
                    .map_err(|e| format!("Failed to open Ollama.app: {}", e))?;
                true
            } else {
                false
            };
            #[cfg(target_os = "windows")]
            let launched = if let Some(app_exe) = find_ollama_app_path() {
                std::process::Command::new(&app_exe)
                    .spawn()
                    .map_err(|e| format!("Failed to launch Ollama app: {}", e))?;
                true
            } else {
                false
            };
            #[cfg(all(unix, not(target_os = "macos")))]
            let launched = false;

            if !launched {
                if let Some(bin) = find_executable(&["ollama"]) {
                    let mut cmd = new_background_command(&bin, &["serve"]);
                    cmd.env("PATH", extended_path())
                        .stdin(std::process::Stdio::null())
                        .stdout(std::process::Stdio::null())
                        .stderr(std::process::Stdio::null())
                        .spawn()
                        .map_err(|e| format!("Failed to start ollama serve: {}", e))?;
                } else {
                    return Err("Ollama is not installed on this machine.".to_string());
                }
            }

            for _ in 0..12 {
                tokio::time::sleep(Duration::from_millis(450)).await;
                let (ok, _) = fetch_ollama_models("http://127.0.0.1:11434").await;
                if ok {
                    return Ok("Ollama started and is ready.".to_string());
                }
            }
            Ok("Ollama launch requested; please wait a moment and re-detect.".to_string())
        }

        "open-lmstudio" => {
            #[cfg(target_os = "macos")]
            {
                if Path::new("/Applications/LM Studio.app").exists() {
                    Command::new("open")
                        .args(["-a", "LM Studio"])
                        .spawn()
                        .map_err(|e| format!("Failed to open LM Studio: {}", e))?;
                    return Ok("LM Studio launched. Start the Local Server in Developer tab.".to_string());
                }
                return Err("LM Studio app was not found in /Applications.".to_string());
            }
            #[cfg(not(target_os = "macos"))]
            {
                let Some(app_exe) = find_lmstudio_app_path() else {
                    return Err("LM Studio was not found on this machine.".to_string());
                };
                std::process::Command::new(&app_exe)
                    .spawn()
                    .map_err(|e| format!("Failed to open LM Studio: {}", e))?;
                Ok("LM Studio launched. Start the Local Server in Developer tab.".to_string())
            }
        }

        "open-apple-intelligence-settings" => {
            #[cfg(target_os = "macos")]
            {
                let status = Command::new("open")
                    .arg("x-apple.systempreferences:com.apple.Siri-Settings.extension")
                    .status()
                    .await;
                match status {
                    Ok(s) if s.success() => Ok(
                        "Opened Apple Intelligence & Siri in System Settings.".to_string(),
                    ),
                    _ => {
                        Command::new("open")
                            .args(["-a", "System Settings"])
                            .spawn()
                            .map_err(|e| format!("Failed to open System Settings: {}", e))?;
                        Ok("Opened System Settings.".to_string())
                    }
                }
            }
            #[cfg(not(target_os = "macos"))]
            {
                Err("Apple Intelligence settings are only available on macOS.".to_string())
            }
        }

        "open-url" => {
            let url = target
                .as_deref()
                .map(str::trim)
                .filter(|u| u.starts_with("https://") || u.starts_with("http://"))
                .ok_or_else(|| "Invalid URL".to_string())?;
            #[cfg(target_os = "macos")]
            {
                Command::new("open")
                    .arg(url)
                    .spawn()
                    .map_err(|e| format!("Failed to open URL: {}", e))?;
            }
            #[cfg(target_os = "windows")]
            {
                let mut cmd = new_background_command("cmd", &["/C", "start", "", url]);
                cmd.spawn()
                    .map_err(|e| format!("Failed to open URL: {}", e))?;
            }
            #[cfg(all(unix, not(target_os = "macos")))]
            {
                Command::new("xdg-open")
                    .arg(url)
                    .spawn()
                    .map_err(|e| format!("Failed to open URL: {}", e))?;
            }
            Ok("Opened in browser.".to_string())
        }

        "open-antigravity" => {
            #[cfg(target_os = "macos")]
            {
                for app_name in ["Antigravity", "Antigravity IDE"] {
                    let app_path = format!("/Applications/{}.app", app_name);
                    if Path::new(&app_path).exists() {
                        Command::new("open")
                            .args(["-a", app_name])
                            .spawn()
                            .map_err(|e| format!("Failed to open {}: {}", app_name, e))?;
                        return Ok(format!("{} launched.", app_name));
                    }
                }
                return Err("Antigravity app was not found in /Applications.".to_string());
            }
            #[cfg(not(target_os = "macos"))]
            {
                let Some(app_exe) = find_antigravity_app_path() else {
                    return Err("Antigravity app was not found on this machine.".to_string());
                };
                std::process::Command::new(&app_exe)
                    .spawn()
                    .map_err(|e| format!("Failed to open Antigravity: {}", e))?;
                Ok("Antigravity launched.".to_string())
            }
        }

        "run-terminal-setup" => {
            let key = target.as_deref().unwrap_or("");
            let shell_cmd = match key {
                "codex-login" => "codex login",
                "codex-install" => "npm install -g @openai/codex && codex login",
                "claude-login" => "claude",
                "claude-install" => "npm install -g @anthropic-ai/claude-code && claude",
                "gemini-login" => "gemini",
                "gemini-install" => "npm install -g @google/gemini-cli && gemini",
                "antigravity-login" => "agy",
                "antigravity-install" => {
                    #[cfg(target_os = "windows")]
                    {
                        "powershell -NoProfile -ExecutionPolicy Bypass -Command \"irm https://antigravity.google/cli/install.ps1 | iex\""
                    }
                    #[cfg(not(target_os = "windows"))]
                    {
                        "curl -fsSL https://antigravity.google/cli/install.sh | bash && agy"
                    }
                }
                "ollama-pull-llama3.2" => "ollama pull llama3.2",
                "ollama-pull-qwen2.5" => "ollama pull qwen2.5:7b",
                _ => return Err(format!("Unsupported setup action: {}", key)),
            };

            #[cfg(target_os = "macos")]
            {
                let needs_npm = matches!(
                    key,
                    "codex-install" | "claude-install" | "gemini-install"
                );
                let prereq_block = if needs_npm {
                    r#"if ! command -v npm >/dev/null 2>&1; then
  echo "[Node.js / npm が見つかりません] 先に Node.js をインストールします..."
  if ! command -v brew >/dev/null 2>&1; then
    echo "Homebrew が未導入のためインストールします (パスワードや Enter の入力が求められる場合があります)..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    if [ -x /opt/homebrew/bin/brew ]; then eval "$(/opt/homebrew/bin/brew shellenv)"; fi
    if [ -x /usr/local/bin/brew ]; then eval "$(/usr/local/bin/brew shellenv)"; fi
  fi
  if command -v brew >/dev/null 2>&1; then
    brew install node
  else
    echo "Homebrew の準備ができなかったため、ブラウザで https://nodejs.org/ を開きます。"
    open "https://nodejs.org/"
    exit 1
  fi
fi
NPM_GLOBAL_PREFIX="$(npm prefix -g 2>/dev/null || true)"
if [ -n "$NPM_GLOBAL_PREFIX" ] && [ ! -w "$NPM_GLOBAL_PREFIX" ] && [ ! -w "$NPM_GLOBAL_PREFIX/lib" ]; then
  echo "npm のグローバル保存先に書き込み権限がないため、~/.npm-global を使うよう設定します..."
  mkdir -p "$HOME/.npm-global"
  npm config set prefix "$HOME/.npm-global"
  export PATH="$HOME/.npm-global/bin:$PATH"
fi
"#
                } else if key == "antigravity-install" {
                    r#"if ! command -v agy >/dev/null 2>&1; then
  echo "Antigravity CLI (agy) を公式インストーラーでインストールします..."
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL https://antigravity.google/cli/install.sh | bash
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- https://antigravity.google/cli/install.sh | bash
  else
    echo "curl / wget が見つからないためダウンロードページを開きます..."
    open "https://antigravity.google/download"
    exit 1
  fi
  export PATH="$HOME/.local/bin:$HOME/.antigravity/bin:$PATH"
  rehash 2>/dev/null || hash -r 2>/dev/null || true
else
  echo "Antigravity CLI (agy) は既に導入済みです: $(command -v agy)"
  agy install || true
fi
if command -v agy >/dev/null 2>&1; then
  echo ""
  echo "続けて agy を起動します（初回は案内に従ってサインインしてください）..."
  agy
else
  echo "Antigravity CLI の自動セットアップに失敗しました。公式ページを開きます..."
  open "https://antigravity.google/download"
  exit 1
fi
"#
                } else {
                    ""
                };

                let script_path = env::temp_dir().join(format!("onigiri_ai_setup_{}.command", key));
                let script_body = format!(
                    "#!/bin/zsh\nexport PATH=\"{}\"\necho \"=== Onigiri Editor AI Setup ===\"\necho \"> {}\"\necho \"\"\n{}\n{}\necho \"\"\necho \"完了したら Onigiri Editor に戻り「再検出」をクリックしてください。\"\n",
                    extended_path().replace('"', "\\\""),
                    shell_cmd.replace('"', "\\\""),
                    prereq_block,
                    if key == "antigravity-install" { "" } else { shell_cmd }
                );
                std::fs::write(&script_path, script_body)
                    .map_err(|e| format!("Failed to write setup script: {}", e))?;
                {
                    use std::os::unix::fs::PermissionsExt;
                    let mut perms = std::fs::metadata(&script_path)
                        .map_err(|e| e.to_string())?
                        .permissions();
                    perms.set_mode(0o755);
                    std::fs::set_permissions(&script_path, perms).map_err(|e| e.to_string())?;
                }
                Command::new("open")
                    .args(["-a", "Terminal", &script_path.to_string_lossy()])
                    .spawn()
                    .map_err(|e| format!("Failed to launch Terminal: {}", e))?;
                return Ok(shell_cmd.to_string());
            }

            #[cfg(target_os = "windows")]
            {
                let needs_npm = matches!(
                    key,
                    "codex-install" | "claude-install" | "gemini-install"
                );
                let prereq_block = if needs_npm {
                    r#"where npm >nul 2>nul
if errorlevel 1 (
  echo [Node.js / npm not found] Checking winget...
  where winget >nul 2>nul
  if errorlevel 1 (
    echo winget ^(App Installer^) is not available on this Windows system.
    echo Opening https://nodejs.org/ in your browser. Please install Node.js LTS and re-run.
    start "" "https://nodejs.org/"
    exit /b 1
  )
  echo Installing Node.js LTS via winget...
  winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
  for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')" 2^>nul`) do set "PATH=%%P;%PATH%"
  set "PATH=%ProgramFiles%\nodejs;%APPDATA%\npm;%LOCALAPPDATA%\pnpm;%USERPROFILE%\.local\bin;%PATH%"
  where npm >nul 2>nul
  if errorlevel 1 (
    echo Could not install Node.js automatically. Opening https://nodejs.org/ ...
    start "" "https://nodejs.org/"
    exit /b 1
  )
)
"#
                } else if key == "antigravity-install" {
                    r#"where agy >nul 2>nul
if errorlevel 1 (
  echo Installing Antigravity CLI ^(agy.exe^) via official PowerShell installer...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://antigravity.google/cli/install.ps1 | iex"
  set "PATH=%LOCALAPPDATA%\agy\bin;%USERPROFILE%\.local\bin;%PATH%"
) else (
  echo Antigravity CLI is already installed. Updating PATH integration...
  call agy install
)
where agy >nul 2>nul
if errorlevel 1 (
  echo Automatic installation failed. Opening https://antigravity.google/download ...
  start "" "https://antigravity.google/download"
  exit /b 1
)
echo Starting agy ^(complete sign-in if prompted^)...
call agy
exit /b 0
"#
                } else {
                    ""
                };

                let escape_cmd_echo = |s: &str| -> String {
                    s.replace('^', "^^")
                        .replace('&', "^&")
                        .replace('|', "^|")
                        .replace('<', "^<")
                        .replace('>', "^>")
                };
                let win_exec_cmd = match key {
                    "codex-login" => "call codex login",
                    "codex-install" => "call npm install -g @openai/codex && call codex login",
                    "claude-login" => "call claude",
                    "claude-install" => "call npm install -g @anthropic-ai/claude-code && call claude",
                    "gemini-login" => "call gemini",
                    "gemini-install" => "call npm install -g @google/gemini-cli && call gemini",
                    "antigravity-login" => "call agy",
                    "antigravity-install" => "",
                    _ => shell_cmd,
                };
                let script_path = env::temp_dir().join(format!("onigiri_ai_setup_{}.cmd", key));
                let script_body = format!(
                    "@echo off\r\nchcp 65001 >nul\r\nset \"PATH={}\"\r\necho === Onigiri Editor AI Setup ===\r\necho ^> {}\r\necho.\r\n{}\r\n{}\r\necho.\r\necho Done. Return to Onigiri Editor and click Re-detect.\r\n",
                    extended_path().replace('"', ""),
                    escape_cmd_echo(shell_cmd),
                    prereq_block,
                    win_exec_cmd
                );
                std::fs::write(&script_path, script_body)
                    .map_err(|e| format!("Failed to write setup script: {}", e))?;
                let script_str = script_path.to_string_lossy().to_string();
                let mut launch = new_background_command(
                    "cmd",
                    &["/C", "start", "Onigiri AI Setup", "cmd", "/K", &script_str],
                );
                launch
                    .spawn()
                    .map_err(|e| format!("Failed to open Command Prompt: {}", e))?;
                return Ok(shell_cmd.to_string());
            }

            #[cfg(all(unix, not(target_os = "macos")))]
            {
                let needs_npm = matches!(
                    key,
                    "codex-install" | "claude-install" | "gemini-install"
                );
                let prereq_block = if needs_npm {
                    r#"if ! command -v npm >/dev/null 2>&1; then
  echo "[Node.js / npm not found] Attempting to install Node.js (may prompt for sudo password)..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update && sudo apt-get install -y nodejs npm
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y nodejs npm
  elif command -v pacman >/dev/null 2>&1; then
    sudo pacman -S --noconfirm nodejs npm
  elif command -v zypper >/dev/null 2>&1; then
    sudo zypper --non-interactive install nodejs npm
  else
    echo "Please install Node.js from https://nodejs.org/ and re-run."
    xdg-open "https://nodejs.org/" >/dev/null 2>&1 || true
    exit 1
  fi
fi
NPM_GLOBAL_PREFIX="$(npm prefix -g 2>/dev/null || true)"
if [ -n "$NPM_GLOBAL_PREFIX" ] && [ ! -w "$NPM_GLOBAL_PREFIX" ] && [ ! -w "$NPM_GLOBAL_PREFIX/lib" ]; then
  echo "Global npm prefix ($NPM_GLOBAL_PREFIX) is not writable without root; configuring user-local ~/.npm-global..."
  mkdir -p "$HOME/.npm-global"
  npm config set prefix "$HOME/.npm-global"
  export PATH="$HOME/.npm-global/bin:$PATH"
fi
"#
                } else if key == "antigravity-install" {
                    r#"if ! command -v agy >/dev/null 2>&1; then
  echo "Installing Antigravity CLI (agy) via official installer..."
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL https://antigravity.google/cli/install.sh | bash
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- https://antigravity.google/cli/install.sh | bash
  else
    echo "Neither curl nor wget found. Opening https://antigravity.google/download ..."
    xdg-open "https://antigravity.google/download" >/dev/null 2>&1 || true
    exit 1
  fi
  export PATH="$HOME/.local/bin:$HOME/.antigravity/bin:$PATH"
  hash -r 2>/dev/null || true
else
  echo "Antigravity CLI is already installed: $(command -v agy)"
  agy install || true
fi
if command -v agy >/dev/null 2>&1; then
  agy
else
  echo "Automatic installation failed. Opening https://antigravity.google/download ..."
  xdg-open "https://antigravity.google/download" >/dev/null 2>&1 || true
  exit 1
fi
"#
                } else {
                    ""
                };

                let script_path = env::temp_dir().join(format!("onigiri_ai_setup_{}.sh", key));
                let script_body = format!(
                    "#!/usr/bin/env bash\nexport PATH=\"{}\"\necho \"=== Onigiri Editor AI Setup ===\"\necho \"> {}\"\necho \"\"\n{}\n{}\necho \"\"\necho \"Done. Press Enter to close and click Re-detect in Onigiri Editor.\"\nread -r _\n",
                    extended_path().replace('"', "\\\""),
                    shell_cmd.replace('"', "\\\""),
                    prereq_block,
                    if key == "antigravity-install" { "" } else { shell_cmd }
                );
                std::fs::write(&script_path, script_body)
                    .map_err(|e| format!("Failed to write setup script: {}", e))?;
                {
                    use std::os::unix::fs::PermissionsExt;
                    let mut perms = std::fs::metadata(&script_path)
                        .map_err(|e| e.to_string())?
                        .permissions();
                    perms.set_mode(0o755);
                    std::fs::set_permissions(&script_path, perms).map_err(|e| e.to_string())?;
                }
                let script_str = script_path.to_string_lossy().to_string();
                launch_linux_terminal(&script_str)?;
                Ok(shell_cmd.to_string())
            }
        }

        other => Err(format!("Unsupported connection assist action: {}", other)),
    }
}

fn format_cli_prompt(system_prompt: Option<&str>, messages: &[ChatMessageInput]) -> String {
    format_cli_prompt_with_images(system_prompt, messages, &[])
}

fn format_cli_prompt_with_images(
    system_prompt: Option<&str>,
    messages: &[ChatMessageInput],
    images: &[AiImageAttachment],
) -> String {
    let mut parts = Vec::new();
    if let Some(sys) = system_prompt {
        if !sys.trim().is_empty() {
            parts.push(format!("System Instructions:\n{}\n", sys.trim()));
        }
    }
    if messages.len() > 1 {
        parts.push("Conversation History:".to_string());
        for m in &messages[..messages.len() - 1] {
            let role = if m.role == "assistant" {
                "Assistant"
            } else {
                "User"
            };
            parts.push(format!("{}: {}", role, m.content));
        }
        parts.push(String::new());
    }
    if let Some(last) = messages.last() {
        parts.push(last.content.clone());
    }
    if !images.is_empty() {
        parts.push(String::new());
        parts.push("# Attached Images".to_string());
        for img in images {
            let label = if !img.path.trim().is_empty() {
                img.path.trim()
            } else {
                img.name.trim()
            };
            if !label.is_empty() {
                parts.push(format!("- {}", label));
            }
        }
    }
    parts.join("\n")
}

#[allow(dead_code)]
fn clamp_utf16_prompt(prompt: &str, max_units: usize) -> String {
    let mut count = 0usize;
    let mut end_byte = prompt.len();
    for (idx, ch) in prompt.char_indices() {
        let u = ch.len_utf16();
        if count + u > max_units {
            end_byte = idx;
            break;
        }
        count += u;
    }
    if end_byte < prompt.len() {
        format!(
            "{}\n\n[Note: Context truncated to fit OS command-line limit]",
            &prompt[..end_byte]
        )
    } else {
        prompt.to_string()
    }
}

const CLI_IDLE_TIMEOUT_SECS: u64 = 420;
const CLI_MAX_TOTAL_SECS: u64 = 1800;

#[derive(Clone, Copy, PartialEq, Eq)]
enum CliStdoutMode {
    PlainText,
    CodexJsonl,
}

struct StreamingCliResult {
    stdout: String,
    stderr: String,
    codex_last_agent_message: Option<String>,
    codex_error_message: Option<String>,
    codex_parsed_any: bool,
}

#[derive(Debug, Default, PartialEq)]
struct CodexJsonEventUpdate {
    kind: Option<&'static str>,
    progress_text: Option<String>,
    agent_message: Option<String>,
    error_message: Option<String>,
    parsed_json: bool,
}

fn strip_ansi_escape_sequences(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '\x1b' {
            match chars.peek().copied() {
                Some('[') => {
                    chars.next();
                    while let Some(c) = chars.next() {
                        if ('@'..='~').contains(&c) {
                            break;
                        }
                    }
                }
                Some(']') => {
                    chars.next();
                    while let Some(c) = chars.next() {
                        if c == '\x07' {
                            break;
                        }
                        if c == '\x1b' && chars.peek() == Some(&'\\') {
                            chars.next();
                            break;
                        }
                    }
                }
                Some(_) => {
                    chars.next();
                }
                None => {}
            }
        } else if ch != '\r' {
            out.push(ch);
        }
    }
    out
}

fn truncate_progress_text(text: &str, max_chars: usize) -> String {
    let collapsed = text.split_whitespace().collect::<Vec<_>>().join(" ");
    let mut out = String::new();
    let mut count = 0usize;
    for ch in collapsed.chars() {
        if count >= max_chars {
            out.push('…');
            return out;
        }
        out.push(ch);
        count += 1;
    }
    out
}

fn parse_codex_jsonl_line(line: &str) -> CodexJsonEventUpdate {
    let trimmed = line.trim();
    if trimmed.is_empty() || !trimmed.starts_with('{') {
        return CodexJsonEventUpdate::default();
    }
    let Ok(val) = serde_json::from_str::<serde_json::Value>(trimmed) else {
        return CodexJsonEventUpdate::default();
    };
    let mut update = CodexJsonEventUpdate {
        parsed_json: true,
        ..Default::default()
    };

    match val.get("type").and_then(|v| v.as_str()) {
        Some("turn.started") => {
            update.kind = Some("status");
            update.progress_text = Some("Analyzing request...".to_string());
        }
        Some("item.started") => {
            let item = &val["item"];
            match item.get("type").and_then(|v| v.as_str()) {
                Some("command_execution") => {
                    let cmd = item
                        .get("command")
                        .and_then(|v| v.as_str())
                        .map(|s| truncate_progress_text(s, 110))
                        .unwrap_or_else(|| "command".to_string());
                    update.kind = Some("tool");
                    update.progress_text = Some(format!("$ {}", cmd));
                }
                Some("mcp_tool_call") => {
                    let server = item.get("server").and_then(|v| v.as_str()).unwrap_or("");
                    let tool = item.get("tool").and_then(|v| v.as_str()).unwrap_or("tool");
                    let label = if server.is_empty() {
                        tool.to_string()
                    } else {
                        format!("{}/{}", server, tool)
                    };
                    update.kind = Some("tool");
                    update.progress_text = Some(format!("Tool: {}", label));
                }
                Some("web_search") => {
                    let query = item
                        .get("query")
                        .and_then(|v| v.as_str())
                        .map(|s| truncate_progress_text(s, 90))
                        .unwrap_or_default();
                    update.kind = Some("tool");
                    update.progress_text = Some(if query.is_empty() {
                        "Web search...".to_string()
                    } else {
                        format!("Search: {}", query)
                    });
                }
                Some("file_change") => {
                    update.kind = Some("tool");
                    update.progress_text = Some("Editing files...".to_string());
                }
                Some("reasoning") => {
                    update.kind = Some("status");
                    update.progress_text = Some("Reasoning...".to_string());
                }
                _ => {}
            }
        }
        Some("item.completed") => {
            let item = &val["item"];
            match item.get("type").and_then(|v| v.as_str()) {
                Some("agent_message") => {
                    if let Some(text) = item.get("text").and_then(|v| v.as_str()) {
                        let trimmed_msg = text.trim();
                        if !trimmed_msg.is_empty() {
                            update.agent_message = Some(trimmed_msg.to_string());
                            update.kind = Some("commentary");
                            update.progress_text = Some(truncate_progress_text(trimmed_msg, 220));
                        }
                    }
                }
                Some("command_execution") => {
                    if let Some(code) = item.get("exit_code").and_then(|v| v.as_i64()) {
                        if code != 0 {
                            let cmd = item
                                .get("command")
                                .and_then(|v| v.as_str())
                                .map(|s| truncate_progress_text(s, 70))
                                .unwrap_or_else(|| "command".to_string());
                            update.kind = Some("tool");
                            update.progress_text = Some(format!("Exit {}: {}", code, cmd));
                        }
                    }
                }
                Some("file_change") => {
                    if let Some(changes) = item.get("changes").and_then(|v| v.as_array()) {
                        let paths: Vec<String> = changes
                            .iter()
                            .filter_map(|c| c.get("path").and_then(|p| p.as_str()))
                            .take(3)
                            .map(|p| truncate_progress_text(p, 50))
                            .collect();
                        if !paths.is_empty() {
                            let suffix = if changes.len() > 3 {
                                format!(" (+{})", changes.len() - 3)
                            } else {
                                String::new()
                            };
                            update.kind = Some("tool");
                            update.progress_text =
                                Some(format!("Updated: {}{}", paths.join(", "), suffix));
                        }
                    }
                }
                Some("error") => {
                    if let Some(msg) = item.get("message").and_then(|v| v.as_str()) {
                        let trimmed_err = msg.trim();
                        if !trimmed_err.is_empty() {
                            update.error_message = Some(trimmed_err.to_string());
                            update.kind = Some("status");
                            update.progress_text = Some(truncate_progress_text(trimmed_err, 180));
                        }
                    }
                }
                _ => {}
            }
        }
        Some("error") => {
            if let Some(msg) = val.get("message").and_then(|v| v.as_str()) {
                let trimmed_err = msg.trim();
                if !trimmed_err.is_empty() {
                    update.error_message = Some(trimmed_err.to_string());
                    update.kind = Some("status");
                    update.progress_text = Some(truncate_progress_text(trimmed_err, 180));
                }
            }
        }
        Some("turn.failed") => {
            if let Some(msg) = val
                .get("error")
                .and_then(|e| e.get("message"))
                .and_then(|v| v.as_str())
            {
                let trimmed_err = msg.trim();
                if !trimmed_err.is_empty() {
                    update.error_message = Some(trimmed_err.to_string());
                    update.kind = Some("status");
                    update.progress_text = Some(truncate_progress_text(trimmed_err, 180));
                }
            }
        }
        Some("turn.completed") => {
            update.kind = Some("status");
            update.progress_text = Some("Finalizing response...".to_string());
        }
        _ => {}
    }

    update
}

fn emit_ai_progress(
    app: Option<&tauri::AppHandle>,
    request_id: &str,
    kind: &str,
    text: &str,
    elapsed_secs: u64,
) {
    if let Some(handle) = app {
        if !request_id.is_empty() {
            let _ = handle.emit(
                "ai-chat-progress",
                AiChatProgressEvent {
                    request_id: request_id.to_string(),
                    kind: kind.to_string(),
                    text: text.to_string(),
                    elapsed_secs,
                },
            );
        }
    }
}

async fn run_cli_streaming(
    app: Option<&tauri::AppHandle>,
    request_id: &str,
    mut cancel_rx: Option<watch::Receiver<bool>>,
    bin: &str,
    args: &[String],
    stdin_input: Option<&str>,
    working_dir: Option<&str>,
    idle_timeout_secs: u64,
    max_total_secs: u64,
    stdout_mode: CliStdoutMode,
) -> Result<StreamingCliResult, String> {
    let mut cmd = build_cli_command(bin, args);
    cmd.env("PATH", extended_path())
        .env("GEMINI_CLI_TRUST_WORKSPACE", "true")
        .kill_on_drop(true)
        .stdin(if stdin_input.is_some() {
            std::process::Stdio::piped()
        } else {
            std::process::Stdio::null()
        })
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    if let Some(dir) = working_dir {
        let p = Path::new(dir);
        if p.exists() && p.is_dir() {
            cmd.current_dir(p);
        }
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to start '{}': {}", bin, e))?;

    if let Some(input) = stdin_input {
        if let Some(mut stdin) = child.stdin.take() {
            let _ = stdin.write_all(input.as_bytes()).await;
            let _ = stdin.shutdown().await;
        }
    }

    let (line_tx, mut line_rx) = mpsc::unbounded_channel::<(bool, String)>();

    let mut stdout_task = child.stdout.take().map(|out| {
        let tx = line_tx.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(out);
            let mut buf = Vec::new();
            loop {
                buf.clear();
                match reader.read_until(b'\n', &mut buf).await {
                    Ok(0) | Err(_) => break,
                    Ok(_) => {
                        let line = String::from_utf8_lossy(&buf)
                            .trim_end_matches(&['\r', '\n'][..])
                            .to_string();
                        if tx.send((false, line)).is_err() {
                            break;
                        }
                    }
                }
            }
        })
    });

    let mut stderr_task = child.stderr.take().map(|err| {
        let tx = line_tx.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(err);
            let mut buf = Vec::new();
            loop {
                buf.clear();
                match reader.read_until(b'\n', &mut buf).await {
                    Ok(0) | Err(_) => break,
                    Ok(_) => {
                        let line = String::from_utf8_lossy(&buf)
                            .trim_end_matches(&['\r', '\n'][..])
                            .to_string();
                        if tx.send((true, line)).is_err() {
                            break;
                        }
                    }
                }
            }
        })
    });

    drop(line_tx);

    let started = Instant::now();
    let mut last_activity = Instant::now();
    let mut heartbeat = tokio::time::interval(Duration::from_secs(2));
    heartbeat.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

    let mut stdout_lines: Vec<String> = Vec::new();
    let mut stderr_lines: Vec<String> = Vec::new();
    let mut codex_last_agent_message: Option<String> = None;
    let mut codex_error_message: Option<String> = None;
    let mut codex_parsed_any = false;
    let mut channel_closed = false;

    let process_line = |is_stderr: bool,
                        raw_line: String,
                        elapsed_secs: u64,
                        stdout_lines: &mut Vec<String>,
                        stderr_lines: &mut Vec<String>,
                        codex_last_agent_message: &mut Option<String>,
                        codex_error_message: &mut Option<String>,
                        codex_parsed_any: &mut bool| {
        if is_stderr {
            let clean = strip_ansi_escape_sequences(&raw_line);
            let trimmed = clean.trim();
            if !trimmed.is_empty() {
                stderr_lines.push(clean.clone());
                let preview = truncate_progress_text(trimmed, 180);
                if !preview.is_empty() {
                    emit_ai_progress(app, request_id, "status", &preview, elapsed_secs);
                }
            }
            return;
        }

        stdout_lines.push(raw_line.clone());
        match stdout_mode {
            CliStdoutMode::CodexJsonl => {
                let update = parse_codex_jsonl_line(&raw_line);
                if update.parsed_json {
                    *codex_parsed_any = true;
                    if let Some(msg) = update.agent_message {
                        *codex_last_agent_message = Some(msg);
                    }
                    if let Some(err) = update.error_message {
                        *codex_error_message = Some(err);
                    }
                    if let (Some(kind), Some(text)) = (update.kind, update.progress_text) {
                        emit_ai_progress(app, request_id, kind, &text, elapsed_secs);
                    }
                } else {
                    let clean = strip_ansi_escape_sequences(&raw_line);
                    let preview = truncate_progress_text(clean.trim(), 180);
                    if !preview.is_empty() {
                        emit_ai_progress(app, request_id, "output", &preview, elapsed_secs);
                    }
                }
            }
            CliStdoutMode::PlainText => {
                let clean = strip_ansi_escape_sequences(&raw_line);
                let preview = truncate_progress_text(clean.trim(), 180);
                if !preview.is_empty() {
                    emit_ai_progress(app, request_id, "output", &preview, elapsed_secs);
                }
            }
        }
    };

    let status = loop {
        tokio::select! {
            _ = async {
                if let Some(rx) = cancel_rx.as_mut() {
                    while !*rx.borrow() {
                        if rx.changed().await.is_err() {
                            std::future::pending::<()>().await;
                        }
                    }
                } else {
                    std::future::pending::<()>().await;
                }
            } => {
                let _ = child.kill().await;
                let _ = child.wait().await;
                return Err("CLI_CANCELLED".to_string());
            }
            msg = line_rx.recv(), if !channel_closed => {
                match msg {
                    Some((is_stderr, raw_line)) => {
                        last_activity = Instant::now();
                        process_line(
                            is_stderr,
                            raw_line,
                            started.elapsed().as_secs(),
                            &mut stdout_lines,
                            &mut stderr_lines,
                            &mut codex_last_agent_message,
                            &mut codex_error_message,
                            &mut codex_parsed_any,
                        );
                    }
                    None => {
                        channel_closed = true;
                    }
                }
            }
            _ = heartbeat.tick() => {
                let elapsed_secs = started.elapsed().as_secs();
                emit_ai_progress(app, request_id, "heartbeat", "", elapsed_secs);
                if last_activity.elapsed() >= Duration::from_secs(idle_timeout_secs) {
                    let _ = child.kill().await;
                    let _ = child.wait().await;
                    return Err(format!(
                        "CLI '{}' timed out after {}s without output (elapsed {}s)",
                        bin, idle_timeout_secs, elapsed_secs
                    ));
                }
                if started.elapsed() >= Duration::from_secs(max_total_secs) {
                    let _ = child.kill().await;
                    let _ = child.wait().await;
                    return Err(format!(
                        "CLI '{}' reached max runtime limit ({}s)",
                        bin, max_total_secs
                    ));
                }
            }
            status_res = child.wait() => {
                break status_res.map_err(|e| format!("CLI '{}' execution failed: {}", bin, e))?;
            }
        }
    };

    let _ = tokio::time::timeout(Duration::from_millis(750), async {
        if let Some(h) = stdout_task.take() {
            let _ = h.await;
        }
        if let Some(h) = stderr_task.take() {
            let _ = h.await;
        }
    })
    .await;

    let final_elapsed = started.elapsed().as_secs();
    while let Ok((is_stderr, raw_line)) = line_rx.try_recv() {
        process_line(
            is_stderr,
            raw_line,
            final_elapsed,
            &mut stdout_lines,
            &mut stderr_lines,
            &mut codex_last_agent_message,
            &mut codex_error_message,
            &mut codex_parsed_any,
        );
    }

    let stdout = stdout_lines.join("\n").trim().to_string();
    let stderr = stderr_lines.join("\n").trim().to_string();

    if !status.success() {
        let no_usable_output = match stdout_mode {
            CliStdoutMode::CodexJsonl => {
                codex_last_agent_message
                    .as_deref()
                    .map(|s| s.trim().is_empty())
                    .unwrap_or(true)
                    && (codex_parsed_any || stdout.is_empty())
            }
            CliStdoutMode::PlainText => stdout.is_empty(),
        };
        if no_usable_output {
            return Err(codex_error_message
                .filter(|s| !s.trim().is_empty())
                .or_else(|| (!stderr.is_empty()).then_some(stderr))
                .unwrap_or_else(|| format!("CLI exited with status {}", status)));
        }
    }

    Ok(StreamingCliResult {
        stdout,
        stderr,
        codex_last_agent_message,
        codex_error_message,
        codex_parsed_any,
    })
}

#[tauri::command]
pub fn cancel_ai_chat(
    state: tauri::State<'_, AiChatState>,
    request_id: String,
) -> Result<bool, String> {
    Ok(state.cancel(request_id.trim()))
}

async fn send_http_with_cancel(
    req: reqwest::RequestBuilder,
    mut cancel_rx: watch::Receiver<bool>,
) -> Result<reqwest::Response, String> {
    tokio::select! {
        _ = async {
            while !*cancel_rx.borrow() {
                if cancel_rx.changed().await.is_err() {
                    std::future::pending::<()>().await;
                }
            }
        } => Err("CLI_CANCELLED".to_string()),
        res = req.send() => res.map_err(|e| e.to_string()),
    }
}

#[tauri::command]
pub async fn ai_chat(
    app: tauri::AppHandle,
    state: tauri::State<'_, AiChatState>,
    request: AiChatRequest,
) -> Result<AiChatResponse, String> {
    let request_id = request.request_id.as_deref().unwrap_or("").trim().to_string();
    let (cancel_rx, _active_guard) = state.register(&request_id);

    let provider = request.provider.as_str();
    let model_opt = request
        .model
        .as_deref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty());
    let workspace_dir = request
        .workspace_dir
        .as_deref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty());
    let allow_write = request.allow_workspace_write.unwrap_or(false);

    match provider {
        "codex-cli" => {
            let bin = find_executable(&["codex"]).ok_or_else(|| {
                "Codex CLI (`codex`) was not found on PATH. Click \"Setup in Terminal\" or run `npm install -g @openai/codex && codex login` (requires Node.js 18+).".to_string()
            })?;
            let prompt = format_cli_prompt_with_images(
                request.system_prompt.as_deref(),
                &request.messages,
                &request.images,
            );
            let out_file = std::env::temp_dir().join(format!(
                "onigiri_codex_{}.txt",
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis())
                    .unwrap_or(0)
            ));
            let sandbox_mode = if allow_write && workspace_dir.is_some() {
                "workspace-write"
            } else {
                "read-only"
            };
            let mut args = vec![
                "exec".to_string(),
                "--json".to_string(),
                "--skip-git-repo-check".to_string(),
                "--sandbox".to_string(),
                sandbox_mode.to_string(),
                "-o".to_string(),
                out_file.to_string_lossy().to_string(),
            ];
            if let Some(dir) = workspace_dir {
                args.push("-C".to_string());
                args.push(dir.to_string());
            }
            if let Some(m) = model_opt {
                args.push("-m".to_string());
                args.push(m.to_string());
            }
            args.push("-".to_string());

            let cli_res = run_cli_streaming(
                Some(&app),
                &request_id,
                Some(cancel_rx),
                &bin,
                &args,
                Some(&prompt),
                workspace_dir,
                CLI_IDLE_TIMEOUT_SECS,
                CLI_MAX_TOTAL_SECS,
                CliStdoutMode::CodexJsonl,
            )
            .await;
            let file_text = std::fs::read_to_string(&out_file).unwrap_or_default();
            let _ = std::fs::remove_file(&out_file);
            let res = cli_res?;

            let content = if !file_text.trim().is_empty() {
                file_text.trim().to_string()
            } else if let Some(msg) = res.codex_last_agent_message.filter(|s| !s.trim().is_empty()) {
                msg.trim().to_string()
            } else if !res.codex_parsed_any && !res.stdout.is_empty() {
                res.stdout
            } else {
                return Err(res
                    .codex_error_message
                    .filter(|s| !s.trim().is_empty())
                    .or_else(|| (!res.stderr.is_empty()).then_some(res.stderr))
                    .unwrap_or_else(|| "Codex CLI returned an empty response.".to_string()));
            };
            Ok(AiChatResponse {
                content,
                model_used: model_opt.unwrap_or("codex-subscription").to_string(),
            })
        }

        "claude-cli" => {
            let bin = find_executable(&["claude"]).ok_or_else(|| {
                "Claude Code CLI (`claude`) was not found on PATH. Click \"Setup in Terminal\" or run `npm install -g @anthropic-ai/claude-code && claude` (requires Node.js 18+).".to_string()
            })?;
            let prompt = format_cli_prompt_with_images(
                request.system_prompt.as_deref(),
                &request.messages,
                &request.images,
            );
            let mut args = vec!["-p".to_string()];
            if let Some(m) = model_opt {
                args.push("--model".to_string());
                args.push(m.to_string());
            }
            let use_stdin = cfg!(target_os = "windows") && prompt.encode_utf16().count() > 14_000;
            let stdin_opt = if use_stdin {
                Some(prompt.as_str())
            } else {
                args.push(prompt.clone());
                None
            };
            let res = run_cli_streaming(
                Some(&app),
                &request_id,
                Some(cancel_rx),
                &bin,
                &args,
                stdin_opt,
                workspace_dir,
                CLI_IDLE_TIMEOUT_SECS,
                CLI_MAX_TOTAL_SECS,
                CliStdoutMode::PlainText,
            )
            .await?;
            if res.stdout.is_empty() {
                return Err(if res.stderr.is_empty() {
                    "Claude CLI returned an empty response.".to_string()
                } else {
                    res.stderr
                });
            }
            Ok(AiChatResponse {
                content: res.stdout,
                model_used: model_opt.unwrap_or("claude-subscription").to_string(),
            })
        }

        "gemini-cli" => {
            let bin = find_executable(&["gemini"]).ok_or_else(|| {
                "Gemini CLI (`gemini`) was not found on PATH. Click \"Setup in Terminal\" or run `npm install -g @google/gemini-cli && gemini` (requires Node.js 20+).".to_string()
            })?;
            let has_adc = env::var("GOOGLE_APPLICATION_CREDENTIALS")
                .map(|v| !v.trim().is_empty())
                .unwrap_or(false)
                || env::var("GOOGLE_GENAI_USE_VERTEXAI")
                    .map(|v| !v.trim().is_empty())
                    .unwrap_or(false);
            if !check_gemini_logged_in() && !has_adc {
                return Err(
                    "Gemini CLI is not signed in. Please run `gemini` in Terminal (or click Setup in the AI Connection Support card) to authenticate."
                        .to_string(),
                );
            }
            let prompt = format_cli_prompt_with_images(
                request.system_prompt.as_deref(),
                &request.messages,
                &request.images,
            );
            let mut args = Vec::new();
            if let Some(m) = model_opt.filter(|m| *m != "auto") {
                args.push("-m".to_string());
                args.push(m.to_string());
            }
            let use_stdin = cfg!(target_os = "windows") && prompt.encode_utf16().count() > 14_000;
            args.push("-p".to_string());
            let stdin_opt = if use_stdin {
                args.push("Follow the prompt provided via stdin.".to_string());
                Some(prompt.as_str())
            } else {
                args.push(prompt.clone());
                None
            };
            let res = run_cli_streaming(
                Some(&app),
                &request_id,
                Some(cancel_rx),
                &bin,
                &args,
                stdin_opt,
                workspace_dir,
                CLI_IDLE_TIMEOUT_SECS,
                CLI_MAX_TOTAL_SECS,
                CliStdoutMode::PlainText,
            )
            .await?;
            if res.stdout.is_empty() {
                return Err(if res.stderr.is_empty() {
                    "Gemini CLI returned an empty response.".to_string()
                } else {
                    res.stderr
                });
            }
            Ok(AiChatResponse {
                content: res.stdout,
                model_used: model_opt.unwrap_or("gemini-cli").to_string(),
            })
        }

        "antigravity-cli" => {
            let bin = find_executable(&["agy"]).ok_or_else(|| {
                "Antigravity CLI (`agy`) was not found on PATH. Click \"Setup in Terminal\" (macOS/Linux: curl -fsSL https://antigravity.google/cli/install.sh | bash, Windows: irm https://antigravity.google/cli/install.ps1 | iex).".to_string()
            })?;
            let raw_prompt = format_cli_prompt_with_images(
                request.system_prompt.as_deref(),
                &request.messages,
                &request.images,
            );
            let prompt = if cfg!(target_os = "windows") {
                clamp_utf16_prompt(&raw_prompt, 26_000)
            } else {
                raw_prompt
            };
            let mut args = vec!["--output-format".to_string(), "text".to_string()];
            if allow_write && workspace_dir.is_some() {
                args.push("--mode".to_string());
                args.push("accept-edits".to_string());
            }
            if let Some(m) = model_opt.filter(|m| *m != "auto") {
                args.push("--model".to_string());
                args.push(m.to_string());
            }
            args.push("-p".to_string());
            args.push(prompt);
            let res = run_cli_streaming(
                Some(&app),
                &request_id,
                Some(cancel_rx),
                &bin,
                &args,
                None,
                workspace_dir,
                CLI_IDLE_TIMEOUT_SECS,
                CLI_MAX_TOTAL_SECS,
                CliStdoutMode::PlainText,
            )
            .await?;
            if res.stdout.is_empty() {
                return Err(if res.stderr.is_empty() {
                    "Antigravity CLI returned an empty response.".to_string()
                } else {
                    res.stderr
                });
            }
            Ok(AiChatResponse {
                content: res.stdout,
                model_used: model_opt.unwrap_or("antigravity-cli").to_string(),
            })
        }

        "custom-cli" => {
            let raw_cmd = request
                .custom_cli_cmd
                .as_deref()
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .ok_or_else(|| "Custom CLI command is empty.".to_string())?;
            let prompt = format_cli_prompt_with_images(
                request.system_prompt.as_deref(),
                &request.messages,
                &request.images,
            );
            let mut tokens: Vec<String> = raw_cmd.split_whitespace().map(|s| s.to_string()).collect();
            let cmd_name = tokens.remove(0);
            let bin = find_executable(&[&cmd_name]).unwrap_or(cmd_name);

            let mut used_placeholder = false;
            for arg in &mut tokens {
                if arg.contains("{prompt}") {
                    *arg = arg.replace("{prompt}", &prompt);
                    used_placeholder = true;
                }
            }
            let res = run_cli_streaming(
                Some(&app),
                &request_id,
                Some(cancel_rx),
                &bin,
                &tokens,
                if used_placeholder { None } else { Some(&prompt) },
                workspace_dir,
                CLI_IDLE_TIMEOUT_SECS,
                CLI_MAX_TOTAL_SECS,
                CliStdoutMode::PlainText,
            )
            .await?;
            if res.stdout.is_empty() {
                return Err(if res.stderr.is_empty() {
                    "Custom CLI returned an empty response.".to_string()
                } else {
                    res.stderr
                });
            }
            Ok(AiChatResponse {
                content: res.stdout,
                model_used: raw_cmd.to_string(),
            })
        }

        "openai-api" | "lmstudio" | "openai-compat" => {
            let default_base = match provider {
                "lmstudio" => "http://127.0.0.1:1234/v1",
                "openai-compat" => "http://127.0.0.1:8080/v1",
                _ => "https://api.openai.com/v1",
            };
            let base = request
                .base_url
                .as_deref()
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .unwrap_or(default_base)
                .trim_end_matches('/');
            let endpoint = if base.ends_with("/chat/completions") {
                base.to_string()
            } else if base.ends_with("/v1") {
                format!("{}/chat/completions", base)
            } else {
                format!("{}/v1/chat/completions", base)
            };

            let model = model_opt.unwrap_or(match provider {
                "openai-api" => "gpt-4.1",
                _ => "local-model",
            });

            if provider == "openai-api"
                && request
                    .api_key
                    .as_deref()
                    .map(|s| s.trim().is_empty())
                    .unwrap_or(true)
            {
                return Err("OpenAI API key is required.".to_string());
            }

            let mut msg_list = Vec::new();
            if let Some(sys) = request.system_prompt.as_deref() {
                if !sys.trim().is_empty() {
                    msg_list.push(serde_json::json!({ "role": "system", "content": sys.trim() }));
                }
            }
            let last_idx = request.messages.len().saturating_sub(1);
            for (idx, m) in request.messages.iter().enumerate() {
                if idx == last_idx && m.role != "assistant" && !request.images.is_empty() {
                    let mut parts = vec![serde_json::json!({ "type": "text", "text": m.content })];
                    for img in &request.images {
                        parts.push(serde_json::json!({
                            "type": "image_url",
                            "image_url": {
                                "url": format!("data:{};base64,{}", img.mime_type, img.base64)
                            }
                        }));
                    }
                    msg_list.push(serde_json::json!({ "role": m.role, "content": parts }));
                } else {
                    msg_list.push(serde_json::json!({ "role": m.role, "content": m.content }));
                }
            }

            let client = reqwest::Client::builder()
                .timeout(Duration::from_secs(120))
                .build()
                .map_err(|e| e.to_string())?;
            let mut req = client.post(&endpoint).json(&serde_json::json!({
                "model": model,
                "messages": msg_list,
                "temperature": 0.7
            }));
            if let Some(key) = request.api_key.as_deref() {
                if !key.trim().is_empty() {
                    req = req.bearer_auth(key.trim());
                }
            }

            let resp = send_http_with_cancel(req, cancel_rx).await?;
            let status = resp.status();
            let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            if !status.is_success() {
                return Err(format!("API error ({}): {}", status, body));
            }
            let raw_content = if let Some(s) = body["choices"][0]["message"]["content"].as_str() {
                s.to_string()
            } else if let Some(arr) = body["choices"][0]["message"]["content"].as_array() {
                arr.iter()
                    .filter_map(|part| {
                        part["text"]
                            .as_str()
                            .or_else(|| part["content"].as_str())
                    })
                    .collect::<Vec<_>>()
                    .join("")
            } else if let Some(s) = body["choices"][0]["text"].as_str() {
                s.to_string()
            } else {
                String::new()
            };

            if raw_content.trim().is_empty() {
                let reasoning = body["choices"][0]["message"]["reasoning_content"]
                    .as_str()
                    .or_else(|| body["choices"][0]["message"]["reasoning"].as_str())
                    .unwrap_or("");
                if !reasoning.trim().is_empty() {
                    let finish_reason = body["choices"][0]["finish_reason"]
                        .as_str()
                        .unwrap_or("unknown");
                    return Err(format!(
                        "Model returned reasoning output only with empty content (finish_reason: {}). Try increasing max tokens or using a non-thinking model.",
                        finish_reason
                    ));
                }
                if body["choices"][0]["message"]["content"].is_null() {
                    return Err(format!("Unexpected API response: {}", body));
                }
                return Err("API returned an empty response.".to_string());
            }

            Ok(AiChatResponse {
                content: raw_content,
                model_used: model.to_string(),
            })
        }

        "anthropic-api" => {
            let api_key = request
                .api_key
                .as_deref()
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .ok_or_else(|| "Anthropic API key is required.".to_string())?;
            let model = model_opt.unwrap_or("claude-sonnet-4-5");
            let base = request
                .base_url
                .as_deref()
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .unwrap_or("https://api.anthropic.com")
                .trim_end_matches('/');
            let endpoint = format!("{}/v1/messages", base);

            let last_idx = request.messages.len().saturating_sub(1);
            let msgs: Vec<serde_json::Value> = request
                .messages
                .iter()
                .enumerate()
                .map(|(idx, m)| {
                    if idx == last_idx && m.role != "assistant" && !request.images.is_empty() {
                        let mut parts: Vec<serde_json::Value> = request
                            .images
                            .iter()
                            .map(|img| {
                                serde_json::json!({
                                    "type": "image",
                                    "source": {
                                        "type": "base64",
                                        "media_type": img.mime_type,
                                        "data": img.base64
                                    }
                                })
                            })
                            .collect();
                        parts.push(serde_json::json!({ "type": "text", "text": m.content }));
                        serde_json::json!({ "role": "user", "content": parts })
                    } else {
                        serde_json::json!({
                            "role": if m.role == "assistant" { "assistant" } else { "user" },
                            "content": m.content
                        })
                    }
                })
                .collect();

            let mut payload = serde_json::json!({
                "model": model,
                "max_tokens": 4096,
                "messages": msgs
            });
            if let Some(sys) = request.system_prompt.as_deref() {
                if !sys.trim().is_empty() {
                    payload["system"] = serde_json::json!(sys.trim());
                }
            }

            let client = reqwest::Client::builder()
                .timeout(Duration::from_secs(120))
                .build()
                .map_err(|e| e.to_string())?;
            let req = client
                .post(&endpoint)
                .header("x-api-key", api_key)
                .header("anthropic-version", "2023-06-01")
                .json(&payload);
            let resp = send_http_with_cancel(req, cancel_rx).await?;
            let status = resp.status();
            let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            if !status.is_success() {
                return Err(format!("Anthropic API error ({}): {}", status, body));
            }
            let content = body["content"]
                .as_array()
                .and_then(|arr| arr.first())
                .and_then(|c| c["text"].as_str())
                .ok_or_else(|| format!("Unexpected Anthropic response: {}", body))?
                .to_string();

            Ok(AiChatResponse {
                content,
                model_used: model.to_string(),
            })
        }

        "gemini-api" => {
            let api_key = request
                .api_key
                .as_deref()
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .ok_or_else(|| "Gemini API key is required.".to_string())?;
            let model = model_opt.unwrap_or("gemini-2.5-flash");
            let endpoint = format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
                model, api_key
            );

            let last_idx = request.messages.len().saturating_sub(1);
            let contents: Vec<serde_json::Value> = request
                .messages
                .iter()
                .enumerate()
                .map(|(idx, m)| {
                    let mut parts = vec![serde_json::json!({ "text": m.content })];
                    if idx == last_idx && m.role != "assistant" && !request.images.is_empty() {
                        for img in &request.images {
                            parts.push(serde_json::json!({
                                "inline_data": {
                                    "mime_type": img.mime_type,
                                    "data": img.base64
                                }
                            }));
                        }
                    }
                    serde_json::json!({
                        "role": if m.role == "assistant" { "model" } else { "user" },
                        "parts": parts
                    })
                })
                .collect();

            let mut payload = serde_json::json!({ "contents": contents });
            if let Some(sys) = request.system_prompt.as_deref() {
                if !sys.trim().is_empty() {
                    payload["systemInstruction"] =
                        serde_json::json!({ "parts": [{ "text": sys.trim() }] });
                }
            }

            let client = reqwest::Client::builder()
                .timeout(Duration::from_secs(120))
                .build()
                .map_err(|e| e.to_string())?;
            let req = client.post(&endpoint).json(&payload);
            let resp = send_http_with_cancel(req, cancel_rx).await?;
            let status = resp.status();
            let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            if !status.is_success() {
                return Err(format!("Gemini API error ({}): {}", status, body));
            }
            let content = body["candidates"][0]["content"]["parts"][0]["text"]
                .as_str()
                .ok_or_else(|| format!("Unexpected Gemini response: {}", body))?
                .to_string();

            Ok(AiChatResponse {
                content,
                model_used: model.to_string(),
            })
        }

        "ollama" => {
            let base = request
                .base_url
                .as_deref()
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .unwrap_or("http://127.0.0.1:11434")
                .trim_end_matches('/');
            let endpoint = format!("{}/api/chat", base);
            let model = model_opt.unwrap_or("llama3.2");

            let mut msg_list = Vec::new();
            if let Some(sys) = request.system_prompt.as_deref() {
                if !sys.trim().is_empty() {
                    msg_list.push(serde_json::json!({ "role": "system", "content": sys.trim() }));
                }
            }
            let last_idx = request.messages.len().saturating_sub(1);
            for (idx, m) in request.messages.iter().enumerate() {
                if idx == last_idx && m.role != "assistant" && !request.images.is_empty() {
                    let imgs: Vec<&str> = request.images.iter().map(|i| i.base64.as_str()).collect();
                    msg_list.push(serde_json::json!({
                        "role": m.role,
                        "content": m.content,
                        "images": imgs
                    }));
                } else {
                    msg_list.push(serde_json::json!({ "role": m.role, "content": m.content }));
                }
            }

            let client = reqwest::Client::builder()
                .timeout(Duration::from_secs(180))
                .build()
                .map_err(|e| e.to_string())?;
            let req = client.post(&endpoint).json(&serde_json::json!({
                "model": model,
                "messages": msg_list,
                "stream": false
            }));
            let resp = send_http_with_cancel(req, cancel_rx).await.map_err(|e| {
                if e == "CLI_CANCELLED" {
                    e
                } else {
                    format!("Failed to connect to Ollama ({}): {}", endpoint, e)
                }
            })?;
            let status = resp.status();
            let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            if !status.is_success() {
                return Err(format!("Ollama error ({}): {}", status, body));
            }
            let raw_content = body["message"]["content"]
                .as_str()
                .or_else(|| body["response"].as_str())
                .map(|s| s.to_string())
                .unwrap_or_default();

            if raw_content.trim().is_empty() {
                let thinking = body["message"]["thinking"].as_str().unwrap_or("");
                if !thinking.trim().is_empty() {
                    let done_reason = body["done_reason"].as_str().unwrap_or("unknown");
                    return Err(format!(
                        "Ollama returned thinking output only with empty content (done_reason: {}). Try a non-thinking model or disable thinking.",
                        done_reason
                    ));
                }
                if body["message"]["content"].is_null() && body["response"].is_null() {
                    return Err(format!("Unexpected Ollama response: {}", body));
                }
                return Err("Ollama returned an empty response.".to_string());
            }

            Ok(AiChatResponse {
                content: raw_content,
                model_used: model.to_string(),
            })
        }

        "apple-foundation-models" => {
            crate::apple_fm::generate(
                app,
                request_id,
                cancel_rx,
                model_opt,
                request.system_prompt.as_deref(),
                &request.messages,
            )
            .await
        }

        other => Err(format!("Unsupported AI provider: {}", other)),
    }
}

pub fn resolve_image_path(path_str: &str, base_dir: Option<&str>) -> PathBuf {
    let raw = Path::new(path_str);
    if raw.is_absolute() {
        return raw.to_path_buf();
    }
    if let Some(base) = base_dir {
        let base_path = Path::new(base);
        let dir = if base_path.is_file() {
            base_path.parent().unwrap_or(base_path)
        } else {
            base_path
        };
        return dir.join(raw);
    }
    raw.to_path_buf()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_codex_models_and_config_default() {
        let toml = r#"
notify = ["echo"]
model = "gpt-5.6-sol"
model_reasoning_effort = "medium"

[tui]
screen_reader_detection_done = true
"#;
        assert_eq!(
            parse_codex_default_model_toml(toml).as_deref(),
            Some("gpt-5.6-sol")
        );

        let cache = r#"{
          "models": [
            {"slug": "gpt-6.1-sol", "visibility": "list"},
            {"slug": "gpt-reserve", "visibility": "hide"},
            {"slug": "gpt-5.6-sol", "visibility": "list"}
          ]
        }"#;
        assert_eq!(
            parse_codex_models_cache_json(cache),
            vec!["gpt-6.1-sol".to_string(), "gpt-5.6-sol".to_string()]
        );
    }

    #[test]
    fn parses_gemini_list_models_output() {
        let out = r#"Available Gemini Models:

auto (Auto)
  Description:   Let Gemini CLI decide
  Context limit: 1,048,576 input tokens

gemini-2.5-pro (gemini-2.5-pro)
  Context limit: 1,048,576 input tokens

gemini-3.5-flash (gemini-3.5-flash)
  Context limit: 1,048,576 input tokens
"#;
        assert_eq!(
            parse_gemini_list_models(out),
            vec![
                "auto".to_string(),
                "gemini-2.5-pro".to_string(),
                "gemini-3.5-flash".to_string()
            ]
        );
    }

    #[test]
    fn parses_agy_models_with_spinner() {
        let out = "\r⠋ Fetching available models...\r⠙ Fetching available models...\rgemini-4-hydrogen-high          Gemini 4 Hydrogen (High)\ngemini-4-argon-medium           Gemini 4 Argon (Medium)\nclaude-opus-5-5-high            Claude Opus 5.5 (High)\ngpt-oss-120b-medium             GPT-OSS 120B (Medium)\n";
        assert_eq!(
            parse_agy_models(out),
            vec![
                "gemini-4-hydrogen-high".to_string(),
                "gemini-4-argon-medium".to_string(),
                "claude-opus-5-5-high".to_string(),
                "gpt-oss-120b-medium".to_string(),
            ]
        );
    }

    #[test]
    fn parses_and_merges_gemini_models_json() {
        let json = r#"[
          {"modelId": "auto", "displayName": "Auto"},
          {"modelId": "gemini-2.5-pro", "displayName": "gemini-2.5-pro"},
          {"modelId": "gemini-3.5-flash", "displayName": "gemini-3.5-flash"}
        ]"#;
        let parsed = parse_gemini_models_json(json);
        assert_eq!(parsed, vec!["auto", "gemini-2.5-pro", "gemini-3.5-flash"]);
        let merged = merge_modern_gemini_models(parsed);
        assert!(merged.contains(&"gemini-3.8-flash".to_string()));
        assert!(merged.contains(&"gemini-3.1-pro-preview".to_string()));
    }

    #[test]
    fn extended_path_joins_entries_cleanly() {
        let joined = extended_path();
        assert!(env::split_paths(&joined).count() >= 3);
    }

    #[test]
    fn parses_windows_npm_and_pnpm_cmd_shims() {
        let npm_shim = r#"@ECHO off
SET dp0=%~dp0
endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\node_modules\@openai\codex\bin\codex.js" %*
"#;
        assert_eq!(
            parse_windows_cmd_shim_rel(npm_shim).as_deref(),
            Some(r"node_modules\@openai\codex\bin\codex.js")
        );

        let mjs_shim = r#"@"%dp0%\node.exe" "%~dp0\..\lib\cli.mjs" %*"#;
        assert_eq!(
            parse_windows_cmd_shim_rel(mjs_shim).as_deref(),
            Some(r"..\lib\cli.mjs")
        );

        let non_node_cmd = "@echo off\r\necho hello\r\n";
        assert_eq!(parse_windows_cmd_shim_rel(non_node_cmd), None);
    }

    #[test]
    fn clamps_utf16_prompt_safely_at_char_boundaries() {
        let ascii = "hello world";
        assert_eq!(clamp_utf16_prompt(ascii, 20), "hello world");

        let jp = "あいうえお🍙かき";
        let clamped = clamp_utf16_prompt(jp, 6);
        assert!(clamped.starts_with("あいうえお"));
        assert!(clamped.contains("truncated"));
    }

    #[test]
    fn resolves_windows_executable_skipping_extensionless_shims() {
        let dir = env::temp_dir().join(format!("onigiri_win_exec_ai_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();

        // Simulate `%APPDATA%\npm` having extensionless POSIX script `codex`, `codex.ps1`, and `codex.cmd`
        std::fs::write(dir.join("codex"), "#!/bin/sh\nnode \"$basedir/node_modules/@openai/codex/bin/codex.js\" \"$@\"\n").unwrap();
        std::fs::write(dir.join("codex.ps1"), "# ps1 shim\n").unwrap();
        std::fs::write(dir.join("codex.cmd"), "@echo off\r\n").unwrap();

        assert_eq!(
            resolve_windows_executable_candidate(&dir, "codex"),
            Some(dir.join("codex.cmd"))
        );

        // When `.exe` also exists alongside extensionless + `.cmd`, prefer `.exe`
        std::fs::write(dir.join("claude"), "#!/bin/sh\n").unwrap();
        std::fs::write(dir.join("claude.cmd"), "@echo off\r\n").unwrap();
        std::fs::write(dir.join("claude.exe"), b"MZ").unwrap();
        assert_eq!(
            resolve_windows_executable_candidate(&dir, "claude"),
            Some(dir.join("claude.exe"))
        );

        // Extensionless-only file must never be matched on Windows
        std::fs::write(dir.join("posix_only"), "#!/bin/sh\n").unwrap();
        assert_eq!(resolve_windows_executable_candidate(&dir, "posix_only"), None);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn parses_codex_jsonl_events_for_progress_and_fallback() {
        let turn_started = parse_codex_jsonl_line(r#"{"type":"turn.started"}"#);
        assert!(turn_started.parsed_json);
        assert_eq!(turn_started.kind, Some("status"));
        assert_eq!(turn_started.progress_text.as_deref(), Some("Analyzing request..."));

        let cmd_started = parse_codex_jsonl_line(
            r#"{"type":"item.started","item":{"id":"1","type":"command_execution","command":"mkdir -p docs"}}"#,
        );
        assert_eq!(cmd_started.kind, Some("tool"));
        assert_eq!(cmd_started.progress_text.as_deref(), Some("$ mkdir -p docs"));

        let mcp_started = parse_codex_jsonl_line(
            r#"{"type":"item.started","item":{"id":"2","type":"mcp_tool_call","server":"imagegen","tool":"image_gen"}}"#,
        );
        assert_eq!(mcp_started.kind, Some("tool"));
        assert_eq!(mcp_started.progress_text.as_deref(), Some("Tool: imagegen/image_gen"));

        let commentary = parse_codex_jsonl_line(
            r#"{"type":"item.completed","item":{"id":"3","type":"agent_message","text":"最初の3案を生成中です..."}}"#,
        );
        assert_eq!(commentary.kind, Some("commentary"));
        assert_eq!(
            commentary.agent_message.as_deref(),
            Some("最初の3案を生成中です...")
        );

        let file_changed = parse_codex_jsonl_line(
            r#"{"type":"item.completed","item":{"id":"4","type":"file_change","changes":[{"path":"docs/design-1.png","kind":"add"},{"path":"docs/design-2.png","kind":"add"}]}}"#,
        );
        assert_eq!(file_changed.kind, Some("tool"));
        assert_eq!(
            file_changed.progress_text.as_deref(),
            Some("Updated: docs/design-1.png, docs/design-2.png")
        );

        let failed = parse_codex_jsonl_line(
            r#"{"type":"turn.failed","error":{"message":"Sandbox denied write"}}"#,
        );
        assert_eq!(failed.error_message.as_deref(), Some("Sandbox denied write"));
    }

    #[test]
    fn strips_ansi_sequences_cleanly() {
        let raw = "\x1b[32mOK\x1b[0m \x1b]0;title\x07line\r";
        assert_eq!(strip_ansi_escape_sequences(raw), "OK line");
    }

    #[test]
    fn ai_chat_state_cancels_and_cleans_up_on_drop() {
        let state = AiChatState::new();
        {
            let (rx, _guard) = state.register("req-1");
            assert!(!*rx.borrow());
            assert!(state.cancel("req-1"));
            assert!(*rx.borrow());
            assert!(!state.cancel("missing"));
        }
        assert!(!state.cancel("req-1"));
    }
}
