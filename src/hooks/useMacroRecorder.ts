import { useCallback, useRef, useState } from 'react';
import type React from 'react';
import type { EditorHandle } from '../components/EditorPane';
import type { Translations } from '../i18n/types';
import type { ViewLayout } from '../types';
import {
  appendMacroStep,
  loadSavedMacroSteps,
  MAX_MACRO_STEPS,
  saveMacroSteps,
  type MacroStep,
} from '../utils/macro';

interface UseMacroRecorderParams {
  t: Translations;
  layout: ViewLayout;
  setLayout: React.Dispatch<React.SetStateAction<ViewLayout>>;
  activePaneRef: React.MutableRefObject<'code' | 'visual'>;
  setActivePane: React.Dispatch<React.SetStateAction<'code' | 'visual'>>;
  editorRef: React.MutableRefObject<EditorHandle | null>;
  notify: (msg: string) => void;
}

export function useMacroRecorder({
  t,
  layout,
  setLayout,
  activePaneRef,
  setActivePane,
  editorRef,
  notify,
}: UseMacroRecorderParams) {
  const [macroSteps, setMacroSteps] = useState<MacroStep[]>(() => loadSavedMacroSteps());
  const [recordingMacroSteps, setRecordingMacroSteps] = useState<MacroStep[]>([]);
  const [isRecordingMacro, setIsRecordingMacro] = useState(false);
  const [isPlayingMacro, setIsPlayingMacro] = useState(false);

  const isRecordingMacroRef = useRef(false);
  isRecordingMacroRef.current = isRecordingMacro;
  const isPlayingMacroRef = useRef(false);
  isPlayingMacroRef.current = isPlayingMacro;
  const recordingMacroStepsRef = useRef<MacroStep[]>([]);
  const macroStepsRef = useRef<MacroStep[]>(macroSteps);
  macroStepsRef.current = macroSteps;
  const executeToolbarActionRef = useRef<(action: string, fromMacro?: boolean) => Promise<void>>(
    async () => {}
  );

  const resetMacroState = useCallback(() => {
    setIsRecordingMacro(false);
    isRecordingMacroRef.current = false;
    setRecordingMacroSteps([]);
    recordingMacroStepsRef.current = [];
    setMacroSteps([]);
    macroStepsRef.current = [];
    saveMacroSteps([]);
  }, []);

  const handleRecordMacroStep = useCallback(
    (step: MacroStep) => {
      if (!isRecordingMacroRef.current || isPlayingMacroRef.current) return;
      const { steps: next, truncated } = appendMacroStep(
        recordingMacroStepsRef.current,
        step,
        MAX_MACRO_STEPS
      );
      recordingMacroStepsRef.current = next;
      setRecordingMacroSteps(next);
      if (truncated) {
        isRecordingMacroRef.current = false;
        setIsRecordingMacro(false);
        setMacroSteps(next);
        macroStepsRef.current = next;
        saveMacroSteps(next);
        notify(t.toasts.macroStepLimit.replace('{n}', String(MAX_MACRO_STEPS)));
      }
    },
    [notify, t.toasts.macroStepLimit]
  );

  const handleToggleMacroRecording = useCallback(() => {
    if (isPlayingMacroRef.current) return;
    if (!isRecordingMacroRef.current) {
      recordingMacroStepsRef.current = [];
      setRecordingMacroSteps([]);
      isRecordingMacroRef.current = true;
      setIsRecordingMacro(true);
      if (layout === 'preview') {
        setLayout('split');
      }
      activePaneRef.current = 'code';
      setActivePane('code');
      requestAnimationFrame(() => editorRef.current?.focus());
      notify(t.toasts.macroRecordStarted);
      return;
    }

    isRecordingMacroRef.current = false;
    setIsRecordingMacro(false);
    const recorded = recordingMacroStepsRef.current;
    if (recorded.length > 0) {
      setMacroSteps(recorded);
      macroStepsRef.current = recorded;
      saveMacroSteps(recorded);
      notify(t.toasts.macroRecordStopped.replace('{n}', String(recorded.length)));
    } else {
      notify(t.toasts.macroRecordEmpty);
    }
  }, [
    layout,
    setLayout,
    activePaneRef,
    setActivePane,
    editorRef,
    notify,
    t.toasts.macroRecordStarted,
    t.toasts.macroRecordStopped,
    t.toasts.macroRecordEmpty,
  ]);

  const handleClearMacro = useCallback(() => {
    if (isRecordingMacroRef.current) {
      isRecordingMacroRef.current = false;
      setIsRecordingMacro(false);
    }
    recordingMacroStepsRef.current = [];
    setRecordingMacroSteps([]);
    setMacroSteps([]);
    macroStepsRef.current = [];
    saveMacroSteps([]);
    notify(t.toasts.macroCleared);
  }, [notify, t.toasts.macroCleared]);

  const handlePlayMacro = useCallback(async () => {
    if (isRecordingMacroRef.current || isPlayingMacroRef.current) return;
    const steps = macroStepsRef.current;
    if (steps.length === 0) {
      notify(t.toasts.macroNoRecorded);
      return;
    }

    isPlayingMacroRef.current = true;
    setIsPlayingMacro(true);
    try {
      if (layout === 'preview') {
        setLayout('split');
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => window.setTimeout(resolve, 0));
        });
      }
      activePaneRef.current = 'code';
      setActivePane('code');
      editorRef.current?.focus();

      for (const step of steps) {
        if (step.type === 'toolbarAction') {
          await executeToolbarActionRef.current(step.action, true);
        } else {
          await editorRef.current?.runMacroStep(step);
        }
      }
      notify(t.toasts.macroPlayed.replace('{n}', String(steps.length)));
    } finally {
      isPlayingMacroRef.current = false;
      setIsPlayingMacro(false);
    }
  }, [layout, setLayout, activePaneRef, setActivePane, editorRef, notify, t.toasts.macroNoRecorded, t.toasts.macroPlayed]);

  return {
    macroSteps,
    recordingMacroSteps,
    isRecordingMacro,
    isPlayingMacro,
    isRecordingMacroRef,
    executeToolbarActionRef,
    resetMacroState,
    handleRecordMacroStep,
    handleToggleMacroRecording,
    handleClearMacro,
    handlePlayMacro,
  };
}
