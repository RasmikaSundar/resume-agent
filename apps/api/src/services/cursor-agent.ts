import { Agent, CursorAgentError } from "@cursor/sdk";
import type { Run } from "@cursor/sdk";
import type { JobPayload, RunCompleteResponse } from "@resume-agent/shared";
import type { AppConfig } from "../config.js";
import { findHonestyWarnings, parseDoNotAddTerms } from "./honesty-check.js";
import { buildRunPrompt, outputPathsForJob } from "./run-prompt.js";
import { type RunStore, sanitizeText } from "./run-store.js";

export interface StartRunParams {
  runId: string;
  job: JobPayload;
  repoUrl: string;
  config: AppConfig;
  store: RunStore;
}

type SdkAgent = Awaited<ReturnType<typeof Agent.create>>;

interface ActiveSession {
  agent: SdkAgent;
  run: Run | null;
  config: AppConfig;
}

/** In-flight SDK sessions — disposed on run end and process shutdown. */
const activeSessions = new Map<string, ActiveSession>();

export function getActiveAgentSessionCount(): number {
  return activeSessions.size;
}

async function disposeAgent(session: ActiveSession): Promise<void> {
  const { agent, config } = session;
  activeSessions.delete(agent.agentId);

  if (config.agentRuntime === "cloud") {
    try {
      await Agent.archive(agent.agentId, {
        apiKey: config.cursorApiKey,
      });
    } catch {
      /* best-effort — agent may already be archived */
    }
  }

  try {
    await agent[Symbol.asyncDispose]();
  } catch {
    /* best-effort */
  }
}

/** Cancel runs and dispose all SDK agents (API shutdown). */
export async function shutdownAgentSessions(): Promise<void> {
  const sessions = [...activeSessions.values()];
  await Promise.allSettled(
    sessions.map(async (session) => {
      try {
        if (session.run?.status === "running") {
          await session.run.cancel();
        }
      } catch {
        /* ignore */
      }
      await disposeAgent(session);
    }),
  );
}

function eventLabelFromMessage(event: {
  type: string;
  message?: { content?: Array<{ type: string; text?: string }> };
}): string | undefined {
  if (event.type === "assistant" && event.message?.content) {
    for (const block of event.message.content) {
      if (block.type === "text" && block.text) {
        const snippet = sanitizeText(block.text).slice(0, 120);
        return snippet ? `Assistant: ${snippet}` : "Assistant update";
      }
    }
  }
  if (event.type === "tool_call") return "Tool call";
  return undefined;
}

async function streamRunToCompletion(
  params: StartRunParams,
  session: ActiveSession,
  run: Run,
  options: {
    completeLabel: (prUrl: string | null) => string;
    includePr: boolean;
  },
): Promise<void> {
  const { runId, job, store } = params;
  const outputPaths = outputPathsForJob(job);
  session.run = run;

  try {
    for await (const event of run.stream()) {
      const label = eventLabelFromMessage(
        event as Parameters<typeof eventLabelFromMessage>[0],
      );
      if (label) {
        store.appendEvent(runId, {
          type: event.type === "tool_call" ? "tool_call" : "assistant",
          label,
          timestamp: new Date().toISOString(),
        });
      }
    }

    const result = await run.wait();

    if (result.status === "error") {
      store.fail(runId, "Agent run failed", false);
      store.complete(runId, {
        runId,
        agentId: session.agent.agentId,
        status: "failed",
        outputPaths,
        error: "Run finished with error status",
      });
      return;
    }

    const prUrl = options.includePr
      ? (result.git?.branches?.find((b) => b.prUrl)?.prUrl ?? null)
      : null;
    const branch = result.git?.branches?.[0]?.branch ?? null;

    const response: RunCompleteResponse = {
      runId,
      agentId: session.agent.agentId,
      status: "succeeded",
      prUrl,
      branch,
      outputPaths,
      warnings: [],
    };

    store.appendEvent(runId, {
      type: "complete",
      label: options.completeLabel(prUrl),
      timestamp: new Date().toISOString(),
    });

    store.complete(runId, response);
  } catch (err) {
    const message =
      err instanceof Error ? sanitizeText(err.message) : "Stream failed";
    store.fail(runId, message);
    store.complete(runId, {
      runId,
      agentId: session.agent.agentId,
      status: "failed",
      outputPaths,
      error: message,
    });
    throw err;
  } finally {
    session.run = null;
  }
}

