use serde::Serialize;
use std::sync::{Mutex, OnceLock};
use tauri::{
    webview::{PageLoadEvent, WebviewBuilder},
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Rect, WebviewUrl,
};
use url::Url;

const BROWSER_WEBVIEW_LABEL: &str = "builtin-browser";

#[derive(Clone, Copy, Debug)]
struct SavedBrowserBounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    visible: bool,
}

fn compute_macos_y_offset(inner_logical_height: f64, viewport_height: Option<f64>) -> f64 {
    let Some(vh) = viewport_height else {
        return 0.0;
    };
    if !inner_logical_height.is_finite() || !vh.is_finite() || vh <= 0.0 {
        return 0.0;
    }
    let delta = inner_logical_height - vh;
    if delta > 1.0 && delta <= 80.0 {
        delta
    } else {
        0.0
    }
}

fn adjust_y_for_macos_content_view(app: &AppHandle, y: f64, viewport_height: Option<f64>) -> f64 {
    #[cfg(target_os = "macos")]
    {
        if let Some(win) = app.get_window("main") {
            if let (Ok(inner), Ok(scale)) = (win.inner_size(), win.scale_factor()) {
                let logical_h = inner.to_logical::<f64>(scale.max(0.1)).height;
                return y + compute_macos_y_offset(logical_h, viewport_height);
            }
        }
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (app, viewport_height);
    y
}

static LAST_BROWSER_BOUNDS: OnceLock<Mutex<Option<SavedBrowserBounds>>> = OnceLock::new();

fn save_browser_bounds(bounds: SavedBrowserBounds) {
    let lock = LAST_BROWSER_BOUNDS.get_or_init(|| Mutex::new(None));
    if let Ok(mut guard) = lock.lock() {
        *guard = Some(bounds);
    }
}

#[allow(dead_code)]
fn load_browser_bounds() -> Option<SavedBrowserBounds> {
    let lock = LAST_BROWSER_BOUNDS.get_or_init(|| Mutex::new(None));
    lock.lock().ok().and_then(|g| *g)
}

#[cfg(target_os = "macos")]
fn configure_detached_inspector_defaults() {
    use objc2_foundation::{NSString, NSUserDefaults};
    let defaults = NSUserDefaults::standardUserDefaults();
    for key in [
        "__WebInspectorPageGroupLevel1__.WebKit2InspectorStartsAttached",
        "WebKit2InspectorStartsAttached",
        "WebInspectorStartsAttached",
    ] {
        let ns_key = NSString::from_str(key);
        defaults.setBool_forKey(false, &ns_key);
    }
}

fn is_allowed_embedded_navigation_url(url: &Url) -> bool {
    matches!(url.scheme(), "http" | "https" | "about" | "blob" | "data")
}

fn is_allowed_external_browser_url(url: &Url) -> bool {
    matches!(url.scheme(), "http" | "https")
}

fn create_embedded_browser_webview(
    app: &AppHandle,
    parsed: Url,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
    visible: bool,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    configure_detached_inspector_defaults();

    let window = app
        .get_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;

    let app_for_nav = app.clone();
    let app_for_load = app.clone();

    let builder = WebviewBuilder::new(BROWSER_WEBVIEW_LABEL, WebviewUrl::External(parsed))
        .on_navigation(move |nav_url| {
            if !is_allowed_embedded_navigation_url(nav_url) {
                return false;
            }
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
    Ok(())
}

#[allow(dead_code)]
fn apply_saved_browser_bounds(app: &AppHandle) {
    let Some(bounds) = load_browser_bounds() else {
        return;
    };
    let Some(wv) = app.get_webview(BROWSER_WEBVIEW_LABEL) else {
        return;
    };
    #[cfg(target_os = "macos")]
    {
        use objc2::msg_send;
        use objc2::runtime::AnyObject;
        let _ = wv.with_webview(|pwv| unsafe {
            let wk_webview = pwv.inner() as *mut AnyObject;
            if !wk_webview.is_null() {
                let () = msg_send![wk_webview, setAutoresizingMask: 0usize];
            }
        });
    }
    let w = bounds.width.max(80.0);
    let h = bounds.height.max(80.0);
    let _ = wv.set_bounds(Rect {
        position: LogicalPosition::new(bounds.x, bounds.y).into(),
        size: LogicalSize::new(w, h).into(),
    });
    if bounds.visible {
        let _ = wv.show();
    } else {
        let _ = wv.hide();
    }
}

#[cfg(target_os = "macos")]
fn detach_macos_inspector_if_attached(app: &AppHandle) {
    use objc2::runtime::AnyObject;
    use objc2::{msg_send, sel};
    let Some(wv) = app.get_webview(BROWSER_WEBVIEW_LABEL) else {
        return;
    };
    let _ = wv.with_webview(|pwv| unsafe {
        configure_detached_inspector_defaults();
        let wk_webview = pwv.inner() as *mut AnyObject;
        if !wk_webview.is_null() {
            let inspector: *mut AnyObject = msg_send![wk_webview, _inspector];
            if !inspector.is_null() {
                let is_visible: bool = msg_send![inspector, isVisible];
                let can_detach: bool = msg_send![inspector, respondsToSelector: sel!(detach)];
                if is_visible && can_detach {
                    let () = msg_send![inspector, detach];
                }
            }
            let () = msg_send![wk_webview, setAutoresizingMask: 0usize];
        }
    });
}

#[cfg(target_os = "macos")]
fn check_macos_child_webview_corrupted(app: &AppHandle) -> bool {
    use objc2::msg_send;
    use objc2::runtime::AnyObject;
    use std::sync::mpsc;
    use std::time::Duration;

    let Some(wv) = app.get_webview(BROWSER_WEBVIEW_LABEL) else {
        return false;
    };
    let expected = load_browser_bounds();
    let (tx, rx) = mpsc::channel::<bool>();
    let _ = wv.with_webview(move |pwv| {
        let mut corrupted = false;
        unsafe {
            let wk_webview = pwv.inner() as *mut AnyObject;
            let ns_window = pwv.ns_window() as *mut AnyObject;
            if !wk_webview.is_null() && !ns_window.is_null() {
                let superview: *mut AnyObject = msg_send![wk_webview, superview];
                let content_view: *mut AnyObject = msg_send![ns_window, contentView];
                if superview.is_null() || content_view.is_null() || superview != content_view {
                    corrupted = true;
                }
            }
        }
        let _ = tx.send(corrupted);
    });
    let superview_bad = rx.recv_timeout(Duration::from_millis(600)).unwrap_or(false);
    if superview_bad {
        return true;
    }
    if let (Ok(actual), Some(exp)) = (wv.bounds(), expected) {
        let scale = app
            .get_window("main")
            .and_then(|win| win.scale_factor().ok())
            .unwrap_or(1.0);
        let actual_pos = actual.position.to_logical::<f64>(scale);
        let actual_size = actual.size.to_logical::<f64>(scale);
        if (actual_pos.x - exp.x).abs() > 24.0
            || (actual_size.width - exp.width).abs() > 24.0
        {
            return true;
        }
    }
    false
}

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
    viewport_height: Option<f64>,
) -> Result<String, String> {
    let parsed = normalize_url(&url)?;
    let parsed_str = parsed.to_string();
    let w = width.max(120.0);
    let h = height.max(120.0);
    let adj_y = adjust_y_for_macos_content_view(&app, y, viewport_height);
    save_browser_bounds(SavedBrowserBounds {
        x,
        y: adj_y,
        width: w,
        height: h,
        visible,
    });

    tauri::async_runtime::spawn_blocking(move || {
        if let Some(wv) = app.get_webview(BROWSER_WEBVIEW_LABEL) {
            let _ = wv.set_bounds(Rect {
                position: LogicalPosition::new(x, adj_y).into(),
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

        create_embedded_browser_webview(&app, parsed, x, adj_y, w, h, visible)?;
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
    viewport_height: Option<f64>,
) -> Result<(), String> {
    let w = width.max(80.0);
    let h = height.max(80.0);
    let adj_y = adjust_y_for_macos_content_view(&app, y, viewport_height);
    save_browser_bounds(SavedBrowserBounds {
        x,
        y: adj_y,
        width: w,
        height: h,
        visible,
    });
    let Some(wv) = app.get_webview(BROWSER_WEBVIEW_LABEL) else {
        return Ok(());
    };
    let _ = wv.set_bounds(Rect {
        position: LogicalPosition::new(x, adj_y).into(),
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
    #[cfg(target_os = "macos")]
    {
        use objc2::runtime::AnyObject;
        use objc2::{msg_send, sel};
        use std::sync::mpsc;
        use std::time::Duration;

        let current_url = wv.url().ok();
        let was_open = wv.is_devtools_open();
        let (tx, rx) = mpsc::channel::<()>();

        let _ = wv.with_webview(move |pwv| {
            unsafe {
                configure_detached_inspector_defaults();
                let wk_webview = pwv.inner() as *mut AnyObject;
                if !wk_webview.is_null() {
                    let inspector: *mut AnyObject = msg_send![wk_webview, _inspector];
                    if !inspector.is_null() {
                        let can_detach: bool =
                            msg_send![inspector, respondsToSelector: sel!(detach)];
                        if was_open {
                            if can_detach {
                                let () = msg_send![inspector, detach];
                            }
                            let () = msg_send![inspector, close];
                        } else {
                            let () = msg_send![inspector, show];
                            if can_detach {
                                let () = msg_send![inspector, detach];
                            }
                        }
                    }
                    let () = msg_send![wk_webview, setAutoresizingMask: 0usize];
                }
            }
            let _ = tx.send(());
        });

        let _ = tauri::async_runtime::spawn_blocking(move || {
            let _ = rx.recv_timeout(Duration::from_millis(800));
        })
        .await;

        if was_open {
            // Allow WebKit to finish its async close/detach cycle, then verify the child
            // WKWebView's superview and frame; if WebKit corrupted them, recreate cleanly.
            tokio::time::sleep(Duration::from_millis(120)).await;
            apply_saved_browser_bounds(&app);
            let app_check = app.clone();
            let corrupted = tauri::async_runtime::spawn_blocking(move || {
                check_macos_child_webview_corrupted(&app_check)
            })
            .await
            .unwrap_or(false);

            if corrupted {
                if let (Some(url), Some(bounds)) = (current_url, load_browser_bounds()) {
                    let app_recreate = app.clone();
                    let _ = tauri::async_runtime::spawn_blocking(move || {
                        if let Some(old) = app_recreate.get_webview(BROWSER_WEBVIEW_LABEL) {
                            let _ = old.hide();
                            let _ = old.close();
                        }
                        std::thread::sleep(Duration::from_millis(80));
                        let _ = create_embedded_browser_webview(
                            &app_recreate,
                            url,
                            bounds.x,
                            bounds.y,
                            bounds.width.max(120.0),
                            bounds.height.max(120.0),
                            bounds.visible,
                        );
                    })
                    .await;
                }
            } else {
                let app_delayed = app.clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(Duration::from_millis(220)).await;
                    apply_saved_browser_bounds(&app_delayed);
                });
            }
        } else {
            // WebKit opens Web Inspector asynchronously; detach and re-enforce child bounds
            // after IPC settles so the child WKWebView never expands across the main window.
            apply_saved_browser_bounds(&app);
            let app_delayed = app.clone();
            tauri::async_runtime::spawn(async move {
                for delay_ms in [120u64, 300u64, 600u64] {
                    tokio::time::sleep(Duration::from_millis(delay_ms)).await;
                    detach_macos_inspector_if_attached(&app_delayed);
                    apply_saved_browser_bounds(&app_delayed);
                }
            });
        }

        Ok(!was_open)
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        if wv.is_devtools_open() {
            wv.close_devtools();
            apply_saved_browser_bounds(&app);
            Ok(false)
        } else {
            wv.open_devtools();
            apply_saved_browser_bounds(&app);
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

#[cfg(any(target_os = "windows", test))]
fn build_windows_screenshot_ps(
    phys_x: i32,
    phys_y: i32,
    phys_w: i32,
    phys_h: i32,
    out_path: &str,
) -> String {
    let escaped_out = out_path.replace('\'', "''");
    format!(
        "Add-Type -AssemblyName System.Drawing; \
         Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class OnigiriDpi {{ [DllImport(\"user32.dll\")] public static extern IntPtr SetProcessDpiAwarenessContext(IntPtr value); [DllImport(\"user32.dll\")] public static extern bool SetProcessDPIAware(); }}' -ErrorAction SilentlyContinue; \
         try {{ [void][OnigiriDpi]::SetProcessDpiAwarenessContext([IntPtr](-4)) }} catch {{ try {{ [void][OnigiriDpi]::SetProcessDPIAware() }} catch {{}} }}; \
         $bmp = New-Object System.Drawing.Bitmap({}, {}); \
         $g = [System.Drawing.Graphics]::FromImage($bmp); \
         $g.CopyFromScreen({}, {}, 0, 0, $bmp.Size); \
         $bmp.Save('{}', [System.Drawing.Imaging.ImageFormat]::Png); \
         $g.Dispose(); $bmp.Dispose()",
        phys_w, phys_h, phys_x, phys_y, escaped_out
    )
}

#[cfg(any(all(unix, not(target_os = "macos")), test))]
fn format_x11_crop_geometry(phys_x: i32, phys_y: i32, phys_w: u32, phys_h: u32) -> String {
    format!("{}x{}{:+}{:+}", phys_w, phys_h, phys_x, phys_y)
}

#[tauri::command]
pub async fn browser_capture_screenshot(
    app: AppHandle,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
    use std::time::{SystemTime, UNIX_EPOCH};

    let window = app
        .get_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;

    let scale = window.scale_factor().unwrap_or(1.0);
    let inner_pos = window
        .inner_position()
        .map_err(|e| format!("Failed to read window position: {}", e))?;

    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let out_path = std::env::temp_dir().join(format!("onigiri-browser-shot-{}.png", stamp));
    let out_str = out_path.to_string_lossy().to_string();

    #[cfg(target_os = "macos")]
    {
        let logical_origin_x = (inner_pos.x as f64) / scale;
        let logical_origin_y = (inner_pos.y as f64) / scale;
        let cap_x = (logical_origin_x + x).round() as i32;
        let cap_y = (logical_origin_y + y).round() as i32;
        let cap_w = width.max(120.0).round() as u32;
        let cap_h = height.max(120.0).round() as u32;
        let rect_arg = format!("{},{},{},{}", cap_x, cap_y, cap_w, cap_h);
        let status = std::process::Command::new("screencapture")
            .args(["-x", "-t", "png", "-R", &rect_arg, &out_str])
            .status()
            .map_err(|e| format!("Failed to run screencapture: {}", e))?;
        if !status.success() {
            return Err(
                "Screen capture failed. Please grant Screen Recording permission to Onigiri Editor in macOS System Settings if prompted."
                    .to_string(),
            );
        }
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let phys_x = (inner_pos.x as f64 + x * scale).round() as i32;
        let phys_y = (inner_pos.y as f64 + y * scale).round() as i32;
        let phys_w = (width.max(120.0) * scale).round() as i32;
        let phys_h = (height.max(120.0) * scale).round() as i32;
        let ps = build_windows_screenshot_ps(phys_x, phys_y, phys_w, phys_h, &out_str);
        let status = std::process::Command::new("powershell")
            .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &ps])
            .creation_flags(CREATE_NO_WINDOW)
            .status()
            .map_err(|e| format!("Failed to run PowerShell screenshot capture: {}", e))?;
        if !status.success() {
            return Err("Failed to capture browser screenshot on Windows".to_string());
        }
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let logical_origin_x = (inner_pos.x as f64) / scale;
        let logical_origin_y = (inner_pos.y as f64) / scale;
        let cap_x = (logical_origin_x + x).round() as i32;
        let cap_y = (logical_origin_y + y).round() as i32;
        let cap_w = width.max(120.0).round() as u32;
        let cap_h = height.max(120.0).round() as u32;

        let phys_x = (inner_pos.x as f64 + x * scale).round() as i32;
        let phys_y = (inner_pos.y as f64 + y * scale).round() as i32;
        let phys_w = (width.max(120.0) * scale).round() as u32;
        let phys_h = (height.max(120.0) * scale).round() as u32;

        let is_wayland = std::env::var_os("WAYLAND_DISPLAY").is_some();
        let grim_geom = format!("{},{} {}x{}", cap_x, cap_y, cap_w, cap_h);
        let x11_crop = format_x11_crop_geometry(phys_x, phys_y, phys_w, phys_h);
        let scrot_area = format!("{},{},{},{}", phys_x, phys_y, phys_w, phys_h);

        let try_wayland = || {
            std::process::Command::new("grim")
                .args(["-g", &grim_geom, &out_str])
                .status()
                .map(|s| s.success())
                .unwrap_or(false)
        };
        let try_x11 = || {
            std::process::Command::new("import")
                .args(["-window", "root", "-crop", &x11_crop, &out_str])
                .status()
                .map(|s| s.success())
                .unwrap_or(false)
                || std::process::Command::new("maim")
                    .args(["-g", &x11_crop, &out_str])
                    .status()
                    .map(|s| s.success())
                    .unwrap_or(false)
                || std::process::Command::new("scrot")
                    .args(["-a", &scrot_area, &out_str])
                    .status()
                    .map(|s| s.success())
                    .unwrap_or(false)
        };

        let ok = if is_wayland {
            try_wayland() || try_x11()
        } else {
            try_x11() || try_wayland()
        };
        if !ok {
            return Err(
                "Screenshot tool not found on Linux (install `grim` on Wayland, or `import` / `maim` / `scrot` on X11)."
                    .to_string(),
            );
        }
    }

    let bytes = std::fs::read(&out_path)
        .map_err(|e| format!("Failed to read captured screenshot: {}", e))?;
    let _ = std::fs::remove_file(&out_path);
    if bytes.is_empty() {
        return Err("Captured screenshot was empty".to_string());
    }
    Ok(BASE64.encode(bytes))
}

#[tauri::command]
pub async fn open_in_external_browser(url: String) -> Result<(), String> {
    let parsed = normalize_url(&url)?;
    if !is_allowed_external_browser_url(&parsed) {
        return Err("Only http:// and https:// URLs can be opened externally".to_string());
    }
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
        std::process::Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", &target])
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn windows_screenshot_script_enables_dpi_awareness_and_escapes_path() {
        let ps = build_windows_screenshot_ps(-400, 120, 800, 600, r"C:\Temp\o'shot.png");
        assert!(ps.contains("SetProcessDpiAwarenessContext"));
        assert!(ps.contains("SetProcessDPIAware"));
        assert!(ps.contains("CopyFromScreen(-400, 120"));
        assert!(ps.contains("o''shot.png"));
    }

    #[test]
    fn formats_x11_crop_geometry_including_negative_monitor_offsets() {
        assert_eq!(format_x11_crop_geometry(100, 50, 800, 600), "800x600+100+50");
        assert_eq!(format_x11_crop_geometry(-200, -40, 800, 600), "800x600-200-40");
    }

    #[test]
    fn blocks_unsafe_url_schemes_for_embedded_and_external_browser() {
        assert!(is_allowed_embedded_navigation_url(&Url::parse("https://example.com").unwrap()));
        assert!(is_allowed_embedded_navigation_url(&Url::parse("http://localhost:3000").unwrap()));
        assert!(!is_allowed_embedded_navigation_url(&Url::parse("file:///etc/passwd").unwrap()));
        assert!(!is_allowed_embedded_navigation_url(&Url::parse("javascript:alert(1)").unwrap()));

        assert!(is_allowed_external_browser_url(&Url::parse("https://example.com").unwrap()));
        assert!(!is_allowed_external_browser_url(&Url::parse("about:blank").unwrap()));
        assert!(!is_allowed_external_browser_url(&Url::parse("file:///etc/passwd").unwrap()));
    }
}
