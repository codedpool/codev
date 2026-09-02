'use client';
// CodeMirror 6 editor bound to a Yjs document (one room per file, `${projectId}-${fileName}`) over
// y-websocket when NEXT_PUBLIC_COLLAB_URL is set; otherwise a plain local editor.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { yCollab, yUndoManagerKeymap } from 'y-codemirror.next';
import { unifiedMergeView, getChunks, getOriginalDoc, acceptChunk, rejectChunk, goToNextChunk } from '@codemirror/merge';
import { EditorState, Compartment, EditorSelection } from '@codemirror/state';
import {
  EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor,
  rectangularSelection, crosshairCursor, highlightActiveLine, placeholder,
} from '@codemirror/view';
import { defaultKeymap, indentWithTab, history, historyKeymap } from '@codemirror/commands';
import { foldGutter, indentOnInput, bracketMatching, foldKeymap, indentUnit } from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches, openSearchPanel } from '@codemirror/search';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { lintGutter, setDiagnostics } from '@codemirror/lint';
import { showMinimap } from '@replit/codemirror-minimap';
import { collabEnabled, createProvider, fileRoom } from '../collab/client';
import { languageFor } from './languages';
import { themeById } from './theme';
import { inlineSuggest } from './inlineSuggest';
import { colorFor } from '../lib/colors';

const SYNC_TIMEOUT_MS = 6000;

function foldMarker(open) {
  const el = document.createElement('span');
  el.className = 'cm-fold-marker';
  el.textContent = open ? '⌄' : '›';
  el.style.cssText = 'display:inline-block;width:12px;text-align:center;font-size:12px;line-height:1;cursor:pointer;';
  return el;
}

function minimapExt(enabled) {
  if (!enabled) return [];
  return showMinimap.compute(['doc'], () => ({
    create: () => ({ dom: document.createElement('div') }),
    displayText: 'blocks',
    showOverlay: 'mouse-over',
  }));
}

