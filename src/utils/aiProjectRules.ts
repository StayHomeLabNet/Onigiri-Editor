import { readWorkspaceFileIfExists, writeWorkspaceFile } from './platform';

const RULE_CANDIDATE_FILES = ['AGENTS.md', 'CLAUDE.md', '.onigiri-rules.md'] as const;
const MAX_RULE_CHARS = 8000;

export interface LoadedProjectAiRules {
  sourceFile: string;
  content: string;
  promptBlock: string;
}

/**
 * Loads project-level AI instructions from AGENTS.md, CLAUDE.md, or .onigiri-rules.md
 * in the workspace root (in priority order) when enabled.
 */
export async function loadWorkspaceAiRules(
  workspaceRoot: string | null | undefined,
  enabled = true
): Promise<LoadedProjectAiRules | null> {
  if (!enabled || !workspaceRoot) return null;
  for (const relPath of RULE_CANDIDATE_FILES) {
    try {
      const raw = await readWorkspaceFileIfExists(workspaceRoot, relPath);
      if (raw && raw.trim().length > 0) {
        const trimmed = raw.trim().slice(0, MAX_RULE_CHARS);
        return {
          sourceFile: relPath,
          content: trimmed,
          promptBlock: `# Project AI Rules (from ${relPath})\n${trimmed}`,
        };
      }
    } catch {
      // ignore unreadable candidate and try next
    }
  }
  return null;
}

/**
 * Appends a concise project AI rule to the existing rule file (AGENTS.md / CLAUDE.md / .onigiri-rules.md)
 * or creates AGENTS.md if none exists yet.
 */
export async function appendWorkspaceAiRule(
  workspaceRoot: string,
  ruleText: string,
  preferredFile?: 'AGENTS.md' | 'CLAUDE.md' | '.onigiri-rules.md'
): Promise<string> {
  const cleaned = ruleText.trim().replace(/\r\n/g, '\n');
  if (!cleaned) {
    throw new Error('Rule text is empty');
  }

  let targetFile: string = preferredFile ?? 'AGENTS.md';
  let existing: string | null = null;
  if (!preferredFile) {
    for (const candidate of RULE_CANDIDATE_FILES) {
      const content = await readWorkspaceFileIfExists(workspaceRoot, candidate);
      if (content !== null) {
        targetFile = candidate;
        existing = content;
        break;
      }
    }
  } else {
    existing = await readWorkspaceFileIfExists(workspaceRoot, targetFile);
  }

  const bulletLine = cleaned.includes('\n') ? cleaned : `- ${cleaned}`;
  const nextContent =
    existing && existing.trim().length > 0
      ? `${existing.replace(/\s+$/, '')}\n${bulletLine}\n`
      : `# Project AI Rules\n\n${bulletLine}\n`;

  await writeWorkspaceFile(workspaceRoot, targetFile, nextContent);
  return targetFile;
}
