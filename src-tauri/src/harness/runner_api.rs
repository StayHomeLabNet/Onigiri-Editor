use super::snapshot::compute_unified_diff;
use super::store::HarnessStore;
use super::types::{HarnessEvent, HarnessThread, TimelineEntry};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::Emitter;
use tokio::io::AsyncReadExt;
use tokio::sync::{oneshot, watch};
use walkdir::WalkDir;

const MAX_TOOL_STEPS: usize = 16;

pub struct ApiTurnContext {
    pub app: Option<tauri::AppHandle>,
    pub store: Arc<HarnessStore>,
    pub threads_lock: Arc<Mutex<Vec<HarnessThread>>>,
    pub approvals_lock: Arc<Mutex<HashMap<String, oneshot::Sender<String>>>>,
    pub thread_id: String,
    pub turn_id: String,
    pub workspace_root: String,
    pub provider: String,
    pub model: String,
    pub permission_mode: String,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub user_prompt: String,
    pub prior_messages: Vec<(String, String)>,
    pub system_prompt_extra: Option<String>,
    pub dirty_paths: Vec<String>,
    pub images: Vec<crate::ai::AiImageAttachment>,
    pub cancel_rx: watch::Receiver<bool>,
}

#[allow(dead_code)]
pub struct ApiTurnOutcome {
    pub final_text: String,
    pub model_used: String,
}

struct ParsedToolCall {
    call_id: String,
    name: String,
    args: Value,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn truncate_chars(s: &str, max_chars: usize) -> String {
    let count = s.chars().count();
    if count <= max_chars {
        s.to_string()
    } else {
        let head: String = s.chars().take(max_chars).collect();
        format!("{}…", head)
    }
}

fn emit_entry(
    app: &Option<tauri::AppHandle>,
    store: &HarnessStore,
    thread_id: &str,
    entry: TimelineEntry,
) {
    let _ = store.upsert_entry(thread_id, entry.clone());
    if let Some(h) = app {
        let _ = h.emit(
            "harness-event",
            HarnessEvent::EntryUpserted {
                thread_id: thread_id.to_string(),
                entry,
            },
        );
    }
}

fn set_thread_status(ctx: &ApiTurnContext, status: &str) {
    let mut updated_thread: Option<HarnessThread> = None;
    if let Ok(mut guard) = ctx.threads_lock.lock() {
        if let Some(t) = guard.iter_mut().find(|t| t.id == ctx.thread_id) {
            t.status = status.to_string();
            t.updated_at = now_ms();
            updated_thread = Some(t.clone());
        }
        let _ = ctx.store.save_threads(&guard);
    }
    if let (Some(h), Some(thread)) = (&ctx.app, updated_thread) {
        let _ = h.emit("harness-event", HarnessEvent::ThreadUpdated { thread });
    }
}

pub fn resolve_safe_workspace_path(workspace_root: &str, raw_rel: &str) -> Result<(PathBuf, String), String> {
    let root = Path::new(workspace_root);
    if !root.exists() || !root.is_dir() {
        return Err(format!("Workspace root does not exist: {}", workspace_root));
    }

    let trimmed = raw_rel.trim();
    if trimmed.is_empty() || trimmed == "." {
        return Ok((root.to_path_buf(), ".".to_string()));
    }

    let raw_path = Path::new(trimmed);
    let rel_candidate = if raw_path.is_absolute() {
        raw_path
            .strip_prefix(root)
            .map_err(|_| format!("Path '{}' is outside the workspace root.", trimmed))?
    } else {
        raw_path
    };

    let mut clean_parts: Vec<String> = Vec::new();
    for comp in rel_candidate.components() {
        match comp {
            Component::Normal(os) => {
                clean_parts.push(os.to_string_lossy().to_string());
            }
            Component::CurDir => {}
            Component::ParentDir => {
                if clean_parts.pop().is_none() {
                    return Err(format!("Path '{}' escapes workspace root.", trimmed));
                }
            }
            _ => {
                return Err(format!("Invalid path component in '{}'.", trimmed));
            }
        }
    }

    let mut joined = root.to_path_buf();
    for p in &clean_parts {
        joined.push(p);
    }
    let rel_display = if clean_parts.is_empty() {
        ".".to_string()
    } else {
        clean_parts.join("/")
    };
    Ok((joined, rel_display))
}

pub fn write_workspace_file_preserving_encoding(
    target_path: &Path,
    new_content: &str,
) -> Result<String, String> {
    let (orig_encoding, orig_eol) = if target_path.exists() && target_path.is_file() {
        if let Ok(existing_bytes) = fs::read(target_path) {
            if let Ok(decoded) = crate::decode_bytes_with_encoding(&existing_bytes, None) {
                (decoded.encoding, decoded.eol)
            } else {
                ("utf-8".to_string(), "\n".to_string())
            }
        } else {
            ("utf-8".to_string(), "\n".to_string())
        }
    } else {
        ("utf-8".to_string(), "\n".to_string())
    };

    let normalized_lf = new_content.replace("\r\n", "\n");
    let final_text = if orig_eol == "\r\n" {
        normalized_lf.replace('\n', "\r\n")
    } else {
        normalized_lf
    };

    if let Some(parent) = target_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }
    }

    match crate::encode_text_with_encoding(&final_text, Some(&orig_encoding)) {
        Ok(bytes) => {
            fs::write(target_path, bytes)
                .map_err(|e| format!("Failed to write file: {}", e))?;
            Ok(orig_encoding)
        }
        Err(_) => {
            fs::write(target_path, final_text.as_bytes())
                .map_err(|e| format!("Failed to write UTF-8 fallback: {}", e))?;
            Ok("utf-8 (upgraded)".to_string())
        }
    }
}

fn normalize_compare_path(p: &str) -> String {
    let replaced = p.replace('\\', "/");
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        replaced.to_lowercase()
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        replaced
    }
}

