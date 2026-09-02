# Codev — Collaborative Code Editor <>

Codev is a browser IDE with a VS Code–grade editor, an AI pair programmer running on Groq, one-key code execution, project/file management on MongoDB + S3, and optional real-time collaboration.

The app is a single **Next.js** project in [`web/`](web/) (App Router, React 19) with **Clerk** authentication and API route handlers — no separate backend process is required.


---

## Features

- **IDE-grade editor** — CodeMirror 6, "Codev Dark" theme, tabs, breadcrumbs, minimap, folding, bracket matching, find/replace, go-to-line/symbol, gutter diagnostics.
- **AI assistant (Groq, with Gemini fallback)** — streaming chat that knows the open file/selection, quick actions (Fix errors, Explain, Refactor, Write tests, Docs), ghost-text inline completions (Tab to accept), inline "Ask AI to edit" (Ctrl+I). **Apply / Replace selection / inline edits open a Cursor-style review**: the AI version is shown as an inline diff with Accept / Reject per change plus Accept all / Reject all (toggle in Settings → AI). Defaults: `openai/gpt-oss-120b` for chat, `openai/gpt-oss-20b` for completions (override with `GROQ_CHAT_MODEL` / `GROQ_FAST_MODEL`). If Groq errors (quota, outage, retired model) and `GEMINI_API_KEY` is set, the same request is retried on Google Gemini automatically — the client is never aware it happened beyond a (usually) slightly slower response.
- **Run & terminal** — Ctrl+Enter runs the active file: in development through the **local runner** (whatever toolchains are on your machine — Python, Node/TS, C/C++, Java, Go, Rust, …), or through **Judge0** (~40 languages, sandboxed; the public `ce.judge0.com` instance needs no key), self-hosted **Piston** or **JDoodle**. Terminal-style output with stdin, time limit, compile errors, Problems panel with jump-to-line and "Ask AI to fix". **Python can also run entirely in the browser** (Pyodide / WebAssembly CPython 3.14 — Settings → Editor → "Run Python in the browser"), and is used automatically as a fallback when the server runner is rate-limited or down. Supported languages come from `/api/capabilities` and drive the UI. See [web/runner/README.md](web/runner/README.md).
- **File management** — explorer with folders, inline create/rename, delete, upload, drag & drop, filter, project-wide search & replace, dirty/modified markers. Files are stored in S3, project metadata in MongoDB.
- **Real-time collaboration (optional)** — per-file Yjs documents over the bundled y-websocket server (`npm run collab`), live text sync, remote cursors with names, presence ("Live · N online"), share links.
- **Command palette** (Ctrl+K / Ctrl+Shift+P), quick open (Ctrl+P), keyboard-first workflow.
- **Auth** — Clerk (sign-in/sign-up pages, dark theme, protected routes and APIs via `src/proxy.js`).

---

## Tech stack

- **Next.js 16** (App Router, Turbopack), **React 19**
- **Clerk** for authentication (`@clerk/nextjs`)
- **MongoDB / Mongoose** (projects, users), **AWS S3** (file contents)
- **Groq SDK** (chat, inline completions, lint/docs/snippet helpers)
- Code execution: local toolchains (dev), **Piston** (self-hosted, Docker), **Judge0** or **JDoodle**
- **CodeMirror 6**, **Yjs** + **y-websocket** for the editor and collaboration
- Custom CSS design system (dark-first tokens), Lucide icons, Inter + JetBrains Mono

---

## Directory structure

The code is split into three top-level groups under `web/src`: **`app/`** (Next.js routes — the thin layer that wires the two together), **`backend/`** (everything server-only) and **`frontend/`** (everything that runs in the browser). Import them with the `@/backend/*` and `@/frontend/*` aliases.

```
web/
├── src/app/                     # Next.js App Router — routing only
│   ├── page.jsx                 # Landing        → @/frontend/screens
│   ├── dashboard/               # Project list   → @/frontend/screens
│   ├── ide/[projectId]/[[...path]]/   # The IDE  → @/frontend/ide
│   ├── sign-in/, sign-up/       # Clerk pages
│   └── api/                     # Route handlers → @/backend/*
│       ├── projects/            # GET/POST, GET/DELETE /:projectId
│       ├── files/               # POST (save), GET/DELETE /:projectId/*, POST /rename
│       ├── run/                 # POST — execute code
│       ├── ai/                  # chat (stream), auto-complete, lint, generate-docs, generate-snippet
│       ├── capabilities/        # runner/languages/models/collab for the client
│       └── health/
│
├── src/backend/                 # ── SERVER ONLY (never imported by the browser) ──
│   ├── db.js, models/           # Mongoose connection, Project + User schemas
│   ├── auth.js                  # Clerk session → User doc, project access checks
│   ├── s3.js                    # File storage
│   ├── groq.js, ai.js           # Groq client, chat/completion/lint/docs prompts
│   ├── runner.js, runners/      # Code execution: judge0, piston, jdoodle, local
│   ├── ratelimit.js, http.js    # Rate limiting, handler/error/JSON helpers
│
├── src/frontend/                # ── BROWSER ONLY ──
│   ├── ide/                     # IDE shell, sidebar views, panels, dialogs, AI panel, contexts
│   ├── editor/                  # CodeMirror setup, theme, extensions
│   ├── screens/                 # Landing, Dashboard
│   ├── ui/, styles/             # Design system
│   ├── hooks/                   # Shared React hooks
│   ├── collab/                  # y-websocket client helpers
│   └── lib/                     # api client, file types, session/nav adapters,
│                                #   pyodideRunner.js (in-browser Python, module worker)
│
├── src/proxy.js                 # Clerk middleware (route protection)
├── runner/                      # Self-hosted Piston: docker-compose.yml, install-languages.mjs, README
└── collab/server.js             # y-websocket server (npm run collab) — Yjs sync + awareness
```

