/** Baked in at build time from `.env.local` (local dev only). */
export const DEV_DEFAULTS = {
  port: import.meta.env.VITE_RESUME_AGENT_PORT ?? "3847",
  token: import.meta.env.VITE_RESUME_AGENT_TOKEN ?? "",
  repoUrl:
    import.meta.env.VITE_RESUME_AGENT_REPO_URL ??
    "https://github.com/you/your-resume-repo",
};
