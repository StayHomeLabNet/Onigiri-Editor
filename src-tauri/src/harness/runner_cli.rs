use super::store::HarnessStore;
use super::types::{HarnessEvent, TimelineEntry};
use std::env;
use std::path::Path;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::{mpsc, watch};

const CLI_IDLE_TIMEOUT_SECS: u64 = 300;
const CLI_MAX_TOTAL_SECS: u64 = 1800;

pub struct CliTurnContext {
    pub app: Option<tauri::AppHandle>,
    pub store: Arc<HarnessStore>,
    pub thread_id: String,
    pub turn_id: String,
    pub workspace_root: String,
    pub provider: String,
    pub model: String,
    pub permission_mode: String,
    pub provider_session_id: Option<String>,
    pub user_prompt: String,
    pub prior_messages: Vec<(String, String)>,
    pub system_prompt_extra: Option<String>,
    pub custom_cli_cmd: Option<String>,
    pub images: Vec<crate::ai::AiImageAttachment>,
    pub cancel_rx: watch::Receiver<bool>,
}

pub struct CliTurnOutcome {
    pub final_text: String,
    pub model_used: String,
    pub new_session_id: Option<String>,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
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

fn strip_ansi(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '\x1b' {
            if matches!(chars.peek(), Some('[')) {
                let _ = chars.next();
                while let Some(c) = chars.next() {
                    if ('@'..='~').contains(&c) {
                        break;
                    }
                }
                continue;
            }
        }
        out.push(ch);
    }
    out
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

fn build_composite_cli_prompt(ctx: &CliTurnContext, include_history: bool) -> String {
    let mut sections: Vec<String> = Vec::new();

    if ctx.permission_mode == "plan" {
        sections.push(
            "[MODE: PLAN / READ-ONLY]\n\
             Do NOT create, modify, or delete any files, and do NOT run destructive commands.\n\
             Inspect the workspace as needed, then respond with:\n\
             1. A concise summary of your findings and proposed approach.\n\
             2. A numbered or bulleted step-by-step implementation plan."
                .to_string(),
        );
    }

    if let Some(extra) = ctx.system_prompt_extra.as_deref() {
        let trimmed = extra.trim();
        if !trimmed.is_empty() {
            sections.push(trimmed.to_string());
        }
    }

    if include_history && !ctx.prior_messages.is_empty() {
        let start = ctx.prior_messages.len().saturating_sub(12);
        let mut hist_block = String::from("# Previous Conversation Context\n");
        for (role, text) in &ctx.prior_messages[start..] {
            let label = if role == "assistant" { "Assistant" } else { "User" };
            hist_block.push_str(&format!("\n[{}]:\n{}\n", label, truncate_chars(text, 4000)));
        }
        sections.push(hist_block);
    }

    if !ctx.images.is_empty() {
        let paths: Vec<String> = ctx
            .images
            .iter()
            .filter(|img| !img.path.trim().is_empty())
            .map(|img| img.path.clone())
            .collect();
        if !paths.is_empty() {
            sections.push(format!("Attached image files:\n{}", paths.join("\n")));
        }
    }

    sections.push(ctx.user_prompt.trim().to_string());
    sections.join("\n\n")
}

pub fn extract_plan_steps(markdown: &str) -> (String, Vec<String>) {
    let mut steps = Vec::new();
    let mut summary_lines = Vec::new();

    for line in markdown.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Some(rest) = trimmed
            .strip_prefix("- ")
            .or_else(|| trimmed.strip_prefix("* "))
        {
            let clean = rest.trim().trim_start_matches("[ ] ").trim();
            if !clean.is_empty() && steps.len() < 16 {
                steps.push(truncate_chars(clean, 220));
            }
        } else if let Some(dot_idx) = trimmed.find(". ") {
            let num_part = &trimmed[..dot_idx];
            if !num_part.is_empty() && num_part.chars().all(|c| c.is_ascii_digit()) {
                let clean = trimmed[dot_idx + 2..].trim();
                if !clean.is_empty() && steps.len() < 16 {
                    steps.push(truncate_chars(clean, 220));
                }
            } else if summary_lines.len() < 3 && !trimmed.starts_with('#') && steps.is_empty() {
                summary_lines.push(trimmed.to_string());
            }
        } else if summary_lines.len() < 3 && !trimmed.starts_with('#') && steps.is_empty() {
            summary_lines.push(trimmed.to_string());
        }
    }