---

## Getting started

### Prerequisites

- Node.js 20+
- Accounts/keys: [Clerk](https://dashboard.clerk.com), MongoDB (Atlas or local), AWS S3 bucket, [Groq](https://console.groq.com) API key. Code execution needs nothing extra in development (uses the toolchains on your machine); for production self-host Piston with Docker (see `web/runner/`) or use Judge0/JDoodle.

### Install & run

```bash
cd web
npm install
cp .env.example .env.local   # fill in the values below
npm run dev                  # http://localhost:3000
```

Optional collaboration server (in a second terminal):

```bash
npm run collab               # ws://localhost:1234 — then set NEXT_PUBLIC_COLLAB_URL in .env.local
```

Production:

```bash
npm run build && npm start
```

### Environment variables (`web/.env.local`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | prod | Clerk keys. Leave empty in dev to use Clerk keyless mode. |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | yes | `/sign-in`, `/sign-up` |
| `MONGO_URI` | yes | MongoDB connection string |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME` | yes | File storage |
| `GROQ_API_KEY` | yes (for AI) | Groq API key — primary AI provider |
| `GROQ_CHAT_MODEL`, `GROQ_FAST_MODEL` | no | Groq model overrides |
| `GEMINI_API_KEY` | recommended | Google Gemini key ([aistudio.google.com/apikey](https://aistudio.google.com/apikey)) — automatic fallback when Groq fails. Works standalone too if `GROQ_API_KEY` is unset. |
| `GEMINI_CHAT_MODEL`, `GEMINI_FAST_MODEL` | no | Gemini model overrides (default `gemini-3.5-flash` / `gemini-3.5-flash-lite`) |
| `PISTON_URL` | no | Self-hosted Piston runner (`web/runner/docker-compose.yml`) |
| `JUDGE0_URL` / `JUDGE0_RAPIDAPI_KEY` (+ `JUDGE0_AUTH_TOKEN`, `JUDGE0_RAPIDAPI_HOST`) | recommended | Judge0 runner — `https://ce.judge0.com` works with no key (rate-limited); self-host or RapidAPI for real traffic |
| `JDOODLE_CLIENT_ID`, `JDOODLE_CLIENT_SECRET` | no | JDoodle runner (4 languages) |
| `RUNNER`, `RUN_TIMEOUT_MS` | no | Force a runner (`piston|judge0|jdoodle|local|none`); per-run time limit (default 5000 ms). Dev auto-uses `local`. |
| `NEXT_PUBLIC_COLLAB_URL` | no | y-websocket URL to enable real-time collaboration (`ws://localhost:1234` with `npm run collab`) |
| `COLLAB_PORT` | no | Port for `npm run collab` (default 1234) |
| `NEXT_PUBLIC_PYODIDE_VERSION` | no | Pyodide version served from jsDelivr for in-browser Python (default 314.0.5) |

---

## API endpoints

All routes require a Clerk session (unauthenticated calls get `401` JSON).

| Method | Route | Description |
| --- | --- | --- |
| GET | `/api/health` | Liveness (public) |
| GET | `/api/capabilities` | `{ runner, languages, ai, models, collab }` |
| GET / POST | `/api/projects` | List / create (`{ projectName }`) |
| GET / DELETE | `/api/projects/:projectId` | Project details / delete (owner) |
| POST | `/api/files` | Save `{ projectId, fileName, content }` |
| GET / DELETE | `/api/files/:projectId/*path` | Read / delete a file |
| POST | `/api/files/rename` | `{ projectId, from, to }` (folder when both end with `/`) |
| POST | `/api/run` | `{ projectId, fileName, code, stdin }` |
| POST | `/api/ai/chat` | Streaming chat `{ messages, context }` |
| POST | `/api/ai/auto-complete` | Inline completion `{ prefix, suffix, language, fileName }` |
| POST | `/api/ai/lint` · `/api/ai/generate-docs` · `/api/ai/generate-snippet` | Helpers |

---

## Roadmap

See [docs/REVAMP-PLAN.md](docs/REVAMP-PLAN.md) for the phased plan (runner upgrades, diff-based AI edits, collaboration server, etc.).

## License

MIT
