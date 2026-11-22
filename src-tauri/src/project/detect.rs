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
    detect_python_web_with_host(root, false)
}

fn detect_python_web_with_host(root: &Path, allow_lan: bool) -> Option<PythonWebSpec> {
    detect_python_web_with_host_and_port(root, allow_lan, None)
}

fn detect_python_web_with_host_and_port(
    root: &Path,
    allow_lan: bool,
    port: Option<u16>,
) -> Option<PythonWebSpec> {
    let bind_host = if allow_lan { "0.0.0.0" } else { "127.0.0.1" };
    if root.join("manage.py").is_file() {
        let p = port.unwrap_or(8000);
        let addr = format!("{}:{}", bind_host, p);
        return Some(PythonWebSpec {
            kind: "django",
            dev_script: "python-django",
            default_url: "http://127.0.0.1:8000",
            command_label: format!("python manage.py runserver {}", addr),
            args: vec![
                "manage.py".to_string(),
                "runserver".to_string(),
                addr,
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
        let p = port.unwrap_or(8501);
        return Some(PythonWebSpec {
            kind: "streamlit",
            dev_script: "python-streamlit",
            default_url: "http://localhost:8501",
            command_label: format!(
                "streamlit run {} --server.headless true --server.address {} --server.port {}",
                entry, bind_host, p
            ),
            args: vec![
                "-m".to_string(),
                "streamlit".to_string(),
                "run".to_string(),
                entry.to_string(),
                "--server.headless".to_string(),
                "true".to_string(),
                "--server.address".to_string(),
                bind_host.to_string(),
                "--server.port".to_string(),
                p.to_string(),
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
        let p = port.unwrap_or(8000);
        return Some(PythonWebSpec {
            kind: "fastapi",
            dev_script: "python-fastapi",
            default_url: "http://127.0.0.1:8000",
            command_label: format!("uvicorn {} --reload --host {} --port {}", module, bind_host, p),
            args: vec![
                "-m".to_string(),
                "uvicorn".to_string(),
                module.to_string(),
                "--reload".to_string(),
                "--host".to_string(),
                bind_host.to_string(),
                "--port".to_string(),
                p.to_string(),
            ],
            uses_uv_ok: true,
        });
    }

    if deps_blob.contains("flask") {
        let entry = ["app.py", "main.py", "wsgi.py"]
            .iter()
            .find(|rel| root.join(rel).is_file())
            .copied()?;
        let p = port.unwrap_or(5000);
        return Some(PythonWebSpec {
            kind: "flask",
            dev_script: "python-flask",
            default_url: "http://127.0.0.1:5000",
            command_label: format!(
                "flask --app {} run --debug --host {} --port {}",
                entry, bind_host, p
            ),
            args: vec![
                "-m".to_string(),
                "flask".to_string(),
                "--app".to_string(),
                entry.to_string(),
                "run".to_string(),
                "--debug".to_string(),
                "--host".to_string(),
                bind_host.to_string(),
                "--port".to_string(),
                p.to_string(),
            ],
            uses_uv_ok: true,
        });
    }

    // Generic Python backend / API / engine script in a project with pyproject.toml or requirements.txt
    if let Some(entry) = [
        "server.py",
        "api.py",
        "app.py",
        "main.py",
        "run.py",
        "src/main.py",
        "src/server.py",
        "src/app.py",
    ]
    .iter()
    .find(|rel| root.join(rel).is_file())
    .copied()
    {
        return Some(PythonWebSpec {
            kind: "python",
            dev_script: "python-run",
            default_url: if deps_blob.contains("gradio") {
                "http://127.0.0.1:7860"
            } else {
                "http://127.0.0.1:8000"
            },
            command_label: format!("python {}", entry),
            args: vec![entry.to_string()],
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
    inspect_root_dir_with_script(root, None)
}

fn inspect_root_dir_with_script(
    root: &Path,
    preferred_script: Option<&str>,
) -> Result<ProjectInfo, String> {
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
            let scripts = vec!["artisan-vite".to_string(), "artisan-serve".to_string()];
            let chosen = preferred_script
                .filter(|s| scripts.iter().any(|k| k == *s))
                .unwrap_or("artisan-vite");
            let cmd_label = if chosen == "artisan-serve" {
                "php artisan serve --host=127.0.0.1 --port=8000".to_string()
            } else {
                "php artisan serve + vite".to_string()
            };
            (Some(chosen.to_string()), scripts, cmd_label)
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
            targets: Vec::new(),
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
                targets: Vec::new(),
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
            targets: Vec::new(),
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
            targets: Vec::new(),
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
            targets: Vec::new(),
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
            targets: Vec::new(),
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

        let dev_script = preferred_script
            .filter(|s| scripts.iter().any(|k| k == *s))
            .map(|s| s.to_string())
            .or_else(|| {
                ["dev", "docs:dev", "start", "preview", "docs:preview", "serve"]
                    .iter()
                    .find(|s| scripts.iter().any(|k| k == *s))
                    .map(|s| (*s).to_string())
            });

        let compose_ports = parse_compose_ports(root);
        if dev_script.is_some() || compose_ports.is_empty() {
            let script_cmd = dev_script
                .as_ref()
                .and_then(|sc| scripts_map.and_then(|m| m.get(sc)).and_then(|v| v.as_str()));

            let is_vite_preview = matches!(
                dev_script.as_deref(),
                Some("preview") | Some("docs:preview")
            ) || script_cmd
                .map(|c| c.to_ascii_lowercase().contains("vite preview"))
                .unwrap_or(false);

            let pm = detect_package_manager(root);
            let default_port = script_cmd
                .and_then(parse_port_from_script)
                .or_else(|| {
                    if is_vite_preview {
                        Some(4173)
                    } else {
                        parse_port_from_config(root, kind)
                    }
                })
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
                targets: Vec::new(),
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
            targets: Vec::new(),
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
                targets: Vec::new(),
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
            targets: Vec::new(),
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
            targets: Vec::new(),
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
            targets: Vec::new(),
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
        targets: Vec::new(),
    })
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

fn to_project_target(workspace_root: &Path, info: &ProjectInfo) -> ProjectTarget {
    let target_path = Path::new(&info.root_path);
    let relative_path = target_path
        .strip_prefix(workspace_root)
        .ok()
        .map(|rel| {
            let s = rel.to_string_lossy().replace('\\', "/");
            if s.is_empty() {
                ".".to_string()
            } else {
                s
            }
        })
        .unwrap_or_else(|| ".".to_string());
    let label = if relative_path == "." {
        format!("{} ({})", info.name, info.kind)
    } else {
        format!("{} ({})", relative_path, info.kind)
    };
    ProjectTarget {
        root_path: info.root_path.clone(),
        label,
        relative_path,
        kind: info.kind.clone(),
        dev_script: info.dev_script.clone(),
        scripts: info.scripts.clone(),
        default_url: info.default_url.clone(),
    }
}

fn discover_monorepo_targets(root: &Path) -> Vec<ProjectTarget> {
    let mut dirs: Vec<PathBuf> = vec![root.to_path_buf()];
    if let Ok(entries) = fs::read_dir(root) {
        let mut sub_dirs: Vec<PathBuf> = Vec::new();
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
            sub_dirs.push(p.clone());

            if matches!(
                name.as_str(),
                "apps"
                    | "packages"
                    | "services"
                    | "sites"
                    | "examples"
                    | "frontend"
                    | "backend"
                    | "web"
                    | "server"
                    | "gui"
                    | "engine"
                    | "api"
                    | "client"
            ) {
                if let Ok(sub_entries) = fs::read_dir(&p) {
                    for sub in sub_entries.flatten() {
                        let sp = sub.path();
                        if sp.is_dir() {
                            let sname = sub.file_name().to_string_lossy().to_string();
                            if !sname.starts_with('.')
                                && !matches!(
                                    sname.as_str(),
                                    "node_modules" | "target" | "dist" | "build" | "vendor" | ".venv" | "venv"
                                )
                            {
                                sub_dirs.push(sp);
                            }
                        }
                    }
                }
            }
        }
        sub_dirs.sort();
        dirs.extend(sub_dirs);
    }

    let mut seen_paths: Vec<String> = Vec::new();
    let mut targets: Vec<ProjectTarget> = Vec::new();
    for dir in dirs {
        if let Ok(info) = inspect_root_dir(&dir) {
            if info.kind == "none" || info.dev_command_label.is_none() {
                continue;
            }
            if seen_paths.iter().any(|p| p == &info.root_path) {
                continue;
            }
            seen_paths.push(info.root_path.clone());
            targets.push(to_project_target(root, &info));
        }
    }

    targets.sort_by(|a, b| {
        let prio_a = kind_priority(&a.kind);
        let prio_b = kind_priority(&b.kind);
        if prio_a != prio_b {
            return prio_b.cmp(&prio_a);
        }
        if a.relative_path == "." && b.relative_path != "." {
            return std::cmp::Ordering::Less;
        }
        if b.relative_path == "." && a.relative_path != "." {
            return std::cmp::Ordering::Greater;
        }
        a.relative_path.cmp(&b.relative_path)
    });

    targets
}

fn find_monorepo_subproject(root: &Path) -> Option<ProjectInfo> {
    let targets = discover_monorepo_targets(root);
    let first = targets.into_iter().find(|t| t.relative_path != ".")?;
    inspect_root_dir(Path::new(&first.root_path)).ok()
}

#[tauri::command]
pub async fn inspect_workspace_project(
    root_path: String,
    target_root: Option<String>,
    script_name: Option<String>,
) -> Result<ProjectInfo, String> {
    let root = Path::new(&root_path);
    let targets = discover_monorepo_targets(root);

    let chosen_dir = target_root
        .as_deref()
        .and_then(|tr| {
            targets
                .iter()
                .find(|t| t.root_path == tr)
                .map(|t| PathBuf::from(&t.root_path))
                .or_else(|| {
                    let p = PathBuf::from(tr);
                    if p.is_dir() && p.starts_with(root) {
                        Some(p)
                    } else {
                        None
                    }
                })
        })
        .or_else(|| targets.first().map(|t| PathBuf::from(&t.root_path)));

    let mut info = if let Some(dir) = chosen_dir {
        inspect_root_dir_with_script(&dir, script_name.as_deref())?
    } else {
        inspect_root_dir_with_script(root, script_name.as_deref())?
    };
    if info.kind == "none" {
        if let Some(sub) = find_monorepo_subproject(root) {
            info = sub;
        }
    }
    info.targets = targets;
    finalize_project_probe(&mut info).await;
    Ok(info)
}

#[tauri::command]
pub async fn inspect_project_for_path(
    path: String,
    script_name: Option<String>,
) -> Result<ProjectInfo, String> {
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

    let mut info = inspect_root_dir_with_script(&chosen_dir, script_name.as_deref())?;
    if info.kind != "none" && info.dev_command_label.is_some() {
        info.targets = vec![to_project_target(&chosen_dir, &info)];
    }
    finalize_project_probe(&mut info).await;
    Ok(info)
}

