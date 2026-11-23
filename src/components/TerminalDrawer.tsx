import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Sparkles, Square, Terminal, Trash2, X } from 'lucide-react';
import type { Locale } from '../types';
import {
  isTauri,
  listenTerminalExit,
  listenTerminalOutput,
  terminalKillCommand,
  terminalRunCommand,
} from '../utils/platform';

interface TerminalLine {
  id: string;
  kind: 'cmd' | 'stdout' | 'stderr' | 'meta';
  text: string;
}

interface TerminalDrawerProps {
  open: boolean;
  locale: Locale;
  initialCwd: string | null;
  onAskAi?: (errorSnippet: string) => void;
  onClose: () => void;
}

const MAX_LINES = 600;

export const TerminalDrawer: React.FC<TerminalDrawerProps> = ({
  open,
  locale,
  initialCwd,
  onAskAi,
  onClose,
}) => {
  const ja = locale === 'ja';
  const [cwd, setCwd] = useState<string>(initialCwd || '');
  const [input, setInput] = useState('');
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const [lastExitCode, setLastExitCode] = useState<number | null>(null);

  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const runningIdRef = useRef<string | null>(null);
  runningIdRef.current = runningId;

  useEffect(() => {
    if (initialCwd && !cwd) {
      setCwd(initialCwd);
    }
  }, [initialCwd, cwd]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  const appendLines = useCallback((newItems: TerminalLine[]) => {
    setLines((prev) => {
      const merged = [...prev, ...newItems];
      return merged.length > MAX_LINES ? merged.slice(merged.length - MAX_LINES) : merged;
    });
  }, []);

  useEffect(() => {
    const el = outputRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [lines]);

  useEffect(() => {
    if (!isTauri()) return;
    let unlistenOut: (() => void) | null = null;
    let unlistenExit: (() => void) | null = null;

    void listenTerminalOutput((ev) => {
      if (ev.runId !== runningIdRef.current) return;
      appendLines([
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          kind: ev.stream === 'stderr' ? 'stderr' : 'stdout',
          text: ev.chunk,
        },
      ]);
    }).then((fn) => {
      unlistenOut = fn;
    });

    void listenTerminalExit((ev) => {
      if (ev.runId !== runningIdRef.current) return;
      setRunningId(null);
      setLastExitCode(ev.exitCode);
      if (ev.cwd) setCwd(ev.cwd);
      appendLines([
        {
          id: `${Date.now()}-exit`,
          kind: 'meta',
          text: ev.cancelled
            ? ja
              ? '⏹ コマンドを中断しました'
              : '⏹ Command cancelled'
            : ev.exitCode === 0
              ? ja
                ? '✓ 完了 (exit 0)'
                : '✓ Done (exit 0)'
              : `✕ Exit code ${ev.exitCode}`,
        },
      ]);
    }).then((fn) => {
      unlistenExit = fn;
    });

    return () => {
      unlistenOut?.();
      unlistenExit?.();
    };
  }, [appendLines, ja]);

  const runCurrentCommand = useCallback(async () => {
    const cmd = input.trim();
    if (!cmd || runningId) return;

    if (cmd === 'clear' || cmd === 'cls') {
      setLines([]);
      setInput('');
      return;
    }

    setInput('');
    setHistory((prev) => [cmd, ...prev.filter((h) => h !== cmd)].slice(0, 60));
    setHistoryIdx(-1);
    setLastExitCode(null);

    appendLines([
      {
        id: `${Date.now()}-cmd`,
        kind: 'cmd',
        text: `$ ${cmd}`,
      },
    ]);

    if (!isTauri()) {
      appendLines([
        {
          id: `${Date.now()}-notauri`,
          kind: 'stderr',
          text: ja
            ? '統合ターミナルはデスクトップ版（Tauri）でのみ利用できます。'
            : 'Integrated terminal is only available in the desktop app.',
        },
      ]);
      return;
    }

    const runId = `term-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setRunningId(runId);

    try {
      const res = await terminalRunCommand(runId, cmd, cwd || initialCwd);
      if (res.cwd) setCwd(res.cwd);
      if (res.immediateExitCode !== undefined && res.immediateExitCode !== null) {
        setRunningId(null);
        setLastExitCode(res.immediateExitCode);
        if (res.immediateOutput) {
          appendLines([
            { id: `${Date.now()}-imm`, kind: 'stdout', text: res.immediateOutput },
          ]);
        }
      }
    } catch (err) {
      setRunningId(null);
      setLastExitCode(1);
      appendLines([
        {
          id: `${Date.now()}-err`,
          kind: 'stderr',
          text: err instanceof Error ? err.message : String(err),
        },
      ]);
    }
  }, [input, runningId, cwd, initialCwd, appendLines, ja]);

  const handleStop = useCallback(async () => {
    if (!runningId) return;
    await terminalKillCommand(runningId);
  }, [runningId]);

  const handleAskAiErrors = useCallback(() => {
    if (!onAskAi) return;
    const recent = lines
      .slice(-40)
      .map((l) => l.text)
      .join('\n')
      .trim();
    if (!recent) return;
    onAskAi(recent);
  }, [lines, onAskAi]);

  if (!open) return null;

  const hasErrorOutput =
    (lastExitCode !== null && lastExitCode !== 0) || lines.some((l) => l.kind === 'stderr');

  return (
    <section className="terminal-drawer" aria-label={ja ? '統合ターミナル' : 'Integrated Terminal'}>
      <div className="terminal-drawer-header">
        <div className="terminal-drawer-title">
          <Terminal size={13} />
          <span>{ja ? 'ターミナル' : 'Terminal'}</span>
          {cwd && (
            <span className="terminal-cwd" data-tooltip={cwd}>
              {cwd}
            </span>
          )}
        </div>
        <div className="terminal-drawer-actions">
          {hasErrorOutput && onAskAi && (
            <button
              type="button"
              className="terminal-mini-btn is-accent"
              onClick={handleAskAiErrors}
              data-tooltip={ja ? '直近のエラー出力をAIチャットで原因解析' : 'Ask AI to diagnose recent terminal error'}
            >
              <Sparkles size={12} />
              <span>{ja ? 'AIで解析' : 'Ask AI'}</span>
            </button>
          )}
          {runningId && (
            <button
              type="button"
              className="terminal-mini-btn is-danger"
              onClick={() => void handleStop()}
              data-tooltip={ja ? '実行中のコマンドを停止' : 'Stop running command'}
            >
              <Square size={11} />
              <span>{ja ? '停止' : 'Stop'}</span>
            </button>
          )}
          <button
            type="button"
            className="icon-btn-sm"
            onClick={() => setLines([])}
            data-tooltip={ja ? '出力をクリア' : 'Clear output'}
            aria-label={ja ? '出力をクリア' : 'Clear output'}
          >
            <Trash2 size={13} />
          </button>
          <button
            type="button"
            className="icon-btn-sm"
            onClick={onClose}
            data-tooltip={ja ? 'ターミナルを閉じる' : 'Close terminal'}
            aria-label={ja ? 'ターミナルを閉じる' : 'Close terminal'}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="terminal-output" ref={outputRef}>
        {lines.length === 0 ? (
          <div className="terminal-empty">
            {ja
              ? 'コマンドを入力して Enter で実行（例: git status, npm test, ls）。↑ / ↓ で履歴を呼び出せます。'
              : 'Type a shell command and press Enter (e.g. git status, npm test, ls). Use ↑ / ↓ for history.'}
          </div>
        ) : (
          lines.map((line) => (
            <div key={line.id} className={`terminal-line is-${line.kind}`}>
              {line.text}
            </div>
          ))
        )}
      </div>

      <form
        className="terminal-input-row"
        onSubmit={(e) => {
          e.preventDefault();
          void runCurrentCommand();
        }}
      >
        <span className="terminal-prompt">$</span>
        <input
          ref={inputRef}
          type="text"
          className="terminal-input"
          value={input}
          disabled={Boolean(runningId)}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              if (history.length === 0) return;
              const next = Math.min(historyIdx + 1, history.length - 1);
              setHistoryIdx(next);
              setInput(history[next] ?? '');
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              if (historyIdx <= 0) {
                setHistoryIdx(-1);
                setInput('');
              } else {
                const next = historyIdx - 1;
                setHistoryIdx(next);
                setInput(history[next] ?? '');
              }
            } else if (e.key === 'c' && (e.ctrlKey || e.metaKey) && runningId) {
              e.preventDefault();
              void handleStop();
            }
          }}
          placeholder={
            runningId
              ? ja
                ? '実行中...（停止ボタンで中断）'
                : 'Running... (click Stop to interrupt)'
              : ja
                ? 'コマンドを入力...'
                : 'Enter command...'
          }
        />
        <button
          type="submit"
          className="terminal-run-btn"
          disabled={Boolean(runningId) || !input.trim()}
          data-tooltip={ja ? '実行 (Enter)' : 'Run (Enter)'}
          aria-label={ja ? '実行' : 'Run'}
        >
          <Play size={12} />
        </button>
      </form>
    </section>
  );
};
