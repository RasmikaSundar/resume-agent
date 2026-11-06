import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { MIN_DESCRIPTION_LENGTH } from "@resume-agent/shared";
import type { AppConfig } from "../config.js";
import { createAuthMiddleware } from "../middleware/auth.js";
import { RunStore } from "../services/run-store.js";

vi.mock("@cursor/sdk", () => ({
  CursorAgentError: class CursorAgentError extends Error {
    isRetryable = false;
  },
  Agent: { create: vi.fn() },
}));

vi.mock("../services/cursor-agent.js", () => ({
  startAgentRun: vi.fn(),
}));

import { startAgentRun } from "../services/cursor-agent.js";
import { createRunsRouter } from "./runs.js";

const TOKEN = "test-secret-with-enough-length-for-auth-middleware";

const config: AppConfig = {
  port: 3847,
  cursorApiKey: "test-key",
  sharedSecret: TOKEN,
  resumeRepoUrl: "https://github.com/example/resume",
  devExtensionOrigin: "",
  demoFixturePath: "",
  agentRuntime: "cloud",
  cloudStartingRef: "main",
  localResumeRepoPath: "",
};

function buildApp(store: RunStore) {
  const app = express();
  app.use(express.json());
  app.use("/runs", createAuthMiddleware(config), createRunsRouter(config, store));
  return app;
}

const validJob = {
  title: "Engineer",
  company: "Acme",
  url: "https://example.com/job",
  description: "d".repeat(MIN_DESCRIPTION_LENGTH),
  source: "extract" as const,
  confirmed: true,
};

describe("POST /runs", () => {
  beforeEach(() => {
    vi.mocked(startAgentRun).mockClear();
  });

  it("returns 401 without token", async () => {
    const app = buildApp(new RunStore());
    const res = await request(app)
      .post("/runs")
      .send({ job: validJob });
    expect(res.status).toBe(401);
  });

  it("returns 400 without confirmed job (AE4)", async () => {
    const app = buildApp(new RunStore());
    const res = await request(app)
      .post("/runs")
      .set("X-Resume-Agent-Token", TOKEN)
      .send({ job: { ...validJob, confirmed: false } });
    expect(res.status).toBe(400);
    expect(startAgentRun).not.toHaveBeenCalled();
  });

  it("returns runId on happy path", async () => {
    const app = buildApp(new RunStore());
    const res = await request(app)
      .post("/runs")
      .set("X-Resume-Agent-Token", TOKEN)
      .send({ job: validJob });
    expect(res.status).toBe(202);
    expect(res.body.runId).toBeDefined();
    expect(startAgentRun).toHaveBeenCalled();
  });

  it("returns 409 when repo already has active run", async () => {
    const store = new RunStore();
    const app = buildApp(store);
    await request(app)
      .post("/runs")
      .set("X-Resume-Agent-Token", TOKEN)
      .send({ job: validJob });
    const second = await request(app)
      .post("/runs")
      .set("X-Resume-Agent-Token", TOKEN)
      .send({ job: validJob });
    expect(second.status).toBe(409);
    expect(second.body.runId).toBeDefined();
  });
});
