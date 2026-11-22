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
}
