# Resume Agent

**Resume Agent** tailors your markdown resume for a specific job—honestly—from the job page you're already viewing. A Chrome extension captures the role and job description; a local API runs a **Composer 2.5** cloud agent on your **GitHub resume repo** and opens a PR with a fit report, tailored resume, and change summary.

## Architecture

```
Chrome extension  →  apps/api (localhost)  →  Cursor cloud agent  →  your resume repo (PR)
```

The extension never sees your Cursor API key.

## Quick start

1. Copy `example` to a new GitHub repository and connect it in [Cursor](https://cursor.com/dashboard). Reference standalone repo: [gopinav/resume-agent-skills](https://github.com/gopinav/resume-agent-skills).
2. Copy `apps/api/.env.example` to `apps/api/.env` and set `CURSOR_API_KEY`, `BACKEND_SHARED_SECRET` (32+ random bytes), and `RESUME_REPO_URL`.
3. `pnpm install && pnpm dev:api`
4. Load `apps/extension` as an unpacked extension (see runbook), set backend port and shared token in Options.
5. Open a job posting, confirm in the popup, and **Tailor resume**.

**Testing:** step-by-step guide → [docs/TESTING.md](docs/TESTING.md)  
Shorter E2E reference → [docs/runbooks/resume-agent-e2e.md](docs/runbooks/resume-agent-e2e.md)

## Workspace

| Package | Role |
|---------|------|
| `apps/extension` | MV3 — extract JD, confirm, stream progress |
| `apps/api` | Express API — SDK orchestration, SSE |
| `packages/shared` | Shared TypeScript contracts |
| `example` | Template resume + `tailor-resume` skill — lives in its own repo ([gopinav/resume-agent-skills](https://github.com/gopinav/resume-agent-skills)) |

## Environment

| Variable | Where | Purpose |
|----------|-------|---------|
| `CURSOR_API_KEY` | API only | Cursor SDK |
| `BACKEND_SHARED_SECRET` | API + extension options | `X-Resume-Agent-Token` |
| `PORT` | API | Default `3847` |
| `RESUME_REPO_URL` | API | Default repo for runs |
| `DEV_EXTENSION_ORIGIN` | API | CORS allowlist |
| `DEMO_RUN_FIXTURE_PATH` | API | Optional replay mode for demos/testing |

## License

Private / demo — see repo owner.
