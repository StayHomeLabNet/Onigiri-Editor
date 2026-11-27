use super::types::{HarnessStorageSummary, HarnessThread, TimelineEntry};
use std::fs;
use std::path::{Path, PathBuf};

pub struct HarnessStore {
    base_dir: PathBuf,
}

impl HarnessStore {
    pub fn new(base_dir: PathBuf) -> Self {
        Self { base_dir }
    }

    #[allow(dead_code)]
    pub fn base_dir(&self) -> &Path {
        &self.base_dir
    }

    pub fn snapshots_dir(&self) -> PathBuf {
        self.base_dir.join("snapshots")
    }

    fn threads_file(&self) -> PathBuf {
        self.base_dir.join("threads.json")
    }

    fn timelines_dir(&self) -> PathBuf {
        self.base_dir.join("timelines")
    }

    fn timeline_file(&self, thread_id: &str) -> PathBuf {
        let safe_id: String = thread_id
            .chars()
            .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
            .collect();
        self.timelines_dir().join(format!("{}.jsonl", safe_id))
    }

    fn ensure_dirs(&self) -> Result<(), String> {
        fs::create_dir_all(&self.base_dir)
            .map_err(|e| format!("Failed to create harness dir: {}", e))?;
        fs::create_dir_all(self.timelines_dir())
            .map_err(|e| format!("Failed to create timelines dir: {}", e))?;
        fs::create_dir_all(self.snapshots_dir())
            .map_err(|e| format!("Failed to create snapshots dir: {}", e))?;
        Ok(())
    }

    pub fn load_threads(&self) -> Vec<HarnessThread> {
        let path = self.threads_file();
        let Ok(raw) = fs::read_to_string(&path) else {
            return Vec::new();
        };
        serde_json::from_str::<Vec<HarnessThread>>(&raw).unwrap_or_default()
    }

    pub fn save_threads(&self, threads: &[HarnessThread]) -> Result<(), String> {
        self.ensure_dirs()?;
        let json = serde_json::to_string_pretty(threads)
            .map_err(|e| format!("Failed to serialize threads: {}", e))?;
        let target = self.threads_file();
        let tmp = self.base_dir.join("threads.json.tmp");
        fs::write(&tmp, json).map_err(|e| format!("Failed to write threads tmp: {}", e))?;
        fs::rename(&tmp, &target).map_err(|e| format!("Failed to commit threads.json: {}", e))
    }

    pub fn load_timeline(&self, thread_id: &str) -> Vec<TimelineEntry> {
        let path = self.timeline_file(thread_id);
        let Ok(raw) = fs::read_to_string(&path) else {
            return Vec::new();
        };
        raw.lines()
            .filter(|l| !l.trim().is_empty())
            .filter_map(|line| serde_json::from_str::<TimelineEntry>(line).ok())
            .collect()
    }

    pub fn save_timeline(&self, thread_id: &str, entries: &[TimelineEntry]) -> Result<(), String> {
        self.ensure_dirs()?;
        let mut out = String::new();
        for entry in entries {
            let line = serde_json::to_string(entry)
                .map_err(|e| format!("Failed to serialize timeline entry: {}", e))?;
            out.push_str(&line);
            out.push('\n');
        }
        let target = self.timeline_file(thread_id);
        let tmp = target.with_extension("jsonl.tmp");
        fs::write(&tmp, out).map_err(|e| format!("Failed to write timeline tmp: {}", e))?;
        fs::rename(&tmp, &target).map_err(|e| format!("Failed to commit timeline: {}", e))
    }

    pub fn upsert_entry(&self, thread_id: &str, entry: TimelineEntry) -> Result<Vec<TimelineEntry>, String> {
        let mut entries = self.load_timeline(thread_id);
        if let Some(existing) = entries.iter_mut().find(|e| e.id() == entry.id()) {
            *existing = entry;
        } else {
            entries.push(entry);
        }
        self.save_timeline(thread_id, &entries)?;
        Ok(entries)
    }

    pub fn delete_thread_files(&self, thread_id: &str) {
        let entries = self.load_timeline(thread_id);
        for entry in entries {
            if let TimelineEntry::TurnDiff { snapshot_id, .. } = entry {
                if !snapshot_id.is_empty() {
                    let snap_manifest = self
                        .snapshots_dir()
                        .join("manifests")
                        .join(format!("{}.json", snapshot_id));
                    let _ = fs::remove_file(snap_manifest);
                }
            }
        }
        let _ = fs::remove_file(self.timeline_file(thread_id));
    }

    pub fn storage_summary(&self) -> HarnessStorageSummary {
        let threads = self.load_threads();
        let total_bytes = compute_dir_size(&self.base_dir);
        HarnessStorageSummary {
            thread_count: threads.len(),
            total_bytes,
        }
    }

    pub fn clear_all(&self) -> Result<HarnessStorageSummary, String> {
        let summary = self.storage_summary();
        if self.base_dir.exists() {
            fs::remove_dir_all(&self.base_dir)
                .map_err(|e| format!("Failed to clear harness data: {}", e))?;
        }
        Ok(summary)
    }
}

fn compute_dir_size(dir: &Path) -> u64 {
    if !dir.exists() {
        return 0;
    }
    let mut total = 0u64;
    for entry in walkdir::WalkDir::new(dir).into_iter().flatten() {
        if entry.file_type().is_file() {
            if let Ok(meta) = entry.metadata() {
                total = total.saturating_add(meta.len());
            }
        }
    }
    total
}
