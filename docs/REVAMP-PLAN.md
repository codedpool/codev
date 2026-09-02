# Codev — Revamp Plan: an AI-native browser IDE with VS Code fundamentals

_Last updated: 2026-08-17_

## 0. Where we are (honest baseline)

The UI redesign shipped a real IDE shell (tabs, explorer, terminal panel, AI panel, palette, presence). Underneath, several capabilities are still thin or simulated:

| Area | Today | Gap |
| --- | --- | --- |
| Editing | CodeMirror 6, custom theme, fold/bracket/search, minimap, go-to-line/symbol (regex) | No language intelligence (no real completions, hover, go-to-def, rename), no formatter, no snippets, single editor group, no diff view, no light theme |
| AI completion | Ghost text via Groq chat model, debounce 650 ms | Chat model is not a fill-in-the-middle (FIM) model → mediocre, slow (~1–2 s), no caching/telemetry |
| AI chat | Streaming chat with file/selection context, quick actions, Apply/Insert/Replace | Whole-file "Apply" only (no diff/hunk review), no multi-file edits, no workspace context (@file, symbols, embeddings), no history persistence, no agent/tool loop |
| Run | JDoodle one-shot execution (4 langs), stdin, output parsing | No interactive process/PTY, no packages, no ports/preview, ~1 s cold start, no debugger |
| Files | Flat S3 keys; folders are client-side virtual; rename = copy+delete | No server-side rename/move/list-tree, no binary files, no size limits |
| VCS | "Changes" = unsaved files | No git at all |
| Collaboration | Liveblocks public key, Yjs per file, presence room | No auth on rooms, no roles/permissions, no comments |
| Backend | Express, no auth middleware, no rate limits | Any caller can read/write any project by id |
| Quality | Manual Playwright QA against a mock backend | No CI, no unit/e2e suites in repo |

## 1. North star

**"Cursor-class AI on top of VS Code-class fundamentals, in a tab, with live collaboration."**

Product pillars, in priority order:

1. **Editor you trust** — fast, VS Code muscle memory, real language intelligence.
2. **AI that edits, not just chats** — completions that feel instant, edits reviewed as diffs, workspace-aware context, an agent that can run and fix.
3. **A real runtime** — interactive terminal, packages, ports, tests.
4. **Team-ready** — auth, permissions, git, share links that just work.

## 2. Target architecture

```
Browser (React + CodeMirror 6)
├── Editor core        CM6 + extensions (LSP client, diff/merge, snippets, formatting, multi-group layout)
├── AI client          completion engine (FIM, cache, telemetry) · chat/edits (structured diffs) · agent UI
├── Terminal           xterm.js ↔ WebSocket PTY
├── Collab             Yjs over self-hosted Hocuspocus (WebSocket in the backend), awareness = presence, comments
└── State              WorkspaceContext (existing) → split into stores (files, editors, ai, run, collab)

Backend (Node) — becomes 3 services (can start as one process, split later)
├── API                Express: auth (Auth0 JWT), projects/files v2 (tree, rename, move), settings sync, share/roles
├── AI gateway         provider abstraction (Groq primary; optional BYO OpenAI/Anthropic/Ollama), FIM-style completions + chat + tools,
│                      workspace indexer (symbols + embeddings), prompt/context builder, streaming, budgets
└── Workspace runtime  per-project sandbox (Docker/Firecracker; gVisor) exposing: PTY (WS), file sync, LSP gateway (WS),
                       run/test tasks, port forwarding; JDoodle kept as zero-infra fallback

Storage: Mongo (projects, users, chats, settings) · S3 (files snapshot) · Redis (sessions, rate limits, completion cache)
```

Key decisions to make early (each has a cheap default and an ambitious option):

| Decision | Cheap default (this month) | Ambitious (later) |
| --- | --- | --- |
| Completions model | **Groq `llama-3.1-8b-instant`** with a strict FIM-style prompt (prefix/suffix, code-only), cached + debounced | Self-hosted StarCoder2/Qwen2.5-Coder with vLLM (true FIM) |
| Chat/edit model | **Groq** — `llama-3.3-70b-versatile` (existing) for chat/edits; larger Groq models (e.g. Llama 4 Maverick / GPT-OSS-120B, per current catalog) for hard edits and the agent loop | Same, plus BYO keys (OpenAI/Anthropic) and local Ollama |
| Language servers | Server-side processes per language behind one WS gateway (tsserver, pyright, clangd, jdtls) | Per-workspace container hosts the LSPs |
| Runtime | **WebContainers** (JS/TS in-browser) + **Pyodide** (Python in-browser) for instant, free execution; JDoodle for C++/Java | Docker/Firecracker sandbox per workspace with PTY, packages, ports |
| Git | **isomorphic-git** in the browser over the file API (commit/branch/diff local), GitHub OAuth for push/pull | Server-side git in the sandbox |
| Collab | **Self-hosted Hocuspocus** in the Node backend: `onAuthenticate` (Auth0 JWT + project role), `onStoreDocument` → S3 via existing file save; frontend swaps `LiveblocksYjsProvider` for `HocuspocusProvider`; env: `VITE_COLLAB_URL` only | Redis extension for horizontal scale; PartyKit if you want hosted |

