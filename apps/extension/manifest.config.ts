import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Resume Agent",
  version: "0.1.0",
  description: "Tailor your markdown resume for the job you're viewing — honestly.",
  action: {
    default_popup: "src/popup/index.html",
    default_title: "Resume Agent",
  },
  options_page: "src/options/index.html",
  permissions: ["storage", "activeTab", "scripting"],
  host_permissions: [
    "http://127.0.0.1/*",
    "https://www.linkedin.com/*",
    "https://linkedin.com/*",
    "https://*/*",
    "http://*/*",
  ],
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["https://www.linkedin.com/jobs/view/*", "https://linkedin.com/jobs/view/*"],
      js: ["src/content/linkedin.ts"],
      run_at: "document_idle",
    },
    {
      matches: ["<all_urls>"],
      exclude_matches: [
        "https://www.linkedin.com/jobs/view/*",
        "https://linkedin.com/jobs/view/*",
      ],
      js: ["src/content/generic.ts"],
      run_at: "document_idle",
    },
  ],
});
