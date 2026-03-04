import { describe, it, expect } from "bun:test";
import { runVerifyStep, type ExecShell } from "../extensions/megapowers/subagent/pipeline-steps.js";

describe("runVerifyStep", () => {
  it("returns passed=true with exit code 0 and captures output", async () => {
    const mockExec: ExecShell = async () => ({
      exitCode: 0,
      stdout: "3 pass\n0 fail",
      stderr: "",
    });

    const result = await runVerifyStep("bun test", "/workspace", mockExec);
    expect(result.passed).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("3 pass");
    expect(typeof result.durationMs).toBe("number");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("returns passed=false with non-zero exit code", async () => {
    const mockExec: ExecShell = async () => ({
      exitCode: 1,
      stdout: "2 pass\n1 fail\nERROR: expected true to be false",
      stderr: "test failed",
    });

    const result = await runVerifyStep("bun test", "/workspace", mockExec);
    expect(result.passed).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("1 fail");
    expect(result.output).toContain("test failed");
  });
});
