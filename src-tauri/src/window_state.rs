use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{mpsc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, Runtime};

pub const MAIN_WINDOW_LABEL: &str = "main";
const DEFAULT_WIDTH: f64 = 1360.0;
const DEFAULT_HEIGHT: f64 = 860.0;
const MIN_WIDTH: f64 = 820.0;
const MIN_HEIGHT: f64 = 560.0;
const MAX_DIMENSION: f64 = 16384.0;
const STATE_FILE_NAME: &str = "window-state.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SavedWindowState {
    pub width: f64,
    pub height: f64,
    #[serde(default)]
    pub x: Option<f64>,
    #[serde(default)]
    pub y: Option<f64>,
    #[serde(default)]
    pub maximized: bool,
}

impl Default for SavedWindowState {
    fn default() -> Self {
        Self {
            width: DEFAULT_WIDTH,
            height: DEFAULT_HEIGHT,
            x: None,
            y: None,
            maximized: false,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
struct LogicalRect {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

struct WindowStateInner {
    state: SavedWindowState,
    dirty: bool,
    restored: bool,
    file_path: Option<PathBuf>,
}

pub struct WindowStateManager {
    inner: Mutex<WindowStateInner>,
    save_tx: Mutex<Option<mpsc::Sender<()>>>,
}

impl WindowStateManager {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(WindowStateInner {
                state: SavedWindowState::default(),
                dirty: false,
                restored: false,
                file_path: None,
            }),
            save_tx: Mutex::new(None),
        }
    }

    fn ensure_worker<R: Runtime>(&self, app: &AppHandle<R>) {
        let mut tx_guard = self.save_tx.lock().unwrap();
        if tx_guard.is_some() {
            return;
        }
        let (tx, rx) = mpsc::channel::<()>();
        let app_handle = app.clone();
        std::thread::spawn(move || {
            while rx.recv().is_ok() {
                // Coalesce bursty resize/move events for 350ms before writing to disk.
                std::thread::sleep(Duration::from_millis(350));
                while rx.try_recv().is_ok() {}
                if let Some(mgr) = app_handle.try_state::<WindowStateManager>() {
                    mgr.flush_to_disk();
                }
            }
        });
        *tx_guard = Some(tx);
    }

    fn schedule_save<R: Runtime>(&self, app: &AppHandle<R>) {
        self.ensure_worker(app);
        if let Some(tx) = self.save_tx.lock().unwrap().as_ref() {
            let _ = tx.send(());
        }
    }

    pub fn flush_to_disk(&self) {
        let (snapshot, path_opt) = {
            let mut guard = self.inner.lock().unwrap();
            if !guard.dirty {
                return;
            }
            let Some(path) = guard.file_path.clone() else {
                return;
            };
            guard.dirty = false;
            (guard.state.clone(), Some(path))
        };

        if let Some(path) = path_opt {
            if let Err(err) = write_window_state_file(&path, &snapshot) {
                let mut guard = self.inner.lock().unwrap();
                guard.dirty = true;
                eprintln!("[Onigiri Editor] Failed to persist window state: {}", err);
            }
        }
    }
}

fn sanitize_window_state(raw: SavedWindowState) -> SavedWindowState {
    let width = if raw.width.is_finite() && raw.width > 0.0 {
        raw.width.clamp(MIN_WIDTH, MAX_DIMENSION)
    } else {
        DEFAULT_WIDTH
    };
    let height = if raw.height.is_finite() && raw.height > 0.0 {
        raw.height.clamp(MIN_HEIGHT, MAX_DIMENSION)
    } else {
        DEFAULT_HEIGHT
    };
    let (x, y) = match (raw.x, raw.y) {
        (Some(px), Some(py))
            if px.is_finite()
                && py.is_finite()
                && px > -10000.0
                && py > -10000.0
                && px < 32768.0
                && py < 32768.0 =>
        {
            (Some(px), Some(py))
        }
        _ => (None, None),
    };

    SavedWindowState {
        width,
        height,
        x,
        y,
        maximized: raw.maximized,
    }
}

fn is_rect_visible_on_monitors(win: LogicalRect, monitors: &[LogicalRect]) -> bool {
    if monitors.is_empty() {
        return true;
    }
    monitors.iter().any(|m| {
        let overlap_x = (win.x + win.width).min(m.x + m.width) - win.x.max(m.x);
        // Keep the top edge (title bar) reachable so the window can always be dragged.
        let top_visible = win.y >= m.y - 24.0 && win.y <= m.y + m.height - 48.0;
        overlap_x >= 64.0 && top_visible
    })
}

fn read_window_state_file(path: &Path) -> Option<SavedWindowState> {
    let content = fs::read_to_string(path).ok()?;
    let parsed: SavedWindowState = serde_json::from_str(&content).ok()?;
    Some(sanitize_window_state(parsed))
}

fn write_window_state_file(path: &Path, state: &SavedWindowState) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create config dir: {}", e))?;
        }
    }
    let json = serde_json::to_string_pretty(state)
        .map_err(|e| format!("Failed to serialize window state: {}", e))?;
    fs::write(path, json).map_err(|e| format!("Failed to write {}: {}", path.display(), e))
}

