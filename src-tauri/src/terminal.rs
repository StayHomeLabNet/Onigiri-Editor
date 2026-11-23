use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::Mutex;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub struct TerminalState {
    running: Arc<Mutex<HashMap<String, tokio::sync::oneshot::Sender<()>>>>,
}

impl TerminalState {
    pub fn new() -> Self {
        Self {
            running: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalOutputEvent {
    pub run_id: String,
    pub stream: String,
    pub chunk: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalExitEvent {
    pub run_id: String,
    pub exit_code: i32,
    pub cwd: String,
    pub cancelled: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalRunResult {
    pub cwd: String,
    pub immediate_output: Option<String>,
    pub immediate_exit_code: Option<i32>,
}

fn resolve_cd_target(raw_target: &str, base_cwd: &Path) -> Result<PathBuf, String> {
    let trimmed = raw_target.trim().trim_matches('"').trim_matches('\'');
    let candidate = if trimmed.is_empty() || trimmed == "~" {
        std::env::var_os("HOME")
            .or_else(|| std::env::var_os("USERPROFILE"))
            .map(PathBuf::from)
            .ok_or_else(|| "Home directory not found".to_string())?
    } else if let Some(rest) = trimmed.strip_prefix("~/") {
        let home = std::env::var_os("HOME")
            .or_else(|| std::env::var_os("USERPROFILE"))
            .map(PathBuf::from)
            .ok_or_else(|| "Home directory not found".to_string())?;
        home.join(rest)
    } else {
        let p = PathBuf::from(trimmed);
        if p.is_absolute() {
            p
        } else {
            base_cwd.join(p)
        }
    };

    let canonical = candidate
        .canonicalize()
        .map_err(|e| format!("cd: {}: {}", trimmed, e))?;
    if !canonical.is_dir() {
        return Err(format!("cd: not a directory: {}", trimmed));
    }
    Ok(canonical)
}

#[tauri::command]
pub async fn terminal_run_command(
    app: AppHandle,
    state: State<'_, TerminalState>,
    run_id: String,
    command: String,
    cwd: Option<String>,
) -> Result<TerminalRunResult, String> {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return Err("Empty command".to_string());
    }

    let working_dir = cwd
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .map(PathBuf::from)
        .filter(|p| p.is_dir())
        .or_else(|| std::env::current_dir().ok())
        .unwrap_or_else(|| PathBuf::from("."));

    // Handle standalone `cd <dir>` directly so cwd persists across commands
    if trimmed == "cd" || trimmed.starts_with("cd ") {
        let target = trimmed.strip_prefix("cd").unwrap_or("").trim();
        let next_dir = resolve_cd_target(target, &working_dir)?;
        let next_str = next_dir.to_string_lossy().to_string();
        let next_clean = next_str.strip_prefix(r"\\?\").unwrap_or(&next_str).to_string();
        return Ok(TerminalRunResult {
            cwd: next_clean,
            immediate_output: None,
            immediate_exit_code: Some(0),
        });
    }

    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = Command::new("cmd");
        c.args(["/C", trimmed]);
        #[cfg(target_os = "windows")]
        c.creation_flags(CREATE_NO_WINDOW);
        c
    } else {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string());
        let mut c = Command::new(shell);
        c.args(["-lc", trimmed]);
        c
    };

    cmd.current_dir(&working_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn command: {}", e))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let (cancel_tx, mut cancel_rx) = tokio::sync::oneshot::channel::<()>();
    {
        let mut map = state.running.lock().await;
        map.insert(run_id.clone(), cancel_tx);
    }

    let cwd_str = working_dir.to_string_lossy().to_string();
    let cwd_clean = cwd_str.strip_prefix(r"\\?\").unwrap_or(&cwd_str).to_string();
    let running_map = Arc::clone(&state.running);
    let run_id_task = run_id.clone();
    let cwd_task = cwd_clean.clone();

    tokio::spawn(async move {
        let app_out = app.clone();
        let run_out = run_id_task.clone();
        let stdout_handle = tokio::spawn(async move {
            if let Some(out) = stdout {
                let mut reader = BufReader::new(out).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    let _ = app_out.emit(
                        "terminal-output",
                        TerminalOutputEvent {
                            run_id: run_out.clone(),
                            stream: "stdout".to_string(),
                            chunk: line,
                        },
                    );
                }
            }
        });

        let app_err = app.clone();
        let run_err = run_id_task.clone();
        let stderr_handle = tokio::spawn(async move {
            if let Some(err) = stderr {
                let mut reader = BufReader::new(err).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    let _ = app_err.emit(
                        "terminal-output",
                        TerminalOutputEvent {
                            run_id: run_err.clone(),
                            stream: "stderr".to_string(),
                            chunk: line,
                        },
                    );
                }
            }
        });

        let (exit_code, cancelled) = tokio::select! {
            status_res = child.wait() => {
                let code = status_res.ok().and_then(|s| s.code()).unwrap_or(-1);
                (code, false)
            }
            _ = &mut cancel_rx => {
                let _ = child.kill().await;
                let _ = child.wait().await;
                (130, true)
            }
        };

        let _ = stdout_handle.await;
        let _ = stderr_handle.await;

        {
            let mut map = running_map.lock().await;
            map.remove(&run_id_task);
        }

        let _ = app.emit(
            "terminal-exit",
            TerminalExitEvent {
                run_id: run_id_task,
                exit_code,
                cwd: cwd_task,
                cancelled,
            },
        );
    });

    Ok(TerminalRunResult {
        cwd: cwd_clean,
        immediate_output: None,
        immediate_exit_code: None,
    })
}

#[tauri::command]
pub async fn terminal_kill_command(
    state: State<'_, TerminalState>,
    run_id: String,
) -> Result<bool, String> {
    let mut map = state.running.lock().await;
    if let Some(tx) = map.remove(&run_id) {
        let _ = tx.send(());
        Ok(true)
    } else {
        Ok(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_relative_cd_target() {
        let tmp = std::env::temp_dir();
        let resolved = resolve_cd_target(".", &tmp).unwrap();
        assert!(resolved.is_dir());
    }
}
