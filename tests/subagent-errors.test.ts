import { describe, it, expect } from "bun:test";
import { detectRepeatedErrors, type MessageLine } from "../extensions/megapowers/subagent-errors.js";

describe("detectRepeatedErrors", () => {
  it("detects same error appearing 3+ times", () => {
    const lines: MessageLine[] = [
      { type: "error", text: "TypeError: Cannot read property 'x' of undefined" },
      { type: "info", text: "Retrying..." },
      { type: "error", text: "TypeError: Cannot read property 'x' of undefined" },
      { type: "info", text: "Retrying again..." },
      { type: "error", text: "TypeError: Cannot read property 'x' of undefined" },
    ];
    const errors = detectRepeatedErrors(lines);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("TypeError");
  });

  it("returns empty array when no repeated errors", () => {
    const lines: MessageLine[] = [
      { type: "error", text: "Error A" },
      { type: "error", text: "Error B" },
    ];
    expect(detectRepeatedErrors(lines)).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(detectRepeatedErrors([])).toEqual([]);
  });

  it("detects multiple different repeated errors", () => {
    const lines: MessageLine[] = [
      { type: "error", text: "Error A" },
      { type: "error", text: "Error A" },
      { type: "error", text: "Error A" },
      { type: "error", text: "Error B" },
      { type: "error", text: "Error B" },
      { type: "error", text: "Error B" },
    ];
    const errors = detectRepeatedErrors(lines);
    expect(errors).toHaveLength(2);
  });

  it("normalizes error messages by trimming whitespace", () => {
    const lines: MessageLine[] = [
      { type: "error", text: "  Error X  " },
      { type: "error", text: "Error X" },
      { type: "error", text: "Error X " },
    ];
    const errors = detectRepeatedErrors(lines);
    expect(errors).toHaveLength(1);
  });

  it("uses configurable threshold", () => {
    const lines: MessageLine[] = [
      { type: "error", text: "Error" },
      { type: "error", text: "Error" },
    ];
    expect(detectRepeatedErrors(lines, 2)).toHaveLength(1);
    expect(detectRepeatedErrors(lines, 3)).toHaveLength(0);
  });
});
