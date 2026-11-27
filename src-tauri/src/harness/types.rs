use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HarnessThread {
    pub id: String,
    pub title: String,
    pub workspace_root: String,
    #[serde(default)]
    pub worktree_path: Option<String>,
    #[serde(default)]
    pub branch: Option<String>,
    pub provider: String,
    pub model: String,
    pub permission_mode: String,
    #[serde(default)]
    pub provider_session_id: Option<String>,
    pub status: String,
    #[serde(default)]
    pub unread: bool,
    pub created_at: u64,
    pub updated_at: u64,
    #[serde(default)]
    pub turn_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TurnChangedFile {
    pub path: String,
    pub relative_path: String,
    pub status: String, // "added" | "modified" | "deleted"
    pub additions: usize,
    pub deletions: usize,
    pub unified_diff: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum TimelineEntry {
    #[serde(rename_all = "camelCase")]
    UserMessage {
        id: String,
        turn_id: String,
        content: String,
        #[serde(default)]
        context_files: Vec<String>,
        #[serde(default)]
        images_count: usize,
        timestamp: u64,
    },
    #[serde(rename_all = "camelCase")]
    AssistantMessage {
        id: String,
        turn_id: String,
        content: String,
        #[serde(default)]
        model: Option<String>,
        #[serde(default)]
        streaming: bool,
        timestamp: u64,
    },
    #[serde(rename_all = "camelCase")]
    Thinking {
        id: String,
        turn_id: String,
        content: String,
        #[serde(default)]
        streaming: bool,
        timestamp: u64,
    },
    #[serde(rename_all = "camelCase")]
    ToolCall {
        id: String,
        turn_id: String,
        tool_name: String,
        summary: String,
        #[serde(default)]
        args_preview: String,
        status: String, // "running" | "done" | "failed" | "rejected"
        #[serde(default)]
        output_preview: Option<String>,
        #[serde(default)]
        target_path: Option<String>,
        timestamp: u64,
    },
    #[serde(rename_all = "camelCase")]
    PlanCard {
        id: String,
        turn_id: String,
        summary: String,
        #[serde(default)]
        steps: Vec<String>,
        raw_plan: String,
        #[serde(default)]
        executed: bool,
        timestamp: u64,
    },
    #[serde(rename_all = "camelCase")]
    TurnDiff {
        id: String,
        turn_id: String,
        snapshot_id: String,
        #[serde(default)]
        files: Vec<TurnChangedFile>,
        #[serde(default)]
        reverted: bool,
        #[serde(default)]
        accepted: bool,
        #[serde(default)]
        dirty_conflicts: Vec<String>,
        timestamp: u64,
    },
    #[serde(rename_all = "camelCase")]
    ApprovalRequest {
        id: String,
        turn_id: String,
        approval_id: String,
        tool_name: String,
        summary: String,
        #[serde(default)]
        target_path: Option<String>,
        #[serde(default)]
        command: Option<String>,
        #[serde(default)]
        diff_preview: Option<String>,
        #[serde(default)]
        decision: Option<String>, // "allow" | "allow_session" | "deny"
        #[serde(default)]
        is_dirty_conflict: bool,
        timestamp: u64,
    },
    #[serde(rename_all = "camelCase")]
    Notice {
        id: String,
        turn_id: String,
        level: String, // "info" | "warning" | "error"
        message: String,
        timestamp: u64,
    },
}

impl TimelineEntry {
    pub fn id(&self) -> &str {
        match self {
            TimelineEntry::UserMessage { id, .. } => id,
            TimelineEntry::AssistantMessage { id, .. } => id,
            TimelineEntry::Thinking { id, .. } => id,
            TimelineEntry::ToolCall { id, .. } => id,
            TimelineEntry::PlanCard { id, .. } => id,
            TimelineEntry::TurnDiff { id, .. } => id,
            TimelineEntry::ApprovalRequest { id, .. } => id,
            TimelineEntry::Notice { id, .. } => id,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HarnessCreateThreadRequest {
    pub title: Option<String>,
    pub workspace_root: String,
    pub provider: String,
    pub model: String,
    pub permission_mode: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HarnessUpdateThreadRequest {
    pub thread_id: String,
    pub title: Option<String>,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub permission_mode: Option<String>,
    pub unread: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HarnessSendMessageRequest {
    pub thread_id: String,
    pub content: String,
    #[serde(default)]
    pub provider: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub permission_mode: Option<String>,
    #[serde(default)]
    pub api_key: Option<String>,
    #[serde(default)]
    pub base_url: Option<String>,
    #[serde(default)]
    pub custom_cli_cmd: Option<String>,
    #[serde(default)]
    pub system_prompt_extra: Option<String>,
    #[serde(default)]
    pub context_files: Vec<String>,
    #[serde(default)]
    pub dirty_paths: Vec<String>,
    #[serde(default)]
    pub images: Vec<crate::ai::AiImageAttachment>,
    #[serde(default)]
    pub execute_plan_entry_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HarnessStorageSummary {
    pub thread_count: usize,
    pub total_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum HarnessEvent {
    #[serde(rename_all = "camelCase")]
    ThreadUpdated { thread: HarnessThread },
    #[serde(rename_all = "camelCase")]
    ThreadsChanged { threads: Vec<HarnessThread> },
    #[serde(rename_all = "camelCase")]
    EntryUpserted {
        thread_id: String,
        entry: TimelineEntry,
    },
    #[serde(rename_all = "camelCase")]
    WorkspaceFilesChanged {
        thread_id: String,
        workspace_root: String,
        paths: Vec<String>,
    },
}
