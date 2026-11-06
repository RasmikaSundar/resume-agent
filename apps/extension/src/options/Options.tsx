import { useEffect, useState } from "react";

import { DEV_DEFAULTS } from "../shared/dev-defaults.js";
import "./options.css";

const DEFAULT_PORT = DEV_DEFAULTS.port;
const DEFAULT_REPO = DEV_DEFAULTS.repoUrl;

function isValidLocalPort(port: string): boolean {
  const n = Number(port);
  return Number.isInteger(n) && n > 0 && n < 65536;
}

export function Options() {
  const [port, setPort] = useState(DEFAULT_PORT);
  const [token, setToken] = useState(DEV_DEFAULTS.token);
  const [repoUrl, setRepoUrl] = useState(DEFAULT_REPO);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void chrome.storage.sync
      .get(["backendPort", "sharedToken", "resumeRepoUrl"])
      .then((s) => {
        if (s.backendPort) setPort(String(s.backendPort));
        if (s.sharedToken) setToken(String(s.sharedToken));
        if (s.resumeRepoUrl) setRepoUrl(String(s.resumeRepoUrl));
      });
  }, []);

  const save = async () => {
    if (!isValidLocalPort(port)) return;
    await chrome.storage.sync.set({
      backendPort: port,
      sharedToken: token,
      resumeRepoUrl: repoUrl,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const portInvalid = port.length > 0 && !isValidLocalPort(port);

  return (
    <main className="options">
      <header className="options__header">
        <h1>Resume Agent</h1>
        <p>
          Connect the extension to your local API on <code>127.0.0.1</code>. The
          token must match <code>RESUME_AGENT_TOKEN</code> in your backend{" "}
          <code>.env</code>.
        </p>
      </header>

      <form
        className="options__form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="field">
          <label htmlFor="api-port">API port</label>
          <input
            id="api-port"
            inputMode="numeric"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            aria-invalid={portInvalid}
          />
          {portInvalid && (
            <span className="error-text">Enter a valid port (1–65535)</span>
          )}
        </div>

        <div className="field">
          <label htmlFor="shared-token">Shared token</label>
          <input
            id="shared-token"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="repo-url">Default resume repo URL</label>
          <input
            id="repo-url"
            type="url"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/you/resume"
          />
        </div>

        <div className="options__actions">
          <button
            type="submit"
            className="btn-primary"
            disabled={portInvalid}
          >
            Save
          </button>
          {saved && <span className="save-toast">Saved</span>}
        </div>
      </form>
    </main>
  );
}
