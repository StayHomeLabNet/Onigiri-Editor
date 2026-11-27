import type { AiProviderId } from '../types';
import { detectAndRedactSecrets } from './aiPrivacy';

export const AI_AUDIT_LOG_STORAGE_KEY = 'onigiri-markdown.ai-audit-log.v1';
const MAX_AUDIT_ENTRIES = 80;
const AUDIT_EVENT_NAME = 'onigiri:ai-audit-log-updated';

export type AiAuditSource = 'chat' | 'inline-edit' | 'custom-button' | 'review' | 'harness';

export interface AiAuditEntry {
  id: string;
  timestamp: number;
  source: AiAuditSource;
  label?: string;
  provider: AiProviderId;
  model?: string;
  promptPreview: string;
  responsePreview: string;
  durationMs: number;
  applied?: boolean;
  error?: string;
}

function clampPreview(text: string, maxLen = 1200): string {
  const { redactedText } = detectAndRedactSecrets(text || '');
  return redactedText.length > maxLen ? `${redactedText.slice(0, maxLen)}…` : redactedText;
}

export function loadAiAuditLog(): AiAuditEntry[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(AI_AUDIT_LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_AUDIT_ENTRIES) as AiAuditEntry[];
  } catch {
    return [];
  }
}

export function appendAiAuditEntry(
  input: Omit<AiAuditEntry, 'id' | 'timestamp'> & { timestamp?: number },
  enabled = true
): AiAuditEntry | null {
  if (!enabled || typeof localStorage === 'undefined') return null;
  const entry: AiAuditEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: input.timestamp ?? Date.now(),
    source: input.source,
    label: input.label,
    provider: input.provider,
    model: input.model,
    promptPreview: clampPreview(input.promptPreview),
    responsePreview: clampPreview(input.responsePreview),
    durationMs: Math.max(0, Math.round(input.durationMs)),
    applied: input.applied,
    error: input.error ? clampPreview(input.error, 400) : undefined,
  };
  try {
    const prev = loadAiAuditLog();
    const next = [entry, ...prev].slice(0, MAX_AUDIT_ENTRIES);
    localStorage.setItem(AI_AUDIT_LOG_STORAGE_KEY, JSON.stringify(next));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(AUDIT_EVENT_NAME));
    }
  } catch {
    // ignore storage quota errors
  }
  return entry;
}

export function clearAiAuditLog(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(AI_AUDIT_LOG_STORAGE_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(AUDIT_EVENT_NAME));
    }
  } catch {
    // ignore
  }
}

export function subscribeAiAuditLog(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(AUDIT_EVENT_NAME, listener);
  return () => window.removeEventListener(AUDIT_EVENT_NAME, listener);
}
