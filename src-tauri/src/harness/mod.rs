pub mod runner_api;
pub mod runner_cli;
pub mod snapshot;
pub mod store;
pub mod types;

use runner_api::{execute_api_turn, ApiTurnContext};
use runner_cli::{execute_cli_turn, extract_plan_steps, CliTurnContext};
use snapshot::{
    capture_baseline_snapshot, compute_turn_changes, detect_git_branch, revert_turn_changes,
};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};
use store::HarnessStore;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::{oneshot, watch};
use types::{
    HarnessCreateThreadRequest, HarnessEvent, HarnessSendMessageRequest, HarnessStorageSummary,
    HarnessThread, HarnessUpdateThreadRequest, TimelineEntry,
};

pub struct HarnessState {
    store_cell: OnceLock<Arc<HarnessStore>>,
    threads: Arc<Mutex<Vec<HarnessThread>>>,
    loaded: Mutex<bool>,
    active_cancels: Arc<Mutex<HashMap<String, watch::Sender<bool>>>>,
    pending_approvals: Arc<Mutex<HashMap<String, oneshot::Sender<String>>>>,
    active_write_workspaces: Arc<Mutex<HashMap<String, String>>>, // normalized_ws -> thread_id
}

impl HarnessState {
    pub fn new() -> Self {
        Self {
            store_cell: OnceLock::new(),
            threads: Arc::new(Mutex::new(Vec::new())),
            loaded: Mutex::new(false),
            active_cancels: Arc::new(Mutex::new(HashMap::new())),
            pending_approvals: Arc::new(Mutex::new(HashMap::new())),
            active_write_workspaces: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    fn ensure_store(&self, app: &AppHandle) -> Arc<HarnessStore> {
        let store = self
            .store_cell
            .get_or_init(|| {
                let base = app
                    .path()
                    .app_data_dir()
                    .unwrap_or_else(|_| std::env::temp_dir().join("onigiri-editor-data"))
                    .join("harness");
                Arc::new(HarnessStore::new(base))
            })
            .clone();

        let mut loaded_guard = self.loaded.lock().unwrap();
        if !*loaded_guard {
            let mut loaded_threads = store.load_threads();
            // Reset any stale 'running' / 'waiting_approval' status left over from a previous app exit
            let mut changed = false;
            for t in &mut loaded_threads {
                if t.status == "running" || t.status == "waiting_approval" {
                    t.status = "idle".to_string();
                    changed = true;
                }
            }
            if changed {
                let _ = store.save_threads(&loaded_threads);
            }
            if let Ok(mut tg) = self.threads.lock() {
                *tg = loaded_threads;
            }
            *loaded_guard = true;
        }
        store
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn normalize_ws_key(path: &str) -> String {
    let trimmed = path.trim().trim_end_matches(['/', '\\']).replace('\\', "/");
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        trimmed.to_lowercase()
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        trimmed
    }
}

fn is_cli_provider(provider: &str) -> bool {
    matches!(
        provider,
        "codex-cli" | "claude-cli" | "gemini-cli" | "antigravity-cli" | "custom-cli"
    )
}

fn derive_thread_title(prompt: &str) -> String {
    let first_line = prompt
        .lines()
        .map(str::trim)
        .find(|l| !l.is_empty())
        .unwrap_or("New Thread");
    let count = first_line.chars().count();
    if count <= 46 {
        first_line.to_string()
    } else {
        let head: String = first_line.chars().take(46).collect();
        format!("{}…", head)
    }
}

fn collect_prior_conversation(entries: &[TimelineEntry]) -> Vec<(String, String)> {
    let mut out = Vec::new();
    for entry in entries {
        match entry {
            TimelineEntry::UserMessage { content, .. } => {
                if !content.trim().is_empty() {
                    out.push(("user".to_string(), content.clone()));
                }
            }
            TimelineEntry::AssistantMessage { content, .. } => {
                if !content.trim().is_empty() {
                    out.push(("assistant".to_string(), content.clone()));
                }
            }
            _ => {}
        }
    }
    out
}

#[tauri::command]
pub fn harness_list_threads(app: AppHandle, state: State<'_, HarnessState>) -> Vec<HarnessThread> {
    let _store = state.ensure_store(&app);
    let mut list = state.threads.lock().unwrap().clone();
    list.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    list
}

#[tauri::command]
pub fn harness_create_thread(
    app: AppHandle,
    state: State<'_, HarnessState>,
    request: HarnessCreateThreadRequest,
) -> Result<HarnessThread, String> {
    let store = state.ensure_store(&app);
    let ws = request.workspace_root.trim().to_string();
    if ws.is_empty() {
        return Err("Workspace folder is required to start a harness thread.".to_string());
    }
    let now = now_ms();
    let id = format!(
        "hthread-{}-{:04x}",
        now,
        (now % 65535) as u16 ^ (std::process::id() as u16)
    );
    let branch = detect_git_branch(&ws);
    let perm = request
        .permission_mode
        .as_deref()
        .filter(|s| matches!(*s, "plan" | "approve-edits" | "auto-edits" | "full-access"))
        .unwrap_or("auto-edits")
        .to_string();

    let thread = HarnessThread {
        id,
        title: request
            .title
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .unwrap_or("New Thread")
            .to_string(),
        workspace_root: ws,
        worktree_path: None,
        branch,
        provider: request.provider,
        model: request.model,
        permission_mode: perm,
        provider_session_id: None,
        status: "idle".to_string(),
        unread: false,
        created_at: now,
        updated_at: now,
        turn_count: 0,
    };

    let all_threads = {
        let mut guard = state.threads.lock().unwrap();
        guard.insert(0, thread.clone());
        store.save_threads(&guard)?;
        guard.clone()
    };

    let _ = app.emit(
        "harness-event",
        HarnessEvent::ThreadsChanged {
            threads: all_threads,
        },
    );

    Ok(thread)
}

#[tauri::command]
pub fn harness_update_thread(
    app: AppHandle,
    state: State<'_, HarnessState>,
    request: HarnessUpdateThreadRequest,
) -> Result<HarnessThread, String> {
    let store = state.ensure_store(&app);
    let updated = {
        let mut guard = state.threads.lock().unwrap();
        let t = guard
            .iter_mut()
            .find(|t| t.id == request.thread_id)
            .ok_or_else(|| "Thread not found.".to_string())?;
        if let Some(title) = request.title.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
            t.title = title.to_string();
        }
        if let Some(p) = request.provider.as_deref().filter(|s| !s.is_empty()) {
            if t.provider != p {
                t.provider = p.to_string();
                t.provider_session_id = None;
            }
        }
        if let Some(m) = request.model.as_deref() {
            t.model = m.to_string();
        }
        if let Some(pm) = request.permission_mode.as_deref() {
            t.permission_mode = pm.to_string();
        }
        if let Some(unread) = request.unread {
            t.unread = unread;
        }
        t.branch = detect_git_branch(&t.workspace_root);
        let cloned = t.clone();
        store.save_threads(&guard)?;
        cloned
    };

    let _ = app.emit(
        "harness-event",
        HarnessEvent::ThreadUpdated {
            thread: updated.clone(),
        },
    );

    Ok(updated)
}

#[tauri::command]
pub fn harness_delete_thread(
    app: AppHandle,
    state: State<'_, HarnessState>,
    thread_id: String,
) -> Result<(), String> {
    let store = state.ensure_store(&app);
    if let Some(tx) = state.active_cancels.lock().unwrap().remove(&thread_id) {
        let _ = tx.send(true);
    }
    store.delete_thread_files(&thread_id);

    let all_threads = {
        let mut guard = state.threads.lock().unwrap();
        guard.retain(|t| t.id != thread_id);
        store.save_threads(&guard)?;
        guard.clone()
    };

    let _ = app.emit(
        "harness-event",
        HarnessEvent::ThreadsChanged {
            threads: all_threads,
        },
    );
    Ok(())
}

#[tauri::command]
pub fn harness_get_timeline(
    app: AppHandle,
    state: State<'_, HarnessState>,
    thread_id: String,
) -> Vec<TimelineEntry> {
    let store = state.ensure_store(&app);
    store.load_timeline(&thread_id)
}

#[tauri::command]
pub fn harness_cancel_turn(
    state: State<'_, HarnessState>,
    thread_id: String,
) -> Result<bool, String> {
    let guard = state.active_cancels.lock().unwrap();
    if let Some(tx) = guard.get(&thread_id) {
        let _ = tx.send(true);
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub fn harness_respond_approval(
    state: State<'_, HarnessState>,
    approval_id: String,
    decision: String,
) -> Result<bool, String> {
    let tx_opt = state.pending_approvals.lock().unwrap().remove(&approval_id);
    if let Some(tx) = tx_opt {
        let _ = tx.send(decision);
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub fn harness_revert_turn(
    app: AppHandle,
    state: State<'_, HarnessState>,
    thread_id: String,
    diff_entry_id: String,
) -> Result<Vec<String>, String> {
    let store = state.ensure_store(&app);
    let entries = store.load_timeline(&thread_id);
    let target_entry = entries
        .iter()
        .find(|e| e.id() == diff_entry_id)
        .cloned()
        .ok_or_else(|| "Diff entry not found.".to_string())?;

    let TimelineEntry::TurnDiff {
        id,
        turn_id,
        snapshot_id,
        files,
        reverted,
        dirty_conflicts,
        timestamp,
        ..
    } = target_entry
    else {
        return Err("Target entry is not a TurnDiff.".to_string());
    };

    if reverted {
        return Err("This turn has already been reverted.".to_string());
    }

    let reverted_paths = revert_turn_changes(&store.snapshots_dir(), &snapshot_id)?;

    let updated_entry = TimelineEntry::TurnDiff {
        id,
        turn_id,
        snapshot_id,
        files,
        reverted: true,
        accepted: false,
        dirty_conflicts,
        timestamp,
    };
    store.upsert_entry(&thread_id, updated_entry.clone())?;

    let _ = app.emit(
        "harness-event",
        HarnessEvent::EntryUpserted {
            thread_id: thread_id.clone(),
            entry: updated_entry,
        },
    );

    if let Some(ws) = state
        .threads
        .lock()
        .unwrap()
        .iter()
        .find(|t| t.id == thread_id)
        .map(|t| t.workspace_root.clone())
    {
        let _ = app.emit(
            "harness-event",
            HarnessEvent::WorkspaceFilesChanged {
                thread_id,
                workspace_root: ws,
                paths: reverted_paths.clone(),
            },
        );
    }

    Ok(reverted_paths)
}

#[tauri::command]
pub fn harness_accept_turn(
    app: AppHandle,
    state: State<'_, HarnessState>,
    thread_id: String,
    diff_entry_id: String,
) -> Result<(), String> {
    let store = state.ensure_store(&app);
    let entries = store.load_timeline(&thread_id);
    let Some(TimelineEntry::TurnDiff {
        id,
        turn_id,
        snapshot_id,
        files,
        reverted,
        dirty_conflicts,
        timestamp,
        ..
    }) = entries.into_iter().find(|e| e.id() == diff_entry_id)
    else {
        return Err("Diff entry not found.".to_string());
    };

    let updated = TimelineEntry::TurnDiff {
        id,
        turn_id,
        snapshot_id,
        files,
        reverted,
        accepted: true,
        dirty_conflicts,
        timestamp,
    };
    store.upsert_entry(&thread_id, updated.clone())?;
    let _ = app.emit(
        "harness-event",
        HarnessEvent::EntryUpserted {
            thread_id,
            entry: updated,
        },
    );
    Ok(())
}

#[tauri::command]
pub fn harness_get_storage_summary(
    app: AppHandle,
    state: State<'_, HarnessState>,
) -> HarnessStorageSummary {
    let store = state.ensure_store(&app);
    store.storage_summary()
}

#[tauri::command]
pub fn harness_clear_data(
    app: AppHandle,
    state: State<'_, HarnessState>,
) -> Result<HarnessStorageSummary, String> {
    let store = state.ensure_store(&app);
    {
        let mut cancels = state.active_cancels.lock().unwrap();
        for (_, tx) in cancels.drain() {
            let _ = tx.send(true);
        }
    }
    let summary = store.clear_all()?;
    {
        let mut tg = state.threads.lock().unwrap();
        tg.clear();
    }
    let _ = app.emit(
        "harness-event",
        HarnessEvent::ThreadsChanged {
            threads: Vec::new(),
        },
    );
    Ok(summary)
}

#[tauri::command]
pub async fn harness_send_message(
    app: AppHandle,
    state: State<'_, HarnessState>,
    request: HarnessSendMessageRequest,
) -> Result<HarnessThread, String> {
    let store = state.ensure_store(&app);
    let prompt_trimmed = request.content.trim().to_string();
    if prompt_trimmed.is_empty() && request.images.is_empty() {
        return Err("Prompt cannot be empty.".to_string());
    }

    // Prevent concurrent runs on the same thread
    if state
        .active_cancels
        .lock()
        .unwrap()
        .contains_key(&request.thread_id)
    {
        return Err("This thread already has a turn running.".to_string());
    }

    let now = now_ms();
    let turn_id = format!("turn-{}", now);

    // Mark executed plan card if triggered from "Execute Plan"
    if let Some(plan_id) = request.execute_plan_entry_id.as_deref() {
        let existing = store.load_timeline(&request.thread_id);
        if let Some(TimelineEntry::PlanCard {
            id,
            turn_id: p_turn,
            summary,
            steps,
            raw_plan,
            timestamp,
            ..
        }) = existing.into_iter().find(|e| e.id() == plan_id)
        {
            let marked = TimelineEntry::PlanCard {
                id,
                turn_id: p_turn,
                summary,
                steps,
                raw_plan,
                executed: true,
                timestamp,
            };
            let _ = store.upsert_entry(&request.thread_id, marked.clone());
            let _ = app.emit(
                "harness-event",
                HarnessEvent::EntryUpserted {
                    thread_id: request.thread_id.clone(),
                    entry: marked,
                },
            );
        }
    }

    let (mut thread_snapshot, downgraded_to_plan) = {
        let mut tg = state.threads.lock().unwrap();
        let t = tg
            .iter_mut()
            .find(|t| t.id == request.thread_id)
            .ok_or_else(|| "Thread not found.".to_string())?;

        if let Some(p) = request.provider.as_deref().filter(|s| !s.is_empty()) {
            if t.provider != p {
                t.provider = p.to_string();
                t.provider_session_id = None;
            }
        }
        if let Some(m) = request.model.as_deref() {
            t.model = m.to_string();
        }
        if let Some(pm) = request.permission_mode.as_deref() {
            t.permission_mode = pm.to_string();
        }

        if t.turn_count == 0 && (t.title == "New Thread" || t.title == "新しいスレッド") {
            t.title = derive_thread_title(&prompt_trimmed);
        }

        // Enforce single concurrent write-thread per workspace folder
        let ws_key = normalize_ws_key(&t.workspace_root);
        let mut downgraded = false;
        if t.permission_mode != "plan" {
            let mut wl = state.active_write_workspaces.lock().unwrap();
            if let Some(other_tid) = wl.get(&ws_key) {
                if other_tid != &t.id {
                    downgraded = true;
                }
            } else {
                wl.insert(ws_key, t.id.clone());
            }
        }

        t.turn_count += 1;
        t.status = "running".to_string();
        t.unread = false;
        t.updated_at = now;
        t.branch = detect_git_branch(&t.workspace_root);
        let cloned = t.clone();
        store.save_threads(&tg)?;
        (cloned, downgraded)
    };

    let effective_permission_mode = if downgraded_to_plan {
        "plan".to_string()
    } else {
        thread_snapshot.permission_mode.clone()
    };
    thread_snapshot.permission_mode = effective_permission_mode.clone();

    let _ = app.emit(
        "harness-event",
        HarnessEvent::ThreadUpdated {
            thread: thread_snapshot.clone(),
        },
    );

    let existing_timeline = store.load_timeline(&request.thread_id);
    let prior_messages = collect_prior_conversation(&existing_timeline);

    // Record user message
    let user_entry = TimelineEntry::UserMessage {
        id: format!("user-{}", turn_id),
        turn_id: turn_id.clone(),
        content: prompt_trimmed.clone(),
        context_files: request.context_files.clone(),
        images_count: request.images.len(),
        timestamp: now,
    };
    store.upsert_entry(&request.thread_id, user_entry.clone())?;
    let _ = app.emit(
        "harness-event",
        HarnessEvent::EntryUpserted {
            thread_id: request.thread_id.clone(),
            entry: user_entry,
        },
    );

    if downgraded_to_plan {
        let notice = TimelineEntry::Notice {
            id: format!("notice-lock-{}", turn_id),
            turn_id: turn_id.clone(),
            level: "info".to_string(),
            message: "Another thread is currently writing in this folder. Running this turn in Plan (read-only) mode to prevent file conflicts.".to_string(),
            timestamp: now_ms(),
        };
        let _ = store.upsert_entry(&request.thread_id, notice.clone());
        let _ = app.emit(
            "harness-event",
            HarnessEvent::EntryUpserted {
                thread_id: request.thread_id.clone(),
                entry: notice,
            },
        );
    }

    let (cancel_tx, cancel_rx) = watch::channel(false);
    state
        .active_cancels
        .lock()
        .unwrap()
        .insert(request.thread_id.clone(), cancel_tx);

    // Spawn background task so harness_send_message returns immediately and multiple threads can run concurrently!
    let threads_arc = state.threads.clone();
    let cancels_arc = state.active_cancels.clone();
    let approvals_arc = state.pending_approvals.clone();
    let write_locks_arc = state.active_write_workspaces.clone();
    let app_clone = app.clone();
    let store_clone = store.clone();
    let thread_for_task = thread_snapshot.clone();

    tokio::spawn(async move {
        let thread_id = thread_for_task.id.clone();
        let ws_root = thread_for_task.workspace_root.clone();
        let ws_key = normalize_ws_key(&ws_root);
        let is_plan = effective_permission_mode == "plan";

        // Build enriched prompt with attached context files if provided
        let mut enriched_prompt = prompt_trimmed.clone();
        if !request.context_files.is_empty() {
            let mut ctx_section = String::from("\n\n# Referenced Files\n");
            for fp in request.context_files.iter().take(8) {
                let p = PathBuf::from(fp);
                if let Ok(bytes) = std::fs::read(&p) {
                    if bytes.len() <= 256_000 {
                        let txt = crate::decode_bytes_with_encoding(&bytes, None)
                            .map(|d| d.content)
                            .unwrap_or_else(|_| String::from_utf8_lossy(&bytes).to_string());
                        let snippet: String = txt.chars().take(12_000).collect();
                        ctx_section.push_str(&format!("\n## {}\n```\n{}\n```\n", fp, snippet));
                    }
                }
            }
            enriched_prompt.push_str(&ctx_section);
        }

        // Capture pre-turn baseline snapshot for both diff generation and Plan-mode safety guard
        let snapshot_id = format!("hsnap-{}-{}", thread_id, turn_id);
        let baseline_opt = capture_baseline_snapshot(
            &store_clone.snapshots_dir(),
            &snapshot_id,
            &ws_root,
            now_ms(),
        )
        .ok();

        let run_result: Result<(String, Option<String>), String> =
            if is_cli_provider(&thread_for_task.provider) {
                execute_cli_turn(CliTurnContext {
                    app: Some(app_clone.clone()),
                    store: store_clone.clone(),
                    thread_id: thread_id.clone(),
                    turn_id: turn_id.clone(),
                    workspace_root: ws_root.clone(),
                    provider: thread_for_task.provider.clone(),
                    model: thread_for_task.model.clone(),
                    permission_mode: effective_permission_mode.clone(),
                    provider_session_id: thread_for_task.provider_session_id.clone(),
                    user_prompt: enriched_prompt,
                    prior_messages,
                    system_prompt_extra: request.system_prompt_extra,
                    custom_cli_cmd: request.custom_cli_cmd,
                    images: request.images,
                    cancel_rx,
                })
                .await
                .map(|o| (o.final_text, o.new_session_id))
            } else {
                execute_api_turn(ApiTurnContext {
                    app: Some(app_clone.clone()),
                    store: store_clone.clone(),
                    threads_lock: threads_arc.clone(),
                    approvals_lock: approvals_arc.clone(),
                    thread_id: thread_id.clone(),
                    turn_id: turn_id.clone(),
                    workspace_root: ws_root.clone(),
                    provider: thread_for_task.provider.clone(),
                    model: thread_for_task.model.clone(),
                    permission_mode: effective_permission_mode.clone(),
                    api_key: request.api_key,
                    base_url: request.base_url,
                    user_prompt: enriched_prompt,
                    prior_messages,
                    system_prompt_extra: request.system_prompt_extra,
                    dirty_paths: request.dirty_paths.clone(),
                    images: request.images,
                    cancel_rx,
                })
                .await
                .map(|o| (o.final_text, None))
            };

        // Release write lock if owned by this thread
        if !downgraded_to_plan && !is_plan {
            let mut wl = write_locks_arc.lock().unwrap();
            if wl.get(&ws_key).map(|s| s == &thread_id).unwrap_or(false) {
                wl.remove(&ws_key);
            }
        }
        cancels_arc.lock().unwrap().remove(&thread_id);

        // Evaluate workspace changes against baseline
        if let Some(mut manifest) = baseline_opt {
            let (changes, dirty_conflicts) =
                compute_turn_changes(&store_clone.snapshots_dir(), &mut manifest, &request.dirty_paths);

            if is_plan && !changes.is_empty() {
                // Enforce strict read-only guarantee in Plan mode even if an external CLI wrote files
                let _ = revert_turn_changes(&store_clone.snapshots_dir(), &snapshot_id);
            } else if !changes.is_empty() {
                let changed_paths: Vec<String> = changes.iter().map(|c| c.path.clone()).collect();
                let diff_entry = TimelineEntry::TurnDiff {
                    id: format!("diff-{}", turn_id),
                    turn_id: turn_id.clone(),
                    snapshot_id,
                    files: changes,
                    reverted: false,
                    accepted: false,
                    dirty_conflicts,
                    timestamp: now_ms(),
                };
                let _ = store_clone.upsert_entry(&thread_id, diff_entry.clone());
                let _ = app_clone.emit(
                    "harness-event",
                    HarnessEvent::EntryUpserted {
                        thread_id: thread_id.clone(),
                        entry: diff_entry,
                    },
                );
                let _ = app_clone.emit(
                    "harness-event",
                    HarnessEvent::WorkspaceFilesChanged {
                        thread_id: thread_id.clone(),
                        workspace_root: ws_root.clone(),
                        paths: changed_paths,
                    },
                );
            }
        }

        let (final_status, new_sid) = match run_result {
            Ok((final_text, sid)) => {
                if is_plan && !final_text.trim().is_empty() {
                    let (summary, steps) = extract_plan_steps(&final_text);
                    let plan_entry = TimelineEntry::PlanCard {
                        id: format!("plan-{}", turn_id),
                        turn_id: turn_id.clone(),
                        summary,
                        steps,
                        raw_plan: final_text,
                        executed: false,
                        timestamp: now_ms(),
                    };
                    let _ = store_clone.upsert_entry(&thread_id, plan_entry.clone());
                    let _ = app_clone.emit(
                        "harness-event",
                        HarnessEvent::EntryUpserted {
                            thread_id: thread_id.clone(),
                            entry: plan_entry,
                        },
                    );
                }
                ("completed", sid)
            }
            Err(err) if err == "CLI_CANCELLED" => {
                let notice = TimelineEntry::Notice {
                    id: format!("notice-cancel-{}", turn_id),
                    turn_id: turn_id.clone(),
                    level: "warning".to_string(),
                    message: "Turn cancelled.".to_string(),
                    timestamp: now_ms(),
                };
                let _ = store_clone.upsert_entry(&thread_id, notice.clone());
                let _ = app_clone.emit(
                    "harness-event",
                    HarnessEvent::EntryUpserted {
                        thread_id: thread_id.clone(),
                        entry: notice,
                    },
                );
                ("cancelled", None)
            }
            Err(err) => {
                let notice = TimelineEntry::Notice {
                    id: format!("notice-err-{}", turn_id),
                    turn_id: turn_id.clone(),
                    level: "error".to_string(),
                    message: err,
                    timestamp: now_ms(),
                };
                let _ = store_clone.upsert_entry(&thread_id, notice.clone());
                let _ = app_clone.emit(
                    "harness-event",
                    HarnessEvent::EntryUpserted {
                        thread_id: thread_id.clone(),
                        entry: notice,
                    },
                );
                ("error", None)
            }
        };

        let updated_thread_opt = {
            let mut tg = threads_arc.lock().unwrap();
            let res = if let Some(t) = tg.iter_mut().find(|t| t.id == thread_id) {
                t.status = final_status.to_string();
                t.unread = true;
                t.updated_at = now_ms();
                t.branch = detect_git_branch(&t.workspace_root);
                if let Some(sid) = new_sid {
                    t.provider_session_id = Some(sid);
                }
                Some(t.clone())
            } else {
                None
            };
            let _ = store_clone.save_threads(&tg);
            res
        };

        if let Some(t) = updated_thread_opt {
            let _ = app_clone.emit("harness-event", HarnessEvent::ThreadUpdated { thread: t });
        }
    });

    Ok(thread_snapshot)
}
