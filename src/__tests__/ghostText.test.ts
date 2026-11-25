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
});
