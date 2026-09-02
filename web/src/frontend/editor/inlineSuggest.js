// Inline AI suggestions ("ghost text") for CodeMirror 6.
// Debounces typing, asks the backend for a completion, renders it as grey text
// after the cursor. Tab accepts, Escape dismisses, any edit/cursor move clears.
import { StateEffect, StateField, Prec, Facet } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType, keymap } from '@codemirror/view';

const setSuggestion = StateEffect.define();
const clearSuggestion = StateEffect.define();

/** Config facet: { fetch: async ({prefix, suffix, ...}) => string, enabled: () => boolean, delay: number, context: () => object } */
export const inlineSuggestConfig = Facet.define({
  combine: (values) => values[0] || { fetch: null, enabled: () => false, delay: 700, context: () => ({}) },
});

class GhostWidget extends WidgetType {
  constructor(text) {
    super();
    this.text = text;
  }
  eq(other) {
    return other.text === this.text;
  }
  toDOM() {
    const wrap = document.createElement('span');
    wrap.className = 'cm-ghost-text';
    wrap.setAttribute('aria-hidden', 'true');
    const lines = this.text.split('\n');
    lines.forEach((line, i) => {
      const span = document.createElement('span');
      span.textContent = line;
      if (i > 0) span.className = 'cm-ghost-text-block';
      wrap.appendChild(span);
      if (i === 0) {
        const hint = document.createElement('span');
        hint.className = 'cm-ghost-hint';
        hint.textContent = 'Tab';
        wrap.appendChild(hint);
      }
    });
    return wrap;
  }
  ignoreEvent() {
    return false;
  }
}

const suggestionField = StateField.define({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setSuggestion)) return e.value;
      if (e.is(clearSuggestion)) return null;
    }
    if (value && (tr.docChanged || tr.selection)) return null;
    return value;
  },
  provide: (f) =>
    EditorView.decorations.from(f, (s) => {
      if (!s) return Decoration.none;
      return Decoration.set([Decoration.widget({ widget: new GhostWidget(s.text), side: 1 }).range(s.pos)]);
    }),
});

function stripFences(text = '') {
  // A leading newline is meaningful (the model wants to continue on the next line): keep it.
  const leadingNewline = /^[ \t]*\r?\n/.test(text);
  let t = text.trim();
  const m = t.match(/^```[a-zA-Z0-9_+-]*\n([\s\S]*?)\n?```$/);
  if (m) t = m[1];
  t = t.replace(/^```[a-zA-Z0-9_+-]*\n?/, '').replace(/\n?```$/, '');
  t = t.replace(/\r/g, '');
  return leadingNewline && t ? '\n' + t : t;
}

/** Remove any leading portion that merely repeats the text before the cursor. */
function dedupePrefix(suggestion, prefix) {
  const lastLine = prefix.slice(prefix.lastIndexOf('\n') + 1);
  const trimmedLast = lastLine.trimStart();
  if (trimmedLast && suggestion.startsWith(trimmedLast)) return suggestion.slice(trimmedLast.length);
  if (lastLine && suggestion.startsWith(lastLine)) return suggestion.slice(lastLine.length);
  return suggestion;
}

const suggestPlugin = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.view = view;
      this.timer = null;
      this.controller = null;
      this.lastRequestPos = -1;
    }
    update(update) {
      const cfg = update.view.state.facet(inlineSuggestConfig);
      if (!cfg.fetch) return;
      const userTyped = update.transactions.some((tr) => tr.isUserEvent('input.type') || tr.isUserEvent('delete'));
      if (update.docChanged && userTyped) this.schedule(cfg);
      else if (update.selectionSet && !update.docChanged) this.cancel();
      else if (update.docChanged) this.cancel();
    }
    schedule(cfg) {
      this.cancel();
      if (!cfg.enabled()) return;
      this.timer = setTimeout(() => this.request(cfg), cfg.delay || 700);
    }
    cancel() {
      clearTimeout(this.timer);
      this.timer = null;
      if (this.controller) {
        this.controller.abort();
        this.controller = null;
      }
    }
    async request(cfg) {
      const view = this.view;
      if (!view.hasFocus) return;
      const state = view.state;
      const sel = state.selection.main;
      if (!sel.empty) return;
      const pos = sel.head;
      const line = state.doc.lineAt(pos);
      // Only suggest at end of a line with some content on it or an indented empty line
      if (pos !== line.to) return;
      const before = state.doc.sliceString(Math.max(0, pos - 2500), pos);
      const after = state.doc.sliceString(pos, Math.min(state.doc.length, pos + 600));
      if (!before.trim()) return;
      const controller = new AbortController();
      this.controller = controller;
      this.lastRequestPos = pos;
      try {
        const raw = await cfg.fetch({ prefix: before, suffix: after, ...cfg.context() }, controller.signal);
        if (controller.signal.aborted) return;
        let text = dedupePrefix(stripFences(raw || ''), before);
        // Trim to a sensible size: max 6 lines
        text = text.split('\n').slice(0, 6).join('\n').replace(/\s+$/, '');
        if (!text.trim()) return;
        const cur = view.state.selection.main;
        if (!cur.empty || cur.head !== pos) return;
        view.dispatch({ effects: setSuggestion.of({ text, pos }) });
      } catch {
        /* aborted or failed: stay silent */
      } finally {
        if (this.controller === controller) this.controller = null;
      }
    }
    destroy() {
      this.cancel();
    }
  }
);

export function acceptSuggestion(view) {
  const s = view.state.field(suggestionField, false);
  if (!s) return false;
  view.dispatch({
    changes: { from: s.pos, insert: s.text },
    selection: { anchor: s.pos + s.text.length },
    effects: clearSuggestion.of(null),
    userEvent: 'input.complete',
  });
  return true;
}
export function dismissSuggestion(view) {
  const s = view.state.field(suggestionField, false);
  if (!s) return false;
  view.dispatch({ effects: clearSuggestion.of(null) });
  return true;
}
export function hasSuggestion(state) {
  return !!state.field(suggestionField, false);
}

const suggestKeymap = Prec.highest(
  keymap.of([
    { key: 'Tab', run: acceptSuggestion },
    { key: 'Escape', run: dismissSuggestion },
  ])
);

export function inlineSuggest(config) {
  return [inlineSuggestConfig.of(config), suggestionField, suggestPlugin, suggestKeymap];
}
