use crate::ai::{AiChatResponse, ChatMessageInput};
#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
use crate::ai::AiChatProgressEvent;
#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
use std::time::Instant;
#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
use tauri::Emitter;
use tokio::sync::watch;

#[derive(Debug, Clone)]
pub struct AppleFmAvailability {
    pub supported: bool,
    pub available: bool,
    pub status: String,
}

#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
mod ffi {
    use std::os::raw::{c_char, c_int, c_void};

    pub type ProgressCallback = extern "C" fn(*mut c_void, *const c_char);

    extern "C" {
        pub fn afm_is_compiled_with_sdk() -> c_int;
        pub fn afm_check_availability() -> c_int;
        pub fn afm_cancel(request_id: *const c_char) -> c_int;
        pub fn afm_free_string(ptr: *mut c_char);
        pub fn afm_generate(
            request_id: *const c_char,
            system_prompt: *const c_char,
            prompt: *const c_char,
            permissive_guardrails: c_int,
            progress_cb: Option<ProgressCallback>,
            progress_ctx: *mut c_void,
            out_text: *mut *mut c_char,
            out_error: *mut *mut c_char,
        ) -> c_int;
    }
}

pub fn check_availability() -> AppleFmAvailability {
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    {
        let compiled_with_sdk = unsafe { ffi::afm_is_compiled_with_sdk() } != 0;
        let code = unsafe { ffi::afm_check_availability() };
        let status = match code {
            0 => "available",
            1 => "unsupported_os",
            2 => "device_not_eligible",
            3 => "apple_intelligence_not_enabled",
            4 => "model_not_ready",
            _ => "unavailable",
        };
        AppleFmAvailability {
            supported: compiled_with_sdk,
            available: compiled_with_sdk && code == 0,
            status: status.to_string(),
        }
    }

    #[cfg(all(target_os = "macos", not(target_arch = "aarch64")))]
    {
        AppleFmAvailability {
            supported: false,
            available: false,
            status: "device_not_eligible".to_string(),
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        AppleFmAvailability {
            supported: false,
            available: false,
            status: "unsupported_platform".to_string(),
        }
    }
}

#[allow(dead_code)]
fn clamp_chars_head_tail(input: &str, max_chars: usize) -> String {
    let count = input.chars().count();
    if count <= max_chars {
        return input.to_string();
    }
    let keep_head = (max_chars * 2) / 3;
    let keep_tail = max_chars.saturating_sub(keep_head).saturating_sub(32);
    let head: String = input.chars().take(keep_head).collect();
    let tail: String = input
        .chars()
        .skip(count.saturating_sub(keep_tail))
        .collect();
    format!("{}\n...[truncated for on-device context limit]...\n{}", head, tail)
}

#[allow(dead_code)]
pub fn build_prompt_payload(
    system_prompt: Option<&str>,
    messages: &[ChatMessageInput],
) -> (Option<String>, String) {
    // Apple Foundation Models on-device context window is ~4,096 tokens.
    // Keep instructions and conversation prompt reasonably bounded while preserving the latest user turn.
    const MAX_SYSTEM_CHARS: usize = 4_500;
    const MAX_PROMPT_CHARS: usize = 6_500;

    let clean_system = system_prompt
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| clamp_chars_head_tail(s, MAX_SYSTEM_CHARS));

    if messages.is_empty() {
        return (clean_system, String::new());
    }

    if messages.len() == 1 {
        let single = clamp_chars_head_tail(messages[0].content.trim(), MAX_PROMPT_CHARS);
        return (clean_system, single);
    }

    // Include recent conversation turns, prioritizing the latest messages.
    let mut parts: Vec<String> = Vec::new();
    let mut total_chars = 0usize;
    let last_idx = messages.len() - 1;

    // Always include the latest message first (bounded)
    let latest_msg = &messages[last_idx];
    let latest_role = if latest_msg.role == "assistant" {
        "Assistant"
    } else {
        "User"
    };
    let latest_text = clamp_chars_head_tail(latest_msg.content.trim(), MAX_PROMPT_CHARS - 512);
    let latest_block = format!("{}: {}", latest_role, latest_text);
    total_chars += latest_block.chars().count();
    parts.push(latest_block);

    for m in messages[..last_idx].iter().rev() {
        let role = if m.role == "assistant" {
            "Assistant"
        } else {
            "User"
        };
        let snippet = clamp_chars_head_tail(m.content.trim(), 1_500);
        let block = format!("{}: {}", role, snippet);
        let len = block.chars().count() + 2;
        if total_chars + len > MAX_PROMPT_CHARS {
            break;
        }
        total_chars += len;
        parts.push(block);
    }

    parts.reverse();
    let prompt = format!("{}\n\nAssistant:", parts.join("\n\n"));
    (clean_system, prompt)
}

