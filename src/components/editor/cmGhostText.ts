import { Prec, StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, keymap, WidgetType } from '@codemirror/view';

export interface GhostTextSuggestion {
  pos: number;
  text: string;
}

export const setGhostTextEffect = StateEffect.define<GhostTextSuggestion | null>();

class GhostTextWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }

  eq(other: GhostTextWidget): boolean {
    return other.text === this.text;
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-ai-ghost-text';
    span.textContent = this.text;
    span.setAttribute('aria-hidden', 'true');
    return span;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

export const ghostTextField = StateField.define<GhostTextSuggestion | null>({
  create: () => null,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setGhostTextEffect)) {
        return effect.value;
      }
    }
    if (tr.docChanged || tr.selection) {
      return null;
    }
    return value;
  },
  provide: (field) =>
    EditorView.decorations.from(field, (suggestion): DecorationSet => {
      if (!suggestion || !suggestion.text) return Decoration.none;
      const widget = Decoration.widget({
        widget: new GhostTextWidget(suggestion.text),
        side: 1,
      });
      return Decoration.set([widget.range(suggestion.pos)]);
    }),
});

export function acceptGhostTextCommand(view: EditorView): boolean {
  const suggestion = view.state.field(ghostTextField, false);
  if (!suggestion || !suggestion.text) return false;
  const cursor = view.state.selection.main.head;
  if (cursor !== suggestion.pos || !view.state.selection.main.empty) return false;

  view.dispatch({
    changes: { from: suggestion.pos, to: suggestion.pos, insert: suggestion.text },
    selection: { anchor: suggestion.pos + suggestion.text.length },
    effects: setGhostTextEffect.of(null),
  });
  return true;
}

export function dismissGhostTextCommand(view: EditorView): boolean {
  const suggestion = view.state.field(ghostTextField, false);
  if (!suggestion) return false;
  view.dispatch({ effects: setGhostTextEffect.of(null) });
  return true;
}

export function createGhostTextExtension(): Extension {
  return [
    ghostTextField,
    Prec.highest(
      keymap.of([
        { key: 'Tab', run: acceptGhostTextCommand },
        { key: 'Escape', run: dismissGhostTextCommand },
      ])
    ),
  ];
}
