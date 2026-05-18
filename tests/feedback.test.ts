import { describe, it, expect } from "bun:test";
import { ICONS, composeMessage } from "../extensions/megapowers/feedback.js";

describe("feedback vocabulary", () => {
  it("exposes a status icon vocabulary", () => {
    expect(ICONS.success).toBe("✅");
    expect(ICONS.info).toBe("📋");
    expect(ICONS.warn).toBe("⚠️");
    expect(ICONS.error).toBe("❌");
    expect(ICONS.note).toBe("📝");
  });

  it("composeMessage prepends the requested status icon", () => {
    const out = composeMessage({ icon: "success", summary: "saved" });
    expect(out.startsWith("✅ saved")).toBe(true);
  });

  it("composeMessage includes artifact path line when provided", () => {
    const out = composeMessage({
      icon: "success",
      summary: "Task 1 saved",
      artifactPath: ".megapowers/plans/001-test/tasks/task-001.md",
      nextStep: "continue with task 2",
    });
    expect(out).toContain("→ .megapowers/plans/001-test/tasks/task-001.md");
    expect(out).toContain("Next: continue with task 2");
  });

  it("composeMessage omits artifact and next-step lines when not provided", () => {
    const out = composeMessage({ icon: "info", summary: "noop" });
    expect(out).toBe("📋 noop");
    expect(out).not.toContain("→");
    expect(out).not.toContain("Next:");
  });
});
