# Resume Agent — end-to-end runbook

## Prerequisites

- Node 20+, pnpm 10+
- Cursor account with GitHub connected
- `CURSOR_API_KEY` from Cursor dashboard
- Resume repo copied from `example` and pushed to GitHub

## 1. Resume repository

1. Copy `example` to a new GitHub repository.
2. Connect the repo in Cursor (cloud agents must clone it).
3. Verify `.cursor/skills/tailor-resume/` is committed on `main`.

## 2. API

```bash
cp apps/api/.env.example apps/api/.env
# Set CURSOR_API_KEY, BACKEND_SHARED_SECRET (32+ chars), RESUME_REPO_URL, DEV_EXTENSION_ORIGIN

pnpm install
pnpm dev:api
```

Health check: `curl http://127.0.0.1:3847/health`

### Demo replay

```bash
# In apps/api/.env
DEMO_RUN_FIXTURE_PATH=./fixtures/demo-run.json
```

Extension shows a **Replay** badge; no SDK call is made.

### Live smoke (optional)

```bash
pnpm --filter @resume-agent/api smoke
```

Requires real `CURSOR_API_KEY` and `RESUME_REPO_URL`.

## 3. Chrome extension

```bash
pnpm dev:extension   # or pnpm build:extension
```

1. Open `chrome://extensions` → Developer mode → Load unpacked → `apps/extension/dist` (after build).
2. Copy extension ID into `DEV_EXTENSION_ORIGIN=chrome-extension://<ID>` in API `.env`; restart API.
3. Options: set port `3847`, same shared token as API, resume repo URL.

## 4. Happy path (F1)

1. Open a job posting.
2. Open Resume Agent popup — confirm title, company, description.
3. Check confirmation checkbox → **Tailor resume**.
4. Watch progress; on success open PR link.
5. On GitHub, verify under `jobs/<company>/<role>/`:
   - `fit-report.md` (includes **Do not add**)
   - `tailored-resume.md`
   - `change-summary.md`

## 5. Fallbacks

| Scenario | Action |
|----------|--------|
| Low extraction confidence | Paste JD in popup |
| Active run 409 | Wait or check `GET /runs/:id` |
| PR missing, branch exists | Review branch in GitHub; merge manually |
| SDK auth error | Re-check API key and repo connection |
