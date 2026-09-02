'use client';
// AI assistant state: conversation, streaming, quick actions and inline edits.
// Uses the new streaming /api/ai/chat endpoint and falls back to the original
// lint / generate-docs / generate-snippet endpoints when it is unavailable.
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import * as api from '../../lib/api';
import { errorMessage } from '../../lib/api';
import { languageLabel, extOf } from '../../lib/fileTypes';
import { useWorkspace } from '../WorkspaceContext';

const AiCtx = createContext(null);
const MAX_CONTEXT_CHARS = 14000;
let n = 0;
const uid = () => `m${Date.now().toString(36)}${(n++).toString(36)}`;

export const QUICK_ACTIONS = [
  { id: 'fix', label: 'Fix errors', prompt: 'Find bugs, syntax errors or runtime errors in this code and provide the corrected code. Briefly explain each fix.' },
  { id: 'explain', label: 'Explain', prompt: 'Explain what this code does, step by step. Be concise and precise.' },
  { id: 'refactor', label: 'Refactor', prompt: 'Refactor this code for readability, structure and maintainability without changing its behaviour. Return the full refactored code in one code block.' },
  { id: 'tests', label: 'Write tests', prompt: 'Write unit tests for this code using the idiomatic testing framework for the language. Cover edge cases. Return the tests in one code block.' },
  { id: 'docs', label: 'Docs', prompt: 'Add documentation comments / docstrings to this code. Return the documented code in one code block.' },
];

export function stripFences(text = '') {
  const t = text.trim();
  const m = t.match(/^```[\w+-]*\s*\n([\s\S]*?)\n?```\s*$/);
  if (m) return m[1];
  // if there is any code block, take the first
  const first = t.match(/```[\w+-]*\s*\n([\s\S]*?)\n?```/);
  if (first) return first[1];
  return t;
}

