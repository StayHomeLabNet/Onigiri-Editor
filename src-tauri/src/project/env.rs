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
        let text = decode_process_output_bytes(&out.stdout);
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

        // Respect the user's active PATH and Registry PATH first (excluding WindowsApps stubs),
        // then fall back to common toolchain install locations.
        if let Some(current) = env::var_os("PATH") {
            for entry in env::split_paths(&current) {
                let lower = entry.to_string_lossy().to_ascii_lowercase();
                if !lower.ends_with(r"microsoft\windowsapps") {
                    dirs.push(entry);
                }
            }
        }
        for reg_dir in windows_registry_path_entries() {
            let lower = reg_dir.to_string_lossy().to_ascii_lowercase();
            if !lower.ends_with(r"microsoft\windowsapps") {
                dirs.push(reg_dir);
            }
        }

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
                r".fnm\aliases\default",
                r".volta\bin",
            ] {
                dirs.push(PathBuf::from(&user_profile).join(rel));
            }
        }
        if !appdata.is_empty() {
            dirs.push(PathBuf::from(&appdata).join(r"fnm\aliases\default"));
            push_sorted_subdirs_desc(&mut dirs, &PathBuf::from(&appdata).join("nvm"), Some("v"));
        }
        if !local_appdata.is_empty() {
            dirs.push(PathBuf::from(&local_appdata).join(r"fnm\aliases\default"));
            dirs.push(PathBuf::from(&local_appdata).join(r"Programs\nodejs"));
            dirs.push(PathBuf::from(&local_appdata).join(r"mise\shims"));
        }
        for var in ["NVM_SYMLINK", "NVM_HOME"] {
            if let Ok(val) = env::var(var) {
                if !val.trim().is_empty() {
                    dirs.push(PathBuf::from(val));
                }
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
        let sys_root = env::var("SystemRoot").unwrap_or_else(|_| r"C:\Windows".to_string());
        dirs.push(PathBuf::from(&sys_root).join("System32"));
        dirs.push(PathBuf::from(&sys_root));
        if !local_appdata.is_empty() {
            dirs.push(PathBuf::from(&local_appdata).join(r"Microsoft\WindowsApps"));
        }
    }

    #[cfg(not(target_os = "windows"))]
    if let Some(current) = env::var_os("PATH") {
        dirs.extend(env::split_paths(&current));
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
    // 1. Collect `SET "VAR=%~dp0\..."` / `SET VAR=%dp0%\...` mappings to `.js`/`.mjs`/`.cjs`.
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

    // 2. Inspect actual CLI invocation lines (`%*` or `%1`) so helper scripts like `npm-prefix.js`
    //    used in `FOR /F` blocks are never mistaken for the main CLI entrypoint.
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

#[allow(dead_code)]
fn quote_windows_cmd_token(token: &str) -> String {
    if token.is_empty() {
        return "\"\"".to_string();
    }
    let clean = token.replace(['\r', '\n'], " ");
    if clean.contains([' ', '\t', '"', '&', '|', '<', '>', '^', '(', ')', '%'])
        || !clean.is_ascii()
    {
        format!("\"{}\"", clean.replace('"', "\\\""))
    } else {
        clean
    }
}

#[allow(dead_code)]
fn format_windows_cmd_line(bin: &str, args: &[String]) -> String {
    let mut parts = Vec::with_capacity(args.len() + 1);
    parts.push(format!("\"{}\"", bin.replace('"', "")));
    for arg in args {
        parts.push(quote_windows_cmd_token(arg));
    }
    parts.join(" ")
}

fn build_project_command(bin: &str, args: &[String]) -> Command {
    #[cfg(target_os = "windows")]
    {
        if let Some((node_exe, node_args)) = resolve_windows_cmd_shim(bin, args) {
            return new_background_command(&node_exe, &node_args);
        }
        let lower = bin.to_ascii_lowercase();
        if lower.ends_with(".cmd") || lower.ends_with(".bat") {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            let comspec = env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string());
            let mut std_cmd = std::process::Command::new(comspec);
            std_cmd
                .args(["/d", "/s", "/c"])
                .raw_arg(format!("\"{}\"", format_windows_cmd_line(bin, args)))
                .creation_flags(CREATE_NO_WINDOW);
            return Command::from(std_cmd);
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

fn find_all_executables(name: &str) -> Vec<String> {
    let mut results: Vec<String> = Vec::new();
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
    let path_var = extended_path();
    for dir in env::split_paths(&path_var) {
        #[cfg(target_os = "windows")]
        {
            if let Some(found) = resolve_windows_executable_candidate(&dir, name) {
                let s = found.to_string_lossy().to_string();
                if seen.insert(s.to_ascii_lowercase()) {
                    results.push(s);
                }
            }
        }
        #[cfg(not(target_os = "windows"))]
        {
            let candidate = dir.join(name);
            if candidate.exists() && candidate.is_file() {
                let s = candidate.to_string_lossy().to_string();
                if seen.insert(s.clone()) {
                    results.push(s);
                }
            }
        }
    }
    results
}

fn new_sync_background_command(exe: &str, args: &[&str]) -> std::process::Command {
    let mut cmd = std::process::Command::new(exe);
    cmd.args(args);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

fn php_loaded_modules(php_exe: &str, scan_dir: Option<&str>) -> Option<Vec<String>> {
    let mut cmd = new_sync_background_command(php_exe, &["-m"]);
    cmd.env("PATH", extended_path())
        .stdin(std::process::Stdio::null());
    if let Some(sd) = scan_dir {
        cmd.env("PHP_INI_SCAN_DIR", sd);
    }
    let out = cmd.output().ok()?;
    if !out.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&out.stdout);
    let mods = stdout
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty() && !l.starts_with('['))
        .map(|l| l.to_ascii_lowercase())
        .collect();
    Some(mods)
}

fn select_php_executable() -> Option<String> {
    let candidates = find_all_executables("php");
    if candidates.len() <= 1 {
        return candidates.into_iter().next();
    }
    for cand in &candidates {
        if let Some(mods) = php_loaded_modules(cand, None) {
            if mods.iter().any(|m| m == "pdo_sqlite") {
                return Some(cand.clone());
            }
        }
    }
    candidates.into_iter().next()
}

#[allow(dead_code)]
fn build_windows_php_scan_ini_content(
    current_ext_dir: &str,
    real_ext_dir: &Path,
    missing: &[&str],
) -> Option<String> {
    let mut available_missing: Vec<&str> = Vec::new();
    for &ext in missing {
        let dll = real_ext_dir.join(format!("php_{}.dll", ext));
        if dll.is_file() {
            available_missing.push(ext);
        }
    }
    let first_ext = *available_missing.first()?;
    let mut lines: Vec<String> = Vec::new();
    let trimmed_curr = current_ext_dir.trim();
    let current_has_dll = !trimmed_curr.is_empty()
        && Path::new(trimmed_curr)
            .join(format!("php_{}.dll", first_ext))
            .is_file();
    if !current_has_dll {
        let normalized_ext_dir = real_ext_dir.to_string_lossy().replace('\\', "/");
        lines.push(format!("extension_dir=\"{}\"", normalized_ext_dir));
    }
    for ext in available_missing {
        lines.push(format!("extension={}", ext));
    }
    Some(format!("{}\n", lines.join("\n")))
}

fn prepare_php_ini_scan_dir_if_needed(php_exe: &str) -> Option<String> {
    #[cfg(not(target_os = "windows"))]
    {
        let _ = php_exe;
        return None;
    }

    #[cfg(target_os = "windows")]
    {
        let loaded = php_loaded_modules(php_exe, None)?;
        let desired = ["pdo_sqlite", "sqlite3", "mbstring", "openssl", "curl", "fileinfo"];
        let missing: Vec<&str> = desired
            .iter()
            .copied()
            .filter(|ext| !loaded.iter().any(|m| m == ext))
            .collect();
        if missing.is_empty() {
            return None;
        }

        let mut probe_cmd = new_sync_background_command(
            php_exe,
            &["-r", "echo PHP_BINARY . \"\\n\" . ini_get('extension_dir');"],
        );
        probe_cmd
            .env("PATH", extended_path())
            .stdin(std::process::Stdio::null());
        let out = probe_cmd.output().ok()?;
        if !out.status.success() {
            return None;
        }
        let text = String::from_utf8_lossy(&out.stdout);
        let mut lines = text.lines();
        let php_bin = lines.next().unwrap_or(php_exe).trim();
        let curr_ext_dir = lines.next().unwrap_or("").trim();
        let real_ext_dir = Path::new(php_bin).parent()?.join("ext");
        if !real_ext_dir.is_dir() {
            return None;
        }
        let ini_content = build_windows_php_scan_ini_content(curr_ext_dir, &real_ext_dir, &missing)?;

        let mut hash: u64 = 0xcbf29ce484222325;
        for b in php_bin.to_ascii_lowercase().as_bytes() {
            hash ^= *b as u64;
            hash = hash.wrapping_mul(0x100000001b3);
        }
        let scan_dir = env::temp_dir()
            .join("onigiri-php-scan")
            .join(format!("{:016x}", hash));
        fs::create_dir_all(&scan_dir).ok()?;
        let ini_path = scan_dir.join("onigiri-ext.ini");
        let existing_ini = fs::read_to_string(&ini_path).ok();
        if existing_ini.as_deref() != Some(ini_content.as_str()) {
            fs::write(&ini_path, &ini_content).ok()?;
        }

        if let Some(prev) = env::var_os("PHP_INI_SCAN_DIR") {
            let mut dirs: Vec<PathBuf> = env::split_paths(&prev).collect();
            if !dirs.iter().any(|d| d == &scan_dir) {
                dirs.push(scan_dir);
            }
            return env::join_paths(dirs)
                .ok()
                .map(|s| s.to_string_lossy().to_string());
        }
        Some(scan_dir.to_string_lossy().to_string())
    }
}

fn resolve_php_scan_dir_for_exe(exe: &str) -> Option<String> {
    let stem = Path::new(exe)
        .file_stem()
        .and_then(|s| s.to_str())
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_default();
    let php_exe = if stem == "php" {
        Some(exe.to_string())
    } else if stem == "composer" {
        select_php_executable()
    } else {
        None
    };
    php_exe.and_then(|php| prepare_php_ini_scan_dir_if_needed(&php))
}

fn apply_php_env_if_needed(cmd: &mut Command, exe: &str) {
    if let Some(scan_dir) = resolve_php_scan_dir_for_exe(exe) {
        cmd.env("PHP_INI_SCAN_DIR", scan_dir);
    }
}

fn should_add_artisan_no_reload(args: &[String], has_injected_php_scan_dir: bool) -> bool {
    let is_artisan_serve = args.first().map(|s| s.as_str()) == Some("artisan")
        && args.get(1).map(|s| s.as_str()) == Some("serve");
    if !is_artisan_serve || args.iter().any(|a| a == "--no-reload") {
        return false;
    }
    has_injected_php_scan_dir
        || env::var_os("PHP_INI_SCAN_DIR").is_some()
        || env::var_os("PHPRC").is_some()
}