#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
struct ProgressBridgeCtx {
    app: tauri::AppHandle,
    request_id: String,
    started_at: Instant,
}

#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
extern "C" fn on_afm_progress(ctx: *mut std::os::raw::c_void, msg: *const std::os::raw::c_char) {
    if ctx.is_null() || msg.is_null() {
        return;
    }
    let bridge = unsafe { &*(ctx as *const ProgressBridgeCtx) };
    if bridge.request_id.is_empty() {
        return;
    }
    let text = unsafe { std::ffi::CStr::from_ptr(msg) }
        .to_string_lossy()
        .trim()
        .to_string();
    if text.is_empty() {
        return;
    }
    let _ = bridge.app.emit(
        "ai-chat-progress",
        AiChatProgressEvent {
            request_id: bridge.request_id.clone(),
            kind: "output".to_string(),
            text,
            elapsed_secs: bridge.started_at.elapsed().as_secs(),
        },
    );
}

#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
pub async fn generate(
    app: tauri::AppHandle,
    request_id: String,
    mut cancel_rx: watch::Receiver<bool>,
    model_opt: Option<&str>,
    system_prompt: Option<&str>,
    messages: &[ChatMessageInput],
) -> Result<AiChatResponse, String> {
    use std::ffi::{CStr, CString};
    use std::ptr;

    let permissive = matches!(
        model_opt.map(|m| m.trim().to_ascii_lowercase()).as_deref(),
        Some("permissive") | Some("content-transformations")
    );
    let model_used = if permissive {
        "Apple Foundation Models (Permissive)".to_string()
    } else {
        "Apple Foundation Models".to_string()
    };

    let (sys_opt, prompt_text) = build_prompt_payload(system_prompt, messages);
    if prompt_text.trim().is_empty() {
        return Err("Prompt is empty.".to_string());
    }

    let effective_req_id = if request_id.is_empty() {
        format!(
            "afm-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        )
    } else {
        request_id.clone()
    };

    let started_at = Instant::now();
    if !request_id.is_empty() {
        let _ = app.emit(
            "ai-chat-progress",
            AiChatProgressEvent {
                request_id: request_id.clone(),
                kind: "status".to_string(),
                text: "Apple Foundation Models (On-Device)...".to_string(),
                elapsed_secs: 0,
            },
        );
    }

    // Watch cancel channel and forward cancellation to Swift Task
    let cancel_req_id = effective_req_id.clone();
    let cancel_watcher = tokio::spawn(async move {
        loop {
            if *cancel_rx.borrow() {
                if let Ok(c_id) = CString::new(cancel_req_id.as_str()) {
                    unsafe {
                        ffi::afm_cancel(c_id.as_ptr());
                    }
                }
                break;
            }
            if cancel_rx.changed().await.is_err() {
                break;
            }
        }
    });

    let c_req_id = CString::new(effective_req_id.as_str())
        .map_err(|_| "Invalid request ID.".to_string())?;
    let c_sys = match sys_opt {
        Some(s) => Some(CString::new(s.replace('\0', "")).map_err(|_| "Invalid system prompt.")?),
        None => None,
    };
    let c_prompt = CString::new(prompt_text.replace('\0', ""))
        .map_err(|_| "Invalid prompt text.".to_string())?;

    let blocking_result = tokio::task::spawn_blocking(move || {
        let bridge_ctx = ProgressBridgeCtx {
            app,
            request_id,
            started_at,
        };
        let mut out_text: *mut std::os::raw::c_char = ptr::null_mut();
        let mut out_error: *mut std::os::raw::c_char = ptr::null_mut();

        let status = unsafe {
            ffi::afm_generate(
                c_req_id.as_ptr(),
                c_sys.as_ref().map_or(ptr::null(), |s| s.as_ptr()),
                c_prompt.as_ptr(),
                if permissive { 1 } else { 0 },
                Some(on_afm_progress),
                (&bridge_ctx as *const ProgressBridgeCtx) as *mut std::os::raw::c_void,
                &mut out_text,
                &mut out_error,
            )
        };

        let text_opt = if !out_text.is_null() {
            let s = unsafe { CStr::from_ptr(out_text) }
                .to_string_lossy()
                .to_string();
            unsafe { ffi::afm_free_string(out_text) };
            Some(s)
        } else {
            None
        };

        let err_opt = if !out_error.is_null() {
            let s = unsafe { CStr::from_ptr(out_error) }
                .to_string_lossy()
                .to_string();
            unsafe { ffi::afm_free_string(out_error) };
            Some(s)
        } else {
            None
        };

        match status {
            0 => Ok(text_opt.unwrap_or_default()),
            2 => Err("CLI_CANCELLED".to_string()),
            _ => Err(err_opt
                .filter(|s| !s.trim().is_empty())
                .unwrap_or_else(|| "Apple Foundation Models failed to generate a response.".to_string())),
        }
    })
    .await
    .map_err(|e| format!("Apple Foundation Models worker failed: {}", e))?;

    cancel_watcher.abort();

    let content = blocking_result?;
    if content.trim().is_empty() {
        return Err("Apple Foundation Models returned an empty response.".to_string());
    }
    Ok(AiChatResponse {
        content,
        model_used,
    })
}

#[cfg(all(target_os = "macos", not(target_arch = "aarch64")))]
pub async fn generate(
    _app: tauri::AppHandle,
    _request_id: String,
    _cancel_rx: watch::Receiver<bool>,
    _model_opt: Option<&str>,
    _system_prompt: Option<&str>,
    _messages: &[ChatMessageInput],
) -> Result<AiChatResponse, String> {
    Err("Apple Foundation Models requires an Apple Silicon Mac (M1 or later).".to_string())
}

#[cfg(not(target_os = "macos"))]
pub async fn generate(
    _app: tauri::AppHandle,
    _request_id: String,
    _cancel_rx: watch::Receiver<bool>,
    _model_opt: Option<&str>,
    _system_prompt: Option<&str>,
    _messages: &[ChatMessageInput],
) -> Result<AiChatResponse, String> {
    Err("Apple Foundation Models is only available on macOS.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn availability_check_returns_known_status() {
        let info = check_availability();
        let valid_statuses = [
            "available",
            "unsupported_os",
            "device_not_eligible",
            "apple_intelligence_not_enabled",
            "model_not_ready",
            "unavailable",
            "unsupported_platform",
        ];
        assert!(
            valid_statuses.contains(&info.status.as_str()),
            "unexpected status: {}",
            info.status
        );
        #[cfg(target_os = "macos")]
        {
            if info.available {
                assert!(info.supported);
                assert_eq!(info.status, "available");
            }
        }
    }

    #[test]
    fn builds_single_and_multi_turn_prompts() {
        let single = vec![ChatMessageInput {
            role: "user".to_string(),
            content: "Hello".to_string(),
        }];
        let (sys, prompt) = build_prompt_payload(Some("Be concise."), &single);
        assert_eq!(sys.as_deref(), Some("Be concise."));
        assert_eq!(prompt, "Hello");

        let multi = vec![
            ChatMessageInput {
                role: "user".to_string(),
                content: "First question".to_string(),
            },
            ChatMessageInput {
                role: "assistant".to_string(),
                content: "First answer".to_string(),
            },
            ChatMessageInput {
                role: "user".to_string(),
                content: "Follow up".to_string(),
            },
        ];
        let (_, multi_prompt) = build_prompt_payload(None, &multi);
        assert!(multi_prompt.contains("User: First question"));
        assert!(multi_prompt.contains("Assistant: First answer"));
        assert!(multi_prompt.contains("User: Follow up"));
        assert!(multi_prompt.ends_with("Assistant:"));
    }
}
