import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ClientRunPhase,
  JobExtractResult,
  JobPayload,
  RunEvent,
} from "@resume-agent/shared";
import { MIN_DESCRIPTION_LENGTH } from "@resume-agent/shared";
import { createApiClient, jobToPayload } from "./api-client.js";

type Tab = "detected" | "paste";

interface Settings {
  port: string;
  token: string;
  repoUrl: string;
}

const DEFAULT_PORT = "3847";
const ACTIVE_PHASES: ClientRunPhase[] = ["creating", "running", "succeeded", "failed"];

function formatPhaseLabel(phase: ClientRunPhase): string {
  switch (phase) {
    case "creating":
      return "Starting run…";
    case "running":
      return "Running agent…";
    case "succeeded":
      return "Done — check your PR";
    case "failed":
      return "Run failed";
    default:
      return phase;
  }
}

function phaseFromServerStatus(status: string): ClientRunPhase {
  if (status === "succeeded") return "succeeded";
  if (status === "failed") return "failed";
  return "running";
}

function phaseFromRunEvent(
  current: ClientRunPhase,
  event: RunEvent & { status?: string },
): ClientRunPhase {
  if (event.type === "complete" || event.status) {
    return event.status === "failed" ? "failed" : "succeeded";
  }
  if (current === "creating") return "creating";
  return "running";
}

function shortUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${parsed.hostname}${path}`.slice(0, 72);
  } catch {
    return url.slice(0, 72);
  }
}

async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get([
    "backendPort",
    "sharedToken",
    "resumeRepoUrl",
  ]);
  return {
    port: (stored.backendPort as string) || DEFAULT_PORT,
    token: (stored.sharedToken as string) || "",
    repoUrl: (stored.resumeRepoUrl as string) || "",
  };
}

function openOptions() {
  void chrome.runtime.openOptionsPage();
}

export function Popup() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [extract, setExtract] = useState<JobExtractResult | null>(null);
  const [tab, setTab] = useState<Tab>("detected");
  const [pasteDescription, setPasteDescription] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [phase, setPhase] = useState<ClientRunPhase>("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [result, setResult] = useState<{
    prUrl?: string | null;
    warnings?: string[];
    error?: string;
    demo?: boolean;
  } | null>(null);

  const client = useMemo(() => {
    if (!settings?.token) return null;
    return createApiClient({
      baseUrl: `http://127.0.0.1:${settings.port}`,
      token: settings.token,
    });
  }, [settings?.port, settings?.token]);

  useEffect(() => {
    void loadSettings().then(setSettings);
    chrome.runtime.sendMessage({ type: "GET_LAST_EXTRACT" }, (res) => {
      if (res?.payload) {
        setExtract(res.payload as JobExtractResult);
        if (res.payload.confidence === "low") {
          setTab("paste");
        }
      }
    });
  }, []);

  useEffect(() => {
    if (!client) return;

    void chrome.storage.local.get(["activeRunId"]).then((stored) => {
      if (stored.activeRunId) {
        setRunId(stored.activeRunId as string);
        void client.getRun(stored.activeRunId as string).then((run) => {
          if (run.status === "succeeded" || run.status === "failed") {
            setResult(run);
            setPhase(phaseFromServerStatus(run.status));
          } else {
            setPhase("running");
          }
        });
      }
    });
  }, [client]);

  const buildJob = useCallback((): JobPayload | null => {
    if (!extract && tab === "detected") return null;
    const description =
      tab === "paste" ? pasteDescription : (extract?.description ?? "");
    const title = extract?.title ?? "Role";
    const company = extract?.company ?? "Company";
    const url = extract?.url ?? "";
    return jobToPayload(
      {
        title,
        company,
        url,
        description,
        source: tab === "paste" ? "paste" : "extract",
      },
      confirmed,
    );
  }, [confirmed, extract, pasteDescription, tab]);

  const canTailor =
    confirmed &&
    (tab === "paste"
      ? pasteDescription.trim().length >= MIN_DESCRIPTION_LENGTH
      : Boolean(
          extract?.description &&
            extract.description.length >= MIN_DESCRIPTION_LENGTH,
        ));

  const isBusy = phase === "running" || phase === "creating";
  const showStatus = ACTIVE_PHASES.includes(phase);

  const startRun = async () => {
    if (!client) return;
    const job = buildJob();
    if (!job) return;

    setPhase("creating");
    setResult(null);

    try {
      const created = await client.createRun({
        job,
        repoUrl: settings?.repoUrl || undefined,
      });
      setRunId(created.runId);
      await chrome.storage.local.set({ activeRunId: created.runId });
      setPhase("running");

      const unsubscribe = client.subscribeEvents(
        created.runId,
        (event) => {
          setPhase((current) => phaseFromRunEvent(current, event));
          if (event.type === "complete" || event.status) {
            setResult(event);
            unsubscribe();
          }
        },
        () => {
          void client.getRun(created.runId).then((run) => {
            setResult(run);
            setPhase(phaseFromServerStatus(run.status));
          });
        },
      );
    } catch (err) {
      setPhase("failed");
      setResult({
        error: err instanceof Error ? err.message : "Failed to start run",
      });
    }
  };

  if (!settings) {
    return (
      <main className="popup popup--loading" aria-busy="true">
        Loading…
      </main>
    );
  }

  if (!settings.token) {
    return (
      <main className="popup">
        <header className="popup__header">
          <div className="popup__brand">
            <h1>Resume Agent</h1>
            <p>Tailor your resume for the role you&apos;re viewing</p>
          </div>
        </header>
        <section className="panel setup-panel">
          <p>
            Add your API token in Options so the extension can talk to your local
            backend.
          </p>
          <button type="button" className="btn-primary" onClick={openOptions}>
            Open settings
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="popup">
      <header className="popup__header">
        <div className="popup__brand">
          <h1>Resume Agent</h1>
          <p>Tailor for this role</p>
        </div>
        <div className="popup__header-actions">
          {result?.demo && <span className="chip chip--demo">Replay</span>}
          <button type="button" className="btn-ghost" onClick={openOptions}>
            Settings
          </button>
        </div>
      </header>

      <nav className="segmented" aria-label="Job input mode">
        <button
          type="button"
          className={tab === "detected" ? "active" : ""}
          onClick={() => setTab("detected")}
        >
          From page
        </button>
        <button
          type="button"
          className={tab === "paste" ? "active" : ""}
          onClick={() => setTab("paste")}
        >
          Paste JD
        </button>
      </nav>

      {tab === "detected" && (
        <section className="panel" aria-label="Detected job">
          {extract ? (
            <>
              <div className="job-head">
                <h2 className="job-head__title">{extract.title}</h2>
                <div className="job-head__meta">
                  <span className="job-company">{extract.company}</span>
                  {extract.confidence === "low" ? (
                    <span className="chip chip--warn">Low confidence</span>
                  ) : (
                    <span className="chip chip--success">Ready</span>
                  )}
                </div>
                {extract.url ? (
                  <p className="job-url" title={extract.url}>
                    {shortUrl(extract.url)}
                  </p>
                ) : null}
              </div>
              {extract.confidence === "low" && (
                <p className="callout callout--warn">
                  Extraction was weak — switch to Paste JD or refresh the posting
                  tab.
                </p>
              )}
              <p className="job-preview">{extract.description.slice(0, 320)}…</p>
            </>
          ) : (
            <div className="panel--empty">
              <p>No job detected on the active tab.</p>
              <ol>
                <li>Open a job posting in another tab</li>
                <li>Wait for the page to finish loading</li>
                <li>Reopen this popup</li>
              </ol>
            </div>
          )}
        </section>
      )}

      {tab === "paste" && (
        <section className="panel" aria-label="Paste job description">
          <div className="field">
            <label htmlFor="jd-paste">Job description</label>
            <textarea
              id="jd-paste"
              value={pasteDescription}
              onChange={(e) => setPasteDescription(e.target.value)}
              rows={9}
              placeholder="Paste the full job description…"
            />
          </div>
        </section>
      )}

      <label className="confirm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>I reviewed this role and want to start tailoring</span>
      </label>

      <button
        type="button"
        className="btn-primary"
        disabled={!canTailor || isBusy}
        onClick={() => void startRun()}
      >
        {isBusy ? "Working…" : "Tailor resume"}
      </button>

      {showStatus && (
        <div
          className={`status-banner status-banner--${phase}`}
          role="status"
          aria-live="polite"
        >
          <span className="status-dot" aria-hidden />
          {formatPhaseLabel(phase)}
        </div>
      )}

      {result?.warnings?.length ? (
        <ul className="warnings">
          {result.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}

      {(result?.prUrl || result?.error) && (
        <section className="panel result-block" aria-label="Run result">
          {result.prUrl ? (
            <a
              className="btn-primary"
              href={result.prUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open pull request
            </a>
          ) : null}

          {result.error ? <p className="error-text">{result.error}</p> : null}
        </section>
      )}

      {runId ? <footer className="popup__footer">Run {runId}</footer> : null}
    </main>
  );
}
