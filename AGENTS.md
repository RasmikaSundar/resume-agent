# Resume Agent — agent guidance

Monorepo for **Resume Agent**: Chrome extension (`apps/extension`), local API (`apps/api`), shared types (`packages/shared`), and resume repo template (`example`).

## Layout

- `apps/api` — holds `CURSOR_API_KEY`; orchestrates Cursor cloud agents with `autoCreatePR`
- `apps/extension` — MV3; talks to API via `X-Resume-Agent-Token` only
- `packages/shared` — `JobPayload`, run types, validation
- `example` — resume repo template; contains `.cursor/skills/tailor-resume/`. This must live in its **own** GitHub repo (cloud agents clone it separately). Reference: [gopinav/resume-agent-skills](https://github.com/gopinav/resume-agent-skills) is the standalone repo showing the skills + example resume set up correctly.

## Commands

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm dev:api          # localhost API
pnpm dev:extension    # Vite dev build
```

## Env

See `apps/api/.env.example` (API) and `apps/extension/.env.example` (extension dev defaults). Never commit secrets. Extension must not bundle `CURSOR_API_KEY`.

## Cloud runs

Use `@cursor/sdk` with explicit `cloud: { repos, autoCreatePR: true }` and `model: { id: "composer-2.5" }`. Per-run prompts stay thin; playbook lives in the resume repo skill.
