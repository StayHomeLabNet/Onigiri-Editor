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

fn decode_process_output_bytes_with_fallback(bytes: &[u8], shift_jis_fallback: bool) -> String {
    let trimmed = bytes.strip_suffix(b"\n").unwrap_or(bytes);
    let trimmed = trimmed.strip_suffix(b"\r").unwrap_or(trimmed);
    if let Ok(utf8) = std::str::from_utf8(trimmed) {
        return utf8.to_string();
    }
    if shift_jis_fallback {
        let (cow, _, _) = encoding_rs::SHIFT_JIS.decode(trimmed);
        return cow.into_owned();
    }
    String::from_utf8_lossy(trimmed).into_owned()
}

fn decode_process_output_bytes(bytes: &[u8]) -> String {
    decode_process_output_bytes_with_fallback(bytes, cfg!(target_os = "windows"))
}

async fn read_next_line_lossy<R: AsyncBufReadExt + Unpin>(reader: &mut R) -> Option<String> {
    let mut buf = Vec::new();
    match reader.read_until(b'\n', &mut buf).await {
        Ok(0) => None,
        Ok(_) => Some(decode_process_output_bytes(&buf)),
        Err(_) => None,
    }
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

fn extract_lan_url(line: &str) -> Option<String> {
    let clean = strip_ansi(line);
    for prefix in ["http://", "https://"] {
        let mut rest = clean.as_str();
        while let Some(idx) = rest.find(prefix) {
            let slice = &rest[idx..];
            let end = slice
                .find(|c: char| {
                    c.is_whitespace() || matches!(c, '"' | '\'' | ')' | ']' | '>' | '`')
                })
                .unwrap_or(slice.len());
            let candidate = slice[..end].trim_end_matches(['.', ',', ';']).to_string();
            if let Ok(parsed) = url::Url::parse(&candidate) {
                if let Some(url::Host::Ipv4(ipv4)) = parsed.host() {
                    if !ipv4.is_loopback() && !ipv4.is_unspecified() && !ipv4.is_link_local() {
                        let normalized = if candidate.ends_with('/') {
                            candidate
                        } else {
                            format!("{}/", candidate)
                        };
                        return Some(normalized);
                    }
                }
            }
            rest = &slice[prefix.len()..];
        }
    }
    None
}

fn merge_lan_url(urls: &mut Vec<String>, candidate: String) {
    let norm_cand = candidate.trim_end_matches('/');
    if urls.iter().any(|u| u.trim_end_matches('/') == norm_cand) {
        return;
    }
    urls.push(candidate);
}

fn build_lan_urls_for_url(url_str: &str) -> Vec<String> {
    let Ok(parsed) = url::Url::parse(url_str) else {
        return Vec::new();
    };
    let Some(port) = parsed.port_or_known_default() else {
        return Vec::new();
    };
    let scheme = parsed.scheme();
    crate::live_preview::detect_lan_ipv4s()
        .into_iter()
        .map(|ip| format!("{}://{}:{}/", scheme, ip, port))
        .collect()
}

fn compute_project_lan_urls(allow_lan: bool, url_opt: Option<&str>) -> Vec<String> {
    if !allow_lan {
        return Vec::new();
    }
    url_opt.map(build_lan_urls_for_url).unwrap_or_default()
}

async fn probe_lan_reachable(url_str: &str, timeout_ms: u64) -> Vec<String> {
    let Ok(parsed) = url::Url::parse(url_str) else {
        return Vec::new();
    };
    let Some(port) = parsed.port_or_known_default() else {
        return Vec::new();
    };
    let scheme = parsed.scheme().to_string();
    let dur = Duration::from_millis(timeout_ms);
    let ips = crate::live_preview::detect_lan_ipv4s();
    let mut join_set = tokio::task::JoinSet::new();
    for (idx, ip) in ips.into_iter().enumerate() {
        let scheme_clone = scheme.clone();
        join_set.spawn(async move {
            let ok = matches!(
                tokio::time::timeout(dur, tokio::net::TcpStream::connect((ip.as_str(), port))).await,
                Ok(Ok(_))
            );
            (idx, ok, format!("{}://{}:{}/", scheme_clone, ip, port))
        });
    }
    let mut results: Vec<(usize, String)> = Vec::new();
    while let Some(res) = join_set.join_next().await {
        if let Ok((idx, true, url)) = res {
            results.push((idx, url));
        }
    }
    results.sort_by_key(|(idx, _)| *idx);
    results.into_iter().map(|(_, url)| url).collect()
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

fn kill_pid_sync(pid: u32) {
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

async fn kill_extra_server(srv: &mut ExtraManagedServer) {
    if let Some(task) = srv.static_server_task.take() {
        task.abort();
    }
    for pid_opt in [srv.pid.take(), srv.aux_pid.take()] {
        if let Some(pid) = pid_opt {
            kill_pid_sync(pid);
        }
    }
    if let Some(mut child) = srv.child.take() {
        let _ = child.kill().await;
    }
    if let Some(mut aux) = srv.aux_child.take() {
        let _ = aux.kill().await;
    }
}

fn kill_extra_server_sync(srv: &mut ExtraManagedServer) {
    if let Some(task) = srv.static_server_task.take() {
        task.abort();
    }
    for pid_opt in [srv.pid.take(), srv.aux_pid.take()] {
        if let Some(pid) = pid_opt {
            kill_pid_sync(pid);
        }
    }
    if let Some(mut child) = srv.child.take() {
        let _ = child.start_kill();
    }
    if let Some(mut aux) = srv.aux_child.take() {
        let _ = aux.start_kill();
    }
}

async fn kill_primary_server(guard: &mut ProjectServerInner) {
    guard.generation = guard.generation.saturating_add(1);
    if let Some(task) = guard.static_server_task.take() {
        task.abort();
    }
    for pid_opt in [guard.pid.take(), guard.aux_pid.take()] {
        if let Some(pid) = pid_opt {
            kill_pid_sync(pid);
        }
    }
    if let Some(mut child) = guard.child.take() {
        let _ = child.kill().await;
    }
    if let Some(mut aux) = guard.aux_child.take() {
        let _ = aux.kill().await;
    }
    guard.primary_name = None;
    guard.primary_logs.clear();
    guard.requested_port = None;
    guard.requested_script = None;
    guard.status.running = false;
    guard.status.starting = false;
    guard.status.external = false;
    guard.status.allow_lan = false;
    guard.status.requested_port = None;
    guard.status.requested_script = None;
    guard.status.lan_urls.clear();
}

async fn kill_existing_server(guard: &mut ProjectServerInner) {
    kill_primary_server(guard).await;
    for mut extra in guard.extra_servers.drain(..) {
        kill_extra_server(&mut extra).await;
    }
    guard.status.running_targets.clear();
}

pub(crate) fn is_error_log_line(line: &str) -> bool {
    let lower = line.to_ascii_lowercase();
    if lower.is_empty() {
        return false;
    }
    if lower.contains("0 error") {
        return false;
    }
    const KEYWORDS: &[&str] = &[
        "error",
        "exception",
        "traceback",
        "fatal",
        "panic",
        "err!",
        "syntaxerror",
        "typeerror",
        "referenceerror",
        "module not found",
        "cannot find module",
        "failed to compile",
        "build failed",
        "address already in use",
        "eaddrinuse",
    ];
    KEYWORDS.iter().any(|kw| lower.contains(kw))
}

pub(crate) fn count_error_log_lines(logs: &[String]) -> usize {
    logs.iter().filter(|l| is_error_log_line(l)).count()
}

fn push_log_bounded(logs: &mut Vec<String>, entry: String, cap: usize) {
    logs.push(entry);
    if logs.len() > cap {
        let excess = logs.len() - cap;
        logs.drain(0..excess);
    }
}

fn normalize_path_for_monorepo_compare(raw: &str) -> String {
    let mut s = raw.replace('\\', "/");
    if let Some(stripped) = s.strip_prefix("//?/") {
        s = stripped.to_string();
    }
    let trimmed = s.trim_end_matches('/').to_string();
    let looks_windows_drive = trimmed.as_bytes().len() >= 2
        && trimmed.as_bytes()[0].is_ascii_alphabetic()
        && trimmed.as_bytes()[1] == b':';
    if cfg!(target_os = "windows") || looks_windows_drive {
        trimmed.to_ascii_lowercase()
    } else {
        trimmed
    }
}

pub(crate) fn are_monorepo_related_paths(a: &str, b: &str) -> bool {
    let norm_a = normalize_path_for_monorepo_compare(a);
    let norm_b = normalize_path_for_monorepo_compare(b);
    if norm_a.is_empty() || norm_b.is_empty() || norm_a == norm_b {
        return false;
    }
    if norm_a.starts_with(&format!("{}/", norm_b)) || norm_b.starts_with(&format!("{}/", norm_a)) {
        return true;
    }
    let pa = Path::new(&norm_a);
    let pb = Path::new(&norm_b);
    if let (Some(par_a), Some(par_b)) = (pa.parent(), pb.parent()) {
        if par_a == par_b && par_a.file_name().is_some() {
            return true;
        }
        if let (Some(gp_a), Some(gp_b)) = (par_a.parent(), par_b.parent()) {
            if (gp_a == par_b || par_a == gp_b || gp_a == gp_b) && gp_a.file_name().is_some() {
                // Check if common ancestor looks like a workspace root (has subdirectories or manifest)
                return par_a == par_b || gp_a == par_b || par_a == gp_b;
            }
        }
    }
    false
}

fn target_display_name(root_path: &str, explicit_name: Option<&str>) -> String {
    if let Some(n) = explicit_name.filter(|s| !s.trim().is_empty()) {
        return n.to_string();
    }
    Path::new(root_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("server")
        .to_string()
}

fn refresh_running_targets(guard: &mut ProjectServerInner) {
    let mut list: Vec<RunningProjectTarget> = Vec::new();
    if (guard.status.running || guard.status.starting) && guard.status.root_path.is_some() {
        let rp = guard.status.root_path.clone().unwrap_or_default();
        let error_count = count_error_log_lines(&guard.primary_logs);
        list.push(RunningProjectTarget {
            name: target_display_name(&rp, guard.primary_name.as_deref()),
            root_path: rp,
            kind: guard.status.kind.clone().unwrap_or_else(|| "node".to_string()),
            url: guard.status.url.clone(),
            command_label: guard.status.command_label.clone(),
            starting: guard.status.starting,
            logs: guard.primary_logs.clone(),
            error_count,
        });
    }
    for extra in &guard.extra_servers {
        if !list.iter().any(|t| t.root_path == extra.root_path) {
            let error_count = count_error_log_lines(&extra.logs);
            list.push(RunningProjectTarget {
                root_path: extra.root_path.clone(),
                name: extra.name.clone(),
                kind: extra.kind.clone(),
                url: extra.url.clone(),
                command_label: extra.command_label.clone(),
                starting: extra.starting,
                logs: extra.logs.clone(),
                error_count,
            });
        }
    }
    guard.status.running_targets = list;
}

async fn prepare_for_target_start(guard: &mut ProjectServerInner, target_root: &str) {
    // If target_root was already running in extra_servers, stop that old instance first
    let mut i = 0;
    while i < guard.extra_servers.len() {
        if guard.extra_servers[i].root_path == target_root {
            let mut old = guard.extra_servers.remove(i);
            kill_extra_server(&mut old).await;
        } else {
            i += 1;
        }
    }

    if let Some(prev_root) = guard.status.root_path.clone() {
        if (guard.status.running || guard.status.starting)
            && prev_root != target_root
            && !guard.status.external
            && are_monorepo_related_paths(&prev_root, target_root)
            && (guard.child.is_some() || guard.static_server_task.is_some())
        {
            let prev_name = target_display_name(&prev_root, guard.primary_name.as_deref());
            let moved = ExtraManagedServer {
                server_id: guard.generation,
                root_path: prev_root,
                name: prev_name,
                kind: guard.status.kind.clone().unwrap_or_else(|| "node".to_string()),
                url: guard.status.url.clone(),
                command_label: guard.status.command_label.clone(),
                starting: guard.status.starting,
                requested_port: guard.requested_port.take(),
                requested_script: guard.requested_script.take(),
                allow_lan: guard.status.allow_lan,
                lan_urls: std::mem::take(&mut guard.status.lan_urls),
                logs: std::mem::take(&mut guard.primary_logs),
                child: guard.child.take(),
                pid: guard.pid.take(),
                aux_child: guard.aux_child.take(),
                aux_pid: guard.aux_pid.take(),
                static_server_task: guard.static_server_task.take(),
            };
            guard.extra_servers.retain(|s| s.root_path != moved.root_path);
            guard.extra_servers.push(moved);
            guard.primary_name = None;
            return;
        }
        if prev_root != target_root && !are_monorepo_related_paths(&prev_root, target_root) {
            for mut extra in guard.extra_servers.drain(..) {
                kill_extra_server(&mut extra).await;
            }
        }
    }
    kill_primary_server(guard).await;
}

fn promote_last_extra_server(guard: &mut ProjectServerInner) -> bool {
    let Some(promoted) = guard.extra_servers.pop() else {
        return false;
    };
    guard.generation = promoted.server_id;
    guard.primary_name = Some(promoted.name);
    guard.primary_logs = promoted.logs;
    guard.requested_port = promoted.requested_port;
    guard.requested_script = promoted.requested_script.clone();
    guard.child = promoted.child;
    guard.pid = promoted.pid;
    guard.aux_child = promoted.aux_child;
    guard.aux_pid = promoted.aux_pid;
    guard.static_server_task = promoted.static_server_task;
    guard.status.running = true;
    guard.status.starting = promoted.starting;
    guard.status.external = false;
    guard.status.allow_lan = promoted.allow_lan;
    guard.status.lan_urls = promoted.lan_urls;
    guard.status.root_path = Some(promoted.root_path);
    guard.status.kind = Some(promoted.kind);
    guard.status.url = promoted.url;
    guard.status.command_label = promoted.command_label;
    guard.status.requested_port = promoted.requested_port;
    guard.status.requested_script = promoted.requested_script;
    guard.status.error = None;
    refresh_running_targets(guard);
    true
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
                kill_pid_sync(pid);
            }
        }
        if let Some(mut child) = guard.child.take() {
            let _ = child.start_kill();
        }
        if let Some(mut aux) = guard.aux_child.take() {
            let _ = aux.start_kill();
        }
        for mut extra in guard.extra_servers.drain(..) {
            kill_extra_server_sync(&mut extra);
        }
        guard.primary_name = None;
        guard.primary_logs.clear();
        guard.requested_port = None;
        guard.requested_script = None;
        guard.status.running = false;
        guard.status.starting = false;
        guard.status.external = false;
        guard.status.allow_lan = false;
        guard.status.requested_port = None;
        guard.status.requested_script = None;
        guard.status.lan_urls.clear();
        guard.status.running_targets.clear();
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

fn read_package_script_cmd(root: &Path, script_name: &str) -> Option<String> {
    let raw = fs::read_to_string(root.join("package.json")).ok()?;
    let json: serde_json::Value = serde_json::from_str(&raw).ok()?;
    json["scripts"][script_name]
        .as_str()
        .map(|s| s.to_string())
}

fn append_node_dev_args(
    args: &mut Vec<String>,
    pm: &str,
    kind: &str,
    script_cmd: Option<&str>,
    allow_lan: bool,
    port: Option<u16>,
) {
    let raw_cmd = script_cmd.unwrap_or("");
    let cmd_lower = raw_cmd.to_ascii_lowercase();
    let mut extra: Vec<String> = Vec::new();

    if allow_lan {
        let already_has_host = cmd_lower.split_whitespace().any(|tok| {
            tok == "--host"
                || tok.starts_with("--host=")
                || tok == "--hostname"
                || tok.starts_with("--hostname=")
                || tok.starts_with("host=")
        }) || raw_cmd
            .split_whitespace()
            .any(|tok| tok == "-H" || tok.starts_with("-H="));

        if !already_has_host {
            if kind == "next"
                || cmd_lower.contains("next dev")
                || cmd_lower.contains("next start")
            {
                extra.push("-H".to_string());
                extra.push("0.0.0.0".to_string());
            } else if matches!(
                kind,
                "vite" | "vitepress" | "sveltekit" | "astro" | "nuxt" | "docusaurus"
            ) || cmd_lower.contains("vite")
                || cmd_lower.contains("astro")
                || cmd_lower.contains("nuxt")
                || cmd_lower.contains("docusaurus")
                || cmd_lower.contains("svelte-kit")
            {
                extra.push("--host".to_string());
                extra.push("0.0.0.0".to_string());
            }
        }
    }

    if let Some(p) = port {
        let uses_long_port = cmd_lower.split_whitespace().any(|tok| {
            tok == "--port" || tok.starts_with("--port=")
        });
        if kind == "next"
            || cmd_lower.contains("next dev")
            || cmd_lower.contains("next start")
        {
            extra.push(if uses_long_port {
                "--port".to_string()
            } else {
                "-p".to_string()
            });
            extra.push(p.to_string());
        } else if cmd_lower.contains("storybook") || cmd_lower.contains("parcel") {
            extra.push(if uses_long_port {
                "--port".to_string()
            } else {
                "-p".to_string()
            });
            extra.push(p.to_string());
        } else if matches!(
            kind,
            "vite" | "vitepress" | "sveltekit" | "astro" | "nuxt" | "docusaurus"
        ) || cmd_lower.contains("vite")
            || cmd_lower.contains("astro")
            || cmd_lower.contains("nuxt")
            || cmd_lower.contains("docusaurus")
            || cmd_lower.contains("svelte-kit")
            || cmd_lower.contains("webpack")
            || cmd_lower.contains("ng serve")
        {
            extra.push("--port".to_string());
            extra.push(p.to_string());
        }
    }

    if extra.is_empty() {
        return;
    }

    if pm == "npm" {
        args.push("--".to_string());
    }
    args.extend(extra);
}

#[allow(dead_code)]
fn append_node_lan_args(
    args: &mut Vec<String>,
    pm: &str,
    kind: &str,
    script_cmd: Option<&str>,
) {
    append_node_dev_args(args, pm, kind, script_cmd, true, None);
}

fn resolve_runner(
    root_path: &str,
    info: &ProjectInfo,
    script_name: Option<String>,
    allow_lan: bool,
    custom_port: Option<u16>,
) -> Result<ResolvedRunner, String> {
    let root = Path::new(root_path);
    let chosen_script = script_name.or_else(|| info.dev_script.clone());
    let bind_host = if allow_lan { "0.0.0.0" } else { "127.0.0.1" };

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
            let php = select_php_executable().ok_or_else(|| {
                "Command not found: php. Please install PHP or start Docker first."
                    .to_string()
            })?;
            let with_vite = chosen_script.as_deref() == Some("artisan-vite")
                || (chosen_script.is_none() && laravel_needs_companion_vite(root));
            let port = custom_port.unwrap_or(8000);
            return Ok(ResolvedRunner::Command {
                exe: php,
                args: vec![
                    "artisan".to_string(),
                    "serve".to_string(),
                    format!("--host={}", bind_host),
                    format!("--port={}", port),
                ],
                label: if with_vite {
                    format!("php artisan serve --port={} + vite", port)
                } else {
                    format!("php artisan serve --host={} --port={}", bind_host, port)
                },
                companion_vite: with_vite,
                is_docker_compose: false,
            });
        }
    }

    if info.kind == "laravel" || info.kind == "php" || info.kind == "wordpress" {
        let php = select_php_executable().ok_or_else(|| {
            "Command not found: php. Please install PHP or start Docker first."
                .to_string()
        })?;
        let docroot = if root.join("public/index.php").exists() {
            "public"
        } else {
            "."
        };
        let port = custom_port.unwrap_or(8000);
        let addr = format!("{}:{}", bind_host, port);
        return Ok(ResolvedRunner::Command {
            exe: php,
            args: vec![
                "-S".to_string(),
                addr.clone(),
                "-t".to_string(),
                docroot.to_string(),
            ],
            label: format!("php -S {} -t {}", addr, docroot),
            companion_vite: false,
            is_docker_compose: false,
        });
    }

    if info.kind == "mkdocs" {
        let port = custom_port.unwrap_or(8000);
        let addr = format!("{}:{}", bind_host, port);
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
                    args: vec!["serve".to_string(), "-a".to_string(), addr.clone()],
                    label: format!("mkdocs serve -a {}", addr),
                    companion_vite: false,
                    is_docker_compose: false,
                });
            }
        }
        if let Some(mk) = find_executable(&["mkdocs"]) {
            return Ok(ResolvedRunner::Command {
                exe: mk,
                args: vec!["serve".to_string(), "-a".to_string(), addr.clone()],
                label: format!("mkdocs serve -a {}", addr),
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
                addr.clone(),
            ]);
            return Ok(ResolvedRunner::Command {
                exe: py_exe,
                args: prefix_args,
                label: format!("python -m mkdocs serve -a {}", addr),
                companion_vite: false,
                is_docker_compose: false,
            });
        }
        return Err("Command not found: mkdocs / python3. Please install MkDocs.".to_string());
    }

    if info.kind == "hugo" {
        let hugo = find_executable(&["hugo"])
            .ok_or_else(|| "Command not found: hugo. Please install Hugo (e.g. brew install hugo).".to_string())?;
        let port = custom_port.unwrap_or(1313);
        let mut args = vec![
            "server".to_string(),
            "-D".to_string(),
            "--port".to_string(),
            port.to_string(),
        ];
        if allow_lan {
            args.push("--bind".to_string());
            args.push("0.0.0.0".to_string());
        }
        let label = format!("hugo {}", args.join(" "));
        return Ok(ResolvedRunner::Command {
            exe: hugo,
            args,
            label,
            companion_vite: false,
            is_docker_compose: false,
        });
    }

    if info.kind == "jekyll" {
        let port = custom_port.unwrap_or(4000);
        if let Some(bundle) = find_executable(&["bundle"]) {
            let mut args = vec![
                "exec".to_string(),
                "jekyll".to_string(),
                "serve".to_string(),
                "--port".to_string(),
                port.to_string(),
            ];
            if allow_lan {
                args.push("--host".to_string());
                args.push("0.0.0.0".to_string());
            }
            let label = format!("bundle {}", args.join(" "));
            return Ok(ResolvedRunner::Command {
                exe: bundle,
                args,
                label,
                companion_vite: false,
                is_docker_compose: false,
            });
        }
        let jekyll = find_executable(&["jekyll"])
            .ok_or_else(|| "Command not found: bundle / jekyll. Please install Ruby Bundler & Jekyll.".to_string())?;
        let mut args = vec![
            "serve".to_string(),
            "--port".to_string(),
            port.to_string(),
        ];
        if allow_lan {
            args.push("--host".to_string());
            args.push("0.0.0.0".to_string());
        }
        let label = format!("jekyll {}", args.join(" "));
        return Ok(ResolvedRunner::Command {
            exe: jekyll,
            args,
            label,
            companion_vite: false,
            is_docker_compose: false,
        });
    }

    if matches!(
        info.kind.as_str(),
        "django" | "fastapi" | "flask" | "streamlit" | "python"
    ) {
        let spec = detect_python_web_with_host_and_port(root, allow_lan, custom_port)
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
    let mut args = vec!["run".to_string(), sc.clone()];
    if allow_lan || custom_port.is_some() {
        let script_cmd = read_package_script_cmd(root, &sc);
        append_node_dev_args(
            &mut args,
            pm_static,
            &info.kind,
            script_cmd.as_deref(),
            allow_lan,
            custom_port,
        );
    }
    let label = format!("{} {}", pm_static, args.join(" "));
    Ok(ResolvedRunner::Command {
        exe,
        args,
        label,
        companion_vite: false,
        is_docker_compose: false,
    })
}

