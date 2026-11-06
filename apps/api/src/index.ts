import cors from "cors";
import express from "express";
import { loadConfig } from "./config.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { createRunsRouter } from "./routes/runs.js";
import { shutdownAgentSessions } from "./services/cursor-agent.js";
import { RunStore } from "./services/run-store.js";

const config = loadConfig();
const store = new RunStore();
const app = express();

const allowedOrigins = new Set<string>();
if (config.devExtensionOrigin) {
  allowedOrigins.add(config.devExtensionOrigin);
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.size === 0 || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS not allowed"));
    },
    allowedHeaders: ["Content-Type", "X-Resume-Agent-Token"],
    methods: ["GET", "POST", "OPTIONS"],
  }),
);

app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    demo: Boolean(config.demoFixturePath),
    agentRuntime: config.agentRuntime,
    localResumeRepoPath:
      config.agentRuntime === "local" ? config.localResumeRepoPath : undefined,
  });
});

const auth = createAuthMiddleware(config);
app.use("/runs", auth, createRunsRouter(config, store));

const server = app.listen(config.port, "127.0.0.1", () => {
  console.log(
    `Resume Agent API listening on http://127.0.0.1:${config.port} (AGENT_RUNTIME=${config.agentRuntime})`,
  );
  if (config.agentRuntime === "local") {
    console.log(`  Local resume repo: ${config.localResumeRepoPath}`);
  }
});

async function shutdown(signal: string) {
  console.log(`${signal} — shutting down API and disposing agent sessions…`);
  server.close();
  await shutdownAgentSessions();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