## 2b. Decisions: AI provider and multi-language runtime

### AI — Groq only (free tier), no paid vendors required

| Job | Choice | Notes |
| --- | --- | --- |
| Chat, edits, quick actions | **Groq `llama-3.3-70b-versatile`** (already integrated) — streaming | Ask for edits as structured search/replace blocks (JSON mode) so the client can render diff hunks. |
| Agent mode / hard multi-file edits | **Groq's strongest current model** (e.g. Llama 4 Maverick or GPT-OSS-120B — check the live catalog) with **Groq function calling** for read/search/write/run tools, approval gates on writes/runs | Same OpenAI-compatible request shape, so it's a model-id switch. |
| Inline ghost-text completions | **Groq `llama-3.1-8b-instant`** with a strict FIM-style prompt: prefix + suffix in tags, "output only the inserted code", 1–6 lines, stop sequences | Groq has no true FIM model, but the 8B model is fast enough (~150–300 ms) for ghost text if we debounce (~400 ms), cache by (file, prefix-hash), cancel in-flight requests and cap output tokens. |
| Explain / docs / tests | `llama-3.3-70b-versatile` | Existing endpoints stay; route through the same gateway. |
| Embeddings for `@file` / semantic context (Phase 2) | **Local, free**: `@xenova/transformers` (e.g. `bge-small-en`) running in the backend or a web worker; no API cost | Groq doesn't offer embeddings; symbol/keyword search first, embeddings later. |
| Optional BYO | OpenAI / Anthropic / Ollama behind the same provider abstraction | Off by default; only if a user supplies a key. |

**Living within the free tier:** Groq's free tier has per-model requests/tokens-per-minute limits, so the gateway must add (a) a completion cache and debounce, (b) per-user throttling with a friendly "slow down" state in the UI, (c) small `max_tokens` for completions, (d) prompt trimming (send the selection or a window around the cursor, not the whole project), and (e) graceful fallback to a smaller model on 429. Upgrade to Groq's paid Dev tier later only if usage demands it. Rough cost today: **$0**.

### Runtime for many languages

| Step | Choice | Gets you |
| --- | --- | --- |
| Now (≈1 day) | **Self-hosted Judge0 (or Piston)** replacing JDoodle; keep JDoodle as fallback | 60+ languages, stdin, compile errors, time/memory limits — same save→run→output contract the UI already uses |
| Phase 4a | **WebContainers** (Node/npm/TS + dev-server port preview) + **Pyodide** (Python + micropip) in-browser | Instant, free, offline JS/TS & Python; WebContainers needs a commercial license for paid products |
| Phase 4b | **Sandbox per workspace**: E2B / Fly Machines / Modal / Daytona, or self-hosted Docker+gVisor / Firecracker; PTY over WebSocket → xterm.js | Real interactive terminal, package installs, ports, tests, later DAP debugger; per-second compute, idle shutdown, paid tier |

## 3. Roadmap (phased, each phase ships something usable)

### Phase 0 — Foundations (≈1 week)
- Backend **auth**: verify Auth0 JWT on every route; project ownership + membership model (`owner | editor | viewer`); share tokens for links.
- **File API v2**: `GET /projects/:id/tree`, `POST /files/rename`, `POST /files/move`, `POST /folders`, size limits, ETag/If-Match on save (conflict detection). Keep old routes working.
- Config & ops: `.env` validation on boot, structured logging, rate limits (AI + run), request ids, error tracking.
- Quality: Vitest for lib/hooks, Playwright e2e using the existing mock backend, GitHub Actions (lint + build + e2e).
- Split `WorkspaceContext` into focused stores (files, editors, run, ai, layout) with the same public API.

### Phase 1 — VS Code fundamentals in the editor (≈2 weeks)
- **Split editors** (2 groups, drag tab to split), **diff editor** (`@codemirror/merge`) for AI edits & git.
- **Snippets** (VS Code snippet JSON format, per language) + tab stops.
- **Formatting**: Prettier in a web worker (JS/TS/CSS/JSON/MD/HTML); Black/clang-format/google-java-format via the AI-gateway host; format-on-save setting.
- Bracket-pair colorization, indentation guides, sticky scroll, whitespace rendering, column ruler, word-based completion improvements.
- **Outline view** (from LSP later; regex now), **light theme** + high-contrast, font/zoom settings, per-language settings.
- **Keybindings editor** (`keybindings.json`-style, VS Code defaults), settings sync to server, recent projects, workspace templates.
- Editor performance pass: large files (virtualized minimap off > 20k lines), lazy-load languages, code-split routes.

