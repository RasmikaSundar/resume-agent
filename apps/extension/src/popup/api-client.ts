import type {
  CreateRunRequest,
  CreateRunResponse,
  JobPayload,
  RunCompleteResponse,
  RunEvent,
} from "@resume-agent/shared";

const TOKEN_HEADER = "X-Resume-Agent-Token";

export interface ApiClientOptions {
  baseUrl: string;
  token: string;
}

async function backgroundFetch(
  url: string,
  init: RequestInit,
): Promise<{ ok: boolean; status: number; body?: unknown; error?: string }> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "API_FETCH", url, init },
      (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, status: 0, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response);
      },
    );
  });
}

export function createApiClient({ baseUrl, token }: ApiClientOptions) {
  const headers = {
    "Content-Type": "application/json",
    [TOKEN_HEADER]: token,
  };

  return {
    async createRun(body: CreateRunRequest): Promise<CreateRunResponse> {
      const res = await backgroundFetch(`${baseUrl}/runs`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (res.body as { error?: string })?.error ?? res.error ?? "Request failed";
        throw new Error(err);
      }
      return res.body as CreateRunResponse;
    },

    async getRun(runId: string): Promise<RunCompleteResponse & { events?: RunEvent[]; demo?: boolean }> {
      const res = await backgroundFetch(`${baseUrl}/runs/${runId}`, {
        method: "GET",
        headers: { [TOKEN_HEADER]: token },
      });
      if (!res.ok) {
        throw new Error((res.body as { error?: string })?.error ?? "Failed to load run");
      }
      return res.body as RunCompleteResponse & { events?: RunEvent[]; demo?: boolean };
    },

    subscribeEvents(
      runId: string,
      onEvent: (event: RunEvent & Partial<RunCompleteResponse>) => void,
      onError: (err: Error) => void,
    ): () => void {
      const url = `${baseUrl}/runs/${runId}/events?token=${encodeURIComponent(token)}`;
      const source = new EventSource(url);

      source.onmessage = (msg) => {
        try {
          onEvent(JSON.parse(msg.data));
        } catch {
          /* ignore parse errors */
        }
      };

      source.onerror = () => {
        onError(new Error("SSE connection lost"));
        source.close();
      };

      return () => source.close();
    },
  };
}

export function jobToPayload(
  job: Omit<JobPayload, "confirmed" | "source"> & {
    source: JobPayload["source"];
  },
  confirmed: boolean,
): JobPayload {
  return { ...job, confirmed };
}
