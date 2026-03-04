# Plan

### Task 1: Create pipeline-schemas.ts with ReviewFrontmatterSchema

### Task 1: Create pipeline-schemas.ts with ReviewFrontmatterSchema

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-schemas.ts`
- Test: `tests/pipeline-schemas-review.test.ts`

**Step 1 — Write the failing test**

```typescript
// tests/pipeline-schemas-review.test.ts
import { describe, it, expect } from "bun:test";
import { ReviewFrontmatterSchema } from "../extensions/megapowers/subagent/pipeline-schemas.js";

describe("ReviewFrontmatterSchema", () => {
  it("validates approve and reject verdicts and rejects invalid values", () => {
    const approve = ReviewFrontmatterSchema.safeParse({ verdict: "approve" });
    expect(approve.success).toBe(true);
    if (approve.success) expect(approve.data.verdict).toBe("approve");

    const reject = ReviewFrontmatterSchema.safeParse({ verdict: "reject" });
    expect(reject.success).toBe(true);
    if (reject.success) expect(reject.data.verdict).toBe("reject");

    const invalid = ReviewFrontmatterSchema.safeParse({ verdict: "maybe" });
    expect(invalid.success).toBe(false);

    const missing = ReviewFrontmatterSchema.safeParse({});
    expect(missing.success).toBe(false);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-schemas-review.test.ts`
Expected: FAIL — Cannot find module "../extensions/megapowers/subagent/pipeline-schemas.js"

**Step 3 — Write minimal implementation**

```typescript
// extensions/megapowers/subagent/pipeline-schemas.ts
import { z } from "zod";

export const ReviewVerdictEnum = z.enum(["approve", "reject"]);
export type ReviewVerdictValue = z.infer<typeof ReviewVerdictEnum>;

export const ReviewFrontmatterSchema = z.object({
  verdict: ReviewVerdictEnum,
});
export type ReviewFrontmatter = z.infer<typeof ReviewFrontmatterSchema>;
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-schemas-review.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 2: Define VerifyResult type and runVerifyStep shell function

### Task 2: Define VerifyResult type and runVerifyStep shell function

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-steps.ts`
- Test: `tests/pipeline-steps.test.ts`

**Step 1 — Write the failing test**

```typescript
// tests/pipeline-steps.test.ts
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
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-steps.test.ts`
Expected: FAIL — Cannot find module "../extensions/megapowers/subagent/pipeline-steps.js"

**Step 3 — Write minimal implementation**

```typescript
// extensions/megapowers/subagent/pipeline-steps.ts

export type ExecShell = (
  cmd: string,
  cwd: string,
) => Promise<{ exitCode: number; stdout: string; stderr: string }>;

export interface VerifyResult {
  passed: boolean;
  exitCode: number;
  output: string;
  durationMs: number;
}

export async function runVerifyStep(
  testCommand: string,
  cwd: string,
  exec: ExecShell,
): Promise<VerifyResult> {
  const t0 = Date.now();
  const result = await exec(testCommand, cwd);
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  return {
    passed: result.exitCode === 0,
    exitCode: result.exitCode,
    output,
    durationMs: Date.now() - t0,
  };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-steps.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 3: Define ImplementResult type

### Task 3: Define ImplementResult type

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-results.ts`
- Test: `tests/pipeline-results.test.ts`

**Step 1 — Write the failing test**

Append to `tests/pipeline-results.test.ts`:

```typescript
// Add this describe block at the end of tests/pipeline-results.test.ts
import { type ImplementResult } from "../extensions/megapowers/subagent/pipeline-results.js";

describe("ImplementResult", () => {
  it("satisfies the type contract with required and optional fields", () => {
    const result: ImplementResult = {
      filesChanged: ["src/a.ts", "tests/a.test.ts"],
      tddReport: {
        testWrittenFirst: true,
        testRanBeforeProduction: true,
        productionFilesBeforeTest: [],
        testRunCount: 2,
      },
    };
    expect(result.filesChanged).toEqual(["src/a.ts", "tests/a.test.ts"]);
    expect(result.tddReport.testWrittenFirst).toBe(true);
    expect(result.error).toBeUndefined();

    const withError: ImplementResult = {
      filesChanged: [],
      tddReport: {
        testWrittenFirst: false,
        testRanBeforeProduction: false,
        productionFilesBeforeTest: [],
        testRunCount: 0,
      },
      error: "Dispatch timed out",
    };
    expect(withError.error).toBe("Dispatch timed out");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-results.test.ts`
Expected: FAIL — "ImplementResult" is not exported from "../extensions/megapowers/subagent/pipeline-results.js"

**Step 3 — Write minimal implementation**

Add to `extensions/megapowers/subagent/pipeline-results.ts` after the existing imports:

```typescript
import type { TddComplianceReport } from "./tdd-auditor.js";

export interface ImplementResult {
  filesChanged: string[];
  tddReport: TddComplianceReport;
  error?: string;
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-results.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 4: Define ReviewResult type and parseReviewOutput with frontmatter Zod validation [depends: 1]

### Task 4: Define ReviewResult type and parseReviewOutput with frontmatter Zod validation [depends: 1]

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-results.ts`
- Test: `tests/pipeline-results.test.ts`

**Step 1 — Write the failing test**

Append to `tests/pipeline-results.test.ts`:

```typescript
import { parseReviewOutput, type ReviewResult } from "../extensions/megapowers/subagent/pipeline-results.js";

describe("parseReviewOutput", () => {
  it("parses valid frontmatter with approve verdict and extracts findings from body", () => {
    const text = `---
verdict: approve
---

Good implementation.

- Clean code structure
- Tests cover edge cases`;

    const result = parseReviewOutput(text);
    expect(result.verdict).toBe("approve");
    expect(result.findings).toEqual(["Clean code structure", "Tests cover edge cases"]);
    expect(result.raw).toBe(text);
  });

  it("parses valid frontmatter with reject verdict", () => {
    const text = `---
verdict: reject
---

Issues found:

- Missing error handling in parser
- No edge case coverage`;

    const result = parseReviewOutput(text);
    expect(result.verdict).toBe("reject");
    expect(result.findings).toEqual(["Missing error handling in parser", "No edge case coverage"]);
    expect(result.raw).toBe(text);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-results.test.ts`
Expected: FAIL — "parseReviewOutput" is not exported from "../extensions/megapowers/subagent/pipeline-results.js"

**Step 3 — Write minimal implementation**

Add to `extensions/megapowers/subagent/pipeline-results.ts`:

```typescript
import matter from "gray-matter";
import { ReviewFrontmatterSchema } from "./pipeline-schemas.js";

export interface ReviewResult {
  verdict: "approve" | "reject";
  findings: string[];
  raw: string;
}

export function parseReviewOutput(text: string): ReviewResult {
  const findings: string[] = [];

  try {
    const parsed = matter(text);
    const validation = ReviewFrontmatterSchema.safeParse(parsed.data);

    if (validation.success) {
      // Extract bullet findings from the markdown body
      for (const line of parsed.content.split("\n")) {
        const m = line.match(/^[-*]\s+(.+)/);
        if (m) findings.push(m[1].trim());
      }
      return {
        verdict: validation.data.verdict,
        findings,
        raw: text,
      };
    }

    // Invalid frontmatter data — fall through to fallback
    const errors = validation.error.issues.map((i) => i.message).join("; ");
    return {
      verdict: "reject",
      findings: [`Review parse error: invalid frontmatter — ${errors}`],
      raw: text,
    };
  } catch (err: any) {
    return {
      verdict: "reject",
      findings: [`Review parse error: ${err?.message ?? "unknown"}`],
      raw: text,
    };
  }
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-results.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 5: parseReviewOutput empty-output fallback [depends: 4]

### Task 5: parseReviewOutput empty-output fallback [depends: 4]

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-results.ts`
- Test: `tests/pipeline-results.test.ts`

**Step 1 — Write the failing test**

Append to `tests/pipeline-results.test.ts`:

```typescript
describe("parseReviewOutput empty output", () => {
  it("returns reject with a stable empty-output parse error finding", () => {
    const result = parseReviewOutput("\n\n");
    expect(result.verdict).toBe("reject");
    expect(result.findings).toEqual(["Review parse error: empty output"]);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-results.test.ts`
Expected: FAIL — `expect(received).toEqual(expected)` — Received `["Review parse error: invalid frontmatter — Required"]` because gray-matter parses `"\n\n"` as `data: {}`, Zod validation fails on the missing `verdict` field, producing the generic invalid-frontmatter message instead of the specific "empty output" message.

**Step 3 — Write minimal implementation**

Add an empty-output guard at the top of `parseReviewOutput` in `extensions/megapowers/subagent/pipeline-results.ts`. Only this guard is new; the rest of the function body from Task 4 is unchanged:

```typescript
export function parseReviewOutput(text: string): ReviewResult {
  if (!text.trim()) {
    return {
      verdict: "reject",
      findings: ["Review parse error: empty output"],
      raw: text,
    };
  }

  const findings: string[] = [];

  try {
    const parsed = matter(text);
    const validation = ReviewFrontmatterSchema.safeParse(parsed.data);

    if (validation.success) {
      for (const line of parsed.content.split("\n")) {
        const m = line.match(/^[-*]\s+(.+)/);
        if (m) findings.push(m[1].trim());
      }
      return {
        verdict: validation.data.verdict,
        findings,
        raw: text,
      };
    }

    const errors = validation.error.issues.map((i) => i.message).join("; ");
    return {
      verdict: "reject",
      findings: [`Review parse error: invalid frontmatter — ${errors}`],
      raw: text,
    };
  } catch (err: any) {
    return {
      verdict: "reject",
      findings: [`Review parse error: ${err?.message ?? "unknown"}`],
      raw: text,
    };
  }
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-results.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 6: createPipelineWorkspace returns discriminated union

### Task 6: createPipelineWorkspace returns discriminated union

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-workspace.ts`
- Test: `tests/pipeline-workspace.test.ts`

**Step 1 — Write the failing test**

Replace the existing `createPipelineWorkspace` tests in `tests/pipeline-workspace.test.ts` with discriminated union assertions:

```typescript
// In tests/pipeline-workspace.test.ts, replace the "AC14: createPipelineWorkspace" test with:

  it("createPipelineWorkspace returns ok:true with workspaceName and workspacePath on success", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };

    const r = await createPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.workspacePath).toBe("/project/.megapowers/workspaces/pipe-1");
      expect(r.workspaceName).toBe("mega-pipe-1");
    }
  });

  it("createPipelineWorkspace returns ok:false with error on failure", async () => {
    const execGit: ExecGit = async (args) => {
      if (args.includes("worktree") && args.includes("add")) {
        throw new Error("fatal: worktree add failed");
      }
      return { stdout: "", stderr: "" };
    };

    const r = await createPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("worktree add failed");
    }
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-workspace.test.ts`
Expected: FAIL — Property 'ok' does not exist on type '{ workspaceName: string; workspacePath: string; error?: string }'

**Step 3 — Write minimal implementation**

Replace the `createPipelineWorkspace` function in `extensions/megapowers/subagent/pipeline-workspace.ts`:

```typescript
export type CreateWorkspaceResult =
  | { ok: true; workspaceName: string; workspacePath: string }
  | { ok: false; error: string };

export async function createPipelineWorkspace(
  projectRoot: string,
  pipelineId: string,
  execGit: ExecGit,
): Promise<CreateWorkspaceResult> {
  const workspaceName = pipelineWorkspaceName(pipelineId);
  const workspacePath = pipelineWorkspacePath(projectRoot, pipelineId);

  try {
    mkdirSync(join(projectRoot, ".megapowers", "workspaces"), { recursive: true });
  } catch {
    // best effort; execGit surfaces actionable errors
  }

  try {
    await execGit(inDir(projectRoot, ["worktree", "add", "--detach", workspacePath]));
    return { ok: true, workspaceName, workspacePath };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "git worktree add failed" };
  }
}
```

Also update the existing test that checks `(r as any).error` in the "subagent workspace creation fails on fresh repo" section of `tests/reproduce-086-bugs.test.ts` — that test uses `(r as any).error` but will keep working since `ok: false` results still have `error`.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-workspace.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing — existing tests that use `(r as any).error` still work because the `error` field is still present on failure results. The `reproduce-086-bugs.test.ts` test uses `(r as any).error` which will be `undefined` on success results (correct).

### Task 7: createPipelineWorkspace temp-commit and reset behavior [depends: 6]

### Task 7: createPipelineWorkspace temp-commit and reset behavior [depends: 6]

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-workspace.ts`
- Test: `tests/pipeline-workspace.test.ts`

**Step 1 — Write the failing test**

Add these imports at the top of `tests/pipeline-workspace.test.ts` (extending the existing `readFileSync` import):

```typescript
import { readFileSync, mkdtempSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
```

Add these tests inside the `describe("pipeline-workspace")` block:

```typescript
  it("temp-commits with identity config before worktree add, then resets", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };

    const r = await createPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.ok).toBe(true);

    const addIdx = calls.findIndex(
      (a) => a.includes("-C") && a.includes("/project") && a.includes("add") && a.includes("-A"),
    );
    const commitIdx = calls.findIndex(
      (a) =>
        a.includes("-C") &&
        a.includes("/project") &&
        a.includes("commit") &&
        a.includes("user.name=megapowers") &&
        a.includes("user.email=megapowers@local") &&
        a.includes("--no-gpg-sign"),
    );
    const worktreeIdx = calls.findIndex(
      (a) => a.includes("worktree") && a.includes("add"),
    );
    const resetIdx = calls.findIndex(
      (a) => a.includes("-C") && a.includes("/project") && a.includes("reset") && a.includes("HEAD~1"),
    );

    expect(addIdx).toBeGreaterThanOrEqual(0);
    expect(commitIdx).toBeGreaterThan(addIdx);
    expect(worktreeIdx).toBeGreaterThan(commitIdx);
    expect(resetIdx).toBeGreaterThan(worktreeIdx);
  });

  it("resets temp commit even when worktree creation fails", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args.includes("worktree") && args.includes("add")) {
        throw new Error("worktree add failed");
      }
      return { stdout: "", stderr: "" };
    };

    const r = await createPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.ok).toBe(false);
    const resetCall = calls.find(
      (a) => a.includes("-C") && a.includes("/project") && a.includes("reset") && a.includes("HEAD~1"),
    );
    expect(resetCall).toBeDefined();
  });

  it("unstages changes if commit fails after add -A", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args.includes("commit")) throw new Error("commit failed");
      return { stdout: "", stderr: "" };
    };

    const r = await createPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.ok).toBe(false);

    // ensure we attempted to undo staging so main WD is not left in a different state
    expect(
      calls.some((a) => a.includes("-C") && a.includes("/project") && a.includes("reset") && !a.includes("HEAD~1")),
    ).toBe(true);
  });

  it("integration: worktree contains uncommitted additions from main WD (AC2)", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "ws-integ-"));
    try {
      execSync("git init", { cwd: tmp, stdio: "pipe" });
      execSync('git -c user.name=test -c user.email=test@test commit --allow-empty -m "init"', {
        cwd: tmp,
        stdio: "pipe",
      });

      // Create uncommitted file (the core bug case)
      writeFileSync(join(tmp, "new-file.ts"), "export const x = 1;");

      const realExecGit: ExecGit = async (args) => {
        const result = execSync(`git ${args.join(" ")}`, { stdio: "pipe", encoding: "utf-8" });
        return { stdout: String(result), stderr: "" };
      };

      const r = await createPipelineWorkspace(tmp, "integ-1", realExecGit);
      expect(r.ok).toBe(true);
      if (r.ok) {
        // AC2: The new file should exist in the worktree
        expect(existsSync(join(r.workspacePath, "new-file.ts"))).toBe(true);
        expect(readFileSync(join(r.workspacePath, "new-file.ts"), "utf-8")).toBe("export const x = 1;");
      }

      // AC1: Main WD should be unchanged (reset happened)
      expect(existsSync(join(tmp, "new-file.ts"))).toBe(true);
    } finally {
      try {
        execSync(
          `git -C "${tmp}" worktree remove --force "${join(tmp, ".megapowers", "workspaces", "integ-1")}"`,
          { stdio: "pipe" },
        );
      } catch {}
      rmSync(tmp, { recursive: true, force: true });
    }
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-workspace.test.ts`
Expected: FAIL — `expect(received).toBeGreaterThanOrEqual(expected)` — Expected >= 0, Received -1 (no `add -A` call in current implementation; Task 6's `createPipelineWorkspace` only does `worktree add`). The integration test also fails: `expect(received).toBe(expected)` — Expected true, Received false (worktree doesn't contain uncommitted file because no temp commit was made).

**Step 3 — Write minimal implementation**

Replace the `createPipelineWorkspace` function in `extensions/megapowers/subagent/pipeline-workspace.ts`:

```typescript
export async function createPipelineWorkspace(
  projectRoot: string,
  pipelineId: string,
  execGit: ExecGit,
): Promise<CreateWorkspaceResult> {
  const workspaceName = pipelineWorkspaceName(pipelineId);
  const workspacePath = pipelineWorkspacePath(projectRoot, pipelineId);
  try {
    mkdirSync(join(projectRoot, ".megapowers", "workspaces"), { recursive: true });
  } catch {
    // best effort
  }
  // AC1/AC2: Temp-commit all uncommitted changes (including untracked) with injected identity
  let stagedAll = false;
  let tempCommitted = false;
  let worktreeError: string | undefined;
  try {
    await execGit(inDir(projectRoot, ["add", "-A"]));
    stagedAll = true;
    await execGit(
      inDir(projectRoot, [
        "-c",
        "user.name=megapowers",
        "-c",
        "user.email=megapowers@local",
        "commit",
        "--allow-empty",
        "--no-gpg-sign",
        "-m",
        "temp-pipeline-commit",
      ]),
    );
    tempCommitted = true;
    await execGit(inDir(projectRoot, ["worktree", "add", "--detach", workspacePath]));
  } catch (err) {
    worktreeError = err instanceof Error ? err.message : String(err);
  } finally {
    // If we staged but never successfully created the temp commit, undo staging.
    if (stagedAll && !tempCommitted) {
      try { await execGit(inDir(projectRoot, ["reset"])); } catch {}
    }
  }
  // AC1/AC5: always reset if temp commit succeeded, even on worktree failure
  if (tempCommitted) {
    try {
      await execGit(inDir(projectRoot, ["reset", "HEAD~1"]));
    } catch (resetErr) {
      const resetMsg = resetErr instanceof Error ? resetErr.message : String(resetErr);
      const combined = worktreeError
        ? `${worktreeError}; reset failed: ${resetMsg}`
        : `Worktree created but reset failed: ${resetMsg}`;
      return { ok: false, error: combined };
    }
  }
  if (worktreeError) {
    return { ok: false, error: worktreeError };
  }
  return { ok: true, workspaceName, workspacePath };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-workspace.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 8: squashPipelineWorkspace returns discriminated union

### Task 8: squashPipelineWorkspace returns discriminated union

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-workspace.ts`
- Test: `tests/pipeline-workspace.test.ts`

**Step 1 — Write the failing test**

Replace the existing squash tests in `tests/pipeline-workspace.test.ts`:

```typescript
  it("squashPipelineWorkspace returns ok:true on success", async () => {
    const execGit: ExecGit = async (args) => {
      if (args.includes("diff") && args.includes("--cached") && !args.includes("--name-only"))
        return { stdout: "diff --git a/a.ts b/a.ts\n+x", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const r = await squashPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.ok).toBe(true);
  });

  it("squashPipelineWorkspace returns ok:true when there are no changes", async () => {
    const execGit: ExecGit = async (args) => {
      // --name-only returns empty = no changed files
      return { stdout: "", stderr: "" };
    };

    const r = await squashPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.ok).toBe(true);
  });

  it("squashPipelineWorkspace returns ok:false on failure and preserves worktree", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args.includes("diff") && args.includes("--cached") && !args.includes("--name-only"))
        return { stdout: "diff content", stderr: "" };
      if (args[0] === "apply") throw new Error("git apply failed");
      return { stdout: "", stderr: "" };
    };

    const r = await squashPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("apply");
    }
    // No worktree remove on failure
    expect(calls.some((a) => a.includes("worktree") && a.includes("remove"))).toBe(false);
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-workspace.test.ts`
Expected: FAIL — Property 'ok' does not exist on type '{ error?: string }'

**Step 3 — Write minimal implementation**

Update `squashPipelineWorkspace` in `extensions/megapowers/subagent/pipeline-workspace.ts` to return discriminated union. Keep the existing `git apply` logic for now (Task 9 replaces it with file-copy):

```typescript
export type SquashWorkspaceResult = { ok: true } | { ok: false; error: string };

export async function squashPipelineWorkspace(
  projectRoot: string,
  pipelineId: string,
  execGit: ExecGit,
): Promise<SquashWorkspaceResult> {
  const workspacePath = pipelineWorkspacePath(projectRoot, pipelineId);

  try {
    await execGit(inDir(workspacePath, ["add", "-A"]));
    const diff = await execGit(inDir(workspacePath, ["diff", "--cached", "HEAD"]));

    if (!diff.stdout.trim()) {
      try {
        await execGit(inDir(projectRoot, ["worktree", "remove", "--force", workspacePath]));
      } catch {
        // ignore cleanup failure
      }
      return { ok: true };
    }

    const patchPath = join(tmpdir(), `mega-squash-${pipelineId}.patch`);
    writeFileSync(patchPath, diff.stdout);
    await execGit(["apply", "--allow-empty", patchPath]);

    try {
      await execGit(inDir(projectRoot, ["worktree", "remove", "--force", workspacePath]));
    } catch {
      // ignore cleanup failure
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "git squash failed" };
  }
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-workspace.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing — existing callers use `(squash as any).error` which still returns `undefined` on success (ok:true has no error field) and the error string on failure.

### Task 9: squashPipelineWorkspace uses file-copy instead of git apply [depends: 7, 8]

### Task 9: squashPipelineWorkspace uses file-copy instead of git apply [depends: 7, 8]

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-workspace.ts`
- Modify: `tests/pipeline-workspace.test.ts`
- Modify: `tests/oneshot-tool.test.ts`

**Step 1 — Write the failing test**

Add `mkdirSync` to the existing `node:fs` import in `tests/pipeline-workspace.test.ts` (which already has `readFileSync, mkdtempSync, writeFileSync, existsSync, rmSync` from Task 7):

```typescript
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
```

Add these tests inside the `describe("pipeline-workspace")` block:

```typescript
  it("squash copies changed files from worktree to project root (file-copy, not git apply)", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "squash-copy-"));
    const wsPath = join(projectRoot, ".megapowers", "workspaces", "pipe-1");
    mkdirSync(join(wsPath, "src"), { recursive: true });
    mkdirSync(join(projectRoot, "src"), { recursive: true });
    writeFileSync(join(wsPath, "src", "new.ts"), "export const x = 1;");
    writeFileSync(join(wsPath, "src", "modified.ts"), "updated content");
    writeFileSync(join(projectRoot, "src", "modified.ts"), "old content");
    const execGit: ExecGit = async (args) => {
      if (args.includes("--name-only") && args.includes("--diff-filter=AMCR")) {
        return { stdout: "src/new.ts\nsrc/modified.ts\n", stderr: "" };
      }
      if (args.includes("--name-only") && args.includes("--diff-filter=D")) {
        return { stdout: "", stderr: "" };
      }
      if (args.includes("--name-status") && args.includes("--diff-filter=R")) {
        return { stdout: "", stderr: "" };
      }
      return { stdout: "", stderr: "" };
    };

    const r = await squashPipelineWorkspace(projectRoot, "pipe-1", execGit);
    expect(r.ok).toBe(true);
    expect(readFileSync(join(projectRoot, "src", "new.ts"), "utf-8")).toBe("export const x = 1;");
    expect(readFileSync(join(projectRoot, "src", "modified.ts"), "utf-8")).toBe("updated content");
    rmSync(projectRoot, { recursive: true, force: true });
  });
  it("squash deletes files identified by diff-filter=D", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "squash-del-"));
    const wsPath = join(projectRoot, ".megapowers", "workspaces", "pipe-1");
    mkdirSync(wsPath, { recursive: true });

    writeFileSync(join(projectRoot, "old.ts"), "to be removed");

    const execGit: ExecGit = async (args) => {
      if (args.includes("--name-only") && args.includes("--diff-filter=AMCR")) {
        return { stdout: "", stderr: "" };
      }
      if (args.includes("--name-only") && args.includes("--diff-filter=D")) {
        return { stdout: "old.ts\n", stderr: "" };
      }
      if (args.includes("--name-status") && args.includes("--diff-filter=R")) {
        return { stdout: "", stderr: "" };
      }
      return { stdout: "", stderr: "" };
    };

    const r = await squashPipelineWorkspace(projectRoot, "pipe-1", execGit);
    expect(r.ok).toBe(true);
    expect(existsSync(join(projectRoot, "old.ts"))).toBe(false);
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it("squash handles renames by copying new path and deleting old path", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "squash-rename-"));
    const wsPath = join(projectRoot, ".megapowers", "workspaces", "pipe-1");
    mkdirSync(wsPath, { recursive: true });

    // old/path.ts exists in project root (the rename source)
    writeFileSync(join(projectRoot, "old", "path.ts"), "old content");
    // new/path.ts exists in worktree (the rename destination)
    mkdirSync(join(wsPath, "new"), { recursive: true });
    writeFileSync(join(wsPath, "new", "path.ts"), "renamed content");
    mkdirSync(join(projectRoot, "old"), { recursive: true });

    const execGit: ExecGit = async (args) => {
      if (args.includes("--name-only") && args.includes("--diff-filter=AMCR")) {
        return { stdout: "new/path.ts\n", stderr: "" };
      }
      if (args.includes("--name-only") && args.includes("--diff-filter=D")) {
        return { stdout: "", stderr: "" };
      }
      if (args.includes("--name-status") && args.includes("--diff-filter=R")) {
        return { stdout: "R100\told/path.ts\tnew/path.ts\n", stderr: "" };
      }
      return { stdout: "", stderr: "" };
    };

    const r = await squashPipelineWorkspace(projectRoot, "pipe-1", execGit);
    expect(r.ok).toBe(true);
    // new path was copied
    expect(readFileSync(join(projectRoot, "new", "path.ts"), "utf-8")).toBe("renamed content");
    // old path was removed
    expect(existsSync(join(projectRoot, "old", "path.ts"))).toBe(false);

    rmSync(projectRoot, { recursive: true, force: true });
  });
```

Also update the existing failure test (from Task 8) in `tests/pipeline-workspace.test.ts` to trigger failure via the name-only diff instead of `git apply`. Replace the `"squashPipelineWorkspace returns ok:false on failure and preserves worktree"` test with:

```typescript
  it("squashPipelineWorkspace returns ok:false on failure and preserves worktree", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args.includes("--name-only") && args.includes("--diff-filter=AMCR")) {
        throw new Error("diff name-only failed");
      }
      return { stdout: "", stderr: "" };
    };

    const r = await squashPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("diff name-only failed");
    }
    // No worktree remove on failure
    expect(calls.some((a) => a.includes("worktree") && a.includes("remove"))).toBe(false);
  });
```

Also update `tests/oneshot-tool.test.ts` — replace the squash failure mock in the `"returns an error when squash fails after successful dispatch"` test to trigger on the name-only diff instead of `git apply`:

```typescript
  it("returns an error when squash fails after successful dispatch", async () => {
    const execGit = async (args: string[]) => {
      if (args.includes("--name-only") && args.includes("--diff-filter=AMCR")) {
        throw new Error("diff name-only failed: squash boom");
      }
      return { stdout: "", stderr: "" };
    };

    const dispatcher: Dispatcher = {
      async dispatch() {
        return {
          exitCode: 0,
          messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "ok" }] }] as any,
          filesChanged: [],
          testsPassed: null,
        };
      },
    };

    const r = await handleOneshotTool(tmp, { task: "do it" }, dispatcher, execGit);
    expect(r.error).toContain("Squash failed");
    expect(r.error).toContain("diff name-only failed");
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-workspace.test.ts`
Expected: FAIL — `readFileSync(join(projectRoot, "src", "new.ts"))` throws `Error: ENOENT: no such file or directory` because the current implementation uses `git apply` (which writes via a patch file), not file-copy. The new file was never copied to the project root.

**Step 3 — Write minimal implementation**

Update the imports at the top of `extensions/megapowers/subagent/pipeline-workspace.ts`:

```typescript
import { join, dirname } from "node:path";
import { mkdirSync, copyFileSync, unlinkSync, existsSync } from "node:fs";
```

Remove `writeFileSync` from the `node:fs` import and `tmpdir` from `node:os` (no longer needed — the `patchPath` logic is removed).

Replace `squashPipelineWorkspace` in `extensions/megapowers/subagent/pipeline-workspace.ts`:

```typescript
export async function squashPipelineWorkspace(
  projectRoot: string,
  pipelineId: string,
  execGit: ExecGit,
): Promise<SquashWorkspaceResult> {
  const workspacePath = pipelineWorkspacePath(projectRoot, pipelineId);
  try {
    await execGit(inDir(workspacePath, ["add", "-A"]));
    const changed = await execGit(
      inDir(workspacePath, ["diff", "--cached", "--name-only", "--diff-filter=AMCR"]),
    );
    // AC7: Get deleted files
    const deleted = await execGit(
      inDir(workspacePath, ["diff", "--cached", "--name-only", "--diff-filter=D"]),
    );
    // Get rename entries to clean up old paths
    const renames = await execGit(
      inDir(workspacePath, ["diff", "--cached", "--name-status", "--diff-filter=R"]),
    );
    const changedFiles = changed.stdout.trim().split("\n").filter(Boolean);
    const deletedFiles = deleted.stdout.trim().split("\n").filter(Boolean);
    // Parse rename lines: "R100\told/path.ts\tnew/path.ts"
    const renameOldPaths: string[] = [];
    for (const line of renames.stdout.trim().split("\n").filter(Boolean)) {
      const parts = line.split("\t");
      if (parts.length >= 2) {
        renameOldPaths.push(parts[1]);
      }
    }
    // Copy changed files from worktree to main WD
    for (const file of changedFiles) {
      const src = join(workspacePath, file);
      const dest = join(projectRoot, file);
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(src, dest);
    }
    // Remove deleted files from main WD
    for (const file of deletedFiles) {
      const dest = join(projectRoot, file);
      if (existsSync(dest)) {
        unlinkSync(dest);
      }
    }

    // Remove old paths from renames
    for (const file of renameOldPaths) {
      const dest = join(projectRoot, file);
      if (existsSync(dest)) {
        unlinkSync(dest);
      }
    }
    // Clean up worktree
    try {
      await execGit(inDir(projectRoot, ["worktree", "remove", "--force", workspacePath]));
    } catch {
      // ignore cleanup failure
    }
    return { ok: true };
  } catch (err: any) {
    // AC9: preserve worktree for inspection on failure
    return { ok: false, error: err?.message ?? "git squash failed" };
  }
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-workspace.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing — the updated failure mocks in `tests/pipeline-workspace.test.ts` and `tests/oneshot-tool.test.ts` now trigger failure via the name-only diff command instead of `git apply`, which matches the new file-copy implementation.

### Task 10: cleanupPipelineWorkspace returns discriminated union

### Task 10: cleanupPipelineWorkspace returns discriminated union

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-workspace.ts`
- Test: `tests/pipeline-workspace.test.ts`

**Step 1 — Write the failing test**

Replace the existing cleanup test in `tests/pipeline-workspace.test.ts`:

```typescript
  it("cleanupPipelineWorkspace returns ok:true on success", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };

    const r = await cleanupPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.ok).toBe(true);
    expect(calls).toContainEqual([
      "-C", "/project", "worktree", "remove", "--force",
      "/project/.megapowers/workspaces/pipe-1",
    ]);
  });

  it("cleanupPipelineWorkspace returns ok:false with error on failure", async () => {
    const execGit: ExecGit = async (args) => {
      if (args.includes("worktree") && args.includes("remove")) {
        throw new Error("worktree remove failed: not a valid directory");
      }
      return { stdout: "", stderr: "" };
    };

    const r = await cleanupPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("worktree remove failed");
    }
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-workspace.test.ts`
Expected: FAIL — Property 'ok' does not exist on type '{ error?: string }'

**Step 3 — Write minimal implementation**

Update `cleanupPipelineWorkspace` in `extensions/megapowers/subagent/pipeline-workspace.ts`:

```typescript
export type CleanupWorkspaceResult = { ok: true } | { ok: false; error: string };

export async function cleanupPipelineWorkspace(
  projectRoot: string,
  pipelineId: string,
  execGit: ExecGit,
): Promise<CleanupWorkspaceResult> {
  const workspacePath = pipelineWorkspacePath(projectRoot, pipelineId);

  try {
    await execGit(inDir(projectRoot, ["worktree", "remove", "--force", workspacePath]));
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "git worktree remove failed" };
  }
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-workspace.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 11: Update oneshot-tool.ts to use discriminated union checks [depends: 6, 8, 10]

### Task 11: Update oneshot-tool.ts to use discriminated union checks [depends: 6, 8, 10]

**Files:**
- Modify: `extensions/megapowers/subagent/oneshot-tool.ts`
- Test: `tests/oneshot-tool.test.ts`

**Step 1 — Write the failing test**

Add to `tests/oneshot-tool.test.ts`:

```typescript
  it("uses discriminated union checks (no as-any casts)", async () => {
    // Verify the source code has no (as any).error casts
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(process.cwd(), "extensions/megapowers/subagent/oneshot-tool.ts"),
      "utf-8",
    );
    expect(source).not.toContain("(ws as any).error");
    expect(source).not.toContain("(squash as any).error");
    expect(source).not.toContain("(cleanup as any).error");
    // Should use .ok checks instead
    expect(source).toContain(".ok");
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/oneshot-tool.test.ts`
Expected: FAIL — Expected source to not contain "(ws as any).error" (current code has 3 `(as any).error` casts)

**Step 3 — Write minimal implementation**

Replace `handleOneshotTool` in `extensions/megapowers/subagent/oneshot-tool.ts`:

```typescript
import type { Dispatcher } from "./dispatcher.js";
import { readState } from "../state/state-io.js";
import {
  createPipelineWorkspace,
  squashPipelineWorkspace,
  cleanupPipelineWorkspace,
  type ExecGit,
} from "./pipeline-workspace.js";
import { parseStepResult } from "./pipeline-results.js";

export interface OneshotToolInput {
  task: string;
  agent?: string;
  timeoutMs?: number;
}

export interface OneshotToolOutput {
  id: string;
  output?: string;
  filesChanged?: string[];
  error?: string;
}

export async function handleOneshotTool(
  projectRoot: string,
  input: OneshotToolInput,
  dispatcher: Dispatcher,
  execGit: ExecGit,
): Promise<OneshotToolOutput> {
  const state = readState(projectRoot);
  if (!state.megaEnabled) return { id: "", error: "Megapowers is disabled." };

  const id = `oneshot-${Date.now()}`;

  const ws = await createPipelineWorkspace(projectRoot, id, execGit);
  if (!ws.ok) return { id, error: `Workspace creation failed: ${ws.error}` };

  const dispatch = await dispatcher.dispatch({
    agent: input.agent ?? "worker",
    task: input.task,
    cwd: ws.workspacePath,
    timeoutMs: input.timeoutMs,
  });

  const parsed = parseStepResult(dispatch);

  let workspaceError: string | undefined;

  if (dispatch.exitCode === 0) {
    const squash = await squashPipelineWorkspace(projectRoot, id, execGit);
    if (!squash.ok) workspaceError = `Squash failed: ${squash.error}`;
  } else {
    const cleanup = await cleanupPipelineWorkspace(projectRoot, id, execGit);
    if (!cleanup.ok) workspaceError = `Cleanup failed: ${cleanup.error}`;
  }

  return {
    id,
    output: parsed.finalOutput || undefined,
    filesChanged: parsed.filesChanged.length ? parsed.filesChanged : undefined,
    error: workspaceError ?? (dispatch.exitCode === 0 ? undefined : dispatch.error ?? parsed.error),
  };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/oneshot-tool.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 12: Update pipeline-tool.ts to use discriminated union checks [depends: 6, 8]

### Task 12: Update pipeline-tool.ts to use discriminated union checks [depends: 6, 8]

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-tool.ts`
- Test: `tests/pipeline-tool.test.ts`

**Step 1 — Write the failing test**

Add to `tests/pipeline-tool.test.ts`:

```typescript
  it("uses discriminated union checks (no as-any casts)", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(process.cwd(), "extensions/megapowers/subagent/pipeline-tool.ts"),
      "utf-8",
    );
    expect(source).not.toContain("(ws as any).error");
    expect(source).not.toContain("(squash as any).error");
    // Should use .ok checks instead
    expect(source).toContain(".ok");
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-tool.test.ts`
Expected: FAIL — Expected source to not contain "(ws as any).error" (line 90 has `(ws as any).error`, line 120 has `(squash as any).error`)

**Step 3 — Write minimal implementation**

In `extensions/megapowers/subagent/pipeline-tool.ts`, replace the two `(as any).error` casts:

**Line ~89-91** (workspace creation):
```typescript
    const ws = await createPipelineWorkspace(projectRoot, pipelineId, execGit);
    if (!ws.ok) return { error: `Workspace creation failed: ${ws.error}` };
    workspacePath = ws.workspacePath;
```

**Line ~118-120** (squash):
```typescript
  if (result.status === "completed") {
    const squash = await squashPipelineWorkspace(projectRoot, pipelineId, execGit);
    if (!squash.ok) return { error: `Squash failed: ${squash.error}`, pipelineId, result };
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-tool.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 13: Add bounded pipeline context API (V2) in new file

### Task 13: Add bounded pipeline context API (V2) in new file

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-context-bounded.ts`
- Create: `tests/pipeline-context-bounded.test.ts`

Existing `pipeline-context.ts` and `tests/pipeline-context.test.ts` are left untouched. The new bounded API lives in a separate file. Task 14 switches the runner to import from this file.

**Step 1 — Write the failing test**

Create `tests/pipeline-context-bounded.test.ts`:

```typescript
// tests/pipeline-context-bounded.test.ts
import { describe, it, expect } from "bun:test";
import {
  buildInitialContext,
  withRetryContext,
  renderContextPrompt,
  type BoundedPipelineContext,
} from "../extensions/megapowers/subagent/pipeline-context-bounded.js";

describe("pipeline context (bounded)", () => {
  it("builds initial context without retry data", () => {
    const ctx = buildInitialContext({
      taskDescription: "Implement parser",
      planSection: "### Task 1: Parser",
      specContent: "AC1: parse input",
      learnings: "Use bun test",
    });

    const prompt = renderContextPrompt(ctx);
    expect(prompt).toContain("Implement parser");
    expect(prompt).toContain("### Task 1: Parser");
    expect(prompt).toContain("AC1");
    expect(prompt).toContain("Use bun test");
    expect(prompt).not.toContain("Retry");
  });

  it("withRetryContext adds bounded failure data that replaces on each call", () => {
    let ctx = buildInitialContext({ taskDescription: "x" });

    ctx = withRetryContext(ctx, {
      reason: "verify_failed",
      detail: "1 fail\nExpected true to be false at line 12",
    });

    let prompt = renderContextPrompt(ctx);
    expect(prompt).toContain("verify_failed");
    expect(prompt).toContain("Expected true to be false");

    // Second retry REPLACES (not accumulates)
    ctx = withRetryContext(ctx, {
      reason: "review_rejected",
      detail: "Missing error handling",
    });

    prompt = renderContextPrompt(ctx);
    expect(prompt).toContain("review_rejected");
    expect(prompt).toContain("Missing error handling");
    // Old retry data is gone
    expect(prompt).not.toContain("Expected true to be false");
  });

  it("context size is O(1) — does not grow with repeated retries", () => {
    let ctx = buildInitialContext({
      taskDescription: "Implement feature",
      planSection: "### Task 1",
      specContent: "AC1: do thing",
    });

    const baseSize = renderContextPrompt(ctx).length;

    // Simulate 10 retries
    for (let i = 0; i < 10; i++) {
      ctx = withRetryContext(ctx, {
        reason: "verify_failed",
        detail: `Failure output for cycle ${i}`,
      });
    }

    const finalSize = renderContextPrompt(ctx).length;
    // Should be base + one retry section, not base + 10 retry sections
    expect(finalSize).toBeLessThan(baseSize + 500);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-context-bounded.test.ts`
Expected: FAIL — `error: Cannot find module "../extensions/megapowers/subagent/pipeline-context-bounded.js"` (file does not exist yet).

**Step 3 — Write minimal implementation**

Create `extensions/megapowers/subagent/pipeline-context-bounded.ts`:

```typescript
// extensions/megapowers/subagent/pipeline-context-bounded.ts

export type RetryReason =
  | "implement_failed"
  | "verify_failed"
  | "review_rejected"
  | "review_failed";

export interface RetryContext {
  reason: RetryReason;
  detail: string;
}

export interface BoundedPipelineContext {
  taskDescription: string;
  planSection?: string;
  specContent?: string;
  learnings?: string;
  retryContext?: RetryContext;
}

export function buildInitialContext(input: {
  taskDescription: string;
  planSection?: string;
  specContent?: string;
  learnings?: string;
}): BoundedPipelineContext {
  return {
    taskDescription: input.taskDescription,
    planSection: input.planSection,
    specContent: input.specContent,
    learnings: input.learnings,
  };
}

export function withRetryContext(
  ctx: BoundedPipelineContext,
  retry: RetryContext,
): BoundedPipelineContext {
  return { ...ctx, retryContext: retry };
}

export function renderContextPrompt(ctx: BoundedPipelineContext): string {
  const sections: string[] = [];
  sections.push(`## Task\n\n${ctx.taskDescription}`);

  if (ctx.planSection) sections.push(`## Plan\n\n${ctx.planSection}`);
  if (ctx.specContent) sections.push(`## Spec / Acceptance Criteria\n\n${ctx.specContent}`);
  if (ctx.learnings) sections.push(`## Project Learnings\n\n${ctx.learnings}`);

  if (ctx.retryContext) {
    sections.push(
      `## Retry Context\n\nReason: ${ctx.retryContext.reason}\n\n${ctx.retryContext.detail}`,
    );
  }

  return sections.join("\n\n");
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-context-bounded.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing — the existing `pipeline-context.ts` and `tests/pipeline-context.test.ts` are completely untouched. The new bounded API is purely additive.

### Task 14: Refactor runPipeline: shell verify, frontmatter review, bounded context, structured result with infrastructure error separation [depends: 2, 3, 4, 5, 12, 13]

### Task 14: Refactor runPipeline: shell verify, frontmatter review, bounded context, structured result with infrastructure error separation [depends: 2, 3, 4, 5, 12, 13]

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-runner.ts`
- Modify: `extensions/megapowers/subagent/pipeline-tool.ts`
- Test: `tests/pipeline-runner.test.ts`

**Step 1 — Write the failing test**

Replace the entire `tests/pipeline-runner.test.ts`:

```typescript
// tests/pipeline-runner.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runPipeline } from "../extensions/megapowers/subagent/pipeline-runner.js";
import type { Dispatcher, DispatchConfig, DispatchResult } from "../extensions/megapowers/subagent/dispatcher.js";
import type { ExecShell } from "../extensions/megapowers/subagent/pipeline-steps.js";

let projectRoot: string;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), "pipeline-runner-"));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

function mkDispatch(exitCode: number, extra?: Partial<DispatchResult>): DispatchResult {
  return {
    exitCode,
    messages: [],
    filesChanged: [],
    testsPassed: null,
    ...extra,
  };
}

const passingShell: ExecShell = async () => ({
  exitCode: 0,
  stdout: "3 pass\n0 fail",
  stderr: "",
});

const failingShell: ExecShell = async () => ({
  exitCode: 1,
  stdout: "2 pass\n1 fail\nERROR: expected true to be false at tests/foo.test.ts:12",
  stderr: "",
});

describe("runPipeline (refactored)", () => {
  it("happy path: implement -> shell verify -> frontmatter review => completed", async () => {
    const called: string[] = [];

    const dispatcher: Dispatcher = {
      async dispatch(cfg: DispatchConfig) {
        called.push(cfg.agent);
        if (cfg.agent === "implementer") {
          return mkDispatch(0, {
            messages: [
              {
                role: "assistant" as const,
                content: [{ type: "tool_use" as const, id: "1", name: "write", input: { path: "src/a.ts" } }],
              },
            ] as any,
          });
        }
        if (cfg.agent === "reviewer") {
          return mkDispatch(0, {
            messages: [{
              role: "assistant" as const,
              content: [{ type: "text" as const, text: "---\nverdict: approve\n---\n\nLooks good.\n\n- Clean code" }],
            }] as any,
          });
        }
        return mkDispatch(1, { error: "unknown" });
      },
    };

    const r = await runPipeline(
      { taskDescription: "Do task", planSection: "### Task 1" },
      dispatcher,
      {
        projectRoot,
        workspaceCwd: join(projectRoot, "workspace"),
        pipelineId: "pipe",
        agents: { implementer: "implementer", reviewer: "reviewer" },
        testCommand: "bun test",
        execShell: passingShell,
        execGit: async (args) => {
          if (args.includes("--stat")) return { stdout: "src/a.ts | 2 ++\n", stderr: "" };
          if (args.includes("diff") && args.includes("--cached") && !args.includes("--stat"))
            return { stdout: "diff --git ...", stderr: "" };
          return { stdout: "", stderr: "" };
        },
      },
    );

    expect(r.status).toBe("completed");
    expect(r.filesChanged).toEqual(["src/a.ts"]);
    expect(r.reviewVerdict).toBe("approve");
    expect(r.testsPassed).toBe(true);
    expect(r.testOutput).toContain("3 pass");
    expect(r.infrastructureError).toBeUndefined();
    // Only 2 agents dispatched (no verifier)
    expect(called).toEqual(["implementer", "reviewer"]);
  });

  it("verify failure retries with bounded test output (not accumulated)", async () => {
    let implCount = 0;
    let secondImplContext: string | undefined;

    const dispatcher: Dispatcher = {
      async dispatch(cfg) {
        if (cfg.agent === "implementer") {
          implCount++;
          if (implCount === 2) secondImplContext = cfg.context;
          return mkDispatch(0, { messages: [] as any });
        }
        return mkDispatch(0, {
          messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "---\nverdict: approve\n---\n" }] }] as any,
        });
      },
    };

    const r = await runPipeline(
      { taskDescription: "x" },
      dispatcher,
      {
        projectRoot,
        workspaceCwd: join(projectRoot, "workspace"),
        pipelineId: "p",
        agents: { implementer: "implementer", reviewer: "reviewer" },
        testCommand: "bun test",
        execShell: failingShell,
        maxRetries: 1,
        execGit: async (args) => {
          if (args.includes("diff") && args.includes("--cached") && !args.includes("--stat"))
            return { stdout: "diff --git ...", stderr: "" };
          return { stdout: "", stderr: "" };
        },
      },
    );

    expect(r.status).toBe("paused");
    expect(implCount).toBe(2);
    expect(r.errorSummary).toContain("Retry budget exhausted");
    expect(r.infrastructureError).toBeUndefined();
    expect(secondImplContext).toBeDefined();
    expect(secondImplContext).toContain("expected true to be false");
    expect(secondImplContext).toContain("verify_failed");
  });

  it("review rejection retries with findings in bounded context", async () => {
    const called: string[] = [];
    let cycle = 0;
    let secondCycleImplContext: string | undefined;

    const dispatcher: Dispatcher = {
      async dispatch(cfg) {
        called.push(cfg.agent);
        if (cfg.agent === "implementer") {
          if (cycle === 1) secondCycleImplContext = cfg.context;
          return mkDispatch(0, {
            messages: [
              { role: "assistant" as const, content: [{ type: "tool_use" as const, id: "w", name: "write", input: { path: "src/a.ts" } }] },
            ] as any,
          });
        }
        if (cfg.agent === "reviewer") {
          if (cycle === 0) {
            cycle++;
            return mkDispatch(0, {
              messages: [{
                role: "assistant" as const,
                content: [{
                  type: "text" as const,
                  text: "---\nverdict: reject\n---\n\n- Missing error handling in parser\n- No edge case coverage",
                }],
              }] as any,
            });
          }
          return mkDispatch(0, {
            messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "---\nverdict: approve\n---\n" }] }] as any,
          });
        }
        return mkDispatch(1, { error: "unknown" });
      },
    };

    const r = await runPipeline(
      { taskDescription: "Implement parser" },
      dispatcher,
      {
        projectRoot,
        workspaceCwd: join(projectRoot, "workspace"),
        pipelineId: "p",
        agents: { implementer: "implementer", reviewer: "reviewer" },
        testCommand: "bun test",
        execShell: passingShell,
        maxRetries: 3,
        execGit: async (args) => {
          if (args.includes("--stat")) return { stdout: "src/a.ts | 2 ++\n", stderr: "" };
          if (args.includes("diff") && args.includes("--cached") && !args.includes("--stat"))
            return { stdout: "diff --git ...", stderr: "" };
          return { stdout: "", stderr: "" };
        },
      },
    );

    expect(r.status).toBe("completed");
    expect(r.reviewVerdict).toBe("approve");
    expect(r.infrastructureError).toBeUndefined();
    // 2 agents per cycle × 2 cycles = 4 dispatches (no verifier)
    expect(called).toEqual(["implementer", "reviewer", "implementer", "reviewer"]);
    expect(secondCycleImplContext).toContain("Missing error handling in parser");
    expect(secondCycleImplContext).toContain("review_rejected");
  });

  it("infrastructure failures (timeout) populate infrastructureError, not domain fields (AC26)", async () => {
    let tries = 0;

    const dispatcher: Dispatcher = {
      async dispatch(cfg) {
        if (cfg.agent === "implementer") {
          tries++;
          throw new Error("TimeoutError: step exceeded timeout");
        }
        return mkDispatch(0, { messages: [] as any });
      },
    };

    const r = await runPipeline(
      { taskDescription: "x" },
      dispatcher,
      {
        projectRoot,
        workspaceCwd: join(projectRoot, "workspace"),
        pipelineId: "p",
        agents: { implementer: "implementer", reviewer: "reviewer" },
        testCommand: "bun test",
        execShell: passingShell,
        maxRetries: 0,
        execGit: async () => ({ stdout: "", stderr: "" }),
      },
    );

    expect(tries).toBe(1);
    expect(r.status).toBe("paused");
    expect(r.infrastructureError).toContain("TimeoutError");
    expect(r.errorSummary).toContain("TimeoutError");
    // Domain fields NOT populated for infra failures
    expect(r.testsPassed).toBeUndefined();
    expect(r.reviewVerdict).toBeUndefined();
  });

  it("verify infrastructure failure populates infrastructureError", async () => {
    const dispatcher: Dispatcher = { async dispatch() { return mkDispatch(0, { messages: [] as any }); } };
    const throwingShell: ExecShell = async () => { throw new Error("spawn ENOENT"); };

    const r = await runPipeline(
      { taskDescription: "x" },
      dispatcher,
      { projectRoot, workspaceCwd: join(projectRoot, "ws"), pipelineId: "p", agents: { implementer: "implementer", reviewer: "reviewer" }, execGit: async () => ({ stdout: "", stderr: "" }), execShell: throwingShell, maxRetries: 0 },
    );

    expect(r.status).toBe("paused");
    expect(r.infrastructureError).toContain("ENOENT");
    expect(r.testsPassed).toBeUndefined();
  });

  it("review rejection pause includes reviewVerdict and reviewFindings", async () => {
    const dispatcher: Dispatcher = {
      async dispatch(cfg) {
        if (cfg.agent === "implementer") {
          return mkDispatch(0, {
            messages: [
              { role: "assistant" as const, content: [{ type: "tool_use" as const, id: "w", name: "write", input: { path: "src/a.ts" } }] },
            ] as any,
          });
        }
        return mkDispatch(0, {
          messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "---\nverdict: reject\n---\n\n- Missing error handling" }] }] as any,
        });
      },
    };

    const r = await runPipeline(
      { taskDescription: "x" },
      dispatcher,
      {
        projectRoot,
        workspaceCwd: join(projectRoot, "workspace"),
        pipelineId: "p",
        agents: { implementer: "implementer", reviewer: "reviewer" },
        testCommand: "bun test",
        execShell: passingShell,
        maxRetries: 0,
        execGit: async (args) => {
          if (args.includes("diff") && args.includes("--cached") && !args.includes("--stat"))
            return { stdout: "diff --git ...", stderr: "" };
          return { stdout: "", stderr: "" };
        },
      },
    );

    expect(r.status).toBe("paused");
    expect(r.reviewVerdict).toBe("reject");
    expect(r.reviewFindings).toContain("Missing error handling");
    expect(r.errorSummary).toContain("review still rejecting");
  });

  it("reviewer dispatch failure uses review_failed retry reason and populates infrastructureError", async () => {
    let implCount = 0;
    let secondImplContext: string | undefined;

    const dispatcher: Dispatcher = {
      async dispatch(cfg) {
        if (cfg.agent === "implementer") {
          implCount++;
          if (implCount === 2) secondImplContext = cfg.context;
          return mkDispatch(0, {
            messages: [
              { role: "assistant" as const, content: [{ type: "tool_use" as const, id: "w", name: "write", input: { path: "src/a.ts" } }] },
            ] as any,
          });
        }
        return mkDispatch(1, { error: "TimeoutError: reviewer timed out", messages: [] as any });
      },
    };

    const r = await runPipeline(
      { taskDescription: "x" },
      dispatcher,
      {
        projectRoot,
        workspaceCwd: join(projectRoot, "workspace"),
        pipelineId: "p",
        agents: { implementer: "implementer", reviewer: "reviewer" },
        testCommand: "bun test",
        execShell: passingShell,
        maxRetries: 1,
        execGit: async () => ({ stdout: "", stderr: "" }),
      },
    );

    expect(r.status).toBe("paused");
    expect(r.infrastructureError).toContain("TimeoutError");
    expect(implCount).toBe(2);
    expect(secondImplContext).toContain("review_failed");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-runner.test.ts`
Expected: FAIL — `PipelineAgents` missing `verifier` field / `execShell` not in `PipelineOptions` / `testCommand` not in `PipelineOptions` / `infrastructureError` not in `PipelineResult`.

**Step 3 — Write minimal implementation**

Rewrite `extensions/megapowers/subagent/pipeline-runner.ts`:

```typescript
import type { Dispatcher, DispatchConfig, DispatchResult } from "./dispatcher.js";
import { buildInitialContext, withRetryContext, renderContextPrompt } from "./pipeline-context-bounded.js";
import { parseStepResult, parseReviewOutput } from "./pipeline-results.js";
import { writeLogEntry, readPipelineLog, type PipelineLogEntry } from "./pipeline-log.js";
import { extractToolCalls } from "./message-utils.js";
import { auditTddCompliance } from "./tdd-auditor.js";
import { getWorkspaceDiff, type ExecGit } from "./pipeline-workspace.js";
import { runVerifyStep, type ExecShell } from "./pipeline-steps.js";

export interface PipelineAgents {
  implementer: string;
  reviewer: string;
}

export interface PipelineOptions {
  projectRoot: string;
  workspaceCwd: string;
  pipelineId: string;
  agents: PipelineAgents;

  maxRetries?: number;
  stepTimeoutMs?: number;

  execGit: ExecGit;
  testCommand?: string;
  execShell?: ExecShell;
}

export type PipelineStatus = "completed" | "paused";

export interface PipelineResult {
  status: PipelineStatus;
  filesChanged: string[];

  testsPassed?: boolean | null;
  testOutput?: string;

  reviewVerdict?: "approve" | "reject";
  reviewFindings?: string[];

  retryCount: number;

  logEntries?: PipelineLogEntry[];
  diff?: string;
  errorSummary?: string;
  infrastructureError?: string;
}

function asDispatchFailure(err: unknown): DispatchResult {
  return {
    exitCode: 1,
    messages: [],
    filesChanged: [],
    testsPassed: null,
    error: err instanceof Error ? err.message : String(err),
  };
}

async function safeDispatch(dispatcher: Dispatcher, cfg: DispatchConfig): Promise<DispatchResult> {
  try {
    return await dispatcher.dispatch(cfg);
  } catch (err) {
    return asDispatchFailure(err);
  }
}

const defaultExecShell: ExecShell = async (cmd, cwd) => {
  const { exec } = await import("child_process");
  return new Promise((resolve) => {
    exec(cmd, { cwd, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({
        exitCode: error && typeof (error as any).code === "number" ? (error as any).code : error ? 1 : 0,
        stdout: stdout ?? "",
        stderr: stderr ?? "",
      });
    });
  });
};

export async function runPipeline(
  input: { taskDescription: string; planSection?: string; specContent?: string; learnings?: string },
  dispatcher: Dispatcher,
  options: PipelineOptions,
): Promise<PipelineResult> {
  const maxRetries = options.maxRetries ?? 3;
  const stepTimeoutMs = options.stepTimeoutMs ?? 10 * 60 * 1000;
  const testCommand = options.testCommand ?? "bun test";
  const execShell = options.execShell ?? defaultExecShell;

  let retryCount = 0;
  let filesChanged: string[] = [];

  let ctx = buildInitialContext(input);

  for (let cycle = 0; cycle <= maxRetries; cycle++) {
    // ---------------- implement ----------------
    const t0 = Date.now();
    const impl = await safeDispatch(dispatcher, {
      agent: options.agents.implementer,
      task: input.taskDescription,
      cwd: options.workspaceCwd,
      context: renderContextPrompt(ctx),
      timeoutMs: stepTimeoutMs,
    });

    const implParsed = parseStepResult(impl);
    filesChanged = [...new Set([...filesChanged, ...implParsed.filesChanged])];

    const toolCalls = extractToolCalls(impl.messages);
    const tddReport = auditTddCompliance(toolCalls);

    writeLogEntry(options.projectRoot, options.pipelineId, {
      step: "implement",
      status: impl.exitCode === 0 ? "completed" : "failed",
      durationMs: Date.now() - t0,
      summary: impl.exitCode === 0 ? "implement ok" : "implement failed",
      error: implParsed.error,
    });

    if (impl.exitCode !== 0) {
      retryCount++;
      if (cycle >= maxRetries) {
        const { diff } = await getWorkspaceDiff(options.workspaceCwd, options.execGit);
        return {
          status: "paused",
          filesChanged,
          retryCount,
          logEntries: readPipelineLog(options.projectRoot, options.pipelineId),
          diff,
          errorSummary: `Retry budget exhausted — implement failed: ${implParsed.error ?? "unknown"}`,
          infrastructureError: implParsed.error,
        };
      }
      ctx = withRetryContext(ctx, {
        reason: "implement_failed",
        detail: implParsed.error ?? "unknown",
      });
      continue;
    }

    // ---------------- verify (shell command) ----------------
    const t1 = Date.now();
    let verify: { passed: boolean; exitCode: number; output: string; durationMs: number };
    try {
      verify = await runVerifyStep(testCommand, options.workspaceCwd, execShell);
    } catch (verifyErr) {
      const verifyMsg = verifyErr instanceof Error ? verifyErr.message : String(verifyErr);
      writeLogEntry(options.projectRoot, options.pipelineId, {
        step: "verify",
        status: "failed",
        durationMs: Date.now() - t1,
        summary: "verify infrastructure failure",
        error: verifyMsg,
      });
      retryCount++;
      if (cycle >= maxRetries) {
        const { diff } = await getWorkspaceDiff(options.workspaceCwd, options.execGit);
        return {
          status: "paused",
          filesChanged,
          retryCount,
          logEntries: readPipelineLog(options.projectRoot, options.pipelineId),
          diff,
          errorSummary: `Retry budget exhausted — verify infrastructure failure: ${verifyMsg}`,
          infrastructureError: verifyMsg,
        };
      }
      ctx = withRetryContext(ctx, {
        reason: "verify_failed",
        detail: verifyMsg,
      });
      continue;
    }
    writeLogEntry(options.projectRoot, options.pipelineId, {
      step: "verify",
      status: verify.passed ? "completed" : "failed",
      durationMs: verify.durationMs,
      summary: verify.passed ? "tests passed" : "tests failed",
      error: verify.passed ? undefined : `exit code ${verify.exitCode}`,
    });
    if (!verify.passed) {
      retryCount++;
      if (cycle >= maxRetries) {
        const { diff } = await getWorkspaceDiff(options.workspaceCwd, options.execGit);
        return {
          status: "paused",
          filesChanged,
          retryCount,
          logEntries: readPipelineLog(options.projectRoot, options.pipelineId),
          diff,
          testsPassed: false,
          testOutput: verify.output,
          errorSummary: "Retry budget exhausted — tests still failing",
        };
      }
      ctx = withRetryContext(ctx, {
        reason: "verify_failed",
        detail: verify.output,
      });
      continue;
    }

    // ---------------- review (frontmatter-parsed) ----------------
    const t2 = Date.now();
    const { diff: reviewDiff } = await getWorkspaceDiff(options.workspaceCwd, options.execGit);
    const review = await safeDispatch(dispatcher, {
      agent: options.agents.reviewer,
      task: `Review the implementation. Output your verdict as frontmatter:\n---\nverdict: approve\n---\nor\n---\nverdict: reject\n---\nThen list findings as bullet points.`,
      cwd: options.workspaceCwd,
      context: [
        renderContextPrompt(ctx),
        `## Test Results\n\n${verify.output}`,
        `## TDD Audit\n\n${JSON.stringify(tddReport)}`,
        reviewDiff ? `## Diff\n\n\`\`\`\n${reviewDiff}\n\`\`\`` : "",
      ].filter(Boolean).join("\n\n"),
      timeoutMs: stepTimeoutMs,
    });

    const reviewParsed = parseStepResult(review);

    if (review.exitCode !== 0) {
      writeLogEntry(options.projectRoot, options.pipelineId, {
        step: "review",
        status: "failed",
        durationMs: Date.now() - t2,
        summary: "review dispatch failed",
        error: reviewParsed.error,
      });

      retryCount++;
      if (cycle >= maxRetries) {
        const { diff } = await getWorkspaceDiff(options.workspaceCwd, options.execGit);
        return {
          status: "paused",
          filesChanged,
          retryCount,
          logEntries: readPipelineLog(options.projectRoot, options.pipelineId),
          diff,
          errorSummary: `Retry budget exhausted — review failed: ${reviewParsed.error ?? "unknown"}`,
          infrastructureError: reviewParsed.error,
        };
      }
      ctx = withRetryContext(ctx, {
        reason: "review_failed",
        detail: `Review dispatch failed: ${reviewParsed.error ?? "unknown"}`,
      });
      continue;
    }

    const verdict = parseReviewOutput(reviewParsed.finalOutput);

    writeLogEntry(options.projectRoot, options.pipelineId, {
      step: "review",
      status: verdict.verdict === "approve" ? "completed" : "rejected",
      durationMs: Date.now() - t2,
      summary: `verdict: ${verdict.verdict}`,
      error: verdict.verdict === "reject" ? verdict.findings.join("; ") : undefined,
    });

    if (verdict.verdict === "approve") {
      return {
        status: "completed",
        filesChanged,
        retryCount,
        testsPassed: true,
        testOutput: verify.output,
        reviewVerdict: "approve",
        reviewFindings: verdict.findings,
      };
    }

    retryCount++;
    if (cycle >= maxRetries) {
      const { diff } = await getWorkspaceDiff(options.workspaceCwd, options.execGit);
      return {
        status: "paused",
        filesChanged,
        retryCount,
        logEntries: readPipelineLog(options.projectRoot, options.pipelineId),
        diff,
        reviewVerdict: "reject",
        reviewFindings: verdict.findings,
        errorSummary: "Retry budget exhausted — review still rejecting",
      };
    }
    ctx = withRetryContext(ctx, {
      reason: "review_rejected",
      detail: verdict.findings.join("\n"),
    });
  }

  const { diff } = await getWorkspaceDiff(options.workspaceCwd, options.execGit);
  return {
    status: "paused",
    filesChanged,
    retryCount,
    logEntries: readPipelineLog(options.projectRoot, options.pipelineId),
    diff,
    errorSummary: "Unexpected pipeline exit",
  };
}
```

Also update `extensions/megapowers/subagent/pipeline-tool.ts`:

1. Remove verifier from agents line (~113):

```typescript
    agents: { implementer: "implementer", reviewer: "reviewer" },
```

2. Add `execShell` import and parameter to `handlePipelineTool`, and pass it through to `runPipeline`:

```typescript
import type { ExecShell } from "./pipeline-steps.js";

export async function handlePipelineTool(
  projectRoot: string,
  input: PipelineToolInput,
  dispatcher: Dispatcher,
  execGit: ExecGit,
  execShell?: ExecShell,
): Promise<PipelineToolOutput> {
  // ... existing validation code unchanged ...

  const result = await runPipeline(
    { taskDescription, planSection, specContent, learnings },
    dispatcher,
    {
      projectRoot,
      workspaceCwd: workspacePath,
      pipelineId,
      agents: { implementer: "implementer", reviewer: "reviewer" },
      execGit,
      execShell,
    },
  );
  // ... rest unchanged ...
}
```

3. Update `tests/pipeline-tool.test.ts` to work with the new runner (no verifier, shell-based verify, frontmatter reviewer):

Add import at the top:

```typescript
import type { ExecShell } from "../extensions/megapowers/subagent/pipeline-steps.js";
```

Replace the "on completed pipeline" test (~line 77):

```typescript
  it("on completed pipeline, squashes workspace and marks the specified task done even with null TDD state", async () => {
    tmp = setup(`# Plan\n\n### Task 1: First\n\nX\n\n### Task 2: Second\n\nY\n`);

    const gitCalls: any[] = [];
    const execGit = async (args: string[]) => {
      gitCalls.push({ args });
      return { stdout: "", stderr: "" };
    };

    const mockExecShell: ExecShell = async () => ({
      exitCode: 0,
      stdout: "1 pass\n0 fail",
      stderr: "",
    });

    const dispatcher: Dispatcher = {
      async dispatch(cfg) {
        if (cfg.agent === "reviewer") {
          return {
            exitCode: 0,
            messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "---\nverdict: approve\n---\n" }] }] as any,
            filesChanged: [],
            testsPassed: null,
          };
        }

        return {
          exitCode: 0,
          messages: [{ role: "assistant" as const, content: [{ type: "tool_use" as const, id: "w", name: "write", input: { path: "src/x.ts" } }] }] as any,
          filesChanged: [],
          testsPassed: null,
        };
      },
    };

    const r = await handlePipelineTool(tmp, { taskIndex: 2 }, dispatcher, execGit, mockExecShell);
    expect(r.error).toBeUndefined();
    expect(r.result?.status).toBe("completed");

    expect(gitCalls.some((c) => c.args.includes("worktree") && c.args.includes("remove"))).toBe(true);

    const state = readState(tmp);
    expect(state.completedTasks).toContain(2);
  });
```

Replace the "paused pipeline" test (~line 128):

```typescript
  it("paused pipeline returns log + diff + errorSummary (AC27) and resume reuses workspace", async () => {
    tmp = setup(`# Plan\n\n### Task 1: Do thing\n\nDo it.\n`);

    const gitCalls: any[] = [];
    const execGit = async (args: string[]) => {
      gitCalls.push({ args });
      if (args.includes("--stat")) return { stdout: "src/file.ts | 1 +\n", stderr: "" };
      if (args.includes("diff") && args.includes("--cached") && !args.includes("--stat")) return { stdout: "diff --git a/src/file.ts b/src/file.ts\n+new code", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const failingExecShell: ExecShell = async () => ({
      exitCode: 1,
      stdout: "0 pass\n1 fail",
      stderr: "",
    });

    const dispatcher: Dispatcher = {
      async dispatch() {
        return { exitCode: 0, messages: [] as any, filesChanged: [], testsPassed: null };
      },
    };

    const first = await handlePipelineTool(tmp, { taskIndex: 1 }, dispatcher, execGit, failingExecShell);
    expect(first.result?.status).toBe("paused");

    expect(first.paused).toBeDefined();
    expect(typeof first.paused?.errorSummary).toBe("string");
    expect((first.paused?.errorSummary ?? "").length).toBeGreaterThan(0);
    expect(Array.isArray(first.paused?.log)).toBe(true);
    expect((first.paused?.log ?? []).length).toBeGreaterThan(0);
    expect(first.paused?.diff).toContain("diff --git");

    const adds = gitCalls.filter((c) => c.args.includes("worktree") && c.args.includes("add")).length;

    const second = await handlePipelineTool(tmp, { taskIndex: 1, resume: true, guidance: "try again" }, dispatcher, execGit, failingExecShell);
    expect(second.result?.status).toBe("paused");

    const addsAfter = gitCalls.filter((c) => c.args.includes("worktree") && c.args.includes("add")).length;
    expect(addsAfter).toBe(adds);
  });
```
**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-runner.test.ts`
Expected: PASS
Run: `bun test tests/pipeline-tool.test.ts`
Expected: PASS — pipeline-tool tests use the new `execShell` parameter, frontmatter reviewer mocks, and shell-based verify mocks.
Run: `bun test`
Expected: all passing — no test references the removed `verifier` agent.

### Task 15: Add legacy deprecation comment to pipeline-context.ts [no-test] [depends: 14]

### Task 15: Add legacy deprecation comment to pipeline-context.ts [no-test] [depends: 14]

**Justification:** Documentation-only change — adds a deprecation comment to the legacy `pipeline-context.ts` module. Task 13 created `pipeline-context-bounded.ts` and Task 14 rewired the runner to use it. The old module remains for backward compatibility and its existing tests (`tests/pipeline-context.test.ts`) continue to pass unchanged. No exports are removed.

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-context.ts`

**Step 1 — Make the change**

Add a deprecation comment at the top of `extensions/megapowers/subagent/pipeline-context.ts`:

```typescript
/**
 * @deprecated Legacy unbounded pipeline context — accumulates step outputs without size limits.
 * New code should use `pipeline-context-bounded.ts` which provides `withRetryContext()` with
 * bounded replacement semantics (AC22–AC24).
 *
 * This module is kept for backward compatibility. Do not add new callers.
 */
```

Insert this before the first `export interface PipelineStepOutput {` line. Do not modify or delete any existing exports (`PipelineStepOutput`, `PipelineContext`, `buildInitialContext`, `appendStepOutput`, `setRetryContext`, `renderContextPrompt`).

**Step 2 — Verify**
Run: `bun test tests/pipeline-context.test.ts`
Expected: all passing — no functional changes, only a comment was added.

Run: `bun test`
Expected: all passing — full suite unaffected.

### Task 16: Add pipeline-tool integration test verifying exactly 2 agents dispatched [no-test] [depends: 14]

### Task 16: Add pipeline-tool integration test verifying exactly 2 agents dispatched [depends: 14]
**Files:**
- Modify: `tests/pipeline-tool.test.ts`
Task 14 already added `execShell` to `handlePipelineTool` and updated existing tests. This task adds one new focused test verifying AC15 (exactly 2 agents dispatched, no verifier) at the pipeline-tool integration level.

**Step 1 — Write the failing test**

Add this new test inside the `describe("handlePipelineTool")` block in `tests/pipeline-tool.test.ts`:

```typescript
  it("pipeline dispatches exactly 2 agents (no verifier), uses shell verify via execShell (AC15)", async () => {
    tmp = setup(`# Plan\n\n### Task 1: Do thing\n\nDo it.\n`);
    const agentsCalled: string[] = [];
    const execGit = async (args: string[]) => {
      if (args.includes("--stat")) return { stdout: "src/file.ts | 1 +\n", stderr: "" };
      if (args.includes("diff") && args.includes("--cached") && !args.includes("--stat"))
        return { stdout: "diff --git ...", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const mockExecShell: ExecShell = async () => ({
      exitCode: 0,
      stdout: "3 pass\n0 fail",
      stderr: "",
    });

    const dispatcher: Dispatcher = {
      async dispatch(cfg) {
        agentsCalled.push(cfg.agent);
        if (cfg.agent === "implementer") {
          return {
            exitCode: 0,
            messages: [{ role: "assistant" as const, content: [{ type: "tool_use" as const, id: "w", name: "write", input: { path: "src/x.ts" } }] }] as any,
            filesChanged: [],
            testsPassed: null,
          };
        }
        if (cfg.agent === "reviewer") {
          return {
            exitCode: 0,
            messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "---\nverdict: approve\n---\n" }] }] as any,
            filesChanged: [],
            testsPassed: null,
          };
        }
        return { exitCode: 1, messages: [], filesChanged: [], testsPassed: null };
      },
    };
    const r = await handlePipelineTool(tmp, { taskIndex: 1 }, dispatcher, execGit, mockExecShell);
    expect(r.error).toBeUndefined();
    expect(r.result?.status).toBe("completed");
    // AC15: No "verifier" in the agents called — only implementer + reviewer
    expect(agentsCalled).not.toContain("verifier");
    expect(agentsCalled.filter((a) => a === "implementer").length).toBe(1);
    expect(agentsCalled.filter((a) => a === "reviewer").length).toBe(1);
  });
```
**Step 2 — Verify**
Run: `bun test tests/pipeline-tool.test.ts`
Expected: PASS — the new regression guard test passes because Task 14 already removed the verifier agent.
Run: `bun test`
Expected: all passing.

**Justification for [no-test]:** Regression guard test only — no production code change. Task 14 already removed the verifier agent; this test prevents re-introduction. No RED phase is possible since the behavioral change was made in Task 14.
