import { useCallback, useRef, useState } from 'react';
import type React from 'react';
import type { EditorHandle } from '../components/EditorPane';
import type { AiSendPreviewRequest } from '../components/AiSendPreviewModal';
import type { Translations } from '../i18n/types';
import type {
  AiCustomButton,
  AiCustomSubmenuItem,
  AiProviderConfig,
  DocumentTab,
  EditorSettings,
  Locale,
} from '../types';
import {
  cleanAiCustomResponse,
  expandAiPromptVariables,
  hasClipboardVariable,
  resolveAiProviderCallOptions,
} from '../utils/aiCustomButtons';
import {
  cancelAiChat,
  listenAiChatProgress,
  readClipboardText,
  sendAiChat,
  writeClipboardText,
} from '../utils/platform';
import { formatAiErrorHint } from '../utils/aiErrorHint';
import { loadWorkspaceAiRules } from '../utils/aiProjectRules';
import { buildAiMemoryPromptBlock } from '../utils/aiMemory';
import { appendAiAuditEntry } from '../utils/aiAuditLog';

interface UseAiCustomRunnerParams {
  t: Translations;
  locale: Locale;
  activeTab: DocumentTab;
  aiConfig: AiProviderConfig;
  settingsRef: React.MutableRefObject<EditorSettings>;
  tabsRef: React.MutableRefObject<DocumentTab[]>;
  activeTabIdRef: React.MutableRefObject<string>;
  sideTabIdRef: React.MutableRefObject<string | null>;
  editorRef: React.MutableRefObject<EditorHandle | null>;
  sideEditorRef: React.MutableRefObject<EditorHandle | null>;
  workspaceRootRef: React.MutableRefObject<string | null>;
  detectedLanguageIdRef: React.MutableRefObject<string | null>;
  isSideEditorActive: () => boolean;
  updateTabContentById: (tabId: string, content: string) => void;
  setAiSendPreviewRequest: React.Dispatch<React.SetStateAction<AiSendPreviewRequest | null>>;
  notify: (msg: string) => void;
}