async function runWithAgent(
  params: StartRunParams,
  createAgent: () => Promise<SdkAgent>,
  streamOptions: {
    creatingLabel: string;
    completeLabel: (prUrl: string | null) => string;
    includePr: boolean;
  },
): Promise<void> {
  const { runId, config, store } = params;
  let session: ActiveSession | undefined;

  try {
    const agent = await createAgent();
    session = { agent, run: null, config };
    activeSessions.set(agent.agentId, session);

    store.setAgentId(runId, agent.agentId);
    store.appendEvent(runId, {
      type: "status",
      label: streamOptions.creatingLabel,
      timestamp: new Date().toISOString(),
    });

    const prompt = buildRunPrompt(params.job);
    const run = await agent.send(prompt);
    await streamRunToCompletion(params, session, run, streamOptions);
  } finally {
    if (session) {
      await disposeAgent(session);
    }
  }
}

/** Cloud agent on GitHub repo (requires Cursor ↔ GitHub integration). */
export async function startCloudRun(params: StartRunParams): Promise<void> {
  const { runId, repoUrl, config, store } = params;

  store.setStatus(runId, "running");
  store.appendEvent(runId, {
    type: "status",
    label: "Creating cloud agent",
    timestamp: new Date().toISOString(),
  });

  try {
    await runWithAgent(
      params,
      () =>
        Agent.create({
          apiKey: config.cursorApiKey,
          model: { id: "composer-2.5" },
          cloud: {
            repos: [{ url: repoUrl, startingRef: config.cloudStartingRef }],
            autoCreatePR: true,
            skipReviewerRequest: true,
          },
        }),
      {
        creatingLabel: "Agent created — sending prompt",
        completeLabel: (prUrl) =>
          prUrl ? "PR opened" : "Run complete (PR link unavailable)",
        includePr: true,
      },
    );
  } catch (err) {
    if (err instanceof CursorAgentError) {
      store.fail(runId, sanitizeText(err.message), err.isRetryable);
      throw err;
    }
    store.fail(
      runId,
      err instanceof Error ? sanitizeText(err.message) : "Unknown error",
    );
    throw err;
  }
}

/** Local agent on a cloned resume repo (runs inside this Node process). */
export async function startLocalRun(params: StartRunParams): Promise<void> {
  const { runId, config, store } = params;
  const cwd = config.localResumeRepoPath;

  store.setStatus(runId, "running");
  store.appendEvent(runId, {
    type: "status",
    label: `Creating local agent (${cwd})`,
    timestamp: new Date().toISOString(),
  });

  try {
    await runWithAgent(
      params,
      () =>
        Agent.create({
          apiKey: config.cursorApiKey,
          model: { id: "composer-2.5" },
          local: { cwd },
        }),
      {
        creatingLabel: "Local agent ready — sending prompt",
        completeLabel: () =>
          "Run complete — check git status in your local resume repo (no cloud PR)",
        includePr: false,
      },
    );
  } catch (err) {
    if (err instanceof CursorAgentError) {
      store.fail(runId, sanitizeText(err.message), err.isRetryable);
      throw err;
    }
    store.fail(
      runId,
      err instanceof Error ? sanitizeText(err.message) : "Unknown error",
    );
    throw err;
  }
}

function handleAgentRunError(params: StartRunParams, err: unknown): void {
  const { runId, store } = params;
  const run = store.get(runId);
  if (!run || run.status === "succeeded" || run.status === "failed") {
    return;
  }
  if (err instanceof CursorAgentError) {
    store.fail(runId, sanitizeText(err.message), err.isRetryable);
    return;
  }
  store.fail(
    runId,
    err instanceof Error ? sanitizeText(err.message) : "Unknown error",
  );
}

/**
 * Kick off an agent run without blocking the HTTP handler.
 * Returns 202 immediately; failures surface via run status / SSE.
 */
export function startAgentRun(params: StartRunParams): void {
  const runner =
    params.config.agentRuntime === "local" ? startLocalRun : startCloudRun;

  void runner(params).catch((err) => {
    handleAgentRunError(params, err);
  });
}

/** @deprecated Use startAgentRun */
export const startCloudRunOnly = startCloudRun;

export function attachHonestyWarnings(
  response: RunCompleteResponse,
  fitReportMarkdown: string,
  tailoredResumeMarkdown: string,
): RunCompleteResponse {
  const terms = parseDoNotAddTerms(fitReportMarkdown);
  const warnings = findHonestyWarnings(tailoredResumeMarkdown, terms);
  if (!warnings.length) return response;
  return { ...response, warnings: [...(response.warnings ?? []), ...warnings] };
}
