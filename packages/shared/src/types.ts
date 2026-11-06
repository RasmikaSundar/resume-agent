/** How the job description was supplied (extension → API). */
export type JobSource = "extract" | "paste";

/** Content-script extraction result (no confirmation yet). */
export interface JobExtractResult {
  title: string;
  company: string;
  url: string;
  description: string;
  confidence: "high" | "low";
}

/** Job context sent to the backend after user confirmation. */
export interface JobPayload {
  title: string;
  company: string;
  url: string;
  description: string;
  source: JobSource;
  /** Must be true for POST /runs (server-enforced AE4). */
  confirmed: boolean;
}

export interface CreateRunRequest {
  job: JobPayload;
  repoUrl?: string;
}

/** Persisted server run status. */
export type ServerRunStatus =
  | "submitting"
  | "running"
  | "succeeded"
  | "failed";

/** Popup-facing phase labels (may differ from server while connecting). */
export type ClientRunPhase =
  | "idle"
  | "creating"
  | "running"
  | "writing"
  | "opening_pr"
  | "succeeded"
  | "failed";

export type RunEventType =
  | "status"
  | "assistant"
  | "tool_call"
  | "heartbeat"
  | "complete"
  | "error";

export interface RunEvent {
  type: RunEventType;
  label?: string;
  message?: string;
  timestamp: string;
}

export interface RunCompleteResponse {
  runId: string;
  agentId?: string;
  status: ServerRunStatus;
  prUrl?: string | null;
  branch?: string | null;
  outputPaths?: {
    fitReport: string;
    tailoredResume: string;
    changeSummary: string;
  };
  warnings?: string[];
  error?: string;
  retryable?: boolean;
}

export interface CreateRunResponse {
  runId: string;
  agentId?: string;
}

export const MIN_DESCRIPTION_LENGTH = 200;

export function validateJobPayload(job: JobPayload): string | null {
  if (!job.confirmed) {
    return "Job must be confirmed before starting a run";
  }
  if (!job.title?.trim()) return "Title is required";
  if (!job.company?.trim()) return "Company is required";
  if (!job.url?.trim()) return "URL is required";
  const desc = job.description?.trim() ?? "";
  if (!desc) return "Description is required";
  if (desc.length < MIN_DESCRIPTION_LENGTH) {
    return `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters`;
  }
  if (job.source !== "extract" && job.source !== "paste") {
    return "Invalid source";
  }
  return null;
}

export function slugifySegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/** Strip trailing legal entity suffixes (e.g. "Acme Inc." → "Acme"), not "Acme Corp". */
export function stripLegalSuffix(company: string): string {
  return company
    .replace(/,?\s+(inc|llc|ltd|corporation)\.?\s*$/i, "")
    .trim();
}

export function jobOutputFolder(company: string, role: string): string {
  const companySlug = slugifySegment(stripLegalSuffix(company));
  const roleSlug = slugifySegment(role);
  return `jobs/${companySlug}/${roleSlug}`;
}
