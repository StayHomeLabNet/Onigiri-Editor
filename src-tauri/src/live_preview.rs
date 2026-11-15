use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::State;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::RwLock;

#[derive(Clone, Default)]
pub struct LivePreviewContent {
    pub title: String,
    pub body_html: String,
    pub theme: String,
    pub custom_css: String,
    pub doc_dir: Option<String>,
    pub workspace_root: Option<String>,
    pub is_raw_page: bool,
    pub version: u64,
}

pub struct LivePreviewState {
    pub inner: Arc<RwLock<LivePreviewContent>>,
    pub port: Arc<RwLock<Option<u16>>>,
}

impl LivePreviewState {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(LivePreviewContent::default())),
            port: Arc::new(RwLock::new(None)),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalPreviewStatus {
    pub running: bool,
    pub url: Option<String>,
    pub port: Option<u16>,
}

fn theme_palette(theme: &str) -> (&'static str, &'static str, &'static str, &'static str, &'static str) {
    match theme {
        "dark" => ("#0f172a", "#e2e8f0", "#94a3b8", "#334155", "#1e293b"),
        "midnight" => ("#070b14", "#e2e8f0", "#94a3b8", "#1e293b", "#0f172a"),
        "sepia" => ("#f8f2e4", "#3b2f23", "#786958", "#e2d6c0", "#efe7d4"),
        _ => ("#ffffff", "#1e293b", "#64748b", "#e2e8f0", "#f1f5f9"),
    }
}

