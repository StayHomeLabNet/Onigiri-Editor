use serde::Serialize;
use std::env;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDiagnostic {
    pub id: String,
    pub severity: String, // "error" | "warning" | "info"
    pub title_ja: String,
    pub title_en: String,
    pub description_ja: String,
    pub description_en: String,
    pub command_preview: Option<String>,
    pub in_app_action: Option<String>,
    pub action_target: Option<String>,
    pub in_app_label_ja: Option<String>,
    pub in_app_label_en: Option<String>,
    pub terminal_command: Option<String>,
    pub docs_url: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSetupProgress {
    pub root_path: String,
    pub action: String,
    pub running: bool,
    pub line: Option<String>,
    pub done: bool,
    pub ok: Option<bool>,
    pub message: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSetupResult {
    pub ok: bool,
    pub message: String,
    pub output: Vec<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub root_path: String,
    pub name: String,
    pub kind: String,
    pub package_manager: Option<String>,
    pub dev_script: Option<String>,
    pub scripts: Vec<String>,
    pub default_url: Option<String>,
    pub dev_command_label: Option<String>,
    pub has_dist: bool,
    pub dist_index_path: Option<String>,
    pub entry_html_path: Option<String>,
    pub already_running: bool,
    pub diagnostics: Vec<ProjectDiagnostic>,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProjectServerStatus {
    pub running: bool,
    pub starting: bool,
    pub external: bool,
    pub root_path: Option<String>,
    pub kind: Option<String>,
    pub url: Option<String>,
    pub command_label: Option<String>,
    pub logs: Vec<String>,
    pub error: Option<String>,
}

pub struct ProjectServerInner {
    pub status: ProjectServerStatus,
    pub child: Option<Child>,
    pub pid: Option<u32>,
    pub aux_child: Option<Child>,
    pub aux_pid: Option<u32>,
    pub static_server_task: Option<tokio::task::JoinHandle<()>>,
    pub generation: u64,
}

pub struct ProjectServerState {
    pub inner: Arc<Mutex<ProjectServerInner>>,
    pub start_lock: Arc<Mutex<()>>,
}

impl ProjectServerState {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(ProjectServerInner {
                status: ProjectServerStatus::default(),
                child: None,
                pid: None,
                aux_child: None,
                aux_pid: None,
                static_server_task: None,
                generation: 0,
            })),
            start_lock: Arc::new(Mutex::new(())),
        }
    }
}

#[allow(dead_code)]
pub(crate) fn parse_reg_query_path_output(output: &str) -> Option<String> {
    for raw_line in output.lines() {
        let trimmed = raw_line.trim();
        let upper = trimmed.to_ascii_uppercase();
        for kind in ["REG_EXPAND_SZ", "REG_SZ"] {
            if let Some(idx) = upper.find(kind) {
                let after = trimmed[idx + kind.len()..].trim();
                if !after.is_empty() {
                    return Some(after.to_string());
                }
            }
        }
    }
    None
}

#[allow(dead_code)]
pub(crate) fn expand_windows_env_vars_with<'a, F>(input: &str, mut lookup: F) -> String
where
    F: FnMut(&str) -> Option<String>,
{
    let mut out = String::with_capacity(input.len());
    let mut rest = input;
    while let Some(start) = rest.find('%') {
        out.push_str(&rest[..start]);
        let after_start = &rest[start + 1..];
        if let Some(end) = after_start.find('%') {
            let var_name = &after_start[..end];
            if !var_name.is_empty() {
                if let Some(val) = lookup(var_name) {
                    out.push_str(&val);
                    rest = &after_start[end + 1..];
                    continue;
                }
            }
            out.push('%');
            out.push_str(var_name);
            out.push('%');
            rest = &after_start[end + 1..];
        } else {
            out.push('%');
            rest = after_start;
        }
    }
    out.push_str(rest);
    out
}

#[cfg(target_os = "windows")]
fn expand_windows_env_vars(input: &str) -> String {
    let vars: Vec<(String, String)> = env::vars_os()
        .map(|(k, v)| {
            (
                k.to_string_lossy().to_ascii_lowercase(),
                v.to_string_lossy().to_string(),
            )
        })
        .collect();
    expand_windows_env_vars_with(input, |name| {
        let target = name.to_ascii_lowercase();
        vars.iter()
            .find(|(k, _)| k == &target)
            .map(|(_, v)| v.clone())
    })
}

#[cfg(target_os = "windows")]
pub(crate) fn windows_registry_path_entries() -> Vec<PathBuf> {
    use std::os::windows::process::CommandExt;
    use std::sync::{Mutex as StdMutex, OnceLock};
    use std::time::Instant;

    static CACHE: OnceLock<StdMutex<Option<(Instant, Vec<PathBuf>)>>> = OnceLock::new();
    let cache = CACHE.get_or_init(|| StdMutex::new(None));
    if let Ok(guard) = cache.lock() {
        if let Some((fetched_at, ref cached)) = *guard {
            if fetched_at.elapsed() < Duration::from_secs(2) {
                return cached.clone();
            }
        }
    }

    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let mut entries: Vec<PathBuf> = Vec::new();
    for key in [
        r"HKCU\Environment",
        r"HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment",
    ] {
        let Ok(out) = std::process::Command::new("reg")
            .args(["query", key, "/v", "Path"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
        else {
            continue;
        };
        if !out.status.success() {
            continue;
        }
        let text = String::from_utf8_lossy(&out.stdout);
        if let Some(raw_path) = parse_reg_query_path_output(&text) {
            let expanded = expand_windows_env_vars(&raw_path);
            for p in env::split_paths(&expanded) {
                if !p.as_os_str().is_empty() {
                    entries.push(p);
                }
            }
        }
    }

    if let Ok(mut guard) = cache.lock() {
        *guard = Some((Instant::now(), entries.clone()));
    }
    entries
}

#[cfg(target_os = "windows")]
fn push_sorted_subdirs_desc(dirs: &mut Vec<PathBuf>, parent: &Path, prefix_ci: Option<&str>) {
    let Ok(read_dir) = fs::read_dir(parent) else {
        return;
    };
    let mut matches: Vec<PathBuf> = read_dir
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            if !path.is_dir() {
                return None;
            }
            if let Some(prefix) = prefix_ci {
                let name = entry.file_name().to_string_lossy().to_ascii_lowercase();
                if !name.starts_with(prefix) {
                    return None;
                }
            }
            Some(path)
        })
        .collect();
    matches.sort();
    matches.reverse();
    dirs.extend(matches);
}