fn state_file_path<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join(STATE_FILE_NAME))
}

pub fn restore_main_window_state<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return;
    };

    let path = state_file_path(app);
    let saved = path.as_deref().and_then(read_window_state_file);

    if let Some(ref state) = saved {
        let _ = window.set_size(LogicalSize::new(state.width, state.height));

        let mut placed = false;
        if let (Some(x), Some(y)) = (state.x, state.y) {
            let monitors: Vec<LogicalRect> = window
                .available_monitors()
                .unwrap_or_default()
                .into_iter()
                .map(|m| {
                    let scale = m.scale_factor().max(0.1);
                    let pos = m.position().to_logical::<f64>(scale);
                    let size = m.size().to_logical::<f64>(scale);
                    LogicalRect {
                        x: pos.x,
                        y: pos.y,
                        width: size.width,
                        height: size.height,
                    }
                })
                .collect();

            let target = LogicalRect {
                x,
                y,
                width: state.width,
                height: state.height,
            };
            if is_rect_visible_on_monitors(target, &monitors) {
                let _ = window.set_position(LogicalPosition::new(x, y));
                placed = true;
            }
        }

        if !placed {
            let _ = window.center();
        }

        if state.maximized {
            let _ = window.maximize();
        }
    }

    if let Some(mgr) = app.try_state::<WindowStateManager>() {
        let mut guard = mgr.inner.lock().unwrap();
        guard.file_path = path;
        if let Some(state) = saved {
            guard.state = state;
        } else if let Ok(scale) = window.scale_factor() {
            let scale = scale.max(0.1);
            if let Ok(inner_size) = window.inner_size() {
                let logical = inner_size.to_logical::<f64>(scale);
                guard.state.width = logical.width.max(MIN_WIDTH);
                guard.state.height = logical.height.max(MIN_HEIGHT);
            }
            if let Ok(outer_pos) = window.outer_position() {
                let logical = outer_pos.to_logical::<f64>(scale);
                guard.state.x = Some(logical.x);
                guard.state.y = Some(logical.y);
            }
            guard.state.maximized = window.is_maximized().unwrap_or(false);
        }
        guard.dirty = false;
        guard.restored = true;
    }

    let _ = window.show();
    let _ = window.set_focus();
}

pub fn capture_main_window_state<R: Runtime>(app: &AppHandle<R>, flush_immediately: bool) {
    let Some(mgr) = app.try_state::<WindowStateManager>() else {
        return;
    };
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return;
    };

    {
        let guard = mgr.inner.lock().unwrap();
        if !guard.restored {
            return;
        }
    }

    if window.is_minimized().unwrap_or(false) || window.is_fullscreen().unwrap_or(false) {
        if flush_immediately {
            mgr.flush_to_disk();
        }
        return;
    }

    let is_maximized = window.is_maximized().unwrap_or(false);
    let scale = window.scale_factor().unwrap_or(1.0).max(0.1);

    let mut changed = false;
    {
        let mut guard = mgr.inner.lock().unwrap();
        if guard.file_path.is_none() {
            guard.file_path = state_file_path(app);
        }

        if is_maximized {
            if !guard.state.maximized {
                guard.state.maximized = true;
                guard.dirty = true;
                changed = true;
            }
        } else {
            let mut next = guard.state.clone();
            next.maximized = false;

            if let Ok(inner_size) = window.inner_size() {
                let logical = inner_size.to_logical::<f64>(scale);
                // Ignore transient tiny sizes emitted on some platforms during minimize/teardown.
                if logical.width >= MIN_WIDTH * 0.5 && logical.height >= MIN_HEIGHT * 0.5 {
                    next.width = logical.width.clamp(MIN_WIDTH, MAX_DIMENSION);
                    next.height = logical.height.clamp(MIN_HEIGHT, MAX_DIMENSION);
                }
            }
            if let Ok(outer_pos) = window.outer_position() {
                let logical = outer_pos.to_logical::<f64>(scale);
                if logical.x > -10000.0
                    && logical.y > -10000.0
                    && logical.x < 32768.0
                    && logical.y < 32768.0
                {
                    next.x = Some(logical.x);
                    next.y = Some(logical.y);
                }
            }

            if next != guard.state {
                guard.state = next;
                guard.dirty = true;
                changed = true;
            }
        }
    }

    if flush_immediately {
        mgr.flush_to_disk();
    } else if changed {
        mgr.schedule_save(app);
    }
}