async fn emit_project_server_failure(
    app: &AppHandle,
    state: &State<'_, ProjectServerState>,
    root_path: &str,
    info: &ProjectInfo,
    command_label: Option<String>,
    msg: &str,
) {
    let mut guard = state.inner.lock().await;
    kill_primary_server(&mut guard).await;
    guard.status = ProjectServerStatus {
        running: false,
        starting: false,
        external: false,
        allow_lan: false,
        lan_urls: Vec::new(),
        root_path: Some(root_path.to_string()),
        kind: Some(info.kind.clone()),
        url: None,
        command_label,
        requested_port: None,
        requested_script: None,
        logs: vec![msg.to_string()],
        error: Some(msg.to_string()),
        running_targets: Vec::new(),
    };
    refresh_running_targets(&mut guard);
    let snap = guard.status.clone();
    drop(guard);
    let _ = app.emit("project-server-update", snap);
}

#[tauri::command]
pub async fn start_project_dev_server(
    app: AppHandle,
    state: State<'_, ProjectServerState>,
    root_path: String,
    script_name: Option<String>,
    allow_lan: Option<bool>,
    port: Option<u16>,
) -> Result<ProjectServerStatus, String> {
    if port == Some(0) {
        return Err("Invalid port number (must be between 1 and 65535).".to_string());
    }
    let _start_guard = state.start_lock.lock().await;
    let mut effective_root = root_path.clone();
    let mut info = inspect_root_dir_with_script(Path::new(&effective_root), script_name.as_deref())?;
    if info.kind == "none" {
        if let Some(sub) = find_monorepo_subproject(Path::new(&effective_root)) {
            effective_root = sub.root_path.clone();
            info = inspect_root_dir_with_script(Path::new(&effective_root), script_name.as_deref())?;
        }
    }
    let want_lan = allow_lan.unwrap_or(false);
    let chosen_script = script_name.clone().or_else(|| info.dev_script.clone());
    let effective_port = if info.kind == "docker" || script_name.as_deref() == Some("docker-compose") {
        None
    } else {
        port
    };
    let target_default_url = match effective_port {
        Some(p) => Some(format!("http://localhost:{}", p)),
        None => info.default_url.clone(),
    };

    // 1. If we already manage a live server for this exact root_path, reuse it when LAN mode, script, and port match
    // (or refresh LAN URLs for externally-managed servers).
    {
        let (existing_snap, existing_port, existing_script) = {
            let guard = state.inner.lock().await;
            if guard.status.running
                && guard.status.root_path.as_deref() == Some(effective_root.as_str())
            {
                (
                    Some(guard.status.clone()),
                    guard.requested_port,
                    guard.requested_script.clone(),
                )
            } else {
                (None, None, None)
            }
        };
        if let Some(existing) = existing_snap {
            if existing.external {
                let port_matches = match effective_port {
                    Some(p) => existing
                        .url
                        .as_deref()
                        .and_then(|u| url::Url::parse(u).ok())
                        .and_then(|u| u.port_or_known_default())
                        == Some(p),
                    None => true,
                };
                if port_matches {
                    if let Some(ref existing_url) = existing.url {
                        if probe_local_http(existing_url, 400).await {
                            let lan_urls = if want_lan {
                                probe_lan_reachable(existing_url, 250).await
                            } else {
                                Vec::new()
                            };
                            let mut guard = state.inner.lock().await;
                            guard.status.allow_lan = !lan_urls.is_empty();
                            guard.status.lan_urls = lan_urls;
                            refresh_running_targets(&mut guard);
                            let snap = guard.status.clone();
                            drop(guard);
                            let _ = app.emit("project-server-update", snap.clone());
                            return Ok(snap);
                        }
                    }
                }
            } else if existing.allow_lan == want_lan
                && existing_port == effective_port
                && existing_script == chosen_script
            {
                if let Some(ref existing_url) = existing.url {
                    if probe_local_http(existing_url, 400).await || existing.starting {
                        return Ok(existing);
                    }
                } else if existing.starting {
                    return Ok(existing);
                }
            }
        }
    }

    // 2. If the configured project URL (or Laravel .env APP_URL / Docker port) is already alive externally,
    // connect to it instead of launching a second server (skip for built-in static server).
    if info.kind != "static" {
        let mut candidate_urls: Vec<String> = if let Some(p) = effective_port {
            vec![format!("http://localhost:{}", p), format!("http://127.0.0.1:{}", p)]
        } else if info.kind == "laravel" {
            laravel_candidate_urls(Path::new(&effective_root))
        } else {
            info.default_url.iter().cloned().collect()
        };
        if effective_port.is_none() {
            for p in parse_compose_ports(Path::new(&effective_root)) {
                let u = format!("http://localhost:{}", p);
                if !candidate_urls.iter().any(|x| x == &u) {
                    candidate_urls.push(u);
                }
            }
        }

        for candidate in &candidate_urls {
            if probe_local_http(candidate, 500).await {
                let lan_urls = if want_lan {
                    probe_lan_reachable(candidate, 250).await
                } else {
                    Vec::new()
                };
                let mut guard = state.inner.lock().await;
                prepare_for_target_start(&mut guard, &effective_root).await;
                guard.primary_name = Some(info.name.clone());
                let init_line = format!("Connected to already-running server at {}", candidate);
                guard.primary_logs = vec![init_line.clone()];
                guard.requested_port = effective_port;
                guard.requested_script = chosen_script.clone();
                let mut prev_logs = std::mem::take(&mut guard.status.logs);
                push_log_bounded(&mut prev_logs, init_line, 180);
                guard.status = ProjectServerStatus {
                    running: true,
                    starting: false,
                    external: true,
                    allow_lan: !lan_urls.is_empty(),
                    lan_urls,
                    root_path: Some(effective_root.clone()),
                    kind: Some(info.kind.clone()),
                    url: Some(candidate.clone()),
                    command_label: info.dev_command_label.clone(),
                    requested_port: effective_port,
                    requested_script: chosen_script.clone(),
                    logs: prev_logs,
                    error: None,
                    running_targets: Vec::new(),
                };
                refresh_running_targets(&mut guard);
                let snap = guard.status.clone();
                drop(guard);
                let _ = app.emit("project-server-update", snap.clone());
                return Ok(snap);
            }
        }

        if let Some(ref check_url) = target_default_url {
            if let Ok(parsed) = url::Url::parse(check_url) {
                if let Some(port) = parsed.port() {
                    if is_local_port_bound(port, 250).await {
                        let msg = format!(
                            "Port {} is already occupied by an unresponsive process. Stop that process or restart it before starting the dev server.",
                            port
                        );
                        emit_project_server_failure(
                            &app,
                            &state,
                            &effective_root,
                            &info,
                            info.dev_command_label.clone(),
                            &msg,
                        )
                        .await;
                        return Err(msg);
                    }
                }
            }
        }
    }

    {
        let mut guard = state.inner.lock().await;
        prepare_for_target_start(&mut guard, &effective_root).await;
    }

    let runner = match resolve_runner(&effective_root, &info, script_name, want_lan, effective_port) {
        Ok(r) => r,
        Err(msg) => {
            emit_project_server_failure(
                &app,
                &state,
                &effective_root,
                &info,
                info.dev_command_label.clone(),
                &msg,
            )
            .await;
            return Err(msg);
        }
    };

    if matches!(runner, ResolvedRunner::StaticHttp) {
        let bind_host = if want_lan { "0.0.0.0" } else { "127.0.0.1" };
        let listener = if let Some(p) = effective_port {
            match TcpListener::bind(format!("{}:{}", bind_host, p)).await {
                Ok(l) => l,
                Err(e) => {
                    let msg = format!("Failed to start built-in static server on port {}: {}", p, e);
                    emit_project_server_failure(
                        &app,
                        &state,
                        &effective_root,
                        &info,
                        info.dev_command_label.clone(),
                        &msg,
                    )
                    .await;
                    return Err(msg);
                }
            }
        } else {
            match TcpListener::bind(format!("{}:4173", bind_host)).await {
                Ok(l) => l,
                Err(_) => match TcpListener::bind(format!("{}:0", bind_host)).await {
                    Ok(l) => l,
                    Err(e) => {
                        let msg = format!("Failed to start built-in static server: {}", e);
                        emit_project_server_failure(
                            &app,
                            &state,
                            &effective_root,
                            &info,
                            info.dev_command_label.clone(),
                            &msg,
                        )
                        .await;
                        return Err(msg);
                    }
                },
            }
        };
        let port = listener.local_addr().map_err(|e| e.to_string())?.port();
        let url = format!("http://127.0.0.1:{}", port);
        let lan_urls = compute_project_lan_urls(want_lan, Some(&url));
        let root_buf = PathBuf::from(&effective_root);
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
            guard.primary_name = Some(info.name.clone());
            let init_line = format!("Serving {} at {}", effective_root, url);
            guard.primary_logs = vec![init_line.clone()];
            guard.requested_port = effective_port;
            guard.requested_script = chosen_script.clone();
            guard.static_server_task = Some(task);
            let mut prev_logs = if guard.extra_servers.is_empty() {
                Vec::new()
            } else {
                std::mem::take(&mut guard.status.logs)
            };
            let tagged = if guard.extra_servers.is_empty() {
                init_line
            } else {
                format!("[{}] {}", info.name, init_line)
            };
            push_log_bounded(&mut prev_logs, tagged, 180);
            guard.status = ProjectServerStatus {
                running: true,
                starting: false,
                external: false,
                allow_lan: want_lan,
                lan_urls,
                root_path: Some(effective_root.clone()),
                kind: Some("static".to_string()),
                url: Some(url.clone()),
                command_label: Some(format!("Built-in Static HTTP ({})", url)),
                requested_port: effective_port,
                requested_script: chosen_script.clone(),
                logs: prev_logs,
                error: None,
                running_targets: Vec::new(),
            };
            refresh_running_targets(&mut guard);
            guard.status.clone()
        };
        let _ = app.emit("project-server-update", snapshot.clone());
        return Ok(snapshot);
    }

    let (exe, mut args, command_label, companion_vite, is_docker_compose) = match runner {
        ResolvedRunner::Command {
            exe,
            args,
            label,
            companion_vite,
            is_docker_compose,
        } => (exe, args, label, companion_vite, is_docker_compose),
        ResolvedRunner::StaticHttp => unreachable!(),
    };

    let php_scan_dir = resolve_php_scan_dir_for_exe(&exe);
    if should_add_artisan_no_reload(&args, php_scan_dir.is_some()) {
        args.push("--no-reload".to_string());
    }

    let mut cmd = build_project_command(&exe, &args);
    cmd.current_dir(&effective_root)
        .env("PATH", extended_path())
        .env("BROWSER", "none")
        .env("FORCE_COLOR", "0")
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    if want_lan {
        cmd.env("HOST", "0.0.0.0");
    }
    if let Some(p) = effective_port {
        cmd.env("PORT", p.to_string());
    }
    if let Some(scan_dir) = php_scan_dir {
        cmd.env("PHP_INI_SCAN_DIR", scan_dir);
    }

    #[cfg(unix)]
    {
        cmd.process_group(0);
    }

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            let msg = format!("Failed to start {}: {}", command_label, e);
            emit_project_server_failure(
                &app,
                &state,
                &effective_root,
                &info,
                Some(command_label),
                &msg,
            )
            .await;
            return Err(msg);
        }
    };

    let pid = child.id();
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // Optionally spawn companion Vite dev server for Laravel projects with node_modules & @vite
    let (aux_child, aux_pid) = if companion_vite {
        let pm = detect_package_manager(Path::new(&effective_root));
        if let Some(pm_exe) = find_executable(&[pm]) {
            let mut vite_args = vec!["run".to_string(), "dev".to_string()];
            if want_lan {
                if pm == "npm" {
                    vite_args.push("--".to_string());
                }
                vite_args.push("--host".to_string());
                vite_args.push("0.0.0.0".to_string());
            }
            let mut vcmd = build_project_command(&pm_exe, &vite_args);
            vcmd.current_dir(&effective_root)
                .env("PATH", extended_path())
                .env("BROWSER", "none")
                .env("FORCE_COLOR", "0")
                .stdin(std::process::Stdio::null())
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null());
            if want_lan {
                vcmd.env("HOST", "0.0.0.0");
            }
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
        guard.primary_name = Some(info.name.clone());
        let cmd_line = format!("$ {}", command_label);
        guard.primary_logs = vec![cmd_line.clone()];
        guard.requested_port = effective_port;
        guard.requested_script = chosen_script.clone();
        guard.child = Some(child);
        guard.pid = pid;
        guard.aux_child = aux_child;
        guard.aux_pid = aux_pid;
        let mut prev_logs = if guard.extra_servers.is_empty() {
            Vec::new()
        } else {
            std::mem::take(&mut guard.status.logs)
        };
        let tagged_cmd = if guard.extra_servers.is_empty() {
            cmd_line
        } else {
            format!("[{}] {}", info.name, cmd_line)
        };
        push_log_bounded(&mut prev_logs, tagged_cmd, 180);
        guard.status = ProjectServerStatus {
            running: true,
            starting: true,
            external: false,
            allow_lan: want_lan,
            lan_urls: Vec::new(),
            root_path: Some(effective_root.clone()),
            kind: Some(info.kind.clone()),
            url: None,
            command_label: Some(command_label.clone()),
            requested_port: effective_port,
            requested_script: chosen_script.clone(),
            logs: prev_logs,
            error: None,
            running_targets: Vec::new(),
        };
        refresh_running_targets(&mut guard);
        (gen_id, guard.status.clone())
    };

    let _ = app.emit("project-server-update", snapshot.clone());

    let shared_out = state.inner.clone();
    let app_out = app.clone();
    if let Some(out) = stdout {
        tokio::spawn(async move {
            let mut reader = BufReader::new(out);
            while let Some(line) = read_next_line_lossy(&mut reader).await {
                let clean = strip_ansi(&line);
                if clean.trim().is_empty() {
                    continue;
                }
                let maybe_url = if is_docker_compose {
                    None
                } else {
                    extract_local_url(&clean)
                };
                let maybe_lan = if want_lan && !is_docker_compose {
                    extract_lan_url(&clean)
                } else {
                    None
                };
                {
                    let mut guard = shared_out.lock().await;
                    let is_primary = guard.generation == gen_id;
                    let has_multiple = !guard.extra_servers.is_empty();
                    let extra_name = if !is_primary {
                        guard
                            .extra_servers
                            .iter_mut()
                            .find(|s| s.server_id == gen_id)
                            .map(|extra| {
                                if let Some(ref lan_u) = maybe_lan {
                                    merge_lan_url(&mut extra.lan_urls, lan_u.clone());
                                }
                                push_log_bounded(&mut extra.logs, clean.clone(), 120);
                                extra.name.clone()
                            })
                    } else {
                        None
                    };
                    if !is_primary && extra_name.is_none() {
                        break;
                    }
                    if is_primary {
                        push_log_bounded(&mut guard.primary_logs, clean.clone(), 120);
                        if let Some(lan_u) = maybe_lan {
                            merge_lan_url(&mut guard.status.lan_urls, lan_u);
                        }
                    }
                    let log_entry = if let Some(ref name) = extra_name {
                        format!("[{}] {}", name, clean)
                    } else if has_multiple {
                        let pname = guard.primary_name.clone().unwrap_or_else(|| "server".to_string());
                        format!("[{}] {}", pname, clean)
                    } else {
                        clean
                    };
                    push_log_bounded(&mut guard.status.logs, log_entry, 180);
                    refresh_running_targets(&mut guard);
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
                    let computed_lan = compute_project_lan_urls(want_lan, Some(&u));
                    let mut guard = shared_out.lock().await;
                    if guard.generation == gen_id {
                        guard.status.url = Some(u);
                        guard.status.starting = false;
                        for lan_u in computed_lan {
                            merge_lan_url(&mut guard.status.lan_urls, lan_u);
                        }
                    } else if let Some(extra) =
                        guard.extra_servers.iter_mut().find(|s| s.server_id == gen_id)
                    {
                        extra.url = Some(u);
                        extra.starting = false;
                        for lan_u in computed_lan {
                            merge_lan_url(&mut extra.lan_urls, lan_u);
                        }
                    } else {
                        break;
                    }
                    refresh_running_targets(&mut guard);
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
            let mut reader = BufReader::new(err);
            while let Some(line) = read_next_line_lossy(&mut reader).await {
                let clean = strip_ansi(&line);
                if clean.trim().is_empty() {
                    continue;
                }
                let maybe_url = if is_docker_compose {
                    None
                } else {
                    extract_local_url(&clean)
                };
                let maybe_lan = if want_lan && !is_docker_compose {
                    extract_lan_url(&clean)
                } else {
                    None
                };
                {
                    let mut guard = shared_err.lock().await;
                    let is_primary = guard.generation == gen_id;
                    let has_multiple = !guard.extra_servers.is_empty();
                    let extra_name = if !is_primary {
                        guard
                            .extra_servers
                            .iter_mut()
                            .find(|s| s.server_id == gen_id)
                            .map(|extra| {
                                if let Some(ref lan_u) = maybe_lan {
                                    merge_lan_url(&mut extra.lan_urls, lan_u.clone());
                                }
                                push_log_bounded(&mut extra.logs, clean.clone(), 120);
                                extra.name.clone()
                            })
                    } else {
                        None
                    };
                    if !is_primary && extra_name.is_none() {
                        break;
                    }
                    if is_primary {
                        push_log_bounded(&mut guard.primary_logs, clean.clone(), 120);
                        if let Some(lan_u) = maybe_lan {
                            merge_lan_url(&mut guard.status.lan_urls, lan_u);
                        }
                    }
                    let log_entry = if let Some(ref name) = extra_name {
                        format!("[{}] {}", name, clean)
                    } else if has_multiple {
                        let pname = guard.primary_name.clone().unwrap_or_else(|| "server".to_string());
                        format!("[{}] {}", pname, clean)
                    } else {
                        clean
                    };
                    push_log_bounded(&mut guard.status.logs, log_entry, 180);
                    refresh_running_targets(&mut guard);
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
                    let computed_lan = compute_project_lan_urls(want_lan, Some(&u));
                    let mut guard = shared_err.lock().await;
                    if guard.generation == gen_id {
                        guard.status.url = Some(u);
                        guard.status.starting = false;
                        for lan_u in computed_lan {
                            merge_lan_url(&mut guard.status.lan_urls, lan_u);
                        }
                    } else if let Some(extra) =
                        guard.extra_servers.iter_mut().find(|s| s.server_id == gen_id)
                    {
                        extra.url = Some(u);
                        extra.starting = false;
                        for lan_u in computed_lan {
                            merge_lan_url(&mut extra.lan_urls, lan_u);
                        }
                    } else {
                        break;
                    }
                    refresh_running_targets(&mut guard);
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
    let fallback_url = target_default_url;
    tokio::spawn(async move {
        let mut ticks: u32 = 0;
        let mut compose_started = false;
        loop {
            tokio::time::sleep(Duration::from_millis(500)).await;
            ticks = ticks.saturating_add(1);

            let should_probe_fallback = {
                let mut guard = shared_wait.lock().await;
                if guard.generation == gen_id {
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
                                guard.status.allow_lan = false;
                                guard.status.lan_urls.clear();
                                if !exit_status.success() {
                                    guard.status.error = Some(format!(
                                        "Dev server exited with code {}",
                                        exit_status
                                            .code()
                                            .map(|c| c.to_string())
                                            .unwrap_or_else(|| "signal".to_string())
                                    ));
                                } else if guard.status.url.is_none() {
                                    guard.status.error = Some(
                                        "Dev server exited (code 0) before listening on a local URL. Check logs below."
                                            .to_string(),
                                    );
                                }
                                refresh_running_targets(&mut guard);
                                let snap = guard.status.clone();
                                drop(guard);
                                let _ = app_wait.emit("project-server-update", snap);
                                break;
                            }
                        }
                    }
                    guard.status.starting && guard.status.url.is_none() && ticks <= 120
                } else if let Some(extra_idx) = guard
                    .extra_servers
                    .iter()
                    .position(|s| s.server_id == gen_id)
                {
                    let exited = if let Some(child) = guard.extra_servers[extra_idx].child.as_mut() {
                        match child.try_wait() {
                            Ok(Some(status)) => Some(status),
                            Ok(None) => None,
                            Err(_) => None,
                        }
                    } else {
                        break;
                    };
                    if let Some(_exit_status) = exited {
                        guard.extra_servers.remove(extra_idx);
                        refresh_running_targets(&mut guard);
                        let snap = guard.status.clone();
                        drop(guard);
                        let _ = app_wait.emit("project-server-update", snap);
                        break;
                    }
                    guard.extra_servers[extra_idx].starting
                        && guard.extra_servers[extra_idx].url.is_none()
                        && ticks <= 120
                } else {
                    break;
                }
            };

            if should_probe_fallback {
                if let Some(ref fb) = fallback_url {
                    if probe_local_http(fb, 350).await {
                        let computed_lan = compute_project_lan_urls(want_lan, Some(fb));
                        let mut guard = shared_wait.lock().await;
                        if guard.generation == gen_id && guard.status.url.is_none() {
                            guard.status.url = Some(fb.clone());
                            guard.status.starting = false;
                            for lan_u in computed_lan {
                                merge_lan_url(&mut guard.status.lan_urls, lan_u);
                            }
                            if is_docker_compose {
                                guard.status.external = true;
                            }
                            refresh_running_targets(&mut guard);
                            let snap = guard.status.clone();
                            drop(guard);
                            let _ = app_wait.emit("project-server-update", snap);
                            if is_docker_compose {
                                break;
                            }
                        } else if let Some(extra) =
                            guard.extra_servers.iter_mut().find(|s| s.server_id == gen_id)
                        {
                            if extra.url.is_none() {
                                extra.url = Some(fb.clone());
                                extra.starting = false;
                                for lan_u in computed_lan {
                                    merge_lan_url(&mut extra.lan_urls, lan_u);
                                }
                                refresh_running_targets(&mut guard);
                                let snap = guard.status.clone();
                                drop(guard);
                                let _ = app_wait.emit("project-server-update", snap);
                            }
                        }
                    }
                }
            } else if ticks > 120 {
                let mut guard = shared_wait.lock().await;
                if guard.generation == gen_id
                    && guard.status.url.is_none()
                    && (compose_started || guard.status.starting)
                {
                    if compose_started {
                        guard.status.running = false;
                        guard.status.allow_lan = false;
                        guard.status.lan_urls.clear();
                    }
                    guard.status.starting = false;
                    if guard.status.error.is_none() {
                        guard.status.error = Some(if compose_started {
                            "Docker container started, but HTTP did not respond in time.".to_string()
                        } else {
                            "Dev server did not expose a local URL within 60 seconds. Check logs below.".to_string()
                        });
                    }
                    refresh_running_targets(&mut guard);
                    let snap = guard.status.clone();
                    drop(guard);
                    let _ = app_wait.emit("project-server-update", snap);
                    if compose_started {
                        break;
                    }
                } else if compose_started {
                    break;
                }
            }
        }
    });

    Ok(snapshot)
}

#[tauri::command]
pub async fn stop_project_dev_server(
    app: AppHandle,
    state: State<'_, ProjectServerState>,
    target_root: Option<String>,
) -> Result<ProjectServerStatus, String> {
    let mut guard = state.inner.lock().await;
    if let Some(ref tr) = target_root {
        if let Some(idx) = guard.extra_servers.iter().position(|s| &s.root_path == tr) {
            let mut removed = guard.extra_servers.remove(idx);
            kill_extra_server(&mut removed).await;
            refresh_running_targets(&mut guard);
            let snap = guard.status.clone();
            drop(guard);
            let _ = app.emit("project-server-update", snap.clone());
            return Ok(snap);
        }
        if guard.status.root_path.as_deref() == Some(tr.as_str()) {
            kill_primary_server(&mut guard).await;
            if !promote_last_extra_server(&mut guard) {
                guard.status.url = None;
                guard.status.error = None;
                guard.status.allow_lan = false;
                guard.status.lan_urls.clear();
                guard.status.running_targets.clear();
            }
            let snap = guard.status.clone();
            drop(guard);
            let _ = app.emit("project-server-update", snap.clone());
            return Ok(snap);
        }
    }

    kill_existing_server(&mut guard).await;
    guard.status.url = None;
    guard.status.error = None;
    guard.status.allow_lan = false;
    guard.status.lan_urls.clear();
    guard.status.running_targets.clear();
    let snap = guard.status.clone();
    drop(guard);
    let _ = app.emit("project-server-update", snap.clone());
    Ok(snap)
}

#[tauri::command]
pub async fn clear_project_dev_server_logs(
    app: AppHandle,
    state: State<'_, ProjectServerState>,
    target_root: Option<String>,
) -> Result<ProjectServerStatus, String> {
    let mut guard = state.inner.lock().await;
    if let Some(ref tr) = target_root {
        let mut cleared_any = false;
        if guard.status.root_path.as_deref() == Some(tr.as_str()) {
            guard.primary_logs.clear();
            cleared_any = true;
        }
        for extra in &mut guard.extra_servers {
            if &extra.root_path == tr {
                extra.logs.clear();
                cleared_any = true;
            }
        }
        if cleared_any && guard.extra_servers.is_empty() {
            guard.status.logs.clear();
        }
        refresh_running_targets(&mut guard);
    } else {
        guard.status.logs.clear();
        guard.primary_logs.clear();
        for extra in &mut guard.extra_servers {
            extra.logs.clear();
        }
        refresh_running_targets(&mut guard);
    }
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

