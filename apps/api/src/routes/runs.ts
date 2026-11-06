import { randomUUID } from "node:crypto";
import {
  validateJobPayload,
  type CreateRunRequest,
  type RunCompleteResponse,
} from "@resume-agent/shared";
import { Router } from "express";
import type { AppConfig } from "../config.js";
import { runRepoKey } from "../agent-runtime.js";
import { startAgentRun } from "../services/cursor-agent.js";
import { isDemoMode, replayDemoRun } from "../services/demo-replay.js";
import { outputPathsForJob } from "../services/run-prompt.js";
import { RunStore } from "../services/run-store.js";

export function createRunsRouter(
  config: AppConfig,
  store: RunStore,
): Router {
  const router = Router();

  router.post("/", async (req, res) => {
    const body = req.body as CreateRunRequest;
    const job = body?.job;

    if (!job) {
      res.status(400).json({ error: "Missing job payload" });
      return;
    }

    if (!job.confirmed) {
      res.status(400).json({ error: "Job must be confirmed before run" });
      return;
    }

    const validationError = validateJobPayload(job);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const repoUrl = body.repoUrl?.trim() || config.resumeRepoUrl;
    if (config.agentRuntime === "cloud" && !repoUrl) {
      res.status(400).json({ error: "resume repo URL is required for cloud runs" });
      return;
    }

    const lockKey = runRepoKey(config, repoUrl);
    const activeId = store.getActiveRunIdForRepo(lockKey);
    if (activeId) {
      res.status(409).json({
        error: "A run is already in progress for this repo",
        runId: activeId,
      });
      return;
    }

    const runId = randomUUID();

    if (isDemoMode(config.demoFixturePath)) {
      store.create(runId, lockKey);
      store.setStatus(runId, "running");

      void replayDemoRun(runId, config.demoFixturePath, (event) => {
        store.appendEvent(runId, event);
      })
        .then((result) => {
          store.complete(runId, { ...result, runId });
        })
        .catch((err: Error) => {
          store.fail(runId, err.message);
        });

      res.status(202).json({ runId, demo: true });
      return;
    }

    store.create(runId, lockKey);

    startAgentRun({ runId, job, repoUrl, config, store });

    res.status(202).json({
      runId,
      agentRuntime: config.agentRuntime,
      outputPaths: outputPathsForJob(job),
    });
  });

  router.get("/:id", (req, res) => {
    const run = store.get(req.params.id);
    if (!run) {
      res.status(404).json({ error: "Run not found" });
      return;
    }

    const payload: RunCompleteResponse & {
      events?: typeof run.events;
      demo?: boolean;
    } = run.result ?? {
      runId: run.runId,
      agentId: run.agentId,
      status: run.status,
      error: run.error,
      retryable: run.retryable,
    };

    res.json({
      ...payload,
      events: run.events,
      demo: isDemoMode(config.demoFixturePath),
    });
  });

  router.get("/:id/events", (req, res) => {
    const runId = req.params.id;
    if (!store.get(runId)) {
      res.status(404).json({ error: "Run not found" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    let index = 0;
    const startedAt = Date.now();
    const SSE_MAX_MS = 2 * 60 * 60 * 1000;

    const stop = () => {
      clearInterval(tick);
      clearInterval(heartbeat);
    };

    const heartbeat = setInterval(() => {
      if (res.writableEnded) {
        stop();
        return;
      }
      res.write(
        `data: ${JSON.stringify({ type: "heartbeat", timestamp: new Date().toISOString() })}\n\n`,
      );
    }, 15000);

    const tick = setInterval(() => {
      if (res.writableEnded) {
        stop();
        return;
      }

      const run = store.get(runId);
      if (!run) {
        stop();
        res.end();
        return;
      }

      while (index < run.events.length) {
        const event = run.events[index++];
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }

      const terminal =
        run.status === "succeeded" || run.status === "failed";
      const timedOut = Date.now() - startedAt > SSE_MAX_MS;

      if (terminal || timedOut) {
        if (run.result) {
          res.write(
            `data: ${JSON.stringify({ type: "complete", ...run.result })}\n\n`,
          );
        }
        stop();
        res.end();
      }
    }, 500);

    req.on("close", stop);
  });

  return router;
}
