# Resume Agent — step-by-step testing guide

Follow these steps in order. You can test the **UI flow without a Cursor API key** using demo replay (Part B), then run the **full live pipeline** (Part C) when your resume repo and API key are ready.

---

## Before you start

### What you need installed

| Tool | Version | Check |
|------|---------|--------|
| Node.js | 20 or newer | `node -v` |
| pnpm | 10+ | `pnpm -v` |
| Google Chrome | Recent | For the extension |
| Git | Any | For resume repo setup |

### Accounts and access

- A **Cursor** account with **GitHub** connected ([Cursor dashboard](https://cursor.com/dashboard))
- A **Cursor API key** ([Integrations](https://cursor.com/dashboard/integrations)) — only required for Part C (live run)
- A **GitHub** account to host your resume repository

### Clone and install (once)

From the project root (`better-codebase/`):

```bash
pnpm install
```

Optional sanity check (no API key needed):

```bash
pnpm test
pnpm typecheck
```

All tests should pass.

If the API later fails with a `sqlite3` error when starting, run:

```bash
pnpm approve-builds
```

Select `esbuild` and `sqlite3`, then run `pnpm install` again.

---

## Part A — Set up your resume GitHub repository

The cloud agent runs against **your** resume repo, not this monorepo.

### Step A1 — Create the repo on GitHub

1. On GitHub, click **New repository**.
2. Name it something like `my-resume` (public or private is fine).
3. Do **not** add a README if you plan to push the template as-is (or merge manually later).

### Step A2 — Copy the template from this project

On your machine, from the `better-codebase` root:

```bash
# Example: copy template to a sibling folder (adjust paths as you like)
cp -R example ~/Projects/my-resume
cd ~/Projects/my-resume
git init
git add .
git commit -m "Initial resume repo from Resume Agent template"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/my-resume.git
git push -u origin main
```

Replace `YOUR_USERNAME` and `my-resume` with your GitHub user and repo name.

### Step A3 — Connect the repo in Cursor

1. Open [cursor.com/dashboard](https://cursor.com/dashboard).
2. Connect **GitHub** if you have not already.
3. Ensure the resume repository is available for **cloud agents** (same GitHub account Cursor uses).

### Step A4 — Confirm skill files are on `main`

On GitHub, verify these exist on the `main` branch:

- `resume.md`
- `AGENTS.md`
- `.cursor/skills/tailor-resume/SKILL.md`
- `.cursor/skills/tailor-resume/references/` (multiple `.md` files)
- `jobs/.gitkeep`

Copy your real resume content into `resume.md` when you are ready for production testing.

Cloud runs use the skill copy committed in your resume repo, not the template copy in this monorepo.

### Step A5 — Note your repo URL

You will need this exact URL later:

```text
https://github.com/YOUR_USERNAME/my-resume
```

---

## Part B — Quick test (demo replay, no cloud agent)

Use this to verify the **extension + API + popup flow** without spending a cloud agent run or needing `CURSOR_API_KEY`.

### Step B1 — Generate a shared secret

In a terminal:

```bash
openssl rand -hex 32
```

Copy the output. You will use the **same value** in the API `.env` and in the extension Options.

### Step B2 — Configure the API for demo mode

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env`:

```env
PORT=3847
BACKEND_SHARED_SECRET=paste-your-64-char-hex-here
RESUME_REPO_URL=https://github.com/YOUR_USERNAME/my-resume
DEV_EXTENSION_ORIGIN=chrome-extension://PLACEHOLDER
DEMO_RUN_FIXTURE_PATH=./fixtures/demo-run.json
```

- Leave `CURSOR_API_KEY` empty or as a placeholder for demo mode.
- `DEV_EXTENSION_ORIGIN` will be fixed in Step B6 after you load the extension.

### Step B3 — Start the API

From the project root:

```bash
pnpm dev:api
```

Leave this terminal open. You should see:

```text
Resume Agent API listening on http://127.0.0.1:3847
```

### Step B4 — Verify the API health endpoint

In a **new** terminal:

```bash
curl http://127.0.0.1:3847/health
```

Expected JSON includes `"ok": true` and `"demo": true` (because `DEMO_RUN_FIXTURE_PATH` is set).

### Step B5 — Build and load the Chrome extension

In a new terminal (project root):

```bash
pnpm build:extension
```

In Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the folder: `better-codebase/apps/extension/dist`
5. Copy the **Extension ID** (long string under the extension name)

### Step B6 — Fix CORS and restart the API

1. Edit `apps/api/.env` and set:

   ```env
   DEV_EXTENSION_ORIGIN=chrome-extension://YOUR_EXTENSION_ID
   ```

   Example: `chrome-extension://abcdefghijklmnop`

2. Stop the API (Ctrl+C in the API terminal) and start again:

   ```bash
   pnpm dev:api
   ```

### Step B7 — Configure extension Options

1. On `chrome://extensions`, find **Resume Agent** and click **Extension options** (or right-click the extension icon → Options).
2. Set:
   - **API port:** `3847`
   - **Shared token:** same value as `BACKEND_SHARED_SECRET` in `apps/api/.env`
   - **Default resume repo URL:** your GitHub resume repo URL from Step A5
3. Click **Save**.

### Step B8 — Run a demo tailor flow

1. Open any webpage (a LinkedIn job URL is ideal but not required for demo mode).
2. Click the **Resume Agent** extension icon to open the popup.
3. If job fields are empty, switch to the **Paste JD** tab and paste at least **200 characters** of job description text.
4. Check: **I confirm this role and want to start tailoring**
5. Click **Tailor resume**.

**Expected behavior:**

- A **Replay** badge appears in the popup header.
- Status updates appear with visible spacing below **Tailor resume**.
- After a few seconds, an **Open pull request** link appears.
- The popup does **not** list file paths under `jobs/.../`; those artifacts live in the PR.
- No real Cursor cloud run occurs.

If this fails, see [Troubleshooting](#troubleshooting) below.

---

## Agent runtime modes (`AGENT_RUNTIME`)

| Mode | When to use | Requirements |
|------|-------------|--------------|
| `cloud` | Production / PR on GitHub | Cursor **connected to GitHub**; repo visible to cloud agents |
| `local` | GitHub connect broken in Cursor | Git clone on disk; `LOCAL_RESUME_REPO_PATH` set |

**Your cloud error** (`Failed to verify existence of branch 'main'`) means Cursor’s servers cannot see your GitHub repo — usually because Cursor Settings → GitHub shows “Failed to load GitHub settings”. The repo and `main` branch can still exist on GitHub (verify with `gh`).

**Switch to local for testing** in `apps/api/.env`:

```env
AGENT_RUNTIME=local
LOCAL_RESUME_REPO_PATH=/absolute/path/to/your-resume-repo
```

Restart the API. Local runs write files under `jobs/.../` in that clone; there is no cloud PR — use `git status` / commit / push yourself.

To return to cloud later:

```env
AGENT_RUNTIME=cloud
```

Fix Cursor GitHub: Cursor Settings → GitHub → Connect, then grant access to your resume repo.

---

## Part C — Full live test (real cloud agent + PR)

Only do this after Part B works. Requires a valid `CURSOR_API_KEY` and a connected resume repo.

### Step C1 — Update API environment for live runs

Edit `apps/api/.env`:

```env
CURSOR_API_KEY=cursor_your_real_key_here
BACKEND_SHARED_SECRET=same-as-before
PORT=3847
RESUME_REPO_URL=https://github.com/YOUR_USERNAME/my-resume
DEV_EXTENSION_ORIGIN=chrome-extension://YOUR_EXTENSION_ID
# Remove or comment out demo mode:
# DEMO_RUN_FIXTURE_PATH=./fixtures/demo-run.json
```

Restart the API:

```bash
pnpm dev:api
```

Health check should show `"demo": false`:

```bash
curl http://127.0.0.1:3847/health
```

### Step C2 — Open a real job posting

Use a job page with a visible description, for example:

- A LinkedIn job posting URL (`linkedin.com/jobs/view/...`), or
- Any careers page with a long job description

Refresh the page after loading the extension if the popup shows empty fields.

### Step C3 — Confirm extraction in the popup

1. Open the Resume Agent popup.
2. On the **Detected** tab, verify **title**, **company**, and a **description preview** look reasonable.
3. If you see a warning about low confidence, use **Paste JD** and paste the full description (minimum 200 characters).

### Step C4 — Start a live run

1. Check the confirmation checkbox.
2. Click **Tailor resume**.
3. Keep the popup open or reopen it later — progress is stored by `runId`.

**Expected behavior:**

- Status moves through creating / running / writing / PR phases (may take several minutes).
- On success: **Open pull request** link only; the popup does not list `jobs/...` file paths.
- On GitHub: a new PR on your resume repo with three files under `jobs/<company>/<role>/`:
  - `fit-report.md` (must include **Overall fit** with `**Tier:**`, `**Verdict:**`, and narrative, plus a **Do not add** section)
  - `tailored-resume.md`
  - `change-summary.md`

### Step C5 — Verify on GitHub

1. Open the PR link from the popup.
2. Confirm `resume.md` on `main` was **not** overwritten (changes should be on the agent branch only).
3. Read `fit-report.md` and confirm **Overall fit** includes `**Tier:**`, `**Verdict:**`, and a short narrative.
4. Confirm **Strong matches**, **Gaps**, and **Do not add** are present, and read `change-summary.md` for traceability.

### Step C6 — Optional CLI smoke test

With `apps/api/.env` configured for live runs:

```bash
pnpm --filter @resume-agent/api smoke
```

This starts one cloud run from the terminal. Watch the API logs and poll status with the returned `runId` (or check GitHub for a new branch/PR).

---

## Part D — Test paste fallback and edge cases

| What to test | How | Expected |
|--------------|-----|----------|
| Paste fallback | Paste tab + 200+ char JD, confirm, Tailor | Same POST shape as extract; run starts |
| Confirm guard | Tailor without checkbox | Button disabled |
| Second run while first is running | Tailor twice quickly on same repo | API returns 409 with existing `runId` |
| Popup closed mid-run | Close popup, reopen during run | Progress restored via stored `runId` |
| Wrong token in Options | Change token, Tailor | Error message in popup (not raw API dump) |

---

## Troubleshooting

### Extension popup says to set token in Options

- Open Options and paste the same secret as `BACKEND_SHARED_SECRET` in `apps/api/.env`.
- Secret must be at least 32 characters.

### CORS or network errors in the popup

- `DEV_EXTENSION_ORIGIN` must exactly match `chrome-extension://<your-extension-id>`.
- Restart the API after changing `.env`.
- API must be on `http://127.0.0.1:3847` (not `localhost` in extension options — port only).

### `curl /health` fails

- API terminal must be running (`pnpm dev:api`).
- Check nothing else is using port `3847`.

### Demo mode never shows Replay badge

- Confirm `DEMO_RUN_FIXTURE_PATH=./fixtures/demo-run.json` in `apps/api/.env` (path is relative to `apps/api` when the server runs).
- Restart API after editing `.env`.

### Live run fails immediately (502)

- Verify `CURSOR_API_KEY` is valid and has no extra spaces.
- Confirm resume repo is connected in Cursor dashboard.
- Check `RESUME_REPO_URL` matches the GitHub URL exactly.

### Live run finishes but no PR link

- Files may still exist on the agent branch — check GitHub branches.
- PR creation can fail while commits succeed; open the branch manually.

### LinkedIn fields are wrong or empty

- Refresh the job page and reopen the popup.
- Use **Paste JD** with the full description (200+ characters).
- LinkedIn changes their HTML often; paste fallback is the reliable path.

### `sqlite3` / bindings error when starting API

```bash
pnpm approve-builds
pnpm install
```

Then restart `pnpm dev:api`.

---

## Checklist summary

**Part A — Resume repo**

- [ ] Template pushed to GitHub
- [ ] Repo connected in Cursor
- [ ] Skill files visible on `main`

**Part B — Demo replay**

- [ ] `pnpm install` and `pnpm test` pass
- [ ] `apps/api/.env` configured with secret + demo fixture
- [ ] API running; `curl /health` shows `"demo": true`
- [ ] Extension built and loaded from `apps/extension/dist`
- [ ] `DEV_EXTENSION_ORIGIN` set; API restarted
- [ ] Options saved (port, token, repo URL)
- [ ] Demo Tailor completes with Replay badge and mock PR link only

**Part C — Live run**

- [ ] `CURSOR_API_KEY` set; demo fixture removed
- [ ] Job page open; popup shows job context
- [ ] Live Tailor completes with real PR
- [ ] Three files under `jobs/<company>/<role>/` on GitHub
- [ ] `fit-report.md` includes `**Tier:**`, `**Verdict:**`, narrative, and **Do not add**

---

## Related docs

- [README.md](../README.md) — project overview
- [runbooks/resume-agent-e2e.md](runbooks/resume-agent-e2e.md) — shorter E2E reference