### Phase 2 — AI v2: edits as diffs, better completions, context (≈2–3 weeks)
- **Provider abstraction** in the AI gateway (Groq first): `complete(fim)`, `chat(stream)`, `edit(structured)`, `embed()`; routing table by task/model; per-user throttling & rate-limit-aware fallbacks.
- **Completions engine**: FIM-style prompting on Groq `llama-3.1-8b-instant`, prefix/suffix windows, multi-line, request cancellation, LRU cache keyed by (file, prefix hash), suggestion telemetry (shown/accepted/latency), "next-edit" prediction after acceptance, per-language enable, `Alt+]` cycle.
- **Structured edits**: model returns search/replace blocks or unified diff → applied as a **hunk-level diff review** inside the editor (accept/reject per hunk, keyboard `Ctrl+Y/N`), multi-file edit sets with a review panel, one undo group. Replace today's whole-file "Apply".
- **Context**: `@file`, `@folder`, `@symbol`, `@problems`, `@terminal`, `@git` mentions; workspace **indexer** (symbols via LSP/tree-sitter, embeddings for semantic retrieval); auto-context ranking; token budget display.
- **Inline edit (Ctrl+I) v2**: renders as in-editor diff, follow-up prompts, "explain change".
- Chat persistence per project, threads, share a chat, regenerate with a different model.
- Guardrails: never send secrets (`.env` filter), redact tokens, opt-out per project.

### Phase 3 — Language intelligence via LSP (≈2–3 weeks)
- **LSP gateway**: WebSocket multiplexer that spawns/pools language servers per project (`typescript-language-server`, `pyright`, `clangd`, `jdtls`), syncs open buffers (Yjs → LSP `didChange`), workspace files mounted from S3 snapshot.
- **CM6 LSP client**: completions (with snippets/auto-import), hover, signature help, diagnostics (replaces regex problems), go-to-definition/references, rename symbol, document symbols (outline, palette `@`), code actions/quick fixes, format.
- Problems panel fed by LSP + runtime; "Fix with AI" gets the exact diagnostic + range.

### Phase 4 — Real runtime & terminal (≈2–3 weeks)
- **Terminal**: xterm.js with tabs/splits, links, search, themes; WS PTY protocol.
- **In-browser runtimes first**: WebContainers (Node/npm, dev servers with port preview) and Pyodide (Python + micropip); C++/Java stay on JDoodle until sandboxes exist.
- **Sandbox service** (opt-in per plan): container per workspace (gVisor/Firecracker), file sync both ways, `Run`/`Test`/custom tasks (`tasks.json`), port forwarding with preview pane, resource limits/timeouts, idle shutdown.
- Test explorer (pytest/jest discovery + run + inline results), coverage gutter later.
- Debugger via **DAP** (debugpy, node inspector) — breakpoints, variables, call stack — after the sandbox exists.

### Phase 5 — Git & GitHub (≈2 weeks)
- isomorphic-git over File API v2: init/clone/commit/branch/checkout/stash, status → real SCM view, inline diff gutters (added/modified/deleted), blame, history view, conflict resolution UI (3-way merge editor).
- GitHub OAuth: import repo, push/pull, open PRs (later: review PRs in Codev with AI summaries).

### Phase 6 — Collaboration v2 (≈1–2 weeks)
- Hocuspocus rooms with roles (owner/editor/viewer, read-only enforced server-side), invite by email with real emails, presence in terminal/panels, **comments/threads** anchored to code ranges, follow mode, activity feed, "AI as a participant" (shared AI thread).

### Phase 7 — Agent & platform (ongoing)
- **Agent mode**: tool loop (read/search files, propose edits, run tests, read terminal) with step-by-step approval and rollback; task templates ("add a feature", "fix failing tests", "write docs").
- Extension points: command/keybinding contributions, themes, custom snippets, webhooks; marketplace later.
- PWA/offline for local mode, mobile-friendly review flows, telemetry dashboards, billing tiers (free: in-browser runtimes + capped AI; pro: sandboxes + premium models).

## 4. Quick wins for this week (no infra needed)
1. Backend JWT auth + rate limits (closes the open-API hole).
2. `rename`/`move`/`tree` endpoints; drop client-side copy+delete rename.
3. Move completions to Groq `llama-3.1-8b-instant` with a strict FIM-style prompt + cache + cancellation + telemetry (much faster than the current 70B chat call).
4. AI edits as diff review (`@codemirror/merge`) instead of whole-file Apply.
5. Prettier format-on-save (worker), snippets, bracket-pair colors, light theme.
6. Split editors + diff view; recent projects on the dashboard.

## 5. Success metrics
- Completion: p50 latency < 400 ms, acceptance rate > 25 %.
- Editor: keystroke → paint < 16 ms on 5k-line files; open file < 300 ms.
- AI edits: > 60 % of accepted edits applied without manual fix-up.
- Run: JS/Python "Run" < 1 s warm (in-browser runtimes).
- Reliability: zero data-loss incidents (ETag conflicts + Yjs), e2e suite green on every PR.

## 6. Risks & mitigations
- **Sandbox cost/complexity** → start with in-browser runtimes; sandboxes behind a paid tier.
- **LSP resource use** → pool servers, idle shutdown, start with TS + Python only.
- **AI free-tier rate limits** → small model for completions, caching/debounce, per-user throttling, model fallback on 429; BYO keys optional.
- **Backend auth breaking shared links** → share tokens with roles; existing links keep working via viewer role.
- **Scope creep** → each phase ends with a demoable, shippable increment; agent/debugger deliberately last.