fn build_tool_schemas_json(is_plan: bool) -> Vec<Value> {
    let mut tools = vec![
        json!({
            "name": "list_dir",
            "description": "List files and directories inside a workspace directory.",
            "parameters": {
                "type": "object",
                "properties": {
                    "relative_path": {
                        "type": "string",
                        "description": "Relative directory path from workspace root (use '.' for root)."
                    }
                }
            }
        }),
        json!({
            "name": "read_file",
            "description": "Read a text file in the workspace with line numbers.",
            "parameters": {
                "type": "object",
                "properties": {
                    "relative_path": {
                        "type": "string",
                        "description": "Relative path to the file."
                    },
                    "start_line": {
                        "type": "integer",
                        "description": "1-based start line (optional)."
                    },
                    "end_line": {
                        "type": "integer",
                        "description": "1-based end line inclusive (optional)."
                    }
                },
                "required": ["relative_path"]
            }
        }),
        json!({
            "name": "grep_search",
            "description": "Search for a text pattern across workspace files.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Substring or keyword to search for."
                    }
                },
                "required": ["query"]
            }
        }),
    ];

    if !is_plan {
        tools.push(json!({
            "name": "write_file",
            "description": "Create a new file or overwrite an existing file in the workspace (preserves original character encoding and line endings).",
            "parameters": {
                "type": "object",
                "properties": {
                    "relative_path": {
                        "type": "string",
                        "description": "Relative path to the file."
                    },
                    "content": {
                        "type": "string",
                        "description": "Full text content to write."
                    }
                },
                "required": ["relative_path", "content"]
            }
        }));
        tools.push(json!({
            "name": "edit_file",
            "description": "Replace an exact target block in an existing file with replacement text.",
            "parameters": {
                "type": "object",
                "properties": {
                    "relative_path": {
                        "type": "string",
                        "description": "Relative path to the file."
                    },
                    "target": {
                        "type": "string",
                        "description": "Exact existing snippet to replace."
                    },
                    "replacement": {
                        "type": "string",
                        "description": "Replacement text."
                    }
                },
                "required": ["relative_path", "target", "replacement"]
            }
        }));
        tools.push(json!({
            "name": "run_command",
            "description": "Execute a shell command in the workspace root and capture output.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "Command line to run."
                    }
                },
                "required": ["command"]
            }
        }));
    }

    tools
}

fn build_system_prompt(ctx: &ApiTurnContext) -> String {
    let mut parts = vec![format!(
        "You are an AI Harness coding & documentation agent running inside Onigiri Editor.\nWorkspace root: {}",
        ctx.workspace_root
    )];

    if ctx.permission_mode == "plan" {
        parts.push(
            "CURRENT MODE: PLAN (READ-ONLY).\n\
             Inspect files using read_file / list_dir / grep_search, then produce a clear summary and a numbered or bulleted step-by-step plan."
                .to_string(),
        );
    } else {
        parts.push(
            "Use the provided tools to inspect and edit files accurately. Prefer edit_file for targeted changes and explain your changes concisely."
                .to_string(),
        );
    }

    if let Some(extra) = ctx.system_prompt_extra.as_deref() {
        if !extra.trim().is_empty() {
            parts.push(extra.trim().to_string());
        }
    }

    parts.join("\n\n")
}

async fn send_http_cancellable(
    req: reqwest::RequestBuilder,
    mut cancel_rx: watch::Receiver<bool>,
) -> Result<reqwest::Response, String> {
    tokio::select! {
        _ = async {
            while !*cancel_rx.borrow() {
                if cancel_rx.changed().await.is_err() {
                    std::future::pending::<()>().await;
                }
            }
        } => Err("CLI_CANCELLED".to_string()),
        res = req.send() => res.map_err(|e| e.to_string()),
    }
}

async fn wait_for_user_approval(
    ctx: &mut ApiTurnContext,
    tool_name: &str,
    summary: &str,
    target_path: Option<String>,
    command: Option<String>,
    diff_preview: Option<String>,
    is_dirty_conflict: bool,
) -> Result<String, String> {
    let approval_id = format!("appr-{}-{}", ctx.turn_id, now_ms());
    let entry_id = format!("entry-{}", approval_id);
    let (tx, rx) = oneshot::channel::<String>();

    {
        let mut guard = ctx
            .approvals_lock
            .lock()
            .map_err(|_| "Approval state lock poisoned".to_string())?;
        guard.insert(approval_id.clone(), tx);
    }

    emit_entry(
        &ctx.app,
        &ctx.store,
        &ctx.thread_id,
        TimelineEntry::ApprovalRequest {
            id: entry_id.clone(),
            turn_id: ctx.turn_id.clone(),
            approval_id: approval_id.clone(),
            tool_name: tool_name.to_string(),
            summary: summary.to_string(),
            target_path: target_path.clone(),
            command: command.clone(),
            diff_preview: diff_preview.clone(),
            decision: None,
            is_dirty_conflict,
            timestamp: now_ms(),
        },
    );
    set_thread_status(ctx, "waiting_approval");

    let decision_res = tokio::select! {
        _ = async {
            while !*ctx.cancel_rx.borrow() {
                if ctx.cancel_rx.changed().await.is_err() {
                    std::future::pending::<()>().await;
                }
            }
        } => {
            if let Ok(mut guard) = ctx.approvals_lock.lock() {
                guard.remove(&approval_id);
            }
            Err("CLI_CANCELLED".to_string())
        }
        res = rx => {
            res.map_err(|_| "Approval request cancelled".to_string())
        }
    };

    set_thread_status(ctx, "running");
    let decision = decision_res?;

    emit_entry(
        &ctx.app,
        &ctx.store,
        &ctx.thread_id,
        TimelineEntry::ApprovalRequest {
            id: entry_id,
            turn_id: ctx.turn_id.clone(),
            approval_id,
            tool_name: tool_name.to_string(),
            summary: summary.to_string(),
            target_path,
            command,
            diff_preview,
            decision: Some(decision.clone()),
            is_dirty_conflict,
            timestamp: now_ms(),
        },
    );

    Ok(decision)
}

