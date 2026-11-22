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
        let modern_npm_cmd = "\
:: Created by npm, please don't edit manually.\r\n\
@ECHO OFF\r\n\
SETLOCAL\r\n\
SET \"NODE_EXE=%~dp0\\node.exe\"\r\n\
SET \"NPM_PREFIX_JS=%~dp0\\node_modules\\npm\\bin\\npm-prefix.js\"\r\n\
SET \"NPM_CLI_JS=%~dp0\\node_modules\\npm\\bin\\npm-cli.js\"\r\n\
FOR /F \"delims=\" %%F IN ('CALL \"%NODE_EXE%\" \"%NPM_PREFIX_JS%\"') DO (\r\n\
  SET \"NPM_PREFIX_NPM_CLI_JS=%%F\\node_modules\\npm\\bin\\npm-cli.js\"\r\n\
)\r\n\
IF EXIST \"%NPM_PREFIX_NPM_CLI_JS%\" (\r\n\
  SET \"NPM_CLI_JS=%NPM_PREFIX_NPM_CLI_JS%\"\r\n\
)\r\n\
\"%NODE_EXE%\" \"%NPM_CLI_JS%\" %*\r\n";
        assert_eq!(
            parse_windows_cmd_shim_rel(modern_npm_cmd).as_deref(),
            Some("node_modules\\npm\\bin\\npm-cli.js")
        );
        let pnpm_shim = "\"%_prog%\"  \"%dp0%\\..\\pnpm\\bin\\pnpm.cjs\" %*\r\n";
        assert_eq!(
            parse_windows_cmd_shim_rel(pnpm_shim).as_deref(),
            Some("..\\pnpm\\bin\\pnpm.cjs")
        );
        let corepack_shim = "\
@SETLOCAL\r\n\
@IF EXIST \"%~dp0\\node.exe\" (\r\n\
  \"%~dp0\\node.exe\" \"%~dp0\\node_modules\\corepack\\dist\\pnpm.js\" %*\r\n\
)\r\n";
        assert_eq!(
            parse_windows_cmd_shim_rel(corepack_shim).as_deref(),
            Some("node_modules\\corepack\\dist\\pnpm.js")
        );
        assert_eq!(
            parse_windows_cmd_shim_rel("@echo off\r\n\"%~dp0\\tool.exe\" %*\r\n"),
            None
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

    #[test]
    fn extracts_and_merges_project_lan_urls() {
        assert_eq!(
            extract_lan_url("┃ Local    http://localhost:4321/"),
            None
        );
        assert_eq!(
            extract_lan_url("┃ Network  http://192.168.1.30:4321/"),
            Some("http://192.168.1.30:4321/".to_string())
        );
        assert_eq!(
            extract_lan_url("  ➜  Network: http://10.0.0.12:5173"),
            Some("http://10.0.0.12:5173/".to_string())
        );
        assert_eq!(extract_lan_url("Listening on http://0.0.0.0:8000/"), None);
        assert_eq!(extract_lan_url("Link-local http://169.254.1.2:3000/"), None);

        let mut urls = Vec::new();
        merge_lan_url(&mut urls, "http://192.168.1.30:4321/".to_string());
        merge_lan_url(&mut urls, "http://192.168.1.30:4321".to_string());
        merge_lan_url(&mut urls, "http://192.168.50.10:4321/".to_string());
        assert_eq!(
            urls,
            vec![
                "http://192.168.1.30:4321/".to_string(),
                "http://192.168.50.10:4321/".to_string(),
            ]
        );
    }

    #[test]
    fn appends_node_lan_flags_appropriately() {
        // Astro with npm -> inserts `-- --host 0.0.0.0`
        let mut npm_astro = vec!["run".to_string(), "dev".to_string()];
        append_node_lan_args(&mut npm_astro, "npm", "astro", Some("astro dev"));
        assert_eq!(npm_astro, vec!["run", "dev", "--", "--host", "0.0.0.0"]);

        // Vite with pnpm -> inserts `--host 0.0.0.0` without `--`
        let mut pnpm_vite = vec!["run".to_string(), "dev".to_string()];
        append_node_lan_args(&mut pnpm_vite, "pnpm", "vite", Some("vite"));
        assert_eq!(pnpm_vite, vec!["run", "dev", "--host", "0.0.0.0"]);

        // Next.js with npm -> inserts `-- -H 0.0.0.0`
        let mut npm_next = vec!["run".to_string(), "dev".to_string()];
        append_node_lan_args(&mut npm_next, "npm", "next", Some("next dev"));
        assert_eq!(npm_next, vec!["run", "dev", "--", "-H", "0.0.0.0"]);

        // Script already specifies `--host` -> does not duplicate
        let mut existing_host = vec!["run".to_string(), "dev".to_string()];
        append_node_lan_args(&mut existing_host, "npm", "astro", Some("astro dev --host"));
        assert_eq!(existing_host, vec!["run", "dev"]);

        // Vite with npm + custom port (without LAN) -> inserts `-- --port 5180`
        let mut npm_vite_port = vec!["run".to_string(), "dev".to_string()];
        append_node_dev_args(&mut npm_vite_port, "npm", "vite", Some("vite --port 5173"), false, Some(5180));
        assert_eq!(npm_vite_port, vec!["run", "dev", "--", "--port", "5180"]);

        // Next.js with npm + LAN + custom port -> inserts `-- -H 0.0.0.0 -p 3100`
        let mut npm_next_both = vec!["run".to_string(), "dev".to_string()];
        append_node_dev_args(&mut npm_next_both, "npm", "next", Some("next dev"), true, Some(3100));
        assert_eq!(npm_next_both, vec!["run", "dev", "--", "-H", "0.0.0.0", "-p", "3100"]);
    }

    #[test]
    fn python_web_spec_binds_localhost_or_lan_by_flag() {
        let py = make_temp_dir("py_lan_host");
        fs::write(
            py.join("pyproject.toml"),
            "[project]\ndependencies = [\"fastapi\", \"uvicorn\"]\n",
        )
        .unwrap();
        fs::write(py.join("main.py"), "from fastapi import FastAPI\napp = FastAPI()\n").unwrap();

        let local_spec = detect_python_web_with_host(&py, false).unwrap();
        assert!(local_spec.args.contains(&"127.0.0.1".to_string()));
        assert!(!local_spec.args.contains(&"0.0.0.0".to_string()));
        assert!(local_spec.args.contains(&"8000".to_string()));

        let lan_spec = detect_python_web_with_host(&py, true).unwrap();
        assert!(lan_spec.args.contains(&"0.0.0.0".to_string()));
        assert!(!lan_spec.args.contains(&"127.0.0.1".to_string()));

        let custom_port_spec = detect_python_web_with_host_and_port(&py, false, Some(9001)).unwrap();
        assert!(custom_port_spec.args.contains(&"9001".to_string()));
        assert!(!custom_port_spec.args.contains(&"8000".to_string()));

        let _ = fs::remove_dir_all(&py);
    }

    #[test]
    fn builds_windows_php_scan_ini_for_missing_extensions() {
        let dir = make_temp_dir("win_php_ext");
        let ext_dir = dir.join("ext");
        fs::create_dir_all(&ext_dir).unwrap();
        fs::write(ext_dir.join("php_pdo_sqlite.dll"), b"").unwrap();
        fs::write(ext_dir.join("php_mbstring.dll"), b"").unwrap();

        // When current extension_dir doesn't point to real ext_dir, sets extension_dir + extensions
        let ini = build_windows_php_scan_ini_content(
            "C:\\php\\ext",
            &ext_dir,
            &["pdo_sqlite", "sqlite3", "mbstring"],
        )
        .expect("should produce ini content");
        assert!(ini.contains("extension_dir="));
        assert!(ini.contains("extension=pdo_sqlite"));
        assert!(ini.contains("extension=mbstring"));
        assert!(!ini.contains("extension=sqlite3"));

        // When current extension_dir already matches real ext_dir, omits extension_dir
        let ini2 = build_windows_php_scan_ini_content(
            &ext_dir.to_string_lossy(),
            &ext_dir,
            &["pdo_sqlite"],
        )
        .expect("should produce extension line only");
        assert!(!ini2.contains("extension_dir="));
        assert_eq!(ini2, "extension=pdo_sqlite\n");

        // When none of the missing DLLs exist, returns None
        assert!(build_windows_php_scan_ini_content("", &ext_dir, &["curl"]).is_none());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn adds_no_reload_to_artisan_serve_only_when_php_ini_env_active() {
        let serve_args = vec![
            "artisan".to_string(),
            "serve".to_string(),
            "--host=127.0.0.1".to_string(),
            "--port=8000".to_string(),
        ];
        assert!(should_add_artisan_no_reload(&serve_args, true));

        let mut already = serve_args.clone();
        already.push("--no-reload".to_string());
        assert!(!should_add_artisan_no_reload(&already, true));

        let other_args = vec!["-S".to_string(), "127.0.0.1:8000".to_string()];
        assert!(!should_add_artisan_no_reload(&other_args, true));
    }

    #[test]
    fn formats_windows_cmd_lines_with_spaces_and_non_ascii() {
        assert_eq!(quote_windows_cmd_token("dev"), "dev");
        assert_eq!(quote_windows_cmd_token(""), "\"\"");
        assert_eq!(quote_windows_cmd_token("ドキュメント"), "\"ドキュメント\"");
        assert_eq!(quote_windows_cmd_token("a b"), "\"a b\"");

        let line = format_windows_cmd_line(
            "C:\\Program Files\\nodejs\\npm.cmd",
            &["run".to_string(), "dev".to_string(), "C:\\ドキュメント\\app".to_string()],
        );
        assert_eq!(
            line,
            "\"C:\\Program Files\\nodejs\\npm.cmd\" run dev \"C:\\ドキュメント\\app\""
        );
    }

    #[test]
    fn decodes_utf8_and_shift_jis_process_output_lines() {
        assert_eq!(
            decode_process_output_bytes_with_fallback("Local: http://localhost:5173/\r\n".as_bytes(), true),
            "Local: http://localhost:5173/"
        );
        let (encoded, _, _) = encoding_rs::SHIFT_JIS.encode("ドキュメント\\Repos\\Shift-for-Retail\r\n");
        assert_eq!(
            decode_process_output_bytes_with_fallback(encoded.as_ref(), true),
            "ドキュメント\\Repos\\Shift-for-Retail"
        );
    }

    #[test]
    fn discovers_monorepo_targets_and_selects_scripts() {
        let root = make_temp_dir("monorepo_targets");
        let gui = root.join("gui");
        let engine = root.join("engine");
        fs::create_dir_all(&gui).unwrap();
        fs::create_dir_all(&engine).unwrap();

        fs::write(
            gui.join("package.json"),
            r#"{"name":"retail-gui","devDependencies":{"vite":"^5.0.0"},"scripts":{"dev":"vite --port 5173","preview":"vite preview","build":"vite build"}}"#,
        )
        .unwrap();
        fs::write(
            engine.join("pyproject.toml"),
            "[project]\ndependencies = [\"fastapi\", \"uvicorn\"]\n",
        )
        .unwrap();
        fs::write(engine.join("main.py"), "from fastapi import FastAPI\napp = FastAPI()\n").unwrap();

        let targets = discover_monorepo_targets(&root);
        assert_eq!(targets.len(), 2);
        assert!(targets.iter().any(|t| t.relative_path == "gui" && t.kind == "vite"));
        assert!(targets.iter().any(|t| t.relative_path == "engine" && t.kind == "fastapi"));

        let gui_preview = inspect_root_dir_with_script(&gui, Some("preview")).unwrap();
        assert_eq!(gui_preview.dev_script.as_deref(), Some("preview"));
        assert_eq!(gui_preview.default_url.as_deref(), Some("http://localhost:4173"));

        // Next.js with --port flag respects `--port` rather than mixing `-p`
        let mut next_long_port = vec!["run".to_string(), "dev".to_string()];
        append_node_dev_args(
            &mut next_long_port,
            "npm",
            "next",
            Some("next dev --port 3000"),
            false,
            Some(3050),
        );
        assert_eq!(next_long_port, vec!["run", "dev", "--", "--port", "3050"]);

        // Monorepo path relationship check
        assert!(are_monorepo_related_paths(
            &gui.to_string_lossy(),
            &engine.to_string_lossy()
        ));
        assert!(are_monorepo_related_paths(
            &root.to_string_lossy(),
            &gui.to_string_lossy()
        ));
        assert!(!are_monorepo_related_paths(
            &gui.to_string_lossy(),
            &gui.to_string_lossy()
        ));

        // Generic Python script in monorepo subfolder (e.g. engine with requirements.txt + server.py)
        let py_engine = root.join("py-engine");
        fs::create_dir_all(&py_engine).unwrap();
        fs::write(py_engine.join("requirements.txt"), "requests==2.31.0\n").unwrap();
        fs::write(py_engine.join("server.py"), "print('running')\n").unwrap();
        let py_info = inspect_root_dir(&py_engine).unwrap();
        assert_eq!(py_info.kind, "python");
        assert_eq!(py_info.dev_command_label.as_deref(), Some("python server.py"));

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn finds_free_port_when_preferred_port_is_occupied() {
        let occupied = std::net::TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let occupied_port = occupied.local_addr().unwrap().port();
        let suggested = find_available_port_from(occupied_port).unwrap();
        assert_ne!(suggested, occupied_port);
        assert!(suggested >= 1024);
    }

    #[test]
    fn classifies_server_error_log_lines_and_counts_them() {
        let logs = vec![
            "$ npm run dev".to_string(),
            "VITE v6.3.5 ready in 190 ms".to_string(),
            "Found 0 errors. Watching for file changes.".to_string(),
            "TypeError: Cannot read properties of undefined".to_string(),
            "Error: listen EADDRINUSE: address already in use 127.0.0.1:3000".to_string(),
        ];
        assert!(!is_error_log_line(&logs[0]));
        assert!(!is_error_log_line(&logs[1]));
        assert!(!is_error_log_line(&logs[2]));
        assert!(is_error_log_line(&logs[3]));
        assert!(is_error_log_line(&logs[4]));
        assert_eq!(count_error_log_lines(&logs), 2);
    }

    #[test]
    fn handles_windows_case_and_verbatim_prefixes_in_monorepo_path_matching() {
        assert!(are_monorepo_related_paths(
            r"\\?\C:\Users\Dev\Repo\apps\web",
            r"c:\users\dev\repo\apps\api"
        ));
        assert!(are_monorepo_related_paths(
            r"C:\Repo",
            r"c:\repo\packages\docs"
        ));
        assert!(!are_monorepo_related_paths(
            r"C:\Repo\apps\web",
            r"c:\repo\apps\web"
        ));
    }
}

