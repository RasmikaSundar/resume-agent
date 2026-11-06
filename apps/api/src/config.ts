import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import {
  parseAgentRuntime,
  resolveLocalResumeRepoPath,
} from "./agent-runtime.js";

loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), "apps/api/.env") });

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadConfig() {
  const sharedSecret = requireEnv("BACKEND_SHARED_SECRET");
  if (sharedSecret.length < 32) {
    throw new Error("BACKEND_SHARED_SECRET must be at least 32 characters");
  }

  const agentRuntime = parseAgentRuntime(process.env.AGENT_RUNTIME);
  const cloudStartingRef = process.env.CLOUD_STARTING_REF?.trim() || "main";

  return {
    port: Number(process.env.PORT ?? 3847),
    cursorApiKey: requireEnv("CURSOR_API_KEY"),
    sharedSecret,
    resumeRepoUrl: process.env.RESUME_REPO_URL?.trim() ?? "",
    devExtensionOrigin: process.env.DEV_EXTENSION_ORIGIN?.trim() ?? "",
    demoFixturePath: process.env.DEMO_RUN_FIXTURE_PATH?.trim() ?? "",
    agentRuntime,
    cloudStartingRef,
    localResumeRepoPath:
      agentRuntime === "local"
        ? resolveLocalResumeRepoPath(process.env.LOCAL_RESUME_REPO_PATH)
        : "",
  };
}

export type AppConfig = ReturnType<typeof loadConfig>;