async fn execute_single_tool(
    ctx: &mut ApiTurnContext,
    call: &ParsedToolCall,
    dirty_norm: &HashSet<String>,
    session_auto_approved: &mut bool,
) -> Result<String, String> {
    let tool_entry_id = format!("tool-{}-{}", ctx.turn_id, call.call_id);
    let rel_arg = call
        .args
        .get("relative_path")
        .and_then(|v| v.as_str())
        .unwrap_or(".");

    let summary = match call.name.as_str() {
        "list_dir" => format!("List directory: {}", rel_arg),
        "read_file" => format!("Read file: {}", rel_arg),
        "grep_search" => {
            let q = call.args.get("query").and_then(|v| v.as_str()).unwrap_or("");
            format!("Search workspace: {}", truncate_chars(q, 80))
        }
        "write_file" => format!("Write file: {}", rel_arg),
        "edit_file" => format!("Edit file: {}", rel_arg),
        "run_command" => {
            let cmd = call.args.get("command").and_then(|v| v.as_str()).unwrap_or("");
            format!("Run command: {}", truncate_chars(cmd, 100))
        }
        other => other.to_string(),
    };

    emit_entry(
        &ctx.app,
        &ctx.store,
        &ctx.thread_id,
        TimelineEntry::ToolCall {
            id: tool_entry_id.clone(),
            turn_id: ctx.turn_id.clone(),
            tool_name: call.name.clone(),
            summary: summary.clone(),
            args_preview: truncate_chars(&call.args.to_string(), 500),
            status: "running".to_string(),
            output_preview: None,
            target_path: None,
            timestamp: now_ms(),
        },
    );

    let result: Result<(String, Option<String>, bool), String> = match call.name.as_str() {
        "list_dir" => match resolve_safe_workspace_path(&ctx.workspace_root, rel_arg) {
            Ok((dir_path, _)) => {
                if !dir_path.is_dir() {
                    Ok((format!("Error: '{}' is not a directory.", rel_arg), None, true))
                } else {
                    let mut items = Vec::new();
                    if let Ok(rd) = fs::read_dir(&dir_path) {
                        for entry in rd.flatten().take(200) {
                            let name = entry.file_name().to_string_lossy().to_string();
                            if name == ".DS_Store" {
                                continue;
                            }
                            let suffix = if entry.path().is_dir() { "/" } else { "" };
                            items.push(format!("{}{}", name, suffix));
                        }
                    }
                    items.sort();
                    let out = if items.is_empty() {
                        "(empty directory)".to_string()
                    } else {
                        items.join("\n")
                    };
                    Ok((out, None, false))
                }
            }
            Err(e) => Ok((format!("Error: {}", e), None, true)),
        },

        "read_file" => match resolve_safe_workspace_path(&ctx.workspace_root, rel_arg) {
            Ok((file_path, _)) => {
                let full_str = file_path.to_string_lossy().to_string();
                match fs::read(&file_path) {
                    Ok(bytes) => {
                        let text = crate::decode_bytes_with_encoding(&bytes, None)
                            .map(|d| d.content)
                            .unwrap_or_else(|_| String::from_utf8_lossy(&bytes).to_string());
                        let lines: Vec<&str> = text.lines().collect();
                        let total = lines.len();
                        let start = call
                            .args
                            .get("start_line")
                            .and_then(|v| v.as_u64())
                            .map(|n| (n as usize).saturating_sub(1))
                            .unwrap_or(0)
                            .min(total);
                        let end = call
                            .args
                            .get("end_line")
                            .and_then(|v| v.as_u64())
                            .map(|n| (n as usize).min(total))
                            .unwrap_or_else(|| (start + 350).min(total));
                        let mut numbered = format!("File: {} ({} lines total)\n", rel_arg, total);
                        for (idx, line) in lines[start..end].iter().enumerate() {
                            numbered.push_str(&format!("{:>4}: {}\n", start + idx + 1, line));
                        }
                        if end < total {
                            numbered.push_str(&format!("... ({} more lines)\n", total - end));
                        }
                        Ok((numbered, Some(full_str), false))
                    }
                    Err(e) => Ok((format!("Error reading '{}': {}", rel_arg, e), None, true)),
                }
            }
            Err(e) => Ok((format!("Error: {}", e), None, true)),
        },

        "grep_search" => {
            let query = call
                .args
                .get("query")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim();
            if query.is_empty() {
                Ok(("Error: query cannot be empty.".to_string(), None, true))
            } else {
                let q_lower = query.to_lowercase();
                let root_path = Path::new(&ctx.workspace_root);
                let mut matches = Vec::new();
                for entry in WalkDir::new(root_path)
                    .follow_links(false)
                    .into_iter()
                    .filter_entry(|e| {
                        let name = e.file_name().to_string_lossy();
                        !(e.depth() > 0
                            && e.file_type().is_dir()
                            && matches!(
                                name.as_ref(),
                                ".git" | "node_modules" | "target" | "dist" | "build" | ".venv"
                            ))
                    })
                    .flatten()
                {
                    if matches.len() >= 60 {
                        break;
                    }
                    if !entry.file_type().is_file() {
                        continue;
                    }
                    if entry.metadata().map(|m| m.len() > 1_048_576).unwrap_or(true) {
                        continue;
                    }
                    let Ok(bytes) = fs::read(entry.path()) else {
                        continue;
                    };
                    if bytes[..bytes.len().min(1024)].contains(&0) {
                        continue;
                    }
                    let text = String::from_utf8_lossy(&bytes);
                    let rel = entry
                        .path()
                        .strip_prefix(root_path)
                        .map(|p| p.to_string_lossy().replace('\\', "/"))
                        .unwrap_or_default();
                    for (idx, line) in text.lines().enumerate() {
                        if line.to_lowercase().contains(&q_lower) {
                            matches.push(format!("{}:{}: {}", rel, idx + 1, truncate_chars(line.trim(), 160)));
                            if matches.len() >= 60 {
                                break;
                            }
                        }
                    }
                }
                if matches.is_empty() {
                    Ok((format!("No matches found for '{}'.", query), None, false))
                } else {
                    Ok((matches.join("\n"), None, false))
                }
            }
        }

        "write_file" => {
            if ctx.permission_mode == "plan" {
                Ok(("Error: write_file is disabled in Plan mode.".to_string(), None, true))
            } else {
                match resolve_safe_workspace_path(&ctx.workspace_root, rel_arg) {
                    Ok((file_path, rel_clean)) => {
                        let new_content = call
                            .args
                            .get("content")
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                        let full_str = file_path.to_string_lossy().to_string();
                        let is_dirty = dirty_norm.contains(&normalize_compare_path(&full_str));
                        let old_text = fs::read(&file_path)
                            .ok()
                            .and_then(|b| crate::decode_bytes_with_encoding(&b, None).ok().map(|d| d.content))
                            .unwrap_or_default();
                        let (diff_prev, adds, dels) = compute_unified_diff(&old_text, new_content, &rel_clean);

                        let needs_approval = is_dirty
                            || (ctx.permission_mode == "approve-edits" && !*session_auto_approved);
                        let mut allowed = true;
                        if needs_approval {
                            let dec = wait_for_user_approval(
                                ctx,
                                "write_file",
                                &format!("Write {} (+{} / -{})", rel_clean, adds, dels),
                                Some(full_str.clone()),
                                None,
                                Some(truncate_chars(&diff_prev, 8000)),
                                is_dirty,
                            )
                            .await?;
                            if dec == "allow_session" {
                                *session_auto_approved = true;
                            } else if dec == "deny" {
                                allowed = false;
                            }
                        }

                        if !allowed {
                            emit_entry(
                                &ctx.app,
                                &ctx.store,
                                &ctx.thread_id,
                                TimelineEntry::ToolCall {
                                    id: tool_entry_id,
                                    turn_id: ctx.turn_id.clone(),
                                    tool_name: call.name.clone(),
                                    summary,
                                    args_preview: truncate_chars(&call.args.to_string(), 500),
                                    status: "rejected".to_string(),
                                    output_preview: Some("User rejected file write.".to_string()),
                                    target_path: Some(full_str),
                                    timestamp: now_ms(),
                                },
                            );
                            return Ok("User denied permission to write this file.".to_string());
                        }

                        match write_workspace_file_preserving_encoding(&file_path, new_content) {
                            Ok(enc) => Ok((
                                format!("Wrote '{}' ({}, +{} / -{} lines).", rel_clean, enc, adds, dels),
                                Some(full_str),
                                false,
                            )),
                            Err(e) => Ok((format!("Error writing '{}': {}", rel_clean, e), None, true)),
                        }
                    }
                    Err(e) => Ok((format!("Error: {}", e), None, true)),
                }
            }
        }

        "edit_file" => {
            if ctx.permission_mode == "plan" {
                Ok(("Error: edit_file is disabled in Plan mode.".to_string(), None, true))
            } else {
                match resolve_safe_workspace_path(&ctx.workspace_root, rel_arg) {
                    Ok((file_path, rel_clean)) => {
                        let target_snippet = call.args.get("target").and_then(|v| v.as_str()).unwrap_or("");
                        let replacement = call.args.get("replacement").and_then(|v| v.as_str()).unwrap_or("");
                        let full_str = file_path.to_string_lossy().to_string();
                        match fs::read(&file_path) {
                            Ok(bytes) => {
                                let decoded = crate::decode_bytes_with_encoding(&bytes, None)
                                    .map(|d| d.content)
                                    .unwrap_or_else(|_| String::from_utf8_lossy(&bytes).to_string());
                                let norm_src = decoded.replace("\r\n", "\n");
                                let norm_target = target_snippet.replace("\r\n", "\n");
                                let norm_repl = replacement.replace("\r\n", "\n");

                                if norm_target.is_empty() || !norm_src.contains(&norm_target) {
                                    Ok((
                                        format!("Error: target snippet not found in '{}'. Read the file first to verify exact lines.", rel_clean),
                                        Some(full_str),
                                        true,
                                    ))
                                } else {
                                    let updated = norm_src.replacen(&norm_target, &norm_repl, 1);
                                    let (diff_prev, adds, dels) =
                                        compute_unified_diff(&norm_src, &updated, &rel_clean);
                                    let is_dirty = dirty_norm.contains(&normalize_compare_path(&full_str));
                                    let needs_approval = is_dirty
                                        || (ctx.permission_mode == "approve-edits" && !*session_auto_approved);
                                    let mut allowed = true;
                                    if needs_approval {
                                        let dec = wait_for_user_approval(
                                            ctx,
                                            "edit_file",
                                            &format!("Edit {} (+{} / -{})", rel_clean, adds, dels),
                                            Some(full_str.clone()),
                                            None,
                                            Some(truncate_chars(&diff_prev, 8000)),
                                            is_dirty,
                                        )
                                        .await?;
                                        if dec == "allow_session" {
                                            *session_auto_approved = true;
                                        } else if dec == "deny" {
                                            allowed = false;
                                        }
                                    }

                                    if !allowed {
                                        emit_entry(
                                            &ctx.app,
                                            &ctx.store,
                                            &ctx.thread_id,
                                            TimelineEntry::ToolCall {
                                                id: tool_entry_id,
                                                turn_id: ctx.turn_id.clone(),
                                                tool_name: call.name.clone(),
                                                summary,
                                                args_preview: truncate_chars(&call.args.to_string(), 500),
                                                status: "rejected".to_string(),
                                                output_preview: Some("User rejected file edit.".to_string()),
                                                target_path: Some(full_str),
                                                timestamp: now_ms(),
                                            },
                                        );
                                        return Ok("User denied permission to edit this file.".to_string());
                                    }

                                    match write_workspace_file_preserving_encoding(&file_path, &updated) {
                                        Ok(enc) => Ok((
                                            format!("Edited '{}' ({}, +{} / -{} lines).", rel_clean, enc, adds, dels),
                                            Some(full_str),
                                            false,
                                        )),
                                        Err(e) => Ok((format!("Error saving '{}': {}", rel_clean, e), None, true)),
                                    }
                                }
                            }
                            Err(e) => Ok((format!("Error reading '{}': {}", rel_clean, e), None, true)),
                        }
                    }
                    Err(e) => Ok((format!("Error: {}", e), None, true)),
                }
            }
        }

        "run_command" => {
            let command_str = call
                .args
                .get("command")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim()
                .to_string();
            if command_str.is_empty() {
                Ok(("Error: command is empty.".to_string(), None, true))
            } else if ctx.permission_mode == "plan" {
                Ok(("Error: run_command is disabled in Plan mode.".to_string(), None, true))
            } else {
                let mut allowed = ctx.permission_mode == "full-access";
                if !allowed {
                    let dec = wait_for_user_approval(
                        ctx,
                        "run_command",
                        &format!("Run command: {}", truncate_chars(&command_str, 120)),
                        None,
                        Some(command_str.clone()),
                        None,
                        false,
                    )
                    .await?;
                    allowed = dec == "allow" || dec == "allow_session";
                }
                if !allowed {
                    emit_entry(
                        &ctx.app,
                        &ctx.store,
                        &ctx.thread_id,
                        TimelineEntry::ToolCall {
                            id: tool_entry_id,
                            turn_id: ctx.turn_id.clone(),
                            tool_name: call.name.clone(),
                            summary,
                            args_preview: command_str,
                            status: "rejected".to_string(),
                            output_preview: Some("User rejected shell command.".to_string()),
                            target_path: None,
                            timestamp: now_ms(),
                        },
                    );
                    return Ok("User denied permission to execute this command.".to_string());
                }

                #[cfg(target_os = "windows")]
                let mut cmd = {
                    let mut c = tokio::process::Command::new("cmd");
                    c.args(["/C", &command_str]);
                    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
                    c.creation_flags(CREATE_NO_WINDOW);
                    c
                };
                #[cfg(not(target_os = "windows"))]
                let mut cmd = {
                    let mut c = tokio::process::Command::new("sh");
                    c.args(["-c", &command_str]);
                    c
                };

                cmd.env("PATH", crate::ai::extended_path())
                    .current_dir(&ctx.workspace_root)
                    .kill_on_drop(true)
                    .stdout(std::process::Stdio::piped())
                    .stderr(std::process::Stdio::piped());

                match cmd.spawn() {
                    Ok(mut child) => {
                        let mut stdout_pipe = child.stdout.take();
                        let mut stderr_pipe = child.stderr.take();
                        let mut cancel_clone = ctx.cancel_rx.clone();

                        let wait_res = tokio::select! {
                            _ = async {
                                while !*cancel_clone.borrow() {
                                    if cancel_clone.changed().await.is_err() {
                                        std::future::pending::<()>().await;
                                    }
                                }
                            } => {
                                let _ = child.kill().await;
                                return Err("CLI_CANCELLED".to_string());
                            }
                            _ = tokio::time::sleep(Duration::from_secs(60)) => {
                                let _ = child.kill().await;
                                Err("Command timed out after 60s.".to_string())
                            }
                            st = child.wait() => {
                                st.map_err(|e| e.to_string())
                            }
                        };

                        let mut out_buf = Vec::new();
                        let mut err_buf = Vec::new();
                        if let Some(mut s) = stdout_pipe.take() {
                            let _ = s.read_to_end(&mut out_buf).await;
                        }
                        if let Some(mut s) = stderr_pipe.take() {
                            let _ = s.read_to_end(&mut err_buf).await;
                        }
                        let stdout_str = String::from_utf8_lossy(&out_buf);
                        let stderr_str = String::from_utf8_lossy(&err_buf);
                        match wait_res {
                            Ok(st) => {
                                let code = st.code().unwrap_or(-1);
                                let combined = format!(
                                    "Exit code: {}\n{}{}",
                                    code,
                                    truncate_chars(stdout_str.trim(), 6000),
                                    if stderr_str.trim().is_empty() {
                                        String::new()
                                    } else {
                                        format!("\nSTDERR:\n{}", truncate_chars(stderr_str.trim(), 4000))
                                    }
                                );
                                Ok((combined, None, code != 0))
                            }
                            Err(timeout_msg) => Ok((timeout_msg, None, true)),
                        }
                    }
                    Err(e) => Ok((format!("Failed to start command: {}", e), None, true)),
                }
            }
        }

        other => Ok((format!("Unknown tool '{}'.", other), None, true)),
    };

    let (output, target_path, is_err) = result?;
    emit_entry(
        &ctx.app,
        &ctx.store,
        &ctx.thread_id,
        TimelineEntry::ToolCall {
            id: tool_entry_id,
            turn_id: ctx.turn_id.clone(),
            tool_name: call.name.clone(),
            summary,
            args_preview: truncate_chars(&call.args.to_string(), 500),
            status: if is_err { "failed" } else { "done" }.to_string(),
            output_preview: Some(truncate_chars(&output, 1200)),
            target_path,
            timestamp: now_ms(),
        },
    );

    Ok(output)
}

