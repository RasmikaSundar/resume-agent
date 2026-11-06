import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../config.js";
import { RunStore } from "./run-store.js";

const mockAsyncDispose = vi.fn().mockResolvedValue(undefined);
const mockArchive = vi.fn().mockResolvedValue(undefined);
const mockStream = vi.fn();
const mockWait = vi.fn();
const mockSend = vi.fn();
const mockCreate = vi.fn();

vi.mock("@cursor/sdk", () => ({
  CursorAgentError: class CursorAgentError extends Error {
    isRetryable = false;
  },
  Agent: {
    create: (...args: unknown[]) => mockCreate(...args),
    archive: (...args: unknown[]) => mockArchive(...args),
  },
}));

import {
  getActiveAgentSessionCount,
  shutdownAgentSessions,
  startCloudRun,
} from "./cursor-agent.js";

const config: AppConfig = {
  port: 3847,
  cursorApiKey: "test-key",
  sharedSecret: "x".repeat(32),
  resumeRepoUrl: "https://github.com/example/resume",
  devExtensionOrigin: "",
  demoFixturePath: "",
  agentRuntime: "cloud",
  cloudStartingRef: "main",
  localResumeRepoPath: "",
};

const job = {
  title: "Engineer",
  company: "Acme",
  url: "https://example.com/job",
  description: "d".repeat(200),
  source: "extract" as const,
  confirmed: true,
};

describe("cursor-agent lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({
      agentId: "bc-test-agent",
      send: mockSend,
      [Symbol.asyncDispose]: mockAsyncDispose,
    });
    mockSend.mockResolvedValue({
      stream: mockStream,
      wait: mockWait,
      status: "running",
    });
    mockStream.mockImplementation(async function* () {
      yield { type: "assistant", message: { content: [{ type: "text", text: "ok" }] } };
    });
    mockWait.mockResolvedValue({
      status: "finished",
      git: { branches: [{ prUrl: "https://github.com/example/resume/pull/1" }] },
    });
  });

  it("disposes and archives the cloud agent after a successful run", async () => {
    const store = new RunStore();
    const runId = "run-1";
    store.create(runId, config.resumeRepoUrl);

    await startCloudRun({
      runId,
      job,
      repoUrl: config.resumeRepoUrl,
      config,
      store,
    });

    expect(store.get(runId)?.status).toBe("succeeded");
    expect(mockArchive).toHaveBeenCalledWith("bc-test-agent", {
      apiKey: config.cursorApiKey,
    });
    expect(mockAsyncDispose).toHaveBeenCalledTimes(1);
    expect(getActiveAgentSessionCount()).toBe(0);
  });

  it("disposes the agent when streaming fails", async () => {
    mockStream.mockImplementation(async function* () {
      throw new Error("stream broke");
    });

    const store = new RunStore();
    const runId = "run-2";
    store.create(runId, config.resumeRepoUrl);

    await expect(
      startCloudRun({ runId, job, repoUrl: config.resumeRepoUrl, config, store }),
    ).rejects.toThrow("stream broke");

    expect(mockAsyncDispose).toHaveBeenCalledTimes(1);
    expect(getActiveAgentSessionCount()).toBe(0);
  });

  it("shutdownAgentSessions cancels and disposes active sessions", async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    mockSend.mockResolvedValue({
      stream: async function* () {
        await new Promise(() => {
          /* never completes */
        });
      },
      wait: vi.fn(),
      cancel,
      status: "running",
    });

    const store = new RunStore();
    const runId = "run-3";
    store.create(runId, config.resumeRepoUrl);

    void startCloudRun({
      runId,
      job,
      repoUrl: config.resumeRepoUrl,
      config,
      store,
    });

    await vi.waitFor(() => {
      expect(getActiveAgentSessionCount()).toBe(1);
    });

    await shutdownAgentSessions();

    expect(cancel).toHaveBeenCalled();
    expect(mockAsyncDispose).toHaveBeenCalled();
    expect(getActiveAgentSessionCount()).toBe(0);
  });
});