export function useAiCustomRunner({
  t,
  locale,
  activeTab,
  aiConfig,
  settingsRef,
  tabsRef,
  activeTabIdRef,
  sideTabIdRef,
  editorRef,
  sideEditorRef,
  workspaceRootRef,
  detectedLanguageIdRef,
  isSideEditorActive,
  updateTabContentById,
  setAiSendPreviewRequest,
  notify,
}: UseAiCustomRunnerParams) {
  const [runningAiCustom, setRunningAiCustom] = useState<{
    buttonId: string;
    label: string;
  } | null>(null);
  const aiCustomRequestRef = useRef<{
    requestId: string;
    buttonId: string;
    buttonName: string;
    cancelled: boolean;
  } | null>(null);

  const handleCancelAiCustom = useCallback(() => {
    const active = aiCustomRequestRef.current;
    if (!active) return;
    active.cancelled = true;
    aiCustomRequestRef.current = null;
    setRunningAiCustom(null);
    void cancelAiChat(active.requestId).catch(() => {});
    notify(t.toasts.aiCustomCancelled.replace('{name}', active.buttonName));
  }, [notify, t.toasts.aiCustomCancelled]);

  const handleRunAiCustomButton = useCallback(
    async (
      button: AiCustomButton | AiCustomSubmenuItem,
      parentButtonId?: string
    ) => {
      if (aiCustomRequestRef.current) return;
      const toolbarButtonId = parentButtonId ?? button.id;
      const fallbackName =
        parentButtonId && parentButtonId !== button.id
          ? t.settingsModal.aiCustom.submenuDefaultName
          : t.settingsModal.aiCustom.defaultButtonName;
      const buttonName = button.name.trim() || fallbackName;
      const rawPromptText = button.prompt.trim();
      if (!rawPromptText) {
        notify(t.toasts.aiCustomEmptyPrompt.replace('{name}', buttonName));
        return;
      }
      if (!button.copyToClipboard && !button.replaceContent) {
        notify(t.toasts.aiCustomNoOutputTarget.replace('{name}', buttonName));
        return;
      }

      const sideActive =
        isSideEditorActive() && Boolean(sideEditorRef.current) && Boolean(sideTabIdRef.current);
      const targetTabId =
        sideActive && sideTabIdRef.current ? sideTabIdRef.current : activeTabIdRef.current;
      const targetTab = tabsRef.current.find((tb) => tb.id === targetTabId) ?? activeTab;
      const targetEditor = sideActive ? sideEditorRef.current : editorRef.current;

      const range = targetEditor?.getSelectionRange() ?? null;
      const selectedText = targetEditor?.getSelectedText() ?? '';
      const liveDocText = targetEditor ? targetEditor.getText() : targetTab.content;
      const hasSelection = Boolean(range && range.from < range.to && selectedText.length > 0);
      const inputText = hasSelection ? selectedText : liveDocText;
      const captureFrom = hasSelection && range ? range.from : 0;
      const captureTo = hasSelection && range ? range.to : liveDocText.length;

      let clipboardText = '';
      if (hasClipboardVariable(rawPromptText)) {
        try {
          clipboardText = (await readClipboardText()) || '';
        } catch {
          clipboardText = '';
        }
      }
      const promptText = expandAiPromptVariables(rawPromptText, {
        selection: selectedText,
        clipboard: clipboardText,
        fileName: targetTab.title,
        filePath: targetTab.filePath ?? '',
        language: targetTab.languageOverride ?? detectedLanguageIdRef.current ?? 'markdown',
      });

      const callOpts = resolveAiProviderCallOptions(
        aiConfig,
        button.aiProvider,
        button.aiModel
      );
      const projectRules = await loadWorkspaceAiRules(
        workspaceRootRef.current,
        settingsRef.current.aiProjectRulesEnabled ?? true
      );
      const pinnedMemory = buildAiMemoryPromptBlock(
        workspaceRootRef.current,
        settingsRef.current.aiMemoryEnabled ?? true
      );
      const systemParts = [
        'You are an AI assistant invoked from a custom toolbar button inside a Markdown editor.',
        'Follow the user instruction faithfully and return ONLY the resulting text.',
        'Do not add explanations, greetings, <input_text> tags, or surrounding Markdown code fences unless explicitly asked.',
      ];
      if (pinnedMemory) {
        systemParts.push(pinnedMemory);
      }
      if (projectRules) {
        systemParts.push(projectRules.promptBlock);
      }
      const systemPrompt = systemParts.join('\n\n');
      const hasSelectionPlaceholder = /\{\{\s*selection\s*\}\}/i.test(rawPromptText);
      const shouldAppendInputBlock =
        inputText.length > 0 && !(hasSelection && hasSelectionPlaceholder);
      let userPrompt = shouldAppendInputBlock
        ? `${promptText}\n\n# 入力テキスト (Input Text)\n<input_text>\n${inputText}\n</input_text>`
        : promptText;

      if (settingsRef.current.aiSendPreviewEnabled) {
        const confirmedPayload = await new Promise<string | null>((resolve) => {
          setAiSendPreviewRequest({
            title: buttonName,
            providerLabel: callOpts.provider,
            modelLabel: callOpts.model || 'default',
            scopeLabel: hasSelection
              ? locale === 'ja'
                ? `選択範囲 (${selectedText.length} 文字)`
                : `Selection (${selectedText.length} chars)`
              : locale === 'ja'
                ? `文書全体 (${liveDocText.length} 文字)`
                : `Full Document (${liveDocText.length} chars)`,
            payloadText: userPrompt,
            onConfirm: (finalText) => resolve(finalText),
            onCancel: () => resolve(null),
          });
        });
        if (confirmedPayload === null) {
          return;
        }
        userPrompt = confirmedPayload;
      }

      const requestId = `ai-custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const reqState = {
        requestId,
        buttonId: toolbarButtonId,
        buttonName,
        cancelled: false,
      };
      aiCustomRequestRef.current = reqState;
      setRunningAiCustom({ buttonId: toolbarButtonId, label: buttonName });
      notify(t.toasts.aiCustomRunning.replace('{name}', buttonName));
      const startedAt = Date.now();
      let lastProgressNotifyAt = 0;
      const unlistenProgress = await listenAiChatProgress((ev) => {
        if (ev.requestId !== requestId || reqState.cancelled) return;
        const now = Date.now();
        if (now - lastProgressNotifyAt > 3500) {
          lastProgressNotifyAt = now;
          const line = ev.text.trim().split(/\r?\n/).pop()?.trim().slice(0, 60);
          if (line) {
            notify(`${buttonName} (${ev.elapsedSecs}s): ${line}`);
          }
        }
      });

      try {
        const res = await sendAiChat({
          requestId,
          provider: callOpts.provider,
          model: callOpts.model,
          apiKey: callOpts.apiKey,
          baseUrl: callOpts.baseUrl,
          customCliCmd: callOpts.customCliCmd,
          systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
          workspaceDir: workspaceRootRef.current,
          allowWorkspaceWrite: false,
        });

        if (reqState.cancelled) return;
        const resultText = cleanAiCustomResponse(res.content, inputText, promptText);
        appendAiAuditEntry(
          {
            source: 'custom-button',
            label: buttonName,
            provider: callOpts.provider,
            model: res.modelUsed || callOpts.model,
            promptPreview: userPrompt,
            responsePreview: resultText,
            durationMs: Date.now() - startedAt,
            applied: Boolean(button.replaceContent && resultText.trim()),
          },
          settingsRef.current.aiAuditLogEnabled ?? true
        );
        if (!resultText.trim()) {
          notify(t.toasts.aiCustomEmptyResponse.replace('{name}', buttonName));
          return;
        }

        if (button.copyToClipboard) {
          await writeClipboardText(resultText);
        }

        if (button.replaceContent) {
          const stillOnSide =
            sideActive &&
            Boolean(sideEditorRef.current) &&
            sideTabIdRef.current === targetTabId;
          const stillOnMain =
            !sideActive &&
            Boolean(editorRef.current) &&
            activeTabIdRef.current === targetTabId;
          const liveEditor = stillOnSide
            ? sideEditorRef.current
            : stillOnMain
              ? editorRef.current
              : null;

          if (liveEditor) {
            if (hasSelection) {
              liveEditor.replaceRange(captureFrom, captureTo, resultText, {
                selectResult: true,
              });
            } else {
              const latestDocLen =
                tabsRef.current.find((tb) => tb.id === targetTabId)?.content.length ?? captureTo;
              liveEditor.replaceRange(0, latestDocLen, resultText, {
                selectResult: false,
              });
            }
          } else {
            const latestTab = tabsRef.current.find((tb) => tb.id === targetTabId);
            if (latestTab) {
              const nextContent = hasSelection
                ? latestTab.content.slice(0, captureFrom) +
                  resultText +
                  latestTab.content.slice(captureTo)
                : resultText;
              updateTabContentById(targetTabId, nextContent);
            }
          }
        }

        if (button.replaceContent && button.copyToClipboard) {
          notify(t.toasts.aiCustomReplacedAndCopied.replace('{name}', buttonName));
        } else if (button.replaceContent) {
          notify(t.toasts.aiCustomReplaced.replace('{name}', buttonName));
        } else if (button.copyToClipboard) {
          notify(t.toasts.aiCustomCopied.replace('{name}', buttonName));
        }
      } catch (err) {
        if (reqState.cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === 'CLI_CANCELLED') return;
        appendAiAuditEntry(
          {
            source: 'custom-button',
            label: buttonName,
            provider: callOpts.provider,
            model: callOpts.model,
            promptPreview: userPrompt,
            responsePreview: '',
            durationMs: Date.now() - startedAt,
            error: msg,
          },
          settingsRef.current.aiAuditLogEnabled ?? true
        );
        const info = formatAiErrorHint(err, callOpts.provider, locale === 'ja');
        notify(`${t.toasts.errorPrefix} ${info.message}${info.hint ? ` — ${info.hint}` : ''}`);
      } finally {
        unlistenProgress();
        if (aiCustomRequestRef.current?.requestId === requestId) {
          aiCustomRequestRef.current = null;
          setRunningAiCustom(null);
        }
      }
    },
    [
      activeTab,
      aiConfig,
      locale,
      settingsRef,
      tabsRef,
      activeTabIdRef,
      sideTabIdRef,
      editorRef,
      sideEditorRef,
      workspaceRootRef,
      detectedLanguageIdRef,
      isSideEditorActive,
      setAiSendPreviewRequest,
      notify,
      t.gitPanel.noAiProviderToast,
      t.settingsModal.aiCustom.defaultButtonName,
      t.settingsModal.aiCustom.submenuDefaultName,
      t.toasts.aiCustomCopied,
      t.toasts.aiCustomEmptyPrompt,
      t.toasts.aiCustomEmptyResponse,
      t.toasts.aiCustomNoOutputTarget,
      t.toasts.aiCustomReplaced,
      t.toasts.aiCustomReplacedAndCopied,
      t.toasts.aiCustomRunning,
      t.toasts.errorPrefix,
      updateTabContentById,
    ]
  );

  return {
    runningAiCustom,
    handleCancelAiCustom,
    handleRunAiCustomButton,
  };
}
