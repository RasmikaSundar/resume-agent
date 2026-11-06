import { DEV_DEFAULTS } from "./dev-defaults.js";

const STORAGE_KEYS = [
  "backendPort",
  "sharedToken",
  "resumeRepoUrl",
] as const;

/** Seed chrome.storage.sync on install when values are missing. */
export async function applyDefaultSettings(): Promise<void> {
  const current = await chrome.storage.sync.get([...STORAGE_KEYS]);
  await chrome.storage.sync.set({
    backendPort: current.backendPort ?? DEV_DEFAULTS.port,
    sharedToken: current.sharedToken ?? DEV_DEFAULTS.token,
    resumeRepoUrl: current.resumeRepoUrl ?? DEV_DEFAULTS.repoUrl,
  });
}
