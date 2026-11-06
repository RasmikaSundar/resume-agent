import { describe, expect, it } from "vitest";
import {
  jobOutputFolder,
  MIN_DESCRIPTION_LENGTH,
  slugifySegment,
  validateJobPayload,
  type JobPayload,
} from "./types.js";

function baseJob(overrides: Partial<JobPayload> = {}): JobPayload {
  return {
    title: "Frontend Engineer",
    company: "Acme Corp",
    url: "https://example.com/jobs/1",
    description: "x".repeat(MIN_DESCRIPTION_LENGTH),
    source: "extract",
    confirmed: true,
    ...overrides,
  };
}

describe("validateJobPayload", () => {
  it("accepts a valid payload", () => {
    expect(validateJobPayload(baseJob())).toBeNull();
  });

  it("rejects unconfirmed jobs", () => {
    expect(validateJobPayload(baseJob({ confirmed: false }))).toMatch(
      /confirmed/i,
    );
  });

  it("rejects empty description", () => {
    expect(validateJobPayload(baseJob({ description: "   " }))).toMatch(
      /description/i,
    );
  });

  it("rejects short description", () => {
    expect(validateJobPayload(baseJob({ description: "too short" }))).toMatch(
      /at least/i,
    );
  });

  it("rejects invalid source", () => {
    expect(
      validateJobPayload(
        baseJob({ source: "invalid" as JobPayload["source"] }),
      ),
    ).toMatch(/source/i);
  });
});

describe("slugifySegment", () => {
  it("slugifies company and role names", () => {
    expect(slugifySegment("Acme Corp")).toBe("acme-corp");
    expect(slugifySegment("Frontend Engineer")).toBe("frontend-engineer");
  });
});

describe("jobOutputFolder", () => {
  it("builds jobs/<company>/<role> path", () => {
    expect(jobOutputFolder("Acme Corp", "Frontend Engineer")).toBe(
      "jobs/acme-corp/frontend-engineer",
    );
  });
});
