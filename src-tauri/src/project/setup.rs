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
    apply_php_env_if_needed(&mut cmd, exe);

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
            let mut reader = BufReader::new(out);
            while let Some(line) = read_next_line_lossy(&mut reader).await {
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
            let mut reader = BufReader::new(err);
            while let Some(line) = read_next_line_lossy(&mut reader).await {
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
                let php = select_php_executable().ok_or_else(|| {
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
                if let Some(php) = select_php_executable() {
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

