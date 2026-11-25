import type { AiProviderId } from '../types';

export interface AiErrorInfo {
  message: string;
  hint: string | null;
}

/**
 * Normalizes raw AI provider errors into a concise message plus an actionable troubleshooting hint.
 */
export function formatAiErrorHint(
  err: unknown,
  provider: AiProviderId,
  isJa: boolean
): AiErrorInfo {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const message = raw.trim() || (isJa ? '不明なエラーが発生しました' : 'Unknown AI error');
  const lower = message.toLowerCase();

  if (lower.includes('not found on path') || lower.includes('enoent') || lower.includes('command not found')) {
    return {
      message,
      hint: isJa
        ? `CLI（${provider}）が見つかりません。設定 → AI でセットアップするか、別のプロバイダーへ切り替えてください。`
        : `CLI (${provider}) was not found on PATH. Set it up in Settings → AI or switch providers.`,
    };
  }
  if (lower.includes('api key') || lower.includes('unauthorized') || lower.includes('401') || lower.includes('403') || lower.includes('login') || lower.includes('auth')) {
    return {
      message,
      hint: isJa
        ? '認証または API キーが未設定／無効の可能性があります。設定 → AI で API キーまたは CLI ログイン状態を確認してください。'
        : 'Authentication or API key may be missing/invalid. Check your API key or CLI login status in Settings → AI.',
    };
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return {
      message,
      hint: isJa
        ? '応答がタイムアウトしました。ネットワーク状態や選択中モデルの負荷を確認して再試行してください。'
        : 'The request timed out. Check your network connection or model load and try again.',
    };
  }
  if (lower.includes('connection refused') || lower.includes('econnrefused') || lower.includes('ollama') || lower.includes('lmstudio')) {
    return {
      message,
      hint: isJa
        ? 'ローカル AI サーバーに接続できません。Ollama / LM Studio が起動しているか設定 → AI の URL と合わせて確認してください。'
        : 'Cannot reach the local AI server. Make sure Ollama / LM Studio is running and verify the URL in Settings → AI.',
    };
  }
  if (provider === 'apple-foundation-models') {
    return {
      message,
      hint: isJa
        ? 'Apple Intelligence が有効（macOS 26+）か、システム設定と「設定 → AI」を確認してください。'
        : 'Verify Apple Intelligence is enabled (macOS 26+) in System Settings and Settings → AI.',
    };
  }

  return {
    message,
    hint: isJa
      ? '「設定 → AI」で使用中のプロバイダーやモデル設定を確認してください。'
      : 'Check your active provider and model settings in Settings → AI.',
  };
}
