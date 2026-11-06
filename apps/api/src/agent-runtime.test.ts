import { describe, expect, it } from "vitest";
import { parseAgentRuntime } from "./agent-runtime.js";

describe("parseAgentRuntime", () => {
  it("defaults to cloud", () => {
    expect(parseAgentRuntime(undefined)).toBe("cloud");
  });

  it("accepts local", () => {
    expect(parseAgentRuntime("local")).toBe("local");
  });

  it("rejects unknown values", () => {
    expect(() => parseAgentRuntime("remote")).toThrow(/AGENT_RUNTIME/);
  });
});