fn render_shell_html(content: &LivePreviewContent) -> String {
    let (bg, fg, muted, border, code_bg) = theme_palette(&content.theme);
    let safe_title = content.title.replace('<', "&lt;").replace('>', "&gt;");
    let is_dark = content.theme == "dark" || content.theme == "midnight";
    let hljs_css = if is_dark {
        "https://cdn.jsdelivr.net/npm/highlight.js@11.11.1/styles/github-dark.min.css"
    } else {
        "https://cdn.jsdelivr.net/npm/highlight.js@11.11.1/styles/github.min.css"
    };

    format!(
        r#"<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{safe_title} — Onigiri Editor Live Preview</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css" />
  <link rel="stylesheet" href="{hljs_css}" />
  <style>
    body {{
      margin: 0;
      padding: 36px 24px 80px;
      background: {bg};
      color: {fg};
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Yu Gothic UI", "Meiryo", "Noto Sans CJK JP", "Noto Sans JP", "Ubuntu", sans-serif;
      line-height: 1.75;
    }}
    .live-badge {{
      position: fixed;
      top: 12px;
      right: 16px;
      font-size: 11px;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(99, 102, 241, 0.14);
      color: #6366f1;
      border: 1px solid rgba(99, 102, 241, 0.35);
      backdrop-filter: blur(8px);
      z-index: 99;
    }}
    .markdown-body {{ max-width: 860px; margin: 0 auto; }}
    .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 {{ line-height: 1.3; margin-top: 1.5em; }}
    .markdown-body h1, .markdown-body h2 {{ border-bottom: 1px solid {border}; padding-bottom: 0.3em; }}
    .markdown-body a {{ color: #6366f1; }}
    .markdown-body img {{ max-width: 100%; border-radius: 8px; }}
    .markdown-body code {{ font-family: 'JetBrains Mono', 'Cascadia Mono', 'SF Mono', Consolas, Menlo, 'Ubuntu Mono', 'Noto Sans Mono', monospace; background: {code_bg}; padding: 0.18em 0.4em; border-radius: 5px; font-size: 0.9em; }}
    .markdown-body pre {{ background: {code_bg}; padding: 14px 16px; border-radius: 10px; overflow-x: auto; border: 1px solid {border}; }}
    .markdown-body pre code {{ background: transparent; padding: 0; }}
    .markdown-body blockquote {{ margin: 1em 0; padding: 0.4em 1em; border-left: 4px solid #6366f1; color: {muted}; }}
    .markdown-body table {{ border-collapse: collapse; width: 100%; margin: 1.2em 0; }}
    .markdown-body th, .markdown-body td {{ border: 1px solid {border}; padding: 8px 12px; text-align: left; }}
    .markdown-body th {{ background: {code_bg}; }}
    .mf-callout {{ padding: 12px 16px; border-radius: 10px; border-left: 4px solid #3b82f6; background: {code_bg}; margin: 1em 0; }}
    .mf-callout-tip {{ border-left-color: #10b981; }}
    .mf-callout-important {{ border-left-color: #8b5cf6; }}
    .mf-callout-warning {{ border-left-color: #f59e0b; }}
    .mf-callout-caution {{ border-left-color: #ef4444; }}
    {custom_css}
  </style>
</head>
<body>
  <div class="live-badge">🍙 Onigiri Editor Live</div>
  <article id="preview-root" class="markdown-body">{body}</article>
  <script type="module">
    let currentVersion = {version};
    let mermaidApi = null;
    async function renderMermaid() {{
      const nodes = document.querySelectorAll('pre code.language-mermaid');
      if (!nodes.length) return;
      try {{
        if (!mermaidApi) {{
          const mod = await import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs');
          mermaidApi = mod.default;
          mermaidApi.initialize({{ startOnLoad: false, theme: {mermaid_dark} ? 'dark' : 'default' }});
        }}
        let idx = 0;
        for (const codeEl of nodes) {{
          const pre = codeEl.parentElement;
          const src = codeEl.textContent || '';
          const {{ svg }} = await mermaidApi.render('live-m-' + (++idx) + '-' + Date.now(), src);
          const wrap = document.createElement('div');
          wrap.innerHTML = svg;
          pre.replaceWith(wrap);
        }}
      }} catch (_) {{}}
    }}
    renderMermaid();
    setInterval(async () => {{
      try {{
        const res = await fetch('/version', {{ cache: 'no-store' }});
        if (!res.ok) return;
        const data = await res.json();
        if (data.version !== currentVersion) {{
          currentVersion = data.version;
          const bodyRes = await fetch('/body', {{ cache: 'no-store' }});
          if (!bodyRes.ok) return;
          const payload = await bodyRes.json();
          if (payload.isRawPage) {{
            location.reload();
            return;
          }}
          document.title = payload.title + ' — Onigiri Editor Live Preview';
          document.getElementById('preview-root').innerHTML = payload.bodyHtml;
          renderMermaid();
        }}
      }} catch (_) {{}}
    }}, 500);
  </script>
</body>
</html>"#,
        safe_title = safe_title,
        hljs_css = hljs_css,
        bg = bg,
        fg = fg,
        muted = muted,
        border = border,
        code_bg = code_bg,
        custom_css = content.custom_css,
        body = content.body_html,
        version = content.version,
        mermaid_dark = if is_dark { "true" } else { "false" }
    )
}

fn rewrite_attr_assets(html: &str, attr_prefix: &str, raw_page_mode: bool) -> String {
    let mut out = String::with_capacity(html.len());
    let mut rest = html;
    while let Some(pos) = rest.find(attr_prefix) {
        out.push_str(&rest[..pos + attr_prefix.len()]);
        rest = &rest[pos + attr_prefix.len()..];
        if let Some(end) = rest.find('"') {
            let val = &rest[..end];
            let trimmed = val.trim();
            let skip = trimmed.is_empty()
                || trimmed.starts_with("http://")
                || trimmed.starts_with("https://")
                || trimmed.starts_with("//")
                || trimmed.starts_with("data:")
                || trimmed.starts_with("blob:")
                || trimmed.starts_with('#')
                || trimmed.starts_with("mailto:")
                || trimmed.starts_with("tel:")
                || trimmed.starts_with("javascript:")
                || trimmed.starts_with("/asset?")
                || (raw_page_mode && !trimmed.starts_with("../") && !trimmed.starts_with("..\\") && !trimmed.starts_with("file://"));

            if skip {
                out.push_str(val);
            } else {
                let encoded: String =
                    url::form_urlencoded::byte_serialize(trimmed.as_bytes()).collect();
                out.push_str(&format!("/asset?path={}", encoded));
            }
            out.push('"');
            rest = &rest[end + 1..];
        } else {
            break;
        }
    }
    out.push_str(rest);
    out
}

fn rewrite_local_images(html: &str, raw_page_mode: bool) -> String {
    let pass1 = rewrite_attr_assets(html, "src=\"", raw_page_mode);
    rewrite_attr_assets(&pass1, "href=\"", raw_page_mode)
}

fn render_raw_page_html(content: &LivePreviewContent) -> String {
    let version = content.version;
    let reload_script = format!(
        r#"<script>
(function(){{
  var cur={version};
  setInterval(async function(){{
    try{{
      var r=await fetch('/version',{{cache:'no-store'}});
      if(!r.ok)return;
      var d=await r.json();
      if(d.version!==cur){{location.reload();}}
    }}catch(_){{}}
  }},450);
}})();
</script>"#
    );

    let trimmed = content.body_html.trim();
    let is_svg = content.title.to_ascii_lowercase().ends_with(".svg")
        || trimmed.starts_with("<svg");
    if is_svg {
        return format!(
            r#"<!doctype html>
<html>
<head><meta charset="UTF-8" /><title>{title}</title>
<style>html,body{{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;}}</style>
</head>
<body>{svg}{script}</body>
</html>"#,
            title = content.title.replace('<', "&lt;"),
            svg = content.body_html,
            script = reload_script
        );
    }

    let rewritten = rewrite_local_images(&content.body_html, true);
    if let Some(idx) = rewritten.rfind("</body>") {
        let mut out = String::with_capacity(rewritten.len() + reload_script.len());
        out.push_str(&rewritten[..idx]);
        out.push_str(&reload_script);
        out.push_str(&rewritten[idx..]);
        out
    } else if let Some(idx) = rewritten.rfind("</BODY>") {
        let mut out = String::with_capacity(rewritten.len() + reload_script.len());
        out.push_str(&rewritten[..idx]);
        out.push_str(&reload_script);
        out.push_str(&rewritten[idx..]);
        out
    } else {
        format!("{}\n{}", rewritten, reload_script)
    }
}

fn guess_mime(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase())
        .as_deref()
    {
        Some("html") | Some("htm") => "text/html; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("js") | Some("mjs") | Some("cjs") => "application/javascript; charset=utf-8",
        Some("json") | Some("map") => "application/json; charset=utf-8",
        Some("txt") => "text/plain; charset=utf-8",
        Some("wasm") => "application/wasm",
        Some("woff2") => "font/woff2",
        Some("woff") => "font/woff",
        Some("ttf") => "font/ttf",
        Some("otf") => "font/otf",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("svg") => "image/svg+xml",
        Some("bmp") => "image/bmp",
        Some("avif") => "image/avif",
        Some("ico") => "image/x-icon",
        _ => "application/octet-stream",
    }
}

fn safe_relative_subpath(req_path: &str) -> Option<PathBuf> {
    let trimmed = req_path.trim().trim_start_matches('/');
    if trimmed.is_empty() {
        return None;
    }
    let mut rel = PathBuf::new();
    for comp in Path::new(trimmed).components() {
        match comp {
            std::path::Component::Normal(s) => rel.push(s),
            std::path::Component::CurDir => {}
            _ => return None,
        }
    }
    if rel.as_os_str().is_empty() {
        None
    } else {
        Some(rel)
    }
}

fn resolve_static_candidate(
    req_path: &str,
    doc_dir: Option<&str>,
    workspace_root: Option<&str>,
) -> Option<PathBuf> {
    let rel = safe_relative_subpath(req_path)?;
    let mut bases: Vec<PathBuf> = Vec::new();
    if let Some(d) = doc_dir {
        bases.push(PathBuf::from(d));
    }
    if let Some(w) = workspace_root {
        let wp = PathBuf::from(w);
        bases.push(wp.clone());
        bases.push(wp.join("public"));
        bases.push(wp.join("dist"));
    }
    for base in bases {
        let candidate = base.join(&rel);
        if candidate.exists() && candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

async fn write_http_response(
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

async fn handle_connection(mut stream: TcpStream, state: Arc<RwLock<LivePreviewContent>>) {
    let mut buf = [0u8; 4096];
    let n = match stream.read(&mut buf).await {
        Ok(n) if n > 0 => n,
        _ => return,
    };
    let req_line = String::from_utf8_lossy(&buf[..n])
        .lines()
        .next()
        .unwrap_or("")
        .to_string();
    let target = req_line.split_whitespace().nth(1).unwrap_or("/");
    let (path, query) = target.split_once('?').unwrap_or((target, ""));

    match path {
        "/version" => {
            let ver = state.read().await.version;
            let body = serde_json::json!({ "version": ver }).to_string();
            write_http_response(&mut stream, "200 OK", "application/json; charset=utf-8", body.as_bytes()).await;
        }
        "/body" => {
            let guard = state.read().await;
            let payload = serde_json::json!({
                "title": guard.title,
                "bodyHtml": if guard.is_raw_page { guard.body_html.clone() } else { rewrite_local_images(&guard.body_html, false) },
                "isRawPage": guard.is_raw_page,
                "version": guard.version,
            })
            .to_string();
            write_http_response(&mut stream, "200 OK", "application/json; charset=utf-8", payload.as_bytes()).await;
        }
        "/asset" => {
            let raw_path = url::form_urlencoded::parse(query.as_bytes())
                .find(|(k, _)| k == "path")
                .map(|(_, v)| v.to_string())
                .unwrap_or_default();
            let (doc_dir, workspace_root) = {
                let guard = state.read().await;
                (guard.doc_dir.clone(), guard.workspace_root.clone())
            };
            let cleaned = raw_path.strip_prefix("file://").unwrap_or(&raw_path);
            let p = PathBuf::from(cleaned);
            let resolved = if cleaned.starts_with('/') {
                if let Some(found) = resolve_static_candidate(
                    cleaned,
                    doc_dir.as_deref(),
                    workspace_root.as_deref(),
                ) {
                    found
                } else {
                    p
                }
            } else if let Some(dir) = doc_dir {
                Path::new(&dir).join(p)
            } else if let Some(ws) = workspace_root {
                Path::new(&ws).join(p)
            } else {
                p
            };
            match tokio::fs::read(&resolved).await {
                Ok(bytes) => {
                    let mime = guess_mime(&resolved);
                    write_http_response(&mut stream, "200 OK", mime, &bytes).await;
                }
                Err(_) => {
                    write_http_response(&mut stream, "404 Not Found", "text/plain", b"Not Found").await;
                }
            }
        }
        _ => {
            let mut snapshot = state.read().await.clone();
            if path != "/" && path != "/index.html" {
                let decoded_path = url::form_urlencoded::parse(format!("p={}", path).as_bytes())
                    .find(|(k, _)| k == "p")
                    .map(|(_, v)| v.to_string())
                    .unwrap_or_else(|| path.to_string());
                if let Some(static_file) = resolve_static_candidate(
                    &decoded_path,
                    snapshot.doc_dir.as_deref(),
                    snapshot.workspace_root.as_deref(),
                ) {
                    if let Ok(bytes) = tokio::fs::read(&static_file).await {
                        let mime = guess_mime(&static_file);
                        write_http_response(&mut stream, "200 OK", mime, &bytes).await;
                        return;
                    }
                }
            }
            let html = if snapshot.is_raw_page {
                render_raw_page_html(&snapshot)
            } else {
                snapshot.body_html = rewrite_local_images(&snapshot.body_html, false);
                render_shell_html(&snapshot)
            };
            write_http_response(&mut stream, "200 OK", "text/html; charset=utf-8", html.as_bytes()).await;
        }
    }
}

#[tauri::command]
pub async fn start_external_preview(
    state: State<'_, LivePreviewState>,
    preferred_port: Option<u16>,
    open_browser: bool,
) -> Result<ExternalPreviewStatus, String> {
    {
        let existing = *state.port.read().await;
        if let Some(p) = existing {
            let url = format!("http://127.0.0.1:{}/", p);
            if open_browser {
                let _ = crate::browser::open_in_external_browser(url.clone());
            }
            return Ok(ExternalPreviewStatus {
                running: true,
                url: Some(url),
                port: Some(p),
            });
        }
    }

    let bind_addr = format!("127.0.0.1:{}", preferred_port.unwrap_or(17420));
    let listener = match TcpListener::bind(&bind_addr).await {
        Ok(l) => l,
        Err(_) => TcpListener::bind("127.0.0.1:0")
            .await
            .map_err(|e| format!("Failed to bind live preview server: {}", e))?,
    };
    let actual_port = listener.local_addr().map_err(|e| e.to_string())?.port();
    *state.port.write().await = Some(actual_port);

    let shared = state.inner.clone();
    let port_flag = state.port.clone();
    tokio::spawn(async move {
        loop {
            if port_flag.read().await.is_none() {
                break;
            }
            match listener.accept().await {
                Ok((stream, _)) => {
                    let st = shared.clone();
                    tokio::spawn(async move {
                        handle_connection(stream, st).await;
                    });
                }
                Err(_) => break,
            }
        }
    });

    let url = format!("http://127.0.0.1:{}/", actual_port);
    if open_browser {
        crate::browser::open_in_external_browser(url.clone())?;
    }

    Ok(ExternalPreviewStatus {
        running: true,
        url: Some(url),
        port: Some(actual_port),
    })
}

#[tauri::command]
pub async fn update_external_preview(
    state: State<'_, LivePreviewState>,
    title: String,
    body_html: String,
    theme: String,
    custom_css: String,
    doc_dir: Option<String>,
    workspace_root: Option<String>,
    is_raw_page: Option<bool>,
) -> Result<(), String> {
    let mut guard = state.inner.write().await;
    guard.title = title;
    guard.body_html = body_html;
    guard.theme = theme;
    guard.custom_css = custom_css;
    guard.doc_dir = doc_dir;
    guard.workspace_root = workspace_root;
    guard.is_raw_page = is_raw_page.unwrap_or(false);
    guard.version = guard.version.saturating_add(1);
    Ok(())
}

#[tauri::command]
pub async fn stop_external_preview(state: State<'_, LivePreviewState>) -> Result<(), String> {
    *state.port.write().await = None;
    Ok(())
}

#[tauri::command]
pub async fn get_external_preview_status(
    state: State<'_, LivePreviewState>,
) -> Result<ExternalPreviewStatus, String> {
    let p = *state.port.read().await;
    Ok(ExternalPreviewStatus {
        running: p.is_some(),
        url: p.map(|port| format!("http://127.0.0.1:{}/", port)),
        port: p,
    })
}
