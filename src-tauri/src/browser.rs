use serde::Serialize;
use tauri::{
    webview::{PageLoadEvent, WebviewBuilder},
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Rect, WebviewUrl,
};
use url::Url;

const BROWSER_WEBVIEW_LABEL: &str = "builtin-browser";

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct BrowserLoadEvent {
    state: &'static str,
    url: String,
}

fn normalize_url(raw: &str) -> Result<Url, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Url::parse("https://www.google.com").map_err(|e| e.to_string());
    }
    let candidate = if trimmed.starts_with("http://")
        || trimmed.starts_with("https://")
        || trimmed.starts_with("about:")
    {
        trimmed.to_string()
    } else if trimmed.starts_with("localhost")
        || trimmed.starts_with("127.0.0.1")
        || trimmed.starts_with("0.0.0.0")
        || trimmed.starts_with("[::1]")
    {
        format!("http://{}", trimmed)
    } else if trimmed.contains('.') && !trimmed.contains(' ') {
        format!("https://{}", trimmed)
    } else {
        format!(
            "https://www.google.com/search?q={}",
            url::form_urlencoded::byte_serialize(trimmed.as_bytes()).collect::<String>()
        )
    };
    Url::parse(&candidate).map_err(|e| format!("Invalid URL: {}", e))
}

#[tauri::command]
pub async fn browser_open_or_update(
    app: AppHandle,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    visible: bool,
) -> Result<String, String> {
    let parsed = normalize_url(&url)?;
    let parsed_str = parsed.to_string();
    let w = width.max(120.0);
    let h = height.max(120.0);

    tauri::async_runtime::spawn_blocking(move || {
        if let Some(wv) = app.get_webview(BROWSER_WEBVIEW_LABEL) {
            let _ = wv.set_bounds(Rect {
                position: LogicalPosition::new(x, y).into(),
                size: LogicalSize::new(w, h).into(),
            });
            if visible {
                let _ = wv.show();
            } else {
                let _ = wv.hide();
            }
            let current = wv.url().map(|u| u.to_string()).unwrap_or_default();
            if current != parsed_str || current == "about:blank" {
                wv.navigate(parsed).map_err(|e| e.to_string())?;
            }
            return Ok(parsed_str);
        }

        let window = app
            .get_window("main")
            .ok_or_else(|| "Main window not found".to_string())?;

        let app_for_nav = app.clone();
        let app_for_load = app.clone();

        let builder = WebviewBuilder::new(BROWSER_WEBVIEW_LABEL, WebviewUrl::External(parsed))
            .on_navigation(move |nav_url| {
                let _ = app_for_nav.emit("browser-url-changed", nav_url.to_string());
                true
            })
            .on_page_load(move |_webview, payload| {
                let url_str = payload.url().to_string();
                let is_finished = matches!(payload.event(), PageLoadEvent::Finished);
                let state = if is_finished { "finished" } else { "loading" };
                let _ = app_for_load.emit(
                    "browser-load-state",
                    BrowserLoadEvent {
                        state,
                        url: url_str.clone(),
                    },
                );
                if is_finished && !url_str.is_empty() {
                    let _ = app_for_load.emit("browser-url-changed", url_str);
                }
            });

        let child = window
            .add_child(builder, LogicalPosition::new(x, y), LogicalSize::new(w, h))
            .map_err(|e| format!("Failed to create embedded browser webview: {}", e))?;

        if !visible {
            let _ = child.hide();
        }

        Ok(parsed_str)
    })
    .await
    .map_err(|e| format!("Embedded browser task failed: {}", e))?
}

#[tauri::command]
pub async fn browser_set_bounds(
    app: AppHandle,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    visible: bool,
) -> Result<(), String> {
    let Some(wv) = app.get_webview(BROWSER_WEBVIEW_LABEL) else {
        return Ok(());
    };
    let w = width.max(80.0);
    let h = height.max(80.0);
    let _ = wv.set_bounds(Rect {
        position: LogicalPosition::new(x, y).into(),
        size: LogicalSize::new(w, h).into(),
    });
    if visible {
        let _ = wv.show();
    } else {
        let _ = wv.hide();
    }
    Ok(())
}

#[tauri::command]
pub async fn browser_navigate(app: AppHandle, url: String) -> Result<String, String> {
    let parsed = normalize_url(&url)?;
    let parsed_str = parsed.to_string();
    if let Some(wv) = app.get_webview(BROWSER_WEBVIEW_LABEL) {
        wv.navigate(parsed).map_err(|e| e.to_string())?;
    }
    Ok(parsed_str)
}

#[tauri::command]
pub async fn browser_nav_action(app: AppHandle, action: String) -> Result<(), String> {
    let Some(wv) = app.get_webview(BROWSER_WEBVIEW_LABEL) else {
        return Ok(());
    };
    let script = match action.as_str() {
        "back" => "window.history.back();",
        "forward" => "window.history.forward();",
        "reload" => "window.location.reload();",
        _ => return Ok(()),
    };
    wv.eval(script).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn browser_open_devtools(app: AppHandle) -> Result<bool, String> {
    let Some(wv) = app.get_webview(BROWSER_WEBVIEW_LABEL) else {
        return Err("Built-in browser is not open yet.".to_string());
    };
    #[cfg(target_os = "windows")]
    {
        wv.open_devtools();
        Ok(true)
    }
    #[cfg(not(target_os = "windows"))]
    {
        if wv.is_devtools_open() {
            wv.close_devtools();
            Ok(false)
        } else {
            wv.open_devtools();
            Ok(true)
        }
    }
}

#[tauri::command]
pub async fn browser_close(app: AppHandle) -> Result<(), String> {
    if let Some(wv) = app.get_webview(BROWSER_WEBVIEW_LABEL) {
        let _ = wv.hide();
        wv.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn open_in_external_browser(url: String) -> Result<(), String> {
    let parsed = normalize_url(&url)?;
    let target = parsed.to_string();

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&target)
            .spawn()
            .map_err(|e| format!("Failed to open browser: {}", e))?;
    }
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &target])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("Failed to open browser: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&target)
            .spawn()
            .map_err(|e| format!("Failed to open browser: {}", e))?;
    }
    Ok(())
}