export default function CodeEditor({
  projectId,
  fileName,
  loadContent,
  settings,
  user,
  onReview,
  onChange,
  onLoaded,
  onCursor,
  onSyncStatus,
  onReady,
  onDestroy,
  fetchSuggestion,
  onSave,
}) {
  const [element, setElement] = useState(null);
  const collab = collabEnabled;
  const viewRef = useRef(null);
  const providerRef = useRef(null);
  const compartments = useRef({
    language: new Compartment(),
    theme: new Compartment(),
    wrap: new Compartment(),
    minimap: new Compartment(),
    tabSize: new Compartment(),
    lineNumbers: new Compartment(),
    merge: new Compartment(),
  });
  // Keep latest callbacks in refs so the (expensive) editor effect doesn't re-run when they change.
  const cb = useRef({});
  cb.current = { onChange, onLoaded, onCursor, onSyncStatus, onReady, onDestroy, fetchSuggestion, onSave, loadContent, settings, user, onReview };

  const ref = useCallback((node) => { if (node) setElement(node); }, []);

  // Keep the awareness "user" (name/colour shown on remote cursors) current — the profile may load after mount.
  const userName = user?.name;
  const userColor = user?.color;
  useEffect(() => {
    const provider = providerRef.current;
    if (!provider) return;
    const color = userColor || colorFor(userName || 'anon');
    provider.awareness.setLocalStateField('user', { name: userName || 'Guest', color, colorLight: color + '55' });
  }, [userName, userColor]);

  useEffect(() => {
    if (!element) return;
    const cmp = compartments.current;
    const s = cb.current.settings || {};

    // --- Yjs document + Liveblocks provider (per file room) ---
    const yDoc = new Y.Doc();
    const yText = yDoc.getText('codemirror');
    const undoManager = new Y.UndoManager(yText);
    let provider = null;
    if (collab) {
      provider = createProvider(fileRoom(projectId, fileName), yDoc);
      providerRef.current = provider;
      const u = cb.current.user || {};
      const color = u.color || colorFor(u.name || 'anon');
      provider.awareness.setLocalStateField('user', { name: u.name || 'Guest', color, colorLight: color + '55' });
      cb.current.onSyncStatus?.('connecting');
    } else {
      cb.current.onSyncStatus?.('local');
    }

    // --- Initial content: wait for the first sync so we never double-insert into a doc that already
    // has content from another collaborator; if sync never comes (offline), fall back after a timeout.
    let fetched = null;
    let synced = provider ? provider.synced : true;
    let inserted = false;
    let disposed = false;
    const applyInitial = () => {
      if (inserted || fetched == null || disposed) return;
      inserted = true;
      if (provider) {
        if (yText.length === 0 && fetched) yText.insert(0, fetched);
      } else if (viewRef.current && fetched) {
        const v = viewRef.current;
        v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: fetched } });
      }
    };
    Promise.resolve()
      .then(() => cb.current.loadContent?.())
      .then((content) => {
        if (disposed) return;
        fetched = content ?? '';
        cb.current.onLoaded?.(fetched);
        if (synced) applyInitial();
      })
      .catch(() => {
        if (disposed) return;
        fetched = '';
        cb.current.onLoaded?.(null);
      });
    const onSync = (isSynced) => {
      if (isSynced) {
        synced = true;
        applyInitial();
        cb.current.onSyncStatus?.('synced');
      }
    };
    provider?.on('sync', onSync);
    provider?.on('status', ({ status }) => { if (status === 'disconnected' && !disposed) cb.current.onSyncStatus?.('offline'); if (status === 'connected' && synced && !disposed) cb.current.onSyncStatus?.('synced'); });
    if (provider && synced) onSync(true);
    const timeout = setTimeout(() => {
      if (!synced && !disposed) {
        cb.current.onSyncStatus?.('offline');
        applyInitial();
      }
    }, SYNC_TIMEOUT_MS);

    // --- CodeMirror ---
    let reviewing = false;
    const reportReview = (state) => {
      const chunks = getChunks(state)?.chunks || [];
      cb.current.onReview?.({ active: reviewing, chunks: chunks.length });
    };
    const exitReview = () => {
      if (!reviewing) return;
      reviewing = false;
      view.dispatch({ effects: cmp.merge.reconfigure([]) });
      cb.current.onReview?.({ active: false, chunks: 0 });
    };
    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) cb.current.onChange?.(update.state.doc.toString());
      if (reviewing && update.docChanged) {
        const n = getChunks(update.state)?.chunks.length ?? 0;
        if (n === 0) queueMicrotask(exitReview);
        else cb.current.onReview?.({ active: true, chunks: n });
      }
      if (update.selectionSet || update.docChanged || update.focusChanged) {
        const st = update.state;
        const sel = st.selection.main;
        const line = st.doc.lineAt(sel.head);
        const selChars = Math.abs(sel.to - sel.from);
        const selLines = selChars ? st.doc.lineAt(sel.to).number - st.doc.lineAt(sel.from).number + 1 : 0;
        cb.current.onCursor?.({
          line: line.number,
          col: sel.head - line.from + 1,
          selChars,
          selLines,
          selections: st.selection.ranges.length,
          hasSelection: selChars > 0,
        });
      }
    });

    const state = EditorState.create({
      doc: yText.toString(),
      extensions: [
        cmp.lineNumbers.of(s.lineNumbers === false ? [] : lineNumbers()),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        foldGutter({ markerDOM: foldMarker }),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion({ activateOnTyping: true, icons: true }),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        lintGutter(),
        placeholder('Start typing, or press Ctrl+I to ask AI to write something here.'),
        keymap.of([
          { key: 'Mod-s', run: () => { cb.current.onSave?.(); return true; } },
          ...(provider ? yUndoManagerKeymap : historyKeymap),
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...foldKeymap,
          ...completionKeymap,
          indentWithTab,
        ]),
        cmp.language.of(languageFor(fileName)),
        cmp.theme.of(themeById(s.theme)),
        cmp.wrap.of(s.wordWrap ? EditorView.lineWrapping : []),
        cmp.minimap.of(minimapExt(s.minimap)),
        cmp.tabSize.of([EditorState.tabSize.of(s.tabSize || 4), indentUnit.of(' '.repeat(s.tabSize || 4))]),
        cmp.merge.of([]),
        inlineSuggest({
          fetch: (payload, signal) => cb.current.fetchSuggestion?.(payload, signal),
          enabled: () => !!cb.current.settings?.inlineAi && !!cb.current.fetchSuggestion,
          delay: 650,
          context: () => ({ fileName }),
        }),
        provider ? yCollab(yText, provider.awareness, { undoManager }) : history(),
        updateListener,
      ],
    });

    const view = new EditorView({ state, parent: element });
    viewRef.current = view;

    const api = {
      view,
      focus: () => view.focus(),
      getContent: () => view.state.doc.toString(),
      getSelectionText: () => {
        const sel = view.state.selection.main;
        return view.state.doc.sliceString(sel.from, sel.to);
      },
      getSelectionRange: () => {
        const sel = view.state.selection.main;
        return { from: sel.from, to: sel.to, empty: sel.empty };
      },
      getSelectionLines: () => {
        const sel = view.state.selection.main;
        return { from: view.state.doc.lineAt(sel.from).number, to: view.state.doc.lineAt(sel.to).number };
      },
      insertAtCursor: (text) => {
        const sel = view.state.selection.main;
        view.dispatch({ changes: { from: sel.head, insert: text }, selection: { anchor: sel.head + text.length }, scrollIntoView: true, userEvent: 'input.paste' });
        view.focus();
      },
      replaceSelection: (text) => {
        const sel = view.state.selection.main;
        view.dispatch({ changes: { from: sel.from, to: sel.to, insert: text }, selection: EditorSelection.range(sel.from, sel.from + text.length), scrollIntoView: true, userEvent: 'input.paste' });
        view.focus();
      },
      replaceRange: (from, to, text) => {
        view.dispatch({ changes: { from, to, insert: text }, selection: EditorSelection.range(from, from + text.length), scrollIntoView: true, userEvent: 'input.paste' });
        view.focus();
      },
      replaceAll: (text) => {
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, userEvent: 'input.paste' });
        view.focus();
      },
      selectionCoords: () => {
        const sel = view.state.selection.main;
        const head = view.coordsAtPos(sel.head);
        const start = view.coordsAtPos(sel.from);
        const end = view.coordsAtPos(sel.to);
        return { head, start, end };
      },
      revealLine: (n, col = 1) => {
        const line = view.state.doc.line(Math.max(1, Math.min(n, view.state.doc.lines)));
        const pos = Math.min(line.to, line.from + Math.max(0, col - 1));
        view.dispatch({ selection: { anchor: pos }, effects: EditorView.scrollIntoView(pos, { y: 'center' }) });
        view.focus();
      },
      selectRange: (from, to) => {
        view.dispatch({ selection: EditorSelection.range(from, to), effects: EditorView.scrollIntoView(from, { y: 'center' }) });
        view.focus();
      },
      openSearch: () => openSearchPanel(view),
      /** Show problems ({ line, severity, message }) as squiggles + gutter markers. */
      setDiagnostics: (items = []) => {
        const doc = view.state.doc;
        const diags = items
          .filter((p) => p.line && p.line >= 1 && p.line <= doc.lines)
          .map((p) => {
            const l = doc.line(p.line);
            const from = l.from + (l.text.length - l.text.trimStart().length);
            return { from, to: Math.max(from + 1, l.to), severity: p.severity === 'warning' ? 'warning' : p.severity === 'info' ? 'info' : 'error', message: p.message, source: p.source };
          });
        view.dispatch(setDiagnostics(view.state, diags));
      },
      /**
       * Cursor-style review: apply `text` over [from,to] (whole doc by default) but keep the previous version as
       * a unified diff with per-chunk accept/reject controls. Resolves when the user accepts/rejects everything.
       */
      previewChanges: (text, range) => {
        const original = view.state.doc.toString();
        const from = range?.from ?? 0;
        const to = range?.to ?? view.state.doc.length;
        reviewing = true;
        view.dispatch({
          changes: { from, to, insert: text },
          effects: cmp.merge.reconfigure(unifiedMergeView({ original, mergeControls: true, highlightChanges: true, gutter: true, syntaxHighlightDeletions: true })),
          userEvent: 'input.paste',
        });
        const n = getChunks(view.state)?.chunks.length ?? 0;
        if (n === 0) { exitReview(); return 0; }
        reportReview(view.state);
        try { goToNextChunk(view); } catch { /* ignore */ }
        return n;
      },
      isReviewing: () => reviewing,
      acceptAll: () => { exitReview(); view.focus(); },
      rejectAll: () => {
        if (!reviewing) return;
        const original = getOriginalDoc(view.state).toString();
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: original }, userEvent: 'input.paste' });
        exitReview();
        view.focus();
      },
      acceptChunkAt: (pos) => acceptChunk(view, pos),
      rejectChunkAt: (pos) => rejectChunk(view, pos),
      nextChunk: () => goToNextChunk(view),
      undoManager,
      yText,
    };
    cb.current.onReady?.(api);

    return () => {
      disposed = true;
      clearTimeout(timeout);
      provider?.off('sync', onSync);
      cb.current.onDestroy?.();
      view.destroy();
      viewRef.current = null;
      provider?.destroy();
      if (providerRef.current === provider) providerRef.current = null;
      yDoc.destroy();
    };
    // Re-create the editor only when the room/file changes.
  }, [element, collab, projectId, fileName]);

  // --- Live settings via compartments ---
  const { theme, wordWrap, minimap, tabSize, lineNumbers: showLines } = settings || {};
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const cmp = compartments.current;
    view.dispatch({
      effects: [
        cmp.theme.reconfigure(themeById(theme)),
        cmp.wrap.reconfigure(wordWrap ? EditorView.lineWrapping : []),
        cmp.minimap.reconfigure(minimapExt(minimap)),
        cmp.tabSize.reconfigure([EditorState.tabSize.of(tabSize || 4), indentUnit.of(' '.repeat(tabSize || 4))]),
        cmp.lineNumbers.reconfigure(showLines === false ? [] : lineNumbers()),
      ],
    });
  }, [theme, wordWrap, minimap, tabSize, showLines]);

  const style = {
    '--editor-font-size': `${settings?.fontSize || 13}px`,
    '--editor-line-height': settings?.lineHeight || 1.6,
    fontVariantLigatures: settings?.ligatures === false ? 'none' : 'contextual',
  };

  return <div ref={ref} className="cv-editor-host" style={style} />;
}
