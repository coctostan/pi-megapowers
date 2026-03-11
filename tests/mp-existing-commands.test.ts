import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("/mp registration compatibility", () => {
  it("keeps active standalone commands while removing deprecated /review", () => {
    const indexSource = readFileSync(join(process.cwd(), "extensions", "megapowers", "index.ts"), "utf-8");
    const commandsSource = readFileSync(join(process.cwd(), "extensions", "megapowers", "commands.ts"), "utf-8");

    expect(indexSource).toContain('pi.registerCommand("mp"');

    for (const cmd of ["mega", "issue", "triage", "phase", "done", "learn", "tdd", "task"]) {
      expect(indexSource).toContain(`pi.registerCommand("${cmd}"`);
    }

    expect(indexSource).not.toContain('pi.registerCommand("review"');
    expect(indexSource).not.toContain("handleReviewCommand");
    expect(commandsSource).not.toContain("export async function handleReviewCommand");
    expect(commandsSource).not.toContain('handleSignal(ctx.cwd, "review_approve")');
  });
});
