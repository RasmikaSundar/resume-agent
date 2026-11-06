import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { AppConfig } from "./config.js";

export type AgentRuntime = "cloud" | "local";

export function parseAgentRuntime(value: string | undefined): AgentRuntime {
  const normalized = (value ?? "cloud").trim().toLowerCase();
  if (normalized === "local") return "local";
  if (normalized === "cloud") return "cloud";
  throw new Error(`AGENT_RUNTIME must be "cloud" or "local", got: ${value}`);
}

export function resolveLocalResumeRepoPath(raw: string | undefined): string {
  const path = raw?.trim();
  if (!path) {
    throw new Error(
      "LOCAL_RESUME_REPO_PATH is required when AGENT_RUNTIME=local",
    );
  }
  const absolute = resolve(path);
  if (!existsSync(absolute)) {
    throw new Error(`LOCAL_RESUME_REPO_PATH does not exist: ${absolute}`);
  }
  return absolute;
}

/** Lock key for one-active-run policy (cloud URL vs local path). */
export function runRepoKey(config: AppConfig, repoUrl: string): string {
  if (config.agentRuntime === "local") {
    return config.localResumeRepoPath;
  }
  return repoUrl;
}
