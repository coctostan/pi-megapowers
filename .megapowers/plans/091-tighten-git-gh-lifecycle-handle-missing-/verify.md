# Verification Report — Issue 091: Tighten Git/GH Lifecycle

## Test Suite Results

```
bun test v1.3.9 (cf6cdbbb)

 853 pass
 0 fail
 1963 expect() calls
Ran 853 tests across 77 files. [809.00ms]
```

Targeted test runs:
- `bun test tests/sync-check.test.ts`: **4 pass, 0 fail**
- `bun test tests/vcs-commands.test.ts`: **13 pass, 0 fail**
- `bun test tests/prompt-inject.test.ts`: **33 pass, 0 fail**

---

## Per-Criterion Verification

### Criterion 1: When activating an issue while on a `feat/*` or `fix/*` branch that is NOT tracked in state, `handleIssueCommand` silently runs `git checkout main` before proceeding.

**Evidence:** `extensions/megapowers/commands.ts` lines 83-95:
```typescript
} else {
  try {
    const r = await deps.execGit(["rev-parse", "--abbrev-ref", "HEAD"]);
    const currentBranch = r.stdout.trim();
    if (currentBranch && /^(feat|fix)\//.test(currentBranch)) {
      await deps.execGit(["checkout", "main"]);
      baseBranch = "main";
    } else {
      baseBranch = currentBranch || null;
    }
  } catch { /* ignore — baseBranch stays null */ }
```
Test coverage: `tests/vcs-commands.test.ts` — "checks out main when on feat/* branch with no state.branchName (AC1)" — PASS.
Also verified: "does NOT checkout main when on main already" — PASS.

**Verdict:** pass

---

### Criterion 2: A new `checkBranchSync(execGit, baseBranch)` helper returns `{ hasRemote: boolean, behind: number, ahead: number }`.

**Evidence:** `extensions/megapowers/vcs/sync-check.ts` exists with:
```typescript
export type BranchSyncStatus = {
  hasRemote: boolean;
  behind: number;
  ahead: number;
};
export async function checkBranchSync(execGit: ExecGit, baseBranch: string): Promise<BranchSyncStatus>
```
Imported in `commands.ts` line 9: `import { checkBranchSync } from "./vcs/sync-check.js";`

**Verdict:** pass

---

### Criterion 3: `checkBranchSync` returns `{ hasRemote: false, behind: 0, ahead: 0 }` when `git remote` produces no output.

**Evidence:** `tests/sync-check.test.ts` — "returns hasRemote false when git remote produces no output (AC3)" — PASS (4/4 sync-check tests pass). Implementation: when `remoteResult.stdout.trim()` is empty, returns `{ hasRemote: false, behind: 0, ahead: 0 }`.

**Verdict:** pass

---

### Criterion 4: `checkBranchSync` returns `{ hasRemote: true, behind: 0, ahead: 0 }` when local and remote refs are identical.

**Evidence:** `tests/sync-check.test.ts` — "returns hasRemote true, behind 0, ahead 0 when local and remote are identical (AC4)" — PASS. Mock returns `"0\t0\n"` from rev-list; implementation parses `ahead=0, behind=0`.

**Verdict:** pass

---

### Criterion 5: `checkBranchSync` returns the correct `behind` count when local is behind `origin/main`.

**Evidence:** `tests/sync-check.test.ts` — "returns correct behind count when local is behind origin (AC5)" — PASS. Mock returns `"0\t3\n"` from rev-list; result is `{ hasRemote: true, behind: 3, ahead: 0 }`.

**Verdict:** pass

---

### Criterion 6: When `git fetch` fails, `checkBranchSync` returns `{ hasRemote: true, behind: 0, ahead: 0 }` (fail-open).

**Evidence:** `tests/sync-check.test.ts` — "returns hasRemote true, behind 0 when fetch fails — fail-open (AC6)" — PASS. Implementation catch block on fetch: `return { hasRemote: true, behind: 0, ahead: 0 }`.

**Verdict:** pass

---

### Criterion 7: When `checkBranchSync` reports `behind > 0`, `handleIssueCommand` prompts the user with two choices.

