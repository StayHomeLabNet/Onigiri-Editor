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

                if uses_sqlite {
                    if let Some(php) = select_php_executable() {
                        let scan_dir = prepare_php_ini_scan_dir_if_needed(&php);
                        let has_sqlite = php_loaded_modules(&php, scan_dir.as_deref())
                            .map(|mods| mods.iter().any(|m| m == "pdo_sqlite"))
                            .unwrap_or(true);
                        if !has_sqlite {
                            let hint_cmd = if cfg!(target_os = "windows") {
                                "php --ini".to_string()
                            } else if cfg!(target_os = "macos") {
                                "php -m | grep -i sqlite".to_string()
                            } else {
                                "sudo apt-get install -y php-sqlite3".to_string()
                            };
                            diags.push(ProjectDiagnostic {
                                id: "missing-php-sqlite".to_string(),
                                severity: "warning".to_string(),
                                title_ja: "PHP の pdo_sqlite 拡張が無効です".to_string(),
                                title_en: "PHP pdo_sqlite extension is not enabled".to_string(),
                                description_ja: "Laravel の .env で SQLite が使われていますが、PHP に `pdo_sqlite` ドライバーが見つかりません。`php.ini` で `extension=pdo_sqlite` / `extension=sqlite3` を有効にするか、OS パッケージ（Linux の場合は `php-sqlite3`）をインストールしてください。".to_string(),
                                description_en: "Laravel is configured to use SQLite in .env, but PHP does not have the `pdo_sqlite` driver enabled. Enable `extension=pdo_sqlite` / `extension=sqlite3` in `php.ini` or install the `php-sqlite3` package.".to_string(),
                                command_preview: Some(hint_cmd.clone()),
                                in_app_action: None,
                                action_target: None,
                                in_app_label_ja: None,
                                in_app_label_en: None,
                                terminal_command: Some(hint_cmd),
                                docs_url: None,
                            });
                        }
                    }
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

    // Python Web (Django, FastAPI, Flask, Streamlit, Python backend) & MkDocs
    if matches!(
        info.kind.as_str(),
        "django" | "fastapi" | "flask" | "streamlit" | "python" | "mkdocs"
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

