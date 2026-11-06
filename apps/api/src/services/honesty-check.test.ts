import { describe, expect, it } from "vitest";
import {
  findHonestyWarnings,
  parseDoNotAddTerms,
} from "./honesty-check.js";

describe("parseDoNotAddTerms", () => {
  it("extracts bullets under Do not add", () => {
    const md = `# Fit report

## Do not add

- Kubernetes orchestration at scale
- HIPAA compliance lead

## Gaps
`;
    expect(parseDoNotAddTerms(md)).toEqual([
      "Kubernetes orchestration at scale",
      "HIPAA compliance lead",
    ]);
  });
});

describe("findHonestyWarnings", () => {
  it("flags when tailored resume mentions a do-not-add term (AE1)", () => {
    const warnings = findHonestyWarnings(
      "Led Kubernetes orchestration migration",
      ["Kubernetes orchestration at scale"],
    );
    expect(warnings.length).toBeGreaterThan(0);
  });
});