fn extended_path() -> String {
    let mut dirs: Vec<PathBuf> = Vec::new();

    #[cfg(unix)]
    {
        let home = env::var("HOME").unwrap_or_default();
        if !home.is_empty() {
            for rel in [
                ".local/bin",
                ".cargo/bin",
                ".npm-global/bin",
                ".volta/bin",
                ".asdf/shims",
                ".local/share/mise/shims",
                ".rbenv/shims",
                ".rvm/bin",
                ".bun/bin",
                ".fnm/aliases/default/bin",
                ".nvm/versions/node/current/bin",
            ] {
                dirs.push(PathBuf::from(&home).join(rel));
            }

            // Scan ~/.nvm/versions/node/*/bin so GUI-launched apps find nvm node/npm
            let nvm_dir = PathBuf::from(&home).join(".nvm/versions/node");
            if let Ok(read_dir) = fs::read_dir(&nvm_dir) {
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

            // Scan user gem bin directories (~/.local/share/gem/ruby/*/bin and ~/.gem/ruby/*/bin)
            for gem_base in [".local/share/gem/ruby", ".gem/ruby"] {
                if let Ok(read_dir) = fs::read_dir(PathBuf::from(&home).join(gem_base)) {
                    let mut gem_bins: Vec<PathBuf> = read_dir
                        .flatten()
                        .map(|e| e.path().join("bin"))
                        .filter(|p| p.is_dir())
                        .collect();
                    gem_bins.sort();
                    if let Some(latest) = gem_bins.pop() {
                        dirs.push(latest);
                    }
                }
            }
        }

        #[cfg(target_os = "macos")]
        {
            for p in [
                "/Applications/Docker.app/Contents/Resources/bin",
                "/Applications/OrbStack.app/Contents/MacOS/xbin",
                "/opt/homebrew/opt/php/bin",
                "/opt/homebrew/opt/ruby/bin",
                "/usr/local/opt/ruby/bin",
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
        let program_files_x86 =
            env::var("ProgramFiles(x86)").unwrap_or_else(|_| r"C:\Program Files (x86)".to_string());
        let program_data =
            env::var("ProgramData").unwrap_or_else(|_| r"C:\ProgramData".to_string());

        if !appdata.is_empty() {
            dirs.push(PathBuf::from(&appdata).join("npm"));
            dirs.push(PathBuf::from(&appdata).join("nvm"));
            dirs.push(PathBuf::from(&appdata).join(r"Composer\vendor\bin"));
        }
        if !local_appdata.is_empty() {
            dirs.push(PathBuf::from(&local_appdata).join(r"Microsoft\WinGet\Links"));
            let winget_pkgs = PathBuf::from(&local_appdata).join(r"Microsoft\WinGet\Packages");
            if winget_pkgs.is_dir() {
                let mut php_pkgs = Vec::new();
                push_sorted_subdirs_desc(&mut php_pkgs, &winget_pkgs, Some("php.php"));
                for pkg in php_pkgs {
                    dirs.push(pkg.clone());
                    push_sorted_subdirs_desc(&mut dirs, &pkg, None);
                }
            }
            dirs.push(PathBuf::from(&local_appdata).join("pnpm"));
            dirs.push(PathBuf::from(&local_appdata).join(r"Volta\bin"));
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
            for rel in [
                r".cargo\bin",
                r".bun\bin",
                r".local\bin",
                r"scoop\shims",
                r"scoop\apps\php\current",
                r".config\herd\bin",
                r".config\herd-lite\bin",
            ] {
                dirs.push(PathBuf::from(&user_profile).join(rel));
            }
        }
        dirs.push(PathBuf::from(&program_data).join(r"chocolatey\bin"));
        dirs.push(PathBuf::from(&program_data).join(r"ComposerSetup\bin"));
        dirs.push(PathBuf::from(&program_files).join("nodejs"));
        for pf in [&program_files, &program_files_x86] {
            let pf_php = PathBuf::from(pf).join("PHP");
            dirs.push(pf_php.clone());
            push_sorted_subdirs_desc(&mut dirs, &pf_php, None);
        }
        dirs.push(PathBuf::from(&program_files).join(r"Docker\Docker\resources\bin"));
        dirs.push(PathBuf::from(&program_files).join(r"Git\cmd"));
        dirs.push(PathBuf::from(&program_files).join(r"Git\bin"));
        dirs.push(PathBuf::from(r"C:\php"));
        push_sorted_subdirs_desc(&mut dirs, Path::new(r"C:\"), Some("php"));
        dirs.push(PathBuf::from(r"C:\tools\php"));
        push_sorted_subdirs_desc(&mut dirs, Path::new(r"C:\tools"), Some("php"));
        dirs.push(PathBuf::from(r"C:\xampp\php"));
        push_sorted_subdirs_desc(&mut dirs, Path::new(r"C:\laragon\bin\php"), Some("php"));
        push_sorted_subdirs_desc(&mut dirs, Path::new(r"C:\wamp64\bin\php"), Some("php"));
        push_sorted_subdirs_desc(&mut dirs, Path::new(r"C:\wamp\bin\php"), Some("php"));
        push_sorted_subdirs_desc(&mut dirs, Path::new(r"C:\MAMP\bin\php"), Some("php"));
        for ruby_ver in ["Ruby34-x64", "Ruby33-x64", "Ruby32-x64", "Ruby31-x64"] {
            let ruby_bin = PathBuf::from(r"C:\").join(ruby_ver).join("bin");
            if ruby_bin.is_dir() {
                dirs.push(ruby_bin);
            }
        }
        for reg_dir in windows_registry_path_entries() {
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

#[allow(dead_code)]
fn parse_windows_cmd_shim_rel(content: &str) -> Option<String> {
    let lower = content.to_ascii_lowercase();
    for marker in ["%dp0%", "%~dp0"] {
        let mut search_from = 0usize;
        while let Some(rel_idx) = lower[search_from..].find(marker) {
            let abs_start = search_from + rel_idx + marker.len();
            let rest = &content[abs_start..];
            let end_offset = rest
                .find(|c: char| c == '"' || c == '\'' || c == '\r' || c == '\n')
                .unwrap_or(rest.len());
            let candidate = rest[..end_offset].trim();
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

#[cfg(target_os = "windows")]
fn resolve_windows_cmd_shim(bin: &str, args: &[String]) -> Option<(String, Vec<String>)> {
    let lower = bin.to_ascii_lowercase();
    if !lower.ends_with(".cmd") && !lower.ends_with(".bat") {
        return None;
    }
    let content = fs::read_to_string(bin).ok()?;
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

fn build_project_command(bin: &str, args: &[String]) -> Command {
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

fn find_executable(names: &[&str]) -> Option<String> {
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

fn detect_package_manager(root: &Path) -> &'static str {
    if root.join("pnpm-lock.yaml").exists() {
        "pnpm"
    } else if root.join("yarn.lock").exists() {
        "yarn"
    } else if root.join("bun.lockb").exists() || root.join("bun.lock").exists() {
        "bun"
    } else {
        "npm"
    }
}

const VITE_CONFIG_FILES: &[&str] = &[
    "vite.config.ts",
    "vite.config.js",
    "vite.config.mts",
    "vite.config.mjs",
    "vite.config.cts",
    "vite.config.cjs",
];

const NEXT_CONFIG_FILES: &[&str] = &[
    "next.config.ts",
    "next.config.mjs",
    "next.config.js",
    "next.config.cjs",
];

const ASTRO_CONFIG_FILES: &[&str] = &[
    "astro.config.mjs",
    "astro.config.ts",
    "astro.config.js",
    "astro.config.cjs",
];

const NUXT_CONFIG_FILES: &[&str] = &["nuxt.config.ts", "nuxt.config.js", "nuxt.config.mjs"];

const COMPOSE_FILES: &[&str] = &[
    "compose.yaml",
    "compose.yml",
    "docker-compose.yml",
    "docker-compose.yaml",
];

fn has_vite_config(root: &Path) -> bool {
    VITE_CONFIG_FILES.iter().any(|name| root.join(name).exists())
}

fn has_next_config(root: &Path) -> bool {
    NEXT_CONFIG_FILES.iter().any(|name| root.join(name).exists())
}

fn has_astro_config(root: &Path) -> bool {
    ASTRO_CONFIG_FILES.iter().any(|name| root.join(name).exists())
}

fn has_nuxt_config(root: &Path) -> bool {
    NUXT_CONFIG_FILES.iter().any(|name| root.join(name).exists())
}

fn find_compose_file(root: &Path) -> Option<PathBuf> {
    COMPOSE_FILES
        .iter()
        .map(|name| root.join(name))
        .find(|p| p.is_file())
}

fn parse_compose_ports(root: &Path) -> Vec<u16> {
    let Some(compose_path) = find_compose_file(root) else {
        return Vec::new();
    };
    let Ok(content) = fs::read_to_string(&compose_path) else {
        return Vec::new();
    };

    let mut preferred: Vec<u16> = Vec::new();
    let mut secondary: Vec<u16> = Vec::new();
    let mut in_ports = false;
    let mut ports_indent: usize = 0;

    for raw_line in content.lines() {
        let indent = raw_line.chars().take_while(|c| *c == ' ').count();
        let trimmed = raw_line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let code_part = trimmed.split('#').next().unwrap_or(trimmed).trim();

        if code_part.starts_with("ports:") {
            in_ports = true;
            ports_indent = indent;
            continue;
        }

        if in_ports {
            let is_list_item = code_part.starts_with('-');
            if indent <= ports_indent && !is_list_item {
                in_ports = false;
                continue;
            }

            if let Some(after_pub) = code_part
                .trim_start_matches('-')
                .trim()
                .strip_prefix("published:")
            {
                let val = after_pub.trim().trim_matches(|c| c == '"' || c == '\'');
                if let Some(p) = parse_leading_port(val) {
                    if !preferred.contains(&p) && !secondary.contains(&p) {
                        preferred.push(p);
                    }
                }
                continue;
            }

            let entry = code_part
                .trim_start_matches('-')
                .trim()
                .trim_matches(|c| c == '"' || c == '\'');
            let base = entry.split('/').next().unwrap_or(entry);
            let parts: Vec<&str> = base.split(':').collect();
            let (host_opt, target_opt) = match parts.as_slice() {
                [host, target] => (parse_leading_port(host), parse_leading_port(target)),
                [_ip, host, target] => (parse_leading_port(host), parse_leading_port(target)),
                _ => (None, None),
            };
            if let (Some(host_p), Some(target_p)) = (host_opt, target_opt) {
                if matches!(target_p, 3306 | 5432 | 6379 | 27017 | 11211 | 9042) {
                    continue;
                }
                if !preferred.contains(&host_p) && !secondary.contains(&host_p) {
                    if matches!(target_p, 80 | 443 | 8000 | 8080 | 3000 | 5173 | 4173) {
                        preferred.push(host_p);
                    } else {
                        secondary.push(host_p);
                    }
                }
            }
        }
    }

    preferred.extend(secondary);
    preferred
}

fn is_laravel_project(root: &Path) -> bool {
    if root.join("artisan").is_file() {
        return true;
    }
    let composer_path = root.join("composer.json");
    if composer_path.is_file() {
        if let Ok(raw) = fs::read_to_string(&composer_path) {
            if raw.contains("\"laravel/framework\"") {
                return true;
            }
        }
    }
    false
}

fn is_wordpress_project(root: &Path) -> bool {
    root.join("wp-config.php").is_file()
        || root.join("wp-includes/version.php").is_file()
        || (root.join("wp-content").is_dir() && root.join("wp-load.php").is_file())
}

fn is_mkdocs_project(root: &Path) -> bool {
    root.join("mkdocs.yml").is_file() || root.join("mkdocs.yaml").is_file()
}

fn is_hugo_project(root: &Path) -> bool {
    root.join("hugo.toml").is_file()
        || root.join("hugo.yaml").is_file()
        || root.join("hugo.yml").is_file()
        || root.join("hugo.json").is_file()
        || (root.join("config.toml").is_file()
            && (root.join("content").is_dir()
                || root.join("layouts").is_dir()
                || root.join("themes").is_dir()))
}

fn is_jekyll_project(root: &Path) -> bool {
    let gemfile = root.join("Gemfile");
    if gemfile.is_file() {
        if let Ok(raw) = fs::read_to_string(&gemfile) {
            if raw.to_ascii_lowercase().contains("jekyll") {
                return true;
            }
        }
        if root.join("_config.yml").is_file() {
            return true;
        }
    }
    false
}

struct PythonWebSpec {
    kind: &'static str,
    dev_script: &'static str,
    default_url: &'static str,
    command_label: String,
    args: Vec<String>,
    uses_uv_ok: bool,
}

fn detect_python_web(root: &Path) -> Option<PythonWebSpec> {
    if root.join("manage.py").is_file() {
        return Some(PythonWebSpec {
            kind: "django",
            dev_script: "python-django",
            default_url: "http://127.0.0.1:8000",
            command_label: "python manage.py runserver 127.0.0.1:8000".to_string(),
            args: vec![
                "manage.py".to_string(),
                "runserver".to_string(),
                "127.0.0.1:8000".to_string(),
            ],
            uses_uv_ok: true,
        });
    }

    let mut deps_blob = String::new();
    for f in ["pyproject.toml", "requirements.txt"] {
        let p = root.join(f);
        if p.is_file() {
            if let Ok(raw) = fs::read_to_string(&p) {
                deps_blob.push_str(&raw.to_ascii_lowercase());
                deps_blob.push('\n');
            }
        }
    }
    if deps_blob.is_empty() {
        return None;
    }

    if deps_blob.contains("streamlit") {
        let entry = ["app.py", "main.py", "Home.py", "streamlit_app.py"]
            .iter()
            .find(|rel| root.join(rel).is_file())
            .copied()?;
        return Some(PythonWebSpec {
            kind: "streamlit",
            dev_script: "python-streamlit",
            default_url: "http://localhost:8501",
            command_label: format!("streamlit run {} --server.headless true --server.port 8501", entry),
            args: vec![
                "-m".to_string(),
                "streamlit".to_string(),
                "run".to_string(),
                entry.to_string(),
                "--server.headless".to_string(),
                "true".to_string(),
                "--server.port".to_string(),
                "8501".to_string(),
            ],
            uses_uv_ok: true,
        });
    }

    if deps_blob.contains("fastapi") || deps_blob.contains("uvicorn") {
        let module = [
            ("main.py", "main:app"),
            ("app.py", "app:app"),
            ("src/main.py", "src.main:app"),
            ("app/main.py", "app.main:app"),
        ]
        .iter()
        .find(|(file, _)| root.join(file).is_file())
        .map(|(_, m)| *m)?;
        return Some(PythonWebSpec {
            kind: "fastapi",
            dev_script: "python-fastapi",
            default_url: "http://127.0.0.1:8000",
            command_label: format!("uvicorn {} --reload --host 127.0.0.1 --port 8000", module),
            args: vec![
                "-m".to_string(),
                "uvicorn".to_string(),
                module.to_string(),
                "--reload".to_string(),
                "--host".to_string(),
                "127.0.0.1".to_string(),
                "--port".to_string(),
                "8000".to_string(),
            ],
            uses_uv_ok: true,
        });
    }

    if deps_blob.contains("flask") {
        let entry = ["app.py", "main.py", "wsgi.py"]
            .iter()
            .find(|rel| root.join(rel).is_file())
            .copied()?;
        return Some(PythonWebSpec {
            kind: "flask",
            dev_script: "python-flask",
            default_url: "http://127.0.0.1:5000",
            command_label: format!("flask --app {} run --debug --host 127.0.0.1 --port 5000", entry),
            args: vec![
                "-m".to_string(),
                "flask".to_string(),
                "--app".to_string(),
                entry.to_string(),
                "run".to_string(),
                "--debug".to_string(),
                "--host".to_string(),
                "127.0.0.1".to_string(),
                "--port".to_string(),
                "5000".to_string(),
            ],
            uses_uv_ok: true,
        });
    }

    None
}

fn is_usable_python_exe(exe: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        if exe.to_ascii_lowercase().contains(r"\microsoft\windowsapps\") {
            let mut cmd = std::process::Command::new(exe);
            cmd.args(["-c", "import sys"])
                .stdin(std::process::Stdio::null())
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null());
            {
                use std::os::windows::process::CommandExt;
                cmd.creation_flags(0x0800_0000);
            }
            return cmd.status().map(|s| s.success()).unwrap_or(false);
        }
    }
    let _ = exe;
    true
}

fn find_usable_python_exe() -> Option<String> {
    for name in ["python3", "python"] {
        if let Some(exe) = find_executable(&[name]) {
            if is_usable_python_exe(&exe) {
                return Some(exe);
            }
        }
    }
    None
}

fn find_python_runner(root: &Path) -> Option<(String, Vec<String>)> {
    for rel in [
        ".venv/bin/python",
        ".venv/bin/python3",
        ".venv/Scripts/python.exe",
        "venv/bin/python",
        "venv/bin/python3",
        "venv/Scripts/python.exe",
    ] {
        let p = root.join(rel);
        if p.is_file() {
            return Some((p.to_string_lossy().to_string(), Vec::new()));
        }
    }
    if root.join("uv.lock").is_file() || root.join("pyproject.toml").is_file() {
        if let Some(uv) = find_executable(&["uv"]) {
            return Some((uv, vec!["run".to_string(), "python".to_string()]));
        }
    }
    find_usable_python_exe().map(|exe| (exe, Vec::new()))
}

fn parse_env_app_url(root: &Path) -> Option<String> {
    let env_path = root.join(".env");
    let content = fs::read_to_string(&env_path).ok()?;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let Some(rest) = trimmed.strip_prefix("APP_URL") else {
            continue;
        };
        let rest = rest.trim_start();
        let Some(val_raw) = rest.strip_prefix('=') else {
            continue;
        };
        let val = val_raw.trim();
        let unquoted = if (val.starts_with('"') && val.ends_with('"') && val.len() >= 2)
            || (val.starts_with('\'') && val.ends_with('\'') && val.len() >= 2)
        {
            &val[1..val.len() - 1]
        } else {
            val.split('#').next().unwrap_or(val).trim()
        };
        if let Ok(mut parsed) = url::Url::parse(unquoted) {
            if matches!(parsed.scheme(), "http" | "https") {
                if let Some(host) = parsed.host_str() {
                    if host == "0.0.0.0" {
                        let _ = parsed.set_host(Some("localhost"));
                    }
                    if matches!(parsed.host_str(), Some("localhost" | "127.0.0.1")) {
                        return Some(parsed.to_string().trim_end_matches('/').to_string());
                    }
                }
            }
        }
    }
    None
}

fn laravel_candidate_urls(root: &Path) -> Vec<String> {
    let mut urls = Vec::new();
    if let Some(app_url) = parse_env_app_url(root) {
        urls.push(app_url);
    }
    for port in parse_compose_ports(root) {
        let u = format!("http://localhost:{}", port);
        if !urls.iter().any(|x| x == &u) {
            urls.push(u);
        }
    }
    let artisan_default = "http://127.0.0.1:8000".to_string();
    if !urls.iter().any(|u| u == &artisan_default) {
        urls.push(artisan_default);
    }
    urls
}

fn laravel_needs_companion_vite(root: &Path) -> bool {
    if !root.join("artisan").is_file() {
        return false;
    }
    if !root.join("node_modules").is_dir() || !root.join("package.json").is_file() {
        return false;
    }
    if root.join("public/build/manifest.json").is_file() {
        return false;
    }
    if !has_vite_config(root) {
        return false;
    }
    if let Ok(raw) = fs::read_to_string(root.join("package.json")) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&raw) {
            return json["scripts"]["dev"].is_string();
        }
    }
    false
}

fn parse_leading_port(s: &str) -> Option<u16> {
    let digits: String = s
        .trim_start()
        .chars()
        .take_while(|c| c.is_ascii_digit())
        .collect();
    if digits.is_empty() {
        return None;
    }
    digits.parse::<u16>().ok().filter(|&p| p > 0)
}

fn parse_port_from_script(script_cmd: &str) -> Option<u16> {
    let tokens: Vec<&str> = script_cmd.split_whitespace().collect();
    for (idx, tok) in tokens.iter().enumerate() {
        if let Some(rest) = tok.strip_prefix("--port=") {
            if let Some(p) = parse_leading_port(rest) {
                return Some(p);
            }
        }
        if let Some(rest) = tok.strip_prefix("-p=") {
            if let Some(p) = parse_leading_port(rest) {
                return Some(p);
            }
        }
        if let Some(rest) = tok.strip_prefix("PORT=") {
            if let Some(p) = parse_leading_port(rest) {
                return Some(p);
            }
        }
        if *tok == "--port" || *tok == "-p" {
            if let Some(next) = tokens.get(idx + 1) {
                if let Some(p) = parse_leading_port(next) {
                    return Some(p);
                }
            }
        }
    }
    None
}

fn extract_port_property(text: &str) -> Option<u16> {
    // Strip // line comments before searching for `port: <number>`
    let cleaned: String = text
        .lines()
        .map(|line| {
            if let Some(idx) = line.find("//") {
                &line[..idx]
            } else {
                line
            }
        })
        .collect::<Vec<_>>()
        .join("\n");

    let search_slice = if let Some(server_idx) = cleaned.find("server") {
        &cleaned[server_idx..]
    } else {
        &cleaned[..]
    };

    let mut pos = 0;
    while let Some(rel_idx) = search_slice[pos..].find("port") {
        let abs_idx = pos + rel_idx;
        let before_ok = abs_idx == 0
            || !search_slice[..abs_idx]
                .chars()
                .next_back()
                .map(|c| c.is_ascii_alphanumeric() || c == '_')
                .unwrap_or(false);
        let after = &search_slice[abs_idx + 4..];
        let after_trimmed = after.trim_start();
        if before_ok && after_trimmed.starts_with(':') {
            let val = after_trimmed[1..].trim_start();
            if let Some(p) = parse_leading_port(val) {
                return Some(p);
            }
        }
        pos = abs_idx + 4;
    }
    None
}

fn parse_port_from_config(root: &Path, kind: &str) -> Option<u16> {
    let files: &[&str] = match kind {
        "vite" | "vitepress" | "sveltekit" => VITE_CONFIG_FILES,
        "astro" => ASTRO_CONFIG_FILES,
        "nuxt" => NUXT_CONFIG_FILES,
        _ => &[],
    };
    for name in files {
        let p = root.join(name);
        if p.exists() && p.is_file() {
            if let Ok(content) = fs::read_to_string(&p) {
                if let Some(port) = extract_port_property(&content) {
                    return Some(port);
                }
            }
        }
    }
    None
}

fn inspect_root_dir(root: &Path) -> Result<ProjectInfo, String> {
    if !root.exists() || !root.is_dir() {
        return Err("Project root is not a directory".to_string());
    }
    let root_path = root.to_string_lossy().to_string();
    let dir_name = root
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Project")
        .to_string();

    let dist_index = ["dist/index.html", "build/index.html", "out/index.html"]
        .iter()
        .map(|rel| root.join(rel))
        .find(|p| p.exists() && p.is_file());

    let entry_html = ["index.html", "public/index.html"]
        .iter()
        .map(|rel| root.join(rel))
        .find(|p| p.exists() && p.is_file());

    // 1. Laravel (checked before package.json because Laravel commonly includes Vite/package.json)
    if is_laravel_project(root) {
        let has_artisan = root.join("artisan").is_file();
        let with_vite = laravel_needs_companion_vite(root);
        let docroot = if root.join("public/index.php").exists() {
            "public"
        } else {
            "."
        };
        let (dev_script, scripts, label) = if has_artisan && with_vite {
            (
                Some("artisan-vite".to_string()),
                vec!["artisan-vite".to_string(), "artisan-serve".to_string()],
                "php artisan serve + vite".to_string(),
            )
        } else if has_artisan {
            (
                Some("artisan-serve".to_string()),
                vec!["artisan-serve".to_string()],
                "php artisan serve --host=127.0.0.1 --port=8000".to_string(),
            )
        } else {
            (
                Some("php-server".to_string()),
                vec!["php-server".to_string()],
                format!("php -S 127.0.0.1:8000 -t {}", docroot),
            )
        };
        return Ok(ProjectInfo {
            root_path,
            name: dir_name,
            kind: "laravel".to_string(),
            package_manager: None,
            dev_script,
            scripts,
            default_url: Some("http://127.0.0.1:8000".to_string()),
            dev_command_label: Some(label),
            has_dist: dist_index.is_some(),
            dist_index_path: dist_index.map(|p| p.to_string_lossy().to_string()),
            entry_html_path: entry_html.map(|p| p.to_string_lossy().to_string()),
            already_running: false,
            diagnostics: Vec::new(),
        });
    }

    // 2. WordPress (prefer Docker Compose when compose.yaml / docker-compose.yml exists)
    if is_wordpress_project(root) {
        let compose_ports = parse_compose_ports(root);
        if find_compose_file(root).is_some() {
            let port = compose_ports.first().copied().unwrap_or(8080);
            return Ok(ProjectInfo {
                root_path,
                name: dir_name,
                kind: "wordpress".to_string(),
                package_manager: None,
                dev_script: Some("docker-compose".to_string()),
                scripts: vec!["docker-compose".to_string()],
                default_url: Some(format!("http://localhost:{}", port)),
                dev_command_label: Some("docker compose up -d".to_string()),
                has_dist: dist_index.is_some(),
                dist_index_path: dist_index.map(|p| p.to_string_lossy().to_string()),
                entry_html_path: entry_html.map(|p| p.to_string_lossy().to_string()),
                already_running: false,
            diagnostics: Vec::new(),
            });
        }
        return Ok(ProjectInfo {
            root_path,
            name: dir_name,
            kind: "wordpress".to_string(),
            package_manager: None,
            dev_script: Some("php-server".to_string()),
            scripts: vec!["php-server".to_string()],
            default_url: Some("http://127.0.0.1:8000".to_string()),
            dev_command_label: Some("php -S 127.0.0.1:8000 -t .".to_string()),
            has_dist: dist_index.is_some(),
            dist_index_path: dist_index.map(|p| p.to_string_lossy().to_string()),
            entry_html_path: entry_html.map(|p| p.to_string_lossy().to_string()),
            already_running: false,
            diagnostics: Vec::new(),
        });
    }

    // 3. Markdown Static Site Generators (MkDocs, Hugo, Jekyll)
    if is_mkdocs_project(root) {
        return Ok(ProjectInfo {
            root_path,
            name: dir_name,
            kind: "mkdocs".to_string(),
            package_manager: None,
            dev_script: Some("mkdocs-serve".to_string()),
            scripts: vec!["mkdocs-serve".to_string()],
            default_url: Some("http://127.0.0.1:8000".to_string()),
            dev_command_label: Some("mkdocs serve -a 127.0.0.1:8000".to_string()),
            has_dist: dist_index.is_some(),
            dist_index_path: dist_index.map(|p| p.to_string_lossy().to_string()),
            entry_html_path: entry_html.map(|p| p.to_string_lossy().to_string()),
            already_running: false,
            diagnostics: Vec::new(),
        });
    }

    if is_hugo_project(root) {
        return Ok(ProjectInfo {
            root_path,
            name: dir_name,
            kind: "hugo".to_string(),
            package_manager: None,
            dev_script: Some("hugo-server".to_string()),
            scripts: vec!["hugo-server".to_string()],
            default_url: Some("http://localhost:1313".to_string()),
            dev_command_label: Some("hugo server -D --port 1313".to_string()),
            has_dist: dist_index.is_some(),
            dist_index_path: dist_index.map(|p| p.to_string_lossy().to_string()),
            entry_html_path: entry_html.map(|p| p.to_string_lossy().to_string()),
            already_running: false,
            diagnostics: Vec::new(),
        });
    }

    if is_jekyll_project(root) {
        return Ok(ProjectInfo {
            root_path,
            name: dir_name,
            kind: "jekyll".to_string(),
            package_manager: None,
            dev_script: Some("jekyll-serve".to_string()),
            scripts: vec!["jekyll-serve".to_string()],
            default_url: Some("http://127.0.0.1:4000".to_string()),
            dev_command_label: Some("bundle exec jekyll serve --port 4000".to_string()),
            has_dist: dist_index.is_some(),
            dist_index_path: dist_index.map(|p| p.to_string_lossy().to_string()),
            entry_html_path: entry_html.map(|p| p.to_string_lossy().to_string()),
            already_running: false,
            diagnostics: Vec::new(),
        });
    }

    // 4. Node.js / Vite / VitePress / Docusaurus / Next / Astro / Nuxt / SvelteKit
    let pkg_path = root.join("package.json");
    if pkg_path.exists() && pkg_path.is_file() {
        let raw = fs::read_to_string(&pkg_path).unwrap_or_default();
        let json: serde_json::Value = serde_json::from_str(&raw).unwrap_or_default();
        let pkg_name = json["name"]
            .as_str()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or(&dir_name)
            .to_string();

        let scripts_map = json["scripts"].as_object();
        let scripts: Vec<String> = scripts_map
            .map(|m| m.keys().cloned().collect())
            .unwrap_or_default();

        let has_dep = |needle: &str| -> bool {
            json["dependencies"][needle].is_string() || json["devDependencies"][needle].is_string()
        };

        let kind = if has_dep("vitepress") {
            "vitepress"
        } else if has_dep("@docusaurus/core") {
            "docusaurus"
        } else if has_vite_config(root) || has_dep("vite") {
            "vite"
        } else if has_next_config(root) || has_dep("next") {
            "next"
        } else if has_astro_config(root) || has_dep("astro") {
            "astro"
        } else if has_nuxt_config(root) || has_dep("nuxt") {
            "nuxt"
        } else if has_dep("@sveltejs/kit") {
            "sveltekit"
        } else if has_dep("react-scripts") {
            "cra"
        } else {
            "node"
        };

        let dev_script = ["dev", "docs:dev", "start", "preview", "docs:preview", "serve"]
            .iter()
            .find(|s| scripts.iter().any(|k| k == *s))
            .map(|s| (*s).to_string());

        let compose_ports = parse_compose_ports(root);
        if dev_script.is_some() || compose_ports.is_empty() {
            let script_cmd = dev_script
                .as_ref()
                .and_then(|sc| scripts_map.and_then(|m| m.get(sc)).and_then(|v| v.as_str()));

            let pm = detect_package_manager(root);
            let default_port = script_cmd
                .and_then(parse_port_from_script)
                .or_else(|| parse_port_from_config(root, kind))
                .unwrap_or(match kind {
                    "vite" | "vitepress" | "sveltekit" => 5173,
                    "astro" => 4321,
                    _ => 3000,
                });
            let dev_command_label = dev_script
                .as_ref()
                .map(|sc| format!("{} run {}", pm, sc));

            return Ok(ProjectInfo {
                root_path,
                name: pkg_name,
                kind: kind.to_string(),
                package_manager: Some(pm.to_string()),
                dev_script: dev_script.clone(),
                scripts,
                default_url: dev_script.map(|_| format!("http://localhost:{}", default_port)),
                dev_command_label,
                has_dist: dist_index.is_some(),
                dist_index_path: dist_index.map(|p| p.to_string_lossy().to_string()),
                entry_html_path: entry_html.map(|p| p.to_string_lossy().to_string()),
                already_running: false,
            diagnostics: Vec::new(),
            });
        }
    }

    // 5. Python Web (Django, Streamlit, FastAPI, Flask)
    if let Some(py) = detect_python_web(root) {
        return Ok(ProjectInfo {
            root_path,
            name: dir_name,
            kind: py.kind.to_string(),
            package_manager: None,
            dev_script: Some(py.dev_script.to_string()),
            scripts: vec![py.dev_script.to_string()],
            default_url: Some(py.default_url.to_string()),
            dev_command_label: Some(py.command_label),
            has_dist: dist_index.is_some(),
            dist_index_path: dist_index.map(|p| p.to_string_lossy().to_string()),
            entry_html_path: entry_html.map(|p| p.to_string_lossy().to_string()),
            already_running: false,
            diagnostics: Vec::new(),
        });
    }

    // 6. Generic PHP
    let has_php = root.join("composer.json").exists()
        || root.join("index.php").exists()
        || root.join("public/index.php").exists();
    if has_php {
        let compose_ports = parse_compose_ports(root);
        if find_compose_file(root).is_some()
            && !compose_ports.is_empty()
            && !root.join("vendor").is_dir()
        {
            return Ok(ProjectInfo {
                root_path,
                name: dir_name,
                kind: "docker".to_string(),
                package_manager: None,
                dev_script: Some("docker-compose".to_string()),
                scripts: vec!["docker-compose".to_string()],
                default_url: Some(format!("http://localhost:{}", compose_ports[0])),
                dev_command_label: Some("docker compose up -d".to_string()),
                has_dist: dist_index.is_some(),
                dist_index_path: dist_index.map(|p| p.to_string_lossy().to_string()),
                entry_html_path: entry_html.map(|p| p.to_string_lossy().to_string()),
                already_running: false,
            diagnostics: Vec::new(),
            });
        }
        let docroot = if root.join("public/index.php").exists() {
            "public"
        } else {
            "."
        };
        return Ok(ProjectInfo {
            root_path,
            name: dir_name,
            kind: "php".to_string(),
            package_manager: None,
            dev_script: Some("php-server".to_string()),
            scripts: vec!["php-server".to_string()],
            default_url: Some("http://127.0.0.1:8000".to_string()),
            dev_command_label: Some(format!("php -S 127.0.0.1:8000 -t {}", docroot)),
            has_dist: dist_index.is_some(),
            dist_index_path: dist_index.map(|p| p.to_string_lossy().to_string()),
            entry_html_path: entry_html.map(|p| p.to_string_lossy().to_string()),
            already_running: false,
            diagnostics: Vec::new(),
        });
    }

    // 7. Generic Docker Compose web project
    let compose_ports = parse_compose_ports(root);
    if find_compose_file(root).is_some() && !compose_ports.is_empty() {
        return Ok(ProjectInfo {
            root_path,
            name: dir_name,
            kind: "docker".to_string(),
            package_manager: None,
            dev_script: Some("docker-compose".to_string()),
            scripts: vec!["docker-compose".to_string()],
            default_url: Some(format!("http://localhost:{}", compose_ports[0])),
            dev_command_label: Some("docker compose up -d".to_string()),
            has_dist: dist_index.is_some(),
            dist_index_path: dist_index.map(|p| p.to_string_lossy().to_string()),
            entry_html_path: entry_html.map(|p| p.to_string_lossy().to_string()),
            already_running: false,
            diagnostics: Vec::new(),
        });
    }

    // 8. Static HTML/JS/CSS site (served via built-in HTTP server on demand)
    if entry_html.is_some() || dist_index.is_some() {
        return Ok(ProjectInfo {
            root_path,
            name: dir_name,
            kind: "static".to_string(),
            package_manager: None,
            dev_script: Some("static-http".to_string()),
            scripts: vec!["static-http".to_string()],
            default_url: Some("http://127.0.0.1:4173".to_string()),
            dev_command_label: Some("Built-in Static HTTP".to_string()),
            has_dist: dist_index.is_some(),
            dist_index_path: dist_index.map(|p| p.to_string_lossy().to_string()),
            entry_html_path: entry_html.map(|p| p.to_string_lossy().to_string()),
            already_running: false,
            diagnostics: Vec::new(),
        });
    }

    Ok(ProjectInfo {
        root_path,
        name: dir_name,
        kind: "none".to_string(),
        package_manager: None,
        dev_script: None,
        scripts: Vec::new(),
        default_url: None,
        dev_command_label: None,
        has_dist: false,
        dist_index_path: None,
        entry_html_path: None,
        already_running: false,
            diagnostics: Vec::new(),
    })
}

async fn probe_local_http(target_url: &str, timeout_ms: u64) -> bool {
    let Ok(parsed) = url::Url::parse(target_url) else {
        return false;
    };
    let Ok(client) = reqwest::Client::builder()
        .no_proxy()
        .timeout(Duration::from_millis(timeout_ms))
        .build()
    else {
        return false;
    };

    if client.get(target_url).send().await.is_ok() {
        return true;
    }

    if let Some(host) = parsed.host_str() {
        if host == "localhost" {
            let mut ipv4 = parsed.clone();
            if ipv4.set_host(Some("127.0.0.1")).is_ok()
                && client.get(ipv4.as_str()).send().await.is_ok()
            {
                return true;
            }
        } else if host == "127.0.0.1" {
            let mut local = parsed.clone();
            if local.set_host(Some("localhost")).is_ok()
                && client.get(local.as_str()).send().await.is_ok()
            {
                return true;
            }
        }
    }

    false
}

async fn is_local_port_bound(port: u16, timeout_ms: u64) -> bool {
    let dur = Duration::from_millis(timeout_ms);
    let v4 = tokio::time::timeout(
        dur,
        tokio::net::TcpStream::connect(("127.0.0.1", port)),
    )
    .await
    .map(|r| r.is_ok())
    .unwrap_or(false);
    if v4 {
        return true;
    }
    tokio::time::timeout(dur, tokio::net::TcpStream::connect(("::1", port)))
        .await
        .map(|r| r.is_ok())
        .unwrap_or(false)
}

async fn check_docker_daemon_running(docker_exe: &str) -> bool {
    let mut cmd = new_background_command(docker_exe, &["info", "--format", "{{.ServerVersion}}"]);
    cmd.env("PATH", extended_path())
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    tokio::time::timeout(Duration::from_millis(1800), cmd.output())
        .await
        .ok()
        .and_then(|r| r.ok())
        .map(|out| out.status.success())
        .unwrap_or(false)
}

async fn check_python_imports(py_exe: &str, prefix_args: &[String], root: &Path, imports: &str) -> bool {
    let mut args = prefix_args.to_vec();
    args.push("-c".to_string());
    args.push(imports.to_string());
    let mut cmd = new_background_command(py_exe, &args);
    cmd.current_dir(root)
        .env("PATH", extended_path())
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    tokio::time::timeout(Duration::from_millis(1500), cmd.output())
        .await
        .ok()
        .and_then(|r| r.ok())
        .map(|out| out.status.success())
        .unwrap_or(false)
}

async fn check_bundle_gems_ok(bundle_exe: &str, root: &Path) -> bool {
    let mut cmd = new_background_command(bundle_exe, &["check"]);
    cmd.current_dir(root)
        .env("PATH", extended_path())
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    tokio::time::timeout(Duration::from_millis(1800), cmd.output())
        .await
        .ok()
        .and_then(|r| r.ok())
        .map(|out| out.status.success())
        .unwrap_or(false)
}

#[cfg(target_os = "windows")]
fn find_windows_docker_desktop_exe() -> Option<PathBuf> {
    let program_files =
        env::var("ProgramFiles").unwrap_or_else(|_| r"C:\Program Files".to_string());
    let local_appdata = env::var("LOCALAPPDATA").unwrap_or_default();
    let mut candidates = vec![
        PathBuf::from(&program_files).join(r"Docker\Docker\Docker Desktop.exe"),
    ];
    if !local_appdata.is_empty() {
        candidates.push(PathBuf::from(&local_appdata).join(r"Programs\Docker\Docker\Docker Desktop.exe"));
    }
    candidates.into_iter().find(|p| p.is_file())
}

fn has_docker_desktop_app() -> bool {
    #[cfg(target_os = "macos")]
    {
        Path::new("/Applications/Docker.app").exists()
            || Path::new("/Applications/OrbStack.app").exists()
    }
    #[cfg(target_os = "windows")]
    {
        find_windows_docker_desktop_exe().is_some()
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Path::new("/opt/docker-desktop/bin/docker-desktop").is_file()
            || find_executable(&["docker-desktop"]).is_some()
    }
}

fn has_linux_docker_engine_service() -> bool {
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Path::new("/lib/systemd/system/docker.service").is_file()
            || Path::new("/usr/lib/systemd/system/docker.service").is_file()
            || Path::new("/etc/systemd/system/docker.service").is_file()
            || find_executable(&["dockerd"]).is_some()
    }
    #[cfg(not(all(unix, not(target_os = "macos"))))]
    {
        false
    }
}

#[cfg(all(unix, not(target_os = "macos")))]
fn detect_linux_pkg_manager() -> &'static str {
    if find_executable(&["apt-get"]).is_some() {
        "apt"
    } else if find_executable(&["dnf"]).is_some() {
        "dnf"
    } else if find_executable(&["pacman"]).is_some() {
        "pacman"
    } else if find_executable(&["zypper"]).is_some() {
        "zypper"
    } else {
        "unknown"
    }
}

#[allow(dead_code)]
fn linux_install_hint_for_pkg_manager(tool: &str, mgr: &str) -> String {
    match tool {
        "docker" => match mgr {
            "pacman" => "sudo pacman -S --noconfirm docker docker-compose".to_string(),
            _ => "curl -fsSL https://get.docker.com | sh".to_string(),
        },
        "node" => match mgr {
            "dnf" => "sudo dnf install -y nodejs npm".to_string(),
            "pacman" => "sudo pacman -S --noconfirm nodejs npm".to_string(),
            "zypper" => "sudo zypper install -y nodejs npm".to_string(),
            _ => "sudo apt-get update && sudo apt-get install -y nodejs npm".to_string(),
        },
        "php" => match mgr {
            "dnf" => "sudo dnf install -y php php-cli php-mbstring php-xml php-curl unzip".to_string(),
            "pacman" => "sudo pacman -S --noconfirm php unzip".to_string(),
            "zypper" => "sudo zypper install -y php8 php8-cli php8-mbstring php8-curl unzip".to_string(),
            _ => "sudo apt-get update && sudo apt-get install -y php php-cli php-mbstring php-xml php-curl php-zip unzip".to_string(),
        },
        "composer" => match mgr {
            "dnf" => "sudo dnf install -y composer".to_string(),
            "pacman" => "sudo pacman -S --noconfirm composer".to_string(),
            "zypper" => "sudo zypper install -y php-composer2".to_string(),
            _ => "sudo apt-get update && sudo apt-get install -y composer".to_string(),
        },
        "python" => match mgr {
            "dnf" => "sudo dnf install -y python3 python3-pip".to_string(),
            "pacman" => "sudo pacman -S --noconfirm python python-pip".to_string(),
            "zypper" => "sudo zypper install -y python3 python3-pip".to_string(),
            _ => "sudo apt-get update && sudo apt-get install -y python3 python3-venv python3-pip".to_string(),
        },
        "hugo" => match mgr {
            "dnf" => "sudo dnf install -y hugo".to_string(),
            "pacman" => "sudo pacman -S --noconfirm hugo".to_string(),
            "zypper" => "sudo zypper install -y hugo".to_string(),
            _ => "sudo apt-get update && sudo apt-get install -y hugo".to_string(),
        },
        "ruby" => match mgr {
            "dnf" => "sudo dnf install -y ruby ruby-devel gcc make".to_string(),
            "pacman" => "sudo pacman -S --noconfirm ruby base-devel".to_string(),
            "zypper" => "sudo zypper install -y ruby ruby-devel gcc make".to_string(),
            _ => "sudo apt-get update && sudo apt-get install -y ruby-full build-essential".to_string(),
        },
        "bun" => "curl -fsSL https://bun.sh/install | bash".to_string(),
        other => other.to_string(),
    }
}

fn os_install_hint(tool: &str) -> String {
    #[cfg(target_os = "macos")]
    {
        match tool {
            "docker" => "brew install --cask docker".to_string(),
            "node" => "brew install node".to_string(),
            "php" => "brew install php".to_string(),
            "composer" => "brew install composer".to_string(),
            "python" => "brew install python uv".to_string(),
            "hugo" => "brew install hugo".to_string(),
            "ruby" => "brew install ruby".to_string(),
            "bun" => "curl -fsSL https://bun.sh/install | bash".to_string(),
            other => other.to_string(),
        }
    }
    #[cfg(target_os = "windows")]
    {
        match tool {
            "docker" => "winget install -e --id Docker.DockerDesktop".to_string(),
            "node" => "winget install -e --id OpenJS.NodeJS.LTS".to_string(),
            "php" => "winget install -e --id PHP.PHP.8.4".to_string(),
            "composer" => "winget install -e --id Composer.Composer".to_string(),
            "python" => "winget install -e --id Python.Python.3.12".to_string(),
            "hugo" => "winget install -e --id Hugo.Hugo.Extended".to_string(),
            "ruby" => "winget install -e --id RubyInstallerTeam.RubyWithDevKit.3.3".to_string(),
            "bun" => "powershell -NoProfile -ExecutionPolicy Bypass -Command \"irm https://bun.sh/install.ps1 | iex\"".to_string(),
            other => other.to_string(),
        }
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        linux_install_hint_for_pkg_manager(tool, detect_linux_pkg_manager())
    }
}

pub(crate) async fn diagnose_project(info: &mut ProjectInfo) {
    info.diagnostics.clear();
    if info.kind == "none" || info.kind == "static" || info.already_running {
        return;
    }

    let root = Path::new(&info.root_path);
    let mut diags: Vec<ProjectDiagnostic> = Vec::new();

    let uses_docker =
        info.kind == "docker" || info.dev_script.as_deref() == Some("docker-compose");

    if uses_docker {
        match find_executable(&["docker"]) {
            None => {
                let has_app = has_docker_desktop_app();
                let install_cmd = os_install_hint("docker");
                diags.push(ProjectDiagnostic {
                    id: "missing-docker".to_string(),
                    severity: "error".to_string(),
                    title_ja: "Docker がインストールされていません".to_string(),
                    title_en: "Docker is not installed".to_string(),
                    description_ja: if has_app {
                        "Docker アプリは見つかりましたが、docker CLI がまだ有効化されていません。「Docker を起動」または手動で Docker Desktop を起動して初期設定を完了してください（初回起動は 10〜30 秒かかる場合があります）。".to_string()
                    } else {
                        "このプロジェクトは Docker Compose でアプリやデータベースを起動します。「Terminal で実行」または公式サイトから Docker Desktop を導入してください（Windows では WSL 2 の有効化、初回コンテナ起動時はイメージ取得に数分かかる場合があります）。".to_string()
                    },
                    description_en: if has_app {
                        "Docker app was found, but the docker CLI is not ready yet. Launch Docker Desktop to finish initialization (startup can take 10–30s).".to_string()
                    } else {
                        "This project uses Docker Compose to run its app and services. Install Docker Desktop via Terminal or the official download page (Windows requires WSL 2; first image pull may take a few minutes).".to_string()
                    },
                    command_preview: if has_app {
                        None
                    } else {
                        Some(install_cmd.clone())
                    },
                    in_app_action: if has_app {
                        Some("launch-docker".to_string())
                    } else {
                        None
                    },
                    action_target: None,
                    in_app_label_ja: if has_app {
                        Some("Docker を起動".to_string())
                    } else {
                        None
                    },
                    in_app_label_en: if has_app {
                        Some("Start Docker".to_string())
                    } else {
                        None
                    },
                    terminal_command: if has_app {
                        None
                    } else {
                        Some(install_cmd)
                    },
                    docs_url: Some("https://www.docker.com/products/docker-desktop/".to_string()),
                });
            }
            Some(docker_exe) => {
                if !check_docker_daemon_running(&docker_exe).await {
                    let has_app = has_docker_desktop_app();
                    let has_linux_engine = !has_app && has_linux_docker_engine_service();
                    diags.push(ProjectDiagnostic {
                        id: "docker-not-running".to_string(),
                        severity: "error".to_string(),
                        title_ja: "Docker が起動していません".to_string(),
                        title_en: "Docker daemon is not running".to_string(),
                        description_ja: if has_linux_engine {
                            "Docker コマンドはインストール済みですが、バックグラウンドの Docker Engine（docker.service）が停止しているか権限がありません。サービスを起動してください（権限エラーが出る場合は `sudo usermod -aG docker $USER` 後に再ログインが必要です）。".to_string()
                        } else {
                            "Docker コマンドはインストール済みですが、バックグラウンドのエンジンが停止中です。「Docker を起動」または Docker Desktop を起動し、10〜20秒ほど待ってから「環境を再チェック」を押してください。".to_string()
                        },
                        description_en: if has_linux_engine {
                            "Docker CLI is installed, but Docker Engine (docker.service) is stopped or inaccessible. Start the service (if permission is denied, run `sudo usermod -aG docker $USER` and re-login).".to_string()
                        } else {
                            "Docker CLI is available, but the Docker daemon is stopped. Launch Docker Desktop, wait 10–20 seconds for it to become ready, then click Re-check Environment.".to_string()
                        },
                        command_preview: if has_linux_engine {
                            Some("sudo systemctl start docker".to_string())
                        } else {
                            None
                        },
                        in_app_action: if has_app || has_linux_engine {
                            Some("launch-docker".to_string())
                        } else {
                            None
                        },
                        action_target: None,
                        in_app_label_ja: if has_app || has_linux_engine {
                            Some("Docker を起動".to_string())
                        } else {
                            None
                        },
                        in_app_label_en: if has_app || has_linux_engine {
                            Some("Start Docker".to_string())
                        } else {
                            None
                        },
                        terminal_command: if has_linux_engine {
                            Some("sudo systemctl start docker".to_string())
                        } else {
                            None
                        },
                        docs_url: if has_app || has_linux_engine {
                            None
                        } else {
                            Some("https://www.docker.com/products/docker-desktop/".to_string())
                        },
                    });
                }
            }
        }
        info.diagnostics = diags;
        return;
    }

    // Node.js / Package Manager / node_modules diagnostics
    let laravel_uses_vite = info.kind == "laravel"
        && root.join("package.json").is_file()
        && has_vite_config(root)
        && !root.join("public/build/manifest.json").is_file();

    if info.package_manager.is_some() || laravel_uses_vite {
        let pm = info
            .package_manager
            .as_deref()
            .unwrap_or_else(|| detect_package_manager(root));

        if find_executable(&["node"]).is_none() {
            let install_cmd = os_install_hint("node");
            diags.push(ProjectDiagnostic {
                id: "missing-node".to_string(),
                severity: if info.kind == "laravel" {
                    "warning".to_string()
                } else {
                    "error".to_string()
                },
                title_ja: "Node.js がインストールされていません".to_string(),
                title_en: "Node.js is not installed".to_string(),
                description_ja: if info.kind == "laravel" {
                    "この Laravel プロジェクトは Vite で CSS/JS をビルドしています（`public/build/manifest.json` がまだありません）。Node.js 20 LTS 以上を導入すると開発時の自動ビルド（HMR）も同時起動できます（「Terminal で実行」または公式サイトから導入可能）。".to_string()
                } else {
                    "このプロジェクトの開発サーバーやパッケージ管理を動かすには Node.js（20 LTS 以上推奨）が必要です。「Terminal で実行」または公式サイトのインストーラーから導入し、完了後に「環境を再チェック」を押してください（Linux の apt 版が古い場合は公式サイトまたは nvm を推奨）。".to_string()
                },
                description_en: if info.kind == "laravel" {
                    "This Laravel project uses Vite for frontend assets (and `public/build/manifest.json` is not built yet). Install Node.js 20 LTS+ via Terminal or the official website to run Vite HMR alongside PHP.".to_string()
                } else {
                    "Node.js (20 LTS+ recommended) is required to install packages and start this project's dev server. Install it via \"Run in Terminal\" or the official installer, then click Re-check Environment (if a Linux distro package is too old, use the official installer or nvm).".to_string()
                },
                command_preview: Some(install_cmd.clone()),
                in_app_action: None,
                action_target: None,
                in_app_label_ja: None,
                in_app_label_en: None,
                terminal_command: Some(install_cmd),
                docs_url: Some("https://nodejs.org/".to_string()),
            });
        } else if find_executable(&[pm]).is_none() {
            let has_npm = find_executable(&["npm"]).is_some();
            let can_install_via_npm = has_npm && matches!(pm, "pnpm" | "yarn");
            let bun_cmd = os_install_hint("bun");
            let missing_npm_for_pm = !has_npm && matches!(pm, "npm" | "pnpm" | "yarn");
            diags.push(ProjectDiagnostic {
                id: "missing-pm".to_string(),
                severity: if info.kind == "laravel" {
                    "warning".to_string()
                } else {
                    "error".to_string()
                },
                title_ja: format!("パッケージマネージャー ({}) が見つかりません", pm),
                title_en: format!("Package manager ({}) not found", pm),
                description_ja: if pm == "bun" {
                    "このプロジェクトは Bun（bun.lock）で管理されています。下のコマンドまたは「Terminal で実行」で Bun を導入してください（Windows では PowerShell 経由で導入されます）。".to_string()
                } else if can_install_via_npm {
                    format!(
                        "このプロジェクトは {} で管理されています（ロックファイルを検出）。「{} を自動インストール」または `corepack enable` で導入できます。",
                        pm, pm
                    )
                } else if missing_npm_for_pm {
                    format!(
                        "このプロジェクトは {} で管理されていますが、npm が PATH 上に見つかりません。Node.js（npm 同梱）を再インストールするか公式サイトから導入してください。",
                        pm
                    )
                } else {
                    format!(
                        "このプロジェクトは {} で管理されています。先に {} をインストールしてください。",
                        pm, pm
                    )
                },
                description_en: if pm == "bun" {
                    "This project uses Bun (bun.lock detected). Install Bun using the command below or \"Run in Terminal\" (uses PowerShell on Windows).".to_string()
                } else if can_install_via_npm {
                    format!(
                        "This project uses {} (lockfile detected). Click \"Install {}\" below or enable Corepack (`corepack enable`).",
                        pm, pm
                    )
                } else if missing_npm_for_pm {
                    format!(
                        "This project uses {}, but npm was not found on PATH. Reinstall Node.js (with npm) from the official download page.",
                        pm
                    )
                } else {
                    format!(
                        "This project uses {}, which is not currently installed on PATH.",
                        pm
                    )
                },
                command_preview: if can_install_via_npm {
                    Some(format!("npm install -g {}", pm))
                } else if pm == "bun" {
                    Some(bun_cmd.clone())
                } else {
                    None
                },
                in_app_action: if can_install_via_npm {
                    Some("install-pm".to_string())
                } else {
                    None
                },
                action_target: Some(pm.to_string()),
                in_app_label_ja: if can_install_via_npm {
                    Some(format!("{} を自動インストール", pm))
                } else {
                    None
                },
                in_app_label_en: if can_install_via_npm {
                    Some(format!("Install {}", pm))
                } else {
                    None
                },
                terminal_command: if can_install_via_npm {
                    Some(format!("npm install -g {}", pm))
                } else if pm == "bun" {
                    Some(bun_cmd)
                } else {
                    None
                },
                docs_url: if pm == "bun" {
                    Some("https://bun.sh/".to_string())
                } else {
                    Some("https://nodejs.org/".to_string())
                },
            });
        } else if root.join("package.json").is_file() && !root.join("node_modules").is_dir() {
            diags.push(ProjectDiagnostic {
                id: "missing-node-modules".to_string(),
                severity: if info.kind == "laravel" {
                    "warning".to_string()
                } else {
                    "error".to_string()
                },
                title_ja: "依存パッケージ（node_modules）が未インストールです".to_string(),
                title_en: "Dependencies (node_modules) are not installed".to_string(),
                description_ja: if info.kind == "laravel" {
                    format!(
                        "フロントエンド（Vite）用の JavaScript ライブラリが未導入です。「{} install を実行」を押すと `node_modules/` を作成し、PHP と同時に Vite も起動できます（所要時間: 数十秒〜数分）。",
                        pm
                    )
                } else {
                    format!(
                        "プロジェクトを最初に開いたときや新しい PC では、最初にライブラリ一式を `node_modules/` へダウンロードする必要があります。「{} install を実行」で自動導入できます（ネットワーク状況により数十秒〜数分かかります）。",
                        pm
                    )
                },
                description_en: if info.kind == "laravel" {
                    format!(
                        "Frontend (Vite) JavaScript packages are not installed in `node_modules/` yet. Click \"Run {} install\" to enable Vite HMR alongside PHP.",
                        pm
                    )
                } else {
                    format!(
                        "JavaScript dependencies in package.json are not installed in `node_modules/` yet. Click \"Run {} install\" to download them automatically (may take a minute).",
                        pm
                    )
                },
                command_preview: Some(format!("{} install", pm)),
                in_app_action: Some("install-node-deps".to_string()),
                action_target: Some(pm.to_string()),
                in_app_label_ja: Some(format!("{} install を実行", pm)),
                in_app_label_en: Some(format!("Run {} install", pm)),
                terminal_command: Some(format!("{} install", pm)),
                docs_url: None,
            });
        }
    }

    // PHP / Laravel / WordPress (local PHP server)
    if matches!(info.kind.as_str(), "laravel" | "php" | "wordpress") {
        if find_executable(&["php"]).is_none() {
            let install_cmd = os_install_hint("php");
            diags.push(ProjectDiagnostic {
                id: "missing-php".to_string(),
                severity: "error".to_string(),
                title_ja: "PHP がインストールされていません".to_string(),
                title_en: "PHP is not installed".to_string(),
                description_ja: "このプロジェクトをローカルサーバーで動かすには PHP（8.1 以上推奨・mbstring / xml / curl / pdo 拡張含む）が必要です。「Terminal で実行」または公式サイトから導入するか、Docker Compose 環境を用意してください。".to_string(),
                description_en: "PHP (8.1+ recommended with mbstring/xml/curl/pdo extensions) is required to run the local server. Install via \"Run in Terminal\" or the official download page, or add a Docker Compose setup.".to_string(),
                command_preview: Some(install_cmd.clone()),
                in_app_action: None,
                action_target: None,
                in_app_label_ja: None,
                in_app_label_en: None,
                terminal_command: Some(install_cmd),
                docs_url: Some("https://www.php.net/downloads.php".to_string()),
            });
        }

        if root.join("composer.json").is_file() && !root.join("vendor").is_dir() {
            let has_composer =
                find_executable(&["composer"]).is_some() || root.join("composer.phar").is_file();
            if has_composer {
                diags.push(ProjectDiagnostic {
                    id: "missing-composer-vendor".to_string(),
                    severity: "error".to_string(),
                    title_ja: "PHP パッケージ（vendor）が未インストールです".to_string(),
                    title_en: "PHP dependencies (vendor) are not installed".to_string(),
                    description_ja: "composer.json に書かれた PHP ライブラリ（vendor フォルダー）がまだ入っていません。「composer install を実行」で自動導入できます（失敗する場合は PHP 拡張の curl / mbstring / xml / zip や PHP バージョン要件をログで確認してください）。".to_string(),
                    description_en: "PHP packages defined in composer.json are not installed in vendor/ yet. Click \"Run composer install\" below (if it fails, check logs for missing PHP extensions such as curl, mbstring, xml, or zip).".to_string(),
                    command_preview: Some("composer install".to_string()),
                    in_app_action: Some("install-composer-deps".to_string()),
                    action_target: None,
                    in_app_label_ja: Some("composer install を実行".to_string()),
                    in_app_label_en: Some("Run composer install".to_string()),
                    terminal_command: Some("composer install".to_string()),
                    docs_url: None,
                });
            } else {
                let install_cmd = os_install_hint("composer");
                diags.push(ProjectDiagnostic {
                    id: "missing-composer".to_string(),
                    severity: "error".to_string(),
                    title_ja: "Composer がインストールされていません".to_string(),
                    title_en: "Composer is not installed".to_string(),
                    description_ja: "vendor フォルダーを作成する PHP パッケージ管理ツール「Composer」が見つかりません。「Terminal で実行」または公式サイトから導入し、続けて `composer install` を実行してください。".to_string(),
                    description_en: "Composer (the PHP package manager used to populate vendor/) was not found on PATH. Install it via Terminal or the official download page, then run `composer install`.".to_string(),
                    command_preview: Some(install_cmd.clone()),
                    in_app_action: None,
                    action_target: None,
                    in_app_label_ja: None,
                    in_app_label_en: None,
                    terminal_command: Some(install_cmd),
                    docs_url: Some("https://getcomposer.org/download/".to_string()),
                });
            }
        }

        if info.kind == "laravel" && !root.join(".env").is_file() && root.join(".env.example").is_file() {
            let env_cmd = if cfg!(target_os = "windows") {
                "copy .env.example .env && php artisan key:generate"
            } else {
                "cp .env.example .env && php artisan key:generate"
            };
            diags.push(ProjectDiagnostic {
                id: "missing-laravel-env".to_string(),
                severity: "warning".to_string(),
                title_ja: ".env 設定ファイルが未作成です".to_string(),
                title_en: ".env configuration file is missing".to_string(),
                description_ja: "Laravel を動かすには .env ファイルが必要です。「.env を自動作成」で .env.example をコピーし暗号化キー（APP_KEY）を生成できます（その後、必要に応じて .env の DB_CONNECTION 設定や `php artisan migrate` を実行してください）。".to_string(),
                description_en: "Laravel requires a .env file. Click \"Create .env & Key\" to copy .env.example and generate APP_KEY (configure DB_CONNECTION in .env and run `php artisan migrate` if your app uses a database).".to_string(),
                command_preview: Some(env_cmd.to_string()),
                in_app_action: Some("setup-laravel-env".to_string()),
                action_target: None,
                in_app_label_ja: Some(".env を自動作成".to_string()),
                in_app_label_en: Some("Create .env & Key".to_string()),
                terminal_command: Some(env_cmd.to_string()),
                docs_url: None,
            });
        } else if info.kind == "laravel" && root.join(".env").is_file() {
            if let Ok(env_raw) = fs::read_to_string(root.join(".env")) {
                let uses_sqlite = env_raw.lines().any(|line| {
                    let t = line.trim();
                    !t.starts_with('#') && t.starts_with("DB_CONNECTION=") && t.contains("sqlite")
                });
                let uses_memory = env_raw.lines().any(|line| {
                    let t = line.trim();
                    !t.starts_with('#') && t.starts_with("DB_DATABASE=") && t.contains(":memory:")
                });
                let sqlite_path = root.join("database/database.sqlite");
                if uses_sqlite && !uses_memory && root.join("database").is_dir() && !sqlite_path.is_file() {
                    let sqlite_cmd = if cfg!(target_os = "windows") {
                        "type nul > database\\database.sqlite && php artisan migrate"
                    } else {
                        "touch database/database.sqlite && php artisan migrate"
                    };
                    diags.push(ProjectDiagnostic {
                        id: "missing-laravel-sqlite".to_string(),
                        severity: "info".to_string(),
                        title_ja: "SQLite データベースファイルが未作成の可能性があります".to_string(),
                        title_en: "SQLite database file may need to be created".to_string(),
                        description_ja: ".env で SQLite が指定されていますが `database/database.sqlite` がまだ存在しません。起動後に DB エラーが出る場合は Terminal で SQLite ファイルを作成しマイグレーションを実行してください。".to_string(),
                        description_en: ".env sets DB_CONNECTION=sqlite, but `database/database.sqlite` does not exist yet. If the app shows a database error, create it and run migrations in Terminal.".to_string(),
                        command_preview: Some(sqlite_cmd.to_string()),
                        in_app_action: None,
                        action_target: None,
                        in_app_label_ja: None,
                        in_app_label_en: None,
                        terminal_command: Some(sqlite_cmd.to_string()),
                        docs_url: None,
                    });
                }
            }
        }

        if info.kind == "wordpress" {
            if !root.join("wp-config.php").is_file() && root.join("wp-config-sample.php").is_file() {
                diags.push(ProjectDiagnostic {
                    id: "missing-wp-config".to_string(),
                    severity: "warning".to_string(),
                    title_ja: "wp-config.php が未作成です".to_string(),
                    title_en: "wp-config.php is missing".to_string(),
                    description_ja: "`wp-config-sample.php` は見つかりましたが `wp-config.php` がまだありません。コピーして DB_NAME / DB_USER / DB_PASSWORD / DB_HOST を設定するか、サーバー起動後にブラウザ上のセットアップ画面で設定してください。".to_string(),
                    description_en: "`wp-config-sample.php` exists, but `wp-config.php` has not been created yet. Copy it and fill in DB_NAME / DB_USER / DB_PASSWORD / DB_HOST, or complete the browser installer after starting the server.".to_string(),
                    command_preview: None,
                    in_app_action: None,
                    action_target: None,
                    in_app_label_ja: None,
                    in_app_label_en: None,
                    terminal_command: None,
                    docs_url: None,
                });
            }
            diags.push(ProjectDiagnostic {
                id: "wordpress-db-info".to_string(),
                severity: "info".to_string(),
                title_ja: "WordPress にはデータベース接続が必要です".to_string(),
                title_en: "WordPress requires a database connection".to_string(),
                description_ja: "MAMP / Local / MySQL / MariaDB 等のデータベースが起動しており、`wp-config.php` の DB_HOST・DB_NAME・ユーザー名・パスワードが一致している必要があります（Docker Compose 構成を追加すると DB も自動起動できます）。".to_string(),
                description_en: "Ensure MySQL/MariaDB (e.g. MAMP, Local, or Docker) is running and matches DB_HOST / DB_NAME / credentials in `wp-config.php`.".to_string(),
                command_preview: None,
                in_app_action: None,
                action_target: None,
                in_app_label_ja: None,
                in_app_label_en: None,
                terminal_command: None,
                docs_url: Some("https://localwp.com/".to_string()),
            });
        }
    }

    // Python Web (Django, FastAPI, Flask, Streamlit) & MkDocs
    if matches!(
        info.kind.as_str(),
        "django" | "fastapi" | "flask" | "streamlit" | "mkdocs"
    ) {
        let mkdocs_direct_bin = info.kind == "mkdocs"
            && (root.join(".venv/bin/mkdocs").is_file()
                || root.join(".venv/Scripts/mkdocs.exe").is_file()
                || root.join("venv/bin/mkdocs").is_file()
                || root.join("venv/Scripts/mkdocs.exe").is_file()
                || find_executable(&["mkdocs"]).is_some());

        if !mkdocs_direct_bin {
            match find_python_runner(root) {
                None => {
                    let install_cmd = os_install_hint("python");
                    diags.push(ProjectDiagnostic {
                        id: "missing-python".to_string(),
                        severity: "error".to_string(),
                        title_ja: "Python 3 がインストールされていません".to_string(),
                        title_en: "Python 3 is not installed".to_string(),
                        description_ja: "このプロジェクトを実行するには Python 3（3.10 以上推奨、または uv）が必要です。「Terminal で実行」または公式サイトから導入してください（Windows では Microsoft Store のダミーエイリアスではなく公式インストーラー / winget を推奨、Linux Ubuntu/Debian では `python3-venv` も必要です）。".to_string(),
                        description_en: "Python 3 (3.10+ recommended, or uv) is required to run this project. Install via \"Run in Terminal\" or the official download page (on Windows, avoid the empty Microsoft Store python.exe alias and use winget/official installer; Debian/Ubuntu also needs `python3-venv`).".to_string(),
                        command_preview: Some(install_cmd.clone()),
                        in_app_action: None,
                        action_target: None,
                        in_app_label_ja: None,
                        in_app_label_en: None,
                        terminal_command: Some(install_cmd),
                        docs_url: Some("https://www.python.org/downloads/".to_string()),
                    });
                }
                Some((py_exe, prefix_args)) => {
                    let is_uv_without_venv = prefix_args.first().map(|s| s.as_str()) == Some("run")
                        && !root.join(".venv").is_dir()
                        && !root.join("venv").is_dir();

                    let imports_ok = if is_uv_without_venv {
                        false
                    } else {
                        let import_stmt = match info.kind.as_str() {
                            "django" => "import django",
                            "fastapi" => "import fastapi, uvicorn",
                            "flask" => "import flask",
                            "streamlit" => "import streamlit",
                            "mkdocs" => "import mkdocs",
                            _ => "",
                        };
                        if import_stmt.is_empty() {
                            true
                        } else {
                            check_python_imports(&py_exe, &prefix_args, root, import_stmt).await
                        }
                    };

                    if !imports_ok {
                        let has_uv = find_executable(&["uv"]).is_some()
                            && (root.join("pyproject.toml").is_file()
                                || root.join("uv.lock").is_file());
                        let py_cmd = if cfg!(target_os = "windows") {
                            "python"
                        } else {
                            "python3"
                        };
                        let pip_cmd = if cfg!(target_os = "windows") {
                            r".venv\Scripts\pip"
                        } else {
                            ".venv/bin/pip"
                        };
                        let preview = if has_uv {
                            "uv sync".to_string()
                        } else if root.join("requirements.txt").is_file() {
                            format!("{} -m venv .venv && {} install -r requirements.txt", py_cmd, pip_cmd)
                        } else if root.join("pyproject.toml").is_file() {
                            format!("{} -m venv .venv && {} install -e .", py_cmd, pip_cmd)
                        } else {
                            let pkg = match info.kind.as_str() {
                                "fastapi" => "fastapi uvicorn",
                                other => other,
                            };
                            format!("{} -m venv .venv && {} install {}", py_cmd, pip_cmd, pkg)
                        };

                        diags.push(ProjectDiagnostic {
                            id: "missing-python-deps".to_string(),
                            severity: "error".to_string(),
                            title_ja: "Python パッケージ（仮想環境 .venv）が不足しています".to_string(),
                            title_en: "Python packages / virtual environment (.venv) missing".to_string(),
                            description_ja: if has_uv {
                                "このプロジェクトに必要な Python ライブラリが見つかりません。「仮想環境を作成して導入」を押すと `uv sync` でプロジェクト直下に `.venv/` を作成し依存関係を導入します（PC 本体の Python 環境は汚しません）。".to_string()
                            } else {
                                "このプロジェクトに必要な Python ライブラリが見つかりません。「仮想環境を作成して導入」を押すとプロジェクト直下に専用仮想環境（`.venv/`）を作成しパッケージをインストールします（Linux で `ensurepip` エラーが出る場合は `python3-venv` パッケージを追加してください）。".to_string()
                            },
                            description_en: if has_uv {
                                "Required Python libraries are not installed yet. Click \"Create .venv & Install\" to run `uv sync` and isolate dependencies inside `.venv/`.".to_string()
                            } else {
                                "Required Python libraries are not installed yet. Click \"Create .venv & Install\" to create a project-local `.venv/` and install dependencies without affecting system Python (on Debian/Ubuntu, install `python3-venv` if venv creation fails).".to_string()
                            },
                            command_preview: Some(preview.clone()),
                            in_app_action: Some("install-python-deps".to_string()),
                            action_target: Some(info.kind.clone()),
                            in_app_label_ja: Some("仮想環境を作成して導入".to_string()),
                            in_app_label_en: Some("Create .venv & Install".to_string()),
                            terminal_command: Some(preview),
                            docs_url: None,
                        });
                    }
                }
            }
        }
    }

    // Hugo
    if info.kind == "hugo" && find_executable(&["hugo"]).is_none() {
        let install_cmd = os_install_hint("hugo");
        diags.push(ProjectDiagnostic {
            id: "missing-hugo".to_string(),
            severity: "error".to_string(),
            title_ja: "Hugo がインストールされていません".to_string(),
            title_en: "Hugo is not installed".to_string(),
            description_ja: "Hugo サイトをプレビューするには hugo コマンドの導入が必要です。SCSS/Sass を使うテーマでは Hugo Extended 版が推奨されます（Linux の distro 版が古い場合は公式サイトのバイナリ / Homebrew を推奨）。".to_string(),
            description_en: "Hugo CLI is required to serve and preview this site. Hugo Extended is recommended for themes using SCSS/Sass (if a Linux distro package is outdated, download the Extended binary from the official site).".to_string(),
            command_preview: Some(install_cmd.clone()),
            in_app_action: None,
            action_target: None,
            in_app_label_ja: None,
            in_app_label_en: None,
            terminal_command: Some(install_cmd),
            docs_url: Some("https://gohugo.io/installation/".to_string()),
        });
    }

    // Jekyll
    if info.kind == "jekyll" {
        let ruby = find_executable(&["ruby"]);
        let bundle = find_executable(&["bundle"]);
        let jekyll = find_executable(&["jekyll"]);

        if ruby.is_none() {
            let install_cmd = os_install_hint("ruby");
            diags.push(ProjectDiagnostic {
                id: "missing-ruby".to_string(),
                severity: "error".to_string(),
                title_ja: "Ruby がインストールされていません".to_string(),
                title_en: "Ruby is not installed".to_string(),
                description_ja: "Jekyll サイトを起動するには Ruby（3.0 以上推奨）と Bundler / Jekyll が必要です。「Terminal で実行」または公式サイトから Ruby を導入してください。".to_string(),
                description_en: "Ruby (3.0+ recommended) is required before installing Bundler and Jekyll. Install Ruby via \"Run in Terminal\" or the official installation guide.".to_string(),
                command_preview: Some(install_cmd.clone()),
                in_app_action: None,
                action_target: None,
                in_app_label_ja: None,
                in_app_label_en: None,
                terminal_command: Some(install_cmd),
                docs_url: Some("https://jekyllrb.com/docs/installation/".to_string()),
            });
        } else if bundle.is_none() && jekyll.is_none() {
            let is_apple_system_ruby = cfg!(target_os = "macos")
                && ruby.as_deref() == Some("/usr/bin/ruby");
            let gem_cmd = if is_apple_system_ruby {
                "gem install --user-install bundler jekyll".to_string()
            } else {
                "gem install bundler jekyll".to_string()
            };
            diags.push(ProjectDiagnostic {
                id: "missing-jekyll".to_string(),
                severity: "error".to_string(),
                title_ja: "Bundler / Jekyll が見つかりません".to_string(),
                title_en: "Bundler / Jekyll is not installed".to_string(),
                description_ja: if is_apple_system_ruby {
                    "macOS 標準の `/usr/bin/ruby` は書き込み保護されており通常の `gem install` が権限エラーになるため、`--user-install` または Homebrew 版 Ruby（`brew install ruby`）での導入を推奨します。".to_string()
                } else {
                    "Ruby は見つかりましたが、Bundler / Jekyll がまだインストールされていません。「Terminal で実行」から gem を導入してください。".to_string()
                },
                description_en: if is_apple_system_ruby {
                    "Apple's built-in `/usr/bin/ruby` is system-protected and rejects global `gem install`. Use `--user-install` or install Homebrew Ruby (`brew install ruby`).".to_string()
                } else {
                    "Ruby is installed, but Bundler / Jekyll was not found on PATH. Run the gem install command in Terminal.".to_string()
                },
                command_preview: Some(gem_cmd.clone()),
                in_app_action: None,
                action_target: None,
                in_app_label_ja: None,
                in_app_label_en: None,
                terminal_command: Some(gem_cmd),
                docs_url: Some("https://jekyllrb.com/docs/installation/".to_string()),
            });
        } else if root.join("Gemfile").is_file() {
            if let Some(bundle_exe) = bundle {
                if !check_bundle_gems_ok(&bundle_exe, root).await {
                    diags.push(ProjectDiagnostic {
                        id: "missing-jekyll-gems".to_string(),
                        severity: "error".to_string(),
                        title_ja: "Ruby パッケージ（Gem）が未インストールです".to_string(),
                        title_en: "Ruby gems in Gemfile are not installed".to_string(),
                        description_ja: "Gemfile に記載されたライブラリをインストールするとサイトを起動できます。「bundle install を実行」を押してください（ネイティブ拡張のビルドに C コンパイラが必要な場合があります）。".to_string(),
                        description_en: "Install required Ruby gems listed in Gemfile before starting Jekyll (some gems with native extensions may require C build tools).".to_string(),
                        command_preview: Some("bundle install".to_string()),
                        in_app_action: Some("install-ruby-gems".to_string()),
                        action_target: None,
                        in_app_label_ja: Some("bundle install を実行".to_string()),
                        in_app_label_en: Some("Run bundle install".to_string()),
                        terminal_command: Some("bundle install".to_string()),
                        docs_url: None,
                    });
                }
            }
        }
    }

    // Generic .env template hint for Node / Python Web projects
    if !matches!(
        info.kind.as_str(),
        "laravel" | "php" | "wordpress" | "static" | "none"
    ) {
        let missing_env_from_example = root.join(".env.example").is_file()
            && !root.join(".env").is_file()
            && !root.join(".env.local").is_file();
        let missing_local_from_example = root.join(".env.local.example").is_file()
            && !root.join(".env.local").is_file();
        if missing_env_from_example || missing_local_from_example {
            let (src_name, dst_name) = if missing_local_from_example {
                (".env.local.example", ".env.local")
            } else {
                (".env.example", ".env")
            };
            diags.push(ProjectDiagnostic {
                id: "missing-env-example-hint".to_string(),
                severity: "info".to_string(),
                title_ja: format!("環境変数テンプレート（{}）が見つかりました", src_name),
                title_en: format!("Environment variable template ({}) detected", src_name),
                description_ja: format!(
                    "このプロジェクトには `{}` がありますが `{}` は未作成です。API キーやデータベース接続先が必要なアプリの場合は、コピーして値を設定してください（不要な場合はこのまま起動できます）。",
                    src_name, dst_name
                ),
                description_en: format!(
                    "`{}` exists without `{}`. If this app requires API keys or database URLs, copy it to `{}` and fill in your values (optional if defaults work).",
                    src_name, dst_name, dst_name
                ),
                command_preview: Some(if cfg!(target_os = "windows") {
                    format!("copy {} {}", src_name, dst_name)
                } else {
                    format!("cp {} {}", src_name, dst_name)
                }),
                in_app_action: None,
                action_target: None,
                in_app_label_ja: None,
                in_app_label_en: None,
                terminal_command: None,
                docs_url: None,
            });
        }
    }

    info.diagnostics = diags;
}

async fn finalize_project_probe(info: &mut ProjectInfo) {
    if info.kind == "static" || info.kind == "none" {
        return;
    }
    if info.kind == "laravel" {
        let candidates = laravel_candidate_urls(Path::new(&info.root_path));
        for url in candidates {
            if probe_local_http(&url, 750).await {
                info.already_running = true;
                info.default_url = Some(url);
                return;
            }
        }
        diagnose_project(info).await;
        return;
    }
    if let Some(ref url) = info.default_url {
        if probe_local_http(url, 750).await {
            info.already_running = true;
            return;
        }
    }
    for port in parse_compose_ports(Path::new(&info.root_path)) {
        let url = format!("http://localhost:{}", port);
        if probe_local_http(&url, 750).await {
            info.already_running = true;
            info.default_url = Some(url);
            return;
        }
    }
    diagnose_project(info).await;
}

fn kind_priority(kind: &str) -> u8 {
    match kind {
        "none" => 0,
        "static" => 1,
        _ => 2,
    }
}

fn find_monorepo_subproject(root: &Path) -> Option<ProjectInfo> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    let Ok(entries) = fs::read_dir(root) else {
        return None;
    };

    for entry in entries.flatten() {
        let p = entry.path();
        if !p.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.')
            || matches!(
                name.as_str(),
                "node_modules" | "target" | "dist" | "build" | "vendor" | ".venv" | "venv"
            )
        {
            continue;
        }
        candidates.push(p.clone());

        if matches!(
            name.as_str(),
            "apps" | "packages" | "services" | "sites" | "examples" | "frontend" | "backend"
        ) {
            if let Ok(sub_entries) = fs::read_dir(&p) {
                for sub in sub_entries.flatten() {
                    let sp = sub.path();
                    if sp.is_dir() {
                        let sname = sub.file_name().to_string_lossy().to_string();
                        if !sname.starts_with('.') && sname != "node_modules" && sname != "target" {
                            candidates.push(sp);
                        }
                    }
                }
            }
        }
    }

    candidates.sort();
    let mut best: Option<ProjectInfo> = None;
    for dir in candidates {
        if let Ok(info) = inspect_root_dir(&dir) {
            let score = kind_priority(&info.kind);
            if score == 0 {
                continue;
            }
            let replace = match &best {
                None => true,
                Some(prev) => score > kind_priority(&prev.kind),
            };
            if replace {
                best = Some(info);
                if score >= 2 {
                    break;
                }
            }
        }
    }
    best
}

#[tauri::command]
pub async fn inspect_workspace_project(root_path: String) -> Result<ProjectInfo, String> {
    let root = Path::new(&root_path);
    let mut info = inspect_root_dir(root)?;
    if info.kind == "none" {
        if let Some(sub) = find_monorepo_subproject(root) {
            info = sub;
        }
    }
    finalize_project_probe(&mut info).await;
    Ok(info)
}

#[tauri::command]
pub async fn inspect_project_for_path(path: String) -> Result<ProjectInfo, String> {
    let target = PathBuf::from(&path);
    let start_dir = if target.is_dir() {
        target
    } else {
        target
            .parent()
            .map(|p| p.to_path_buf())
            .ok_or_else(|| "Invalid path".to_string())?
    };

    let mut chosen_dir = start_dir.clone();
    let mut cur = Some(start_dir.as_path());
    for _ in 0..10 {
        let Some(dir) = cur else { break };
        if dir.join("artisan").is_file()
            || is_wordpress_project(dir)
            || is_mkdocs_project(dir)
            || is_hugo_project(dir)
            || is_jekyll_project(dir)
            || dir.join("package.json").exists()
            || has_vite_config(dir)
            || has_next_config(dir)
            || has_astro_config(dir)
            || has_nuxt_config(dir)
            || dir.join("manage.py").is_file()
            || dir.join("pyproject.toml").is_file()
            || dir.join("requirements.txt").is_file()
            || dir.join("composer.json").exists()
            || dir.join("index.php").exists()
            || find_compose_file(dir).is_some()
        {
            chosen_dir = dir.to_path_buf();
            break;
        }
        cur = dir.parent();
    }

    let mut info = inspect_root_dir(&chosen_dir)?;
    finalize_project_probe(&mut info).await;
    Ok(info)
}

fn strip_ansi(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\x1b' {
            if matches!(chars.peek(), Some('[')) {
                chars.next();
                for nc in chars.by_ref() {
                    if ('@'..='~').contains(&nc) {
                        break;
                    }
                }
            }
            continue;
        }
        if !c.is_control() || c == '\t' {
            out.push(c);
        }
    }
    out
}

fn extract_local_url(line: &str) -> Option<String> {
    let clean = strip_ansi(line);
    for prefix in ["http://", "https://"] {
        if let Some(idx) = clean.find(prefix) {
            let slice = &clean[idx..];
            let end = slice
                .find(|c: char| {
                    c.is_whitespace() || matches!(c, '"' | '\'' | ')' | ']' | '>' | '`')
                })
                .unwrap_or(slice.len());
            let mut candidate = slice[..end].trim_end_matches(['.', ',', ';']).to_string();
            if candidate.contains("0.0.0.0") {
                candidate = candidate.replace("0.0.0.0", "localhost");
            } else if candidate.contains("[::1]") {
                candidate = candidate.replace("[::1]", "localhost");
            } else if candidate.contains("[::]") {
                candidate = candidate.replace("[::]", "localhost");
            }
            if candidate.contains("localhost") || candidate.contains("127.0.0.1") {
                return Some(candidate);
            }
        }
    }
    None
}

fn guess_static_mime(path: &Path) -> &'static str {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_default();
    match ext.as_str() {
        "html" | "htm" => "text/html; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "js" | "mjs" | "cjs" => "application/javascript; charset=utf-8",
        "json" | "map" => "application/json; charset=utf-8",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "ico" => "image/x-icon",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        "wasm" => "application/wasm",
        "txt" | "md" => "text/plain; charset=utf-8",
        "xml" => "application/xml; charset=utf-8",
        _ => "application/octet-stream",
    }
}

fn resolve_safe_static_file(root: &Path, req_path: &str) -> Option<PathBuf> {
    let raw_rel = req_path.split('?').next().unwrap_or("/").trim_start_matches('/');
    let decoded = url::form_urlencoded::parse(format!("p={}", raw_rel).as_bytes())
        .find(|(k, _)| k == "p")
        .map(|(_, v)| v.to_string())
        .unwrap_or_else(|| raw_rel.to_string());

    let mut clean_rel = PathBuf::new();
    for comp in Path::new(&decoded).components() {
        match comp {
            Component::Normal(c) => clean_rel.push(c),
            Component::CurDir => {}
            _ => return None,
        }
    }

    let candidate = if clean_rel.as_os_str().is_empty() {
        ["index.html", "public/index.html", "dist/index.html", "build/index.html"]
            .iter()
            .map(|r| root.join(r))
            .find(|p| p.is_file())?
    } else {
        let joined = root.join(&clean_rel);
        if joined.is_file() {
            joined
        } else if joined.is_dir() && joined.join("index.html").is_file() {
            joined.join("index.html")
        } else {
            let html_alt = root.join(format!("{}.html", clean_rel.to_string_lossy()));
            if html_alt.is_file() {
                html_alt
            } else {
                return None;
            }
        }
    };

    Some(candidate)
}

async fn write_static_http_response(
    stream: &mut TcpStream,
    status: &str,
    content_type: &str,
    body: &[u8],
) {
    let header = format!(
        "HTTP/1.1 {}\r\nContent-Type: {}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",
        status,
        content_type,
        body.len()
    );
    let _ = stream.write_all(header.as_bytes()).await;
    let _ = stream.write_all(body).await;
    let _ = stream.flush().await;
}

async fn handle_static_connection(mut stream: TcpStream, root: PathBuf) {
    let mut buf = [0u8; 4096];
    let n = match stream.read(&mut buf).await {
        Ok(n) if n > 0 => n,
        _ => return,
    };
    let req = String::from_utf8_lossy(&buf[..n]);
    let first_line = req.lines().next().unwrap_or("");
    let path = first_line.split_whitespace().nth(1).unwrap_or("/");

    if let Some(file_path) = resolve_safe_static_file(&root, path) {
        if let Ok(bytes) = tokio::fs::read(&file_path).await {
            let mime = guess_static_mime(&file_path);
            write_static_http_response(&mut stream, "200 OK", mime, &bytes).await;
            return;
        }
    }
    write_static_http_response(&mut stream, "404 Not Found", "text/plain; charset=utf-8", b"Not Found").await;
}

async fn kill_existing_server(guard: &mut ProjectServerInner) {
    guard.generation = guard.generation.saturating_add(1);
    if let Some(task) = guard.static_server_task.take() {
        task.abort();
    }
    for pid_opt in [guard.pid.take(), guard.aux_pid.take()] {
        if let Some(pid) = pid_opt {
            #[cfg(unix)]
            {
                let pgid = format!("-{}", pid);
                let _ = std::process::Command::new("kill")
                    .args(["-TERM", &pgid])
                    .status();
                let _ = std::process::Command::new("kill")
                    .args(["-TERM", &pid.to_string()])
                    .status();
            }
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                let _ = std::process::Command::new("taskkill")
                    .args(["/PID", &pid.to_string(), "/T", "/F"])
                    .creation_flags(0x0800_0000)
                    .status();
            }
        }
    }
    if let Some(mut child) = guard.child.take() {
        let _ = child.kill().await;
    }
    if let Some(mut aux) = guard.aux_child.take() {
        let _ = aux.kill().await;
    }
    guard.status.running = false;
    guard.status.starting = false;
    guard.status.external = false;
}

pub fn stop_project_dev_server_sync(app_handle: &tauri::AppHandle) {
    let Some(state) = app_handle.try_state::<ProjectServerState>() else {
        return;
    };
    let inner = state.inner.clone();
    if let Ok(mut guard) = inner.try_lock() {
        guard.generation = guard.generation.saturating_add(1);
        if let Some(task) = guard.static_server_task.take() {
            task.abort();
        }
        for pid_opt in [guard.pid.take(), guard.aux_pid.take()] {
            if let Some(pid) = pid_opt {
                #[cfg(unix)]
                {
                    let pgid = format!("-{}", pid);
                    let _ = std::process::Command::new("kill")
                        .args(["-TERM", &pgid])
                        .status();
                    let _ = std::process::Command::new("kill")
                        .args(["-TERM", &pid.to_string()])
                        .status();
                }
                #[cfg(target_os = "windows")]
                {
                    use std::os::windows::process::CommandExt;
                    let _ = std::process::Command::new("taskkill")
                        .args(["/PID", &pid.to_string(), "/T", "/F"])
                        .creation_flags(0x0800_0000)
                        .status();
                }
            }
        }
        if let Some(mut child) = guard.child.take() {
            let _ = child.start_kill();
        }
        if let Some(mut aux) = guard.aux_child.take() {
            let _ = aux.start_kill();
        }
        guard.status.running = false;
        guard.status.starting = false;
        guard.status.external = false;
    };
}

enum ResolvedRunner {
    Command {
        exe: String,
        args: Vec<String>,
        label: String,
        companion_vite: bool,
        is_docker_compose: bool,
    },
    StaticHttp,
}

fn resolve_runner(
    root_path: &str,
    info: &ProjectInfo,
    script_name: Option<String>,
) -> Result<ResolvedRunner, String> {
    let root = Path::new(root_path);
    let chosen_script = script_name.or_else(|| info.dev_script.clone());

    if info.kind == "static" || chosen_script.as_deref() == Some("static-http") {
        return Ok(ResolvedRunner::StaticHttp);
    }

    if chosen_script.as_deref() == Some("docker-compose")
        || info.kind == "docker"
        || (info.kind == "wordpress" && find_compose_file(root).is_some())
    {
        let docker = find_executable(&["docker"]).ok_or_else(|| {
            "Command not found: docker. Please start Docker Desktop or install Docker CLI."
                .to_string()
        })?;
        return Ok(ResolvedRunner::Command {
            exe: docker,
            args: vec!["compose".to_string(), "up".to_string(), "-d".to_string()],
            label: "docker compose up -d".to_string(),
            companion_vite: false,
            is_docker_compose: true,
        });
    }

    if info.kind == "laravel" {
        let has_artisan = root.join("artisan").is_file();
        if has_artisan {
            let php = find_executable(&["php"]).ok_or_else(|| {
                "Command not found: php. Please install PHP or start Docker first."
                    .to_string()
            })?;
            let with_vite = chosen_script.as_deref() == Some("artisan-vite")
                || (chosen_script.is_none() && laravel_needs_companion_vite(root));
            return Ok(ResolvedRunner::Command {
                exe: php,
                args: vec![
                    "artisan".to_string(),
                    "serve".to_string(),
                    "--host=127.0.0.1".to_string(),
                    "--port=8000".to_string(),
                ],
                label: if with_vite {
                    "php artisan serve + vite".to_string()
                } else {
                    "php artisan serve --host=127.0.0.1 --port=8000".to_string()
                },
                companion_vite: with_vite,
                is_docker_compose: false,
            });
        }
    }

    if info.kind == "laravel" || info.kind == "php" || info.kind == "wordpress" {
        let php = find_executable(&["php"]).ok_or_else(|| {
            "Command not found: php. Please install PHP or start Docker first."
                .to_string()
        })?;
        let docroot = if root.join("public/index.php").exists() {
            "public"
        } else {
            "."
        };
        return Ok(ResolvedRunner::Command {
            exe: php,
            args: vec![
                "-S".to_string(),
                "127.0.0.1:8000".to_string(),
                "-t".to_string(),
                docroot.to_string(),
            ],
            label: format!("php -S 127.0.0.1:8000 -t {}", docroot),
            companion_vite: false,
            is_docker_compose: false,
        });
    }

    if info.kind == "mkdocs" {
        for rel in [
            ".venv/bin/mkdocs",
            ".venv/Scripts/mkdocs.exe",
            "venv/bin/mkdocs",
            "venv/Scripts/mkdocs.exe",
        ] {
            let p = root.join(rel);
            if p.is_file() {
                return Ok(ResolvedRunner::Command {
                    exe: p.to_string_lossy().to_string(),
                    args: vec![
                        "serve".to_string(),
                        "-a".to_string(),
                        "127.0.0.1:8000".to_string(),
                    ],
                    label: "mkdocs serve -a 127.0.0.1:8000".to_string(),
                    companion_vite: false,
                    is_docker_compose: false,
                });
            }
        }
        if let Some(mk) = find_executable(&["mkdocs"]) {
            return Ok(ResolvedRunner::Command {
                exe: mk,
                args: vec![
                    "serve".to_string(),
                    "-a".to_string(),
                    "127.0.0.1:8000".to_string(),
                ],
                label: "mkdocs serve -a 127.0.0.1:8000".to_string(),
                companion_vite: false,
                is_docker_compose: false,
            });
        }
        if let Some((py_exe, mut prefix_args)) = find_python_runner(root) {
            prefix_args.extend([
                "-m".to_string(),
                "mkdocs".to_string(),
                "serve".to_string(),
                "-a".to_string(),
                "127.0.0.1:8000".to_string(),
            ]);
            return Ok(ResolvedRunner::Command {
                exe: py_exe,
                args: prefix_args,
                label: "python -m mkdocs serve -a 127.0.0.1:8000".to_string(),
                companion_vite: false,
                is_docker_compose: false,
            });
        }
        return Err("Command not found: mkdocs / python3. Please install MkDocs.".to_string());
    }

    if info.kind == "hugo" {
        let hugo = find_executable(&["hugo"])
            .ok_or_else(|| "Command not found: hugo. Please install Hugo (e.g. brew install hugo).".to_string())?;
        return Ok(ResolvedRunner::Command {
            exe: hugo,
            args: vec![
                "server".to_string(),
                "-D".to_string(),
                "--port".to_string(),
                "1313".to_string(),
            ],
            label: "hugo server -D --port 1313".to_string(),
            companion_vite: false,
            is_docker_compose: false,
        });
    }

    if info.kind == "jekyll" {
        if let Some(bundle) = find_executable(&["bundle"]) {
            return Ok(ResolvedRunner::Command {
                exe: bundle,
                args: vec![
                    "exec".to_string(),
                    "jekyll".to_string(),
                    "serve".to_string(),
                    "--port".to_string(),
                    "4000".to_string(),
                ],
                label: "bundle exec jekyll serve --port 4000".to_string(),
                companion_vite: false,
                is_docker_compose: false,
            });
        }
        let jekyll = find_executable(&["jekyll"])
            .ok_or_else(|| "Command not found: bundle / jekyll. Please install Ruby Bundler & Jekyll.".to_string())?;
        return Ok(ResolvedRunner::Command {
            exe: jekyll,
            args: vec![
                "serve".to_string(),
                "--port".to_string(),
                "4000".to_string(),
            ],
            label: "jekyll serve --port 4000".to_string(),
            companion_vite: false,
            is_docker_compose: false,
        });
    }

    if matches!(info.kind.as_str(), "django" | "fastapi" | "flask" | "streamlit") {
        let spec = detect_python_web(root)
            .ok_or_else(|| "Python web entry file not found in project root.".to_string())?;
        let (py_exe, mut prefix_args) = if spec.uses_uv_ok {
            find_python_runner(root)
        } else {
            find_usable_python_exe().map(|e| (e, Vec::new()))
        }
        .ok_or_else(|| "Command not found: python3 / uv. Please install Python or create .venv.".to_string())?;
        prefix_args.extend(spec.args);
        return Ok(ResolvedRunner::Command {
            exe: py_exe,
            args: prefix_args,
            label: spec.command_label,
            companion_vite: false,
            is_docker_compose: false,
        });
    }

    let pm = info.package_manager.as_deref().unwrap_or("npm");
    let sc = chosen_script.ok_or_else(|| "No dev/start script found in package.json".to_string())?;
    let pm_static: &str = match pm {
        "pnpm" => "pnpm",
        "yarn" => "yarn",
        "bun" => "bun",
        _ => "npm",
    };
    let exe = find_executable(&[pm_static]).ok_or_else(|| {
        format!(
            "Command not found: {}. Please ensure Node.js / {} is installed.",
            pm_static, pm_static
        )
    })?;
    Ok(ResolvedRunner::Command {
        exe,
        args: vec!["run".to_string(), sc.clone()],
        label: format!("{} run {}", pm_static, sc),
        companion_vite: false,
        is_docker_compose: false,
    })
}

#[tauri::command]
pub async fn start_project_dev_server(
    app: AppHandle,
    state: State<'_, ProjectServerState>,
    root_path: String,
    script_name: Option<String>,
) -> Result<ProjectServerStatus, String> {
    let _start_guard = state.start_lock.lock().await;
    let info = inspect_root_dir(Path::new(&root_path))?;

    // 1. If we already manage a live server for this exact root_path, reuse it without spawning a duplicate.
    {
        let guard = state.inner.lock().await;
        if guard.status.running
            && guard.status.root_path.as_deref() == Some(root_path.as_str())
        {
            if let Some(ref existing_url) = guard.status.url {
                if probe_local_http(existing_url, 400).await || guard.status.starting {
                    return Ok(guard.status.clone());
                }
            } else if guard.status.starting {
                return Ok(guard.status.clone());
            }
        }
    }

    // 2. If the configured project URL (or Laravel .env APP_URL / Docker port) is already alive externally,
    // connect to it instead of launching a second server (skip for built-in static server).
    if info.kind != "static" {
        let mut candidate_urls: Vec<String> = if info.kind == "laravel" {
            laravel_candidate_urls(Path::new(&root_path))
        } else {
            info.default_url.iter().cloned().collect()
        };
        for p in parse_compose_ports(Path::new(&root_path)) {
            let u = format!("http://localhost:{}", p);
            if !candidate_urls.iter().any(|x| x == &u) {
                candidate_urls.push(u);
            }
        }

        for candidate in &candidate_urls {
            if probe_local_http(candidate, 500).await {
                let mut guard = state.inner.lock().await;
                kill_existing_server(&mut guard).await;
                guard.status = ProjectServerStatus {
                    running: true,
                    starting: false,
                    external: true,
                    root_path: Some(root_path.clone()),
                    kind: Some(info.kind.clone()),
                    url: Some(candidate.clone()),
                    command_label: info.dev_command_label.clone(),
                    logs: vec![format!("Connected to already-running server at {}", candidate)],
                    error: None,
                };
                let snap = guard.status.clone();
                drop(guard);
                let _ = app.emit("project-server-update", snap.clone());
                return Ok(snap);
            }
        }

        if let Some(ref default_url) = info.default_url {
            if let Ok(parsed) = url::Url::parse(default_url) {
                if let Some(port) = parsed.port() {
                    if is_local_port_bound(port, 250).await {
                        let msg = format!(
                            "Port {} is already occupied by an unresponsive process. Stop that process or restart it before starting the dev server.",
                            port
                        );
                        let mut guard = state.inner.lock().await;
                        kill_existing_server(&mut guard).await;
                        guard.status = ProjectServerStatus {
                            running: false,
                            starting: false,
                            external: false,
                            root_path: Some(root_path.clone()),
                            kind: Some(info.kind.clone()),
                            url: None,
                            command_label: info.dev_command_label.clone(),
                            logs: vec![msg.clone()],
                            error: Some(msg.clone()),
                        };
                        let snap = guard.status.clone();
                        drop(guard);
                        let _ = app.emit("project-server-update", snap);
                        return Err(msg);
                    }
                }
            }
        }
    }

    {
        let mut guard = state.inner.lock().await;
        kill_existing_server(&mut guard).await;
    }

    let runner = resolve_runner(&root_path, &info, script_name)?;

    if matches!(runner, ResolvedRunner::StaticHttp) {
        let listener = match TcpListener::bind("127.0.0.1:4173").await {
            Ok(l) => l,
            Err(_) => TcpListener::bind("127.0.0.1:0")
                .await
                .map_err(|e| format!("Failed to start built-in static server: {}", e))?,
        };
        let port = listener.local_addr().map_err(|e| e.to_string())?.port();
        let url = format!("http://127.0.0.1:{}", port);
        let root_buf = PathBuf::from(&root_path);
        let task = tokio::spawn(async move {
            loop {
                match listener.accept().await {
                    Ok((stream, _)) => {
                        let r = root_buf.clone();
                        tokio::spawn(async move {
                            handle_static_connection(stream, r).await;
                        });
                    }
                    Err(_) => break,
                }
            }
        });

        let snapshot = {
            let mut guard = state.inner.lock().await;
            guard.generation = guard.generation.saturating_add(1);
            guard.static_server_task = Some(task);
            guard.status = ProjectServerStatus {
                running: true,
                starting: false,
                external: false,
                root_path: Some(root_path.clone()),
                kind: Some("static".to_string()),
                url: Some(url.clone()),
                command_label: Some(format!("Built-in Static HTTP ({})", url)),
                logs: vec![format!("Serving {} at {}", root_path, url)],
                error: None,
            };
            guard.status.clone()
        };
        let _ = app.emit("project-server-update", snapshot.clone());
        return Ok(snapshot);
    }

    let (exe, args, command_label, companion_vite, is_docker_compose) = match runner {
        ResolvedRunner::Command {
            exe,
            args,
            label,
            companion_vite,
            is_docker_compose,
        } => (exe, args, label, companion_vite, is_docker_compose),
        ResolvedRunner::StaticHttp => unreachable!(),
    };

    let mut cmd = build_project_command(&exe, &args);
    cmd.current_dir(&root_path)
        .env("PATH", extended_path())
        .env("BROWSER", "none")
        .env("FORCE_COLOR", "0")
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    #[cfg(unix)]
    {
        cmd.process_group(0);
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to start {}: {}", command_label, e))?;

    let pid = child.id();
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // Optionally spawn companion Vite dev server for Laravel projects with node_modules & @vite
    let (aux_child, aux_pid) = if companion_vite {
        let pm = detect_package_manager(Path::new(&root_path));
        if let Some(pm_exe) = find_executable(&[pm]) {
            let vite_args = vec!["run".to_string(), "dev".to_string()];
            let mut vcmd = build_project_command(&pm_exe, &vite_args);
            vcmd.current_dir(&root_path)
                .env("PATH", extended_path())
                .env("BROWSER", "none")
                .env("FORCE_COLOR", "0")
                .stdin(std::process::Stdio::null())
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null());
            #[cfg(unix)]
            {
                vcmd.process_group(0);
            }
            if let Ok(vc) = vcmd.spawn() {
                let vpid = vc.id();
                (Some(vc), vpid)
            } else {
                (None, None)
            }
        } else {
            (None, None)
        }
    } else {
        (None, None)
    };

    let (gen_id, snapshot) = {
        let mut guard = state.inner.lock().await;
        guard.generation = guard.generation.saturating_add(1);
        let gen_id = guard.generation;
        guard.child = Some(child);
        guard.pid = pid;
        guard.aux_child = aux_child;
        guard.aux_pid = aux_pid;
        guard.status = ProjectServerStatus {
            running: true,
            starting: true,
            external: false,
            root_path: Some(root_path.clone()),
            kind: Some(info.kind.clone()),
            url: None,
            command_label: Some(command_label.clone()),
            logs: vec![format!("$ {}", command_label)],
            error: None,
        };
        (gen_id, guard.status.clone())
    };

    let _ = app.emit("project-server-update", snapshot.clone());

    let shared_out = state.inner.clone();
    let app_out = app.clone();
    if let Some(out) = stdout {
        tokio::spawn(async move {
            let mut lines = BufReader::new(out).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let clean = strip_ansi(&line);
                if clean.trim().is_empty() {
                    continue;
                }
                let maybe_url = if is_docker_compose {
                    None
                } else {
                    extract_local_url(&clean)
                };
                {
                    let mut guard = shared_out.lock().await;
                    if guard.generation != gen_id {
                        break;
                    }
                    guard.status.logs.push(clean);
                    if guard.status.logs.len() > 80 {
                        let excess = guard.status.logs.len() - 80;
                        guard.status.logs.drain(0..excess);
                    }
                    if maybe_url.is_none() {
                        let snap = guard.status.clone();
                        drop(guard);
                        let _ = app_out.emit("project-server-update", snap);
                        continue;
                    }
                }

                if let Some(u) = maybe_url {
                    for _ in 0..8 {
                        if probe_local_http(&u, 300).await {
                            break;
                        }
                        tokio::time::sleep(Duration::from_millis(120)).await;
                    }
                    let mut guard = shared_out.lock().await;
                    if guard.generation != gen_id {
                        break;
                    }
                    guard.status.url = Some(u);
                    guard.status.starting = false;
                    let snap = guard.status.clone();
                    drop(guard);
                    let _ = app_out.emit("project-server-update", snap);
                }
            }
        });
    }

    let shared_err = state.inner.clone();
    let app_err = app.clone();
    if let Some(err) = stderr {
        tokio::spawn(async move {
            let mut lines = BufReader::new(err).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let clean = strip_ansi(&line);
                if clean.trim().is_empty() {
                    continue;
                }
                let maybe_url = if is_docker_compose {
                    None
                } else {
                    extract_local_url(&clean)
                };
                {
                    let mut guard = shared_err.lock().await;
                    if guard.generation != gen_id {
                        break;
                    }
                    guard.status.logs.push(clean);
                    if guard.status.logs.len() > 80 {
                        let excess = guard.status.logs.len() - 80;
                        guard.status.logs.drain(0..excess);
                    }
                    if maybe_url.is_none() {
                        let snap = guard.status.clone();
                        drop(guard);
                        let _ = app_err.emit("project-server-update", snap);
                        continue;
                    }
                }

                if let Some(u) = maybe_url {
                    for _ in 0..8 {
                        if probe_local_http(&u, 300).await {
                            break;
                        }
                        tokio::time::sleep(Duration::from_millis(120)).await;
                    }
                    let mut guard = shared_err.lock().await;
                    if guard.generation != gen_id {
                        break;
                    }
                    guard.status.url = Some(u);
                    guard.status.starting = false;
                    let snap = guard.status.clone();
                    drop(guard);
                    let _ = app_err.emit("project-server-update", snap);
                }
            }
        });
    }

    // Monitor child exit & fallback readiness check on default_url (plus docker compose up -d HTTP wait)
    let shared_wait = state.inner.clone();
    let app_wait = app.clone();
    let fallback_url = info.default_url.clone();
    tokio::spawn(async move {
        let mut ticks: u32 = 0;
        let mut compose_started = false;
        loop {
            tokio::time::sleep(Duration::from_millis(500)).await;
            ticks = ticks.saturating_add(1);

            let should_probe_fallback = {
                let mut guard = shared_wait.lock().await;
                if guard.generation != gen_id {
                    break;
                }
                if !compose_started {
                    let exited = if let Some(child) = guard.child.as_mut() {
                        match child.try_wait() {
                            Ok(Some(status)) => Some(status),
                            Ok(None) => None,
                            Err(_) => None,
                        }
                    } else {
                        break;
                    };
                    if let Some(exit_status) = exited {
                        guard.child = None;
                        guard.pid = None;
                        if is_docker_compose && exit_status.success() {
                            compose_started = true;
                            guard.status.logs.push("Docker Compose started; waiting for HTTP...".to_string());
                        } else {
                            guard.status.running = false;
                            guard.status.starting = false;
                            guard.status.external = false;
                            if !exit_status.success() {
                                guard.status.error = Some(format!(
                                    "Dev server exited with code {}",
                                    exit_status
                                        .code()
                                        .map(|c| c.to_string())
                                        .unwrap_or_else(|| "signal".to_string())
                                ));
                            }
                            let snap = guard.status.clone();
                            drop(guard);
                            let _ = app_wait.emit("project-server-update", snap);
                            break;
                        }
                    }
                }
                guard.status.starting && guard.status.url.is_none() && ticks <= 60
            };

            if should_probe_fallback {
                if let Some(ref fb) = fallback_url {
                    if probe_local_http(fb, 350).await {
                        let mut guard = shared_wait.lock().await;
                        if guard.generation == gen_id && guard.status.url.is_none() {
                            guard.status.url = Some(fb.clone());
                            guard.status.starting = false;
                            if is_docker_compose {
                                guard.status.external = true;
                            }
                            let snap = guard.status.clone();
                            drop(guard);
                            let _ = app_wait.emit("project-server-update", snap);
                            if is_docker_compose {
                                break;
                            }
                        }
                    }
                }
            } else if compose_started && ticks > 60 {
                let mut guard = shared_wait.lock().await;
                if guard.generation == gen_id && guard.status.url.is_none() {
                    guard.status.running = false;
                    guard.status.starting = false;
                    guard.status.error = Some("Docker container started, but HTTP did not respond in time.".to_string());
                    let snap = guard.status.clone();
                    drop(guard);
                    let _ = app_wait.emit("project-server-update", snap);
                }
                break;
            }
        }
    });

    Ok(snapshot)
}

