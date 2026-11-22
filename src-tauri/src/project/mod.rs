use serde::Serialize;
use std::env;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDiagnostic {
    pub id: String,
    pub severity: String, // "error" | "warning" | "info"
    pub title_ja: String,
    pub title_en: String,
    pub description_ja: String,
    pub description_en: String,
    pub command_preview: Option<String>,
    pub in_app_action: Option<String>,
    pub action_target: Option<String>,
    pub in_app_label_ja: Option<String>,
    pub in_app_label_en: Option<String>,
    pub terminal_command: Option<String>,
    pub docs_url: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSetupProgress {
    pub root_path: String,
    pub action: String,
    pub running: bool,
    pub line: Option<String>,
    pub done: bool,
    pub ok: Option<bool>,
    pub message: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSetupResult {
    pub ok: bool,
    pub message: String,
    pub output: Vec<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProjectTarget {
    pub root_path: String,
    pub label: String,
    pub relative_path: String,
    pub kind: String,
    pub dev_script: Option<String>,
    pub scripts: Vec<String>,
    pub default_url: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub root_path: String,
    pub name: String,
    pub kind: String,
    pub package_manager: Option<String>,
    pub dev_script: Option<String>,
    pub scripts: Vec<String>,
    pub default_url: Option<String>,
    pub dev_command_label: Option<String>,
    pub has_dist: bool,
    pub dist_index_path: Option<String>,
    pub entry_html_path: Option<String>,
    pub already_running: bool,
    pub diagnostics: Vec<ProjectDiagnostic>,
    pub targets: Vec<ProjectTarget>,
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RunningProjectTarget {
    pub root_path: String,
    pub name: String,
    pub kind: String,
    pub url: Option<String>,
    pub command_label: Option<String>,
    pub starting: bool,
    pub logs: Vec<String>,
    pub error_count: usize,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProjectServerStatus {
    pub running: bool,
    pub starting: bool,
    pub external: bool,
    pub allow_lan: bool,
    pub lan_urls: Vec<String>,
    pub root_path: Option<String>,
    pub kind: Option<String>,
    pub url: Option<String>,
    pub command_label: Option<String>,
    pub requested_port: Option<u16>,
    pub requested_script: Option<String>,
    pub logs: Vec<String>,
    pub error: Option<String>,
    pub running_targets: Vec<RunningProjectTarget>,
}

pub struct ExtraManagedServer {
    pub server_id: u64,
    pub root_path: String,
    pub name: String,
    pub kind: String,
    pub url: Option<String>,
    pub command_label: Option<String>,
    pub starting: bool,
    pub requested_port: Option<u16>,
    pub requested_script: Option<String>,
    pub allow_lan: bool,
    pub lan_urls: Vec<String>,
    pub logs: Vec<String>,
    pub child: Option<Child>,
    pub pid: Option<u32>,
    pub aux_child: Option<Child>,
    pub aux_pid: Option<u32>,
    pub static_server_task: Option<tokio::task::JoinHandle<()>>,
}

pub struct ProjectServerInner {
    pub status: ProjectServerStatus,
    pub primary_name: Option<String>,
    pub primary_logs: Vec<String>,
    pub requested_port: Option<u16>,
    pub requested_script: Option<String>,
    pub child: Option<Child>,
    pub pid: Option<u32>,
    pub aux_child: Option<Child>,
    pub aux_pid: Option<u32>,
    pub static_server_task: Option<tokio::task::JoinHandle<()>>,
    pub generation: u64,
    pub extra_servers: Vec<ExtraManagedServer>,
}

pub struct ProjectServerState {
    pub inner: Arc<Mutex<ProjectServerInner>>,
    pub start_lock: Arc<Mutex<()>>,
}

impl ProjectServerState {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(ProjectServerInner {
                status: ProjectServerStatus::default(),
                primary_name: None,
                primary_logs: Vec::new(),
                requested_port: None,
                requested_script: None,
                child: None,
                pid: None,
                aux_child: None,
                aux_pid: None,
                static_server_task: None,
                generation: 0,
                extra_servers: Vec::new(),
            })),
            start_lock: Arc::new(Mutex::new(())),
        }
    }
}

#[allow(dead_code)]
pub(crate) fn parse_reg_query_path_output(output: &str) -> Option<String> {
    for raw_line in output.lines() {
        let trimmed = raw_line.trim();
        let upper = trimmed.to_ascii_uppercase();
        for kind in ["REG_EXPAND_SZ", "REG_SZ"] {
            if let Some(idx) = upper.find(kind) {
                let after = trimmed[idx + kind.len()..].trim();
                if !after.is_empty() {
                    return Some(after.to_string());
                }
            }
        }
    }
    None
}

#[allow(dead_code)]
pub(crate) fn expand_windows_env_vars_with<'a, F>(input: &str, mut lookup: F) -> String
where
    F: FnMut(&str) -> Option<String>,
{
    let mut out = String::with_capacity(input.len());
    let mut rest = input;
    while let Some(start) = rest.find('%') {
        out.push_str(&rest[..start]);
        let after_start = &rest[start + 1..];
        if let Some(end) = after_start.find('%') {
            let var_name = &after_start[..end];
            if !var_name.is_empty() {
                if let Some(val) = lookup(var_name) {
                    out.push_str(&val);
                    rest = &after_start[end + 1..];
                    continue;
                }
            }
            out.push('%');
            out.push_str(var_name);
            out.push('%');
            rest = &after_start[end + 1..];
        } else {
            out.push('%');
            rest = after_start;
        }
    }
    out.push_str(rest);
    out
}

pub fn find_available_port_from(preferred_port: u16) -> Option<u16> {
    let start = if preferred_port < 1024 {
        3000
    } else {
        preferred_port
    };
    for offset in 0..=80u16 {
        let Some(candidate) = start.checked_add(offset) else {
            break;
        };
        if candidate == 0 {
            continue;
        }
        if std::net::TcpListener::bind(("127.0.0.1", candidate)).is_ok() {
            return Some(candidate);
        }
    }
    std::net::TcpListener::bind(("127.0.0.1", 0))
        .ok()
        .and_then(|l| l.local_addr().ok())
        .map(|a| a.port())
}

#[tauri::command]
pub async fn find_free_project_port(preferred_port: u16) -> Result<u16, String> {
    find_available_port_from(preferred_port)
        .ok_or_else(|| format!("Could not find an available port near {}", preferred_port))
}

include!("env.rs");
include!("detect.rs");
include!("diagnostics.rs");
include!("server.rs");
include!("setup.rs");

#[cfg(test)]
include!("tests.rs");
