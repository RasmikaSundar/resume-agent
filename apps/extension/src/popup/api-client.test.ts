import { describe, expect, it } from "vitest";
import { jobToPayload } from "./api-client.js";

describe("jobToPayload", () => {
  it("sets confirmed flag for POST body (AE4)", () => {
    const payload = jobToPayload(
      {
        title: "Eng",
        company: "Acme",
        url: "https://x.com",
        description: "x".repeat(200),
        source: "paste",
      },
      true,
    );
    expect(payload.confirmed).toBe(true);
    expect(payload.source).toBe("paste");
  });
});