#[tauri::command]
pub async fn stop_project_dev_server(
    app: AppHandle,
    state: State<'_, ProjectServerState>,
) -> Result<ProjectServerStatus, String> {
    let mut guard = state.inner.lock().await;
    kill_existing_server(&mut guard).await;
    guard.status.url = None;
    guard.status.error = None;
    let snap = guard.status.clone();
    drop(guard);
    let _ = app.emit("project-server-update", snap.clone());
    Ok(snap)
}

#[tauri::command]
pub async fn get_project_dev_server_status(
    state: State<'_, ProjectServerState>,
) -> Result<ProjectServerStatus, String> {
    let guard = state.inner.lock().await;
    Ok(guard.status.clone())
}

fn emit_setup_progress(
    app: &AppHandle,
    root_path: &str,
    action: &str,
    running: bool,
    line: Option<String>,
    done: bool,
    ok: Option<bool>,
    message: Option<String>,
) {
    let _ = app.emit(
        "project-setup-progress",
        ProjectSetupProgress {
            root_path: root_path.to_string(),
            action: action.to_string(),
            running,
            line,
            done,
            ok,
            message,
        },
    );
}

async fn run_streaming_setup_command(
    app: &AppHandle,
    root_path: &str,
    action: &str,
    exe: &str,
    args: &[String],
    label: &str,
) -> Result<(bool, Vec<String>), String> {
    emit_setup_progress(
        app,
        root_path,
        action,
        true,
        Some(format!("$ {}", label)),
        false,
        None,
        None,
    );

    let mut cmd = build_project_command(exe, args);
    cmd.current_dir(root_path)
        .env("PATH", extended_path())
        .env("FORCE_COLOR", "0")
        .env("CI", "true")
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to start `{}`: {}", label, e))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let collected = Arc::new(Mutex::new(vec![format!("$ {}", label)]));

    let out_task = stdout.map(|out| {
        let app_c = app.clone();
        let root_c = root_path.to_string();
        let act_c = action.to_string();
        let buf_c = collected.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(out).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let clean = strip_ansi(&line);
                if clean.trim().is_empty() {
                    continue;
                }
                {
                    let mut guard = buf_c.lock().await;
                    guard.push(clean.clone());
                    if guard.len() > 140 {
                        let excess = guard.len() - 140;
                        guard.drain(0..excess);
                    }
                }
                emit_setup_progress(&app_c, &root_c, &act_c, true, Some(clean), false, None, None);
            }
        })
    });

    let err_task = stderr.map(|err| {
        let app_c = app.clone();
        let root_c = root_path.to_string();
        let act_c = action.to_string();
        let buf_c = collected.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(err).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let clean = strip_ansi(&line);
                if clean.trim().is_empty() {
                    continue;
                }
                {
                    let mut guard = buf_c.lock().await;
                    guard.push(clean.clone());
                    if guard.len() > 140 {
                        let excess = guard.len() - 140;
                        guard.drain(0..excess);
                    }
                }
                emit_setup_progress(&app_c, &root_c, &act_c, true, Some(clean), false, None, None);
            }
        })
    });

    let status = tokio::time::timeout(Duration::from_secs(300), child.wait())
        .await
        .map_err(|_| {
            let _ = child.start_kill();
            format!("Setup command `{}` timed out after 5 minutes.", label)
        })?
        .map_err(|e| format!("Failed waiting for `{}`: {}", label, e))?;

    if let Some(t) = out_task {
        let _ = t.await;
    }
    if let Some(t) = err_task {
        let _ = t.await;
    }

    let output = collected.lock().await.clone();
    Ok((status.success(), output))
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
pub async fn assist_project_setup(
    app: AppHandle,
    root_path: String,
    action: String,
    target: Option<String>,
    command: Option<String>,
    url: Option<String>,
) -> Result<ProjectSetupResult, String> {
    let root = Path::new(&root_path);

    match action.as_str() {
        "open-url" => {
            let target_url = url
                .as_deref()
                .map(str::trim)
                .filter(|u| u.starts_with("https://") || u.starts_with("http://"))
                .ok_or_else(|| "Invalid documentation/download URL".to_string())?;
            #[cfg(target_os = "macos")]
            {
                Command::new("open")
                    .arg(target_url)
                    .spawn()
                    .map_err(|e| format!("Failed to open URL: {}", e))?;
            }
            #[cfg(target_os = "windows")]
            {
                let mut c = new_background_command("cmd", &["/C", "start", "", target_url]);
                c.spawn()
                    .map_err(|e| format!("Failed to open URL: {}", e))?;
            }
            #[cfg(all(unix, not(target_os = "macos")))]
            {
                Command::new("xdg-open")
                    .arg(target_url)
                    .spawn()
                    .map_err(|e| format!("Failed to open URL: {}", e))?;
            }
            Ok(ProjectSetupResult {
                ok: true,
                message: format!("Opened {}", target_url),
                output: Vec::new(),
            })
        }

        "launch-docker" => {
            #[cfg(target_os = "macos")]
            {
                let app_name = if Path::new("/Applications/Docker.app").exists() {
                    Some("Docker")
                } else if Path::new("/Applications/OrbStack.app").exists() {
                    Some("OrbStack")
                } else {
                    None
                };
                let Some(app_name) = app_name else {
                    return Err("Docker Desktop / OrbStack app not found in /Applications.".to_string());
                };
                Command::new("open")
                    .args(["-a", app_name])
                    .spawn()
                    .map_err(|e| format!("Failed to launch {}: {}", app_name, e))?;

                if let Some(docker_exe) = find_executable(&["docker"]) {
                    for _ in 0..16 {
                        tokio::time::sleep(Duration::from_millis(600)).await;
                        if check_docker_daemon_running(&docker_exe).await {
                            return Ok(ProjectSetupResult {
                                ok: true,
                                message: format!("{} started and Docker is ready.", app_name),
                                output: Vec::new(),
                            });
                        }
                    }
                }
                return Ok(ProjectSetupResult {
                    ok: true,
                    message: format!(
                        "{} is launching. Wait a few seconds and click Re-check.",
                        app_name
                    ),
                    output: Vec::new(),
                });
            }
            #[cfg(target_os = "windows")]
            {
                let Some(docker_desktop) = find_windows_docker_desktop_exe() else {
                    return Err("Docker Desktop.exe was not found.".to_string());
                };
                std::process::Command::new(&docker_desktop)
                    .spawn()
                    .map_err(|e| format!("Failed to launch Docker Desktop: {}", e))?;
                if let Some(docker_exe) = find_executable(&["docker"]) {
                    for _ in 0..16 {
                        tokio::time::sleep(Duration::from_millis(600)).await;
                        if check_docker_daemon_running(&docker_exe).await {
                            return Ok(ProjectSetupResult {
                                ok: true,
                                message: "Docker Desktop started and Docker is ready.".to_string(),
                                output: Vec::new(),
                            });
                        }
                    }
                }
                return Ok(ProjectSetupResult {
                    ok: true,
                    message: "Docker Desktop is launching. Wait a few seconds and click Re-check.".to_string(),
                    output: Vec::new(),
                });
            }
            #[cfg(all(unix, not(target_os = "macos")))]
            {
                let mut launched_desktop = false;
                if Path::new("/opt/docker-desktop/bin/docker-desktop").is_file() {
                    launched_desktop = std::process::Command::new("/opt/docker-desktop/bin/docker-desktop")
                        .spawn()
                        .is_ok();
                } else if let Some(bin) = find_executable(&["docker-desktop"]) {
                    launched_desktop = std::process::Command::new(bin).spawn().is_ok();
                } else if has_docker_desktop_app() {
                    launched_desktop = std::process::Command::new("systemctl")
                        .args(["--user", "start", "docker-desktop"])
                        .status()
                        .map(|s| s.success())
                        .unwrap_or(false);
                }

                let mut started_engine = false;
                if !launched_desktop && has_linux_docker_engine_service() {
                    started_engine = std::process::Command::new("systemctl")
                        .args(["start", "docker"])
                        .status()
                        .map(|s| s.success())
                        .unwrap_or(false);
                    if !started_engine && find_executable(&["pkexec"]).is_some() {
                        started_engine = std::process::Command::new("pkexec")
                            .args(["systemctl", "start", "docker"])
                            .status()
                            .map(|s| s.success())
                            .unwrap_or(false);
                    }
                }

                if !launched_desktop && !started_engine {
                    if has_linux_docker_engine_service() {
                        return Err(
                            "Could not start Docker Engine automatically. Run `sudo systemctl start docker` in your terminal (and ensure your user is in the `docker` group)."
                                .to_string(),
                        );
                    }
                    return Err("Could not launch Docker Desktop automatically on Linux.".to_string());
                }

                let label = if launched_desktop { "Docker Desktop" } else { "Docker Engine" };
                if let Some(docker_exe) = find_executable(&["docker"]) {
                    for _ in 0..16 {
                        tokio::time::sleep(Duration::from_millis(600)).await;
                        if check_docker_daemon_running(&docker_exe).await {
                            return Ok(ProjectSetupResult {
                                ok: true,
                                message: format!("{} started and Docker is ready.", label),
                                output: Vec::new(),
                            });
                        }
                    }
                }
                Ok(ProjectSetupResult {
                    ok: true,
                    message: format!("{} is launching. Wait a few seconds and click Re-check.", label),
                    output: Vec::new(),
                })
            }
        }

        "run-terminal-command" => {
            let cmd_str = command
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .ok_or_else(|| "Missing terminal command".to_string())?;

            #[cfg(target_os = "macos")]
            {
                let needs_brew = cmd_str.split_whitespace().next() == Some("brew")
                    || cmd_str.contains("brew install");
                let brew_bootstrap = if needs_brew {
                    r#"if ! command -v brew >/dev/null 2>&1; then
  echo "[Homebrew が見つからないため、先に Homebrew をインストールします]"
  echo "(途中で macOS のログインパスワードや Enter キーの入力が求められる場合があります)"
  echo ""
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  if [ -x /opt/homebrew/bin/brew ]; then eval "$(/opt/homebrew/bin/brew shellenv)"; fi
  if [ -x /usr/local/bin/brew ]; then eval "$(/usr/local/bin/brew shellenv)"; fi
fi
"#
                } else {
                    ""
                };

                let quoted_root = root_path.replace('\'', "'\\''");
                let script_path = env::temp_dir().join("onigiri_project_setup.command");
                let script_body = format!(
                    "#!/bin/zsh\nexport PATH=\"{}\"\ncd '{}' || exit 1\necho \"=== Onigiri Editor Project Setup ===\"\necho \"Folder: {}\"\necho \"> {}\"\necho \"\"\n{}\n{}\necho \"\"\necho \"完了したら Onigiri Editor に戻り「環境を再チェック」をクリックしてください。\"\n",
                    extended_path().replace('"', "\\\""),
                    quoted_root,
                    quoted_root,
                    cmd_str.replace('"', "\\\""),
                    brew_bootstrap,
                    cmd_str
                );
                fs::write(&script_path, script_body)
                    .map_err(|e| format!("Failed to write setup script: {}", e))?;
                {
                    use std::os::unix::fs::PermissionsExt;
                    let mut perms = fs::metadata(&script_path)
                        .map_err(|e| e.to_string())?
                        .permissions();
                    perms.set_mode(0o755);
                    fs::set_permissions(&script_path, perms).map_err(|e| e.to_string())?;
                }
                Command::new("open")
                    .args(["-a", "Terminal", &script_path.to_string_lossy()])
                    .spawn()
                    .map_err(|e| format!("Failed to launch Terminal: {}", e))?;
                return Ok(ProjectSetupResult {
                    ok: true,
                    message: cmd_str.to_string(),
                    output: Vec::new(),
                });
            }
            #[cfg(target_os = "windows")]
            {
                let escape_cmd_echo = |s: &str| -> String {
                    s.replace('^', "^^")
                        .replace('&', "^&")
                        .replace('|', "^|")
                        .replace('<', "^<")
                        .replace('>', "^>")
                };
                let needs_winget = cmd_str.split_whitespace().next() == Some("winget")
                    || cmd_str.contains("winget install");
                let fallback_url = if cmd_str.contains("OpenJS.NodeJS") {
                    "https://nodejs.org/"
                } else if cmd_str.contains("Docker.DockerDesktop") {
                    "https://www.docker.com/products/docker-desktop/"
                } else if cmd_str.contains("Python.Python") {
                    "https://www.python.org/downloads/"
                } else if cmd_str.contains("PHP.PHP") {
                    "https://windows.php.net/download/"
                } else if cmd_str.contains("Composer.Composer") {
                    "https://getcomposer.org/download/"
                } else if cmd_str.contains("Hugo.Hugo") {
                    "https://gohugo.io/installation/windows/"
                } else if cmd_str.contains("RubyInstallerTeam") {
                    "https://rubyinstaller.org/downloads/"
                } else {
                    "https://aka.ms/getwinget"
                };
                let winget_guard = if needs_winget {
                    format!(
                        "where winget >nul 2>nul\r\nif errorlevel 1 (\r\n  echo [winget was not found on this Windows installation.]\r\n  echo [Opening official download page instead: {}]\r\n  start \"\" \"{}\"\r\n  echo.\r\n  echo After installing, return to Onigiri Editor and click Re-check Environment.\r\n  goto :eof\r\n)\r\n",
                        fallback_url, fallback_url
                    )
                } else {
                    String::new()
                };
                let script_path = env::temp_dir().join("onigiri_project_setup.cmd");
                let safe_root = root_path.replace('"', "");
                let script_body = format!(
                    "@echo off\r\nchcp 65001 >nul\r\nset \"PATH={}\"\r\ncd /d \"{}\"\r\necho === Onigiri Editor Project Setup ===\r\necho Folder: {}\r\necho ^> {}\r\necho.\r\n{}\r\n{}\r\nfor /f \"usebackq delims=\" %%P in (`powershell -NoProfile -Command \"[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')\" 2^>nul`) do set \"PATH=%%P;%PATH%\"\r\necho.\r\necho Done. Return to Onigiri Editor and click Re-check (restart app if PATH changes are not yet picked up).\r\n",
                    extended_path().replace('"', ""),
                    safe_root,
                    escape_cmd_echo(&safe_root),
                    escape_cmd_echo(cmd_str),
                    winget_guard,
                    cmd_str
                );
                fs::write(&script_path, script_body)
                    .map_err(|e| format!("Failed to write setup script: {}", e))?;
                let script_str = script_path.to_string_lossy().to_string();
                let mut launch = new_background_command(
                    "cmd",
                    &["/C", "start", "Onigiri Editor Setup", "cmd", "/K", &script_str],
                );
                launch
                    .spawn()
                    .map_err(|e| format!("Failed to open Windows Command Prompt: {}", e))?;
                return Ok(ProjectSetupResult {
                    ok: true,
                    message: cmd_str.to_string(),
                    output: Vec::new(),
                });
            }
            #[cfg(all(unix, not(target_os = "macos")))]
            {
                let quoted_root = root_path.replace('\'', "'\\''");
                let script_path = env::temp_dir().join("onigiri_project_setup.sh");
                let script_body = format!(
                    "#!/usr/bin/env bash\nexport PATH=\"{}\"\ncd '{}' || exit 1\necho \"=== Onigiri Editor Project Setup ===\"\necho \"Folder: {}\"\necho \"> {}\"\necho \"\"\n{}\necho \"\"\necho \"Done. Press Enter to close and click Re-check in Onigiri Editor.\"\nread -r _\n",
                    extended_path().replace('"', "\\\""),
                    quoted_root,
                    quoted_root,
                    cmd_str.replace('"', "\\\""),
                    cmd_str
                );
                fs::write(&script_path, script_body)
                    .map_err(|e| format!("Failed to write setup script: {}", e))?;
                {
                    use std::os::unix::fs::PermissionsExt;
                    let mut perms = fs::metadata(&script_path)
                        .map_err(|e| e.to_string())?
                        .permissions();
                    perms.set_mode(0o755);
                    fs::set_permissions(&script_path, perms).map_err(|e| e.to_string())?;
                }
                let script_str = script_path.to_string_lossy().to_string();
                launch_linux_terminal(&script_str)?;
                Ok(ProjectSetupResult {
                    ok: true,
                    message: cmd_str.to_string(),
                    output: Vec::new(),
                })
            }
        }

        "install-pm" => {
            let pm = target
                .as_deref()
                .filter(|s| matches!(*s, "pnpm" | "yarn"))
                .ok_or_else(|| "Only pnpm / yarn can be auto-installed via npm.".to_string())?;
            let npm = find_executable(&["npm"])
                .ok_or_else(|| "Command not found: npm. Please install Node.js first.".to_string())?;
            let args = vec!["install".to_string(), "-g".to_string(), pm.to_string()];
            let label = format!("npm install -g {}", pm);
            let (ok, output) =
                run_streaming_setup_command(&app, &root_path, &action, &npm, &args, &label).await?;
            let message = if ok {
                format!("Installed {} successfully.", pm)
            } else {
                format!("Failed to install {} (exit non-zero). Check logs or run in Terminal.", pm)
            };
            emit_setup_progress(&app, &root_path, &action, false, None, true, Some(ok), Some(message.clone()));
            Ok(ProjectSetupResult { ok, message, output })
        }

        "install-node-deps" => {
            if !root.is_dir() {
                return Err("Project root directory does not exist.".to_string());
            }
            let pm = target
                .as_deref()
                .filter(|s| matches!(*s, "npm" | "pnpm" | "yarn" | "bun"))
                .unwrap_or_else(|| detect_package_manager(root));
            let pm_exe = find_executable(&[pm]).ok_or_else(|| {
                format!("Command not found: {}. Please install Node.js / {} first.", pm, pm)
            })?;
            let args = vec!["install".to_string()];
            let label = format!("{} install", pm);
            let (ok, output) =
                run_streaming_setup_command(&app, &root_path, &action, &pm_exe, &args, &label)
                    .await?;
            let message = if ok {
                format!("`{} install` completed.", pm)
            } else {
                format!("`{} install` failed. Expand logs for details.", pm)
            };
            emit_setup_progress(&app, &root_path, &action, false, None, true, Some(ok), Some(message.clone()));
            Ok(ProjectSetupResult { ok, message, output })
        }

        "install-composer-deps" => {
            if !root.is_dir() {
                return Err("Project root directory does not exist.".to_string());
            }
            let (exe, mut args, label) = if let Some(composer) = find_executable(&["composer"]) {
                (composer, vec!["install".to_string()], "composer install".to_string())
            } else if root.join("composer.phar").is_file() {
                let php = find_executable(&["php"]).ok_or_else(|| {
                    "Command not found: php. Please install PHP first.".to_string()
                })?;
                (
                    php,
                    vec!["composer.phar".to_string(), "install".to_string()],
                    "php composer.phar install".to_string(),
                )
            } else {
                return Err("Composer was not found on PATH.".to_string());
            };
            args.push("--no-interaction".to_string());
            let (ok, output) =
                run_streaming_setup_command(&app, &root_path, &action, &exe, &args, &label).await?;
            let message = if ok {
                "composer install completed.".to_string()
            } else {
                "composer install failed. Expand logs for details.".to_string()
            };
            emit_setup_progress(&app, &root_path, &action, false, None, true, Some(ok), Some(message.clone()));
            Ok(ProjectSetupResult { ok, message, output })
        }

        "setup-laravel-env" => {
            let env_example = root.join(".env.example");
            let env_file = root.join(".env");
            if !env_example.is_file() {
                return Err(".env.example file was not found.".to_string());
            }
            let mut output = Vec::new();
            if !env_file.exists() {
                fs::copy(&env_example, &env_file)
                    .map_err(|e| format!("Failed to copy .env.example to .env: {}", e))?;
                let line = "Copied .env.example -> .env".to_string();
                output.push(line.clone());
                emit_setup_progress(&app, &root_path, &action, true, Some(line), false, None, None);
            }
            let mut ok = true;
            let mut message = ".env created from .env.example.".to_string();
            if root.join("artisan").is_file() && root.join("vendor").is_dir() {
                if let Some(php) = find_executable(&["php"]) {
                    let args = vec!["artisan".to_string(), "key:generate".to_string()];
                    let (key_ok, key_out) = run_streaming_setup_command(
                        &app,
                        &root_path,
                        &action,
                        &php,
                        &args,
                        "php artisan key:generate",
                    )
                    .await?;
                    output.extend(key_out);
                    ok = key_ok;
                    if key_ok {
                        message = ".env created and APP_KEY generated.".to_string();
                    } else {
                        message = ".env created, but `php artisan key:generate` failed.".to_string();
                    }
                }
            }
            emit_setup_progress(&app, &root_path, &action, false, None, true, Some(ok), Some(message.clone()));
            Ok(ProjectSetupResult { ok, message, output })
        }

        "install-python-deps" => {
            if !root.is_dir() {
                return Err("Project root directory does not exist.".to_string());
            }
            let mut combined_output = Vec::new();
            let has_uv = find_executable(&["uv"]);
            if let Some(uv_exe) = has_uv {
                if root.join("pyproject.toml").is_file() || root.join("uv.lock").is_file() {
                    let args = vec!["sync".to_string()];
                    let (ok, output) = run_streaming_setup_command(
                        &app,
                        &root_path,
                        &action,
                        &uv_exe,
                        &args,
                        "uv sync",
                    )
                    .await?;
                    let message = if ok {
                        "uv sync completed.".to_string()
                    } else {
                        "uv sync failed. Expand logs for details.".to_string()
                    };
                    emit_setup_progress(&app, &root_path, &action, false, None, true, Some(ok), Some(message.clone()));
                    return Ok(ProjectSetupResult { ok, message, output });
                }
            }

            let py_exe = find_usable_python_exe().ok_or_else(|| {
                "Command not found: usable Python 3 (3.10+). On Windows, avoid the empty Microsoft Store python.exe alias and install Python from python.org or winget.".to_string()
            })?;

            let venv_dir = root.join(".venv");
            if !venv_dir.is_dir() {
                let args = vec!["-m".to_string(), "venv".to_string(), ".venv".to_string()];
                let (venv_ok, venv_out) = run_streaming_setup_command(
                    &app,
                    &root_path,
                    &action,
                    &py_exe,
                    &args,
                    "python3 -m venv .venv",
                )
                .await?;
                combined_output.extend(venv_out);
                if !venv_ok {
                    let msg = "Failed to create Python virtual environment (.venv).".to_string();
                    emit_setup_progress(&app, &root_path, &action, false, None, true, Some(false), Some(msg.clone()));
                    return Ok(ProjectSetupResult {
                        ok: false,
                        message: msg,
                        output: combined_output,
                    });
                }
            }

            let venv_py = if venv_dir.join("bin/python").is_file() {
                venv_dir.join("bin/python")
            } else if venv_dir.join("bin/python3").is_file() {
                venv_dir.join("bin/python3")
            } else {
                venv_dir.join("Scripts/python.exe")
            };
            let venv_py_str = venv_py.to_string_lossy().to_string();

            let (pip_args, label) = if root.join("requirements.txt").is_file() {
                (
                    vec![
                        "-m".to_string(),
                        "pip".to_string(),
                        "install".to_string(),
                        "-r".to_string(),
                        "requirements.txt".to_string(),
                    ],
                    ".venv/bin/python -m pip install -r requirements.txt".to_string(),
                )
            } else if root.join("pyproject.toml").is_file() {
                (
                    vec![
                        "-m".to_string(),
                        "pip".to_string(),
                        "install".to_string(),
                        "-e".to_string(),
                        ".".to_string(),
                    ],
                    ".venv/bin/python -m pip install -e .".to_string(),
                )
            } else {
                let kind_hint = target.as_deref().unwrap_or("");
                let mut args = vec!["-m".to_string(), "pip".to_string(), "install".to_string()];
                match kind_hint {
                    "fastapi" => args.extend(["fastapi".to_string(), "uvicorn".to_string()]),
                    "django" => args.push("django".to_string()),
                    "flask" => args.push("flask".to_string()),
                    "streamlit" => args.push("streamlit".to_string()),
                    "mkdocs" => args.push("mkdocs".to_string()),
                    _ => {
                        return Err("No requirements.txt or pyproject.toml found.".to_string());
                    }
                }
                let lbl = format!(".venv/bin/python {}", args.join(" "));
                (args, lbl)
            };

            let (ok, pip_out) = run_streaming_setup_command(
                &app,
                &root_path,
                &action,
                &venv_py_str,
                &pip_args,
                &label,
            )
            .await?;
            combined_output.extend(pip_out);
            let message = if ok {
                "Python virtual environment and dependencies installed.".to_string()
            } else {
                "Python package installation failed. Expand logs for details.".to_string()
            };
            emit_setup_progress(&app, &root_path, &action, false, None, true, Some(ok), Some(message.clone()));
            Ok(ProjectSetupResult {
                ok,
                message,
                output: combined_output,
            })
        }

        "install-ruby-gems" => {
            let bundle = find_executable(&["bundle"]).ok_or_else(|| {
                "Command not found: bundle. Please install Ruby & Bundler first.".to_string()
            })?;
            let args = vec!["install".to_string()];
            let (ok, output) = run_streaming_setup_command(
                &app,
                &root_path,
                &action,
                &bundle,
                &args,
                "bundle install",
            )
            .await?;
            let message = if ok {
                "bundle install completed.".to_string()
            } else {
                "bundle install failed. Expand logs for details.".to_string()
            };
            emit_setup_progress(&app, &root_path, &action, false, None, true, Some(ok), Some(message.clone()));
            Ok(ProjectSetupResult { ok, message, output })
        }

        other => Err(format!("Unsupported project setup action: {}", other)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_temp_dir(label: &str) -> PathBuf {
        let dir = env::temp_dir().join(format!("onigiri_{}_{}", label, std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn parses_ports_from_scripts_and_configs() {
        assert_eq!(parse_port_from_script("vite --port 7890 --host"), Some(7890));
        assert_eq!(parse_port_from_script("vite --port=4173"), Some(4173));
        assert_eq!(parse_port_from_script("next dev -p 3005"), Some(3005));
        assert_eq!(parse_port_from_script("PORT=8080 node server.js"), Some(8080));
        assert_eq!(parse_port_from_script("vite"), None);

        let vite_cfg = r#"
          export default defineConfig({
            // port: 1111
            server: {
              port: 7890,
              host: true,
            },
          });
        "#;
        assert_eq!(extract_port_property(vite_cfg), Some(7890));
    }

    #[test]
    fn extracts_laravel_artisan_url_and_detects_laravel_before_vite() {
        assert_eq!(
            extract_local_url("   INFO  Server running on [http://127.0.0.1:8000]."),
            Some("http://127.0.0.1:8000".to_string())
        );

        let temp_dir = make_temp_dir("laravel");
        fs::write(temp_dir.join("artisan"), "#!/usr/bin/env php\n").unwrap();
        fs::write(
            temp_dir.join("package.json"),
            r#"{"scripts":{"dev":"vite"},"devDependencies":{"vite":"^8.0.0"}}"#,
        )
        .unwrap();
        fs::write(temp_dir.join("vite.config.js"), "export default {};").unwrap();
        fs::write(
            temp_dir.join(".env"),
            "APP_NAME=Laravel\nAPP_URL=http://localhost:9998\n",
        )
        .unwrap();

        let info = inspect_root_dir(&temp_dir).unwrap();
        assert_eq!(info.kind, "laravel");
        assert_eq!(
            info.dev_command_label.as_deref(),
            Some("php artisan serve --host=127.0.0.1 --port=8000")
        );
        assert_eq!(info.default_url.as_deref(), Some("http://127.0.0.1:8000"));
        assert_eq!(
            laravel_candidate_urls(&temp_dir),
            vec![
                "http://localhost:9998".to_string(),
                "http://127.0.0.1:8000".to_string()
            ]
        );

        // With node_modules + vite script and no manifest, companion Vite mode is enabled
        fs::create_dir_all(temp_dir.join("node_modules")).unwrap();
        let info_vite = inspect_root_dir(&temp_dir).unwrap();
        assert_eq!(info_vite.dev_script.as_deref(), Some("artisan-vite"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn detects_wordpress_compose_ssg_python_static_and_monorepo() {
        // 1. WordPress + compose.yaml
        let wp = make_temp_dir("wp");
        fs::write(wp.join("wp-config.php"), "<?php").unwrap();
        fs::write(wp.join("index.php"), "<?php").unwrap();
        fs::write(
            wp.join("compose.yaml"),
            "services:\n  db:\n    ports:\n      - \"3306:3306\"\n  wordpress:\n    ports:\n      - \"9999:80\"\n",
        )
        .unwrap();
        let wp_info = inspect_root_dir(&wp).unwrap();
        assert_eq!(wp_info.kind, "wordpress");
        assert_eq!(wp_info.default_url.as_deref(), Some("http://localhost:9999"));
        assert_eq!(wp_info.dev_command_label.as_deref(), Some("docker compose up -d"));
        let _ = fs::remove_dir_all(&wp);

        // 2. VitePress (docs:dev script)
        let vp = make_temp_dir("vitepress");
        fs::write(
            vp.join("package.json"),
            r#"{"scripts":{"docs:dev":"vitepress dev docs"},"devDependencies":{"vitepress":"^1.5.0"}}"#,
        )
        .unwrap();
        let vp_info = inspect_root_dir(&vp).unwrap();
        assert_eq!(vp_info.kind, "vitepress");
        assert_eq!(vp_info.dev_script.as_deref(), Some("docs:dev"));
        assert_eq!(vp_info.default_url.as_deref(), Some("http://localhost:5173"));
        let _ = fs::remove_dir_all(&vp);

        // 3. MkDocs & Hugo & Python FastAPI
        let mk = make_temp_dir("mkdocs");
        fs::write(mk.join("mkdocs.yml"), "site_name: Docs\n").unwrap();
        assert_eq!(inspect_root_dir(&mk).unwrap().kind, "mkdocs");
        let _ = fs::remove_dir_all(&mk);

        let hugo = make_temp_dir("hugo");
        fs::write(hugo.join("hugo.toml"), "title = 'Blog'\n").unwrap();
        assert_eq!(inspect_root_dir(&hugo).unwrap().kind, "hugo");
        let _ = fs::remove_dir_all(&hugo);

        let py = make_temp_dir("fastapi");
        fs::write(py.join("pyproject.toml"), "[project]\ndependencies = [\"fastapi\", \"uvicorn\"]\n").unwrap();
        fs::write(py.join("main.py"), "from fastapi import FastAPI\napp = FastAPI()\n").unwrap();
        let py_info = inspect_root_dir(&py).unwrap();
        assert_eq!(py_info.kind, "fastapi");
        assert_eq!(py_info.default_url.as_deref(), Some("http://127.0.0.1:8000"));
        let _ = fs::remove_dir_all(&py);

        // 4. Static HTML site
        let st = make_temp_dir("static");
        fs::write(st.join("index.html"), "<h1>Hi</h1>").unwrap();
        let st_info = inspect_root_dir(&st).unwrap();
        assert_eq!(st_info.kind, "static");
        assert_eq!(st_info.dev_script.as_deref(), Some("static-http"));
        let _ = fs::remove_dir_all(&st);

        // 5. Monorepo apps/web detection
        let mono = make_temp_dir("monorepo");
        fs::create_dir_all(mono.join("apps/web")).unwrap();
        fs::write(
            mono.join("apps/web/package.json"),
            r#"{"name":"mono-web","scripts":{"dev":"vite"},"devDependencies":{"vite":"^6.0.0"}}"#,
        )
        .unwrap();
        let found = find_monorepo_subproject(&mono).unwrap();
        assert_eq!(found.kind, "vite");
        assert_eq!(found.name, "mono-web");
        let _ = fs::remove_dir_all(&mono);
    }

    #[test]
    fn diagnoses_missing_dependencies_and_env_files() {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();

        rt.block_on(async {
            // 1. Vite project without node_modules + .env.example hint
            let vite = make_temp_dir("diag_vite");
            fs::write(
                vite.join("package.json"),
                r#"{"name":"sample","scripts":{"dev":"vite"},"devDependencies":{"vite":"^6.0.0"}}"#,
            )
            .unwrap();
            fs::write(vite.join(".env.example"), "VITE_API_URL=http://localhost:3000\n").unwrap();
            let mut vite_info = inspect_root_dir(&vite).unwrap();
            diagnose_project(&mut vite_info).await;
            let ids: Vec<&str> = vite_info.diagnostics.iter().map(|d| d.id.as_str()).collect();
            if find_executable(&["node"]).is_some() && find_executable(&["npm"]).is_some() {
                assert!(ids.contains(&"missing-node-modules"), "got {:?}", ids);
            } else {
                assert!(ids.contains(&"missing-node") || ids.contains(&"missing-pm"));
            }
            assert!(ids.contains(&"missing-env-example-hint"), "got {:?}", ids);
            let _ = fs::remove_dir_all(&vite);

            // 2. Laravel without .env and without vendor
            let lar = make_temp_dir("diag_laravel");
            fs::write(lar.join("artisan"), "#!/usr/bin/env php\n").unwrap();
            fs::write(lar.join("composer.json"), r#"{"require":{"laravel/framework":"^11.0"}}"#).unwrap();
            fs::write(lar.join(".env.example"), "APP_NAME=Test\n").unwrap();
            let mut lar_info = inspect_root_dir(&lar).unwrap();
            diagnose_project(&mut lar_info).await;
            let lar_ids: Vec<&str> = lar_info.diagnostics.iter().map(|d| d.id.as_str()).collect();
            assert!(lar_ids.contains(&"missing-laravel-env"), "got {:?}", lar_ids);
            assert!(
                lar_ids.contains(&"missing-composer-vendor") || lar_ids.contains(&"missing-composer"),
                "got {:?}",
                lar_ids
            );

            // Laravel with .env specifying sqlite without database.sqlite
            fs::create_dir_all(lar.join("database")).unwrap();
            fs::write(lar.join(".env"), "APP_NAME=Test\nDB_CONNECTION=sqlite\n").unwrap();
            let mut lar_sqlite_info = inspect_root_dir(&lar).unwrap();
            diagnose_project(&mut lar_sqlite_info).await;
            let lar_sqlite_ids: Vec<&str> =
                lar_sqlite_info.diagnostics.iter().map(|d| d.id.as_str()).collect();
            assert!(
                lar_sqlite_ids.contains(&"missing-laravel-sqlite"),
                "got {:?}",
                lar_sqlite_ids
            );
            let _ = fs::remove_dir_all(&lar);

            // 3. WordPress with wp-config-sample.php and without wp-config.php
            let wp = make_temp_dir("diag_wp");
            fs::create_dir_all(wp.join("wp-includes")).unwrap();
            fs::write(wp.join("wp-includes/version.php"), "<?php $wp_version = '6.7';").unwrap();
            fs::write(wp.join("wp-config-sample.php"), "<?php define('DB_NAME', 'wp');").unwrap();
            let mut wp_info = inspect_root_dir(&wp).unwrap();
            diagnose_project(&mut wp_info).await;
            let wp_ids: Vec<&str> = wp_info.diagnostics.iter().map(|d| d.id.as_str()).collect();
            assert!(wp_ids.contains(&"missing-wp-config"), "got {:?}", wp_ids);
            assert!(wp_ids.contains(&"wordpress-db-info"), "got {:?}", wp_ids);
            let _ = fs::remove_dir_all(&wp);

            // 4. Jekyll project diagnostics (missing-ruby / missing-jekyll / missing-jekyll-gems)
            let jk = make_temp_dir("diag_jekyll");
            fs::write(jk.join("_config.yml"), "title: Docs\n").unwrap();
            fs::write(
                jk.join("Gemfile"),
                "source \"https://rubygems.org\"\ngem \"jekyll\"\ngem \"nonexistent_onigiri_test_gem\"\n",
            )
            .unwrap();
            let mut jk_info = inspect_root_dir(&jk).unwrap();
            assert_eq!(jk_info.kind, "jekyll");
            diagnose_project(&mut jk_info).await;
            let jk_ids: Vec<&str> = jk_info.diagnostics.iter().map(|d| d.id.as_str()).collect();
            if find_executable(&["ruby"]).is_none() {
                assert!(jk_ids.contains(&"missing-ruby"), "got {:?}", jk_ids);
            } else if find_executable(&["bundle"]).is_none() && find_executable(&["jekyll"]).is_none() {
                assert!(jk_ids.contains(&"missing-jekyll"), "got {:?}", jk_ids);
            } else if find_executable(&["bundle"]).is_some() {
                assert!(jk_ids.contains(&"missing-jekyll-gems"), "got {:?}", jk_ids);
            }
            let _ = fs::remove_dir_all(&jk);

            // 5. Static project emits zero diagnostics
            let st = make_temp_dir("diag_static");
            fs::write(st.join("index.html"), "<h1>Static</h1>").unwrap();
            let mut st_info = inspect_root_dir(&st).unwrap();
            diagnose_project(&mut st_info).await;
            assert!(st_info.diagnostics.is_empty());
            let _ = fs::remove_dir_all(&st);
        });
    }

    #[test]
    fn extended_path_and_install_hints_are_valid() {
        let joined = extended_path();
        let split_count = env::split_paths(&joined).count();
        assert!(split_count >= 3, "expected multiple PATH entries, got {}", joined);
        for tool in ["docker", "node", "php", "composer", "python", "hugo", "ruby", "bun"] {
            assert!(!os_install_hint(tool).trim().is_empty());
        }
    }

    #[test]
    fn parses_project_windows_cmd_shims() {
        let npm_shim = "\"%dp0%\\node.exe\"  \"%dp0%\\node_modules\\npm\\bin\\npm-cli.js\" %*\r\n";
        assert_eq!(
            parse_windows_cmd_shim_rel(npm_shim).as_deref(),
            Some("node_modules\\npm\\bin\\npm-cli.js")
        );
        let pnpm_shim = "\"%_prog%\"  \"%dp0%\\..\\pnpm\\bin\\pnpm.cjs\" %*\r\n";
        assert_eq!(
            parse_windows_cmd_shim_rel(pnpm_shim).as_deref(),
            Some("..\\pnpm\\bin\\pnpm.cjs")
        );
    }

    #[test]
    fn generates_linux_distro_install_hints() {
        assert!(linux_install_hint_for_pkg_manager("node", "apt").contains("apt-get"));
        assert!(linux_install_hint_for_pkg_manager("node", "dnf").contains("dnf"));
        assert!(linux_install_hint_for_pkg_manager("node", "pacman").contains("pacman"));
        assert!(linux_install_hint_for_pkg_manager("node", "zypper").contains("zypper"));
        assert!(linux_install_hint_for_pkg_manager("docker", "pacman").contains("pacman"));
    }

    #[test]
    fn resolves_windows_executable_skipping_extensionless_shims() {
        let dir = env::temp_dir().join(format!("onigiri_win_exec_proj_{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();

        fs::write(dir.join("npm"), "#!/bin/sh\n").unwrap();
        fs::write(dir.join("npm.cmd"), "@echo off\r\n").unwrap();
        assert_eq!(
            resolve_windows_executable_candidate(&dir, "npm"),
            Some(dir.join("npm.cmd"))
        );

        fs::write(dir.join("composer"), "#!/bin/sh\n").unwrap();
        fs::write(dir.join("composer.bat"), "@echo off\r\n").unwrap();
        assert_eq!(
            resolve_windows_executable_candidate(&dir, "composer"),
            Some(dir.join("composer.bat"))
        );

        fs::write(dir.join("posix_only"), "#!/bin/sh\n").unwrap();
        assert_eq!(resolve_windows_executable_candidate(&dir, "posix_only"), None);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn parses_windows_registry_path_and_expands_env_vars() {
        let reg_output = "\r\nHKEY_CURRENT_USER\\Environment\r\n    Path    REG_EXPAND_SZ    %USERPROFILE%\\AppData\\Local\\Microsoft\\WinGet\\Links;C:\\Program Files\\PHP\\v8.4\r\n";
        let raw = parse_reg_query_path_output(reg_output).expect("should parse REG_EXPAND_SZ path");
        assert_eq!(
            raw,
            "%USERPROFILE%\\AppData\\Local\\Microsoft\\WinGet\\Links;C:\\Program Files\\PHP\\v8.4"
        );
        let expanded = expand_windows_env_vars_with(&raw, |name| {
            if name.eq_ignore_ascii_case("userprofile") {
                Some("C:\\Users\\Alice".to_string())
            } else {
                None
            }
        });
        assert_eq!(
            expanded,
            "C:\\Users\\Alice\\AppData\\Local\\Microsoft\\WinGet\\Links;C:\\Program Files\\PHP\\v8.4"
        );
        assert_eq!(parse_reg_query_path_output("ERROR: Not found"), None);
    }
}
