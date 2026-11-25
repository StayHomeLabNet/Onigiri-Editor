import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  acceptGhostTextCommand,
  createGhostTextExtension,
  dismissGhostTextCommand,
  ghostTextField,
  setGhostTextEffect,
} from '../components/editor/cmGhostText';
import { formatAiErrorHint } from '../utils/aiErrorHint';

function createTestView(doc: string, anchor: number): EditorView {
  const state = EditorState.create({
    doc,
    selection: { anchor },
    extensions: [createGhostTextExtension()],
  });
  return new EditorView({ state });
}

describe('cmGhostText extension', () => {
  it('displays, accepts with Tab, and clears ghost text', () => {
    const view = createTestView('Hello world', 11);
    view.dispatch({
      effects: setGhostTextEffect.of({ pos: 11, text: ' from Onigiri' }),
    });
    expect(view.state.field(ghostTextField)).toEqual({
      pos: 11,
      text: ' from Onigiri',
    });

    const accepted = acceptGhostTextCommand(view);
    expect(accepted).toBe(true);
    expect(view.state.doc.toString()).toBe('Hello world from Onigiri');
    expect(view.state.selection.main.head).toBe(24);
    expect(view.state.field(ghostTextField)).toBeNull();
    view.destroy();
  });

  it('dismisses ghost text with Escape or cursor/doc change', () => {
    const view = createTestView('Markdown test', 13);
    view.dispatch({
      effects: setGhostTextEffect.of({ pos: 13, text: ' suggestion' }),
    });
    expect(dismissGhostTextCommand(view)).toBe(true);
    expect(view.state.field(ghostTextField)).toBeNull();

    view.dispatch({
      effects: setGhostTextEffect.of({ pos: 13, text: ' another' }),
    });
    expect(view.state.field(ghostTextField)).not.toBeNull();
    view.dispatch({ selection: { anchor: 5 } });
    expect(view.state.field(ghostTextField)).toBeNull();
    view.destroy();
  });

  it('does not insert loading placeholder on Tab and formats AI error hints', () => {
    const view = createTestView('Markdown test', 13);
    view.dispatch({
      effects: setGhostTextEffect.of({ pos: 13, text: ' …', loading: true }),
    });
    expect(acceptGhostTextCommand(view)).toBe(false);
    expect(view.state.doc.toString()).toBe('Markdown test');
    expect(dismissGhostTextCommand(view)).toBe(true);
    expect(view.state.field(ghostTextField)).toBeNull();
    view.destroy();

    const cliHint = formatAiErrorHint(new Error('Codex CLI (`codex`) was not found on PATH'), 'codex-cli', true);
    expect(cliHint.hint).toContain('codex-cli');
    const authHint = formatAiErrorHint(new Error('401 Unauthorized'), 'openai-api', false);
    expect(authHint.hint).toContain('Settings → AI');
  });
});
