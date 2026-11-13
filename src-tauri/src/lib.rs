use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{Emitter, Manager, State};
use walkdir::WalkDir;

struct OpenedFilesState(Mutex<Vec<String>>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceEntry {
    name: String,
    path: String,
    relative_path: String,
    is_dir: bool,
    size: u64,
    modified_ms: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatch {
    path: String,
    relative_path: String,
    name: String,
    line: usize,
    snippet: String,
}

fn is_markdown_or_text(path: &Path) -> bool {
    let Some(ext) = path.extension().and_then(|e| e.to_str()) else {
        return false;
    };
    matches!(
        ext.to_ascii_lowercase().as_str(),
        "md" | "markdown" | "mdown" | "mdx" | "txt"
    )
}

fn should_skip_dir(name: &str) -> bool {
    matches!(
        name,
        "node_modules" | ".git" | "target" | "dist" | "build" | ".next" | ".nuxt" | ".venv"
    ) || name.starts_with('.')
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read {}: {}", path, e))
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }
    }
    fs::write(&path, content).map_err(|e| format!("Failed to write {}: {}", path, e))
}

#[tauri::command]
fn scan_workspace(root_path: String) -> Result<Vec<WorkspaceEntry>, String> {
    let root = PathBuf::from(&root_path);
    if !root.exists() || !root.is_dir() {
        return Err("Workspace path is not a directory".to_string());
    }

    let mut entries = Vec::new();
    let mut count = 0usize;
    let walker = WalkDir::new(&root)
        .max_depth(8)
        .into_iter()
        .filter_entry(|e| {
            if e.depth() == 0 {
                return true;
            }
            let name = e.file_name().to_string_lossy();
            if e.file_type().is_dir() {
                !should_skip_dir(&name)
            } else {
                is_markdown_or_text(e.path())
            }
        });

    for entry in walker.flatten() {
        if entry.depth() == 0 {
            continue;
        }
        let path = entry.path();
        let is_dir = entry.file_type().is_dir();
        if !is_dir && !is_markdown_or_text(path) {
            continue;
        }

        let Ok(rel) = path.strip_prefix(&root) else {
            continue;
        };
        let meta = entry.metadata().ok();
        let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
        let modified_ms = meta
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        entries.push(WorkspaceEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: path.to_string_lossy().to_string(),
            relative_path: rel.to_string_lossy().to_string(),
            is_dir,
            size,
            modified_ms,
        });

        count += 1;
        if count >= 2000 {
            break;
        }
    }

    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.relative_path.to_lowercase().cmp(&b.relative_path.to_lowercase()))
    });

    Ok(entries)
}

#[tauri::command]
fn search_workspace(root_path: String, query: String) -> Result<Vec<SearchMatch>, String> {
    let q = query.trim().to_lowercase();
    if q.is_empty() {
        return Ok(Vec::new());
    }
    let root = PathBuf::from(&root_path);
    if !root.exists() || !root.is_dir() {
        return Err("Workspace path is not a directory".to_string());
    }

    let mut matches = Vec::new();
    let walker = WalkDir::new(&root)
        .max_depth(8)
        .into_iter()
        .filter_entry(|e| {
            if e.depth() == 0 {
                return true;
            }
            let name = e.file_name().to_string_lossy();
            if e.file_type().is_dir() {
                !should_skip_dir(&name)
            } else {
                is_markdown_or_text(e.path())
            }
        });

    for entry in walker.flatten() {
        if entry.file_type().is_dir() || !is_markdown_or_text(entry.path()) {
            continue;
        }
        let Ok(meta) = entry.metadata() else {
            continue;
        };
        if meta.len() > 2 * 1024 * 1024 {
            continue;
        }
        let Ok(content) = fs::read_to_string(entry.path()) else {
            continue;
        };
        let rel = entry
            .path()
            .strip_prefix(&root)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        let name = entry.file_name().to_string_lossy().to_string();
        let path_str = entry.path().to_string_lossy().to_string();

        for (idx, line) in content.lines().enumerate() {
            if line.to_lowercase().contains(&q) {
                let snippet: String = line.trim().chars().take(140).collect();
                matches.push(SearchMatch {
                    path: path_str.clone(),
                    relative_path: rel.clone(),
                    name: name.clone(),
                    line: idx + 1,
                    snippet,
                });
                if matches.len() >= 150 {
                    return Ok(matches);
                }
            }
        }
    }

    Ok(matches)
}

#[tauri::command]
fn take_initial_files(state: State<'_, OpenedFilesState>) -> Vec<String> {
    let mut guard = state.0.lock().unwrap();
    let items = guard.clone();
    guard.clear();
    items
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut initial_files = Vec::new();
    let mut seen = HashSet::new();
    for arg in std::env::args().skip(1) {
        if !arg.starts_with('-') {
            let p = PathBuf::from(&arg);
            if p.exists() && p.is_file() && seen.insert(arg.clone()) {
                initial_files.push(arg);
            }
        }
    }

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(OpenedFilesState(Mutex::new(initial_files)))
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            scan_workspace,
            search_workspace,
            take_initial_files
        ])
        .build(tauri::generate_context!())
        .expect("error while building Onigiri-Markdown");

    app.run(|app_handle, event| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = event {
            let paths: Vec<String> = urls
                .into_iter()
                .filter_map(|u| u.to_file_path().ok())
                .map(|p| p.to_string_lossy().to_string())
                .collect();
            if !paths.is_empty() {
                if let Some(state) = app_handle.try_state::<OpenedFilesState>() {
                    let mut guard = state.0.lock().unwrap();
                    guard.extend(paths.clone());
                }
                let _ = app_handle.emit("open-files", paths);
            }
        }
        #[cfg(not(target_os = "macos"))]
        let _ = (app_handle, event);
    });
}
