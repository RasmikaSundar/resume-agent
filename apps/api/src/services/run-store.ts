import type {
  RunCompleteResponse,
  RunEvent,
  ServerRunStatus,
} from "@resume-agent/shared";

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_EVENTS = 500;

export interface StoredRun {
  runId: string;
  agentId?: string;
  repoUrl: string;
  status: ServerRunStatus;
  events: RunEvent[];
  result?: RunCompleteResponse;
  error?: string;
  retryable?: boolean;
  createdAt: number;
  updatedAt: number;
  purgeTimer?: ReturnType<typeof setTimeout>;
}

export class RunStore {
  private runs = new Map<string, StoredRun>();
  private activeByRepo = new Map<string, string>();

  get(runId: string): StoredRun | undefined {
    return this.runs.get(runId);
  }

  getActiveRunIdForRepo(repoUrl: string): string | undefined {
    return this.activeByRepo.get(repoUrl);
  }

  create(runId: string, repoUrl: string): StoredRun {
    const now = Date.now();
    const run: StoredRun = {
      runId,
      repoUrl,
      status: "submitting",
      events: [],
      createdAt: now,
      updatedAt: now,
    };
    this.runs.set(runId, run);
    this.activeByRepo.set(repoUrl, runId);
    return run;
  }

  appendEvent(runId: string, event: RunEvent): void {
    const run = this.runs.get(runId);
    if (!run) return;
    run.events.push(event);
    if (run.events.length > MAX_EVENTS) {
      run.events.splice(0, run.events.length - MAX_EVENTS);
    }
    run.updatedAt = Date.now();
  }

  setStatus(runId: string, status: ServerRunStatus): void {
    const run = this.runs.get(runId);
    if (!run) return;
    run.status = status;
    run.updatedAt = Date.now();
  }

  setAgentId(runId: string, agentId: string): void {
    const run = this.runs.get(runId);
    if (!run) return;
    run.agentId = agentId;
    run.updatedAt = Date.now();
  }

  complete(runId: string, result: RunCompleteResponse): void {
    const run = this.runs.get(runId);
    if (!run) return;
    run.status = result.status === "failed" ? "failed" : "succeeded";
    run.result = result;
    run.updatedAt = Date.now();
    this.activeByRepo.delete(run.repoUrl);
    this.schedulePurge(run);
  }

  fail(runId: string, error: string, retryable?: boolean): void {
    const run = this.runs.get(runId);
    if (!run) return;
    run.status = "failed";
    run.error = error;
    run.retryable = retryable;
    run.updatedAt = Date.now();
    this.activeByRepo.delete(run.repoUrl);
    this.schedulePurge(run);
  }

  private schedulePurge(run: StoredRun): void {
    if (run.purgeTimer) clearTimeout(run.purgeTimer);
    run.purgeTimer = setTimeout(() => {
      this.runs.delete(run.runId);
    }, TTL_MS);
  }
}

export function sanitizeText(text: string): string {
  return text
    .replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]")
    .replace(/cursor_[a-zA-Z0-9]+/g, "[redacted]")
    .slice(0, 4000);
}
