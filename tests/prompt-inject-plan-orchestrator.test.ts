import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("prompt-inject plan-orchestrator wiring", () => {
  it("uses resolvePlanTemplate instead of a local plan-mode map", () => {
    const source = readFileSync(
      join(process.cwd(), "extensions", "megapowers", "prompt-inject.ts"),
      "utf-8",
    );

    expect(source).toContain("resolvePlanTemplate");
    expect(source).not.toContain("PLAN_MODE_TEMPLATES");
  });
});