    let summary = if summary_lines.is_empty() {
        truncate_chars(markdown.trim().lines().next().unwrap_or("Implementation Plan"), 240)
    } else {
        truncate_chars(&summary_lines.join(" "), 300)
    };

    (summary, steps)
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum StreamProtocol {
    CodexJsonl,
    ClaudeStreamJson,
    PlainText,
}

pub async fn execute_cli_turn(mut ctx: CliTurnContext) -> Result<CliTurnOutcome, String> {
    let is_plan = ctx.permission_mode == "plan";
    let is_full = ctx.permission_mode == "full-access";
    let allow_write = !is_plan;
    let model_owned = Some(ctx.model.trim().to_string()).filter(|s| !s.is_empty() && s != "auto");
    let model_opt = model_owned.as_deref();

    match ctx.provider.as_str() {
        "codex-cli" => {
            let bin = crate::ai::find_executable(&["codex"]).ok_or_else(|| {
                "Codex CLI (`codex`) was not found on PATH. Run `npm install -g @openai/codex && codex login`.".to_string()
            })?;
            let prompt = build_composite_cli_prompt(&ctx, true);
            let out_file = env::temp_dir().join(format!(
                "onigiri_harness_codex_{}_{}.txt",
                ctx.turn_id,
                now_ms()
            ));
            let sandbox_mode = if is_full {
                "danger-full-access"
            } else if allow_write {
                "workspace-write"
            } else {
                "read-only"
            };
            let mut args = vec![
                "exec".to_string(),
                "--json".to_string(),
                "--skip-git-repo-check".to_string(),
                "--sandbox".to_string(),
                sandbox_mode.to_string(),
                "-o".to_string(),
                out_file.to_string_lossy().to_string(),
                "-C".to_string(),
                ctx.workspace_root.clone(),
            ];
            if let Some(m) = model_opt {
                args.push("-m".to_string());
                args.push(m.to_string());
            }
            args.push("-".to_string());

            let res = run_harness_cli_process(
                &mut ctx,
                &bin,
                &args,
                Some(&prompt),
                StreamProtocol::CodexJsonl,
            )
            .await;

            let file_text = std::fs::read_to_string(&out_file).unwrap_or_default();
            let _ = std::fs::remove_file(&out_file);
            let mut out = res?;
            if out.final_text.trim().is_empty() && !file_text.trim().is_empty() {
                out.final_text = file_text.trim().to_string();
            }
            out.model_used = model_opt.unwrap_or("codex").to_string();
            Ok(out)
        }

        "claude-cli" => {
            let bin = crate::ai::find_executable(&["claude"]).ok_or_else(|| {
                "Claude Code CLI (`claude`) was not found on PATH. Run `npm install -g @anthropic-ai/claude-code && claude`.".to_string()
            })?;

            let has_resume = ctx
                .provider_session_id
                .as_deref()
                .map(|s| !s.trim().is_empty())
                .unwrap_or(false);
            let prompt = build_composite_cli_prompt(&ctx, !has_resume);

            let build_claude_args = |resume_id: Option<&str>, prompt_arg: &str| -> (Vec<String>, bool) {
                let mut a = vec![
                    "-p".to_string(),
                    "--output-format".to_string(),
                    "stream-json".to_string(),
                    "--verbose".to_string(),
                ];
                if let Some(sid) = resume_id {
                    a.push("--resume".to_string());
                    a.push(sid.to_string());
                }
                if let Some(m) = model_opt {
                    a.push("--model".to_string());
                    a.push(m.to_string());
                }
                let allowed_tools = if is_plan {
                    "Read,Glob,Grep,LS"
                } else if is_full {
                    "Read,Edit,Write,MultiEdit,Glob,Grep,LS,Bash"
                } else {
                    "Read,Edit,Write,MultiEdit,Glob,Grep,LS"
                };
                a.push("--allowedTools".to_string());
                a.push(allowed_tools.to_string());

                let use_stdin = cfg!(target_os = "windows") && prompt_arg.encode_utf16().count() > 14_000;
                if !use_stdin {
                    a.push(prompt_arg.to_string());
                }
                (a, use_stdin)
            };

            let (args, use_stdin) = build_claude_args(ctx.provider_session_id.as_deref(), &prompt);
            let first_try = run_harness_cli_process(
                &mut ctx,
                &bin,
                &args,
                if use_stdin { Some(prompt.as_str()) } else { None },
                StreamProtocol::ClaudeStreamJson,
            )
            .await;

            match first_try {
                Ok(mut out) => {
                    out.model_used = model_opt.unwrap_or("claude-code").to_string();
                    Ok(out)
                }
                Err(err) if has_resume && err != "CLI_CANCELLED" => {
                    // Fallback without --resume if session expired
                    let full_prompt = build_composite_cli_prompt(&ctx, true);
                    let (retry_args, retry_stdin) = build_claude_args(None, &full_prompt);
                    let mut out = run_harness_cli_process(
                        &mut ctx,
                        &bin,
                        &retry_args,
                        if retry_stdin { Some(full_prompt.as_str()) } else { None },
                        StreamProtocol::ClaudeStreamJson,
                    )
                    .await?;
                    out.model_used = model_opt.unwrap_or("claude-code").to_string();
                    Ok(out)
                }
                Err(e) => Err(e),
            }
        }

        "gemini-cli" => {
            let bin = crate::ai::find_executable(&["gemini"]).ok_or_else(|| {
                "Gemini CLI (`gemini`) was not found on PATH. Run `npm install -g @google/gemini-cli && gemini`.".to_string()
            })?;
            let prompt = build_composite_cli_prompt(&ctx, true);
            let mut args = Vec::new();
            if let Some(m) = model_opt {
                args.push("-m".to_string());
                args.push(m.to_string());
            }
            if is_full {
                args.push("-y".to_string());
            }
            let use_stdin = cfg!(target_os = "windows") && prompt.encode_utf16().count() > 14_000;
            args.push("-p".to_string());
            let stdin_opt = if use_stdin {
                args.push("Follow the prompt provided via stdin.".to_string());
                Some(prompt.as_str())
            } else {
                args.push(prompt.clone());
                None
            };
            let mut out = run_harness_cli_process(
                &mut ctx,
                &bin,
                &args,
                stdin_opt,
                StreamProtocol::PlainText,
            )
            .await?;
            out.model_used = model_opt.unwrap_or("gemini-cli").to_string();
            Ok(out)
        }

        "antigravity-cli" => {
            let bin = crate::ai::find_executable(&["agy"]).ok_or_else(|| {
                "Antigravity CLI (`agy`) was not found on PATH.".to_string()
            })?;
            let prompt = build_composite_cli_prompt(&ctx, true);
            let mut args = vec!["--output-format".to_string(), "text".to_string()];
            if allow_write {
                args.push("--mode".to_string());
                args.push("accept-edits".to_string());
            }
            if let Some(m) = model_opt {
                args.push("--model".to_string());
                args.push(m.to_string());
            }
            args.push("-p".to_string());
            args.push(prompt);
            let mut out = run_harness_cli_process(
                &mut ctx,
                &bin,
                &args,
                None,
                StreamProtocol::PlainText,
            )
            .await?;
            out.model_used = model_opt.unwrap_or("antigravity-cli").to_string();
            Ok(out)
        }

        "custom-cli" => {
            let raw_cmd = ctx
                .custom_cli_cmd
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .ok_or_else(|| "Custom CLI command is empty.".to_string())?
                .to_string();
            let prompt = build_composite_cli_prompt(&ctx, true);
            let mut tokens: Vec<String> = raw_cmd.split_whitespace().map(|s| s.to_string()).collect();
            let cmd_name = tokens.remove(0);
            let bin = crate::ai::find_executable(&[&cmd_name]).unwrap_or(cmd_name);
            let mut used_placeholder = false;
            for arg in &mut tokens {
                if arg.contains("{prompt}") {
                    *arg = arg.replace("{prompt}", &prompt);
                    used_placeholder = true;
                }
            }
            let stdin_opt = if used_placeholder {
                None
            } else {
                Some(prompt.as_str())
            };
            let mut out = run_harness_cli_process(
                &mut ctx,
                &bin,
                &tokens,
                stdin_opt,
                StreamProtocol::PlainText,
            )
            .await?;
            out.model_used = raw_cmd;
            Ok(out)
        }

        other => Err(format!("Unsupported CLI provider: {}", other)),
    }
}

async fn run_harness_cli_process(
    ctx: &mut CliTurnContext,
    bin: &str,
    args: &[String],
    stdin_input: Option<&str>,
    protocol: StreamProtocol,
) -> Result<CliTurnOutcome, String> {
    let mut cmd = crate::ai::build_cli_command(bin, args);
    cmd.env("PATH", crate::ai::extended_path())
        .env("GEMINI_CLI_TRUST_WORKSPACE", "true")
        .kill_on_drop(true)
        .stdin(if stdin_input.is_some() {
            std::process::Stdio::piped()
        } else {
            std::process::Stdio::null()
        })
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    let ws_path = Path::new(&ctx.workspace_root);
    if ws_path.exists() && ws_path.is_dir() {
        cmd.current_dir(ws_path);
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to launch '{}': {}", bin, e))?;

    if let Some(input) = stdin_input {
        if let Some(mut stdin) = child.stdin.take() {
            let _ = stdin.write_all(input.as_bytes()).await;
            let _ = stdin.shutdown().await;
        }
    }

    let (line_tx, mut line_rx) = mpsc::unbounded_channel::<(bool, String)>();

    let mut stdout_task = child.stdout.take().map(|out| {
        let tx = line_tx.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(out);
            let mut buf = Vec::new();
            loop {
                buf.clear();
                match reader.read_until(b'\n', &mut buf).await {
                    Ok(0) | Err(_) => break,
                    Ok(_) => {
                        let line = String::from_utf8_lossy(&buf)
                            .trim_end_matches(&['\r', '\n'][..])
                            .to_string();
                        if tx.send((false, line)).is_err() {
                            break;
                        }
                    }
                }
            }
        })
    });