export function AiProvider({ children }) {
  const ws = useWorkspace();
  const { activeTab, contentsRef, editorRef, problems, setLayout, log } = ws;
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef(null);

  const buildContext = useCallback(
    (opts = {}) => {
      const file = opts.file ?? activeTab;
      const ed = editorRef.current;
      const selection = opts.selection ?? (ed && ed.getSelectionText ? ed.getSelectionText() : '');
      const full = file ? contentsRef.current.get(file) ?? (ed?.getContent?.() || '') : '';
      const useSel = !!selection && selection.trim().length > 0 && opts.preferSelection !== false;
      let code = useSel ? selection : full;
      let truncated = false;
      if (code.length > MAX_CONTEXT_CHARS) { code = code.slice(0, MAX_CONTEXT_CHARS); truncated = true; }
      const lines = ed && useSel ? ed.getSelectionLines?.() : null;
      return {
        fileName: file || null,
        language: file ? languageLabel(file) : null,
        ext: file ? extOf(file) : null,
        code,
        isSelection: useSel,
        selectionLines: lines ? { from: lines.from, to: lines.to } : null,
        truncated,
        problems: opts.includeProblems ? problems.slice(-5).map((p) => `${p.file}${p.line ? `:${p.line}` : ''}: ${p.message}`) : undefined,
      };
    },
    [activeTab, contentsRef, editorRef, problems]
  );

  const updateMessage = useCallback((id, patch) => {
    setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, ...(typeof patch === 'function' ? patch(m) : patch) } : m)));
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  /** Core send: pushes a user message and streams the assistant reply. */
  const send = useCallback(
    async (text, opts = {}) => {
      const content = (text || '').trim();
      if (!content || busy) return;
      setLayout({ aiOpen: true });
      const context = buildContext(opts);
      const userMsg = { id: uid(), role: 'user', content, context: { fileName: context.fileName, isSelection: context.isSelection, selectionLines: context.selectionLines, action: opts.action }, ts: Date.now() };
      const asstMsg = { id: uid(), role: 'assistant', content: '', streaming: true, ts: Date.now(), action: opts.action };
      setMessages((ms) => [...ms, userMsg, asstMsg]);
      setBusy(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));
      const outgoing = [...history, { role: 'user', content }];
      log('info', `AI request${opts.action ? ` (${opts.action})` : ''}${context.fileName ? ` · ${context.fileName}` : ''}`);
      try {
        await api.aiChatStream(
          { messages: outgoing, context },
          {
            signal: ctrl.signal,
            onToken: (chunk) => updateMessage(asstMsg.id, (m) => ({ content: m.content + chunk })),
          }
        );
        updateMessage(asstMsg.id, { streaming: false });
      } catch (e) {
        if (ctrl.signal.aborted) {
          updateMessage(asstMsg.id, (m) => ({ streaming: false, content: m.content || '', stopped: true }));
        } else {
          // Legacy fallback for the original endpoints when /chat is missing.
          const legacy = await legacyFallback(opts.action, context, content).catch(() => null);
          if (legacy) updateMessage(asstMsg.id, { streaming: false, content: legacy, legacy: true });
          else {
            updateMessage(asstMsg.id, { streaming: false, error: errorMessage(e, 'AI request failed') });
            log('error', `AI request failed: ${errorMessage(e)}`);
          }
        }
      } finally {
        abortRef.current = null;
        setBusy(false);
      }
    },
    [busy, buildContext, messages, setLayout, updateMessage, log]
  );

  const runAction = useCallback(
    (actionId, extra = {}) => {
      const a = QUICK_ACTIONS.find((x) => x.id === actionId);
      if (!a) return;
      let prompt = a.prompt;
      if (actionId === 'fix' && problems.length) prompt += `\n\nThe last run reported:\n${problems.slice(-5).map((p) => `- ${p.file}${p.line ? `:${p.line}` : ''}: ${p.message}`).join('\n')}`;
      if (extra.prompt) prompt = extra.prompt;
      return send(prompt, { action: actionId, includeProblems: actionId === 'fix', ...extra });
    },
    [send, problems]
  );

  const clear = useCallback(() => { stop(); setMessages([]); }, [stop]);

  const retry = useCallback(
    (assistantId) => {
      const idx = messages.findIndex((m) => m.id === assistantId);
      const userMsg = idx > 0 ? messages[idx - 1] : null;
      if (!userMsg) return;
      setMessages((ms) => ms.filter((m) => m.id !== assistantId && m.id !== userMsg.id));
      setTimeout(() => send(userMsg.content, { action: userMsg.context?.action }), 0);
    },
    [messages, send]
  );

  /** Inline edit / generation: returns code only (no chat message). */
  const requestCode = useCallback(
    async (instruction, { code, fileName, signal } = {}) => {
      const context = buildContext({ file: fileName, selection: code, preferSelection: !!code });
      const prompt = code
        ? `Modify the following ${context.language || ''} code according to this instruction: "${instruction}".\nReturn ONLY the complete replacement code in a single fenced code block. No explanations.`
        : `Write ${context.language || ''} code for: "${instruction}".\nReturn ONLY the code in a single fenced code block, no explanations.`;
      try {
        const out = await api.aiChatStream({ messages: [{ role: 'user', content: prompt }], context: { ...context, mode: 'code-only' } }, { signal });
        return stripFences(out).replace(/\r/g, '');
      } catch (e) {
        if (signal?.aborted) throw e;
        // fallback to legacy snippet endpoint
        const snippet = await api.aiSnippet(code ? `${instruction}\n\nCode:\n${code}` : instruction);
        return stripFences(snippet || '');
      }
    },
    [buildContext]
  );

  const value = useMemo(
    () => ({ messages, busy, send, stop, clear, retry, runAction, requestCode, buildContext, actions: QUICK_ACTIONS }),
    [messages, busy, send, stop, clear, retry, runAction, requestCode, buildContext]
  );
  return <AiCtx.Provider value={value}>{children}</AiCtx.Provider>;
}

async function legacyFallback(action, context, content) {
  const code = context.code || '';
  if (action === 'fix' || (!action && /fix|error|bug/i.test(content) && code)) return api.aiLint(code);
  if (action === 'docs') return api.aiDocs(code);
  if (!code || !action) return api.aiSnippet(content);
  return null;
}

export function useAi() {
  const ctx = useContext(AiCtx);
  if (!ctx) throw new Error('useAi must be used inside AiProvider');
  return ctx;
}