pub fn flush_window_state<R: Runtime>(app: &AppHandle<R>) {
    if let Some(mgr) = app.try_state::<WindowStateManager>() {
        mgr.flush_to_disk();
    }
}

fn remove_window_state_file(path: &Path) -> Result<(), String> {
    if path.exists() {
        fs::remove_file(path)
            .map_err(|e| format!("Failed to remove {}: {}", path.display(), e))?;
    }
    Ok(())
}

pub fn reset_main_window_state<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let resolved_path = state_file_path(app);
    if let Some(mgr) = app.try_state::<WindowStateManager>() {
        let mut guard = mgr.inner.lock().unwrap();
        let target_path = guard.file_path.clone().or(resolved_path.clone());
        if let Some(path) = target_path.as_deref() {
            remove_window_state_file(path)?;
        }
        guard.state = SavedWindowState::default();
        guard.dirty = false;
        guard.restored = false;
    } else if let Some(path) = resolved_path.as_deref() {
        remove_window_state_file(path)?;
    }

    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        if window.is_maximized().unwrap_or(false) {
            let _ = window.unmaximize();
        }
        let _ = window.set_size(LogicalSize::new(DEFAULT_WIDTH, DEFAULT_HEIGHT));
        let _ = window.center();
    }

    if let Some(mgr) = app.try_state::<WindowStateManager>() {
        let mut guard = mgr.inner.lock().unwrap();
        guard.dirty = false;
        guard.restored = true;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_clamps_invalid_and_small_dimensions() {
        let sanitized = sanitize_window_state(SavedWindowState {
            width: 120.0,
            height: -50.0,
            x: Some(-32000.0),
            y: Some(200.0),
            maximized: true,
        });

        assert_eq!(sanitized.width, MIN_WIDTH);
        assert_eq!(sanitized.height, DEFAULT_HEIGHT);
        assert_eq!(sanitized.x, None);
        assert_eq!(sanitized.y, None);
        assert!(sanitized.maximized);
    }

    #[test]
    fn monitor_visibility_accepts_visible_and_rejects_disconnected_monitor() {
        let primary = LogicalRect {
            x: 0.0,
            y: 0.0,
            width: 1920.0,
            height: 1080.0,
        };
        let monitors = vec![primary];

        assert!(is_rect_visible_on_monitors(
            LogicalRect {
                x: 100.0,
                y: 80.0,
                width: 1200.0,
                height: 800.0,
            },
            &monitors
        ));

        // Window previously on a detached monitor to the right.
        assert!(!is_rect_visible_on_monitors(
            LogicalRect {
                x: 2100.0,
                y: 120.0,
                width: 1200.0,
                height: 800.0,
            },
            &monitors
        ));

        // Title bar off-screen above the top edge.
        assert!(!is_rect_visible_on_monitors(
            LogicalRect {
                x: 100.0,
                y: -200.0,
                width: 1200.0,
                height: 800.0,
            },
            &monitors
        ));
    }

    #[test]
    fn round_trips_window_state_file() {
        let base = std::env::temp_dir().join(format!(
            "onigiri_win_state_test_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let file_path = base.join(STATE_FILE_NAME);
        let state = SavedWindowState {
            width: 1520.5,
            height: 940.0,
            x: Some(120.0),
            y: Some(45.0),
            maximized: false,
        };

        write_window_state_file(&file_path, &state).unwrap();
        let loaded = read_window_state_file(&file_path).unwrap();
        assert_eq!(loaded, state);

        assert!(file_path.exists());
        remove_window_state_file(&file_path).unwrap();
        assert!(!file_path.exists());
        remove_window_state_file(&file_path).unwrap();

        let _ = fs::remove_dir_all(&base);
    }
}