    let mut stderr_task = child.stderr.take().map(|err| {
        let tx = line_tx.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(err);
            let mut buf = Vec::new();
            loop {
                buf.clear();
                match reader.read_until(b'\n', &mut buf).await {
                    Ok(0) | Err(_) => break,
                    Ok(_) => {
                        let line = String::from_utf8_lossy(&buf)
                            .trim_end_matches(&['\r', '\n'][..])
                            .to_string();
                        if tx.send((true, line)).is_err() {
                            break;
                        }
                    }
                }
            }
        })
    });

    drop(line_tx);

    let started = Instant::now();
    let mut last_activity = Instant::now();
    let mut heartbeat = tokio::time::interval(Duration::from_secs(3));
    heartbeat.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

    let assistant_entry_id = format!("asst-{}", ctx.turn_id);
    let thinking_entry_id = format!("think-{}", ctx.turn_id);
    let mut assistant_text = String::new();
    let mut thinking_text = String::new();
    let mut plain_lines: Vec<String> = Vec::new();
    let mut stderr_lines: Vec<String> = Vec::new();
    let mut detected_session_id: Option<String> = None;
    let mut protocol_error: Option<String> = None;
    let mut tool_seq = 0usize;
    let mut active_tool_ids: Vec<String> = Vec::new();
    let mut channel_closed = false;

    let mut handle_line = |is_stderr: bool, raw_line: String| {
        if is_stderr {
            let clean = strip_ansi(&raw_line);
            if !clean.trim().is_empty() {
                stderr_lines.push(clean);
            }
            return;
        }

        match protocol {
            StreamProtocol::PlainText => {
                let clean = strip_ansi(&raw_line);
                plain_lines.push(clean);
                assistant_text = plain_lines.join("\n");
                emit_entry(
                    &ctx.app,
                    &ctx.store,
                    &ctx.thread_id,
                    TimelineEntry::AssistantMessage {
                        id: assistant_entry_id.clone(),
                        turn_id: ctx.turn_id.clone(),
                        content: assistant_text.clone(),
                        model: Some(ctx.model.clone()),
                        streaming: true,
                        timestamp: now_ms(),
                    },
                );
            }
            StreamProtocol::CodexJsonl => {
                let trimmed = raw_line.trim();
                let Ok(val) = serde_json::from_str::<serde_json::Value>(trimmed) else {
                    if !trimmed.is_empty() {
                        plain_lines.push(strip_ansi(&raw_line));
                    }
                    return;
                };
                match val.get("type").and_then(|v| v.as_str()) {
                    Some("thread.started") => {
                        if let Some(tid) = val.get("thread_id").and_then(|v| v.as_str()) {
                            detected_session_id = Some(tid.to_string());
                        }
                    }
                    Some("item.started") => {
                        let item = &val["item"];
                        let item_id = item
                            .get("id")
                            .and_then(|v| v.as_str())
                            .map(|s| format!("tool-{}-{}", ctx.turn_id, s))
                            .unwrap_or_else(|| {
                                tool_seq += 1;
                                format!("tool-{}-{}", ctx.turn_id, tool_seq)
                            });
                        match item.get("type").and_then(|v| v.as_str()) {
                            Some("command_execution") => {
                                let cmd_str = item
                                    .get("command")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("shell command");
                                emit_entry(
                                    &ctx.app,
                                    &ctx.store,
                                    &ctx.thread_id,
                                    TimelineEntry::ToolCall {
                                        id: item_id,
                                        turn_id: ctx.turn_id.clone(),
                                        tool_name: "shell".to_string(),
                                        summary: truncate_chars(cmd_str, 140),
                                        args_preview: cmd_str.to_string(),
                                        status: "running".to_string(),
                                        output_preview: None,
                                        target_path: None,
                                        timestamp: now_ms(),
                                    },
                                );
                            }
                            Some("web_search") => {
                                let q = item.get("query").and_then(|v| v.as_str()).unwrap_or("");
                                emit_entry(
                                    &ctx.app,
                                    &ctx.store,
                                    &ctx.thread_id,
                                    TimelineEntry::ToolCall {
                                        id: item_id,
                                        turn_id: ctx.turn_id.clone(),
                                        tool_name: "web_search".to_string(),
                                        summary: format!("Web search: {}", truncate_chars(q, 100)),
                                        args_preview: q.to_string(),
                                        status: "running".to_string(),
                                        output_preview: None,
                                        target_path: None,
                                        timestamp: now_ms(),
                                    },
                                );
                            }
                            Some("file_change") => {
                                emit_entry(
                                    &ctx.app,
                                    &ctx.store,
                                    &ctx.thread_id,
                                    TimelineEntry::ToolCall {
                                        id: item_id,
                                        turn_id: ctx.turn_id.clone(),
                                        tool_name: "edit_file".to_string(),
                                        summary: "Applying file changes".to_string(),
                                        args_preview: String::new(),
                                        status: "running".to_string(),
                                        output_preview: None,
                                        target_path: None,
                                        timestamp: now_ms(),
                                    },
                                );
                            }
                            _ => {}
                        }
                    }
                    Some("item.completed") => {
                        let item = &val["item"];
                        let item_id = item
                            .get("id")
                            .and_then(|v| v.as_str())
                            .map(|s| format!("tool-{}-{}", ctx.turn_id, s))
                            .unwrap_or_else(|| {
                                tool_seq += 1;
                                format!("tool-{}-{}", ctx.turn_id, tool_seq)
                            });
                        match item.get("type").and_then(|v| v.as_str()) {
                            Some("reasoning") => {
                                if let Some(txt) = item.get("text").and_then(|v| v.as_str()) {
                                    if !txt.trim().is_empty() {
                                        if !thinking_text.is_empty() {
                                            thinking_text.push_str("\n\n");
                                        }
                                        thinking_text.push_str(txt.trim());
                                        emit_entry(
                                            &ctx.app,
                                            &ctx.store,
                                            &ctx.thread_id,
                                            TimelineEntry::Thinking {
                                                id: thinking_entry_id.clone(),
                                                turn_id: ctx.turn_id.clone(),
                                                content: thinking_text.clone(),
                                                streaming: false,
                                                timestamp: now_ms(),
                                            },
                                        );
                                    }
                                }
                            }
                            Some("agent_message") => {
                                if let Some(txt) = item.get("text").and_then(|v| v.as_str()) {
                                    if !txt.trim().is_empty() {
                                        assistant_text = txt.trim().to_string();
                                        emit_entry(
                                            &ctx.app,
                                            &ctx.store,
                                            &ctx.thread_id,
                                            TimelineEntry::AssistantMessage {
                                                id: assistant_entry_id.clone(),
                                                turn_id: ctx.turn_id.clone(),
                                                content: assistant_text.clone(),
                                                model: Some(ctx.model.clone()),
                                                streaming: true,
                                                timestamp: now_ms(),
                                            },
                                        );
                                    }
                                }
                            }
                            Some("command_execution") => {
                                let cmd_str = item
                                    .get("command")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("shell command");
                                let code = item.get("exit_code").and_then(|v| v.as_i64()).unwrap_or(0);
                                let out_txt = item
                                    .get("aggregated_output")
                                    .and_then(|v| v.as_str())
                                    .map(|s| truncate_chars(s.trim(), 1200));
                                emit_entry(
                                    &ctx.app,
                                    &ctx.store,
                                    &ctx.thread_id,
                                    TimelineEntry::ToolCall {
                                        id: item_id,
                                        turn_id: ctx.turn_id.clone(),
                                        tool_name: "shell".to_string(),
                                        summary: truncate_chars(cmd_str, 140),
                                        args_preview: cmd_str.to_string(),
                                        status: if code == 0 { "done" } else { "failed" }.to_string(),
                                        output_preview: out_txt,
                                        target_path: None,
                                        timestamp: now_ms(),
                                    },
                                );
                            }
                            Some("file_change") => {
                                let first_path = item
                                    .get("changes")
                                    .and_then(|v| v.as_array())
                                    .and_then(|arr| arr.first())
                                    .and_then(|c| c.get("path"))
                                    .and_then(|p| p.as_str())
                                    .map(|s| s.to_string());
                                let summary = first_path
                                    .as_deref()
                                    .map(|p| format!("Edited {}", p))
                                    .unwrap_or_else(|| "Edited files".to_string());
                                emit_entry(
                                    &ctx.app,
                                    &ctx.store,
                                    &ctx.thread_id,
                                    TimelineEntry::ToolCall {
                                        id: item_id,
                                        turn_id: ctx.turn_id.clone(),
                                        tool_name: "edit_file".to_string(),
                                        summary,
                                        args_preview: String::new(),
                                        status: "done".to_string(),
                                        output_preview: None,
                                        target_path: first_path,
                                        timestamp: now_ms(),
                                    },
                                );
                            }
                            _ => {}
                        }
                    }
                    Some("error") | Some("turn.failed") => {
                        let msg = val
                            .get("message")
                            .and_then(|v| v.as_str())
                            .or_else(|| {
                                val.get("error")
                                    .and_then(|e| e.get("message"))
                                    .and_then(|v| v.as_str())
                            });
                        if let Some(m) = msg {
                            protocol_error = Some(m.to_string());
                        }
                    }
                    _ => {}
                }
            }
            StreamProtocol::ClaudeStreamJson => {
                let trimmed = raw_line.trim();
                let Ok(val) = serde_json::from_str::<serde_json::Value>(trimmed) else {
                    if !trimmed.is_empty() {
                        plain_lines.push(strip_ansi(&raw_line));
                    }
                    return;
                };
                if let Some(sid) = val.get("session_id").and_then(|v| v.as_str()) {
                    if !sid.is_empty() {
                        detected_session_id = Some(sid.to_string());
                    }
                }
                match val.get("type").and_then(|v| v.as_str()) {
                    Some("assistant") => {
                        if let Some(blocks) = val
                            .get("message")
                            .and_then(|m| m.get("content"))
                            .and_then(|c| c.as_array())
                        {
                            for block in blocks {
                                match block.get("type").and_then(|v| v.as_str()) {
                                    Some("thinking") => {
                                        if let Some(t) = block.get("thinking").and_then(|v| v.as_str()) {
                                            thinking_text = t.trim().to_string();
                                            emit_entry(
                                                &ctx.app,
                                                &ctx.store,
                                                &ctx.thread_id,
                                                TimelineEntry::Thinking {
                                                    id: thinking_entry_id.clone(),
                                                    turn_id: ctx.turn_id.clone(),
                                                    content: thinking_text.clone(),
                                                    streaming: false,
                                                    timestamp: now_ms(),
                                                },
                                            );
                                        }
                                    }
                                    Some("text") => {
                                        if let Some(t) = block.get("text").and_then(|v| v.as_str()) {
                                            if !t.trim().is_empty() {
                                                assistant_text = t.to_string();
                                                emit_entry(
                                                    &ctx.app,
                                                    &ctx.store,
                                                    &ctx.thread_id,
                                                    TimelineEntry::AssistantMessage {
                                                        id: assistant_entry_id.clone(),
                                                        turn_id: ctx.turn_id.clone(),
                                                        content: assistant_text.clone(),
                                                        model: Some(ctx.model.clone()),
                                                        streaming: true,
                                                        timestamp: now_ms(),
                                                    },
                                                );
                                            }
                                        }
                                    }
                                    Some("tool_use") => {
                                        let tool_name = block
                                            .get("name")
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("tool");
                                        let id_raw = block
                                            .get("id")
                                            .and_then(|v| v.as_str())
                                            .map(|s| format!("tool-{}-{}", ctx.turn_id, s))
                                            .unwrap_or_else(|| {
                                                tool_seq += 1;
                                                format!("tool-{}-{}", ctx.turn_id, tool_seq)
                                            });
                                        let input = &block["input"];
                                        let file_path = input
                                            .get("file_path")
                                            .or_else(|| input.get("path"))
                                            .and_then(|v| v.as_str())
                                            .map(|s| s.to_string());
                                        let cmd_str = input.get("command").and_then(|v| v.as_str());
                                        let summary = if let Some(fp) = file_path.as_deref() {
                                            format!("{}: {}", tool_name, fp)
                                        } else if let Some(c) = cmd_str {
                                            format!("{}: {}", tool_name, truncate_chars(c, 100))
                                        } else {
                                            tool_name.to_string()
                                        };
                                        active_tool_ids.push(id_raw.clone());
                                        emit_entry(
                                            &ctx.app,
                                            &ctx.store,
                                            &ctx.thread_id,
                                            TimelineEntry::ToolCall {
                                                id: id_raw,
                                                turn_id: ctx.turn_id.clone(),
                                                tool_name: tool_name.to_string(),
                                                summary,
                                                args_preview: truncate_chars(&input.to_string(), 500),
                                                status: "running".to_string(),
                                                output_preview: None,
                                                target_path: file_path,
                                                timestamp: now_ms(),
                                            },
                                        );
                                    }
                                    _ => {}
                                }
                            }
                        }
                    }
                    Some("user") => {
                        if let Some(blocks) = val
                            .get("message")
                            .and_then(|m| m.get("content"))
                            .and_then(|c| c.as_array())
                        {
                            for block in blocks {
                                if block.get("type").and_then(|v| v.as_str()) == Some("tool_result") {
                                    if let Some(use_id) = block.get("tool_use_id").and_then(|v| v.as_str()) {
                                        let target_id = format!("tool-{}-{}", ctx.turn_id, use_id);
                                        let is_err = block
                                            .get("is_error")
                                            .and_then(|v| v.as_bool())
                                            .unwrap_or(false);
                                        let preview = block
                                            .get("content")
                                            .and_then(|v| v.as_str())
                                            .map(|s| truncate_chars(s.trim(), 800));
                                        let existing = ctx
                                            .store
                                            .load_timeline(&ctx.thread_id)
                                            .into_iter()
                                            .find(|e| e.id() == target_id);
                                        if let Some(TimelineEntry::ToolCall {
                                            id,
                                            turn_id,
                                            tool_name,
                                            summary,
                                            args_preview,
                                            target_path,
                                            ..
                                        }) = existing
                                        {
                                            emit_entry(
                                                &ctx.app,
                                                &ctx.store,
                                                &ctx.thread_id,
                                                TimelineEntry::ToolCall {
                                                    id,
                                                    turn_id,
                                                    tool_name,
                                                    summary,
                                                    args_preview,
                                                    status: if is_err { "failed" } else { "done" }
                                                        .to_string(),
                                                    output_preview: preview,
                                                    target_path,
                                                    timestamp: now_ms(),
                                                },
                                            );
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Some("result") => {
                        if let Some(res_txt) = val.get("result").and_then(|v| v.as_str()) {
                            if !res_txt.trim().is_empty() {
                                assistant_text = res_txt.to_string();
                            }
                        }
                        if val.get("is_error").and_then(|v| v.as_bool()).unwrap_or(false) {
                            if let Some(res_txt) = val.get("result").and_then(|v| v.as_str()) {
                                protocol_error = Some(res_txt.to_string());
                            }
                        }
                    }
                    _ => {}
                }
            }
        }
    };

    let status = loop {
        tokio::select! {
            _ = async {
                while !*ctx.cancel_rx.borrow() {
                    if ctx.cancel_rx.changed().await.is_err() {
                        std::future::pending::<()>().await;
                    }
                }
            } => {
                let _ = child.kill().await;
                let _ = child.wait().await;
                return Err("CLI_CANCELLED".to_string());
            }
            msg = line_rx.recv(), if !channel_closed => {
                match msg {
                    Some((is_stderr, raw_line)) => {
                        last_activity = Instant::now();
                        handle_line(is_stderr, raw_line);
                    }
                    None => {
                        channel_closed = true;
                    }
                }
            }
            _ = heartbeat.tick() => {
                if last_activity.elapsed() >= Duration::from_secs(CLI_IDLE_TIMEOUT_SECS) {
                    let _ = child.kill().await;
                    let _ = child.wait().await;
                    return Err(format!("CLI timed out after {}s without output.", CLI_IDLE_TIMEOUT_SECS));
                }
                if started.elapsed() >= Duration::from_secs(CLI_MAX_TOTAL_SECS) {
                    let _ = child.kill().await;
                    let _ = child.wait().await;
                    return Err(format!("CLI exceeded max runtime limit ({}s).", CLI_MAX_TOTAL_SECS));
                }
            }
            res = child.wait() => {
                break res.map_err(|e| format!("CLI execution error: {}", e))?;
            }
        }
    };

    let _ = tokio::time::timeout(Duration::from_millis(600), async {
        if let Some(h) = stdout_task.take() {
            let _ = h.await;
        }
        if let Some(h) = stderr_task.take() {
            let _ = h.await;
        }
    })
    .await;

    while let Ok((is_stderr, raw_line)) = line_rx.try_recv() {
        handle_line(is_stderr, raw_line);
    }

    if assistant_text.trim().is_empty() && !plain_lines.is_empty() {
        assistant_text = plain_lines.join("\n").trim().to_string();
    }

    if !status.success() && assistant_text.trim().is_empty() {
        let err_msg = protocol_error
            .filter(|s| !s.trim().is_empty())
            .or_else(|| {
                let joined = stderr_lines.join("\n").trim().to_string();
                (!joined.is_empty()).then_some(joined)
            })
            .unwrap_or_else(|| format!("CLI exited with status {}", status));
        return Err(err_msg);
    }

    if !assistant_text.trim().is_empty() {
        emit_entry(
            &ctx.app,
            &ctx.store,
            &ctx.thread_id,
            TimelineEntry::AssistantMessage {
                id: assistant_entry_id,
                turn_id: ctx.turn_id.clone(),
                content: assistant_text.clone(),
                model: Some(ctx.model.clone()),
                streaming: false,
                timestamp: now_ms(),
            },
        );
    }

    Ok(CliTurnOutcome {
        final_text: assistant_text,
        model_used: ctx.model.clone(),
        new_session_id: detected_session_id,
    })
}
