# Code runners

The Run button (`POST /api/run`) executes the active file through one of these backends, chosen in `src/backend/runner.js`:

| Runner | When it's used | Languages | Notes |
| --- | --- | --- | --- |
| **judge0** | `JUDGE0_URL=https://ce.judge0.com` (public CE instance, free, no key, rate-limited), a self-hosted URL, or `JUDGE0_RAPIDAPI_KEY` | ~40 | Sandboxed. Language ids are resolved from the instance's `/languages` (newest version). Java files are compiled as `Main.java` — the public class is renamed automatically. **Default choice.** |
| **jdoodle** | `JDOODLE_CLIENT_ID` + `JDOODLE_CLIENT_SECRET` | 4 (C++, Java, Python, JS) | Free tier 20 runs/day. |
| **piston** | `PISTON_URL` | 40+ (whatever packages you install) | Sandboxed, free, self-hosted via Docker — good when you want unlimited runs on your own box. |
| **local** | Automatically in development when nothing else is configured (or `RUNNER=local`) | whatever toolchains are on the host (`python`, `node`, `gcc/g++`, `java`, `go`, `rustc`, …) | **No sandbox** — dev / single-user only. Never auto-selected when `NODE_ENV=production`. |
| none | `RUNNER=none`, or production without any of the above | — | UI shows "no runner configured". |

Force one with `RUNNER=piston|judge0|jdoodle|local|none`. Per-run time limit: `RUN_TIMEOUT_MS` (default 5000).

## Judge0

The quickest path is Judge0's public CE instance — no account needed:

```
JUDGE0_URL=https://ce.judge0.com
```

It's shared and rate-limited (you'll see "The code runner is rate-limited right now" under load), so for real traffic pick one of:

- **Self-host** with Docker: `git clone https://github.com/judge0/judge0 && cd judge0 && docker compose up -d` (Linux host with cgroup v1, see their README), then `JUDGE0_URL=http://<host>:2358` and, if you enabled auth, `JUDGE0_AUTH_TOKEN`.
- **RapidAPI**: subscribe to "Judge0 CE" and set `JUDGE0_RAPIDAPI_KEY` (host defaults to `judge0-ce.p.rapidapi.com`).
- **Sulu / Judge0 hosted plans**: use the URL + `JUDGE0_AUTH_TOKEN` they give you.

## Self-hosting Piston (alternative)

```bash
cd web/runner
docker compose up -d
node install-languages.mjs        # one-time; downloads python, node, gcc, java, ... (~10 min)
```

Then in `web/.env.local`:

```
PISTON_URL=http://localhost:2000/api/v2
```

Deploying the Next.js app to Vercel/Render? Run this container on any small VPS (Piston needs `--privileged`) and point `PISTON_URL` at it — put it behind a firewall or reverse proxy that only allows your app's origin, since Piston has no auth of its own.

> The public instance at emkc.org has been whitelist-only since Feb 2026, so a URL is required.