**Evidence:** `commands.ts` lines 99-103:
```typescript
if (syncStatus.hasRemote && syncStatus.behind > 0 && ctx.hasUI && ctx.ui.select) {
  const choice = await ctx.ui.select(
    `Local \`${baseBranch}\` is ${syncStatus.behind} commit(s) behind remote.`,
    ["Pull latest (recommended)", "Use local as-is"],
  );
```
Test: `tests/vcs-commands.test.ts` — "prompts user and pulls when behind remote and user selects 'Pull latest' (AC7/AC8)" — `selectCalled` is `true` — PASS.

**Verdict:** pass

---

### Criterion 8: When the user selects "Pull latest", `handleIssueCommand` runs `git pull`.

**Evidence:** `commands.ts` lines 104-109:
```typescript
if (choice === "Pull latest (recommended)") {
  try {
    await deps.execGit(["pull"]);
  } catch (err: any) { ... }
}
```
Test: `tests/vcs-commands.test.ts` — `expect(calls.some(c => c[0] === "pull")).toBe(true)` — PASS.

**Verdict:** pass

---

### Criterion 9: When the user selects "Use local as-is", `handleIssueCommand` proceeds without pulling.

**Evidence:** Test: `tests/vcs-commands.test.ts` — "skips pull when user selects 'Use local as-is' (AC9)" — `expect(calls.some(c => c[0] === "pull")).toBe(false)` — PASS.

**Verdict:** pass

---

### Criterion 10: When `checkBranchSync` reports `behind === 0` or `hasRemote === false`, no user prompt is shown.

**Evidence:** Tests in `tests/vcs-commands.test.ts`:
- "proceeds silently when local is in sync with remote — no prompt (AC10)": `selectCalled` is `false` — PASS.
- "proceeds silently when no remote — no prompt (AC10)": `selectCalled` is `false` — PASS.

**Verdict:** pass

---

### Criterion 11: The done prompt instructs the LLM to check `which gh` and `gh auth status` before attempting `gh pr create`.

**Evidence:** `prompts/done.md` lines 68-70:
```
**Step 2 — Check GitHub CLI availability:**
```
bash("which gh && gh auth status")
```
```
And line 79: `bash("gh pr create --base ... --head ... ...")` only follows if Step 2 checks pass.

**Verdict:** pass

---

### Criterion 12: The done prompt instructs the LLM to offer the user help setting up `gh`, and to skip PR creation if the user declines.

**Evidence:** `prompts/done.md` lines 73-75:
```
- If `gh` is **not installed**: Ask the user if they'd like help installing it (e.g., `brew install gh`). If they decline, skip PR creation and tell them: "Push succeeded. Create your PR manually at the GitHub repo page."
- If `gh` is installed but **not authenticated**: Ask the user if they'd like to run `gh auth login`. If they decline, skip PR creation with the same message.
- If both checks pass: proceed to Step 3.
```

**Verdict:** pass

---

### Criterion 13: The done prompt instructs the LLM to run `git checkout main` before calling `close_issue`.

**Evidence:** `prompts/done.md` lines 91-92:
```
All other actions are complete. Before closing:
1. Run `git checkout main` to return to the base branch — do not leave the user on the feature branch.
```

**Verdict:** pass

---

### Criterion 14: The done prompt instructs the LLM to tell the user what cleanup commands to run after merging the PR.

**Evidence:** `prompts/done.md` lines 85-88:
```
> After your PR is merged on GitHub, run these cleanup commands:
> ```
> git checkout main && git pull && git branch -d {{branch_name}}
> ```
```

**Verdict:** pass

---

## Overall Verdict

**pass**

All 14 acceptance criteria are satisfied. The implementation adds:
1. `extensions/megapowers/vcs/sync-check.ts` — new `checkBranchSync` helper (AC2-AC6)
2. `extensions/megapowers/commands.ts` — stale branch detection (AC1) and remote sync check with user prompt (AC7-AC10)
3. `prompts/done.md` — gh CLI checks, auth guidance, cleanup instructions (AC11-AC14)

Full test suite: **853 pass, 0 fail**.
