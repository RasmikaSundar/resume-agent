import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import {
  buildExtractResult,
  companyFromUrl,
  normalizeDescription,
} from "./extract.js";

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../../fixtures");

describe("companyFromUrl", () => {
  it("derives Cursor from cursor.com careers URL", () => {
    expect(
      companyFromUrl(
        "https://cursor.com/careers/software-engineer-billing",
      ),
    ).toBe("Cursor");
  });

  it("derives company slug from Lever job URLs", () => {
    expect(companyFromUrl("https://jobs.lever.co/acme-corp/uuid")).toBe(
      "Acme Corp",
    );
  });
});

describe("buildExtractResult", () => {
  it("marks low confidence for short descriptions", () => {
    const result = buildExtractResult({
      title: "Engineer",
      company: "Acme",
      url: "https://example.com",
      description: "short",
    });
    expect(result.confidence).toBe("low");
  });

  it("parses LinkedIn fixture with title and company", () => {
    const html = readFileSync(join(fixtureDir, "linkedin-job.html"), "utf8");
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    const title =
      doc.querySelector(".job-details-jobs-unified-top-card__job-title h1")
        ?.textContent ?? "";
    const company =
      doc
        .querySelector(".job-details-jobs-unified-top-card__company-name a")
        ?.textContent ?? "";
    const description = normalizeDescription(
      doc.querySelector("#job-details")?.textContent ?? "",
    );

    const result = buildExtractResult({
      title: title.trim(),
      company: company.trim(),
      url: "https://www.linkedin.com/jobs/view/123",
      description,
    });

    expect(result.title).toContain("Frontend Engineer");
    expect(result.company).toContain("Acme");
    expect(result.description).toMatch(/TypeScript/i);
  });
});
