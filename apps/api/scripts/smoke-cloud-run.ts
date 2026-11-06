/**
 * Manual smoke test — requires CURSOR_API_KEY and RESUME_REPO_URL in apps/api/.env
 * Usage: pnpm --filter @resume-agent/api smoke
 */
import { loadConfig } from "../src/config.js";
import { startCloudRun } from "../src/services/cursor-agent.js";
import { RunStore } from "../src/services/run-store.js";
import { randomUUID } from "node:crypto";
import { MIN_DESCRIPTION_LENGTH } from "@resume-agent/shared";

const config = loadConfig();
const store = new RunStore();
const runId = randomUUID();
const repoUrl = config.resumeRepoUrl;

if (!repoUrl) {
  console.error("Set RESUME_REPO_URL");
  process.exit(1);
}

store.create(runId, repoUrl);

await startCloudRun({
  runId,
  repoUrl,
  config,
  store,
  job: {
    title: "Smoke Test Engineer",
    company: "Resume Agent",
    url: "https://example.com/smoke",
    description: "Smoke test job description. ".repeat(
      Math.ceil(MIN_DESCRIPTION_LENGTH / 28),
    ),
    source: "paste",
    confirmed: true,
  },
});

console.log("Started run", runId, "— poll GET /runs/" + runId);
