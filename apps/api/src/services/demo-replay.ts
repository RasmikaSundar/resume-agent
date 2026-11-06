import { readFile } from "node:fs/promises";
import type { RunCompleteResponse, RunEvent } from "@resume-agent/shared";

export interface DemoFixture {
  events: RunEvent[];
  result: RunCompleteResponse;
}

export async function loadDemoFixture(path: string): Promise<DemoFixture> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as DemoFixture;
}

export function isDemoMode(fixturePath: string | undefined): boolean {
  return Boolean(fixturePath?.trim());
}

export async function replayDemoRun(
  runId: string,
  fixturePath: string,
  onEvent: (event: RunEvent) => void,
): Promise<RunCompleteResponse> {
  const fixture = await loadDemoFixture(fixturePath);
  for (const event of fixture.events) {
    onEvent(event);
    await new Promise((r) => setTimeout(r, 400));
  }
  return { ...fixture.result, runId };
}