pub async fn execute_api_turn(mut ctx: ApiTurnContext) -> Result<ApiTurnOutcome, String> {
    let is_plan = ctx.permission_mode == "plan";
    let sys_prompt = build_system_prompt(&ctx);
    let schemas = build_tool_schemas_json(is_plan);
    let dirty_norm: HashSet<String> = ctx
        .dirty_paths
        .iter()
        .map(|p| normalize_compare_path(p))
        .collect();
    let mut session_auto_approved = false;

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(150))
        .build()
        .map_err(|e| e.to_string())?;

    let assistant_entry_id = format!("asst-{}", ctx.turn_id);
    let thinking_entry_id = format!("think-{}", ctx.turn_id);

    match ctx.provider.as_str() {
        "apple-foundation-models" => {
            let app_handle = ctx
                .app
                .clone()
                .ok_or_else(|| "AppHandle unavailable for Apple Foundation Models.".to_string())?;
            let mut msgs: Vec<crate::ai::ChatMessageInput> = ctx
                .prior_messages
                .iter()
                .map(|(role, content)| crate::ai::ChatMessageInput {
                    role: role.clone(),
                    content: content.clone(),
                })
                .collect();
            msgs.push(crate::ai::ChatMessageInput {
                role: "user".to_string(),
                content: ctx.user_prompt.clone(),
            });
            let model_opt = Some(ctx.model.trim()).filter(|s| !s.is_empty());
            let res = crate::apple_fm::generate(
                app_handle,
                ctx.turn_id.clone(),
                ctx.cancel_rx.clone(),
                model_opt,
                Some(&sys_prompt),
                &msgs,
            )
            .await?;
            emit_entry(
                &ctx.app,
                &ctx.store,
                &ctx.thread_id,
                TimelineEntry::AssistantMessage {
                    id: assistant_entry_id,
                    turn_id: ctx.turn_id.clone(),
                    content: res.content.clone(),
                    model: Some(res.model_used.clone()),
                    streaming: false,
                    timestamp: now_ms(),
                },
            );
            Ok(ApiTurnOutcome {
                final_text: res.content,
                model_used: res.model_used,
            })
        }

        "openai-api" | "lmstudio" | "openai-compat" => {
            let default_base = match ctx.provider.as_str() {
                "lmstudio" => "http://127.0.0.1:1234/v1",
                "openai-compat" => "http://127.0.0.1:8080/v1",
                _ => "https://api.openai.com/v1",
            };
            let base = ctx
                .base_url
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .unwrap_or(default_base)
                .trim_end_matches('/');
            let endpoint = if base.ends_with("/chat/completions") {
                base.to_string()
            } else if base.ends_with("/v1") {
                format!("{}/chat/completions", base)
            } else {
                format!("{}/v1/chat/completions", base)
            };

            if ctx.provider == "openai-api"
                && ctx.api_key.as_deref().map(|s| s.trim().is_empty()).unwrap_or(true)
            {
                return Err("OpenAI API key is required.".to_string());
            }

            let model = if ctx.model.trim().is_empty() {
                if ctx.provider == "openai-api" {
                    "gpt-4.1".to_string()
                } else {
                    "local-model".to_string()
                }
            } else {
                ctx.model.trim().to_string()
            };

            let openai_tools: Vec<Value> = schemas
                .iter()
                .map(|s| {
                    json!({
                        "type": "function",
                        "function": s
                    })
                })
                .collect();

            let mut messages: Vec<Value> = vec![json!({ "role": "system", "content": sys_prompt })];
            for (role, content) in &ctx.prior_messages {
                messages.push(json!({ "role": role, "content": content }));
            }
            if ctx.images.is_empty() {
                messages.push(json!({ "role": "user", "content": ctx.user_prompt }));
            } else {
                let mut parts = vec![json!({ "type": "text", "text": ctx.user_prompt })];
                for img in &ctx.images {
                    parts.push(json!({
                        "type": "image_url",
                        "image_url": { "url": format!("data:{};base64,{}", img.mime_type, img.base64) }
                    }));
                }
                messages.push(json!({ "role": "user", "content": parts }));
            }

            let mut tools_supported = true;
            let mut final_text = String::new();

            for step in 0..MAX_TOOL_STEPS {
                let mut body_json = json!({
                    "model": model,
                    "messages": messages,
                });
                if tools_supported {
                    body_json["tools"] = json!(openai_tools);
                }

                let mut req = client.post(&endpoint).json(&body_json);
                if let Some(k) = ctx.api_key.as_deref().filter(|s| !s.trim().is_empty()) {
                    req = req.bearer_auth(k.trim());
                }

                let resp = send_http_cancellable(req, ctx.cancel_rx.clone()).await?;
                let status = resp.status();
                let resp_body: Value = resp.json().await.map_err(|e| e.to_string())?;

                if !status.is_success() {
                    if step == 0 && tools_supported && status.as_u16() == 400 {
                        tools_supported = false;
                        continue;
                    }
                    return Err(format!("API error ({}): {}", status, resp_body));
                }

                let msg = &resp_body["choices"][0]["message"];
                if let Some(reasoning) = msg["reasoning_content"]
                    .as_str()
                    .or_else(|| msg["reasoning"].as_str())
                {
                    if !reasoning.trim().is_empty() {
                        emit_entry(
                            &ctx.app,
                            &ctx.store,
                            &ctx.thread_id,
                            TimelineEntry::Thinking {
                                id: thinking_entry_id.clone(),
                                turn_id: ctx.turn_id.clone(),
                                content: reasoning.trim().to_string(),
                                streaming: false,
                                timestamp: now_ms(),
                            },
                        );
                    }
                }

                let text_part = msg["content"].as_str().unwrap_or("").to_string();
                if !text_part.trim().is_empty() {
                    final_text = text_part.clone();
                    emit_entry(
                        &ctx.app,
                        &ctx.store,
                        &ctx.thread_id,
                        TimelineEntry::AssistantMessage {
                            id: assistant_entry_id.clone(),
                            turn_id: ctx.turn_id.clone(),
                            content: final_text.clone(),
                            model: Some(model.clone()),
                            streaming: true,
                            timestamp: now_ms(),
                        },
                    );
                }

                let tool_calls_opt = msg["tool_calls"].as_array().filter(|a| !a.is_empty());
                let Some(tool_calls) = tool_calls_opt else {
                    break;
                };

                messages.push(msg.clone());
                for (idx, tc) in tool_calls.iter().enumerate() {
                    let call_id = tc["id"]
                        .as_str()
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| format!("call_{}_{}", step, idx));
                    let fn_name = tc["function"]["name"].as_str().unwrap_or("").to_string();
                    let raw_args = tc["function"]["arguments"].as_str().unwrap_or("{}");
                    let parsed_args = serde_json::from_str::<Value>(raw_args).unwrap_or_else(|_| json!({}));
                    let call = ParsedToolCall {
                        call_id: call_id.clone(),
                        name: fn_name,
                        args: parsed_args,
                    };
                    let tool_out =
                        execute_single_tool(&mut ctx, &call, &dirty_norm, &mut session_auto_approved)
                            .await?;
                    messages.push(json!({
                        "role": "tool",
                        "tool_call_id": call_id,
                        "content": tool_out
                    }));
                }
            }

            emit_entry(
                &ctx.app,
                &ctx.store,
                &ctx.thread_id,
                TimelineEntry::AssistantMessage {
                    id: assistant_entry_id,
                    turn_id: ctx.turn_id.clone(),
                    content: final_text.clone(),
                    model: Some(model.clone()),
                    streaming: false,
                    timestamp: now_ms(),
                },
            );

            Ok(ApiTurnOutcome {
                final_text,
                model_used: model,
            })
        }

        "ollama" => {
            let base = ctx
                .base_url
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .unwrap_or("http://127.0.0.1:11434")
                .trim_end_matches('/');
            let endpoint = format!("{}/api/chat", base);
            let model = if ctx.model.trim().is_empty() {
                "llama3.2".to_string()
            } else {
                ctx.model.trim().to_string()
            };

            let ollama_tools: Vec<Value> = schemas
                .iter()
                .map(|s| json!({ "type": "function", "function": s }))
                .collect();

            let mut messages: Vec<Value> = vec![json!({ "role": "system", "content": sys_prompt })];
            for (role, content) in &ctx.prior_messages {
                messages.push(json!({ "role": role, "content": content }));
            }
            if ctx.images.is_empty() {
                messages.push(json!({ "role": "user", "content": ctx.user_prompt }));
            } else {
                let imgs: Vec<&str> = ctx.images.iter().map(|i| i.base64.as_str()).collect();
                messages.push(json!({
                    "role": "user",
                    "content": ctx.user_prompt,
                    "images": imgs
                }));
            }

            let mut tools_supported = true;
            let mut final_text = String::new();

            for step in 0..MAX_TOOL_STEPS {
                let mut payload = json!({
                    "model": model,
                    "messages": messages,
                    "stream": false
                });
                if tools_supported {
                    payload["tools"] = json!(ollama_tools);
                }

                let req = client.post(&endpoint).json(&payload);
                let resp = send_http_cancellable(req, ctx.cancel_rx.clone()).await?;
                let status = resp.status();
                let resp_body: Value = resp.json().await.map_err(|e| e.to_string())?;

                if !status.is_success() {
                    if step == 0 && tools_supported {
                        tools_supported = false;
                        continue;
                    }
                    return Err(format!("Ollama error ({}): {}", status, resp_body));
                }

                let msg = &resp_body["message"];
                if let Some(thinking) = msg["thinking"].as_str() {
                    if !thinking.trim().is_empty() {
                        emit_entry(
                            &ctx.app,
                            &ctx.store,
                            &ctx.thread_id,
                            TimelineEntry::Thinking {
                                id: thinking_entry_id.clone(),
                                turn_id: ctx.turn_id.clone(),
                                content: thinking.trim().to_string(),
                                streaming: false,
                                timestamp: now_ms(),
                            },
                        );
                    }
                }

                let content_str = msg["content"].as_str().unwrap_or("").to_string();
                if !content_str.trim().is_empty() {
                    final_text = content_str.clone();
                    emit_entry(
                        &ctx.app,
                        &ctx.store,
                        &ctx.thread_id,
                        TimelineEntry::AssistantMessage {
                            id: assistant_entry_id.clone(),
                            turn_id: ctx.turn_id.clone(),
                            content: final_text.clone(),
                            model: Some(model.clone()),
                            streaming: true,
                            timestamp: now_ms(),
                        },
                    );
                }

                let Some(tool_calls) = msg["tool_calls"].as_array().filter(|a| !a.is_empty()) else {
                    break;
                };

                messages.push(msg.clone());
                for (idx, tc) in tool_calls.iter().enumerate() {
                    let fn_name = tc["function"]["name"].as_str().unwrap_or("").to_string();
                    let args_val = if tc["function"]["arguments"].is_string() {
                        serde_json::from_str(tc["function"]["arguments"].as_str().unwrap_or("{}"))
                            .unwrap_or_else(|_| json!({}))
                    } else {
                        tc["function"]["arguments"].clone()
                    };
                    let call = ParsedToolCall {
                        call_id: format!("ollama_{}_{}", step, idx),
                        name: fn_name.clone(),
                        args: args_val,
                    };
                    let tool_out =
                        execute_single_tool(&mut ctx, &call, &dirty_norm, &mut session_auto_approved)
                            .await?;
                    messages.push(json!({
                        "role": "tool",
                        "name": fn_name,
                        "content": tool_out
                    }));
                }
            }

            emit_entry(
                &ctx.app,
                &ctx.store,
                &ctx.thread_id,
                TimelineEntry::AssistantMessage {
                    id: assistant_entry_id,
                    turn_id: ctx.turn_id.clone(),
                    content: final_text.clone(),
                    model: Some(model.clone()),
                    streaming: false,
                    timestamp: now_ms(),
                },
            );

            Ok(ApiTurnOutcome {
                final_text,
                model_used: model,
            })
        }

        "anthropic-api" => {
            let api_key = ctx
                .api_key
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .ok_or_else(|| "Anthropic API key is required.".to_string())?
                .to_string();
            let model = if ctx.model.trim().is_empty() {
                "claude-sonnet-4-5".to_string()
            } else {
                ctx.model.trim().to_string()
            };
            let base = ctx
                .base_url
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .unwrap_or("https://api.anthropic.com")
                .trim_end_matches('/');
            let endpoint = format!("{}/v1/messages", base);

            let anthropic_tools: Vec<Value> = schemas
                .iter()
                .map(|s| {
                    json!({
                        "name": s["name"],
                        "description": s["description"],
                        "input_schema": s["parameters"]
                    })
                })
                .collect();

            let mut messages: Vec<Value> = ctx
                .prior_messages
                .iter()
                .map(|(role, content)| {
                    json!({
                        "role": if role == "assistant" { "assistant" } else { "user" },
                        "content": content
                    })
                })
                .collect();

            if ctx.images.is_empty() {
                messages.push(json!({ "role": "user", "content": ctx.user_prompt }));
            } else {
                let mut parts: Vec<Value> = ctx
                    .images
                    .iter()
                    .map(|img| {
                        json!({
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": img.mime_type,
                                "data": img.base64
                            }
                        })
                    })
                    .collect();
                parts.push(json!({ "type": "text", "text": ctx.user_prompt }));
                messages.push(json!({ "role": "user", "content": parts }));
            }

            let mut final_text = String::new();

            for _step in 0..MAX_TOOL_STEPS {
                let payload = json!({
                    "model": model,
                    "max_tokens": 8192,
                    "system": sys_prompt,
                    "tools": anthropic_tools,
                    "messages": messages
                });
                let req = client
                    .post(&endpoint)
                    .header("x-api-key", &api_key)
                    .header("anthropic-version", "2023-06-01")
                    .json(&payload);
                let resp = send_http_cancellable(req, ctx.cancel_rx.clone()).await?;
                let status = resp.status();
                let resp_body: Value = resp.json().await.map_err(|e| e.to_string())?;
                if !status.is_success() {
                    return Err(format!("Anthropic API error ({}): {}", status, resp_body));
                }

                let blocks = resp_body["content"].as_array().cloned().unwrap_or_default();
                let mut text_chunks = Vec::new();
                let mut tool_calls = Vec::new();

                for block in &blocks {
                    match block["type"].as_str() {
                        Some("thinking") => {
                            if let Some(t) = block["thinking"].as_str() {
                                emit_entry(
                                    &ctx.app,
                                    &ctx.store,
                                    &ctx.thread_id,
                                    TimelineEntry::Thinking {
                                        id: thinking_entry_id.clone(),
                                        turn_id: ctx.turn_id.clone(),
                                        content: t.trim().to_string(),
                                        streaming: false,
                                        timestamp: now_ms(),
                                    },
                                );
                            }
                        }
                        Some("text") => {
                            if let Some(t) = block["text"].as_str() {
                                if !t.trim().is_empty() {
                                    text_chunks.push(t.to_string());
                                }
                            }
                        }
                        Some("tool_use") => {
                            tool_calls.push(ParsedToolCall {
                                call_id: block["id"].as_str().unwrap_or("tool_1").to_string(),
                                name: block["name"].as_str().unwrap_or("").to_string(),
                                args: block["input"].clone(),
                            });
                        }
                        _ => {}
                    }
                }

                if !text_chunks.is_empty() {
                    final_text = text_chunks.join("\n\n");
                    emit_entry(
                        &ctx.app,
                        &ctx.store,
                        &ctx.thread_id,
                        TimelineEntry::AssistantMessage {
                            id: assistant_entry_id.clone(),
                            turn_id: ctx.turn_id.clone(),
                            content: final_text.clone(),
                            model: Some(model.clone()),
                            streaming: true,
                            timestamp: now_ms(),
                        },
                    );
                }

                if tool_calls.is_empty() {
                    break;
                }

                messages.push(json!({ "role": "assistant", "content": blocks }));
                let mut result_blocks = Vec::new();
                for call in &tool_calls {
                    let out =
                        execute_single_tool(&mut ctx, call, &dirty_norm, &mut session_auto_approved)
                            .await?;
                    result_blocks.push(json!({
                        "type": "tool_result",
                        "tool_use_id": call.call_id,
                        "content": out
                    }));
                }
                messages.push(json!({ "role": "user", "content": result_blocks }));
            }

            emit_entry(
                &ctx.app,
                &ctx.store,
                &ctx.thread_id,
                TimelineEntry::AssistantMessage {
                    id: assistant_entry_id,
                    turn_id: ctx.turn_id.clone(),
                    content: final_text.clone(),
                    model: Some(model.clone()),
                    streaming: false,
                    timestamp: now_ms(),
                },
            );

            Ok(ApiTurnOutcome {
                final_text,
                model_used: model,
            })
        }

        "gemini-api" => {
            let api_key = ctx
                .api_key
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .ok_or_else(|| "Gemini API key is required.".to_string())?
                .to_string();
            let model = if ctx.model.trim().is_empty() {
                "gemini-2.5-flash".to_string()
            } else {
                ctx.model.trim().to_string()
            };
            let endpoint = format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
                model, api_key
            );

            let mut contents: Vec<Value> = ctx
                .prior_messages
                .iter()
                .map(|(role, content)| {
                    json!({
                        "role": if role == "assistant" { "model" } else { "user" },
                        "parts": [{ "text": content }]
                    })
                })
                .collect();

            let mut user_parts = vec![json!({ "text": ctx.user_prompt })];
            for img in &ctx.images {
                user_parts.push(json!({
                    "inline_data": {
                        "mime_type": img.mime_type,
                        "data": img.base64
                    }
                }));
            }
            contents.push(json!({ "role": "user", "parts": user_parts }));

            let mut final_text = String::new();

            for step in 0..MAX_TOOL_STEPS {
                let payload = json!({
                    "systemInstruction": { "parts": [{ "text": sys_prompt }] },
                    "tools": [{ "functionDeclarations": schemas }],
                    "contents": contents
                });

                let req = client.post(&endpoint).json(&payload);
                let resp = send_http_cancellable(req, ctx.cancel_rx.clone()).await?;
                let status = resp.status();
                let resp_body: Value = resp.json().await.map_err(|e| e.to_string())?;
                if !status.is_success() {
                    return Err(format!("Gemini API error ({}): {}", status, resp_body));
                }

                let model_content = resp_body["candidates"][0]["content"].clone();
                let parts = model_content["parts"].as_array().cloned().unwrap_or_default();

                let mut text_chunks = Vec::new();
                let mut calls = Vec::new();
                for (idx, part) in parts.iter().enumerate() {
                    if part.get("thought").and_then(|v| v.as_bool()).unwrap_or(false) {
                        if let Some(t) = part["text"].as_str() {
                            emit_entry(
                                &ctx.app,
                                &ctx.store,
                                &ctx.thread_id,
                                TimelineEntry::Thinking {
                                    id: thinking_entry_id.clone(),
                                    turn_id: ctx.turn_id.clone(),
                                    content: t.trim().to_string(),
                                    streaming: false,
                                    timestamp: now_ms(),
                                },
                            );
                        }
                    } else if let Some(t) = part["text"].as_str() {
                        if !t.trim().is_empty() {
                            text_chunks.push(t.to_string());
                        }
                    }
                    if let Some(fc) = part.get("functionCall") {
                        calls.push(ParsedToolCall {
                            call_id: format!("gemini_{}_{}", step, idx),
                            name: fc["name"].as_str().unwrap_or("").to_string(),
                            args: fc["args"].clone(),
                        });
                    }
                }

                if !text_chunks.is_empty() {
                    final_text = text_chunks.join("\n\n");
                    emit_entry(
                        &ctx.app,
                        &ctx.store,
                        &ctx.thread_id,
                        TimelineEntry::AssistantMessage {
                            id: assistant_entry_id.clone(),
                            turn_id: ctx.turn_id.clone(),
                            content: final_text.clone(),
                            model: Some(model.clone()),
                            streaming: true,
                            timestamp: now_ms(),
                        },
                    );
                }

                if calls.is_empty() {
                    break;
                }

                // Preserve exact model_content (including thoughtSignature if any)
                contents.push(model_content);
                let mut resp_parts = Vec::new();
                for call in &calls {
                    let out =
                        execute_single_tool(&mut ctx, call, &dirty_norm, &mut session_auto_approved)
                            .await?;
                    resp_parts.push(json!({
                        "functionResponse": {
                            "name": call.name,
                            "response": { "result": out }
                        }
                    }));
                }
                contents.push(json!({ "role": "user", "parts": resp_parts }));
            }

            emit_entry(
                &ctx.app,
                &ctx.store,
                &ctx.thread_id,
                TimelineEntry::AssistantMessage {
                    id: assistant_entry_id,
                    turn_id: ctx.turn_id.clone(),
                    content: final_text.clone(),
                    model: Some(model.clone()),
                    streaming: false,
                    timestamp: now_ms(),
                },
            );

            Ok(ApiTurnOutcome {
                final_text,
                model_used: model,
            })
        }

        other => Err(format!("Unsupported API provider: {}", other)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preserves_shift_jis_and_crlf_on_write() {
        let tmp = std::env::temp_dir().join(format!(
            "onigiri_harness_enc_test_{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        let file = tmp.join("legacy.md");
        let sjis_bytes = crate::encode_text_with_encoding("見出し\r\n本文テスト\r\n", Some("shift_jis")).unwrap();
        fs::write(&file, &sjis_bytes).unwrap();

        let used_enc = write_workspace_file_preserving_encoding(&file, "見出し\n更新後の本文\n").unwrap();
        assert_eq!(used_enc, "shift_jis");

        let raw_after = fs::read(&file).unwrap();
        let decoded = crate::decode_bytes_with_encoding(&raw_after, None).unwrap();
        assert_eq!(decoded.encoding, "shift_jis");
        assert_eq!(decoded.eol, "\r\n");
        assert_eq!(decoded.content, "見出し\r\n更新後の本文\r\n");

        // Rejects path traversal
        assert!(resolve_safe_workspace_path(&tmp.to_string_lossy(), "../outside.md").is_err());

        let _ = fs::remove_dir_all(&tmp);
    }
}
