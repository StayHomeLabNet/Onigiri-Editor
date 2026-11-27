use super::types::TurnChangedFile;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;

const MAX_TRACKED_FILE_BYTES: u64 = 2 * 1024 * 1024; // 2 MiB
const MAX_TRACKED_FILES: usize = 8_000;

const IGNORED_DIRS: &[&str] = &[
    ".git",
    "node_modules",
    "target",
    "dist",
    "build",
    ".next",
    ".nuxt",
    ".svelte-kit",
    ".venv",
    "venv",
    "__pycache__",
    ".turbo",
    ".cache",
    "coverage",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotFileEntry {
    pub relative_path: String,
    pub sha256: String,
    pub size: u64,
    pub modified_ms: u64,
    pub blob_stored: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotManifest {
    pub snapshot_id: String,
    pub workspace_root: String,
    pub created_at: u64,
    pub pre_existing_files: BTreeMap<String, SnapshotFileEntry>,
    #[serde(default)]
    pub tracked_post_files: Vec<String>,
}

fn is_ignored_dir_name(name: &str) -> bool {
    IGNORED_DIRS.iter().any(|d| d.eq_ignore_ascii_case(name))
}

fn is_probably_binary(bytes: &[u8]) -> bool {
    let check_len = bytes.len().min(4096);
    bytes[..check_len].contains(&0)
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

fn to_forward_slash_rel(root: &Path, full: &Path) -> Option<String> {
    let rel = full.strip_prefix(root).ok()?;
    let parts: Vec<String> = rel
        .components()
        .map(|c| c.as_os_str().to_string_lossy().to_string())
        .collect();
    if parts.is_empty() {
        None
    } else {
        Some(parts.join("/"))
    }
}

fn blobs_dir(snapshots_root: &Path) -> PathBuf {
    snapshots_root.join("blobs")
}

fn manifests_dir(snapshots_root: &Path) -> PathBuf {
    snapshots_root.join("manifests")
}

fn manifest_path(snapshots_root: &Path, snapshot_id: &str) -> PathBuf {
    let safe_id: String = snapshot_id
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .collect();
    manifests_dir(snapshots_root).join(format!("{}.json", safe_id))
}

fn store_blob(snapshots_root: &Path, sha: &str, bytes: &[u8]) -> bool {
    let dir = blobs_dir(snapshots_root);
    if fs::create_dir_all(&dir).is_err() {
        return false;
    }
    let path = dir.join(sha);
    if path.exists() {
        return true;
    }
    fs::write(&path, bytes).is_ok()
}

fn load_blob(snapshots_root: &Path, sha: &str) -> Option<Vec<u8>> {
    let path = blobs_dir(snapshots_root).join(sha);
    fs::read(path).ok()
}

fn scan_workspace_files(
    workspace_root: &Path,
    snapshots_root: &Path,
    persist_blobs: bool,
) -> BTreeMap<String, (SnapshotFileEntry, Option<Vec<u8>>)> {
    let mut out = BTreeMap::new();
    if !workspace_root.exists() || !workspace_root.is_dir() {
        return out;
    }

    let walker = WalkDir::new(workspace_root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            if e.depth() == 0 {
                return true;
            }
            let name = e.file_name().to_string_lossy();
            if name == ".DS_Store" || name == "Thumbs.db" {
                return false;
            }
            if e.file_type().is_dir() && is_ignored_dir_name(&name) {
                return false;
            }
            true
        });

    for entry in walker.flatten() {
        if out.len() >= MAX_TRACKED_FILES {
            break;
        }
        if !entry.file_type().is_file() {
            continue;
        }
        let Ok(meta) = entry.metadata() else {
            continue;
        };
        let size = meta.len();
        if size > MAX_TRACKED_FILE_BYTES {
            continue;
        }
        let Some(rel) = to_forward_slash_rel(workspace_root, entry.path()) else {
            continue;
        };
        let Ok(bytes) = fs::read(entry.path()) else {
            continue;
        };
        let sha = sha256_hex(&bytes);
        let modified_ms = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        let blob_stored = if persist_blobs {
            store_blob(snapshots_root, &sha, &bytes)
        } else {
            false
        };

        out.insert(
            rel.clone(),
            (
                SnapshotFileEntry {
                    relative_path: rel,
                    sha256: sha,
                    size,
                    modified_ms,
                    blob_stored,
                },
                Some(bytes),
            ),
        );
    }

    out
}

pub fn capture_baseline_snapshot(
    snapshots_root: &Path,
    snapshot_id: &str,
    workspace_root: &str,
    now_ms: u64,
) -> Result<SnapshotManifest, String> {
    let root_path = Path::new(workspace_root);
    fs::create_dir_all(manifests_dir(snapshots_root))
        .map_err(|e| format!("Failed to create snapshot manifests dir: {}", e))?;
    fs::create_dir_all(blobs_dir(snapshots_root))
        .map_err(|e| format!("Failed to create snapshot blobs dir: {}", e))?;

    let scanned = scan_workspace_files(root_path, snapshots_root, true);
    let pre_existing_files: BTreeMap<String, SnapshotFileEntry> = scanned
        .into_iter()
        .map(|(k, (entry, _))| (k, entry))
        .collect();

    let manifest = SnapshotManifest {
        snapshot_id: snapshot_id.to_string(),
        workspace_root: workspace_root.to_string(),
        created_at: now_ms,
        pre_existing_files,
        tracked_post_files: Vec::new(),
    };

    save_manifest(snapshots_root, &manifest)?;
    Ok(manifest)
}

fn save_manifest(snapshots_root: &Path, manifest: &SnapshotManifest) -> Result<(), String> {
    let json = serde_json::to_string(manifest)
        .map_err(|e| format!("Failed to serialize snapshot manifest: {}", e))?;
    let path = manifest_path(snapshots_root, &manifest.snapshot_id);
    fs::write(&path, json).map_err(|e| format!("Failed to save snapshot manifest: {}", e))
}

pub fn load_manifest(snapshots_root: &Path, snapshot_id: &str) -> Result<SnapshotManifest, String> {
    let path = manifest_path(snapshots_root, snapshot_id);
    let raw = fs::read_to_string(&path)
        .map_err(|e| format!("Snapshot '{}' not found: {}", snapshot_id, e))?;
    serde_json::from_str::<SnapshotManifest>(&raw)
        .map_err(|e| format!("Corrupted snapshot manifest '{}': {}", snapshot_id, e))
}

pub fn compute_turn_changes(
    snapshots_root: &Path,
    manifest: &mut SnapshotManifest,
    dirty_paths: &[String],
) -> (Vec<TurnChangedFile>, Vec<String>) {
    let root_path = Path::new(&manifest.workspace_root);
    let post_scan = scan_workspace_files(root_path, snapshots_root, false);

    let mut all_rels: HashSet<String> = manifest.pre_existing_files.keys().cloned().collect();
    for k in post_scan.keys() {
        all_rels.insert(k.clone());
    }
    let mut sorted_rels: Vec<String> = all_rels.into_iter().collect();
    sorted_rels.sort();

    let dirty_norm: HashSet<String> = dirty_paths
        .iter()
        .map(|p| normalize_compare_path(p))
        .collect();

    let mut changed_files = Vec::new();
    let mut dirty_conflicts = Vec::new();
    let mut newly_added_rels = Vec::new();

    for rel in sorted_rels {
        let pre_opt = manifest.pre_existing_files.get(&rel);
        let post_opt = post_scan.get(&rel);

        let full_path = root_path.join(rel.replace('/', std::path::MAIN_SEPARATOR_STR));
        let full_path_str = full_path.to_string_lossy().to_string();

        match (pre_opt, post_opt) {
            (None, Some((_, bytes_opt))) => {
                newly_added_rels.push(rel.clone());
                let new_bytes = bytes_opt.as_deref().unwrap_or(&[]);
                let new_text = decode_text_lossy(new_bytes);
                let (diff, adds, dels) = compute_unified_diff("", &new_text, &rel);
                if dirty_norm.contains(&normalize_compare_path(&full_path_str)) {
                    dirty_conflicts.push(full_path_str.clone());
                }
                changed_files.push(TurnChangedFile {
                    path: full_path_str,
                    relative_path: rel,
                    status: "added".to_string(),
                    additions: adds,
                    deletions: dels,
                    unified_diff: diff,
                });
            }
            (Some(pre), None) => {
                let old_bytes = load_blob(snapshots_root, &pre.sha256).unwrap_or_default();
                let old_text = decode_text_lossy(&old_bytes);
                let (diff, adds, dels) = compute_unified_diff(&old_text, "", &rel);
                if dirty_norm.contains(&normalize_compare_path(&full_path_str)) {
                    dirty_conflicts.push(full_path_str.clone());
                }
                changed_files.push(TurnChangedFile {
                    path: full_path_str,
                    relative_path: rel,
                    status: "deleted".to_string(),
                    additions: adds,
                    deletions: dels,
                    unified_diff: diff,
                });
            }
            (Some(pre), Some((post_entry, bytes_opt))) => {
                if pre.sha256 == post_entry.sha256 {
                    continue;
                }
                let old_bytes = load_blob(snapshots_root, &pre.sha256).unwrap_or_default();
                let new_bytes = bytes_opt.as_deref().unwrap_or(&[]);
                let (diff, adds, dels) = if is_probably_binary(&old_bytes) || is_probably_binary(new_bytes) {
                    (
                        format!("--- a/{rel}\n+++ b/{rel}\n@@ binary file modified @@\n"),
                        0,
                        0,
                    )
                } else {
                    let old_text = decode_text_lossy(&old_bytes);
                    let new_text = decode_text_lossy(new_bytes);
                    compute_unified_diff(&old_text, &new_text, &rel)
                };
                if dirty_norm.contains(&normalize_compare_path(&full_path_str)) {
                    dirty_conflicts.push(full_path_str.clone());
                }
                changed_files.push(TurnChangedFile {
                    path: full_path_str,
                    relative_path: rel,
                    status: "modified".to_string(),
                    additions: adds,
                    deletions: dels,
                    unified_diff: diff,
                });
            }
            (None, None) => {}
        }
    }

    manifest.tracked_post_files = changed_files.iter().map(|f| f.relative_path.clone()).collect();
    let _ = save_manifest(snapshots_root, manifest);
    let _ = newly_added_rels;

    (changed_files, dirty_conflicts)
}

pub fn revert_turn_changes(
    snapshots_root: &Path,
    snapshot_id: &str,
) -> Result<Vec<String>, String> {
    let manifest = load_manifest(snapshots_root, snapshot_id)?;
    let root_path = Path::new(&manifest.workspace_root);
    let mut reverted_paths = Vec::new();

    for rel in &manifest.tracked_post_files {
        let target = root_path.join(rel.replace('/', std::path::MAIN_SEPARATOR_STR));
        if let Some(pre) = manifest.pre_existing_files.get(rel) {
            let bytes = load_blob(snapshots_root, &pre.sha256).ok_or_else(|| {
                format!("Backup blob missing for '{}' (sha {})", rel, pre.sha256)
            })?;
            if let Some(parent) = target.parent() {
                let _ = fs::create_dir_all(parent);
            }
            fs::write(&target, bytes)
                .map_err(|e| format!("Failed to restore '{}': {}", rel, e))?;
            reverted_paths.push(target.to_string_lossy().to_string());
        } else if target.exists() {
            fs::remove_file(&target)
                .map_err(|e| format!("Failed to remove added file '{}': {}", rel, e))?;
            reverted_paths.push(target.to_string_lossy().to_string());
        }
    }

    Ok(reverted_paths)
}

pub fn detect_git_branch(workspace_root: &str) -> Option<String> {
    let root = Path::new(workspace_root);
    let head_path = root.join(".git").join("HEAD");
    let raw = fs::read_to_string(head_path).ok()?;
    let trimmed = raw.trim();
    if let Some(rest) = trimmed.strip_prefix("ref: refs/heads/") {
        Some(rest.trim().to_string())
    } else if trimmed.len() >= 7 {
        Some(trimmed[..7].to_string())
    } else {
        None
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

fn decode_text_lossy(bytes: &[u8]) -> String {
    if bytes.is_empty() {
        return String::new();
    }
    if let Ok(decoded) = crate::decode_bytes_with_encoding(bytes, None) {
        decoded.content.replace("\r\n", "\n")
    } else {
        String::from_utf8_lossy(bytes).replace("\r\n", "\n")
    }
}

pub fn compute_unified_diff(old_text: &str, new_text: &str, rel_path: &str) -> (String, usize, usize) {
    let old_norm = old_text.replace("\r\n", "\n");
    let new_norm = new_text.replace("\r\n", "\n");
    let old_lines: Vec<&str> = if old_norm.is_empty() {
        Vec::new()
    } else {
        old_norm.lines().collect()
    };
    let new_lines: Vec<&str> = if new_norm.is_empty() {
        Vec::new()
    } else {
        new_norm.lines().collect()
    };

    if old_lines == new_lines {
        return (String::new(), 0, 0);
    }

    let mut prefix = 0usize;
    while prefix < old_lines.len()
        && prefix < new_lines.len()
        && old_lines[prefix] == new_lines[prefix]
    {
        prefix += 1;
    }

    let mut old_end = old_lines.len();
    let mut new_end = new_lines.len();
    while old_end > prefix
        && new_end > prefix
        && old_lines[old_end - 1] == new_lines[new_end - 1]
    {
        old_end -= 1;
        new_end -= 1;
    }

    let old_mid = &old_lines[prefix..old_end];
    let new_mid = &new_lines[prefix..new_end];

    #[derive(Clone, Copy, PartialEq, Eq)]
    enum EditOp {
        Keep,
        Del,
        Add,
    }

    let mut ops: Vec<(EditOp, &str)> = Vec::new();
    for &l in &old_lines[..prefix] {
        ops.push((EditOp::Keep, l));
    }

    if old_mid.len() * new_mid.len() <= 900_000 {
        let n = old_mid.len();
        let m = new_mid.len();
        let mut dp = vec![vec![0u32; m + 1]; n + 1];
        for i in (0..n).rev() {
            for j in (0..m).rev() {
                dp[i][j] = if old_mid[i] == new_mid[j] {
                    dp[i + 1][j + 1] + 1
                } else {
                    dp[i + 1][j].max(dp[i][j + 1])
                };
            }
        }
        let (mut i, mut j) = (0, 0);
        while i < n && j < m {
            if old_mid[i] == new_mid[j] {
                ops.push((EditOp::Keep, old_mid[i]));
                i += 1;
                j += 1;
            } else if dp[i + 1][j] >= dp[i][j + 1] {
                ops.push((EditOp::Del, old_mid[i]));
                i += 1;
            } else {
                ops.push((EditOp::Add, new_mid[j]));
                j += 1;
            }
        }
        while i < n {
            ops.push((EditOp::Del, old_mid[i]));
            i += 1;
        }
        while j < m {
            ops.push((EditOp::Add, new_mid[j]));
            j += 1;
        }
    } else {
        for &l in old_mid {
            ops.push((EditOp::Del, l));
        }
        for &l in new_mid {
            ops.push((EditOp::Add, l));
        }
    }

    for &l in &old_lines[old_end..] {
        ops.push((EditOp::Keep, l));
    }

    let mut additions = 0usize;
    let mut deletions = 0usize;
    for (op, _) in &ops {
        match op {
            EditOp::Add => additions += 1,
            EditOp::Del => deletions += 1,
            EditOp::Keep => {}
        }
    }

    let context = 3usize;
    let mut include = vec![false; ops.len()];
    for (idx, (op, _)) in ops.iter().enumerate() {
        if *op != EditOp::Keep {
            let start = idx.saturating_sub(context);
            let end = (idx + context + 1).min(ops.len());
            for flag in &mut include[start..end] {
                *flag = true;
            }
        }
    }

    let mut out = format!("--- a/{rel_path}\n+++ b/{rel_path}\n");
    let mut old_ln = 1usize;
    let mut new_ln = 1usize;
    let mut idx = 0usize;
    let max_diff_chars = 48_000usize;

    while idx < ops.len() {
        if !include[idx] {
            if ops[idx].0 != EditOp::Add {
                old_ln += 1;
            }
            if ops[idx].0 != EditOp::Del {
                new_ln += 1;
            }
            idx += 1;
            continue;
        }

        let hunk_start = idx;
        while idx < ops.len() && include[idx] {
            idx += 1;
        }
        let hunk_end = idx;

        let mut old_count = 0usize;
        let mut new_count = 0usize;
        for (op, _) in &ops[hunk_start..hunk_end] {
            if *op != EditOp::Add {
                old_count += 1;
            }
            if *op != EditOp::Del {
                new_count += 1;
            }
        }

        out.push_str(&format!(
            "@@ -{},{} +{},{} @@\n",
            if old_count == 0 { old_ln.saturating_sub(1) } else { old_ln },
            old_count,
            if new_count == 0 { new_ln.saturating_sub(1) } else { new_ln },
            new_count
        ));

        for (op, line) in &ops[hunk_start..hunk_end] {
            match op {
                EditOp::Keep => {
                    out.push(' ');
                    out.push_str(line);
                    out.push('\n');
                    old_ln += 1;
                    new_ln += 1;
                }
                EditOp::Del => {
                    out.push('-');
                    out.push_str(line);
                    out.push('\n');
                    old_ln += 1;
                }
                EditOp::Add => {
                    out.push('+');
                    out.push_str(line);
                    out.push('\n');
                    new_ln += 1;
                }
            }
            if out.len() > max_diff_chars {
                out.push_str("... [diff truncated]\n");
                return (out, additions, deletions);
            }
        }
    }

    (out, additions, deletions)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unified_diff_and_snapshot_roundtrip() {
        let tmp = std::env::temp_dir().join(format!(
            "onigiri_harness_snap_test_{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&tmp);
        let ws = tmp.join("ws");
        let snaps = tmp.join("snaps");
        fs::create_dir_all(&ws).unwrap();

        fs::write(ws.join("note.md"), "# Title\nHello\n").unwrap();
        let mut manifest = capture_baseline_snapshot(
            &snaps,
            "snap-1",
            &ws.to_string_lossy(),
            1000,
        )
        .unwrap();

        fs::write(ws.join("note.md"), "# Title\nHello World\nAdded line\n").unwrap();
        fs::write(ws.join("new.md"), "New doc\n").unwrap();

        let dirty = vec![ws.join("note.md").to_string_lossy().to_string()];
        let (changes, conflicts) = compute_turn_changes(&snaps, &mut manifest, &dirty);

        assert_eq!(changes.len(), 2);
        assert_eq!(conflicts.len(), 1);

        let reverted = revert_turn_changes(&snaps, "snap-1").unwrap();
        assert_eq!(reverted.len(), 2);
        assert_eq!(fs::read_to_string(ws.join("note.md")).unwrap(), "# Title\nHello\n");
        assert!(!ws.join("new.md").exists());

        let _ = fs::remove_dir_all(&tmp);
    }
}
