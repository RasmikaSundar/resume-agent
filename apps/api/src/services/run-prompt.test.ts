import { describe, expect, it } from "vitest";
import { buildRunPrompt, outputPathsForJob } from "./run-prompt.js";
import type { JobPayload } from "@resume-agent/shared";

const job: JobPayload = {
  title: "Frontend Engineer",
  company: "Acme Corp",
  url: "https://jobs.example.com/1",
  description: "x".repeat(200),
  source: "extract",
  confirmed: true,
};

describe("buildRunPrompt", () => {
  it("includes skill invocation and output paths", () => {
    const prompt = buildRunPrompt(job);
    expect(prompt).toContain("tailor-resume skill");
    expect(prompt).toContain("jobs/acme-corp/frontend-engineer/fit-report.md");
    expect(prompt).not.toMatch(/keyword stuffing/i);
  });

  it("foregrounds JD alignment without embedding ATS rules inline", () => {
    const prompt = buildRunPrompt(job);
    expect(prompt).toContain("resume.md");
    expect(prompt).not.toContain("Greenhouse");
  });
});

describe("outputPathsForJob", () => {
  it("slugifies company and role", () => {
    expect(outputPathsForJob(job).tailoredResume).toBe(
      "jobs/acme-corp/frontend-engineer/tailored-resume.md",
    );
  });
});
